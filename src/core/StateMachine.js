import { EventEmitter } from 'node:events';

export const STATES = {
  IDLE: 'IDLE',
  WORKING: 'WORKING',
  BLOCKED: 'BLOCKED',
  PAUSED: 'PAUSED',
  HELP: 'HELP',
  COMPLETE: 'COMPLETE',
  RESTED: 'RESTED',
};

const TRANSITIONS = {
  [STATES.IDLE]:     { taskAvailable: STATES.WORKING, noTasks: STATES.IDLE },
  [STATES.WORKING]:  { taskComplete: STATES.COMPLETE, blocked: STATES.BLOCKED, energyLow: STATES.PAUSED, continue: STATES.WORKING },
  [STATES.BLOCKED]:  { helpReceived: STATES.WORKING, timeout: STATES.HELP, continue: STATES.BLOCKED },
  [STATES.PAUSED]:   { energyRestored: STATES.RESTED, emergency: STATES.WORKING, continue: STATES.PAUSED },
  [STATES.HELP]:     { resolved: STATES.IDLE, continue: STATES.HELP },
  [STATES.COMPLETE]: { auto: STATES.IDLE },
  [STATES.RESTED]:   { auto: STATES.IDLE },
};

export class StateMachine extends EventEmitter {
  #maxHistory;
  #callbacks;

  constructor(agentId, options = {}) {
    super();
    this.agentId = agentId;
    this.currentState = STATES.IDLE;
    this.history = [];
    this.#maxHistory = options.maxHistory || 100;
    this.#callbacks = new Map();
    this.stateTimers = new Map();
    this.stateTimers.set(STATES.IDLE, Date.now());
  }

  transition(event) {
    const allowed = TRANSITIONS[this.currentState];
    if (!allowed || !(event in allowed)) return false;

    const from = this.currentState;
    const to = allowed[event];

    this.history.push({ from, to, event, timestamp: Date.now() });
    if (this.history.length > this.#maxHistory) this.history.shift();

    this.currentState = to;
    this.stateTimers.set(to, Date.now());

    // Fire callbacks
    const key = `${from}->${to}`;
    const cb = this.#callbacks.get(key);
    if (cb) cb({ from, to, event });

    this.emit('state-change', { from, to, event, agentId: this.agentId });
    return true;
  }

  onTransition(from, to, callback) {
    this.#callbacks.set(`${from}->${to}`, callback);
  }

  getTimeInState() {
    const entered = this.stateTimers.get(this.currentState) || Date.now();
    return Date.now() - entered;
  }

  canTransition(event) {
    const allowed = TRANSITIONS[this.currentState];
    return allowed ? event in allowed : false;
  }
}
