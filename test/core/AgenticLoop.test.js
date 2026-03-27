import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { Agent } from '../../src/core/Agent.js';
import { WorkerBus } from '../../src/communication/WorkerBus.js';
import { ToolRunner } from '../../src/tools/ToolRunner.js';

describe('Agent — Agentic Loop', () => {
  let agent, bus, toolRunner, toolCallLog;

  beforeEach(() => {
    bus = new WorkerBus();
    toolRunner = new ToolRunner({ bus });
    toolCallLog = [];

    // Register a simple test tool
    toolRunner.registerTool({
      name: 'readFile',
      description: 'Read a file',
      parameters: {
        path: { type: 'string', required: true, description: 'File path' },
      },
      permissionLevel: 'auto',
      execute: async (args) => {
        toolCallLog.push({ name: 'readFile', args });
        return { success: true, output: `Content of ${args.path}` };
      },
    });
  });

  it('uses agentic loop when toolRunner is provided', async () => {
    let llmCallCount = 0;
    const fakeLLM = {
      query: async (messages, options) => {
        llmCallCount++;
        if (llmCallCount === 1) {
          // First call: return a tool call
          return {
            content: '',
            toolCalls: [{ id: 'call-1', name: 'readFile', args: { path: 'test.js' } }],
            usage: {},
          };
        }
        // Second call: return final text
        return {
          content: 'Datei gelesen: test.js enthält Code.',
          toolCalls: [],
          usage: {},
        };
      },
    };

    agent = new Agent('dev', {
      name: 'Dev',
      role: 'developer',
      bus,
      llm: fakeLLM,
      toolRunner,
      startupDescription: 'Test',
    });

    // Get agent to WORKING state
    await agent.runLoop(); // IDLE -> WORKING
    await agent.runLoop(); // WORKING -> agentic loop

    assert.equal(llmCallCount, 2, 'LLM should be called twice (tool call + final)');
    assert.equal(toolCallLog.length, 1, 'Tool should be called once');
    assert.equal(toolCallLog[0].args.path, 'test.js');
  });

  it('falls back to single-shot when no toolRunner', async () => {
    let llmCalled = false;
    const fakeLLM = {
      query: async () => {
        llmCalled = true;
        return { content: 'Result without tools', usage: {} };
      },
    };

    agent = new Agent('dev', {
      name: 'Dev',
      role: 'developer',
      bus,
      llm: fakeLLM,
      // NO toolRunner
      startupDescription: 'Test',
    });

    await agent.runLoop(); // IDLE -> WORKING
    await agent.runLoop(); // WORKING -> single-shot LLM

    assert.ok(llmCalled);
  });

  it('passes tool definitions to LLM query', async () => {
    let receivedOptions = null;
    const fakeLLM = {
      query: async (messages, options) => {
        receivedOptions = options;
        return { content: 'Done.', toolCalls: [], usage: {} };
      },
    };

    agent = new Agent('dev', {
      name: 'Dev',
      role: 'developer',
      bus,
      llm: fakeLLM,
      toolRunner,
      startupDescription: 'Test',
    });

    await agent.runLoop(); // IDLE -> WORKING
    await agent.runLoop(); // WORKING -> agentic loop

    assert.ok(receivedOptions.tools, 'Tools should be passed to LLM');
    assert.ok(receivedOptions.tools.length > 0);
    assert.equal(receivedOptions.tools[0].function.name, 'readFile');
  });

  it('handles multiple tool calls in sequence', async () => {
    toolRunner.registerTool({
      name: 'writeFile',
      description: 'Write a file',
      parameters: {
        path: { type: 'string', required: true, description: 'Path' },
        content: { type: 'string', required: true, description: 'Content' },
      },
      permissionLevel: 'auto',
      execute: async (args) => {
        toolCallLog.push({ name: 'writeFile', args });
        return { success: true, output: `Written to ${args.path}` };
      },
    });

    let callCount = 0;
    const fakeLLM = {
      query: async () => {
        callCount++;
        if (callCount === 1) {
          return {
            content: '', toolCalls: [
              { id: 'c1', name: 'readFile', args: { path: 'input.txt' } },
            ], usage: {},
          };
        }
        if (callCount === 2) {
          return {
            content: '', toolCalls: [
              { id: 'c2', name: 'writeFile', args: { path: 'output.txt', content: 'processed' } },
            ], usage: {},
          };
        }
        return { content: 'Alles erledigt.', toolCalls: [], usage: {} };
      },
    };

    agent = new Agent('dev', {
      name: 'Dev', role: 'developer', bus, llm: fakeLLM, toolRunner, startupDescription: 'Test',
    });

    await agent.runLoop(); // IDLE -> WORKING
    await agent.runLoop(); // WORKING -> agentic loop with 3 LLM calls

    assert.equal(callCount, 3);
    assert.equal(toolCallLog.length, 2);
    assert.equal(toolCallLog[0].name, 'readFile');
    assert.equal(toolCallLog[1].name, 'writeFile');
  });

  it('stops after max 25 iterations', async () => {
    let callCount = 0;
    const fakeLLM = {
      query: async () => {
        callCount++;
        // Always return a tool call — never finish
        return {
          content: '', toolCalls: [
            { id: `c${callCount}`, name: 'readFile', args: { path: 'loop.txt' } },
          ], usage: {},
        };
      },
    };

    agent = new Agent('dev', {
      name: 'Dev', role: 'developer', bus, llm: fakeLLM, toolRunner, startupDescription: 'Test',
    });

    await agent.runLoop();
    await agent.runLoop();

    assert.equal(callCount, 25, 'Should stop at 25 iterations');
  });

  it('stops after 3 consecutive tool failures', async () => {
    toolRunner.registerTool({
      name: 'failTool',
      description: 'Always fails',
      parameters: { x: { type: 'string', required: true, description: 'X' } },
      permissionLevel: 'auto',
      execute: async () => { throw new Error('broken'); },
    });

    let callCount = 0;
    const fakeLLM = {
      query: async () => {
        callCount++;
        if (callCount <= 4) {
          return {
            content: '', toolCalls: [
              { id: `c${callCount}`, name: 'failTool', args: { x: 'test' } },
            ], usage: {},
          };
        }
        return { content: 'Stopped.', toolCalls: [], usage: {} };
      },
    };

    agent = new Agent('dev', {
      name: 'Dev', role: 'developer', bus, llm: fakeLLM, toolRunner, startupDescription: 'Test',
    });

    await agent.runLoop();
    await agent.runLoop();

    // Should have stopped after 3 failures, not continued to 4+
    assert.ok(callCount <= 4, 'Should stop within a few calls due to failures');
  });

  it('publishes tool:executed events on bus', async () => {
    const events = [];
    bus.subscribe('tool:executed', (data) => events.push(data));

    const fakeLLM = {
      query: async (messages, options) => {
        if (messages.length <= 2) {
          return {
            content: '', toolCalls: [
              { id: 'c1', name: 'readFile', args: { path: 'x.js' } },
            ], usage: {},
          };
        }
        return { content: 'Done.', toolCalls: [], usage: {} };
      },
    };

    agent = new Agent('dev', {
      name: 'Dev', role: 'developer', bus, llm: fakeLLM, toolRunner, startupDescription: 'Test',
    });

    await agent.runLoop();
    await agent.runLoop();

    assert.ok(events.length > 0, 'Should publish tool:executed events');
    assert.equal(events[0].toolName, 'readFile');
  });
});
