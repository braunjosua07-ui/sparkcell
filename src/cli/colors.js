// src/cli/colors.js
// Premium Color Theme System für SparkCell

// ANSI Color Codes
const ANSI = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  italic: '\x1b[3m',
  underline: '\x1b[4m',
  blink: '\x1b[5m',
  reverse: '\x1b[7m',
  hidden: '\x1b[8m',
  strikethrough: '\x1b[9m',
};

// Base Colors
const BASE = {
  black: '\x1b[30m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
};

// Bright Colors
const BRIGHT = {
  brightBlack: '\x1b[90m',
  brightRed: '\x1b[91m',
  brightGreen: '\x1b[92m',
  brightYellow: '\x1b[93m',
  brightBlue: '\x1b[94m',
  brightMagenta: '\x1b[95m',
  brightCyan: '\x1b[96m',
  brightWhite: '\x1b[97m',
};

// Background Colors
const BG = {
  bgBlack: '\x1b[40m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m',
  bgMagenta: '\x1b[45m',
  bgCyan: '\x1b[46m',
  bgWhite: '\x1b[47m',
};

// ============================================
// SPARKCELL THEME - Premium Color Palette
// ============================================

export const THEME = {
  // Primary Brand Colors
  primary: BRIGHT.brightCyan,      // Main brand color
  primaryDim: BASE.cyan,          // Dimmed variant

  // Secondary Colors
  secondary: BRIGHT.brightMagenta, // Accent color
  secondaryDim: BASE.magenta,      // Dimmed variant

  // Semantic Colors
  success: BRIGHT.brightGreen,     // Success states
  successDim: BASE.green,          // Success dimmed

  warning: BRIGHT.brightYellow,    // Warning states
  warningDim: BASE.yellow,         // Warning dimmed

  error: BRIGHT.brightRed,         // Error states
  errorDim: BASE.red,              // Error dimmed

  info: BRIGHT.brightBlue,         // Info states
  infoDim: BASE.blue,              // Info dimmed

  // Text Colors
  text: BRIGHT.brightWhite,        // Primary text
  textDim: BASE.white,             // Secondary text
  textMuted: BRIGHT.brightBlack,   // Muted/placeholder text

  // UI Elements
  border: BASE.cyan,               // Box borders
  borderDim: BRIGHT.brightBlack,   // Dimmed borders

  // Special Effects
  highlight: ANSI.bold + BRIGHT.brightCyan,  // Highlighted text
  accent: ANSI.underline + BRIGHT.brightCyan, // Accented text

  // Agent Role Colors (for multi-agent visualization)
  roles: {
    ceo: '\x1b[38;5;93m',          // Purple - Strategic Lead
    tech: '\x1b[38;5;39m',         // Blue - Tech Lead
    product: '\x1b[38;5;208m',     // Orange - Product Manager
    designer: '\x1b[38;5;213m',    // Pink - Designer
    marketing: '\x1b[38;5;82m',    // Green - Marketing
    default: BRIGHT.brightWhite,   // Default role color
  },

  // Skill Level Colors
  skills: {
    beginner: BRIGHT.brightBlack,   // Gray
    intermediate: BRIGHT.brightYellow, // Yellow
    expert: BRIGHT.brightGreen,     // Green
    master: BRIGHT.brightMagenta,  // Magenta
  },

  // Energy/Status Colors
  energy: {
    high: BRIGHT.brightGreen,      // >70%
    medium: BRIGHT.brightYellow,   // 30-70%
    low: BRIGHT.brightRed,         // <30%
  },

  // State Colors
  state: {
    idle: BRIGHT.brightBlack,
    working: BRIGHT.brightCyan,
    blocked: BRIGHT.brightYellow,
    paused: BRIGHT.brightMagenta,
    complete: BRIGHT.brightGreen,
    help: BRIGHT.brightRed,
  },
};

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Apply color to text
 */
export function color(text, colorCode) {
  return `${colorCode}${text}${ANSI.reset}`;
}

/**
 * Apply multiple styles to text
 */
export function style(text, ...styles) {
  return `${styles.join('')}${text}${ANSI.reset}`;
}

/**
 * Create a colored box around text
 */
export function box(text, options = {}) {
  const {
    borderColor = THEME.border,
    padding = 1,
    title = '',
    width = null,
  } = options;

  const lines = text.split('\n');
  const maxLen = Math.max(...lines.map(l => l.length), width || 0);
  const pad = ' '.repeat(padding);

  const horizontal = '─'.repeat(maxLen + padding * 2);

  let result = `${borderColor}╭${horizontal}╮${ANSI.reset}\n`;

  if (title) {
    const titlePad = Math.floor((maxLen - title.length) / 2);
    result += `${borderColor}│${ANSI.reset}${pad}${' '.repeat(Math.max(0, titlePad))}${style(title, ANSI.bold)}${' '.repeat(Math.max(0, maxLen - title.length - titlePad))}${pad}${borderColor}│${ANSI.reset}\n`;
    result += `${borderColor}├${horizontal}┤${ANSI.reset}\n`;
  }

  for (const line of lines) {
    const linePad = ' '.repeat(maxLen - line.length);
    result += `${borderColor}│${ANSI.reset}${pad}${line}${linePad}${pad}${borderColor}│${ANSI.reset}\n`;
  }

  result += `${borderColor}╰${horizontal}╯${ANSI.reset}`;

  return result;
}

/**
 * Create a horizontal divider
 */
export function divider(char = '─', colorCode = THEME.border) {
  const width = process.stdout.columns || 80;
  return `${colorCode}${char.repeat(width)}${ANSI.reset}`;
}

/**
 * Create a section header
 */
export function header(text, colorCode = THEME.primary) {
  const line = '═'.repeat(text.length + 4);
  return `${colorCode}╔${line}╗${ANSI.reset}
${colorCode}║${ANSI.reset}  ${style(text, ANSI.bold)}  ${colorCode}║${ANSI.reset}
${colorCode}╚${line}╝${ANSI.reset}`;
}

/**
 * Create a sub-header
 */
export function subHeader(text, colorCode = THEME.primary) {
  return `${colorCode}▶ ${style(text, ANSI.bold)}${ANSI.reset}
${colorCode}  ${'─'.repeat(text.length + 2)}${ANSI.reset}`;
}

/**
 * Create a labeled line
 */
export function labelLine(label, value, labelColor = THEME.primary, valueColor = THEME.text) {
  return `${labelColor}${label}:${ANSI.reset} ${valueColor}${value}${ANSI.reset}`;
}

/**
 * Create a key-value pair
 */
export function keyValue(key, value, keyColor = THEME.textMuted, valueColor = THEME.text) {
  return `${keyColor}${key}${ANSI.reset} ${valueColor}${value}${ANSI.reset}`;
}

/**
 * Create inline code snippet
 */
export function code(text) {
  return `${BG.bgBlack}${BRIGHT.brightWhite} ${text} ${ANSI.reset}`;
}

/**
 * Create a highlighted word
 */
export function highlight(text) {
  return style(text, ANSI.bold, THEME.primary);
}

/**
 * Create a muted text
 */
export function muted(text) {
  return style(text, ANSI.dim, THEME.textMuted);
}

/**
 * Create a success message
 */
export function success(text) {
  return `${THEME.success}✓${ANSI.reset} ${text}`;
}

/**
 * Create a warning message
 */
export function warn(text) {
  return `${THEME.warning}!${ANSI.reset} ${text}`;
}

/**
 * Create an error message
 */
export function error(text) {
  return `${THEME.error}✗${ANSI.reset} ${text}`;
}

/**
 * Create an info message
 */
export function info(text) {
  return `${THEME.info}ℹ${ANSI.reset} ${text}`;
}

/**
 * Create a step indicator
 */
export function step(n, total, text) {
  return `${THEME.primary}[${n}/${total}]${ANSI.reset} ${style(text, ANSI.bold)}`;
}

/**
 * Create a bullet point
 */
export function bullet(text, bulletChar = '•', colorCode = THEME.primary) {
  return `${colorCode}${bulletChar}${ANSI.reset} ${text}`;
}

/**
 * Create an indented bullet list
 */
export function bulletList(items, colorCode = THEME.primary) {
  return items.map(item => bullet(item, '•', colorCode)).join('\n');
}

/**
 * Create a table row
 */
export function tableRow(columns, widths, colors = []) {
  return columns.map((col, i) => {
    const width = widths[i] || 0;
    const padLen = Math.max(0, width - col.length);
    const color = colors[i] || THEME.text;
    return `${color}${col}${' '.repeat(padLen)}${ANSI.reset}`;
  }).join(' ');
}

/**
 * Create a progress bar
 */
export function progressBar(percent, width = 20, colorCode = THEME.primary) {
  const filled = Math.round(width * percent / 100);
  const empty = width - filled;
  const bar = '█'.repeat(filled) + '░'.repeat(empty);
  return `${colorCode}${bar}${ANSI.reset} ${percent}%`;
}

/**
 * Truncate text with ellipsis
 */
export function truncate(text, maxLength, suffix = '...') {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - suffix.length) + suffix;
}

/**
 * Pad text to width
 */
export function pad(text, width, align = 'left') {
  const padLen = Math.max(0, width - text.length);
  if (align === 'right') return ' '.repeat(padLen) + text;
  if (align === 'center') {
    const leftPad = Math.floor(padLen / 2);
    return ' '.repeat(leftPad) + text + ' '.repeat(padLen - leftPad);
  }
  return text + ' '.repeat(padLen);
}

// Export all for flexibility
export { ANSI, BASE, BRIGHT, BG };