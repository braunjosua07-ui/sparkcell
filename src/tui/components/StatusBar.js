// src/tui/components/StatusBar.js
// Premium Status Bar with Theme Colors and Animated Indicators

import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';

// Ink-compatible color names (mapping from THEME concepts)
const INK_COLORS = {
  primary: 'cyan',
  secondary: 'magenta',
  success: 'green',
  warning: 'yellow',
  error: 'red',
  info: 'blue',
  muted: 'gray',
  white: 'white',
};

// Animated spinner frames for working state
const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

export function StatusBar({ sparkCell }) {
  const status = sparkCell?.getStatus?.() || {};
  const uptime = status.uptime ? formatUptime(status.uptime) : '00:00:00';
  const agentCount = status.agents?.length || 0;
  const isPaused = status.paused;
  const rssMB = status.health?.rssMB || 0;
  const ramColor = rssMB >= 450 ? INK_COLORS.error : rssMB >= 300 ? INK_COLORS.warning : INK_COLORS.muted;

  // Animated spinner state
  const [spinnerFrame, setSpinnerFrame] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setSpinnerFrame(f => (f + 1) % SPINNER_FRAMES.length);
    }, 80);
    return () => clearInterval(timer);
  }, []);

  // Calculate average soul score from personality across all agents
  const avgSoulScore = agentCount > 0
    ? Math.round(status.agents.reduce((sum, a) => {
        return sum + (a.personalitySoulScore || a.soulScore || 0);
      }, 0) / agentCount)
    : 0;

  // Count agents by state
  const workingCount = status.agents?.filter(a => a.state === 'WORKING').length || 0;
  const idleCount = status.agents?.filter(a => a.state === 'IDLE').length || 0;
  const blockedCount = status.agents?.filter(a => a.state === 'BLOCKED').length || 0;

  // State indicator
  const stateIndicator = isPaused
    ? '⏸ PAUSED'
    : workingCount > 0
      ? `${SPINNER_FRAMES[spinnerFrame]} ${workingCount} working`
      : '○ idle';

  // Soul badge color based on score
  const soulColor = avgSoulScore >= 70 ? INK_COLORS.error
    : avgSoulScore >= 40 ? INK_COLORS.secondary
    : INK_COLORS.muted;

  // Border color based on soul
  const borderColor = avgSoulScore >= 50 ? INK_COLORS.secondary : INK_COLORS.primary;

  return React.createElement(
    Box,
    { borderStyle: 'double', borderColor, paddingX: 1 },
    // App name
    React.createElement(Text, { bold: true, color: INK_COLORS.primary }, 'SparkCell'),
    React.createElement(Text, null, ' | '),

    // Startup name
    React.createElement(Text, { color: INK_COLORS.success, bold: true }, status.startup || 'No startup'),
    React.createElement(Text, null, ' | '),

    // Agent count and state
    React.createElement(Text, { color: INK_COLORS.info }, `${agentCount} agents`),
    React.createElement(Text, null, ' | '),

    // Working/Idle indicator
    React.createElement(
      Text,
      { color: isPaused ? INK_COLORS.warning : workingCount > 0 ? INK_COLORS.success : INK_COLORS.muted },
      stateIndicator
    ),
    React.createElement(Text, null, ' | '),

    // Uptime
    React.createElement(Text, { dimColor: true }, uptime),
    React.createElement(Text, null, ' | '),

    // Soul score
    React.createElement(Text, { color: soulColor }, `❤ ${avgSoulScore}%`),
    React.createElement(Text, null, ' | '),

    // RAM indicator
    React.createElement(Text, { color: ramColor }, `RAM ${rssMB}MB`),

    // Spacer
    React.createElement(Box, { flexGrow: 1 }),

    // Shortcuts hint
    React.createElement(
      Text,
      { dimColor: true },
      '? help | Ctrl+Q quit'
    ),
  );
}

function formatUptime(ms) {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}