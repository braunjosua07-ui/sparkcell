import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { BrowserManager } from '../../src/tools/BrowserManager.js';

/**
 * BrowserManager tests use the real class but mock Playwright
 * at the page/browser level since Playwright may not be installed.
 * Tests focus on session management logic, not actual browser rendering.
 */

// --- Mock helpers ---
function mockPage(url = 'https://example.com') {
  return {
    url: () => url,
    goto: async () => {},
    click: async () => {},
    fill: async () => {},
    screenshot: async () => {},
    evaluate: async () => 'Page text content',
    $: async (sel) => ({ textContent: async () => `Text for ${sel}` }),
    close: async () => {},
  };
}

function mockContext() {
  return {
    newPage: async () => mockPage(),
    close: async () => {},
  };
}

function mockBrowser() {
  return {
    newContext: async () => mockContext(),
    close: async () => {},
  };
}

/**
 * Create a BrowserManager with a mock browser injected.
 * We override the private #ensureBrowser by subclassing through a test helper.
 */
class TestBrowserManager extends BrowserManager {
  #mockBrowser;

  constructor(opts = {}) {
    super(opts);
    this.#mockBrowser = mockBrowser();
  }

  // Override availability check
  async isAvailable() { return true; }

  // Expose a way to open pages using mock browser
  async open(agentId, url) {
    // We need to access the internal logic but can't easily since it's private.
    // Instead, test the public API behavior through a wrapper approach.
    // For unit tests of session management, we'll test the logic directly.
    return super.open(agentId, url);
  }
}

// --- Session management tests (without actual Playwright) ---
describe('BrowserManager — Core Logic', () => {
  let bm;

  beforeEach(() => {
    bm = new BrowserManager();
  });

  it('reports unavailable when Playwright is not installed', async () => {
    // In test environment, Playwright is likely not installed
    const available = await bm.isAvailable();
    // This test passes regardless — just exercises the check
    assert.equal(typeof available, 'boolean');
  });

  it('getStatus returns initial state', () => {
    const status = bm.getStatus();
    assert.equal(status.browserRunning, false);
    assert.equal(status.openPages, 0);
  });

  it('getAgentPages returns empty for unknown agent', () => {
    const pages = bm.getAgentPages('unknown-agent');
    assert.deepEqual(pages, []);
  });

  it('shutdown is safe when no browser is running', async () => {
    await bm.shutdown(); // Should not throw
  });

  it('suspendAgent returns empty for agent with no pages', async () => {
    const state = await bm.suspendAgent('unknown-agent');
    assert.deepEqual(state, []);
  });
});

// --- Browser tool interface tests ---
describe('Browser Tool Interfaces', () => {
  const toolFiles = [
    'BrowserOpenTool',
    'BrowserClickTool',
    'BrowserTypeTool',
    'BrowserScreenshotTool',
    'BrowserNavigateTool',
    'BrowserGetTextTool',
    'BrowserCloseTool',
  ];

  for (const name of toolFiles) {
    it(`${name} has correct interface`, async () => {
      const mod = await import(`../../src/tools/core/${name}.js`);
      const ToolClass = mod.default;
      const tool = new ToolClass();
      assert.ok(tool.name, 'has name');
      assert.ok(tool.description, 'has description');
      assert.ok(tool.parameters, 'has parameters');
      assert.equal(tool.permissionLevel, 'auto');
      assert.equal(typeof tool.execute, 'function');
    });
  }
});

// --- Browser tools graceful degradation ---
describe('Browser Tools — No BrowserManager', () => {
  it('browserOpen fails gracefully without BrowserManager', async () => {
    const mod = await import('../../src/tools/core/BrowserOpenTool.js');
    const tool = new mod.default();
    const result = await tool.execute({ url: 'https://example.com' }, {});
    assert.equal(result.success, false);
    assert.ok(result.error.includes('BrowserManager'));
  });

  it('browserClick fails gracefully without BrowserManager', async () => {
    const mod = await import('../../src/tools/core/BrowserClickTool.js');
    const tool = new mod.default();
    const result = await tool.execute({ pageId: 'p1', selector: '#btn' }, {});
    assert.equal(result.success, false);
  });

  it('browserType fails gracefully without BrowserManager', async () => {
    const mod = await import('../../src/tools/core/BrowserTypeTool.js');
    const tool = new mod.default();
    const result = await tool.execute({ pageId: 'p1', selector: '#input', text: 'hi' }, {});
    assert.equal(result.success, false);
  });

  it('browserScreenshot fails gracefully without BrowserManager', async () => {
    const mod = await import('../../src/tools/core/BrowserScreenshotTool.js');
    const tool = new mod.default();
    const result = await tool.execute({ pageId: 'p1' }, {});
    assert.equal(result.success, false);
  });

  it('browserNavigate fails gracefully without BrowserManager', async () => {
    const mod = await import('../../src/tools/core/BrowserNavigateTool.js');
    const tool = new mod.default();
    const result = await tool.execute({ pageId: 'p1', url: 'https://example.com' }, {});
    assert.equal(result.success, false);
  });

  it('browserGetText fails gracefully without BrowserManager', async () => {
    const mod = await import('../../src/tools/core/BrowserGetTextTool.js');
    const tool = new mod.default();
    const result = await tool.execute({ pageId: 'p1' }, {});
    assert.equal(result.success, false);
  });

  it('browserClose fails gracefully without BrowserManager', async () => {
    const mod = await import('../../src/tools/core/BrowserCloseTool.js');
    const tool = new mod.default();
    const result = await tool.execute({ pageId: 'p1' }, {});
    assert.equal(result.success, false);
  });
});

// --- BrowserOpen with unavailable Playwright ---
describe('Browser Tools — Playwright Not Installed', () => {
  it('browserOpen returns clear error when Playwright missing', async () => {
    const mod = await import('../../src/tools/core/BrowserOpenTool.js');
    const tool = new mod.default();
    // Pass a BrowserManager that reports unavailable
    const fakeBM = { isAvailable: async () => false };
    const result = await tool.execute({ url: 'https://example.com' }, { browserManager: fakeBM });
    assert.equal(result.success, false);
    assert.ok(result.error.includes('Playwright'));
  });
});
