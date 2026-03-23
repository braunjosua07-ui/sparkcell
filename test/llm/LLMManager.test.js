import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { LLMManager } from '../../src/llm/LLMManager.js';

describe('LLMManager', () => {
  it('constructs with a primary provider config', () => {
    const mgr = new LLMManager({
      primary: { provider: 'ollama', model: 'llama3.1:8b', baseUrl: 'http://localhost:11434/v1' },
    });
    assert.ok(mgr);
  });

  it('circuit breaker opens after 3 failures', () => {
    const mgr = new LLMManager({
      primary: { provider: 'ollama', model: 'test', baseUrl: 'http://localhost:99999/v1' },
    });
    mgr._recordFailure('primary');
    mgr._recordFailure('primary');
    mgr._recordFailure('primary');
    assert.equal(mgr._isCircuitOpen('primary'), true);
  });

  it('circuit breaker closes after cooldown', async () => {
    const mgr = new LLMManager({
      primary: { provider: 'ollama', model: 'test', baseUrl: 'http://localhost:99999/v1' },
    });
    mgr._circuitBreakers.set('primary', { failures: 3, openedAt: Date.now() - 31000 });
    assert.equal(mgr._isCircuitOpen('primary'), false);
  });
});
