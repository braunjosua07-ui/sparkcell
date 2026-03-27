export default class BrowserNavigateTool {
  name = 'browserNavigate';
  description = 'Navigate an existing browser page to a new URL.';
  parameters = {
    pageId: { type: 'string', required: true, description: 'Page ID from browserOpen' },
    url: { type: 'string', required: true, description: 'URL to navigate to' },
  };
  permissionLevel = 'auto';

  async execute(args, context) {
    const bm = context.browserManager;
    if (!bm) return { success: false, output: null, error: 'BrowserManager not available' };
    try {
      await bm.navigate(args.pageId, args.url);
      return { success: true, output: `Navigated ${args.pageId} to ${args.url}` };
    } catch (err) {
      return { success: false, output: null, error: err.message };
    }
  }
}
