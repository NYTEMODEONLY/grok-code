/**
 * Terminal UI Module
 * Claude Code-style terminal interface with status line, autocomplete, and permission cycling
 * Built by nytemode
 */

import readline from 'readline';
import { EventEmitter } from 'events';

// ANSI escape codes
const ANSI = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  italic: '\x1b[3m',
  underline: '\x1b[4m',
  inverse: '\x1b[7m',
  hidden: '\x1b[8m',

  // Colors
  black: '\x1b[30m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m',

  // Background colors
  bgBlack: '\x1b[40m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m',
  bgMagenta: '\x1b[45m',
  bgCyan: '\x1b[46m',
  bgWhite: '\x1b[47m',

  // Cursor control
  clearLine: '\x1b[2K',
  clearScreen: '\x1b[2J',
  cursorHome: '\x1b[H',
  cursorUp: (n = 1) => `\x1b[${n}A`,
  cursorDown: (n = 1) => `\x1b[${n}B`,
  cursorRight: (n = 1) => `\x1b[${n}C`,
  cursorLeft: (n = 1) => `\x1b[${n}D`,
  cursorTo: (x, y) => `\x1b[${y};${x}H`,
  saveCursor: '\x1b[s',
  restoreCursor: '\x1b[u',
  hideCursor: '\x1b[?25l',
  showCursor: '\x1b[?25h',
};

// Box drawing characters
const BOX = {
  topLeft: '╭',
  topRight: '╮',
  bottomLeft: '╰',
  bottomRight: '╯',
  horizontal: '─',
  vertical: '│',
  teeRight: '├',
  teeLeft: '┤',
  teeDown: '┬',
  teeUp: '┴',
  cross: '┼',
  // Double line variants
  dTopLeft: '╔',
  dTopRight: '╗',
  dBottomLeft: '╚',
  dBottomRight: '╝',
  dHorizontal: '═',
  dVertical: '║',
};

/**
 * Permission modes for cycling
 */
const PERMISSION_MODES = [
  { id: 'ask', label: 'ask permissions', description: 'Ask before each action' },
  { id: 'bypass', label: 'bypass permissions on', description: 'Auto-approve safe actions' },
  { id: 'strict', label: 'strict mode', description: 'Require explicit approval' },
];

/**
 * Input modes
 */
const INPUT_MODES = {
  INSERT: 'INSERT',
  NORMAL: 'NORMAL',
  COMMAND: 'COMMAND',
};

/**
 * Terminal UI - Claude Code-style interface
 */
export class TerminalUI extends EventEmitter {
  constructor(options = {}) {
    super();

    this.options = {
      showStatusLine: options.showStatusLine ?? true,
      showTips: options.showTips ?? true,
      colorEnabled: options.colorEnabled ?? true,
      promptSymbol: options.promptSymbol ?? '>',
      ...options,
    };

    // State
    this.inputMode = INPUT_MODES.INSERT;
    this.permissionMode = 0; // Index into PERMISSION_MODES
    this.currentInput = '';
    this.cursorPosition = 0;
    this.historyIndex = -1;
    this.commandHistory = [];
    this.suggestions = [];
    this.selectedSuggestion = -1;
    this.isShowingSuggestions = false;

    // Terminal dimensions
    this.width = process.stdout.columns || 80;
    this.height = process.stdout.rows || 24;

    // Status line content
    this.statusLeft = '';
    this.statusRight = '';

    // Command definitions for autocomplete
    this.commands = new Map();

    // Listen for terminal resize
    process.stdout.on('resize', () => {
      this.width = process.stdout.columns || 80;
      this.height = process.stdout.rows || 24;
      this.emit('resize', { width: this.width, height: this.height });
    });
  }

  /**
   * Register a command for autocomplete
   * @param {string} name - Command name (without /)
   * @param {Object} config - Command configuration
   */
  registerCommand(name, config = {}) {
    this.commands.set(name, {
      name,
      description: config.description || '',
      args: config.args || [],
      subcommands: config.subcommands || [],
      completer: config.completer || null,
      ...config,
    });
  }

  /**
   * Register multiple commands
   * @param {Object} commands - Commands object { name: config }
   */
  registerCommands(commands) {
    for (const [name, config] of Object.entries(commands)) {
      this.registerCommand(name, config);
    }
  }

  /**
   * Get autocomplete suggestions for input
   * @param {string} input - Current input
   * @returns {Array} Suggestions
   */
  getSuggestions(input) {
    if (!input.startsWith('/')) {
      return [];
    }

    const parts = input.slice(1).split(/\s+/);
    const commandPart = parts[0] || '';
    const isTypingCommand = parts.length === 1 && !input.endsWith(' ');

    if (isTypingCommand) {
      // Suggest command names
      const suggestions = [];
      for (const [name, config] of this.commands) {
        if (name.toLowerCase().startsWith(commandPart.toLowerCase())) {
          suggestions.push({
            type: 'command',
            value: name,
            display: `/${name}`,
            description: config.description,
            score: name === commandPart ? 100 : 50,
          });
        }
      }
      return suggestions.sort((a, b) => b.score - a.score).slice(0, 10);
    }

    // Suggest command arguments
    const command = this.commands.get(commandPart);
    if (!command) {
      return [];
    }

    // If command has subcommands
    if (command.subcommands.length > 0 && parts.length === 2) {
      const subPart = parts[1] || '';
      return command.subcommands
        .filter(sub => sub.toLowerCase().startsWith(subPart.toLowerCase()))
        .map(sub => ({
          type: 'subcommand',
          value: sub,
          display: sub,
          description: '',
          score: sub === subPart ? 100 : 50,
        }))
        .slice(0, 10);
    }

    // If command has a custom completer
    if (command.completer) {
      const argIndex = parts.length - 2;
      const currentArg = parts[parts.length - 1] || '';
      return command.completer(currentArg, argIndex, parts.slice(1));
    }

    return [];
  }

  /**
   * Cycle permission mode (Tab/Shift+Tab)
   * @param {number} direction - 1 for forward, -1 for backward
   */
  cyclePermissionMode(direction = 1) {
    this.permissionMode = (this.permissionMode + direction + PERMISSION_MODES.length) % PERMISSION_MODES.length;
    const mode = PERMISSION_MODES[this.permissionMode];
    this.emit('permissionModeChanged', mode);

    // Show mode change notification inline
    process.stdout.write(ANSI.saveCursor);
    process.stdout.write('\r' + ANSI.clearLine);
    process.stdout.write(`${ANSI.bgBlue}${ANSI.white} Permission: ${mode.label} ${ANSI.reset}`);
    process.stdout.write(ANSI.restoreCursor);

    return mode;
  }

  /**
   * Get current permission mode
   * @returns {Object} Current permission mode
   */
  getPermissionMode() {
    return PERMISSION_MODES[this.permissionMode];
  }

  /**
   * Set input mode
   * @param {string} mode - One of INPUT_MODES
   */
  setInputMode(mode) {
    if (Object.values(INPUT_MODES).includes(mode)) {
      this.inputMode = mode;
      this.updateStatusLine();
      this.emit('inputModeChanged', mode);
    }
  }

  /**
   * Format the status line
   * @returns {string} Formatted status line
   */
  formatStatusLine() {
    if (!this.options.showStatusLine) return '';

    const mode = `-- ${this.inputMode} --`;
    const permission = PERMISSION_MODES[this.permissionMode];
    const permissionText = `>> ${permission.label} (shift+tab to cycle)`;

    // Calculate padding
    const leftPart = mode;
    const rightPart = permissionText;
    const totalLength = leftPart.length + rightPart.length;
    const padding = Math.max(0, this.width - totalLength - 4);

    if (this.options.colorEnabled) {
      return `${ANSI.dim}${leftPart}${' '.repeat(padding)}${rightPart}${ANSI.reset}`;
    }

    return `${leftPart}${' '.repeat(padding)}${rightPart}`;
  }

  /**
   * Update and render the status line
   */
  updateStatusLine() {
    if (!this.options.showStatusLine) return;

    const statusLine = this.formatStatusLine();

    // Save cursor, move to bottom, write status, restore cursor
    process.stdout.write(ANSI.saveCursor);
    process.stdout.write(ANSI.cursorTo(1, this.height));
    process.stdout.write(ANSI.clearLine);
    process.stdout.write(statusLine);
    process.stdout.write(ANSI.restoreCursor);
  }

  /**
   * Render suggestions dropdown
   * @param {Array} suggestions - Suggestions to display
   * @param {number} selectedIndex - Currently selected index
   */
  renderSuggestions(suggestions, selectedIndex = -1) {
    if (!suggestions || suggestions.length === 0) {
      this.isShowingSuggestions = false;
      return;
    }

    this.isShowingSuggestions = true;
    this.suggestions = suggestions;
    this.selectedSuggestion = selectedIndex;

    // Find max width needed
    const maxDisplayWidth = Math.max(...suggestions.map(s => s.display.length));
    const maxDescWidth = Math.min(40, Math.max(...suggestions.map(s => (s.description || '').length)));
    const boxWidth = Math.min(this.width - 4, maxDisplayWidth + maxDescWidth + 5);

    console.log(''); // New line for suggestions

    // Top border
    console.log(`${ANSI.dim}${BOX.topLeft}${BOX.horizontal.repeat(boxWidth)}${BOX.topRight}${ANSI.reset}`);

    // Suggestions
    for (let i = 0; i < suggestions.length; i++) {
      const s = suggestions[i];
      const isSelected = i === selectedIndex;
      const display = s.display.padEnd(maxDisplayWidth + 2);
      const desc = (s.description || '').slice(0, maxDescWidth);

      let line = `${BOX.vertical} ${display}${ANSI.dim}${desc}${ANSI.reset}`;
      const lineLen = maxDisplayWidth + desc.length + 4;
      const padding = Math.max(0, boxWidth - lineLen);
      line += ' '.repeat(padding) + `${ANSI.dim}${BOX.vertical}${ANSI.reset}`;

      if (isSelected) {
        console.log(`${ANSI.inverse}${line}${ANSI.reset}`);
      } else {
        console.log(line);
      }
    }

    // Bottom border
    console.log(`${ANSI.dim}${BOX.bottomLeft}${BOX.horizontal.repeat(boxWidth)}${BOX.bottomRight}${ANSI.reset}`);

    // Usage hint
    console.log(`${ANSI.dim}Tab: select  Enter: confirm  Esc: cancel${ANSI.reset}`);
  }

  /**
   * Clear suggestions display
   */
  clearSuggestions() {
    if (!this.isShowingSuggestions) return;

    // Move cursor up and clear the suggestion lines
    const linesToClear = this.suggestions.length + 4; // borders + hint
    for (let i = 0; i < linesToClear; i++) {
      process.stdout.write(ANSI.cursorUp(1) + ANSI.clearLine);
    }

    this.isShowingSuggestions = false;
    this.suggestions = [];
    this.selectedSuggestion = -1;
  }

  /**
   * Create a styled welcome banner
   * @param {Object} config - Banner configuration
   * @returns {string} Formatted banner
   */
  createWelcomeBanner(config = {}) {
    const {
      title = 'Grok Code',
      version = '2.0.0',
      subtitle = 'AI-Powered Coding Assistant',
      user = process.env.USER || 'Developer',
      organization = '',
      workingDir = process.cwd(),
    } = config;

    const lines = [];
    // Make banner responsive - use 60% of terminal width, min 40, max 70
    const contentWidth = Math.min(70, Math.max(40, Math.floor(this.width * 0.6) - 4));

    // Top border
    lines.push(`${BOX.topLeft}${BOX.horizontal.repeat(contentWidth)}${BOX.topRight}`);

    // Title line
    const titleLine = `${title} v${version}`;
    const titlePadding = Math.floor((contentWidth - titleLine.length) / 2);
    lines.push(`${BOX.vertical}${' '.repeat(titlePadding)}${ANSI.bold}${titleLine}${ANSI.reset}${' '.repeat(contentWidth - titlePadding - titleLine.length)}${BOX.vertical}`);

    // Empty line
    lines.push(`${BOX.vertical}${' '.repeat(contentWidth)}${BOX.vertical}`);

    // Welcome message
    const welcomeLine = `Welcome back ${user}!`;
    const welcomePadding = Math.floor((contentWidth - welcomeLine.length) / 2);
    lines.push(`${BOX.vertical}${' '.repeat(welcomePadding)}${welcomeLine}${' '.repeat(contentWidth - welcomePadding - welcomeLine.length)}${BOX.vertical}`);

    // Organization if present
    if (organization) {
      const orgPadding = Math.floor((contentWidth - organization.length) / 2);
      lines.push(`${BOX.vertical}${' '.repeat(orgPadding)}${ANSI.dim}${organization}${ANSI.reset}${' '.repeat(contentWidth - orgPadding - organization.length)}${BOX.vertical}`);
    }

    // Working directory
    const dirLine = workingDir.length > contentWidth - 4
      ? `...${workingDir.slice(-(contentWidth - 7))}`
      : workingDir;
    const dirPadding = Math.floor((contentWidth - dirLine.length) / 2);
    lines.push(`${BOX.vertical}${' '.repeat(dirPadding)}${ANSI.dim}${dirLine}${ANSI.reset}${' '.repeat(contentWidth - dirPadding - dirLine.length)}${BOX.vertical}`);

    // Bottom border
    lines.push(`${BOX.bottomLeft}${BOX.horizontal.repeat(contentWidth)}${BOX.bottomRight}`);

    return lines.join('\n');
  }

  /**
   * Create a tips panel (side panel like Claude Code)
   * @param {Array} tips - Array of tip strings
   * @param {string} header - Panel header
   * @returns {string} Formatted tips panel
   */
  createTipsPanel(tips = [], header = 'Tips for getting started') {
    // Make tips panel responsive - min 30, max 40, or 30% of terminal
    const maxWidth = Math.min(40, Math.max(30, Math.floor(this.width * 0.3)));
    const lines = [];

    // Border with header
    const headerPadding = Math.max(0, maxWidth - header.length - 4);
    lines.push(`${ANSI.yellow}${BOX.vertical}${ANSI.reset} ${ANSI.bold}${header}${ANSI.reset}`);

    // Separator
    lines.push(`${ANSI.yellow}${BOX.vertical}${ANSI.reset} ${ANSI.dim}${BOX.horizontal.repeat(maxWidth - 2)}${ANSI.reset}`);

    // Tips
    for (const tip of tips) {
      const wrappedLines = this.wrapText(tip, maxWidth - 4);
      for (const line of wrappedLines) {
        lines.push(`${ANSI.yellow}${BOX.vertical}${ANSI.reset} ${line}`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Wrap text to a specified width
   * @param {string} text - Text to wrap
   * @param {number} width - Max width
   * @returns {Array} Wrapped lines
   */
  wrapText(text, width) {
    const words = text.split(' ');
    const lines = [];
    let currentLine = '';

    for (const word of words) {
      if (currentLine.length + word.length + 1 <= width) {
        currentLine += (currentLine ? ' ' : '') + word;
      } else {
        if (currentLine) lines.push(currentLine);
        currentLine = word;
      }
    }
    if (currentLine) lines.push(currentLine);

    return lines;
  }

  /**
   * Display the welcome screen
   * @param {Object} config - Welcome screen configuration
   */
  displayWelcome(config = {}) {
    const banner = this.createWelcomeBanner(config);

    const tips = config.tips || [
      'Run /init to create a GROK.md',
      '/help for available commands',
      '/model to switch AI models',
    ];

    const tipsPanel = this.createTipsPanel(tips);

    // Display banner and tips side by side if there's enough space, otherwise stack
    const bannerLines = banner.split('\n');
    const tipsLines = tipsPanel.split('\n');
    const maxLines = Math.max(bannerLines.length, tipsLines.length);

    // Calculate banner width from actual content
    const bannerWidth = Math.max(...bannerLines.map(line => this.stripAnsi(line).length));
    const tipsWidth = 38; // Tips panel width
    const minSideBySideWidth = bannerWidth + tipsWidth + 4;

    console.log('');

    if (this.width >= minSideBySideWidth) {
      // Side by side layout
      for (let i = 0; i < maxLines; i++) {
        const bannerLine = bannerLines[i] || '';
        const tipsLine = tipsLines[i] || '';
        const padding = Math.max(0, bannerWidth - this.stripAnsi(bannerLine).length + 2);

        console.log(`${bannerLine}${' '.repeat(padding)}${tipsLine}`);
      }
    } else {
      // Stacked layout for narrow terminals
      for (const line of bannerLines) {
        console.log(line);
      }
      console.log('');
      for (const line of tipsLines) {
        console.log(line);
      }
    }

    console.log('');
  }

  /**
   * Strip ANSI codes from string (for length calculation)
   * @param {string} str - String with ANSI codes
   * @returns {string} String without ANSI codes
   */
  stripAnsi(str) {
    return str.replace(/\x1b\[[0-9;]*m/g, '');
  }

  /**
   * Create an interactive input prompt with autocomplete
   * @param {Object} options - Prompt options
   * @returns {Promise<string>} User input
   */
  async prompt(options = {}) {
    const {
      message = this.options.promptSymbol,
      defaultValue = '',
      autocomplete = true,
    } = options;

    return new Promise((resolve, reject) => {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        completer: autocomplete ? (line) => {
          const suggestions = this.getSuggestions(line);
          const completions = suggestions.map(s => s.value.startsWith('/') ? s.value : `/${s.value}`);
          return [completions, line];
        } : undefined,
      });

      // Handle Tab for suggestion selection or permission cycling
      const originalWrite = process.stdout.write.bind(process.stdout);

      rl.on('line', (input) => {
        this.commandHistory.push(input);
        rl.close();
        resolve(input);
      });

      rl.on('close', () => {
        resolve('');
      });

      rl.on('SIGINT', () => {
        rl.close();
        reject(new Error('User interrupted'));
      });

      // Show prompt
      rl.setPrompt(`${message} `);
      rl.prompt();

      // Update status line
      this.updateStatusLine();
    });
  }

  /**
   * Show a confirmation dialog
   * @param {string} message - Confirmation message
   * @param {Object} options - Dialog options
   * @returns {Promise<boolean>} User choice
   */
  async confirm(message, options = {}) {
    const {
      defaultValue = false,
      yesLabel = 'Yes',
      noLabel = 'No',
    } = options;

    const defaultIndicator = defaultValue ? `[${yesLabel}]/no` : `yes/[${noLabel}]`;

    return new Promise((resolve) => {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      rl.question(`${message} (${defaultIndicator}): `, (answer) => {
        rl.close();
        const normalized = answer.toLowerCase().trim();

        if (normalized === '' && defaultValue !== undefined) {
          resolve(defaultValue);
        } else if (normalized === 'y' || normalized === 'yes') {
          resolve(true);
        } else if (normalized === 'n' || normalized === 'no') {
          resolve(false);
        } else {
          resolve(defaultValue);
        }
      });
    });
  }

  /**
   * Show a selection menu
   * @param {string} message - Menu message
   * @param {Array} choices - Array of choices
   * @param {Object} options - Menu options
   * @returns {Promise<any>} Selected choice
   */
  async select(message, choices, options = {}) {
    const {
      defaultIndex = 0,
    } = options;

    console.log(`\n${message}\n`);

    // Display choices
    choices.forEach((choice, index) => {
      const label = typeof choice === 'string' ? choice : choice.label;
      const indicator = index === defaultIndex ? ANSI.green + '>' : ' ';
      console.log(`  ${indicator} ${index + 1}. ${label}${ANSI.reset}`);
    });

    console.log(`\n${ANSI.dim}Enter number (1-${choices.length}) or press Enter for default:${ANSI.reset}`);

    return new Promise((resolve) => {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      rl.question('> ', (answer) => {
        rl.close();

        const num = parseInt(answer, 10);
        if (!isNaN(num) && num >= 1 && num <= choices.length) {
          resolve(choices[num - 1]);
        } else {
          resolve(choices[defaultIndex]);
        }
      });
    });
  }

  /**
   * Clear the terminal
   */
  clear() {
    process.stdout.write(ANSI.clearScreen + ANSI.cursorHome);
  }

  /**
   * Print a horizontal separator
   * @param {string} char - Character to use for separator
   */
  separator(char = BOX.horizontal) {
    console.log(ANSI.dim + char.repeat(this.width) + ANSI.reset);
  }

  /**
   * Print styled text
   * @param {string} text - Text to print
   * @param {Object} styles - Style options
   */
  print(text, styles = {}) {
    let output = '';

    if (styles.bold) output += ANSI.bold;
    if (styles.dim) output += ANSI.dim;
    if (styles.italic) output += ANSI.italic;
    if (styles.underline) output += ANSI.underline;
    if (styles.color) output += ANSI[styles.color] || '';

    output += text + ANSI.reset;

    console.log(output);
  }

  /**
   * Print a success message
   * @param {string} message - Message text
   */
  success(message) {
    console.log(`${ANSI.green}${message}${ANSI.reset}`);
  }

  /**
   * Print an error message
   * @param {string} message - Message text
   */
  error(message) {
    console.log(`${ANSI.red}${message}${ANSI.reset}`);
  }

  /**
   * Print a warning message
   * @param {string} message - Message text
   */
  warn(message) {
    console.log(`${ANSI.yellow}${message}${ANSI.reset}`);
  }

  /**
   * Print an info message
   * @param {string} message - Message text
   */
  info(message) {
    console.log(`${ANSI.cyan}${message}${ANSI.reset}`);
  }
}

/**
 * Interactive Prompt with real-time autocomplete
 * More advanced than basic readline prompt
 */
export class InteractivePrompt extends EventEmitter {
  constructor(terminalUI, options = {}) {
    super();

    this.ui = terminalUI;
    this.options = {
      prompt: '> ',
      autocomplete: true,
      history: true,
      ...options,
    };

    this.buffer = '';
    this.cursorPos = 0;
    this.historyIndex = -1;
    this.history = [];
    this.suggestions = [];
    this.selectedSuggestion = -1;
    this.isActive = false;
    this.lastSuggestionLines = 0; // Track rendered suggestion lines for cleanup
  }

  /**
   * Start the interactive prompt
   * @returns {Promise<string>} User input
   */
  async start() {
    return new Promise((resolve, reject) => {
      this.isActive = true;
      this.buffer = '';
      this.cursorPos = 0;
      this.selectedSuggestion = -1;
      this.suggestions = [];
      this.lastSuggestionLines = 0;
      this.historyIndex = -1;

      // Enable raw mode for real-time key handling
      if (process.stdin.isTTY) {
        process.stdin.setRawMode(true);
      }
      process.stdin.resume();
      process.stdin.setEncoding('utf8');

      // Show initial prompt
      this.render();

      const onData = (key) => {
        if (!this.isActive) return;

        // Handle special keys
        if (key === '\u0003') { // Ctrl+C
          this.cleanup();
          reject(new Error('Interrupted'));
          return;
        }

        if (key === '\r' || key === '\n') { // Enter
          if (this.selectedSuggestion >= 0 && this.suggestions.length > 0) {
            // Accept selected suggestion
            const suggestion = this.suggestions[this.selectedSuggestion];
            this.acceptSuggestion(suggestion);
            this.selectedSuggestion = -1;
            this.suggestions = [];
            this.render();
          } else {
            // Submit input
            const input = this.buffer;
            this.history.push(input);
            this.cleanup();
            console.log(''); // New line after input
            resolve(input);
          }
          return;
        }

        if (key === '\t') { // Tab
          if (this.suggestions.length > 0) {
            // Cycle through suggestions
            this.selectedSuggestion = (this.selectedSuggestion + 1) % this.suggestions.length;
            this.render();
          } else if (this.buffer.startsWith('/')) {
            // Get suggestions
            this.suggestions = this.ui.getSuggestions(this.buffer);
            if (this.suggestions.length > 0) {
              this.selectedSuggestion = 0;
              this.render();
            }
          } else {
            // Cycle permission mode when not in command
            this.ui.cyclePermissionMode(1);
            this.render(); // Re-render prompt after permission change
          }
          return;
        }

        if (key === '\u001b[Z') { // Shift+Tab
          if (this.suggestions.length > 0) {
            // Cycle backwards through suggestions
            this.selectedSuggestion = (this.selectedSuggestion - 1 + this.suggestions.length) % this.suggestions.length;
            this.render();
          } else {
            // Cycle permission mode backwards
            this.ui.cyclePermissionMode(-1);
            this.render(); // Re-render prompt after permission change
          }
          return;
        }

        if (key === '\u001b') { // Escape
          if (this.suggestions.length > 0) {
            // Clear suggestions
            this.suggestions = [];
            this.selectedSuggestion = -1;
            this.render();
          }
          return;
        }

        if (key === '\u007f' || key === '\b') { // Backspace
          if (this.cursorPos > 0) {
            this.buffer = this.buffer.slice(0, this.cursorPos - 1) + this.buffer.slice(this.cursorPos);
            this.cursorPos--;
            this.updateSuggestions();
            this.render();
          }
          return;
        }

        if (key === '\u001b[A') { // Up arrow
          if (this.suggestions.length > 0) {
            this.selectedSuggestion = Math.max(0, this.selectedSuggestion - 1);
            this.render();
          } else if (this.history.length > 0) {
            // Navigate history
            if (this.historyIndex < 0) {
              this.historyIndex = this.history.length - 1;
            } else if (this.historyIndex > 0) {
              this.historyIndex--;
            }
            this.buffer = this.history[this.historyIndex] || '';
            this.cursorPos = this.buffer.length;
            this.render();
          }
          return;
        }

        if (key === '\u001b[B') { // Down arrow
          if (this.suggestions.length > 0) {
            this.selectedSuggestion = Math.min(this.suggestions.length - 1, this.selectedSuggestion + 1);
            this.render();
          } else if (this.historyIndex >= 0) {
            // Navigate history
            this.historyIndex++;
            if (this.historyIndex >= this.history.length) {
              this.historyIndex = -1;
              this.buffer = '';
            } else {
              this.buffer = this.history[this.historyIndex] || '';
            }
            this.cursorPos = this.buffer.length;
            this.render();
          }
          return;
        }

        if (key === '\u001b[C') { // Right arrow
          if (this.cursorPos < this.buffer.length) {
            this.cursorPos++;
            this.render();
          }
          return;
        }

        if (key === '\u001b[D') { // Left arrow
          if (this.cursorPos > 0) {
            this.cursorPos--;
            this.render();
          }
          return;
        }

        // Regular character input
        if (key.length === 1 && key >= ' ') {
          this.buffer = this.buffer.slice(0, this.cursorPos) + key + this.buffer.slice(this.cursorPos);
          this.cursorPos++;
          this.updateSuggestions();
          this.render();
        }
      };

      process.stdin.on('data', onData);
      this.cleanupHandler = () => {
        process.stdin.removeListener('data', onData);
      };
    });
  }

  /**
   * Update suggestions based on current input
   */
  updateSuggestions() {
    if (this.options.autocomplete && this.buffer.startsWith('/')) {
      const prevSuggestions = this.suggestions;
      this.suggestions = this.ui.getSuggestions(this.buffer);

      if (this.suggestions.length > 0) {
        // Always show suggestions when available (set to 0 if not already selected)
        if (this.selectedSuggestion < 0) {
          this.selectedSuggestion = 0;
        }
        // Clamp selection to valid range if suggestions list changed
        if (this.selectedSuggestion >= this.suggestions.length) {
          this.selectedSuggestion = 0;
        }
      } else {
        this.selectedSuggestion = -1;
      }
    } else {
      this.suggestions = [];
      this.selectedSuggestion = -1;
    }
  }

  /**
   * Accept a suggestion
   * @param {Object} suggestion - Suggestion to accept
   */
  acceptSuggestion(suggestion) {
    if (suggestion.type === 'command') {
      this.buffer = `/${suggestion.value} `;
    } else {
      // Replace the last word/argument
      const parts = this.buffer.split(/\s+/);
      parts[parts.length - 1] = suggestion.value;
      this.buffer = parts.join(' ') + ' ';
    }
    this.cursorPos = this.buffer.length;
  }

  /**
   * Render the prompt and suggestions
   */
  render() {
    // Clear any previously rendered suggestions first
    if (this.lastSuggestionLines > 0) {
      // Save current cursor position
      process.stdout.write(ANSI.saveCursor);
      // Move down to where suggestions were and clear them
      for (let i = 0; i < this.lastSuggestionLines; i++) {
        process.stdout.write(ANSI.cursorDown(1) + ANSI.clearLine);
      }
      // Restore cursor to input line
      process.stdout.write(ANSI.restoreCursor);
      this.lastSuggestionLines = 0;
    }

    // Clear current line
    process.stdout.write('\r' + ANSI.clearLine);

    // Show prompt and buffer
    process.stdout.write(`${this.options.prompt}${this.buffer}`);

    // Show cursor at correct position
    const cursorOffset = this.buffer.length - this.cursorPos;
    if (cursorOffset > 0) {
      process.stdout.write(ANSI.cursorLeft(cursorOffset));
    }

    // Show suggestions dropdown if any
    if (this.suggestions.length > 0 && this.selectedSuggestion >= 0) {
      // Save cursor position
      process.stdout.write(ANSI.saveCursor);

      // Move down and show suggestions
      console.log('');
      this.ui.renderSuggestions(this.suggestions, this.selectedSuggestion);

      // Track how many lines we rendered (suggestions + borders + hint)
      this.lastSuggestionLines = this.suggestions.length + 4;

      // Restore cursor
      process.stdout.write(ANSI.restoreCursor);
    }
  }

  /**
   * Cleanup and restore terminal state
   */
  cleanup() {
    this.isActive = false;

    // Clear any rendered suggestions before cleanup
    if (this.lastSuggestionLines > 0) {
      process.stdout.write(ANSI.saveCursor);
      for (let i = 0; i < this.lastSuggestionLines; i++) {
        process.stdout.write(ANSI.cursorDown(1) + ANSI.clearLine);
      }
      process.stdout.write(ANSI.restoreCursor);
      this.lastSuggestionLines = 0;
    }

    if (this.cleanupHandler) {
      this.cleanupHandler();
    }
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(false);
    }
  }
}

// Export ANSI codes and box characters for external use
export { ANSI, BOX, PERMISSION_MODES, INPUT_MODES };

export default TerminalUI;
