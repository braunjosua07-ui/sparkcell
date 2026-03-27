import React from 'react';
import { Box, Text } from 'ink';

export function TasksView({ sparkCell }) {
  const agents = sparkCell?.agents || [];

  return React.createElement(Box, { flexDirection: 'column', padding: 1 },
    React.createElement(Text, { bold: true }, 'Task Board'),
    ...agents.map(agent => {
      const status = agent.getStatus();
      return React.createElement(Box, { key: status.id, marginBottom: 1 },
        React.createElement(Text, { bold: true, color: 'cyan' }, `${status.name}: `),
        status.currentTask
          ? React.createElement(Text, null, status.currentTask.title || 'Working...')
          : React.createElement(Text, { dimColor: true }, 'No active task'),
        React.createElement(Text, { dimColor: true }, ` (queue: ${status.queueLength})`)
      );
    }),
    agents.length === 0 && React.createElement(Text, { dimColor: true }, 'No agents loaded')
  );
}
