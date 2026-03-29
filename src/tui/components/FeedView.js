// src/tui/components/FeedView.js
// Premium Activity Feed with Theme Colors and Relative Timestamps

import React from 'react';
import { Box, Text } from 'ink';
import { useFeed } from '../hooks/useFeed.js';
import { THEME } from '../../cli/colors.js';

// Event icons
const EVENT_ICONS = {
  'state-change': '●',
  'task-started': '▶',
  'task-completed': '✓',
  'thinking': '…',
  'output': '✉',
  'error': '✗',
  'energy-low': '⚠',
  'blocker-added': '⛔',
  'decision-added': '⚖',
  'skill-evaluation': '⭐',
  'skill-upgrade': '⚡',
  'soul-evolution': '❤',
  'chat-response': '💬',
  'tool-executed': '🔨',
  'tool-created': '⭐',
  'tool-permission-requested': '🔒',
  'tool-permission-granted': '🔑',
  'tool-failed': '✗',
  'notification': '🔔',
  'email-sent': '✉',
  'slack-sent': '📨',
  'discord-sent': '📨',
};

// Event colors (Ink color names)
const EVENT_COLORS = {
  'state-change': 'cyan',
  'task-started': 'yellow',
  'task-completed': 'green',
  'thinking': 'blue',
  'output': 'magenta',
  'error': 'red',
  'energy-low': 'yellow',
  'blocker-added': 'red',
  'decision-added': 'green',
  'skill-evaluation': 'yellow',
  'skill-upgrade': 'green',
  'soul-evolution': 'magenta',
  'chat-response': 'cyan',
  'tool-executed': 'blue',
  'tool-created': 'green',
  'tool-permission-requested': 'yellow',
  'tool-permission-granted': 'green',
  'tool-failed': 'red',
  'notification': 'yellow',
  'email-sent': 'magenta',
  'slack-sent': 'magenta',
  'discord-sent': 'magenta',
};

// Relative time formatting
function formatRelativeTime(ts) {
  if (!ts) return '';
  const now = Date.now();
  const diff = now - new Date(ts).getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (seconds < 10) return 'just now';
  if (seconds < 60) return `${seconds}s`;
  if (minutes < 60) return `${minutes}m`;
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

// Absolute time formatting (for hover/details)
function formatAbsoluteTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
}

// Format event text
function formatEvent(entry) {
  const name = entry.agentName || entry.agentId || '?';
  switch (entry.type) {
    case 'state-change':
      return `${name}: ${entry.from || '?'} → ${entry.to || '?'}`;
    case 'task-started':
      return `${name} starting: ${entry.task?.title || 'Task'}`;
    case 'task-completed':
      return `${name} done: ${entry.task?.title || 'Task'}`;
    case 'thinking':
      return `${name} thinking... (${entry.task || ''})`;
    case 'output':
      return `${name}: ${entry.preview || 'Output generated'}`;
    case 'error':
      return `${name} error: ${entry.error || 'unknown'}`;
    case 'energy-low':
      return `${name} low energy (${entry.energy}%)`;
    case 'blocker-added':
      return `BLOCKER from ${name}: ${entry.blocker || '?'}`;
    case 'decision-added':
      return `DECISION by ${name}: ${entry.decision || '?'}`;
    case 'skill-evaluation': {
      const pct = ((entry.score || 0) * 100).toFixed(0);
      const training = entry.needsTraining ? ' → training started' : '';
      return `${name} skill "${entry.skill}": ${pct}%${training}`;
    }
    case 'skill-upgrade': {
      const level = entry.level || 0;
      const prevLevel = entry.prevLevel || 0;
      return `${name} skill "${entry.skill}" leveled: ${prevLevel} → ${level} ${level >= 70 ? '❤ SOUL' : ''}`;
    }
    case 'soul-evolution': {
      const soulScore = entry.soulScore || entry.newSoulScore || 0;
      const changes = entry.changes || entry.personalityChanges || {};
      const changeStr = Object.keys(changes).length > 0
        ? ` (${Object.entries(changes).map(([k, v]) => `${k} ${v > 0 ? '+' : ''}${v}`).join(', ')})`
        : '';
      const milestone = soulScore >= 70 ? '❤ SOUL-CHARGE' : soulScore >= 40 ? '♥ Soul evolved' : '♡ Soul emerged';
      return `${name}: ${milestone} (${soulScore}%${changeStr})`;
    }
    case 'chat-response':
      return `${name}: ${(entry.response || '').slice(0, 80)}`;
    case 'tool-executed': {
      const status = entry.success ? '✓' : '✗';
      return `${name} → ${entry.toolName || '?'}: ${status}`;
    }
    case 'tool-created':
      return `${name} created: ${entry.toolName || '?'}`;
    case 'tool-permission-requested':
      return `${name} needs permission: ${entry.toolName || '?'}`;
    case 'tool-permission-granted':
      return `Permission granted: ${entry.actionKey || '?'}`;
    case 'tool-failed':
      return `${name} tool failed: ${entry.toolName || '?'} — ${entry.error || ''}`;
    case 'notification':
      return `${name}: [${entry.priority || 'medium'}] ${entry.message || ''}`;
    case 'email-sent':
      return `${name} email to ${entry.to || '?'}: ${entry.subject || ''}`;
    case 'slack-sent':
      return `${name} Slack: ${entry.preview || ''}`;
    case 'discord-sent':
      return `${name} Discord: ${entry.preview || ''}`;
    default:
      return `${name}: ${entry.type}`;
  }
}

// Empty state component
function EmptyState() {
  return React.createElement(
    Box,
    { flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 2 },
    React.createElement(Text, { color: 'gray' }, '📡'),
    React.createElement(Text, { color: 'gray', bold: true }, 'No Activity Yet'),
    React.createElement(Text, { color: 'gray' }, 'Agent activity will appear here'),
    React.createElement(
      Box,
      { flexDirection: 'column', marginTop: 1 },
      React.createElement(Text, { color: 'cyan' }, '› Wait for agents to start working'),
      React.createElement(Text, { color: 'cyan' }, '› Check agent status in Agents tab'),
    ),
  );
}

export function FeedView({ sparkCell }) {
  const entries = useFeed(sparkCell?.bus, 50);

  // Empty state
  if (entries.length === 0) {
    return React.createElement(EmptyState);
  }

  const visible = entries.slice(-25); // Show last 25 events

  return React.createElement(
    Box,
    { flexDirection: 'column' },
    // Header
    React.createElement(
      Box,
      { gap: 2, marginBottom: 1 },
      React.createElement(Text, { bold: true, color: 'cyan' }, `Live Feed (${entries.length})`),
      React.createElement(Text, { dimColor: true }, '— Real-time activity'),
    ),

    // Legend
    React.createElement(
      Box,
      { gap: 2, marginBottom: 1, paddingX: 1 },
      React.createElement(Text, { dimColor: true }, '❤ Soul'),
      React.createElement(Text, { dimColor: true }, '⚡ Skills'),
      React.createElement(Text, { dimColor: true }, '✓ Tasks'),
      React.createElement(Text, { dimColor: true }, '✉ Output'),
    ),

    // Events
    ...visible.map((entry, i) => {
      const icon = EVENT_ICONS[entry.type] || '•';
      const color = EVENT_COLORS[entry.type] || 'white';
      const time = formatRelativeTime(entry.timestamp);
      const isSpecial = entry.type === 'soul-evolution' || entry.type === 'skill-upgrade';

      return React.createElement(
        Box,
        { key: i, gap: 1, marginBottom: 0.5 },
        React.createElement(Text, { dimColor: true }, `[${time}]`.padEnd(8)),
        React.createElement(Text, { color, bold: isSpecial }, icon),
        React.createElement(
          Text,
          { color: isSpecial ? color : 'white', wrap: 'truncate-end' },
          formatEvent(entry),
        ),
      );
    }),
  );
}