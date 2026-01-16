/**
 * Agent Loader
 * Loads agents from files and directories
 */

import fs from 'fs-extra';
import path from 'path';
import { BaseAgent } from './base-agent.js';

export class AgentLoader {
  constructor(options = {}) {
    this.userAgentsDir = options.userAgentsDir || path.join(process.env.HOME || '', '.grok', 'agents');
    this.projectAgentsDir = options.projectAgentsDir || '.grok/agents';
    this.pluginAgentsDir = options.pluginAgentsDir || null;
  }

  /**
   * Load all agents from all sources
   * @param {Object} context - Loading context
   * @returns {Promise<Array>} Loaded agents
   */
  async loadAll(context = {}) {
    const agents = [];

    // Load project-level agents (highest priority after CLI)
    const projectPath = path.resolve(context.cwd || process.cwd(), this.projectAgentsDir);
    const projectAgents = await this.loadFromDirectory(projectPath);
    agents.push(...projectAgents);

    // Load user-level agents
    const userAgents = await this.loadFromDirectory(this.userAgentsDir);
    agents.push(...userAgents);

    // Load plugin agents
    if (this.pluginAgentsDir) {
      const pluginAgents = await this.loadFromDirectory(this.pluginAgentsDir);
      agents.push(...pluginAgents);
    }

    // Deduplicate by name (earlier entries take precedence)
    const uniqueAgents = new Map();
    for (const agent of agents) {
      if (!uniqueAgents.has(agent.name)) {
        uniqueAgents.set(agent.name, agent);
      }
    }

    return Array.from(uniqueAgents.values());
  }

  /**
   * Load agents from a directory
   * @param {string} dir - Directory path
   * @returns {Promise<Array>} Loaded agents
   */
  async loadFromDirectory(dir) {
    const agents = [];

    try {
      if (!await fs.pathExists(dir)) {
        return agents;
      }

      const files = await fs.readdir(dir);

      for (const file of files) {
        if (!file.endsWith('.md')) continue;

        const filePath = path.join(dir, file);
        const agent = await this.loadFromFile(filePath);

        if (agent) {
          agents.push(agent);
        }
      }
    } catch (error) {
      console.warn(`Failed to load agents from ${dir}: ${error.message}`);
    }

    return agents;
  }

  /**
   * Load an agent from a markdown file with YAML frontmatter
   * @param {string} filePath - Path to agent file
   * @returns {Promise<BaseAgent|null>} Loaded agent
   */
  async loadFromFile(filePath) {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      const { frontmatter, body } = this.parseFrontmatter(content);

      if (!frontmatter.name) {
        // Use filename as name
        frontmatter.name = path.basename(filePath, '.md');
      }

      return new BaseAgent({
        name: frontmatter.name,
        description: frontmatter.description || '',
        tools: this.parseTools(frontmatter.tools),
        disallowedTools: this.parseTools(frontmatter.disallowedTools),
        model: frontmatter.model || 'inherit',
        permissionMode: frontmatter.permissionMode || 'default',
        skills: frontmatter.skills || [],
        hooks: frontmatter.hooks || {},
        prompt: body.trim(),
        color: frontmatter.color || 'cyan',
        filePath
      });
    } catch (error) {
      console.warn(`Failed to load agent from ${filePath}: ${error.message}`);
      return null;
    }
  }

  /**
   * Parse YAML frontmatter from markdown
   * @param {string} content - File content
   * @returns {Object} Parsed frontmatter and body
   */
  parseFrontmatter(content) {
    const frontmatterRegex = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/;
    const match = content.match(frontmatterRegex);

    if (!match) {
      return { frontmatter: {}, body: content };
    }

    const [, yamlStr, body] = match;
    const frontmatter = this.parseSimpleYaml(yamlStr);

    return { frontmatter, body };
  }

  /**
   * Simple YAML parser for frontmatter
   * @param {string} yaml - YAML string
   * @returns {Object} Parsed object
   */
  parseSimpleYaml(yaml) {
    const result = {};
    const lines = yaml.split('\n');
    let currentKey = null;
    let currentIndent = 0;
    let arrayValue = null;

    for (const line of lines) {
      // Skip empty lines and comments
      if (!line.trim() || line.trim().startsWith('#')) continue;

      const indent = line.search(/\S/);
      const trimmedLine = line.trim();

      // Array item
      if (trimmedLine.startsWith('- ')) {
        if (arrayValue !== null) {
          arrayValue.push(this.parseYamlValue(trimmedLine.slice(2)));
        }
        continue;
      }

      // Key-value pair
      const colonIndex = trimmedLine.indexOf(':');
      if (colonIndex !== -1) {
        const key = trimmedLine.slice(0, colonIndex).trim();
        const value = trimmedLine.slice(colonIndex + 1).trim();

        // Check if this starts an array or nested object
        if (value === '' || value === '|' || value === '>') {
          result[key] = [];
          arrayValue = result[key];
          currentKey = key;
        } else {
          result[key] = this.parseYamlValue(value);
          arrayValue = null;
        }
      }
    }

    return result;
  }

  /**
   * Parse a YAML value
   * @param {string} value - Value string
   * @returns {*} Parsed value
   */
  parseYamlValue(value) {
    // Boolean
    if (value === 'true') return true;
    if (value === 'false') return false;

    // Number
    if (/^-?\d+$/.test(value)) return parseInt(value, 10);
    if (/^-?\d+\.\d+$/.test(value)) return parseFloat(value);

    // Quoted string
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      return value.slice(1, -1);
    }

    return value;
  }

  /**
   * Parse tools specification
   * @param {*} tools - Tools specification
   * @returns {Array} Tool names
   */
  parseTools(tools) {
    if (!tools) return [];
    if (Array.isArray(tools)) return tools;
    if (typeof tools === 'string') {
      return tools.split(',').map(t => t.trim()).filter(Boolean);
    }
    return [];
  }

  /**
   * Create a new agent file
   * @param {Object} config - Agent configuration
   * @param {string} scope - 'user' or 'project'
   * @param {Object} context - Context with cwd
   * @returns {Promise<string>} Path to created file
   */
  async createAgentFile(config, scope = 'project', context = {}) {
    const dir = scope === 'user'
      ? this.userAgentsDir
      : path.resolve(context.cwd || process.cwd(), this.projectAgentsDir);

    await fs.ensureDir(dir);

    const fileName = `${config.name.toLowerCase().replace(/\s+/g, '-')}.md`;
    const filePath = path.join(dir, fileName);

    // Generate markdown content
    const content = this.generateAgentMarkdown(config);
    await fs.writeFile(filePath, content);

    return filePath;
  }

  /**
   * Generate markdown content for an agent
   * @param {Object} config - Agent configuration
   * @returns {string} Markdown content
   */
  generateAgentMarkdown(config) {
    const frontmatter = [
      '---',
      `name: ${config.name}`,
      `description: ${config.description || ''}`,
    ];

    if (config.tools && config.tools.length > 0) {
      frontmatter.push(`tools: ${config.tools.join(', ')}`);
    }

    if (config.model && config.model !== 'inherit') {
      frontmatter.push(`model: ${config.model}`);
    }

    if (config.permissionMode && config.permissionMode !== 'default') {
      frontmatter.push(`permissionMode: ${config.permissionMode}`);
    }

    if (config.color) {
      frontmatter.push(`color: ${config.color}`);
    }

    frontmatter.push('---');
    frontmatter.push('');
    frontmatter.push(config.prompt || '');

    return frontmatter.join('\n');
  }
}
