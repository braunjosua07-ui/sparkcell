// src/core/ProtectionStorage.js

import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * ProtectionStorage — Persists agent action history to disk.
 *
 * Maintains a buffer in memory and persistently stores actions
 * as JSON files. Supports rotation when buffer exceeds maxActions.
 */
export class ProtectionStorage {
  #persistDir;
  #maxActions;
  #buffer = new Map();

  /**
   * @param {object} [options]
   * @param {string} [options.persistDir] - Directory for persistence files
   * @param {number} [options.maxActions] - Maximum actions per buffer (default: 100)
   */
  constructor(options = {}) {
    const {
      persistDir = process.env.SPARKCELL_HOME
        ? path.join(process.env.SPARKCELL_HOME, 'protection')
        : process.cwd(),
      maxActions = 100,
    } = options;

    this.#persistDir = persistDir;
    this.#maxActions = maxActions;
  }

  /**
   * Ensure persist directory exists.
   * @returns {Promise<void>}
   */
  async #ensureDir() {
    await fs.mkdir(this.#persistDir, { recursive: true });
  }

  /**
   * Load actions from JSON file for given agentId.
   * @param {string} agentId
   * @returns {Promise<Array>} Array of actions
   */
  async load(agentId) {
    const filePath = this.#getFilePath(agentId);
    try {
      const raw = await fs.readFile(filePath, 'utf8');
      return JSON.parse(raw);
    } catch (err) {
      if (err.code === 'ENOENT') {
        return [];
      }
      throw err;
    }
  }

  /**
   * Save actions to JSON file for given agentId.
   * @param {string} agentId
   * @param {Array} actions
   * @returns {Promise<void>}
   */
  async save(agentId, actions) {
    await this.#ensureDir();
    const filePath = this.#getFilePath(agentId);
    await fs.writeFile(filePath, JSON.stringify(actions, null, 2), 'utf8');
  }

  /**
   * Add action(s) to buffer, rotating if buffer exceeds maxActions.
   * @param {string} agentId
   * @param {object|object[]} action - Single action or array of actions
   */
  add(agentId, action) {
    if (!this.#buffer.has(agentId)) {
      this.#buffer.set(agentId, []);
    }

    const buffer = this.#buffer.get(agentId);
    const actions = Array.isArray(action) ? action : [action];
    buffer.push(...actions);

    if (buffer.length > this.#maxActions) {
      this.#rotateBuffer(agentId);
    }
  }

  /**
   * Get actions array for agentId (from buffer or empty array).
   * @param {string} agentId
   * @returns {Array}
   */
  get(agentId) {
    return this.#buffer.get(agentId) ?? [];
  }

  /**
   * Save current buffer to file and clear it.
   * @param {string} agentId
   * @returns {Promise<void>}
   */
  async saveBuffer(agentId) {
    await this.#ensureDir();
    const actions = this.#buffer.get(agentId) ?? [];
    if (actions.length > 0) {
      await this.save(agentId, actions);
    }
    this.#buffer.delete(agentId);
  }

  /**
   * Rotate buffer by saving current contents and clearing.
   * @param {string} agentId
   */
  #rotateBuffer(agentId) {
    const buffer = this.#buffer.get(agentId);
    if (!buffer) return;

    // Keep only the most recent actions within limit
    const kept = buffer.slice(-this.#maxActions);
    this.#buffer.set(agentId, kept);
  }

  /**
   * Delete buffer entry and JSON file for agentId.
   * @param {string} agentId
   * @returns {Promise<void>}
   */
  async clear(agentId) {
    this.#buffer.delete(agentId);
    const filePath = this.#getFilePath(agentId);
    try {
      await fs.unlink(filePath);
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
    }
  }

  /**
   * Get full file path for agentId.
   * @param {string} agentId
   * @returns {string}
   */
  #getFilePath(agentId) {
    return path.join(this.#persistDir, `${agentId}.json`);
  }
}
