import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { ToolPermissions } from '../../src/tools/ToolPermissions.js';

describe('ToolPermissions', () => {
  let perms;

  beforeEach(() => {
    perms = new ToolPermissions();
  });

  it('defaults to auto (allowed) for unknown tools', () => {
    assert.equal(perms.check('agent1', 'readFile', {}), 'allowed');
  });

  it('returns allowed for auto tools', () => {
    perms.setRule('readFile', 'auto');
    assert.equal(perms.check('agent1', 'readFile', {}), 'allowed');
  });

  it('returns denied for deny tools', () => {
    perms.setRule('dangerous', 'deny');
    assert.equal(perms.check('agent1', 'dangerous', {}), 'denied');
  });

  it('returns needs-approval for ask tools', () => {
    perms.setRule('socialPost', 'ask');
    assert.equal(perms.check('agent1', 'socialPost', {}), 'needs-approval');
  });

  it('returns allowed for ask tools after approval', () => {
    perms.setRule('socialPost', 'ask');
    perms.approve('agent1:socialPost');
    assert.equal(perms.check('agent1', 'socialPost', {}), 'allowed');
  });

  it('approval is per-agent', () => {
    perms.setRule('socialPost', 'ask');
    perms.approve('agent1:socialPost');
    assert.equal(perms.check('agent1', 'socialPost', {}), 'allowed');
    assert.equal(perms.check('agent2', 'socialPost', {}), 'needs-approval');
  });

  it('throws on invalid permission level', () => {
    assert.throws(() => perms.setRule('test', 'invalid'), /Invalid permission level/);
  });

  it('getRule returns the current rule', () => {
    perms.setRule('bash', 'auto');
    assert.equal(perms.getRule('bash'), 'auto');
    assert.equal(perms.getRule('unknown'), 'auto'); // default
  });
});

describe('ToolPermissions — Persistence', () => {
  it('saves and loads state', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sparkcell-test-'));
    const configPath = path.join(tmpDir, 'permissions-state.json');

    const perms1 = new ToolPermissions();
    perms1.setRule('socialPost', 'ask');
    perms1.setRule('bash', 'auto');
    perms1.approve('agent1:socialPost');
    await perms1.save(configPath);

    const perms2 = new ToolPermissions();
    await perms2.load(configPath);
    assert.equal(perms2.check('agent1', 'socialPost', {}), 'allowed');
    assert.equal(perms2.check('agent2', 'socialPost', {}), 'needs-approval');
    assert.equal(perms2.getRule('bash'), 'auto');

    await fs.rm(tmpDir, { recursive: true });
  });

  it('handles missing config file gracefully', async () => {
    const perms = new ToolPermissions();
    await perms.load('/tmp/nonexistent-path-12345/perms.json');
    assert.equal(perms.check('agent1', 'test', {}), 'allowed');
  });
});
