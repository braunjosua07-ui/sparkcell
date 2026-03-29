// src/core/ProtectionSystem.js

import { ProtectionStorage } from './ProtectionStorage.js';

const LOOP_THRESHOLD = 8;
const LOOP_WINDOW = 30;
const ENERGY_BOOST_THRESHOLD = 3;
const SKILL_JUMP_THRESHOLD = 20;
const COMMITMENT_LIMIT = 10;
const ISOLATION_WINDOW = 50;   // actions without any communication → isolated (high because solo work is normal)
const MEMORY_LIMIT = 1000;
const DEADLOCK_ACTIONS = 5;    // blocked for this many actions without help request

/**
 * ProtectionSystem — 7-guard safety layer for SparkCell agents.
 *
 * Guards:
 *   loop              — same action+target repeated > LOOP_THRESHOLD times recently
 *   skillInflation    — skill level jumped > 20 in a single tick
 *   commitmentOverload — pending commitments > 10
 *   isolation         — no communication events in last N actions
 *   energyExploit     — boost used > ENERGY_BOOST_THRESHOLD times recently
 *   memoryOverflow    — memory entries > MEMORY_LIMIT
 *   deadlock          — blocked with no help request for > DEADLOCK_ACTIONS actions
 *
 * context parameter for check():
 *   skillLevels:     Map<string, number>   — current skill levels
 *   prevSkillLevels: Map<string, number>   — previous tick levels
 *   commitments:     number                — pending commitment count
 *   boostCount:      number                — energy boosts in recent window
 *   memorySize:      number                — current AgentMemory entry count
 *   agentState:      string                — current StateMachine state
 *   blockedActions:  number                — consecutive actions spent in blocked state
 *   helpRequested:   boolean               — whether help was requested while blocked
 */
export class ProtectionSystem {
  #actionLog = new Map();
  #storage;

  constructor(options = {}) {
    this.#storage = options.storage || new ProtectionStorage();
  }

  recordAction(agentId, actionType, target) {
    if (!this.#actionLog.has(agentId)) {
      this.#actionLog.set(agentId, []);
    }
    const actions = this.#actionLog.get(agentId);
    const action = { actionType, target, timestamp: Date.now() };
    actions.push(action);
    if (actions.length > 1000) actions.shift();
    this.#storage.add(agentId, action);
  }

  /**
   * Load actions from storage for agent.
   * @param {string} agentId
   * @returns {Promise<Array>} Array of loaded actions
   */
  async loadFromStorage(agentId) {
    return this.#storage.load(agentId);
  }

  /**
   * Save current action log to storage.
   * @param {string} agentId
   * @returns {Promise<void>}
   */
  async saveToStorage(agentId) {
    if (this.#actionLog.has(agentId)) {
      const actions = this.#actionLog.get(agentId);
      // Save directly without adding to storage buffer (which would duplicate)
      await this.#storage.save(agentId, actions);
    }
  }

  /**
   * Run all guards and return violations. Empty array = safe.
   */
  check(agentId, context = {}) {
    const violations = [];
    const history = this.#actionLog.get(agentId) ?? [];

    this.#checkLoop(history, violations);
    this.#checkSkillInflation(context, violations);
    this.#checkCommitmentOverload(context, violations);
    this.#checkIsolation(history, violations);
    this.#checkEnergyExploit(context, violations);
    this.#checkMemoryOverflow(context, violations);
    this.#checkDeadlock(context, violations);

    return violations;
  }

  // ── Guard implementations ─────────────────────────────────────────────────

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

  #checkSkillInflation(context, violations) {
    const { skillLevels, prevSkillLevels } = context;
    if (!skillLevels || !prevSkillLevels) return;
    for (const [skill, level] of skillLevels) {
      const prev = prevSkillLevels.get(skill) ?? 0;
      // Skip newly discovered skills (prev was 0 = not tracked before)
      if (prev === 0) continue;
      if (level - prev > SKILL_JUMP_THRESHOLD) {
        violations.push({
          guard: 'skillInflation',
          message: `Skill "${skill}" jumped ${level - prev} levels in one tick (${prev} → ${level}, threshold: ${SKILL_JUMP_THRESHOLD}).`,
        });
      }
    }
  }

  #checkCommitmentOverload(context, violations) {
    const { commitments } = context;
    if (commitments == null) return;
    if (commitments > COMMITMENT_LIMIT) {
      violations.push({
        guard: 'commitmentOverload',
        message: `Agent has ${commitments} pending commitments (limit: ${COMMITMENT_LIMIT}).`,
      });
    }
  }

  #checkIsolation(history, violations) {
    const window = history.slice(-ISOLATION_WINDOW);
    if (window.length < ISOLATION_WINDOW) return; // not enough data yet
    const hasComm = window.some(a => a.actionType.startsWith('comm:') || a.actionType.startsWith('chat:'));
    if (!hasComm) {
      violations.push({
        guard: 'isolation',
        message: `No communication in last ${ISOLATION_WINDOW} actions — agent may be isolated.`,
      });
    }
  }

  #checkEnergyExploit(context, violations) {
    const { boostCount } = context;
    if (boostCount == null) return;
    if (boostCount > ENERGY_BOOST_THRESHOLD) {
      violations.push({
        guard: 'energyExploit',
        message: `Energy boosted ${boostCount} times recently (threshold: ${ENERGY_BOOST_THRESHOLD}).`,
      });
    }
  }

  #checkMemoryOverflow(context, violations) {
    const { memorySize } = context;
    if (memorySize == null) return;
    if (memorySize > MEMORY_LIMIT) {
      violations.push({
        guard: 'memoryOverflow',
        message: `Memory has ${memorySize} entries (limit: ${MEMORY_LIMIT}).`,
      });
    }
  }

  #checkDeadlock(context, violations) {
    const { agentState, blockedActions, helpRequested } = context;
    if (agentState !== 'blocked' || blockedActions == null) return;
    if (blockedActions > DEADLOCK_ACTIONS && !helpRequested) {
      violations.push({
        guard: 'deadlock',
        message: `Agent blocked for ${blockedActions} actions without requesting help (threshold: ${DEADLOCK_ACTIONS}).`,
      });
    }
  }
}
