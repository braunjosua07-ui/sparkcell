// src/core/SkillManager.js

const XP_PER_HOUR = 100;
const MAX_LEVEL = 100;

// Skill tier presets — used when creating agents
export const SKILL_TIERS = {
  beginner:     { level: 30, xp: 400 },
  intermediate: { level: 50, xp: 1200 },
  expert:       { level: 70, xp: 4000 },
  master:       { level: 85, xp: 12000 },
};

const DEFAULT_TIER = 'intermediate';

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

function xpToLevel(xp) {
  if (xp <= 0) return 10;
  const k = 20;
  const scale = 200;
  return Math.min(MAX_LEVEL, 10 + k * Math.log(1 + xp / scale));
}

export class SkillManager {
  #agentId;
  #skills = new Map();

  /**
   * @param {string} agentId
   * @param {Array<string|{name: string, tier?: string}>} initialSkills
   */
  constructor(agentId, initialSkills = []) {
    this.#agentId = agentId;
    for (const skill of initialSkills) {
      if (typeof skill === 'string') {
        // Simple string — use default tier
        const tier = SKILL_TIERS[DEFAULT_TIER];
        this.#skills.set(skill, { level: tier.level, practiceTime: 0, xp: tier.xp });
      } else if (skill && skill.name) {
        // Object with tier: { name: 'coding', tier: 'expert' }
        const tier = SKILL_TIERS[skill.tier || DEFAULT_TIER] || SKILL_TIERS[DEFAULT_TIER];
        this.#skills.set(skill.name, { level: tier.level, practiceTime: 0, xp: tier.xp });
      }
    }
  }

  /**
   * Practice a skill for a given number of hours.
   */
  practice(skillName, hours) {
    if (hours <= 0) return;
    let entry = this.#skills.get(skillName);
    if (!entry) {
      // Auto-discovered skill starts at beginner tier
      const tier = SKILL_TIERS.beginner;
      entry = { level: tier.level, practiceTime: 0, xp: tier.xp };
      this.#skills.set(skillName, entry);
    }
    entry.practiceTime += hours;
    entry.xp += hours * XP_PER_HOUR;
    entry.level = xpToLevel(entry.xp);
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
   * Evaluate output quality for a skill. Returns a score 0-1.
   * Uses heuristics: length, structure, actionability.
   * @param {string} output - The LLM output
   * @param {string} skillName - The skill used
   * @returns {{ score: number, reasons: string[] }}
   */
  evaluateQuality(output, skillName) {
    if (!output) return { score: 0, reasons: ['Kein Output'] };

    const reasons = [];
    let score = 0.5; // baseline

    // Length check — too short = low effort
    if (output.length < 50) {
      score -= 0.3;
      reasons.push('Output zu kurz');
    } else if (output.length > 200) {
      score += 0.1;
    }

    // Structure check — has headings, lists, or code blocks
    const hasStructure = /^#+\s|^[-*]\s|```/m.test(output);
    if (hasStructure) {
      score += 0.15;
      reasons.push('Gut strukturiert');
    } else if (output.length > 300) {
      score -= 0.1;
      reasons.push('Fehlende Struktur');
    }

    // Actionability — contains concrete items
    const hasActionable = /\b(implementier|erstell|definier|plan|schritt|todo|next|deploy|test|launch)\b/i.test(output);
    if (hasActionable) {
      score += 0.15;
      reasons.push('Enthält konkrete Aktionen');
    }

    // Repetition penalty — same phrases repeated
    const sentences = output.split(/[.!?\n]+/).filter(s => s.trim().length > 10);
    const unique = new Set(sentences.map(s => s.trim().toLowerCase()));
    if (sentences.length > 3 && unique.size < sentences.length * 0.6) {
      score -= 0.2;
      reasons.push('Zu viele Wiederholungen');
    }

    // Skill-specific checks
    if (skillName === 'coding' && !/[{(=;]|function|class|const|let|def |import /i.test(output)) {
      score -= 0.15;
      reasons.push('Coding-Task ohne Code');
    }

    return { score: Math.max(0, Math.min(1, score)), reasons };
  }

  /**
   * Apply quality feedback to a skill — boost XP for good work, reduce for bad.
   * Returns training suggestion if quality is too low.
   * @param {string} skillName
   * @param {number} qualityScore - 0 to 1
   * @returns {{ needsTraining: boolean, trainingTask?: { title: string, description: string } }}
   */
  applyFeedback(skillName, qualityScore) {
    let entry = this.#skills.get(skillName);
    if (!entry) return { needsTraining: false };

    if (qualityScore >= 0.7) {
      // Good output — bonus XP
      entry.xp += 50;
      entry.level = xpToLevel(entry.xp);
      return { needsTraining: false };
    }

    if (qualityScore < 0.4) {
      // Poor output — reduce XP slightly and suggest training
      entry.xp = Math.max(0, entry.xp - 30);
      entry.level = xpToLevel(entry.xp);

      return {
        needsTraining: true,
        trainingTask: {
          title: `Skill-Training: ${skillName} verbessern`,
          description: `Dein letzter Output im Bereich "${skillName}" war unter dem erwarteten Niveau (Score: ${(qualityScore * 100).toFixed(0)}%). ` +
            `Übe gezielt: Erstelle ein Beispiel-Ergebnis für eine typische ${skillName}-Aufgabe. ` +
            `Fokussiere auf Struktur, Konkretheit und Qualität.`,
          priority: 'medium',
          source: 'self-improvement',
          skillTarget: skillName,
        },
      };
    }

    // Mediocre — no XP change, no training
    return { needsTraining: false };
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
      .sort((a, b) => b[1].level - a[1].level);

    const strong = entries.filter(([, s]) => s.level >= 50).map(([n]) => n);
    const developing = entries.filter(([, s]) => s.level >= 30 && s.level < 50).map(([n]) => n);

    const parts = [];
    if (strong.length > 0) parts.push(`Stärken: ${strong.join(', ')}`);
    if (developing.length > 0) parts.push(`Entwickelt sich in: ${developing.join(', ')}`);
    return parts.join('. ');
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
