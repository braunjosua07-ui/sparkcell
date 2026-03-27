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
      level, source,
      message: Logger.redact(message),
      data: Logger.redactObj(data),
    };
    this.#buffer.push(entry);
    this.emit('log', entry);
  }

  // Redact API keys and secrets from log output
  static redact(str) {
    if (typeof str !== 'string') return str;
    return str
      .replace(/sk-[a-zA-Z0-9]{20,}/g, 'sk-***REDACTED***')
      .replace(/key-[a-zA-Z0-9]{20,}/g, 'key-***REDACTED***')
      .replace(/(Bearer\s+)[^\s"]+/gi, '$1***REDACTED***')
      .replace(/(apiKey["']?\s*[:=]\s*["']?)[^"'\s,}]+/gi, '$1***REDACTED***');
  }

  static redactObj(obj) {
    if (!obj || typeof obj !== 'object') return obj;
    const result = {};
    for (const [k, v] of Object.entries(obj)) {
      if (/key|secret|token|password|auth/i.test(k) && typeof v === 'string') {
        result[k] = '***REDACTED***';
      } else if (typeof v === 'string') {
        result[k] = Logger.redact(v);
      } else if (typeof v === 'object') {
        result[k] = Logger.redactObj(v);
      } else {
        result[k] = v;
      }
    }
    return result;
  }

  info(message, data)  { this.log('info', '', message, data); }
  warn(message, data)  { this.log('warn', '', message, data); }
  error(message, data) { this.log('error', '', message, data); }

  async flush() {
    if (this.#buffer.length === 0) return;
    const entries = this.#buffer;
    this.#buffer = [];
    const lines = entries.map(e => JSON.stringify(e)).join('\n') + '\n';
    try {
      const file = path.join(this.#logDir, `sparkcell-${new Date().toISOString().slice(0, 10)}.log`);
      await fs.appendFile(file, lines);
    } catch {
      this.#buffer = [...entries, ...this.#buffer];
    }
  }

  async shutdown() {
    clearInterval(this.#flushInterval);
    await this.flush();
  }
}
