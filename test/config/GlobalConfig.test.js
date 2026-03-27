import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { GlobalConfig } from '../../src/config/GlobalConfig.js';

describe('GlobalConfig', () => {
  let tmpDir;
  beforeEach(async () => { tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sc-test-')); });
  afterEach(async () => { await fs.rm(tmpDir, { recursive: true }); });

  it('creates default config on first load', async () => {
    const gc = new GlobalConfig(path.join(tmpDir, 'config.json'));
    await gc.load();
    assert.equal(gc.data.version, 1);
  });

  it('saves and reloads config', async () => {
    const configPath = path.join(tmpDir, 'config.json');
    const gc = new GlobalConfig(configPath);
    await gc.load();
    gc.data.llm = { primary: { provider: 'ollama', model: 'test' } };
    await gc.save();
    const gc2 = new GlobalConfig(configPath);
    await gc2.load();
    assert.equal(gc2.data.llm.primary.provider, 'ollama');
  });

  it('detects first-time setup needed', async () => {
    const gc = new GlobalConfig(path.join(tmpDir, 'config.json'));
    assert.equal(gc.needsSetup(), true);
    await gc.load();
    gc.data.llm = { primary: { provider: 'ollama' } };
    await gc.save();
    await gc.load();
    assert.equal(gc.needsSetup(), false);
  });
});
