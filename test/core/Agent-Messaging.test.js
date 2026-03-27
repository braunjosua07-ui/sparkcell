// test/core/Agent-Messaging.test.js
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { Agent } from '../../src/core/Agent.js';
import { WorkerBus } from '../../src/communication/WorkerBus.js';

describe('Agent Messaging', () => {
  let bus;
  let agentA, agentB;

  beforeEach(() => {
    bus = new WorkerBus();
    agentA = new Agent('agent-a', { bus, name: 'Alice', role: 'developer' });
    agentB = new Agent('agent-b', { bus, name: 'Bob', role: 'developer' });
  });

  it('sends message to another agent', () => {
    let received;
    bus.subscribe('agent:message', (data) => { received = data; });

    agentA.sendTo('agent-b', 'Hallo Bob!');

    assert.ok(received);
    assert.equal(received.fromAgentId, 'agent-a');
    assert.equal(received.toAgentId, 'agent-b');
    assert.equal(received.content, 'Hallo Bob!');
  });

  it('emits help request event', () => {
    let helpEvent;
    // Help requests are sent as regular messages with type: 'help' in content
    bus.subscribe('agent:message', (data) => { helpEvent = data; });

    agentA.requestHelp('agent-b', 'Kannst du mir beim Debuggen helfen?');

    assert.ok(helpEvent);
    assert.equal(helpEvent.content.type, 'help');
    assert.ok(helpEvent.content.description.includes('Debuggen'));
  });

  it('stores received message in memory', async () => {
    let msgReceived;
    bus.subscribe('agent:message', (data) => {
      msgReceived = data;
      // Store in agent-a's memory
      if (data.toAgentId === 'agent-a') {
        agentA.memory.store(`msg-${data.messageId}`, data.content);
      }
    });

    agentB.sendTo('agent-a', 'Testnachricht');

    assert.ok(msgReceived);
    const memories = agentA.memory.search('Testnachricht');
    assert.ok(memories.length > 0);
    assert.ok(memories[0].content.includes('Testnachricht'));
  });
});
