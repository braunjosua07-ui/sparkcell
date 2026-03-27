export class ConfigValidator {
  validateGlobal(config) {
    const errors = [];
    if (!config.version) errors.push('Missing version');
    if (config.llm && config.llm.primary) {
      if (!config.llm.primary.provider) errors.push('Missing llm.primary.provider');
    }
    if (config.budget) {
      if (typeof config.budget.dailyLimit !== 'number' || config.budget.dailyLimit < 0) {
        errors.push('budget.dailyLimit must be a non-negative number');
      }
    }
    return { valid: errors.length === 0, errors };
  }

  validateStartup(config) {
    const errors = [];
    if (!config.version) errors.push('Missing version');
    if (!config.name) errors.push('Missing name');
    if (!Array.isArray(config.agents) || config.agents.length === 0) {
      errors.push('Must have at least one agent');
    } else {
      for (const agent of config.agents) {
        if (!agent.id) errors.push(`Agent missing id`);
        if (!agent.role) errors.push(`Agent ${agent.id || '?'} missing role`);
      }
    }
    return { valid: errors.length === 0, errors };
  }
}
