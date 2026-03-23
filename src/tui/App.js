import React, { useState } from 'react';
import { Box, useInput, useApp } from 'ink';
import { StatusBar } from './components/StatusBar.js';
import { TabBar } from './components/TabBar.js';

const TABS = ['Feed', 'Agents', 'Tasks', 'Skills', 'Pause'];

export function App({ sparkCell }) {
  const [activeTab, setActiveTab] = useState('Feed');
  const [focusChat, setFocusChat] = useState(false);
  const { exit } = useApp();

  useInput((input, key) => {
    if (key.ctrl && input === 'q') { sparkCell?.shutdown?.().then(() => exit()); }
    if (key.ctrl && input === 'p') { sparkCell?.togglePause?.(); }
    if (key.tab) { setFocusChat(f => !f); }
    if (key.escape) { setFocusChat(false); }
    const tabIndex = parseInt(input) - 1;
    if (tabIndex >= 0 && tabIndex < TABS.length && !focusChat) {
      setActiveTab(TABS[tabIndex]);
    }
  });

  return React.createElement(Box, { flexDirection: 'column', height: '100%' },
    React.createElement(StatusBar, { sparkCell }),
    React.createElement(Box, { flexGrow: 1 },
      React.createElement(Box, { flexDirection: 'column', flexGrow: 1 },
        React.createElement(TabBar, { tabs: TABS, active: activeTab, onSelect: setActiveTab }),
        React.createElement(Box, { flexGrow: 1, padding: 1 },
          React.createElement(Box, null, `[${activeTab} View]`)
        )
      )
    )
  );
}
