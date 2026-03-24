export default class BrowserScreenshotTool {
  name = 'browserScreenshot';
  description = 'Take a screenshot of a browser page. Returns the file path of the saved image.';
  parameters = {
    pageId: { type: 'string', required: true, description: 'Page ID from browserOpen' },
  };
  permissionLevel = 'auto';

  async execute(args, context) {
    const bm = context.browserManager;
    if (!bm) return { success: false, output: null, error: 'BrowserManager not available' };
    const outputDir = context.outputDir || context.workDir;
    if (!outputDir) return { success: false, output: null, error: 'No output directory configured' };
    try {
      const filepath = await bm.screenshot(args.pageId, outputDir);
      return { success: true, output: { filepath } };
    } catch (err) {
      return { success: false, output: null, error: err.message };
    }
  }
}
