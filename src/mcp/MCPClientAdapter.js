/**
 * MCPClientAdapter — Connects to a single MCP server and exposes its tools
 * as SparkCell-compatible tool objects.
 *
 * Supports stdio transport (local processes) and Streamable HTTP transport (remote servers).
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { ListToolsResultSchema, CallToolResultSchema } from '@modelcontextprotocol/sdk/types.js';

export class MCPClientAdapter {
  #client;
  #transport;
  #serverName;
  #connected = false;
  #tools = [];
  #logger;

  constructor(serverName, config, logger = null) {
    this.#serverName = serverName;
    this.#logger = logger;
    this.#client = new Client(
      { name: `sparkcell-${serverName}`, version: '1.0.0' },
      { capabilities: {} },
    );

    if (config.transport === 'stdio') {
      this.#transport = new StdioClientTransport({
        command: config.command,
        args: config.args || [],
        env: config.env || undefined,
      });
    } else if (config.transport === 'http') {
      // Dynamically import StreamableHTTPClientTransport only when needed
      this._httpConfig = config;
    } else {
      throw new Error(`Unsupported MCP transport: "${config.transport}". Use "stdio" or "http".`);
    }
  }

  get name() { return this.#serverName; }
  get isConnected() { return this.#connected; }
  get toolCount() { return this.#tools.length; }

  async connect() {
    // Handle HTTP transport lazy init
    if (this._httpConfig) {
      const { StreamableHTTPClientTransport } = await import(
        '@modelcontextprotocol/sdk/client/streamableHttp.js'
      );
      this.#transport = new StreamableHTTPClientTransport(
        new URL(this._httpConfig.url),
      );
      delete this._httpConfig;
    }

    try {
      await this.#client.connect(this.#transport);
      this.#connected = true;
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
      tools: this.#tools.map(t => t.mcpToolName),
    };
  }

  #log(level, message) {
    if (this.#logger && typeof this.#logger[level] === 'function') {
      this.#logger[level](message);
    }
  }
}
