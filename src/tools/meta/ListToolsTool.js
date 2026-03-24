export default class ListToolsTool {
  name = 'listTools';
  description = 'List all available tools with their descriptions and permission levels.';
  parameters = {
    filter: { type: 'string', required: false, description: 'Filter by "core", "custom", or "all"', default: 'all' },
  };
  permissionLevel = 'auto';

  async execute(args, context) {
    const toolRunner = context.toolRunner;
    if (!toolRunner) {
      return { success: false, output: null, error: 'No ToolRunner available' };
    }

    const names = toolRunner.getToolNames();
    const filter = args.filter || 'all';

    const tools = names.map(name => {
      const isCustom = name.startsWith('custom:') || toolRunner.isCustomTool?.(name);
      return {
        name,
        type: isCustom ? 'custom' : 'core',
        permission: toolRunner.permissions.getRule(name),
      };
    }).filter(t => {
      if (filter === 'core') return t.type === 'core';
      if (filter === 'custom') return t.type === 'custom';
      return true;
    });

    const summary = `${tools.length} tools available (${tools.filter(t => t.type === 'core').length} core, ${tools.filter(t => t.type === 'custom').length} custom)`;

    return {
      success: true,
      output: {
        summary,
        tools,
      },
    };
  }
}
