import React, { useState } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import { StatusBar } from './components/StatusBar.js';
import { TabBar } from './components/TabBar.js';
import { FeedView } from './components/FeedView.js';
import { AgentsView } from './components/AgentsView.js';
import { TasksView } from './components/TasksView.js';
import { SkillsView } from './components/SkillsView.js';
import { PauseRoomView } from './components/PauseRoomView.js';
import { ChatView } from './components/ChatView.js';
import { ToolsView } from './components/ToolsView.js';

const TABS = ['Feed', 'Chat', 'Agents', 'Tasks', 'Skills', 'Pause', 'Tools'];

export function App({ sparkCell }) {
  const [activeTab, setActiveTab] = useState('Feed');
  const { exit } = useApp();

  useInput((input, key) => {
    if (key.ctrl && input === 'q') { sparkCell?.shutdown?.().then(() => exit()); }
    if (key.ctrl && input === 'p') { sparkCell?.togglePause?.(); }
    const tabIndex = parseInt(input) - 1;
    if (tabIndex >= 0 && tabIndex < TABS.length) {
      setActiveTab(TABS[tabIndex]);
    }
  });

  const viewProps = { sparkCell };
  const views = {
    Feed: React.createElement(FeedView, viewProps),
    Chat: React.createElement(ChatView, viewProps),
    Agents: React.createElement(AgentsView, viewProps),
    Tasks: React.createElement(TasksView, viewProps),
    Skills: React.createElement(SkillsView, viewProps),
    Pause: React.createElement(PauseRoomView, viewProps),
    Tools: React.createElement(ToolsView, viewProps),
  };

  return React.createElement(Box, { flexDirection: 'column', height: '100%' },
    React.createElement(StatusBar, { sparkCell }),
    React.createElement(Box, { flexGrow: 1, flexDirection: 'column' },
      React.createElement(TabBar, { tabs: TABS, active: activeTab, onSelect: setActiveTab }),
      React.createElement(Box, { flexGrow: 1, padding: 1 },
        views[activeTab] || null,
      ),
    ),
    React.createElement(Box, { paddingX: 1, borderStyle: 'single', borderColor: 'gray' },
      React.createElement(Text, { dimColor: true }, '1-7: Tabs  |  2: Chat  |  7: Tools  |  Ctrl+P: Pause  |  Ctrl+Q: Quit'),
    ),
  );
}
