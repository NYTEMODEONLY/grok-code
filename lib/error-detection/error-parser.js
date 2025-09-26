import { ErrorPatterns } from '../learning/error-patterns.js';

/**
 * Error Parser for Linter and Compiler Output
 * Parses ESLint, TypeScript compiler, and other tool error outputs into structured format
 */
export class ErrorParser {
  constructor(options = {}) {
    this.patterns = options.patterns || new ErrorPatterns();
    // Error source patterns
    this.sources = {
      eslint: {
        name: 'ESLint',
        patterns: [
          // Standard ESLint format: file:line:column: message (rule)
          /^(.+?):(\d+):(\d+):\s*(.+?)\s*\((.+?)\)$/,
          // Alternative format: file:line:column: message
          /^(.+?):(\d+):(\d+):\s*(.+?)$/,
        ],
        severityMap: {
          'error': 'error',
          'warn': 'warning',
          'off': 'off'
        }
      },
      typescript: {
        name: 'TypeScript',
        patterns: [
          // TypeScript compiler format: file(line,column): error TS####: message
          /^(.+?)\((\d+),(\d+)\):\s*(error|warning)\s*TS(\d+):\s*(.+)$/,
          // Alternative format: file:line:column - error TS####: message
          /^(.+?):(\d+):(\d+)\s*-\s*(error|warning)\s*TS(\d+):\s*(.+)$/,
          // Simple format: file(line,column): message
          /^(.+?)\((\d+),(\d+)\):\s*(.+)$/,
        ],
        severityMap: {
          'error': 'error',
          'warning': 'warning'
        }
      },
      prettier: {
        name: 'Prettier',
        patterns: [
          // Prettier format: [error|warn] file: message
          /^\[(error|warn)\]\s*(.+?):\s*(.+)$/,
        ],
        severityMap: {
          'error': 'error',
          'warn': 'warning'
        }
      },
      generic: {
        name: 'Generic',
        patterns: [
          // Generic format: file:line:column: message
          /^(.+?):(\d+):(\d+):\s*(.+)$/,
          // Simple format: file:line: message
          /^(.+?):(\d+):\s*(.+)$/,
        ],
        severityMap: {}
      }
    };

    this.parsedErrors = [];
    this.parseStats = {
      totalErrors: 0,
      bySource: {},
      bySeverity: {},
      byFile: {},
    };
  }

  /**
   * Parse error output from various sources
   * @param {string} errorOutput - Raw error output from linter/compiler
   * @param {string} source - Source type ('eslint', 'typescript', 'prettier', 'auto')
   * @returns {Object} Parsed error analysis
   */
  parseErrors(errorOutput, source = 'auto', context = {}) {
    this.parsedErrors = [];
    this.resetStats();

    const lines = errorOutput.split('\n').filter(line => line.trim());

    if (source === 'auto') {
      // Auto-detect source from content
      source = this.detectSource(lines);
    }

    const sourceConfig = this.sources[source];
    if (!sourceConfig) {
      throw new Error(`Unknown error source: ${source}`);
    }

    // Parse each line
    for (const line of lines) {
      const parsedError = this.parseErrorLine(line, sourceConfig);
      if (parsedError) {
        this.parsedErrors.push(parsedError);
        this.updateStats(parsedError);

        // Record pattern for learning
        if (this.patterns) {
          this.patterns.recordError(parsedError, {
            ...context,
            source,
            rawLine: line,
            sessionId: context.sessionId,
            userId: context.userId,
            projectId: context.projectId
          });
        }
      }
    }

    return {
      source: sourceConfig.name,
      totalErrors: this.parsedErrors.length,
      errors: this.parsedErrors,
      stats: this.parseStats,
      summary: this.generateSummary(),
    };
  }

  /**
   * Parse a single error line
   * @param {string} line - Error line to parse
   * @param {Object} sourceConfig - Source configuration
   * @returns {Object|null} Parsed error or null if not an error line
   */
  parseErrorLine(line, sourceConfig) {
    // Skip empty lines, warnings about config files, etc.
    if (this.shouldSkipLine(line)) {
      return null;
    }

    for (const pattern of sourceConfig.patterns) {
      const match = line.match(pattern);
      if (match) {
        return this.extractErrorInfo(match, sourceConfig);
      }
    }

    return null;
  }

  /**
   * Extract structured error information from regex match
   * @param {Array} match - Regex match result
   * @param {Object} sourceConfig - Source configuration
   * @returns {Object} Structured error information
   */
  extractErrorInfo(match, sourceConfig) {
    const error = {
      source: sourceConfig.name,
      file: '',
      line: 0,
      column: 0,
      message: '',
      rule: '',
      code: '',
      severity: 'error',
      raw: match[0],
      timestamp: new Date().toISOString(),
    };

    switch (sourceConfig.name) {
      case 'ESLint':
        error.file = match[1];
        error.line = parseInt(match[2]) || 0;
        error.column = parseInt(match[3]) || 0;
        error.message = match[4] || '';
        error.rule = match[5] || '';
        // ESLint doesn't specify severity in output, assume error unless overridden
        break;

      case 'TypeScript':
        error.file = match[1];
        error.line = parseInt(match[2]) || 0;
        error.column = parseInt(match[3]) || 0;
        error.severity = sourceConfig.severityMap[match[4]] || 'error';
        error.code = match[5] ? `TS${match[5]}` : '';
        error.message = match[6] || match[4] || '';
        break;

      case 'Prettier':
        error.severity = sourceConfig.severityMap[match[1]] || 'error';
        error.file = match[2];
        error.message = match[3] || '';
        break;

      case 'Generic':
        error.file = match[1];
        error.line = parseInt(match[2]) || 0;
        error.column = parseInt(match[3]) || 0;
        error.message = match[4] || match[3] || '';
        break;
    }

    // Clean up file paths
    error.file = error.file.replace(/^[\.\/]+/, '');

    // Determine error category
    error.category = this.categorizeError(error);

    return error;
  }

  /**
   * Determine if a line should be skipped (not an error)
   * @param {string} line - Line to check
   * @returns {boolean} Whether to skip the line
   */
  shouldSkipLine(line) {
    const skipPatterns = [
      /^\s*$/,  // Empty lines
      /^[\w\s]+:\s*\d+\s*$/,  // Just file:count summaries
      /^✨\s+Done\s+in/,  // Build completion messages
      /^Compiled\s+successfully/,  // Success messages
      /^No\s+errors\s+found/,  // Success messages
      /^✓\s+No\s+errors/,  // Success messages
      /^\d+\s+error\(s\)/,  // Summary lines
      /^\d+\s+warning\(s\)/,  // Summary lines
      /^warning\s+about\s+config/,  // Config warnings
      /^Configuration\s+error/,  // Config errors
      /^Cannot\s+find\s+module/,  // Module resolution issues (handled separately)
    ];

    return skipPatterns.some(pattern => pattern.test(line.trim()));
  }

  /**
   * Auto-detect error source from content
   * @param {Array} lines - Error output lines
   * @returns {string} Detected source
   */
  detectSource(lines) {
    const sampleLines = lines.slice(0, 5).join(' ');

    if (sampleLines.includes('TS') && (sampleLines.includes('error') || sampleLines.includes('warning'))) {
      return 'typescript';
    }

    if (sampleLines.includes('eslint') || sampleLines.includes('no-unused-vars') || sampleLines.includes('no-console')) {
      return 'eslint';
    }

    if (sampleLines.includes('prettier') || sampleLines.includes('[error]') || sampleLines.includes('[warn]')) {
      return 'prettier';
    }

    return 'generic';
  }

  /**
   * Categorize error by type
   * @param {Object} error - Parsed error
   * @returns {string} Error category
   */
  categorizeError(error) {
    const message = error.message.toLowerCase();
    const rule = error.rule.toLowerCase();
    const code = error.code.toLowerCase();

    // TypeScript error codes
    if (code.startsWith('ts')) {
      const tsCode = code.replace('ts', '');
      if (['2304', '2307', '2322', '2339'].includes(tsCode)) return 'type-error'; // Cannot find name, etc.
      if (['2335', '2345'].includes(tsCode)) return 'type-mismatch'; // Property doesn't exist, etc.
      if (['1003', '1005'].includes(tsCode)) return 'syntax-error'; // Expression expected, etc.
      if (['2300', '2306'].includes(tsCode)) return 'module-error'; // Duplicate identifier, etc.
      return 'typescript-error';
    }

    // ESLint rules
    if (rule) {
      if (rule.includes('no-unused') || rule.includes('no-unreachable')) return 'unused-code';
      if (rule.includes('no-console') || rule.includes('no-debugger')) return 'debug-code';
      if (rule.includes('semi') || rule.includes('indent') || rule.includes('quotes')) return 'style-issue';
      if (rule.includes('no-undef') || rule.includes('no-var')) return 'scope-issue';
      if (rule.includes('react/')) return 'react-issue';
      return 'linting-issue';
    }

    // Message-based categorization
    if (message.includes('cannot find') || message.includes('module not found')) return 'import-error';
    if (message.includes('syntax') || message.includes('unexpected token')) return 'syntax-error';
    if (message.includes('type') || message.includes('interface')) return 'type-error';
    if (message.includes('unused') || message.includes('unreachable')) return 'unused-code';
    if (message.includes('deprecated') || message.includes('obsolete')) return 'deprecated-code';

    return 'general-error';
  }

  /**
   * Update parsing statistics
   * @param {Object} error - Parsed error
   */
  updateStats(error) {
    this.parseStats.totalErrors++;

    // By source
    this.parseStats.bySource[error.source] = (this.parseStats.bySource[error.source] || 0) + 1;

    // By severity
    this.parseStats.bySeverity[error.severity] = (this.parseStats.bySeverity[error.severity] || 0) + 1;

    // By file
    this.parseStats.byFile[error.file] = (this.parseStats.byFile[error.file] || 0) + 1;
  }

  /**
   * Reset parsing statistics
   */
  resetStats() {
    this.parseStats = {
      totalErrors: 0,
      bySource: {},
      bySeverity: {},
      byFile: {},
    };
  }

  /**
   * Generate summary of parsed errors
   * @returns {string} Summary text
   */
  generateSummary() {
    if (this.parsedErrors.length === 0) {
      return 'No errors found.';
    }

    const errorCount = this.parseStats.totalErrors;
    const warningCount = this.parseStats.bySeverity.warning || 0;
    const filesAffected = Object.keys(this.parseStats.byFile).length;

    let summary = `Found ${errorCount} issue${errorCount !== 1 ? 's' : ''}`;
    if (warningCount > 0) {
      summary += ` (${errorCount - warningCount} errors, ${warningCount} warnings)`;
    }
    summary += ` in ${filesAffected} file${filesAffected !== 1 ? 's' : ''}.`;

    // Add top categories
    const categories = {};
    this.parsedErrors.forEach(error => {
      categories[error.category] = (categories[error.category] || 0) + 1;
    });

    const topCategories = Object.entries(categories)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([cat, count]) => `${cat} (${count})`);

    if (topCategories.length > 0) {
      summary += ` Top categories: ${topCategories.join(', ')}.`;
    }

    return summary;
  }

  /**
   * Filter errors by criteria
   * @param {Object} filters - Filter criteria
   * @returns {Array} Filtered errors
   */
  filterErrors(filters = {}) {
    const { severity, category, file, source } = filters;

    return this.parsedErrors.filter(error => {
      if (severity && error.severity !== severity) return false;
      if (category && error.category !== category) return false;
      if (file && !error.file.includes(file)) return false;
      if (source && error.source !== source) return false;
      return true;
    });
  }

  /**
   * Get errors grouped by file
   * @returns {Object} Errors grouped by file
   */
  getErrorsByFile() {
    const byFile = {};

    this.parsedErrors.forEach(error => {
      if (!byFile[error.file]) {
        byFile[error.file] = [];
      }
      byFile[error.file].push(error);
    });

    return byFile;
  }

  /**
   * Get errors grouped by category
   * @returns {Object} Errors grouped by category
   */
  getErrorsByCategory() {
    const byCategory = {};

    this.parsedErrors.forEach(error => {
      if (!byCategory[error.category]) {
        byCategory[error.category] = [];
      }
      byCategory[error.category].push(error);
    });

    return byCategory;
  }

  /**
   * Export errors in various formats
   * @param {string} format - Export format ('json', 'csv', 'summary')
   * @returns {string} Formatted output
   */
  exportErrors(format = 'json') {
    switch (format.toLowerCase()) {
      case 'json':
        return JSON.stringify({
          summary: this.generateSummary(),
          stats: this.parseStats,
          errors: this.parsedErrors,
        }, null, 2);

      case 'csv':
        let csv = 'file,line,column,severity,category,message,rule,code\n';
        this.parsedErrors.forEach(error => {
          csv += `"${error.file}",${error.line},${error.column},"${error.severity}","${error.category}","${error.message.replace(/"/g, '""')}","${error.rule}","${error.code}"\n`;
        });
        return csv;

      case 'summary':
        let summary = `Error Analysis Summary\n`;
        summary += '=' .repeat(30) + '\n\n';
        summary += this.generateSummary() + '\n\n';

        summary += 'By Severity:\n';
        Object.entries(this.parseStats.bySeverity).forEach(([severity, count]) => {
          summary += `  ${severity}: ${count}\n`;
        });

        summary += '\nBy Category:\n';
        const categories = this.getErrorsByCategory();
        Object.entries(categories).forEach(([category, errors]) => {
          summary += `  ${category}: ${errors.length}\n`;
        });

        return summary;

      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  /**
   * Get supported error sources
   * @returns {Array} Supported sources
   */
  getSupportedSources() {
    return Object.keys(this.sources);
  }
}

// Export singleton instance for global use
export const errorParser = new ErrorParser();
export default errorParser;
