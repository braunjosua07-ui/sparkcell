// test/core/AgentMessageBus.test.js
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { AgentMessageBus } from '../../src/core/AgentMessageBus.js';
import { WorkerBus } from '../../src/communication/WorkerBus.js';

describe('AgentMessageBus', () => {
  let bus;
  let eventBus;

  beforeEach(() => {
    eventBus = new WorkerBus();
    bus = new AgentMessageBus(eventBus);
  });

  it('sends message and emits event', () => {
    let received;
    eventBus.subscribe('agent:message', (data) => { received = data; });

    const msgId = bus.send('agent-a', 'agent-b', 'Hello!');

    assert.ok(received);
    assert.equal(received.fromAgentId, 'agent-a');
    assert.equal(received.toAgentId, 'agent-b');
    assert.equal(received.content, 'Hello!');
    assert.ok(received.messageId.startsWith('msg-'));
  });

  it('creates help request', () => {
    let received;
    eventBus.subscribe('agent:message', (data) => { received = data; });

    bus.requestHelp('agent-a', 'agent-b', 'Stuck on file parsing');

    assert.equal(received.content.type, 'help');
    assert.ok(received.content.description.includes('Stuck'));
  });

  it('subscribes to messages for specific agent', () => {
    let received;
    bus.subscribeToMessages('agent-b', (data) => { received = data; });

    // Only this message should be received (to agent-b)
    bus.send('agent-a', 'agent-b', 'To B');

    assert.ok(received);
    assert.equal(received.toAgentId, 'agent-b');
    assert.equal(received.content, 'To B');
  });

  it('responds to help request', () => {
    let helpResponse;
    eventBus.subscribe('agent:help-response', (data) => { helpResponse = data; });

    const msgId = bus.requestHelp('agent-a', 'agent-b', 'Need help');
    bus.respondToHelp(msgId, 'Here is the solution', true, 'agent-b', 'agent-a');

    assert.ok(helpResponse);
    assert.equal(helpResponse.response, 'Here is the solution');
    assert.equal(helpResponse.approved, true);
  });
});
