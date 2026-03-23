// test/utils/paths.test.js
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';

describe('paths', () => {
  const originalEnv = process.env.SPARKCELL_HOME;

  after(() => {
    if (originalEnv) process.env.SPARKCELL_HOME = originalEnv;
    else delete process.env.SPARKCELL_HOME;
  });

  it('uses default home directory', async () => {
    delete process.env.SPARKCELL_HOME;
    const { default: paths } = await import('../../src/utils/paths.js?' + Date.now());
    const expected = path.join(os.homedir(), '.sparkcell');
    assert.ok(paths.home().endsWith('.sparkcell'));
  });

  it('resolves config path', async () => {
    const { default: paths } = await import('../../src/utils/paths.js?' + Date.now());
    assert.ok(paths.config().endsWith('config.json'));
  });

  it('resolves startup paths', async () => {
    const { default: paths } = await import('../../src/utils/paths.js?' + Date.now());
    const p = paths.startup('my-app');
    assert.ok(p.includes('startups'));
    assert.ok(p.endsWith('my-app'));
  });

  it('resolves agent path with startup and id', async () => {
    const { default: paths } = await import('../../src/utils/paths.js?' + Date.now());
    const p = paths.agent('my-app', 'ceo');
    assert.ok(p.includes('my-app'));
    assert.ok(p.endsWith('ceo'));
  });

  it('resolves per-startup logs', async () => {
    const { default: paths } = await import('../../src/utils/paths.js?' + Date.now());
    const p = paths.startupLogs('my-app');
    assert.ok(p.includes('my-app'));
    assert.ok(p.endsWith('logs'));
  });
});
