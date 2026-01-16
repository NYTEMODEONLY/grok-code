/**
 * Agentic Conversation Handler
 * Automatically manages tool selection and execution based on user intent
 */

import { EventEmitter } from 'events';

export class AgenticHandler extends EventEmitter {
  constructor(options = {}) {
    super();

    this.grokApi = options.grokApi;
    this.toolExecutor = options.toolExecutor;
    this.hooksManager = options.hooksManager;
    this.permissionManager = options.permissionManager;

    // Configuration
    this.maxToolIterations = options.maxToolIterations || 10;
    this.autoExecuteTools = options.autoExecuteTools ?? true;
    this.requireConfirmation = options.requireConfirmation ?? true;

    // Conversation state
    this.messages = [];
    this.pendingToolCalls = [];
    this.executedTools = [];

    // System prompt for agentic behavior
    this.systemPrompt = this.buildSystemPrompt(options.projectContext || {});
  }

  /**
   * Build the system prompt for agentic behavior
   * @param {Object} context - Project context
   * @returns {string} System prompt
   */
  buildSystemPrompt(context) {
    const currentDir = context.currentDir || process.cwd();
    const os = process.platform === 'darwin' ? 'macOS' : process.platform === 'win32' ? 'Windows' : 'Linux';
    const dateTime = new Date().toISOString().slice(0, 19).replace('T', ' ');

    return `You are Grok Code, an agentic AI coding assistant built by xAI, running in the terminal.

Current date and time: ${dateTime}
Operating system: ${os}
Working directory: ${currentDir}
${context.grokMdContent ? `Project configuration (GROK.md):\n${context.grokMdContent}` : ''}

You are an expert software engineer. Your role is to help users understand, write, debug, and improve code.

## Available Tools

You have access to these tools to help accomplish tasks:

1. **Read** - Read file contents from the filesystem
   - Parameters: file_path (required), offset (optional), limit (optional)
   - Use for: viewing code, checking file contents, understanding implementations

2. **Write** - Write content to a file (creates or overwrites)
   - Parameters: file_path (required), content (required)
   - Use for: creating new files, replacing entire file contents

3. **Edit** - Make exact string replacements in files
   - Parameters: file_path (required), old_string (required), new_string (required), replace_all (optional)
   - Use for: precise code modifications, bug fixes, refactoring

4. **Bash** - Execute shell commands
   - Parameters: command (required), timeout (optional)
   - Use for: running tests, installing packages, git operations, building projects

5. **Grep** - Search file contents with regex
   - Parameters: pattern (required), path (optional), glob (optional), output_mode (optional)
   - Use for: finding code patterns, locating functions/classes, searching across files

6. **Glob** - Find files by pattern
   - Parameters: pattern (required), path (optional)
   - Use for: listing files, finding specific file types

7. **TodoWrite** - Track tasks and progress
   - Parameters: todos (required - array of {content, status, activeForm})
   - Use for: planning multi-step tasks, tracking progress

## Guidelines

1. **Be proactive**: When users ask for code changes, make the changes directly using tools rather than just explaining.

2. **Read before writing**: Always read a file before editing it to understand its current state.

3. **Use precise edits**: Prefer Edit tool over Write when modifying existing files.

4. **Explain your actions**: Briefly explain what you're doing and why.

5. **Handle errors gracefully**: If a tool fails, explain the error and try alternative approaches.

6. **Ask for clarification**: If a request is ambiguous, ask clarifying questions.

7. **Security first**: Never execute potentially dangerous commands without user confirmation.

8. **Backup important files**: When making significant changes, consider the impact.

## Response Format

When you need to use a tool, include the tool call in your response. The system will execute it and provide the result.

When providing code suggestions, be specific about file paths and exact changes needed.

Always think step-by-step for complex tasks:
1. Understand the request
2. Gather necessary context (read files, search codebase)
3. Plan the changes
4. Execute the changes
5. Verify the results
`;
  }

  /**
   * Initialize conversation with system prompt
   */
  initializeConversation() {
    this.messages = [
      { role: 'system', content: this.systemPrompt }
    ];
  }

  /**
   * Process a user message and handle the full conversation loop
   * @param {string} userMessage - User's message
   * @param {Object} options - Processing options
   * @returns {Promise<Object>} Final response with any tool results
   */
  async processMessage(userMessage, options = {}) {
    // Fire user prompt submit hook
    if (this.hooksManager) {
      const hookResult = await this.hooksManager.trigger('UserPromptSubmit', {
        message: userMessage,
        messages: this.messages
      });

      // Check if hook blocks the request
      if (hookResult.blocked) {
        return {
          response: hookResult.message || 'Request blocked by hook.',
          blocked: true
        };
      }

      // Allow hook to modify the message
      if (hookResult.modifiedMessage) {
        userMessage = hookResult.modifiedMessage;
      }
    }

    // Add user message to conversation
    this.messages.push({ role: 'user', content: userMessage });

    let iterations = 0;
    let finalResponse = null;
    const toolResults = [];

    while (iterations < this.maxToolIterations) {
      iterations++;

      this.emit('iteration', { iteration: iterations, maxIterations: this.maxToolIterations });

      try {
        // Get AI response
        const response = await this.grokApi.chat({
          messages: this.messages,
          useTools: this.autoExecuteTools && this.toolExecutor,
          stream: options.stream,
          onToken: options.onToken
        });

        const assistantMessage = response.choices[0].message;
        this.messages.push(assistantMessage);

        // Check for tool calls
        if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
          this.emit('toolCalls', { calls: assistantMessage.tool_calls });

          // Process each tool call
          for (const toolCall of assistantMessage.tool_calls) {
            const result = await this.executeToolCall(toolCall, options);
            toolResults.push(result);

            // Add tool result to messages
            this.messages.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              content: JSON.stringify(result.output)
            });
          }

          // Continue the loop to get AI's response to tool results
          continue;
        }

        // No tool calls - we have the final response
        finalResponse = assistantMessage.content;
        break;

      } catch (error) {
        this.emit('error', error);

        // Add error context and try to recover
        this.messages.push({
          role: 'system',
          content: `Error occurred: ${error.message}. Please acknowledge and continue.`
        });

        if (iterations >= this.maxToolIterations - 1) {
          finalResponse = `I encountered an error: ${error.message}. Please try again or rephrase your request.`;
          break;
        }
      }
    }

    // Fire stop hook if we hit max iterations
    if (iterations >= this.maxToolIterations) {
      if (this.hooksManager) {
        await this.hooksManager.trigger('Stop', {
          reason: 'max_iterations',
          iterations
        });
      }
    }

    return {
      response: finalResponse,
      toolResults,
      iterations,
      messages: this.messages
    };
  }

  /**
   * Execute a single tool call
   * @param {Object} toolCall - Tool call from AI
   * @param {Object} options - Execution options
   * @returns {Promise<Object>} Tool execution result
   */
  async executeToolCall(toolCall, options = {}) {
    const toolName = toolCall.function.name;
    let toolArgs;

    try {
      toolArgs = JSON.parse(toolCall.function.arguments);
    } catch {
      toolArgs = {};
    }

    this.emit('toolExecuting', { name: toolName, arguments: toolArgs });

    // Fire PreToolUse hook
    if (this.hooksManager) {
      const preHookResult = await this.hooksManager.trigger('PreToolUse', {
        tool: toolName,
        arguments: toolArgs
      });

      if (preHookResult.blocked) {
        return {
          tool: toolName,
          arguments: toolArgs,
          output: { error: preHookResult.message || 'Tool execution blocked by hook' },
          blocked: true
        };
      }

      // Allow hook to modify arguments
      if (preHookResult.modifiedArguments) {
        toolArgs = preHookResult.modifiedArguments;
      }
    }

    // Check permission if required
    if (this.requireConfirmation && this.permissionManager) {
      const hasPermission = await this.permissionManager.checkPermission(toolName, toolArgs);

      if (!hasPermission) {
        // Request permission
        const granted = await this.requestPermission(toolName, toolArgs, options);

        if (!granted) {
          return {
            tool: toolName,
            arguments: toolArgs,
            output: { error: 'Permission denied by user' },
            permissionDenied: true
          };
        }
      }
    }

    // Execute the tool
    let output;
    let error = null;

    try {
      if (this.toolExecutor) {
        output = await this.toolExecutor.execute(toolName, toolArgs);
      } else {
        output = { error: 'No tool executor configured' };
      }
    } catch (err) {
      error = err;
      output = { error: err.message };
    }

    // Fire PostToolUse hook
    if (this.hooksManager) {
      await this.hooksManager.trigger('PostToolUse', {
        tool: toolName,
        arguments: toolArgs,
        output,
        error
      });
    }

    this.emit('toolExecuted', { name: toolName, arguments: toolArgs, output, error });

    // Track executed tool
    this.executedTools.push({
      name: toolName,
      arguments: toolArgs,
      output,
      error,
      timestamp: new Date().toISOString()
    });

    return {
      tool: toolName,
      arguments: toolArgs,
      output,
      error
    };
  }

  /**
   * Request permission from user for tool execution
   * @param {string} toolName - Tool name
   * @param {Object} toolArgs - Tool arguments
   * @param {Object} options - Options including permission callback
   * @returns {Promise<boolean>} Whether permission was granted
   */
  async requestPermission(toolName, toolArgs, options = {}) {
    // Fire permission request hook
    if (this.hooksManager) {
      const hookResult = await this.hooksManager.trigger('PermissionRequest', {
        tool: toolName,
        arguments: toolArgs
      });

      // Hook can auto-approve or deny
      if (hookResult.approved !== undefined) {
        return hookResult.approved;
      }
    }

    // Use callback if provided
    if (options.onPermissionRequest) {
      return await options.onPermissionRequest(toolName, toolArgs);
    }

    // Default to approved if no permission handler
    return true;
  }

  /**
   * Add context to the conversation
   * @param {string} content - Context content
   * @param {string} type - Context type (file, system, etc.)
   */
  addContext(content, type = 'system') {
    this.messages.push({
      role: 'system',
      content: `[${type}] ${content}`
    });
  }

  /**
   * Get conversation history
   * @returns {Array} Messages
   */
  getHistory() {
    return this.messages.filter(m => m.role !== 'system');
  }

  /**
   * Get executed tools history
   * @returns {Array} Executed tools
   */
  getExecutedTools() {
    return this.executedTools;
  }

  /**
   * Clear conversation history
   */
  clearHistory() {
    this.initializeConversation();
    this.executedTools = [];
    this.pendingToolCalls = [];
  }

  /**
   * Undo the last tool execution
   * @returns {Promise<Object>} Undo result
   */
  async undoLastTool() {
    if (this.executedTools.length === 0) {
      return { success: false, message: 'No tools to undo' };
    }

    const lastTool = this.executedTools.pop();

    if (this.toolExecutor && this.toolExecutor.undo) {
      try {
        await this.toolExecutor.undo();
        return { success: true, tool: lastTool.name, message: 'Successfully undone' };
      } catch (error) {
        return { success: false, message: error.message };
      }
    }

    return { success: false, message: 'Undo not supported' };
  }

  /**
   * Export conversation for persistence
   * @returns {Object} Serializable conversation state
   */
  exportState() {
    return {
      messages: this.messages,
      executedTools: this.executedTools,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Import conversation state
   * @param {Object} state - Previously exported state
   */
  importState(state) {
    if (state.messages) {
      this.messages = state.messages;
    }
    if (state.executedTools) {
      this.executedTools = state.executedTools;
    }
  }
}

/**
 * Permission Manager for tool execution
 */
export class PermissionManager {
  constructor(options = {}) {
    this.allowedPatterns = options.allowedPatterns || [];
    this.deniedPatterns = options.deniedPatterns || [];
    this.sessionApprovals = new Map();
    this.alwaysRequireConfirmation = options.alwaysRequireConfirmation || [
      'Bash',
      'Write',
      'Edit'
    ];
  }

  /**
   * Check if a tool execution is permitted
   * @param {string} toolName - Tool name
   * @param {Object} toolArgs - Tool arguments
   * @returns {Promise<boolean>} Whether permitted
   */
  async checkPermission(toolName, toolArgs) {
    // Check denied patterns first
    for (const pattern of this.deniedPatterns) {
      if (this.matchesPattern(pattern, toolName, toolArgs)) {
        return false;
      }
    }

    // Check allowed patterns
    for (const pattern of this.allowedPatterns) {
      if (this.matchesPattern(pattern, toolName, toolArgs)) {
        return true;
      }
    }

    // Check session approvals
    const key = this.getApprovalKey(toolName, toolArgs);
    if (this.sessionApprovals.has(key)) {
      return this.sessionApprovals.get(key);
    }

    // Tools that don't require confirmation
    if (!this.alwaysRequireConfirmation.includes(toolName)) {
      return true;
    }

    return false;
  }

  /**
   * Record a permission decision for the session
   * @param {string} toolName - Tool name
   * @param {Object} toolArgs - Tool arguments
   * @param {boolean} approved - Whether approved
   */
  recordDecision(toolName, toolArgs, approved) {
    const key = this.getApprovalKey(toolName, toolArgs);
    this.sessionApprovals.set(key, approved);
  }

  /**
   * Add an allowed pattern
   * @param {string} pattern - Pattern string (e.g., "Bash(git:*)")
   */
  allow(pattern) {
    this.allowedPatterns.push(pattern);
  }

  /**
   * Add a denied pattern
   * @param {string} pattern - Pattern string
   */
  deny(pattern) {
    this.deniedPatterns.push(pattern);
  }

  /**
   * Check if a pattern matches
   * @param {string} pattern - Pattern to check
   * @param {string} toolName - Tool name
   * @param {Object} toolArgs - Tool arguments
   * @returns {boolean} Whether matches
   */
  matchesPattern(pattern, toolName, toolArgs) {
    // Simple pattern matching: "ToolName" or "ToolName(arg:value)"
    if (pattern === toolName) {
      return true;
    }

    const match = pattern.match(/^(\w+)\((.+)\)$/);
    if (match) {
      const [, patternTool, patternArgs] = match;

      if (patternTool !== toolName) {
        return false;
      }

      // Parse pattern arguments
      const argParts = patternArgs.split(':');
      if (argParts.length === 2) {
        const [argName, argPattern] = argParts;

        if (argPattern === '*') {
          return argName in toolArgs;
        }

        if (argPattern.endsWith('*')) {
          const prefix = argPattern.slice(0, -1);
          return String(toolArgs[argName] || '').startsWith(prefix);
        }

        return toolArgs[argName] === argPattern;
      }
    }

    return false;
  }

  /**
   * Get a unique key for an approval
   * @param {string} toolName - Tool name
   * @param {Object} toolArgs - Tool arguments
   * @returns {string} Approval key
   */
  getApprovalKey(toolName, toolArgs) {
    // Create a simplified key based on tool and primary argument
    const primaryArg = toolArgs.file_path || toolArgs.command || toolArgs.pattern || '';
    return `${toolName}:${primaryArg}`;
  }

  /**
   * Clear session approvals
   */
  clearSession() {
    this.sessionApprovals.clear();
  }
}
