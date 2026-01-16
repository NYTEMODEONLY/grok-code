/**
 * Write Tool
 * Writes files to the filesystem
 */

import { BaseTool } from './base-tool.js';
import fs from 'fs-extra';
import path from 'path';

export class WriteTool extends BaseTool {
  constructor(options = {}) {
    super({
      name: 'Write',
      description: `Writes a file to the local filesystem.
- This tool will overwrite the existing file if there is one at the provided path
- If this is an existing file, you MUST use the Read tool first to read the file's contents
- ALWAYS prefer editing existing files in the codebase using the Edit tool
- NEVER create new files unless explicitly required
- NEVER proactively create documentation files (*.md) or README files`,
      parameters: {
        type: 'object',
        properties: {
          file_path: {
            type: 'string',
            description: 'The absolute path to the file to write (must be absolute, not relative)'
          },
          content: {
            type: 'string',
            description: 'The content to write to the file'
          }
        },
        required: ['file_path', 'content']
      },
      requiresPermission: true,
      isReadOnly: false,
      ...options
    });

    this.backupEnabled = options.backupEnabled ?? true;
    this.backupDir = options.backupDir || '.grok/backups';
  }

  async execute(params, context = {}) {
    const { file_path, content } = params;
    const startTime = Date.now();

    try {
      // Validate parameters
      if (!file_path) {
        return { error: 'file_path is required' };
      }
      if (content === undefined || content === null) {
        return { error: 'content is required' };
      }

      // Resolve to absolute path
      const absolutePath = path.isAbsolute(file_path)
        ? file_path
        : path.resolve(context.cwd || process.cwd(), file_path);

      // Check if file exists (for backup)
      const fileExists = await fs.pathExists(absolutePath);
      let backupPath = null;
      let originalContent = null;

      if (fileExists) {
        // Read original content for undo functionality
        try {
          originalContent = await fs.readFile(absolutePath, 'utf8');
        } catch (e) {
          // File might be binary, skip
        }

        // Create backup if enabled
        if (this.backupEnabled) {
          backupPath = await this.createBackup(absolutePath, fs);
        }
      }

      // Ensure directory exists
      await fs.ensureDir(path.dirname(absolutePath));

      // Write the file
      await fs.writeFile(absolutePath, content, 'utf8');

      // Get file stats
      const stat = await fs.stat(absolutePath);

      return {
        success: true,
        filePath: absolutePath,
        bytesWritten: content.length,
        fileSize: stat.size,
        fileExists: fileExists,
        backupPath,
        originalContent: fileExists ? originalContent : null,
        action: fileExists ? 'updated' : 'created',
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
      action: result.action,
      timestamp: new Date().toISOString()
    };
  }
}
