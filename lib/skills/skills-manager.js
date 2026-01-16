/**
 * Skills Manager
 * Handles loading and execution of built-in and custom skills
 */

import fs from 'fs-extra';
import path from 'path';
import { EventEmitter } from 'events';

export class SkillsManager extends EventEmitter {
  constructor(options = {}) {
    super();

    this.skillsDir = options.skillsDir || path.join(process.cwd(), '.grok', 'skills');
    this.userSkillsDir = options.userSkillsDir || path.join(process.env.HOME, '.grok', 'skills');

    // Built-in skills registry
    this.builtInSkills = new Map();

    // Custom skills cache
    this.customSkills = new Map();

    // Skill execution history
    this.history = [];
    this.maxHistory = options.maxHistory || 50;
  }

  /**
   * Initialize the skills manager
   */
  async initialize() {
    await fs.ensureDir(this.skillsDir);
    await this.loadCustomSkills();
    this.emit('initialized');
  }

  /**
   * Register a built-in skill
   * @param {string} name - Skill name
   * @param {Object} skill - Skill definition
   */
  registerBuiltIn(name, skill) {
    this.builtInSkills.set(name, {
      name,
      type: 'builtin',
      description: skill.description,
      usage: skill.usage,
      arguments: skill.arguments || [],
      handler: skill.handler
    });
  }

  /**
   * Load custom skills from .grok/skills/
   */
  async loadCustomSkills() {
    this.customSkills.clear();

    // Load from project skills directory
    await this.loadSkillsFromDir(this.skillsDir);

    // Load from user skills directory
    if (this.userSkillsDir !== this.skillsDir) {
      await this.loadSkillsFromDir(this.userSkillsDir);
    }
  }

  /**
   * Load skills from a directory
   * @param {string} dir - Directory path
   */
  async loadSkillsFromDir(dir) {
    if (!await fs.pathExists(dir)) {
      return;
    }

    const files = await fs.readdir(dir);

    for (const file of files) {
      if (!file.endsWith('.md')) {
        continue;
      }

      const name = file.replace('.md', '');
      const filePath = path.join(dir, file);

      try {
        const content = await fs.readFile(filePath, 'utf8');
        const skill = this.parseSkillFile(name, content, filePath);

        if (skill) {
          this.customSkills.set(name, skill);
        }
      } catch (error) {
        this.emit('error', { skill: name, error });
      }
    }
  }

  /**
   * Parse a skill markdown file
   * @param {string} name - Skill name
   * @param {string} content - File content
   * @param {string} filePath - File path
   * @returns {Object} Parsed skill definition
   */
  parseSkillFile(name, content, filePath) {
    // Extract YAML frontmatter
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    let metadata = {};
    let body = content;

    if (frontmatterMatch) {
      body = content.slice(frontmatterMatch[0].length).trim();

      // Simple YAML parsing
      const yaml = frontmatterMatch[1];
      const lines = yaml.split('\n');

      for (const line of lines) {
        const colonIndex = line.indexOf(':');
        if (colonIndex > 0) {
          const key = line.slice(0, colonIndex).trim();
          let value = line.slice(colonIndex + 1).trim();

          // Handle arrays (simple format: key: [a, b, c])
          if (value.startsWith('[') && value.endsWith(']')) {
            value = value.slice(1, -1).split(',').map(v => v.trim());
          }
          // Handle quoted strings
          else if ((value.startsWith('"') && value.endsWith('"')) ||
                   (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
          }

          metadata[key] = value;
        }
      }
    }

    return {
      name: metadata.name || name,
      type: 'custom',
      description: metadata.description || `Custom skill: ${name}`,
      usage: metadata.usage || `/${name} [args]`,
      arguments: metadata.arguments || [],
      filePath,
      prompt: body,
      metadata
    };
  }

  /**
   * Get a skill by name
   * @param {string} name - Skill name
   * @returns {Object|null} Skill definition
   */
  get(name) {
    // Check built-in first
    if (this.builtInSkills.has(name)) {
      return this.builtInSkills.get(name);
    }

    // Then check custom
    if (this.customSkills.has(name)) {
      return this.customSkills.get(name);
    }

    return null;
  }

  /**
   * List all available skills
   * @returns {Array} List of skill names and info
   */
  list() {
    const skills = [];

    // Add built-in skills
    for (const [name, skill] of this.builtInSkills) {
      skills.push({
        name,
        type: 'builtin',
        description: skill.description
      });
    }

    // Add custom skills
    for (const [name, skill] of this.customSkills) {
      skills.push({
        name,
        type: 'custom',
        description: skill.description
      });
    }

    return skills;
  }

  /**
   * Check if a skill exists
   * @param {string} name - Skill name
   * @returns {boolean}
   */
  has(name) {
    return this.builtInSkills.has(name) || this.customSkills.has(name);
  }

  /**
   * Execute a skill
   * @param {string} name - Skill name
   * @param {Object} context - Execution context
   * @returns {Promise<Object>} Execution result
   */
  async execute(name, context = {}) {
    const skill = this.get(name);

    if (!skill) {
      throw new Error(`Skill not found: ${name}`);
    }

    const startTime = Date.now();
    this.emit('executing', { name, context });

    try {
      let result;

      if (skill.type === 'builtin' && skill.handler) {
        // Execute built-in skill handler
        result = await skill.handler(context);
      } else {
        // Return the prompt for custom skills (to be executed by the main loop)
        result = {
          type: 'prompt',
          prompt: skill.prompt,
          skill: skill
        };
      }

      const duration = Date.now() - startTime;

      // Record in history
      this.recordHistory(name, context, result, duration);

      this.emit('executed', { name, result, duration });
      return result;

    } catch (error) {
      this.emit('error', { name, error });
      throw error;
    }
  }

  /**
   * Record skill execution in history
   */
  recordHistory(name, context, result, duration) {
    this.history.unshift({
      skill: name,
      timestamp: new Date().toISOString(),
      duration,
      success: true,
      context: { args: context.args }
    });

    // Trim history
    if (this.history.length > this.maxHistory) {
      this.history = this.history.slice(0, this.maxHistory);
    }
  }

  /**
   * Get skill execution history
   * @param {number} limit - Max entries to return
   * @returns {Array}
   */
  getHistory(limit = 10) {
    return this.history.slice(0, limit);
  }

  /**
   * Create a new custom skill
   * @param {string} name - Skill name
   * @param {Object} definition - Skill definition
   * @returns {Promise<string>} Path to created skill file
   */
  async create(name, definition = {}) {
    const filePath = path.join(this.skillsDir, `${name}.md`);

    if (await fs.pathExists(filePath)) {
      throw new Error(`Skill already exists: ${name}`);
    }

    const content = `---
name: ${name}
description: ${definition.description || 'Custom skill description'}
usage: /${name} ${definition.usage || '[args]'}
arguments:
  - name: input
    description: Input for the skill
    required: false
---

# ${name} Skill

${definition.instructions || 'Add your skill instructions here.'}

## When Invoked

${definition.prompt || `When the user runs /${name}, you should:

1. [Describe first step]
2. [Describe second step]
3. [Describe third step]`}

## Example Usage

\`\`\`
/${name} [example arguments]
\`\`\`
`;

    await fs.ensureDir(this.skillsDir);
    await fs.writeFile(filePath, content);

    // Reload custom skills
    await this.loadCustomSkills();

    return filePath;
  }

  /**
   * Delete a custom skill
   * @param {string} name - Skill name
   * @returns {Promise<boolean>}
   */
  async delete(name) {
    // Can't delete built-in skills
    if (this.builtInSkills.has(name)) {
      throw new Error(`Cannot delete built-in skill: ${name}`);
    }

    const skill = this.customSkills.get(name);
    if (!skill) {
      return false;
    }

    await fs.remove(skill.filePath);
    this.customSkills.delete(name);

    return true;
  }

  /**
   * Get statistics
   * @returns {Object}
   */
  getStats() {
    return {
      builtInCount: this.builtInSkills.size,
      customCount: this.customSkills.size,
      totalExecutions: this.history.length,
      recentSkills: [...new Set(this.history.slice(0, 10).map(h => h.skill))]
    };
  }
}
