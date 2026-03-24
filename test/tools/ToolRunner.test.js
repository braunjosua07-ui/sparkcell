import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { ToolRunner } from '../../src/tools/ToolRunner.js';
import { ToolPermissions } from '../../src/tools/ToolPermissions.js';
import { WorkerBus } from '../../src/communication/WorkerBus.js';

const makeTool = (overrides = {}) => ({
  name: 'testTool',
  description: 'A test tool',
  parameters: {
    input: { type: 'string', required: true, description: 'Input value' },
  },
  permissionLevel: 'auto',
  execute: async (args) => ({ success: true, output: `echo: ${args.input}` }),
  ...overrides,
});

describe('ToolRunner — Registration', () => {
  let runner;

  beforeEach(() => {
    runner = new ToolRunner();
  });

  it('registers a valid tool', () => {
    runner.registerTool(makeTool());
    assert.ok(runner.hasTool('testTool'));
  });

  it('rejects duplicate tool name', () => {
    runner.registerTool(makeTool());
    assert.throws(() => runner.registerTool(makeTool()), /already registered/);
  });

  it('rejects invalid tool interface', () => {
    assert.throws(() => runner.registerTool({ name: 'bad' }), /Invalid tool/);
  });

  it('lists registered tool names', () => {
    runner.registerTool(makeTool());
    runner.registerTool(makeTool({ name: 'otherTool' }));
    assert.deepEqual(runner.getToolNames(), ['testTool', 'otherTool']);
  });
});

describe('ToolRunner — getToolDefinitions', () => {
  let runner;

  beforeEach(() => {
    runner = new ToolRunner();
    runner.registerTool(makeTool());
  });

  it('returns OpenAI format by default', () => {
    const defs = runner.getToolDefinitions('openai');
    assert.equal(defs.length, 1);
    assert.equal(defs[0].type, 'function');
    assert.equal(defs[0].function.name, 'testTool');
    assert.ok(defs[0].function.parameters.properties.input);
    assert.deepEqual(defs[0].function.parameters.required, ['input']);
  });

  it('returns Anthropic format', () => {
    const defs = runner.getToolDefinitions('anthropic');
    assert.equal(defs.length, 1);
    assert.equal(defs[0].name, 'testTool');
    assert.ok(defs[0].input_schema.properties.input);
  });
});

describe('ToolRunner — execute', () => {
  let runner, bus;

  beforeEach(() => {
    bus = new WorkerBus();
    runner = new ToolRunner({ bus });
    runner.registerTool(makeTool());
  });

  it('executes a tool and returns result', async () => {
    const result = await runner.execute('agent1', 'testTool', { input: 'hello' });
    assert.equal(result.success, true);
    assert.equal(result.output, 'echo: hello');
  });

  it('returns error for unknown tool', async () => {
    const result = await runner.execute('agent1', 'nonexistent', {});
    assert.equal(result.success, false);
    assert.ok(result.error.includes('Unknown tool'));
  });

  it('returns error for invalid args', async () => {
    const result = await runner.execute('agent1', 'testTool', {});
    assert.equal(result.success, false);
    assert.ok(result.error.includes('missing required'));
  });

  it('returns error for denied permission', async () => {
    const permissions = new ToolPermissions();
    const r = new ToolRunner({ permissions });
    r.registerTool(makeTool());
    permissions.setRule('testTool', 'deny');
    const result = await r.execute('agent1', 'testTool', { input: 'hi' });
    assert.equal(result.success, false);
    assert.ok(result.error.includes('Permission denied'));
  });

  it('publishes tool:executed event on bus', async () => {
    let event = null;
    bus.subscribe('tool:executed', (data) => { event = data; });
    await runner.execute('agent1', 'testTool', { input: 'test' });
    assert.ok(event);
    assert.equal(event.toolName, 'testTool');
    assert.equal(event.agentId, 'agent1');
    assert.equal(event.success, true);
  });

  it('handles tool execution errors gracefully', async () => {
    runner.registerTool(makeTool({
      name: 'failTool',
      execute: async () => { throw new Error('boom'); },
    }));
    const result = await runner.execute('agent1', 'failTool', { input: 'x' });
    assert.equal(result.success, false);
    assert.ok(result.error.includes('boom'));
  });

  it('publishes tool:failed event on error', async () => {
    let event = null;
    bus.subscribe('tool:failed', (data) => { event = data; });
    runner.registerTool(makeTool({
      name: 'failTool',
      execute: async () => { throw new Error('crash'); },
    }));
    await runner.execute('agent1', 'failTool', { input: 'x' });
    assert.ok(event);
    assert.equal(event.toolName, 'failTool');
    assert.ok(event.error.includes('crash'));
  });

  it('applies default values to args', async () => {
    runner.registerTool(makeTool({
      name: 'defaultTool',
      parameters: {
        input: { type: 'string', required: true, description: 'Input' },
        mode: { type: 'string', required: false, description: 'Mode', default: 'fast' },
      },
      execute: async (args) => ({ success: true, output: args.mode }),
    }));
    const result = await runner.execute('agent1', 'defaultTool', { input: 'hi' });
    assert.equal(result.output, 'fast');
  });
});
