// src/cli/tools.js - Tool Management CLI
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

const USER_TOOLS_DIR = path.join(os.homedir(), '.config', 'sparkcell', 'tools');

/**
 * Ensure user tools directory exists
 */
async function ensureToolsDir() {
  await fs.mkdir(USER_TOOLS_DIR, { recursive: true });
}

/**
 * List all installed tools
 */
export async function listTools() {
  await ensureToolsDir();

  try {
    const entries = await fs.readdir(USER_TOOLS_DIR);
    const tools = entries.filter(f => f.endsWith('.tool.json'));

    console.log();
    console.log('Installed Tools:');
    console.log('----------------');

    if (tools.length === 0) {
      console.log('No tools installed yet.');
      console.log('Use: sparkcell tool install <url|file>');
      console.log();
      return;
    }

    for (const toolFile of tools) {
      const toolPath = path.join(USER_TOOLS_DIR, toolFile);
      const data = JSON.parse(await fs.readFile(toolPath, 'utf8'));
      const status = data.enabled ? '[enabled]' : '[disabled]';
      console.log(`  ${data.name} ${status}`);
      console.log(`    ${toolFile}`);
      console.log(`    ${data.description}`);
    }
    console.log();
  } catch (err) {
    console.error(`Failed to list tools: ${err.message}`);
  }
}

/**
 * Install a tool from a remote URL or local file
 */
export async function installTool(toolSpec) {
  await ensureToolsDir();

  if (!toolSpec) {
    console.log();
    console.log('Usage: sparkcell tool install <url|local-path>');
    console.log();
    return;
  }

  console.log();
  console.log('Installing Tool...');

  let toolData;
  let toolName;

  try {
    // Check if it's a URL or local file
    if (toolSpec.startsWith('http://') || toolSpec.startsWith('https://')) {
      console.log(`  Downloading from: ${toolSpec}`);
      const response = await fetch(toolSpec);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      toolData = await response.json();
      toolName = toolData.name || path.basename(toolSpec, '.tool.json');
    } else {
      console.log(`  Loading from: ${toolSpec}`);
      const toolPath = path.resolve(toolSpec);
      toolData = JSON.parse(await fs.readFile(toolPath, 'utf8'));
      toolName = toolData.name || path.basename(toolPath, '.tool.json');
    }
  } catch (err) {
    console.error(`  Failed to load tool: ${err.message}`);
    console.log();
    return;
  }

  // Validate tool manifest
  if (!toolData.name || !toolData.description || !toolData.parameters) {
    console.error('  Invalid tool manifest. Missing: name, description, or parameters');
    console.log();
    return;
  }

  const safeName = toolData.name.replace(/[^a-z0-9]/gi, '-').toLowerCase();
  const targetFile = `${safeName}.tool.json`;
  const targetPath = path.join(USER_TOOLS_DIR, targetFile);

  // Save tool manifest
  await fs.writeFile(targetPath, JSON.stringify(toolData, null, 2));

  console.log(`  Tool installed: ${toolData.name}`);
  console.log(`  Location: ${targetPath}`);
  console.log();
  console.log('Tool details:');
  console.log(`  Name: ${toolData.name}`);
  console.log(`  Description: ${toolData.description}`);
  console.log(`  Parameters: ${Object.keys(toolData.parameters || {}).join(', ')}`);
  console.log();
}

/**
 * Remove/uninstall a tool
 */
export async function removeTool(toolName) {
  await ensureToolsDir();

  if (!toolName) {
    console.log();
    console.log('Usage: sparkcell tool remove <tool-name>');
    console.log();
    return;
  }

  console.log();
  console.log('Removing Tool...');

  const safeName = toolName.replace(/[^a-z0-9]/gi, '-').toLowerCase();
  const targetFile = `${safeName}.tool.json`;
  const targetPath = path.join(USER_TOOLS_DIR, targetFile);

  try {
    await fs.access(targetPath);
  } catch {
    console.log(`Tool not found: ${toolName}`);
    console.log();
    return;
  }

  // For now, remove without confirmation (simpler)
  await fs.unlink(targetPath);
  console.log(`Tool removed: ${toolName}`);
  console.log();
}

/**
 * Enable a tool
 */
export async function enableTool(toolName) {
  await ensureToolsDir();

  if (!toolName) {
    console.log();
    console.log('Usage: sparkcell tool enable <tool-name>');
    console.log();
    return;
  }

  const safeName = toolName.replace(/[^a-z0-9]/gi, '-').toLowerCase();
  const targetFile = `${safeName}.tool.json`;
  const targetPath = path.join(USER_TOOLS_DIR, targetFile);

  try {
    const data = JSON.parse(await fs.readFile(targetPath, 'utf8'));
    data.enabled = true;
    await fs.writeFile(targetPath, JSON.stringify(data, null, 2));
    console.log();
    console.log(`Tool enabled: ${toolName}`);
    console.log();
  } catch (err) {
    console.error(`Failed to enable tool: ${err.message}`);
  }
}

/**
 * Disable a tool
 */
export async function disableTool(toolName) {
  await ensureToolsDir();

  if (!toolName) {
    console.log();
    console.log('Usage: sparkcell tool disable <tool-name>');
    console.log();
    return;
  }

  const safeName = toolName.replace(/[^a-z0-9]/gi, '-').toLowerCase();
  const targetFile = `${safeName}.tool.json`;
  const targetPath = path.join(USER_TOOLS_DIR, targetFile);

  try {
    const data = JSON.parse(await fs.readFile(targetPath, 'utf8'));
    data.enabled = false;
    await fs.writeFile(targetPath, JSON.stringify(data, null, 2));
    console.log();
    console.log(`Tool disabled: ${toolName}`);
    console.log();
  } catch (err) {
    console.error(`Failed to disable tool: ${err.message}`);
  }
}
