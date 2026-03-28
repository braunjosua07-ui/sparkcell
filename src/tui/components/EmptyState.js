// src/tui/components/EmptyState.js
// Reusable Empty State Component

import React from 'react';
import { Box, Text } from 'ink';
import { THEME, ANSI } from '../../cli/colors.js';

/**
 * Empty State Component for views
 */
export function EmptyState({ title, message, actions = [], icon = '○' }) {
  return React.createElement(
    Box,
    { flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 2 },
    React.createElement(Text, { color: THEME.textMuted }, icon),
    React.createElement(Text, { color: THEME.textMuted, bold: true }, title),
    message && React.createElement(Text, { color: THEME.textMuted }, message),
    actions.length > 0 && React.createElement(
      Box,
      { flexDirection: 'column', marginTop: 1 },
      ...actions.map((action, i) =>
        React.createElement(
          Text,
          { key: i, color: THEME.primary },
          '› ' + action
        )
      )
    ),
  );
}

// Tab-specific empty states
export const EMPTY_STATES = {
  Feed: {
    title: 'No Activity Yet',
    message: 'Agent activity will appear here',
    actions: ['Wait for agents to start working'],
    icon: '📡',
  },
  Chat: {
    title: 'No Messages',
    message: 'Chat with agents here',
    actions: ['Type a message to start'],
    icon: '💬',
  },
  Agents: {
    title: 'No Agents',
    message: 'Create agents to get started',
    actions: ['Run: sparkcell new'],
    icon: '🤖',
  },
  Tasks: {
    title: 'No Tasks',
    message: 'Tasks will appear as agents work',
    actions: ['Check Feed for activity'],
    icon: '📋',
  },
  Skills: {
    title: 'No Skills Yet',
    message: 'Agent skills appear here',
    actions: ['Skills develop as agents work'],
    icon: '⚡',
  },
  Pause: {
    title: 'Pause Room',
    message: 'Paused agents appear here',
    actions: ['Press Ctrl+P to pause/resume'],
    icon: '⏸',
  },
  Tools: {
    title: 'No Tools',
    message: 'Install tools to extend capabilities',
    actions: ['Run: sparkcell tool list'],
    icon: '🔧',
  },
};

export default EmptyState;