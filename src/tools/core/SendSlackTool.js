/**
 * SendSlackTool — Send a message to Slack via webhook.
 *
 * Webhook URL from context.slackWebhook (set in startup.json).
 * Permission: ask (once, then persistent).
 */
export default class SendSlackTool {
  name = 'sendSlack';
  description = 'Send a message to a Slack channel via webhook. Requires slackWebhook URL in startup.json.';
  parameters = {
    channel: { type: 'string', required: false, description: 'Channel name override (if webhook supports it)', default: '' },
    message: { type: 'string', required: true, description: 'Message text (supports Slack markdown)' },
  };
  permissionLevel = 'ask';

  async execute(args, context) {
    const webhookUrl = context.slackWebhook;
    if (!webhookUrl) {
      return { success: false, output: null, error: 'Slack webhook not configured. Add slackWebhook URL to startup.json.' };
    }

    const payload = { text: args.message };
    if (args.channel) payload.channel = args.channel;

    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(15000),
      });

      if (!response.ok) {
        const body = await response.text();
        return { success: false, output: null, error: `Slack API error ${response.status}: ${body}` };
      }

      if (context.bus) {
        context.bus.publish('comm:slack-sent', {
          agentId: context.agentId,
          agentName: context.agentName,
          channel: args.channel || 'default',
          preview: args.message.slice(0, 80),
        });
      }

      return { success: true, output: `Slack message sent${args.channel ? ` to #${args.channel}` : ''}: "${args.message.slice(0, 80)}"` };
    } catch (err) {
      return { success: false, output: null, error: `Slack error: ${err.message}` };
    }
  }
}
