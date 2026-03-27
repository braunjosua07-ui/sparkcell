import React from 'react';
import { Box, Text } from 'ink';
import { useToolStatus } from '../hooks/useToolStatus.js';

const TYPE_ICONS = {
  executed: '\u{1F528}',   // hammer
  created: '\u2B50',       // star
  failed: '\u2718',        // x
  disabled: '\u26D4',      // no entry
};

const TYPE_COLORS = {
  executed: 'blue',
  created: 'green',
  failed: 'red',
  disabled: 'red',
};

function formatTime(ts) {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
}

function formatAction(action) {
  const agent = action.agentName || action.agentId || '?';
  switch (action.type) {
    case 'executed': {
      const status = action.success ? 'ok' : 'FEHLER';
      const detail = action.args
        ? Object.values(action.args).filter(v => typeof v === 'string').slice(0, 1).join('').slice(0, 40)
        : '';
      return `${agent.padEnd(16)} ${(action.toolName || '?').padEnd(13)} ${detail.padEnd(42)} ${status}`;
    }
    case 'created':
      return `${agent} erstellt: ${action.toolName} — ${action.description || ''}`;
    case 'failed':
      return `${agent} ${action.toolName}: ${action.error || 'Fehler'}`;
    case 'disabled':
      return `Tool ${action.toolName} deaktiviert: ${action.reason || ''}`;
    default:
      return `${agent}: ${action.type}`;
  }
}

export function ToolsView({ sparkCell }) {
  const { actions, pendingApprovals, toolCount } = useToolStatus(
    sparkCell?.bus,
    sparkCell?.toolRunner,
  );

  return React.createElement(Box, { flexDirection: 'column' },
    // Header
    React.createElement(Text, { bold: true, color: 'cyan' },
      `Tools (${toolCount.total} verfuegbar, ${toolCount.custom} custom)`
    ),
    React.createElement(Text, null, ''),

    // Recent actions
    React.createElement(Text, { bold: true }, '  Letzte Aktionen:'),
    actions.length === 0
      ? React.createElement(Text, { dimColor: true }, '  Noch keine Tool-Aktionen.')
      : React.createElement(Box, { flexDirection: 'column' },
          ...actions.slice(-15).map((action, i) => {
            const icon = TYPE_ICONS[action.type] || '\u2022';
            const color = TYPE_COLORS[action.type] || 'white';
            const time = formatTime(action.timestamp);
            return React.createElement(Box, { key: i, gap: 1 },
              React.createElement(Text, { dimColor: true }, `  ${time}`),
              React.createElement(Text, { color }, icon),
              React.createElement(Text, { color, wrap: 'truncate' }, formatAction(action)),
            );
          }),
        ),

    // Pending approvals
    pendingApprovals.length > 0
      ? React.createElement(Box, { flexDirection: 'column', marginTop: 1 },
          React.createElement(Text, { bold: true, color: 'yellow' }, '  Warte auf Bestaetigung:'),
          ...pendingApprovals.map((p, i) => {
            const agent = p.agentName || p.agentId || '?';
            const argPreview = p.args
              ? JSON.stringify(p.args).slice(0, 60)
              : '';
            return React.createElement(Box, { key: `p-${i}`, flexDirection: 'column' },
              React.createElement(Text, { color: 'yellow' },
                `  > ${agent} will ${p.toolName} ausfuehren: ${argPreview}`
              ),
              React.createElement(Text, { dimColor: true },
                `    Erlaube via Chat: /allow ${p.toolName}`
              ),
            );
          }),
        )
      : null,
  );
}
