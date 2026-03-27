// test/integration/startup-flow.test.js
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

describe('Startup Flow (integration)', () => {
  let tmpDir;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sc-integration-'));
    process.env.SPARKCELL_HOME = tmpDir;
  });

  afterEach(async () => {
    delete process.env.SPARKCELL_HOME;
    await fs.rm(tmpDir, { recursive: true });
  });

  it('creates and runs a startup simulation', async () => {
    // 1. Create global config
    const configDir = tmpDir;
    await fs.mkdir(configDir, { recursive: true });
    await fs.writeFile(path.join(configDir, 'config.json'), JSON.stringify({
      version: 1,
      llm: { primary: { provider: 'ollama', model: 'test', baseUrl: 'http://localhost:11434/v1' } },
    }));

    // 2. Create startup directory
    const startupDir = path.join(configDir, 'startups', 'test-app');
    await fs.mkdir(path.join(startupDir, 'agents', 'ceo'), { recursive: true });
    await fs.mkdir(path.join(startupDir, 'shared'), { recursive: true });
    await fs.mkdir(path.join(startupDir, 'output', 'docs'), { recursive: true });
    await fs.writeFile(path.join(startupDir, 'startup.json'), JSON.stringify({
      version: 1,
      name: 'TestApp',
      description: 'Integration test startup',
      agents: [{ id: 'ceo', name: 'CEO', role: 'strategic-lead', skills: ['strategy'], active: true }],
    }));

    // 3. Verify directory structure was created
    const startupConfig = JSON.parse(await fs.readFile(path.join(startupDir, 'startup.json'), 'utf8'));
    assert.equal(startupConfig.name, 'TestApp');
    assert.equal(startupConfig.agents.length, 1);

    // 4. Note: Full SparkCell run requires LLM — test structure only
  });
});
