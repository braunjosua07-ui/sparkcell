import fs from 'node:fs/promises';
import path from 'node:path';
import { ToolValidator } from '../ToolValidator.js';

const validator = new ToolValidator();

export default class GlobTool {
  name = 'glob';
  description = 'Find files matching a glob pattern. Returns list of matching file paths.';
  parameters = {
    pattern: { type: 'string', required: true, description: 'Glob pattern (e.g. "**/*.js", "src/**/*.ts")' },
    path: { type: 'string', required: false, description: 'Base directory to search in (defaults to workDir)' },
  };
  permissionLevel = 'auto';

  async execute(args, context) {
    const baseDir = args.path
      ? (path.isAbsolute(args.path) ? args.path : path.join(context.workDir, args.path))
      : context.workDir;
    if (!validator.isPathAllowed(baseDir, context)) {
      return { success: false, output: null, error: `Access denied: path "${args.path}" is outside the allowed directories` };
    }
    try {
      const matches = await this.#globMatch(baseDir, args.pattern);
      return { success: true, output: matches.length > 0 ? matches.join('\n') : 'No files found' };
    } catch (err) {
      return { success: false, output: null, error: err.message };
    }
  }

  async #globMatch(baseDir, pattern) {
    // Simple glob implementation using recursive readdir + pattern matching
    const results = [];
    const regex = this.#patternToRegex(pattern);

    const walk = async (dir, relPath = '') => {
      let entries;
      try {
        entries = await fs.readdir(dir, { withFileTypes: true });
      } catch {
        return;
      }
      for (const entry of entries) {
        const entryRelPath = relPath ? `${relPath}/${entry.name}` : entry.name;
        if (entry.name === 'node_modules' || entry.name === '.git') continue;
        if (entry.isDirectory()) {
          await walk(path.join(dir, entry.name), entryRelPath);
        } else if (regex.test(entryRelPath)) {
          results.push(entryRelPath);
        }
      }
    };
    await walk(baseDir);
    return results.sort();
  }

  #patternToRegex(pattern) {
    let regexStr = pattern
      .replace(/\./g, '\\.')
      .replace(/\*\*/g, '§DOUBLESTAR§')
      .replace(/\*/g, '[^/]*')
      .replace(/§DOUBLESTAR§/g, '.*')
      .replace(/\?/g, '.');
    return new RegExp(`^${regexStr}$`);
  }
}
