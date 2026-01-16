/**
 * Hook Loader
 * Loads hooks from settings files
 */

import fs from 'fs-extra';
import path from 'path';

export class HookLoader {
  constructor(options = {}) {
    this.userSettingsPath = options.userSettingsPath ||
      path.join(process.env.HOME || '', '.grok', 'settings.json');
    this.projectSettingsPath = options.projectSettingsPath || '.grok/settings.json';
    this.localSettingsPath = options.localSettingsPath || '.grok/settings.local.json';
  }

  /**
   * Load all settings with proper priority
   * @param {Object} context - Loading context
   * @returns {Promise<Object>} Merged settings
   */
  async loadSettings(context = {}) {
    const cwd = context.cwd || process.cwd();
    const settings = { hooks: {} };

    // Load in order of increasing priority

    // 1. User-level settings
    const userSettings = await this.loadSettingsFile(this.userSettingsPath);
    this.mergeSettings(settings, userSettings);

    // 2. Project-level settings
    const projectPath = path.resolve(cwd, this.projectSettingsPath);
    const projectSettings = await this.loadSettingsFile(projectPath);
    this.mergeSettings(settings, projectSettings);

    // 3. Local project settings (not committed to git)
    const localPath = path.resolve(cwd, this.localSettingsPath);
    const localSettings = await this.loadSettingsFile(localPath);
    this.mergeSettings(settings, localSettings);

    return settings;
  }

  /**
   * Load a single settings file
   * @param {string} filePath - Path to settings file
   * @returns {Promise<Object>} Settings object
   */
  async loadSettingsFile(filePath) {
    try {
      if (await fs.pathExists(filePath)) {
        const content = await fs.readFile(filePath, 'utf8');
        return JSON.parse(content);
      }
    } catch (error) {
      console.warn(`Failed to load settings from ${filePath}: ${error.message}`);
    }
    return {};
  }

  /**
   * Merge settings objects
   * @param {Object} target - Target settings
   * @param {Object} source - Source settings
   */
  mergeSettings(target, source) {
    if (!source) return;

    // Merge hooks
    if (source.hooks) {
      for (const [event, hooks] of Object.entries(source.hooks)) {
        if (!target.hooks[event]) {
          target.hooks[event] = [];
        }
        target.hooks[event].push(...hooks);
      }
    }

    // Merge other settings
    for (const [key, value] of Object.entries(source)) {
      if (key !== 'hooks') {
        target[key] = value;
      }
    }
  }

  /**
   * Load hooks from plugin directories
   * @param {Object} context - Loading context
   * @returns {Promise<Object>} Plugin hooks
   */
  async loadPluginHooks(context = {}) {
    const hooks = {};
    const cwd = context.cwd || process.cwd();

    // Look for plugins in .grok/plugins/
    const pluginsDir = path.resolve(cwd, '.grok/plugins');

    try {
      if (await fs.pathExists(pluginsDir)) {
        const plugins = await fs.readdir(pluginsDir);

        for (const plugin of plugins) {
          const pluginPath = path.join(pluginsDir, plugin);
          const stat = await fs.stat(pluginPath);

          if (stat.isDirectory()) {
            const hooksFile = path.join(pluginPath, 'hooks', 'hooks.json');
            const pluginHooks = await this.loadSettingsFile(hooksFile);

            if (pluginHooks.hooks) {
              for (const [event, eventHooks] of Object.entries(pluginHooks.hooks)) {
                if (!hooks[event]) {
                  hooks[event] = [];
                }
                hooks[event].push(...eventHooks);
              }
            }
          }
        }
      }
    } catch (error) {
      console.warn(`Failed to load plugin hooks: ${error.message}`);
    }

    return hooks;
  }

  /**
   * Save settings to a file
   * @param {Object} settings - Settings to save
   * @param {string} scope - 'user', 'project', or 'local'
   * @param {Object} context - Context with cwd
   */
  async saveSettings(settings, scope = 'project', context = {}) {
    const cwd = context.cwd || process.cwd();
    let filePath;

    switch (scope) {
      case 'user':
        filePath = this.userSettingsPath;
        break;
      case 'local':
        filePath = path.resolve(cwd, this.localSettingsPath);
        break;
      case 'project':
      default:
        filePath = path.resolve(cwd, this.projectSettingsPath);
    }

    await fs.ensureDir(path.dirname(filePath));
    await fs.writeJson(filePath, settings, { spaces: 2 });

    return filePath;
  }

  /**
   * Add a hook to settings
   * @param {string} event - Event name
   * @param {Object} hookConfig - Hook configuration
   * @param {string} scope - Settings scope
   * @param {Object} context - Context
   */
  async addHookToSettings(event, hookConfig, scope = 'project', context = {}) {
    const settings = await this.loadSettings(context);

    if (!settings.hooks[event]) {
      settings.hooks[event] = [];
    }

    settings.hooks[event].push(hookConfig);

    await this.saveSettings(settings, scope, context);
  }
}
