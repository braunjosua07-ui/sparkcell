/**
 * MCPBridge — Manages multiple MCP server connections and registers
 * their tools into SparkCell's ToolRunner.
 *
 * Config format in startup.json:
 * {
 *   "mcpServers": {
 *     "filesystem": {
 *       "transport": "stdio",
 *       "command": "npx",
 *       "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path/to/dir"]
 *     },
 *     "remote-api": {
 *       "transport": "http",
 *       "url": "https://mcp.example.com/sse"
 *     }
 *   }
 * }
 */
import { MCPClientAdapter } from './MCPClientAdapter.js';

export class MCPBridge {
  #adapters = new Map();
  #toolRunner;
  #logger;
  #bus;

  constructor({ toolRunner, logger, bus } = {}) {
    this.#toolRunner = toolRunner;
    this.#logger = logger || null;
    this.#bus = bus || null;
  }

  get serverCount() { return this.#adapters.size; }
  get connectedCount() { return [...this.#adapters.values()].filter(a => a.isConnected).length; }

  /**
   * Connect to all configured MCP servers and register their tools.
   * Failures are non-fatal — individual servers that fail are skipped.
   */
  async connectAll(serversConfig) {
    if (!serversConfig || typeof serversConfig !== 'object') return;

    const entries = Object.entries(serversConfig);
    if (entries.length === 0) return;

    this.#log('info', `Connecting to ${entries.length} MCP server(s)...`);

    const results = await Promise.allSettled(
      entries.map(([name, config]) => this.#connectOne(name, config)),
    );

    let connected = 0;
    let totalTools = 0;
    for (const result of results) {
      if (result.status === 'fulfilled') {
        connected++;
        totalTools += result.value;
      }
    }

    this.#log('info', `MCP: ${connected}/${entries.length} servers connected, ${totalTools} tools registered`);

    if (this.#bus) {
      this.#bus.publish('mcp:initialized', {
        servers: connected,
        total: entries.length,
        tools: totalTools,
      });
    }
  }

  async #connectOne(name, config) {
    const adapter = new MCPClientAdapter(name, config, this.#logger);
    this.#adapters.set(name, adapter);

    await adapter.connect();
    const tools = await adapter.discoverTools();

    // Register each MCP tool in ToolRunner
    let registered = 0;
    for (const tool of tools) {
      try {
        this.#toolRunner.registerTool(tool);
        registered++;
      } catch (err) {
        this.#log('warn', `Failed to register MCP tool "${tool.name}": ${err.message}`);
      }
    }

    if (this.#bus) {
      this.#bus.publish('mcp:server-connected', {
        server: name,
        tools: tools.map(t => t.mcpToolName),
      });
    }

    return registered;
  }

  /**
   * Connect a single additional server at runtime.
   */
  async addServer(name, config) {
    if (this.#adapters.has(name)) {
      throw new Error(`MCP server "${name}" is already registered`);
    }
    const toolCount = await this.#connectOne(name, config);
    return toolCount;
  }

  /**
   * Disconnect a specific server and remove its tools.
   */
  async removeServer(name) {
    const adapter = this.#adapters.get(name);
    if (!adapter) return false;

    await adapter.disconnect();
    this.#adapters.delete(name);
    return true;
  }

  /**
   * Disconnect all MCP servers.
   */
  async shutdown() {
    const promises = [...this.#adapters.values()].map(a => a.disconnect());
    await Promise.allSettled(promises);
    this.#adapters.clear();
  }

  getStatus() {
    const servers = [];
    for (const adapter of this.#adapters.values()) {
      servers.push(adapter.getStatus());
    }
    return { servers, totalTools: servers.reduce((sum, s) => sum + s.tools.length, 0) };
  }

  getServerNames() {
    return [...this.#adapters.keys()];
  }

  #log(level, message) {
    if (this.#logger && typeof this.#logger[level] === 'function') {
      this.#logger[level](message);
    }
  }
}
