/**
 * Tool Confirmation Dialog System
 * Provides interactive confirmation for tool execution with previews
 */

import inquirer from 'inquirer';
import chalk from 'chalk';

export class ToolConfirmation {
  constructor(options = {}) {
    this.permissionManager = options.permissionManager;
    this.backupManager = options.backupManager;

    // Tools that always need confirmation
    this.alwaysConfirm = new Set([
      'Write',
      'Edit',
      'Bash',
      'NotebookEdit'
    ]);

    // Tools that never need confirmation (read-only)
    this.neverConfirm = new Set([
      'Read',
      'Glob',
      'Grep',
      'TodoRead'
    ]);

    // Session-level permissions granted by user
    this.sessionPermissions = new Map();

    // Risk levels for different operations
    this.riskLevels = {
      low: { color: 'green', icon: '✓' },
      medium: { color: 'yellow', icon: '⚠' },
      high: { color: 'red', icon: '⛔' }
    };
  }

  /**
   * Request confirmation for a tool execution
   * @param {string} toolName - Name of the tool
   * @param {Object} toolArgs - Tool arguments
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Confirmation result
   */
  async requestConfirmation(toolName, toolArgs, options = {}) {
    // Check if tool never needs confirmation
    if (this.neverConfirm.has(toolName)) {
      return { approved: true, reason: 'read-only' };
    }

    // Check session-level permissions
    const sessionKey = this.getPermissionKey(toolName, toolArgs);
    if (this.sessionPermissions.has(sessionKey)) {
      return { approved: true, reason: 'session-approved' };
    }

    // Check permission manager patterns
    if (this.permissionManager) {
      const patternResult = await this.permissionManager.checkPermission(toolName, toolArgs);
      if (patternResult.allowed) {
        return { approved: true, reason: 'pattern-allowed' };
      }
      if (patternResult.denied) {
        return { approved: false, reason: 'pattern-denied', message: patternResult.reason };
      }
    }

    // Assess risk level
    const risk = this.assessRisk(toolName, toolArgs);

    // Show confirmation dialog
    return await this.showDialog(toolName, toolArgs, risk, options);
  }

  /**
   * Assess risk level of an operation
   * @param {string} toolName - Tool name
   * @param {Object} toolArgs - Tool arguments
   * @returns {string} Risk level
   */
  assessRisk(toolName, toolArgs) {
    // High risk operations
    if (toolName === 'Bash') {
      const cmd = toolArgs.command || '';

      // Dangerous commands
      if (cmd.match(/rm\s+-rf|sudo|chmod\s+777|>\s*\/|dd\s+if=|mkfs|format/i)) {
        return 'high';
      }

      // Network/download commands
      if (cmd.match(/curl|wget|ssh|scp|git\s+push|npm\s+publish/i)) {
        return 'medium';
      }

      // Git operations (medium risk)
      if (cmd.match(/git\s+(commit|reset|rebase|merge|checkout)/i)) {
        return 'medium';
      }

      // Read-only git commands
      if (cmd.match(/git\s+(status|log|diff|branch|show)/i)) {
        return 'low';
      }

      return 'medium';
    }

    if (toolName === 'Write') {
      const filePath = toolArgs.file_path || toolArgs.path || '';

      // Writing to sensitive files
      if (filePath.match(/\.(env|key|pem|secret|credential|password)/i)) {
        return 'high';
      }

      // Config files
      if (filePath.match(/package\.json|\.gitignore|tsconfig|eslint|babel/i)) {
        return 'medium';
      }

      return 'medium';
    }

    if (toolName === 'Edit') {
      return 'medium';
    }

    return 'low';
  }

  /**
   * Show confirmation dialog
   * @param {string} toolName - Tool name
   * @param {Object} toolArgs - Tool arguments
   * @param {string} risk - Risk level
   * @param {Object} options - Options
   * @returns {Promise<Object>} User response
   */
  async showDialog(toolName, toolArgs, risk, options = {}) {
    const riskInfo = this.riskLevels[risk];

    console.log('');
    console.log(chalk.bold('─'.repeat(60)));
    console.log(chalk[riskInfo.color](`${riskInfo.icon} Tool Confirmation Required`));
    console.log(chalk.bold('─'.repeat(60)));

    // Show tool info
    console.log(chalk.cyan(`Tool: ${toolName}`));
    console.log(chalk.gray(`Risk: ${risk}`));
    console.log('');

    // Show preview based on tool type
    this.showPreview(toolName, toolArgs);

    console.log(chalk.bold('─'.repeat(60)));

    // Prompt for confirmation
    const choices = [
      { name: 'Yes, proceed', value: 'yes' },
      { name: 'Yes, and allow this for the session', value: 'session' },
      { name: 'No, skip this operation', value: 'no' },
      { name: 'No, and block similar operations', value: 'block' }
    ];

    // Add edit option for Write/Edit
    if (toolName === 'Write' || toolName === 'Edit') {
      choices.splice(2, 0, { name: 'Show full content', value: 'show' });
    }

    const answer = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: 'Allow this operation?',
        choices
      }
    ]);

    // Handle response
    switch (answer.action) {
      case 'yes':
        return { approved: true, reason: 'user-approved' };

      case 'session':
        const sessionKey = this.getPermissionKey(toolName, toolArgs);
        this.sessionPermissions.set(sessionKey, true);
        console.log(chalk.green('✓ Permission granted for this session'));
        return { approved: true, reason: 'session-approved' };

      case 'no':
        return { approved: false, reason: 'user-denied' };

      case 'block':
        if (this.permissionManager) {
          const pattern = this.generateBlockPattern(toolName, toolArgs);
          this.permissionManager.addDenyPattern(pattern);
          console.log(chalk.yellow(`⚠ Blocked pattern: ${pattern}`));
        }
        return { approved: false, reason: 'user-blocked' };

      case 'show':
        this.showFullContent(toolName, toolArgs);
        // Re-prompt after showing content
        return await this.showDialog(toolName, toolArgs, risk, options);

      default:
        return { approved: false, reason: 'unknown' };
    }
  }

  /**
   * Show preview of the operation
   * @param {string} toolName - Tool name
   * @param {Object} toolArgs - Tool arguments
   */
  showPreview(toolName, toolArgs) {
    switch (toolName) {
      case 'Bash':
        console.log(chalk.yellow('Command:'));
        console.log(chalk.white(`  $ ${toolArgs.command}`));
        if (toolArgs.cwd) {
          console.log(chalk.gray(`  Working dir: ${toolArgs.cwd}`));
        }
        break;

      case 'Write':
        const writePath = toolArgs.file_path || toolArgs.path;
        const writeContent = toolArgs.content || '';
        console.log(chalk.yellow(`File: ${writePath}`));
        console.log(chalk.gray(`Size: ${writeContent.length} characters`));
        console.log(chalk.yellow('Preview (first 10 lines):'));
        const writeLines = writeContent.split('\n').slice(0, 10);
        writeLines.forEach((line, i) => {
          console.log(chalk.green(`  ${(i + 1).toString().padStart(3)}│ `) + line.substring(0, 70));
        });
        if (writeContent.split('\n').length > 10) {
          console.log(chalk.gray('  ... (more lines)'));
        }
        break;

      case 'Edit':
        const editPath = toolArgs.file_path || toolArgs.path;
        console.log(chalk.yellow(`File: ${editPath}`));
        console.log(chalk.red('Old:'));
        const oldLines = (toolArgs.old_string || '').split('\n').slice(0, 5);
        oldLines.forEach(line => {
          console.log(chalk.red(`  - ${line.substring(0, 60)}`));
        });
        console.log(chalk.green('New:'));
        const newLines = (toolArgs.new_string || '').split('\n').slice(0, 5);
        newLines.forEach(line => {
          console.log(chalk.green(`  + ${line.substring(0, 60)}`));
        });
        break;

      case 'NotebookEdit':
        console.log(chalk.yellow(`Notebook: ${toolArgs.notebook_path}`));
        console.log(chalk.gray(`Cell: ${toolArgs.cell_number || toolArgs.cell_id}`));
        console.log(chalk.gray(`Mode: ${toolArgs.edit_mode || 'replace'}`));
        break;

      default:
        console.log(chalk.gray('Arguments:'));
        console.log(chalk.white(`  ${JSON.stringify(toolArgs, null, 2).substring(0, 200)}`));
    }
    console.log('');
  }

  /**
   * Show full content (for Write/Edit operations)
   */
  showFullContent(toolName, toolArgs) {
    console.log('');
    console.log(chalk.bold('─'.repeat(60)));
    console.log(chalk.cyan('Full Content:'));
    console.log(chalk.bold('─'.repeat(60)));

    if (toolName === 'Write') {
      console.log(toolArgs.content || '');
    } else if (toolName === 'Edit') {
      console.log(chalk.red('Old string:'));
      console.log(toolArgs.old_string || '');
      console.log('');
      console.log(chalk.green('New string:'));
      console.log(toolArgs.new_string || '');
    }

    console.log(chalk.bold('─'.repeat(60)));
    console.log('');
  }

  /**
   * Generate a permission key for session tracking
   * @param {string} toolName - Tool name
   * @param {Object} toolArgs - Tool arguments
   * @returns {string} Permission key
   */
  getPermissionKey(toolName, toolArgs) {
    if (toolName === 'Bash') {
      // Extract command base for Bash
      const cmd = (toolArgs.command || '').split(/\s+/)[0];
      return `Bash:${cmd}`;
    }

    if (toolName === 'Write' || toolName === 'Edit') {
      // Use file path pattern
      const path = toolArgs.file_path || toolArgs.path || '';
      const ext = path.split('.').pop();
      return `${toolName}:*.${ext}`;
    }

    return toolName;
  }

  /**
   * Generate a block pattern from tool call
   * @param {string} toolName - Tool name
   * @param {Object} toolArgs - Tool arguments
   * @returns {string} Block pattern
   */
  generateBlockPattern(toolName, toolArgs) {
    if (toolName === 'Bash') {
      const cmd = (toolArgs.command || '').split(/\s+/)[0];
      return `Bash(${cmd}:*)`;
    }

    return toolName;
  }

  /**
   * Clear session permissions
   */
  clearSessionPermissions() {
    this.sessionPermissions.clear();
  }

  /**
   * Get current session permissions
   * @returns {Array} List of session permissions
   */
  getSessionPermissions() {
    return Array.from(this.sessionPermissions.keys());
  }

  /**
   * Quick confirm for low-risk operations
   * @param {string} message - Confirmation message
   * @returns {Promise<boolean>}
   */
  async quickConfirm(message) {
    const answer = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message,
        default: true
      }
    ]);

    return answer.confirm;
  }

  /**
   * Show a warning without blocking
   * @param {string} message - Warning message
   */
  showWarning(message) {
    console.log(chalk.yellow(`⚠ Warning: ${message}`));
  }

  /**
   * Show an info message
   * @param {string} message - Info message
   */
  showInfo(message) {
    console.log(chalk.blue(`ℹ ${message}`));
  }
}

export default ToolConfirmation;
