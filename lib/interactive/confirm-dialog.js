import fs from 'fs-extra';
import path from 'path';
import { logger } from '../utils/logger.js';
import { SyntaxHighlighter } from '../display/syntax-highlighter.js';
import { DiffViewer } from '../display/diff-viewer.js';

/**
 * Interactive Confirmation Dialog System
 * Provides rich confirmation dialogs with previews, warnings, and interactive elements
 */
export class ConfirmDialog {
  constructor(options = {}) {
    this.maxPreviewLines = options.maxPreviewLines || 20;
    this.showFilePreviews = options.showFilePreviews !== false;
    this.showImpactAssessment = options.showImpactAssessment !== false;
    this.enableSafetyMode = options.enableSafetyMode !== false;
    this.confirmationHistory = [];

    // Dependencies
    this.syntaxHighlighter = options.syntaxHighlighter || null;
    this.diffViewer = options.diffViewer || new DiffViewer();

    logger.info('Interactive confirmation dialog system initialized', {
      maxPreviewLines: this.maxPreviewLines,
      showFilePreviews: this.showFilePreviews,
      showImpactAssessment: this.showImpactAssessment,
      enableSafetyMode: this.enableSafetyMode,
    });
  }

  /**
   * Show a rich confirmation dialog with previews and warnings
   * @param {Object} options - Dialog options
   * @returns {Promise<boolean>} User confirmation result
   */
  async confirm(options = {}) {
    const {
      message,
      type = 'confirm',
      defaultValue = false,
      operation,
      files = [],
      changes = [],
      warnings = [],
      impact = {},
      preview = {},
      choices = [],
      customPrompt = null,
    } = options;

    try {
      // Show header with operation type
      this.showHeader(operation, type);

      // Show main message
      if (message) {
        console.log(`\n${message}\n`);
      }

      // Show file previews if requested
      if (this.showFilePreviews && files.length > 0) {
        await this.showFilePreviews(files, preview);
      }

      // Show changes preview if provided
      if (changes.length > 0) {
        await this.showChangesPreview(changes, preview);
      }

      // Show impact assessment
      if (this.showImpactAssessment && Object.keys(impact).length > 0) {
        this.showImpactAssessment(impact);
      }

      // Show warnings
      if (warnings.length > 0) {
        this.showWarnings(warnings);
      }

      // Show choices or default confirmation
      let confirmed = false;

      if (customPrompt) {
        confirmed = await customPrompt();
      } else if (choices.length > 0) {
        confirmed = await this.showMultipleChoice(choices, defaultValue);
      } else {
        confirmed = await this.showBasicConfirmation(message, defaultValue);
      }

      // Record confirmation in history
      this.recordConfirmation({
        operation,
        type,
        confirmed,
        timestamp: Date.now(),
        files: files.length,
        changes: changes.length,
        warnings: warnings.length,
      });

      return confirmed;
    } catch (error) {
      logger.error('Confirmation dialog failed', { error: error.message });
      return false;
    }
  }

  /**
   * Show dialog header with operation type and styling
   * @param {string} operation - Operation name
   * @param {string} type - Dialog type
   */
  showHeader(operation, type) {
    const icons = {
      confirm: '❓',
      warning: '⚠️',
      danger: '🚨',
      info: 'ℹ️',
      success: '✅',
    };

    const colors = {
      confirm: '\x1b[36m', // Cyan
      warning: '\x1b[33m', // Yellow
      danger: '\x1b[31m', // Red
      info: '\x1b[34m', // Blue
      success: '\x1b[32m', // Green
    };

    const resetColor = '\x1b[0m';
    const icon = icons[type] || icons.confirm;
    const color = colors[type] || colors.confirm;

    console.log(
      `${color}╔══════════════════════════════════════════════════════════════════════════════════════════════════╗${resetColor}`
    );
    console.log(
      `${color}║${resetColor} ${icon} ${operation || 'Confirmation Required'} ${' '.repeat(Math.max(0, 95 - (operation?.length || 20)))} ${color}║${resetColor}`
    );
    console.log(
      `${color}╚══════════════════════════════════════════════════════════════════════════════════════════════════╝${resetColor}`
    );
  }

  /**
   * Show file previews with syntax highlighting
   * @param {Array} files - Files to preview
   * @param {Object} previewOptions - Preview options
   */
  async showFilePreviews(files, previewOptions = {}) {
    const { showLineNumbers = true, highlightLines = [] } = previewOptions;

    console.log('\n📁 Files to be affected:\n');

    for (const filePath of files) {
      try {
        const stats = await fs.stat(filePath);
        const relativePath = path.relative(process.cwd(), filePath);
        const fileSize = this.formatFileSize(stats.size);
        const extension = path.extname(filePath).slice(1);

        console.log(`📄 ${relativePath} (${fileSize})`);
        console.log('─'.repeat(50));

        if (stats.size > 0 && stats.size < 10000) {
          // Only preview small files
          const content = await fs.readFile(filePath, 'utf8');
          const lines = content.split('\n');

          // Show first few lines with syntax highlighting
          const previewLines = lines.slice(0, this.maxPreviewLines);
          const highlighted = this.syntaxHighlighter.highlight(
            content,
            extension
          );

          if (showLineNumbers) {
            highlighted
              .split('\n')
              .slice(0, this.maxPreviewLines)
              .forEach((line, index) => {
                const lineNum = (index + 1).toString().padStart(4, ' ');
                const marker = highlightLines.includes(index + 1) ? '▶' : ' ';
                console.log(`${lineNum}${marker} ${line}`);
              });
          } else {
            console.log(
              highlighted.split('\n').slice(0, this.maxPreviewLines).join('\n')
            );
          }

          if (lines.length > this.maxPreviewLines) {
            console.log(
              `... (${lines.length - this.maxPreviewLines} more lines)`
            );
          }
        } else if (stats.size === 0) {
          console.log('(empty file)');
        } else {
          console.log('(file too large to preview)');
        }

        console.log('');
      } catch (error) {
        console.log(`❌ Error reading file: ${error.message}\n`);
      }
    }
  }

  /**
   * Show changes preview with diff highlighting
   * @param {Array} changes - Changes to preview
   * @param {Object} previewOptions - Preview options
   */
  async showChangesPreview(changes, previewOptions = {}) {
    console.log('\n🔄 Changes to be applied:\n');

    for (const change of changes) {
      const { file, type, content, oldContent } = change;

      console.log(
        `📝 ${type.toUpperCase()}: ${path.relative(process.cwd(), file)}`
      );
      console.log('─'.repeat(50));

      try {
        if (type === 'modify' && oldContent && content) {
          // Show diff
          const diff = this.diffViewer.generateDiff(oldContent, content, {
            contextLines: 3,
            showLineNumbers: true,
          });
          console.log(diff);
        } else if (type === 'create' && content) {
          // Show new content preview
          const lines = content.split('\n').slice(0, 10);
          console.log(lines.join('\n'));
          if (content.split('\n').length > 10) {
            console.log('... (more content)');
          }
        } else if (type === 'delete') {
          console.log('(file will be deleted)');
        }

        console.log('');
      } catch (error) {
        console.log(`❌ Error generating preview: ${error.message}\n`);
      }
    }
  }

  /**
   * Show impact assessment with detailed analysis
   * @param {Object} impact - Impact assessment data
   */
  showImpactAssessment(impact) {
    const {
      affectedFiles = 0,
      affectedLines = 0,
      riskLevel = 'low',
      breakingChanges = false,
      dependencies = [],
      performance = null,
    } = impact;

    console.log('\n📊 Impact Assessment:\n');

    const riskColors = {
      low: '\x1b[32m',
      medium: '\x1b[33m',
      high: '\x1b[31m',
      critical: '\x1b[31;1m',
    };

    const color = riskColors[riskLevel] || riskColors.low;
    const resetColor = '\x1b[0m';

    console.log(
      `🔴 Risk Level: ${color}${riskLevel.toUpperCase()}${resetColor}`
    );
    console.log(`📁 Files Affected: ${affectedFiles}`);
    console.log(`📝 Lines Changed: ${affectedLines}`);

    if (breakingChanges) {
      console.log('⚠️  Breaking Changes: Yes');
    }

    if (dependencies.length > 0) {
      console.log(`🔗 Dependencies: ${dependencies.join(', ')}`);
    }

    if (performance) {
      console.log(`⚡ Performance Impact: ${performance}`);
    }

    console.log('');
  }

  /**
   * Show warnings and cautions
   * @param {Array} warnings - Warning messages
   */
  showWarnings(warnings) {
    console.log('\n⚠️  Warnings:\n');

    warnings.forEach((warning, index) => {
      console.log(`${index + 1}. ${warning}`);
    });

    console.log('');
  }

  /**
   * Show basic yes/no confirmation
   * @param {string} message - Confirmation message
   * @param {boolean} defaultValue - Default value
   * @returns {Promise<boolean>} Confirmation result
   */
  async showBasicConfirmation(message, defaultValue = false) {
    const { inquirer } = await import('inquirer');

    const { confirmed } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirmed',
        message: message || 'Do you want to proceed?',
        default: defaultValue,
      },
    ]);

    return confirmed;
  }

  /**
   * Show multiple choice confirmation
   * @param {Array} choices - Choice options
   * @param {*} defaultValue - Default choice
   * @returns {Promise<boolean>} Confirmation result
   */
  async showMultipleChoice(choices, defaultValue) {
    const { inquirer } = await import('inquirer');

    const formattedChoices = choices.map((choice) => ({
      name: choice.label,
      value: choice.value,
      short: choice.label,
    }));

    const { selected } = await inquirer.prompt([
      {
        type: 'list',
        name: 'selected',
        message: 'Choose an option:',
        choices: formattedChoices,
        default: defaultValue,
      },
    ]);

    // Return true if a choice was selected (treat as confirmation)
    return selected !== null && selected !== undefined;
  }

  /**
   * Create a file operation confirmation dialog
   * @param {Object} options - File operation options
   * @returns {Promise<boolean>} Confirmation result
   */
  async confirmFileOperation(options = {}) {
    const {
      operation = 'file_operation',
      files = [],
      action = 'modify',
      description = '',
      warnings = [],
    } = options;

    // Auto-generate warnings based on file types and operation
    const autoWarnings = this.generateFileWarnings(files, action);
    const allWarnings = [...warnings, ...autoWarnings];

    // Assess impact
    const impact = this.assessFileImpact(files, action);

    return this.confirm({
      message: description,
      type:
        impact.riskLevel === 'high' || impact.riskLevel === 'critical'
          ? 'danger'
          : 'warning',
      operation: `${action} ${files.length} file(s)`,
      files,
      warnings: allWarnings,
      impact,
    });
  }

  /**
   * Create a destructive operation confirmation dialog
   * @param {Object} options - Destructive operation options
   * @returns {Promise<boolean>} Confirmation result
   */
  async confirmDestructiveOperation(options = {}) {
    const {
      operation = 'destructive_operation',
      description = '',
      impact = {},
      requiresTyping = false,
      confirmationPhrase = null,
    } = options;

    if (requiresTyping && confirmationPhrase) {
      return this.confirmWithTyping({
        message: description,
        operation,
        confirmationPhrase,
        type: 'danger',
        ...options,
      });
    }

    return this.confirm({
      message: description,
      type: 'danger',
      operation,
      impact: { ...impact, riskLevel: 'critical' },
      warnings: [
        'This operation cannot be undone.',
        'Make sure you have backups.',
        'Consider the impact on other systems.',
      ],
    });
  }

  /**
   * Confirmation requiring typing a specific phrase
   * @param {Object} options - Typing confirmation options
   * @returns {Promise<boolean>} Confirmation result
   */
  async confirmWithTyping(options = {}) {
    const {
      message,
      confirmationPhrase,
      caseSensitive = false,
      maxAttempts = 3,
    } = options;

    console.log(`\n${message}`);
    console.log(`\nTo proceed, type: "${confirmationPhrase}"`);

    const { inquirer } = await import('inquirer');

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const { typedPhrase } = await inquirer.prompt([
        {
          type: 'input',
          name: 'typedPhrase',
          message: `Attempt ${attempt}/${maxAttempts}:`,
          validate: (input) => {
            const normalizedInput = caseSensitive ? input : input.toLowerCase();
            const normalizedPhrase = caseSensitive
              ? confirmationPhrase
              : confirmationPhrase.toLowerCase();

            if (normalizedInput === normalizedPhrase) {
              return true;
            }

            return `Incorrect phrase. Type "${confirmationPhrase}" exactly.`;
          },
        },
      ]);

      const normalizedInput = caseSensitive
        ? typedPhrase
        : typedPhrase.toLowerCase();
      const normalizedPhrase = caseSensitive
        ? confirmationPhrase
        : confirmationPhrase.toLowerCase();

      if (normalizedInput === normalizedPhrase) {
        return true;
      }

      if (attempt < maxAttempts) {
        console.log('❌ Incorrect. Try again.\n');
      }
    }

    console.log('❌ Too many failed attempts. Operation cancelled.');
    return false;
  }

  /**
   * Generate automatic warnings based on files and operation type
   * @param {Array} files - Files involved
   * @param {string} action - Action type
   * @returns {Array} Generated warnings
   */
  generateFileWarnings(files, action) {
    const warnings = [];

    // Check for critical files
    const criticalFiles = files.filter(
      (file) =>
        file.includes('package.json') ||
        file.includes('package-lock.json') ||
        file.includes('.env') ||
        file.includes('config') ||
        file.includes('database')
    );

    if (criticalFiles.length > 0) {
      warnings.push(
        `Critical files detected: ${criticalFiles.map((f) => path.basename(f)).join(', ')}`
      );
    }

    // Check for large files
    const largeFiles = files.filter(async (file) => {
      try {
        const stats = await fs.stat(file);
        return stats.size > 1024 * 1024; // 1MB
      } catch {
        return false;
      }
    });

    if (largeFiles.length > 0) {
      warnings.push('Large files detected - operation may take time');
    }

    // Action-specific warnings
    if (action === 'delete') {
      warnings.push('Files will be permanently deleted');
    } else if (action === 'overwrite') {
      warnings.push('Existing files will be overwritten');
    }

    return warnings;
  }

  /**
   * Assess the impact of a file operation
   * @param {Array} files - Files involved
   * @param {string} action - Action type
   * @returns {Object} Impact assessment
   */
  assessFileImpact(files, action) {
    let riskLevel = 'low';
    let affectedLines = 0;
    const dependencies = [];

    // Analyze each file
    files.forEach((file) => {
      const ext = path.extname(file).toLowerCase();

      // Risk assessment based on file type
      if (['.json', '.js', '.ts', '.py'].includes(ext)) {
        riskLevel = 'medium';
      } else if (
        ['package.json', 'config', '.env'].some((critical) =>
          file.includes(critical)
        )
      ) {
        riskLevel = 'high';
      }

      // Estimate affected lines (rough heuristic)
      if (['.js', '.ts', '.py', '.java', '.cpp'].includes(ext)) {
        affectedLines += 50; // Assume ~50 lines affected per code file
      } else if (['.json', '.yaml', '.yml'].includes(ext)) {
        affectedLines += 20; // Config files have fewer lines
      }
    });

    // Action-based risk adjustment
    if (action === 'delete') {
      riskLevel = riskLevel === 'high' ? 'critical' : 'high';
    }

    // Check for potential dependencies
    if (files.some((f) => f.includes('package.json'))) {
      dependencies.push('npm packages');
    }
    if (
      files.some((f) => f.includes('requirements.txt') || f.includes('Pipfile'))
    ) {
      dependencies.push('Python packages');
    }

    return {
      affectedFiles: files.length,
      affectedLines,
      riskLevel,
      breakingChanges: riskLevel === 'critical' || riskLevel === 'high',
      dependencies,
      performance:
        action === 'delete' ? 'Potential performance improvement' : null,
    };
  }

  /**
   * Format file size for display
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
   * Record confirmation in history
   * @param {Object} confirmation - Confirmation data
   */
  recordConfirmation(confirmation) {
    this.confirmationHistory.push(confirmation);

    // Keep only last 100 confirmations
    if (this.confirmationHistory.length > 100) {
      this.confirmationHistory = this.confirmationHistory.slice(-100);
    }

    logger.debug('Confirmation recorded', confirmation);
  }

  /**
   * Get confirmation history
   * @param {Object} filters - History filters
   * @returns {Array} Confirmation history
   */
  getConfirmationHistory(filters = {}) {
    let history = [...this.confirmationHistory];

    if (filters.operation) {
      history = history.filter((c) => c.operation === filters.operation);
    }

    if (filters.confirmed !== undefined) {
      history = history.filter((c) => c.confirmed === filters.confirmed);
    }

    if (filters.limit) {
      history = history.slice(-filters.limit);
    }

    return history.reverse(); // Most recent first
  }

  /**
   * Get confirmation statistics
   * @returns {Object} Statistics
   */
  getStatistics() {
    const total = this.confirmationHistory.length;
    const confirmed = this.confirmationHistory.filter(
      (c) => c.confirmed
    ).length;
    const denied = total - confirmed;

    return {
      total,
      confirmed,
      denied,
      confirmationRate: total > 0 ? ((confirmed / total) * 100).toFixed(1) : 0,
      lastConfirmation:
        this.confirmationHistory[this.confirmationHistory.length - 1],
    };
  }

  /**
   * Reset confirmation history
   */
  resetHistory() {
    this.confirmationHistory.length = 0;
    logger.info('Confirmation history reset');
  }
}
