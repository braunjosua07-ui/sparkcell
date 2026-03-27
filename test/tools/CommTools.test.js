import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import SendEmailTool from '../../src/tools/core/SendEmailTool.js';
import SendSlackTool from '../../src/tools/core/SendSlackTool.js';
import SendDiscordTool from '../../src/tools/core/SendDiscordTool.js';
import NotifyTool from '../../src/tools/core/NotifyTool.js';
import { WorkerBus } from '../../src/communication/WorkerBus.js';

// --- SendEmailTool ---
describe('SendEmailTool', () => {
  let tool;

  beforeEach(() => { tool = new SendEmailTool(); });

  it('has correct interface', () => {
    assert.equal(tool.name, 'sendEmail');
    assert.equal(tool.permissionLevel, 'ask');
    assert.ok(tool.parameters.to);
    assert.ok(tool.parameters.subject);
    assert.ok(tool.parameters.body);
  });

  it('fails without SMTP config', async () => {
    const result = await tool.execute(
      { to: 'test@example.com', subject: 'Hi', body: 'Hello' },
      {},
    );
    assert.equal(result.success, false);
    assert.ok(result.error.includes('SMTP not configured'));
  });

  it('rejects invalid email address', async () => {
    const result = await tool.execute(
      { to: 'not-an-email', subject: 'Hi', body: 'Hello' },
      { smtpConfig: { host: 'mail.example.com' } },
    );
    assert.equal(result.success, false);
    assert.ok(result.error.includes('Invalid email'));
  });

  it('attempts SMTP connection with valid config', async () => {
    // This will fail to connect (no real SMTP server), but tests the flow
    const result = await tool.execute(
      { to: 'test@example.com', subject: 'Test', body: 'Hello world' },
      { smtpConfig: { host: '127.0.0.1', port: 19999 }, agentId: 'a1' },
    );
    assert.equal(result.success, false);
    assert.ok(result.error.includes('SMTP error'));
  });
});

// --- SendSlackTool ---
describe('SendSlackTool', () => {
  let tool;

  beforeEach(() => { tool = new SendSlackTool(); });

  it('has correct interface', () => {
    assert.equal(tool.name, 'sendSlack');
    assert.equal(tool.permissionLevel, 'ask');
    assert.ok(tool.parameters.message);
  });

  it('fails without webhook URL', async () => {
    const result = await tool.execute({ message: 'Hello' }, {});
    assert.equal(result.success, false);
    assert.ok(result.error.includes('webhook not configured'));
  });

  it('fails with invalid webhook URL', async () => {
    const result = await tool.execute(
      { message: 'Hello' },
      { slackWebhook: 'http://127.0.0.1:19999/invalid' },
    );
    assert.equal(result.success, false);
    assert.ok(result.error.includes('Slack error'));
  });
});

// --- SendDiscordTool ---
describe('SendDiscordTool', () => {
  let tool;

  beforeEach(() => { tool = new SendDiscordTool(); });

  it('has correct interface', () => {
    assert.equal(tool.name, 'sendDiscord');
    assert.equal(tool.permissionLevel, 'ask');
    assert.ok(tool.parameters.message);
  });

  it('fails without webhook URL', async () => {
    const result = await tool.execute({ message: 'Hello' }, {});
    assert.equal(result.success, false);
    assert.ok(result.error.includes('webhook not configured'));
  });

  it('fails with invalid webhook URL', async () => {
    const result = await tool.execute(
      { message: 'Hello' },
      { discordWebhook: 'http://127.0.0.1:19999/invalid' },
    );
    assert.equal(result.success, false);
    assert.ok(result.error.includes('Discord error'));
  });
});

// --- NotifyTool ---
describe('NotifyTool', () => {
  let tool;

  beforeEach(() => { tool = new NotifyTool(); });

  it('has correct interface', () => {
    assert.equal(tool.name, 'notify');
    assert.equal(tool.permissionLevel, 'auto');
    assert.ok(tool.parameters.message);
    assert.ok(tool.parameters.priority);
  });

  it('publishes notification event on bus', async () => {
    const bus = new WorkerBus();
    let received = null;
    bus.subscribe('agent:notification', (data) => { received = data; });

    const result = await tool.execute(
      { message: 'Build complete!', priority: 'high' },
      { bus, agentId: 'dev-agent', agentName: 'Dev' },
    );

    assert.ok(result.success);
    assert.ok(result.output.includes('Build complete!'));
    assert.ok(received);
    assert.equal(received.message, 'Build complete!');
    assert.equal(received.priority, 'high');
    assert.equal(received.agentId, 'dev-agent');
  });

  it('defaults to medium priority', async () => {
    const bus = new WorkerBus();
    let received = null;
    bus.subscribe('agent:notification', (data) => { received = data; });

    await tool.execute({ message: 'Info' }, { bus, agentId: 'a1' });
    assert.equal(received.priority, 'medium');
  });

  it('rejects invalid priority', async () => {
    const result = await tool.execute(
      { message: 'Test', priority: 'critical' },
      { bus: new WorkerBus(), agentId: 'a1' },
    );
    assert.equal(result.success, false);
    assert.ok(result.error.includes('Invalid priority'));
  });

  it('works without bus (no-op publish)', async () => {
    const result = await tool.execute({ message: 'Silent' }, { agentId: 'a1' });
    assert.ok(result.success);
  });
});
