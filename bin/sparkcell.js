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
import { listTools, installTool, removeTool, enableTool, disableTool } from '../src/cli/tools.js';

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
      const { runSetup } = await import('../src/cli/setup.js');
      const ok = await runSetup();
      if (!ok) return;
      await config.load();
    }
    const startupName = name || await selectStartup();
    if (!startupName) {
      const { info } = await import('../src/cli/prompt.js');
      info('Kein Startup gefunden. Erstelle eins mit: sparkcell new');
      return;
    }
    async function main() {
      try {
        const sc = new SparkCell(startupName, config.data);
        await sc.initialize();
        render(React.createElement(App, { sparkCell: sc }));
        await sc.start();
      } catch (error) {
        console.error('Failed to start SparkCell:', error.message);
        console.error(error.stack);
        process.exit(1);
      }
    }
    main().catch(err => {
      console.error('Fatal error:', err);
      process.exit(1);
    });
  });

program
  .command('new')
  .description('Create a new startup')
  .action(async () => {
    const config = new GlobalConfig(paths.config());
    await config.load();
    if (config.needsSetup()) {
      const { runSetup } = await import('../src/cli/setup.js');
      const ok = await runSetup();
      if (!ok) return;
    }
    const { runNewStartup } = await import('../src/cli/new-startup.js');
    await runNewStartup();
  });

program
  .command('list')
  .description('List all startups')
  .action(async () => {
    const selector = new StartupSelector();
    const startups = await selector.listStartups();
    const { success, dim, info } = await import('../src/cli/prompt.js');
    if (startups.length === 0) {
      dim('Keine Startups gefunden.');
      info('Erstelle eins mit: sparkcell new');
      return;
    }
    console.log();
    success(`${startups.length} Startup(s):`);
    for (const s of startups) {
      info(`  ${s.name} — ${s.displayName} (${s.agentCount} Agents)`);
    }
    console.log();
  });

program
  .command('config [action] [key] [value]')
  .description('Show or edit settings (config set <key> <value>)')
  .action(async (action, key, value) => {
    const { success, info, warn, error: err } = await import('../src/cli/prompt.js');
    const config = new GlobalConfig(paths.config());
    await config.load();

    if (!action || action === 'show') {
      console.log(JSON.stringify(config.data, null, 2));
      console.log();
      info(`Datei: ${paths.config()}`);
      return;
    }

    if (action === 'set') {
      if (!key) { err('Benutzung: sparkcell config set <key> <value>'); return; }
      const keyMap = {
        provider: 'llm.primary.provider',
        model: 'llm.primary.model',
        baseurl: 'llm.primary.baseUrl',
        apikey: 'llm.primary.apiKey',
        'daily-limit': 'budget.dailyLimit',
        tickrate: 'tickRate',
      };
      const resolvedKey = keyMap[key.toLowerCase()] || key;
      setNestedValue(config.data, resolvedKey, value);
      await config.save();
      success(`${resolvedKey} = ${value}`);
      return;
    }

    if (action === 'path') {
      info(paths.config());
      return;
    }

    warn(`Unbekannte Aktion: ${action}. Nutze: show, set, path`);
  });

program
  .command('setup')
  .description('Run first-time setup wizard')
  .action(async () => {
    const { runSetup } = await import('../src/cli/setup.js');
    await runSetup();
  });

program
  .command('doctor')
  .description('Check system health')
  .action(async () => {
    const { runDoctor } = await import('../src/cli/doctor.js');
    await runDoctor();
  });

program
  .command('tool [action] [name]')
  .description('Manage tools (install, list, remove, enable, disable)')
  .action(async (action, name) => {
    const { info, warn } = await import('../src/cli/prompt.js');
    if (!action || action === 'list') {
      await listTools();
      return;
    }
    switch (action) {
      case 'install':
      case 'add':
        await installTool(name);
        break;
      case 'remove':
      case 'uninstall':
        await removeTool(name);
        break;
      case 'enable':
        await enableTool(name);
        break;
      case 'disable':
        await disableTool(name);
        break;
      default:
        warn(`Unbekannte Aktion: ${action}`);
        info('Verfügbare Aktionen: list, install, remove, enable, disable');
    }
  });

program
  .command('export [name]')
  .description('Export startup documents')
  .action(async (name) => {
    const { info, warn } = await import('../src/cli/prompt.js');
    if (!name) { info('Benutzung: sparkcell export <startup-name>'); return; }
    const outputDir = paths.output(name);
    try {
      const docsDir = path.join(outputDir, 'docs');
      const files = await fs.readdir(docsDir);
      info(`${files.length} Dokumente von "${name}":`);
      for (const f of files) info(`  ${f}`);
    } catch {
      warn(`Kein Output gefunden für: ${name}`);
    }
  });

// Default: setup or help
program.action(async () => {
  const config = new GlobalConfig(paths.config());
  await config.load();
  if (config.needsSetup()) {
    const { runSetup } = await import('../src/cli/setup.js');
    await runSetup();
  } else {
    const { info, dim } = await import('../src/cli/prompt.js');
    console.log();
    info('SparkCell v2.0');
    console.log();
    dim('Befehle:');
    info('  sparkcell start [name]   Startup starten');
    info('  sparkcell new            Neues Startup erstellen');
    info('  sparkcell list           Startups auflisten');
    info('  sparkcell config         Einstellungen zeigen');
    info('  sparkcell doctor         System-Check');
    info('  sparkcell setup          Setup-Wizard');
    info('  sparkcell tool [action]  Tools verwalten');
    console.log();
  }
});

async function selectStartup() {
  const selector = new StartupSelector();
  const startups = await selector.listStartups();
  if (startups.length === 0) return null;
  if (startups.length === 1) return startups[0].name;

  const { select } = await import('../src/cli/prompt.js');
  const items = startups.map(s => ({
    label: s.displayName,
    hint: `${s.agentCount} Agents`,
    name: s.name,
  }));
  const chosen = await select('Welches Startup starten?', items);
  return chosen.name;
}

function setNestedValue(obj, path, value) {
  const parts = path.split('.');
  let current = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!current[parts[i]] || typeof current[parts[i]] !== 'object') {
      current[parts[i]] = {};
    }
    current = current[parts[i]];
  }
  // Try to parse numbers/booleans
  if (value === 'true') value = true;
  else if (value === 'false') value = false;
  else if (!isNaN(value) && value !== '') value = Number(value);
  current[parts[parts.length - 1]] = value;
}

program.parse();
