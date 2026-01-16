/**
 * Task Tool
 * Launch and manage sub-agents for complex tasks
 * Equivalent to Claude Code's Task tool for spawning specialists
 */

import { BaseTool } from './base-tool.js';
import { EventEmitter } from 'events';

export class TaskTool extends BaseTool {
  constructor(options = {}) {
    super({
      name: 'Task',
      description: 'Launch a specialized sub-agent to handle complex, multi-step tasks autonomously',
      requiresPermission: false,
      isReadOnly: true, // Task spawning itself is read-only
      timeout: 600000, // 10 minutes max for sub-agent
      ...options
    });

    this.agentRegistry = options.agentRegistry;
    this.grokClient = options.grokClient;
    this.maxConcurrentTasks = options.maxConcurrentTasks || 5;
    this.runningTasks = new Map();

    // Available agent types
    this.agentTypes = {
      'Explore': {
        description: 'Fast codebase exploration (read-only)',
        tools: ['Read', 'Grep', 'Glob'],
        readOnly: true
      },
      'Plan': {
        description: 'Software architecture planning',
        tools: ['Read', 'Grep', 'Glob'],
        readOnly: true
      },
      'Bash': {
        description: 'Command execution specialist',
        tools: ['Bash'],
        readOnly: false
      },
      'general-purpose': {
        description: 'General-purpose agent for research and multi-step tasks',
        tools: ['Read', 'Write', 'Edit', 'Bash', 'Grep', 'Glob'],
        readOnly: false
      }
    };
  }

  getSchema() {
    return {
      name: this.name,
      description: this.description,
      parameters: {
        type: 'object',
        properties: {
          description: {
            type: 'string',
            description: 'A short (3-5 word) description of the task'
          },
          prompt: {
            type: 'string',
            description: 'The detailed task for the agent to perform'
          },
          subagent_type: {
            type: 'string',
            enum: Object.keys(this.agentTypes),
            description: 'The type of specialized agent to use'
          },
          model: {
            type: 'string',
            enum: ['sonnet', 'opus', 'haiku', 'grok-code-fast-1', 'grok-4'],
            description: 'Optional model override for this agent'
          },
          run_in_background: {
            type: 'boolean',
            description: 'Set to true to run the agent in background'
          },
          resume: {
            type: 'string',
            description: 'Optional agent ID to resume from previous execution'
          },
          max_turns: {
            type: 'integer',
            description: 'Maximum number of agentic turns before stopping'
          }
        },
        required: ['description', 'prompt', 'subagent_type']
      }
    };
  }

  async execute(params) {
    const {
      description,
      prompt,
      subagent_type,
      model,
      run_in_background = false,
      resume,
      max_turns = 10
    } = params;

    // Validate agent type
    if (!this.agentTypes[subagent_type]) {
      return {
        success: false,
        error: `Unknown agent type: ${subagent_type}. Available: ${Object.keys(this.agentTypes).join(', ')}`
      };
    }

    // Check concurrent task limit
    if (this.runningTasks.size >= this.maxConcurrentTasks) {
      return {
        success: false,
        error: `Maximum concurrent tasks (${this.maxConcurrentTasks}) reached. Wait for some to complete.`
      };
    }

    const agentConfig = this.agentTypes[subagent_type];
    const taskId = resume || `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Create task record
    const task = {
      id: taskId,
      description,
      prompt,
      agentType: subagent_type,
      model: model || 'grok-code-fast-1',
      startedAt: Date.now(),
      status: 'running',
      output: [],
      isBackground: run_in_background
    };

    this.runningTasks.set(taskId, task);

    if (run_in_background) {
      // Start in background and return immediately
      this.executeAgentAsync(task, agentConfig, max_turns);

      return {
        success: true,
        taskId,
        status: 'started_in_background',
        message: `Agent started in background. Use TaskOutput tool with task_id: ${taskId} to check progress.`
      };
    }

    // Execute synchronously
    try {
      const result = await this.executeAgent(task, agentConfig, max_turns);

      task.status = 'completed';
      task.completedAt = Date.now();
      task.result = result;

      return {
        success: true,
        taskId,
        agentType: subagent_type,
        result: result.content,
        turns: result.turns,
        toolsUsed: result.toolsUsed
      };
    } catch (error) {
      task.status = 'failed';
      task.error = error.message;

      return {
        success: false,
        taskId,
        error: error.message
      };
    } finally {
      if (!run_in_background) {
        this.runningTasks.delete(taskId);
      }
    }
  }

  /**
   * Execute agent synchronously
   */
  async executeAgent(task, agentConfig, maxTurns) {
    const result = {
      content: '',
      turns: 0,
      toolsUsed: []
    };

    // Build agent system prompt
    const systemPrompt = this.buildAgentSystemPrompt(task, agentConfig);

    // Simulate agent execution
    // In a real implementation, this would use the GrokClient to run an agent loop
    if (this.grokClient) {
      try {
        const response = await this.grokClient.chat({
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: task.prompt }
          ],
          model: task.model,
          maxTokens: 4096,
          stream: false
        });

        result.content = response.choices[0].message.content;
        result.turns = 1;
      } catch (error) {
        throw new Error(`Agent execution failed: ${error.message}`);
      }
    } else {
      // Mock response for testing
      result.content = `[${task.agentType} Agent]\n\nTask: ${task.description}\n\nI would analyze and respond to: ${task.prompt.substring(0, 200)}...`;
      result.turns = 1;
    }

    return result;
  }

  /**
   * Execute agent asynchronously (background)
   */
  async executeAgentAsync(task, agentConfig, maxTurns) {
    try {
      const result = await this.executeAgent(task, agentConfig, maxTurns);

      task.status = 'completed';
      task.completedAt = Date.now();
      task.result = result;
    } catch (error) {
      task.status = 'failed';
      task.error = error.message;
    }
  }

  /**
   * Build system prompt for agent
   */
  buildAgentSystemPrompt(task, agentConfig) {
    let prompt = `You are a specialized ${task.agentType} agent for Grok Code.

${agentConfig.description}

Available tools: ${agentConfig.tools.join(', ')}
${agentConfig.readOnly ? 'This is a READ-ONLY agent. Do not attempt to modify files.' : ''}

Your task: ${task.description}

Guidelines:
- Be concise and focused on the task
- Use available tools when necessary
- Report findings clearly
- If you cannot complete the task, explain why`;

    return prompt;
  }

  /**
   * Get status of a running task
   */
  getTaskStatus(taskId) {
    const task = this.runningTasks.get(taskId);
    if (!task) {
      return { found: false };
    }

    return {
      found: true,
      id: task.id,
      description: task.description,
      status: task.status,
      startedAt: task.startedAt,
      completedAt: task.completedAt,
      error: task.error,
      result: task.result
    };
  }

  /**
   * List all running tasks
   */
  listRunningTasks() {
    return Array.from(this.runningTasks.values()).map(task => ({
      id: task.id,
      description: task.description,
      agentType: task.agentType,
      status: task.status,
      startedAt: task.startedAt,
      isBackground: task.isBackground
    }));
  }

  /**
   * Cancel a running task
   */
  cancelTask(taskId) {
    const task = this.runningTasks.get(taskId);
    if (!task) {
      return { success: false, error: 'Task not found' };
    }

    if (task.status !== 'running') {
      return { success: false, error: `Task is not running (status: ${task.status})` };
    }

    task.status = 'cancelled';
    task.completedAt = Date.now();
    this.runningTasks.delete(taskId);

    return { success: true, message: `Task ${taskId} cancelled` };
  }

  /**
   * Clean up completed background tasks
   */
  cleanup() {
    const now = Date.now();
    const maxAge = 30 * 60 * 1000; // 30 minutes

    for (const [id, task] of this.runningTasks.entries()) {
      if (task.status !== 'running' && (now - task.completedAt) > maxAge) {
        this.runningTasks.delete(id);
      }
    }
  }
}

export default TaskTool;
