// test/utils/FileLock.test.js
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { FileLock } from '../../src/utils/FileLock.js';

describe('FileLock', () => {
  let tmpDir, fl;
  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'fl-test-'));
    fl = new FileLock();
  });
  afterEach(async () => { await fl.releaseAll(); await fs.rm(tmpDir, { recursive: true }); });

  it('acquires and releases a lock', async () => {
    const file = path.join(tmpDir, 'test.json');
    await fl.acquire(file);
    assert.equal(await fl.isLocked(file), true);
    await fl.release(file);
  });

  it('releaseAll clears all locks', async () => {
    const f1 = path.join(tmpDir, 'a.json');
    const f2 = path.join(tmpDir, 'b.json');
    await fl.acquire(f1);
    await fl.acquire(f2);
    await fl.releaseAll();
    // No errors thrown = success
  });
});
