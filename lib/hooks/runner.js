/**
 * Hook Runner
 * Executes individual hooks
 */

import { spawn } from 'child_process';

export class HookRunner {
  constructor(options = {}) {
    this.defaultTimeout = options.defaultTimeout || 60000; // 60 seconds
    this.cwd = options.cwd || process.cwd();
    this.verbose = options.verbose || false;
    this.env = options.env || {};
  }

  /**
   * Run a hook
   * @param {Object} hook - Hook configuration
   * @param {Object} input - Hook input (JSON)
   * @returns {Promise<Object>} Hook result
   */
  async run(hook, input) {
    if (hook.type === 'command') {
      return this.runCommand(hook, input);
    } else if (hook.type === 'prompt') {
      return this.runPrompt(hook, input);
    } else {
      throw new Error(`Unknown hook type: ${hook.type}`);
    }
  }

  /**
   * Run a command-type hook
   * @param {Object} hook - Hook configuration
   * @param {Object} input - Hook input
   * @returns {Promise<Object>} Command result
   */
  async runCommand(hook, input) {
    const { command, timeout = this.defaultTimeout } = hook;

    return new Promise((resolve) => {
      const shell = process.platform === 'win32' ? 'cmd.exe' : '/bin/bash';
      const shellArgs = process.platform === 'win32' ? ['/c', command] : ['-c', command];

      let stdout = '';
      let stderr = '';
      let timedOut = false;
      let jsonOutput = null;

      const proc = spawn(shell, shellArgs, {
        cwd: hook.cwd || input.cwd || this.cwd,
        env: {
          ...process.env,
          ...this.env,
          GROK_PROJECT_DIR: input.cwd || this.cwd,
          GROK_SESSION_ID: input.session_id || '',
          GROK_HOOK_EVENT: input.hook_event_name || ''
        },
        stdio: ['pipe', 'pipe', 'pipe']
      });

      // Send JSON input via stdin
      proc.stdin.write(JSON.stringify(input));
      proc.stdin.end();

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

        // Try to parse JSON output
        try {
          if (stdout.trim()) {
            jsonOutput = JSON.parse(stdout.trim());
          }
        } catch (e) {
          // Output is not JSON, that's fine
        }

        resolve({
          exitCode: code,
          stdout,
          stderr,
          timedOut,
          command,
          // Extract decision fields from JSON output
          continue: jsonOutput?.continue,
          stopReason: jsonOutput?.stopReason,
          suppressOutput: jsonOutput?.suppressOutput,
          systemMessage: jsonOutput?.systemMessage,
          decision: jsonOutput?.decision,
          reason: jsonOutput?.reason || stderr,
          hookSpecificOutput: jsonOutput?.hookSpecificOutput
        });
      });

      proc.on('error', (error) => {
        clearTimeout(timer);
        resolve({
          exitCode: -1,
          error: error.message,
          stdout,
          stderr,
          command
        });
      });
    });
  }

  /**
   * Run a prompt-type hook (LLM evaluation)
   * @param {Object} hook - Hook configuration
   * @param {Object} input - Hook input
   * @returns {Promise<Object>} Prompt result
   */
  async runPrompt(hook, input) {
    const { prompt, timeout = 30000 } = hook;

    // Replace $ARGUMENTS placeholder with input
    const expandedPrompt = prompt.replace('$ARGUMENTS', JSON.stringify(input, null, 2));

    // This would call the LLM API to evaluate the prompt
    // For now, return a pass-through result
    // In production, this would integrate with the Grok API

    return {
      exitCode: 0,
      ok: true,
      prompt: expandedPrompt,
      reason: 'Prompt hook evaluation placeholder'
    };
  }

  /**
   * Validate hook configuration
   * @param {Object} hook - Hook configuration
   * @returns {Object} Validation result
   */
  validateHook(hook) {
    const errors = [];

    if (!hook.type) {
      errors.push('Hook must have a type (command or prompt)');
    }

    if (hook.type === 'command' && !hook.command) {
      errors.push('Command hook must have a command property');
    }

    if (hook.type === 'prompt' && !hook.prompt) {
      errors.push('Prompt hook must have a prompt property');
    }

    if (hook.timeout && (typeof hook.timeout !== 'number' || hook.timeout < 0)) {
      errors.push('Timeout must be a positive number');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}
