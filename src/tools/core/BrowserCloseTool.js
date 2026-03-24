export default class BrowserCloseTool {
  name = 'browserClose';
  description = 'Close a browser tab and free its resources.';
  parameters = {
    pageId: { type: 'string', required: true, description: 'Page ID to close' },
  };
  permissionLevel = 'auto';

  async execute(args, context) {
    const bm = context.browserManager;
    if (!bm) return { success: false, output: null, error: 'BrowserManager not available' };
    try {
      await bm.close(args.pageId);
      return { success: true, output: `Page ${args.pageId} closed` };
    } catch (err) {
      return { success: false, output: null, error: err.message };
    }
  }
}
