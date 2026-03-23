// src/utils/ArchiveSystem.js
import fs from 'node:fs/promises';
import path from 'node:path';

export class ArchiveSystem {
  constructor({ maxAgeDays = 30, maxFiles = 100 } = {}) {
    this.maxAgeDays = maxAgeDays;
    this.maxFiles = maxFiles;
  }

  async cleanup(directory) {
    let entries;
    try { entries = await fs.readdir(directory, { withFileTypes: true }); }
    catch { return { removed: 0 }; }

    const files = [];
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      const filePath = path.join(directory, entry.name);
      const stat = await fs.stat(filePath);
      files.push({ path: filePath, mtime: stat.mtimeMs });
    }

    files.sort((a, b) => b.mtime - a.mtime);
    const now = Date.now();
    const maxAge = this.maxAgeDays * 24 * 60 * 60 * 1000;
    let removed = 0;

    for (let i = 0; i < files.length; i++) {
      const isOld = (now - files[i].mtime) > maxAge;
      const isBeyondLimit = i >= this.maxFiles;
      if (isOld || isBeyondLimit) {
        await fs.unlink(files[i].path);
        removed++;
      }
    }
    return { removed };
  }
}
