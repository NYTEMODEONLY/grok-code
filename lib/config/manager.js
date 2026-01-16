/**
 * Configuration Manager
 * Manages global and project-level configuration
 */

import fs from 'fs-extra';
import path from 'path';
import { SettingsSchema } from './schema.js';

export class ConfigManager {
  constructor(options = {}) {
    // Global config directory
    this.globalDir = options.globalDir ||
      path.join(process.env.HOME || '', '.grok');

    // Project config directory
    this.projectDir = options.projectDir || '.grok';

    // Current working directory
    this.cwd = options.cwd || process.cwd();

    // Configuration cache
    this.cache = new Map();
  }

  /**
   * Load all configuration with proper precedence
   * @returns {Promise<Object>} Merged configuration
   */
  async load() {
    // 1. Default settings
    const defaults = SettingsSchema.getDefaults();

    // 2. Global settings
    const globalSettings = await this.loadGlobalSettings();

    // 3. Project settings
    const projectSettings = await this.loadProjectSettings();

    // 4. Local project settings (not committed)
    const localSettings = await this.loadLocalSettings();

    // 5. Environment variables
    const envSettings = this.loadEnvSettings();

    // Merge in order of precedence (later overrides earlier)
    return this.mergeDeep(
      defaults,
      globalSettings,
      projectSettings,
      localSettings,
      envSettings
    );
  }

  /**
   * Load global settings
   * @returns {Promise<Object>} Global settings
   */
  async loadGlobalSettings() {
    const settingsPath = path.join(this.globalDir, 'settings.json');
    return this.loadJsonFile(settingsPath);
  }

  /**
   * Load project settings
   * @returns {Promise<Object>} Project settings
   */
  async loadProjectSettings() {
    const settingsPath = path.resolve(this.cwd, this.projectDir, 'settings.json');
    return this.loadJsonFile(settingsPath);
  }

  /**
   * Load local project settings
   * @returns {Promise<Object>} Local settings
   */
  async loadLocalSettings() {
    const settingsPath = path.resolve(this.cwd, this.projectDir, 'settings.local.json');
    return this.loadJsonFile(settingsPath);
  }

  /**
   * Load settings from environment variables
   * @returns {Object} Environment settings
   */
  loadEnvSettings() {
    const settings = {};

    // API Key
    if (process.env.XAI_API_KEY) {
      settings.apiKey = process.env.XAI_API_KEY;
    }

    // Model
    if (process.env.GROK_MODEL) {
      settings.model = process.env.GROK_MODEL;
    }

    // Debug mode
    if (process.env.GROK_DEBUG) {
      settings.debug = process.env.GROK_DEBUG === 'true';
    }

    // Verbose mode
    if (process.env.GROK_VERBOSE) {
      settings.verbose = process.env.GROK_VERBOSE === 'true';
    }

    // Theme
    if (process.env.GROK_THEME) {
      settings.theme = process.env.GROK_THEME;
    }

    return settings;
  }

  /**
   * Load a JSON file safely
   * @param {string} filePath - Path to file
   * @returns {Promise<Object>} Parsed JSON or empty object
   */
  async loadJsonFile(filePath) {
    try {
      if (await fs.pathExists(filePath)) {
        return await fs.readJson(filePath);
      }
    } catch (error) {
      console.warn(`Failed to load config from ${filePath}: ${error.message}`);
    }
    return {};
  }

  /**
   * Save settings to a specific scope
   * @param {Object} settings - Settings to save
   * @param {string} scope - 'global', 'project', or 'local'
   */
  async save(settings, scope = 'project') {
    let filePath;

    switch (scope) {
      case 'global':
        filePath = path.join(this.globalDir, 'settings.json');
        break;
      case 'local':
        filePath = path.resolve(this.cwd, this.projectDir, 'settings.local.json');
        break;
      case 'project':
      default:
        filePath = path.resolve(this.cwd, this.projectDir, 'settings.json');
    }

    await fs.ensureDir(path.dirname(filePath));
    await fs.writeJson(filePath, settings, { spaces: 2 });

    // Clear cache
    this.cache.delete(filePath);
  }

  /**
   * Get a specific setting
   * @param {string} key - Setting key (dot notation supported)
   * @param {*} defaultValue - Default value if not found
   * @returns {Promise<*>} Setting value
   */
  async get(key, defaultValue = undefined) {
    const config = await this.load();
    return this.getNestedValue(config, key, defaultValue);
  }

  /**
   * Set a specific setting
   * @param {string} key - Setting key (dot notation supported)
   * @param {*} value - Setting value
   * @param {string} scope - Configuration scope
   */
  async set(key, value, scope = 'project') {
    let settings;

    switch (scope) {
      case 'global':
        settings = await this.loadGlobalSettings();
        break;
      case 'local':
        settings = await this.loadLocalSettings();
        break;
      case 'project':
      default:
        settings = await this.loadProjectSettings();
    }

    this.setNestedValue(settings, key, value);
    await this.save(settings, scope);
  }

  /**
   * Initialize project configuration
   * @param {Object} options - Initialization options
   */
  async initProject(options = {}) {
    const projectConfigDir = path.resolve(this.cwd, this.projectDir);

    // Create .grok directory structure
    await fs.ensureDir(projectConfigDir);
    await fs.ensureDir(path.join(projectConfigDir, 'commands'));
    await fs.ensureDir(path.join(projectConfigDir, 'agents'));
    await fs.ensureDir(path.join(projectConfigDir, 'plugins'));
    await fs.ensureDir(path.join(projectConfigDir, 'sessions'));
    await fs.ensureDir(path.join(projectConfigDir, 'backups'));

    // Create default settings.json
    const settingsPath = path.join(projectConfigDir, 'settings.json');
    if (!await fs.pathExists(settingsPath)) {
      await fs.writeJson(settingsPath, {
        model: options.model || 'grok-code-fast-1',
        permissions: {},
        hooks: {}
      }, { spaces: 2 });
    }

    // Create .gitignore for local files
    const gitignorePath = path.join(projectConfigDir, '.gitignore');
    if (!await fs.pathExists(gitignorePath)) {
      await fs.writeFile(gitignorePath, `# Local settings (not committed)
settings.local.json

# Session data
sessions/

# Backups
backups/

# Error logs
error.log

# Temporary files
*.tmp
`);
    }

    // Create GROK.md if it doesn't exist
    const grokMdPath = path.join(this.cwd, 'GROK.md');
    if (!await fs.pathExists(grokMdPath)) {
      await fs.writeFile(grokMdPath, `# Project Configuration for Grok Code

## Overview
Add project-specific instructions here that Grok should follow.

## Coding Conventions
- Describe your coding standards
- List frameworks and libraries used
- Note any project-specific patterns

## File Structure
Explain your project's file organization.

## Custom Commands
Define custom commands in .grok/commands/

## Notes
Add any other relevant information.
`);
    }

    return projectConfigDir;
  }

  /**
   * Get nested value from object using dot notation
   * @param {Object} obj - Source object
   * @param {string} key - Key in dot notation
   * @param {*} defaultValue - Default value
   * @returns {*} Value
   */
  getNestedValue(obj, key, defaultValue) {
    const keys = key.split('.');
    let value = obj;

    for (const k of keys) {
      if (value === undefined || value === null) {
        return defaultValue;
      }
      value = value[k];
    }

    return value !== undefined ? value : defaultValue;
  }

  /**
   * Set nested value in object using dot notation
   * @param {Object} obj - Target object
   * @param {string} key - Key in dot notation
   * @param {*} value - Value to set
   */
  setNestedValue(obj, key, value) {
    const keys = key.split('.');
    let current = obj;

    for (let i = 0; i < keys.length - 1; i++) {
      const k = keys[i];
      if (!current[k] || typeof current[k] !== 'object') {
        current[k] = {};
      }
      current = current[k];
    }

    current[keys[keys.length - 1]] = value;
  }

  /**
   * Deep merge objects
   * @param  {...Object} objects - Objects to merge
   * @returns {Object} Merged object
   */
  mergeDeep(...objects) {
    const result = {};

    for (const obj of objects) {
      if (!obj) continue;

      for (const [key, value] of Object.entries(obj)) {
        if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
          result[key] = this.mergeDeep(result[key] || {}, value);
        } else {
          result[key] = value;
        }
      }
    }

    return result;
  }

  /**
   * Validate settings against schema
   * @param {Object} settings - Settings to validate
   * @returns {Object} Validation result
   */
  validate(settings) {
    return SettingsSchema.validate(settings);
  }

  /**
   * Get settings documentation
   * @returns {string} Documentation
   */
  getDocumentation() {
    return SettingsSchema.getDocumentation();
  }
}
