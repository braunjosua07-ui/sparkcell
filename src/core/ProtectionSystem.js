// src/core/ProtectionSystem.js

const LOOP_THRESHOLD = 5;      // same action+target more than this many times → loop
const LOOP_WINDOW = 20;        // how many recent actions to inspect for loop detection
const ENERGY_BOOST_THRESHOLD = 3; // boost used more than this → energyExploit

/**
 * ProtectionSystem — 7-guard safety layer for SparkCell agents.
 *
 * Guards:
 *   loop           — same action+target repeated > LOOP_THRESHOLD times recently (fully implemented)
 *   skillInflation — skill level jumped > 20 in a single tick           (stub)
 *   commitmentOverload — pending commitments > 10                        (stub)
 *   isolation      — no communication events in last N actions           (stub)
 *   energyExploit  — boost used > ENERGY_BOOST_THRESHOLD times recently (stub)
 *   memoryOverflow — memory entries > 1000                               (stub)
 *   deadlock       — blocked with no help request for > 5 actions        (stub)
 */
export class ProtectionSystem {
  // Map<agentId, Array<{actionType, target, timestamp}>>
  #actionLog = new Map();

  /**
   * Record an action taken by an agent.
   * @param {string} agentId
   * @param {string} actionType
   * @param {string} target
   */
  recordAction(agentId, actionType, target) {
    if (!this.#actionLog.has(agentId)) {
      this.#actionLog.set(agentId, []);
    }
    this.#actionLog.get(agentId).push({
      actionType,
      target,
      timestamp: Date.now(),
    });
  }

  /**
   * Run all guards for agentId and return an array of violations.
   * Empty array means no violations (agent is safe).
   * @param {string} agentId
   * @returns {Array<{guard: string, message: string}>}
   */
  check(agentId) {
    const violations = [];
    const history = this.#actionLog.get(agentId) ?? [];

    this.#checkLoop(history, violations);
    this.#checkSkillInflation(agentId, violations);
    this.#checkCommitmentOverload(agentId, violations);
    this.#checkIsolation(agentId, violations);
    this.#checkEnergyExploit(agentId, violations);
    this.#checkMemoryOverflow(agentId, violations);
    this.#checkDeadlock(agentId, violations);

    return violations;
  }

  // ── Guard implementations ─────────────────────────────────────────────────

  /**
   * Loop guard: same (actionType + target) pair repeated more than LOOP_THRESHOLD
   * times within the most recent LOOP_WINDOW actions.
   */
  #checkLoop(history, violations) {
    const window = history.slice(-LOOP_WINDOW);
    const freq = new Map();
    for (const { actionType, target } of window) {
      const key = `${actionType}::${target}`;
      freq.set(key, (freq.get(key) ?? 0) + 1);
    }
    for (const [key, count] of freq) {
      if (count > LOOP_THRESHOLD) {
        violations.push({
          guard: 'loop',
          message: `Repeated action "${key}" detected ${count} times in recent history (threshold: ${LOOP_THRESHOLD}).`,
        });
      }
    }
  }

  /** Stub: skill inflation guard — wired to actual skill data in Task 10. */
  #checkSkillInflation(_agentId, _violations) {
    // Stub: returns no violations until connected to SkillManager snapshots.
  }

  /** Stub: commitment overload guard. */
  #checkCommitmentOverload(_agentId, _violations) {
    // Stub: returns no violations until connected to commitment tracker.
  }

  /** Stub: isolation guard. */
  #checkIsolation(_agentId, _violations) {
    // Stub: returns no violations until connected to communication layer.
  }

  /** Stub: energy exploit guard. */
  #checkEnergyExploit(_agentId, _violations) {
    // Stub: returns no violations until connected to EnergyManager boost log.
  }

  /** Stub: memory overflow guard. */
  #checkMemoryOverflow(_agentId, _violations) {
    // Stub: returns no violations until connected to AgentMemory.
  }

  /** Stub: deadlock guard. */
  #checkDeadlock(_agentId, _violations) {
    // Stub: returns no violations until connected to StateMachine blocked states.
  }
}
