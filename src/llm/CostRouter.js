import { PRICING } from './ProviderRegistry.js';

export class CostRouter {
  #dailyLimit;
  #onExhaustion;
  #spent = 0;
  _lastReset = Date.now(); // public for tests

  constructor({ dailyLimit = 10.00, onExhaustion = 'pause' } = {}) {
    this.#dailyLimit = dailyLimit;
    this.#onExhaustion = onExhaustion;
  }

  get todaySpent() {
    this._checkReset();
    return this.#spent;
  }

  recordUsage({ inputTokens = 0, outputTokens = 0, model = '' }) {
    this._checkReset();
    const pricing = PRICING[model] || { input: 0.50, output: 1.50 }; // default estimate
    const cost = (inputTokens / 1_000_000) * pricing.input + (outputTokens / 1_000_000) * pricing.output;
    this.#spent += cost;
  }

  isBudgetExhausted() {
    this._checkReset();
    return this.#spent >= this.#dailyLimit;
  }

  getExhaustionAction() {
    return this.#onExhaustion;
  }

  _checkReset() {
    const now = Date.now();
    if (now - this._lastReset > 24 * 60 * 60 * 1000) {
      this.#spent = 0;
      this._lastReset = now;
    }
  }

  getStats() {
    return {
      todaySpent: this.todaySpent,
      dailyLimit: this.#dailyLimit,
      remaining: Math.max(0, this.#dailyLimit - this.#spent),
      exhausted: this.isBudgetExhausted(),
    };
  }
}
