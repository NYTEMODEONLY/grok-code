/**
 * System Prompt Builder
 * Constructs the system prompt for Grok Code conversations
 * Similar to Claude Code's prompt structure
 */

import fs from 'fs-extra';
import path from 'path';
import os from 'os';

export class SystemPromptBuilder {
  constructor(options = {}) {
    this.projectPath = options.projectPath || process.cwd();
    this.model = options.model || 'grok-code-fast-1';
    this.toolRegistry = options.toolRegistry;
    this.projectInstructionsLoader = options.projectInstructionsLoader;

    // Prompt components
    this.basePrompt = null;
    this.toolDescriptions = null;
    this.projectInstructions = null;
    this.environmentInfo = null;
  }

  /**
   * Build the complete system prompt
   * @param {Object} options - Build options
   * @returns {Promise<string>} Complete system prompt
   */
  async build(options = {}) {
    const parts = [];

    // 1. Base system prompt
    parts.push(this.getBasePrompt());

    // 2. Tool descriptions
    if (this.toolRegistry && options.includeTools !== false) {
      parts.push(await this.getToolDescriptions());
    }

    // 3. Environment information
    parts.push(this.getEnvironmentInfo());

    // 4. Project instructions (GROK.md)
    if (options.includeProjectInstructions !== false) {
      const projectInstr = await this.getProjectInstructions();
      if (projectInstr) {
        parts.push(projectInstr);
      }
    }

    // 5. Session context (if provided)
    if (options.sessionContext) {
      parts.push(this.formatSessionContext(options.sessionContext));
    }

    // 6. File context (if provided)
    if (options.fileContext && Object.keys(options.fileContext).length > 0) {
      parts.push(this.formatFileContext(options.fileContext));
    }

    // 7. Conversation summary (if provided)
    if (options.conversationSummary) {
      parts.push(this.formatConversationSummary(options.conversationSummary));
    }

    return parts.filter(Boolean).join('\n\n');
  }

  /**
   * Get base system prompt
   */
  getBasePrompt() {
    return `You are Grok Code, an AI-powered terminal coding assistant built by xAI.

You are an interactive CLI tool that helps users with software engineering tasks. Use the instructions below and the tools available to you to assist the user.

# Core Responsibilities
- Assist with coding tasks: debugging, refactoring, code generation, explanations
- Read, write, and edit files in the user's project
- Execute shell commands when needed
- Search codebases efficiently
- Provide clear, accurate technical guidance

# Important Guidelines

## Code Quality
- Write clean, maintainable, idiomatic code
- Follow existing project conventions and patterns
- Avoid over-engineering; keep solutions focused
- Never introduce security vulnerabilities

## File Operations
- Always read files before modifying them
- Create backups before destructive operations
- Use exact string matching for edits
- Prefer editing existing files over creating new ones

## Communication
- Be concise and direct
- Use markdown formatting appropriately
- Explain complex concepts clearly
- Ask for clarification when requirements are ambiguous

## Safety
- Never execute dangerous commands without confirmation
- Don't expose secrets or sensitive data
- Respect .gitignore patterns
- Warn about potentially destructive operations

# Tool Usage
- Use the appropriate tool for each task
- Prefer specialized tools over bash where available
- Chain tools efficiently for complex operations
- Handle errors gracefully`;
  }

  /**
   * Get tool descriptions for system prompt
   */
  async getToolDescriptions() {
    if (!this.toolRegistry) {
      return null;
    }

    let desc = '# Available Tools\n\n';
    desc += 'You have access to the following tools:\n\n';

    const tools = this.toolRegistry.list();
    for (const toolName of tools) {
      const tool = this.toolRegistry.get(toolName);
      if (tool) {
        const schema = tool.getSchema?.();
        desc += `## ${toolName}\n`;
        desc += `${tool.description || schema?.description || 'No description'}\n`;

        if (tool.requiresPermission) {
          desc += '(Requires user permission)\n';
        }

        if (schema?.parameters?.properties) {
          desc += '\nParameters:\n';
          for (const [param, config] of Object.entries(schema.parameters.properties)) {
            const required = schema.parameters.required?.includes(param) ? ' (required)' : '';
            desc += `- ${param}${required}: ${config.description || config.type}\n`;
          }
        }
        desc += '\n';
      }
    }

    return desc;
  }

  /**
   * Get environment information
   */
  getEnvironmentInfo() {
    const isGitRepo = fs.existsSync(path.join(this.projectPath, '.git'));

    return `# Environment Information

Working directory: ${this.projectPath}
Is git repository: ${isGitRepo ? 'Yes' : 'No'}
Platform: ${process.platform}
OS Version: ${os.release()}
Node.js: ${process.version}
Date: ${new Date().toISOString().split('T')[0]}

You are powered by Grok (${this.model}).`;
  }

  /**
   * Get project instructions from GROK.md
   */
  async getProjectInstructions() {
    if (this.projectInstructionsLoader) {
      const instructions = await this.projectInstructionsLoader.load();
      if (instructions && instructions.content) {
        return `# Project Instructions (GROK.md)

${instructions.content}`;
      }
    }

    // Try to load directly
    const possibleFiles = ['GROK.md', 'grok.md', '.grok.md', 'CLAUDE.md'];

    for (const filename of possibleFiles) {
      const filePath = path.join(this.projectPath, filename);
      if (await fs.pathExists(filePath)) {
        const content = await fs.readFile(filePath, 'utf8');
        return `# Project Instructions (${filename})

${content}`;
      }
    }

    return null;
  }

  /**
   * Format session context
   */
  formatSessionContext(context) {
    if (!context) return null;

    let formatted = '# Session Context\n\n';

    if (context.sessionId) {
      formatted += `Session ID: ${context.sessionId}\n`;
    }

    if (context.startedAt) {
      formatted += `Started: ${new Date(context.startedAt).toLocaleString()}\n`;
    }

    if (context.notes) {
      formatted += `\n${context.notes}\n`;
    }

    return formatted;
  }

  /**
   * Format file context for system prompt
   */
  formatFileContext(fileContext) {
    if (!fileContext || Object.keys(fileContext).length === 0) {
      return null;
    }

    let formatted = '# Files in Context\n\n';
    formatted += 'The following files have been loaded into context:\n\n';

    for (const [filePath, content] of Object.entries(fileContext)) {
      const lines = content.split('\n').length;
      const tokens = Math.ceil(content.length / 4);
      formatted += `## ${filePath}\n`;
      formatted += `_${lines} lines, ~${tokens} tokens_\n\n`;
      formatted += '```\n' + content.substring(0, 5000) + '\n```\n\n';

      if (content.length > 5000) {
        formatted += '_[Content truncated...]_\n\n';
      }
    }

    return formatted;
  }

  /**
   * Format conversation summary
   */
  formatConversationSummary(summary) {
    if (!summary) return null;

    return `# Previous Conversation Summary

${typeof summary === 'string' ? summary : summary.content}`;
  }

  /**
   * Build a minimal prompt for quick operations
   */
  buildMinimal() {
    return `You are Grok Code, an AI coding assistant. Help the user with their coding task. Be concise and accurate.

Working directory: ${this.projectPath}
Platform: ${process.platform}`;
  }

  /**
   * Build prompt for specific agent type
   */
  buildForAgent(agentType) {
    const agentPrompts = {
      Explore: `You are an Explore agent for Grok Code. Your role is to quickly navigate and understand codebases.

Capabilities:
- Read files to understand their contents
- Search with grep for specific patterns
- Use glob to find files by name

Approach:
- Be systematic in your exploration
- Note important files and patterns
- Summarize your findings clearly
- Stay read-only - do not modify files`,

      Plan: `You are a Plan agent for Grok Code. Your role is to design implementation strategies.

Capabilities:
- Analyze requirements
- Break down tasks into steps
- Identify affected files
- Consider tradeoffs

Output:
- Clear, numbered steps
- File paths that will be modified
- Dependencies and risks
- Time/complexity estimates`,

      Review: `You are a Review agent for Grok Code. Your role is to review code for quality and security.

Focus areas:
- Code quality and maintainability
- Security vulnerabilities (OWASP Top 10)
- Performance issues
- Best practices

Output:
- Categorized findings (critical, warning, suggestion)
- Specific line references
- Recommended fixes`,

      Debug: `You are a Debug agent for Grok Code. Your role is to identify and fix bugs.

Approach:
- Understand the expected vs actual behavior
- Identify the root cause
- Trace the code path
- Propose targeted fixes

Output:
- Root cause analysis
- Affected code locations
- Fix recommendations
- Prevention suggestions`
    };

    return agentPrompts[agentType] || this.buildMinimal();
  }
}

export default SystemPromptBuilder;
