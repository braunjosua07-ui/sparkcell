// src/utils/FileLock.js
import { lock, check } from 'proper-lockfile';
import fs from 'node:fs/promises';
import path from 'node:path';

export class FileLock {
  #releases = new Map();

  async acquire(filePath) {
    if (this.#releases.has(filePath)) return;
    const dir = path.dirname(filePath);
    await fs.mkdir(dir, { recursive: true });
    try { await fs.access(filePath); }
    catch { await fs.writeFile(filePath, ''); }
    const release = await lock(filePath, { retries: { retries: 3, minTimeout: 100 } });
    this.#releases.set(filePath, release);
  }

  async release(filePath) {
    const fn = this.#releases.get(filePath);
    if (fn) {
      try { await fn(); } catch { /* already unlocked */ }
      this.#releases.delete(filePath);
    }
  }

  async releaseAll() {
    for (const fp of [...this.#releases.keys()]) {
      await this.release(fp);
    }
  }

  async isLocked(filePath) {
    try { return await check(filePath); }
    catch { return false; }
  }
}
