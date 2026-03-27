// test/core/Agent-Storage.test.js
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { ProtectionStorage } from '../../src/core/ProtectionStorage.js';
import { ProtectionSystem } from '../../src/core/ProtectionSystem.js';

describe('Agent ProtectionStorage Integration', () => {
  let tmpDir;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sc-agent-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true });
  });

  it('records action to storage via protection system', () => {
    const storage = new ProtectionStorage({ persistDir: tmpDir });
    const protection = new ProtectionSystem({ storage });

    // Test direct protection storage recording
    protection.recordAction('test-agent', 'test-action', 'test-target');
    const stored = storage.get('test-agent');
    assert.ok(stored.length > 0);
    assert.equal(stored[0].actionType, 'test-action');
  });

  it('persists storage to file with proper content', async () => {
    const storage = new ProtectionStorage({ persistDir: tmpDir });
    const protection = new ProtectionSystem({ storage });

    // Record some actions
    protection.recordAction('persist-agent', 'action1', 'target1');
    protection.recordAction('persist-agent', 'action2', 'target2');
    protection.recordAction('persist-agent', 'action3', 'target3');

    // Save to file
    await protection.saveToStorage('persist-agent');

    // Load from file directly - saveToStorage copies log to storage, then saveBuffer saves
    // The buffer will have rotations due to maxActions limit, but content is preserved
    const filePath = path.join(tmpDir, 'persist-agent.json');
    const raw = await fs.readFile(filePath, 'utf8');
    const loaded = JSON.parse(raw);
    // saveToStorage copies all actions from log, which gets rotated
    // We verify all expected actions are present
    assert.ok(loaded.length >= 3, 'Should have at least 3 actions');
    const actionTypes = loaded.map(a => a.actionType);
    assert.ok(actionTypes.includes('action1'));
    assert.ok(actionTypes.includes('action2'));
    assert.ok(actionTypes.includes('action3'));
  });

  it('loads storage from file', async () => {
    const storage = new ProtectionStorage({ persistDir: tmpDir });

    // Pre-save some data
    const filePath = path.join(tmpDir, 'load-agent.json');
    await fs.writeFile(filePath, JSON.stringify([
      { actionType: 'preloaded', target: 'pre', timestamp: Date.now() - 1000 }
    ]));

    // Load
    const loaded = await storage.load('load-agent');
    assert.equal(loaded.length, 1);
    assert.equal(loaded[0].actionType, 'preloaded');
  });

  it('rotates storage when exceeding max actions', async () => {
    const storage = new ProtectionStorage({ persistDir: tmpDir, maxActions: 3 });
    const protection = new ProtectionSystem({ storage });

    // Record more than max
    protection.recordAction('rotate-agent', 'a', '1');
    protection.recordAction('rotate-agent', 'b', '2');
    protection.recordAction('rotate-agent', 'c', '3');
    protection.recordAction('rotate-agent', 'd', '4');

    const stored = storage.get('rotate-agent');
    assert.equal(stored.length, 3);
    assert.equal(stored[0].actionType, 'b'); // First one should be rotated out
  });
});
