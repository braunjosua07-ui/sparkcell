import fs from 'node:fs/promises';
import path from 'node:path';
import { ToolValidator } from '../ToolValidator.js';

const validator = new ToolValidator();

export default class ReadFileTool {
  name = 'readFile';
  description = 'Read a file from the filesystem. Returns file contents, truncated to 4000 chars.';
  parameters = {
    path: { type: 'string', required: true, description: 'Absolute or relative file path' },
    offset: { type: 'number', required: false, description: 'Line number to start reading from (1-based)', default: 1 },
    limit: { type: 'number', required: false, description: 'Number of lines to read', default: 2000 },
  };
  permissionLevel = 'auto';

  async execute(args, context) {
    const filePath = path.isAbsolute(args.path) ? args.path : path.join(context.workDir, args.path);
    if (!validator.isPathAllowed(filePath, context)) {
      return { success: false, output: null, error: `Access denied: path "${args.path}" is outside the allowed directories` };
    }
    try {
      const content = await fs.readFile(filePath, 'utf8');
      const lines = content.split('\n');
      const start = Math.max(0, (args.offset || 1) - 1);
      const end = start + (args.limit || 2000);
      let result = lines.slice(start, end).join('\n');
      if (result.length > 4000) {
        const omitted = result.length - 4000;
        result = result.slice(0, 4000) + `\n[...truncated, ${omitted} chars omitted]`;
      }
      return { success: true, output: result };
    } catch (err) {
      return { success: false, output: null, error: err.message };
    }
  }
}
