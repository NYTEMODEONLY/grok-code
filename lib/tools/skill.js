/**
 * Skill Tool
 * Execute skills/workflows within the conversation
 * Equivalent to Claude Code's Skill tool
 */

import { BaseTool } from './base-tool.js';

export class SkillTool extends BaseTool {
  constructor(options = {}) {
    super({
      name: 'Skill',
      description: 'Execute a skill/workflow within the main conversation',
      requiresPermission: false,
      isReadOnly: true,
      timeout: 300000, // 5 minutes for skill execution
      ...options
    });

    this.skillsManager = options.skillsManager;

    // Built-in skills
    this.builtInSkills = new Map([
      ['commit', {
        name: 'commit',
        description: 'Smart git commit with AI-generated message',
        usage: '/commit [hint]'
      }],
      ['review', {
        name: 'review',
        description: 'Code review for staged changes or file',
        usage: '/review [file]'
      }],
      ['explain', {
        name: 'explain',
        description: 'Explain code in context',
        usage: '/explain [file:line]'
      }],
      ['refactor', {
        name: 'refactor',
        description: 'Suggest refactoring improvements',
        usage: '/refactor [file]'
      }],
      ['test', {
        name: 'test',
        description: 'Generate tests for code',
        usage: '/test [file]'
      }],
      ['docs', {
        name: 'docs',
        description: 'Generate documentation',
        usage: '/docs [file]'
      }],
      ['fix', {
        name: 'fix',
        description: 'Analyze and fix errors',
        usage: '/fix [error description]'
      }],
      ['debug', {
        name: 'debug',
        description: 'Debug assistance',
        usage: '/debug [description]'
      }]
    ]);
  }

  getSchema() {
    return {
      name: this.name,
      description: this.description,
      parameters: {
        type: 'object',
        properties: {
          skill: {
            type: 'string',
            description: 'The skill name to execute (e.g., "commit", "review", "test")'
          },
          args: {
            type: 'string',
            description: 'Optional arguments for the skill'
          }
        },
        required: ['skill']
      }
    };
  }

  async execute(params) {
    const { skill, args = '' } = params;

    // Parse skill name (handle plugin:skill format)
    const [pluginOrSkill, skillName] = skill.includes(':')
      ? skill.split(':')
      : [null, skill];

    const actualSkillName = skillName || pluginOrSkill;

    // Check built-in skills first
    if (this.builtInSkills.has(actualSkillName)) {
      return this.executeBuiltInSkill(actualSkillName, args);
    }

    // Check custom skills via skillsManager
    if (this.skillsManager) {
      const customSkill = await this.skillsManager.getSkill(actualSkillName);
      if (customSkill) {
        return this.executeCustomSkill(customSkill, args);
      }
    }

    return {
      success: false,
      error: `Unknown skill: ${skill}`,
      availableSkills: this.getAvailableSkills()
    };
  }

  /**
   * Execute a built-in skill
   */
  async executeBuiltInSkill(skillName, args) {
    const skill = this.builtInSkills.get(skillName);

    // Generate skill prompt based on type
    let prompt;

    switch (skillName) {
      case 'commit':
        prompt = this.buildCommitPrompt(args);
        break;
      case 'review':
        prompt = this.buildReviewPrompt(args);
        break;
      case 'explain':
        prompt = this.buildExplainPrompt(args);
        break;
      case 'refactor':
        prompt = this.buildRefactorPrompt(args);
        break;
      case 'test':
        prompt = this.buildTestPrompt(args);
        break;
      case 'docs':
        prompt = this.buildDocsPrompt(args);
        break;
      case 'fix':
        prompt = this.buildFixPrompt(args);
        break;
      case 'debug':
        prompt = this.buildDebugPrompt(args);
        break;
      default:
        return {
          success: false,
          error: `No implementation for skill: ${skillName}`
        };
    }

    return {
      success: true,
      skill: skillName,
      prompt,
      message: `Skill '${skillName}' loaded. Follow the instructions in the prompt.`
    };
  }

  /**
   * Execute a custom skill
   */
  async executeCustomSkill(skill, args) {
    // Custom skills are loaded from .grok/skills/*.md
    let prompt = skill.content;

    // Replace argument placeholders
    if (args) {
      prompt = prompt.replace(/\{\{args\}\}/g, args);
      prompt = prompt.replace(/\{args\}/g, args);
    }

    return {
      success: true,
      skill: skill.name,
      prompt,
      message: `Custom skill '${skill.name}' loaded.`,
      isCustom: true
    };
  }

  /**
   * Build prompt for commit skill
   */
  buildCommitPrompt(hint) {
    return `## Git Commit Skill

Create a smart git commit with an AI-generated message.

Steps:
1. Run \`git status\` to see changes
2. Run \`git diff --staged\` to see staged changes
3. Run \`git log -3 --oneline\` to see recent commit style
4. Analyze the changes and generate a commit message that:
   - Summarizes the nature of changes (feature, fix, refactor, etc.)
   - Focuses on the "why" rather than "what"
   - Follows the repository's commit style
5. Create the commit

${hint ? `Hint from user: ${hint}` : ''}

Remember to add the co-author line:
Co-Authored-By: Grok <noreply@x.ai>`;
  }

  /**
   * Build prompt for review skill
   */
  buildReviewPrompt(target) {
    return `## Code Review Skill

Perform a thorough code review${target ? ` for: ${target}` : ' of staged changes'}.

Review criteria:
1. **Code Quality**: Is the code clean, readable, and maintainable?
2. **Logic Errors**: Are there any bugs or logical issues?
3. **Security**: Check for OWASP top 10 vulnerabilities
4. **Performance**: Any obvious performance issues?
5. **Best Practices**: Does it follow language/framework conventions?

Steps:
1. ${target ? `Read the file: ${target}` : 'Run `git diff --staged` to see changes'}
2. Analyze the code thoroughly
3. Provide structured feedback with:
   - 🔴 Critical issues (must fix)
   - 🟡 Suggestions (should consider)
   - 🟢 Positive observations (good practices)

Be specific and provide examples for improvements.`;
  }

  /**
   * Build prompt for explain skill
   */
  buildExplainPrompt(target) {
    return `## Code Explanation Skill

Explain the code${target ? ` at: ${target}` : ' in the current context'}.

Provide:
1. **Overview**: What does this code do at a high level?
2. **Step-by-Step**: Walk through the logic
3. **Key Concepts**: Explain any patterns or techniques used
4. **Dependencies**: What does this code depend on?
5. **Usage**: How would someone use this code?

${target ? `Target: ${target}` : 'Explain the most recently discussed code.'}

Use clear, concise language. Include code snippets to illustrate points.`;
  }

  /**
   * Build prompt for refactor skill
   */
  buildRefactorPrompt(target) {
    return `## Refactoring Skill

Suggest refactoring improvements${target ? ` for: ${target}` : ''}.

Consider:
1. **DRY**: Is there code duplication?
2. **Single Responsibility**: Does each function/class do one thing?
3. **Naming**: Are names clear and descriptive?
4. **Complexity**: Can complex logic be simplified?
5. **Testability**: Is the code easy to test?

Steps:
1. ${target ? `Read the file: ${target}` : 'Identify the code to refactor'}
2. Analyze for refactoring opportunities
3. Suggest specific improvements with:
   - Current code snippet
   - Refactored version
   - Explanation of benefits

Prioritize changes by impact and effort.`;
  }

  /**
   * Build prompt for test skill
   */
  buildTestPrompt(target) {
    return `## Test Generation Skill

Generate tests${target ? ` for: ${target}` : ''}.

Steps:
1. ${target ? `Read the file: ${target}` : 'Identify code to test'}
2. Detect the testing framework (Jest, Mocha, pytest, etc.)
3. Generate tests covering:
   - Happy path (normal operation)
   - Edge cases (boundary conditions)
   - Error handling (invalid inputs)
   - Integration points (if applicable)

Output:
- Complete test file with imports
- Descriptive test names
- Clear assertions
- Mocking for external dependencies

Follow the project's existing test patterns if present.`;
  }

  /**
   * Build prompt for docs skill
   */
  buildDocsPrompt(target) {
    return `## Documentation Skill

Generate documentation${target ? ` for: ${target}` : ''}.

Include:
1. **Overview**: Brief description of purpose
2. **API Reference**: Functions, classes, methods with:
   - Parameters and types
   - Return values
   - Examples
3. **Usage Examples**: Show common use cases
4. **Notes**: Important caveats or tips

${target ? `Target: ${target}` : ''}

Output format: JSDoc/docstring style for inline docs, or Markdown for README sections.`;
  }

  /**
   * Build prompt for fix skill
   */
  buildFixPrompt(error) {
    return `## Error Fix Skill

Analyze and fix the error${error ? `: ${error}` : ''}.

Steps:
1. Understand the error message
2. Identify the root cause
3. Search for related code
4. Propose a fix with:
   - Explanation of the problem
   - The fix (code changes)
   - Prevention tips

${error ? `Error: ${error}` : 'Analyze the most recent error in context.'}

Be thorough but concise. Test your fix mentally before proposing.`;
  }

  /**
   * Build prompt for debug skill
   */
  buildDebugPrompt(description) {
    return `## Debug Assistance Skill

Help debug${description ? `: ${description}` : ' the current issue'}.

Debugging approach:
1. **Reproduce**: Understand how to reproduce the issue
2. **Isolate**: Narrow down the problem area
3. **Inspect**: Check variable values, flow, state
4. **Hypothesize**: Form theories about the cause
5. **Test**: Verify theories with targeted checks
6. **Fix**: Apply and validate the fix

${description ? `Description: ${description}` : ''}

Ask clarifying questions if needed. Suggest debugging steps or code.`;
  }

  /**
   * Get list of available skills
   */
  getAvailableSkills() {
    const skills = Array.from(this.builtInSkills.values()).map(s => ({
      name: s.name,
      description: s.description,
      builtin: true
    }));

    return skills;
  }
}

export default SkillTool;
