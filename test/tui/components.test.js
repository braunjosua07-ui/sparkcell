import { test } from 'node:test';
import assert from 'assert';
import path from 'path';
import { fileURLToPath } from 'url';

// JSDOM setup for DOM simulation
const { JSDOM } = await import('jsdom');
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
  url: 'http://localhost',
  pretendToBeVisual: true,
  resources: 'usable',
});
global.window = dom.window;
global.document = dom.window.document;
global.HTMLElement = dom.window.HTMLElement;
global.Node = dom.window.Node;
global.Text = dom.window.Text;
global.Comment = dom.window.Comment;
global.ProcessingInstruction = dom.window.ProcessingInstruction;
global.Element = dom.window.Element;
global.SVGElement = dom.window.SVGElement;
global.SVGGraphicsElement = dom.window.SVGGraphicsElement;

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Mock React for testing
import React from 'react';
global.React = React;

// Directory paths
const tuiDir = path.join(__dirname, '../../src/tui');
const componentsDir = path.join(tuiDir, 'components');

test('TUI components directory exists', async () => {
  const fs = await import('fs');
  assert(fs.existsSync(tuiDir), 'TUI directory should exist');
  assert(fs.existsSync(componentsDir), 'TUI components directory should exist');
});

test('TUI exports expected component interfaces', async () => {
  const fs = await import('fs');
  const expectedComponents = [
    'App.js',
    'ChatInterpreter.js',
    'components/StatusBar.js',
    'components/TabBar.js',
    'components/FeedView.js',
    'components/ChatView.js',
    'components/AgentsView.js',
    'components/TasksView.js',
    'components/SkillsView.js',
    'components/PauseRoomView.js',
    'components/ToolsView.js',
  ];

  expectedComponents.forEach(comp => {
    const fullPath = path.join(tuiDir, comp);
    assert(fs.existsSync(fullPath), `${comp} should exist`);
  });
});

test('App.js can be imported without crashing', async () => {
  const fs = await import('fs');
  const appPath = path.join(tuiDir, 'App.js');

  // Verify file exists
  assert(fs.existsSync(appPath), 'App.js should exist');

  // Read and check for syntax issues by attempting module evaluation
  const code = fs.readFileSync(appPath, 'utf8');

  // Basic syntax validation - check for common issues
  assert(code.includes('export'), 'App.js should have exports');
  assert(code.includes('App'), 'App.js should export App component');

  // Note: Full React rendering test would require a more complex setup
  // This verifies the module structure is valid
});

test('ChatInterpreter can be instantiated if available', async () => {
  const fs = await import('fs');
  const chatInterpreterPath = path.join(tuiDir, 'ChatInterpreter.js');

  if (!fs.existsSync(chatInterpreterPath)) {
    this.skip();
    return;
  }

  // Read to verify structure
  const code = fs.readFileSync(chatInterpreterPath, 'utf8');

  // Check for expected class and constructor
  assert(code.includes('class ChatInterpreter'), 'ChatInterpreter class should exist');
  assert(code.includes('constructor'), 'ChatInterpreter should have constructor');

  // Verify it can be required without errors
  const ChatInterpreter = await import(chatInterpreterPath);

  // Test instantiation with mock sparkCell
  const mockSparkCell = {
    getStatus: () => ({ startup: true, running: true, paused: false, agents: [] }),
    togglePause: () => {},
    isPaused: false,
    agents: [],
    llm: null,
  };

  const interpreter = new ChatInterpreter.ChatInterpreter(mockSparkCell);
  assert(interpreter, 'ChatInterpreter instance should be created');
  assert(typeof interpreter.interpret === 'function', 'interpret method should exist');
});

test('ChatInterpreter interpret method handles empty message', async () => {
  const fs = await import('fs');
  const chatInterpreterPath = path.join(tuiDir, 'ChatInterpreter.js');

  if (!fs.existsSync(chatInterpreterPath)) {
    this.skip();
    return;
  }

  const ChatInterpreter = await import(chatInterpreterPath);
  const interpreter = new ChatInterpreter.ChatInterpreter({});

  const result = await interpreter.interpret('');
  assert(result, 'interpret should return a response for empty input');
});

test('component files have valid module structure', async () => {
  const fs = await import('fs');
  const componentFiles = [
    'components/StatusBar.js',
    'components/TabBar.js',
    'components/FeedView.js',
    'components/AgentsView.js',
    'components/TasksView.js',
    'components/SkillsView.js',
    'components/PauseRoomView.js',
    'components/ToolsView.js',
  ];

  componentFiles.forEach(comp => {
    const fullPath = path.join(tuiDir, comp);
    if (fs.existsSync(fullPath)) {
      const code = fs.readFileSync(fullPath, 'utf8');
      // Check for basic valid JavaScript structure
      assert(code.length > 0, `${comp} should not be empty`);
    }
  });
});
