import React, { useState, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import { useFeed } from '../hooks/useFeed.js';

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
    { type: 'system', text: 'Chat bereit. Befehle: @all, @<agent>, /assign, /resolve, /status, /pause, /resume' },
  ]);
  const entries = useFeed(sparkCell?.bus, 20);

  const addMessage = useCallback((msg) => {
    setMessages(prev => {
      const next = [...prev, msg];
      return next.length > 50 ? next.slice(-50) : next;
    });
  }, []);

  const handleSubmit = useCallback((value) => {
    if (!value.trim()) return;
    setInput('');

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
    React.createElement(Text, { bold: true, color: 'cyan' }, 'Team Chat'),
    React.createElement(Text, null, ''),

    // Messages area
    React.createElement(Box, { flexDirection: 'column', flexGrow: 1 },
      ...messages.slice(-15).map((msg, i) => {
        switch (msg.type) {
          case 'user':
            return React.createElement(Box, { key: `m-${i}`, gap: 1 },
              React.createElement(Text, { color: 'green', bold: true }, 'Du:'),
              React.createElement(Text, { wrap: 'truncate' }, msg.text),
            );
          case 'system':
            return React.createElement(Box, { key: `m-${i}` },
              React.createElement(Text, { dimColor: true }, `  ${msg.text}`),
            );
          case 'response':
            return React.createElement(Box, { key: `m-${i}`, gap: 1 },
              React.createElement(Text, { color: 'magenta', bold: true }, `${msg.agent}:`),
              React.createElement(Text, { wrap: 'truncate' }, msg.text),
            );
          case 'error':
            return React.createElement(Box, { key: `m-${i}` },
              React.createElement(Text, { color: 'red' }, `  ${msg.text}`),
            );
          case 'success':
            return React.createElement(Box, { key: `m-${i}` },
              React.createElement(Text, { color: 'green' }, `  ${msg.text}`),
            );
          default:
            return React.createElement(Box, { key: `m-${i}` },
              React.createElement(Text, null, `  ${msg.text}`),
            );
        }
      }),

      // Show recent agent activity
      recentAgentOutputs.length > 0
        ? React.createElement(Box, { flexDirection: 'column', marginTop: 1 },
            React.createElement(Text, { dimColor: true }, '--- Letzte Agent-Aktivitaet ---'),
            ...recentAgentOutputs.map((e, i) =>
              React.createElement(Box, { key: `a-${i}`, gap: 1 },
                React.createElement(Text, { color: 'blue' }, `${e.agentName || '?'}:`),
                React.createElement(Text, { dimColor: true, wrap: 'truncate' },
                  e.type === 'output' ? (e.preview?.slice(0, 80) || '...')
                  : e.type === 'blocker-added' ? `BLOCKER: ${e.blocker}`
                  : `DECISION: ${e.decision}`
                ),
              )
            ),
          )
        : null,
    ),

    // Input area
    React.createElement(Box, { borderStyle: 'single', borderColor: 'cyan', paddingX: 1 },
      React.createElement(Text, { color: 'cyan' }, '> '),
      React.createElement(TextInput, {
        value: input,
        onChange: setInput,
        onSubmit: handleSubmit,
        placeholder: '@agent Nachricht oder /befehl...',
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
    case 'help': {
      addMessage({ type: 'system', text: 'Befehle:' });
      addMessage({ type: 'system', text: '  @all <msg>         — Nachricht ans ganze Team' });
      addMessage({ type: 'system', text: '  @<agent> <msg>     — Nachricht an einen Agent' });
      addMessage({ type: 'system', text: '  /status            — Team-Status anzeigen' });
      addMessage({ type: 'system', text: '  /assign <id> <task> — Task zuweisen' });
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

  if (target === 'all') {
    // Assign as task to all agents
    for (const agent of sparkCell.agents) {
      agent.assignTask({
        id: `user-msg-${Date.now()}-${agent.id}`,
        title: `User-Anweisung: ${message.slice(0, 60)}`,
        description: `Der User hat folgende Anweisung gegeben: "${message}". Reagiere darauf und liefere ein Ergebnis.`,
        priority: 'high',
        source: 'user',
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
      });
      addMessage({ type: 'success', text: `Nachricht an ${agent.name} gesendet.` });
    } else {
      addMessage({ type: 'error', text: `Agent "${target}" nicht gefunden. Verfuegbar: ${sparkCell.agents.map(a => a.id).join(', ')}` });
    }
  }
}
