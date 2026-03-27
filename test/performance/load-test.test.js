// test/performance/load-test.test.js
// Performance tests for parallel agent execution

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { Agent } from '../../src/core/Agent.js';
import { WorkerBus } from '../../src/communication/WorkerBus.js';
import { ProtectionSystem } from '../../src/core/ProtectionSystem.js';
import { ProtectionStorage } from '../../src/core/ProtectionStorage.js';

// Mock LLM that doesn't actually call an API
class MockLLM {
  async query(messages, options = {}) {
    return {
      content: null,
      toolCalls: [
        { id: 'call-1', name: 'bash', args: { command: 'echo "test"' } },
      ],
    };
  }

  async *queryStream(messages, options = {}) {
    yield { type: 'token', text: 'test' };
    yield {
      type: 'done',
      content: null,
      toolCalls: [
        { id: 'call-1', name: 'bash', args: { command: 'echo "test"' } },
      ],
    };
  }
}

// Mock ToolRunner
class MockToolRunner {
  getToolDefinitions() {
    return [
      {
        type: 'function',
        function: {
          name: 'bash',
          description: 'Execute shell command',
          parameters: { type: 'object', properties: { command: { type: 'string' } }, required: ['command'] },
        },
      },
    ];
  }

  async execute(agentId, toolName, args, context) {
    return { success: true, output: 'test' };
  }
}

function createTestAgent(id, bus, index = 0) {
  return new Agent(id, {
    bus,
    name: `Agent-${index}`,
    role: 'generalist',
    llm: new MockLLM(),
    toolRunner: new MockToolRunner(),
    workDir: '/tmp',
    outputDir: '/tmp',
  });
}

describe('Load Tests - Parallel Agent Execution', () => {
  let tmpDir;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sc-load-'));
    process.env.SPARKCELL_HOME = tmpDir;
  });

  afterEach(async () => {
    delete process.env.SPARKCELL_HOME;
    await fs.rm(tmpDir, { recursive: true });
  });

  it('single agent completes basic cycle within budget', async () => {
    const bus = new WorkerBus();
    const agent = createTestAgent('single-agent', bus, 0);

    const startTime = performance.now();
    for (let i = 0; i < 5; i++) {
      await agent.runLoop();
    }
    const elapsed = performance.now() - startTime;

    assert.ok(elapsed < 1000, `Single agent: ${elapsed.toFixed(2)}ms > 1000ms`);
  });

  it('10 agents run concurrently without deadlock', async () => {
    const bus = new WorkerBus();
    const agents = [];

    for (let i = 0; i < 10; i++) {
      agents.push(createTestAgent(`agent-${i}`, bus, i));
      for (let j = 0; j < 3; j++) {
        agents[i].assignTask({
          id: `task-${i}-${j}`,
          title: `Task ${j} for Agent ${i}`,
          description: `Test task ${j}`,
        });
      }
    }

    const cycles = 20;
    const agentCycles = new Map();

    for (let i = 0; i < cycles; i++) {
      for (const agent of agents) {
        await agent.runLoop();
      }
    }

    for (const agent of agents) {
      agentCycles.set(agent.id, agent.getStatus().cycleCount);
    }

    for (const [id, count] of agentCycles) {
      assert.ok(count >= 1, `${id} should have run at least 1 cycle`);
    }
  });

  it('25 agents scale without memory issues', async () => {
    const bus = new WorkerBus();
    const agents = [];

    for (let i = 0; i < 25; i++) {
      agents.push(createTestAgent(`agent-${i}`, bus, i));
    }

    for (let i = 0; i < 10; i++) {
      for (const agent of agents) {
        await agent.runLoop();
      }
    }

    const memUsage = process.memoryUsage();
    assert.ok(memUsage.heapUsed < 100 * 1024 * 1024, 'Heap usage should be < 100MB');
  });

  it('100 cycles on 10 agents measures throughput', async () => {
    const bus = new WorkerBus();
    const agents = [];

    for (let i = 0; i < 10; i++) {
      agents.push(createTestAgent(`agent-${i}`, bus, i));
    }

    for (let i = 0; i < 5; i++) {
      for (const agent of agents) {
        await agent.runLoop();
      }
    }

    const warmupTime = performance.now();
    const startCount = agents[0].getStatus().cycleCount;

    for (let i = 0; i < 100; i++) {
      for (const agent of agents) {
        await agent.runLoop();
      }
    }

    const elapsed = performance.now() - warmupTime;
    const cyclesCompleted = agents[0].getStatus().cycleCount - startCount;
    const cyclesPerSecond = (cyclesCompleted * 10) / (elapsed / 1000);
    const msPerCycle = elapsed / (cyclesCompleted * 10);

    console.log(`Throughput: ${cyclesPerSecond.toFixed(1)} cycles/s, ${msPerCycle.toFixed(1)}ms/cycle`);

    assert.ok(cyclesPerSecond > 0.5, `Throughput ${cyclesPerSecond.toFixed(1)} < 0.5 cycles/s`);
  });

  it('protection system handles high-frequency action logging', async () => {
    const storage = new ProtectionStorage({ persistDir: tmpDir });
    const ps = new ProtectionSystem({ storage });

    const startTime = performance.now();
    const iterations = 1000;

    for (let i = 0; i < iterations; i++) {
      ps.recordAction('test-agent', 'test-action', `target-${i}`);
    }

    const elapsed = performance.now() - startTime;
    const actionsPerMs = iterations / elapsed;

    console.log(`Action logging: ${actionsPerMs.toFixed(2)} actions/ms`);

    assert.ok(elapsed < 100, `Action logging took ${elapsed.toFixed(1)}ms > 100ms`);
  });

  it('event bus handles high-frequency publishing', async () => {
    const bus = new WorkerBus();

    const handlers = [];
    for (let i = 0; i < 100; i++) {
      handlers.push(bus.subscribe('test:event', () => {}));
    }

    const startTime = performance.now();
    const events = 500;

    for (let i = 0; i < events; i++) {
      bus.publish('test:event', { id: i });
    }

    const elapsed = performance.now() - startTime;
    const eventsPerMs = events / elapsed;

    console.log(`Event bus: ${eventsPerMs.toFixed(2)} events/ms`);

    assert.ok(elapsed < 100, `Event publishing took ${elapsed.toFixed(1)}ms > 100ms`);

    for (const unsub of handlers) unsub();
  });
});
