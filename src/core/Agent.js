import { EventEmitter } from 'node:events';
import { StateMachine, STATES } from './StateMachine.js';
import { EnergyManager } from './EnergyManager.js';
import { SkillManager } from './SkillManager.js';
import { AgentMemory } from './AgentMemory.js';
import { TaskGenerator } from './TaskGenerator.js';

export class Agent extends EventEmitter {
  #bus;
  #llm;
  #docs;
  #taskQueue = [];
  #currentTask = null;
  #cycleCount = 0;

  constructor(id, options = {}) {
    super();
    this.id = id;
    this.name = options.name || id;
    this.role = options.role || 'generalist';
    this.#bus = options.bus || null;
    this.#llm = options.llm || null;
    this.#docs = options.docs || null;

    this.stateMachine = new StateMachine(id);
    this.energy = new EnergyManager(id, options.energyConfig);
    this.skills = new SkillManager(id, options.skills || []);
    this.memory = new AgentMemory(id);
    this.taskGenerator = new TaskGenerator(id, this.role);

    this.stateMachine.on('state-change', (data) => {
      this.emit('state-change', data);
      if (this.#bus) this.#bus.publish('agent:state-change', { ...data, agentName: this.name });
    });
  }

  get state() { return this.stateMachine.currentState; }

  async runLoop() {
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
      this.stateMachine.transition('taskAvailable');
      this.emit('task-started', { agentId: this.id, task: this.#currentTask });
      if (this.#bus) this.#bus.publish('agent:task-started', { agentId: this.id, task: this.#currentTask });
    }
  }

  async #handleWorking() {
    if (!this.#currentTask) { this.stateMachine.transition('taskComplete'); return; }
    this.energy.decay();
    if (this.energy.shouldForcePause()) {
      this.stateMachine.transition('energyLow');
      this.emit('energy-low', { agentId: this.id, energy: this.energy.energy });
      return;
    }
    const action = this.#evaluateNextAction();
    if (action.type === 'complete') {
      this.#learnFromOutcome(this.#currentTask, true);
      this.stateMachine.transition('taskComplete');
      this.emit('task-completed', { agentId: this.id, task: this.#currentTask });
      if (this.#bus) this.#bus.publish('agent:task-completed', { agentId: this.id, task: this.#currentTask });
      this.#currentTask = null;
    } else if (action.type === 'blocked') {
      this.stateMachine.transition('blocked');
    } else {
      if (action.skillUsed) this.skills.practice(action.skillUsed, 0.1);
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

  #evaluateNextAction() {
    if (!this.#currentTask) return { type: 'complete' };
    const taskCycles = this.#currentTask.estimatedCycles || 3;
    this.#currentTask.cyclesWorked = (this.#currentTask.cyclesWorked || 0) + 1;
    if (this.#currentTask.cyclesWorked >= taskCycles) return { type: 'complete' };
    const skillUsed = this.skills.getSkills().keys().next().value || null;
    return { type: 'continue', skillUsed };
  }

  #shouldCollaborate() { return this.#currentTask && this.#currentTask.priority === 'high'; }
  #assessRisk(action) { return { level: 'low', proceed: true }; }
  #learnFromOutcome(task, success) {
    if (success && task) {
      this.memory.store(
        `completed-${task.id}`,
        `Completed: ${task.title}`,
        { importance: 'medium', tags: ['completed', task.source || 'unknown'] }
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
