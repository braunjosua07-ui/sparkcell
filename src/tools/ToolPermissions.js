import fs from 'node:fs/promises';
import path from 'node:path';

export class ToolPermissions {
  #rules = new Map();
  #approvedActions = new Set();

  check(agentId, toolName, args) {
    const level = this.#rules.get(toolName) || 'auto';
    if (level === 'deny') return 'denied';
    if (level === 'auto') return 'allowed';
    // level === 'ask'
    const actionKey = `${agentId}:${toolName}`;
    if (this.#approvedActions.has(actionKey)) return 'allowed';
    return 'needs-approval';
  }

  approve(actionKey) {
    this.#approvedActions.add(actionKey);
  }

  setRule(toolName, level) {
    if (!['auto', 'ask', 'deny'].includes(level)) {
      throw new Error(`Invalid permission level: ${level}`);
    }
    this.#rules.set(toolName, level);
  }

  getRule(toolName) {
    return this.#rules.get(toolName) || 'auto';
  }

  async load(configPath) {
    try {
      const data = JSON.parse(await fs.readFile(configPath, 'utf8'));
      if (data.rules) {
        for (const [name, level] of Object.entries(data.rules)) {
          this.#rules.set(name, level);
        }
      }
      if (data.approved) {
        for (const key of data.approved) {
          this.#approvedActions.add(key);
        }
      }
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
      // No saved state — start fresh
    }
  }

  async save(configPath) {
    await fs.mkdir(path.dirname(configPath), { recursive: true });
    const data = {
      rules: Object.fromEntries(this.#rules),
      approved: [...this.#approvedActions],
    };
    await fs.writeFile(configPath, JSON.stringify(data, null, 2));
  }
}
