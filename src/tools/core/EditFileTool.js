import fs from 'node:fs/promises';
import path from 'node:path';
import { ToolValidator } from '../ToolValidator.js';

const validator = new ToolValidator();

export default class EditFileTool {
  name = 'editFile';
  description = 'Make a targeted replacement in a file. Replaces the first occurrence of oldString with newString.';
  parameters = {
    path: { type: 'string', required: true, description: 'Absolute or relative file path' },
    oldString: { type: 'string', required: true, description: 'The exact string to find and replace' },
    newString: { type: 'string', required: true, description: 'The replacement string' },
  };
  permissionLevel = 'auto';

  async execute(args, context) {
    const filePath = path.isAbsolute(args.path) ? args.path : path.join(context.workDir, args.path);
    if (!validator.isPathAllowed(filePath, context)) {
      return { success: false, output: null, error: `Access denied: path "${args.path}" is outside the allowed directories` };
    }
    try {
      const content = await fs.readFile(filePath, 'utf8');
      if (!content.includes(args.oldString)) {
        return { success: false, output: null, error: `String not found in ${filePath}` };
      }
      const newContent = content.replace(args.oldString, args.newString);
      await fs.writeFile(filePath, newContent);
      return { success: true, output: `Edited ${filePath}: replaced ${args.oldString.length} chars` };
    } catch (err) {
      return { success: false, output: null, error: err.message };
    }
  }
}
