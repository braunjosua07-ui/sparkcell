import fs from 'node:fs/promises';
import path from 'node:path';

export default class WriteFileTool {
  name = 'writeFile';
  description = 'Write content to a file. Creates the file and parent directories if they do not exist.';
  parameters = {
    path: { type: 'string', required: true, description: 'Absolute or relative file path' },
    content: { type: 'string', required: true, description: 'Content to write' },
  };
  permissionLevel = 'auto';

  async execute(args, context) {
    const filePath = path.isAbsolute(args.path) ? args.path : path.join(context.workDir, args.path);
    try {
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, args.content);
      return { success: true, output: `Written ${args.content.length} chars to ${filePath}` };
    } catch (err) {
      return { success: false, output: null, error: err.message };
    }
  }
}
