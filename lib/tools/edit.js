/**
 * Edit Tool
 * Performs exact string replacements in files
 */

import { BaseTool } from './base-tool.js';
import fs from 'fs-extra';
import path from 'path';

export class EditTool extends BaseTool {
  constructor(options = {}) {
    super({
      name: 'Edit',
      description: `Performs exact string replacements in files.
- You must use your Read tool at least once before editing a file
- When editing text, preserve the exact indentation (tabs/spaces) as it appears in the file
- ALWAYS prefer editing existing files over writing new files
- The edit will FAIL if old_string is not unique in the file
- Either provide a larger string with more surrounding context to make it unique, or use replace_all
- Use replace_all for replacing and renaming strings across the file`,
      parameters: {
        type: 'object',
        properties: {
          file_path: {
            type: 'string',
            description: 'The absolute path to the file to modify'
          },
          old_string: {
            type: 'string',
            description: 'The text to replace'
          },
          new_string: {
            type: 'string',
            description: 'The text to replace it with (must be different from old_string)'
          },
          replace_all: {
            type: 'boolean',
            description: 'Replace all occurrences of old_string (default false)',
            default: false
          }
        },
        required: ['file_path', 'old_string', 'new_string']
      },
      requiresPermission: true,
      isReadOnly: false,
      ...options
    });

    this.backupEnabled = options.backupEnabled ?? true;
  }

  async execute(params, context = {}) {
    const { file_path, old_string, new_string, replace_all = false } = params;
    const startTime = Date.now();

    try {
      // Validate parameters
      if (!file_path) {
        return { error: 'file_path is required' };
      }
      if (old_string === undefined || old_string === null) {
        return { error: 'old_string is required' };
      }
      if (new_string === undefined || new_string === null) {
        return { error: 'new_string is required' };
      }
      if (old_string === new_string) {
        return { error: 'old_string and new_string must be different' };
      }

      // Resolve to absolute path
      const absolutePath = path.isAbsolute(file_path)
        ? file_path
        : path.resolve(context.cwd || process.cwd(), file_path);

      // Check if file exists
      if (!await fs.pathExists(absolutePath)) {
        return { error: `File not found: ${absolutePath}` };
      }

      // Read file content
      const originalContent = await fs.readFile(absolutePath, 'utf8');

      // Count occurrences
      const occurrences = this.countOccurrences(originalContent, old_string);

      if (occurrences === 0) {
        return {
          error: `old_string not found in file. Make sure the string matches exactly, including whitespace and indentation.`,
          searchedFor: old_string.substring(0, 100) + (old_string.length > 100 ? '...' : '')
        };
      }

      // Check uniqueness if not replace_all
      if (!replace_all && occurrences > 1) {
        return {
          error: `old_string appears ${occurrences} times in the file. Either provide more context to make it unique, or set replace_all: true`,
          occurrences
        };
      }

      // Create backup
      let backupPath = null;
      if (this.backupEnabled) {
        backupPath = await this.createBackup(absolutePath, fs);
      }

      // Perform replacement
      let newContent;
      let replacementsCount;

      if (replace_all) {
        newContent = originalContent.split(old_string).join(new_string);
        replacementsCount = occurrences;
      } else {
        // Replace only first occurrence
        newContent = originalContent.replace(old_string, new_string);
        replacementsCount = 1;
      }

      // Write file
      await fs.writeFile(absolutePath, newContent, 'utf8');

      // Calculate diff info
      const linesChanged = this.countAffectedLines(originalContent, newContent);

      return {
        success: true,
        filePath: absolutePath,
        replacementsCount,
        linesChanged,
        backupPath,
        originalContent,
        newContent,
        executionTime: Date.now() - startTime
      };
    } catch (error) {
      return {
        error: error.message,
        executionTime: Date.now() - startTime
      };
    }
  }

  /**
   * Count occurrences of a string
   * @param {string} content - Content to search
   * @param {string} search - String to find
   * @returns {number} Number of occurrences
   */
  countOccurrences(content, search) {
    let count = 0;
    let pos = 0;
    while ((pos = content.indexOf(search, pos)) !== -1) {
      count++;
      pos += search.length;
    }
    return count;
  }

  /**
   * Count affected lines between two versions
   * @param {string} original - Original content
   * @param {string} modified - Modified content
   * @returns {Object} Lines statistics
   */
  countAffectedLines(original, modified) {
    const originalLines = original.split('\n');
    const modifiedLines = modified.split('\n');

    let added = 0;
    let removed = 0;
    let modified_count = 0;

    // Simple line-by-line comparison
    const maxLines = Math.max(originalLines.length, modifiedLines.length);

    for (let i = 0; i < maxLines; i++) {
      const origLine = originalLines[i];
      const modLine = modifiedLines[i];

      if (origLine === undefined) {
        added++;
      } else if (modLine === undefined) {
        removed++;
      } else if (origLine !== modLine) {
        modified_count++;
      }
    }

    return { added, removed, modified: modified_count };
  }

  /**
   * Get the action record for undo functionality
   * @param {Object} result - Execution result
   * @returns {Object} Action record
   */
  getActionRecord(result) {
    if (!result.success) return null;

    return {
      type: 'file_edit',
      filepath: result.filePath,
      originalContent: result.originalContent,
      backupPath: result.backupPath,
      action: 'edited',
      replacementsCount: result.replacementsCount,
      timestamp: new Date().toISOString()
    };
  }
}
