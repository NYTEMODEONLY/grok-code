import fs from 'fs-extra';
import path from 'path';
import { logger } from '../utils/logger.js';

/**
 * Project Coding Standards and Conventions Analyzer
 * Analyzes codebase to learn project-specific coding standards and conventions
 */
export class ConventionAnalyzer {
  constructor(options = {}) {
    this.projectRoot = options.projectRoot || process.cwd();
    this.maxFiles = options.maxFiles || 100; // Limit files to analyze for performance
    this.maxFileSize = options.maxFileSize || 1024 * 1024; // 1MB per file
    this.supportedExtensions = options.supportedExtensions || ['.js', '.ts', '.jsx', '.tsx', '.py', '.java'];

    // Analysis results
    this.conventions = {
      codeStyle: {},
      naming: {},
      imports: {},
      structure: {},
      comments: {},
      patterns: {},
      testing: {}
    };

    this.analyzedFiles = 0;
    this.totalFiles = 0;

    logger.debug('Convention analyzer initialized', {
      projectRoot: this.projectRoot,
      maxFiles: this.maxFiles
    });
  }

  /**
   * Analyze the entire project for coding conventions
   * @returns {Object} Analyzed conventions
   */
  async analyzeProject() {
    try {
      logger.info('Starting project convention analysis');

      // Find all relevant files
      const files = await this.findSourceFiles();
      this.totalFiles = files.length;

      logger.info('Found files to analyze', { count: files.length });

      // Analyze files in batches for better performance
      const batchSize = 10;
      for (let i = 0; i < files.length; i += batchSize) {
        const batch = files.slice(i, i + batchSize);
        await Promise.all(batch.map(file => this.analyzeFile(file)));
        this.analyzedFiles += batch.length;

        if (this.analyzedFiles >= this.maxFiles) {
          logger.info('Reached max files limit', { analyzed: this.analyzedFiles });
          break;
        }
      }

      // Process and summarize results
      this.summarizeConventions();

      logger.info('Project convention analysis completed', {
        filesAnalyzed: this.analyzedFiles,
        conventionsFound: Object.keys(this.conventions).length
      });

      return {
        conventions: this.conventions,
        stats: {
          filesAnalyzed: this.analyzedFiles,
          totalFiles: this.totalFiles
        }
      };

    } catch (error) {
      logger.error('Failed to analyze project conventions', { error: error.message });
      throw error;
    }
  }

  /**
   * Find all source files to analyze
   * @returns {Array} Array of file paths
   */
  async findSourceFiles() {
    const files = [];
    const supportedExtensions = this.supportedExtensions;
    const maxFileSize = this.maxFileSize;

    const scanDirectory = async (dir, depth = 0) => {
      if (depth > 5) return; // Limit depth to avoid infinite recursion

      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);

          // Skip common directories
          if (entry.isDirectory()) {
            if (!['node_modules', '.git', 'dist', 'build', '__pycache__', '.next', '.nuxt'].includes(entry.name)) {
              await scanDirectory(fullPath, depth + 1);
            }
          } else if (entry.isFile()) {
            const ext = path.extname(entry.name);
            if (supportedExtensions.includes(ext)) {
              const stats = await fs.stat(fullPath);
              if (stats.size <= maxFileSize) {
                files.push(fullPath);
              }
            }
          }
        }
      } catch (error) {
        // Skip directories we can't read
      }
    };

    await scanDirectory(this.projectRoot);
    return files;
  }

  /**
   * Analyze a single file for coding conventions
   * @param {string} filePath - Path to the file
   */
  async analyzeFile(filePath) {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      const lines = content.split('\n');
      const extension = path.extname(filePath);
      const language = this.getLanguageFromExtension(extension);

      // Analyze different aspects
      this.analyzeCodeStyle(content, lines, language);
      this.analyzeNaming(content, language);
      this.analyzeImports(content, language);
      this.analyzeStructure(content, lines, language);
      this.analyzeComments(content, lines, language);
      this.analyzePatterns(content, language);
      this.analyzeTesting(content, filePath, language);

    } catch (error) {
      logger.debug('Failed to analyze file', { filePath, error: error.message });
    }
  }

  /**
   * Analyze code style preferences
   * @param {string} content - File content
   * @param {Array} lines - File lines
   * @param {string} language - Programming language
   */
  analyzeCodeStyle(content, lines, language) {
    const style = this.conventions.codeStyle;

    // Indentation analysis
    if (!style.indentation) style.indentation = { spaces: 0, tabs: 0 };

    lines.forEach(line => {
      const trimmed = line.trim();
      if (trimmed && trimmed !== line) {
        const indent = line.length - line.trimStart().length;
        if (line.startsWith(' ')) {
          style.indentation.spaces++;
        } else if (line.startsWith('\t')) {
          style.indentation.tabs++;
        }
      }
    });

    // Quote style analysis
    if (!style.quotes) style.quotes = { single: 0, double: 0, backticks: 0 };

    const singleQuotes = (content.match(/'/g) || []).length;
    const doubleQuotes = (content.match(/"/g) || []).length;
    const backticks = (content.match(/`/g) || []).length;

    style.quotes.single += singleQuotes;
    style.quotes.double += doubleQuotes;
    style.quotes.backticks += backticks;

    // Semicolon usage
    if (!style.semicolons) style.semicolons = { used: 0, omitted: 0 };

    const semicolons = (content.match(/;/g) || []).length;
    style.semicolons.used += semicolons;

    // Count statements that could have semicolons
    const statements = content.match(/[a-zA-Z_$][a-zA-Z0-9_$]*\s*[=+\-*/]\s*[^;]*$/gm) || [];
    style.semicolons.omitted += statements.length;

    // Trailing commas
    if (!style.trailingCommas) style.trailingCommas = { used: 0, omitted: 0 };

    const trailingCommas = (content.match(/,(\s*[}\]])/g) || []).length;
    const potentialTrailing = (content.match(/[^,]\s*[}\]]/g) || []).length;

    style.trailingCommas.used += trailingCommas;
    style.trailingCommas.omitted += potentialTrailing;

    // Line length preferences
    if (!style.lineLength) style.lineLength = { lengths: [] };

    lines.forEach(line => {
      style.lineLength.lengths.push(line.length);
    });
  }

  /**
   * Analyze naming conventions
   * @param {string} content - File content
   * @param {string} language - Programming language
   */
  analyzeNaming(content, language) {
    const naming = this.conventions.naming;

    if (!naming.variables) naming.variables = { camelCase: 0, PascalCase: 0, snake_case: 0, UPPER_CASE: 0 };
    if (!naming.functions) naming.functions = { camelCase: 0, PascalCase: 0, snake_case: 0 };
    if (!naming.classes) naming.classes = { PascalCase: 0, camelCase: 0 };

    // Extract identifiers based on language
    let identifiers = [];

    if (language === 'javascript' || language === 'typescript') {
      // Match variable declarations, function names, etc.
      const matches = content.match(/(?:const|let|var|function)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g) || [];
      identifiers = matches.map(match => match.split(/\s+/)[1]);
    } else if (language === 'python') {
      // Match variable and function assignments
      const matches = content.match(/([a-zA-Z_][a-zA-Z0-9_]*)\s*=/g) || [];
      identifiers = matches.map(match => match.split(/\s*=/)[0]);
    }

    // Classify naming patterns
    identifiers.forEach(id => {
      if (this.isCamelCase(id)) {
        naming.variables.camelCase++;
        naming.functions.camelCase++;
      } else if (this.isPascalCase(id)) {
        naming.variables.PascalCase++;
        naming.functions.PascalCase++;
        naming.classes.PascalCase++;
      } else if (this.isSnakeCase(id)) {
        naming.variables.snake_case++;
        naming.functions.snake_case++;
      } else if (this.isUpperCase(id)) {
        naming.variables.UPPER_CASE++;
      }
    });
  }

  /**
   * Analyze import/export patterns
   * @param {string} content - File content
   * @param {string} language - Programming language
   */
  analyzeImports(content, language) {
    const imports = this.conventions.imports;

    if (!imports.style) imports.style = { named: 0, default: 0, namespace: 0 };

    if (language === 'javascript' || language === 'typescript') {
      // ES6 imports
      const namedImports = (content.match(/import\s*{\s*[^}]+}\s*from/g) || []).length;
      const defaultImports = (content.match(/import\s+[a-zA-Z_$][a-zA-Z0-9_$]*\s+from/g) || []).length;
      const namespaceImports = (content.match(/import\s*\*\s*as\s+[a-zA-Z_$]/g) || []).length;

      imports.style.named += namedImports;
      imports.style.default += defaultImports;
      imports.style.namespace += namespaceImports;

      // Import organization
      if (!imports.organization) imports.organization = { grouped: 0, alphabetical: 0 };

      const importLines = content.split('\n').filter(line => line.trim().startsWith('import'));
      if (importLines.length > 1) {
        // Check if imports are grouped
        let currentGroup = [];
        let groups = 0;

        importLines.forEach(line => {
          if (line.trim()) {
            currentGroup.push(line);
          } else if (currentGroup.length > 0) {
            groups++;
            currentGroup = [];
          }
        });

        if (groups > 0) imports.organization.grouped++;
      }
    }
  }

  /**
   * Analyze code structure patterns
   * @param {string} content - File content
   * @param {Array} lines - File lines
   * @param {string} language - Programming language
   */
  analyzeStructure(content, lines, language) {
    const structure = this.conventions.structure;

    if (!structure.exports) structure.exports = { named: 0, default: 0 };

    if (language === 'javascript' || language === 'typescript') {
      const namedExports = (content.match(/export\s+(?:const|let|var|function|class)/g) || []).length;
      const defaultExports = (content.match(/export\s+default/g) || []).length;

      structure.exports.named += namedExports;
      structure.exports.default += defaultExports;
    }

    // Function length analysis
    if (!structure.functionLength) structure.functionLength = { lengths: [] };

    if (language === 'javascript' || language === 'typescript') {
      const functionMatches = content.match(/function\s+\w+\s*\([^)]*\)\s*{[^}]*}/g) || [];
      functionMatches.forEach(func => {
        const lines = func.split('\n').length;
        structure.functionLength.lengths.push(lines);
      });
    }
  }

  /**
   * Analyze comment patterns
   * @param {string} content - File content
   * @param {Array} lines - File lines
   * @param {string} language - Programming language
   */
  analyzeComments(content, lines, language) {
    const comments = this.conventions.comments;

    if (!comments.style) comments.style = { singleLine: 0, multiLine: 0, jsdoc: 0 };

    // Single line comments
    const singleLine = (content.match(/(?:\/\/|#)/g) || []).length;
    comments.style.singleLine += singleLine;

    // Multi-line comments
    const multiLine = (content.match(/\/\*/g) || []).length;
    comments.style.multiLine += multiLine;

    // JSDoc comments
    const jsdoc = (content.match(/\/\*\*/g) || []).length;
    comments.style.jsdoc += jsdoc;

    // Comment density
    if (!comments.density) comments.density = { totalLines: 0, commentLines: 0 };

    comments.density.totalLines += lines.length;
    comments.density.commentLines += lines.filter(line =>
      line.trim().match(/^(?:\/\/|#|\/\*|\*)/)
    ).length;
  }

  /**
   * Analyze code patterns and idioms
   * @param {string} content - File content
   * @param {string} language - Programming language
   */
  analyzePatterns(content, language) {
    const patterns = this.conventions.patterns;

    if (!patterns.errorHandling) patterns.errorHandling = { tryCatch: 0, promises: 0, asyncAwait: 0 };

    if (language === 'javascript' || language === 'typescript') {
      const tryCatch = (content.match(/try\s*{/g) || []).length;
      const asyncFunctions = (content.match(/async\s+function/g) || []).length;
      const awaitUsage = (content.match(/await\s+/g) || []).length;

      patterns.errorHandling.tryCatch += tryCatch;
      patterns.errorHandling.asyncAwait += asyncFunctions + awaitUsage;
    }

    // Arrow functions vs regular functions
    if (!patterns.functions) patterns.functions = { arrow: 0, regular: 0 };

    if (language === 'javascript' || language === 'typescript') {
      const arrowFunctions = (content.match(/=>\s*{/g) || []).length;
      const regularFunctions = (content.match(/function\s+\w+\s*\(/g) || []).length;

      patterns.functions.arrow += arrowFunctions;
      patterns.functions.regular += regularFunctions;
    }
  }

  /**
   * Analyze testing patterns
   * @param {string} content - File content
   * @param {string} filePath - File path
   * @param {string} language - Programming language
   */
  analyzeTesting(content, filePath, language) {
    const testing = this.conventions.testing;

    if (!testing.frameworks) testing.frameworks = { jest: 0, mocha: 0, jasmine: 0, pytest: 0 };

    // Detect test files and frameworks
    const fileName = path.basename(filePath).toLowerCase();

    if (fileName.includes('test') || fileName.includes('spec')) {
      if (content.includes('describe(') && content.includes('it(')) {
        if (content.includes('jest')) testing.frameworks.jest++;
        else if (content.includes('mocha')) testing.frameworks.mocha++;
        else testing.frameworks.jasmine++; // Default to jasmine for describe/it syntax
      }

      if (language === 'python' && content.includes('def test_')) {
        testing.frameworks.pytest++;
      }
    }
  }

  /**
   * Summarize and finalize convention analysis
   */
  summarizeConventions() {
    // Calculate preferences based on majority usage
    this.calculatePreferences();

    // Calculate averages and statistics
    this.calculateStatistics();

    logger.debug('Conventions summarized', {
      codeStyle: Object.keys(this.conventions.codeStyle),
      naming: Object.keys(this.conventions.naming),
      patterns: Object.keys(this.conventions.patterns)
    });
  }

  /**
   * Calculate preference recommendations based on majority usage
   */
  calculatePreferences() {
    const prefs = {};

    // Indentation preference
    const indent = this.conventions.codeStyle.indentation;
    if (indent) {
      prefs.indentation = indent.spaces > indent.tabs ? 'spaces' : 'tabs';
    }

    // Quote preference
    const quotes = this.conventions.codeStyle.quotes;
    if (quotes) {
      const max = Math.max(quotes.single, quotes.double, quotes.backticks);
      if (max === quotes.single) prefs.quotes = 'single';
      else if (max === quotes.double) prefs.quotes = 'double';
      else prefs.quotes = 'backticks';
    }

    // Semicolon preference
    const semicolons = this.conventions.codeStyle.semicolons;
    if (semicolons) {
      prefs.semicolons = semicolons.used > semicolons.omitted ? 'required' : 'optional';
    }

    // Naming preferences
    const naming = this.conventions.naming;
    if (naming && naming.variables) {
      const varStyle = Object.entries(naming.variables)
        .sort(([,a], [,b]) => b - a)[0][0];
      prefs.variableNaming = varStyle;
    }

    this.conventions.preferences = prefs;
  }

  /**
   * Calculate statistical summaries
   */
  calculateStatistics() {
    const stats = {};

    // Average line length
    const lengths = this.conventions.codeStyle.lineLength?.lengths || [];
    if (lengths.length > 0) {
      stats.avgLineLength = Math.round(lengths.reduce((a, b) => a + b, 0) / lengths.length);
      stats.maxLineLength = Math.max(...lengths);
    }

    // Comment density
    const density = this.conventions.comments.density;
    if (density && density.totalLines > 0) {
      stats.commentDensity = Math.round((density.commentLines / density.totalLines) * 100);
    }

    // Average function length
    const funcLengths = this.conventions.structure.functionLength?.lengths || [];
    if (funcLengths.length > 0) {
      stats.avgFunctionLength = Math.round(funcLengths.reduce((a, b) => a + b, 0) / funcLengths.length);
    }

    this.conventions.statistics = stats;
  }

  /**
   * Helper: Check if identifier is camelCase
   * @param {string} id - Identifier to check
   * @returns {boolean} True if camelCase
   */
  isCamelCase(id) {
    return /^[a-z][a-zA-Z0-9]*$/.test(id) && id !== id.toUpperCase();
  }

  /**
   * Helper: Check if identifier is PascalCase
   * @param {string} id - Identifier to check
   * @returns {boolean} True if PascalCase
   */
  isPascalCase(id) {
    return /^[A-Z][a-zA-Z0-9]*$/.test(id);
  }

  /**
   * Helper: Check if identifier is snake_case
   * @param {string} id - Identifier to check
   * @returns {boolean} True if snake_case
   */
  isSnakeCase(id) {
    return /^[a-z][a-z0-9_]*$/.test(id);
  }

  /**
   * Helper: Check if identifier is UPPER_CASE
   * @param {string} id - Identifier to check
   * @returns {boolean} True if UPPER_CASE
   */
  isUpperCase(id) {
    return /^[A-Z][A-Z0-9_]*$/.test(id);
  }

  /**
   * Get language from file extension
   * @param {string} ext - File extension
   * @returns {string} Language name
   */
  getLanguageFromExtension(ext) {
    const mapping = {
      '.js': 'javascript',
      '.ts': 'typescript',
      '.jsx': 'javascript',
      '.tsx': 'typescript',
      '.py': 'python',
      '.java': 'java'
    };
    return mapping[ext] || 'unknown';
  }

  /**
   * Generate a human-readable report of conventions
   * @returns {string} Formatted report
   */
  generateReport() {
    const conv = this.conventions;
    let report = '📋 Project Coding Conventions Analysis\n';
    report += '='.repeat(40) + '\n\n';

    // Code Style
    if (conv.codeStyle.indentation) {
      const indent = conv.codeStyle.indentation;
      report += `🔸 Indentation: ${indent.spaces > indent.tabs ? 'Spaces' : 'Tabs'}\n`;
    }

    if (conv.codeStyle.quotes) {
      const quotes = conv.codeStyle.quotes;
      const max = Math.max(quotes.single, quotes.double, quotes.backticks);
      let quoteStyle = 'Mixed';
      if (max === quotes.single) quoteStyle = 'Single quotes';
      else if (max === quotes.double) quoteStyle = 'Double quotes';
      else if (max === quotes.backticks) quoteStyle = 'Backticks';
      report += `🔸 Quotes: ${quoteStyle}\n`;
    }

    if (conv.preferences) {
      report += `🔸 Semicolons: ${conv.preferences.semicolons || 'Mixed'}\n`;
      report += `🔸 Variable Naming: ${conv.preferences.variableNaming || 'Mixed'}\n`;
    }

    // Statistics
    if (conv.statistics) {
      const stats = conv.statistics;
      if (stats.avgLineLength) {
        report += `🔸 Average Line Length: ${stats.avgLineLength} characters\n`;
      }
      if (stats.commentDensity !== undefined) {
        report += `🔸 Comment Density: ${stats.commentDensity}%\n`;
      }
    }

    report += `\n📊 Analysis based on ${this.analyzedFiles} files\n`;

    return report;
  }
}
