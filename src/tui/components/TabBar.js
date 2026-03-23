import React from 'react';
import { Box, Text } from 'ink';

export function TabBar({ tabs, active, onSelect }) {
  return React.createElement(Box, { borderStyle: 'single', borderColor: 'gray', paddingX: 1, gap: 2 },
    ...tabs.map((tab, i) =>
      React.createElement(Text, {
        key: tab,
        bold: tab === active,
        color: tab === active ? 'cyan' : 'gray',
        inverse: tab === active,
      }, ` ${i + 1}:${tab} `)
    )
  );
}
