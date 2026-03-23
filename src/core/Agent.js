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
  #taskQueue = [];
  #currentTask = null;
  #cycleCount = 0;
  #working = false; // prevent overlapping LLM calls

  constructor(id, options = {}) {
    super();
    this.id = id;
    this.name = options.name || id;
    this.role = options.role || 'generalist';
    this.#bus = options.bus || null;
    this.#llm = options.llm || null;
    this.#outputDir = options.outputDir || null;
    this.#startupDescription = options.startupDescription || '';

    this.stateMachine = new StateMachine(id);
    this.energy = new EnergyManager(id, options.energyConfig);
    this.skills = new SkillManager(id, options.skills || []);
    this.memory = new AgentMemory(id);
    this.taskGenerator = new TaskGenerator(id, this.role);

    this.stateMachine.on('state-change', (data) => {
      this.emit('state-change', data);
      if (this.#bus) this.#bus.publish('agent:state-change', { ...data, agentId: id, agentName: this.name });
    });
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
      const newTasks = this.taskGenerator.generate({ role: this.role, skillGaps: [], agentState: this.state });
      this.#taskQueue.push(...newTasks.slice(0, 3));
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
      maxTokens: 1024,
      signal: AbortSignal.timeout(30000),
    });

    const content = result.content;

    // Store in memory
    this.memory.store(
      `work-${task.id}-${Date.now()}`,
      content.slice(0, 500),
      { importance: 'high', tags: [task.source || 'work', this.role] },
    );

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

    // Practice skill
    const skillUsed = this.skills.getSkills().keys().next().value || null;
    if (skillUsed) this.skills.practice(skillUsed, 0.1);

    await this.#completeTask();
  }

  #buildPrompt(task) {
    const context = this.#startupDescription
      ? `Du arbeitest als ${this.name} (${this.role}) in einem Startup: "${this.#startupDescription}".`
      : `Du bist ${this.name}, ein ${this.role} in einem Startup-Team.`;

    // Check memory for previous work
    const recentWork = this.memory.search('work').slice(-3);
    const memoryContext = recentWork.length > 0
      ? `\n\nBisherige Arbeit:\n${recentWork.map(m => `- ${m.value.slice(0, 100)}`).join('\n')}`
      : '';

    return [
      { role: 'system', content: `${context}\nDu erledigst Aufgaben gründlich und lieferst konkreten Output. Antworte auf Deutsch.${memoryContext}` },
      { role: 'user', content: `Aufgabe: ${task.title}\n\n${task.description}\n\nLiefere ein konkretes Ergebnis für diese Aufgabe.` },
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
    this.stateMachine.transition('taskComplete');
    this.emit('task-completed', { agentId: this.id, task });
    if (this.#bus) this.#bus.publish('agent:task-completed', {
      agentId: this.id, agentName: this.name, task,
    });
    this.#currentTask = null;
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
