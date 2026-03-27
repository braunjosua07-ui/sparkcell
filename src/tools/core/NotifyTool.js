/**
 * NotifyTool — Send a notification to the user in the TUI.
 *
 * Publishes an event on the bus that Feed and Chat pick up.
 * Permission: auto (internal notification, no external side effects).
 */
export default class NotifyTool {
  name = 'notify';
  description = 'Send a notification to the user in the TUI. Appears in Feed and Chat. No external side effects.';
  parameters = {
    message: { type: 'string', required: true, description: 'Notification message' },
    priority: { type: 'string', required: false, description: 'Priority: low, medium, high', default: 'medium' },
  };
  permissionLevel = 'auto';

  async execute(args, context) {
    const { message, priority = 'medium' } = args;

    if (!['low', 'medium', 'high'].includes(priority)) {
      return { success: false, output: null, error: `Invalid priority: "${priority}". Must be low, medium, or high.` };
    }

    if (context.bus) {
      context.bus.publish('agent:notification', {
        agentId: context.agentId,
        agentName: context.agentName,
        message,
        priority,
      });
    }

    return { success: true, output: `Notification sent: [${priority}] ${message}` };
  }
}
