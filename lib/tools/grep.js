/**
 * Grep Tool
 * Content search using ripgrep-like functionality
 */

import { BaseTool } from './base-tool.js';
import fs from 'fs-extra';
import path from 'path';

export class GrepTool extends BaseTool {
  constructor(options = {}) {
    super({
      name: 'Grep',
      description: `A powerful search tool for content search across files.
- ALWAYS use Grep for search tasks. NEVER invoke grep or rg as a Bash command
- Supports full regex syntax (e.g., "log.*Error", "function\\s+\\w+")
- Filter files with glob parameter (e.g., "*.js", "**/*.tsx")
- Output modes: "content" shows matching lines, "files_with_matches" shows only file paths (default)
- Pattern syntax: Uses regex, literal braces need escaping
- For multiline patterns, use multiline: true`,
      parameters: {
        type: 'object',
        properties: {
          pattern: {
            type: 'string',
            description: 'The regular expression pattern to search for'
          },
          path: {
            type: 'string',
            description: 'File or directory to search in (defaults to current directory)'
          },
          glob: {
            type: 'string',
            description: 'Glob pattern to filter files (e.g., "*.js", "*.{ts,tsx}")'
          },
          output_mode: {
            type: 'string',
            enum: ['content', 'files_with_matches', 'count'],
            description: 'Output mode: content shows lines, files_with_matches shows paths, count shows counts'
          },
          '-i': {
            type: 'boolean',
            description: 'Case insensitive search'
          },
          '-n': {
            type: 'boolean',
            description: 'Show line numbers',
            default: true
          },
          '-A': {
            type: 'number',
            description: 'Number of lines to show after each match'
          },
          '-B': {
            type: 'number',
            description: 'Number of lines to show before each match'
          },
          '-C': {
            type: 'number',
            description: 'Number of lines to show before and after each match'
          },
          head_limit: {
            type: 'number',
            description: 'Limit output to first N results'
          },
          multiline: {
            type: 'boolean',
            description: 'Enable multiline mode where patterns can span lines'
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
      '*.min.js',
      '*.map'
    ];
  }

  async execute(params, context = {}) {
    const {
      pattern,
      path: searchPath,
      glob,
      output_mode = 'files_with_matches',
      '-i': ignoreCase = false,
      '-n': showLineNumbers = true,
      '-A': afterContext = 0,
      '-B': beforeContext = 0,
      '-C': aroundContext = 0,
      head_limit = 0,
      multiline = false
    } = params;
    const startTime = Date.now();

    try {
      // Validate pattern
      if (!pattern) {
        return { error: 'pattern is required' };
      }

      // Test regex validity
      try {
        new RegExp(pattern, ignoreCase ? 'i' : '');
      } catch (e) {
        return { error: `Invalid regex pattern: ${e.message}` };
      }

      // Determine search directory
      const basePath = searchPath
        ? path.resolve(context.cwd || process.cwd(), searchPath)
        : context.cwd || process.cwd();

      // Check if path exists
      if (!await fs.pathExists(basePath)) {
        return { error: `Path not found: ${basePath}` };
      }

      // Get files to search
      const files = await this.getFilesToSearch(basePath, glob);

      if (files.length === 0) {
        return {
          output: 'No files found matching criteria',
          filesSearched: 0,
          matches: 0,
          executionTime: Date.now() - startTime
        };
      }

      // Search files
      const regex = new RegExp(pattern, ignoreCase ? 'gi' : 'g');
      const contextLines = aroundContext || Math.max(beforeContext, afterContext);
      const results = [];
      let totalMatches = 0;

      for (const file of files) {
        try {
          const content = await fs.readFile(file, 'utf8');
          const fileMatches = this.searchInFile(
            file,
            content,
            regex,
            {
              outputMode: output_mode,
              showLineNumbers,
              contextLines,
              beforeContext: aroundContext || beforeContext,
              afterContext: aroundContext || afterContext,
              multiline
            }
          );

          if (fileMatches.length > 0) {
            totalMatches += fileMatches.length;
            results.push({
              file: path.relative(basePath, file),
              matches: fileMatches
            });
          }

          // Check limit
          if (head_limit > 0 && results.length >= head_limit) {
            break;
          }
        } catch (e) {
          // Skip files that can't be read (binary, permission issues, etc.)
          continue;
        }
      }

      // Format output based on mode
      const output = this.formatOutput(results, output_mode, basePath);

      return {
        output: head_limit > 0 ? output.slice(0, head_limit * 1000) : output,
        filesSearched: files.length,
        filesMatched: results.length,
        totalMatches,
        executionTime: Date.now() - startTime
      };
    } catch (error) {
      return {
        error: error.message,
        executionTime: Date.now() - startTime
      };
    }
  }

  async getFilesToSearch(basePath, globPattern) {
    const stat = await fs.stat(basePath);

    if (stat.isFile()) {
      return [basePath];
    }

    const files = [];
    await this.walkDirectory(basePath, files, globPattern);
    return files;
  }

  async walkDirectory(dir, files, globPattern, depth = 0) {
    if (depth > 20) return; // Max depth protection

    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      // Skip excluded patterns
      if (this.shouldExclude(entry.name, fullPath)) {
        continue;
      }

      if (entry.isDirectory()) {
        await this.walkDirectory(fullPath, files, globPattern, depth + 1);
      } else if (entry.isFile()) {
        // Check glob pattern if provided
        if (globPattern && !this.matchGlob(entry.name, fullPath, globPattern)) {
          continue;
        }

        // Skip binary files
        if (this.isBinaryFile(entry.name)) {
          continue;
        }

        files.push(fullPath);

        // Limit total files
        if (files.length >= this.maxResults * 10) {
          return;
        }
      }
    }
  }

  shouldExclude(name, fullPath) {
    for (const pattern of this.excludePatterns) {
      if (pattern.startsWith('*')) {
        // Extension pattern
        if (name.endsWith(pattern.slice(1))) return true;
      } else if (name === pattern || fullPath.includes(`/${pattern}/`)) {
        return true;
      }
    }
    return false;
  }

  matchGlob(name, fullPath, pattern) {
    // Simple glob matching
    const patterns = pattern.split(',').map(p => p.trim());

    for (const p of patterns) {
      if (p.startsWith('**/*.')) {
        // Match extension anywhere
        const ext = p.slice(4);
        if (name.endsWith(ext)) return true;
      } else if (p.startsWith('*.')) {
        // Match extension
        const ext = p.slice(1);
        if (name.endsWith(ext)) return true;
      } else if (p.includes('*')) {
        // Convert glob to regex
        const regex = new RegExp('^' + p.replace(/\*/g, '.*').replace(/\?/g, '.') + '$');
        if (regex.test(name)) return true;
      } else {
        if (name === p || fullPath.includes(p)) return true;
      }
    }

    return false;
  }

  isBinaryFile(name) {
    const binaryExtensions = [
      '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.ico', '.webp',
      '.pdf', '.doc', '.docx', '.xls', '.xlsx',
      '.zip', '.tar', '.gz', '.rar',
      '.exe', '.dll', '.so', '.dylib',
      '.mp3', '.mp4', '.avi', '.mov',
      '.ttf', '.otf', '.woff', '.woff2',
      '.lock', '.log'
    ];

    const ext = path.extname(name).toLowerCase();
    return binaryExtensions.includes(ext);
  }

  searchInFile(file, content, regex, options) {
    const { outputMode, showLineNumbers, beforeContext, afterContext, multiline } = options;
    const matches = [];
    const lines = content.split('\n');

    if (multiline) {
      // Multiline search
      let match;
      const multilineRegex = new RegExp(regex.source, regex.flags + (regex.flags.includes('m') ? '' : 'm'));

      while ((match = multilineRegex.exec(content)) !== null) {
        const beforeMatch = content.substring(0, match.index);
        const lineNum = beforeMatch.split('\n').length;

        matches.push({
          line: lineNum,
          match: match[0],
          content: match[0]
        });

        // Prevent infinite loop
        if (matches.length >= this.maxResults) break;
      }
    } else {
      // Line-by-line search
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        regex.lastIndex = 0;

        if (regex.test(line)) {
          const matchObj = {
            line: i + 1,
            content: line
          };

          // Add context if requested
          if (beforeContext > 0 || afterContext > 0) {
            matchObj.before = lines.slice(Math.max(0, i - beforeContext), i);
            matchObj.after = lines.slice(i + 1, Math.min(lines.length, i + 1 + afterContext));
          }

          matches.push(matchObj);

          if (matches.length >= this.maxResults) break;
        }
      }
    }

    return matches;
  }

  formatOutput(results, outputMode, basePath) {
    if (results.length === 0) {
      return 'No matches found';
    }

    switch (outputMode) {
      case 'files_with_matches':
        return results.map(r => r.file).join('\n');

      case 'count':
        return results.map(r => `${r.file}: ${r.matches.length}`).join('\n');

      case 'content':
      default:
        return results.map(r => {
          const lines = r.matches.map(m => {
            let output = `${r.file}:${m.line}:${m.content}`;

            if (m.before && m.before.length > 0) {
              const beforeLines = m.before.map((l, i) =>
                `${r.file}:${m.line - m.before.length + i}:${l}`
              ).join('\n');
              output = beforeLines + '\n' + output;
            }

            if (m.after && m.after.length > 0) {
              const afterLines = m.after.map((l, i) =>
                `${r.file}:${m.line + 1 + i}:${l}`
              ).join('\n');
              output = output + '\n' + afterLines;
            }

            return output;
          });

          return lines.join('\n--\n');
        }).join('\n');
    }
  }
}
