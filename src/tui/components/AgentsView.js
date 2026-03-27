import React from 'react';
import { Box, Text } from 'ink';

const STATE_COLORS = {
  IDLE: 'gray',
  WORKING: 'green',
  BLOCKED: 'red',
  PAUSED: 'yellow',
  HELP: 'magenta',
  COMPLETE: 'cyan',
  RESTED: 'blue',
};

const STATE_ICONS = {
  IDLE: '\u25CB',     // ○
  WORKING: '\u25CF',  // ●
  BLOCKED: '\u2718',  // ✘
  PAUSED: '\u2016',   // ‖
  HELP: '\u2753',     // ❓
  COMPLETE: '\u2714', // ✔
  RESTED: '\u263E',   // ☾
};

function energyBar(energy) {
  const filled = Math.round(energy / 10);
  const empty = 10 - filled;
  return '\u2588'.repeat(filled) + '\u2591'.repeat(empty);
}

function soulBadge(soulScore) {
  if (soulScore >= 70) return { text: '\u2764 SOUL', color: 'red', glow: true };
  if (soulScore >= 40) return { text: '\u2665 soul', color: 'magenta', glow: false };
  return { text: '\u2613 soul', color: 'gray', glow: false };
}

function personalityDescription(traits) {
  if (!traits) return '';
  const { openness, conscientiousness, extraversion, agreeableness, neuroticism } = traits;
  const neuroScore = 100 - neuroticism;

  const parts = [];
  if (openness >= 70) parts.push('kreativ');
  else if (openness <= 30) parts.push('konservativ');
  else parts.push('ausgewogen');

  if (conscientiousness >= 75) parts.push('gewissenhaft');
  else if (conscientiousness <= 25) parts.push('flexibel');
  else parts.push('strukturiert');

  if (extraversion >= 75) parts.push('gesellig');
  else if (extraversion <= 25) parts.push('zurückhaltend');
  else parts.push('sozial');

  if (agreeableness >= 75) parts.push('mitfühlend');
  else if (agreeableness <= 25) parts.push('selbstbewusst');
  else parts.push('harmonie');

  if (neuroScore >= 75) parts.push('stabil');
  else if (neuroScore <= 25) parts.push('empfindlich');
  else parts.push('emotional');

  return parts.join(', ');
}

export function AgentsView({ sparkCell }) {
  const agents = sparkCell?.agents || [];

  if (agents.length === 0) {
    return React.createElement(Box, { padding: 1 },
      React.createElement(Text, { dimColor: true }, 'Keine Agents geladen'),
    );
  }

  return React.createElement(Box, { flexDirection: 'column' },
    React.createElement(Box, { flexDirection: 'row', gap: 2, marginBottom: 1 },
      React.createElement(Text, { bold: true, color: 'cyan' }, `Agents (${agents.length})`),
      React.createElement(Text, { dimColor: true }, '\u2014 Pers\u00f6nlichkeit & Skill Matrix'),
    ),
    ...agents.map(a => {
      const stateColor = STATE_COLORS[a.state] || 'white';
      const icon = STATE_ICONS[a.state] || '?';
      const eColor = a.energy > 60 ? 'green' : a.energy > 30 ? 'yellow' : 'red';

      // Use actual soul score from agent status if available
      const soulScore = a.soulScore || a.personalitySoulScore || 0;
      const soulBadgeData = soulBadge(soulScore);

      // Get personality from agent status (if available)
      const personalityDesc = a.personality || personalityDescription(a.personalityTraits);
      const personalityColor = soulScore >= 70 ? 'red' : soulScore >= 40 ? 'magenta' : 'white';

      // Get top skills
      const skills = Array.from(a.skills?.getSkills?.().entries() || []);
      const topSkills = skills
        .sort((a, b) => b[1].level - a[1].level)
        .slice(0, 3)
        .map(([name, data]) => `${name}:${data.level}`)
        .join(' ');

      return React.createElement(Box, {
        key: a.id,
        borderStyle: soulBadgeData.glow ? 'double' : 'round',
        borderColor: soulBadgeData.color,
        paddingX: 1,
        marginBottom: 1,
        flexDirection: 'column',
      },
        // Header: Name, Role, State
        React.createElement(Box, { gap: 2 },
          React.createElement(Text, { bold: true, color: 'cyan' }, a.name),
          React.createElement(Text, { dimColor: true }, `(${a.role})`),
          React.createElement(Text, { color: stateColor }, `${icon} ${a.state}`),
          React.createElement(Text, { color: soulBadgeData.color }, `${soulBadgeData.text} ${soulScore}%`),
        ),

        // Personality traits line
        personalityDesc ? React.createElement(Box, { marginTop: 0.5 },
          React.createElement(Text, { dimColor: true }, 'Persönlichkeit: '),
          React.createElement(Text, { color: personalityColor }, personalityDesc),
        ) : null,

        // Energy Bar
        React.createElement(Box, { gap: 1 },
          React.createElement(Text, null, 'Energie: '),
          React.createElement(Text, { color: eColor }, `${energyBar(a.energy)} ${a.energy}%`),
        ),

        // Skills Display (Top 3 skills with levels)
        React.createElement(Box, { marginTop: 1 },
          React.createElement(Text, { dimColor: true }, 'Skills: '),
          ...topSkills.split(' ').map((skill, i) => {
            const [name, level] = skill.split(':');
            const skillColor = level > 50 ? 'green' : level > 25 ? 'yellow' : 'white';
            return React.createElement(Text, {
              key: i,
              color: skillColor,
              bold: level > 50
            }, `${name}:${level}  `);
          }),
        ),

        // Current Task or Queue Info
        a.currentTask
          ? React.createElement(Text, { color: 'white' }, `Task: ${a.currentTask.title || 'Arbeitet...'}`)
          : React.createElement(Text, { dimColor: true }, `Queue: ${a.queueLength || 0} | Cycles: ${a.cycleCount || 0}`),

        // Memory Tier Status
        memoryStats.total > 0 ? React.createElement(Box, { marginTop: 0.5 },
          React.createElement(Text, { dimColor: true, fontSize: 10 },
            `Memory: \u2605 ${memoryStats.hot} / \u2606 ${memoryStats.warm} / \u26AB ${memoryStats.cold || 0}`
          ),
        ) : null,
      );
    }),
  );
}
