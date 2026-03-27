import fs from 'node:fs/promises';
import path from 'node:path';
import paths from '../utils/paths.js';

export class StartupSelector {
  async listStartups() {
    const startupsDir = paths.startups();
    try {
      const entries = await fs.readdir(startupsDir, { withFileTypes: true });
      const startups = [];
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const configPath = path.join(startupsDir, entry.name, 'startup.json');
        try {
          const data = JSON.parse(await fs.readFile(configPath, 'utf8'));
          startups.push({
            name: entry.name,
            displayName: data.name || entry.name,
            description: data.description || '',
            agentCount: (data.agents || []).length,
            createdAt: data.createdAt,
          });
        } catch { /* skip invalid */ }
      }
      return startups;
    } catch { return []; }
  }

  async hasStartups() {
    const list = await this.listStartups();
    return list.length > 0;
  }
}
