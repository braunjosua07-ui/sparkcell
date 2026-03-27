// test/core/ProtectionStorage.test.js
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { ProtectionStorage } from '../../src/core/ProtectionStorage.js';

describe('ProtectionStorage', () => {
  let tmpDir;
  let storage;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sc-protection-'));
    storage = new ProtectionStorage({ persistDir: tmpDir });
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true });
  });

  it('loads empty log for new agent', async () => {
    const log = await storage.load('new-agent');
    assert.deepStrictEqual(log, []);
  });

  it('saves and loads actions', async () => {
    storage.add('agent-1', { actionType: 'write', target: 'file.md' });
    storage.add('agent-1', { actionType: 'read', target: 'other.md' });
    await storage.saveBuffer('agent-1');

    const loaded = await storage.load('agent-1');
    assert.equal(loaded.length, 2);
    assert.equal(loaded[0].actionType, 'write');
    assert.equal(loaded[1].actionType, 'read');
  });

  it('rotates old actions when exceeding max', async () => {
    const smallStorage = new ProtectionStorage({ maxActions: 3 });
    smallStorage.add('agent-1', { actionType: 'a', target: '1' });
    smallStorage.add('agent-1', { actionType: 'b', target: '2' });
    smallStorage.add('agent-1', { actionType: 'c', target: '3' });
    smallStorage.add('agent-1', { actionType: 'd', target: '4' });

    const log = smallStorage.get('agent-1');
    assert.equal(log.length, 3);
    assert.equal(log[0].actionType, 'b');
  });

  it('clears stored data', async () => {
    storage.add('agent-1', { actionType: 'test', target: 'x' });
    await storage.saveBuffer('agent-1');
    const filePath = path.join(tmpDir, 'agent-1.json');
    assert.ok(await fs.access(filePath).then(() => true, () => false));

    await storage.clear('agent-1');
    // clear removes file and deletes from buffer map
    assert.ok(await fs.access(filePath).then(() => false, () => true));
    assert.equal(storage.get('agent-1').length, 0);
  });
});
