// src/tui/components/AgentsView.js
// Premium Agent Cards with Big Five Personality, Skills, and Energy

import React from 'react';
import { Box, Text } from 'ink';
import { THEME, ANSI } from '../../cli/colors.js';

// Empty state component
function EmptyState({ title, message, actions = [], icon = '○' }) {
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
        React.createElement(Text, { key: i, color: THEME.primary }, '› ' + action)
      )
    ),
  );
}

// State colors using theme
const STATE_STYLES = {
  IDLE: { color: THEME.textMuted, icon: '○', label: 'Idle' },
  WORKING: { color: THEME.primary, icon: '●', label: 'Working' },
  BLOCKED: { color: THEME.warning, icon: '!', label: 'Blocked' },
  PAUSED: { color: THEME.secondary, icon: '‖', label: 'Paused' },
  HELP: { color: THEME.error, icon: '?', label: 'Help' },
  COMPLETE: { color: THEME.success, icon: '✓', label: 'Complete' },
  RESTED: { color: THEME.info, icon: '☾', label: 'Rested' },
};

// Role colors for visual distinction
const ROLE_COLORS = {
  'strategic-lead': THEME.roles?.ceo || THEME.primary,
  'implementer': THEME.roles?.tech || THEME.info,
  'product': THEME.roles?.product || THEME.warning,
  'designer': THEME.roles?.designer || THEME.secondary,
  'marketing': THEME.roles?.marketing || THEME.success,
};

// Energy bar visualization
function energyBar(energy, width = 10) {
  const filled = Math.round(energy / (100 / width));
  const empty = width - filled;

  // Color based on energy level
  let color;
  if (energy > 70) color = THEME.energy.high;
  else if (energy > 30) color = THEME.energy.medium;
  else color = THEME.energy.low;

  return {
    bar: '█'.repeat(filled) + '░'.repeat(empty),
    color,
    percent: energy + '%',
  };
}

// Soul score badge
function soulBadge(score) {
  if (score >= 70) return { text: '❤ SOUL', color: THEME.error, glow: true };
  if (score >= 40) return { text: '♥ soul', color: THEME.secondary, glow: false };
  return { text: '♡ soul', color: THEME.textMuted, glow: false };
}

// Big Five personality description
function personalityDescription(traits) {
  if (!traits) return '';
  const { openness, conscientiousness, extraversion, agreeableness, neuroticism } = traits;
  const emotional = 100 - neuroticism;

  const parts = [];

  // Openness: creativity vs tradition
  if (openness >= 70) parts.push('creative');
  else if (openness <= 30) parts.push('traditional');
  else parts.push('balanced');

  // Conscientiousness: organized vs flexible
  if (conscientiousness >= 75) parts.push('organized');
  else if (conscientiousness <= 25) parts.push('flexible');
  else parts.push('structured');

  // Extraversion: social vs reserved
  if (extraversion >= 75) parts.push('social');
  else if (extraversion <= 25) parts.push('reserved');
  else parts.push('adaptable');

  // Agreeableness: cooperative vs independent
  if (agreeableness >= 75) parts.push('cooperative');
  else if (agreeableness <= 25) parts.push('independent');
  else parts.push('harmonious');

  // Emotional stability
  if (emotional >= 75) parts.push('stable');
  else if (emotional <= 25) parts.push('sensitive');
  else parts.push('expressive');

  return parts.join(' · ');
}

// Skill level visualization
function skillBar(level, width = 8) {
  const filled = Math.round(level / (100 / width));
  const empty = width - filled;

  let color;
  if (level >= 70) color = THEME.skills.expert;
  else if (level >= 50) color = THEME.skills.intermediate;
  else color = THEME.skills.beginner;

  return { bar: '▓'.repeat(filled) + '░'.repeat(empty), color, level };
}

export function AgentsView({ sparkCell }) {
  const agents = sparkCell?.agents || [];

  // Empty state
  if (agents.length === 0) {
    return React.createElement(EmptyState, {
      title: 'No Agents',
      message: 'Create agents to get started',
      actions: ['Run: sparkcell new', 'Check startup configuration'],
      icon: '🤖',
    });
  }

  return React.createElement(
    Box,
    { flexDirection: 'column' },
    // Header
    React.createElement(
      Box,
      { flexDirection: 'row', gap: 2, marginBottom: 1 },
      React.createElement(Text, { bold: true, color: THEME.primary }, `Agents (${agents.length})`),
      React.createElement(Text, { dimColor: true }, '— Personality & Skill Matrix'),
    ),
    // Agent cards
    ...agents.map(agent => {
      const stateStyle = STATE_STYLES[agent.state] || STATE_STYLES.IDLE;
      const roleColor = ROLE_COLORS[agent.role] || THEME.primary;
      const eBar = energyBar(agent.energy || 0);
      const soulScore = agent.soulScore || agent.personalitySoulScore || 0;
      const soul = soulBadge(soulScore);
      const personality = personalityDescription(agent.personalityTraits);

      // Get top skills
      const skills = Array.from(agent.skills?.getSkills?.()?.entries?.() || []);
      const topSkills = skills
        .sort((a, b) => b[1].level - a[1].level)
        .slice(0, 3);

      return React.createElement(
        Box,
        {
          key: agent.id,
          borderStyle: soul.glow ? 'double' : 'round',
          borderColor: soul.color,
          paddingX: 1,
          marginBottom: 1,
          flexDirection: 'column',
        },
        // Row 1: Name, Role, State, Soul
        React.createElement(
          Box,
          { gap: 2 },
          React.createElement(Text, { bold: true, color: roleColor }, agent.name),
          React.createElement(Text, { dimColor: true }, `(${agent.role})`),
          React.createElement(Text, { color: stateStyle.color }, `${stateStyle.icon} ${stateStyle.label}`),
          React.createElement(Text, { color: soul.color }, `${soul.text} ${soulScore}%`),
        ),

        // Row 2: Personality
        personality && React.createElement(
          Box,
          { marginTop: 0.5 },
          React.createElement(Text, { dimColor: true }, 'Personality: '),
          React.createElement(Text, { color: soul.color }, personality),
        ),

        // Row 3: Energy Bar
        React.createElement(
          Box,
          { gap: 1 },
          React.createElement(Text, null, 'Energy: '),
          React.createElement(Text, { color: eBar.color }, eBar.bar),
          React.createElement(Text, { dimColor: true }, eBar.percent),
        ),

        // Row 4: Skills
        topSkills.length > 0 && React.createElement(
          Box,
          { gap: 2 },
          React.createElement(Text, { dimColor: true }, 'Skills:'),
          ...topSkills.map(([name, data], i) => {
            const sb = skillBar(data.level);
            return React.createElement(
              Text,
              { key: i, color: sb.color },
              `${name} ${sb.bar} ${data.level}`,
            );
          }),
        ),

        // Row 5: Task or Queue
        agent.currentTask
          ? React.createElement(
              Box,
              { marginTop: 0.5 },
              React.createElement(Text, { dimColor: true }, 'Task: '),
              React.createElement(Text, null, agent.currentTask.title || 'Working...'),
            )
          : React.createElement(
              Text,
              { dimColor: true },
              `Queue: ${agent.queueLength || 0} tasks · Cycles: ${agent.cycleCount || 0}`,
            ),
      );
    }),
  );
}