/**
 * Tool Executor
 * Orchestrates tool execution with hooks, permissions, and logging
 */

import { EventEmitter } from 'events';
import fs from 'fs-extra';
import path from 'path';

export class ToolExecutor extends EventEmitter {
  constructor(options = {}) {
    super();
    this.registry = options.registry;
    this.hooks = options.hooks || null;
    this.permissionManager = options.permissionManager || null;
    this.actionHistory = [];
    this.maxHistorySize = options.maxHistorySize || 50;
    this.cwd = options.cwd || process.cwd();
    this.sessionId = options.sessionId || `session-${Date.now()}`;
    this.verbose = options.verbose || false;
  }

  /**
   * Execute a tool with full lifecycle management
   * @param {string} toolName - Name of the tool
   * @param {Object} params - Tool parameters
   * @param {Object} context - Execution context
   * @returns {Promise<Object>} Execution result
   */
  async execute(toolName, params, context = {}) {
    const startTime = Date.now();
    const executionId = `exec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Merge context with defaults
    const fullContext = {
      ...context,
      cwd: context.cwd || this.cwd,
      sessionId: context.sessionId || this.sessionId,
      executionId
    };

    // Get tool from registry
    const tool = this.registry.get(toolName);
    if (!tool) {
      return {
        error: `Tool not found: ${toolName}`,
        executionId,
        executionTime: Date.now() - startTime
      };
    }

    // Check if tool is allowed
    if (!this.registry.isAllowed(toolName)) {
      return {
        error: `Tool not allowed: ${toolName}`,
        executionId,
        executionTime: Date.now() - startTime
      };
    }

    // Validate parameters
    const validation = tool.validate(params);
    if (!validation.valid) {
      return {
        error: `Invalid parameters: ${validation.errors.join(', ')}`,
        executionId,
        executionTime: Date.now() - startTime
      };
    }

    // Run PreToolUse hooks
    if (this.hooks) {
      const preHookResult = await this.runHooks('PreToolUse', {
        toolName,
        toolInput: params,
        context: fullContext
      });

      if (preHookResult.blocked) {
        return {
          error: `Blocked by hook: ${preHookResult.reason}`,
          blockedBy: 'PreToolUse',
          executionId,
          executionTime: Date.now() - startTime
        };
      }

      // Apply any parameter modifications from hooks
      if (preHookResult.updatedInput) {
        Object.assign(params, preHookResult.updatedInput);
      }
    }

    // Check permissions
    if (tool.requiresPermission && this.permissionManager) {
      const permitted = await this.permissionManager.checkPermission(toolName, params, fullContext);
      if (!permitted.allowed) {
        return {
          error: `Permission denied: ${permitted.reason || 'User declined'}`,
          requiresPermission: true,
          executionId,
          executionTime: Date.now() - startTime
        };
      }
    }

    // Emit pre-execution event
    this.emit('tool:executing', {
      toolName,
      params,
      context: fullContext,
      executionId
    });

    // Execute the tool
    let result;
    try {
      result = await tool.execute(params, fullContext);
    } catch (error) {
      result = {
        error: error.message,
        stack: error.stack
      };
    }

    result.executionId = executionId;
    result.executionTime = result.executionTime || (Date.now() - startTime);
    result.toolName = toolName;

    // Run PostToolUse hooks
    if (this.hooks) {
      const postHookResult = await this.runHooks('PostToolUse', {
        toolName,
        toolInput: params,
        toolOutput: result,
        context: fullContext
      });

      if (postHookResult.additionalContext) {
        result.additionalContext = postHookResult.additionalContext;
      }

      if (postHookResult.blocked) {
        result.warning = `Post-hook warning: ${postHookResult.reason}`;
      }
    }

    // Record action for undo functionality
    if (!tool.isReadOnly && result.success) {
      this.recordAction(tool, params, result);
    }

    // Emit post-execution event
    this.emit('tool:executed', {
      toolName,
      params,
      result,
      context: fullContext,
      executionId
    });

    return result;
  }

  /**
   * Execute multiple tools in parallel
   * @param {Array} toolCalls - Array of {tool, params} objects
   * @param {Object} context - Execution context
   * @returns {Promise<Array>} Array of results
   */
  async executeParallel(toolCalls, context = {}) {
    return Promise.all(
      toolCalls.map(({ tool, params }) => this.execute(tool, params, context))
    );
  }

  /**
   * Execute multiple tools sequentially
   * @param {Array} toolCalls - Array of {tool, params} objects
   * @param {Object} context - Execution context
   * @returns {Promise<Array>} Array of results
   */
  async executeSequential(toolCalls, context = {}) {
    const results = [];

    for (const { tool, params } of toolCalls) {
      const result = await this.execute(tool, params, context);
      results.push(result);

      // Stop if error and stopOnError is set
      if (result.error && context.stopOnError) {
        break;
      }
    }

    return results;
  }

  /**
   * Run hooks for an event
   * @param {string} event - Hook event name
   * @param {Object} hookInput - Input data for hooks
   * @returns {Promise<Object>} Hook results
   */
  async runHooks(event, hookInput) {
    if (!this.hooks || typeof this.hooks.run !== 'function') {
      return { blocked: false };
    }

    try {
      return await this.hooks.run(event, hookInput);
    } catch (error) {
      this.emit('hook:error', { event, error });
      return { blocked: false, error: error.message };
    }
  }

  /**
   * Record an action for undo functionality
   * @param {BaseTool} tool - Tool that was executed
   * @param {Object} params - Tool parameters
   * @param {Object} result - Execution result
   */
  recordAction(tool, params, result) {
    const action = {
      id: `action-${Date.now()}`,
      toolName: tool.name,
      params,
      timestamp: new Date().toISOString(),
      sessionId: this.sessionId
    };

    // Get tool-specific action record if available
    if (typeof tool.getActionRecord === 'function') {
      const toolAction = tool.getActionRecord(result);
      if (toolAction) {
        Object.assign(action, toolAction);
      }
    }

    this.actionHistory.push(action);

    // Limit history size
    if (this.actionHistory.length > this.maxHistorySize) {
      this.actionHistory.shift();
    }

    // Save to file
    this.saveActionHistory().catch(() => {});

    this.emit('action:recorded', action);
  }

  /**
   * Undo the last action
   * @returns {Promise<Object>} Undo result
   */
  async undoLastAction() {
    if (this.actionHistory.length === 0) {
      return { success: false, message: 'No actions to undo' };
    }

    const lastAction = this.actionHistory.pop();

    try {
      let result;

      switch (lastAction.type) {
        case 'file_edit':
          // Restore original content
          if (lastAction.originalContent !== undefined) {
            await fs.writeFile(lastAction.filepath, lastAction.originalContent);
            result = { success: true, message: `Restored ${lastAction.filepath}` };
          } else if (await fs.pathExists(lastAction.filepath)) {
            // File was created, delete it
            await fs.unlink(lastAction.filepath);
            result = { success: true, message: `Deleted ${lastAction.filepath}` };
          }
          break;

        case 'file_delete':
          // Restore deleted file
          if (lastAction.originalContent) {
            await fs.writeFile(lastAction.filepath, lastAction.originalContent);
            result = { success: true, message: `Restored ${lastAction.filepath}` };
          }
          break;

        default:
          result = { success: false, message: `Cannot undo action type: ${lastAction.type}` };
      }

      if (result.success) {
        await this.saveActionHistory();
        this.emit('action:undone', lastAction);
      }

      return result;
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  /**
   * Get action history
   * @returns {Array} Action history
   */
  getActionHistory() {
    return [...this.actionHistory];
  }

  /**
   * Save action history to file
   */
  async saveActionHistory() {
    const historyPath = path.join(this.cwd, '.grok', 'action-history.json');
    await fs.ensureDir(path.dirname(historyPath));
    await fs.writeJson(historyPath, {
      actions: this.actionHistory.slice(-20),
      lastUpdated: new Date().toISOString()
    }, { spaces: 2 });
  }

  /**
   * Load action history from file
   */
  async loadActionHistory() {
    const historyPath = path.join(this.cwd, '.grok', 'action-history.json');

    try {
      if (await fs.pathExists(historyPath)) {
        const data = await fs.readJson(historyPath);
        this.actionHistory = data.actions || [];
      }
    } catch (e) {
      this.actionHistory = [];
    }
  }

  /**
   * Clear action history
   */
  clearActionHistory() {
    this.actionHistory = [];
    this.saveActionHistory().catch(() => {});
  }
}
