export default class BrowserTypeTool {
  name = 'browserType';
  description = 'Type text into an input element on a browser page.';
  parameters = {
    pageId: { type: 'string', required: true, description: 'Page ID from browserOpen' },
    selector: { type: 'string', required: true, description: 'CSS selector of the input element' },
    text: { type: 'string', required: true, description: 'Text to type' },
  };
  permissionLevel = 'auto';

  async execute(args, context) {
    const bm = context.browserManager;
    if (!bm) return { success: false, output: null, error: 'BrowserManager not available' };
    try {
      await bm.type(args.pageId, args.selector, args.text);
      return { success: true, output: `Typed into "${args.selector}" on ${args.pageId}` };
    } catch (err) {
      return { success: false, output: null, error: err.message };
    }
  }
}
