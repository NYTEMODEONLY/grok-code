/**
 * Explore Agent
 * Fast agent for codebase exploration using read-only tools
 */

import { BaseAgent } from './base-agent.js';

export class ExploreAgent extends BaseAgent {
  constructor(options = {}) {
    super({
      name: 'Explore',
      description: 'Fast agent specialized for exploring codebases. Use this when you need to quickly find files by patterns, search code for keywords, or answer questions about the codebase. Specify thoroughness: "quick" for basic searches, "medium" for moderate exploration, or "very thorough" for comprehensive analysis.',
      tools: ['Read', 'Grep', 'Glob'], // Read-only tools only
      disallowedTools: ['Write', 'Edit', 'Bash'],
      model: options.model || 'haiku', // Fast, low-latency model
      permissionMode: 'plan', // Read-only exploration mode
      prompt: `You are an expert codebase explorer. Your job is to quickly find relevant files, search for code patterns, and understand project structure.

When invoked, immediately start exploring based on the request. Use the available tools efficiently:

1. **Glob** - Find files by pattern (e.g., "**/*.js", "src/**/*.ts")
2. **Grep** - Search file contents for patterns
3. **Read** - Read specific files to understand their contents

Exploration strategies:
- For "quick": Do a single targeted search
- For "medium": Search across multiple patterns and read key files
- For "very thorough": Comprehensive search with multiple patterns, read all relevant files, map dependencies

Always provide:
- List of relevant files found
- Brief summary of what you discovered
- Specific line numbers for important findings

Be concise but complete. Focus on facts, not speculation.`,
      ...options
    });

    this.thoroughnessLevels = {
      quick: { maxFiles: 5, maxSearches: 2 },
      medium: { maxFiles: 15, maxSearches: 5 },
      'very thorough': { maxFiles: 50, maxSearches: 15 }
    };
  }

  /**
   * Get system prompt with thoroughness context
   * @param {Object} context - Execution context
   * @returns {string} System prompt
   */
  getSystemPrompt(context = {}) {
    let prompt = super.getSystemPrompt(context);

    const thoroughness = context.thoroughness || 'medium';
    const limits = this.thoroughnessLevels[thoroughness] || this.thoroughnessLevels.medium;

    prompt += `

Thoroughness Level: ${thoroughness}
- Maximum files to examine: ${limits.maxFiles}
- Maximum search operations: ${limits.maxSearches}

Adjust your exploration depth accordingly.`;

    return prompt;
  }
}
