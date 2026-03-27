import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { LLMManager } from '../../src/llm/LLMManager.js';

function makeMgr() {
  return new LLMManager({
    primary: { provider: 'ollama', model: 'test', baseUrl: 'http://localhost:99999/v1' },
  });
}

describe('LLMManager', () => {
  it('constructs with a primary provider config', () => {
    const mgr = new LLMManager({
      primary: { provider: 'ollama', model: 'llama3.1:8b', baseUrl: 'http://localhost:11434/v1' },
    });
    assert.ok(mgr);
  });

  it('circuit breaker opens after 3 failures', () => {
    const mgr = makeMgr();
    mgr._recordFailure('primary');
    mgr._recordFailure('primary');
    mgr._recordFailure('primary');
    assert.equal(mgr._isCircuitOpen('primary'), true);
  });

  it('circuit breaker closes after initial cooldown (5s)', () => {
    const mgr = makeMgr();
    mgr._circuitBreakers.set('primary', { failures: 3, openedAt: Date.now() - 5_001, attempt: 0 });
    assert.equal(mgr._isCircuitOpen('primary'), false);
  });

  it('exponential backoff increases cooldown per attempt', () => {
    const mgr = makeMgr();

    // attempt 0 → 5s cooldown
    mgr._circuitBreakers.set('primary', { failures: 3, openedAt: Date.now() - 4_000, attempt: 0 });
    assert.equal(mgr._isCircuitOpen('primary'), true, 'should still be open at 4s (attempt 0, cooldown 5s)');

    // attempt 1 → 10s cooldown — 6s elapsed is not enough
    mgr._circuitBreakers.set('primary', { failures: 3, openedAt: Date.now() - 6_000, attempt: 1 });
    assert.equal(mgr._isCircuitOpen('primary'), true, 'should still be open at 6s (attempt 1, cooldown 10s)');

    // attempt 1 → 10s cooldown — 11s elapsed is enough
    mgr._circuitBreakers.set('primary', { failures: 3, openedAt: Date.now() - 11_000, attempt: 1 });
    assert.equal(mgr._isCircuitOpen('primary'), false, 'should close at 11s (attempt 1, cooldown 10s)');

    // attempt 3 → 40s cooldown
    mgr._circuitBreakers.set('primary', { failures: 3, openedAt: Date.now() - 30_000, attempt: 3 });
    assert.equal(mgr._isCircuitOpen('primary'), true, 'should still be open at 30s (attempt 3, cooldown 40s)');
  });

  it('cooldown caps at 120 seconds', () => {
    const mgr = makeMgr();
    // attempt 10 → 5s * 1024 = 5120s, but capped at 120s
    mgr._circuitBreakers.set('primary', { failures: 3, openedAt: Date.now() - 121_000, attempt: 10 });
    assert.equal(mgr._isCircuitOpen('primary'), false, 'should close after 121s even at high attempt');
  });

  it('attempt counter increments when circuit half-opens', () => {
    const mgr = makeMgr();
    mgr._circuitBreakers.set('primary', { failures: 3, openedAt: Date.now() - 5_001, attempt: 0 });
    mgr._isCircuitOpen('primary'); // transitions to half-open
    const cb = mgr._circuitBreakers.get('primary');
    assert.equal(cb.attempt, 1, 'attempt should increment after half-open transition');
    assert.equal(cb.failures, 0, 'failures should reset after half-open transition');
  });

  it('success resets circuit breaker completely', () => {
    const mgr = makeMgr();
    mgr._recordFailure('primary');
    mgr._recordFailure('primary');
    mgr._recordFailure('primary');
    mgr._recordSuccess('primary');
    assert.equal(mgr._isCircuitOpen('primary'), false);
    assert.equal(mgr._circuitBreakers.has('primary'), false);
  });

  it('queryStream is an async generator', () => {
    const mgr = makeMgr();
    const stream = mgr.queryStream('test');
    assert.equal(typeof stream[Symbol.asyncIterator], 'function');
  });
});
