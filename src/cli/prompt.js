// src/cli/prompt.js
// Premium CLI Prompts für SparkCell

import readline from 'node:readline';
import { THEME, ANSI, box, header, divider, step, success, warn, error, info, muted, bullet, bulletList } from './colors.js';
import { Spinner, ProgressBar, ActivityIndicator, typeWriter } from './progress.js';

const RESET = '\x1b[0m';
const DIM = '\x1b[2m';
const CYAN = '\x1b[36m';

// ASCII Art Logo for SparkCell
const SPARKCELL_LOGO = `
${CYAN}   ███████╗ █████╗ ███████╗███████╗██╗   ██╗██╗ ██████╗ █████╗ ███████╗${RESET}
${CYAN}   ██╔════╝██╔══██╗██╔════╝██╔════╝██║   ██║██║██╔════╝██╔══██╗██╔════╝${RESET}
${CYAN}   ███████╗███████║███████╗███████╗██║   ██║██║██║     ███████║███████╗${RESET}
${CYAN}   ╚════██║██╔══██║╚════██║╚════██║╚██╗ ██╔╝██║██║     ██╔══██║╚════██║${RESET}
${CYAN}   ███████║██║  ██║███████║███████║ ╚████╔╝ ██║╚██████╗██║  ██║███████║${RESET}
${CYAN}   ╚══════╝╚═╝  ╚═╝╚══════╝╚══════╝  ╚═══╝  ╚═╝ ╚═════╝╚═╝  ╚═╝╚══════╝${RESET}
${DIM}                    Multi-Agent Startup Framework${RESET}
`;

function createInterface() {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

/**
 * Show the SparkCell logo
 */
export function showLogo() {
  console.log(SPARKCELL_LOGO);
  console.log();
}

/**
 * Animated logo display
 */
export async function showLogoAnimated(speed = 15) {
  const lines = SPARKCELL_LOGO.trim().split('\n');
  for (const line of lines) {
    console.log(line);
    await new Promise(resolve => setTimeout(resolve, speed));
  }
  console.log();
}

/**
 * Ask a question with styled prompt
 */
export async function ask(question) {
  const rl = createInterface();
  return new Promise(resolve => {
    rl.question(`${THEME.primary}?${ANSI.reset} ${question} `, answer => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

/**
 * Ask for secret input (password-like)
 */
export async function askSecret(question) {
  const rl = createInterface();
  return new Promise(resolve => {
    process.stdout.write(`${THEME.primary}?${ANSI.reset} ${question} `);
    process.stdin.setRawMode?.(true);
    let input = '';
    const onData = (char) => {
      const c = char.toString();
      if (c === '\n' || c === '\r') {
        process.stdin.setRawMode?.(false);
        process.stdin.removeListener('data', onData);
        process.stdout.write('\n');
        rl.close();
        resolve(input);
      } else if (c === '\x7f' || c === '\b') {
        if (input.length > 0) {
          input = input.slice(0, -1);
          process.stdout.write('\b \b');
        }
      } else if (c === '\x03') {
        process.stdout.write('\n');
        process.exit(0);
      } else {
        input += c;
        process.stdout.write('*');
      }
    };
    process.stdin.on('data', onData);
  });
}

/**
 * Confirm dialog with default
 */
export async function confirm(question, defaultYes = true) {
  const hint = defaultYes ? 'Y/n' : 'y/N';
  const answer = await ask(`${question} ${DIM}(${hint})${RESET}`);
  if (answer === '') return defaultYes;
  return answer.toLowerCase().startsWith('y') || answer.toLowerCase().startsWith('j');
}

/**
 * Select from list
 */
export async function select(question, items) {
  console.log(`\n${THEME.primary}?${RESET} ${question}\n`);
  items.forEach((item, i) => {
    const label = item.label || item;
    const hint = item.hint ? ` ${DIM}${item.hint}${RESET}` : '';
    console.log(`  ${THEME.primary}${i + 1}.${RESET} ${label}${hint}`);
  });
  console.log();
  const answer = await ask(`Wähle (1-${items.length}):`);
  const idx = parseInt(answer) - 1;
  if (idx >= 0 && idx < items.length) return items[idx];
  return items[0];
}

/**
 * Show a styled box
 */
export function showBox(content, options = {}) {
  console.log(box(content, options));
}

/**
 * Show a header
 */
export function showHeader(text) {
  console.log(header(text));
}

/**
 * Show a divider
 */
export function showDivider(char = '─') {
  console.log(divider(char));
}

/**
 * Show bullet list
 */
export function showBulletList(items, colorCode = THEME.primary) {
  console.log(bulletList(items, colorCode));
}

/**
 * Show a loading spinner
 */
export function createSpinner(message) {
  return new Spinner(message);
}

/**
 * Show a progress bar
 */
export function createProgressBar(total, options = {}) {
  return new ProgressBar(total, options);
}

/**
 * Show a "coming soon" preview
 */
export function comingSoon(feature) {
  console.log(`\n${THEME.secondary}⏳ Coming Soon:${RESET} ${feature}`);
  console.log(`${DIM}  Diese Funktion wird in einem zukünftigen Update verfügbar sein.${RESET}\n`);
}

/**
 * Show a pro tip
 */
export function proTip(tip) {
  console.log(`\n${THEME.warning}💡 Pro Tip:${RESET} ${tip}`);
  console.log();
}

/**
 * Keyboard shortcut display
 */
export function keyboardShortcut(key, action) {
  console.log(`${THEME.textMuted}${key.padEnd(10)}${RESET} ${action}`);
}

/**
 * Show all keyboard shortcuts
 */
export function showKeyboardShortcuts(shortcuts) {
  console.log(`\n${THEME.primary}Keyboard Shortcuts:${RESET}\n`);
  for (const { key, action } of shortcuts) {
    keyboardShortcut(key, action);
  }
  console.log();
}

/**
 * Show welcome banner with features
 */
export function showWelcome() {
  showLogo();
  console.log(`${THEME.primary}Willkommen bei SparkCell!${RESET}\n`);
  showBulletList([
    '🤖 5 Rollen-Templates: CEO, Tech Lead, Product, Designer, Marketing',
    '🧠 Big Five Persönlichkeitsmodell',
    '⚡ 26 Core Tools + 6400+ MCP Tools',
    '📦 Integrierte Browser-Automatisierung',
  ]);

  console.log();
  console.log(`${THEME.textMuted}Erste Schritte:${RESET}`);
  console.log(`${THEME.primary}  sparkcell setup${RESET}    - LLM Provider konfigurieren`);
  console.log(`${THEME.primary}  sparkcell new${RESET}       - Neues Startup erstellen`);
  console.log(`${THEME.primary}  sparkcell start${RESET}    - Startup starten`);
  console.log();
}

/**
 * Show startup banner
 */
export function showStartupBanner(startupName, agentCount) {
  const lines = [
    `Startup: ${startupName}`,
    `Agenten: ${agentCount}`,
    `Status:  Bereit`,
  ];
  showBox(lines.join('\n'), {
    title: 'SparkCell',
    borderColor: THEME.primary,
    padding: 1,
  });
}

// Re-export from colors.js for convenience
export { THEME, ANSI, typeWriter, step, success, warn, error, info, muted };

/**
 * Dimmed text output
 */
export function dim(text) {
  console.log(`${ANSI.dim}${THEME.textMuted}${text}${ANSI.reset}`);
}