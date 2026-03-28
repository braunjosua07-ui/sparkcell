// src/core/AgentMemory.js

const HOT_RECENCY_MS  = 5  * 60 * 1000; // 5 minutes
const WARM_RECENCY_MS = 30 * 60 * 1000; // 30 minutes
const HOT_ACCESS_COUNT  = 5;
const WARM_ACCESS_COUNT = 2;

function classify(entry) {
  const age = Date.now() - entry.lastAccess;
  if (age <= HOT_RECENCY_MS  || entry.accessCount > HOT_ACCESS_COUNT)  return 'HOT';
  if (age <= WARM_RECENCY_MS || entry.accessCount > WARM_ACCESS_COUNT) return 'WARM';
  return 'COLD';
}

const DEFAULT_MAX_ENTRIES = 500;
const EVICTION_HEADROOM = 0.9; // evict down to 90% of maxEntries

export class AgentMemory {
  #agentId;
  #store = new Map();
  #maxEntries;
  #lock = Promise.resolve();

  constructor(agentId, { maxEntries = DEFAULT_MAX_ENTRIES } = {}) {
    this.#agentId = agentId;
    this.#maxEntries = maxEntries;
  }

  async #withLock(fn) {
    const previous = this.#lock;
    let release;
    this.#lock = new Promise(resolve => { release = resolve; });
    await previous;
    try {
      return await fn();
    } finally {
      release();
    }
  }

  /**
   * Store or update a memory entry.
   * @param {string} key
   * @param {string} content
   * @param {object} metadata  - optional { tags: [], importance: '' }
   */
  async store(key, content, metadata = {}) {
    return this.#withLock(() => {
      const now = Date.now();
      const existing = this.#store.get(key);
      this.#store.set(key, {
        content,
        metadata,
        accessCount: existing ? existing.accessCount : 0,
        lastAccess:  existing ? existing.lastAccess  : now,
        createdAt:   existing ? existing.createdAt   : now,
      });

      if (this.#store.size > this.#maxEntries) {
        this.#evict();
      }
    });
  }

  /**
   * Retrieve a memory entry by exact key, updating access stats.
   * Returns null if not found.
   */
  async recall(key) {
    return this.#withLock(() => {
      const entry = this.#store.get(key);
      if (!entry) return null;
      entry.accessCount += 1;
      entry.lastAccess = Date.now();
      return { key, ...entry };
    });
  }

  /**
   * Search memories by query string.
   * Matches against key, content, and metadata.tags.
   * Returns results sorted by relevance score (descending).
   */
  search(query) {
    const q = query.toLowerCase();
    const results = [];

    for (const [key, entry] of this.#store) {
      let score = 0;

      if (key.toLowerCase().includes(q))            score += 3;
      if (entry.content.toLowerCase().includes(q))  score += 2;

      const tags = entry.metadata?.tags ?? [];
      for (const tag of tags) {
        if (tag.toLowerCase().includes(q)) { score += 1; break; }
      }

      if (score > 0) results.push({ key, ...entry, score });
    }

    results.sort((a, b) => b.score - a.score);
    return results;
  }

  /**
   * Evict lowest-value entries when store exceeds maxEntries.
   * Removes COLD first (oldest first), then WARM if still over limit.
   */
  #evict() {
    const target = Math.floor(this.#maxEntries * EVICTION_HEADROOM);
    if (this.#store.size <= target) return;

    // Score each entry: lower = more evictable
    // COLD=0, WARM=1, HOT=2; within tier, lower accessCount and older lastAccess = evict first
    const scored = [];
    for (const [key, entry] of this.#store) {
      const tier = classify(entry);
      const tierScore = tier === 'COLD' ? 0 : tier === 'WARM' ? 1 : 2;
      scored.push({ key, tierScore, accessCount: entry.accessCount, lastAccess: entry.lastAccess });
    }

    scored.sort((a, b) =>
      a.tierScore - b.tierScore
      || a.accessCount - b.accessCount
      || a.lastAccess - b.lastAccess
    );

    for (const { key } of scored) {
      if (this.#store.size <= target) break;
      this.#store.delete(key);
    }
  }

  /**
   * Return tier counts.
   * @returns {{ total: number, hot: number, warm: number, cold: number }}
   */
  getStats() {
    const stats = { total: this.#store.size, hot: 0, warm: 0, cold: 0 };
    for (const entry of this.#store.values()) {
      const tier = classify(entry).toLowerCase();
      stats[tier] += 1;
    }
    return stats;
  }

  get agentId() { return this.#agentId; }
}