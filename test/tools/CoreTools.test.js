import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import ReadFileTool from '../../src/tools/core/ReadFileTool.js';
import WriteFileTool from '../../src/tools/core/WriteFileTool.js';
import EditFileTool from '../../src/tools/core/EditFileTool.js';
import GlobTool from '../../src/tools/core/GlobTool.js';
import GrepTool from '../../src/tools/core/GrepTool.js';
import BashTool from '../../src/tools/core/BashTool.js';

let tmpDir;
let ctx;

async function setup() {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sparkcell-core-test-'));
  ctx = { workDir: tmpDir, outputDir: path.join(tmpDir, 'output') };
  await fs.mkdir(ctx.outputDir, { recursive: true });
  // Create test files
  await fs.writeFile(path.join(tmpDir, 'hello.txt'), 'Hello World\nLine 2\nLine 3\n');
  await fs.mkdir(path.join(tmpDir, 'src'), { recursive: true });
  await fs.writeFile(path.join(tmpDir, 'src', 'app.js'), 'const x = 42;\nconsole.log(x);\n');
  await fs.writeFile(path.join(tmpDir, 'src', 'util.js'), 'export function add(a, b) { return a + b; }\n');
}

async function cleanup() {
  await fs.rm(tmpDir, { recursive: true, force: true });
}

describe('ReadFileTool', () => {
  beforeEach(setup);
  afterEach(cleanup);
  const tool = new ReadFileTool();

  it('has correct interface', () => {
    assert.equal(tool.name, 'readFile');
    assert.equal(tool.permissionLevel, 'auto');
  });

  it('reads a file', async () => {
    const r = await tool.execute({ path: 'hello.txt' }, ctx);
    assert.equal(r.success, true);
    assert.ok(r.output.includes('Hello World'));
  });

  it('reads with offset and limit', async () => {
    const r = await tool.execute({ path: 'hello.txt', offset: 2, limit: 1 }, ctx);
    assert.equal(r.success, true);
    assert.equal(r.output, 'Line 2');
  });

  it('truncates long files', async () => {
    const longContent = 'x'.repeat(5000);
    await fs.writeFile(path.join(tmpDir, 'big.txt'), longContent);
    const r = await tool.execute({ path: 'big.txt' }, ctx);
    assert.equal(r.success, true);
    assert.ok(r.output.includes('[...truncated'));
    assert.ok(r.output.length <= 4100); // 4000 + truncation message
  });

  it('returns error for missing file', async () => {
    const r = await tool.execute({ path: 'nope.txt' }, ctx);
    assert.equal(r.success, false);
    assert.ok(r.error);
  });

  it('handles absolute paths', async () => {
    const r = await tool.execute({ path: path.join(tmpDir, 'hello.txt') }, ctx);
    assert.equal(r.success, true);
    assert.ok(r.output.includes('Hello World'));
  });
});

describe('WriteFileTool', () => {
  beforeEach(setup);
  afterEach(cleanup);
  const tool = new WriteFileTool();

  it('has correct interface', () => {
    assert.equal(tool.name, 'writeFile');
    assert.equal(tool.permissionLevel, 'auto');
  });

  it('writes a new file', async () => {
    const r = await tool.execute({ path: 'new.txt', content: 'hello' }, ctx);
    assert.equal(r.success, true);
    const content = await fs.readFile(path.join(tmpDir, 'new.txt'), 'utf8');
    assert.equal(content, 'hello');
  });

  it('creates parent directories', async () => {
    const r = await tool.execute({ path: 'deep/nested/file.txt', content: 'deep' }, ctx);
    assert.equal(r.success, true);
    const content = await fs.readFile(path.join(tmpDir, 'deep', 'nested', 'file.txt'), 'utf8');
    assert.equal(content, 'deep');
  });

  it('overwrites existing file', async () => {
    await tool.execute({ path: 'hello.txt', content: 'overwritten' }, ctx);
    const content = await fs.readFile(path.join(tmpDir, 'hello.txt'), 'utf8');
    assert.equal(content, 'overwritten');
  });
});

describe('EditFileTool', () => {
  beforeEach(setup);
  afterEach(cleanup);
  const tool = new EditFileTool();

  it('has correct interface', () => {
    assert.equal(tool.name, 'editFile');
    assert.equal(tool.permissionLevel, 'auto');
  });

  it('replaces text in file', async () => {
    const r = await tool.execute({
      path: 'hello.txt', oldString: 'Hello World', newString: 'Hallo Welt',
    }, ctx);
    assert.equal(r.success, true);
    const content = await fs.readFile(path.join(tmpDir, 'hello.txt'), 'utf8');
    assert.ok(content.includes('Hallo Welt'));
    assert.ok(!content.includes('Hello World'));
  });

  it('returns error when string not found', async () => {
    const r = await tool.execute({
      path: 'hello.txt', oldString: 'NONEXISTENT', newString: 'replacement',
    }, ctx);
    assert.equal(r.success, false);
    assert.ok(r.error.includes('String not found'));
  });

  it('returns error for missing file', async () => {
    const r = await tool.execute({
      path: 'nope.txt', oldString: 'x', newString: 'y',
    }, ctx);
    assert.equal(r.success, false);
  });
});

describe('GlobTool', () => {
  beforeEach(setup);
  afterEach(cleanup);
  const tool = new GlobTool();

  it('has correct interface', () => {
    assert.equal(tool.name, 'glob');
    assert.equal(tool.permissionLevel, 'auto');
  });

  it('finds files matching pattern', async () => {
    const r = await tool.execute({ pattern: '**/*.js' }, ctx);
    assert.equal(r.success, true);
    assert.ok(r.output.includes('src/app.js'));
    assert.ok(r.output.includes('src/util.js'));
  });

  it('finds files in subdirectory', async () => {
    const r = await tool.execute({ pattern: '*.txt' }, ctx);
    assert.equal(r.success, true);
    assert.ok(r.output.includes('hello.txt'));
  });

  it('returns no files message for no match', async () => {
    const r = await tool.execute({ pattern: '**/*.py' }, ctx);
    assert.equal(r.success, true);
    assert.equal(r.output, 'No files found');
  });
});

describe('GrepTool', () => {
  beforeEach(setup);
  afterEach(cleanup);
  const tool = new GrepTool();

  it('has correct interface', () => {
    assert.equal(tool.name, 'grep');
    assert.equal(tool.permissionLevel, 'auto');
  });

  it('finds matching lines', async () => {
    const r = await tool.execute({ query: 'console' }, ctx);
    assert.equal(r.success, true);
    assert.ok(r.output.includes('console.log'));
    assert.ok(r.output.includes('app.js'));
  });

  it('filters by include pattern', async () => {
    const r = await tool.execute({ query: 'const', include: '*.js' }, ctx);
    assert.equal(r.success, true);
    assert.ok(r.output.includes('app.js'));
  });

  it('returns no matches message', async () => {
    const r = await tool.execute({ query: 'ZZZNOMATCHZZZ' }, ctx);
    assert.equal(r.success, true);
    assert.equal(r.output, 'No matches found');
  });
});

describe('BashTool', () => {
  beforeEach(setup);
  afterEach(cleanup);
  const tool = new BashTool();

  it('has correct interface', () => {
    assert.equal(tool.name, 'bash');
    assert.equal(tool.permissionLevel, 'auto');
  });

  it('executes a simple command', async () => {
    const r = await tool.execute({ command: 'echo hello' }, ctx);
    assert.equal(r.success, true);
    assert.ok(r.output.includes('hello'));
  });

  it('runs in workDir', async () => {
    const r = await tool.execute({ command: 'ls hello.txt' }, ctx);
    assert.equal(r.success, true);
    assert.ok(r.output.includes('hello.txt'));
  });

  it('returns error for failing command', async () => {
    const r = await tool.execute({ command: 'exit 1' }, ctx);
    assert.equal(r.success, false);
    assert.ok(r.error.includes('Exit code'));
  });

  it('truncates long output', async () => {
    const r = await tool.execute({ command: 'printf "%0.s0" $(seq 1 3000)' }, ctx);
    assert.equal(r.success, true);
    assert.ok(r.output.includes('[...truncated'));
  });

  it('respects timeout', async () => {
    const r = await tool.execute({ command: 'sleep 10', timeout: 1 }, ctx);
    assert.equal(r.success, false);
    assert.ok(r.error.includes('timed out'));
  });
});
