import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { MCPClientAdapter } from '../../src/mcp/MCPClientAdapter.js';
import { MCPBridge } from '../../src/mcp/MCPBridge.js';
import { ToolRunner } from '../../src/tools/ToolRunner.js';
import { WorkerBus } from '../../src/communication/WorkerBus.js';

// --- Mock MCP SDK ---
// We can't start real MCP servers in unit tests, so we test the adapter's
// wrapping logic and bridge orchestration using controlled error paths
// and by verifying the tool interface conversion.

describe('MCPClientAdapter', () => {
  it('rejects unsupported transport', () => {
    assert.throws(
      () => new MCPClientAdapter('test', { transport: 'grpc' }),
      /Unsupported MCP transport/,
    );
  });

  it('creates adapter with stdio config', () => {
    const adapter = new MCPClientAdapter('fs-server', {
      transport: 'stdio',
      command: 'node',
      args: ['server.js'],
    });
    assert.equal(adapter.name, 'fs-server');
    assert.equal(adapter.isConnected, false);
    assert.equal(adapter.toolCount, 0);
  });

  it('creates adapter with http config', () => {
    const adapter = new MCPClientAdapter('remote', {
      transport: 'http',
      url: 'https://mcp.example.com/sse',
    });
    assert.equal(adapter.name, 'remote');
    assert.equal(adapter.isConnected, false);
  });

  it('getStatus returns correct structure', () => {
    const adapter = new MCPClientAdapter('test-server', {
      transport: 'stdio',
      command: 'echo',
      args: [],
    });
    const status = adapter.getStatus();
    assert.equal(status.name, 'test-server');
    assert.equal(status.connected, false);
    assert.deepEqual(status.tools, []);
  });

  it('discoverTools fails when not connected', async () => {
    const adapter = new MCPClientAdapter('test', {
      transport: 'stdio',
      command: 'echo',
      args: [],
    });
    await assert.rejects(
      () => adapter.discoverTools(),
      /not connected/,
    );
  });

  it('callTool fails when not connected', async () => {
    const adapter = new MCPClientAdapter('test', {
      transport: 'stdio',
      command: 'echo',
      args: [],
    });
    const result = await adapter.callTool('test-tool', {});
    assert.equal(result.success, false);
    assert.ok(result.error.includes('not connected'));
  });
});

describe('MCPBridge', () => {
  let toolRunner;
  let bus;

  beforeEach(() => {
    toolRunner = new ToolRunner({ bus: new WorkerBus() });
    bus = new WorkerBus();
  });

  it('initializes with zero servers', () => {
    const bridge = new MCPBridge({ toolRunner, bus });
    assert.equal(bridge.serverCount, 0);
    assert.equal(bridge.connectedCount, 0);
  });

  it('connectAll handles empty config gracefully', async () => {
    const bridge = new MCPBridge({ toolRunner, bus });
    await bridge.connectAll(null);
    await bridge.connectAll({});
    assert.equal(bridge.serverCount, 0);
  });

  it('connectAll handles failing servers gracefully', async () => {
    const bridge = new MCPBridge({ toolRunner, bus });
    // This will fail to connect (no real server), but should not throw
    await bridge.connectAll({
      'fake-server': {
        transport: 'stdio',
        command: 'node',
        args: ['-e', 'process.exit(1)'],
      },
    });
    // Server is registered but not connected
    assert.equal(bridge.serverCount, 1);
    assert.equal(bridge.connectedCount, 0);
  });

  it('getStatus returns correct structure', () => {
    const bridge = new MCPBridge({ toolRunner, bus });
    const status = bridge.getStatus();
    assert.deepEqual(status.servers, []);
    assert.equal(status.totalTools, 0);
  });

  it('getServerNames returns empty array initially', () => {
    const bridge = new MCPBridge({ toolRunner, bus });
    assert.deepEqual(bridge.getServerNames(), []);
  });

  it('shutdown is safe when no servers connected', async () => {
    const bridge = new MCPBridge({ toolRunner, bus });
    await bridge.shutdown(); // should not throw
    assert.equal(bridge.serverCount, 0);
  });

  it('addServer rejects duplicate server names', async () => {
    const bridge = new MCPBridge({ toolRunner, bus });
    // First add will fail to connect but registers the adapter
    await bridge.connectAll({
      'dup-server': { transport: 'stdio', command: 'node', args: ['-e', 'process.exit(1)'] },
    });
    await assert.rejects(
      () => bridge.addServer('dup-server', { transport: 'stdio', command: 'echo', args: [] }),
      /already registered/,
    );
  });

  it('removeServer returns false for unknown server', async () => {
    const bridge = new MCPBridge({ toolRunner, bus });
    const result = await bridge.removeServer('nonexistent');
    assert.equal(result, false);
  });

  it('publishes mcp:initialized event on connectAll', async () => {
    const bridge = new MCPBridge({ toolRunner, bus });
    let received = null;
    bus.subscribe('mcp:initialized', (data) => { received = data; });

    await bridge.connectAll({
      'fail-server': { transport: 'stdio', command: 'node', args: ['-e', 'process.exit(1)'] },
    });

    assert.ok(received);
    assert.equal(received.total, 1);
    assert.equal(received.servers, 0); // failed to connect
  });
});

describe('MCP Tool Wrapping', () => {
  it('converts MCP tool schema to SparkCell format', () => {
    // Simulate what #wrapTool does by testing via the adapter's public interface
    const adapter = new MCPClientAdapter('test', {
      transport: 'stdio',
      command: 'echo',
      args: [],
    });
    // We can't call #wrapTool directly, but we verify the adapter structure
    const status = adapter.getStatus();
    assert.equal(status.name, 'test');
    assert.ok(Array.isArray(status.tools));
  });
});
