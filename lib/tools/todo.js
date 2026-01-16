/**
 * Todo Tool
 * Task management for tracking progress during coding sessions
 */

import { BaseTool } from './base-tool.js';
import fs from 'fs-extra';
import path from 'path';

export class TodoTool extends BaseTool {
  constructor(options = {}) {
    super({
      name: 'TodoWrite',
      description: `Use this tool to create and manage a structured task list for your current coding session.
- Use this tool VERY frequently to track progress on multi-step work
- Helpful for planning tasks and breaking down larger complex tasks into smaller steps
- Mark todos as completed as soon as you are done with a task
- Do not batch up multiple tasks before marking them as completed

Task states:
- pending: Task not yet started
- in_progress: Currently working on (limit to ONE task at a time)
- completed: Task finished successfully

Task format:
- content: The imperative form describing what needs to be done (e.g., "Run tests")
- activeForm: The present continuous form shown during execution (e.g., "Running tests")
- status: One of pending, in_progress, completed`,
      parameters: {
        type: 'object',
        properties: {
          todos: {
            type: 'array',
            description: 'The updated todo list',
            items: {
              type: 'object',
              properties: {
                content: {
                  type: 'string',
                  description: 'The task description (imperative form)'
                },
                status: {
                  type: 'string',
                  enum: ['pending', 'in_progress', 'completed'],
                  description: 'Task status'
                },
                activeForm: {
                  type: 'string',
                  description: 'The present continuous form of the task'
                }
              },
              required: ['content', 'status', 'activeForm']
            }
          }
        },
        required: ['todos']
      },
      requiresPermission: false,
      isReadOnly: false,
      ...options
    });

    this.todoFile = options.todoFile || '.grok/todos.json';
    this.maxTodos = options.maxTodos || 100;
  }

  async execute(params, context = {}) {
    const { todos } = params;
    const startTime = Date.now();

    try {
      // Validate todos
      if (!todos || !Array.isArray(todos)) {
        return { error: 'todos must be an array' };
      }

      // Validate each todo
      for (const todo of todos) {
        if (!todo.content || typeof todo.content !== 'string') {
          return { error: 'Each todo must have a content string' };
        }
        if (!['pending', 'in_progress', 'completed'].includes(todo.status)) {
          return { error: `Invalid status: ${todo.status}. Must be pending, in_progress, or completed` };
        }
        if (!todo.activeForm || typeof todo.activeForm !== 'string') {
          return { error: 'Each todo must have an activeForm string' };
        }
      }

      // Check for multiple in_progress
      const inProgress = todos.filter(t => t.status === 'in_progress');
      if (inProgress.length > 1) {
        return {
          error: `Only one task can be in_progress at a time. Found ${inProgress.length} tasks in progress.`,
          inProgressTasks: inProgress.map(t => t.content)
        };
      }

      // Limit total todos
      const limitedTodos = todos.slice(0, this.maxTodos);

      // Save to file
      const todoPath = path.resolve(context.cwd || process.cwd(), this.todoFile);
      await fs.ensureDir(path.dirname(todoPath));

      const todoData = {
        todos: limitedTodos,
        lastUpdated: new Date().toISOString(),
        sessionId: context.sessionId || 'default'
      };

      await fs.writeJson(todoPath, todoData, { spaces: 2 });

      // Generate summary
      const summary = this.generateSummary(limitedTodos);

      return {
        success: true,
        todosCount: limitedTodos.length,
        summary,
        currentTask: inProgress.length > 0 ? inProgress[0].activeForm : null,
        executionTime: Date.now() - startTime
      };
    } catch (error) {
      return {
        error: error.message,
        executionTime: Date.now() - startTime
      };
    }
  }

  /**
   * Generate a summary of todos
   * @param {Array} todos - Todo list
   * @returns {Object} Summary statistics
   */
  generateSummary(todos) {
    const pending = todos.filter(t => t.status === 'pending').length;
    const inProgress = todos.filter(t => t.status === 'in_progress').length;
    const completed = todos.filter(t => t.status === 'completed').length;

    return {
      total: todos.length,
      pending,
      inProgress,
      completed,
      completionRate: todos.length > 0
        ? Math.round((completed / todos.length) * 100)
        : 0
    };
  }

  /**
   * Read current todos
   * @param {Object} context - Execution context
   * @returns {Promise<Object>} Current todos
   */
  async readTodos(context = {}) {
    const todoPath = path.resolve(context.cwd || process.cwd(), this.todoFile);

    try {
      if (await fs.pathExists(todoPath)) {
        return await fs.readJson(todoPath);
      }
    } catch (e) {
      // File doesn't exist or is corrupted
    }

    return { todos: [], lastUpdated: null };
  }

  /**
   * Format todos for display
   * @param {Array} todos - Todo list
   * @returns {string} Formatted output
   */
  formatForDisplay(todos) {
    if (!todos || todos.length === 0) {
      return 'No tasks in the todo list.';
    }

    const statusEmoji = {
      pending: '⏳',
      in_progress: '🔄',
      completed: '✅'
    };

    return todos.map((todo, i) => {
      const emoji = statusEmoji[todo.status] || '❓';
      const statusText = todo.status === 'in_progress'
        ? todo.activeForm
        : todo.content;
      return `${i + 1}. ${emoji} [${todo.status}] ${statusText}`;
    }).join('\n');
  }
}

/**
 * TodoRead Tool
 * Read current todo list
 */
export class TodoReadTool extends BaseTool {
  constructor(options = {}) {
    super({
      name: 'TodoRead',
      description: 'Read the current todo list to check progress',
      parameters: {
        type: 'object',
        properties: {}
      },
      requiresPermission: false,
      isReadOnly: true,
      ...options
    });

    this.todoTool = new TodoTool(options);
  }

  async execute(params, context = {}) {
    const startTime = Date.now();

    try {
      const data = await this.todoTool.readTodos(context);
      const formatted = this.todoTool.formatForDisplay(data.todos);
      const summary = this.todoTool.generateSummary(data.todos);

      return {
        output: formatted,
        todos: data.todos,
        summary,
        lastUpdated: data.lastUpdated,
        executionTime: Date.now() - startTime
      };
    } catch (error) {
      return {
        error: error.message,
        executionTime: Date.now() - startTime
      };
    }
  }
}
