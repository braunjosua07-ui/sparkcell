import React from 'react';
import { Box, Text } from 'ink';

function formatLevel(level) {
  const filled = Math.round(level / 10);
  const empty = 10 - filled;
  return '\u2588'.repeat(filled) + '\u2591'.repeat(empty);
}

function getSkillColor(level) {
  if (level >= 70) return 'green';
  if (level >= 40) return 'yellow';
  return 'white';
}

export function SkillsView({ sparkCell }) {
  const agents = sparkCell?.agents || [];
  const globalSkills = new Map();

  // Collect all skills from all agents to show team matrix
  for (const agent of agents) {
    const agentSkills = agent.skills?.getSkills?.() || new Map();
    for (const [name, data] of agentSkills) {
      if (!globalSkills.has(name)) {
        globalSkills.set(name, { agents: [], levels: [], avg: 0 });
      }
      globalSkills.get(name).agents.push(agent.name);
      globalSkills.get(name).levels.push(data.level);
    }
  }

  // Calculate averages for each skill
  const skillStats = [];
  for (const [name, data] of globalSkills) {
    const avg = Math.round(data.levels.reduce((a, b) => a + b, 0) / data.levels.length);
    skillStats.push({ name, avg, agents: data.agents });
  }

  // Sort by average level
  skillStats.sort((a, b) => b.avg - a.avg);

  return React.createElement(Box, { flexDirection: 'column', padding: 1 },
    // Header
    React.createElement(Box, { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 1 },
      React.createElement(Text, { bold: true, color: 'cyan' }, '\u2699 Team Skills'),
      React.createElement(Text, { dimColor: true }, 'Alle Agenten \u2014 Universelle F\u00e4higkeiten'),
    ),

    // Team skill matrix header
    React.createElement(Box, { marginBottom: 1 },
      React.createElement(Text, { dimColor: true, fontSize: 11 }, 'Skill'.padEnd(12)),
      React.createElement(Text, { dimColor: true, fontSize: 11 }, 'Level'.padStart(5)),
      React.createElement(Text, { dimColor: true, fontSize: 11 }, 'Team' + ' '.repeat(12)),
    ),
    React.createElement(Box, { marginBottom: 1 },
      React.createElement(Text, { dimColor: true, fontSize: 11 }, ' '.repeat(12) + '\u2500'.repeat(50)),
    ),

    // Skill list
    skillStats.length === 0
      ? React.createElement(Text, { dimColor: true, marginTop: 1 }, 'Keine Skills erlernt')
      : skillStats.map((skill, i) => {
          const color = getSkillColor(skill.avg);
          return React.createElement(Box, { key: skill.name, gap: 2, marginTop: 0.5 },
            React.createElement(Text, { color: color, bold: skill.avg >= 50 }, skill.name.padEnd(12)),
            React.createElement(Text, { color: color }, `${skill.avg}% ${formatLevel(skill.avg)}`.padStart(10)),
            React.createElement(Text, { dimColor: true, fontSize: 10 },
              skill.agents.slice(0, 2).join(', ') + (skill.agents.length > 2 ? '...' : '')
            ),
          );
        }),

    // Legend
    React.createElement(Box, { marginTop: 2, paddingY: 1, borderStyle: 'single', borderColor: 'gray' },
      React.createElement(Text, { dimColor: true, fontSize: 10 }, 'Legend: '),
      React.createElement(Text, { color: 'green', fontSize: 10 }, '\u2588\u2588\u2588 Experte'),
      React.createElement(Text, { color: 'yellow', fontSize: 10 }, '  \u2588\u2588 \u2591\u2591 Medium'),
      React.createElement(Text, { color: 'white', fontSize: 10 }, '    \u2591\u2591\u2591 \u2591\u2591 Beginner'),
    ),
  );
}
