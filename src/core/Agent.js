import { EventEmitter } from 'node:events';
import fs from 'node:fs/promises';
import path from 'node:path';
import { StateMachine, STATES } from './StateMachine.js';
import { EnergyManager } from './EnergyManager.js';
import { SkillManager } from './SkillManager.js';
import { AgentMemory } from './AgentMemory.js';
import { TaskGenerator } from './TaskGenerator.js';

export class Agent extends EventEmitter {
  #bus;
  #llm;
  #outputDir;
  #startupDescription;
  #whiteboard;
  #taskQueue = [];
  #currentTask = null;
  #cycleCount = 0;
  #working = false; // prevent overlapping LLM calls
  #peerOutputs = []; // last N outputs from other agents

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

    this.stateMachine = new StateMachine(id);
    this.energy = new EnergyManager(id, options.energyConfig);
    this.skills = new SkillManager(id, options.skills || []);
    this.memory = new AgentMemory(id);
    this.taskGenerator = new TaskGenerator(id, this.role);

    this.stateMachine.on('state-change', (data) => {
      this.emit('state-change', data);
      if (this.#bus) this.#bus.publish('agent:state-change', { ...data, agentId: id, agentName: this.name });
    });

    // Phase 1: Listen to peer outputs and task completions
    if (this.#bus) {
      this.#bus.subscribe('agent:output', (data) => {
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
      });

      this.#bus.subscribe('agent:task-completed', (data) => {
        if (data.agentId === this.id) return;
        this.memory.store(
          `peer-done-${data.agentId}-${Date.now()}`,
          `${data.agentName} finished task: ${data.task?.title || 'unknown'}`,
          { importance: 'low', tags: [`peer-${data.agentId}`, 'peer-completed'] },
        );
      });
    }
  }

  get state() { return this.stateMachine.currentState; }

  async runLoop() {
    if (this.#working) return; // skip if previous LLM call still running
    this.#cycleCount++;
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
  }

  async #handleIdle() {
    if (this.#taskQueue.length === 0) {
      // Phase 2: Check whiteboard for open blockers this agent could help with
      if (this.#whiteboard) {
        const wb = this.#whiteboard.getState();
        const openBlockers = wb.blockers.filter(b => !b.resolved && b.agentId !== this.id);
        for (const blocker of openBlockers.slice(0, 1)) {
          this.#taskQueue.push({
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
        this.#taskQueue.push(...newTasks.slice(0, 3));
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

    // Actually do work with LLM
    this.#working = true;
    try {
      if (this.#llm) {
        await this.#doLLMWork();
      } else {
        // No LLM — simulate with cycle counting
        this.#currentTask.cyclesWorked = (this.#currentTask.cyclesWorked || 0) + 1;
        if (this.#currentTask.cyclesWorked >= (this.#currentTask.estimatedCycles || 3)) {
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
    }
  }

  async #doLLMWork() {
    const task = this.#currentTask;
    const prompt = this.#buildPrompt(task);

    if (this.#bus) this.#bus.publish('agent:thinking', {
      agentId: this.id, agentName: this.name, task: task.title,
    });

    const result = await this.#llm.query(prompt, {
      temperature: 0.8,
      maxTokens: 4096,
      signal: AbortSignal.timeout(60000),
    });

    const content = result?.content || '';
    if (!content) return; // LLM returned empty — skip, retry next cycle

    // Store in memory
    this.memory.store(
      `work-${task.id}-${Date.now()}`,
      content.slice(0, 500),
      { importance: 'high', tags: [task.source || 'work', this.role] },
    );

    // Phase 2: Parse blockers and decisions from LLM output
    this.#parseStructuredOutput(content);

    // Save output to file
    if (this.#outputDir) {
      await this.#saveOutput(task, content);
    }

    // Publish result
    if (this.#bus) this.#bus.publish('agent:output', {
      agentId: this.id,
      agentName: this.name,
      task: task.title,
      preview: content.slice(0, 200),
      tokens: result.usage?.total_tokens || 0,
    });

    // Practice the skill most relevant to this task
    this.skills.learnFromTask(task, 0.2);

    await this.#completeTask();
  }

  #buildPrompt(task) {
    const context = this.#startupDescription
      ? `Du arbeitest als ${this.name} (${this.role}) in einem Startup: "${this.#startupDescription}".`
      : `Du bist ${this.name}, ein ${this.role} in einem Startup-Team.`;

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
      'Du erledigst Aufgaben gründlich und lieferst konkreten Output. Antworte auf Deutsch.',
      'Koordiniere dich mit deinem Team. Beziehe dich auf die Arbeit deiner Kollegen.',
      'Wenn du auf ein Problem stößt das du nicht alleine lösen kannst, melde es mit: [BLOCKER: Beschreibung]',
      'Wenn du eine wichtige Entscheidung triffst, markiere sie mit: [DECISION: Beschreibung]',
      skillContext,
      memoryContext,
      peerContext,
      whiteboardContext,
    ].filter(Boolean).join('\n');

    return [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Aufgabe: ${task.title}\n\n${task.description}\n\nLiefere ein konkretes Ergebnis für diese Aufgabe. Berücksichtige was deine Teamkollegen bereits erarbeitet haben.` },
    ];
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

  assignTask(task) { this.#taskQueue.push(task); }

  getStatus() {
    return {
      id: this.id,
      name: this.name,
      role: this.role,
      state: this.state,
      energy: this.energy.energy,
      currentTask: this.#currentTask,
      queueLength: this.#taskQueue.length,
      cycleCount: this.#cycleCount,
    };
  }

  async save() { await this.energy.save(); }
  async load() { await this.energy.load(); }
}
