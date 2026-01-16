/**
 * Grok Core - Central Integration Module
 * Connects all new Claude Code-compatible subsystems
 */

import { ToolRegistry, ToolExecutor } from '../tools/index.js';
import { AgentRegistry, AgentLoader } from '../agents/index.js';
import { HooksManager, HookLoader } from '../hooks/index.js';
import { PluginManager, PluginLoader } from '../plugins/index.js';
import { SessionManager, CheckpointManager } from '../session/index.js';
import { ConfigManager } from '../config/index.js';
import { SkillsManager, BuiltInSkills } from '../skills/index.js';
import path from 'path';
import fs from 'fs-extra';

export class GrokCore {
  constructor(options = {}) {
    this.projectRoot = options.projectRoot || process.cwd();
    this.globalDir = options.globalDir || path.join(process.env.HOME || '', '.grok');

    // Initialize configuration manager
    this.configManager = new ConfigManager({
      globalDir: this.globalDir,
      projectDir: '.grok',
      cwd: this.projectRoot
    });

    // Core components (initialized lazily)
    this._toolRegistry = null;
    this._toolExecutor = null;
    this._agentRegistry = null;
    this._agentLoader = null;
    this._hooksManager = null;
    this._hookLoader = null;
    this._pluginManager = null;
    this._pluginLoader = null;
    this._sessionManager = null;
    this._checkpointManager = null;
    this._skillsManager = null;
    this._builtInSkills = null;

    // State
    this.initialized = false;
    this.config = null;
  }

  /**
   * Initialize all core systems
   */
  async initialize() {
    if (this.initialized) return;

    // Load configuration
    this.config = await this.configManager.load();

    // Initialize tools
    this._toolRegistry = new ToolRegistry();
    this._toolExecutor = new ToolExecutor({
      toolRegistry: this._toolRegistry,
      projectRoot: this.projectRoot
    });

    // Initialize hooks (before other systems so they can be intercepted)
    this._hooksManager = new HooksManager();
    this._hookLoader = new HookLoader({
      projectDir: path.join(this.projectRoot, '.grok'),
      globalDir: this.globalDir
    });

    // Load hooks from config
    await this._hookLoader.loadFromSettings(this.config);
    const hooks = this._hookLoader.getLoadedHooks();
    for (const hook of hooks) {
      this._hooksManager.register(hook.event, hook);
    }

    // Connect hooks to tool executor
    this._toolExecutor.setHooksManager(this._hooksManager);

    // Initialize agents
    this._agentRegistry = new AgentRegistry();
    this._agentLoader = new AgentLoader({
      agentsDir: path.join(this.projectRoot, '.grok', 'agents'),
      globalAgentsDir: path.join(this.globalDir, 'agents')
    });

    // Load custom agents
    await this._agentLoader.loadAgents();
    const agents = this._agentLoader.getLoadedAgents();
    for (const agent of agents) {
      this._agentRegistry.register(agent.name, agent);
    }

    // Initialize plugins
    this._pluginManager = new PluginManager();
    this._pluginLoader = new PluginLoader({
      pluginsDir: path.join(this.projectRoot, '.grok', 'plugins'),
      globalPluginsDir: path.join(this.globalDir, 'plugins')
    });

    // Load plugins
    await this._pluginLoader.loadPlugins();
    const plugins = this._pluginLoader.getLoadedPlugins();
    for (const plugin of plugins) {
      await this._pluginManager.register(plugin);
      await this._pluginManager.enable(plugin.name);
    }

    // Initialize session management
    this._sessionManager = new SessionManager({
      sessionsDir: path.join(this.projectRoot, '.grok', 'sessions'),
      autoSaveInterval: this.config.session?.autoSaveInterval || 30000,
      maxCheckpoints: this.config.session?.maxCheckpoints || 10
    });

    this._checkpointManager = new CheckpointManager({
      sessionsDir: path.join(this.projectRoot, '.grok', 'sessions'),
      maxCheckpoints: this.config.session?.maxCheckpoints || 10
    });

    // Initialize skills manager
    this._skillsManager = new SkillsManager({
      skillsDir: path.join(this.projectRoot, '.grok', 'skills'),
      userSkillsDir: path.join(this.globalDir, 'skills')
    });
    await this._skillsManager.initialize();

    // Register built-in skills
    this._builtInSkills = new BuiltInSkills({
      grokCore: this
    });
    this._builtInSkills.register(this._skillsManager);

    // Fire session start hook
    await this._hooksManager.trigger('SessionStart', {
      projectRoot: this.projectRoot,
      config: this.config
    });

    this.initialized = true;
    return this;
  }

  /**
   * Get tool registry
   */
  get toolRegistry() {
    return this._toolRegistry;
  }

  /**
   * Get tool executor
   */
  get toolExecutor() {
    return this._toolExecutor;
  }

  /**
   * Get agent registry
   */
  get agentRegistry() {
    return this._agentRegistry;
  }

  /**
   * Get hooks manager
   */
  get hooksManager() {
    return this._hooksManager;
  }

  /**
   * Get plugin manager
   */
  get pluginManager() {
    return this._pluginManager;
  }

  /**
   * Get session manager
   */
  get sessionManager() {
    return this._sessionManager;
  }

  /**
   * Get checkpoint manager
   */
  get checkpointManager() {
    return this._checkpointManager;
  }

  /**
   * Get skills manager
   */
  get skillsManager() {
    return this._skillsManager;
  }

  /**
   * Execute a skill
   * @param {string} skillName - Name of the skill
   * @param {Object} context - Execution context
   * @returns {Promise<Object>} Skill result
   */
  async executeSkill(skillName, context = {}) {
    if (!this.initialized) {
      await this.initialize();
    }
    return this._skillsManager.execute(skillName, context);
  }

  /**
   * Execute a tool by name
   * @param {string} toolName - Name of the tool
   * @param {Object} params - Tool parameters
   * @returns {Promise<Object>} Tool result
   */
  async executeTool(toolName, params) {
    if (!this.initialized) {
      await this.initialize();
    }
    return this._toolExecutor.execute(toolName, params);
  }

  /**
   * Start an agent
   * @param {string} agentName - Name of the agent
   * @param {Object} options - Agent options
   * @returns {Promise<Object>} Agent result
   */
  async startAgent(agentName, options = {}) {
    if (!this.initialized) {
      await this.initialize();
    }
    return this._agentRegistry.start(agentName, options);
  }

  /**
   * Trigger a hook event
   * @param {string} event - Event name
   * @param {Object} context - Event context
   * @returns {Promise<Object>} Hook results
   */
  async triggerHook(event, context) {
    if (!this.initialized) {
      await this.initialize();
    }
    return this._hooksManager.trigger(event, context);
  }

  /**
   * Create a session checkpoint
   * @param {string} name - Checkpoint name
   * @param {Object} sessionData - Session data to checkpoint
   * @returns {Promise<string>} Checkpoint ID
   */
  async createCheckpoint(name, sessionData) {
    if (!this.initialized) {
      await this.initialize();
    }

    const sessionId = await this._sessionManager.getCurrentSessionId();
    return this._checkpointManager.create(sessionId, {
      name,
      session: sessionData
    });
  }

  /**
   * Restore from a checkpoint
   * @param {string} checkpointId - Checkpoint ID
   * @returns {Promise<Object>} Restored session data
   */
  async restoreCheckpoint(checkpointId) {
    if (!this.initialized) {
      await this.initialize();
    }

    const sessionId = await this._sessionManager.getCurrentSessionId();
    return this._checkpointManager.restore(sessionId, checkpointId);
  }

  /**
   * List available checkpoints
   * @returns {Promise<Array>} List of checkpoints
   */
  async listCheckpoints() {
    if (!this.initialized) {
      await this.initialize();
    }

    const sessionId = await this._sessionManager.getCurrentSessionId();
    return this._checkpointManager.list(sessionId);
  }

  /**
   * Shutdown and cleanup
   */
  async shutdown() {
    if (!this.initialized) return;

    // Fire session end hook
    await this._hooksManager.trigger('SessionEnd', {
      projectRoot: this.projectRoot
    });

    // Save session
    if (this._sessionManager) {
      await this._sessionManager.saveSession();
    }

    // Disable all plugins
    if (this._pluginManager) {
      const enabledPlugins = this._pluginManager.listEnabled();
      for (const pluginName of enabledPlugins) {
        await this._pluginManager.disable(pluginName);
      }
    }

    this.initialized = false;
  }

  /**
   * Get system status
   * @returns {Object} Status of all subsystems
   */
  getStatus() {
    return {
      initialized: this.initialized,
      tools: {
        registered: this._toolRegistry?.list().length || 0,
        available: this._toolRegistry?.list() || []
      },
      agents: {
        registered: this._agentRegistry?.list().length || 0,
        running: this._agentRegistry?.listRunning().length || 0,
        available: this._agentRegistry?.list() || []
      },
      hooks: {
        events: this._hooksManager?.listEvents() || [],
        totalHooks: Object.values(this._hooksManager?.hooks || {}).flat().length
      },
      plugins: {
        loaded: this._pluginManager?.listAll().length || 0,
        enabled: this._pluginManager?.listEnabled().length || 0,
        available: this._pluginManager?.listAll() || []
      },
      skills: {
        builtIn: this._skillsManager?.builtInSkills?.size || 0,
        custom: this._skillsManager?.customSkills?.size || 0,
        available: this._skillsManager?.list() || []
      },
      session: {
        active: this._sessionManager?.hasActiveSession() || false,
        id: this._sessionManager?.getCurrentSessionId() || null
      }
    };
  }
}

// Singleton instance for easy access
let _instance = null;

/**
 * Get or create the GrokCore singleton
 * @param {Object} options - Options for initialization
 * @returns {GrokCore} The GrokCore instance
 */
export function getGrokCore(options = {}) {
  if (!_instance) {
    _instance = new GrokCore(options);
  }
  return _instance;
}

/**
 * Reset the singleton (mainly for testing)
 */
export function resetGrokCore() {
  if (_instance) {
    _instance.shutdown();
    _instance = null;
  }
}
