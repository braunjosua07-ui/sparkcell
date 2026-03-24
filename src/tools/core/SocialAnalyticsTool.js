/**
 * SocialAnalyticsTool — Fetch analytics/stats from a social media platform.
 *
 * Composed tool: uses browserManager to navigate to analytics pages.
 * Permission: auto (read-only operation).
 */

const ANALYTICS_URLS = {
  tiktok: 'https://www.tiktok.com/creator#/analytics',
  twitter: 'https://analytics.twitter.com',
  x: 'https://analytics.twitter.com',
  instagram: 'https://www.instagram.com/accounts/professional_dashboard/',
  linkedin: 'https://www.linkedin.com/analytics/',
  youtube: 'https://studio.youtube.com/channel/analytics',
  facebook: 'https://www.facebook.com/insights/',
};

export default class SocialAnalyticsTool {
  name = 'socialAnalytics';
  description = 'Fetch analytics and statistics from a social media platform. Requires prior login. Read-only operation.';
  parameters = {
    platform: { type: 'string', required: true, description: 'Platform name' },
  };
  permissionLevel = 'auto';

  async execute(args, context) {
    const platformKey = args.platform.toLowerCase();
    const bm = context.browserManager;

    if (!bm) {
      return { success: false, output: null, error: 'BrowserManager not available' };
    }
    if (!(await bm.isAvailable())) {
      return { success: false, output: null, error: 'Playwright not installed.' };
    }

    const analyticsUrl = ANALYTICS_URLS[platformKey];
    if (!analyticsUrl) {
      return { success: false, output: null, error: `Unknown platform: "${args.platform}". Supported: ${Object.keys(ANALYTICS_URLS).join(', ')}` };
    }

    try {
      const { pageId } = await bm.open(context.agentId, analyticsUrl);

      // Wait briefly for content to load, then extract text
      const page = bm.getPage(pageId);
      await new Promise(r => setTimeout(r, 2000));

      let text = await bm.getText(pageId);
      if (text.length > 4000) {
        text = text.slice(0, 4000) + '\n[...truncated]';
      }

      return {
        success: true,
        output: {
          pageId,
          platform: platformKey,
          analyticsUrl,
          content: text,
          message: `Analytics page loaded. Use browserGetText with specific selectors for detailed data.`,
        },
      };
    } catch (err) {
      return { success: false, output: null, error: err.message };
    }
  }
}
