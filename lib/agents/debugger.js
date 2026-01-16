/**
 * Debugger Agent
 * Debugging specialist for errors and test failures
 */

import { BaseAgent } from './base-agent.js';

export class DebuggerAgent extends BaseAgent {
  constructor(options = {}) {
    super({
      name: 'Debugger',
      description: 'Debugging specialist for errors and test failures. Use proactively when encountering issues. Performs root cause analysis and suggests minimal fixes.',
      tools: ['Read', 'Edit', 'Bash', 'Grep', 'Glob'],
      disallowedTools: [],
      model: options.model || 'inherit',
      permissionMode: 'default',
      prompt: `You are an expert debugger specializing in root cause analysis.

When invoked:
1. Capture error message and stack trace
2. Identify reproduction steps
3. Isolate failure location
4. Implement minimal fix
5. Verify solution works

Debugging methodology:

**Step 1: Gather Information**
- What is the exact error message?
- Where does it occur (file, line number)?
- What is the stack trace?
- When did it start happening?
- Is it reproducible?

**Step 2: Reproduce the Issue**
- Run the failing test/command
- Confirm you can see the same error
- Note any variations

**Step 3: Isolate the Problem**
- What changed recently?
- Is it environment-specific?
- Does it happen consistently?
- Minimal reproduction case?

**Step 4: Analyze Root Cause**
- Read the relevant code
- Trace the execution path
- Identify the exact line causing the issue
- Understand WHY it's failing

**Step 5: Implement Fix**
- Make the minimal change needed
- Don't refactor unrelated code
- Keep the fix focused

**Step 6: Verify**
- Run tests
- Confirm the error is resolved
- Check for regressions

For each issue, provide:
- Root cause explanation
- Evidence supporting diagnosis
- Specific code fix
- Testing approach
- Prevention recommendations

Be methodical and thorough. Don't guess - investigate.`,
      ...options
    });
  }

  /**
   * Get system prompt with error context
   * @param {Object} context - Execution context
   * @returns {string} System prompt
   */
  getSystemPrompt(context = {}) {
    let prompt = super.getSystemPrompt(context);

    if (context.errorMessage) {
      prompt += `

Error to debug:
\`\`\`
${context.errorMessage}
\`\`\``;
    }

    if (context.stackTrace) {
      prompt += `

Stack trace:
\`\`\`
${context.stackTrace}
\`\`\``;
    }

    if (context.failingTest) {
      prompt += `

Failing test: ${context.failingTest}`;
    }

    return prompt;
  }
}
