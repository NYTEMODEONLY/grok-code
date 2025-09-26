import fs from 'fs';
import path from 'path';
import { SyntaxHighlighter } from '../display/syntax-highlighter.js';
import { logger } from '../utils/logger.js';

/**
 * Interactive File Browser for Terminal Navigation
 * Provides file browsing, preview, and selection capabilities in the terminal
 */
export class FileBrowser {
  constructor(options = {}) {
    this.syntaxHighlighter = options.syntaxHighlighter || new SyntaxHighlighter();
    this.currentPath = options.startPath || process.cwd();
    this.showHidden = options.showHidden || false;
    this.maxPreviewLines = options.maxPreviewLines || 50;
    this.selectedFiles = new Set();

    // File type icons
    this.fileIcons = {
      directory: '📁',
      file: '📄',
      javascript: '🟨',
      typescript: '🔷',
      python: '🐍',
      json: '📋',
      markdown: '📝',
      image: '🖼️',
      text: '📄',
      binary: '⚙️',
      unknown: '❓',
    };

    logger.info('File browser initialized', { startPath: this.currentPath });
  }

  /**
   * Get file type icon based on file extension
   * @param {string} filename - File name
   * @param {boolean} isDirectory - Whether it's a directory
   * @returns {string} Icon for the file type
   */
  getFileIcon(filename, isDirectory = false) {
    if (isDirectory) return this.fileIcons.directory;

    const ext = path.extname(filename).toLowerCase();
    const iconMap = {
      '.js': 'javascript',
      '.jsx': 'javascript',
      '.ts': 'typescript',
      '.tsx': 'typescript',
      '.py': 'python',
      '.json': 'json',
      '.md': 'markdown',
      '.txt': 'text',
      '.jpg': 'image',
      '.jpeg': 'image',
      '.png': 'image',
      '.gif': 'image',
      '.svg': 'image',
    };

    return this.fileIcons[iconMap[ext]] || this.fileIcons.unknown;
  }

  /**
   * Get file type description
   * @param {string} filename - File name
   * @param {boolean} isDirectory - Whether it's a directory
   * @returns {string} Human-readable file type
   */
  getFileType(filename, isDirectory = false) {
    if (isDirectory) return 'Directory';

    const ext = path.extname(filename).toLowerCase();
    const typeMap = {
      '.js': 'JavaScript',
      '.jsx': 'React JavaScript',
      '.ts': 'TypeScript',
      '.tsx': 'React TypeScript',
      '.py': 'Python',
      '.json': 'JSON',
      '.md': 'Markdown',
      '.txt': 'Text',
      '.html': 'HTML',
      '.css': 'CSS',
      '.scss': 'SCSS',
      '.less': 'LESS',
      '.jpg': 'JPEG Image',
      '.jpeg': 'JPEG Image',
      '.png': 'PNG Image',
      '.gif': 'GIF Image',
      '.svg': 'SVG Image',
      '.pdf': 'PDF Document',
      '.zip': 'Archive',
      '.tar': 'Archive',
      '.gz': 'Archive',
    };

    return typeMap[ext] || `${ext.toUpperCase()} File`;
  }

  /**
   * Get directory contents with metadata
   * @param {string} dirPath - Directory path
   * @returns {Array} Array of file/directory objects
   */
  getDirectoryContents(dirPath) {
    try {
      const items = fs.readdirSync(dirPath);
      const contents = [];

      // Add parent directory option
      if (path.dirname(dirPath) !== dirPath) {
        contents.push({
          name: '..',
          fullPath: path.dirname(dirPath),
          isDirectory: true,
          isParent: true,
          size: 0,
          modified: new Date(),
          icon: '⬆️',
          displayName: '⬆️  .. (Parent Directory)',
        });
      }

      for (const item of items) {
        // Skip hidden files unless showHidden is true
        if (!this.showHidden && item.startsWith('.')) continue;

        const fullPath = path.join(dirPath, item);
        let stats;

        try {
          stats = fs.statSync(fullPath);
        } catch (error) {
          // Skip files we can't access
          continue;
        }

        const isDirectory = stats.isDirectory();
        const icon = this.getFileIcon(item, isDirectory);
        const fileType = this.getFileType(item, isDirectory);

        contents.push({
          name: item,
          fullPath,
          isDirectory,
          isParent: false,
          size: stats.size,
          modified: stats.mtime,
          icon,
          fileType,
          displayName: `${icon}  ${item}${isDirectory ? '/' : ''}`,
          readable: this.formatFileSize(stats.size),
          modifiedStr: stats.mtime.toLocaleDateString(),
        });
      }

      // Sort: directories first, then files alphabetically
      contents.sort((a, b) => {
        if (a.isParent) return -1;
        if (b.isParent) return 1;
        if (a.isDirectory && !b.isDirectory) return -1;
        if (!a.isDirectory && b.isDirectory) return 1;
        return a.name.localeCompare(b.name);
      });

      return contents;
    } catch (error) {
      logger.error('Failed to read directory', { path: dirPath, error: error.message });
      return [];
    }
  }

  /**
   * Format file size in human-readable format
   * @param {number} bytes - File size in bytes
   * @returns {string} Formatted size
   */
  formatFileSize(bytes) {
    if (bytes === 0) return '0 B';

    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  }

  /**
   * Preview file content
   * @param {string} filePath - Path to file
   * @returns {string} Formatted preview
   */
  previewFile(filePath) {
    try {
      const stats = fs.statSync(filePath);
      if (stats.isDirectory()) {
        const contents = this.getDirectoryContents(filePath);
        return `Directory with ${contents.length} items\n\n${contents.slice(0, 10).map(item => item.displayName).join('\n')}${contents.length > 10 ? '\n...' : ''}`;
      }

      // Check if file is binary
      const buffer = Buffer.alloc(512);
      const fd = fs.openSync(filePath, 'r');
      const bytesRead = fs.readSync(fd, buffer, 0, 512, 0);
      fs.closeSync(fd);

      // Simple binary check
      let isBinary = false;
      for (let i = 0; i < bytesRead; i++) {
        if (buffer[i] === 0) {
          isBinary = true;
          break;
        }
      }

      if (isBinary || stats.size > 1024 * 1024) { // > 1MB
        return `Binary file or large file (${this.formatFileSize(stats.size)})\n\nPreview not available for this file type.`;
      }

      const content = fs.readFileSync(filePath, 'utf8').catch(() => 'Unable to read file content');
      const lines = content.split('\n');

      // Get language for syntax highlighting
      const language = this.syntaxHighlighter.detectLanguage(content);
      const highlighted = this.syntaxHighlighter.highlight(content, language);

      // Limit preview lines
      const previewLines = lines.slice(0, this.maxPreviewLines);
      const preview = previewLines.join('\n');
      const highlightedPreview = this.syntaxHighlighter.highlight(preview, language);

      let result = `File: ${path.basename(filePath)}\nType: ${this.getFileType(path.basename(filePath))}\nSize: ${this.formatFileSize(stats.size)}\nLines: ${lines.length}\n\n`;

      if (lines.length > this.maxPreviewLines) {
        result += `Preview (first ${this.maxPreviewLines} lines):\n`;
      } else {
        result += `Content:\n`;
      }

      result += `─`.repeat(50) + '\n';
      result += highlightedPreview;

      if (lines.length > this.maxPreviewLines) {
        result += `\n\n... (${lines.length - this.maxPreviewLines} more lines)`;
      }

      return result;
    } catch (error) {
      return `Error previewing file: ${error.message}`;
    }
  }

  /**
   * Interactive file browser session
   * @param {Object} options - Browser options
   * @returns {Promise<Array>} Selected files
   */
  async browse(options = {}) {
    const { inquirer } = await import('inquirer');
    const startPath = options.startPath || this.currentPath;
    let currentPath = startPath;
    const selectedFiles = new Set(options.selectedFiles || []);

    console.log('\n🗂️  Interactive File Browser');
    console.log('═'.repeat(40));
    console.log('Navigate with arrow keys, Enter to select, Space to toggle selection');
    console.log('Type to search, Ctrl+C to finish\n');

    while (true) {
      try {
        const contents = this.getDirectoryContents(currentPath);

        if (contents.length === 0) {
          console.log(`📁 Empty directory: ${currentPath}`);
          break;
        }

        // Create choices for inquirer
        const choices = contents.map(item => ({
          name: item.displayName,
          value: item,
          short: item.name,
          checked: selectedFiles.has(item.fullPath),
        }));

        const { selection } = await inquirer.prompt([
          {
            type: 'list',
            name: 'selection',
            message: `📁 ${path.relative(process.cwd(), currentPath) || '.'} (${contents.length} items)`,
            choices: [
              ...choices,
              new inquirer.Separator(),
              { name: '🔍 Search/Filter', value: 'search' },
              { name: '📋 Show Selected', value: 'selected' },
              { name: '✅ Finish Selection', value: 'finish' },
            ],
            pageSize: 15,
            loop: false,
          },
        ]);

        if (selection === 'finish') {
          break;
        }

        if (selection === 'search') {
          const { searchTerm } = await inquirer.prompt([
            {
              type: 'input',
              name: 'searchTerm',
              message: 'Enter search term:',
            },
          ]);

          if (searchTerm) {
            const filtered = contents.filter(item =>
              item.name.toLowerCase().includes(searchTerm.toLowerCase())
            );
            console.log(`\n🔍 Found ${filtered.length} items matching "${searchTerm}":`);
            filtered.forEach(item => console.log(`  ${item.displayName}`));
          }
          continue;
        }

        if (selection === 'selected') {
          console.log(`\n📋 Selected Files (${selectedFiles.size}):`);
          Array.from(selectedFiles).forEach(file => {
            console.log(`  ✅ ${path.relative(process.cwd(), file)}`);
          });
          if (selectedFiles.size === 0) {
            console.log('  (none selected)');
          }
          console.log();
          continue;
        }

        // Handle directory navigation or file selection
        if (selection.isDirectory) {
          if (selection.isParent) {
            currentPath = path.dirname(currentPath);
          } else {
            currentPath = selection.fullPath;
          }
        } else {
          // File selected - show preview and ask what to do
          console.log('\n' + this.previewFile(selection.fullPath));

          const { action } = await inquirer.prompt([
            {
              type: 'list',
              name: 'action',
              message: `What would you like to do with "${selection.name}"?`,
              choices: [
                { name: '📋 Add to Selection', value: 'add' },
                { name: '❌ Remove from Selection', value: 'remove' },
                { name: '👁️  View Full File', value: 'view' },
                { name: '⬅️  Back to Browser', value: 'back' },
              ],
            },
          ]);

          switch (action) {
            case 'add':
              selectedFiles.add(selection.fullPath);
              console.log(`✅ Added: ${path.relative(process.cwd(), selection.fullPath)}`);
              break;
            case 'remove':
              selectedFiles.delete(selection.fullPath);
              console.log(`❌ Removed: ${path.relative(process.cwd(), selection.fullPath)}`);
              break;
            case 'view':
              try {
                const fullContent = fs.readFileSync(selection.fullPath, 'utf8');
                const language = this.syntaxHighlighter.detectLanguage(fullContent);
                const highlighted = this.syntaxHighlighter.highlight(fullContent, language);
                console.log('\n📄 Full File Content:');
                console.log('═'.repeat(50));
                console.log(highlighted);
                console.log('═'.repeat(50));
                await inquirer.prompt([{ type: 'input', name: 'continue', message: 'Press Enter to continue...' }]);
              } catch (error) {
                console.log(`❌ Error reading file: ${error.message}`);
              }
              break;
            case 'back':
              // Continue browsing
              break;
          }
        }

      } catch (error) {
        if (error.isTtyError) {
          console.log('❌ Interactive mode not supported in this environment');
          break;
        } else {
          console.log(`❌ Error: ${error.message}`);
          break;
        }
      }
    }

    const selectedArray = Array.from(selectedFiles);
    console.log(`\n✅ File browser session complete. Selected ${selectedArray.length} files.`);

    return selectedArray;
  }

  /**
   * Non-interactive file selection
   * @param {string} pattern - Glob pattern or search term
   * @param {string} startPath - Starting directory
   * @returns {Array} Matching files
   */
  findFiles(pattern, startPath = this.currentPath) {
    // Simple file search implementation
    const results = [];

    function searchDirectory(dirPath, searchPattern) {
      try {
        const items = fs.readdirSync(dirPath);

        for (const item of items) {
          if (!this.showHidden && item.startsWith('.')) continue;

          const fullPath = path.join(dirPath, item);
          const stats = fs.statSync(fullPath);

          if (stats.isDirectory()) {
            searchDirectory.call(this, fullPath, searchPattern);
          } else if (item.toLowerCase().includes(searchPattern.toLowerCase())) {
            results.push({
              name: item,
              fullPath,
              size: stats.size,
              modified: stats.mtime,
              icon: this.getFileIcon(item),
              fileType: this.getFileType(item),
            });
          }
        }
      } catch (error) {
        // Skip directories we can't read
      }
    }

    searchDirectory.call(this, startPath, pattern);
    return results;
  }

  /**
   * Get browser statistics
   * @returns {Object} Browser stats
   */
  getStats() {
    return {
      currentPath: this.currentPath,
      selectedFiles: this.selectedFiles.size,
      showHidden: this.showHidden,
      maxPreviewLines: this.maxPreviewLines,
    };
  }

  /**
   * Configure browser options
   * @param {Object} options - Configuration options
   */
  configure(options = {}) {
    if (options.showHidden !== undefined) this.showHidden = options.showHidden;
    if (options.maxPreviewLines !== undefined) this.maxPreviewLines = options.maxPreviewLines;
    if (options.currentPath) this.currentPath = options.currentPath;

    logger.info('File browser configured', options);
  }

  /**
   * Test file browser with sample data
   * @param {string} testType - Test type
   */
  async testBrowser(testType = 'basic') {
    console.log('\n🧪 Testing File Browser...\n');

    if (testType === 'basic' || testType === 'all') {
      console.log('Test 1: Directory Contents');
      console.log('='.repeat(30));

      const contents = this.getDirectoryContents(process.cwd());
      console.log(`Found ${contents.length} items in current directory:`);
      contents.slice(0, 10).forEach(item => {
        console.log(`  ${item.displayName}`);
      });
      if (contents.length > 10) {
        console.log(`  ... and ${contents.length - 10} more`);
      }
    }

    if (testType === 'preview' || testType === 'all') {
      console.log('\nTest 2: File Preview');
      console.log('='.repeat(20));

      const packageJson = path.join(process.cwd(), 'package.json');
      if (fs.existsSync(packageJson)) {
        console.log(this.previewFile(packageJson));
      } else {
        console.log('package.json not found for preview test');
      }
    }

    if (testType === 'search' || testType === 'all') {
      console.log('\nTest 3: File Search');
      console.log('='.repeat(20));

      const jsFiles = this.findFiles('.js', process.cwd());
      console.log(`Found ${jsFiles.length} JavaScript files:`);
      jsFiles.slice(0, 5).forEach(file => {
        console.log(`  ${file.icon} ${file.name}`);
      });
    }

    console.log('\n🎉 File browser tests completed!');
  }
}
