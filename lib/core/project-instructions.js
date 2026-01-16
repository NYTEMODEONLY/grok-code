/**
 * Project Instructions Loader
 * Loads and processes GROK.md project instruction files
 * Compatible with Claude Code's CLAUDE.md pattern
 */

import fs from 'fs-extra';
import path from 'path';

export class ProjectInstructionsLoader {
  constructor(options = {}) {
    this.projectRoot = options.projectRoot || process.cwd();
    this.globalDir = options.globalDir || path.join(process.env.HOME || '', '.grok');

    // Supported instruction file names (in priority order)
    this.instructionFiles = [
      'GROK.md',      // Primary
      'grok.md',      // Lowercase variant
      '.grok.md',     // Hidden variant
      'CLAUDE.md',    // Claude Code compatibility
      '.claude.md'    // Hidden Claude variant
    ];

    // Cached instructions
    this._projectInstructions = null;
    this._globalInstructions = null;
    this._lastLoadTime = null;
  }

  /**
   * Load all project instructions
   * @param {boolean} forceReload - Force reload from disk
   * @returns {Promise<Object>} Combined instructions
   */
  async load(forceReload = false) {
    const now = Date.now();

    // Cache for 5 seconds to avoid excessive disk reads
    if (!forceReload && this._lastLoadTime && (now - this._lastLoadTime) < 5000) {
      return this.getCombined();
    }

    // Load global instructions (~/.grok/GROK.md)
    this._globalInstructions = await this.loadFromDir(this.globalDir);

    // Load project instructions (./GROK.md or ./.grok/GROK.md)
    this._projectInstructions = await this.loadFromDir(this.projectRoot);

    // Also check .grok/ subdirectory
    const grokDir = path.join(this.projectRoot, '.grok');
    if (await fs.pathExists(grokDir)) {
      const grokDirInstructions = await this.loadFromDir(grokDir);
      if (grokDirInstructions && !this._projectInstructions) {
        this._projectInstructions = grokDirInstructions;
      }
    }

    this._lastLoadTime = now;
    return this.getCombined();
  }

  /**
   * Load instructions from a directory
   * @param {string} dir - Directory to search
   * @returns {Promise<Object|null>} Instructions object or null
   */
  async loadFromDir(dir) {
    for (const filename of this.instructionFiles) {
      const filePath = path.join(dir, filename);

      if (await fs.pathExists(filePath)) {
        try {
          const content = await fs.readFile(filePath, 'utf8');
          return this.parseInstructions(content, filePath);
        } catch (error) {
          console.error(`Error loading ${filePath}: ${error.message}`);
        }
      }
    }

    return null;
  }

  /**
   * Parse instruction file content
   * @param {string} content - File content
   * @param {string} filePath - Source file path
   * @returns {Object} Parsed instructions
   */
  parseInstructions(content, filePath) {
    const instructions = {
      source: filePath,
      raw: content,
      sections: {},
      rules: [],
      context: [],
      preferences: {}
    };

    // Parse markdown sections
    const lines = content.split('\n');
    let currentSection = 'general';
    let currentContent = [];

    for (const line of lines) {
      // Check for headers
      const headerMatch = line.match(/^(#{1,3})\s+(.+)/);

      if (headerMatch) {
        // Save previous section
        if (currentContent.length > 0) {
          instructions.sections[currentSection] = currentContent.join('\n').trim();
        }

        currentSection = this.normalizeSection(headerMatch[2]);
        currentContent = [];
      } else {
        currentContent.push(line);
      }
    }

    // Save last section
    if (currentContent.length > 0) {
      instructions.sections[currentSection] = currentContent.join('\n').trim();
    }

    // Extract rules (lines starting with - or *)
    const ruleLines = content.match(/^[\s]*[-*]\s+.+$/gm) || [];
    instructions.rules = ruleLines.map(rule => rule.replace(/^[\s]*[-*]\s+/, '').trim());

    // Extract code blocks as context
    const codeBlocks = content.match(/```[\s\S]*?```/g) || [];
    instructions.context = codeBlocks.map(block => {
      const match = block.match(/```(\w+)?\n([\s\S]*?)```/);
      return {
        language: match?.[1] || 'text',
        code: match?.[2]?.trim() || ''
      };
    });

    // Parse key-value preferences from specific patterns
    const prefPatterns = [
      /(?:prefer|use|always|default):\s*([^\n]+)/gi,
      /(?:avoid|never|don't):\s*([^\n]+)/gi
    ];

    for (const pattern of prefPatterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const key = match[0].split(':')[0].toLowerCase().trim();
        const value = match[1].trim();
        if (!instructions.preferences[key]) {
          instructions.preferences[key] = [];
        }
        instructions.preferences[key].push(value);
      }
    }

    return instructions;
  }

  /**
   * Normalize section name
   * @param {string} section - Section header text
   * @returns {string} Normalized section name
   */
  normalizeSection(section) {
    return section
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, '_')
      .trim();
  }

  /**
   * Get combined instructions
   * @returns {Object} Combined global and project instructions
   */
  getCombined() {
    const combined = {
      hasInstructions: !!(this._globalInstructions || this._projectInstructions),
      global: this._globalInstructions,
      project: this._projectInstructions,
      systemPrompt: this.generateSystemPrompt(),
      rules: this.getAllRules(),
      preferences: this.getAllPreferences()
    };

    return combined;
  }

  /**
   * Get all rules from both global and project
   * @returns {Array} Combined rules
   */
  getAllRules() {
    const rules = [];

    if (this._globalInstructions?.rules) {
      rules.push(...this._globalInstructions.rules);
    }

    if (this._projectInstructions?.rules) {
      rules.push(...this._projectInstructions.rules);
    }

    return [...new Set(rules)]; // Deduplicate
  }

  /**
   * Get all preferences
   * @returns {Object} Combined preferences
   */
  getAllPreferences() {
    const prefs = {};

    if (this._globalInstructions?.preferences) {
      Object.assign(prefs, this._globalInstructions.preferences);
    }

    if (this._projectInstructions?.preferences) {
      // Project preferences override global
      for (const [key, values] of Object.entries(this._projectInstructions.preferences)) {
        prefs[key] = values;
      }
    }

    return prefs;
  }

  /**
   * Generate system prompt addition from instructions
   * @returns {string} System prompt content
   */
  generateSystemPrompt() {
    const parts = [];

    if (this._globalInstructions?.raw) {
      parts.push('# Global User Instructions\n\n' + this._globalInstructions.raw);
    }

    if (this._projectInstructions?.raw) {
      parts.push('# Project-Specific Instructions\n\n' + this._projectInstructions.raw);
    }

    if (parts.length === 0) {
      return '';
    }

    return `
The user has provided the following instructions for how you should behave in this project:

${parts.join('\n\n---\n\n')}

Please follow these instructions carefully while helping with their requests.
`;
  }

  /**
   * Check if instructions exist
   * @returns {boolean}
   */
  hasInstructions() {
    return !!(this._globalInstructions || this._projectInstructions);
  }

  /**
   * Get a specific section
   * @param {string} sectionName - Section name
   * @returns {string|null}
   */
  getSection(sectionName) {
    const normalized = this.normalizeSection(sectionName);

    // Check project first, then global
    if (this._projectInstructions?.sections?.[normalized]) {
      return this._projectInstructions.sections[normalized];
    }

    if (this._globalInstructions?.sections?.[normalized]) {
      return this._globalInstructions.sections[normalized];
    }

    return null;
  }

  /**
   * Create a template GROK.md file
   * @param {string} dir - Directory to create in
   * @returns {Promise<string>} Path to created file
   */
  async createTemplate(dir = this.projectRoot) {
    const template = `# Project Instructions for Grok Code

This file contains instructions for how Grok Code should behave in this project.
It works similarly to Claude Code's CLAUDE.md file.

## Project Overview

Describe your project here. What does it do? What technologies does it use?

## Coding Conventions

- Use consistent indentation (2 spaces / 4 spaces / tabs)
- Follow [style guide name] conventions
- Prefer [pattern] over [alternative]

## Architecture

Describe your project's architecture and key components.

## Testing

- Test framework: [jest/vitest/mocha/pytest/etc.]
- Run tests with: \`npm test\`
- Minimum coverage: [X]%

## Git Workflow

- Branch naming: [feature/bugfix/hotfix]/[description]
- Commit message format: [conventional commits / etc.]
- PR requirements: [reviews, tests passing, etc.]

## Security

- Never commit secrets or credentials
- Use environment variables for sensitive config
- [Other security requirements]

## Common Tasks

### Adding a new feature
1. Create feature branch
2. Implement feature
3. Add tests
4. Create PR

### Fixing a bug
1. Reproduce the bug
2. Create a test that fails
3. Fix the bug
4. Verify test passes

## Preferences

- Prefer: TypeScript over JavaScript
- Prefer: async/await over callbacks
- Avoid: any type in TypeScript
- Always: handle errors properly

## Notes

Add any other project-specific notes here.
`;

    const filePath = path.join(dir, 'GROK.md');
    await fs.writeFile(filePath, template);
    return filePath;
  }
}

// Export singleton factory
let _loader = null;

export function getProjectInstructionsLoader(options = {}) {
  if (!_loader) {
    _loader = new ProjectInstructionsLoader(options);
  }
  return _loader;
}

export function resetProjectInstructionsLoader() {
  _loader = null;
}
