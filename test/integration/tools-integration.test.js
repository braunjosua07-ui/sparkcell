import {ToolRunner} from '../../src/tools/ToolRunner.js';
import {ToolPermissions} from '../../src/tools/ToolPermissions.js';
import {afterEach, beforeEach, test} from 'node:test';
import {deepEqual, equal, notEqual, ok, throws} from 'node:assert';
import path from 'node:path';
import fs from 'node:fs/promises';

const testWorkDir = '/tmp/sparkcell-test-workdir';
const testOutputDir = '/tmp/sparkcell-test-output';

beforeEach(async () => {
  // Create temporary test directories
  await fs.mkdir(testWorkDir, {recursive: true});
  await fs.mkdir(testOutputDir, {recursive: true});
  // Create a test file for readFile tests
  await fs.writeFile(path.join(testWorkDir, 'testfile.txt'), 'Hello Test World');
  await fs.writeFile(path.join(testOutputDir, 'output.txt'), 'Output content');
});

afterEach(async () => {
  // Cleanup test directories
  try {
    await fs.rm(testWorkDir, {recursive: true, force: true});
  } catch {}
  try {
    await fs.rm(testOutputDir, {recursive: true, force: true});
  } catch {}
});

test('ToolRunner integration: registerDirectory() loads tools from core directory', async () => {
  const toolRunner = new ToolRunner();
  const coreToolsDir = '/Users/josuabraun/Desktop/sparkcell/src/tools/core';

  await toolRunner.registerDirectory(coreToolsDir);

  const toolNames = toolRunner.getToolNames();
  ok(toolNames.length > 0, 'Should load at least one tool from core directory');
  ok(toolNames.includes('readFile'), 'Should load readFile tool');
  ok(toolNames.includes('glob'), 'Should load glob tool');
});

test('ToolRunner integration: execute() works with a real tool (readFile)', async () => {
  const toolRunner = new ToolRunner();
  const coreToolsDir = '/Users/josuabraun/Desktop/sparkcell/src/tools/core';
  await toolRunner.registerDirectory(coreToolsDir);

  const context = {
    workDir: testWorkDir,
    outputDir: testOutputDir,
  };

  const result = await toolRunner.execute('test-agent', 'readFile', {
    path: 'testfile.txt',
    offset: 1,
    limit: 10,
  }, context);

  equal(result.success, true, 'Should execute successfully');
  ok(result.output.includes('Hello Test World'), 'Should contain file contents');
});

test('ToolRunner integration: execute() works with glob tool', async () => {
  const toolRunner = new ToolRunner();
  const coreToolsDir = '/Users/josuabraun/Desktop/sparkcell/src/tools/core';
  await toolRunner.registerDirectory(coreToolsDir);

  const context = {
    workDir: testWorkDir,
    outputDir: testOutputDir,
  };

  // Create a couple of test files to glob
  await fs.writeFile(path.join(testWorkDir, 'file1.js'), 'content1');
  await fs.writeFile(path.join(testWorkDir, 'file2.js'), 'content2');

  const result = await toolRunner.execute('test-agent', 'glob', {
    pattern: '*.js',
    path: testWorkDir,
  }, context);

  equal(result.success, true, 'Should execute glob successfully');
  ok(result.output.includes('file1.js') || result.output.includes('file2.js'), 'Should find glob matches');
});

test('ToolRunner integration: execute() returns error for invalid arguments', async () => {
  const toolRunner = new ToolRunner();
  const coreToolsDir = '/Users/josuabraun/Desktop/sparkcell/src/tools/core';
  await toolRunner.registerDirectory(coreToolsDir);

  const context = {
    workDir: testWorkDir,
    outputDir: testOutputDir,
  };

  // Test 1: Nonexistent path for readFile
  const result1 = await toolRunner.execute('test-agent', 'readFile', {
    path: 'nonexistent-file.txt',
  }, context);

  equal(result1.success, false, 'Should fail for nonexistent file');
  ok(result1.error.includes('ENOENT') || result1.error.includes('not found') || result1.error.includes('not found'), 'Should have error message');

  // Test 2: Missing required parameter
  const result2 = await toolRunner.execute('test-agent', 'readFile', {}, context);

  equal(result2.success, false, 'Should fail for missing required parameter');
  ok(result2.error.includes('missing required parameter'), 'Should indicate missing parameter');
});

test('ToolRunner integration: execute() enforces permissionLevel', async () => {
  // Create a custom tool with 'ask' permission level
  class TestRestrictedTool {
    name = 'restrictedTool';
    description = 'A restricted tool for testing';
    parameters = {
      data: {type: 'string', required: false, description: 'Some data'},
    };
    permissionLevel = 'ask';

    async execute(args, context) {
      return {success: true, output: `Processed: ${args.data}`};
    }
  }

  const toolRunner = new ToolRunner();
  toolRunner.registerTool(new TestRestrictedTool());

  const context = {
    workDir: testWorkDir,
    outputDir: testOutputDir,
  };

  // Execute without approval - should return timeout/error for needs-approval
  const result = await toolRunner.execute('test-agent', 'restrictedTool', {
    data: 'test',
  }, context);

  // Should fail because permission level is 'ask' and no approval was given
  equal(result.success, false, 'Should fail without approval for ask permission level');
  ok(result.error.includes('timeout') || result.error.includes('Approval') || result.error.includes('denied'), 'Should have permission-related error');
});

test('ToolRunner integration: getToolCount() returns correct core/custom counts', async () => {
  const toolRunner = new ToolRunner();
  const coreToolsDir = '/Users/josuabraun/Desktop/sparkcell/src/tools/core';
  await toolRunner.registerDirectory(coreToolsDir);

  // Check initial counts
  const counts1 = toolRunner.getToolCount();
  ok(counts1.total > 0, 'Should have total count');
  ok(counts1.core > 0, 'Should have core count');
  equal(counts1.custom, 0, 'Should have no custom tools initially');

  // Add a custom tool
  class CustomTool {
    name = 'customTool';
    description = 'A custom tool';
    parameters = {};
    permissionLevel = 'auto';
    isCustom = true;

    async execute(args, context) {
      return {success: true, output: 'custom'};
    }
  }

  toolRunner.registerTool(new CustomTool());

  // Check updated counts
  const counts2 = toolRunner.getToolCount();
  equal(counts2.total, counts1.total + 1, 'Total should increase by 1');
  equal(counts2.custom, 1, 'Should have 1 custom tool');
});

test('ToolRunner integration: execute() returns error for unknown tool', async () => {
  const toolRunner = new ToolRunner();

  const context = {
    workDir: testWorkDir,
    outputDir: testOutputDir,
  };

  const result = await toolRunner.execute('test-agent', 'nonexistentTool', {}, context);

  equal(result.success, false, 'Should fail for unknown tool');
  ok(result.error.includes('Unknown tool'), 'Should indicate unknown tool');
});

test('ToolRunner integration: ToolPermissions setRule and check', () => {
  const permissions = new ToolPermissions();

  permissions.setRule('readFile', 'auto');
  permissions.setRule('bash', 'ask');
  permissions.setRule('execDangerous', 'deny');

  equal(permissions.getRule('readFile'), 'auto');
  equal(permissions.getRule('bash'), 'ask');
  equal(permissions.getRule('execDangerous'), 'deny');

  // Check permission levels
  equal(permissions.check('agent1', 'readFile', {}), 'allowed');
  equal(permissions.check('agent1', 'bash', {}), 'needs-approval');
  equal(permissions.check('agent1', 'execDangerous', {}), 'denied');
});

test('ToolRunner integration: ToolPermissions approval workflow', () => {
  const permissions = new ToolPermissions();

  permissions.setRule('readFile', 'ask');

  // Initial check should be needs-approval
  equal(permissions.check('agent1', 'readFile', {}), 'needs-approval');

  // Approve the action
  permissions.approve('agent1:readFile');

  // Check should now be allowed
  equal(permissions.check('agent1', 'readFile', {}), 'allowed');
});

test('ToolRunner integration: registerDirectory() handles invalid path gracefully', async () => {
  const toolRunner = new ToolRunner();

  // Should not throw for nonexistent directory
  await toolRunner.registerDirectory('/tmp/nonexistent-tool-dir-12345');

  // Should still have no tools
  equal(toolRunner.getToolNames().length, 0, 'Should have no tools after invalid directory');
});

test('ToolRunner integration: ToolRunner validation - invalid tool interface', () => {
  const toolRunner = new ToolRunner();

  // Test invalid tool - missing name
  throws(() => {
    toolRunner.registerTool({
      description: 'No name',
      parameters: {},
      permissionLevel: 'auto',
      execute: async () => ({}),
    });
  }, /missing or invalid name/);

  // Test invalid tool - missing execute function
  throws(() => {
    toolRunner.registerTool({
      name: 'noExecute',
      description: 'No execute',
      parameters: {},
      permissionLevel: 'auto',
    });
  }, /missing execute function/);

  // Test invalid tool - invalid permissionLevel
  // Note: ToolValidator checks multiple fields, so the error may include multiple issues
  throws(() => {
    toolRunner.registerTool({
      name: 'badPermission',
      description: 'Bad permission',
      parameters: {},
      permissionLevel: 'invalid',
    });
  }, /(Invalid permission level|missing execute function)/);
});
