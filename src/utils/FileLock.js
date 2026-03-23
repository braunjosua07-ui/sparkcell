// src/utils/FileLock.js
import { lock, unlock, check } from 'proper-lockfile';
import fs from 'node:fs/promises';
import path from 'node:path';

export class FileLock {
  #locks = new Set();

  async acquire(filePath) {
    const dir = path.dirname(filePath);
    await fs.mkdir(dir, { recursive: true });
    // Ensure file exists for lockfile
    try { await fs.access(filePath); }
    catch { await fs.writeFile(filePath, ''); }
    const release = await lock(filePath, { retries: { retries: 3, minTimeout: 100 } });
    this.#locks.add(filePath);
    return release;
  }

  async release(filePath) {
    try {
      await unlock(filePath);
      this.#locks.delete(filePath);
    } catch { /* already unlocked */ }
  }

  async releaseAll() {
    for (const fp of this.#locks) {
      await this.release(fp);
    }
  }

  async isLocked(filePath) {
    try { return await check(filePath); }
    catch { return false; }
  }
}
