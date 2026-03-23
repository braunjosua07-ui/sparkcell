import React from 'react';
import { Box, Text } from 'ink';

export function PauseRoomView({ sparkCell }) {
  const pauseRoom = sparkCell?.pauseRoom;
  const present = pauseRoom?.getPresent?.() || [];
  const activity = pauseRoom?.getRecentActivity?.(10) || [];

  return React.createElement(Box, { flexDirection: 'column', padding: 1 },
    React.createElement(Text, { bold: true }, 'Pause Room'),
    React.createElement(Box, { marginTop: 1 },
      React.createElement(Text, null, `Present: `),
      present.length > 0
        ? React.createElement(Text, { color: 'green' }, present.join(', '))
        : React.createElement(Text, { dimColor: true }, 'Empty')
    ),
    React.createElement(Box, { flexDirection: 'column', marginTop: 1 },
      React.createElement(Text, { bold: true }, 'Recent Activity:'),
      activity.length > 0
        ? activity.map((a, i) =>
            React.createElement(Text, { key: i, dimColor: true },
              `  ${a.type}: ${a.agentId} - ${a.message || a.activity || ''}`
            )
          )
        : [React.createElement(Text, { key: 'empty', dimColor: true }, '  No activity yet')]
    )
  );
}
