import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import SocialLoginTool from '../../src/tools/core/SocialLoginTool.js';
import SocialPostTool from '../../src/tools/core/SocialPostTool.js';
import SocialAnalyticsTool from '../../src/tools/core/SocialAnalyticsTool.js';
import SocialScheduleTool from '../../src/tools/core/SocialScheduleTool.js';
import { WorkerBus } from '../../src/communication/WorkerBus.js';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

// --- Mock helpers ---
function mockCredentialStore(platforms = {}) {
  return {
    has: (p) => !!platforms[p],
    get: (p) => platforms[p] || null,
  };
}

function mockBrowserManager({ available = false, pages = [] } = {}) {
  return {
    isAvailable: async () => available,
    open: async (agentId, url) => ({ pageId: 'mock-page-1', url }),
    getAgentPages: () => pages,
    getPage: () => ({}),
    getText: async () => 'Analytics data here',
  };
}

// --- SocialLoginTool ---
describe('SocialLoginTool', () => {
  let tool;

  beforeEach(() => { tool = new SocialLoginTool(); });

  it('has correct interface', () => {
    assert.equal(tool.name, 'socialLogin');
    assert.equal(tool.permissionLevel, 'ask');
  });

  it('fails without CredentialStore', async () => {
    const result = await tool.execute({ platform: 'tiktok' }, {});
    assert.equal(result.success, false);
    assert.ok(result.error.includes('CredentialStore'));
  });

  it('fails when no credentials stored', async () => {
    const result = await tool.execute({ platform: 'tiktok' }, {
      credentialStore: mockCredentialStore(),
    });
    assert.equal(result.success, false);
    assert.ok(result.error.includes('No credentials'));
  });

  it('fails without BrowserManager', async () => {
    const result = await tool.execute({ platform: 'tiktok' }, {
      credentialStore: mockCredentialStore({ tiktok: { username: 'u', password: 'p' } }),
    });
    assert.equal(result.success, false);
    assert.ok(result.error.includes('BrowserManager'));
  });

  it('fails when Playwright unavailable', async () => {
    const result = await tool.execute({ platform: 'tiktok' }, {
      credentialStore: mockCredentialStore({ tiktok: { username: 'u', password: 'p' } }),
      browserManager: mockBrowserManager({ available: false }),
    });
    assert.equal(result.success, false);
    assert.ok(result.error.includes('Playwright'));
  });

  it('fails for unknown platform', async () => {
    const result = await tool.execute({ platform: 'myspace' }, {
      credentialStore: mockCredentialStore({ myspace: { username: 'u', password: 'p' } }),
      browserManager: mockBrowserManager({ available: true }),
    });
    assert.equal(result.success, false);
    assert.ok(result.error.includes('Unknown platform'));
  });

  it('opens browser and returns pageId on success', async () => {
    const result = await tool.execute({ platform: 'tiktok' }, {
      agentId: 'a1',
      credentialStore: mockCredentialStore({ tiktok: { username: 'u', password: 'p' } }),
      browserManager: mockBrowserManager({ available: true }),
    });
    assert.ok(result.success);
    assert.equal(result.output.pageId, 'mock-page-1');
    assert.equal(result.output.platform, 'tiktok');
    assert.ok(result.output.hints.username);
  });
});

// --- SocialPostTool ---
describe('SocialPostTool', () => {
  let tool;

  beforeEach(() => { tool = new SocialPostTool(); });

  it('has correct interface', () => {
    assert.equal(tool.name, 'socialPost');
    assert.equal(tool.permissionLevel, 'ask');
  });

  it('fails without BrowserManager', async () => {
    const result = await tool.execute({ platform: 'tiktok', content: 'Hello!' }, {});
    assert.equal(result.success, false);
  });

  it('fails without open browser session', async () => {
    const result = await tool.execute({ platform: 'tiktok', content: 'Hello!' }, {
      agentId: 'a1',
      browserManager: mockBrowserManager({ available: true, pages: [] }),
    });
    assert.equal(result.success, false);
    assert.ok(result.error.includes('No open browser'));
  });

  it('opens post page when logged in', async () => {
    const result = await tool.execute({ platform: 'twitter', content: 'My tweet' }, {
      agentId: 'a1',
      browserManager: mockBrowserManager({
        available: true,
        pages: [{ pageId: 'p1', url: 'https://twitter.com' }],
      }),
    });
    assert.ok(result.success);
    assert.equal(result.output.platform, 'twitter');
    assert.ok(result.output.hints.contentField);
  });
});

// --- SocialAnalyticsTool ---
describe('SocialAnalyticsTool', () => {
  let tool;

  beforeEach(() => { tool = new SocialAnalyticsTool(); });

  it('has correct interface', () => {
    assert.equal(tool.name, 'socialAnalytics');
    assert.equal(tool.permissionLevel, 'auto');
  });

  it('fails for unknown platform', async () => {
    const result = await tool.execute({ platform: 'myspace' }, {
      agentId: 'a1',
      browserManager: mockBrowserManager({ available: true }),
    });
    assert.equal(result.success, false);
    assert.ok(result.error.includes('Unknown'));
  });
});

// --- SocialScheduleTool ---
describe('SocialScheduleTool', () => {
  let tool;
  let tmpDir;

  beforeEach(async () => {
    tool = new SocialScheduleTool();
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sparkcell-sched-'));
  });

  it('has correct interface', () => {
    assert.equal(tool.name, 'socialSchedule');
    assert.equal(tool.permissionLevel, 'auto');
  });

  it('rejects invalid datetime', async () => {
    const result = await tool.execute({
      platform: 'twitter',
      content: 'Hello',
      scheduledTime: 'not-a-date',
    }, { workDir: tmpDir, agentId: 'a1' });
    assert.equal(result.success, false);
    assert.ok(result.error.includes('Invalid datetime'));
  });

  it('rejects past datetime', async () => {
    const result = await tool.execute({
      platform: 'twitter',
      content: 'Hello',
      scheduledTime: '2020-01-01T00:00:00Z',
    }, { workDir: tmpDir, agentId: 'a1' });
    assert.equal(result.success, false);
    assert.ok(result.error.includes('future'));
  });

  it('schedules a post and saves to file', async () => {
    const bus = new WorkerBus();
    let event = null;
    bus.subscribe('social:scheduled', (data) => { event = data; });

    const futureTime = new Date(Date.now() + 86400000).toISOString();
    const result = await tool.execute({
      platform: 'twitter',
      content: 'Scheduled tweet!',
      scheduledTime: futureTime,
    }, { workDir: tmpDir, agentId: 'a1', agentName: 'Test', bus });

    assert.ok(result.success);
    assert.ok(result.output.id.startsWith('sched-'));
    assert.equal(result.output.platform, 'twitter');

    // Check file was created
    const schedFile = path.join(tmpDir, 'scheduled-posts.json');
    const schedule = JSON.parse(await fs.readFile(schedFile, 'utf8'));
    assert.equal(schedule.length, 1);
    assert.equal(schedule[0].content, 'Scheduled tweet!');
    assert.equal(schedule[0].status, 'pending');

    // Check event was published
    assert.ok(event);
    assert.equal(event.platform, 'twitter');
  });

  it('appends to existing schedule', async () => {
    const futureTime = new Date(Date.now() + 86400000).toISOString();
    const ctx = { workDir: tmpDir, agentId: 'a1' };

    await tool.execute({ platform: 'twitter', content: 'Post 1', scheduledTime: futureTime }, ctx);
    await tool.execute({ platform: 'instagram', content: 'Post 2', scheduledTime: futureTime }, ctx);

    const schedule = JSON.parse(await fs.readFile(path.join(tmpDir, 'scheduled-posts.json'), 'utf8'));
    assert.equal(schedule.length, 2);
  });
});
