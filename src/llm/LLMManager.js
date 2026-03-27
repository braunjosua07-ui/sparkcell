import { OpenAICompatibleProvider } from './OpenAICompatibleProvider.js';
import { AnthropicProvider } from './AnthropicProvider.js';
import { getProvider } from './ProviderRegistry.js';
import { injectToolsAsText, parseToolCallsFromText } from './ToolUseFallback.js';

const CB_BASE_COOLDOWN = 5_000;   // 5 seconds
const CB_MAX_COOLDOWN  = 120_000; // 2 minutes
const CB_FAILURE_THRESHOLD = 3;

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
        let queryPrompt = prompt;
        let queryOptions = options;
        const needsFallback = options.tools && !provider.supportsToolUse;

        if (needsFallback) {
          // Inject tools as text instructions for models without tool-use
          const messages = typeof prompt === 'string'
            ? [{ role: 'user', content: prompt }]
            : prompt;
          queryPrompt = injectToolsAsText(messages, options.tools);
          queryOptions = { ...options, tools: undefined };
        }

        const result = await provider.query(queryPrompt, queryOptions);
        this._recordSuccess(name);

        if (needsFallback && result.content) {
          // Parse tool calls from text response
          const { cleanContent, toolCalls } = parseToolCallsFromText(result.content);
          return { ...result, content: cleanContent, toolCalls };
        }

        // Ensure toolCalls is always present
        if (!result.toolCalls) result.toolCalls = [];
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

  async *queryStream(prompt, options = {}) {
    for (const name of this.#providerOrder) {
      if (this._isCircuitOpen(name)) continue;
      try {
        const provider = this.#providers.get(name);
        if (typeof provider.queryStream !== 'function') {
          // Fallback to non-streaming query
          const result = await provider.query(prompt, options);
          if (!result.toolCalls) result.toolCalls = [];
          yield { type: 'token', text: result.content };
          yield { type: 'done', ...result };
          this._recordSuccess(name);
          return;
        }
        for await (const chunk of provider.queryStream(prompt, options)) {
          yield chunk;
        }
        this._recordSuccess(name);
        return;
      } catch (error) {
        this._recordFailure(name);
        if (name === this.#providerOrder[this.#providerOrder.length - 1]) {
          throw error;
        }
      }
    }
    throw new Error('All LLM providers unavailable (circuit breakers open)');
  }

  _recordFailure(name) {
    const cb = this._circuitBreakers.get(name) || { failures: 0, openedAt: null, attempt: 0 };
    cb.failures++;
    if (cb.failures >= CB_FAILURE_THRESHOLD) cb.openedAt = Date.now();
    this._circuitBreakers.set(name, cb);
  }

  _recordSuccess(name) {
    this._circuitBreakers.delete(name);
  }

  // Pure check - no mutation
  isCircuitOpen(name) {
    const cb = this._circuitBreakers.get(name);
    if (!cb || !cb.openedAt) return false;
    const cooldown = Math.min(CB_BASE_COOLDOWN * 2 ** cb.attempt, CB_MAX_COOLDOWN);
    return Date.now() - cb.openedAt <= cooldown;
  }

  // Separate transition method
  transitionToHalfOpen(name) {
    const cb = this._circuitBreakers.get(name);
    if (!cb) return false;
    cb.failures = 0;
    cb.openedAt = null;
    cb.attempt++;
    return true;
  }

  // Legacy method for backwards compatibility - checks and transitions if cooldown expired
  _isCircuitOpen(name) {
    if (!this.isCircuitOpen(name)) {
      // If circuit is not open, check if we're in half-open state (cooldown expired)
      const cb = this._circuitBreakers.get(name);
      if (cb && cb.openedAt) {
        // Cooldown expired - transition to half-open
        this.transitionToHalfOpen(name);
      }
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
