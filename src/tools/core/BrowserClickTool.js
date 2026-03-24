export default class BrowserClickTool {
  name = 'browserClick';
  description = 'Click an element on a browser page by CSS selector.';
  parameters = {
    pageId: { type: 'string', required: true, description: 'Page ID from browserOpen' },
    selector: { type: 'string', required: true, description: 'CSS selector of the element to click' },
  };
  permissionLevel = 'auto';

  async execute(args, context) {
    const bm = context.browserManager;
    if (!bm) return { success: false, output: null, error: 'BrowserManager not available' };
    try {
      await bm.click(args.pageId, args.selector);
      return { success: true, output: `Clicked "${args.selector}" on ${args.pageId}` };
    } catch (err) {
      return { success: false, output: null, error: err.message };
    }
  }
}
