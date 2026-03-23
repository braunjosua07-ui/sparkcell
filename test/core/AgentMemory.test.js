// test/core/AgentMemory.test.js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { AgentMemory } from '../../src/core/AgentMemory.js';

describe('AgentMemory', () => {
  it('stores and retrieves memories', () => {
    const mem = new AgentMemory('agent-1');
    mem.store('project-goal', 'Build a restaurant app', { importance: 'high' });
    const result = mem.recall('project-goal');
    assert.equal(result.content, 'Build a restaurant app');
  });

  it('tiers memories into HOT/WARM/COLD', () => {
    const mem = new AgentMemory('agent-1');
    mem.store('key1', 'recent', { importance: 'high' });
    // Access it to keep it HOT
    mem.recall('key1');
    const stats = mem.getStats();
    assert.ok(stats.hot >= 1);
  });

  it('searches by relevance', () => {
    const mem = new AgentMemory('agent-1');
    mem.store('pricing', 'Competitor pricing analysis', { tags: ['market', 'pricing'] });
    mem.store('tech', 'API architecture', { tags: ['api', 'tech'] });
    const results = mem.search('pricing');
    assert.ok(results.length >= 1);
    assert.ok(results[0].key === 'pricing');
  });

  it('returns null for missing keys', () => {
    const mem = new AgentMemory('agent-1');
    assert.equal(mem.recall('nonexistent'), null);
  });
});
