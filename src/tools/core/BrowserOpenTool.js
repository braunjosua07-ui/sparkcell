export default class BrowserOpenTool {
  name = 'browserOpen';
  description = 'Open a new browser tab and navigate to a URL. Returns a pageId for subsequent browser operations. Max 3 tabs per agent.';
  parameters = {
    url: { type: 'string', required: true, description: 'URL to open' },
  };
  permissionLevel = 'auto';

  async execute(args, context) {
    const bm = context.browserManager;
    if (!bm) return { success: false, output: null, error: 'BrowserManager not available' };
    if (!(await bm.isAvailable())) {
      return { success: false, output: null, error: 'Playwright is not installed. Browser tools are unavailable.' };
    }
    try {
      const { pageId, url } = await bm.open(context.agentId, args.url);
      return { success: true, output: { pageId, url } };
    } catch (err) {
      return { success: false, output: null, error: err.message };
    }
  }
}
