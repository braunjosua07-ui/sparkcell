// src/utils/Logger.js
import fs from 'node:fs/promises';
import path from 'node:path';
import { EventEmitter } from 'node:events';

export class Logger extends EventEmitter {
  #logDir;
  #buffer = [];
  #flushInterval;

  constructor(logDir) {
    super();
    this.#logDir = logDir;
  }

  async initialize() {
    await fs.mkdir(this.#logDir, { recursive: true });
    this.#flushInterval = setInterval(() => this.flush(), 5000);
  }

  log(level, source, message, data = {}) {
    const entry = {
      timestamp: new Date().toISOString(),
      level, source, message, data,
    };
    this.#buffer.push(entry);
    this.emit('log', entry);
  }

  info(message, data)  { this.log('info', '', message, data); }
  warn(message, data)  { this.log('warn', '', message, data); }
  error(message, data) { this.log('error', '', message, data); }

  async flush() {
    if (this.#buffer.length === 0) return;
    const lines = this.#buffer.map(e => JSON.stringify(e)).join('\n') + '\n';
    this.#buffer = [];
    const file = path.join(this.#logDir, `sparkcell-${new Date().toISOString().slice(0, 10)}.log`);
    await fs.appendFile(file, lines);
  }

  async shutdown() {
    clearInterval(this.#flushInterval);
    await this.flush();
  }
}
