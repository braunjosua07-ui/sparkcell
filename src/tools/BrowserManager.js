/**
 * BrowserManager — Central browser session management.
 *
 * Playwright is an optional dependency. If not installed, all browser
 * operations return graceful errors. BrowserManager enforces:
 *   - Max 3 tabs per agent
 *   - Auto-close after 5 min inactivity per page
 *   - Full cleanup on shutdown
 */

const MAX_TABS_PER_AGENT = 3;
const INACTIVITY_TIMEOUT = 5 * 60 * 1000; // 5 minutes

let playwright = null;

async function loadPlaywright() {
  if (playwright) return playwright;
  try {
    playwright = await import('playwright');
    return playwright;
  } catch {
    return null;
  }
}

export class BrowserManager {
  #browser = null;
  #pages = new Map();     // pageId -> { page, agentId, url, lastActivity, timer }
  #agentPages = new Map(); // agentId -> Set<pageId>
  #counter = 0;
  #logger;
  #available = null; // null = not checked, true/false after check

  constructor({ logger } = {}) {
    this.#logger = logger || null;
  }

  /**
   * Check if Playwright is installed and available.
   */
  async isAvailable() {
    if (this.#available !== null) return this.#available;
    const pw = await loadPlaywright();
    this.#available = pw !== null;
    return this.#available;
  }

  async #ensureBrowser() {
    if (!(await this.isAvailable())) {
      throw new Error('Playwright is not installed. Run: npm install playwright');
    }
    if (!this.#browser) {
      this.#browser = await playwright.chromium.launch({ headless: true });
      this.#log('Browser launched');
    }
    return this.#browser;
  }

  /**
   * Open a new page for an agent.
   * @returns {{ pageId: string, url: string }}
   */
  async open(agentId, url) {
    // Check tab limit
    const agentTabs = this.#agentPages.get(agentId) || new Set();
    if (agentTabs.size >= MAX_TABS_PER_AGENT) {
      throw new Error(`Agent ${agentId} has reached the maximum of ${MAX_TABS_PER_AGENT} tabs. Close a tab first.`);
    }

    const browser = await this.#ensureBrowser();
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

    const pageId = `page-${++this.#counter}`;
    const timer = this.#startInactivityTimer(pageId);

    this.#pages.set(pageId, { page, context, agentId, url, lastActivity: Date.now(), timer });
    if (!this.#agentPages.has(agentId)) this.#agentPages.set(agentId, new Set());
    this.#agentPages.get(agentId).add(pageId);

    this.#log(`Page ${pageId} opened: ${url} (agent: ${agentId})`);
    return { pageId, url };
  }

  /**
   * Get a page by ID, refreshing its activity timer.
   */
  getPage(pageId) {
    const entry = this.#pages.get(pageId);
    if (!entry) throw new Error(`Page "${pageId}" not found. It may have been closed.`);
    entry.lastActivity = Date.now();
    // Reset inactivity timer
    clearTimeout(entry.timer);
    entry.timer = this.#startInactivityTimer(pageId);
    return entry.page;
  }

  /**
   * Click an element on a page.
   */
  async click(pageId, selector) {
    const page = this.getPage(pageId);
    await page.click(selector, { timeout: 10000 });
  }

  /**
   * Type text into an element.
   */
  async type(pageId, selector, text) {
    const page = this.getPage(pageId);
    await page.fill(selector, text, { timeout: 10000 });
  }

  /**
   * Take a screenshot.
   * @returns {string} Path to the saved screenshot.
   */
  async screenshot(pageId, outputDir) {
    const page = this.getPage(pageId);
    const filename = `screenshot-${pageId}-${Date.now()}.png`;
    const filepath = `${outputDir}/${filename}`;
    await page.screenshot({ path: filepath, fullPage: false });
    return filepath;
  }

  /**
   * Navigate to a new URL.
   */
  async navigate(pageId, url) {
    const page = this.getPage(pageId);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    const entry = this.#pages.get(pageId);
    if (entry) entry.url = url;
  }

  /**
   * Extract text from a page, optionally scoped by selector.
   */
  async getText(pageId, selector) {
    const page = this.getPage(pageId);
    if (selector) {
      const el = await page.$(selector);
      if (!el) return '';
      return (await el.textContent()) || '';
    }
    return await page.evaluate(() => document.body.innerText || '');
  }

  /**
   * Close a page and free resources.
   */
  async close(pageId) {
    const entry = this.#pages.get(pageId);
    if (!entry) return;
    clearTimeout(entry.timer);
    try { await entry.context.close(); } catch { /* already closed */ }
    this.#pages.delete(pageId);
    const agentSet = this.#agentPages.get(entry.agentId);
    if (agentSet) {
      agentSet.delete(pageId);
      if (agentSet.size === 0) this.#agentPages.delete(entry.agentId);
    }
    this.#log(`Page ${pageId} closed (agent: ${entry.agentId})`);
  }

  /**
   * Get open pages for an agent.
   */
  getAgentPages(agentId) {
    const pageIds = this.#agentPages.get(agentId);
    if (!pageIds) return [];
    return [...pageIds].map(id => {
      const entry = this.#pages.get(id);
      return { pageId: id, url: entry?.url || '?', lastActivity: entry?.lastActivity };
    });
  }

  /**
   * Close all pages for an agent (e.g., on pause).
   * Returns serialized state for resume.
   */
  async suspendAgent(agentId) {
    const pages = this.getAgentPages(agentId);
    for (const { pageId } of pages) {
      await this.close(pageId);
    }
    return pages.map(p => ({ url: p.url }));
  }

  /**
   * Shutdown — close all pages and the browser.
   */
  async shutdown() {
    for (const pageId of [...this.#pages.keys()]) {
      await this.close(pageId);
    }
    if (this.#browser) {
      try { await this.#browser.close(); } catch { /* already closed */ }
      this.#browser = null;
      this.#log('Browser closed');
    }
  }

  /**
   * Get status summary.
   */
  getStatus() {
    return {
      available: this.#available,
      browserRunning: this.#browser !== null,
      openPages: this.#pages.size,
      agentSessions: Object.fromEntries(
        [...this.#agentPages.entries()].map(([id, set]) => [id, set.size])
      ),
    };
  }

  #startInactivityTimer(pageId) {
    return setTimeout(() => {
      this.#log(`Page ${pageId} auto-closed (inactivity timeout)`);
      this.close(pageId).catch(() => {});
    }, INACTIVITY_TIMEOUT);
  }

  #log(msg) {
    if (this.#logger) this.#logger.info(`[BrowserManager] ${msg}`);
  }
}
