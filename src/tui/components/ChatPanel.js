import React, { useState } from 'react';
import { Box, Text } from 'ink';

export function ChatPanel({ sparkCell, focused }) {
  const [messages, setMessages] = useState([]);

  return React.createElement(Box, {
    flexDirection: 'column',
    width: 40,
    borderStyle: 'single',
    borderColor: focused ? 'cyan' : 'gray',
    paddingX: 1,
  },
    React.createElement(Text, { bold: true, color: focused ? 'cyan' : 'gray' }, 'Chat'),
    React.createElement(Box, { flexDirection: 'column', flexGrow: 1 },
      messages.length === 0
        ? React.createElement(Text, { dimColor: true }, 'Type a message...')
        : messages.slice(-10).map((msg, i) =>
            React.createElement(Text, { key: i, color: msg.role === 'user' ? 'green' : 'white' },
              `${msg.role === 'user' ? '> ' : '  '}${msg.content}`
            )
          )
    ),
    React.createElement(Box, { borderStyle: 'single', borderColor: focused ? 'cyan' : 'gray', paddingX: 1 },
      React.createElement(Text, { dimColor: !focused }, focused ? '> _' : 'Press Tab to chat')
    )
  );
}
