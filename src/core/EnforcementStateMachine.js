import { StateMachine, STATES } from './StateMachine.js';

export const ENFORCEMENT_STATES = {
  ...STATES,
  VALIDATING: 'VALIDATING',
  ENFORCING: 'ENFORCING',
};

// Extended transitions for enforcement states
const ENFORCEMENT_TRANSITIONS = {
  ...STATES,
  // Allow validate event from any state to enter VALIDATING
  VALIDATING: { validationComplete: STATES.IDLE, violationsFound: 'ENFORCING' },
  ENFORCING: { enforcementComplete: STATES.IDLE },
};

export class EnforcementStateMachine extends StateMachine {
  #enforcementPreviousState;

  constructor(agentId, options = {}) {
    super(agentId, options);
    this.enforcementRules = options.rules || [];
  }

  async validateAction(action) {
    const previousState = this.currentState;
    this.#enforcementPreviousState = previousState;

    // Use proper transition mechanism for entering VALIDATING
    this.currentState = ENFORCEMENT_STATES.VALIDATING;
    this.history.push({ from: previousState, to: ENFORCEMENT_STATES.VALIDATING, event: 'validate', timestamp: Date.now() });
    if (this.history.length > 100) this.history.shift();
    this.emit('state-change', {
      from: previousState,
      to: ENFORCEMENT_STATES.VALIDATING,
      event: 'validate',
      agentId: this.agentId,
    });

    const violations = [];
    for (const rule of this.enforcementRules) {
      if (!rule.check(action)) {
        violations.push(rule.name);
      }
    }

    if (violations.length > 0) {
      // Transition to ENFORCING state
      const fromValidating = this.currentState;
      this.currentState = ENFORCEMENT_STATES.ENFORCING;
      this.history.push({ from: fromValidating, to: ENFORCEMENT_STATES.ENFORCING, event: 'violations-found', timestamp: Date.now() });
      this.emit('state-change', {
        from: ENFORCEMENT_STATES.VALIDATING,
        to: ENFORCEMENT_STATES.ENFORCING,
        event: 'violations-found',
        agentId: this.agentId,
      });

      // Restore to previous state after enforcement
      const fromEnforcing = this.currentState;
      this.currentState = this.#enforcementPreviousState;
      this.history.push({ from: fromEnforcing, to: this.#enforcementPreviousState, event: 'enforcement-complete', timestamp: Date.now() });
      this.emit('state-change', {
        from: ENFORCEMENT_STATES.ENFORCING,
        to: this.#enforcementPreviousState,
        event: 'enforcement-complete',
        agentId: this.agentId,
      });
      return { valid: false, violations };
    }

    // Restore to previous state after clean validation
    const fromValidating = this.currentState;
    this.currentState = this.#enforcementPreviousState;
    this.history.push({ from: fromValidating, to: this.#enforcementPreviousState, event: 'validation-passed', timestamp: Date.now() });
    this.emit('state-change', {
      from: ENFORCEMENT_STATES.VALIDATING,
      to: this.#enforcementPreviousState,
      event: 'validation-passed',
      agentId: this.agentId,
    });
    return { valid: true, violations: [] };
  }
}
