import fs from 'node:fs/promises';
import path from 'node:path';
import { ToolPermissions } from './ToolPermissions.js';
import { ToolValidator } from './ToolValidator.js';

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
      const timeout = setTimeout(() => {
        resolve(false);
      }, 60000);

      this.#bus.publish('tool:permission-requested', { agentId, toolName, args });

      const handler = (data) => {
        if (data.actionKey === actionKey) {
          clearTimeout(timeout);
          this.#permissions.approve(actionKey);
          resolve(true);
        }
      };
      this.#bus.subscribe('tool:permission-granted', handler);
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
