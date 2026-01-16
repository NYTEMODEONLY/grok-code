/**
 * Read Tool
 * Reads files from the filesystem
 */

import { BaseTool } from './base-tool.js';
import fs from 'fs-extra';
import path from 'path';

export class ReadTool extends BaseTool {
  constructor(options = {}) {
    super({
      name: 'Read',
      description: `Reads a file from the local filesystem. You can access any file directly by using this tool.
- The file_path parameter must be an absolute path, not a relative path
- By default, it reads up to 2000 lines starting from the beginning of the file
- You can optionally specify a line offset and limit (especially handy for long files)
- Any lines longer than 2000 characters will be truncated
- Results are returned with line numbers starting at 1
- This tool can read images, PDFs, and Jupyter notebooks
- This tool can only read files, not directories`,
      parameters: {
        type: 'object',
        properties: {
          file_path: {
            type: 'string',
            description: 'The absolute path to the file to read'
          },
          offset: {
            type: 'number',
            description: 'The line number to start reading from (optional)'
          },
          limit: {
            type: 'number',
            description: 'The number of lines to read (optional, default: 2000)'
          }
        },
        required: ['file_path']
      },
      requiresPermission: false,
      isReadOnly: true,
      ...options
    });

    this.maxLines = options.maxLines || 2000;
    this.maxLineLength = options.maxLineLength || 2000;
    this.maxTokens = options.maxTokens || 25000;
  }

  async execute(params, context = {}) {
    const { file_path, offset = 0, limit = this.maxLines } = params;
    const startTime = Date.now();

    try {
      // Validate path
      if (!file_path) {
        return { error: 'file_path is required' };
      }

      // Resolve to absolute path
      const absolutePath = path.isAbsolute(file_path)
        ? file_path
        : path.resolve(context.cwd || process.cwd(), file_path);

      // Check if file exists
      if (!await fs.pathExists(absolutePath)) {
        return { error: `File not found: ${absolutePath}` };
      }

      // Check if it's a directory
      const stat = await fs.stat(absolutePath);
      if (stat.isDirectory()) {
        return { error: `Cannot read directory. Use LS tool or Glob tool instead.` };
      }

      // Detect file type by extension
      const ext = path.extname(absolutePath).toLowerCase();

      // Handle binary files
      if (this.isBinaryExtension(ext)) {
        return this.handleBinaryFile(absolutePath, ext, stat);
      }

      // Read text file
      const content = await fs.readFile(absolutePath, 'utf8');
      const lines = content.split('\n');
      const totalLines = lines.length;

      // Apply offset and limit
      const startLine = Math.max(0, offset);
      const endLine = Math.min(totalLines, startLine + limit);
      const selectedLines = lines.slice(startLine, endLine);

      // Format with line numbers (1-indexed)
      const formattedLines = selectedLines.map((line, i) => {
        const lineNum = startLine + i + 1;
        const truncatedLine = line.length > this.maxLineLength
          ? line.substring(0, this.maxLineLength) + '...'
          : line;
        return `${String(lineNum).padStart(6)}→${truncatedLine}`;
      });

      const output = formattedLines.join('\n');

      // Check token limit
      const estimatedTokens = Math.ceil(output.length / 4);
      if (estimatedTokens > this.maxTokens) {
        return {
          error: `File content (${estimatedTokens} tokens) exceeds maximum allowed tokens (${this.maxTokens}). Please use offset and limit parameters to read specific portions of the file.`,
          totalLines,
          estimatedTokens
        };
      }

      return {
        output,
        totalLines,
        readLines: selectedLines.length,
        startLine: startLine + 1,
        endLine,
        filePath: absolutePath,
        executionTime: Date.now() - startTime
      };
    } catch (error) {
      return {
        error: error.message,
        executionTime: Date.now() - startTime
      };
    }
  }

  isBinaryExtension(ext) {
    const binaryExtensions = [
      '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp', '.ico', '.svg',
      '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
      '.zip', '.tar', '.gz', '.rar', '.7z',
      '.exe', '.dll', '.so', '.dylib',
      '.mp3', '.mp4', '.avi', '.mov', '.wav',
      '.ttf', '.otf', '.woff', '.woff2'
    ];
    return binaryExtensions.includes(ext);
  }

  async handleBinaryFile(filePath, ext, stat) {
    const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp', '.ico', '.svg'];
    const pdfExtension = '.pdf';

    if (imageExtensions.includes(ext)) {
      return {
        output: `[Image file: ${path.basename(filePath)}]`,
        fileType: 'image',
        extension: ext,
        size: stat.size,
        filePath
      };
    }

    if (ext === pdfExtension) {
      return {
        output: `[PDF file: ${path.basename(filePath)}]`,
        fileType: 'pdf',
        size: stat.size,
        filePath
      };
    }

    return {
      output: `[Binary file: ${path.basename(filePath)}]`,
      fileType: 'binary',
      extension: ext,
      size: stat.size,
      filePath
    };
  }
}
