import fs from 'node:fs/promises';
import path from 'node:path';
import { DEFAULT_CONFIG } from './defaults.js';

export class GlobalConfig {
  #configPath;
  data = null;

  constructor(configPath) {
    this.#configPath = configPath;
  }

  async load() {
    try {
      const raw = await fs.readFile(this.#configPath, 'utf8');
      this.data = JSON.parse(raw);
    } catch {
      this.data = { ...DEFAULT_CONFIG };
    }
  }

  async save() {
    await fs.mkdir(path.dirname(this.#configPath), { recursive: true });
    await fs.writeFile(this.#configPath, JSON.stringify(this.data, null, 2));
    // Restrict permissions — config may contain API keys
    await fs.chmod(this.#configPath, 0o600).catch(() => {});
  }

  needsSetup() {
    return !this.data || !this.data.llm;
  }
}
