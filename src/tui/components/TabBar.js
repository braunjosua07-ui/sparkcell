import React from 'react';
import { Box, Text } from 'ink';

export function TabBar({ tabs, active, onSelect }) {
  return React.createElement(Box, { borderStyle: 'single', borderColor: 'gray', paddingX: 1, gap: 1 },
    ...tabs.map((tab, i) => {
      const isActive = tab === active;
      // Special visual treatment for key tabs
      const isCoreTab = ['Feed', 'Chat', 'Agents'].includes(tab);
      const isSkillTab = tab === 'Skills';

      return React.createElement(Text, {
        key: tab,
        bold: isActive,
        inverse: isActive,
        color: isActive ? (isSkillTab ? 'magenta' : 'cyan') : 'gray',
        ...(isCoreTab && !isActive && { dim: true }),
      }, ` ${i + 1}:${tab} `);
    })
  );
}
