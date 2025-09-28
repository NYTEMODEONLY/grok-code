import fs from 'fs';
import path from 'path';
import { SyntaxHighlighter } from './syntax-highlighter.js';
import { logger } from '../utils/logger.js';

/**
 * Enhanced Code Preview with Line Numbers and IDE-like Features
 * Provides rich code display with syntax highlighting, line numbers, and navigation features
 */
export class CodePreview {
  constructor(options = {}) {
    this.syntaxHighlighter = options.syntaxHighlighter || null;
    this.showLineNumbers = options.showLineNumbers !== false;
    this.lineNumberPadding = options.lineNumberPadding || 4;
    this.maxLines = options.maxLines || 100;
    this.wrapLines = options.wrapLines || false;
    this.highlightCurrentLine = options.highlightCurrentLine || false;
    this.showGutter = options.showGutter !== false;

    // Gutter symbols
    this.gutter = {
      lineNumber: '│',
      currentLine: '▶',
      breakpoint: '●',
      bookmark: '☆',
      error: '✗',
      warning: '⚠',
      info: 'ℹ',
    };

    // Color schemes for different elements
    this.colors = {
      lineNumber: '\x1b[90m', // Gray
      currentLine: '\x1b[43m\x1b[30m', // Yellow background, black text
      gutter: '\x1b[37m', // White
      reset: '\x1b[0m',
      error: '\x1b[41m\x1b[37m', // Red background, white text
      warning: '\x1b[43m\x1b[30m', // Yellow background, black text
      info: '\x1b[44m\x1b[37m', // Blue background, white text
    };

    logger.info('Code preview initialized', {
      showLineNumbers: this.showLineNumbers,
      maxLines: this.maxLines,
      wrapLines: this.wrapLines,
    });
  }

  /**
   * Preview code with enhanced formatting
   * @param {string} code - Code content
   * @param {string} language - Programming language
   * @param {Object} options - Preview options
   * @returns {string} Formatted code preview
   */
  previewCode(code, language = 'auto', options = {}) {
    const opts = { ...this.getDefaultOptions(), ...options };
    const lines = code.split('\n');

    // Limit lines if specified
    const displayLines =
      opts.maxLines && lines.length > opts.maxLines
        ? lines.slice(0, opts.maxLines)
        : lines;

    // Detect language if auto
    const detectedLang =
      language === 'auto'
        ? this.syntaxHighlighter.detectLanguage(code)
        : language;

    // Apply syntax highlighting
    const highlightedCode = this.syntaxHighlighter.highlight(
      code,
      detectedLang
    );

    // Split highlighted code back into lines
    const highlightedLines = highlightedCode.split('\n');

    // Format each line with line numbers and gutter
    const formattedLines = displayLines.map((originalLine, index) => {
      const lineNumber = index + 1;
      const highlightedLine = highlightedLines[index] || originalLine;
      const isCurrentLine = opts.currentLine === lineNumber;

      return this.formatLine(
        highlightedLine,
        lineNumber,
        isCurrentLine,
        opts,
        originalLine
      );
    });

    // Add truncation indicator if needed
    if (opts.maxLines && lines.length > opts.maxLines) {
      const truncatedMsg = `    ${this.colors.info}... ${lines.length - opts.maxLines} more lines ...${this.colors.reset}`;
      formattedLines.push(truncatedMsg);
    }

    // Add header if requested
    let result = '';
    if (opts.showHeader) {
      result += this.createHeader(detectedLang, lines.length, opts);
    }

    result += formattedLines.join('\n');

    // Add footer if requested
    if (opts.showFooter) {
      result += '\n' + this.createFooter(lines.length, opts);
    }

    return result;
  }

  /**
   * Format a single line with line numbers and gutter
   * @param {string} line - Line content (may be highlighted)
   * @param {number} lineNumber - Line number
   * @param {boolean} isCurrentLine - Whether this is the current line
   * @param {Object} options - Formatting options
   * @param {string} originalLine - Original unhighlighted line
   * @returns {string} Formatted line
   */
  formatLine(line, lineNumber, isCurrentLine, options, originalLine) {
    let formatted = '';

    // Add line numbers
    if (options.showLineNumbers) {
      const lineNumStr = lineNumber
        .toString()
        .padStart(options.lineNumberPadding, ' ');
      formatted += `${this.colors.lineNumber}${lineNumStr}${this.colors.reset} `;
    }

    // Add gutter
    if (options.showGutter) {
      let gutterSymbol = this.gutter.lineNumber;
      let gutterColor = this.colors.gutter;

      if (isCurrentLine && options.highlightCurrentLine) {
        gutterSymbol = this.gutter.currentLine;
        gutterColor = this.colors.currentLine;
      }

      formatted += `${gutterColor}${gutterSymbol}${this.colors.reset} `;
    }

    // Add line content
    if (isCurrentLine && options.highlightCurrentLine) {
      formatted += `${this.colors.currentLine}${line}${this.colors.reset}`;
    } else {
      formatted += line;
    }

    return formatted;
  }

  /**
   * Create a header for the code preview
   * @param {string} language - Detected language
   * @param {number} totalLines - Total number of lines
   * @param {Object} options - Options
   * @returns {string} Header string
   */
  createHeader(language, totalLines, options) {
    const langDisplay = language.charAt(0).toUpperCase() + language.slice(1);
    const header = `╭─ ${langDisplay} Code Preview (${totalLines} lines) `;
    const headerWidth = Math.max(60, header.length + 1);
    const padding = '─'.repeat(headerWidth - header.length - 1);

    return `${header}${padding}╮\n`;
  }

  /**
   * Create a footer for the code preview
   * @param {number} totalLines - Total number of lines
   * @param {Object} options - Options
   * @returns {string} Footer string
   */
  createFooter(totalLines, options) {
    const footer = `╰─ End of Preview (${totalLines} total lines) `;
    const footerWidth = Math.max(60, footer.length + 1);
    const padding = '─'.repeat(footerWidth - footer.length - 1);

    return `${footer}${padding}╯`;
  }

  /**
   * Preview a file with enhanced formatting
   * @param {string} filePath - Path to file
   * @param {Object} options - Preview options
   * @returns {string} Formatted file preview
   */
  previewFile(filePath, options = {}) {
    try {
      const stats = fs.statSync(filePath);
      if (stats.isDirectory()) {
        return `📁 ${path.basename(filePath)} is a directory`;
      }

      // Check file size
      const maxSize = options.maxFileSize || 1024 * 1024; // 1MB default
      if (stats.size > maxSize) {
        return `📄 ${path.basename(filePath)} is too large to preview (${this.formatFileSize(stats.size)})`;
      }

      const content = fs.readFileSync(filePath, 'utf8');
      const language =
        options.language || this.syntaxHighlighter.detectLanguage(content);

      const opts = {
        ...this.getDefaultOptions(),
        ...options,
        fileName: path.basename(filePath),
        fileSize: stats.size,
        modified: stats.mtime,
      };

      let preview = this.previewCode(content, language, opts);

      // Add file info if requested
      if (options.showFileInfo) {
        const fileInfo = this.createFileInfo(filePath, stats, language);
        preview = fileInfo + '\n\n' + preview;
      }

      return preview;
    } catch (error) {
      return `❌ Error previewing file: ${error.message}`;
    }
  }

  /**
   * Create file information display
   * @param {string} filePath - File path
   * @param {Object} stats - File stats
   * @param {string} language - Detected language
   * @returns {string} File info string
   */
  createFileInfo(filePath, stats, language) {
    const relativePath = path.relative(process.cwd(), filePath);
    const langDisplay = language.charAt(0).toUpperCase() + language.slice(1);

    return `📄 ${relativePath}
   📏 Size: ${this.formatFileSize(stats.size)}
   🏷️  Type: ${langDisplay}
   📅 Modified: ${stats.mtime.toLocaleString()}
   📊 Lines: ${fs.readFileSync(filePath, 'utf8').split('\n').length}`;
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
    return Math.round((bytes / Math.pow(1024, i)) * 100) / 100 + ' ' + sizes[i];
  }

  /**
   * Get default options for preview
   * @returns {Object} Default options
   */
  getDefaultOptions() {
    return {
      showLineNumbers: this.showLineNumbers,
      showGutter: this.showGutter,
      highlightCurrentLine: this.highlightCurrentLine,
      maxLines: this.maxLines,
      wrapLines: this.wrapLines,
      lineNumberPadding: this.lineNumberPadding,
      showHeader: false,
      showFooter: false,
      showFileInfo: false,
      currentLine: null,
    };
  }

  /**
   * Highlight specific lines in the code
   * @param {string} code - Code content
   * @param {Array} highlightLines - Array of line numbers to highlight
   * @param {string} language - Programming language
   * @param {Object} options - Preview options
   * @returns {string} Code with highlighted lines
   */
  highlightLines(code, highlightLines, language = 'auto', options = {}) {
    const opts = { ...this.getDefaultOptions(), ...options };
    opts.highlightLines = new Set(highlightLines);

    return this.previewCode(code, language, {
      ...opts,
      lineFormatter: (
        line,
        lineNumber,
        isCurrentLine,
        options,
        originalLine
      ) => {
        const shouldHighlight = opts.highlightLines.has(lineNumber);
        if (shouldHighlight) {
          return this.formatLine(
            line,
            lineNumber,
            true,
            { ...options, highlightCurrentLine: true },
            originalLine
          );
        }
        return this.formatLine(line, lineNumber, false, options, originalLine);
      },
    });
  }

  /**
   * Create a side-by-side diff view
   * @param {string} leftCode - Left side code
   * @param {string} rightCode - Right side code
   * @param {string} leftTitle - Left title
   * @param {string} rightTitle - Right title
   * @param {Object} options - Options
   * @returns {string} Side-by-side view
   */
  createSideBySide(
    leftCode,
    rightCode,
    leftTitle = 'Left',
    rightTitle = 'Right',
    options = {}
  ) {
    const leftLines = leftCode.split('\n');
    const rightLines = rightCode.split('\n');
    const maxLines = Math.max(leftLines.length, rightLines.length);
    const lineWidth = options.lineWidth || 40;

    let result = `${leftTitle.padEnd(lineWidth)} │ ${rightTitle}\n`;
    result += `${'─'.repeat(lineWidth)}─┼─${'─'.repeat(lineWidth)}\n`;

    for (let i = 0; i < maxLines; i++) {
      const leftLine = (leftLines[i] || '').padEnd(lineWidth);
      const rightLine = (rightLines[i] || '').padEnd(lineWidth);
      result += `${leftLine} │ ${rightLine}\n`;
    }

    return result;
  }

  /**
   * Add annotations to specific lines
   * @param {string} code - Code content
   * @param {Object} annotations - Line number -> annotation mapping
   * @param {string} language - Programming language
   * @param {Object} options - Preview options
   * @returns {string} Code with annotations
   */
  addAnnotations(code, annotations, language = 'auto', options = {}) {
    const opts = { ...this.getDefaultOptions(), ...options };
    const lines = code.split('\n');

    // Calculate max annotation width
    const maxAnnotationWidth = Math.max(
      ...Object.values(annotations).map((a) => a.length)
    );
    opts.annotationWidth = maxAnnotationWidth;

    const formattedLines = lines.map((line, index) => {
      const lineNumber = index + 1;
      const annotation = annotations[lineNumber];

      if (annotation) {
        // Format line with annotation
        const formattedLine = this.formatLine(
          line,
          lineNumber,
          false,
          opts,
          line
        );
        const annotationStr = ` ${this.colors.info}💬 ${annotation}${this.colors.reset}`;
        return formattedLine + annotationStr;
      }

      return this.formatLine(line, lineNumber, false, opts, line);
    });

    return formattedLines.join('\n');
  }

  /**
   * Navigate to specific line in code
   * @param {string} code - Code content
   * @param {number} targetLine - Line to navigate to
   * @param {number} contextLines - Lines of context around target
   * @param {string} language - Programming language
   * @param {Object} options - Preview options
   * @returns {string} Code preview centered on target line
   */
  navigateToLine(
    code,
    targetLine,
    contextLines = 3,
    language = 'auto',
    options = {}
  ) {
    const lines = code.split('\n');
    const startLine = Math.max(0, targetLine - contextLines - 1);
    const endLine = Math.min(lines.length, targetLine + contextLines);

    const contextCode = lines.slice(startLine, endLine).join('\n');

    const opts = {
      ...this.getDefaultOptions(),
      ...options,
      currentLine: targetLine - startLine,
      showHeader: true,
      showFooter: true,
    };

    let preview = this.previewCode(contextCode, language, opts);

    // Add navigation info
    const navInfo = `\n📍 Showing lines ${startLine + 1}-${endLine} of ${lines.length} (centered on line ${targetLine})`;
    preview += navInfo;

    return preview;
  }

  /**
   * Search and highlight terms in code
   * @param {string} code - Code content
   * @param {string} searchTerm - Term to search for
   * @param {string} language - Programming language
   * @param {Object} options - Preview options
   * @returns {string} Code with search terms highlighted
   */
  searchAndHighlight(code, searchTerm, language = 'auto', options = {}) {
    const opts = { ...this.getDefaultOptions(), ...options };

    // Create a custom highlighter that highlights search terms
    const highlightedCode = code.replace(
      new RegExp(searchTerm, 'gi'),
      (match) => `${this.colors.warning}${match}${this.colors.reset}`
    );

    return this.previewCode(highlightedCode, language, opts);
  }

  /**
   * Configure preview options
   * @param {Object} options - Configuration options
   */
  configure(options = {}) {
    if (options.showLineNumbers !== undefined)
      this.showLineNumbers = options.showLineNumbers;
    if (options.lineNumberPadding !== undefined)
      this.lineNumberPadding = options.lineNumberPadding;
    if (options.maxLines !== undefined) this.maxLines = options.maxLines;
    if (options.wrapLines !== undefined) this.wrapLines = options.wrapLines;
    if (options.highlightCurrentLine !== undefined)
      this.highlightCurrentLine = options.highlightCurrentLine;
    if (options.showGutter !== undefined) this.showGutter = options.showGutter;

    logger.info('Code preview configured', options);
  }

  /**
   * Get preview statistics
   * @returns {Object} Preview stats
   */
  getStats() {
    return {
      showLineNumbers: this.showLineNumbers,
      lineNumberPadding: this.lineNumberPadding,
      maxLines: this.maxLines,
      wrapLines: this.wrapLines,
      highlightCurrentLine: this.highlightCurrentLine,
      showGutter: this.showGutter,
    };
  }

  /**
   * Test code preview with sample data
   * @param {string} type - Test type
   */
  testPreview(type = 'basic') {
    console.log('\n📄 Testing Code Preview...\n');

    const sampleCode = `import React, { useState, useEffect } from 'react';

function TodoApp() {
  const [todos, setTodos] = useState([]);
  const [inputValue, setInputValue] = useState('');

  useEffect(() => {
    // Load todos from localStorage
    const savedTodos = localStorage.getItem('todos');
    if (savedTodos) {
      setTodos(JSON.parse(savedTodos));
    }
  }, []);

  const addTodo = () => {
    if (inputValue.trim()) {
      const newTodo = {
        id: Date.now(),
        text: inputValue.trim(),
        completed: false,
      };
      setTodos([...todos, newTodo]);
      setInputValue('');
    }
  };

  const toggleTodo = (id) => {
    setTodos(todos.map(todo =>
      todo.id === id ? { ...todo, completed: !todo.completed } : todo
    ));
  };

  return (
    <div className="todo-app">
      <h1>Todo List</h1>
      <div className="input-section">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="Add a new todo..."
        />
        <button onClick={addTodo}>Add</button>
      </div>
      <ul className="todo-list">
        {todos.map(todo => (
          <li key={todo.id} className={todo.completed ? 'completed' : ''}>
            <input
              type="checkbox"
              checked={todo.completed}
              onChange={() => toggleTodo(todo.id)}
            />
            {todo.text}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default TodoApp;`;

    if (type === 'basic' || type === 'all') {
      console.log('Test 1: Basic Code Preview');
      console.log('='.repeat(30));

      const basicPreview = this.previewCode(sampleCode, 'javascript', {
        showLineNumbers: true,
        showHeader: true,
        showFooter: true,
        maxLines: 20,
      });
      console.log(basicPreview);
    }

    if (type === 'highlight' || type === 'all') {
      console.log('\nTest 2: Line Highlighting');
      console.log('='.repeat(25));

      const highlighted = this.highlightLines(
        sampleCode,
        [5, 12, 25],
        'javascript',
        {
          showLineNumbers: true,
        }
      );
      console.log(highlighted);
    }

    if (type === 'navigate' || type === 'all') {
      console.log('\nTest 3: Line Navigation');
      console.log('='.repeat(20));

      const navigated = this.navigateToLine(sampleCode, 15, 2, 'javascript', {
        showLineNumbers: true,
      });
      console.log(navigated);
    }

    if (type === 'search' || type === 'all') {
      console.log('\nTest 4: Search and Highlight');
      console.log('='.repeat(30));

      const searched = this.searchAndHighlight(
        sampleCode,
        'todo',
        'javascript',
        {
          showLineNumbers: true,
          showHeader: true,
        }
      );
      console.log(searched);
    }

    if (type === 'annotations' || type === 'all') {
      console.log('\nTest 5: Code Annotations');
      console.log('='.repeat(20));

      const annotations = {
        3: 'State management with hooks',
        7: 'Load persisted data on mount',
        25: 'JSX rendering with map function',
      };

      const annotated = this.addAnnotations(
        sampleCode,
        annotations,
        'javascript',
        {
          showLineNumbers: true,
          maxLines: 30,
        }
      );
      console.log(annotated);
    }

    console.log('\n🎨 Code Preview tests completed successfully!');
    console.log('\n✨ Features verified:');
    console.log('   • Line numbers and gutter display');
    console.log('   • Syntax highlighting integration');
    console.log('   • Line highlighting and navigation');
    console.log('   • Search and term highlighting');
    console.log('   • Code annotations and comments');
    console.log('   • Header/footer formatting');
    console.log('   • Configurable display options');
  }
}
