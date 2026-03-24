/**
 * SocialPostTool — Post content to a social media platform.
 *
 * Composed tool: uses browserManager internally for the actual posting.
 * Permission: ask (once, then persistent).
 * The agent must be logged in first (via socialLogin).
 */

const PLATFORM_POST_URLS = {
  tiktok: 'https://www.tiktok.com/creator#/upload',
  twitter: 'https://twitter.com/compose/tweet',
  x: 'https://twitter.com/compose/tweet',
  instagram: 'https://www.instagram.com/create/style/',
  linkedin: 'https://www.linkedin.com/feed/',
  facebook: 'https://www.facebook.com/',
  reddit: 'https://www.reddit.com/submit',
};

export default class SocialPostTool {
  name = 'socialPost';
  description = 'Post content to a social media platform. Requires prior login via socialLogin. Permission requested on first use per platform.';
  parameters = {
    platform: { type: 'string', required: true, description: 'Platform name (tiktok, twitter, instagram, linkedin, facebook, reddit)' },
    content: { type: 'string', required: true, description: 'Text content to post' },
    media: { type: 'string', required: false, description: 'Optional path to media file (image/video)' },
  };
  permissionLevel = 'ask';

  async execute(args, context) {
    const { platform, content, media } = args;
    const platformKey = platform.toLowerCase();

    const bm = context.browserManager;
    if (!bm) {
      return { success: false, output: null, error: 'BrowserManager not available' };
    }
    if (!(await bm.isAvailable())) {
      return { success: false, output: null, error: 'Playwright not installed.' };
    }

    const postUrl = PLATFORM_POST_URLS[platformKey];
    if (!postUrl) {
      return { success: false, output: null, error: `Unknown platform: "${platform}". Supported: ${Object.keys(PLATFORM_POST_URLS).join(', ')}` };
    }

    // Check if agent has an open browser session (should be logged in)
    const agentPages = bm.getAgentPages(context.agentId);
    if (agentPages.length === 0) {
      return {
        success: false,
        output: null,
        error: `No open browser sessions. Login first with socialLogin for ${platform}.`,
      };
    }

    try {
      // Open or navigate to the post creation page
      const { pageId } = await bm.open(context.agentId, postUrl);

      return {
        success: true,
        output: {
          pageId,
          platform: platformKey,
          postUrl,
          content: content.slice(0, 100) + (content.length > 100 ? '...' : ''),
          message: `Post page opened at ${postUrl}. Page ID: ${pageId}. Use browserType to enter content and browserClick to submit.`,
          hints: {
            contentField: 'textarea, [contenteditable="true"], [role="textbox"]',
            submitButton: 'button[type="submit"], [data-testid="tweetButton"], button:has-text("Post")',
          },
        },
      };
    } catch (err) {
      return { success: false, output: null, error: err.message };
    }
  }
}
