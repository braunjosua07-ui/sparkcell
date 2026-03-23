import React from 'react';
import { Box, Text } from 'ink';

export function AgentsView({ sparkCell }) {
  const agents = sparkCell?.agents || [];

  if (agents.length === 0) {
    return React.createElement(Box, { padding: 1 },
      React.createElement(Text, { dimColor: true }, 'No agents loaded')
    );
  }

  return React.createElement(Box, { flexDirection: 'column', padding: 1 },
    React.createElement(Text, { bold: true }, 'Agents'),
    ...agents.map(agent => {
      const status = agent.getStatus();
      const energyColor = status.energy > 60 ? 'green' : status.energy > 30 ? 'yellow' : 'red';
      return React.createElement(Box, { key: status.id, borderStyle: 'round', paddingX: 1, marginBottom: 1, flexDirection: 'column' },
        React.createElement(Box, { gap: 2 },
          React.createElement(Text, { bold: true, color: 'cyan' }, status.name),
          React.createElement(Text, { dimColor: true }, `(${status.role})`),
          React.createElement(Text, { color: energyColor }, `Energy: ${status.energy}%`),
          React.createElement(Text, null, `State: ${status.state}`)
        ),
        status.currentTask
          ? React.createElement(Text, null, `Task: ${status.currentTask.title || 'Working...'}`)
          : React.createElement(Text, { dimColor: true }, 'Idle')
      );
    })
  );
}
