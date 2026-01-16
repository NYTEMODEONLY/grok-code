/**
 * Glob Tool
 * Fast file pattern matching
 */

import { BaseTool } from './base-tool.js';
import fs from 'fs-extra';
import path from 'path';

export class GlobTool extends BaseTool {
  constructor(options = {}) {
    super({
      name: 'Glob',
      description: `Fast file pattern matching tool that works with any codebase size.
- Supports glob patterns like "**/*.js" or "src/**/*.ts"
- Returns matching file paths sorted by modification time
- Use this tool when you need to find files by name patterns
- DO NOT enter "undefined" or "null" for path - simply omit it for the default directory`,
      parameters: {
        type: 'object',
        properties: {
          pattern: {
            type: 'string',
            description: 'The glob pattern to match files against (e.g., "**/*.js", "src/**/*.ts")'
          },
          path: {
            type: 'string',
            description: 'The directory to search in (optional, defaults to current directory)'
          }
        },
        required: ['pattern']
      },
      requiresPermission: false,
      isReadOnly: true,
      ...options
    });

    this.maxResults = options.maxResults || 1000;
    this.excludePatterns = options.excludePatterns || [
      'node_modules',
      '.git',
      'dist',
      'build',
      '.next',
      'coverage',
      '__pycache__',
      '.cache',
      'vendor'
    ];
  }

  async execute(params, context = {}) {
    const { pattern, path: searchPath } = params;
    const startTime = Date.now();

    try {
      // Validate pattern
      if (!pattern) {
        return { error: 'pattern is required' };
      }

      // Determine search directory
      const basePath = searchPath && searchPath !== 'undefined' && searchPath !== 'null'
        ? path.resolve(context.cwd || process.cwd(), searchPath)
        : context.cwd || process.cwd();

      // Check if path exists
      if (!await fs.pathExists(basePath)) {
        return { error: `Path not found: ${basePath}` };
      }

      // Parse glob pattern
      const { directory, filePattern, recursive } = this.parseGlobPattern(pattern);

      // Adjust search path if pattern includes directory
      const effectivePath = directory
        ? path.join(basePath, directory)
        : basePath;

      if (!await fs.pathExists(effectivePath)) {
        return {
          output: 'No files found',
          filesFound: 0,
          executionTime: Date.now() - startTime
        };
      }

      // Find matching files
      const files = await this.findMatchingFiles(effectivePath, filePattern, recursive);

      // Sort by modification time (most recent first)
      const sortedFiles = await this.sortByModTime(files);

      // Format output
      const relativePaths = sortedFiles.map(f => path.relative(basePath, f));

      if (relativePaths.length === 0) {
        return {
          output: 'No files found',
          filesFound: 0,
          executionTime: Date.now() - startTime
        };
      }

      return {
        output: relativePaths.join('\n'),
        filesFound: relativePaths.length,
        truncated: sortedFiles.length >= this.maxResults,
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
   * Parse a glob pattern into components
   * @param {string} pattern - Glob pattern
   * @returns {Object} Parsed components
   */
  parseGlobPattern(pattern) {
    let directory = '';
    let filePattern = pattern;
    let recursive = false;

    // Handle ** at the start
    if (pattern.startsWith('**/')) {
      recursive = true;
      filePattern = pattern.slice(3);
    }

    // Handle directory prefix
    const lastSlash = filePattern.lastIndexOf('/');
    if (lastSlash !== -1) {
      const dirPart = filePattern.substring(0, lastSlash);

      if (dirPart.includes('**')) {
        // **/ somewhere in the middle
        recursive = true;
        const parts = dirPart.split('**/');
        directory = parts[0].replace(/\/$/, '');
        filePattern = filePattern.substring(dirPart.indexOf('**') + 3);
      } else {
        directory = dirPart;
        filePattern = filePattern.substring(lastSlash + 1);
      }
    }

    return { directory, filePattern, recursive };
  }

  /**
   * Find files matching a pattern
   * @param {string} basePath - Base directory
   * @param {string} pattern - File pattern
   * @param {boolean} recursive - Search recursively
   * @returns {Promise<string[]>} Matching file paths
   */
  async findMatchingFiles(basePath, pattern, recursive) {
    const files = [];
    const regex = this.patternToRegex(pattern);

    await this.walkDirectory(basePath, files, regex, recursive);

    return files.slice(0, this.maxResults);
  }

  /**
   * Convert glob pattern to regex
   * @param {string} pattern - Glob pattern
   * @returns {RegExp} Regex
   */
  patternToRegex(pattern) {
    // Handle common glob patterns
    let regexStr = pattern
      // Escape special regex chars (except * and ?)
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      // Handle ** (match any path)
      .replace(/\*\*/g, '.*')
      // Handle * (match anything except /)
      .replace(/\*/g, '[^/]*')
      // Handle ? (match single char)
      .replace(/\?/g, '.')
      // Handle {a,b,c} alternatives
      .replace(/\{([^}]+)\}/g, (_, alts) => `(${alts.split(',').map(a => a.trim()).join('|')})`);

    return new RegExp(`^${regexStr}$`, 'i');
  }

  /**
   * Walk directory and collect matching files
   * @param {string} dir - Directory to walk
   * @param {string[]} files - Array to collect files
   * @param {RegExp} regex - Pattern to match
   * @param {boolean} recursive - Search recursively
   * @param {number} depth - Current depth
   */
  async walkDirectory(dir, files, regex, recursive, depth = 0) {
    if (depth > 20) return; // Max depth protection
    if (files.length >= this.maxResults) return;

    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        if (files.length >= this.maxResults) return;

        const fullPath = path.join(dir, entry.name);

        // Skip excluded patterns
        if (this.shouldExclude(entry.name)) {
          continue;
        }

        if (entry.isDirectory()) {
          if (recursive) {
            await this.walkDirectory(fullPath, files, regex, recursive, depth + 1);
          }
        } else if (entry.isFile()) {
          if (regex.test(entry.name)) {
            files.push(fullPath);
          }
        }
      }
    } catch (e) {
      // Skip directories we can't read
    }
  }

  /**
   * Check if a name should be excluded
   * @param {string} name - File or directory name
   * @returns {boolean} Should exclude
   */
  shouldExclude(name) {
    return this.excludePatterns.some(pattern => {
      if (pattern.startsWith('*')) {
        return name.endsWith(pattern.slice(1));
      }
      return name === pattern;
    });
  }

  /**
   * Sort files by modification time
   * @param {string[]} files - File paths
   * @returns {Promise<string[]>} Sorted files
   */
  async sortByModTime(files) {
    const withStats = await Promise.all(
      files.map(async (file) => {
        try {
          const stat = await fs.stat(file);
          return { file, mtime: stat.mtimeMs };
        } catch {
          return { file, mtime: 0 };
        }
      })
    );

    return withStats
      .sort((a, b) => b.mtime - a.mtime)
      .map(f => f.file);
  }
}
