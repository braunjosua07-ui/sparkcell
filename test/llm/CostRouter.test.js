import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { CostRouter } from '../../src/llm/CostRouter.js';

describe('CostRouter', () => {
  it('tracks cost per request', () => {
    const cr = new CostRouter({ dailyLimit: 5.00, onExhaustion: 'pause' });
    cr.recordUsage({ inputTokens: 1000, outputTokens: 500, model: 'gpt-4o-mini' });
    assert.ok(cr.todaySpent > 0);
  });

  it('detects budget exhaustion', () => {
    const cr = new CostRouter({ dailyLimit: 0.01, onExhaustion: 'pause' });
    cr.recordUsage({ inputTokens: 1000000, outputTokens: 500000, model: 'gpt-4o' });
    assert.equal(cr.isBudgetExhausted(), true);
  });

  it('returns exhaustion action', () => {
    const cr = new CostRouter({ dailyLimit: 0.01, onExhaustion: 'fallback-then-pause' });
    cr.recordUsage({ inputTokens: 1000000, outputTokens: 500000, model: 'gpt-4o' });
    assert.equal(cr.getExhaustionAction(), 'fallback-then-pause');
  });

  it('resets at midnight', () => {
    const cr = new CostRouter({ dailyLimit: 5.00, onExhaustion: 'pause' });
    cr.recordUsage({ inputTokens: 1000, outputTokens: 500, model: 'gpt-4o' });
    cr._lastReset = Date.now() - 25 * 60 * 60 * 1000;
    cr._checkReset();
    assert.equal(cr.todaySpent, 0);
  });
});
