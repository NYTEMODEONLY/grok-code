import fs from 'fs';
import path from 'path';
import { relevanceScorer } from './relevance-scorer.js';

/**
 * Context Window Optimizer
 * Optimizes file selection and content for AI context windows with token limits
 */
export class ContextWindowOptimizer {
  constructor() {
    // Token limits for different AI models (approximate)
    this.modelLimits = {
      'gpt-4': 128000, // ~128K tokens
      'gpt-4-turbo': 128000,
      'gpt-3.5-turbo': 16385, // ~16K tokens
      'claude-3-opus': 200000, // ~200K tokens
      'claude-3-sonnet': 200000,
      'claude-3-haiku': 200000,
      'gemini-pro': 32768, // ~32K tokens
      default: 8000, // Conservative default
    };

    // Content prioritization weights
    this.contentWeights = {
      functionSignatures: 1.0, // Function/class signatures
      imports: 0.8, // Import statements
      exports: 0.9, // Export statements
      comments: 0.6, // Comments and documentation
      implementation: 0.7, // Implementation code
      tests: 0.3, // Test code
      config: 0.2, // Configuration files
    };

    // File size limits (in characters)
    this.maxFileSize = 50000; // ~50KB per file
    this.maxTotalSize = 200000; // ~200KB total context
  }

  /**
   * Optimize context for a coding query
   * @param {string} query - Coding query
   * @param {string|string[]} filePaths - Files or directories to search
   * @param {Object} options - Optimization options
   * @returns {Object} Optimized context with selected files and content
   */
  async optimizeContext(query, filePaths, options = {}) {
    const {
      model = 'default',
      maxFiles = 20,
      prioritizeDepth = false, // depth vs breadth tradeoff
      includeSymbols = true,
      includeDependencies = true,
      customTokenLimit = null,
    } = options;

    const tokenLimit =
      customTokenLimit || this.modelLimits[model] || this.modelLimits.default;

    // Get relevance scores for all files
    const relevanceResults = await relevanceScorer.scoreFileRelevance(
      query,
      filePaths,
      {
        maxFiles: maxFiles * 2, // Get more candidates initially
        includeDependencies,
        minScore: 1, // Include all files with any relevance
      }
    );

    if (relevanceResults.length === 0) {
      return {
        query,
        files: [],
        totalTokens: 0,
        optimization: {
          strategy: 'no-relevant-files',
          tokenLimit,
          model,
        },
        summary: 'No relevant files found for the query.',
      };
    }

    // Optimize file selection based on strategy
    const selectedFiles = this.selectOptimalFiles(relevanceResults, {
      maxFiles,
      tokenLimit,
      prioritizeDepth,
      query,
    });

    // Extract and optimize content for selected files
    const contextFiles = [];
    let totalTokens = 0;
    let totalCharacters = 0;

    for (const file of selectedFiles) {
      try {
        const optimizedContent = await this.optimizeFileContent(
          file.filePath,
          query,
          {
            includeSymbols,
            maxSize: this.calculateFileSizeLimit(
              selectedFiles.length,
              tokenLimit
            ),
          }
        );

        if (optimizedContent.tokens > 0) {
          contextFiles.push({
            filePath: file.filePath,
            shortName: file.shortName,
            language: file.language,
            relevanceScore: file.score.total,
            content: optimizedContent.content,
            tokens: optimizedContent.tokens,
            characters: optimizedContent.characters,
            sections: optimizedContent.sections,
            optimization: optimizedContent.optimization,
          });

          totalTokens += optimizedContent.tokens;
          totalCharacters += optimizedContent.characters;
        }
      } catch (error) {
        console.warn(
          `Failed to optimize content for ${file.filePath}: ${error.message}`
        );
      }
    }

    // Sort by relevance (most relevant first)
    contextFiles.sort((a, b) => b.relevanceScore - a.relevanceScore);

    return {
      query,
      files: contextFiles,
      totalTokens,
      totalCharacters,
      optimization: {
        strategy: prioritizeDepth ? 'depth-first' : 'breadth-first',
        tokenLimit,
        model,
        maxFiles,
        selectedFiles: contextFiles.length,
        candidateFiles: relevanceResults.length,
        tokenUtilization: Math.round((totalTokens / tokenLimit) * 100),
      },
      summary: this.generateSummary(contextFiles, query),
    };
  }

  /**
   * Select optimal files based on relevance and constraints
   * @param {Array} relevanceResults - Scored files from relevance scorer
   * @param {Object} options - Selection options
   * @returns {Array} Selected files in optimal order
   */
  selectOptimalFiles(relevanceResults, options) {
    const { maxFiles, tokenLimit, prioritizeDepth, query } = options;

    if (relevanceResults.length <= maxFiles) {
      return relevanceResults;
    }

    // Apply different strategies based on query type and preferences
    if (prioritizeDepth) {
      // Depth-first: Focus on top N most relevant files
      return relevanceResults.slice(0, maxFiles);
    } else {
      // Breadth-first: Balance relevance with diversity
      return this.selectDiverseFiles(relevanceResults, maxFiles, query);
    }
  }

  /**
   * Select diverse files to balance relevance and coverage
   * @param {Array} relevanceResults - All scored files
   * @param {number} maxFiles - Maximum files to select
   * @param {string} query - Original query for context
   * @returns {Array} Diverse file selection
   */
  selectDiverseFiles(relevanceResults, maxFiles, query) {
    const selected = [];
    const queryTerms = relevanceScorer.parseQuery(query);

    // Always include top 3 most relevant files
    const topFiles = relevanceResults.slice(0, Math.min(3, maxFiles));
    selected.push(...topFiles);

    if (selected.length >= maxFiles) {
      return selected;
    }

    // Add files with different relevance factors for diversity
    const remainingFiles = relevanceResults.slice(3);
    const factorGroups = {
      symbols: [],
      dependencies: [],
      path: [],
      keywords: [],
      recency: [],
    };

    // Group remaining files by their primary relevance factor
    for (const file of remainingFiles) {
      const score = file.score;

      if (
        score.symbolMatches > score.keywordMatches &&
        score.symbolMatches > score.pathScore
      ) {
        factorGroups.symbols.push(file);
      } else if (score.dependencyScore > 20) {
        factorGroups.dependencies.push(file);
      } else if (score.pathScore > 10) {
        factorGroups.path.push(file);
      } else if (score.keywordMatches > 5) {
        factorGroups.keywords.push(file);
      } else if (score.recencyScore > 0) {
        factorGroups.recency.push(file);
      }
    }

    // Select one file from each factor group (if available)
    const factors = ['symbols', 'dependencies', 'path', 'keywords', 'recency'];
    for (const factor of factors) {
      if (selected.length >= maxFiles) break;

      const groupFiles = factorGroups[factor];
      if (groupFiles.length > 0) {
        // Take the highest scoring file from this group
        selected.push(groupFiles[0]);
      }
    }

    // Fill remaining slots with highest scoring files not yet selected
    const usedFiles = new Set(selected.map((f) => f.filePath));
    for (const file of relevanceResults) {
      if (selected.length >= maxFiles) break;
      if (!usedFiles.has(file.filePath)) {
        selected.push(file);
      }
    }

    return selected;
  }

  /**
   * Optimize content for a single file
   * @param {string} filePath - Path to the file
   * @param {string} query - Original query for context
   * @param {Object} options - Content optimization options
   * @returns {Object} Optimized content with metadata
   */
  async optimizeFileContent(filePath, query, options = {}) {
    const { includeSymbols = true, maxSize = 10000 } = options;

    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const lines = content.split('\n');

      // Extract different sections of the file
      const sections = this.extractFileSections(
        content,
        lines,
        filePath,
        query
      );

      // Prioritize and truncate content based on relevance
      const optimizedContent = this.prioritizeContent(sections, query, maxSize);

      // Estimate token count (rough approximation: 1 token ≈ 4 characters)
      const tokens = Math.ceil(optimizedContent.length / 4);

      return {
        content: optimizedContent,
        tokens,
        characters: optimizedContent.length,
        sections: sections.map((s) => ({
          type: s.type,
          lines: s.lines.length,
        })),
        optimization: {
          originalSize: content.length,
          optimizedSize: optimizedContent.length,
          compressionRatio: Math.round(
            (optimizedContent.length / content.length) * 100
          ),
          strategy: includeSymbols ? 'symbol-aware' : 'content-only',
        },
      };
    } catch (error) {
      return {
        content: '',
        tokens: 0,
        characters: 0,
        sections: [],
        optimization: { error: error.message },
      };
    }
  }

  /**
   * Extract different sections from file content
   * @param {string} content - Full file content
   * @param {Array} lines - File lines
   * @param {string} filePath - File path
   * @param {string} query - Query for relevance context
   * @returns {Array} Extracted sections
   */
  extractFileSections(content, lines, filePath, query) {
    const sections = [];
    const queryTerms = relevanceScorer.parseQuery(query);

    // Extract imports (usually at the top)
    const imports = this.extractImports(lines);
    if (imports.lines.length > 0) {
      sections.push({
        type: 'imports',
        lines: imports.lines,
        priority: this.contentWeights.imports,
        relevance: this.calculateSectionRelevance(imports.content, queryTerms),
      });
    }

    // Extract exports
    const exports = this.extractExports(lines);
    if (exports.lines.length > 0) {
      sections.push({
        type: 'exports',
        lines: exports.lines,
        priority: this.contentWeights.exports,
        relevance: this.calculateSectionRelevance(exports.content, queryTerms),
      });
    }

    // Extract function and class signatures
    if (path.extname(filePath).match(/\.(js|ts|py)$/)) {
      const signatures = this.extractSignatures(lines, filePath);
      if (signatures.lines.length > 0) {
        sections.push({
          type: 'signatures',
          lines: signatures.lines,
          priority: this.contentWeights.functionSignatures,
          relevance: this.calculateSectionRelevance(
            signatures.content,
            queryTerms
          ),
        });
      }
    }

    // Extract comments and documentation
    const comments = this.extractComments(lines);
    if (comments.lines.length > 0) {
      sections.push({
        type: 'comments',
        lines: comments.lines,
        priority: this.contentWeights.comments,
        relevance: this.calculateSectionRelevance(comments.content, queryTerms),
      });
    }

    // Extract implementation code (remaining content)
    const implementationLines = lines.filter(
      (line, index) =>
        !imports.lineIndices.includes(index) &&
        !exports.lineIndices.includes(index) &&
        !comments.lineIndices.includes(index)
    );

    if (implementationLines.length > 0) {
      const implementationContent = implementationLines.join('\n');
      sections.push({
        type: 'implementation',
        lines: implementationLines,
        priority: this.contentWeights.implementation,
        relevance: this.calculateSectionRelevance(
          implementationContent,
          queryTerms
        ),
      });
    }

    return sections;
  }

  /**
   * Extract import statements
   * @param {Array} lines - File lines
   * @returns {Object} Import section
   */
  extractImports(lines) {
    const importLines = [];
    const lineIndices = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (
        line.startsWith('import ') ||
        line.startsWith('from ') ||
        line.startsWith('require(') ||
        line.startsWith('#include ') ||
        line.match(/^\s*#include/)
      ) {
        importLines.push(lines[i]);
        lineIndices.push(i);
      } else if (importLines.length > 0 && line === '') {
        // Include one blank line after imports
        importLines.push(lines[i]);
        lineIndices.push(i);
      } else if (importLines.length > 0) {
        // Stop at first non-import, non-empty line
        break;
      }
    }

    return {
      lines: importLines,
      lineIndices,
      content: importLines.join('\n'),
    };
  }

  /**
   * Extract export statements
   * @param {Array} lines - File lines
   * @returns {Object} Export section
   */
  extractExports(lines) {
    const exportLines = [];
    const lineIndices = [];

    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i].trim();
      if (
        line.startsWith('export ') ||
        line.includes(' module.exports') ||
        line.includes(' exports.')
      ) {
        exportLines.unshift(lines[i]);
        lineIndices.unshift(i);
      } else if (exportLines.length > 0 && line === '') {
        // Include one blank line before exports
        exportLines.unshift(lines[i]);
        lineIndices.unshift(i);
      } else if (exportLines.length > 0) {
        // Stop at first non-export line when going backwards
        break;
      }
    }

    return {
      lines: exportLines,
      lineIndices,
      content: exportLines.join('\n'),
    };
  }

  /**
   * Extract function and class signatures
   * @param {Array} lines - File lines
   * @param {string} filePath - File path for language detection
   * @returns {Object} Signature section
   */
  extractSignatures(lines, filePath) {
    const signatureLines = [];
    const lineIndices = [];
    const ext = path.extname(filePath);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // JavaScript/TypeScript patterns
      if (ext.match(/\.(js|ts)/)) {
        if (
          line.match(/^(export\s+)?(function|class|const|let|var)\s+\w+/) ||
          line.match(/^(export\s+)?(async\s+)?function/) ||
          line.match(/^(export\s+)?class\s+\w+/) ||
          line.match(/^(export\s+)?interface\s+\w+/) ||
          line.match(/^(export\s+)?type\s+\w+/)
        ) {
          signatureLines.push(lines[i]);
          lineIndices.push(i);
        }
      }
      // Python patterns
      else if (ext === '.py') {
        if (
          line.match(/^def\s+\w+/) ||
          line.match(/^class\s+\w+/) ||
          line.match(/^async\s+def\s+\w+/)
        ) {
          signatureLines.push(lines[i]);
          lineIndices.push(i);
        }
      }
    }

    return {
      lines: signatureLines,
      lineIndices,
      content: signatureLines.join('\n'),
    };
  }

  /**
   * Extract comments
   * @param {Array} lines - File lines
   * @returns {Object} Comment section
   */
  extractComments(lines) {
    const commentLines = [];
    const lineIndices = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (
        line.startsWith('//') ||
        line.startsWith('#') ||
        line.startsWith('/*') ||
        line.includes('*/') ||
        line.startsWith('*') ||
        line.startsWith('"""') ||
        line.startsWith("'''")
      ) {
        commentLines.push(lines[i]);
        lineIndices.push(i);
      }
    }

    return {
      lines: commentLines,
      lineIndices,
      content: commentLines.join('\n'),
    };
  }

  /**
   * Calculate relevance score for a section
   * @param {string} content - Section content
   * @param {Array} queryTerms - Query terms
   * @returns {number} Relevance score
   */
  calculateSectionRelevance(content, queryTerms) {
    let score = 0;
    const lowerContent = content.toLowerCase();

    for (const term of queryTerms) {
      const occurrences = (lowerContent.match(new RegExp(term, 'gi')) || [])
        .length;
      score += occurrences * 2; // 2 points per occurrence
    }

    return score;
  }

  /**
   * Prioritize and truncate content based on relevance and size limits
   * @param {Array} sections - File sections
   * @param {string} query - Original query
   * @param {number} maxSize - Maximum size limit
   * @returns {string} Optimized content
   */
  prioritizeContent(sections, query, maxSize) {
    // Sort sections by combined priority and relevance
    sections.sort((a, b) => {
      const scoreA = a.priority * (1 + a.relevance * 0.1);
      const scoreB = b.priority * (1 + b.relevance * 0.1);
      return scoreB - scoreA;
    });

    let content = '';
    let currentSize = 0;

    for (const section of sections) {
      const sectionContent = section.lines.join('\n');
      const sectionSize = sectionContent.length;

      if (currentSize + sectionSize <= maxSize) {
        // Add entire section
        content += sectionContent + '\n\n';
        currentSize += sectionSize + 2;
      } else {
        // Truncate section to fit remaining space
        const remainingSpace = maxSize - currentSize;
        if (remainingSpace > 50) {
          // Only add if we have meaningful space
          const truncated = this.truncateContent(
            sectionContent,
            remainingSpace
          );
          content += truncated + '\n\n';
          currentSize += truncated.length + 2;
        }
        break; // No more space
      }
    }

    return content.trim();
  }

  /**
   * Truncate content intelligently
   * @param {string} content - Content to truncate
   * @param {number} maxLength - Maximum length
   * @returns {string} Truncated content
   */
  truncateContent(content, maxLength) {
    if (content.length <= maxLength) return content;

    // Try to truncate at a reasonable boundary
    const lines = content.split('\n');
    let result = '';
    let currentLength = 0;

    for (const line of lines) {
      if (currentLength + line.length + 1 > maxLength) {
        if (currentLength === 0) {
          // Even first line is too long, hard truncate
          return line.substring(0, maxLength - 3) + '...';
        }
        break;
      }
      result += line + '\n';
      currentLength += line.length + 1;
    }

    return result.trim() + '\n...';
  }

  /**
   * Calculate file size limit based on total context and number of files
   * @param {number} fileCount - Number of files
   * @param {number} totalTokenLimit - Total token limit
   * @returns {number} Size limit per file in characters
   */
  calculateFileSizeLimit(fileCount, totalTokenLimit) {
    const totalCharLimit = totalTokenLimit * 4; // Rough token to character conversion
    const perFileLimit = Math.min(totalCharLimit / fileCount, this.maxFileSize);

    return Math.max(perFileLimit, 1000); // Minimum 1KB per file
  }

  /**
   * Generate summary of the optimized context
   * @param {Array} contextFiles - Optimized context files
   * @param {string} query - Original query
   * @returns {string} Summary text
   */
  generateSummary(contextFiles, query) {
    if (contextFiles.length === 0) {
      return `No relevant context found for query: "${query}"`;
    }

    const totalTokens = contextFiles.reduce((sum, f) => sum + f.tokens, 0);
    const topFile = contextFiles[0];

    return (
      `Optimized context for "${query}": ${contextFiles.length} files, ` +
      `${totalTokens} tokens. Top file: ${topFile.shortName} ` +
      `(relevance: ${topFile.relevanceScore})`
    );
  }

  /**
   * Get supported AI models
   * @returns {Array} Model names
   */
  getSupportedModels() {
    return Object.keys(this.modelLimits);
  }

  /**
   * Configure model token limits
   * @param {Object} modelLimits - New model limits
   */
  configureModelLimits(modelLimits) {
    this.modelLimits = { ...this.modelLimits, ...modelLimits };
  }

  /**
   * Configure content weights
   * @param {Object} contentWeights - New content weights
   */
  configureContentWeights(contentWeights) {
    this.contentWeights = { ...this.contentWeights, ...contentWeights };
  }
}

// Export singleton instance for global use
export const contextWindowOptimizer = new ContextWindowOptimizer();
export default contextWindowOptimizer;
