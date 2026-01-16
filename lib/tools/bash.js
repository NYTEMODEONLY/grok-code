/**
 * Bash Tool
 * Executes shell commands in a persistent session
 */

import { BaseTool } from './base-tool.js';
import { spawn, exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class BashTool extends BaseTool {
  constructor(options = {}) {
    super({
      name: 'Bash',
      description: `Executes a given bash command in a persistent shell session with optional timeout.
- The command argument is required
- Default timeout is 120000ms (2 minutes), max is 600000ms (10 minutes)
- Output will be truncated if it exceeds 30000 characters
- Avoid using find, grep, cat, head, tail, sed, awk, or echo commands
- Instead use the dedicated tools: Glob (for find), Grep (for grep), Read (for cat/head/tail)
- Use this for git, npm, docker, and other terminal operations
- NEVER use git commands with the -i flag (interactive)
- Always quote file paths that contain spaces with double quotes`,
      parameters: {
        type: 'object',
        properties: {
          command: {
            type: 'string',
            description: 'The command to execute'
          },
          description: {
            type: 'string',
            description: 'Clear description of what this command does'
          },
          timeout: {
            type: 'number',
            description: 'Optional timeout in milliseconds (max 600000)'
          },
          run_in_background: {
            type: 'boolean',
            description: 'Set to true to run this command in the background',
            default: false
          }
        },
        required: ['command']
      },
      requiresPermission: true,
      isReadOnly: false,
      ...options
    });

    this.defaultTimeout = options.defaultTimeout || 120000;
    this.maxTimeout = options.maxTimeout || 600000;
    this.maxOutputLength = options.maxOutputLength || 30000;
    this.cwd = options.cwd || process.cwd();
    this.backgroundTasks = new Map();
  }

  async execute(params, context = {}) {
    const {
      command,
      description,
      timeout = this.defaultTimeout,
      run_in_background = false
    } = params;
    const startTime = Date.now();

    try {
      // Validate command
      if (!command || typeof command !== 'string') {
        return { error: 'command is required and must be a string' };
      }

      // Check for dangerous patterns
      const dangerCheck = this.checkDangerousCommand(command);
      if (dangerCheck.dangerous) {
        return {
          error: `Potentially dangerous command detected: ${dangerCheck.reason}`,
          command,
          suggestion: dangerCheck.suggestion
        };
      }

      // Validate timeout
      const effectiveTimeout = Math.min(timeout, this.maxTimeout);
      const workingDir = context.cwd || this.cwd;

      if (run_in_background) {
        return this.executeBackground(command, description, workingDir);
      }

      // Execute command
      const result = await this.executeCommand(command, workingDir, effectiveTimeout);

      return {
        success: !result.error,
        command,
        description,
        output: this.truncateOutput(result.stdout || ''),
        stderr: result.stderr ? this.truncateOutput(result.stderr) : undefined,
        exitCode: result.exitCode,
        executionTime: Date.now() - startTime,
        timedOut: result.timedOut || false
      };
    } catch (error) {
      return {
        error: error.message,
        command,
        executionTime: Date.now() - startTime
      };
    }
  }

  async executeCommand(command, cwd, timeout) {
    return new Promise((resolve) => {
      const shell = process.platform === 'win32' ? 'cmd.exe' : '/bin/bash';
      const shellArgs = process.platform === 'win32' ? ['/c', command] : ['-c', command];

      let stdout = '';
      let stderr = '';
      let timedOut = false;

      const proc = spawn(shell, shellArgs, {
        cwd,
        env: { ...process.env },
        stdio: ['pipe', 'pipe', 'pipe']
      });

      const timer = setTimeout(() => {
        timedOut = true;
        proc.kill('SIGTERM');
        setTimeout(() => proc.kill('SIGKILL'), 1000);
      }, timeout);

      proc.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      proc.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('close', (code) => {
        clearTimeout(timer);
        resolve({
          stdout,
          stderr,
          exitCode: code,
          timedOut
        });
      });

      proc.on('error', (error) => {
        clearTimeout(timer);
        resolve({
          error: error.message,
          stdout,
          stderr,
          exitCode: -1
        });
      });
    });
  }

  async executeBackground(command, description, cwd) {
    const taskId = `bg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const task = {
      id: taskId,
      command,
      description,
      startTime: Date.now(),
      status: 'running',
      stdout: '',
      stderr: ''
    };

    this.backgroundTasks.set(taskId, task);

    // Execute in background
    const shell = process.platform === 'win32' ? 'cmd.exe' : '/bin/bash';
    const shellArgs = process.platform === 'win32' ? ['/c', command] : ['-c', command];

    const proc = spawn(shell, shellArgs, {
      cwd,
      env: { ...process.env },
      stdio: ['pipe', 'pipe', 'pipe'],
      detached: true
    });

    proc.stdout.on('data', (data) => {
      task.stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      task.stderr += data.toString();
    });

    proc.on('close', (code) => {
      task.status = code === 0 ? 'completed' : 'failed';
      task.exitCode = code;
      task.endTime = Date.now();
    });

    proc.on('error', (error) => {
      task.status = 'error';
      task.error = error.message;
      task.endTime = Date.now();
    });

    return {
      success: true,
      taskId,
      command,
      description,
      message: 'Command started in background',
      checkWith: `Use TaskOutput tool with task_id: "${taskId}" to check status`
    };
  }

  /**
   * Check for dangerous command patterns
   * @param {string} command - Command to check
   * @returns {Object} Check result
   */
  checkDangerousCommand(command) {
    const dangerousPatterns = [
      { pattern: /rm\s+-rf\s+\/[^.]/i, reason: 'rm -rf on root or system directories', suggestion: 'Be more specific with the path' },
      { pattern: /rm\s+-rf\s+\~\//i, reason: 'rm -rf on home directory', suggestion: 'Be more specific with the path' },
      { pattern: /mkfs\./i, reason: 'filesystem formatting command', suggestion: 'This is a dangerous system operation' },
      { pattern: /dd\s+if=/i, reason: 'dd command can overwrite data', suggestion: 'Use with extreme caution' },
      { pattern: />\s*\/dev\/sd/i, reason: 'writing directly to disk device', suggestion: 'This can destroy data' },
      { pattern: /chmod\s+-R\s+777\s+\//i, reason: 'chmod 777 on root', suggestion: 'Use more restrictive permissions' },
      { pattern: /git\s+push\s+.*--force\s+.*(?:main|master)/i, reason: 'force push to main/master', suggestion: 'This can overwrite shared history' },
      { pattern: /git\s+.*-i\s/i, reason: 'interactive git command', suggestion: 'Interactive mode is not supported' },
      { pattern: /:(){ :|:& };:/i, reason: 'fork bomb detected', suggestion: 'This is malicious code' }
    ];

    for (const { pattern, reason, suggestion } of dangerousPatterns) {
      if (pattern.test(command)) {
        return { dangerous: true, reason, suggestion };
      }
    }

    return { dangerous: false };
  }

  /**
   * Truncate output if too long
   * @param {string} output - Output to truncate
   * @returns {string} Truncated output
   */
  truncateOutput(output) {
    if (output.length > this.maxOutputLength) {
      const half = Math.floor(this.maxOutputLength / 2);
      return output.substring(0, half) +
        `\n\n... [${output.length - this.maxOutputLength} characters truncated] ...\n\n` +
        output.substring(output.length - half);
    }
    return output;
  }

  /**
   * Get status of a background task
   * @param {string} taskId - Task ID
   * @returns {Object} Task status
   */
  getBackgroundTask(taskId) {
    return this.backgroundTasks.get(taskId) || { error: 'Task not found' };
  }

  /**
   * Get all background tasks
   * @returns {Array} All tasks
   */
  getAllBackgroundTasks() {
    return Array.from(this.backgroundTasks.values());
  }
}
