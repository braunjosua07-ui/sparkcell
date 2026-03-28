import React, { useState, useCallback, createContext, useContext } from 'react';
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
import { ToastContainer, useToast } from './components/Toast.js';
import { THEME, ANSI } from '../cli/colors.js';

// Toast Context for app-wide access
const ToastContext = createContext(null);

export function useToastContext() {
  return useContext(ToastContext);
}

// Error Boundary Component
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    if (this.props.onError) this.props.onError(error, info);
  }

  render() {
    if (this.state.error) {
      return React.createElement(Box, { flexDirection: 'column', padding: 1 },
        React.createElement(Text, { color: 'red', bold: true }, '⚠ Error in Display'),
        React.createElement(Text, { color: 'red' }, this.state.error.message),
        React.createElement(Text, { dimColor: true }, 'Press Ctrl+Q to quit, or switch tabs.'),
      );
    }
    return this.props.children;
  }
}

// Help Overlay Component
function HelpOverlay({ onClose }) {
  const shortcuts = [
    { key: '1-7', action: 'Switch between tabs' },
    { key: '2', action: 'Open Chat view' },
    { key: '7', action: 'Open Tools view' },
    { key: 'Ctrl+P', action: 'Pause/Resume simulation' },
    { key: 'Ctrl+Q', action: 'Quit SparkCell' },
    { key: '?', action: 'Show/hide this help' },
  ];

  return React.createElement(
    Box,
    {
      flexDirection: 'column',
      position: 'absolute',
      top: 2,
      left: 2,
      right: 2,
      bottom: 2,
      borderStyle: 'round',
      borderColor: THEME.primary,
      padding: 2,
    },
    React.createElement(Text, { bold: true, color: THEME.primary }, '⌨  Keyboard Shortcuts'),
    React.createElement(Text, { dimColor: true }, ''),
    ...shortcuts.map(({ key, action }) =>
      React.createElement(
        Box,
        { key: key },
        React.createElement(Text, { color: THEME.primary, bold: true }, key.padEnd(10)),
        React.createElement(Text, null, action)
      )
    ),
    React.createElement(Text, { dimColor: true }, ''),
    React.createElement(Text, { dimColor: true }, 'Press any key to close'),
  );
}

// Empty State Component
export function EmptyState({ title, message, actions = [], icon = '○' }) {
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
        React.createElement(
          Text,
          { key: i, color: THEME.primary },
          '› ' + action
        )
      )
    ),
  );
}

// Main Tabs
const TABS = ['Feed', 'Chat', 'Agents', 'Tasks', 'Skills', 'Pause', 'Tools'];

// Tab-specific empty states
const EMPTY_STATES = {
  Feed: {
    title: 'No Activity Yet',
    message: 'Agent activity will appear here',
    actions: ['Wait for agents to start working'],
    icon: '📡',
  },
  Chat: {
    title: 'No Messages',
    message: 'Chat with agents here',
    actions: ['Type a message to start'],
    icon: '💬',
  },
  Agents: {
    title: 'No Agents',
    message: 'Create agents to get started',
    actions: ['Run: sparkcell new'],
    icon: '🤖',
  },
  Tasks: {
    title: 'No Tasks',
    message: 'Tasks will appear as agents work',
    actions: ['Check Feed for activity'],
    icon: '📋',
  },
  Skills: {
    title: 'No Skills Yet',
    message: 'Agent skills appear here',
    actions: ['Skills develop as agents work'],
    icon: '⚡',
  },
  Pause: {
    title: 'Pause Room',
    message: 'Paused agents appear here',
    actions: ['Press Ctrl+P to pause/resume'],
    icon: '⏸',
  },
  Tools: {
    title: 'No Tools',
    message: 'Install tools to extend capabilities',
    actions: ['Run: sparkcell tool list'],
    icon: '🔧',
  },
};

export function App({ sparkCell }) {
  const [activeTab, setActiveTab] = useState('Feed');
  const [showHelp, setShowHelp] = useState(false);
  const { exit } = useApp();
  const toast = useToast();

  // Keyboard input handler
  useInput((input, key) => {
    // Toggle help on '?'
    if (input === '?') {
      setShowHelp(prev => !prev);
      return;
    }

    // Close help on any key
    if (showHelp) {
      setShowHelp(false);
      return;
    }

    // Quit
    if (key.ctrl && input === 'q') {
      sparkCell?.shutdown?.().then(() => exit());
      return;
    }

    // Pause
    if (key.ctrl && input === 'p') {
      sparkCell?.togglePause?.();
      return;
    }

    // Tab switching
    const tabIndex = parseInt(input) - 1;
    if (tabIndex >= 0 && tabIndex < TABS.length) {
      setActiveTab(TABS[tabIndex]);
    }
  });

  // View props with toast support
  const viewProps = { sparkCell };

  // Views map
  const views = {
    Feed: React.createElement(FeedView, viewProps),
    Chat: React.createElement(ChatView, viewProps),
    Agents: React.createElement(AgentsView, viewProps),
    Tasks: React.createElement(TasksView, viewProps),
    Skills: React.createElement(SkillsView, viewProps),
    Pause: React.createElement(PauseRoomView, viewProps),
    Tools: React.createElement(ToolsView, viewProps),
  };

  // Keyboard shortcuts for footer
  const shortcuts = '1-7: Tabs | ?: Help | Ctrl+P: Pause | Ctrl+Q: Quit';

  return React.createElement(
    ToastContext.Provider,
    { value: toast },
    React.createElement(
      Box,
      { flexDirection: 'column', height: '100%' },
      // Status bar
      React.createElement(StatusBar, { sparkCell }),

      // Main content area
      React.createElement(
        Box,
        { flexGrow: 1, flexDirection: 'column' },
        // Tab bar
        React.createElement(TabBar, { tabs: TABS, active: activeTab, onSelect: setActiveTab }),

        // Active view
        React.createElement(
          Box,
          { flexGrow: 1, padding: 1 },
          React.createElement(
            ErrorBoundary,
            { key: activeTab },
            views[activeTab] || null
          )
        ),
      ),

      // Footer with shortcuts
      React.createElement(
        Box,
        { paddingX: 1, borderStyle: 'single', borderColor: THEME.borderDim || 'gray' },
        React.createElement(Text, { dimColor: true }, shortcuts),
      ),

      // Toast notifications
      React.createElement(ToastContainer, { toasts: toast.toasts, onDismiss: toast.removeToast }),

      // Help overlay (shown on '?')
      showHelp && React.createElement(HelpOverlay, { onClose: () => setShowHelp(false) }),
    )
  );
}

export { THEME, ANSI, EMPTY_STATES };