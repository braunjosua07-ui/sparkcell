import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { CommitmentProtocol } from '../../src/communication/CommitmentProtocol.js';

describe('CommitmentProtocol', () => {
  it('creates a commitment', () => {
    const cp = new CommitmentProtocol();
    const id = cp.create({ from: 'tech', to: 'ceo', action: 'Review architecture.md', deadline: 3 });
    assert.ok(id);
    assert.equal(cp.get(id).status, 'pending');
  });

  it('fulfills a commitment', () => {
    const cp = new CommitmentProtocol();
    const id = cp.create({ from: 'tech', to: 'ceo', action: 'Review', deadline: 3 });
    cp.fulfill(id);
    assert.equal(cp.get(id).status, 'fulfilled');
  });

  it('lists pending commitments for an agent', () => {
    const cp = new CommitmentProtocol();
    cp.create({ from: 'tech', to: 'ceo', action: 'Task 1', deadline: 3 });
    cp.create({ from: 'tech', to: 'product', action: 'Task 2', deadline: 5 });
    const pending = cp.getPendingFor('tech');
    assert.equal(pending.length, 2);
  });

  it('detects overdue commitments', () => {
    const cp = new CommitmentProtocol();
    const id = cp.create({ from: 'tech', to: 'ceo', action: 'Task', deadline: 0 });
    // Manually expire
    cp.get(id).createdAt = Date.now() - 100000;
    const overdue = cp.getOverdue();
    assert.ok(overdue.length >= 1);
  });
});
