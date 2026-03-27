import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import vm from 'node:vm';
import crypto from 'node:crypto';
import { ToolPermissions } from './ToolPermissions.js';
import { ToolValidator } from './ToolValidator.js';

const USER_TOOLS_DIR = path.join(os.homedir(), '.config', 'sparkcell', 'tools');

export class ToolRunner {
  #tools = new Map();
  #permissions;
  #validator;
  #logger;
  #bus;

  constructor({ permissions, logger, bus } = {}) {
    this.#permissions = permissions || new ToolPermissions();
    this.#validator = new ToolValidator();
    this.#logger = logger || null;
    this.#bus = bus || null;
  }

  get permissions() { return this.#permissions; }

  registerTool(tool) {
    this.#validator.validateToolInterface(tool);
    if (this.#tools.has(tool.name)) {
      throw new Error(`Tool "${tool.name}" is already registered`);
    }
    this.#permissions.setRule(tool.name, tool.permissionLevel);
    this.#tools.set(tool.name, tool);
  }

  deregisterTool(name) {
    return this.#tools.delete(name);
  }

  async registerDirectory(dir) {
    let entries;
    try {
      entries = await fs.readdir(dir);
    } catch {
      return; // Directory doesn't exist — skip silently
    }
    for (const entry of entries) {
      if (!entry.endsWith('.js')) continue;
      const filePath = path.join(dir, entry);
      try {
        const mod = await import(filePath);
        // Support both default export and named exports
        const ToolClass = mod.default || Object.values(mod).find(v => typeof v === 'function');
        if (ToolClass && typeof ToolClass === 'function') {
          const tool = new ToolClass();
          this.registerTool(tool);
        }
      } catch (err) {
        if (this.#logger) this.#logger.warn(`Failed to load tool from ${entry}: ${err.message}`);
      }
    }
  }

  /**
   * Load JSON-based tools from user tools directory
   */
  async loadUserTools() {
    try {
      const entries = await fs.readdir(USER_TOOLS_DIR);
      const toolFiles = entries.filter(f => f.endsWith('.tool.json'));

      for (const toolFile of toolFiles) {
        try {
          const toolPath = path.join(USER_TOOLS_DIR, toolFile);
          const data = JSON.parse(await fs.readFile(toolPath, 'utf8'));

          // Skip disabled tools
          if (data.enabled === false) continue;

          // Create sandboxed tool from JSON manifest
          const tool = this.#createJsonTool(data);
          this.registerTool(tool);
          if (this.#logger) this.#logger.info(`Loaded user tool: ${data.name}`);
        } catch (err) {
          if (this.#logger) this.#logger.warn(`Failed to load user tool ${toolFile}: ${err.message}`);
        }
      }
    } catch {
      // Directory doesn't exist - that's ok
    }
  }

  /**
   * Create a tool from JSON manifest (user-installed tools)
   */
  #createJsonTool(manifest) {
    const failureCount = { value: 0 };
    let disabled = false;

    return {
      name: manifest.name,
      description: manifest.description,
      parameters: manifest.parameters,
      permissionLevel: manifest.permissionLevel || 'auto',
      isCustom: true,

      async execute(args, context) {
        if (disabled) {
          return { success: false, output: null, error: `Tool "${manifest.name}" is disabled` };
        }

        // Build sandbox with limited capabilities
        const sandbox = {
          args,
          result: null,
          error: null,
          console: {
            log: (...a) => context.logger?.info(`[${manifest.name}]`, ...a),
            warn: (...a) => context.logger?.warn(`[${manifest.name}]`, ...a),
            error: (...a) => context.logger?.error(`[${manifest.name}]`, ...a),
          },
          JSON, Math, Date, Array, Object, String, Number, Boolean,
          crypto, fetch: globalThis.fetch,
          agentId: context.agentId,
          workDir: context.workDir,
        };

        const vmContext = vm.createContext(sandbox);

        const wrappedCode = `
          (async () => {
            try {
              const execute = async (args, context) => { ${manifest.code} };
              result = await execute(args, { agentId, workDir });
            } catch (e) {
              error = e.message || String(e);
            }
          })();
        `;

        try {
          const script = new vm.Script(wrappedCode, { filename: `user-tool-${manifest.name}.js` });
          await script.runInContext(vmContext, { timeout: 10000 });

          if (sandbox.error) {
            failureCount.value++;
            if (failureCount.value >= 3) disabled = true;
            return { success: false, output: null, error: sandbox.error };
          }

          const r = sandbox.result;
          if (!r || typeof r !== 'object' || typeof r.success !== 'boolean') {
            failureCount.value++;
            if (failureCount.value >= 3) disabled = true;
            return { success: false, output: null, error: 'Tool must return { success: boolean, output: any }' };
          }

          failureCount.value = 0;
          return r;
        } catch (err) {
          failureCount.value++;
          if (failureCount.value >= 3) disabled = true;
          return { success: false, output: null, error: `Sandbox error: ${err.message}` };
        }
      },
    };
  }

  getToolDefinitions(format = 'openai') {
    const tools = [...this.#tools.values()];
    if (format === 'anthropic') {
      return tools.map(t => ({
        name: t.name,
        description: t.description,
        input_schema: this.#toJsonSchema(t.parameters),
      }));
    }
    // OpenAI format (default)
    return tools.map(t => ({
      type: 'function',
      function: {
        name: t.name,
        description: t.description,
        parameters: this.#toJsonSchema(t.parameters),
      },
    }));
  }

  #toJsonSchema(parameters) {
    const properties = {};
    const required = [];
    for (const [name, schema] of Object.entries(parameters)) {
      properties[name] = {
        type: schema.type,
        description: schema.description || '',
      };
      if (schema.default !== undefined) {
        properties[name].default = schema.default;
      }
      if (schema.required) required.push(name);
    }
    return { type: 'object', properties, required };
  }

  async execute(agentId, toolName, args, context = {}) {
    const tool = this.#tools.get(toolName);
    if (!tool) {
      return { success: false, output: null, error: `Unknown tool: ${toolName}` };
    }

    // Permission check
    const permission = this.#permissions.check(agentId, toolName, args);
    if (permission === 'denied') {
      return { success: false, output: null, error: `Permission denied for tool: ${toolName}` };
    }
    if (permission === 'needs-approval') {
      const approved = await this.#waitForApproval(agentId, toolName, args);
      if (!approved) {
        return { success: false, output: null, error: `Approval timeout for tool: ${toolName}` };
      }
    }

    // Validate arguments
    let resolvedArgs;
    try {
      resolvedArgs = this.#validator.validateArgs(tool, args);
    } catch (err) {
      return { success: false, output: null, error: err.message };
    }

    // Execute with timeout
    const timeout = context.timeout || 30000;
    try {
      const result = await Promise.race([
        tool.execute(resolvedArgs, context),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error(`Tool "${toolName}" timed out after ${timeout}ms`)), timeout),
        ),
      ]);

      // Publish event
      if (this.#bus) {
        this.#bus.publish('tool:executed', {
          agentId,
          toolName,
          args: resolvedArgs,
          success: result.success,
        });
      }

      if (this.#logger) {
        this.#logger.info(`Tool ${toolName} executed by ${agentId}: ${result.success ? 'ok' : 'failed'}`);
      }

      return result;
    } catch (err) {
      if (this.#bus) {
        this.#bus.publish('tool:failed', { agentId, toolName, error: err.message });
      }
      return { success: false, output: null, error: err.message };
    }
  }

  async #waitForApproval(agentId, toolName, args) {
    if (!this.#bus) return false;
    return new Promise((resolve) => {
      const actionKey = `${agentId}:${toolName}`;

      const unsub = this.#bus.subscribe('tool:permission-granted', (data) => {
        // Support both exact match (agentId:toolName) and wildcard (*:toolName)
        const matches = data.actionKey === actionKey
          || data.actionKey === `*:${toolName}`;
        if (matches) {
          clearTimeout(timeout);
          unsub();
          this.#permissions.approve(actionKey);
          resolve(true);
        }
      });

      const timeout = setTimeout(() => {
        unsub();
        resolve(false);
      }, 60000);

      this.#bus.publish('tool:permission-requested', { agentId, toolName, args });
    });
  }

  getToolNames() {
    return [...this.#tools.keys()];
  }

  hasTool(name) {
    return this.#tools.has(name);
  }

  getTool(name) {
    return this.#tools.get(name) || null;
  }

  isCustomTool(name) {
    const tool = this.#tools.get(name);
    return tool?.isCustom === true;
  }

  getToolCount() {
    const names = [...this.#tools.values()];
    const custom = names.filter(t => t.isCustom).length;
    return { total: names.length, core: names.length - custom, custom };
  }
}
