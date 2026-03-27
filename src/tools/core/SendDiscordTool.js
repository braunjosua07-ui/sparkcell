/**
 * SendDiscordTool — Send a message to Discord via webhook.
 *
 * Webhook URL from context.discordWebhook (set in startup.json).
 * Permission: ask (once, then persistent).
 */
export default class SendDiscordTool {
  name = 'sendDiscord';
  description = 'Send a message to a Discord channel via webhook. Requires discordWebhook URL in startup.json.';
  parameters = {
    channel: { type: 'string', required: false, description: 'Descriptive label (webhook determines actual channel)', default: '' },
    message: { type: 'string', required: true, description: 'Message text (supports Discord markdown)' },
  };
  permissionLevel = 'ask';

  async execute(args, context) {
    const webhookUrl = context.discordWebhook;
    if (!webhookUrl) {
      return { success: false, output: null, error: 'Discord webhook not configured. Add discordWebhook URL to startup.json.' };
    }

    const payload = {
      content: args.message,
      username: `SparkCell (${context.agentName || context.agentId || 'Agent'})`,
    };

    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(15000),
      });

      if (!response.ok) {
        const body = await response.text();
        return { success: false, output: null, error: `Discord API error ${response.status}: ${body}` };
      }

      if (context.bus) {
        context.bus.publish('comm:discord-sent', {
          agentId: context.agentId,
          agentName: context.agentName,
          preview: args.message.slice(0, 80),
        });
      }

      return { success: true, output: `Discord message sent: "${args.message.slice(0, 80)}"` };
    } catch (err) {
      return { success: false, output: null, error: `Discord error: ${err.message}` };
    }
  }
}
