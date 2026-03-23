import readline from 'node:readline';

const CYAN = '\x1b[36m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';
const DIM = '\x1b[2m';
const BOLD = '\x1b[1m';
const RESET = '\x1b[0m';

function createInterface() {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

export async function ask(question) {
  const rl = createInterface();
  return new Promise(resolve => {
    rl.question(`${CYAN}?${RESET} ${question} `, answer => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

export async function askSecret(question) {
  const rl = createInterface();
  return new Promise(resolve => {
    process.stdout.write(`${CYAN}?${RESET} ${question} `);
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

export async function confirm(question, defaultYes = true) {
  const hint = defaultYes ? 'Y/n' : 'y/N';
  const answer = await ask(`${question} ${DIM}(${hint})${RESET}`);
  if (answer === '') return defaultYes;
  return answer.toLowerCase().startsWith('y') || answer.toLowerCase().startsWith('j');
}

export async function select(question, items) {
  console.log(`\n${CYAN}?${RESET} ${question}\n`);
  items.forEach((item, i) => {
    const label = item.label || item;
    const hint = item.hint ? ` ${DIM}${item.hint}${RESET}` : '';
    console.log(`  ${CYAN}${i + 1}.${RESET} ${label}${hint}`);
  });
  console.log();
  const answer = await ask(`Wähle (1-${items.length}):`);
  const idx = parseInt(answer) - 1;
  if (idx >= 0 && idx < items.length) return items[idx];
  return items[0];
}

export function banner(text) {
  const line = '═'.repeat(text.length + 4);
  console.log(`\n${CYAN}╔${line}╗${RESET}`);
  console.log(`${CYAN}║${RESET}  ${BOLD}${text}${RESET}  ${CYAN}║${RESET}`);
  console.log(`${CYAN}╚${line}╝${RESET}\n`);
}

export function success(text) { console.log(`${GREEN}✓${RESET} ${text}`); }
export function warn(text)    { console.log(`${YELLOW}!${RESET} ${text}`); }
export function error(text)   { console.log(`${RED}✗${RESET} ${text}`); }
export function info(text)    { console.log(`${CYAN}i${RESET} ${text}`); }
export function dim(text)     { console.log(`${DIM}${text}${RESET}`); }
export function step(n, total, text) {
  console.log(`\n${CYAN}[${n}/${total}]${RESET} ${BOLD}${text}${RESET}`);
}
