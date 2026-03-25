import React from 'react';
import { Box, Text } from 'ink';
import { useFeed } from '../hooks/useFeed.js';

const EVENT_ICONS = {
  'state-change': '\u25CF',  // ●
  'task-started': '\u25B6',  // ▶
  'task-completed': '\u2714', // ✔
  'thinking': '\u2026',      // …
  'output': '\u2709',        // ✉
  'error': '\u2718',         // ✘
  'energy-low': '\u26A0',    // ⚠
  'blocker-added': '\u26D4', // ⛔
  'decision-added': '\u2696', // ⚖
  'skill-evaluation': '\u2B50', // ⭐
  'chat-response': '\u{1F4AC}', // 💬
  'tool-executed': '\u{1F528}', // 🔨
  'tool-created': '\u2B50',    // ⭐
  'tool-permission-requested': '\u{1F512}', // 🔒
  'tool-permission-granted': '\u{1F511}',   // 🔑
  'tool-failed': '\u2718',     // ✘
  'notification': '\u{1F514}',  // 🔔
  'email-sent': '\u2709',      // ✉
  'slack-sent': '\u{1F4E8}',   // 📨
  'discord-sent': '\u{1F4E8}', // 📨
};

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

function formatTime(ts) {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
}

function formatEvent(entry) {
  const name = entry.agentName || entry.agentId || '?';
  switch (entry.type) {
    case 'state-change':
      return `${name}: ${entry.from || '?'} -> ${entry.to || '?'}`;
    case 'task-started':
      return `${name} startet: ${entry.task?.title || 'Aufgabe'}`;
    case 'task-completed':
      return `${name} fertig: ${entry.task?.title || 'Aufgabe'}`;
    case 'thinking':
      return `${name} denkt nach... (${entry.task || ''})`;
    case 'output':
      return `${name}: ${entry.preview || 'Output generiert'}`;
    case 'error':
      return `${name} Fehler: ${entry.error || 'unbekannt'}`;
    case 'energy-low':
      return `${name} Energie niedrig (${entry.energy}%)`;
    case 'blocker-added':
      return `BLOCKER von ${name}: ${entry.blocker || '?'}`;
    case 'decision-added':
      return `DECISION von ${name}: ${entry.decision || '?'}`;
    case 'skill-evaluation': {
      const pct = ((entry.score || 0) * 100).toFixed(0);
      const training = entry.needsTraining ? ' -> Training gestartet' : '';
      return `${name} Skill "${entry.skill}": ${pct}%${training}`;
    }
    case 'chat-response':
      return `${name} antwortet: ${(entry.response || '').slice(0, 80)}`;
    case 'tool-executed': {
      const status = entry.success ? 'ok' : 'fehlgeschlagen';
      return `${name} -> ${entry.toolName || '?'}: ${status}`;
    }
    case 'tool-created':
      return `${name} erstellt Tool: ${entry.toolName || '?'}`;
    case 'tool-permission-requested':
      return `${name} braucht Erlaubnis fuer: ${entry.toolName || '?'}`;
    case 'tool-permission-granted':
      return `Erlaubnis erteilt: ${entry.actionKey || '?'}`;
    case 'tool-failed':
      return `${name} Tool-Fehler: ${entry.toolName || '?'} — ${entry.error || ''}`;
    case 'notification':
      return `${name}: [${entry.priority || 'medium'}] ${entry.message || ''}`;
    case 'email-sent':
      return `${name} Email an ${entry.to || '?'}: ${entry.subject || ''}`;
    case 'slack-sent':
      return `${name} Slack: ${entry.preview || ''}`;
    case 'discord-sent':
      return `${name} Discord: ${entry.preview || ''}`;
    default:
      return `${name}: ${entry.type}`;
  }
}

export function FeedView({ sparkCell }) {
  const entries = useFeed(sparkCell?.bus, 50);

  if (entries.length === 0) {
    return React.createElement(Box, { flexDirection: 'column', padding: 1 },
      React.createElement(Text, { bold: true, color: 'cyan' }, 'Live Feed'),
      React.createElement(Text, null, ''),
      React.createElement(Text, { dimColor: true }, 'Warte auf Events...'),
      React.createElement(Text, { dimColor: true }, 'Die Agents starten gleich mit der Arbeit.'),
    );
  }

  const visible = entries.slice(-20);

  return React.createElement(Box, { flexDirection: 'column' },
    React.createElement(Text, { bold: true, color: 'cyan' }, `Live Feed (${entries.length} Events)`),
    React.createElement(Text, null, ''),
    ...visible.map((entry, i) => {
      const icon = EVENT_ICONS[entry.type] || '\u2022';
      const color = EVENT_COLORS[entry.type] || 'white';
      const time = formatTime(entry.timestamp);
      return React.createElement(Box, { key: i, gap: 1 },
        React.createElement(Text, { dimColor: true }, time),
        React.createElement(Text, { color }, icon),
        React.createElement(Text, { color, wrap: 'truncate' }, formatEvent(entry)),
      );
    }),
  );
}
