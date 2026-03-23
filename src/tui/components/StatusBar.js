import React from 'react';
import { Box, Text } from 'ink';

export function StatusBar({ sparkCell }) {
  const status = sparkCell?.getStatus?.() || {};
  const uptime = status.uptime ? formatUptime(status.uptime) : '00:00:00';
  const agentCount = status.agents?.length || 0;
  const paused = status.paused ? ' [PAUSED]' : '';

  return React.createElement(Box, { borderStyle: 'single', borderColor: 'cyan', paddingX: 1 },
    React.createElement(Text, { bold: true, color: 'cyan' }, `SparkCell`),
    React.createElement(Text, null, ` | `),
    React.createElement(Text, { color: 'green' }, status.startup || 'No startup'),
    React.createElement(Text, null, ` | `),
    React.createElement(Text, null, `${agentCount} agents`),
    React.createElement(Text, null, ` | `),
    React.createElement(Text, null, uptime),
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
