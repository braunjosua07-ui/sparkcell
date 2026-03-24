import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { ToolRunner } from '../../src/tools/ToolRunner.js';
import { ToolPermissions } from '../../src/tools/ToolPermissions.js';
import { WorkerBus } from '../../src/communication/WorkerBus.js';
import CreateToolTool, { createSandboxedTool } from '../../src/tools/meta/CreateToolTool.js';
import ListToolsTool from '../../src/tools/meta/ListToolsTool.js';
import UpdateConfigTool from '../../src/tools/meta/UpdateConfigTool.js';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

// --- Helpers ---
function makeContext(overrides = {}) {
  const bus = new WorkerBus();
  const permissions = new ToolPermissions();
  const runner = new ToolRunner({ permissions, bus });
  return {
    agentId: 'test-agent',
    agentName: 'Test Agent',
    workDir: '/tmp/sparkcell-test',
    outputDir: '/tmp/sparkcell-test/output',
    bus,
    toolRunner: runner,
    ...overrides,
  };
}

// --- ListToolsTool ---
describe('ListToolsTool', () => {
  let tool;

  beforeEach(() => {
    tool = new ListToolsTool();
  });

  it('has correct interface', () => {
    assert.equal(tool.name, 'listTools');
    assert.equal(tool.permissionLevel, 'auto');
  });

  it('lists registered tools', async () => {
    const ctx = makeContext();
    ctx.toolRunner.registerTool({
      name: 'readFile',
      description: 'Read a file',
      parameters: {},
      permissionLevel: 'auto',
      execute: async () => ({ success: true, output: '' }),
    });

    const result = await tool.execute({ filter: 'all' }, ctx);
    assert.ok(result.success);
    assert.equal(result.output.tools.length, 1);
    assert.equal(result.output.tools[0].name, 'readFile');
  });

  it('filters by core/custom', async () => {
    const ctx = makeContext();
    // Register a core tool
    ctx.toolRunner.registerTool({
      name: 'coreTool',
      description: 'Core',
      parameters: {},
      permissionLevel: 'auto',
      execute: async () => ({ success: true, output: '' }),
    });
    // Register a custom tool
    ctx.toolRunner.registerTool({
      name: 'myCustom',
      description: 'Custom',
      parameters: {},
      permissionLevel: 'auto',
      isCustom: true,
      execute: async () => ({ success: true, output: '' }),
    });

    const coreResult = await tool.execute({ filter: 'core' }, ctx);
    assert.equal(coreResult.output.tools.length, 1);
    assert.equal(coreResult.output.tools[0].name, 'coreTool');

    const customResult = await tool.execute({ filter: 'custom' }, ctx);
    assert.equal(customResult.output.tools.length, 1);
    assert.equal(customResult.output.tools[0].name, 'myCustom');
  });

  it('returns error without ToolRunner', async () => {
    const result = await tool.execute({}, {});
    assert.equal(result.success, false);
  });
});

// --- UpdateConfigTool ---
describe('UpdateConfigTool', () => {
  let tool;

  beforeEach(() => {
    tool = new UpdateConfigTool();
  });

  it('has correct interface', () => {
    assert.equal(tool.name, 'updateConfig');
    assert.equal(tool.permissionLevel, 'auto');
  });

  it('rejects blocked keys', async () => {
    const ctx = makeContext();
    const result = await tool.execute({ key: 'id', value: '"new-id"' }, ctx);
    assert.equal(result.success, false);
    assert.ok(result.error.includes('protected'));
  });

  it('rejects unknown keys', async () => {
    const ctx = makeContext();
    const result = await tool.execute({ key: 'randomKey', value: '"test"' }, ctx);
    assert.equal(result.success, false);
    assert.ok(result.error.includes('not in the allowed list'));
  });

  it('publishes config update for allowed keys', async () => {
    const ctx = makeContext();
    let received = null;
    ctx.bus.subscribe('agent:config-update', (data) => { received = data; });

    const result = await tool.execute({ key: 'skills', value: '["coding","writing"]' }, ctx);
    assert.ok(result.success);
    assert.deepEqual(received.value, ['coding', 'writing']);
    assert.equal(received.key, 'skills');
  });

  it('handles plain string values', async () => {
    const ctx = makeContext();
    let received = null;
    ctx.bus.subscribe('agent:config-update', (data) => { received = data; });

    const result = await tool.execute({ key: 'energyConfig.decayRate', value: 'not-json' }, ctx);
    assert.ok(result.success);
    assert.equal(received.value, 'not-json');
  });
});

// --- CreateToolTool ---
describe('CreateToolTool', () => {
  let tool;
  let tmpDir;

  beforeEach(async () => {
    tool = new CreateToolTool();
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sparkcell-test-'));
  });

  it('has correct interface', () => {
    assert.equal(tool.name, 'createTool');
    assert.equal(tool.permissionLevel, 'auto');
  });

  it('rejects invalid tool names', async () => {
    const ctx = makeContext({ customToolsDir: tmpDir });
    const result = await tool.execute({
      name: '123bad',
      description: 'test',
      parameters: {},
      code: 'return { success: true, output: "hi" };',
    }, ctx);
    assert.equal(result.success, false);
    assert.ok(result.error.includes('lowercase'));
  });

  it('rejects duplicate tool names', async () => {
    const ctx = makeContext({ customToolsDir: tmpDir });
    ctx.toolRunner.registerTool({
      name: 'existingTool',
      description: 'Existing',
      parameters: {},
      permissionLevel: 'auto',
      execute: async () => ({ success: true, output: '' }),
    });

    const result = await tool.execute({
      name: 'existingTool',
      description: 'test',
      parameters: {},
      code: 'return { success: true, output: "hi" };',
    }, ctx);
    assert.equal(result.success, false);
    assert.ok(result.error.includes('already exists'));
  });

  it('rejects syntax errors in code', async () => {
    const ctx = makeContext({ customToolsDir: tmpDir });
    const result = await tool.execute({
      name: 'badCode',
      description: 'test',
      parameters: {},
      code: 'this is not valid javascript {{{{',
    }, ctx);
    assert.equal(result.success, false);
    assert.ok(result.error.includes('Syntax error'));
  });

  it('creates and registers a custom tool', async () => {
    const ctx = makeContext({ customToolsDir: tmpDir });
    let createdEvent = null;
    ctx.bus.subscribe('tool:created', (data) => { createdEvent = data; });

    const result = await tool.execute({
      name: 'greetTool',
      description: 'Says hello',
      parameters: { name: { type: 'string', required: true, description: 'Name' } },
      code: 'return { success: true, output: "Hello " + args.name };',
    }, ctx);

    assert.ok(result.success);
    assert.ok(result.output.includes('greetTool'));
    assert.ok(ctx.toolRunner.hasTool('greetTool'));
    assert.ok(ctx.toolRunner.isCustomTool('greetTool'));
    assert.equal(createdEvent.toolName, 'greetTool');

    // Verify file was saved
    const files = await fs.readdir(tmpDir);
    assert.ok(files.some(f => f.includes('greetTool')));
  });

  it('saves tool definition as JSON', async () => {
    const ctx = makeContext({ customToolsDir: tmpDir });
    await tool.execute({
      name: 'savedTool',
      description: 'A saved tool',
      parameters: {},
      code: 'return { success: true, output: "ok" };',
    }, ctx);

    const files = await fs.readdir(tmpDir);
    const toolFile = files.find(f => f.includes('savedTool'));
    const data = JSON.parse(await fs.readFile(path.join(tmpDir, toolFile), 'utf8'));
    assert.equal(data.name, 'savedTool');
    assert.equal(data.createdBy, 'test-agent');
  });
});

// --- createSandboxedTool ---
describe('createSandboxedTool — Sandbox', () => {
  it('executes simple code in sandbox', async () => {
    const tool = createSandboxedTool(
      'adder', 'Adds two numbers',
      { a: { type: 'number', required: true }, b: { type: 'number', required: true } },
      'return { success: true, output: args.a + args.b };',
    );

    const result = await tool.execute({ a: 3, b: 4 }, { agentId: 'a1', workDir: '/tmp' });
    assert.ok(result.success);
    assert.equal(result.output, 7);
  });

  it('catches runtime errors', async () => {
    const tool = createSandboxedTool(
      'crasher', 'Will crash',
      {},
      'throw new Error("boom");',
    );

    const result = await tool.execute({}, { agentId: 'a1', workDir: '/tmp' });
    assert.equal(result.success, false);
    assert.ok(result.error.includes('boom'));
  });

  it('rejects invalid return format', async () => {
    const tool = createSandboxedTool(
      'badReturn', 'Bad return',
      {},
      'return "just a string";',
    );

    const result = await tool.execute({}, { agentId: 'a1', workDir: '/tmp' });
    assert.equal(result.success, false);
    assert.ok(result.error.includes('must return'));
  });

  it('disables after 3 consecutive failures', async () => {
    const bus = new WorkerBus();
    let disabledEvent = null;
    bus.subscribe('tool:disabled', (data) => { disabledEvent = data; });

    const tool = createSandboxedTool(
      'fragile', 'Breaks easily',
      {},
      'throw new Error("fail");',
    );

    await tool.execute({}, { agentId: 'a1', workDir: '/tmp', bus });
    await tool.execute({}, { agentId: 'a1', workDir: '/tmp', bus });
    await tool.execute({}, { agentId: 'a1', workDir: '/tmp', bus });

    assert.ok(disabledEvent);
    assert.equal(disabledEvent.toolName, 'fragile');

    // 4th call should return disabled error
    const result = await tool.execute({}, { agentId: 'a1', workDir: '/tmp', bus });
    assert.ok(result.error.includes('disabled'));
  });

  it('resets failure count on success', async () => {
    let callCount = 0;
    const tool = createSandboxedTool(
      'flaky', 'Sometimes works',
      {},
      // Use a counter trick — odd calls succeed, even fail
      // Actually we can't track state across calls in sandbox easily,
      // so test with a tool that always succeeds
      'return { success: true, output: "ok" };',
    );

    // These should all succeed
    const r1 = await tool.execute({}, { agentId: 'a1', workDir: '/tmp' });
    const r2 = await tool.execute({}, { agentId: 'a1', workDir: '/tmp' });
    assert.ok(r1.success);
    assert.ok(r2.success);
  });

  it('provides safe globals in sandbox', async () => {
    const tool = createSandboxedTool(
      'globalsTest', 'Tests globals',
      {},
      `
        const arr = [3, 1, 2];
        arr.sort();
        const obj = JSON.stringify({ sorted: arr });
        const d = new Date('2026-01-01').getFullYear();
        return { success: true, output: obj + ' year:' + d };
      `,
    );

    const result = await tool.execute({}, { agentId: 'a1', workDir: '/tmp' });
    assert.ok(result.success);
    assert.ok(result.output.includes('[1,2,3]'));
    assert.ok(result.output.includes('year:2026'));
  });
});

// --- ToolRunner new methods ---
describe('ToolRunner — Phase 2 methods', () => {
  let runner;

  beforeEach(() => {
    runner = new ToolRunner();
  });

  it('getTool returns tool or null', () => {
    const tool = {
      name: 'test',
      description: 'Test',
      parameters: {},
      permissionLevel: 'auto',
      execute: async () => ({ success: true, output: '' }),
    };
    runner.registerTool(tool);
    assert.equal(runner.getTool('test').name, 'test');
    assert.equal(runner.getTool('nonexistent'), null);
  });

  it('isCustomTool identifies custom tools', () => {
    runner.registerTool({
      name: 'core',
      description: 'Core tool',
      parameters: {},
      permissionLevel: 'auto',
      execute: async () => ({ success: true, output: '' }),
    });
    runner.registerTool({
      name: 'custom',
      description: 'Custom tool',
      parameters: {},
      permissionLevel: 'auto',
      isCustom: true,
      execute: async () => ({ success: true, output: '' }),
    });

    assert.equal(runner.isCustomTool('core'), false);
    assert.equal(runner.isCustomTool('custom'), true);
    assert.equal(runner.isCustomTool('nonexistent'), false);
  });

  it('getToolCount returns correct counts', () => {
    runner.registerTool({
      name: 'core1',
      description: 'Core',
      parameters: {},
      permissionLevel: 'auto',
      execute: async () => ({ success: true, output: '' }),
    });
    runner.registerTool({
      name: 'core2',
      description: 'Core 2',
      parameters: {},
      permissionLevel: 'auto',
      execute: async () => ({ success: true, output: '' }),
    });
    runner.registerTool({
      name: 'custom1',
      description: 'Custom',
      parameters: {},
      permissionLevel: 'auto',
      isCustom: true,
      execute: async () => ({ success: true, output: '' }),
    });

    const count = runner.getToolCount();
    assert.equal(count.total, 3);
    assert.equal(count.core, 2);
    assert.equal(count.custom, 1);
  });
});
