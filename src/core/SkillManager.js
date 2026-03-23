// src/core/SkillManager.js

const INITIAL_LEVEL = 10;
const XP_PER_HOUR = 100;
const MAX_LEVEL = 100;

/**
 * Calculates skill level from total XP using logarithmic diminishing returns.
 * Level grows quickly at first, then slows significantly.
 * Formula: initialLevel + k * log(1 + xp / scale)
 */
function xpToLevel(xp, initialLevel = INITIAL_LEVEL) {
  if (xp <= 0) return initialLevel;
  const k = 20;
  const scale = 200;
  return Math.min(MAX_LEVEL, initialLevel + k * Math.log(1 + xp / scale));
}

export class SkillManager {
  #agentId;
  // Map<skillName, { level, practiceTime, xp }>
  #skills = new Map();

  /**
   * @param {string} agentId
   * @param {string[]} initialSkills - skill names to seed at level 10
   */
  constructor(agentId, initialSkills = []) {
    this.#agentId = agentId;
    for (const name of initialSkills) {
      this.#skills.set(name, { level: INITIAL_LEVEL, practiceTime: 0, xp: 0 });
    }
  }

  /**
   * Practice a skill for a given number of hours.
   * XP increases linearly; level grows logarithmically.
   * @param {string} skillName
   * @param {number} hours
   */
  practice(skillName, hours) {
    if (hours <= 0) return;

    let entry = this.#skills.get(skillName);
    if (!entry) {
      entry = { level: INITIAL_LEVEL, practiceTime: 0, xp: 0 };
      this.#skills.set(skillName, entry);
    }

    entry.practiceTime += hours;
    entry.xp += hours * XP_PER_HOUR;
    entry.level = xpToLevel(entry.xp, INITIAL_LEVEL);
  }

  /**
   * @param {string} skillName
   * @returns {number} current level (0–100)
   */
  getLevel(skillName) {
    return this.#skills.get(skillName)?.level ?? 0;
  }

  /**
   * @returns {Map<string, {level, practiceTime, xp}>}
   */
  getSkills() {
    return new Map(this.#skills);
  }

  /**
   * Return level-per-hour ratio. Returns 0 if no time invested.
   * @param {string} skillName
   * @returns {number}
   */
  getROI(skillName) {
    const entry = this.#skills.get(skillName);
    if (!entry || entry.practiceTime === 0) return 0;
    return entry.level / entry.practiceTime;
  }

  get agentId() { return this.#agentId; }

  /**
   * Build a cross-agent skill matrix.
   * @param {SkillManager[]} skillManagers
   * @returns {{ skills: string[], agents: Array<{id: string, levels: Record<string,number>}> }}
   */
  static teamMatrix(skillManagers) {
    // Collect union of all skill names
    const skillSet = new Set();
    for (const sm of skillManagers) {
      for (const name of sm.getSkills().keys()) {
        skillSet.add(name);
      }
    }
    const skills = [...skillSet].sort();

    const agents = skillManagers.map(sm => {
      const levels = {};
      for (const skill of skills) {
        levels[skill] = sm.getLevel(skill);
      }
      return { id: sm.agentId, levels };
    });

    return { skills, agents };
  }
}
