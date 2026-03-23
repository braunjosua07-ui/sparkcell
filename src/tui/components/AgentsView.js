import React from 'react';
import { Box, Text } from 'ink';
import { useAgentStatus } from '../hooks/useAgentStatus.js';

const STATE_COLORS = {
  IDLE: 'gray',
  WORKING: 'green',
  BLOCKED: 'red',
  PAUSED: 'yellow',
  HELP: 'magenta',
  COMPLETE: 'cyan',
  RESTED: 'blue',
};

const STATE_ICONS = {
  IDLE: '\u25CB',     // ○
  WORKING: '\u25CF',  // ●
  BLOCKED: '\u2718',  // ✘
  PAUSED: '\u2016',   // ‖
  HELP: '\u2753',     // ❓
  COMPLETE: '\u2714', // ✔
  RESTED: '\u263E',   // ☾
};

function energyBar(energy) {
  const filled = Math.round(energy / 10);
  const empty = 10 - filled;
  return '\u2588'.repeat(filled) + '\u2591'.repeat(empty);
}

export function AgentsView({ sparkCell }) {
  const agents = useAgentStatus(sparkCell);

  if (agents.length === 0) {
    return React.createElement(Box, { padding: 1 },
      React.createElement(Text, { dimColor: true }, 'Keine Agents geladen'),
    );
  }

  return React.createElement(Box, { flexDirection: 'column' },
    React.createElement(Text, { bold: true, color: 'cyan' }, `Agents (${agents.length})`),
    React.createElement(Text, null, ''),
    ...agents.map(a => {
      const stateColor = STATE_COLORS[a.state] || 'white';
      const icon = STATE_ICONS[a.state] || '?';
      const eColor = a.energy > 60 ? 'green' : a.energy > 30 ? 'yellow' : 'red';
      return React.createElement(Box, {
        key: a.id,
        borderStyle: 'round',
        borderColor: stateColor,
        paddingX: 1,
        marginBottom: 1,
        flexDirection: 'column',
      },
        React.createElement(Box, { gap: 2 },
          React.createElement(Text, { bold: true, color: 'cyan' }, a.name),
          React.createElement(Text, { dimColor: true }, `(${a.role})`),
          React.createElement(Text, { color: stateColor }, `${icon} ${a.state}`),
        ),
        React.createElement(Box, { gap: 1 },
          React.createElement(Text, null, 'Energie: '),
          React.createElement(Text, { color: eColor }, `${energyBar(a.energy)} ${a.energy}%`),
        ),
        a.currentTask
          ? React.createElement(Text, { color: 'white' }, `Task: ${a.currentTask.title || 'Arbeitet...'}`)
          : React.createElement(Text, { dimColor: true }, `Queue: ${a.queueLength || 0} | Cycles: ${a.cycleCount || 0}`),
      );
    }),
  );
}
