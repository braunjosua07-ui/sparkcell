import { EventEmitter } from 'node:events';
import fs from 'node:fs/promises';
import path from 'node:path';
import { StateMachine, STATES } from './StateMachine.js';
import { EnergyManager } from './EnergyManager.js';
import { SkillManager } from './SkillManager.js';
import { AgentMemory } from './AgentMemory.js';
import { TaskGenerator } from './TaskGenerator.js';
import { ContextManager } from '../tools/ContextManager.js';
import { ProtectionSystem } from './ProtectionSystem.js';
import { ProtectionStorage } from './ProtectionStorage.js';
import { AgentMessageBus, MESSAGE_TYPE } from './AgentMessageBus.js';
import { Personality } from './Personality.js';
import { metrics } from './Metrics.js';

export class Agent extends EventEmitter {
  #bus;
  #llm;
  #outputDir;
  #startupDescription;
  #whiteboard;
  #toolRunner;
  #contextManager;
  #workDir;
  #browserManager;
  #credentialStore;
  #smtpConfig;
  #slackWebhook;
  #discordWebhook;
  #customToolsDir;
  #personality;
  #taskQueue = [];
  #completedTaskCount = 0;
  #currentTask = null;
  #cycleCount = 0;
  #working = false; // prevent overlapping LLM calls
  #peerOutputs = []; // last N outputs from other agents
  #busSubscriptions = []; // track subscriptions for cleanup
  #protection;
  #agentBus;
  #protectionStorage;
  #metrics = metrics;
  #prevSkillLevels = new Map();
  #prevPersonalityScore = 0;
  #blockedCycles = 0;

  constructor(id, options = {}) {
    super();
    this.id = id;
    this.name = options.name || id;
    this.role = options.role || 'generalist';
    this.#bus = options.bus || null;
    this.#llm = options.llm || null;
    this.#outputDir = options.outputDir || null;
    this.#startupDescription = options.startupDescription || '';
    this.#whiteboard = options.whiteboard || null;
    this.#toolRunner = options.toolRunner || null;
    this.#browserManager = options.browserManager || null;
    this.#credentialStore = options.credentialStore || null;
    this.#smtpConfig = options.smtpConfig || null;
    this.#slackWebhook = options.slackWebhook || null;
    this.#discordWebhook = options.discordWebhook || null;
    this.#workDir = options.workDir || null;
    this.#customToolsDir = options.customToolsDir || null;
    this.#contextManager = new ContextManager({ maxTokens: 128000 });

    // Initialize Personality
    const personalityTemplate = this.role === 'ceo' ? 'ceo' :
                                  this.role === 'tech' ? 'tech' :
                                  this.role === 'product' ? 'product' :
                                  this.role === 'design' ? 'design' :
                                  this.role === 'marketing' ? 'marketing' : 'generalist';
    this.#personality = new Personality(this.id, options.personality || {}, personalityTemplate);
    this.#prevPersonalityScore = this.#personality.getSoulScore();

    this.stateMachine = new StateMachine(id);
    this.energy = new EnergyManager(id, options.energyConfig);
    this.skills = new SkillManager(id, options.skills || []);
    this.memory = new AgentMemory(id);
    this.taskGenerator = new TaskGenerator(id, this.role);
    this.#protection = options.protectionSystem || new ProtectionSystem({ storage: options.protectionStorage });
    this.#protectionStorage = options.protectionStorage || new ProtectionStorage();

    // Initialize AgentMessageBus
    this.#agentBus = new AgentMessageBus(this.#bus);

    this.stateMachine.on('state-change', (data) => {
      this.emit('state-change', data);
      if (this.#bus) this.#bus.publish('agent:state-change', { ...data, agentId: id, agentName: this.name });
    });

    // Phase 1: Listen to peer outputs and task completions
    if (this.#bus) {
      const onOutput = (data) => {
        if (data.agentId === this.id) return; // skip own output
        this.#peerOutputs.push({
          agentId: data.agentId,
          agentName: data.agentName,
          task: data.task,
          preview: data.preview,
          timestamp: Date.now(),
        });
        // Keep only last 10 peer outputs
        if (this.#peerOutputs.length > 10) this.#peerOutputs.shift();
        // Store in memory for long-term recall
        this.memory.store(
          `peer-${data.agentId}-${Date.now()}`,
          `${data.agentName} completed: ${data.task} — ${data.preview?.slice(0, 150) || ''}`,
          { importance: 'medium', tags: [`peer-${data.agentId}`, 'peer-work'] },
        );
      };

      const onTaskCompleted = (data) => {
        if (data.agentId === this.id) return;
        this.memory.store(
          `peer-done-${data.agentId}-${Date.now()}`,
          `${data.agentName} finished task: ${data.task?.title || 'unknown'}`,
          { importance: 'low', tags: [`peer-${data.agentId}`, 'peer-completed'] },
        );
      };

      const onUserMessage = (data) => {
        if (data.target !== 'all' && data.target !== this.id) return;
        this.memory.store(
          `user-msg-${Date.now()}`,
          `User-Anweisung: ${data.message}`,
          { importance: 'high', tags: ['user', 'directive'] },
        );
      };

      // AgentMessageBus subscriptions
      const onAgentMessage = (data) => {
        if (data.toAgentId === this.id || data.toAgentId === 'all') {
          // Store received message in memory with tag from fromAgentId
          this.memory.store(
            `msg-${data.messageId}-${Date.now()}`,
            `Nachricht von ${data.fromAgentId}: ${data.content}`,
            { importance: 'medium', tags: [data.fromAgentId, 'message'] },
          );
          // Emit event for listeners
          this.emit('agent:message', data);
          // Publish event to bus
          if (this.#bus) this.#bus.publish('agent:message-received', data);
        }
      };

      const onHelpRequest = (data) => {
        if (data.toAgentId === this.id || data.toAgentId === 'all') {
          // Emit event for listeners
          this.emit('agent:help-request', data);
          // Publish event to bus
          if (this.#bus) this.#bus.publish('agent:help-request-received', data);
        }
      };

      this.#busSubscriptions.push(
        this.#bus.subscribe('agent:output', onOutput),
        this.#bus.subscribe('agent:task-completed', onTaskCompleted),
        this.#bus.subscribe('user:message', onUserMessage),
        this.#bus.subscribe('agent:message', onAgentMessage),
        this.#bus.subscribe('agent:help-request', onHelpRequest),
      );
    }
  }

  get state() { return this.stateMachine.currentState; }

  async runLoop() {
    if (this.#working) return; // skip if previous LLM call still running
    const cycleStart = performance.now();
    this.#cycleCount++;

    // Protection check before each cycle
    const violations = this.#runProtectionCheck();
    if (violations.length > 0 && this.#bus) {
      this.#bus.publish('agent:protection-violation', {
        agentId: this.id, agentName: this.name, violations,
      });
    }

    // Persist protection storage state after each cycle
    await this.#protection.saveToStorage(this.id);

    // Track blocked cycles for deadlock detection
    if (this.state === STATES.BLOCKED) this.#blockedCycles++;
    else this.#blockedCycles = 0;

    switch (this.state) {
      case STATES.IDLE:     await this.#handleIdle();    break;
      case STATES.WORKING:  await this.#handleWorking(); break;
      case STATES.BLOCKED:  await this.#handleBlocked(); break;
      case STATES.PAUSED:   await this.#handlePaused();  break;
      case STATES.COMPLETE: this.stateMachine.transition('auto'); break;
      case STATES.RESTED:   this.stateMachine.transition('auto'); break;
      case STATES.HELP:     break;
    }
    this.emit('cycle', { id: this.id, cycle: this.#cycleCount, state: this.state, energy: this.energy.energy });
    this.#metrics.recordTiming('agent:cycleDuration', performance.now() - cycleStart);
    this.#metrics.recordEvent('agent:cycleCount');
  }

  #runProtectionCheck() {
    const checkStart = performance.now();
    const currentSkills = new Map();
    for (const [name, data] of this.skills.getSkills()) {
      currentSkills.set(name, data.level);
    }

    const violations = this.#protection.check(this.id, {
      skillLevels: currentSkills,
      prevSkillLevels: this.#prevSkillLevels,
      commitments: this.#taskQueue.length,
      boostCount: this.energy.getStats().boosts,
      memorySize: this.memory.getStats().total,
      agentState: this.state,
      blockedActions: this.#blockedCycles,
      helpRequested: this.state === STATES.HELP,
    });

    // Snapshot current skills for next tick comparison
    this.#prevSkillLevels = currentSkills;

    // Track protection check duration
    this.#metrics.recordTiming('agent:protectionCheck', performance.now() - checkStart);
    this.#metrics.recordEvent('agent:protectionCheckCount');
    if (violations.length > 0) {
      this.#metrics.recordEvent('agent:protectionViolation', violations.length);
    }

    return violations;
  }

  async #handleIdle() {
    if (this.#taskQueue.length === 0) {
      // Phase 2: Check whiteboard for open blockers this agent could help with
      if (this.#whiteboard) {
        const wb = this.#whiteboard.getState();
        const openBlockers = wb.blockers.filter(b => !b.resolved && b.agentId !== this.id);
        for (const blocker of openBlockers.slice(0, 1)) {
          this.assignTask({
            id: `help-${blocker.id}-${Date.now()}`,
            title: `Help resolve: ${blocker.blocker}`,
            description: `A teammate (${blocker.agentId}) is blocked: "${blocker.blocker}". Use your skills as ${this.role} to help resolve this.`,
            priority: 'high',
            source: 'blocker-help',
          });
        }
      }

      // Generate context-aware tasks with whiteboard goals + skill gaps
      if (this.#taskQueue.length === 0) {
        const missionGoals = this.#whiteboard
          ? this.#whiteboard.getState().goals.map(g => g.goal)
          : [];
        const skillGaps = this.skills.findGaps(missionGoals);
        const newTasks = this.taskGenerator.generate({
          role: this.role,
          skillGaps,
          agentState: this.state,
          missionGoals,
        });
        for (const t of newTasks.slice(0, 3)) this.assignTask(t);
      }
    }
    if (this.#taskQueue.length > 0) {
      this.#currentTask = this.#taskQueue.shift();
      this.#currentTask.cyclesWorked = 0;
      this.stateMachine.transition('taskAvailable');
      this.emit('task-started', { agentId: this.id, task: this.#currentTask });
      if (this.#bus) this.#bus.publish('agent:task-started', {
        agentId: this.id,
        agentName: this.name,
        task: this.#currentTask,
      });
    }
  }

  async #handleWorking() {
    if (!this.#currentTask) { this.stateMachine.transition('taskComplete'); return; }

    this.energy.decay();
    if (this.energy.shouldForcePause()) {
      this.stateMachine.transition('energyLow');
      this.emit('energy-low', { agentId: this.id, energy: this.energy.energy });
      if (this.#bus) this.#bus.publish('agent:energy-low', {
        agentId: this.id, agentName: this.name, energy: this.energy.energy,
      });
      return;
    }

    // Record action for protection system
    this.#protection.recordAction(this.id, 'work', this.#currentTask?.title || 'unknown');

    // Track working state duration
    const workStart = performance.now();

    // Actually do work with LLM
    this.#working = true;
    try {
      if (this.#llm) {
        await this.#doLLMWork();
      } else {
        // No LLM — simulate with cycle counting
        this.#currentTask.cyclesWorked = (this.#currentTask.cyclesWorked || 0) + 1;
        if (this.#currentTask.cyclesWorked >= (this.#currentTask.estimatedCycles || 3)) {
          // Send simulated chat response for user tasks
          if (this.#currentTask.source === 'user' && this.#currentTask.conversationId && this.#bus) {
            this.#bus.publish('agent:chat-response', {
              agentId: this.id,
              agentName: this.name,
              conversationId: this.#currentTask.conversationId,
              response: `[Simulation] Task "${this.#currentTask.title}" abgeschlossen. (Kein LLM konfiguriert)`,
              task: this.#currentTask.title,
            });
          }
          await this.#completeTask();
        }
      }
    } catch (err) {
      // LLM call failed — emit event but don't crash
      if (this.#bus) this.#bus.publish('agent:error', {
        agentId: this.id, agentName: this.name,
        error: err.message, task: this.#currentTask?.title,
      });
      // Mark as blocked if LLM keeps failing
      this.#currentTask.cyclesWorked = (this.#currentTask.cyclesWorked || 0) + 1;
      if (this.#currentTask.cyclesWorked >= 5) {
        this.stateMachine.transition('blocked');
      }
    } finally {
      this.#working = false;
      // Record working duration as timing metric
      this.#metrics.recordTiming('agent:workDuration', performance.now() - workStart);
    }
  }

  async #doLLMWork() {
    const task = this.#currentTask;

    if (this.#bus) this.#bus.publish('agent:thinking', {
      agentId: this.id, agentName: this.name, task: task.title,
    });

    // If toolRunner is available, use the agentic loop; otherwise single-shot
    if (this.#toolRunner) {
      await this.#agenticLoop(task);
    } else {
      await this.#singleShotLLM(task);
    }
  }

  async #agenticLoop(task) {
    const loopStart = performance.now();
    const messages = this.#buildPrompt(task);
    const toolDefs = this.#toolRunner.getToolDefinitions('openai');
    const maxIterations = 25;
    let failCount = 0;
    let finalContent = '';

    for (let i = 0; i < maxIterations; i++) {
      // Check context budget
      if (this.#contextManager.shouldSummarize(messages)) {
        const summarized = await this.#contextManager.summarize(messages, this.#llm);
        messages.length = 0;
        messages.push(...summarized);
      }

      const llmOptions = {
        temperature: 0.8,
        maxTokens: 4096,
        tools: toolDefs,
        signal: AbortSignal.timeout(60000),
      };

      let content = '';
      let toolCalls = [];

      if (typeof this.#llm.queryStream === 'function') {
        for await (const chunk of this.#llm.queryStream(messages, llmOptions)) {
          if (chunk.type === 'token' && this.#bus) {
            this.#bus.publish('agent:token', {
              agentId: this.id, agentName: this.name, text: chunk.text,
            });
          }
          if (chunk.type === 'done') {
            content = chunk.content || '';
            toolCalls = chunk.toolCalls || [];
          }
        }
      } else {
        const result = await this.#llm.query(messages, llmOptions);
        content = result?.content || '';
        toolCalls = result?.toolCalls || [];
      }

      // If the LLM returned text with no tool calls, task is done
      if (toolCalls.length === 0) {
        finalContent = content;
        break;
      }

      // Add assistant message with tool calls to context
      messages.push({ role: 'assistant', content: content || null, tool_calls: toolCalls });

      // Execute each tool call
      for (const call of toolCalls) {
        const toolContext = {
          agentId: this.id,
          agentName: this.name,
          workDir: this.#workDir || this.#outputDir,
          outputDir: this.#outputDir,
          customToolsDir: this.#customToolsDir,
          browserManager: this.#browserManager,
          credentialStore: this.#credentialStore,
          smtpConfig: this.#smtpConfig,
          slackWebhook: this.#slackWebhook,
          discordWebhook: this.#discordWebhook,
          bus: this.#bus,
          toolRunner: this.#toolRunner,
        };

        try {
          this.#protection.recordAction(this.id, `tool:${call.name}`, JSON.stringify(call.args).slice(0, 100));
          const toolResult = await this.#toolRunner.execute(this.id, call.name, call.args, toolContext);
          const resultStr = this.#contextManager.truncateToolResult(
            JSON.stringify(toolResult),
            call.name === 'bash' ? 2000 : 4000,
          );
          messages.push({ role: 'tool', tool_call_id: call.id, content: resultStr });
          if (!toolResult.success) {
            failCount++;
            if (failCount >= 3) break;
          }
        } catch (err) {
          messages.push({
            role: 'tool', tool_call_id: call.id,
            content: JSON.stringify({ error: true, message: err.message }),
          });
          failCount++;
          if (failCount >= 3) break;
        }
      }

      if (failCount >= 3) {
        finalContent = content || 'Task abgebrochen: zu viele Tool-Fehler.';
        break;
      }

      // If LLM returned text along with tool calls, accumulate it
      if (content) finalContent += content + '\n';
    }

    const loopDuration = performance.now() - loopStart;
    this.#metrics.recordTiming('agent:agenticLoop', loopDuration);
    this.#metrics.recordEvent('agent:agenticLoopCount');

    await this.#processLLMResult(task, finalContent);
  }

  async #singleShotLLM(task) {
    const queryStart = performance.now();
    const prompt = this.#buildPrompt(task);
    const result = await this.#llm.query(prompt, {
      temperature: 0.8,
      maxTokens: 4096,
      signal: AbortSignal.timeout(60000),
    });

    const content = result?.content || '';
    if (!content) return;

    this.#metrics.recordTiming('agent:llmQuery', performance.now() - queryStart);
    this.#metrics.recordEvent('agent:llmQueryCount');

    await this.#processLLMResult(task, content);
  }

  async #processLLMResult(task, content) {
    if (!content) return;

    // Store in memory
    this.memory.store(
      `work-${task.id}-${Date.now()}`,
      content.slice(0, 500),
      { importance: 'high', tags: [task.source || 'work', this.role] },
    );

    // Parse blockers and decisions from LLM output
    this.#parseStructuredOutput(content);

    // Save output to file
    if (this.#outputDir) {
      await this.#saveOutput(task, content);
    }

    // Publish result
    if (this.#bus) {
      this.#bus.publish('agent:output', {
        agentId: this.id,
        agentName: this.name,
        task: task.title,
        preview: content.slice(0, 200),
      });

      if (task.source === 'user' && task.conversationId) {
        this.#bus.publish('agent:chat-response', {
          agentId: this.id,
          agentName: this.name,
          conversationId: task.conversationId,
          response: content,
          task: task.title,
        });
      }
    }

    // Practice the skill most relevant to this task + evaluate quality
    const matchedSkill = this.skills.learnFromTask(task, 0.2);

    if (matchedSkill) {
      const { score, reasons } = this.skills.evaluateQuality(content, matchedSkill);
      const feedback = this.skills.applyFeedback(matchedSkill, score, {
        bus: this.#bus,
        agentId: this.id,
        agentName: this.name,
      });

      if (this.#bus) {
        this.#bus.publish('agent:skill-evaluation', {
          agentId: this.id,
          agentName: this.name,
          skill: matchedSkill,
          score,
          reasons,
          needsTraining: feedback.needsTraining,
        });
      }

      // Emit soul evolution event periodically
      const memoryStats = this.memory.getStats();
      const soulScore = this.skills.getSoulScore(memoryStats);
      this.skills.emitSoulEvent(soulScore, {
        bus: this.#bus,
        agentId: this.id,
        agentName: this.name,
      });

      // Apply quality-based personality adjustments
      const personalityChanges = this.#personality.adjustFromQuality(score, matchedSkill);
      const currentSoulScore = this.#personality.getSoulScore();

      // Emit soul evolution event for personality changes
      if (Object.keys(personalityChanges).length > 0 || currentSoulScore !== this.#prevPersonalityScore) {
        if (this.#bus) {
          this.#bus.publish('agent:soul-evolution', {
            agentId: this.id,
            agentName: this.name,
            changes: personalityChanges,
            oldSoulScore: this.#prevPersonalityScore,
            newSoulScore: currentSoulScore,
          });
        }
        this.#prevPersonalityScore = currentSoulScore;
      }

      if (feedback.needsTraining && feedback.trainingTask) {
        this.assignTask({
          id: `training-${matchedSkill}-${Date.now()}`,
          ...feedback.trainingTask,
        });
        this.memory.store(
          `skill-gap-${matchedSkill}-${Date.now()}`,
          `Skill "${matchedSkill}" braucht Training (Score: ${(score * 100).toFixed(0)}%). Gründe: ${reasons.join(', ')}`,
          { importance: 'high', tags: ['self-improvement', matchedSkill] },
        );
      }
    }

    await this.#completeTask();
  }

  #buildPrompt(task) {
    const context = this.#startupDescription
      ? `Du arbeitest als ${this.name} (${this.role}) in einem Startup: "${this.#startupDescription}".`
      : `Du bist ${this.name}, ein ${this.role} in einem Startup-Team.`;

    // Personality context — inject Big Five traits and character attributes
    const personalityString = this.#personality.getPromptString();
    const personalityContext = personalityString
      ? `\n\n${personalityString}`
      : '';

    // Check memory for previous work
    const recentWork = this.memory.search('work').slice(-3);
    const memoryContext = recentWork.length > 0
      ? `\n\nDeine bisherige Arbeit:\n${recentWork.map(m => `- ${m.content.slice(0, 100)}`).join('\n')}`
      : '';

    // Phase 1: Peer context — what teammates have been doing
    const recentPeers = this.#peerOutputs.slice(-3);
    const peerContext = recentPeers.length > 0
      ? `\n\nWas deine Teamkollegen gerade gemacht haben:\n${recentPeers.map(p => `- ${p.agentName}: ${p.task} — ${p.preview?.slice(0, 100) || ''}`).join('\n')}`
      : '';

    // Phase 2: Whiteboard context — mission, goals, blockers
    let whiteboardContext = '';
    if (this.#whiteboard) {
      const wb = this.#whiteboard.getState();
      const parts = [];
      if (wb.mission) parts.push(`Mission: ${wb.mission}`);
      if (wb.goals.length > 0) parts.push(`Ziele:\n${wb.goals.map(g => `  - ${g.goal}`).join('\n')}`);
      const openBlockers = wb.blockers.filter(b => !b.resolved);
      if (openBlockers.length > 0) parts.push(`Offene Blocker:\n${openBlockers.map(b => `  - [${b.agentId}] ${b.blocker}`).join('\n')}`);
      if (wb.decisions.length > 0) {
        const recentDecisions = wb.decisions.slice(-3);
        parts.push(`Letzte Entscheidungen:\n${recentDecisions.map(d => `  - ${d.decision}`).join('\n')}`);
      }
      if (parts.length > 0) whiteboardContext = `\n\nTeam-Whiteboard:\n${parts.join('\n')}`;
    }

    // Skill context — agent knows what it's good/bad at
    const skillSummary = this.skills.getSkillSummary();
    const skillContext = skillSummary
      ? `\n\nDeine Skills: ${skillSummary}`
      : '';

    const systemPrompt = [
      context,
      personalityContext,
      'Du erledigst Aufgaben gründlich und lieferst konkreten Output. Antworte auf Deutsch.',
      'Koordiniere dich mit deinem Team. Beziehe dich auf die Arbeit deiner Kollegen.',
      'Wenn du auf ein Problem stößt das du nicht alleine lösen kannst, melde es mit: [BLOCKER: Beschreibung]',
      'Wenn du eine wichtige Entscheidung triffst, markiere sie mit: [DECISION: Beschreibung]',
      skillContext,
      memoryContext,
      peerContext,
      whiteboardContext,
    ].filter(Boolean).join('\n');

    // If this is a direct user message, frame it as a conversation
    const isUserMessage = task.source === 'user';
    const userContent = isUserMessage
      ? `Der User hat dir direkt geschrieben: "${task.description.replace(/^.*?:\s*"?|"?\s*\.?\s*Reagiere darauf.*$/g, '')}"\n\nAntworte direkt und hilfreich. Halte deine Antwort kurz und klar.`
      : `Aufgabe: ${task.title}\n\n${task.description}\n\nLiefere ein konkretes Ergebnis für diese Aufgabe. Berücksichtige was deine Teamkollegen bereits erarbeitet haben.`;

    return [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContent },
    ];
  }

  /**
   * Send a message to another agent.
   * @param {string} agentId - Target agent ID (or 'all' for broadcast)
   * @param {string|Object} content - Message content
   * @param {Object} [options] - Additional options
   * @returns {string} The generated message ID
   */
  sendTo(agentId, content, options = {}) {
    return this.#agentBus.send(this.id, agentId, content, options);
  }

  /**
   * Request help from another agent.
   * @param {string} agentId - Target agent ID (or 'all' for broadcast)
   * @param {string} description - Help description
   * @returns {string} The generated message ID
   */
  requestHelp(agentId, description) {
    return this.#agentBus.requestHelp(this.id, agentId, description);
  }

  async #saveOutput(task, content) {
    const docsDir = path.join(this.#outputDir, 'docs');
    await fs.mkdir(docsDir, { recursive: true });
    const slug = task.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const filename = `${this.id}-${slug}.md`;
    const header = `# ${task.title}\n\n> Agent: ${this.name} (${this.role})\n> Datum: ${new Date().toISOString()}\n\n---\n\n`;
    await fs.writeFile(path.join(docsDir, filename), header + content);
  }

  async #completeTask() {
    const task = this.#currentTask;
    this.#learnFromOutcome(task, true);
    this.taskGenerator.markCompleted(task.title);
    this.stateMachine.transition('taskComplete');
    this.emit('task-completed', { agentId: this.id, task });
    if (this.#bus) this.#bus.publish('agent:task-completed', {
      agentId: this.id, agentName: this.name, task,
    });
    this.#currentTask = null;
  }

  /**
   * Parse [BLOCKER: ...] and [DECISION: ...] markers from LLM output.
   */
  #parseStructuredOutput(content) {
    // Parse blockers
    const blockerRegex = /\[BLOCKER:\s*(.+?)\]/gi;
    let blockerMatch;
    while ((blockerMatch = blockerRegex.exec(content)) !== null) {
      if (this.#whiteboard) {
        const blockerId = this.#whiteboard.addBlocker(this.id, blockerMatch[1].trim());
        if (this.#bus) this.#bus.publish('whiteboard:blocker-added', {
          blockerId, agentId: this.id, agentName: this.name, blocker: blockerMatch[1].trim(),
        });
      }
    }

    // Parse decisions
    const decisionRegex = /\[DECISION:\s*(.+?)\]/gi;
    let decisionMatch;
    while ((decisionMatch = decisionRegex.exec(content)) !== null) {
      if (this.#whiteboard) {
        const decisionId = this.#whiteboard.addDecision(decisionMatch[1].trim());
        if (this.#bus) this.#bus.publish('whiteboard:decision-added', {
          decisionId, agentId: this.id, agentName: this.name, decision: decisionMatch[1].trim(),
        });
      }
    }
  }

  async #handleBlocked() {
    const timeBlocked = this.stateMachine.getTimeInState();
    if (timeBlocked > 30000) this.stateMachine.transition('timeout');
  }

  async #handlePaused() {
    this.energy.recover();
    if (this.energy.canResume()) this.stateMachine.transition('energyRestored');
  }

  #learnFromOutcome(task, success) {
    if (success && task) {
      this.memory.store(
        `completed-${task.id}`,
        `Completed: ${task.title}`,
        { importance: 'medium', tags: ['completed', task.source || 'unknown'] },
      );
    }
  }

  destroy() {
    for (const unsub of this.#busSubscriptions) unsub();
    this.#busSubscriptions = [];
    // Save protection storage state before cleanup
    this.#protection.saveToStorage(this.id);
    this.removeAllListeners();
  }

  assignTask(task) {
    if (this.#taskQueue.length >= 200) {
      this.#taskQueue.shift(); // drop oldest to stay within limit
    }
    this.#taskQueue.push(task);
  }

  getStatus() {
    const memoryStats = this.memory?.getStats?.() || { total: 0 };
    const soulScore = this.skills?.getSoulScore?.(memoryStats) || 0;
    const personalitySoulScore = this.#personality?.getSoulScore?.() || 0;

    return {
      id: this.id,
      name: this.name,
      role: this.role,
      state: this.state,
      energy: this.energy.energy,
      currentTask: this.#currentTask,
      queueLength: this.#taskQueue.length,
      cycleCount: this.#cycleCount,
      soulScore,
      personalitySoulScore,
      personality: this.#personality?.getDescription?.(),
      personalityTraits: this.#personality?.traits,
      memoryStats,
      metrics: this.getMetrics(),
    };
  }

  getMetrics() {
    return {
      cycleDuration: this.#metrics.getStats('agent:cycleDuration'),
      workDuration: this.#metrics.getStats('agent:workDuration'),
      protectionCheck: this.#metrics.getStats('agent:protectionCheck'),
      llmQuery: this.#metrics.getStats('agent:llmQuery'),
      agenticLoop: this.#metrics.getStats('agent:agenticLoop'),
      protectionViolation: this.#metrics.getStats('agent:protectionViolation'),
      globalMemory: this.#metrics.getMemoryStats(),
    };
  }

  async save() {
    await this.energy.save();
    const personalityPath = path.join(this.#workDir || this.#outputDir || '.', `${this.id}-personality.json`);
    await fs.writeFile(personalityPath, JSON.stringify(this.#personality.traits, null, 2));
  }

  async load() {
    await this.energy.load();
    const personalityPath = path.join(this.#workDir || this.#outputDir || '.', `${this.id}-personality.json`);
    try {
      const data = await fs.readFile(personalityPath, 'utf8');
      const loadedTraits = JSON.parse(data);
      // Merge loaded traits with existing personality
      this.#personality.setTraits(loadedTraits);
      this.#prevPersonalityScore = this.#personality.getSoulScore();
    } catch {
      // No saved personality — use default
    }
  }
}
