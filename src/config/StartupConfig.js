import fs from 'node:fs/promises';
import path from 'node:path';

export class StartupConfig {
  #dir;

  constructor(startupDir) {
    this.#dir = startupDir;
  }

  #configPath() { return path.join(this.#dir, 'startup.json'); }

  async create(config) {
    await fs.mkdir(this.#dir, { recursive: true });
    await fs.mkdir(path.join(this.#dir, 'agents'), { recursive: true });
    await fs.mkdir(path.join(this.#dir, 'shared'), { recursive: true });
    await fs.mkdir(path.join(this.#dir, 'output', 'docs'), { recursive: true });
    await fs.mkdir(path.join(this.#dir, 'logs'), { recursive: true });
    const data = { version: 1, ...config, createdAt: new Date().toISOString() };
    await fs.writeFile(this.#configPath(), JSON.stringify(data, null, 2));
    // Create agent directories
    for (const agent of (config.agents || [])) {
      await fs.mkdir(path.join(this.#dir, 'agents', agent.id), { recursive: true });
    }
    return data;
  }

  async load() {
    const raw = await fs.readFile(this.#configPath(), 'utf8');
    return JSON.parse(raw);
  }

  async update(changes) {
    const data = await this.load();
    Object.assign(data, changes);
    await fs.writeFile(this.#configPath(), JSON.stringify(data, null, 2));
    return data;
  }

  async exists() {
    try { await fs.access(this.#configPath()); return true; }
    catch { return false; }
  }
}
