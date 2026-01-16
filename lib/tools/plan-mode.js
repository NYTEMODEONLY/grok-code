/**
 * Plan Mode Tools
 * Structured planning workflow for complex implementation tasks
 */

import { BaseTool } from './base-tool.js';
import fs from 'fs-extra';
import path from 'path';

/**
 * Plan Mode Manager - Manages planning state
 */
export class PlanModeManager {
  constructor() {
    this.inPlanMode = false;
    this.currentPlan = null;
    this.planFile = null;
    this.allowedPrompts = [];
    this.planHistory = [];
  }

  /**
   * Enter plan mode
   * @param {Object} options - Options
   * @returns {Object} Result
   */
  enterPlanMode(options = {}) {
    if (this.inPlanMode) {
      return {
        success: false,
        error: 'Already in plan mode. Use ExitPlanMode to exit.'
      };
    }

    this.inPlanMode = true;
    this.planFile = options.planFile || path.join(process.cwd(), '.grok', 'current-plan.md');
    this.currentPlan = {
      title: options.title || 'Implementation Plan',
      created: new Date().toISOString(),
      status: 'drafting',
      sections: [],
      notes: []
    };

    return {
      success: true,
      message: 'Entered plan mode. Explore the codebase and create your implementation plan.',
      planFile: this.planFile
    };
  }

  /**
   * Exit plan mode
   * @param {Object} options - Options including allowedPrompts
   * @returns {Object} Result
   */
  exitPlanMode(options = {}) {
    if (!this.inPlanMode) {
      return {
        success: false,
        error: 'Not in plan mode.'
      };
    }

    // Store allowed prompts for later execution
    this.allowedPrompts = options.allowedPrompts || [];

    // Read the plan from the file
    let planContent = '';
    if (this.planFile && fs.existsSync(this.planFile)) {
      planContent = fs.readFileSync(this.planFile, 'utf8');
    }

    // Archive the plan
    this.planHistory.push({
      ...this.currentPlan,
      content: planContent,
      completed: new Date().toISOString()
    });

    const result = {
      success: true,
      message: 'Plan mode exited. Awaiting user approval.',
      plan: planContent,
      allowedPrompts: this.allowedPrompts,
      planFile: this.planFile
    };

    this.inPlanMode = false;
    this.currentPlan = null;

    return result;
  }

  /**
   * Add content to the current plan
   * @param {string} content - Content to add
   * @param {string} section - Section name
   */
  addToPlan(content, section = 'main') {
    if (!this.inPlanMode) return;

    const existingSection = this.currentPlan.sections.find(s => s.name === section);
    if (existingSection) {
      existingSection.content += '\n' + content;
    } else {
      this.currentPlan.sections.push({
        name: section,
        content
      });
    }
  }

  /**
   * Save the current plan to file
   * @returns {Promise<boolean>} Success
   */
  async savePlan() {
    if (!this.inPlanMode || !this.planFile) {
      return false;
    }

    try {
      await fs.ensureDir(path.dirname(this.planFile));

      let content = `# ${this.currentPlan.title}\n\n`;
      content += `Created: ${this.currentPlan.created}\n`;
      content += `Status: ${this.currentPlan.status}\n\n`;

      for (const section of this.currentPlan.sections) {
        content += `## ${section.name}\n\n${section.content}\n\n`;
      }

      if (this.currentPlan.notes.length > 0) {
        content += `## Notes\n\n`;
        for (const note of this.currentPlan.notes) {
          content += `- ${note}\n`;
        }
      }

      await fs.writeFile(this.planFile, content);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get plan mode status
   * @returns {Object} Status
   */
  getStatus() {
    return {
      inPlanMode: this.inPlanMode,
      planFile: this.planFile,
      currentPlan: this.currentPlan,
      allowedPrompts: this.allowedPrompts,
      historyCount: this.planHistory.length
    };
  }

  /**
   * Check if a command is allowed by the plan
   * @param {string} tool - Tool name
   * @param {string} prompt - Command/prompt description
   * @returns {boolean} Whether allowed
   */
  isAllowed(tool, prompt) {
    if (this.allowedPrompts.length === 0) {
      return false;
    }

    return this.allowedPrompts.some(p => {
      if (p.tool !== tool) return false;

      // Simple fuzzy matching on prompt
      const promptLower = prompt.toLowerCase();
      const patternLower = p.prompt.toLowerCase();

      // Check for key words
      const words = patternLower.split(/\s+/);
      return words.every(word => promptLower.includes(word));
    });
  }
}

// Singleton instance
let planModeManager = null;

export function getPlanModeManager() {
  if (!planModeManager) {
    planModeManager = new PlanModeManager();
  }
  return planModeManager;
}

/**
 * EnterPlanMode Tool - Start a planning session
 */
export class EnterPlanModeTool extends BaseTool {
  constructor(options = {}) {
    super({
      name: 'EnterPlanMode',
      description: `Use this tool when you're about to start a non-trivial implementation task. Getting user sign-off on your approach before writing code prevents wasted effort.

Use EnterPlanMode when:
1. New Feature Implementation
2. Multiple Valid Approaches exist
3. Code Modifications affect existing behavior
4. Architectural Decisions are needed
5. Multi-File Changes (>2-3 files)
6. Unclear Requirements need exploration

Skip EnterPlanMode for:
- Single-line or few-line fixes
- Adding a single function with clear requirements
- Tasks with very specific, detailed instructions
- Pure research/exploration tasks`,
      parameters: {
        type: 'object',
        properties: {},
        required: []
      },
      requiresPermission: true,
      isReadOnly: false,
      timeout: 5000,
      ...options
    });
  }

  async execute(params, context = {}) {
    const manager = getPlanModeManager();

    const result = manager.enterPlanMode({
      planFile: context.planFile
    });

    if (!result.success) {
      return {
        success: false,
        error: result.error
      };
    }

    return {
      success: true,
      output: `Entered plan mode.

You are now in planning mode. In this mode:
1. Use Glob, Grep, and Read tools to explore the codebase
2. Understand existing patterns and architecture
3. Design your implementation approach
4. Write your plan to: ${result.planFile}
5. Use ExitPlanMode when ready to present the plan for approval

Your plan should include:
- Summary of the task
- Files that will be modified
- Implementation steps
- Any architectural decisions
- Test plan`,
      planFile: result.planFile
    };
  }
}

/**
 * ExitPlanMode Tool - Complete planning and request approval
 */
export class ExitPlanModeTool extends BaseTool {
  constructor(options = {}) {
    super({
      name: 'ExitPlanMode',
      description: `Use this tool when you have finished writing your plan and are ready for user approval.

The plan should already be written to the plan file. This tool signals you're done planning and ready for review.

You can request prompt-based permissions for commands your plan will need.`,
      parameters: {
        type: 'object',
        properties: {
          allowedPrompts: {
            type: 'array',
            description: 'Prompt-based permissions needed to implement the plan',
            items: {
              type: 'object',
              properties: {
                tool: {
                  type: 'string',
                  enum: ['Bash'],
                  description: 'The tool this prompt applies to'
                },
                prompt: {
                  type: 'string',
                  description: 'Semantic description of the action, e.g., "run tests", "install dependencies"'
                }
              },
              required: ['tool', 'prompt']
            }
          }
        },
        required: []
      },
      requiresPermission: false,
      isReadOnly: true,
      timeout: 5000,
      ...options
    });
  }

  async execute(params, context = {}) {
    const { allowedPrompts = [] } = params;
    const manager = getPlanModeManager();

    const result = manager.exitPlanMode({ allowedPrompts });

    if (!result.success) {
      return {
        success: false,
        error: result.error
      };
    }

    let output = `Plan mode exited. Your plan is ready for review.

Plan file: ${result.planFile}

`;

    if (result.plan) {
      output += `## Plan Summary\n\n${result.plan.substring(0, 2000)}`;
      if (result.plan.length > 2000) {
        output += '\n\n... (plan truncated for display)';
      }
    }

    if (allowedPrompts.length > 0) {
      output += `\n\n## Requested Permissions\n\n`;
      for (const p of allowedPrompts) {
        output += `- ${p.tool}: ${p.prompt}\n`;
      }
    }

    output += `\n\nAwaiting user approval to proceed with implementation.`;

    return {
      success: true,
      output,
      plan: result.plan,
      planFile: result.planFile,
      allowedPrompts: result.allowedPrompts
    };
  }
}

export default { PlanModeManager, getPlanModeManager, EnterPlanModeTool, ExitPlanModeTool };
