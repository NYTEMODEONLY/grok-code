import fs from 'fs';
import path from 'path';
import { astParser } from './ast-parser.js';
import { symbolExtractor } from './symbol-extractor.js';

/**
 * Dependency Graph Engine - Import/Export Relationship Mapper
 * Builds comprehensive dependency graphs from codebase analysis
 */
export class DependencyMapper {
  constructor() {
    this.cache = new Map(); // Cache for parsed dependencies
    this.dependencyGraph = new Map(); // File -> dependencies mapping
    this.reverseGraph = new Map(); // File -> files that depend on it
    this.symbolTable = new Map(); // Global symbol registry
  }

  /**
   * Build dependency graph for a directory or set of files
   * @param {string|string[]} inputPaths - Directory path(s) or file path(s) to analyze
   * @param {Object} options - Configuration options
   * @returns {Object} Complete dependency analysis
   */
  async buildDependencyGraph(inputPaths, options = {}) {
    const {
      includePatterns = ['**/*.{js,ts,jsx,tsx,py}'],
      excludePatterns = ['**/node_modules/**', '**/.git/**', '**/dist/**', '**/build/**'],
      maxDepth = 10,
      followSymlinks = false,
      cacheEnabled = true,
    } = options;

    // Normalize input paths
    const paths = Array.isArray(inputPaths) ? inputPaths : [inputPaths];
    const files = await this.collectFiles(paths, { includePatterns, excludePatterns });

    console.log(`Analyzing ${files.length} files for dependencies...`);

    // Process each file
    const results = [];
    for (const filePath of files) {
      try {
        const result = await this.analyzeFileDependencies(filePath, { cacheEnabled });
        results.push(result);
      } catch (error) {
        console.warn(`Failed to analyze ${filePath}: ${error.message}`);
        results.push({
          filePath,
          error: error.message,
          symbols: null,
          dependencies: [],
          dependents: [],
        });
      }
    }

    // Build global dependency graph
    this.buildGlobalGraph(results);

    return {
      files: results,
      graph: {
        dependencies: Object.fromEntries(this.dependencyGraph),
        dependents: Object.fromEntries(this.reverseGraph),
      },
      symbols: Object.fromEntries(this.symbolTable),
      metadata: {
        totalFiles: files.length,
        analyzedFiles: results.filter(r => !r.error).length,
        totalDependencies: this.dependencyGraph.size,
        analysisTime: Date.now(),
        options: { includePatterns, excludePatterns, maxDepth, followSymlinks },
      },
    };
  }

  /**
   * Analyze dependencies for a single file
   * @param {string} filePath - Path to the file to analyze
   * @param {Object} options - Analysis options
   * @returns {Object} File dependency analysis
   */
  async analyzeFileDependencies(filePath, options = {}) {
    const { cacheEnabled = true } = options;

    // Check cache first
    if (cacheEnabled && this.cache.has(filePath)) {
      const cached = this.cache.get(filePath);
      // Check if file has been modified since caching
      const stats = fs.statSync(filePath);
      if (stats.mtime <= cached.timestamp) {
        return cached.data;
      }
    }

    // Parse the file using AST parser
    const astData = await astParser.parseFile(filePath);

    // Extract symbols using symbol extractor
    const symbols = symbolExtractor.extractSymbols(astData, astData.language);

    // Analyze imports and exports to determine dependencies
    const dependencies = this.extractDependencies(astData, symbols, filePath);
    const exportedSymbols = this.extractExportedSymbols(symbols);

    const result = {
      filePath,
      language: astData.language,
      symbols,
      dependencies,
      exportedSymbols,
      metadata: astData.metadata,
    };

    // Cache the result
    if (cacheEnabled) {
      this.cache.set(filePath, {
        timestamp: Date.now(),
        data: result,
      });
    }

    return result;
  }

  /**
   * Extract dependencies from AST data and symbols
   * @param {Object} astData - Parsed AST data
   * @param {Object} symbols - Extracted symbols
   * @param {string} filePath - Source file path
   * @returns {Array} Array of dependency objects
   */
  extractDependencies(astData, symbols, filePath) {
    const dependencies = [];
    const fileDir = path.dirname(filePath);

    // Process imports
    if (symbols.imports && symbols.imports.length > 0) {
      for (const importStmt of symbols.imports) {
        const resolvedPath = this.resolveImportPath(importStmt.source, fileDir, astData.language);

        if (resolvedPath) {
          dependencies.push({
            type: 'import',
            source: importStmt.source,
            resolvedPath,
            specifiers: importStmt.specifiers,
            location: importStmt.location,
            language: astData.language,
            dependencyType: this.classifyDependency(importStmt.source),
          });
        }
      }
    }

    // For Python, also check for relative imports and __init__.py files
    if (astData.language === 'python') {
      const packageDeps = this.extractPythonPackageDependencies(filePath, symbols);
      dependencies.push(...packageDeps);
    }

    return dependencies;
  }

  /**
   * Extract exported symbols from symbol data
   * @param {Object} symbols - Symbol extraction results
   * @returns {Array} Array of exported symbol names
   */
  extractExportedSymbols(symbols) {
    const exported = [];

    // Direct exports
    if (symbols.exports) {
      exported.push(...symbols.exports.map(exp => exp.name));
    }

    // Functions and classes are implicitly exportable
    if (symbols.functions) {
      exported.push(...symbols.functions.map(func => func.name));
    }

    if (symbols.classes) {
      exported.push(...symbols.classes.map(cls => cls.name));
    }

    if (symbols.types) {
      exported.push(...symbols.types.map(type => type.name));
    }

    return [...new Set(exported)]; // Remove duplicates
  }

  /**
   * Resolve import path to absolute file path
   * @param {string} importSource - Import statement source
   * @param {string} fileDir - Directory of the importing file
   * @param {string} language - Programming language
   * @returns {string|null} Resolved absolute path or null if not found
   */
  resolveImportPath(importSource, fileDir, language) {
    // Handle different types of imports
    if (this.isNodeModule(importSource)) {
      return null; // Skip node_modules
    }

    if (language === 'python') {
      return this.resolvePythonImport(importSource, fileDir);
    }

    return this.resolveJavaScriptImport(importSource, fileDir);
  }

  /**
   * Resolve JavaScript/TypeScript import paths
   * @param {string} importSource - Import source
   * @param {string} fileDir - File directory
   * @returns {string|null} Resolved path
   */
  resolveJavaScriptImport(importSource, fileDir) {
    // Handle relative imports
    if (importSource.startsWith('./') || importSource.startsWith('../')) {
      const resolvedPath = path.resolve(fileDir, importSource);

      // Try different extensions
      const extensions = ['.js', '.ts', '.jsx', '.tsx', '.mjs', '.cjs'];
      for (const ext of extensions) {
        const fullPath = resolvedPath + ext;
        if (fs.existsSync(fullPath)) {
          return fullPath;
        }

        // Try index files in directories
        const indexPath = path.join(resolvedPath, 'index' + ext);
        if (fs.existsSync(indexPath)) {
          return indexPath;
        }
      }

      // Check if it's a directory with index file
      if (fs.existsSync(resolvedPath) && fs.statSync(resolvedPath).isDirectory()) {
        for (const ext of extensions) {
          const indexPath = path.join(resolvedPath, 'index' + ext);
          if (fs.existsSync(indexPath)) {
            return indexPath;
          }
        }
      }
    }

    // Handle absolute imports (project root relative)
    if (importSource.startsWith('/')) {
      // This would need project root configuration
      return null;
    }

    return null; // Cannot resolve
  }

  /**
   * Resolve Python import paths
   * @param {string} importSource - Import source
   * @param {string} fileDir - File directory
   * @returns {string|null} Resolved path
   */
  resolvePythonImport(importSource, fileDir) {
    // Handle relative imports
    if (importSource.startsWith('.')) {
      const parts = importSource.split('.');
      let currentDir = fileDir;

      // Navigate up directories for each leading dot
      for (let i = 1; i < parts.length && parts[i] === ''; i++) {
        currentDir = path.dirname(currentDir);
      }

      // Build path from remaining parts
      const relativePath = parts.filter(p => p !== '').join('/');
      const fullPath = path.join(currentDir, relativePath + '.py');

      if (fs.existsSync(fullPath)) {
        return fullPath;
      }

      // Check for __init__.py in directory
      const initPath = path.join(currentDir, relativePath, '__init__.py');
      if (fs.existsSync(initPath)) {
        return initPath;
      }
    }

    // Handle absolute imports - would need PYTHONPATH knowledge
    // For now, return null as we can't resolve without full Python path setup
    return null;
  }

  /**
   * Extract Python-specific package dependencies
   * @param {string} filePath - Python file path
   * @param {Object} symbols - Extracted symbols
   * @returns {Array} Package dependencies
   */
  extractPythonPackageDependencies(filePath, symbols) {
    const dependencies = [];
    const fileDir = path.dirname(filePath);

    // Check for __init__.py in parent directories (package membership)
    let currentDir = fileDir;
    while (currentDir !== path.dirname(currentDir)) {
      const initPath = path.join(currentDir, '__init__.py');
      if (fs.existsSync(initPath)) {
        dependencies.push({
          type: 'package',
          source: path.relative(fileDir, initPath),
          resolvedPath: initPath,
          specifiers: [],
          dependencyType: 'internal',
        });
        break;
      }
      currentDir = path.dirname(currentDir);
    }

    return dependencies;
  }

  /**
   * Classify dependency type
   * @param {string} importSource - Import source string
   * @returns {string} Dependency classification
   */
  classifyDependency(importSource) {
    if (this.isNodeModule(importSource)) {
      return 'external';
    }

    if (importSource.startsWith('./') || importSource.startsWith('../')) {
      return 'internal';
    }

    if (importSource.startsWith('@/') || importSource.startsWith('~/')) {
      return 'alias';
    }

    return 'unknown';
  }

  /**
   * Check if import source is a node module
   * @param {string} importSource - Import source
   * @returns {boolean} True if node module
   */
  isNodeModule(importSource) {
    // Common patterns for external dependencies
    return !importSource.startsWith('.') &&
           !importSource.startsWith('/') &&
           !importSource.includes('./') &&
           !importSource.includes('../');
  }

  /**
   * Build global dependency graph from individual file analyses
   * @param {Array} fileResults - Results from individual file analyses
   */
  buildGlobalGraph(fileResults) {
    // Clear existing graphs
    this.dependencyGraph.clear();
    this.reverseGraph.clear();
    this.symbolTable.clear();

    // Build forward dependencies (file -> dependencies)
    for (const result of fileResults) {
      if (result.error) continue;

      const deps = result.dependencies
        .filter(dep => dep.resolvedPath) // Only resolved dependencies
        .map(dep => ({
          path: dep.resolvedPath,
          type: dep.type,
          dependencyType: dep.dependencyType,
        }));

      this.dependencyGraph.set(result.filePath, deps);

      // Register exported symbols
      if (result.exportedSymbols && result.exportedSymbols.length > 0) {
        this.symbolTable.set(result.filePath, result.exportedSymbols);
      }
    }

    // Build reverse dependencies (file -> files that depend on it)
    for (const [filePath, deps] of this.dependencyGraph) {
      for (const dep of deps) {
        if (!this.reverseGraph.has(dep.path)) {
          this.reverseGraph.set(dep.path, []);
        }
        this.reverseGraph.get(dep.path).push({
          path: filePath,
          type: dep.type,
          dependencyType: dep.dependencyType,
        });
      }
    }
  }

  /**
   * Collect all files matching patterns from input paths
   * @param {string[]} inputPaths - Input directory/file paths
   * @param {Object} options - Collection options
   * @returns {string[]} Array of file paths
   */
  async collectFiles(inputPaths, options) {
    const { includePatterns, excludePatterns } = options;
    const files = [];

    for (const inputPath of inputPaths) {
      if (fs.existsSync(inputPath)) {
        const stats = fs.statSync(inputPath);

        if (stats.isDirectory()) {
          // Recursively collect files from directory
          const dirFiles = await this.collectFromDirectory(inputPath, includePatterns, excludePatterns);
          files.push(...dirFiles);
        } else if (stats.isFile()) {
          // Single file
          if (this.matchesPatterns(inputPath, includePatterns, excludePatterns)) {
            files.push(inputPath);
          }
        }
      }
    }

    return files;
  }

  /**
   * Recursively collect files from directory
   * @param {string} dirPath - Directory path
   * @param {string[]} includePatterns - Glob patterns to include
   * @param {string[]} excludePatterns - Glob patterns to exclude
   * @returns {string[]} Array of matching file paths
   */
  async collectFromDirectory(dirPath, includePatterns, excludePatterns) {
    const files = [];

    try {
      const entries = fs.readdirSync(dirPath);

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry);
        const stats = fs.statSync(fullPath);

        if (stats.isDirectory()) {
          // Skip excluded directories
          if (!this.matchesExcludePatterns(fullPath, excludePatterns)) {
            const subFiles = await this.collectFromDirectory(fullPath, includePatterns, excludePatterns);
            files.push(...subFiles);
          }
        } else if (stats.isFile()) {
          if (this.matchesPatterns(fullPath, includePatterns, excludePatterns)) {
            files.push(fullPath);
          }
        }
      }
    } catch (error) {
      console.warn(`Failed to read directory ${dirPath}: ${error.message}`);
    }

    return files;
  }

  /**
   * Check if path matches include/exclude patterns
   * @param {string} filePath - File path to check
   * @param {string[]} includePatterns - Patterns to include
   * @param {string[]} excludePatterns - Patterns to exclude
   * @returns {boolean} True if should be included
   */
  matchesPatterns(filePath, includePatterns, excludePatterns) {
    // Check exclude patterns first
    if (this.matchesExcludePatterns(filePath, excludePatterns)) {
      return false;
    }

    // Check include patterns
    for (const pattern of includePatterns) {
      if (this.matchesGlobPattern(filePath, pattern)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check if path matches exclude patterns
   * @param {string} filePath - File path to check
   * @param {string[]} excludePatterns - Patterns to exclude
   * @returns {boolean} True if should be excluded
   */
  matchesExcludePatterns(filePath, excludePatterns) {
    for (const pattern of excludePatterns) {
      if (this.matchesGlobPattern(filePath, pattern)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Simple glob pattern matching (basic implementation)
   * @param {string} filePath - File path
   * @param {string} pattern - Glob pattern
   * @returns {boolean} True if matches
   */
  matchesGlobPattern(filePath, pattern) {
    // Normalize path separators
    const normalizedPath = filePath.replace(/\\/g, '/');

    // Convert glob to regex (basic implementation)
    let regex = pattern
      .replace(/\*\*/g, '.*')  // ** matches any characters recursively
      .replace(/\*/g, '[^/]*') // * matches any characters except /
      .replace(/\?/g, '.')     // ? matches any single character
      .replace(/\./g, '\\.')   // Escape dots
      .replace(/\{[^}]*\}/g, (match) => { // Handle {a,b,c} patterns
        const options = match.slice(1, -1).split(',');
        return `(${options.join('|')})`;
      });

    // If pattern starts with **/, make it match anywhere in the path
    if (pattern.startsWith('**/')) {
      regex = regex.substring(2); // Remove the leading .*
      const fullRegex = new RegExp(regex);
      return fullRegex.test(normalizedPath);
    }

    // For other patterns, match from the end of the path (basename matching)
    if (pattern.includes('*') && !pattern.includes('/')) {
      // Pattern like *.js - match basename
      const baseName = path.basename(normalizedPath);
      const fullRegex = new RegExp(`^${regex}$`);
      return fullRegex.test(baseName);
    }

    // Default: exact match
    const fullRegex = new RegExp(`^${regex}$`);
    return fullRegex.test(normalizedPath);
  }

  /**
   * Get dependency statistics
   * @returns {Object} Dependency statistics
   */
  getStatistics() {
    const stats = {
      totalFiles: this.dependencyGraph.size,
      totalDependencies: Array.from(this.dependencyGraph.values()).reduce((sum, deps) => sum + deps.length, 0),
      filesByDependencyCount: {},
      mostDependedOn: [],
    };

    // Count dependencies per file
    for (const [file, deps] of this.dependencyGraph) {
      const count = deps.length;
      if (!stats.filesByDependencyCount[count]) {
        stats.filesByDependencyCount[count] = [];
      }
      stats.filesByDependencyCount[count].push(file);
    }

    // Find most depended on files
    const dependentCounts = new Map();
    for (const dependents of this.reverseGraph.values()) {
      for (const dep of dependents) {
        dependentCounts.set(dep.path, (dependentCounts.get(dep.path) || 0) + 1);
      }
    }

    stats.mostDependedOn = Array.from(dependentCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    return stats;
  }

  /**
   * Clear all caches and graphs
   */
  clear() {
    this.cache.clear();
    this.dependencyGraph.clear();
    this.reverseGraph.clear();
    this.symbolTable.clear();
  }

  /**
   * Export dependency graph in various formats
   * @param {string} format - Export format ('json', 'dot', 'csv')
   * @returns {string} Formatted output
   */
  exportGraph(format = 'json') {
    switch (format.toLowerCase()) {
      case 'json':
        return JSON.stringify({
          dependencies: Object.fromEntries(this.dependencyGraph),
          dependents: Object.fromEntries(this.reverseGraph),
          symbols: Object.fromEntries(this.symbolTable),
        }, null, 2);

      case 'dot':
        return this.exportAsDot();

      case 'csv':
        return this.exportAsCsv();

      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  /**
   * Export as GraphViz DOT format
   * @returns {string} DOT format string
   */
  exportAsDot() {
    let dot = 'digraph dependencies {\n';
    dot += '  rankdir=LR;\n';
    dot += '  node [shape=box];\n\n';

    // Add nodes
    for (const filePath of this.dependencyGraph.keys()) {
      const label = path.basename(filePath);
      dot += `  "${filePath}" [label="${label}"];\n`;
    }

    dot += '\n';

    // Add edges
    for (const [fromFile, deps] of this.dependencyGraph) {
      for (const dep of deps) {
        dot += `  "${fromFile}" -> "${dep.path}";\n`;
      }
    }

    dot += '}\n';
    return dot;
  }

  /**
   * Export as CSV format
   * @returns {string} CSV format string
   */
  exportAsCsv() {
    let csv = 'from_file,to_file,dependency_type\n';

    for (const [fromFile, deps] of this.dependencyGraph) {
      for (const dep of deps) {
        csv += `"${fromFile}","${dep.path}","${dep.dependencyType}"\n`;
      }
    }

    return csv;
  }
}

// Export singleton instance for global use
export const dependencyMapper = new DependencyMapper();
export default dependencyMapper;
