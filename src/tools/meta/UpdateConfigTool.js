const ALLOWED_KEYS = new Set([
  'skills',
  'energyConfig',
  'energyConfig.decayRate',
  'energyConfig.recoveryRate',
  'energyConfig.pauseThreshold',
  'taskGeneration.maxTasks',
  'taskGeneration.priorityWeights',
]);

const BLOCKED_KEYS = new Set(['id', 'permissions', 'name', 'bus', 'llm', 'toolRunner']);

export default class UpdateConfigTool {
  name = 'updateConfig';
  description = 'Update own agent configuration. Allowed: skills, energy thresholds, task generation params. Blocked: id, permissions, name.';
  parameters = {
    key: { type: 'string', required: true, description: 'Config key to update (e.g. "skills", "energyConfig.decayRate")' },
    value: { type: 'string', required: true, description: 'New value (JSON-encoded for objects/arrays)' },
  };
  permissionLevel = 'auto';

  async execute(args, context) {
    const { key, value } = args;

    if (BLOCKED_KEYS.has(key)) {
      return { success: false, output: null, error: `Config key "${key}" is protected and cannot be modified` };
    }

    if (!ALLOWED_KEYS.has(key)) {
      return {
        success: false,
        output: null,
        error: `Config key "${key}" is not in the allowed list. Allowed: ${[...ALLOWED_KEYS].join(', ')}`,
      };
    }

    // Parse JSON value if needed
    let parsed;
    try {
      parsed = JSON.parse(value);
    } catch {
      parsed = value; // Use as plain string
    }

    // Emit config update event — Agent picks it up
    if (context.bus) {
      context.bus.publish('agent:config-update', {
        agentId: context.agentId,
        key,
        value: parsed,
      });
    }

    return {
      success: true,
      output: `Config "${key}" updated to ${JSON.stringify(parsed)} for agent ${context.agentId}`,
    };
  }
}
