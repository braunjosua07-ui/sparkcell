import React from 'react';
import { Box, Text } from 'ink';

export function SkillsView({ sparkCell }) {
  const agents = sparkCell?.agents || [];

  return React.createElement(Box, { flexDirection: 'column', padding: 1 },
    React.createElement(Text, { bold: true }, 'Team Skill Matrix'),
    agents.length === 0
      ? React.createElement(Text, { dimColor: true }, 'No agents loaded')
      : React.createElement(Box, { flexDirection: 'column', marginTop: 1 },
          ...agents.map(agent => {
            const skills = agent.skills.getSkills();
            return React.createElement(Box, { key: agent.id, gap: 1 },
              React.createElement(Text, { bold: true, color: 'cyan' }, `${agent.name}: `.padEnd(15)),
              ...Array.from(skills.entries()).map(([name, data]) =>
                React.createElement(Text, { key: name, color: data.level > 50 ? 'green' : data.level > 25 ? 'yellow' : 'white' },
                  `${name}(${Math.round(data.level)}) `
                )
              )
            );
          })
        )
  );
}
