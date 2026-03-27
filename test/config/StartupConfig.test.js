import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { StartupConfig } from '../../src/config/StartupConfig.js';

describe('StartupConfig', () => {
  let tmpDir;
  beforeEach(async () => { tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sc-startup-')); });
  afterEach(async () => { await fs.rm(tmpDir, { recursive: true }); });

  it('creates a new startup config', async () => {
    const sc = new StartupConfig(tmpDir);
    await sc.create({ name: 'TestApp', description: 'A test', agents: [
      { id: 'ceo', name: 'CEO', role: 'strategic-lead', skills: ['strategy'] }
    ]});
    const data = await sc.load();
    assert.equal(data.name, 'TestApp');
    assert.equal(data.agents.length, 1);
  });

  it('updates an existing startup config', async () => {
    const sc = new StartupConfig(tmpDir);
    await sc.create({ name: 'App', description: 'test', agents: [
      { id: 'ceo', name: 'CEO', role: 'strategic-lead', skills: [] }
    ]});
    await sc.update({ description: 'updated' });
    const data = await sc.load();
    assert.equal(data.description, 'updated');
  });
});
