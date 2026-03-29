import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import { useFeed } from '../hooks/useFeed.js';
import { THEME } from '../../cli/colors.js';

// Ink-compatible colors
const COLORS = {
  user: 'green',
  agent: 'magenta',
  system: 'gray',
  error: 'red',
  success: 'green',
  timestamp: 'gray',
  border: 'cyan',
};

// Format timestamp for messages
function formatTime(date) {
  if (!date) return '';
  const d = new Date(date);
  return d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

// Format relative time
function formatRelative(date) {
  if (!date) return 'just now';
  const diff = Date.now() - date;
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

/**
 * ChatView — User can interact with agents during runtime.
 *
 * Commands:
 *   @all <message>       — Send message to all agents
 *   @<agentId> <message> — Send message to specific agent
 *   /pause <agentId>     — Pause specific agent
 *   /resume <agentId>    — Resume specific agent
 *   /assign <agentId> <task> — Assign a task to an agent
 *   /resolve <blockerId> — Resolve a blocker
 *   /status              — Show team status
 */
export function ChatView({ sparkCell }) {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([
    { type: 'system', text: 'Chat bereit. Befehle: @all, @<agent>, /assign, /tools, /allow, /deny, /status, /help' },
  ]);
  const entries = useFeed(sparkCell?.bus, 20);
  const subscribedRef = useRef(false);
  const prevSparkCellRef = useRef(null);
  const [maskedInput, setMaskedInput] = useState(null); // { platform } when active

  const addMessage = useCallback((msg) => {
    setMessages(prev => {
      const next = [...prev, msg];
      return next.length > 50 ? next.slice(-50) : next;
    });
  }, []);

  // Listen for agent chat responses on the bus
  useEffect(() => {
    // Reset subscription if sparkCell changed
    if (sparkCell !== prevSparkCellRef.current) {
      subscribedRef.current = false;
      prevSparkCellRef.current = sparkCell;
    }

    if (!sparkCell?.bus || subscribedRef.current) return;
    subscribedRef.current = true;

    sparkCell.bus.subscribe('agent:chat-response', (data) => {
      addMessage({
        type: 'response',
        agent: data.agentName || data.agentId,
        text: data.response?.slice(0, 500) || '...',
      });
    });

    // Also show when agents start working on user tasks
    sparkCell.bus.subscribe('agent:thinking', (data) => {
      addMessage({
        type: 'system',
        text: `${data.agentName} denkt nach...`,
      });
    });

    // Show errors
    sparkCell.bus.subscribe('agent:error', (data) => {
      addMessage({
        type: 'error',
        text: `${data.agentName}: Fehler — ${data.error}`,
      });
    });

    // Masked input mode for credential entry
    sparkCell.bus.subscribe('credential:input-requested', (data) => {
      setMaskedInput({ platform: data.platform });
    });

    // Show permission requests
    sparkCell.bus.subscribe('tool:permission-requested', (data) => {
      const agent = data.agentName || data.agentId || '?';
      const argPreview = data.args ? JSON.stringify(data.args).slice(0, 80) : '';
      addMessage({
        type: 'system',
        text: `${agent} braucht Erlaubnis fuer "${data.toolName}": ${argPreview}`,
      });
      addMessage({
        type: 'system',
        text: `  /allow ${data.toolName} = immer erlauben | Timeout: 60s`,
      });
    });
  }, [sparkCell, addMessage]);

  const handleSubmit = useCallback((value) => {
    if (!value.trim()) return;
    setInput('');

    // Masked input mode: store credentials instead of normal processing
    if (maskedInput) {
      const { platform } = maskedInput;
      setMaskedInput(null);
      const [username, ...rest] = value.trim().split(':');
      const password = rest.join(':');
      if (!username || !password) {
        addMessage({ type: 'error', text: 'Format: username:password' });
        return;
      }
      if (!sparkCell.credentialStore) {
        addMessage({ type: 'error', text: 'Credential store not available' });
        return;
      }
      sparkCell.credentialStore.store(platform, { username, password }).then(() => {
        addMessage({ type: 'success', text: `Credentials fuer "${platform}" gespeichert.` });
      }).catch(err => {
        addMessage({ type: 'error', text: `Fehler: ${err.message}` });
      });
      return;
    }

    const text = value.trim();
    addMessage({ type: 'user', text });

    if (!sparkCell) {
      addMessage({ type: 'error', text: 'SparkCell nicht verbunden.' });
      return;
    }

    // Parse commands
    if (text.startsWith('/')) {
      handleCommand(text, sparkCell, addMessage);
    } else if (text.startsWith('@')) {
      handleMessage(text, sparkCell, addMessage);
    } else {
      // Default: send to all agents
      handleMessage(`@all ${text}`, sparkCell, addMessage);
    }
  }, [sparkCell, addMessage]);

  // Mix chat messages with recent agent responses
  const recentAgentOutputs = entries
    .filter(e => e.type === 'output' || e.type === 'blocker-added' || e.type === 'decision-added')
    .slice(-5);

  return React.createElement(Box, { flexDirection: 'column', height: '100%' },
    // Header with timestamp
    React.createElement(
      Box,
      { gap: 2, marginBottom: 1 },
      React.createElement(Text, { bold: true, color: COLORS.border }, '💬 Team Chat'),
      React.createElement(Text, { dimColor: true }, `— ${new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}`),
    ),

    // Messages area
    React.createElement(Box, { flexDirection: 'column', flexGrow: 1 },
      ...messages.slice(-15).map((msg, i) => {
        const timestamp = msg.timestamp ? formatRelative(msg.timestamp) : '';
        const timeStr = timestamp ? `[${timestamp}] ` : '';

        switch (msg.type) {
          case 'user':
            return React.createElement(Box, { key: `m-${i}`, gap: 1 },
              React.createElement(Text, { dimColor: true }, timeStr),
              React.createElement(Text, { color: COLORS.user, bold: true }, 'Du:'),
              React.createElement(Text, { wrap: 'truncate' }, msg.text),
            );
          case 'system':
            return React.createElement(Box, { key: `m-${i}` },
              React.createElement(Text, { dimColor: true }, `  ${timeStr}${msg.text}`),
            );
          case 'response':
            return React.createElement(Box, { key: `m-${i}`, gap: 1 },
              React.createElement(Text, { dimColor: true }, timeStr),
              React.createElement(Text, { color: COLORS.agent, bold: true }, `${msg.agent}:`),
              React.createElement(Text, { wrap: 'truncate' }, msg.text),
            );
          case 'error':
            return React.createElement(Box, { key: `m-${i}` },
              React.createElement(Text, { color: COLORS.error }, `  ${timeStr}${msg.text}`),
            );
          case 'success':
            return React.createElement(Box, { key: `m-${i}` },
              React.createElement(Text, { color: COLORS.success }, `  ${timeStr}${msg.text}`),
            );
          default:
            return React.createElement(Box, { key: `m-${i}` },
              React.createElement(Text, null, `  ${timeStr}${msg.text}`),
            );
        }
      }),

      // Show recent agent activity with timestamps
      recentAgentOutputs.length > 0
        ? React.createElement(Box, { flexDirection: 'column', marginTop: 1, borderStyle: 'single', borderColor: COLORS.border, paddingX: 1 },
            React.createElement(Text, { dimColor: true, bold: true }, '📨 Letzte Aktivitaet'),
            ...recentAgentOutputs.map((e, i) => {
              const time = formatRelative(e.timestamp);
              return React.createElement(Box, { key: `a-${i}`, gap: 1 },
                React.createElement(Text, { dimColor: true }, `[${time}]`.padEnd(8)),
                React.createElement(Text, { color: 'blue', bold: true }, `${e.agentName || '?'}:`),
                React.createElement(Text, { dimColor: true, wrap: 'truncate' },
                  e.type === 'output' ? (e.preview?.slice(0, 60) || '...')
                  : e.type === 'blocker-added' ? `⛔ ${e.blocker}`
                  : `⚖ ${e.decision}`
                ),
              );
            }),
          )
        : null,
    ),

    // Input area
    React.createElement(Box, { borderStyle: 'single', borderColor: COLORS.border, paddingX: 1 },
      React.createElement(Text, { color: COLORS.border }, '> '),
      React.createElement(TextInput, {
        value: input,
        onChange: setInput,
        onSubmit: handleSubmit,
        placeholder: maskedInput ? 'username:password (maskiert)' : '@agent Nachricht oder /befehl...',
        mask: maskedInput ? '*' : undefined,
      }),
    ),
  );
}

function handleCommand(text, sparkCell, addMessage) {
  const parts = text.slice(1).split(/\s+/);
  const cmd = parts[0].toLowerCase();

  switch (cmd) {
    case 'status': {
      const status = sparkCell.getStatus();
      addMessage({ type: 'system', text: `Startup: ${status.startup} | Running: ${status.running} | Paused: ${status.paused}` });
      for (const a of status.agents) {
        const task = a.currentTask ? ` -> ${a.currentTask.title}` : '';
        addMessage({ type: 'system', text: `  ${a.name} [${a.state}] E:${Math.round(a.energy)}%${task}` });
      }
      break;
    }
    case 'pause': {
      const agentId = parts[1];
      if (!agentId) {
        sparkCell.togglePause();
        addMessage({ type: 'success', text: 'Simulation pausiert/fortgesetzt.' });
      } else {
        const agent = sparkCell.getAgent(agentId);
        if (agent) {
          agent.stateMachine.transition('forcePause');
          addMessage({ type: 'success', text: `${agent.name} pausiert.` });
        } else {
          addMessage({ type: 'error', text: `Agent "${agentId}" nicht gefunden.` });
        }
      }
      break;
    }
    case 'resume': {
      const agentId = parts[1];
      if (agentId) {
        const agent = sparkCell.getAgent(agentId);
        if (agent) {
          agent.stateMachine.transition('energyRestored');
          addMessage({ type: 'success', text: `${agent.name} fortgesetzt.` });
        } else {
          addMessage({ type: 'error', text: `Agent "${agentId}" nicht gefunden.` });
        }
      }
      break;
    }
    case 'assign': {
      const agentId = parts[1];
      const taskTitle = parts.slice(2).join(' ');
      if (!agentId || !taskTitle) {
        addMessage({ type: 'error', text: 'Benutzung: /assign <agentId> <task-beschreibung>' });
        break;
      }
      const agent = sparkCell.getAgent(agentId);
      if (agent) {
        agent.assignTask({
          id: `user-${Date.now()}`,
          title: taskTitle,
          description: `Vom User zugewiesen: ${taskTitle}`,
          priority: 'high',
          source: 'user',
        });
        addMessage({ type: 'success', text: `Task "${taskTitle}" an ${agent.name} zugewiesen.` });
      } else {
        addMessage({ type: 'error', text: `Agent "${agentId}" nicht gefunden.` });
      }
      break;
    }
    case 'resolve': {
      const blockerId = parts[1];
      if (!blockerId) {
        addMessage({ type: 'error', text: 'Benutzung: /resolve <blocker-id>' });
        break;
      }
      const wb = sparkCell.whiteboard;
      if (wb) {
        wb.resolveBlocker(blockerId);
        addMessage({ type: 'success', text: `Blocker ${blockerId} resolved.` });
      }
      break;
    }
    case 'blockers': {
      const wb = sparkCell.whiteboard;
      if (wb) {
        const state = wb.getState();
        const open = state.blockers.filter(b => !b.resolved);
        if (open.length === 0) {
          addMessage({ type: 'system', text: 'Keine offenen Blocker.' });
        } else {
          for (const b of open) {
            addMessage({ type: 'system', text: `  ${b.id} [${b.agentId}]: ${b.blocker}` });
          }
        }
      }
      break;
    }
    case 'tools': {
      const tr = sparkCell.toolRunner;
      if (!tr) {
        addMessage({ type: 'error', text: 'ToolRunner nicht verfuegbar.' });
        break;
      }
      const filter = parts[1] || 'all';
      const names = tr.getToolNames();
      const count = tr.getToolCount();
      addMessage({ type: 'system', text: `Tools: ${count.total} gesamt (${count.core} core, ${count.custom} custom)` });
      const filtered = names.filter(n => {
        if (filter === 'custom') return tr.isCustomTool(n);
        if (filter === 'core') return !tr.isCustomTool(n);
        return true;
      });
      for (const name of filtered) {
        const perm = tr.permissions.getRule(name);
        const tag = tr.isCustomTool(name) ? ' [custom]' : '';
        addMessage({ type: 'system', text: `  ${name} (${perm})${tag}` });
      }
      break;
    }
    case 'allow': {
      const toolName = parts[1];
      if (!toolName) {
        addMessage({ type: 'error', text: 'Benutzung: /allow <tool-name>' });
        break;
      }
      const tr = sparkCell.toolRunner;
      if (!tr) { addMessage({ type: 'error', text: 'ToolRunner nicht verfuegbar.' }); break; }
      tr.permissions.setRule(toolName, 'auto');
      // Also grant any pending approval
      sparkCell.bus.publish('tool:permission-granted', { actionKey: `*:${toolName}`, toolName });
      addMessage({ type: 'success', text: `Tool "${toolName}" auf auto gesetzt.` });
      break;
    }
    case 'deny': {
      const toolName = parts[1];
      if (!toolName) {
        addMessage({ type: 'error', text: 'Benutzung: /deny <tool-name>' });
        break;
      }
      const tr = sparkCell.toolRunner;
      if (!tr) { addMessage({ type: 'error', text: 'ToolRunner nicht verfuegbar.' }); break; }
      tr.permissions.setRule(toolName, 'deny');
      addMessage({ type: 'success', text: `Tool "${toolName}" gesperrt.` });
      break;
    }
    case 'account': {
      const action = parts[1]?.toLowerCase();
      const platform = parts[2]?.toLowerCase();
      const cs = sparkCell.credentialStore;
      if (!cs) {
        addMessage({ type: 'error', text: 'CredentialStore nicht verfuegbar.' });
        break;
      }
      if (action === 'add') {
        if (!platform) {
          addMessage({ type: 'error', text: 'Benutzung: /account add <platform>' });
          break;
        }
        // Publish event to trigger masked input mode
        sparkCell.bus.publish('credential:input-requested', { platform });
        addMessage({ type: 'system', text: `Credentials fuer "${platform}" eingeben:` });
        addMessage({ type: 'system', text: '  Format: username:password' });
        addMessage({ type: 'system', text: '  (Eingabe wird nicht im Chat angezeigt)' });
        break;
      }
      if (action === 'revoke') {
        if (!platform) {
          addMessage({ type: 'error', text: 'Benutzung: /account revoke <platform>' });
          break;
        }
        cs.revoke(platform).then(deleted => {
          if (deleted) addMessage({ type: 'success', text: `Credentials fuer "${platform}" geloescht.` });
          else addMessage({ type: 'error', text: `Keine Credentials fuer "${platform}" gefunden.` });
        });
        break;
      }
      addMessage({ type: 'error', text: 'Benutzung: /account add|revoke <platform>' });
      break;
    }
    case 'accounts': {
      const cs = sparkCell.credentialStore;
      if (!cs) {
        addMessage({ type: 'error', text: 'CredentialStore nicht verfuegbar.' });
        break;
      }
      const platforms = cs.listPlatforms();
      if (platforms.length === 0) {
        addMessage({ type: 'system', text: 'Keine gespeicherten Accounts.' });
      } else {
        addMessage({ type: 'system', text: `${platforms.length} Account(s):` });
        for (const p of platforms) {
          addMessage({ type: 'system', text: `  ${p.platform} (User: ${p.hasUsername ? 'ja' : 'nein'}) — gespeichert: ${p.storedAt}` });
        }
      }
      break;
    }
    case 'help': {
      addMessage({ type: 'system', text: 'Befehle:' });
      addMessage({ type: 'system', text: '  @all <msg>         — Nachricht ans ganze Team' });
      addMessage({ type: 'system', text: '  @<agent> <msg>     — Nachricht an einen Agent' });
      addMessage({ type: 'system', text: '  /status            — Team-Status anzeigen' });
      addMessage({ type: 'system', text: '  /assign <id> <task> — Task zuweisen' });
      addMessage({ type: 'system', text: '  /tools [core|custom] — Tools auflisten' });
      addMessage({ type: 'system', text: '  /allow <tool>      — Tool erlauben (auto)' });
      addMessage({ type: 'system', text: '  /deny <tool>       — Tool sperren' });
      addMessage({ type: 'system', text: '  /account add <plattform> — Zugangsdaten hinzufuegen' });
      addMessage({ type: 'system', text: '  /accounts          — Gespeicherte Accounts' });
      addMessage({ type: 'system', text: '  /account revoke <plattform> — Zugang loeschen' });
      addMessage({ type: 'system', text: '  /blockers          — Offene Blocker zeigen' });
      addMessage({ type: 'system', text: '  /resolve <id>      — Blocker loesen' });
      addMessage({ type: 'system', text: '  /pause [agent]     — Pausieren' });
      addMessage({ type: 'system', text: '  /resume <agent>    — Fortsetzen' });
      break;
    }
    default:
      addMessage({ type: 'error', text: `Unbekannter Befehl: /${cmd}. Tippe /help` });
  }
}

function handleMessage(text, sparkCell, addMessage) {
  const match = text.match(/^@(\S+)\s+(.*)/s);
  if (!match) {
    addMessage({ type: 'error', text: 'Format: @agent Nachricht oder @all Nachricht' });
    return;
  }

  const target = match[1].toLowerCase();
  const message = match[2];

  // Publish user message on bus so agents can pick it up
  sparkCell.bus.publish('user:message', {
    target,
    message,
    timestamp: Date.now(),
  });

  const conversationId = `conv-${Date.now()}`;

  if (target === 'all') {
    // Assign as task to all agents
    for (const agent of sparkCell.agents) {
      agent.assignTask({
        id: `user-msg-${Date.now()}-${agent.id}`,
        title: `User-Anweisung: ${message.slice(0, 60)}`,
        description: `Der User hat folgende Anweisung gegeben: "${message}". Reagiere darauf und liefere ein Ergebnis.`,
        priority: 'high',
        source: 'user',
        conversationId,
      });
    }
    addMessage({ type: 'success', text: `Nachricht an alle ${sparkCell.agents.length} Agents gesendet.` });
  } else {
    const agent = sparkCell.getAgent(target);
    if (agent) {
      agent.assignTask({
        id: `user-msg-${Date.now()}`,
        title: `User-Anweisung: ${message.slice(0, 60)}`,
        description: `Der User hat dir folgende Anweisung gegeben: "${message}". Reagiere darauf und liefere ein Ergebnis.`,
        priority: 'high',
        source: 'user',
        conversationId,
      });
      addMessage({ type: 'success', text: `Nachricht an ${agent.name} gesendet.` });
    } else {
      addMessage({ type: 'error', text: `Agent "${target}" nicht gefunden. Verfuegbar: ${sparkCell.agents.map(a => a.id).join(', ')}` });
    }
  }
}
