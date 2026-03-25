/**
 * SocialLoginTool — Log into a social media platform.
 *
 * Composed tool: uses browserManager internally.
 * Credentials come from CredentialStore — never from the LLM prompt.
 * Permission: ask (once, then persistent).
 */

const PLATFORM_URLS = {
  tiktok: 'https://www.tiktok.com/login',
  twitter: 'https://twitter.com/i/flow/login',
  x: 'https://twitter.com/i/flow/login',
  instagram: 'https://www.instagram.com/accounts/login/',
  linkedin: 'https://www.linkedin.com/login',
  facebook: 'https://www.facebook.com/login',
  youtube: 'https://accounts.google.com/signin',
  reddit: 'https://www.reddit.com/login/',
};

export default class SocialLoginTool {
  name = 'socialLogin';
  description = 'Log into a social media platform using stored credentials. Credentials must be added first via /account add <platform>.';
  parameters = {
    platform: { type: 'string', required: true, description: 'Platform name (tiktok, twitter, instagram, linkedin, facebook, youtube, reddit)' },
  };
  permissionLevel = 'ask';

  async execute(args, context) {
    const { platform } = args;
    const platformKey = platform.toLowerCase();

    // Check credentials
    const credStore = context.credentialStore;
    if (!credStore) {
      return { success: false, output: null, error: 'CredentialStore not available. Credentials must be configured first.' };
    }
    if (!credStore.has(platformKey)) {
      return { success: false, output: null, error: `No credentials stored for "${platform}". Use /account add ${platform} to add them.` };
    }

    // Check browser
    const bm = context.browserManager;
    if (!bm) {
      return { success: false, output: null, error: 'BrowserManager not available' };
    }
    if (!(await bm.isAvailable())) {
      return { success: false, output: null, error: 'Playwright not installed. Browser-based login unavailable.' };
    }

    const loginUrl = PLATFORM_URLS[platformKey];
    if (!loginUrl) {
      return { success: false, output: null, error: `Unknown platform: "${platform}". Supported: ${Object.keys(PLATFORM_URLS).join(', ')}` };
    }

    try {
      const creds = credStore.get(platformKey);
      const { pageId } = await bm.open(context.agentId, loginUrl);

      // Auto-fill credentials into the page so they never appear in tool output
      const page = bm.getPage(context.agentId, pageId);
      if (page && creds.username) {
        const userSelectors = 'input[name="username"], input[type="email"], input[name="email"]';
        const passSelectors = 'input[name="password"], input[type="password"]';
        try {
          await page.fill(userSelectors, creds.username);
          if (creds.password) await page.fill(passSelectors, creds.password);
        } catch {
          // Fields not found yet — agent can retry with browserType
        }
      }

      return {
        success: true,
        output: {
          pageId,
          platform: platformKey,
          loginUrl,
          message: `Browser opened at ${loginUrl}. Page ID: ${pageId}. Credentials have been auto-filled. Submit the login form or use browserClick.`,
          hints: {
            usernameField: 'input[name="username"], input[type="email"], input[name="email"]',
            passwordField: 'input[name="password"], input[type="password"]',
          },
        },
      };
    } catch (err) {
      return { success: false, output: null, error: err.message };
    }
  }
}
