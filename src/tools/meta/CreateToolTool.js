import vm from 'node:vm';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const SANDBOX_TIMEOUT = 10000; // 10s per custom tool execution
const MAX_FAILURES = 3;

export default class CreateToolTool {
  name = 'createTool';
  description = 'Create a new custom tool. The tool code must export name, description, parameters, permissionLevel, and an execute function. Custom tools run in a sandboxed environment.';
  parameters = {
    name: { type: 'string', required: true, description: 'Unique tool name (no spaces, lowercase)' },
    description: { type: 'string', required: true, description: 'What the tool does' },
    parameters: { type: 'object', required: true, description: 'Tool parameters schema (same format as core tools)' },
    code: { type: 'string', required: true, description: 'The execute function body. Receives (args, context). Must return { success, output } or { success, output, error }.' },
  };
  permissionLevel = 'auto';

  async execute(args, context) {
    const { name: toolName, description: desc, parameters: params, code } = args;

    // Validate tool name
    if (!/^[a-z][a-zA-Z0-9]*$/.test(toolName)) {
      return { success: false, output: null, error: 'Tool name must start with lowercase letter, only alphanumeric chars allowed' };
    }

    // Check for name conflicts with core tools
    if (context.toolRunner?.hasTool(toolName)) {
      return { success: false, output: null, error: `Tool "${toolName}" already exists. Use a different name.` };
    }

    // Validate the code can be parsed (syntax check only, no execution)
    try {
      new vm.Script(`(async (args, context) => { ${code} })`, { filename: `validate-${toolName}.js` });
    } catch (err) {
      return { success: false, output: null, error: `Syntax error in tool code: ${err.message}` };
    }

    // Create sandboxed tool wrapper
    const sandboxedTool = createSandboxedTool(toolName, desc, params, code);

    // Save to custom tools directory
    const customDir = context.customToolsDir || path.join(context.workDir, 'custom-tools');
    await fs.mkdir(customDir, { recursive: true });

    const toolFile = path.join(customDir, `${toolName}.tool.json`);
    await fs.writeFile(toolFile, JSON.stringify({
      name: toolName,
      description: desc,
      parameters: params,
      code,
      createdBy: context.agentId,
      createdAt: new Date().toISOString(),
    }, null, 2));

    // Register with ToolRunner
    if (context.toolRunner) {
      try {
        context.toolRunner.registerTool(sandboxedTool);
      } catch (err) {
        return { success: false, output: null, error: `Failed to register tool: ${err.message}` };
      }
    }

    // Publish event
    if (context.bus) {
      context.bus.publish('tool:created', {
        agentId: context.agentId,
        agentName: context.agentName,
        toolName,
        description: desc,
      });
    }

    return {
      success: true,
      output: `Custom tool "${toolName}" created and registered. All agents can now use it.`,
    };
  }
}

/**
 * Create a tool object that runs user code inside a vm sandbox.
 */
function createSandboxedTool(toolName, description, parameters, code) {
  let failureCount = 0;
  let disabled = false;

  return {
    name: toolName,
    description,
    parameters,
    permissionLevel: 'auto',
    isCustom: true,

    async execute(args, context) {
      if (disabled) {
        return { success: false, output: null, error: `Custom tool "${toolName}" is disabled after ${MAX_FAILURES} consecutive failures` };
      }

      // Build sandbox context with limited capabilities
      const sandbox = {
        args,
        result: null,
        error: null,
        // Safe globals
        console: {
          log: (...a) => context.logger?.info(`[${toolName}]`, ...a),
          warn: (...a) => context.logger?.warn(`[${toolName}]`, ...a),
          error: (...a) => context.logger?.error(`[${toolName}]`, ...a),
        },
        JSON,
        Math,
        Date,
        Array,
        Object,
        String,
        Number,
        Boolean,
        RegExp,
        Map,
        Set,
        Promise,
        parseInt,
        parseFloat,
        isNaN,
        isFinite,
        encodeURIComponent,
        decodeURIComponent,
        // Safe node modules
        crypto: {
          randomUUID: () => crypto.randomUUID(),
          randomBytes: (n) => crypto.randomBytes(n).toString('hex'),
          createHash: (alg) => crypto.createHash(alg),
        },
        // Fetch for HTTP requests
        fetch: globalThis.fetch,
        // Context info (read-only)
        agentId: context.agentId,
        workDir: context.workDir,
      };

      const vmContext = vm.createContext(sandbox);

      // Wrap the user code in an async function
      const wrappedCode = `
        (async () => {
          try {
            const execute = async (args, context) => { ${code} };
            result = await execute(args, { agentId, workDir });
          } catch (e) {
            error = e.message || String(e);
          }
        })();
      `;

      try {
        const script = new vm.Script(wrappedCode, { filename: `custom-tool-${toolName}.js` });
        await script.runInContext(vmContext, { timeout: SANDBOX_TIMEOUT });

        if (sandbox.error) {
          failureCount++;
          if (failureCount >= MAX_FAILURES) {
            disabled = true;
            if (context.bus) {
              context.bus.publish('tool:disabled', { toolName, reason: `${MAX_FAILURES} consecutive failures` });
            }
          }
          return { success: false, output: null, error: sandbox.error };
        }

        // Validate result format
        const r = sandbox.result;
        if (!r || typeof r !== 'object' || typeof r.success !== 'boolean') {
          failureCount++;
          if (failureCount >= MAX_FAILURES) disabled = true;
          return { success: false, output: null, error: 'Tool must return { success: boolean, output: any }' };
        }

        // Success — reset failure count
        failureCount = 0;
        return r;
      } catch (err) {
        failureCount++;
        if (failureCount >= MAX_FAILURES) {
          disabled = true;
          if (context.bus) {
            context.bus.publish('tool:disabled', { toolName, reason: `${MAX_FAILURES} consecutive failures` });
          }
        }
        return { success: false, output: null, error: `Sandbox error: ${err.message}` };
      }
    },
  };
}

export { createSandboxedTool };
