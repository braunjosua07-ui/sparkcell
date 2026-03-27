import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { Agent } from '../../src/core/Agent.js';
import { WorkerBus } from '../../src/communication/WorkerBus.js';
import { SharedWhiteboard } from '../../src/communication/SharedWhiteboard.js';

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

describe('Agent — Peer Awareness (Phase 1)', () => {
  let ceo, cto, bus;

  beforeEach(() => {
    bus = new WorkerBus();
    ceo = new Agent('ceo', { name: 'CEO', role: 'ceo', bus });
    cto = new Agent('cto', { name: 'CTO', role: 'cto', bus });
  });

  it('stores peer output in memory when another agent publishes', () => {
    bus.publish('agent:output', {
      agentId: 'cto',
      agentName: 'CTO',
      task: 'Design architecture',
      preview: 'Microservices with event-driven pattern...',
    });

    // CEO should have stored this in memory
    const peerMemories = ceo.memory.search('peer-cto');
    assert.ok(peerMemories.length > 0, 'CEO should have peer memory from CTO');
    assert.ok(peerMemories[0].content.includes('CTO'));
  });

  it('does not store own output as peer', () => {
    bus.publish('agent:output', {
      agentId: 'ceo',
      agentName: 'CEO',
      task: 'Define vision',
      preview: 'Our vision is...',
    });

    const selfMemories = ceo.memory.search('peer-ceo');
    assert.equal(selfMemories.length, 0, 'CEO should not store own output as peer');
  });

  it('stores peer task completions in memory', () => {
    bus.publish('agent:task-completed', {
      agentId: 'cto',
      agentName: 'CTO',
      task: { title: 'Design architecture' },
    });

    const completions = ceo.memory.search('peer-completed');
    assert.ok(completions.length > 0, 'CEO should track CTO task completion');
  });
});

describe('Agent — Whiteboard Integration (Phase 2)', () => {
  let agent, bus, whiteboard;

  beforeEach(() => {
    bus = new WorkerBus();
    whiteboard = new SharedWhiteboard();
    whiteboard.setMission('Build the best AI meme platform');
    whiteboard.addGoal('Launch MVP');
    agent = new Agent('ceo', {
      name: 'CEO',
      role: 'ceo',
      bus,
      whiteboard,
    });
  });

  it('accepts whiteboard in constructor', () => {
    // Agent should not throw with whiteboard
    assert.equal(agent.id, 'ceo');
  });

  it('generates help tasks from whiteboard blockers when idle', async () => {
    // Add a blocker from another agent
    whiteboard.addBlocker('cto', 'Need API design review');

    // Run agent idle cycle — should pick up blocker as help task
    await agent.runLoop();

    const status = agent.getStatus();
    // Agent should have transitioned to WORKING with a help task
    assert.equal(status.state, 'WORKING');
    assert.ok(status.currentTask.title.includes('Help resolve'));
    assert.equal(status.currentTask.source, 'blocker-help');
  });

  it('does not generate help tasks for own blockers', async () => {
    whiteboard.addBlocker('ceo', 'Need more data');

    await agent.runLoop();

    const status = agent.getStatus();
    // Should still be working but NOT on a blocker-help task (it's own blocker)
    assert.equal(status.state, 'WORKING');
    assert.notEqual(status.currentTask.source, 'blocker-help');
  });
});

describe('Agent — Structured Output Parsing', () => {
  it('parses blockers from LLM output and adds to whiteboard', async () => {
    const bus = new WorkerBus();
    const whiteboard = new SharedWhiteboard();
    let blockerEvent = null;
    bus.subscribe('whiteboard:blocker-added', (data) => { blockerEvent = data; });

    const fakeLLM = {
      query: async () => ({
        content: 'Ich brauche Input vom Designer. [BLOCKER: Wireframes fehlen noch]',
        usage: { total_tokens: 100 },
      }),
    };

    const agent = new Agent('cto', {
      name: 'CTO',
      role: 'cto',
      bus,
      whiteboard,
      llm: fakeLLM,
      startupDescription: 'Test Startup',
    });

    // Get agent to WORKING state
    await agent.runLoop(); // IDLE -> generates task -> WORKING
    await agent.runLoop(); // WORKING -> does LLM work

    const wb = whiteboard.getState();
    assert.ok(wb.blockers.length > 0, 'Blocker should be added to whiteboard');
    assert.ok(wb.blockers[0].blocker.includes('Wireframes fehlen'));
    assert.ok(blockerEvent, 'Blocker event should be published on bus');
  });

  it('parses decisions from LLM output and adds to whiteboard', async () => {
    const bus = new WorkerBus();
    const whiteboard = new SharedWhiteboard();

    const fakeLLM = {
      query: async () => ({
        content: 'Wir nutzen React. [DECISION: Frontend-Framework wird React mit TypeScript]',
        usage: { total_tokens: 80 },
      }),
    };

    const agent = new Agent('cto', {
      name: 'CTO',
      role: 'cto',
      bus,
      whiteboard,
      llm: fakeLLM,
      startupDescription: 'Test Startup',
    });

    await agent.runLoop(); // IDLE -> WORKING
    await agent.runLoop(); // WORKING -> LLM call

    const wb = whiteboard.getState();
    assert.ok(wb.decisions.length > 0, 'Decision should be added to whiteboard');
    assert.ok(wb.decisions[0].decision.includes('React'));
  });
});
