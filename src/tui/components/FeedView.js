import React from 'react';
import { Box, Text } from 'ink';

export function FeedView({ sparkCell }) {
  // In production, would use useFeed hook. Static placeholder for now.
  return React.createElement(Box, { flexDirection: 'column', padding: 1 },
    React.createElement(Text, { bold: true }, 'Live Feed'),
    React.createElement(Text, { dimColor: true }, 'Events will appear here when simulation is running...')
  );
}
