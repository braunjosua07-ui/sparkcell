import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { WorkerBus } from '../../src/communication/WorkerBus.js';

describe('WorkerBus', () => {
  it('publishes and subscribes to events', () => {
    const bus = new WorkerBus();
    let received = null;
    bus.subscribe('task-complete', (data) => { received = data; });
    bus.publish('task-complete', { agentId: 'ceo', task: 'vision.md' });
    assert.deepEqual(received, { agentId: 'ceo', task: 'vision.md' });
  });

  it('supports namespaced events', () => {
    const bus = new WorkerBus();
    let count = 0;
    bus.subscribe('agent:*', () => { count++; });
    bus.publish('agent:state-change', {});
    bus.publish('agent:energy', {});
    assert.equal(count, 2);
  });

  it('unsubscribes correctly', () => {
    const bus = new WorkerBus();
    let count = 0;
    const unsub = bus.subscribe('test', () => { count++; });
    bus.publish('test', {});
    unsub();
    bus.publish('test', {});
    assert.equal(count, 1);
  });
});
