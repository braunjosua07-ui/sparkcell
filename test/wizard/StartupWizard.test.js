import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { StartupWizard } from '../../src/wizard/StartupWizard.js';
import { StartupConfig } from '../../src/config/StartupConfig.js';
import paths from '../../src/utils/paths.js';

describe('StartupWizard', () => {
  let tmpBaseDir;
  let originalSparkcellHome;

  beforeEach(async () => {
    tmpBaseDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sc-test-'));
    originalSparkcellHome = process.env.SPARKCELL_HOME;
    process.env.SPARKCELL_HOME = tmpBaseDir;
  });

  afterEach(async () => {
    if (originalSparkcellHome) {
      process.env.SPARKCELL_HOME = originalSparkcellHome;
    }
    if (tmpBaseDir) {
      await fs.rm(tmpBaseDir, { recursive: true, force: true });
    }
  });

  describe('createStartup()', () => {
    it('creates proper directory structure and config', async () => {
      const wizard = new StartupWizard({});
      const result = await wizard.createStartup({
        name: 'Test Startup',
        description: 'A test startup',
        teamSize: 3
      });

      const expectedDir = paths.startup('test-startup');
      assert.equal(result.startupDir, expectedDir);
      assert.ok(await fs.access(result.startupDir).then(() => true).catch(() => false));
      assert.ok(await fs.access(path.join(result.startupDir, 'agents')).then(() => true).catch(() => false));
      assert.ok(await fs.access(path.join(result.startupDir, 'shared')).then(() => true).catch(() => false));
      assert.ok(await fs.access(path.join(result.startupDir, 'output', 'docs')).then(() => true).catch(() => false));
      assert.ok(await fs.access(path.join(result.startupDir, 'logs')).then(() => true).catch(() => false));

      const configPath = path.join(result.startupDir, 'startup.json');
      assert.ok(await fs.access(configPath).then(() => true).catch(() => false));
    });

    it('returns correct result object (startupDir, config, agents)', async () => {
      const wizard = new StartupWizard({});
      const result = await wizard.createStartup({
        name: 'Test Startup',
        description: 'A test startup',
        teamSize: 3
      });

      assert.strictEqual(typeof result.startupDir, 'string');
      assert.ok(result.startupDir.length > 0);

      assert.deepStrictEqual(typeof result.config, 'object');
      assert.ok(result.config !== null);
      assert.strictEqual(result.config.name, 'Test Startup');
      assert.strictEqual(result.config.description, 'A test startup');
      assert.ok(Array.isArray(result.config.agents));

      assert.ok(Array.isArray(result.agents));
      assert.ok(result.agents.length >= 3, 'Should have at least 3 agents in fallback team');
      result.agents.forEach(agent => {
        assert.strictEqual(agent.active, true);
      });
    });

    it('creates agents with active flag set to true', async () => {
      const wizard = new StartupWizard({});
      const result = await wizard.createStartup({
        name: 'Active Agents Test',
        description: 'Testing active agents',
        teamSize: 3
      });

      assert.ok(result.agents.length >= 3, 'Should have at least 3 agents in fallback team');
      result.agents.forEach(agent => {
        assert.strictEqual(agent.active, true);
      });
    });
  });

  describe('StartupConfig', () => {
    let tmpDir;

    beforeEach(async () => {
      tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sc-config-'));
    });

    afterEach(async () => {
      if (tmpDir) {
        await fs.rm(tmpDir, { recursive: true, force: true });
      }
    });

    it('StartupConfig.create() properly saves startup.json', async () => {
      const config = new StartupConfig(tmpDir);
      const data = await config.create({
        name: 'Test Startup',
        description: 'Test description',
        agents: [
          { id: 'agent1', name: 'Agent 1', role: 'developer', skills: ['js'] }
        ]
      });

      assert.strictEqual(data.name, 'Test Startup');
      assert.strictEqual(data.description, 'Test description');
      assert.ok(data.createdAt);
      assert.ok(data.version, 1);
      assert.strictEqual(data.agents.length, 1);

      const savedPath = path.join(tmpDir, 'startup.json');
      const raw = await fs.readFile(savedPath, 'utf8');
      const parsed = JSON.parse(raw);
      assert.strictEqual(parsed.name, 'Test Startup');
      assert.strictEqual(parsed.agents[0].id, 'agent1');
    });

    it('StartupConfig.exists() checks file existence', async () => {
      const config = new StartupConfig(tmpDir);
      assert.strictEqual(await config.exists(), false);

      await config.create({
        name: 'Exists Test',
        description: 'Testing existence check',
        agents: []
      });

      assert.strictEqual(await config.exists(), true);
    });

    it('StartupConfig.load() properly loads config', async () => {
      const config = new StartupConfig(tmpDir);
      await config.create({
        name: 'Load Test',
        description: 'Testing load',
        agents: []
      });

      const loaded = await config.load();
      assert.strictEqual(loaded.name, 'Load Test');
      assert.strictEqual(loaded.description, 'Testing load');
      assert.ok(loaded.createdAt);
      assert.strictEqual(loaded.version, 1);
    });

    it('StartupConfig.update() modifies existing config', async () => {
      const config = new StartupConfig(tmpDir);
      await config.create({
        name: 'Update Test',
        description: 'Original',
        agents: []
      });

      const updated = await config.update({ description: 'Modified' });
      assert.strictEqual(updated.description, 'Modified');

      const reloaded = await config.load();
      assert.strictEqual(reloaded.description, 'Modified');
    });
  });
});
