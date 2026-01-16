/**
 * Plugin Loader
 * Loads plugins from directories
 */

import fs from 'fs-extra';
import path from 'path';
import { BasePlugin } from './base-plugin.js';

export class PluginLoader {
  constructor(options = {}) {
    this.userPluginsDir = options.userPluginsDir ||
      path.join(process.env.HOME || '', '.grok', 'plugins');
    this.projectPluginsDir = options.projectPluginsDir || '.grok/plugins';
  }

  /**
   * Load all plugins from all sources
   * @param {Object} context - Loading context
   * @returns {Promise<Array>} Loaded plugins
   */
  async loadAll(context = {}) {
    const plugins = [];
    const cwd = context.cwd || process.cwd();

    // Load user-level plugins
    const userPlugins = await this.loadFromDirectory(this.userPluginsDir);
    plugins.push(...userPlugins);

    // Load project-level plugins
    const projectPath = path.resolve(cwd, this.projectPluginsDir);
    const projectPlugins = await this.loadFromDirectory(projectPath);
    plugins.push(...projectPlugins);

    // Deduplicate by name (project plugins take precedence)
    const uniquePlugins = new Map();
    for (const plugin of plugins) {
      uniquePlugins.set(plugin.name, plugin);
    }

    return Array.from(uniquePlugins.values());
  }

  /**
   * Load plugins from a directory
   * @param {string} dir - Directory path
   * @returns {Promise<Array>} Loaded plugins
   */
  async loadFromDirectory(dir) {
    const plugins = [];

    try {
      if (!await fs.pathExists(dir)) {
        return plugins;
      }

      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        if (!entry.isDirectory()) continue;

        const pluginPath = path.join(dir, entry.name);
        const plugin = await this.loadPlugin(pluginPath);

        if (plugin) {
          plugins.push(plugin);
        }
      }
    } catch (error) {
      console.warn(`Failed to load plugins from ${dir}: ${error.message}`);
    }

    return plugins;
  }

  /**
   * Load a single plugin from a directory
   * @param {string} pluginPath - Path to plugin directory
   * @returns {Promise<BasePlugin|null>} Loaded plugin
   */
  async loadPlugin(pluginPath) {
    try {
      // Look for manifest.json or package.json
      const manifestPath = path.join(pluginPath, 'manifest.json');
      const packagePath = path.join(pluginPath, 'package.json');

      let manifest = null;

      if (await fs.pathExists(manifestPath)) {
        manifest = await fs.readJson(manifestPath);
      } else if (await fs.pathExists(packagePath)) {
        const pkg = await fs.readJson(packagePath);
        manifest = {
          name: pkg.name,
          version: pkg.version,
          description: pkg.description,
          author: pkg.author,
          main: pkg.main
        };
      }

      if (!manifest) {
        return null;
      }

      // Create plugin instance
      const plugin = new BasePlugin({
        name: manifest.name || path.basename(pluginPath),
        version: manifest.version || '1.0.0',
        description: manifest.description || '',
        author: manifest.author || ''
      });

      // Load commands
      const commandsDir = path.join(pluginPath, 'commands');
      if (await fs.pathExists(commandsDir)) {
        const commands = await this.loadCommands(commandsDir);
        plugin.commands = commands;
      }

      // Load agents
      const agentsDir = path.join(pluginPath, 'agents');
      if (await fs.pathExists(agentsDir)) {
        const agents = await this.loadAgents(agentsDir);
        plugin.agents = agents;
      }

      // Load hooks
      const hooksFile = path.join(pluginPath, 'hooks', 'hooks.json');
      if (await fs.pathExists(hooksFile)) {
        const hooks = await fs.readJson(hooksFile);
        plugin.hooks = hooks.hooks || {};
      }

      // Load skills
      const skillsDir = path.join(pluginPath, 'skills');
      if (await fs.pathExists(skillsDir)) {
        const skills = await this.loadSkills(skillsDir);
        plugin.skills = skills;
      }

      // Store plugin path for reference
      plugin.pluginPath = pluginPath;

      return plugin;
    } catch (error) {
      console.warn(`Failed to load plugin from ${pluginPath}: ${error.message}`);
      return null;
    }
  }

  /**
   * Load commands from a directory
   * @param {string} dir - Commands directory
   * @returns {Promise<Array>} Loaded commands
   */
  async loadCommands(dir) {
    const commands = [];

    try {
      const files = await fs.readdir(dir);

      for (const file of files) {
        if (!file.endsWith('.md') && !file.endsWith('.txt')) continue;

        const filePath = path.join(dir, file);
        const content = await fs.readFile(filePath, 'utf8');
        const name = path.basename(file, path.extname(file));

        commands.push({
          name,
          description: `Custom command: ${name}`,
          prompt: content.trim()
        });
      }
    } catch (error) {
      console.warn(`Failed to load commands from ${dir}: ${error.message}`);
    }

    return commands;
  }

  /**
   * Load agents from a directory
   * @param {string} dir - Agents directory
   * @returns {Promise<Array>} Loaded agents
   */
  async loadAgents(dir) {
    const agents = [];

    try {
      const files = await fs.readdir(dir);

      for (const file of files) {
        if (!file.endsWith('.md')) continue;

        const filePath = path.join(dir, file);
        const content = await fs.readFile(filePath, 'utf8');
        const { frontmatter, body } = this.parseFrontmatter(content);

        agents.push({
          name: frontmatter.name || path.basename(file, '.md'),
          description: frontmatter.description || '',
          tools: frontmatter.tools || [],
          model: frontmatter.model || 'inherit',
          prompt: body.trim()
        });
      }
    } catch (error) {
      console.warn(`Failed to load agents from ${dir}: ${error.message}`);
    }

    return agents;
  }

  /**
   * Load skills from a directory
   * @param {string} dir - Skills directory
   * @returns {Promise<Array>} Loaded skills
   */
  async loadSkills(dir) {
    const skills = [];

    try {
      const files = await fs.readdir(dir);

      for (const file of files) {
        if (!file.endsWith('.md')) continue;

        const filePath = path.join(dir, file);
        const content = await fs.readFile(filePath, 'utf8');
        const { frontmatter, body } = this.parseFrontmatter(content);

        skills.push({
          name: frontmatter.name || path.basename(file, '.md'),
          description: frontmatter.description || '',
          prompt: body.trim()
        });
      }
    } catch (error) {
      console.warn(`Failed to load skills from ${dir}: ${error.message}`);
    }

    return skills;
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

    // Simple YAML parsing
    const frontmatter = {};
    const lines = yamlStr.split('\n');

    for (const line of lines) {
      const colonIndex = line.indexOf(':');
      if (colonIndex !== -1) {
        const key = line.slice(0, colonIndex).trim();
        let value = line.slice(colonIndex + 1).trim();

        // Parse arrays
        if (value.startsWith('[') && value.endsWith(']')) {
          value = value.slice(1, -1).split(',').map(v => v.trim());
        }

        frontmatter[key] = value;
      }
    }

    return { frontmatter, body };
  }

  /**
   * Create a new plugin scaffold
   * @param {string} name - Plugin name
   * @param {string} dir - Target directory
   * @returns {Promise<string>} Path to created plugin
   */
  async createPluginScaffold(name, dir) {
    const pluginDir = path.join(dir, name);

    await fs.ensureDir(pluginDir);
    await fs.ensureDir(path.join(pluginDir, 'commands'));
    await fs.ensureDir(path.join(pluginDir, 'agents'));
    await fs.ensureDir(path.join(pluginDir, 'hooks'));
    await fs.ensureDir(path.join(pluginDir, 'skills'));

    // Create manifest
    const manifest = {
      name,
      version: '1.0.0',
      description: `${name} plugin for Grok Code`,
      author: ''
    };
    await fs.writeJson(path.join(pluginDir, 'manifest.json'), manifest, { spaces: 2 });

    // Create empty hooks file
    await fs.writeJson(path.join(pluginDir, 'hooks', 'hooks.json'), { hooks: {} }, { spaces: 2 });

    // Create README
    const readme = `# ${name}

A Grok Code plugin.

## Commands

Add command files to the \`commands/\` directory.

## Agents

Add agent files to the \`agents/\` directory.

## Hooks

Configure hooks in \`hooks/hooks.json\`.

## Skills

Add skill files to the \`skills/\` directory.
`;
    await fs.writeFile(path.join(pluginDir, 'README.md'), readme);

    return pluginDir;
  }
}
