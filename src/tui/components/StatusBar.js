import React from 'react';
import { Box, Text } from 'ink';

export function StatusBar({ sparkCell }) {
  const status = sparkCell?.getStatus?.() || {};
  const uptime = status.uptime ? formatUptime(status.uptime) : '00:00:00';
  const agentCount = status.agents?.length || 0;
  const paused = status.paused ? ' [PAUSED]' : '';

  // Calculate average soul score from personality across all agents
  const avgSoulScore = agentCount > 0
    ? Math.round(status.agents.reduce((sum, a) => {
        return sum + (a.personalitySoulScore || a.soulScore || 0);
      }, 0) / agentCount)
    : 0;

  return React.createElement(Box, { borderStyle: 'double', borderColor: avgSoulScore >= 50 ? 'magenta' : 'cyan', paddingX: 1 },
    React.createElement(Text, { bold: true, color: 'cyan' }, 'SparkCell'),
    React.createElement(Text, null, ` | `),
    React.createElement(Text, { color: 'green' }, status.startup || 'No startup'),
    React.createElement(Text, null, ` | `),
    React.createElement(Text, null, `${agentCount} agents`),
    React.createElement(Text, null, ` | `),
    React.createElement(Text, null, uptime),
    React.createElement(Text, { color: avgSoulScore >= 70 ? 'magenta' : avgSoulScore >= 40 ? 'cyan' : 'gray' }, ` | \u2764 Soul: ${avgSoulScore}%`),
    React.createElement(Text, { color: status.paused ? 'yellow' : 'green' }, paused || ' [RUNNING]'),
    React.createElement(Box, { flexGrow: 1 }),
    React.createElement(Text, { dimColor: true }, 'Ctrl+Q quit | Ctrl+P pause | Tab chat')
  );
}

function formatUptime(ms) {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}
