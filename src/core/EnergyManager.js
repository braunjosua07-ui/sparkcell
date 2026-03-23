// src/core/EnergyManager.js
import fs from 'node:fs/promises';
import path from 'node:path';

export class EnergyManager {
  #energy = 100;
  #config;
  #stats = { decayCount: 0, recoveryCount: 0, boosts: 0, forcePauses: 0 };
  #dataDir;
  #agentId;

  constructor(agentId, config = {}, dataDir = null) {
    this.#agentId = agentId;
    this.#config = {
      decayRate: config.decayRate ?? 4,
      recoveryRate: config.recoveryRate ?? 20,
      forcePauseAt: config.forcePauseAt ?? 25,
      canResumeAt: config.canResumeAt ?? 80,
    };
    this.#dataDir = dataDir;
  }

  get energy() { return this.#energy; }

  decay(amount = this.#config.decayRate) {
    amount = Math.max(0, amount);
    this.#energy = Math.max(0, this.#energy - amount);
    this.#stats.decayCount++;
  }

  recover(amount = this.#config.recoveryRate) {
    amount = Math.max(0, amount);
    this.#energy = Math.min(100, this.#energy + amount);
    this.#stats.recoveryCount++;
  }

  boost(type) {
    const amounts = { coffee: 15, lunch: 30, nap: 25 };
    const amount = amounts[type] || 10;
    this.#energy = Math.min(100, this.#energy + amount);
    this.#stats.boosts++;
  }

  shouldForcePause() { return this.#energy <= this.#config.forcePauseAt; }
  canResume()        { return this.#energy >= this.#config.canResumeAt; }

  getStats() {
    return { energy: this.#energy, ...this.#stats };
  }

  async load() {
    if (!this.#dataDir) return;
    try {
      const data = JSON.parse(await fs.readFile(path.join(this.#dataDir, 'energy.json'), 'utf8'));
      this.#energy = Math.min(100, Math.max(0, data.energy ?? 100));
      if (data.stats) Object.assign(this.#stats, data.stats);
    } catch { /* first run, use defaults */ }
  }

  async save() {
    if (!this.#dataDir) return;
    await fs.mkdir(this.#dataDir, { recursive: true });
    await fs.writeFile(
      path.join(this.#dataDir, 'energy.json'),
      JSON.stringify({ energy: this.#energy, stats: this.#stats }, null, 2)
    );
  }
}
