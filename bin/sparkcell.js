#!/usr/bin/env node
import { program } from 'commander';
import { render } from 'ink';
import React from 'react';
import { GlobalConfig } from '../src/config/GlobalConfig.js';
import { SparkCell } from '../src/index.js';
import { App } from '../src/tui/App.js';
import { StartupSelector } from '../src/wizard/StartupSelector.js';
import paths from '../src/utils/paths.js';
import fs from 'node:fs/promises';
import path from 'node:path';

program
  .name('sparkcell')
  .description('Multi-Agent Startup Simulation Platform')
  .version('2.0.0');

program
  .command('start [name]')
  .description('Start a startup simulation')
  .action(async (name) => {
    const config = new GlobalConfig(paths.config());
    await config.load();
    if (config.needsSetup()) {
      console.log('First-time setup required. Run: sparkcell config');
      return;
    }
    const startupName = name || await selectStartup();
    if (!startupName) { console.log('No startup selected.'); return; }
    const sc = new SparkCell(startupName, config.data);
    await sc.initialize();
    render(React.createElement(App, { sparkCell: sc }));
    await sc.start();
  });

program
  .command('new')
  .description('Create a new startup')
  .action(async () => {
    console.log('Use: sparkcell new <name> — Interactive wizard coming soon.');
  });

program
  .command('list')
  .description('List all startups')
  .action(async () => {
    const selector = new StartupSelector();
    const startups = await selector.listStartups();
    if (startups.length === 0) {
      console.log('No startups found. Create one with: sparkcell new');
      return;
    }
    console.log('Available startups:');
    for (const s of startups) {
      console.log(`  ${s.name} — ${s.displayName} (${s.agentCount} agents)`);
    }
  });

program
  .command('config')
  .description('Edit global settings')
  .action(async () => {
    const configPath = paths.config();
    console.log(`Config file: ${configPath}`);
    const config = new GlobalConfig(configPath);
    await config.load();
    console.log(JSON.stringify(config.data, null, 2));
  });

program
  .command('export [name]')
  .description('Export startup documents')
  .action(async (name) => {
    if (!name) { console.log('Usage: sparkcell export <startup-name>'); return; }
    const outputDir = paths.output(name);
    try {
      const files = await fs.readdir(path.join(outputDir, 'docs'));
      console.log(`Exported ${files.length} documents from ${name}`);
      for (const f of files) console.log(`  ${f}`);
    } catch {
      console.log(`No output found for startup: ${name}`);
    }
  });

// Default: show startup selector or help
program.action(async () => {
  const config = new GlobalConfig(paths.config());
  await config.load();
  if (config.needsSetup()) {
    console.log('Welcome to SparkCell! Run "sparkcell config" to set up your LLM provider.');
  } else {
    const selector = new StartupSelector();
    const has = await selector.hasStartups();
    if (has) {
      console.log('Run "sparkcell start" to begin or "sparkcell list" to see your startups.');
    } else {
      console.log('No startups yet. Run "sparkcell new" to create one.');
    }
  }
});

async function selectStartup() {
  const selector = new StartupSelector();
  const startups = await selector.listStartups();
  if (startups.length === 0) return null;
  if (startups.length === 1) return startups[0].name;
  console.log('Available startups:');
  startups.forEach((s, i) => console.log(`  ${i + 1}. ${s.displayName}`));
  return startups[0].name; // Default to first
}

program.parse();
