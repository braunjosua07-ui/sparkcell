export default class BrowserGetTextTool {
  name = 'browserGetText';
  description = 'Extract text content from a browser page, optionally scoped by CSS selector.';
  parameters = {
    pageId: { type: 'string', required: true, description: 'Page ID from browserOpen' },
    selector: { type: 'string', required: false, description: 'Optional CSS selector to scope extraction. If omitted, returns full page text.' },
  };
  permissionLevel = 'auto';

  async execute(args, context) {
    const bm = context.browserManager;
    if (!bm) return { success: false, output: null, error: 'BrowserManager not available' };
    try {
      let text = await bm.getText(args.pageId, args.selector);
      if (text.length > 4000) {
        text = text.slice(0, 4000) + `\n[...truncated, ${text.length - 4000} chars omitted]`;
      }
      return { success: true, output: text };
    } catch (err) {
      return { success: false, output: null, error: err.message };
    }
  }
}
