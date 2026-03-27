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

  it('evicts COLD entries when store exceeds maxEntries', () => {
    const mem = new AgentMemory('agent-1', { maxEntries: 10 });

    // Fill with 10 entries (at limit, no eviction yet)
    for (let i = 0; i < 10; i++) {
      mem.store(`old-${i}`, `value-${i}`);
    }
    assert.equal(mem.getStats().total, 10);

    // Make a few entries HOT by accessing them
    mem.recall('old-8');
    mem.recall('old-8');
    mem.recall('old-8');
    mem.recall('old-8');
    mem.recall('old-8');
    mem.recall('old-8'); // accessCount > 5 → HOT
    mem.recall('old-9');
    mem.recall('old-9');
    mem.recall('old-9');
    mem.recall('old-9');
    mem.recall('old-9');
    mem.recall('old-9'); // accessCount > 5 → HOT

    // Add one more entry to trigger eviction
    mem.store('new-entry', 'trigger eviction');

    const stats = mem.getStats();
    // Should have evicted COLD entries, kept HOT ones
    assert.ok(stats.total <= 10, `expected <= 10 entries, got ${stats.total}`);
    // HOT entries must survive
    assert.ok(mem.recall('old-8') !== null, 'HOT entry old-8 should survive eviction');
    assert.ok(mem.recall('old-9') !== null, 'HOT entry old-9 should survive eviction');
    assert.ok(mem.recall('new-entry') !== null, 'newly added entry should survive');
  });

  it('respects custom maxEntries', () => {
    const mem = new AgentMemory('agent-1', { maxEntries: 5 });
    for (let i = 0; i < 8; i++) {
      mem.store(`key-${i}`, `val-${i}`);
    }
    assert.ok(mem.getStats().total <= 5, 'should not exceed maxEntries');
  });
});
