import fs from 'fs';
import path from 'path';
import { astParser } from '../code-analysis/ast-parser.js';
import { symbolExtractor } from '../code-analysis/symbol-extractor.js';
import { dependencyMapper } from '../code-analysis/dependency-mapper.js';

/**
 * File Relevance Scoring Engine
 * Scores files by relevance to coding queries using semantic analysis
 */
export class RelevanceScorer {
  constructor() {
    this.cache = new Map(); // Cache for computed relevance scores
    this.stopWords = new Set([
      'the',
      'a',
      'an',
      'and',
      'or',
      'but',
      'in',
      'on',
      'at',
      'to',
      'for',
      'of',
      'with',
      'by',
      'is',
      'are',
      'was',
      'were',
      'be',
      'been',
      'being',
      'have',
      'has',
      'had',
      'do',
      'does',
      'did',
      'will',
      'would',
      'could',
      'should',
      'may',
      'might',
      'must',
      'can',
      'this',
      'that',
      'these',
      'those',
      'i',
      'you',
      'he',
      'she',
      'it',
      'we',
      'they',
      'me',
      'him',
      'her',
      'us',
      'them',
      'my',
      'your',
      'his',
      'its',
      'our',
      'their',
      'what',
      'when',
      'where',
      'why',
      'how',
    ]);

    this.weights = {
      exactSymbolMatch: 100, // Exact match with symbol name
      partialSymbolMatch: 50, // Partial match with symbol name
      keywordMatch: 30, // Keyword appears in file content
      dependencyDirect: 40, // Direct dependency relationship
      dependencyIndirect: 15, // Indirect dependency relationship
      pathRelevance: 25, // File path contains query terms
      fileTypeBonus: 20, // Preferred file types (.js, .ts over .json, etc.)
      recentModification: 10, // Recently modified files
      symbolDensity: 5, // Files with many relevant symbols
    };
  }

  /**
   * Score file relevance for a given query
   * @param {string} query - Coding query (e.g., "implement user authentication")
   * @param {string|string[]} filePaths - File path(s) or directory to analyze
   * @param {Object} options - Scoring options
   * @returns {Array} Sorted array of file relevance scores
   */
  async scoreFileRelevance(query, filePaths, options = {}) {
    const {
      maxFiles = 50,
      includeDependencies = true,
      cacheEnabled = true,
      minScore = 0,
    } = options;

    // Parse and normalize the query
    const queryTerms = this.parseQuery(query);

    // Build dependency graph if needed
    let dependencyGraph = null;
    if (includeDependencies) {
      const depResult = await dependencyMapper.buildDependencyGraph(filePaths, {
        includePatterns: ['**/*.{js,ts,jsx,tsx,py}'],
        excludePatterns: [
          '**/node_modules/**',
          '**/.git/**',
          '**/dist/**',
          '**/build/**',
        ],
      });
      dependencyGraph = depResult.graph ? depResult.graph.dependencies : null;
    }

    // Get all relevant files
    const files = await this.collectFiles(filePaths);

    // Score each file
    const scoredFiles = [];
    for (const filePath of files) {
      try {
        const score = await this.scoreSingleFile(
          filePath,
          queryTerms,
          dependencyGraph,
          { cacheEnabled }
        );
        if (score.total >= minScore) {
          scoredFiles.push({
            filePath,
            score,
            shortName: this.getShortName(filePath),
            language: this.detectLanguage(filePath),
          });
        }
      } catch (error) {
        console.warn(`Failed to score ${filePath}: ${error.message}`);
      }
    }

    // Sort by total score (descending)
    scoredFiles.sort((a, b) => b.score.total - a.score.total);

    return scoredFiles.slice(0, maxFiles);
  }

  /**
   * Score a single file's relevance to a query
   * @param {string} filePath - Path to the file
   * @param {Array} queryTerms - Parsed query terms
   * @param {Map} dependencyGraph - Dependency graph (optional)
   * @param {Object} options - Scoring options
   * @returns {Object} Detailed relevance score
   */
  async scoreSingleFile(
    filePath,
    queryTerms,
    dependencyGraph = null,
    options = {}
  ) {
    const { cacheEnabled = true } = options;

    // Check cache first
    const cacheKey = `${filePath}:${queryTerms.join(',')}`;
    if (cacheEnabled && this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    let score = {
      symbolMatches: 0,
      keywordMatches: 0,
      dependencyScore: 0,
      pathScore: 0,
      typeScore: 0,
      recencyScore: 0,
      densityScore: 0,
      total: 0,
      factors: [],
    };

    try {
      // Analyze file content and symbols
      const astData = await astParser.parseFile(filePath);
      const symbols = symbolExtractor.extractSymbols(astData, astData.language);

      // 1. Symbol-based scoring (highest weight)
      const symbolScore = this.scoreSymbolRelevance(symbols, queryTerms);
      score.symbolMatches = symbolScore.score;
      score.densityScore = symbolScore.densityBonus;
      if (symbolScore.score > 0) {
        score.factors.push(`Symbols: ${symbolScore.matches.join(', ')}`);
      }

      // 2. Content keyword matching
      const contentScore = this.scoreContentRelevance(filePath, queryTerms);
      score.keywordMatches = contentScore;
      if (contentScore > 0) {
        score.factors.push(`Keywords: ${queryTerms.slice(0, 3).join(', ')}`);
      }

      // 3. Dependency relationship scoring
      if (dependencyGraph) {
        const depScore = this.scoreDependencyRelevance(
          filePath,
          queryTerms,
          dependencyGraph
        );
        score.dependencyScore = depScore;
        if (depScore > 0) {
          score.factors.push('Dependency relationships');
        }
      }

      // 4. Path relevance scoring
      const pathScore = this.scorePathRelevance(filePath, queryTerms);
      score.pathScore = pathScore;
      if (pathScore > 0) {
        score.factors.push('Path relevance');
      }

      // 5. File type bonus
      const typeScore = this.scoreFileType(filePath);
      score.typeScore = typeScore;

      // 6. Recency bonus (recently modified files)
      const recencyScore = this.scoreRecency(filePath);
      score.recencyScore = recencyScore;
      if (recencyScore > 0) {
        score.factors.push('Recently modified');
      }

      // Calculate total score
      score.total = Math.round(
        score.symbolMatches * (this.weights.exactSymbolMatch / 100) +
          score.keywordMatches * (this.weights.keywordMatch / 100) +
          score.dependencyScore +
          score.pathScore +
          score.typeScore +
          score.recencyScore +
          score.densityScore
      );

      // Cache the result
      if (cacheEnabled) {
        this.cache.set(cacheKey, score);
      }
    } catch (error) {
      console.warn(`Error scoring ${filePath}: ${error.message}`);
      score.total = 0;
      score.factors = ['Error analyzing file'];
    }

    return score;
  }

  /**
   * Parse and normalize a coding query into searchable terms
   * @param {string} query - Raw query string
   * @returns {Array} Normalized query terms
   */
  parseQuery(query) {
    return (
      query
        .toLowerCase()
        // Split on common separators
        .split(/[\s\-_]+/)
        // Remove stop words and short terms
        .filter((term) => term.length > 2 && !this.stopWords.has(term))
        // Remove special characters
        .map((term) => term.replace(/[^\w]/g, ''))
        // Remove duplicates
        .filter((term, index, arr) => arr.indexOf(term) === index)
    );
  }

  /**
   * Score relevance based on symbol matches
   * @param {Object} symbols - Extracted symbols
   * @param {Array} queryTerms - Query terms
   * @returns {Object} Symbol relevance score and matches
   */
  scoreSymbolRelevance(symbols, queryTerms) {
    let score = 0;
    let densityBonus = 0;
    const matches = [];
    const matchedSymbols = new Set();

    // Check all symbol types
    const symbolTypes = ['functions', 'classes', 'variables', 'types'];

    for (const type of symbolTypes) {
      if (!symbols[type]) continue;

      for (const symbol of symbols[type]) {
        const symbolName = symbol.name?.toLowerCase() || '';
        if (!symbolName) continue;

        // Exact matches (highest score)
        for (const term of queryTerms) {
          if (symbolName === term) {
            score += this.weights.exactSymbolMatch;
            matches.push(symbol.name);
            matchedSymbols.add(symbol.name);
          }
          // Partial matches
          else if (symbolName.includes(term) || term.includes(symbolName)) {
            score += this.weights.partialSymbolMatch;
            if (!matchedSymbols.has(symbol.name)) {
              matches.push(symbol.name);
              matchedSymbols.add(symbol.name);
            }
          }
        }
      }
    }

    // Density bonus: files with multiple relevant symbols get extra points
    const uniqueMatches = matchedSymbols.size;
    if (uniqueMatches > 1) {
      densityBonus = uniqueMatches * this.weights.symbolDensity;
    }

    return { score, matches: [...matchedSymbols], densityBonus };
  }

  /**
   * Score relevance based on content keyword matching
   * @param {string} filePath - File path
   * @param {Array} queryTerms - Query terms
   * @returns {number} Content relevance score
   */
  scoreContentRelevance(filePath, queryTerms) {
    try {
      const content = fs.readFileSync(filePath, 'utf8').toLowerCase();
      let score = 0;

      for (const term of queryTerms) {
        // Count occurrences of each term
        const occurrences = (content.match(new RegExp(term, 'g')) || []).length;
        score += Math.min(occurrences * 5, 50); // Cap at 50 points per term
      }

      return score;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Score relevance based on dependency relationships
   * @param {string} filePath - File path
   * @param {Array} queryTerms - Query terms
   * @param {Map|Object} dependencyGraph - Dependency graph (can be Map or plain object)
   * @returns {number} Dependency relevance score
   */
  scoreDependencyRelevance(filePath, queryTerms, dependencyGraph) {
    if (!dependencyGraph) return 0;

    let score = 0;

    // Convert to Map if it's a plain object
    const depMap =
      dependencyGraph instanceof Map
        ? dependencyGraph
        : new Map(Object.entries(dependencyGraph));

    // Direct dependencies
    const deps = depMap.get(filePath) || [];
    for (const dep of deps) {
      // Check if dependency path contains query terms
      const depPath = dep.path.toLowerCase();
      for (const term of queryTerms) {
        if (depPath.includes(term)) {
          score += this.weights.dependencyDirect;
          break;
        }
      }
    }

    // Files that depend on this file (reverse dependencies)
    for (const [otherFile, otherDeps] of depMap) {
      for (const dep of otherDeps) {
        if (dep.path === filePath) {
          // Check if the dependent file is relevant
          const otherPath = otherFile.toLowerCase();
          for (const term of queryTerms) {
            if (otherPath.includes(term)) {
              score += this.weights.dependencyIndirect;
              break;
            }
          }
          break;
        }
      }
    }

    return score;
  }

  /**
   * Score relevance based on file path
   * @param {string} filePath - File path
   * @param {Array} queryTerms - Query terms
   * @returns {number} Path relevance score
   */
  scorePathRelevance(filePath, queryTerms) {
    const pathStr = filePath.toLowerCase();
    let score = 0;

    for (const term of queryTerms) {
      if (pathStr.includes(term)) {
        score += this.weights.pathRelevance;
      }
    }

    return score;
  }

  /**
   * Score bonus based on file type (prefer source code over config)
   * @param {string} filePath - File path
   * @returns {number} File type bonus
   */
  scoreFileType(filePath) {
    const ext = path.extname(filePath).toLowerCase();

    // Preferred source files
    if (['.js', '.ts', '.jsx', '.tsx', '.py'].includes(ext)) {
      return this.weights.fileTypeBonus;
    }

    // Neutral files
    if (['.json', '.md', '.txt'].includes(ext)) {
      return 0;
    }

    // Less preferred files
    return -5;
  }

  /**
   * Score bonus for recently modified files
   * @param {string} filePath - File path
   * @returns {number} Recency bonus
   */
  scoreRecency(filePath) {
    try {
      const stats = fs.statSync(filePath);
      const daysSinceModified =
        (Date.now() - stats.mtime.getTime()) / (1000 * 60 * 60 * 24);

      // Bonus for files modified within last 7 days
      if (daysSinceModified <= 7) {
        return this.weights.recentModification * (1 - daysSinceModified / 7);
      }

      return 0;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Collect all files from input paths
   * @param {string|string[]} inputPaths - Input paths
   * @returns {string[]} Array of file paths
   */
  async collectFiles(inputPaths) {
    const paths = Array.isArray(inputPaths) ? inputPaths : [inputPaths];
    const files = [];

    for (const inputPath of paths) {
      if (fs.existsSync(inputPath)) {
        const stats = fs.statSync(inputPath);

        if (stats.isDirectory()) {
          files.push(...this.collectFromDirectory(inputPath));
        } else if (stats.isFile()) {
          files.push(inputPath);
        }
      }
    }

    return files;
  }

  /**
   * Recursively collect files from directory
   * @param {string} dirPath - Directory path
   * @returns {string[]} File paths
   */
  collectFromDirectory(dirPath) {
    const files = [];

    try {
      const entries = fs.readdirSync(dirPath);

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry);
        const stats = fs.statSync(fullPath);

        if (stats.isDirectory()) {
          // Skip common irrelevant directories
          if (
            ![
              'node_modules',
              '.git',
              'dist',
              'build',
              '.next',
              '__pycache__',
            ].includes(entry)
          ) {
            files.push(...this.collectFromDirectory(fullPath));
          }
        } else if (stats.isFile()) {
          // Include relevant file types
          const ext = path.extname(fullPath).toLowerCase();
          if (
            ['.js', '.ts', '.jsx', '.tsx', '.py', '.json', '.md'].includes(ext)
          ) {
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
   * Detect programming language from file extension
   * @param {string} filePath - File path
   * @returns {string} Language name
   */
  detectLanguage(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const langMap = {
      '.js': 'javascript',
      '.ts': 'typescript',
      '.jsx': 'javascript',
      '.tsx': 'typescript',
      '.py': 'python',
      '.json': 'json',
      '.md': 'markdown',
    };

    return langMap[ext] || 'unknown';
  }

  /**
   * Get short filename for display
   * @param {string} filePath - Full file path
   * @returns {string} Short name
   */
  getShortName(filePath) {
    return path.basename(filePath);
  }

  /**
   * Clear the relevance cache
   */
  clearCache() {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   * @returns {Object} Cache stats
   */
  getCacheStats() {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }

  /**
   * Configure scoring weights
   * @param {Object} newWeights - New weight values
   */
  configureWeights(newWeights) {
    this.weights = { ...this.weights, ...newWeights };
  }
}

// Export singleton instance for global use
export const relevanceScorer = new RelevanceScorer();
export default relevanceScorer;
