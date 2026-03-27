// test/core/EnergyManager.test.js
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { EnergyManager } from '../../src/core/EnergyManager.js';

describe('EnergyManager', () => {
  let em;

  beforeEach(() => {
    em = new EnergyManager('agent-1', { decayRate: 4, recoveryRate: 20, forcePauseAt: 25, canResumeAt: 80 });
  });

  it('starts at 100% energy', () => {
    assert.equal(em.energy, 100);
  });

  it('decays energy', () => {
    em.decay();
    assert.equal(em.energy, 96);
  });

  it('does not go below 0', () => {
    for (let i = 0; i < 30; i++) em.decay();
    assert.equal(em.energy, 0);
  });

  it('recovers energy', () => {
    em.decay(); em.decay(); // 92
    em.recover();
    assert.equal(em.energy, 100); // capped at 100
  });

  it('detects force pause threshold', () => {
    while (em.energy > 25) em.decay();
    assert.equal(em.shouldForcePause(), true);
  });

  it('cannot resume until threshold met', () => {
    while (em.energy > 20) em.decay();
    assert.equal(em.canResume(), false);
    while (em.energy < 80) em.recover();
    assert.equal(em.canResume(), true);
  });

  it('applies boost', () => {
    while (em.energy > 50) em.decay();
    const before = em.energy;
    em.boost('coffee');
    assert.equal(em.energy, before + 15);
  });

  it('tracks stats', () => {
    em.decay();
    em.recover();
    const stats = em.getStats();
    assert.equal(typeof stats.energy, 'number');
    assert.equal(typeof stats.decayCount, 'number');
  });
});
