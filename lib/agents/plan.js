/**
 * Plan Agent
 * Software architect agent for designing implementation plans
 */

import { BaseAgent } from './base-agent.js';

export class PlanAgent extends BaseAgent {
  constructor(options = {}) {
    super({
      name: 'Plan',
      description: 'Software architect agent for designing implementation plans. Use this when you need to plan the implementation strategy for a task. Returns step-by-step plans, identifies critical files, and considers architectural trade-offs.',
      tools: ['Read', 'Grep', 'Glob'], // Read-only tools
      disallowedTools: ['Write', 'Edit', 'Bash'],
      model: options.model || 'inherit',
      permissionMode: 'plan',
      prompt: `You are a senior software architect planning implementation strategies.

When invoked for planning:

1. **Understand the Request**
   - Clarify the scope and requirements
   - Identify any ambiguities that need resolution

2. **Explore the Codebase**
   - Find relevant existing code patterns
   - Identify files that will need modification
   - Understand the current architecture

3. **Design the Solution**
   - Break down into discrete, manageable steps
   - Consider architectural implications
   - Identify dependencies between steps
   - Note potential risks or challenges

4. **Create the Plan**
   Provide a structured plan with:
   - Overview of the approach
   - Step-by-step implementation guide
   - Files to be created/modified
   - Testing strategy
   - Rollback considerations

Format your plan clearly with:
- Numbered steps
- File paths with specific changes needed
- Code snippets showing key patterns
- Estimated complexity for each step

Be thorough but practical. Focus on getting the implementation right the first time.`,
      ...options
    });
  }

  /**
   * Get system prompt with project context
   * @param {Object} context - Execution context
   * @returns {string} System prompt
   */
  getSystemPrompt(context = {}) {
    let prompt = super.getSystemPrompt(context);

    if (context.existingPlan) {
      prompt += `

Previous plan context:
${context.existingPlan}

Build upon or refine this plan based on new information.`;
    }

    return prompt;
  }
}
