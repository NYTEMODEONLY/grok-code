/**
 * Streaming Response Handler
 * Real-time streaming output with token counting and progress display
 */

import { EventEmitter } from 'events';

export class StreamingHandler extends EventEmitter {
  constructor(options = {}) {
    super();

    this.buffer = '';
    this.tokenCount = 0;
    this.startTime = null;
    this.isStreaming = false;

    // Display options
    this.showTokens = options.showTokens ?? true;
    this.showSpeed = options.showSpeed ?? true;
    this.colorEnabled = options.colorEnabled ?? true;

    // Token estimation (rough: ~4 chars per token)
    this.charsPerToken = 4;

    // Spinner for streaming indication
    this.spinnerFrames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    this.spinnerIndex = 0;
    this.spinnerInterval = null;
  }

  /**
   * Start streaming
   */
  start() {
    this.buffer = '';
    this.tokenCount = 0;
    this.startTime = Date.now();
    this.isStreaming = true;

    // Start spinner
    this.startSpinner();

    this.emit('start');
  }

  /**
   * Process a chunk of streamed content
   * @param {string} chunk - Content chunk
   */
  processChunk(chunk) {
    if (!this.isStreaming) return;

    this.buffer += chunk;

    // Estimate tokens for this chunk
    const chunkTokens = Math.ceil(chunk.length / this.charsPerToken);
    this.tokenCount += chunkTokens;

    // Write to stdout
    process.stdout.write(chunk);

    this.emit('chunk', { chunk, totalTokens: this.tokenCount });
  }

  /**
   * End streaming
   */
  end() {
    this.isStreaming = false;
    this.stopSpinner();

    const duration = Date.now() - this.startTime;
    const tokensPerSecond = (this.tokenCount / (duration / 1000)).toFixed(1);

    // Print newline
    console.log('');

    // Show stats
    if (this.showTokens || this.showSpeed) {
      const stats = [];
      if (this.showTokens) {
        stats.push(`${this.tokenCount} tokens`);
      }
      if (this.showSpeed) {
        stats.push(`${tokensPerSecond} tok/s`);
      }
      stats.push(`${(duration / 1000).toFixed(1)}s`);

      const statsLine = this.colorEnabled
        ? `\x1b[90m[${stats.join(' | ')}]\x1b[0m`
        : `[${stats.join(' | ')}]`;

      console.log(statsLine);
    }

    this.emit('end', {
      content: this.buffer,
      tokens: this.tokenCount,
      duration,
      tokensPerSecond: parseFloat(tokensPerSecond)
    });

    return this.buffer;
  }

  /**
   * Start the spinner animation
   */
  startSpinner() {
    if (this.spinnerInterval) return;

    this.spinnerInterval = setInterval(() => {
      const frame = this.spinnerFrames[this.spinnerIndex];
      process.stdout.write(`\r${frame} `);
      this.spinnerIndex = (this.spinnerIndex + 1) % this.spinnerFrames.length;
    }, 80);
  }

  /**
   * Stop the spinner animation
   */
  stopSpinner() {
    if (this.spinnerInterval) {
      clearInterval(this.spinnerInterval);
      this.spinnerInterval = null;
      process.stdout.write('\r  \r'); // Clear spinner
    }
  }

  /**
   * Get current stats
   * @returns {Object} Current streaming stats
   */
  getStats() {
    const duration = this.startTime ? Date.now() - this.startTime : 0;
    return {
      isStreaming: this.isStreaming,
      tokenCount: this.tokenCount,
      duration,
      bufferLength: this.buffer.length,
      tokensPerSecond: duration > 0 ? (this.tokenCount / (duration / 1000)) : 0
    };
  }

  /**
   * Abort streaming
   */
  abort() {
    this.isStreaming = false;
    this.stopSpinner();
    this.emit('abort', { tokens: this.tokenCount });
  }
}

/**
 * Token Counter - Estimates and tracks token usage
 */
export class TokenCounter {
  constructor(options = {}) {
    // Model-specific context limits
    this.modelLimits = {
      'grok-code-fast-1': 128000,
      'grok-4': 256000,
      'grok-4-vision': 128000,
      'grok-3': 128000,
      'grok-3-mini': 32000,
      'default': 128000
    };

    this.currentModel = options.model || 'grok-code-fast-1';
    this.charsPerToken = options.charsPerToken || 4;

    // Usage tracking
    this.sessionTokens = {
      input: 0,
      output: 0,
      total: 0
    };

    this.requestHistory = [];
  }

  /**
   * Estimate tokens for text
   * @param {string} text - Text to estimate
   * @returns {number} Estimated token count
   */
  estimate(text) {
    if (!text) return 0;
    return Math.ceil(text.length / this.charsPerToken);
  }

  /**
   * Estimate tokens for messages array
   * @param {Array} messages - Messages array
   * @returns {number} Estimated token count
   */
  estimateMessages(messages) {
    let total = 0;

    for (const msg of messages) {
      // Role overhead (~4 tokens)
      total += 4;

      // Content
      if (typeof msg.content === 'string') {
        total += this.estimate(msg.content);
      } else if (Array.isArray(msg.content)) {
        for (const part of msg.content) {
          if (part.type === 'text') {
            total += this.estimate(part.text);
          } else if (part.type === 'image') {
            // Images are roughly 85-170 tokens depending on size
            total += 100;
          }
        }
      }

      // Tool calls
      if (msg.tool_calls) {
        for (const call of msg.tool_calls) {
          total += this.estimate(call.function.name);
          total += this.estimate(call.function.arguments);
        }
      }
    }

    return total;
  }

  /**
   * Get context limit for current model
   * @returns {number} Token limit
   */
  getLimit() {
    return this.modelLimits[this.currentModel] || this.modelLimits.default;
  }

  /**
   * Check if within budget
   * @param {number} additionalTokens - Tokens to add
   * @returns {Object} Budget check result
   */
  checkBudget(additionalTokens) {
    const limit = this.getLimit();
    const currentUsage = this.sessionTokens.total;
    const newTotal = currentUsage + additionalTokens;

    return {
      withinBudget: newTotal < limit,
      currentUsage,
      additionalTokens,
      newTotal,
      limit,
      remaining: limit - newTotal,
      utilizationPercent: Math.round((newTotal / limit) * 100)
    };
  }

  /**
   * Track token usage from a request
   * @param {Object} usage - Usage object { input, output }
   */
  track(usage) {
    const input = usage.input || usage.prompt_tokens || 0;
    const output = usage.output || usage.completion_tokens || 0;

    this.sessionTokens.input += input;
    this.sessionTokens.output += output;
    this.sessionTokens.total += input + output;

    this.requestHistory.push({
      timestamp: new Date().toISOString(),
      input,
      output,
      total: input + output
    });
  }

  /**
   * Get session summary
   * @returns {Object} Session token summary
   */
  getSummary() {
    const limit = this.getLimit();
    const utilization = Math.round((this.sessionTokens.total / limit) * 100);

    return {
      model: this.currentModel,
      limit,
      input: this.sessionTokens.input,
      output: this.sessionTokens.output,
      total: this.sessionTokens.total,
      remaining: limit - this.sessionTokens.total,
      utilization: `${utilization}%`,
      requests: this.requestHistory.length
    };
  }

  /**
   * Format summary for display
   * @returns {string} Formatted summary
   */
  formatSummary() {
    const s = this.getSummary();

    let output = `\n📊 Token Usage Summary\n`;
    output += `${'═'.repeat(40)}\n`;
    output += `Model: ${s.model}\n`;
    output += `Context Limit: ${s.limit.toLocaleString()} tokens\n`;
    output += `\n`;
    output += `Input Tokens:  ${s.input.toLocaleString()}\n`;
    output += `Output Tokens: ${s.output.toLocaleString()}\n`;
    output += `Total Used:    ${s.total.toLocaleString()}\n`;
    output += `Remaining:     ${s.remaining.toLocaleString()}\n`;
    output += `\n`;
    output += `Utilization: ${s.utilization}\n`;

    // Visual bar
    const barLength = 30;
    const filled = Math.round((parseInt(s.utilization) / 100) * barLength);
    const bar = '█'.repeat(filled) + '░'.repeat(barLength - filled);
    output += `[${bar}]\n`;

    return output;
  }

  /**
   * Reset session counters
   */
  reset() {
    this.sessionTokens = { input: 0, output: 0, total: 0 };
    this.requestHistory = [];
  }

  /**
   * Set model
   * @param {string} model - Model name
   */
  setModel(model) {
    this.currentModel = model;
  }
}

/**
 * Progress Indicator - Shows progress for long operations
 */
export class ProgressIndicator {
  constructor(options = {}) {
    this.total = options.total || 100;
    this.current = 0;
    this.message = options.message || 'Processing';
    this.barLength = options.barLength || 30;
    this.showPercent = options.showPercent ?? true;
    this.showCount = options.showCount ?? true;
    this.colorEnabled = options.colorEnabled ?? true;

    this.startTime = null;
    this.isActive = false;
  }

  /**
   * Start the progress indicator
   * @param {number} total - Total steps
   * @param {string} message - Progress message
   */
  start(total, message) {
    this.total = total || this.total;
    this.message = message || this.message;
    this.current = 0;
    this.startTime = Date.now();
    this.isActive = true;

    this.render();
  }

  /**
   * Update progress
   * @param {number} current - Current step
   * @param {string} message - Optional new message
   */
  update(current, message) {
    this.current = Math.min(current, this.total);
    if (message) this.message = message;
    this.render();
  }

  /**
   * Increment progress
   * @param {number} amount - Amount to increment (default: 1)
   * @param {string} message - Optional new message
   */
  increment(amount = 1, message) {
    this.update(this.current + amount, message);
  }

  /**
   * Render the progress bar
   */
  render() {
    if (!this.isActive) return;

    const percent = Math.round((this.current / this.total) * 100);
    const filled = Math.round((this.current / this.total) * this.barLength);
    const empty = this.barLength - filled;

    let bar = this.colorEnabled
      ? `\x1b[32m${'█'.repeat(filled)}\x1b[90m${'░'.repeat(empty)}\x1b[0m`
      : `${'█'.repeat(filled)}${'░'.repeat(empty)}`;

    let line = `\r${this.message} [${bar}]`;

    if (this.showPercent) {
      line += ` ${percent}%`;
    }

    if (this.showCount) {
      line += ` (${this.current}/${this.total})`;
    }

    // Add ETA if we have progress
    if (this.current > 0 && this.current < this.total) {
      const elapsed = Date.now() - this.startTime;
      const rate = this.current / elapsed;
      const remaining = (this.total - this.current) / rate;
      const eta = Math.round(remaining / 1000);

      if (eta > 0 && eta < 3600) {
        line += ` ETA: ${eta}s`;
      }
    }

    process.stdout.write(line);
  }

  /**
   * Complete the progress
   * @param {string} message - Completion message
   */
  complete(message) {
    this.current = this.total;
    this.render();

    const duration = Date.now() - this.startTime;
    const durationStr = (duration / 1000).toFixed(1);

    console.log(''); // New line

    if (message) {
      const completeMsg = this.colorEnabled
        ? `\x1b[32m✓\x1b[0m ${message} (${durationStr}s)`
        : `✓ ${message} (${durationStr}s)`;
      console.log(completeMsg);
    }

    this.isActive = false;
  }

  /**
   * Fail the progress
   * @param {string} message - Failure message
   */
  fail(message) {
    console.log(''); // New line

    const failMsg = this.colorEnabled
      ? `\x1b[31m✗\x1b[0m ${message || 'Failed'}`
      : `✗ ${message || 'Failed'}`;
    console.log(failMsg);

    this.isActive = false;
  }
}

/**
 * Diff Preview - Shows file changes before applying
 */
export class DiffPreview {
  constructor(options = {}) {
    this.colorEnabled = options.colorEnabled ?? true;
    this.contextLines = options.contextLines || 3;
  }

  /**
   * Generate a diff between old and new content
   * @param {string} oldContent - Original content
   * @param {string} newContent - New content
   * @param {string} filePath - File path for display
   * @returns {string} Formatted diff
   */
  generate(oldContent, newContent, filePath) {
    const oldLines = oldContent.split('\n');
    const newLines = newContent.split('\n');

    const changes = this.computeChanges(oldLines, newLines);

    return this.formatDiff(changes, filePath, oldLines.length, newLines.length);
  }

  /**
   * Compute changes between old and new lines
   * @param {Array} oldLines - Original lines
   * @param {Array} newLines - New lines
   * @returns {Array} Changes array
   */
  computeChanges(oldLines, newLines) {
    const changes = [];

    // Simple diff algorithm (LCS-based would be better for production)
    let i = 0;
    let j = 0;

    while (i < oldLines.length || j < newLines.length) {
      if (i >= oldLines.length) {
        // Remaining new lines are additions
        changes.push({ type: 'add', line: newLines[j], newLineNum: j + 1 });
        j++;
      } else if (j >= newLines.length) {
        // Remaining old lines are deletions
        changes.push({ type: 'remove', line: oldLines[i], oldLineNum: i + 1 });
        i++;
      } else if (oldLines[i] === newLines[j]) {
        // Unchanged
        changes.push({ type: 'same', line: oldLines[i], oldLineNum: i + 1, newLineNum: j + 1 });
        i++;
        j++;
      } else {
        // Look ahead to find if this is a modification or add/remove
        const oldInNew = newLines.indexOf(oldLines[i], j);
        const newInOld = oldLines.indexOf(newLines[j], i);

        if (oldInNew === -1 && newInOld === -1) {
          // Both lines changed
          changes.push({ type: 'remove', line: oldLines[i], oldLineNum: i + 1 });
          changes.push({ type: 'add', line: newLines[j], newLineNum: j + 1 });
          i++;
          j++;
        } else if (oldInNew === -1) {
          // Old line was removed
          changes.push({ type: 'remove', line: oldLines[i], oldLineNum: i + 1 });
          i++;
        } else {
          // New line was added
          changes.push({ type: 'add', line: newLines[j], newLineNum: j + 1 });
          j++;
        }
      }
    }

    return changes;
  }

  /**
   * Format the diff for display
   * @param {Array} changes - Changes array
   * @param {string} filePath - File path
   * @param {number} oldLineCount - Original line count
   * @param {number} newLineCount - New line count
   * @returns {string} Formatted diff
   */
  formatDiff(changes, filePath, oldLineCount, newLineCount) {
    let output = '';

    // Header
    if (this.colorEnabled) {
      output += `\x1b[1m--- ${filePath} (original)\x1b[0m\n`;
      output += `\x1b[1m+++ ${filePath} (modified)\x1b[0m\n`;
    } else {
      output += `--- ${filePath} (original)\n`;
      output += `+++ ${filePath} (modified)\n`;
    }

    // Stats
    const additions = changes.filter(c => c.type === 'add').length;
    const deletions = changes.filter(c => c.type === 'remove').length;

    if (this.colorEnabled) {
      output += `\x1b[32m+${additions}\x1b[0m \x1b[31m-${deletions}\x1b[0m lines\n\n`;
    } else {
      output += `+${additions} -${deletions} lines\n\n`;
    }

    // Show changes with context
    let lastShownIndex = -1;

    for (let i = 0; i < changes.length; i++) {
      const change = changes[i];

      if (change.type === 'same') {
        // Show context around changes
        const isNearChange = this.isNearChange(changes, i, this.contextLines);
        if (isNearChange) {
          if (i > lastShownIndex + 1) {
            output += `\x1b[90m...\x1b[0m\n`;
          }
          output += this.formatLine(change);
          lastShownIndex = i;
        }
      } else {
        if (i > lastShownIndex + 1) {
          output += `\x1b[90m...\x1b[0m\n`;
        }
        output += this.formatLine(change);
        lastShownIndex = i;
      }
    }

    return output;
  }

  /**
   * Check if a line is near a change
   * @param {Array} changes - Changes array
   * @param {number} index - Current index
   * @param {number} distance - Context distance
   * @returns {boolean} Whether near a change
   */
  isNearChange(changes, index, distance) {
    for (let i = Math.max(0, index - distance); i <= Math.min(changes.length - 1, index + distance); i++) {
      if (changes[i].type !== 'same') {
        return true;
      }
    }
    return false;
  }

  /**
   * Format a single line
   * @param {Object} change - Change object
   * @returns {string} Formatted line
   */
  formatLine(change) {
    const lineNum = change.oldLineNum || change.newLineNum || '';
    const numStr = String(lineNum).padStart(4);

    if (this.colorEnabled) {
      switch (change.type) {
        case 'add':
          return `\x1b[32m${numStr} + ${change.line}\x1b[0m\n`;
        case 'remove':
          return `\x1b[31m${numStr} - ${change.line}\x1b[0m\n`;
        default:
          return `\x1b[90m${numStr}   ${change.line}\x1b[0m\n`;
      }
    } else {
      switch (change.type) {
        case 'add':
          return `${numStr} + ${change.line}\n`;
        case 'remove':
          return `${numStr} - ${change.line}\n`;
        default:
          return `${numStr}   ${change.line}\n`;
      }
    }
  }

  /**
   * Preview an edit operation
   * @param {string} filePath - File path
   * @param {string} oldString - String to replace
   * @param {string} newString - Replacement string
   * @param {string} fileContent - Current file content
   * @returns {string} Diff preview
   */
  previewEdit(filePath, oldString, newString, fileContent) {
    const newContent = fileContent.replace(oldString, newString);
    return this.generate(fileContent, newContent, filePath);
  }
}

export default {
  StreamingHandler,
  TokenCounter,
  ProgressIndicator,
  DiffPreview
};
