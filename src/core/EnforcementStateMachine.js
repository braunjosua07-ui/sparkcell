import { StateMachine, STATES } from './StateMachine.js';

export const ENFORCEMENT_STATES = {
  ...STATES,
  VALIDATING: 'VALIDATING',
  ENFORCING: 'ENFORCING',
};

export class EnforcementStateMachine extends StateMachine {
  constructor(agentId, options = {}) {
    super(agentId, options);
    this.enforcementRules = options.rules || [];
  }

  async validateAction(action) {
    const previousState = this.currentState;
    this.currentState = ENFORCEMENT_STATES.VALIDATING;
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
      this.currentState = ENFORCEMENT_STATES.ENFORCING;
      this.emit('state-change', {
        from: ENFORCEMENT_STATES.VALIDATING,
        to: ENFORCEMENT_STATES.ENFORCING,
        event: 'violations-found',
        agentId: this.agentId,
      });
      // Restore to previous state after enforcement
      this.currentState = previousState;
      this.emit('state-change', {
        from: ENFORCEMENT_STATES.ENFORCING,
        to: previousState,
        event: 'enforcement-complete',
        agentId: this.agentId,
      });
      return { valid: false, violations };
    }

    // Restore to previous state after clean validation
    this.currentState = previousState;
    this.emit('state-change', {
      from: ENFORCEMENT_STATES.VALIDATING,
      to: previousState,
      event: 'validation-passed',
      agentId: this.agentId,
    });
    return { valid: true, violations: [] };
  }
}
