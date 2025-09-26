import { SyntaxHighlighter } from './syntax-highlighter.js';
import { logger } from '../utils/logger.js';

/**
 * Color-Coded Diff Viewer for Terminal Display
 * Parses and displays unified diffs with syntax highlighting and color coding
 */
export class DiffViewer {
  constructor(options = {}) {
    this.syntaxHighlighter = options.syntaxHighlighter || new SyntaxHighlighter();
    this.theme = options.theme || 'default';
    this.showLineNumbers = options.showLineNumbers !== false;
    this.contextLines = options.contextLines || 3;

    // Diff-specific colors
    this.diffColors = {
      addition: '\x1b[32m',    // Green
      deletion: '\x1b[31m',    // Red
      context: '\x1b[37m',     // Gray/white
      header: '\x1b[36m',      // Cyan
      file: '\x1b[35m',        // Magenta
      hunk: '\x1b[33m',        // Yellow
      reset: '\x1b[0m',
      bold: '\x1b[1m',
    };

    // Diff markers
    this.markers = {
      addition: '+',
      deletion: '-',
      context: ' ',
      header: '@',
      file: 'diff',
    };

    logger.info('Diff viewer initialized', {
      theme: this.theme,
      showLineNumbers: this.showLineNumbers,
      contextLines: this.contextLines
    });
  }

  /**
   * Display a unified diff with color coding and syntax highlighting
   * @param {string} diffText - Raw unified diff text
   * @param {Object} options - Display options
   * @returns {string} Formatted diff output
   */
  displayDiff(diffText, options = {}) {
    try {
      const lines = diffText.split('\n');
      const processedLines = [];

      let currentFile = null;
      let currentHunk = null;
      let inHunk = false;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const processedLine = this.processDiffLine(line, currentFile, currentHunk, inHunk, options);

        if (processedLine.file) {
          currentFile = processedLine.file;
        }
        if (processedLine.hunk) {
          currentHunk = processedLine.hunk;
          inHunk = true;
        }

        processedLines.push(processedLine.formatted);
      }

      return processedLines.join('\n');

    } catch (error) {
      logger.warn('Diff display failed', { error: error.message });
      return diffText; // Return original diff on error
    }
  }

  /**
   * Process a single diff line
   * @param {string} line - Raw diff line
   * @param {Object} currentFile - Current file context
   * @param {Object} currentHunk - Current hunk context
   * @param {boolean} inHunk - Whether we're inside a hunk
   * @param {Object} options - Processing options
   * @returns {Object} Processed line info
   */
  processDiffLine(line, currentFile, currentHunk, inHunk, options) {
    const result = { formatted: line, file: null, hunk: null };

    // File header (diff --git a/file b/file)
    if (line.startsWith('diff --git')) {
      const fileMatch = line.match(/diff --git a\/(.+) b\/(.+)/);
      if (fileMatch) {
        const fileA = fileMatch[1];
        const fileB = fileMatch[2];
        result.file = { old: fileA, new: fileB };
        result.formatted = `${this.diffColors.file}${this.diffColors.bold}${line}${this.diffColors.reset}`;
      }
      return result;
    }

    // File metadata lines (+++ b/file, --- a/file)
    if (line.startsWith('+++') || line.startsWith('---')) {
      result.formatted = `${this.diffColors.file}${line}${this.diffColors.reset}`;
      return result;
    }

    // Hunk header (@@ -start,len +start,len @@)
    if (line.startsWith('@@')) {
      const hunkMatch = line.match(/@@ -(\d+),?(\d*) \+(\d+),?(\d*) @@(.*)/);
      if (hunkMatch) {
        const oldStart = parseInt(hunkMatch[1]);
        const oldLen = hunkMatch[2] ? parseInt(hunkMatch[2]) : 1;
        const newStart = parseInt(hunkMatch[3]);
        const newLen = hunkMatch[4] ? parseInt(hunkMatch[4]) : 1;
        const context = hunkMatch[5].trim();

        result.hunk = { oldStart, oldLen, newStart, newLen, context };
        result.formatted = `${this.diffColors.hunk}${line}${this.diffColors.reset}`;
      }
      return result;
    }

    // Addition lines (+ ...)
    if (line.startsWith('+') && !line.startsWith('+++')) {
      const content = line.substring(1);
      let highlightedContent = content;

      // Apply syntax highlighting if we have file context
      if (currentFile && options.syntaxHighlight !== false) {
        const language = this.detectLanguageFromFile(currentFile.new || currentFile.old);
        if (language) {
          // Highlight the content but preserve the + marker
          const highlighted = this.syntaxHighlighter.highlight(content, language);
          highlightedContent = highlighted;
        }
      }

      result.formatted = `${this.diffColors.addition}+${highlightedContent}${this.diffColors.reset}`;
      return result;
    }

    // Deletion lines (- ...)
    if (line.startsWith('-') && !line.startsWith('---')) {
      const content = line.substring(1);
      let highlightedContent = content;

      // Apply syntax highlighting if we have file context
      if (currentFile && options.syntaxHighlight !== false) {
        const language = this.detectLanguageFromFile(currentFile.old || currentFile.new);
        if (language) {
          const highlighted = this.syntaxHighlighter.highlight(content, language);
          highlightedContent = highlighted;
        }
      }

      result.formatted = `${this.diffColors.deletion}-${highlightedContent}${this.diffColors.reset}`;
      return result;
    }

    // Context lines (unchanged)
    if (line.startsWith(' ') && inHunk) {
      const content = line.substring(1);
      let highlightedContent = content;

      // Apply syntax highlighting if we have file context
      if (currentFile && options.syntaxHighlight !== false) {
        const language = this.detectLanguageFromFile(currentFile.old || currentFile.new);
        if (language) {
          const highlighted = this.syntaxHighlighter.highlight(content, language);
          highlightedContent = highlighted;
        }
      }

      result.formatted = `${this.diffColors.context} ${highlightedContent}${this.diffColors.reset}`;
      return result;
    }

    // Other lines (usually empty or metadata)
    return result;
  }

  /**
   * Detect programming language from file path
   * @param {string} filePath - File path
   * @returns {string|null} Detected language or null
   */
  detectLanguageFromFile(filePath) {
    if (!filePath) return null;

    const ext = filePath.split('.').pop()?.toLowerCase();
    const extMap = {
      js: 'javascript',
      jsx: 'javascript',
      ts: 'typescript',
      tsx: 'typescript',
      py: 'python',
      java: 'java',
      cpp: 'cpp',
      c: 'c',
      cs: 'csharp',
      php: 'php',
      rb: 'ruby',
      go: 'go',
      rs: 'rust',
      swift: 'swift',
      kt: 'kotlin',
      scala: 'scala',
      html: 'html',
      css: 'css',
      scss: 'scss',
      less: 'less',
      json: 'json',
      xml: 'xml',
      yaml: 'yaml',
      yml: 'yaml',
      md: 'markdown',
      sh: 'shell',
      bash: 'shell',
      zsh: 'shell',
      sql: 'sql',
    };

    return extMap[ext] || null;
  }

  /**
   * Generate a side-by-side diff view
   * @param {string} oldContent - Original content
   * @param {string} newContent - Modified content
   * @param {Object} options - Display options
   * @returns {string} Side-by-side diff
   */
  generateSideBySideDiff(oldContent, newContent, options = {}) {
    const oldLines = oldContent.split('\n');
    const newLines = newContent.split('\n');

    // Simple diff algorithm (for now)
    const maxLines = Math.max(oldLines.length, newLines.length);
    const width = options.width || 80;

    let result = '';

    for (let i = 0; i < maxLines; i++) {
      const oldLine = oldLines[i] || '';
      const newLine = newLines[i] || '';

      const isDifferent = oldLine !== newLine;
      const oldDisplay = oldLine.padEnd(width / 2);
      const newDisplay = newLine.padEnd(width / 2);

      if (isDifferent) {
        result += `${this.diffColors.deletion}${oldDisplay}${this.diffColors.reset}|${this.diffColors.addition}${newDisplay}${this.diffColors.reset}\n`;
      } else {
        result += `${this.diffColors.context}${oldDisplay}${this.diffColors.reset}|${this.diffColors.context}${newDisplay}${this.diffColors.reset}\n`;
      }
    }

    return result;
  }

  /**
   * Apply syntax highlighting to diff content
   * @param {string} diffText - Raw diff text
   * @returns {string} Diff with syntax highlighting
   */
  highlightDiff(diffText) {
    return this.displayDiff(diffText, { syntaxHighlight: true });
  }

  /**
   * Generate a compact diff summary
   * @param {string} diffText - Raw diff text
   * @returns {Object} Diff summary statistics
   */
  getDiffSummary(diffText) {
    const lines = diffText.split('\n');
    let additions = 0;
    let deletions = 0;
    let files = new Set();

    for (const line of lines) {
      if (line.startsWith('+') && !line.startsWith('+++')) {
        additions++;
      } else if (line.startsWith('-') && !line.startsWith('---')) {
        deletions++;
      } else if (line.startsWith('diff --git')) {
        const fileMatch = line.match(/diff --git a\/(.+) b\/(.+)/);
        if (fileMatch) {
          files.add(fileMatch[1]);
          files.add(fileMatch[2]);
        }
      }
    }

    return {
      files: Array.from(files),
      additions,
      deletions,
      changes: additions + deletions,
      hunks: lines.filter(line => line.startsWith('@@')).length,
    };
  }

  /**
   * Display diff summary with colors
   * @param {Object} summary - Diff summary from getDiffSummary
   * @returns {string} Formatted summary
   */
  formatDiffSummary(summary) {
    let result = `${this.diffColors.bold}Diff Summary:${this.diffColors.reset}\n`;
    result += `Files changed: ${summary.files.length}\n`;
    result += `Lines added: ${this.diffColors.addition}+${summary.additions}${this.diffColors.reset}\n`;
    result += `Lines deleted: ${this.diffColors.deletion}-${summary.deletions}${this.diffColors.reset}\n`;
    result += `Total changes: ${summary.changes}\n`;
    result += `Hunks: ${summary.hunks}\n`;

    return result;
  }

  /**
   * Test diff viewer with sample data
   * @param {string} type - Test type ('unified', 'sidebyside', 'summary')
   * @returns {string} Test output
   */
  testDiffViewer(type = 'unified') {
    const sampleDiff = `diff --git a/lib/example.js b/lib/example.js
index 1234567..abcdef0 100644
--- a/lib/example.js
+++ b/lib/example.js
@@ -1,8 +1,12 @@
 function hello(name) {
-  console.log("Hello, " + name + "!");
+  const greeting = \`Hello, \${name}!\`;
+  console.log(greeting);
+
   if (!name) {
     throw new Error("Name is required");
   }
+
   return true;
 }
+
+// New function added
+function goodbye(name) {
+  console.log(\`Goodbye, \${name}!\`);
+}`;

    switch (type) {
      case 'unified':
        return this.displayDiff(sampleDiff);
      case 'sidebyside':
        return this.generateSideBySideDiff(
          `function hello(name) {
  console.log("Hello, " + name + "!");

  if (!name) {
    throw new Error("Name is required");
  }

  return true;
}`,
          `function hello(name) {
  const greeting = \`Hello, \${name}!\`;
  console.log(greeting);

  if (!name) {
    throw new Error("Name is required");
  }

  return true;
}

// New function added
function goodbye(name) {
  console.log(\`Goodbye, \${name}!\`);
}`
        );
      case 'summary':
        const summary = this.getDiffSummary(sampleDiff);
        return this.formatDiffSummary(summary);
      default:
        return 'Unknown test type';
    }
  }

  /**
   * Set diff viewer theme
   * @param {string} theme - Theme name
   */
  setTheme(theme) {
    if (this.diffColors[theme]) {
      // Apply theme-specific color adjustments if needed
      logger.info('Diff viewer theme updated', { theme });
    }
  }

  /**
   * Configure diff viewer options
   * @param {Object} options - Configuration options
   */
  configure(options = {}) {
    if (options.showLineNumbers !== undefined) {
      this.showLineNumbers = options.showLineNumbers;
    }
    if (options.contextLines !== undefined) {
      this.contextLines = options.contextLines;
    }
    if (options.theme) {
      this.theme = options.theme;
    }

    logger.info('Diff viewer configured', options);
  }

  /**
   * Get diff viewer statistics
   * @returns {Object} Viewer statistics
   */
  getStats() {
    return {
      showLineNumbers: this.showLineNumbers,
      contextLines: this.contextLines,
      theme: this.theme,
      syntaxHighlighterEnabled: this.syntaxHighlighter ? !this.syntaxHighlighter.enabled : false,
    };
  }
}
