/**
 * Background Task Management
 * Handles background shells, async agents, and task output retrieval
 */

import { BaseTool } from './base-tool.js';
import { spawn } from 'child_process';
import { EventEmitter } from 'events';

/**
 * Task Manager - Manages background processes and async tasks
 */
export class TaskManager extends EventEmitter {
  constructor() {
    super();
    this.tasks = new Map();
    this.taskCounter = 0;
  }

  /**
   * Start a background shell task
   * @param {string} command - Command to run
   * @param {Object} options - Options
   * @returns {string} Task ID
   */
  startShell(command, options = {}) {
    const taskId = `shell-${++this.taskCounter}`;

    const task = {
      id: taskId,
      type: 'shell',
      command,
      status: 'running',
      output: '',
      error: '',
      startTime: new Date().toISOString(),
      endTime: null,
      exitCode: null,
      process: null
    };

    // Spawn the process
    const proc = spawn('bash', ['-c', command], {
      cwd: options.cwd || process.cwd(),
      env: { ...process.env, ...options.env },
      detached: false
    });

    task.process = proc;
    task.pid = proc.pid;

    proc.stdout.on('data', (data) => {
      task.output += data.toString();
      this.emit('output', { taskId, data: data.toString() });
    });

    proc.stderr.on('data', (data) => {
      task.error += data.toString();
      this.emit('error', { taskId, data: data.toString() });
    });

    proc.on('close', (code) => {
      task.status = code === 0 ? 'completed' : 'failed';
      task.exitCode = code;
      task.endTime = new Date().toISOString();
      this.emit('complete', { taskId, exitCode: code });
    });

    proc.on('error', (err) => {
      task.status = 'failed';
      task.error += err.message;
      task.endTime = new Date().toISOString();
      this.emit('error', { taskId, error: err.message });
    });

    this.tasks.set(taskId, task);
    return taskId;
  }

  /**
   * Start an async agent task
   * @param {string} agentName - Agent name
   * @param {Object} options - Agent options
   * @returns {string} Task ID
   */
  startAgent(agentName, options = {}) {
    const taskId = `agent-${++this.taskCounter}`;

    const task = {
      id: taskId,
      type: 'agent',
      agentName,
      status: 'running',
      output: '',
      result: null,
      startTime: new Date().toISOString(),
      endTime: null,
      options
    };

    this.tasks.set(taskId, task);
    return taskId;
  }

  /**
   * Update an agent task
   * @param {string} taskId - Task ID
   * @param {Object} update - Update data
   */
  updateAgent(taskId, update) {
    const task = this.tasks.get(taskId);
    if (task && task.type === 'agent') {
      Object.assign(task, update);
      if (update.status && ['completed', 'failed'].includes(update.status)) {
        task.endTime = new Date().toISOString();
      }
    }
  }

  /**
   * Get task by ID
   * @param {string} taskId - Task ID
   * @returns {Object|null} Task or null
   */
  getTask(taskId) {
    return this.tasks.get(taskId) || null;
  }

  /**
   * Get task output
   * @param {string} taskId - Task ID
   * @param {Object} options - Options { block, timeout }
   * @returns {Promise<Object>} Task output
   */
  async getOutput(taskId, options = {}) {
    const { block = true, timeout = 30000 } = options;

    const task = this.tasks.get(taskId);
    if (!task) {
      return { success: false, error: `Task not found: ${taskId}` };
    }

    if (!block || task.status !== 'running') {
      return this.formatTaskOutput(task);
    }

    // Wait for completion
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        resolve(this.formatTaskOutput(task));
      }, timeout);

      const checkComplete = () => {
        if (task.status !== 'running') {
          clearTimeout(timer);
          resolve(this.formatTaskOutput(task));
        } else {
          setTimeout(checkComplete, 100);
        }
      };

      checkComplete();
    });
  }

  /**
   * Format task output for return
   * @param {Object} task - Task object
   * @returns {Object} Formatted output
   */
  formatTaskOutput(task) {
    return {
      success: true,
      task_id: task.id,
      type: task.type,
      status: task.status,
      output: task.output,
      error: task.error,
      result: task.result,
      startTime: task.startTime,
      endTime: task.endTime,
      exitCode: task.exitCode,
      duration: task.endTime
        ? new Date(task.endTime) - new Date(task.startTime)
        : Date.now() - new Date(task.startTime)
    };
  }

  /**
   * Kill a running task
   * @param {string} taskId - Task ID
   * @returns {Object} Result
   */
  kill(taskId) {
    const task = this.tasks.get(taskId);
    if (!task) {
      return { success: false, error: `Task not found: ${taskId}` };
    }

    if (task.status !== 'running') {
      return { success: false, error: 'Task is not running' };
    }

    if (task.type === 'shell' && task.process) {
      try {
        task.process.kill('SIGTERM');

        // Force kill after 5 seconds if still running
        setTimeout(() => {
          if (task.status === 'running') {
            task.process.kill('SIGKILL');
          }
        }, 5000);

        task.status = 'killed';
        task.endTime = new Date().toISOString();

        return { success: true, message: `Task ${taskId} killed` };
      } catch (error) {
        return { success: false, error: error.message };
      }
    }

    if (task.type === 'agent') {
      task.status = 'killed';
      task.endTime = new Date().toISOString();
      return { success: true, message: `Agent ${taskId} killed` };
    }

    return { success: false, error: 'Cannot kill this task type' };
  }

  /**
   * List all tasks
   * @param {Object} filter - Filter options
   * @returns {Array} Task list
   */
  list(filter = {}) {
    let tasks = Array.from(this.tasks.values());

    if (filter.status) {
      tasks = tasks.filter(t => t.status === filter.status);
    }

    if (filter.type) {
      tasks = tasks.filter(t => t.type === filter.type);
    }

    return tasks.map(t => ({
      id: t.id,
      type: t.type,
      status: t.status,
      startTime: t.startTime,
      command: t.command,
      agentName: t.agentName
    }));
  }

  /**
   * Clean up completed tasks
   * @param {number} maxAge - Max age in ms (default: 1 hour)
   */
  cleanup(maxAge = 3600000) {
    const now = Date.now();

    for (const [id, task] of this.tasks.entries()) {
      if (task.status !== 'running' && task.endTime) {
        const age = now - new Date(task.endTime);
        if (age > maxAge) {
          this.tasks.delete(id);
        }
      }
    }
  }
}

// Singleton instance
let taskManager = null;

export function getTaskManager() {
  if (!taskManager) {
    taskManager = new TaskManager();
  }
  return taskManager;
}

/**
 * KillShell Tool - Kill a running background shell
 */
export class KillShellTool extends BaseTool {
  constructor(options = {}) {
    super({
      name: 'KillShell',
      description: 'Kills a running background shell by its ID. Use /tasks to see running shells.',
      parameters: {
        type: 'object',
        properties: {
          shell_id: {
            type: 'string',
            description: 'The ID of the background shell to kill'
          }
        },
        required: ['shell_id']
      },
      requiresPermission: true,
      isReadOnly: false,
      timeout: 10000,
      ...options
    });
  }

  async execute(params, context = {}) {
    const { shell_id } = params;
    const manager = getTaskManager();

    const result = manager.kill(shell_id);

    if (result.success) {
      return {
        success: true,
        output: result.message
      };
    }

    return {
      success: false,
      error: result.error
    };
  }
}

/**
 * TaskOutput Tool - Retrieve output from a running or completed task
 */
export class TaskOutputTool extends BaseTool {
  constructor(options = {}) {
    super({
      name: 'TaskOutput',
      description: 'Retrieves output from a running or completed task (background shell or agent).',
      parameters: {
        type: 'object',
        properties: {
          task_id: {
            type: 'string',
            description: 'The task ID to get output from'
          },
          block: {
            type: 'boolean',
            description: 'Whether to wait for task completion (default: true)',
            default: true
          },
          timeout: {
            type: 'number',
            description: 'Max wait time in ms (default: 30000, max: 600000)',
            default: 30000,
            maximum: 600000
          }
        },
        required: ['task_id', 'block', 'timeout']
      },
      requiresPermission: false,
      isReadOnly: true,
      timeout: 600000,
      ...options
    });
  }

  async execute(params, context = {}) {
    const { task_id, block = true, timeout = 30000 } = params;
    const manager = getTaskManager();

    const result = await manager.getOutput(task_id, { block, timeout });

    if (!result.success) {
      return {
        success: false,
        error: result.error
      };
    }

    return {
      success: true,
      output: result.output,
      status: result.status,
      task_id: result.task_id,
      type: result.type,
      exitCode: result.exitCode,
      duration: result.duration,
      error: result.error
    };
  }

  formatResult(result) {
    if (!result.success) {
      return `Task error: ${result.error}`;
    }

    let output = `Task ${result.task_id} (${result.status}):\n`;

    if (result.output) {
      output += `\nOutput:\n${result.output}`;
    }

    if (result.error) {
      output += `\nErrors:\n${result.error}`;
    }

    if (result.exitCode !== undefined && result.exitCode !== null) {
      output += `\nExit code: ${result.exitCode}`;
    }

    output += `\nDuration: ${Math.round(result.duration / 1000)}s`;

    return output;
  }
}

export default { TaskManager, getTaskManager, KillShellTool, TaskOutputTool };
