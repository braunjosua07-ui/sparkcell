import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export default class BashTool {
  name = 'bash';
  description = 'Execute a shell command. Output is truncated to 2000 chars. Max timeout 120s.';
  parameters = {
    command: { type: 'string', required: true, description: 'Shell command to execute' },
    timeout: { type: 'number', required: false, description: 'Timeout in seconds (max 120, default 30)', default: 30 },
  };
  permissionLevel = 'auto';

  async execute(args, context) {
    const timeoutSec = Math.min(args.timeout || 30, 120);
    const timeoutMs = timeoutSec * 1000;

    // Filter environment variables — remove secrets
    const env = { ...process.env };
    const secretPatterns = /^(.*_KEY|.*_SECRET|.*_TOKEN|.*_PASSWORD|.*_CREDENTIALS|API_KEY)$/i;
    for (const key of Object.keys(env)) {
      if (secretPatterns.test(key)) delete env[key];
    }

    try {
      const { stdout, stderr } = await execFileAsync('/bin/sh', ['-c', args.command], {
        cwd: context.workDir,
        timeout: timeoutMs,
        env,
        maxBuffer: 1024 * 1024, // 1MB
      });

      let output = (stdout || '') + (stderr ? `\nSTDERR:\n${stderr}` : '');
      if (output.length > 2000) {
        const omitted = output.length - 2000;
        output = output.slice(0, 2000) + `\n[...truncated, ${omitted} chars omitted]`;
      }
      return { success: true, output: output || '(no output)' };
    } catch (err) {
      let output = err.stdout || '';
      if (err.stderr) output += `\nSTDERR:\n${err.stderr}`;
      if (output.length > 2000) {
        output = output.slice(0, 2000) + '\n[...truncated]';
      }
      const errorMsg = err.killed ? `Command timed out after ${timeoutSec}s` : `Exit code ${err.code}: ${err.message}`;
      return { success: false, output: output || null, error: errorMsg };
    }
  }
}
