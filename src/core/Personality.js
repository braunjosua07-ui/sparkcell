// src/core/Personality.js - Agent Persönlichkeit & Soul System

/**
 * Big Five Persönlichkeitsmodell (Neue Version):
 *
 * 1. **Offenheit (Openness)** - Kreativität, Neugier, Abenteuerlust
 *    Niedrig: Konservativ, strukturiert, risikoscheu
 *    Hoch: Kreativ, neugierig, experimentierfreudig
 *
 * 2. **Gewissenhaftigkeit (Conscientiousness)** - Organisierung, Zuverlässigkeit
 *    Niedrig: spontan, unordentlich, flexibel
 *    Hoch: geordnet, zuverlässig, diszipliniert
 *
 * 3. **Extraversion (Extraversion)** - Geselligkeit, Energie
 *    Niedrig: introvertiert, zurückhaltend, ruhig
 *    Hoch: extrovertiert, gesellig, energisch
 *
 * 4. **Vereinbarkeit (Agreeableness)** - Kooperativität, Mitgefühl
 *    Niedrig: wettbewerbsorientiert, kritisch, selbstbewusst
 *    Hoch: kooperativ, mitfühlend, hilfsbereit
 *
 * 5. **Neurotizismus (Neuroticism)** - Emotionale Stabilität
 *    Niedrig: emotional stabil, ruhig, zuversichtlich
 *    Hoch: emotional labil, ängstlich, empfindlich
 */

const PERSONALITY_STORAGE_KEY = 'agent-personality';
const SOUL_EVO_THRESHOLD = 15; // Soul Score Increase needed for evolution event
const MIN_SOUL_FOR_CHARGE = 70;

export const PERSONALITY_TEMPLATES = {
  // Entrepreneurial CEO
  ceo: {
    openness: 80,           // kreativ, visionär
    conscientiousness: 75,  // diszipliniert, strategisch
    extraversion: 85,       // extrovertiert, charismatisch
    agreeableness: 60,      // ergebnisorientiert, nicht always agree
    neuroticism: 30,        // emotional stabil unter Druck
    humor: 'sarkastisch',
    style: 'prägnant, direkt',
    approach: 'decision-driven',
    values: ['wachstum', 'impact', 'exzellenz'],
  },
  // Tech Lead
  tech: {
    openness: 70,           // technikbegeistert
    conscientiousness: 85,  // methodisch, präzise
    extraversion: 40,       // introvertiert, fokusiert
    agreeableness: 70,      // kooperativ im Team
    neuroticism: 40,        // ausgeglichen
    humor: 'witzig',
    style: 'technisch, genau',
    approach: 'solution-oriented',
    values: ['qualität', 'effizienz', 'innovation'],
  },
  // Product Manager
  product: {
    openness: 75,           // kreativ für feature-ideen
    conscientiousness: 70,  // organisiert
    extraversion: 75,       // kommunikativ mit teams
    agreeableness: 80,      // user-empfindsam
    neuroticism: 35,        // stabil unter deadline-druck
    humor: 'leicht',
    style: 'nutzerzentriert',
    approach: 'data-driven',
    values: ['nutzen', 'wachstum', 'einfachheit'],
  },
  // Designer
  design: {
    openness: 90,           // sehr kreativ
    conscientiousness: 60,  // flexibel, iterativ
    extraversion: 60,       // kommunikativ
    agreeableness: 75,      // collaborativ
    neuroticism: 45,        // empfindlich für design
    humor: 'kreativ',
    style: 'ästhetisch, emotional',
    approach: 'experimentell',
    values: ['schönheit', 'user-experience', 'ästhetik'],
  },
  // Marketing
  marketing: {
    openness: 65,           // kreativ für campaigns
    conscientiousness: 60,  // organisiert
    extraversion: 90,       // sehr gesellig
    agreeableness: 70,      // kooperativ
    neuroticism: 40,        // ausgeglichen
    humor: 'trocken',
    style: 'persuasiv, emotional',
    approach: 'test-and-learn',
    values: ['wachstum', 'brand', 'community'],
  },
  // Generalist (default)
  generalist: {
    openness: 55,
    conscientiousness: 55,
    extraversion: 55,
    agreeableness: 55,
    neuroticism: 55,
    humor: 'neutral',
    style: 'ausgewogen',
    approach: 'adaptiv',
    values: ['erfolg', 'lernbereitschaft'],
  },
};

/**
 * Calculate personality score from Big Five traits
 * @param {{ openness: number, conscientiousness: number, extraversion: number, agreeableness: number, neuroticism: number }} traits
 * @returns {number} Soul score 0-100
 */
export function calculateSoulScore(traits) {
  // Weighted average of personality traits
  // Neuroticism is inverted (low = better for stability)
  const { openness, conscientiousness, extraversion, agreeableness, neuroticism } = traits;

  const neuroticismScore = 100 - neuroticism; // Invert for consistency

  const rawScore = (
    openness * 0.15 +
    conscientiousness * 0.20 +
    extraversion * 0.15 +
    agreeableness * 0.20 +
    neuroticismScore * 0.30
  );

  return Math.min(100, Math.round(rawScore));
}

/**
 * Generate personality description string from traits
 */
export function personalityToDescription(traits) {
  const { openness, conscientiousness, extraversion, agreeableness, neuroticism } = traits;
  const neuroScore = 100 - neuroticism;

  const description = [];

  // Openness
  if (openness >= 70) description.push('kreativ und neugierig');
  else if (openness <= 30) description.push('konservativ und strukturiert');
  else description.push('ausgewogen im Denken');

  // Conscientiousness
  if (conscientiousness >= 75) description.push('sehr gewissenhaft');
  else if (conscientiousness <= 25) description.push('flexibel und spontan');
  else description.push('strukturiert aber flexibel');

  // Extraversion
  if (extraversion >= 75) description.push('gesellig und energisch');
  else if (extraversion <= 25) description.push('zurückhaltend und nachdenklich');
  else description.push('sozial ausgeglichen');

  // Agreeableness
  if (agreeableness >= 75) description.push('kooperativ und mitfühlend');
  else if (agreeableness <= 25) description.push('selbstbewusst und direk');
  else description.push('harmonieorientiert');

  // Neuroticism (inverted)
  if (neuroScore >= 75) description.push('emotional stabil');
  else if (neuroScore <= 25) description.push('emotional empfindlich');
  else description.push('emotional ausgewogen');

  return description.join(', ');
}

/**
 * Personality class for an agent
 */
export class Personality {
  #traits;
  #prevTraits = null;
  #name;

  /**
   * @param {string} agentId - Unique agent identifier
   * @param {object} traits - Big Five traits (optional)
   * @param {object} template - Personality template name (optional)
   */
  constructor(agentId, traits = {}, template = null) {
    this.#name = agentId;

    if (template && PERSONALITY_TEMPLATES[template]) {
      this.#traits = { ...PERSONALITY_TEMPLATES[template] };
      // Override with any specific traits
      this.#traits = { ...this.#traits, ...traits };
    } else {
      this.#traits = {
        openness: traits.openness ?? 50,
        conscientiousness: traits.conscientiousness ?? 50,
        extraversion: traits.extraversion ?? 50,
        agreeableness: traits.agreeableness ?? 50,
        neuroticism: traits.neuroticism ?? 50,
        // Additional personality attributes
        humor: traits.humor ?? 'neutral',
        style: traits.style ?? 'ausgewogen',
        approach: traits.approach ?? 'adaptiv',
        values: traits.values ?? ['erfolg', 'lernbereitschaft'],
      };
    }

    this.#prevTraits = null;
  }

  /**
   * Get traits object
   */
  get traits() {
    return { ...this.#traits };
  }

  /**
   * Set a single trait value
   */
  setTrait(key, value) {
    if (key in this.#traits) {
      this.#traits[key] = value;
    }
  }

  /**
   * Set traits from object (for loading from saved state)
   */
  setTraits(newTraits) {
    for (const [key, value] of Object.entries(newTraits)) {
      if (key in this.#traits) {
        this.#traits[key] = value;
      }
    }
  }

  /**
   * Get personality description
   */
  getDescription() {
    return personalityToDescription(this.#traits);
  }

  /**
   * Calculate current soul score
   */
  getSoulScore() {
    return calculateSoulScore(this.#traits);
  }

  /**
   * Check if personality evolved significantly
   */
  hasEvolved() {
    if (!this.#prevTraits) {
      this.#prevTraits = { ...this.#traits };
      return false;
    }

    let changed = false;
    for (const key of ['openness', 'conscientiousness', 'extraversion', 'agreeableness', 'neuroticism']) {
      if (this.#traits[key] !== this.#prevTraits[key]) {
        changed = true;
        break;
      }
    }

    this.#prevTraits = { ...this.#traits };
    return changed;
  }

  /**
   * Check if soul charge milestone reached
   */
  getMilestone() {
    const score = this.getSoulScore();
    if (score >= MIN_SOUL_FOR_CHARGE) return 'SOUL-CHARGE';
    if (score >= 40) return 'Soul gestärkt';
    if (score >= 10) return 'Soul entstanden';
    return '';
  }

  /**
   * Apply quality-based personality adjustments
   * Good work boosts certain traits, bad work can reduce them
   */
  adjustFromQuality(qualityScore, skill) {
    let changes = {};

    if (qualityScore >= 0.8) {
      // Excellent work - boost confidence and openness
      changes = {
        extraversion: Math.min(95, this.#traits.extraversion + 2),
        openness: Math.min(95, this.#traits.openness + 3),
      };
    } else if (qualityScore >= 0.6) {
      // Good work - steady growth
      changes = {
        conscientiousness: Math.min(95, this.#traits.conscientiousness + 1),
      };
    } else if (qualityScore < 0.4) {
      // Poor work - possible self-doubt or adjustment
      if (this.#traits.neuroticism > 30) {
        changes = {
          neuroticism: Math.min(95, this.#traits.neuroticism + 2),
        };
      } else {
        changes = {
          conscientiousness: Math.max(5, this.#traits.conscientiousness - 3),
        };
      }
    }

    // Apply changes
    for (const [key, value] of Object.entries(changes)) {
      this.#traits[key] = value;
    }

    return changes;
  }

  /**
   * Get prompt injection string for agent personality
   */
  getPromptString() {
    const desc = this.getDescription();
    const { humor, style, approach, values } = this.#traits;

    const valueList = values.length > 0 ? values.join(', ') : 'erfolg, lernbereitschaft';

    return `Deine Persönlichkeit:
${desc}
Stil: ${style}
Humor: ${humor}
Ansatz: ${approach}
Werte: ${valueList}

Sei authentisch in deiner Kommunikation und arbeite konsistent mit deiner Persönlichkeit.`;
  }
}

// Export default personality function
export function createPersonality(agentId, traits = {}, template = null) {
  return new Personality(agentId, traits, template);
}
