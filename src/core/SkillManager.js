// src/core/SkillManager.js

const INITIAL_LEVEL = 10;
const XP_PER_HOUR = 100;
const MAX_LEVEL = 100;

/**
 * Keyword → skill mapping for task matching.
 * When a task title/description contains these keywords, the skill is relevant.
 */
const SKILL_KEYWORDS = {
  strategy:      ['vision', 'strategy', 'okr', 'mission', 'roadmap', 'planning', 'competitive', 'partnership', 'go-to-market'],
  leadership:    ['team', 'hire', 'recruit', 'co-founder', 'meeting', 'delegate', 'manage', 'culture', 'values'],
  coding:        ['code', 'implement', 'build', 'mvp', 'api', 'endpoint', 'backend', 'frontend', 'migration', 'debug', 'test', 'ci/cd'],
  architecture:  ['architecture', 'system design', 'schema', 'database', 'infrastructure', 'scaling', 'tech stack', 'microservice'],
  devops:        ['ci/cd', 'deploy', 'docker', 'kubernetes', 'pipeline', 'monitoring', 'infrastructure'],
  marketing:     ['marketing', 'brand', 'campaign', 'social media', 'content', 'seo', 'email', 'launch', 'audience'],
  sales:         ['sales', 'lead', 'pitch', 'crm', 'outreach', 'funnel', 'prospect', 'demo', 'objection', 'pricing'],
  finance:       ['financial', 'budget', 'burn rate', 'funding', 'investor', 'revenue', 'cost', 'unit economics', 'pricing'],
  design:        ['design', 'wireframe', 'mockup', 'prototype', 'ui', 'ux', 'icon', 'illustration', 'layout', 'style guide'],
  research:      ['research', 'analysis', 'user research', 'interview', 'persona', 'competitor', 'market'],
  writing:       ['document', 'write', 'report', 'content', 'copy', 'blog', 'description', 'define'],
  negotiation:   ['negotiate', 'deal', 'contract', 'partner', 'terms'],
  prototyping:   ['prototype', 'clickable', 'interactive', 'demo', 'proof of concept'],
};

function xpToLevel(xp, initialLevel = INITIAL_LEVEL) {
  if (xp <= 0) return initialLevel;
  const k = 20;
  const scale = 200;
  return Math.min(MAX_LEVEL, initialLevel + k * Math.log(1 + xp / scale));
}

export class SkillManager {
  #agentId;
  #skills = new Map();

  constructor(agentId, initialSkills = []) {
    this.#agentId = agentId;
    for (const name of initialSkills) {
      this.#skills.set(name, { level: INITIAL_LEVEL, practiceTime: 0, xp: 0 });
    }
  }

  /**
   * Practice a skill for a given number of hours.
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
   * Match a task to the most relevant skill based on keywords.
   * Returns the best-matching skill name, or null if no match.
   * @param {{ title?: string, description?: string }} task
   * @returns {string|null}
   */
  matchTaskToSkill(task) {
    const text = `${task.title || ''} ${task.description || ''}`.toLowerCase();
    let bestSkill = null;
    let bestScore = 0;

    // Check agent's own skills first, then all known keywords
    const candidateSkills = new Set([...this.#skills.keys(), ...Object.keys(SKILL_KEYWORDS)]);

    for (const skillName of candidateSkills) {
      const keywords = SKILL_KEYWORDS[skillName] || [skillName];
      let score = 0;
      for (const kw of keywords) {
        if (text.includes(kw)) score++;
      }
      if (score > bestScore) {
        bestScore = score;
        bestSkill = skillName;
      }
    }

    return bestScore > 0 ? bestSkill : null;
  }

  /**
   * Auto-learn: practice the matched skill, or discover a new one from the task.
   * Returns the skill that was practiced.
   * @param {{ title?: string, description?: string }} task
   * @param {number} hours
   * @returns {string|null}
   */
  learnFromTask(task, hours = 0.2) {
    const matched = this.matchTaskToSkill(task);
    if (matched) {
      this.practice(matched, hours);
      return matched;
    }
    return null;
  }

  /**
   * Find skills the agent is weak at (below threshold) that are relevant to given goals.
   * @param {string[]} goals - mission goals or task descriptions
   * @param {number} threshold - level below which a skill is considered a gap
   * @returns {string[]} skill names that need development
   */
  findGaps(goals = [], threshold = 20) {
    const gaps = [];
    const goalText = goals.join(' ').toLowerCase();

    for (const [skillName, keywords] of Object.entries(SKILL_KEYWORDS)) {
      // Is this skill relevant to the goals?
      const relevant = keywords.some(kw => goalText.includes(kw));
      if (!relevant) continue;

      const level = this.getLevel(skillName);
      if (level < threshold) {
        gaps.push(skillName);
      }
    }

    return gaps;
  }

  /**
   * Get a summary of skills for prompt injection.
   * @returns {string} Human-readable skill summary
   */
  getSkillSummary() {
    if (this.#skills.size === 0) return '';
    const entries = [...this.#skills.entries()]
      .sort((a, b) => b[1].level - a[1].level)
      .map(([name, s]) => {
        const bar = s.level >= 50 ? 'stark' : s.level >= 25 ? 'mittel' : 'Anfänger';
        return `${name}: ${Math.round(s.level)}/100 (${bar})`;
      });
    return entries.join(', ');
  }

  getLevel(skillName) {
    return this.#skills.get(skillName)?.level ?? 0;
  }

  getSkills() {
    return new Map(this.#skills);
  }

  getROI(skillName) {
    const entry = this.#skills.get(skillName);
    if (!entry || entry.practiceTime === 0) return 0;
    return entry.level / entry.practiceTime;
  }

  get agentId() { return this.#agentId; }

  static teamMatrix(skillManagers) {
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
