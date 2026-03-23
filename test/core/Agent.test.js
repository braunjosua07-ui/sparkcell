import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { Agent } from '../../src/core/Agent.js';
import { WorkerBus } from '../../src/communication/WorkerBus.js';

describe('Agent', () => {
  let agent, bus;

  beforeEach(() => {
    bus = new WorkerBus();
    agent = new Agent('ceo', {
      name: 'CEO',
      role: 'strategic-lead',
      skills: ['strategy', 'vision'],
      bus,
    });
  });

  it('initializes in IDLE state', () => {
    assert.equal(agent.state, 'IDLE');
  });

  it('emits state-change events', () => {
    let emitted = false;
    agent.on('state-change', () => { emitted = true; });
    agent.stateMachine.transition('taskAvailable');
    assert.ok(emitted);
  });

  it('has an id, name, and role', () => {
    assert.equal(agent.id, 'ceo');
    assert.equal(agent.name, 'CEO');
    assert.equal(agent.role, 'strategic-lead');
  });
});
