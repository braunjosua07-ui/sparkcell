import { OpenAICompatibleProvider } from './OpenAICompatibleProvider.js';
import { AnthropicProvider } from './AnthropicProvider.js';
import { getProvider } from './ProviderRegistry.js';

export class LLMManager {
  #providers = new Map();
  _circuitBreakers = new Map(); // public for tests
  #providerOrder = [];

  constructor(config = {}) {
    if (config.primary) {
      this.#addProvider('primary', config.primary);
      this.#providerOrder.push('primary');
    }
    if (config.fallback) {
      this.#addProvider('fallback', config.fallback);
      this.#providerOrder.push('fallback');
    }
  }

  #addProvider(name, providerConfig) {
    const registry = getProvider(providerConfig.provider);
    const baseUrl = providerConfig.baseUrl || registry?.baseUrl;

    if (registry?.isAnthropic) {
      this.#providers.set(name, new AnthropicProvider({
        apiKey: providerConfig.apiKey,
        model: providerConfig.model,
      }));
    } else {
      this.#providers.set(name, new OpenAICompatibleProvider({
        baseUrl,
        apiKey: providerConfig.apiKey,
        model: providerConfig.model,
        name: registry?.name || providerConfig.provider,
      }));
    }
  }

  async query(prompt, options = {}) {
    for (const name of this.#providerOrder) {
      if (this._isCircuitOpen(name)) continue;
      try {
        const provider = this.#providers.get(name);
        const result = await provider.query(prompt, options);
        this._recordSuccess(name);
        return result;
      } catch (error) {
        this._recordFailure(name);
        if (name === this.#providerOrder[this.#providerOrder.length - 1]) {
          throw error; // last provider failed
        }
      }
    }
    throw new Error('All LLM providers unavailable (circuit breakers open)');
  }

  _recordFailure(name) {
    const cb = this._circuitBreakers.get(name) || { failures: 0, openedAt: null };
    cb.failures++;
    if (cb.failures >= 3) cb.openedAt = Date.now();
    this._circuitBreakers.set(name, cb);
  }

  _recordSuccess(name) {
    this._circuitBreakers.delete(name);
  }

  _isCircuitOpen(name) {
    const cb = this._circuitBreakers.get(name);
    if (!cb || cb.failures < 3) return false;
    // Cooldown: 30 seconds
    if (Date.now() - cb.openedAt > 30000) {
      cb.failures = 0;
      cb.openedAt = null;
      return false;
    }
    return true;
  }

  getStats() {
    const stats = {};
    for (const [name, provider] of this.#providers) {
      stats[name] = provider.getStats();
    }
    return stats;
  }
}
