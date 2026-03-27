import React from 'react';
import { Box, Text } from 'ink';
import { useFeed } from '../hooks/useFeed.js';

const EVENT_ICONS = {
  'state-change': '\u25CF',        // ●
  'task-started': '\u25B6',       // ▶
  'task-completed': '\u2714',     // ✔
  'thinking': '\u2026',           // …
  'output': '\u2709',             // ✉
  'error': '\u2718',              // ✘
  'energy-low': '\u26A0',         // ⚠
  'blocker-added': '\u26D4',      // ⛔
  'decision-added': '\u2696',     // ⚖
  'skill-evaluation': '\u2B50',   // ⭐
  'skill-upgrade': '\u26A1',      // ⚡ (neu: Skill Upgrade)
  'soul-evolution': '\u2764',     // ❤ (neu: Agent Soul)
  'chat-response': '\u{1F4AC}',   // 💬
  'tool-executed': '\u{1F528}',   // 🔨
  'tool-created': '\u2B50',       // ⭐
  'tool-permission-requested': '\u{1F512}', // 🔒
  'tool-permission-granted': '\u{1F511}',   // 🔑
  'tool-failed': '\u2718',        // ✘
  'notification': '\u{1F514}',    // 🔔
  'email-sent': '\u2709',         // ✉
  'slack-sent': '\u{1F4E8}',      // 📨
  'discord-sent': '\u{1F4E8}',    // 📨
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
  'skill-upgrade': 'green',       // neuer Farbcode
  'soul-evolution': 'magenta',    // neuer Farbcode
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
    case 'skill-upgrade': {
      const level = entry.level || 0;
      const prevLevel = entry.prevLevel || 0;
      return `${name} Skill "${entry.skill}" erh\u00f6ht: ${prevLevel} -> ${level} ${level >= 70 ? '\u2764 SOUL' : ''}`;
    }
    case 'soul-evolution': {
      const soulScore = entry.soulScore || entry.newSoulScore || 0;
      const changes = entry.changes || entry.personalityChanges || {};
      const changeStr = Object.keys(changes).length > 0
        ? ` (${Object.entries(changes).map(([k,v]) => `${k} ${v > 0 ? '+' : ''}${v}`).join(', ')})`
        : '';
      const milestone = soulScore >= 70 ? '\u2764 SOUL-CHARGE' : soulScore >= 40 ? '\u2665 Soul gest\u00e4rkt' : '\u2613 Soul entstanden';
      return `${name}: ${milestone} (${soulScore}%${changeStr})`;
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

    // Header for special events
    React.createElement(Box, { gap: 2, marginBottom: 1, paddingX: 1, paddingY: 0.5, backgroundColor: '#1a1a1a', borderRadius: 4 },
      React.createElement(Text, { dimColor: true, fontSize: 10 }, '\u2764 Agent Soul  '),
      React.createElement(Text, { dimColor: true, fontSize: 10 }, '\u26A1 Skill Evolution  '),
      React.createElement(Text, { dimColor: true, fontSize: 10 }, '\u2714 Progress'),
    ),

    ...visible.map((entry, i) => {
      const icon = EVENT_ICONS[entry.type] || '\u2022';
      const color = EVENT_COLORS[entry.type] || 'white';
      const time = formatTime(entry.timestamp);

      // Highlight soul and skill events
      const isSpecial = entry.type === 'soul-evolution' || entry.type === 'skill-upgrade';
      const highlightStyle = isSpecial ? { bold: true, color: color, inverse: true } : { color };

      return React.createElement(Box, { key: i, gap: 1, marginBottom: 0.5 },
        React.createElement(Text, { dimColor: true }, time),
        React.createElement(Text, highlightStyle, icon),
        React.createElement(Text, { color: isSpecial ? color : 'white', wrap: 'truncate' }, formatEvent(entry)),
      );
    }),
  );
}
