/**
 * Tool Registry
 * Central registry for all available tools in Grok Code
 */

import { EventEmitter } from 'events';

export class ToolRegistry extends EventEmitter {
  constructor(options = {}) {
    super();
    this.tools = new Map();
    this.aliases = new Map();
    this.permissions = options.permissions || {};
    this.hooks = options.hooks || null;
    this.allowedTools = options.allowedTools || null; // null = all allowed
    this.deniedTools = options.deniedTools || [];
  }

  /**
   * Register a tool
   * @param {BaseTool} tool - Tool instance to register
   * @param {string[]} aliases - Optional aliases for the tool
   */
  register(tool, aliases = []) {
    this.tools.set(tool.name, tool);

    for (const alias of aliases) {
      this.aliases.set(alias, tool.name);
    }

    this.emit('tool:registered', { name: tool.name, aliases });
  }

  /**
   * Get a tool by name or alias
   * @param {string} name - Tool name or alias
   * @returns {BaseTool|null} Tool instance or null
   */
  get(name) {
    // Check direct name first
    if (this.tools.has(name)) {
      return this.tools.get(name);
    }

    // Check aliases
    const realName = this.aliases.get(name);
    if (realName && this.tools.has(realName)) {
      return this.tools.get(realName);
    }

    return null;
  }

  /**
   * Check if a tool is allowed
   * @param {string} name - Tool name
   * @returns {boolean} Whether the tool is allowed
   */
  isAllowed(name) {
    // Check denied list first
    if (this.deniedTools.includes(name)) {
      return false;
    }

    // If allowedTools is set, check if tool is in the list
    if (this.allowedTools !== null) {
      return this.allowedTools.includes(name);
    }

    return true;
  }

  /**
   * Get all registered tools
   * @returns {Array} Array of tool schemas
   */
  getAllTools() {
    return Array.from(this.tools.values()).map(tool => tool.getSchema());
  }

  /**
   * Get allowed tools for a specific context
   * @param {Object} context - Context with permissions
   * @returns {Array} Array of allowed tool schemas
   */
  getAllowedTools(context = {}) {
    const { allowedTools, deniedTools } = context;

    return Array.from(this.tools.values())
      .filter(tool => {
        // Check context-specific denied tools
        if (deniedTools && deniedTools.includes(tool.name)) {
          return false;
        }

        // Check context-specific allowed tools
        if (allowedTools && !allowedTools.includes(tool.name)) {
          return false;
        }

        // Check registry-level permissions
        return this.isAllowed(tool.name);
      })
      .map(tool => tool.getSchema());
  }

  /**
   * Get read-only tools
   * @returns {Array} Array of read-only tool schemas
   */
  getReadOnlyTools() {
    return Array.from(this.tools.values())
      .filter(tool => tool.isReadOnly)
      .map(tool => tool.getSchema());
  }

  /**
   * Get tools that require permission
   * @returns {Array} Array of tools requiring permission
   */
  getPermissionTools() {
    return Array.from(this.tools.values())
      .filter(tool => tool.requiresPermission)
      .map(tool => tool.getSchema());
  }

  /**
   * Format tools for AI model consumption
   * @param {Object} options - Formatting options
   * @returns {string} Formatted tool descriptions
   */
  formatForModel(options = {}) {
    const tools = options.readOnly
      ? this.getReadOnlyTools()
      : this.getAllowedTools(options);

    return tools.map(tool => {
      let desc = `## ${tool.name}\n${tool.description}\n`;

      if (tool.parameters && tool.parameters.properties) {
        desc += '\nParameters:\n';
        for (const [name, param] of Object.entries(tool.parameters.properties)) {
          const required = tool.parameters.required?.includes(name) ? ' (required)' : '';
          desc += `- ${name}${required}: ${param.description || param.type}\n`;
        }
      }

      return desc;
    }).join('\n---\n');
  }

  /**
   * Generate tool calling schema for API
   * @returns {Array} Array of tool definitions for API
   */
  getToolCallingSchema() {
    return Array.from(this.tools.values())
      .filter(tool => this.isAllowed(tool.name))
      .map(tool => ({
        type: 'function',
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters
        }
      }));
  }
}
