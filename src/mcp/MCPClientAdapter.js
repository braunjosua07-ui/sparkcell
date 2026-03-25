/**
 * MCPClientAdapter — Connects to a single MCP server and exposes its tools
 * as SparkCell-compatible tool objects.
 *
 * Supports stdio transport (local processes) and Streamable HTTP transport (remote servers).
 * Tracks consecutive failures and auto-disconnects unhealthy servers.
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { ListToolsResultSchema, CallToolResultSchema } from '@modelcontextprotocol/sdk/types.js';

const MAX_CONSECUTIVE_FAILURES = 3;

export class MCPClientAdapter {
  #client;
  #transport;
  #serverName;
  #config;
  #connected = false;
  #tools = [];
  #logger;
  #consecutiveFailures = 0;
  #bus;

  constructor(serverName, config, logger = null, bus = null) {
    this.#serverName = serverName;
    this.#config = config;
    this.#logger = logger;
    this.#bus = bus;
    this.#client = new Client(
      { name: `sparkcell-${serverName}`, version: '1.0.0' },
      { capabilities: {} },
    );

    if (config.transport !== 'stdio' && config.transport !== 'http') {
      throw new Error(`Unsupported MCP transport: "${config.transport}". Use "stdio" or "http".`);
    }
  }

  get name() { return this.#serverName; }
  get isConnected() { return this.#connected; }
  get toolCount() { return this.#tools.length; }

  async connect() {
    if (this.#config.transport === 'stdio') {
      this.#transport = new StdioClientTransport({
        command: this.#config.command,
        args: this.#config.args || [],
        env: this.#config.env || undefined,
      });
    } else if (this.#config.transport === 'http') {
      const { StreamableHTTPClientTransport } = await import(
        '@modelcontextprotocol/sdk/client/streamableHttp.js'
      );
      this.#transport = new StreamableHTTPClientTransport(
        new URL(this.#config.url),
      );
    }

    try {
      await this.#client.connect(this.#transport);
      this.#connected = true;
      this.#consecutiveFailures = 0;
      this.#log('info', `Connected to MCP server: ${this.#serverName}`);
    } catch (err) {
      this.#log('warn', `Failed to connect to MCP server "${this.#serverName}": ${err.message}`);
      throw err;
    }
  }

  async discoverTools() {
    if (!this.#connected) throw new Error(`MCP server "${this.#serverName}" not connected`);

    const response = await this.#client.request(
      { method: 'tools/list' },
      ListToolsResultSchema,
    );

    this.#tools = (response.tools || []).map(mcpTool => this.#wrapTool(mcpTool));
    this.#log('info', `Discovered ${this.#tools.length} tools from MCP server "${this.#serverName}"`);
    return this.#tools;
  }

  /**
   * Wraps an MCP tool definition into a SparkCell-compatible tool object.
   */
  #wrapTool(mcpTool) {
    const adapter = this;
    const prefix = `mcp_${this.#serverName}`;
    const toolName = `${prefix}_${mcpTool.name}`;

    // Convert MCP inputSchema to SparkCell parameters format
    const parameters = {};
    if (mcpTool.inputSchema?.properties) {
      const required = mcpTool.inputSchema.required || [];
      for (const [name, schema] of Object.entries(mcpTool.inputSchema.properties)) {
        parameters[name] = {
          type: schema.type || 'string',
          description: schema.description || '',
          required: required.includes(name),
        };
        if (schema.default !== undefined) {
          parameters[name].default = schema.default;
        }
      }
    }

    return {
      name: toolName,
      description: `[MCP: ${this.#serverName}] ${mcpTool.description || mcpTool.name}`,
      parameters,
      permissionLevel: 'ask', // MCP tools always require first-use approval
      isMCP: true,
      mcpServer: this.#serverName,
      mcpToolName: mcpTool.name,

      async execute(args) {
        return adapter.callTool(mcpTool.name, args);
      },
    };
  }

  async callTool(toolName, args) {
    if (!this.#connected) {
      return { success: false, output: null, error: `MCP server "${this.#serverName}" not connected` };
    }

    try {
      const result = await this.#client.request(
        {
          method: 'tools/call',
          params: { name: toolName, arguments: args },
        },
        CallToolResultSchema,
      );

      // Success — reset failure counter
      this.#consecutiveFailures = 0;

      // MCP returns content as array of {type, text/data} objects
      const output = (result.content || [])
        .map(c => {
          if (c.type === 'text') return c.text;
          if (c.type === 'image') return `[image: ${c.mimeType}]`;
          if (c.type === 'resource') return `[resource: ${c.resource?.uri || 'unknown'}]`;
          return JSON.stringify(c);
        })
        .join('\n');

      const isError = result.isError === true;
      return {
        success: !isError,
        output: isError ? null : output,
        error: isError ? output : null,
      };
    } catch (err) {
      this.#consecutiveFailures++;
      this.#log('warn', `MCP tool "${toolName}" failed on "${this.#serverName}" (${this.#consecutiveFailures}/${MAX_CONSECUTIVE_FAILURES}): ${err.message}`);

      // Auto-disconnect after too many consecutive failures
      if (this.#consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
        this.#log('warn', `MCP server "${this.#serverName}" marked unhealthy after ${MAX_CONSECUTIVE_FAILURES} consecutive failures — disconnecting`);
        this.#connected = false;
        if (this.#bus) {
          this.#bus.publish('mcp:server-unhealthy', {
            server: this.#serverName,
            failures: this.#consecutiveFailures,
            lastError: err.message,
          });
        }
      }

      return { success: false, output: null, error: `MCP tool error (${toolName}): ${err.message}` };
    }
  }

  async disconnect() {
    if (!this.#connected) return;
    try {
      await this.#transport.close();
    } catch {
      // Ignore close errors
    }
    this.#connected = false;
    this.#tools = [];
    this.#log('info', `Disconnected from MCP server: ${this.#serverName}`);
  }

  getStatus() {
    return {
      name: this.#serverName,
      connected: this.#connected,
      consecutiveFailures: this.#consecutiveFailures,
      tools: this.#tools.map(t => t.mcpToolName),
    };
  }

  #log(level, message) {
    if (this.#logger && typeof this.#logger[level] === 'function') {
      this.#logger[level](message);
    }
  }
}
