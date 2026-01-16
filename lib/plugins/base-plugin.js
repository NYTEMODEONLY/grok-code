/**
 * Base Plugin Class
 * Foundation for Grok Code plugins
 */

import { EventEmitter } from 'events';

export class BasePlugin extends EventEmitter {
  constructor(options = {}) {
    super();

    // Plugin metadata
    this.name = options.name || 'BasePlugin';
    this.version = options.version || '1.0.0';
    this.description = options.description || '';
    this.author = options.author || '';

    // Plugin capabilities
    this.commands = options.commands || [];
    this.agents = options.agents || [];
    this.hooks = options.hooks || {};
    this.skills = options.skills || [];

    // Runtime state
    this.enabled = options.enabled !== false;
    this.initialized = false;
    this.context = null;
  }

  /**
   * Initialize the plugin
   * @param {Object} context - Plugin context
   */
  async initialize(context = {}) {
    this.context = context;
    this.initialized = true;

    this.emit('plugin:initialized', {
      name: this.name,
      version: this.version
    });
  }

  /**
   * Shutdown the plugin
   */
  async shutdown() {
    this.initialized = false;

    this.emit('plugin:shutdown', {
      name: this.name
    });
  }

  /**
   * Enable the plugin
   */
  enable() {
    this.enabled = true;
    this.emit('plugin:enabled', { name: this.name });
  }

  /**
   * Disable the plugin
   */
  disable() {
    this.enabled = false;
    this.emit('plugin:disabled', { name: this.name });
  }

  /**
   * Get plugin manifest
   * @returns {Object} Plugin manifest
   */
  getManifest() {
    return {
      name: this.name,
      version: this.version,
      description: this.description,
      author: this.author,
      capabilities: {
        commands: this.commands.map(c => c.name || c),
        agents: this.agents.map(a => a.name || a),
        hooks: Object.keys(this.hooks),
        skills: this.skills.map(s => s.name || s)
      },
      enabled: this.enabled
    };
  }

  /**
   * Handle a command from the plugin
   * @param {string} command - Command name
   * @param {Object} args - Command arguments
   * @param {Object} context - Execution context
   * @returns {Promise<Object>} Command result
   */
  async handleCommand(command, args, context = {}) {
    const cmd = this.commands.find(c => c.name === command);

    if (!cmd) {
      return { error: `Command not found: ${command}` };
    }

    if (typeof cmd.handler === 'function') {
      return cmd.handler(args, context);
    }

    return { error: `Command handler not implemented: ${command}` };
  }

  /**
   * Register a command
   * @param {Object} command - Command definition
   */
  registerCommand(command) {
    this.commands.push({
      name: command.name,
      description: command.description || '',
      usage: command.usage || '',
      handler: command.handler
    });
  }

  /**
   * Register an agent
   * @param {Object} agent - Agent definition
   */
  registerAgent(agent) {
    this.agents.push(agent);
  }

  /**
   * Register a hook
   * @param {string} event - Hook event
   * @param {Object} hook - Hook configuration
   */
  registerHook(event, hook) {
    if (!this.hooks[event]) {
      this.hooks[event] = [];
    }
    this.hooks[event].push(hook);
  }

  /**
   * Register a skill
   * @param {Object} skill - Skill definition
   */
  registerSkill(skill) {
    this.skills.push(skill);
  }
}
