import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class Logger {
  constructor(options = {}) {
    // Use current working directory for logs, not relative to install location
    this.logDir = options.logDir || path.join(process.cwd(), '.grok');
    this.logFile = path.join(this.logDir, 'app.log');
    this.errorLogFile = path.join(this.logDir, 'error.log');
    this.maxLogSize = options.maxLogSize || 10 * 1024 * 1024; // 10MB
    this.maxLogFiles = options.maxLogFiles || 5;
    this.enableConsoleOutput = options.enableConsoleOutput !== false;
    this.enableFileOutput = options.enableFileOutput !== false;

    // Track initialization status
    this.initialized = false;
    this.fileLoggingEnabled = false;

    try {
      // Ensure log directory exists
      if (this.enableFileOutput && !fs.existsSync(this.logDir)) {
        fs.mkdirSync(this.logDir, { recursive: true });
      }

      // Rotate logs if needed
      if (this.enableFileOutput) {
        this.rotateLogs();
      }

      this.fileLoggingEnabled = true;
      this.initialized = true;
    } catch (error) {
      // Fallback to console-only logging
      this.fileLoggingEnabled = false;
      this.initialized = true;

      if (this.enableConsoleOutput) {
        console.warn(
          '⚠️  Logger initialization failed, falling back to console-only logging:',
          error.message
        );
      }
    }
  }

  /**
   * Log an info message
   */
  info(message, data = null) {
    this.log('INFO', message, data);
  }

  /**
   * Log a warning message
   */
  warn(message, data = null) {
    this.log('WARN', message, data);
  }

  /**
   * Log an error message
   */
  error(message, error = null) {
    const errorData =
      error instanceof Error
        ? {
            message: error.message,
            stack: error.stack,
            name: error.name,
          }
        : error;

    this.log('ERROR', message, errorData);

    // Also write to error log
    this.writeToFile(
      this.errorLogFile,
      this.formatLogEntry('ERROR', message, errorData)
    );
  }

  /**
   * Log a debug message
   */
  debug(message, data = null) {
    if (process.env.DEBUG || process.env.GROK_DEBUG) {
      this.log('DEBUG', message, data);
    }
  }

  /**
   * Internal logging method
   */
  log(level, message, data = null) {
    const entry = this.formatLogEntry(level, message, data);

    // Write to console
    this.writeToConsole(level, entry);

    // Write to file
    this.writeToFile(this.logFile, entry);
  }

  /**
   * Format a log entry
   */
  formatLogEntry(level, message, data = null) {
    const timestamp = new Date().toISOString();
    const pid = process.pid;

    let entry = `[${timestamp}] [${pid}] [${level}] ${message}`;

    if (data !== null) {
      if (typeof data === 'object') {
        entry += `\n${JSON.stringify(data, null, 2)}`;
      } else {
        entry += ` ${data}`;
      }
    }

    return entry + '\n';
  }

  /**
   * Write to console with appropriate colors
   * Only ERROR messages are shown to users; INFO, WARN, DEBUG are silent for clean CLI experience
   */
  writeToConsole(level, entry) {
    // Only show ERROR messages to console to avoid cluttering user experience
    // INFO, WARN, and DEBUG messages are still written to log files
    if (level !== 'ERROR') {
      return;
    }

    const colors = {
      INFO: '\x1b[36m', // Cyan
      WARN: '\x1b[33m', // Yellow
      ERROR: '\x1b[31m', // Red
      DEBUG: '\x1b[35m', // Magenta
      RESET: '\x1b[0m', // Reset
    };

    const color = colors[level] || colors.RESET;
    process.stdout.write(`${color}${entry}${colors.RESET}`);
  }

  /**
   * Write to log file
   */
  writeToFile(filePath, entry) {
    if (!this.fileLoggingEnabled) {
      return; // Skip file logging if disabled
    }

    try {
      fs.appendFileSync(filePath, entry);
    } catch (error) {
      // Fallback to console if file writing fails (but avoid infinite loops)
      if (this.enableConsoleOutput) {
        console.error(
          `Failed to write to log file ${filePath}:`,
          error.message
        );
        // Don't write the full entry to console to avoid spam
      }
    }
  }

  /**
   * Rotate log files if they get too large
   */
  rotateLogs() {
    if (!this.fileLoggingEnabled) return;

    try {
      const files = [this.logFile, this.errorLogFile];

      for (const file of files) {
        try {
          if (fs.existsSync(file)) {
            const stats = fs.statSync(file);
            if (stats.size > this.maxLogSize) {
              this.rotateFile(file);
            }
          }
        } catch (fileError) {
          if (this.enableConsoleOutput) {
            console.warn(
              `Log rotation check failed for ${file}:`,
              fileError.message
            );
          }
        }
      }
    } catch (error) {
      if (this.enableConsoleOutput) {
        console.error('Log rotation failed:', error.message);
      }
    }
  }

  /**
   * Rotate a single log file
   */
  rotateFile(filePath) {
    for (let i = this.maxLogFiles - 1; i >= 1; i--) {
      const oldFile = `${filePath}.${i}`;
      const newFile = `${filePath}.${i + 1}`;

      if (fs.existsSync(oldFile)) {
        if (i === this.maxLogFiles - 1) {
          fs.unlinkSync(oldFile); // Delete oldest
        } else {
          fs.renameSync(oldFile, newFile);
        }
      }
    }

    // Move current file
    const backupFile = `${filePath}.1`;
    fs.renameSync(filePath, backupFile);
  }

  /**
   * Get recent log entries
   */
  getRecentLogs(lines = 50) {
    try {
      if (!fs.existsSync(this.logFile)) {
        return [];
      }

      const content = fs.readFileSync(this.logFile, 'utf8');
      const logLines = content.trim().split('\n');
      return logLines.slice(-lines);
    } catch (error) {
      return [`Error reading logs: ${error.message}`];
    }
  }

  /**
   * Get recent error entries
   */
  getRecentErrors(lines = 20) {
    try {
      if (!fs.existsSync(this.errorLogFile)) {
        return [];
      }

      const content = fs.readFileSync(this.errorLogFile, 'utf8');
      const logLines = content.trim().split('\n');
      return logLines.slice(-lines);
    } catch (error) {
      return [`Error reading error logs: ${error.message}`];
    }
  }

  /**
   * Clear all logs
   */
  clearLogs() {
    try {
      if (fs.existsSync(this.logFile)) {
        fs.unlinkSync(this.logFile);
      }
      if (fs.existsSync(this.errorLogFile)) {
        fs.unlinkSync(this.errorLogFile);
      }
      this.info('Logs cleared');
    } catch (error) {
      console.error('Failed to clear logs:', error.message);
    }
  }
}

// Export singleton instance
export const logger = new Logger();
