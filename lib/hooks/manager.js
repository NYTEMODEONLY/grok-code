/**
 * Hooks Manager
 * Central manager for all Grok Code hooks
 */

import { EventEmitter } from 'events';
import { HookRunner } from './runner.js';
import { HookLoader } from './loader.js';

export class HooksManager extends EventEmitter {
  constructor(options = {}) {
    super();

    this.hooks = new Map();
    this.runner = new HookRunner(options);
    this.loader = new HookLoader(options);
    this.enabled = options.enabled !== false;
    this.verbose = options.verbose || false;
    this.cwd = options.cwd || process.cwd();

    // Hook events supported by Grok Code (Claude Code compatible)
    this.supportedEvents = [
      'PreToolUse',      // Before tool execution
      'PostToolUse',     // After tool execution
      'PermissionRequest', // When permission is needed
      'UserPromptSubmit',  // When user submits prompt
      'Stop',            // When assistant stops
      'SubagentStop',    // When subagent stops
      'Notification',    // When notification is sent
      'SessionStart',    // When session begins
      'SessionEnd',      // When session ends
      'PreCompact'       // Before context compaction
    ];
  }

  /**
   * Load hooks from all sources
   * @param {Object} context - Loading context
   */
  async loadHooks(context = {}) {
    // Load from settings files
    const settings = await this.loader.loadSettings(context);

    if (settings.hooks) {
      for (const [event, hookConfigs] of Object.entries(settings.hooks)) {
        if (this.supportedEvents.includes(event)) {
          this.registerHooks(event, hookConfigs);
        }
      }
    }

    // Load from plugins
    const pluginHooks = await this.loader.loadPluginHooks(context);
    for (const [event, hookConfigs] of Object.entries(pluginHooks)) {
      this.registerHooks(event, hookConfigs);
    }

    this.emit('hooks:loaded', {
      eventCount: this.hooks.size,
      totalHooks: Array.from(this.hooks.values()).reduce((sum, h) => sum + h.length, 0)
    });
  }

  /**
   * Register hooks for an event
   * @param {string} event - Event name
   * @param {Array} hookConfigs - Hook configurations
   */
  registerHooks(event, hookConfigs) {
    if (!this.hooks.has(event)) {
      this.hooks.set(event, []);
    }

    for (const config of hookConfigs) {
      this.hooks.get(event).push({
        matcher: config.matcher || '*',
        hooks: config.hooks || [],
        priority: config.priority || 0
      });
    }

    // Sort by priority (higher first)
    this.hooks.get(event).sort((a, b) => b.priority - a.priority);
  }

  /**
   * Run hooks for an event
   * @param {string} event - Event name
   * @param {Object} input - Hook input data
   * @returns {Promise<Object>} Hook results
   */
  async run(event, input = {}) {
    if (!this.enabled) {
      return { blocked: false };
    }

    const eventHooks = this.hooks.get(event);
    if (!eventHooks || eventHooks.length === 0) {
      return { blocked: false };
    }

    // Find matching hooks
    const matchingHooks = eventHooks.filter(h =>
      this.matchesPattern(h.matcher, input.toolName || input.matcher || '')
    );

    if (matchingHooks.length === 0) {
      return { blocked: false };
    }

    // Build hook input
    const hookInput = this.buildHookInput(event, input);

    // Run all matching hooks
    const results = [];
    let blocked = false;
    let blockReason = null;
    let updatedInput = null;
    let additionalContext = null;

    for (const hookConfig of matchingHooks) {
      for (const hook of hookConfig.hooks) {
        try {
          const result = await this.runner.run(hook, hookInput);
          results.push(result);

          // Check for blocking decision
          if (result.exitCode === 2 || result.decision === 'block') {
            blocked = true;
            blockReason = result.reason || result.stderr || 'Hook blocked execution';
          }

          // Check for permission decision
          if (result.hookSpecificOutput) {
            const specific = result.hookSpecificOutput;

            if (specific.permissionDecision === 'deny') {
              blocked = true;
              blockReason = specific.permissionDecisionReason || 'Permission denied by hook';
            }

            if (specific.updatedInput) {
              updatedInput = { ...updatedInput, ...specific.updatedInput };
            }

            if (specific.additionalContext) {
              additionalContext = specific.additionalContext;
            }
          }

          // Stop on blocking error
          if (blocked) break;
        } catch (error) {
          this.emit('hook:error', { event, hook, error: error.message });

          if (this.verbose) {
            console.error(`Hook error in ${event}: ${error.message}`);
          }
        }
      }

      if (blocked) break;
    }

    return {
      blocked,
      reason: blockReason,
      updatedInput,
      additionalContext,
      results
    };
  }

  /**
   * Check if a pattern matches a value
   * @param {string} pattern - Matcher pattern
   * @param {string} value - Value to match
   * @returns {boolean} Whether it matches
   */
  matchesPattern(pattern, value) {
    if (pattern === '*') return true;
    if (pattern === value) return true;

    // Support regex patterns
    if (pattern.includes('|')) {
      const parts = pattern.split('|');
      return parts.some(p => p === value);
    }

    // Support wildcard
    if (pattern.includes('*')) {
      const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
      return regex.test(value);
    }

    return false;
  }

  /**
   * Build hook input based on event type
   * @param {string} event - Event name
   * @param {Object} input - Raw input
   * @returns {Object} Hook input
   */
  buildHookInput(event, input) {
    const base = {
      session_id: input.context?.sessionId || 'unknown',
      transcript_path: input.context?.transcriptPath || '',
      cwd: input.context?.cwd || this.cwd,
      permission_mode: input.context?.permissionMode || 'default',
      hook_event_name: event
    };

    switch (event) {
      case 'PreToolUse':
      case 'PostToolUse':
        return {
          ...base,
          tool_name: input.toolName,
          tool_input: input.toolInput,
          tool_output: input.toolOutput,
          tool_use_id: input.executionId || `tool-${Date.now()}`
        };

      case 'UserPromptSubmit':
        return {
          ...base,
          prompt: input.prompt
        };

      case 'PermissionRequest':
        return {
          ...base,
          tool_name: input.toolName,
          tool_input: input.toolInput,
          permission_type: input.permissionType || 'execute'
        };

      case 'Stop':
      case 'SubagentStop':
        return {
          ...base,
          stop_reason: input.stopReason,
          agent_name: input.agentName
        };

      case 'Notification':
        return {
          ...base,
          notification_type: input.notificationType,
          message: input.message
        };

      case 'SessionStart':
      case 'SessionEnd':
        return {
          ...base,
          session_id: input.sessionId
        };

      default:
        return { ...base, ...input };
    }
  }

  /**
   * Add a hook dynamically
   * @param {string} event - Event name
   * @param {Object} hookConfig - Hook configuration
   */
  addHook(event, hookConfig) {
    if (!this.supportedEvents.includes(event)) {
      throw new Error(`Unsupported hook event: ${event}`);
    }

    if (!this.hooks.has(event)) {
      this.hooks.set(event, []);
    }

    this.hooks.get(event).push({
      matcher: hookConfig.matcher || '*',
      hooks: hookConfig.hooks || [hookConfig],
      priority: hookConfig.priority || 0
    });
  }

  /**
   * Remove hooks for an event
   * @param {string} event - Event name
   * @param {string} matcher - Optional matcher to remove specific hooks
   */
  removeHooks(event, matcher = null) {
    if (matcher) {
      const eventHooks = this.hooks.get(event);
      if (eventHooks) {
        const filtered = eventHooks.filter(h => h.matcher !== matcher);
        this.hooks.set(event, filtered);
      }
    } else {
      this.hooks.delete(event);
    }
  }

  /**
   * Get all registered hooks
   * @returns {Object} Hooks by event
   */
  getHooks() {
    const result = {};
    for (const [event, hooks] of this.hooks) {
      result[event] = hooks;
    }
    return result;
  }

  /**
   * Enable/disable hooks
   * @param {boolean} enabled - Whether to enable
   */
  setEnabled(enabled) {
    this.enabled = enabled;
    this.emit('hooks:enabled', { enabled });
  }
}
