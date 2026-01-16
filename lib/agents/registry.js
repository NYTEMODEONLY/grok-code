/**
 * Agent Registry
 * Central registry for managing sub-agents
 */

import { EventEmitter } from 'events';

export class AgentRegistry extends EventEmitter {
  constructor(options = {}) {
    super();
    this.agents = new Map();
    this.runningAgents = new Map();
    this.loader = options.loader || null;
    this.defaultModel = options.defaultModel || 'inherit';
  }

  /**
   * Register an agent
   * @param {BaseAgent} agent - Agent to register
   */
  register(agent) {
    this.agents.set(agent.name, agent);
    this.emit('agent:registered', { name: agent.name });
  }

  /**
   * Get an agent by name
   * @param {string} name - Agent name
   * @returns {BaseAgent|null} Agent instance
   */
  get(name) {
    return this.agents.get(name) || null;
  }

  /**
   * Check if an agent exists
   * @param {string} name - Agent name
   * @returns {boolean} Whether agent exists
   */
  has(name) {
    return this.agents.has(name);
  }

  /**
   * Get all registered agents
   * @returns {Array} Array of agent configurations
   */
  getAll() {
    return Array.from(this.agents.values()).map(agent => ({
      name: agent.name,
      description: agent.description,
      model: agent.model,
      tools: agent.tools,
      permissionMode: agent.permissionMode
    }));
  }

  /**
   * Get agents by capability
   * @param {string} capability - Capability to filter by
   * @returns {Array} Matching agents
   */
  getByCapability(capability) {
    return Array.from(this.agents.values()).filter(agent => {
      // Check if description mentions capability
      const desc = agent.description.toLowerCase();
      const cap = capability.toLowerCase();

      return desc.includes(cap) ||
        agent.tools.some(t => t.toLowerCase().includes(cap));
    });
  }

  /**
   * Start an agent
   * @param {string} name - Agent name
   * @param {Object} context - Execution context
   * @returns {Promise<Object>} Agent run result
   */
  async startAgent(name, context = {}) {
    const agent = this.get(name);
    if (!agent) {
      return { error: `Agent not found: ${name}` };
    }

    // Generate unique run ID
    const runId = `${name}-${Date.now()}`;

    // Clone agent for this run
    const runningAgent = Object.create(agent);
    runningAgent.runId = runId;

    this.runningAgents.set(runId, runningAgent);

    try {
      await runningAgent.start(context);

      this.emit('agent:started', {
        name,
        runId,
        context
      });

      return {
        success: true,
        runId,
        agent: {
          name: agent.name,
          description: agent.description,
          model: agent.model
        }
      };
    } catch (error) {
      this.runningAgents.delete(runId);
      return { error: error.message };
    }
  }

  /**
   * Stop a running agent
   * @param {string} runId - Run ID
   * @param {Object} result - Final result
   */
  async stopAgent(runId, result = {}) {
    const agent = this.runningAgents.get(runId);
    if (!agent) return;

    try {
      await agent.stop(result);
    } finally {
      this.runningAgents.delete(runId);
      this.emit('agent:stopped', { runId, result });
    }
  }

  /**
   * Get running agents
   * @returns {Array} Running agent info
   */
  getRunningAgents() {
    return Array.from(this.runningAgents.entries()).map(([runId, agent]) => ({
      runId,
      name: agent.name,
      startTime: agent.startTime,
      runtime: Date.now() - agent.startTime
    }));
  }

  /**
   * Resume an agent from a previous session
   * @param {string} agentId - Previous agent ID
   * @param {Object} context - Execution context
   * @returns {Promise<Object>} Resume result
   */
  async resumeAgent(agentId, context = {}) {
    // Load agent transcript from storage
    const transcript = await this.loadAgentTranscript(agentId);

    if (!transcript) {
      return { error: `No transcript found for agent: ${agentId}` };
    }

    // Get the agent type
    const agentName = transcript.agentName;
    const agent = this.get(agentName);

    if (!agent) {
      return { error: `Agent type not found: ${agentName}` };
    }

    // Start with previous context
    const result = await this.startAgent(agentName, {
      ...context,
      previousTranscript: transcript.messages,
      resumedFrom: agentId
    });

    return result;
  }

  /**
   * Load agent transcript from storage
   * @param {string} agentId - Agent ID
   * @returns {Promise<Object|null>} Transcript data
   */
  async loadAgentTranscript(agentId) {
    // This would load from .grok/agents/{agentId}.jsonl
    // Implementation depends on storage strategy
    return null;
  }

  /**
   * Format agents for display
   * @returns {string} Formatted agent list
   */
  formatForDisplay() {
    const agents = this.getAll();

    if (agents.length === 0) {
      return 'No agents registered.';
    }

    return agents.map(agent => {
      const tools = agent.tools.length > 0
        ? agent.tools.slice(0, 5).join(', ') + (agent.tools.length > 5 ? '...' : '')
        : 'all';

      return `${agent.name}
  Description: ${agent.description}
  Model: ${agent.model}
  Tools: ${tools}
  Permission: ${agent.permissionMode}`;
    }).join('\n\n');
  }
}
