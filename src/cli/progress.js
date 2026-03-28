// src/cli/progress.js
// Premium Progress Indicators für SparkCell

import { THEME, ANSI, style, color } from './colors.js';

// Spinner frames
const SPINNERS = {
  dots: ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'],
  line: ['-', '\\', '|', '/'],
  arrow: ['←', '↖', '↑', '↗', '→', '↘', '↓', '↙'],
  bounce: ['⠁', '⠃', '⠇', '⡇', '⡏', '⡗', '⡧', '⡧', '⡗', '⡏', '⡇', '⠇', '⠃', '⠁'],
  pulse: ['∙', '●', '∙', '∙', '∙'],
  wave: ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█', '▇', '▆', '▅', '▄', '▃', '▁'],
};

/**
 * Create a spinner instance
 */
export class Spinner {
  #frames;
  #interval;
  #frame = 0;
  #message;
  #timer = null;
  #stream = process.stdout;

  constructor(message = '', options = {}) {
    this.#frames = SPINNERS[options.style || 'dots'];
    this.#interval = options.interval || 80;
    this.#message = message;
  }

  start() {
    if (this.#timer) return this;
    this.#stream.write(ANSI.hidden); // Hide cursor
    this.#timer = setInterval(() => this.#tick(), this.#interval);
    return this;
  }

  #tick() {
    const frame = this.#frames[this.#frame];
    this.#stream.write(`\r${ANSI.reset}${THEME.primary}${frame}${ANSI.reset} ${this.#message}`);
    this.#frame = (this.#frame + 1) % this.#frames.length;
  }

  update(message) {
    this.#message = message;
    return this;
  }

  stop(finalMessage = null, symbol = '✓') {
    if (!this.#timer) return this;
    clearInterval(this.#timer);
    this.#timer = null;
    this.#stream.write(ANSI.reset);
    this.#stream.write(`\r${ANSI.reset}  ${THEME.success}${symbol}${ANSI.reset} ${finalMessage || this.#message}\n`);
    this.#stream.write(ANSI.reset); // Show cursor
    return this;
  }

  fail(finalMessage = null) {
    if (!this.#timer) return this;
    clearInterval(this.#timer);
    this.#timer = null;
    this.#stream.write(ANSI.reset);
    this.#stream.write(`\r${ANSI.reset}  ${THEME.error}✗${ANSI.reset} ${finalMessage || this.#message}\n`);
    this.#stream.write(ANSI.reset);
    return this;
  }

  warn(finalMessage = null) {
    if (!this.#timer) return this;
    clearInterval(this.#timer);
    this.#timer = null;
    this.#stream.write(ANSI.reset);
    this.#stream.write(`\r${ANSI.reset}  ${THEME.warning}!${ANSI.reset} ${finalMessage || this.#message}\n`);
    this.#stream.write(ANSI.reset);
    return this;
  }
}

/**
 * Progress bar with percentage
 */
export class ProgressBar {
  #total;
  #current = 0;
  #width;
  #message;
  #stream = process.stdout;
  #incompleteChar = '░';
  #completeChar = '█';

  constructor(total, options = {}) {
    this.#total = total;
    this.#width = options.width || 30;
    this.#message = options.message || '';
  }

  #render() {
    const percent = Math.round((this.#current / this.#total) * 100);
    const complete = Math.round((this.#current / this.#total) * this.#width);
    const incomplete = this.#width - complete;

    const bar = `${THEME.primary}${this.#completeChar.repeat(complete)}${ANSI.reset}${THEME.textMuted}${this.#incompleteChar.repeat(incomplete)}${ANSI.reset}`;
    const msg = this.#message ? ` ${this.#message}` : '';

    this.#stream.write(`\r${bar} ${THEME.primary}${percent}%${ANSI.reset}${msg}`);
  }

  start(message = null) {
    if (message) this.#message = message;
    this.#current = 0;
    this.#render();
    return this;
  }

  update(current, message = null) {
    this.#current = Math.min(current, this.#total);
    if (message) this.#message = message;
    this.#render();
    return this;
  }

  increment(message = null) {
    return this.update(this.#current + 1, message);
  }

  complete(finalMessage = 'Complete') {
    this.#current = this.#total;
    this.#render();
    this.#stream.write(`\n${THEME.success}✓${ANSI.reset} ${finalMessage}\n`);
    return this;
  }
}

/**
 * Multi-item progress display
 */
export class ProgressList {
  #items = [];
  #stream = process.stdout;

  add(item, status = 'pending') {
    this.#items.push({ item, status });
    return this;
  }

  #render() {
    this.#stream.write(ANSI.reset + '\x1b[2J\x1b[H'); // Clear screen

    for (const { item, status } of this.#items) {
      let symbol, statusColor;
      switch (status) {
        case 'done':
          symbol = '✓';
          statusColor = THEME.success;
          break;
        case 'running':
          symbol = SPINNERS.dots[Date.now() % SPINNERS.dots.length];
          statusColor = THEME.primary;
          break;
        case 'error':
          symbol = '✗';
          statusColor = THEME.error;
          break;
        case 'warning':
          symbol = '!';
          statusColor = THEME.warning;
          break;
        default:
          symbol = '○';
          statusColor = THEME.textMuted;
      }

      this.#stream.write(`${statusColor}${symbol}${ANSI.reset} ${item}\n`);
    }
  }

  update(index, status) {
    if (index >= 0 && index < this.#items.length) {
      this.#items[index].status = status;
      this.#render();
    }
    return this;
  }

  complete() {
    this.#render();
    return this;
  }
}

/**
 * Simple loading message
 */
export function loading(message, duration = 2000) {
  return new Promise(resolve => {
    const spinner = new Spinner(message).start();
    setTimeout(() => {
      spinner.stop();
      resolve();
    }, duration);
  });
}

/**
 * Step-by-step progress with auto-advance
 */
export class StepProgress {
  #steps = [];
  #current = -1;
  #stream = process.stdout;

  constructor(steps) {
    this.#steps = steps;
  }

  start() {
    this.#current = 0;
    this.#render();
    return this;
  }

  #render() {
    this.#stream.write('\r' + ' '.repeat(100) + '\r'); // Clear line

    for (let i = 0; i < this.#steps.length; i++) {
      const step = this.#steps[i];
      let symbol, colorCode;

      if (i < this.#current) {
        symbol = '✓';
        colorCode = THEME.success;
      } else if (i === this.#current) {
        symbol = SPINNERS.dots[Date.now() % SPINNERS.dots.length];
        colorCode = THEME.primary;
      } else {
        symbol = '○';
        colorCode = THEME.textMuted;
      }

      this.#stream.write(`${colorCode}${symbol}${ANSI.reset} ${step} `);
    }
  }

  next() {
    this.#current++;
    if (this.#current >= this.#steps.length) {
      this.complete();
    } else {
      this.#render();
    }
    return this;
  }

  complete() {
    this.#current = this.#steps.length;
    this.#stream.write('\r' + ' '.repeat(100) + '\r');
    for (const step of this.#steps) {
      this.#stream.write(`${THEME.success}✓${ANSI.reset} ${step} `);
    }
    this.#stream.write('\n');
    return this;
  }
}

/**
 * Animated text effect
 */
export async function typeWriter(text, speed = 30, colorCode = THEME.text) {
  const stream = process.stdout;
  stream.write(colorCode);
  for (const char of text) {
    stream.write(char);
    await new Promise(resolve => setTimeout(resolve, speed));
  }
  stream.write(ANSI.reset + '\n');
}

/**
 * Countdown timer
 */
export async function countdown(seconds, message = 'Starting in') {
  const stream = process.stdout;
  for (let i = seconds; i > 0; i--) {
    stream.write(`\r${THEME.primary}${message} ${i}s...${ANSI.reset} `);
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  stream.write(`\r${THEME.success}Starting!${ANSI.reset}   \n`);
}

/**
 * Create a simple status indicator
 */
export function status(text, state, colorCode = THEME.text) {
  const symbols = {
    running: '●',
    done: '✓',
    error: '✗',
    warning: '!',
    info: 'ℹ',
    pending: '○',
  };
  const symbol = symbols[state] || '•';
  return `${colorCode}${symbol}${ANSI.reset} ${text}`;
}

/**
 * Format duration for display
 */
export function formatDuration(ms) {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 3600000) return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
  return `${Math.floor(ms / 3600000)}h ${Math.floor((ms % 3600000) / 60000)}m`;
}

/**
 * Create an activity indicator
 */
export class ActivityIndicator {
  #message;
  #dots = 0;
  #timer = null;
  #stream = process.stdout;

  constructor(message) {
    this.#message = message;
  }

  start() {
    if (this.#timer) return this;
    this.#stream.write(ANSI.hidden);
    this.#timer = setInterval(() => this.#tick(), 300);
    return this;
  }

  #tick() {
    this.#dots = (this.#dots + 1) % 4;
    const dots = '.'.repeat(this.#dots);
    this.#stream.write(`\r${THEME.primary}${this.#message}${dots}${ANSI.reset}    `);
  }

  stop(success = true, finalMessage = null) {
    if (!this.#timer) return this;
    clearInterval(this.#timer);
    this.#timer = null;
    const symbol = success ? '✓' : '✗';
    const color = success ? THEME.success : THEME.error;
    this.#stream.write(`\r${ANSI.reset}${color}${symbol}${ANSI.reset} ${finalMessage || this.#message}\n`);
    this.#stream.write(ANSI.reset);
    return this;
  }
}