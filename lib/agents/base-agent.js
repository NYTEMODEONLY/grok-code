/**
 * Base Agent Class
 * Foundation for all Grok Code sub-agents
 */

import { EventEmitter } from 'events';

export class BaseAgent extends EventEmitter {
  constructor(options = {}) {
    super();

    // Required fields
    this.name = options.name || 'BaseAgent';
    this.description = options.description || '';

    // Tools configuration
    this.tools = options.tools || []; // List of allowed tool names
    this.disallowedTools = options.disallowedTools || [];

    // Model configuration
    this.model = options.model || 'inherit'; // sonnet, opus, haiku, or inherit

    // Permission mode
    this.permissionMode = options.permissionMode || 'default';
    // default, acceptEdits, dontAsk, bypassPermissions, plan

    // Skills to inject
    this.skills = options.skills || [];

    // Lifecycle hooks
    this.hooks = options.hooks || {};

    // System prompt (the agent's instructions)
    this.prompt = options.prompt || '';

    // Display options
    this.color = options.color || 'cyan';

    // Runtime state
    this.isRunning = false;
    this.context = null;
    this.transcript = [];
    this.startTime = null;
  }

  /**
   * Get the system prompt for this agent
   * @param {Object} context - Execution context
   * @returns {string} System prompt
   */
  getSystemPrompt(context = {}) {
    let prompt = this.prompt;

    // Add context-specific information
    if (context.cwd) {
      prompt += `\n\nCurrent working directory: ${context.cwd}`;
    }

    if (context.projectInfo) {
      prompt += `\n\nProject information:\n${JSON.stringify(context.projectInfo, null, 2)}`;
    }

    return prompt;
  }

  /**
   * Get allowed tools for this agent
   * @param {Object} allTools - All available tools
   * @returns {Array} Allowed tool schemas
   */
  getAllowedTools(allTools) {
    if (this.tools.length === 0 && this.disallowedTools.length === 0) {
      // No restrictions - inherit all tools
      return allTools;
    }

    return allTools.filter(tool => {
      // Check disallowed list
      if (this.disallowedTools.includes(tool.name)) {
        return false;
      }

      // Check allowed list (if specified)
      if (this.tools.length > 0 && !this.tools.includes(tool.name)) {
        return false;
      }

      return true;
    });
  }

  /**
   * Check if agent requires permission for an action
   * @param {string} action - Action type
   * @returns {boolean} Whether permission is required
   */
  requiresPermission(action) {
    switch (this.permissionMode) {
      case 'bypassPermissions':
        return false;
      case 'acceptEdits':
        return !['Edit', 'Write', 'MultiEdit'].includes(action);
      case 'dontAsk':
        return true; // Always deny
      case 'plan':
        return true; // Read-only mode
      default:
        return true;
    }
  }

  /**
   * Start the agent
   * @param {Object} context - Execution context
   */
  async start(context = {}) {
    this.isRunning = true;
    this.context = context;
    this.startTime = Date.now();
    this.transcript = [];

    this.emit('agent:started', {
      name: this.name,
      context,
      timestamp: new Date().toISOString()
    });

    // Run start hooks
    if (this.hooks.SubagentStart) {
      await this.runHooks('SubagentStart', context);
    }
  }

  /**
   * Stop the agent
   * @param {Object} result - Final result
   */
  async stop(result = {}) {
    // Run stop hooks
    if (this.hooks.SubagentStop) {
      await this.runHooks('SubagentStop', { ...this.context, result });
    }

    this.isRunning = false;

    this.emit('agent:stopped', {
      name: this.name,
      result,
      runtime: Date.now() - this.startTime,
      transcriptLength: this.transcript.length,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Run hooks for an event
   * @param {string} event - Event name
   * @param {Object} data - Event data
   */
  async runHooks(event, data) {
    const hooks = this.hooks[event];
    if (!hooks || !Array.isArray(hooks)) return;

    for (const hook of hooks) {
      try {
        if (hook.type === 'command') {
          // Execute shell command
          const { exec } = await import('child_process');
          const { promisify } = await import('util');
          const execAsync = promisify(exec);

          const timeout = hook.timeout || 60000;
          await execAsync(hook.command, {
            timeout,
            cwd: data.cwd || process.cwd(),
            env: { ...process.env, GROK_AGENT_NAME: this.name }
          });
        }
      } catch (error) {
        this.emit('hook:error', { event, error: error.message });
      }
    }
  }

  /**
   * Add to transcript
   * @param {Object} entry - Transcript entry
   */
  addToTranscript(entry) {
    this.transcript.push({
      ...entry,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Get agent configuration for serialization
   * @returns {Object} Agent configuration
   */
  toConfig() {
    return {
      name: this.name,
      description: this.description,
      tools: this.tools,
      disallowedTools: this.disallowedTools,
      model: this.model,
      permissionMode: this.permissionMode,
      skills: this.skills,
      prompt: this.prompt,
      color: this.color
    };
  }

  /**
   * Create agent from configuration
   * @param {Object} config - Agent configuration
   * @returns {BaseAgent} Agent instance
   */
  static fromConfig(config) {
    return new BaseAgent(config);
  }
}
