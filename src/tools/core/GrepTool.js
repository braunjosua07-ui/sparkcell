import fs from 'node:fs/promises';
import path from 'node:path';

export default class GrepTool {
  name = 'grep';
  description = 'Search for a pattern in files. Returns matching lines with file paths and line numbers.';
  parameters = {
    query: { type: 'string', required: true, description: 'Search string or regex pattern' },
    path: { type: 'string', required: false, description: 'Directory or file to search in (defaults to workDir)' },
    include: { type: 'string', required: false, description: 'File extension filter (e.g. "*.js")' },
  };
  permissionLevel = 'auto';

  async execute(args, context) {
    const searchPath = args.path
      ? (path.isAbsolute(args.path) ? args.path : path.join(context.workDir, args.path))
      : context.workDir;

    try {
      const results = [];
      const regex = new RegExp(args.query, 'gi');
      const includeRegex = args.include ? this.#includeToRegex(args.include) : null;

      await this.#searchDir(searchPath, regex, includeRegex, results);

      if (results.length === 0) {
        return { success: true, output: 'No matches found' };
      }
      let output = results.slice(0, 100).join('\n');
      if (results.length > 100) {
        output += `\n[...${results.length - 100} more matches]`;
      }
      return { success: true, output };
    } catch (err) {
      return { success: false, output: null, error: err.message };
    }
  }

  async #searchDir(dir, regex, includeRegex, results) {
    let stat;
    try {
      stat = await fs.stat(dir);
    } catch {
      return;
    }

    if (stat.isFile()) {
      await this.#searchFile(dir, regex, results);
      return;
    }

    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (entry.name === 'node_modules' || entry.name === '.git') continue;
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await this.#searchDir(fullPath, regex, includeRegex, results);
      } else {
        if (includeRegex && !includeRegex.test(entry.name)) continue;
        await this.#searchFile(fullPath, regex, results);
      }
    }
  }

  async #searchFile(filePath, regex, results) {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        if (regex.test(lines[i])) {
          results.push(`${filePath}:${i + 1}: ${lines[i].trim()}`);
          regex.lastIndex = 0; // reset regex state
        }
      }
    } catch {
      // Skip binary/unreadable files
    }
  }

  #includeToRegex(include) {
    const pattern = include.replace(/\./g, '\\.').replace(/\*/g, '.*');
    return new RegExp(`^${pattern}$`);
  }
}
