import fs from 'fs';
import path from 'path';
import { logger } from '../utils/logger.js';

/**
 * Auto-complete System for Commands and File Paths
 * Provides intelligent tab completion for terminal commands and file navigation
 */
export class AutoComplete {
  constructor(options = {}) {
    this.currentDir = options.currentDir || process.cwd();
    this.maxSuggestions = options.maxSuggestions || 10;
    this.includeHidden = options.includeHidden || false;
    this.caseSensitive = options.caseSensitive || false;
    this.fuzzyMatch = options.fuzzyMatch !== false;

    // Command definitions with completion rules
    this.commandDefinitions = {
      // Built-in commands
      help: { type: 'builtin', description: 'Show help information' },
      add: {
        type: 'builtin',
        args: ['file'],
        description: 'Add file to context',
        completer: this.completeFilePath.bind(this),
      },
      remove: {
        type: 'builtin',
        args: ['file'],
        description: 'Remove file from context',
        completer: this.completeFilePath.bind(this),
      },
      scan: {
        type: 'builtin',
        description: 'Scan and add all files to context',
      },
      ls: {
        type: 'builtin',
        args: ['directory'],
        description: 'List files in directory',
        completer: this.completeDirectoryPath.bind(this),
      },
      model: {
        type: 'builtin',
        args: ['model_name'],
        description: 'Change AI model',
        completer: this.completeModelName.bind(this),
      },
      'semantic-search': {
        type: 'builtin',
        args: ['query'],
        description: 'Find relevant files for coding tasks',
      },
      analyze: {
        type: 'builtin',
        args: ['query'],
        description: 'Deep analysis with automatic context building',
      },
      'auto-context': {
        type: 'builtin',
        args: ['setting'],
        description: 'Control automatic context building',
        completer: this.completeAutoContext.bind(this),
      },
      'prune-context': {
        type: 'builtin',
        args: ['action'],
        description: 'Manage context size and token limits',
        completer: this.completePruneAction.bind(this),
      },
      update: { type: 'builtin', description: 'Check for and install updates' },
      run: {
        type: 'builtin',
        args: ['command'],
        description: 'Run shell command',
      },
      git: {
        type: 'builtin',
        args: ['subcommand'],
        description: 'Run git command',
        completer: this.completeGitCommand.bind(this),
      },
      init: { type: 'builtin', description: 'Initialize git repo' },
      commit: {
        type: 'builtin',
        args: ['message'],
        description: 'Commit changes',
      },
      push: { type: 'builtin', description: 'Push to remote' },
      pr: {
        type: 'builtin',
        args: ['title'],
        description: 'Create a pull request',
        completer: this.completePRTemplate.bind(this),
      },
      highlight: {
        type: 'builtin',
        args: ['subcommand'],
        description: 'Control syntax highlighting',
        completer: this.completeHighlightCommand.bind(this),
      },
      diff: {
        type: 'builtin',
        args: ['subcommand'],
        description: 'Color-coded diff display and git integration',
        completer: this.completeDiffCommand.bind(this),
      },
      progress: {
        type: 'builtin',
        args: ['subcommand'],
        description: 'Progress indicators and status displays',
        completer: this.completeProgressCommand.bind(this),
      },
      browse: {
        type: 'builtin',
        args: ['subcommand'],
        description: 'Interactive file browser and navigation',
        completer: this.completeBrowseCommand.bind(this),
      },
      preview: {
        type: 'builtin',
        args: ['subcommand'],
        description: 'Enhanced code preview with line numbers',
        completer: this.completePreviewCommand.bind(this),
      },
      search: {
        type: 'builtin',
        args: ['mode', 'query'],
        description: 'Interactive code search across codebase',
        completer: this.completeSearchCommand.bind(this),
      },
      debug: {
        type: 'builtin',
        args: ['subcommand'],
        description: 'Interactive error analysis and recovery',
        completer: this.completeDebugCommand.bind(this),
      },
      logs: { type: 'builtin', description: 'View recent error logs' },
      clear: { type: 'builtin', description: 'Clear conversation history' },
      undo: { type: 'builtin', description: 'Undo the last file operation' },
      exit: { type: 'builtin', description: 'Quit' },

      // Custom command types
      custom: {
        type: 'custom',
        description: 'User-defined commands from .grok/commands/',
      },
    };

    // Model options
    this.availableModels = [
      'grok-code-fast-1',
      'grok-4-fast-reasoning',
      'grok-4-fast-non-reasoning',
      'grok-beta',
      'grok-3-beta',
      'grok-3-mini-beta',
    ];

    // Cache for file system operations
    this.fileCache = new Map();
    this.cacheTimeout = 5000; // 5 seconds

    logger.info('Auto-complete system initialized', {
      currentDir: this.currentDir,
      maxSuggestions: this.maxSuggestions,
    });
  }

  /**
   * Get completions for a given input line
   * @param {string} line - Current input line
   * @param {number} cursorPosition - Cursor position in the line
   * @param {Object} context - Additional context (currentDir, fileContext, etc.)
   * @returns {Object} Completion results
   */
  getCompletions(line, cursorPosition, context = {}) {
    try {
      // Update current directory if provided
      if (context.currentDir) {
        this.currentDir = context.currentDir;
      }

      // Extract the current word being typed
      const { prefix, word, isCommand } = this.parseInput(line, cursorPosition);

      if (!word) {
        return { completions: [], prefix: '' };
      }

      let completions = [];

      if (isCommand) {
        // Complete command names
        completions = this.completeCommand(word, context);
      } else if (line.startsWith('/')) {
        // Complete command arguments
        completions = this.completeCommandArgs(line, word, context);
      } else {
        // Complete general input (could be files or other)
        completions = this.completeGeneral(word, context);
      }

      // Sort and limit completions
      completions = this.sortAndLimit(completions, word);

      return {
        completions,
        prefix: prefix || '',
        word: word,
        isCommand,
      };
    } catch (error) {
      logger.warn('Auto-complete error', {
        error: error.message,
        line,
        cursorPosition,
      });
      return { completions: [], prefix: '', word: '', isCommand: false };
    }
  }

  /**
   * Parse input line to extract current word and context
   * @param {string} line - Input line
   * @param {number} cursorPosition - Cursor position
   * @returns {Object} Parsed input information
   */
  parseInput(line, cursorPosition) {
    const beforeCursor = line.substring(0, cursorPosition);
    const afterCursor = line.substring(cursorPosition);

    // Find word boundaries
    const wordMatch = beforeCursor.match(/(\S+)$/);
    const word = wordMatch ? wordMatch[1] : '';
    const prefix = wordMatch
      ? beforeCursor.substring(0, wordMatch.index)
      : beforeCursor;

    // Check if we're completing a command
    const isCommand =
      beforeCursor.trim() === '/' ||
      (beforeCursor.startsWith('/') && !beforeCursor.includes(' '));

    return { prefix, word, isCommand };
  }

  /**
   * Complete command names
   * @param {string} word - Partial command name
   * @param {Object} context - Completion context
   * @returns {Array} Command completions
   */
  completeCommand(word, context) {
    const commands = Object.keys(this.commandDefinitions);
    const customCommands = this.getCustomCommands(context);

    const allCommands = [...commands, ...customCommands];

    return allCommands
      .filter((cmd) => this.matches(word, cmd))
      .map((cmd) => ({
        value: cmd,
        display: cmd,
        type: 'command',
        description: this.getCommandDescription(cmd),
        priority: this.getCommandPriority(cmd),
      }));
  }

  /**
   * Complete command arguments
   * @param {string} line - Full command line
   * @param {string} word - Current word being completed
   * @param {Object} context - Completion context
   * @returns {Array} Argument completions
   */
  completeCommandArgs(line, word, context) {
    const parts = line.split(/\s+/).filter((p) => p.length > 0);
    const command = parts[0].substring(1); // Remove leading /
    const argIndex = parts.length - 1;

    if (!this.commandDefinitions[command]) {
      return [];
    }

    const cmdDef = this.commandDefinitions[command];
    if (cmdDef.completer) {
      return cmdDef.completer(word, argIndex, parts.slice(1), context);
    }

    // Default argument completion based on command type
    switch (command) {
      case 'add':
      case 'remove':
        return this.completeFilePath(word, context);
      case 'ls':
        return this.completeDirectoryPath(word, context);
      case 'model':
        return this.completeModelName(word, context);
      default:
        return [];
    }
  }

  /**
   * Complete file paths
   * @param {string} word - Partial file path
   * @param {Object} context - Completion context
   * @returns {Array} File path completions
   */
  completeFilePath(word, context = {}) {
    try {
      const { dir, base } = this.parsePath(word);
      const fullDir = path.isAbsolute(dir)
        ? dir
        : path.join(this.currentDir, dir);

      if (!fs.existsSync(fullDir)) {
        return [];
      }

      const items = fs.readdirSync(fullDir, { withFileTypes: true });
      const showHidden = this.includeHidden || word.startsWith('.');

      return items
        .filter((item) => {
          if (!showHidden && item.name.startsWith('.')) return false;
          if (!this.caseSensitive) {
            return item.name.toLowerCase().startsWith(base.toLowerCase());
          }
          return item.name.startsWith(base);
        })
        .map((item) => {
          const fullPath = path.join(fullDir, item.name);
          const relativePath = path.relative(this.currentDir, fullPath);
          const displayPath = item.isDirectory() ? `${item.name}/` : item.name;

          return {
            value: relativePath + (item.isDirectory() ? '/' : ''),
            display: displayPath,
            type: item.isDirectory() ? 'directory' : 'file',
            description: this.getFileDescription(fullPath, item),
            priority: item.isDirectory() ? 2 : 1,
          };
        });
    } catch (error) {
      logger.debug('File path completion error', {
        word,
        error: error.message,
      });
      return [];
    }
  }

  /**
   * Complete directory paths
   * @param {string} word - Partial directory path
   * @param {Object} context - Completion context
   * @returns {Array} Directory path completions
   */
  completeDirectoryPath(word, context = {}) {
    try {
      const completions = this.completeFilePath(word, context);
      return completions.filter((comp) => comp.type === 'directory');
    } catch (error) {
      logger.debug('Directory path completion error', {
        word,
        error: error.message,
      });
      return [];
    }
  }

  /**
   * Complete model names
   * @param {string} word - Partial model name
   * @param {Object} context - Completion context
   * @returns {Array} Model name completions
   */
  completeModelName(word, context = {}) {
    return this.availableModels
      .filter((model) => this.matches(word, model))
      .map((model) => ({
        value: model,
        display: model,
        type: 'model',
        description: this.getModelDescription(model),
        priority: 3,
      }));
  }

  /**
   * Complete auto-context settings
   * @param {string} word - Partial setting
   * @param {Object} context - Completion context
   * @returns {Array} Setting completions
   */
  completeAutoContext(word, argIndex, args, context) {
    const settings = ['on', 'off', 'status', 'clear'];

    if (argIndex === 0) {
      return settings
        .filter((setting) => this.matches(word, setting))
        .map((setting) => ({
          value: setting,
          display: setting,
          type: 'setting',
          description: `Turn auto-context ${setting}`,
          priority: 3,
        }));
    }

    return [];
  }

  /**
   * Complete prune actions
   * @param {string} word - Partial action
   * @param {Object} context - Completion context
   * @returns {Array} Action completions
   */
  completePruneAction(word, argIndex, args, context) {
    const actions = ['status', 'prune', 'strategy', 'auto'];

    return actions
      .filter((action) => this.matches(word, action))
      .map((action) => ({
        value: action,
        display: action,
        type: 'action',
        description: `Context pruning: ${action}`,
        priority: 3,
      }));
  }

  /**
   * Complete git commands
   * @param {string} word - Partial git command
   * @param {Object} context - Completion context
   * @returns {Array} Git command completions
   */
  completeGitCommand(word, argIndex, args, context) {
    const commonCommands = [
      'status',
      'add',
      'commit',
      'push',
      'pull',
      'fetch',
      'merge',
      'branch',
      'checkout',
      'log',
      'diff',
      'reset',
      'stash',
      'clone',
      'init',
    ];

    return commonCommands
      .filter((cmd) => this.matches(word, cmd))
      .map((cmd) => ({
        value: cmd,
        display: cmd,
        type: 'git-command',
        description: `git ${cmd}`,
        priority: 2,
      }));
  }

  /**
   * Complete highlight commands
   * @param {string} word - Partial highlight command
   * @param {Object} context - Completion context
   * @returns {Array} Highlight command completions
   */
  completeHighlightCommand(word, argIndex, args, context) {
    if (argIndex === 0) {
      const commands = ['on', 'off', 'theme', 'status'];
      return commands
        .filter((cmd) => this.matches(word, cmd))
        .map((cmd) => ({
          value: cmd,
          display: cmd,
          type: 'highlight-command',
          description: `Syntax highlighting: ${cmd}`,
          priority: 3,
        }));
    } else if (args[0] === 'theme') {
      // Theme names would come from syntax highlighter
      const themes = ['default', 'dark', 'minimal'];
      return themes
        .filter((theme) => this.matches(word, theme))
        .map((theme) => ({
          value: theme,
          display: theme,
          type: 'theme',
          description: `Color theme: ${theme}`,
          priority: 3,
        }));
    }

    return [];
  }

  /**
   * Complete diff commands
   * @param {string} word - Partial diff command
   * @param {Object} context - Completion context
   * @returns {Array} Diff command completions
   */
  completeDiffCommand(word, argIndex, args, context) {
    const commands = ['status', 'test', 'git', 'show'];

    return commands
      .filter((cmd) => this.matches(word, cmd))
      .map((cmd) => ({
        value: cmd,
        display: cmd,
        type: 'diff-command',
        description: `Diff operation: ${cmd}`,
        priority: 3,
      }));
  }

  /**
   * Complete progress commands
   * @param {string} word - Partial progress command
   * @param {Object} context - Completion context
   * @returns {Array} Progress command completions
   */
  completeProgressCommand(word, argIndex, args, context) {
    const commands = ['status', 'test', 'spinner', 'multistep'];

    return commands
      .filter((cmd) => this.matches(word, cmd))
      .map((cmd) => ({
        value: cmd,
        display: cmd,
        type: 'progress-command',
        description: `Progress display: ${cmd}`,
        priority: 3,
      }));
  }

  /**
   * Complete browse commands
   * @param {string} word - Partial browse command
   * @param {Object} context - Completion context
   * @returns {Array} Browse command completions
   */
  completeBrowseCommand(word, argIndex, args, context) {
    const commands = ['start', 'find', 'preview', 'stats'];

    return commands
      .filter((cmd) => this.matches(word, cmd))
      .map((cmd) => ({
        value: cmd,
        display: cmd,
        type: 'browse-command',
        description: `File browser: ${cmd}`,
        priority: 3,
      }));
  }

  /**
   * Complete preview commands
   * @param {string} word - Partial preview command
   * @param {Object} context - Completion context
   * @returns {Array} Preview command completions
   */
  completePreviewCommand(word, argIndex, args, context) {
    const commands = ['file', 'code', 'line', 'search', 'config'];

    return commands
      .filter((cmd) => this.matches(word, cmd))
      .map((cmd) => ({
        value: cmd,
        display: cmd,
        type: 'preview-command',
        description: `Code preview: ${cmd}`,
        priority: 3,
      }));
  }

  /**
   * Complete search commands
   * @param {string} word - Partial search command
   * @param {Object} context - Completion context
   * @returns {Array} Search command completions
   */
  completeSearchCommand(word, argIndex, args, context) {
    if (argIndex === 0) {
      const modes = [
        'query',
        'regex',
        'word',
        'fuzzy',
        'interactive',
        'history',
        'stats',
      ];
      return modes
        .filter((mode) => this.matches(word, mode))
        .map((mode) => ({
          value: mode,
          display: mode,
          type: 'search-mode',
          description: `Search mode: ${mode}`,
          priority: 3,
        }));
    }

    return [];
  }

  /**
   * Complete debug commands
   * @param {string} word - Partial debug command
   * @param {Object} context - Completion context
   * @returns {Array} Debug command completions
   */
  completeDebugCommand(word, argIndex, args, context) {
    const commands = [
      'interactive',
      'file',
      'errors',
      'fix',
      'history',
      'stats',
    ];

    return commands
      .filter((cmd) => this.matches(word, cmd))
      .map((cmd) => ({
        value: cmd,
        display: cmd,
        type: 'debug-command',
        description: `Debug operation: ${cmd}`,
        priority: 3,
      }));
  }

  /**
   * Complete PR templates
   * @param {string} word - Partial template
   * @param {Object} context - Completion context
   * @returns {Array} Template completions
   */
  completePRTemplate(word, argIndex, args, context) {
    // Could integrate with GitHub PR templates if available
    const templates = ['feature', 'bugfix', 'docs', 'refactor'];

    return templates
      .filter((template) => this.matches(word, template))
      .map((template) => ({
        value: template,
        display: template,
        type: 'pr-template',
        description: `PR type: ${template}`,
        priority: 2,
      }));
  }

  /**
   * Complete general input (fallback)
   * @param {string} word - Partial input
   * @param {Object} context - Completion context
   * @returns {Array} General completions
   */
  completeGeneral(word, context) {
    // Try file completion first
    const fileCompletions = this.completeFilePath(word, context);
    if (fileCompletions.length > 0) {
      return fileCompletions;
    }

    // Fallback to fuzzy matching against commands
    return this.completeCommand(word, context);
  }

  /**
   * Parse path into directory and base name
   * @param {string} inputPath - Input path
   * @returns {Object} Parsed path components
   */
  parsePath(inputPath) {
    const normalizedPath = path.normalize(inputPath);
    const dir = path.dirname(normalizedPath);
    const base = path.basename(normalizedPath);

    // Handle special cases
    if (inputPath.endsWith('/')) {
      return { dir: normalizedPath, base: '' };
    }

    return { dir, base };
  }

  /**
   * Get custom commands from .grok/commands directory
   * @param {Object} context - Completion context
   * @returns {Array} Custom command names
   */
  getCustomCommands(context) {
    try {
      const cmdDir = path.join(this.currentDir, '.grok', 'commands');
      if (!fs.existsSync(cmdDir)) return [];

      return fs
        .readdirSync(cmdDir)
        .filter((file) => file.endsWith('.txt'))
        .map((file) => file.replace('.txt', ''));
    } catch (error) {
      return [];
    }
  }

  /**
   * Get description for a command
   * @param {string} command - Command name
   * @returns {string} Command description
   */
  getCommandDescription(command) {
    const cmdDef = this.commandDefinitions[command];
    return cmdDef ? cmdDef.description : 'Custom command';
  }

  /**
   * Get priority for a command (higher = more important)
   * @param {string} command - Command name
   * @returns {number} Priority score
   */
  getCommandPriority(command) {
    const cmdDef = this.commandDefinitions[command];
    if (!cmdDef) return 1;

    switch (cmdDef.type) {
      case 'builtin':
        return 3;
      case 'custom':
        return 2;
      default:
        return 1;
    }
  }

  /**
   * Get description for a file
   * @param {string} fullPath - Full file path
   * @param {Object} item - fs.Dirent item
   * @returns {string} File description
   */
  getFileDescription(fullPath, item) {
    try {
      const stats = fs.statSync(fullPath);
      const size = this.formatFileSize(stats.size);
      const mtime = stats.mtime.toLocaleDateString();

      if (item.isDirectory()) {
        return `Directory (${size} items, modified ${mtime})`;
      } else {
        return `File (${size}, modified ${mtime})`;
      }
    } catch (error) {
      return item.isDirectory() ? 'Directory' : 'File';
    }
  }

  /**
   * Get description for a model
   * @param {string} model - Model name
   * @returns {string} Model description
   */
  getModelDescription(model) {
    const descriptions = {
      'grok-code-fast-1': 'Optimized for coding tasks',
      'grok-4-fast-reasoning': 'Fast reasoning model',
      'grok-4-fast-non-reasoning': 'Fast non-reasoning model',
      'grok-beta': 'Original Grok model',
      'grok-3-beta': 'Legacy Grok 3 model',
      'grok-3-mini-beta': 'Compact Grok 3 model',
    };

    return descriptions[model] || 'Grok AI model';
  }

  /**
   * Format file size
   * @param {number} bytes - File size in bytes
   * @returns {string} Formatted size
   */
  formatFileSize(bytes) {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(1)} ${units[unitIndex]}`;
  }

  /**
   * Check if a string matches another (with fuzzy matching)
   * @param {string} pattern - Pattern to match against
   * @param {string} target - Target string
   * @returns {boolean} Whether they match
   */
  matches(pattern, target) {
    if (!pattern) return true;

    if (this.fuzzyMatch) {
      // Simple fuzzy matching - check if all characters in pattern appear in order in target
      let patternIndex = 0;
      const targetLower = this.caseSensitive ? target : target.toLowerCase();
      const patternLower = this.caseSensitive ? pattern : pattern.toLowerCase();

      for (const char of targetLower) {
        if (char === patternLower[patternIndex]) {
          patternIndex++;
          if (patternIndex === patternLower.length) {
            return true;
          }
        }
      }
      return false;
    } else {
      // Exact prefix matching
      return this.caseSensitive
        ? target.startsWith(pattern)
        : target.toLowerCase().startsWith(pattern.toLowerCase());
    }
  }

  /**
   * Sort and limit completions
   * @param {Array} completions - Raw completions
   * @param {string} word - Original word being completed
   * @returns {Array} Sorted and limited completions
   */
  sortAndLimit(completions, word) {
    return completions
      .sort((a, b) => {
        // Sort by priority first, then alphabetically
        if (a.priority !== b.priority) {
          return b.priority - a.priority;
        }
        return a.display.localeCompare(b.display);
      })
      .slice(0, this.maxSuggestions);
  }

  /**
   * Get completion statistics
   * @returns {Object} Statistics
   */
  getStats() {
    return {
      maxSuggestions: this.maxSuggestions,
      includeHidden: this.includeHidden,
      caseSensitive: this.caseSensitive,
      fuzzyMatch: this.fuzzyMatch,
      availableCommands: Object.keys(this.commandDefinitions).length,
      availableModels: this.availableModels.length,
      cacheSize: this.fileCache.size,
    };
  }

  /**
   * Clear file system cache
   */
  clearCache() {
    this.fileCache.clear();
    logger.debug('Auto-complete cache cleared');
  }

  /**
   * Update configuration
   * @param {Object} options - New configuration options
   */
  updateConfig(options = {}) {
    if (options.maxSuggestions !== undefined) {
      this.maxSuggestions = options.maxSuggestions;
    }
    if (options.includeHidden !== undefined) {
      this.includeHidden = options.includeHidden;
    }
    if (options.caseSensitive !== undefined) {
      this.caseSensitive = options.caseSensitive;
    }
    if (options.fuzzyMatch !== undefined) {
      this.fuzzyMatch = options.fuzzyMatch;
    }

    logger.info('Auto-complete configuration updated', options);
  }
}
