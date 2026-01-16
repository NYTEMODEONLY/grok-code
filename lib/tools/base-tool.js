/**
 * Base Tool Class
 * Foundation for all Grok Code tools
 */

export class BaseTool {
  constructor(options = {}) {
    this.name = options.name || 'BaseTool';
    this.description = options.description || '';
    this.parameters = options.parameters || {};
    this.requiresPermission = options.requiresPermission ?? true;
    this.isReadOnly = options.isReadOnly ?? false;
    this.timeout = options.timeout || 120000; // 2 minutes default
    this.hooks = options.hooks || null;
  }

  /**
   * Validate tool parameters
   * @param {Object} params - Parameters to validate
   * @returns {Object} Validation result
   */
  validate(params) {
    const errors = [];
    const required = this.parameters.required || [];

    for (const param of required) {
      if (params[param] === undefined || params[param] === null) {
        errors.push(`Missing required parameter: ${param}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Execute the tool
   * @param {Object} params - Tool parameters
   * @param {Object} context - Execution context
   * @returns {Promise<Object>} Tool result
   */
  async execute(params, context = {}) {
    throw new Error('execute() must be implemented by subclass');
  }

  /**
   * Get tool schema for AI model
   * @returns {Object} JSON schema for the tool
   */
  getSchema() {
    return {
      name: this.name,
      description: this.description,
      parameters: this.parameters,
      requiresPermission: this.requiresPermission,
      isReadOnly: this.isReadOnly
    };
  }

  /**
   * Format tool result for display
   * @param {Object} result - Tool execution result
   * @returns {string} Formatted output
   */
  formatResult(result) {
    if (result.error) {
      return `Error: ${result.error}`;
    }
    return result.output || JSON.stringify(result, null, 2);
  }

  /**
   * Create a backup before modifying a file
   * @param {string} filePath - Path to file
   * @param {Object} fs - File system module
   */
  async createBackup(filePath, fs) {
    const backupDir = '.grok/backups';
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = filePath.split('/').pop();
    const backupPath = `${backupDir}/${fileName}.${timestamp}.bak`;

    try {
      await fs.ensureDir(backupDir);
      if (await fs.pathExists(filePath)) {
        await fs.copy(filePath, backupPath);
        return backupPath;
      }
    } catch (error) {
      console.warn(`Failed to create backup for ${filePath}: ${error.message}`);
    }
    return null;
  }
}
