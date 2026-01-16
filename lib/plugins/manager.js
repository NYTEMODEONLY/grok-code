/**
 * Plugin Manager
 * Central manager for all Grok Code plugins
 */

import { EventEmitter } from 'events';
import { PluginLoader } from './loader.js';

export class PluginManager extends EventEmitter {
  constructor(options = {}) {
    super();

    this.plugins = new Map();
    this.loader = new PluginLoader(options);
    this.context = options.context || {};
    this.verbose = options.verbose || false;
  }

  /**
   * Load all plugins from all sources
   * @param {Object} context - Loading context
   */
  async loadPlugins(context = {}) {
    const plugins = await this.loader.loadAll(context);

    for (const plugin of plugins) {
      await this.register(plugin);
    }

    this.emit('plugins:loaded', {
      count: this.plugins.size
    });
  }

  /**
   * Register a plugin
   * @param {BasePlugin} plugin - Plugin to register
   */
  async register(plugin) {
    if (this.plugins.has(plugin.name)) {
      this.emit('plugin:exists', { name: plugin.name });
      return false;
    }

    try {
      await plugin.initialize(this.context);
      this.plugins.set(plugin.name, plugin);

      this.emit('plugin:registered', {
        name: plugin.name,
        version: plugin.version
      });

      return true;
    } catch (error) {
      this.emit('plugin:error', {
        name: plugin.name,
        error: error.message
      });
      return false;
    }
  }

  /**
   * Unregister a plugin
   * @param {string} name - Plugin name
   */
  async unregister(name) {
    const plugin = this.plugins.get(name);

    if (!plugin) {
      return false;
    }

    try {
      await plugin.shutdown();
      this.plugins.delete(name);

      this.emit('plugin:unregistered', { name });
      return true;
    } catch (error) {
      this.emit('plugin:error', {
        name,
        error: error.message
      });
      return false;
    }
  }

  /**
   * Get a plugin by name
   * @param {string} name - Plugin name
   * @returns {BasePlugin|null} Plugin instance
   */
  get(name) {
    return this.plugins.get(name) || null;
  }

  /**
   * Get all plugins
   * @returns {Array} All plugin manifests
   */
  getAll() {
    return Array.from(this.plugins.values()).map(p => p.getManifest());
  }

  /**
   * Get all commands from all plugins
   * @returns {Array} All commands
   */
  getAllCommands() {
    const commands = [];

    for (const plugin of this.plugins.values()) {
      if (!plugin.enabled) continue;

      for (const cmd of plugin.commands) {
        commands.push({
          ...cmd,
          plugin: plugin.name
        });
      }
    }

    return commands;
  }

  /**
   * Get all agents from all plugins
   * @returns {Array} All agents
   */
  getAllAgents() {
    const agents = [];

    for (const plugin of this.plugins.values()) {
      if (!plugin.enabled) continue;

      for (const agent of plugin.agents) {
        agents.push({
          ...agent,
          plugin: plugin.name
        });
      }
    }

    return agents;
  }

  /**
   * Get all hooks from all plugins
   * @returns {Object} Hooks by event
   */
  getAllHooks() {
    const hooks = {};

    for (const plugin of this.plugins.values()) {
      if (!plugin.enabled) continue;

      for (const [event, eventHooks] of Object.entries(plugin.hooks)) {
        if (!hooks[event]) {
          hooks[event] = [];
        }
        hooks[event].push(...eventHooks);
      }
    }

    return hooks;
  }

  /**
   * Get all skills from all plugins
   * @returns {Array} All skills
   */
  getAllSkills() {
    const skills = [];

    for (const plugin of this.plugins.values()) {
      if (!plugin.enabled) continue;

      for (const skill of plugin.skills) {
        skills.push({
          ...skill,
          plugin: plugin.name
        });
      }
    }

    return skills;
  }

  /**
   * Execute a command from a plugin
   * @param {string} pluginName - Plugin name
   * @param {string} commandName - Command name
   * @param {Object} args - Command arguments
   * @param {Object} context - Execution context
   * @returns {Promise<Object>} Command result
   */
  async executeCommand(pluginName, commandName, args, context = {}) {
    const plugin = this.get(pluginName);

    if (!plugin) {
      return { error: `Plugin not found: ${pluginName}` };
    }

    if (!plugin.enabled) {
      return { error: `Plugin is disabled: ${pluginName}` };
    }

    return plugin.handleCommand(commandName, args, context);
  }

  /**
   * Enable a plugin
   * @param {string} name - Plugin name
   */
  enable(name) {
    const plugin = this.get(name);
    if (plugin) {
      plugin.enable();
      this.emit('plugin:enabled', { name });
    }
  }

  /**
   * Disable a plugin
   * @param {string} name - Plugin name
   */
  disable(name) {
    const plugin = this.get(name);
    if (plugin) {
      plugin.disable();
      this.emit('plugin:disabled', { name });
    }
  }

  /**
   * Format plugins for display
   * @returns {string} Formatted plugin list
   */
  formatForDisplay() {
    const plugins = this.getAll();

    if (plugins.length === 0) {
      return 'No plugins installed.';
    }

    return plugins.map(p => {
      const status = p.enabled ? '✅' : '❌';
      const caps = [];

      if (p.capabilities.commands.length > 0) {
        caps.push(`${p.capabilities.commands.length} commands`);
      }
      if (p.capabilities.agents.length > 0) {
        caps.push(`${p.capabilities.agents.length} agents`);
      }
      if (p.capabilities.hooks.length > 0) {
        caps.push(`${p.capabilities.hooks.length} hooks`);
      }
      if (p.capabilities.skills.length > 0) {
        caps.push(`${p.capabilities.skills.length} skills`);
      }

      return `${status} ${p.name} v${p.version}
  ${p.description}
  ${p.author ? `By: ${p.author}` : ''}
  Provides: ${caps.join(', ') || 'none'}`;
    }).join('\n\n');
  }
}
