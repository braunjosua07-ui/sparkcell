// test/core/KnowledgeGraph.test.js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { KnowledgeGraph } from '../../src/core/KnowledgeGraph.js';

describe('KnowledgeGraph', () => {
  it('adds and retrieves entities', () => {
    const kg = new KnowledgeGraph();
    kg.addEntity('React', 'tech', { category: 'frontend' });
    const entity = kg.getEntity('React');
    assert.equal(entity.type, 'tech');
  });

  it('adds relations between entities', () => {
    const kg = new KnowledgeGraph();
    kg.addEntity('ReserveTable', 'company');
    kg.addEntity('restaurants', 'concept');
    kg.addRelation('ReserveTable', 'restaurants', 'serves');
    const related = kg.getRelated('ReserveTable');
    assert.ok(related.some(r => r.entity === 'restaurants'));
  });

  it('performs BFS traversal with depth', () => {
    const kg = new KnowledgeGraph();
    kg.addEntity('A', 'concept');
    kg.addEntity('B', 'concept');
    kg.addEntity('C', 'concept');
    kg.addRelation('A', 'B', 'links');
    kg.addRelation('B', 'C', 'links');
    const depth1 = kg.getRelated('A', 1);
    assert.equal(depth1.length, 1); // only B
    const depth2 = kg.getRelated('A', 2);
    assert.equal(depth2.length, 2); // B and C
  });
});
