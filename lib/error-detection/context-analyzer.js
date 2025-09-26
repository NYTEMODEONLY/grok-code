import { relevanceScorer } from '../context/relevance-scorer.js';
import { dependencyMapper } from '../code-analysis/dependency-mapper.js';
import { errorParser } from './error-parser.js';
import { errorClassifier } from './error-classifier.js';

/**
 * Context-Aware Error Analysis Engine
 * Analyzes errors within the full context of the codebase using semantic understanding
 */
export class ContextErrorAnalyzer {
  constructor() {
    this.contextCache = new Map(); // Cache for context analysis
    this.errorRelationships = new Map(); // Track error relationships
    this.impactAnalysis = new Map(); // Track error impact analysis

    // Impact levels
    this.impactLevels = {
      isolated: 1,     // Single file, no dependencies
      localized: 2,    // Single file with local impact
      cascading: 3,    // Affects dependent files
      systemic: 4,     // Affects multiple modules/systems
      critical: 5,     // Core functionality broken
    };
  }

  /**
   * Perform context-aware error analysis
   * @param {string} errorOutput - Raw error output
   * @param {string|string[]} filePaths - Codebase paths to analyze
   * @param {Object} options - Analysis options
   * @returns {Object} Comprehensive context-aware error analysis
   */
  async analyzeErrorsInContext(errorOutput, filePaths, options = {}) {
    const {
      includeDependencies = true,
      includeRelevance = true,
      maxRelatedFiles = 5,
      analyzeImpact = true,
    } = options;

    // Parse and classify errors first
    const parsedResult = errorParser.parseErrors(errorOutput);
    const classifiedResult = errorClassifier.classifyErrors(parsedResult.errors);

    // Build codebase context
    const context = await this.buildCodebaseContext(filePaths, {
      includeDependencies,
      includeRelevance,
    });

    // Analyze each error in context
    const contextAwareErrors = [];
    for (const error of classifiedResult.errors) {
      const contextAnalysis = await this.analyzeErrorContext(error, context, {
        maxRelatedFiles,
        analyzeImpact,
      });
      contextAwareErrors.push({
        ...error,
        contextAnalysis,
      });
    }

    // Identify error patterns and relationships
    const patterns = this.identifyErrorPatterns(contextAwareErrors, context);
    const impact = analyzeImpact ? this.analyzeSystemImpact(contextAwareErrors, context) : null;

    // Generate context-aware recommendations
    const recommendations = this.generateContextRecommendations(contextAwareErrors, patterns, impact, context);

    return {
      summary: this.generateContextSummary(contextAwareErrors, patterns, impact),
      errors: contextAwareErrors,
      patterns,
      impact,
      recommendations,
      context: {
        filesAnalyzed: context.files?.length || 0,
        dependenciesMapped: context.dependencies ? Object.keys(context.dependencies).length : 0,
        relevanceScores: context.relevance ? Object.keys(context.relevance).length : 0,
      },
      metadata: {
        analysisTime: new Date().toISOString(),
        errorCount: contextAwareErrors.length,
        patternCount: patterns.length,
        impactAnalyzed: analyzeImpact,
      },
    };
  }

  /**
   * Build comprehensive codebase context for error analysis
   * @param {string|string[]} filePaths - Codebase paths
   * @param {Object} options - Context building options
   * @returns {Object} Codebase context
   */
  async buildCodebaseContext(filePaths, options = {}) {
    const { includeDependencies = true, includeRelevance = true } = options;
    const context = {};

    try {
      // Get all files in the codebase
      const files = await this.collectCodebaseFiles(filePaths);
      context.files = files;

      // Build dependency graph
      if (includeDependencies) {
        const depResult = await dependencyMapper.buildDependencyGraph(filePaths, {
          includePatterns: ['**/*.{js,ts,jsx,tsx,py}'],
          excludePatterns: ['**/node_modules/**', '**/.git/**', '**/dist/**', '**/build/**'],
        });
        context.dependencies = depResult.graph.dependencies;
        context.dependents = depResult.graph.dependents;
      }

      // Calculate file relevance scores (using a generic query to establish baseline)
      if (includeRelevance) {
        const relevanceResult = await relevanceScorer.scoreFileRelevance(
          'code functionality', // Generic query for baseline relevance
          filePaths,
          { maxFiles: 50, includeDependencies: false, minScore: 1 }
        );
        context.relevance = {};
        relevanceResult.forEach(result => {
          context.relevance[result.filePath] = result.score.total;
        });
      }

    } catch (error) {
      console.warn('Failed to build codebase context:', error.message);
      // Return partial context
      context.files = [];
      context.dependencies = {};
      context.relevance = {};
    }

    return context;
  }

  /**
   * Analyze individual error in codebase context
   * @param {Object} error - Classified error
   * @param {Object} context - Codebase context
   * @param {Object} options - Analysis options
   * @returns {Object} Context analysis for this error
   */
  async analyzeErrorContext(error, context, options = {}) {
    const { maxRelatedFiles = 5 } = options;
    const analysis = {
      fileImportance: this.calculateFileImportance(error.file, context),
      relatedFiles: [],
      dependencyImpact: [],
      similarErrors: [],
      relevanceContext: {},
      fixComplexity: error.complexityScore,
      estimatedImpact: 'isolated',
    };

    // Analyze file importance
    if (context.relevance && context.relevance[error.file]) {
      analysis.relevanceContext = {
        score: context.relevance[error.file],
        percentile: this.calculateRelevancePercentile(error.file, context.relevance),
      };
    }

    // Find related files through dependencies
    if (context.dependencies && context.dependents) {
      analysis.dependencyImpact = this.analyzeDependencyImpact(error.file, context);

      // Find files that might be affected by this error
      analysis.relatedFiles = this.findRelatedFiles(error, context, maxRelatedFiles);
    }

    // Find similar errors in related files
    analysis.similarErrors = this.findSimilarErrors(error, context);

    // Estimate overall impact
    analysis.estimatedImpact = this.estimateErrorImpact(error, analysis, context);

    // Adjust fix complexity based on context
    analysis.contextAdjustedComplexity = this.adjustComplexityForContext(error, analysis);

    return analysis;
  }

  /**
   * Calculate file importance based on context
   * @param {string} filePath - File path
   * @param {Object} context - Codebase context
   * @returns {Object} File importance metrics
   */
  calculateFileImportance(filePath, context) {
    const importance = {
      dependencyCount: 0,
      dependentCount: 0,
      relevanceScore: 0,
      centrality: 0,
      overall: 0,
    };

    // Count dependencies (files this file depends on)
    if (context.dependencies && context.dependencies[filePath]) {
      importance.dependencyCount = context.dependencies[filePath].length;
    }

    // Count dependents (files that depend on this file)
    if (context.dependents && context.dependents[filePath]) {
      importance.dependentCount = context.dependents[filePath].length;
    }

    // Relevance score
    if (context.relevance && context.relevance[filePath]) {
      importance.relevanceScore = context.relevance[filePath];
    }

    // Calculate centrality (measure of how connected the file is)
    importance.centrality = importance.dependencyCount + importance.dependentCount;

    // Overall importance score (weighted combination)
    importance.overall = (
      importance.relevanceScore * 0.4 +
      importance.centrality * 0.3 +
      Math.min(importance.dependentCount * 5, 30) * 0.3 // Cap dependent bonus
    );

    return importance;
  }

  /**
   * Calculate relevance percentile for a file
   * @param {string} filePath - File path
   * @param {Object} relevanceScores - All relevance scores
   * @returns {number} Percentile (0-100)
   */
  calculateRelevancePercentile(filePath, relevanceScores) {
    const scores = Object.values(relevanceScores).sort((a, b) => b - a);
    const fileScore = relevanceScores[filePath] || 0;
    const index = scores.findIndex(score => score <= fileScore);

    if (index === -1) return 0;
    return Math.round((index / scores.length) * 100);
  }

  /**
   * Analyze dependency impact of an error
   * @param {string} filePath - File with error
   * @param {Object} context - Codebase context
   * @returns {Array} Dependency impact analysis
   */
  analyzeDependencyImpact(filePath, context) {
    const impact = [];

    if (!context.dependents || !context.dependents[filePath]) {
      return impact;
    }

    // Files that depend on this file will be affected
    context.dependents[filePath].forEach(dependent => {
      impact.push({
        file: dependent.path,
        relationship: 'depends_on_error_file',
        risk: this.calculateDependencyRisk(dependent, context),
        description: `${dependent.path} depends on ${filePath} which has errors`,
      });
    });

    // Files that this file depends on might indicate root cause
    if (context.dependencies && context.dependencies[filePath]) {
      context.dependencies[filePath].forEach(dependency => {
        impact.push({
          file: dependency.path,
          relationship: 'error_file_depends_on',
          risk: 'low',
          description: `${filePath} depends on ${dependency.path} - check for issues there`,
        });
      });
    }

    return impact;
  }

  /**
   * Calculate risk level for a dependency relationship
   * @param {Object} dependency - Dependency info
   * @param {Object} context - Context
   * @returns {string} Risk level
   */
  calculateDependencyRisk(dependency, context) {
    // Higher risk if the dependent file is important
    const dependentFile = dependency.path;
    const importance = this.calculateFileImportance(dependentFile, context);

    if (importance.overall > 50) return 'high';
    if (importance.overall > 25) return 'medium';
    return 'low';
  }

  /**
   * Find files related to an error
   * @param {Object} error - Error object
   * @param {Object} context - Codebase context
   * @param {number} maxFiles - Maximum related files to return
   * @returns {Array} Related files with relevance scores
   */
  findRelatedFiles(error, context, maxFiles) {
    const related = [];

    // Files with similar errors
    if (context.files) {
      context.files.forEach(filePath => {
        if (filePath !== error.file) {
          const similarity = this.calculateFileSimilarity(error, filePath, context);
          if (similarity > 0.3) { // 30% similarity threshold
            related.push({
              file: filePath,
              relevance: similarity,
              reason: 'similar_error_patterns',
            });
          }
        }
      });
    }

    // Sort by relevance and limit
    related.sort((a, b) => b.relevance - a.relevance);
    return related.slice(0, maxFiles);
  }

  /**
   * Calculate similarity between error and another file
   * @param {Object} error - Error object
   * @param {string} filePath - File to compare
   * @param {Object} context - Context
   * @returns {number} Similarity score (0-1)
   */
  calculateFileSimilarity(error, filePath, context) {
    let similarity = 0;

    // Same directory
    const errorDir = error.file.split('/').slice(0, -1).join('/');
    const fileDir = filePath.split('/').slice(0, -1).join('/');
    if (errorDir === fileDir) similarity += 0.3;

    // Similar filename patterns
    const errorName = error.file.split('/').pop().split('.')[0];
    const fileName = filePath.split('/').pop().split('.')[0];

    if (errorName.includes(fileName) || fileName.includes(errorName)) {
      similarity += 0.4;
    }

    // Similar relevance scores (files serving similar purposes)
    if (context.relevance && context.relevance[error.file] && context.relevance[filePath]) {
      const relevanceDiff = Math.abs(context.relevance[error.file] - context.relevance[filePath]);
      if (relevanceDiff < 20) similarity += 0.3; // Within 20 points
    }

    return Math.min(similarity, 1.0);
  }

  /**
   * Find similar errors across the codebase
   * @param {Object} error - Error to find similar errors for
   * @param {Object} context - Context (not used directly but for future expansion)
   * @returns {Array} Similar errors (would need error database for full implementation)
   */
  findSimilarErrors(error, context) {
    // In a full implementation, this would search through error databases
    // or historical error patterns. For now, return empty array.
    return [];
  }

  /**
   * Estimate overall impact of an error
   * @param {Object} error - Error object
   * @param {Object} analysis - Context analysis
   * @param {Object} context - Codebase context
   * @returns {string} Impact level
   */
  estimateErrorImpact(error, analysis, context) {
    let impactScore = this.impactLevels.isolated;

    // Error severity increases impact
    if (error.severityScore >= 4) impactScore += 1;
    if (error.severityScore >= 5) impactScore += 1;

    // File importance increases impact
    if (analysis.fileImportance.overall > 40) impactScore += 1;
    if (analysis.fileImportance.overall > 70) impactScore += 1;

    // Dependency impact increases impact
    if (analysis.dependencyImpact.length > 0) impactScore += 1;
    if (analysis.dependencyImpact.some(d => d.risk === 'high')) impactScore += 1;

    // Cap at maximum impact level
    impactScore = Math.min(impactScore, this.impactLevels.critical);

    // Convert score to level name
    for (const [level, score] of Object.entries(this.impactLevels)) {
      if (score === impactScore) return level;
    }

    return 'isolated';
  }

  /**
   * Adjust fix complexity based on context
   * @param {Object} error - Error object
   * @param {Object} analysis - Context analysis
   * @returns {number} Context-adjusted complexity score
   */
  adjustComplexityForContext(error, analysis) {
    let adjustedComplexity = error.complexityScore;

    // Higher complexity for important files
    if (analysis.fileImportance.overall > 60) {
      adjustedComplexity += 0.5;
    }

    // Higher complexity for files with many dependencies
    if (analysis.fileImportance.dependencyCount > 10) {
      adjustedComplexity += 0.5;
    }

    // Lower complexity if similar patterns exist elsewhere
    if (analysis.relatedFiles.length > 2) {
      adjustedComplexity -= 0.3;
    }

    return Math.max(1, Math.min(adjustedComplexity, 5));
  }

  /**
   * Identify error patterns across the codebase
   * @param {Array} contextAwareErrors - Errors with context analysis
   * @param {Object} context - Codebase context
   * @returns {Array} Identified patterns
   */
  identifyErrorPatterns(contextAwareErrors, context) {
    const patterns = [];

    // Pattern: Errors clustered in important files
    const importantFilesWithErrors = contextAwareErrors.filter(
      error => error.contextAnalysis.fileImportance.overall > 50
    );

    if (importantFilesWithErrors.length >= 2) {
      patterns.push({
        type: 'important_file_cluster',
        severity: 'high',
        description: `${importantFilesWithErrors.length} errors in highly important files`,
        errors: importantFilesWithErrors.map(e => e.file),
        recommendation: 'Prioritize fixing errors in core files first',
      });
    }

    // Pattern: Similar error types across multiple files
    const errorTypes = {};
    contextAwareErrors.forEach(error => {
      errorTypes[error.type] = (errorTypes[error.type] || 0) + 1;
    });

    Object.entries(errorTypes).forEach(([type, count]) => {
      if (count >= 3) {
        patterns.push({
          type: 'recurring_error_type',
          severity: 'medium',
          description: `${count} ${type} errors across multiple files`,
          errors: contextAwareErrors.filter(e => e.type === type).map(e => e.file),
          recommendation: `Address ${type} issues systematically`,
        });
      }
    });

    // Pattern: High impact errors
    const highImpactErrors = contextAwareErrors.filter(
      error => ['systemic', 'critical'].includes(error.contextAnalysis.estimatedImpact)
    );

    if (highImpactErrors.length > 0) {
      patterns.push({
        type: 'high_impact_errors',
        severity: 'critical',
        description: `${highImpactErrors.length} high-impact errors detected`,
        errors: highImpactErrors.map(e => e.file),
        recommendation: 'Address critical errors immediately',
      });
    }

    return patterns;
  }

  /**
   * Analyze system-wide impact of all errors
   * @param {Array} contextAwareErrors - Errors with context analysis
   * @param {Object} context - Codebase context
   * @returns {Object} System impact analysis
   */
  analyzeSystemImpact(contextAwareErrors, context) {
    const impact = {
      overall: 'low',
      affectedFiles: new Set(),
      affectedModules: new Set(),
      cascadingEffects: [],
      riskAssessment: 'low',
    };

    // Collect all affected files
    contextAwareErrors.forEach(error => {
      impact.affectedFiles.add(error.file);

      // Add related files
      error.contextAnalysis.relatedFiles.forEach(related => {
        impact.affectedFiles.add(related.file);
      });

      // Add dependency impact files
      error.contextAnalysis.dependencyImpact.forEach(dep => {
        impact.affectedFiles.add(dep.file);
      });
    });

    // Determine modules affected
    impact.affectedFiles.forEach(file => {
      const module = file.split('/').slice(0, -1).join('/');
      impact.affectedModules.add(module);
    });

    // Assess overall impact
    const errorCount = contextAwareErrors.length;
    const highSeverityErrors = contextAwareErrors.filter(e => e.severityScore >= 4).length;
    const systemicErrors = contextAwareErrors.filter(e =>
      ['systemic', 'critical'].includes(e.contextAnalysis.estimatedImpact)
    ).length;

    if (systemicErrors > 0 || highSeverityErrors > errorCount * 0.5) {
      impact.overall = 'critical';
      impact.riskAssessment = 'high';
    } else if (highSeverityErrors > errorCount * 0.3) {
      impact.overall = 'high';
      impact.riskAssessment = 'medium';
    } else if (errorCount > 5) {
      impact.overall = 'medium';
      impact.riskAssessment = 'low';
    }

    // Convert sets to arrays for JSON serialization
    impact.affectedFiles = Array.from(impact.affectedFiles);
    impact.affectedModules = Array.from(impact.affectedModules);

    return impact;
  }

  /**
   * Generate context-aware recommendations
   * @param {Array} contextAwareErrors - Errors with context analysis
   * @param {Array} patterns - Identified patterns
   * @param {Object} impact - System impact analysis
   * @param {Object} context - Codebase context
   * @returns {Array} Context-aware recommendations
   */
  generateContextRecommendations(contextAwareErrors, patterns, impact, context) {
    const recommendations = [];

    // Sort errors by contextual priority
    const prioritizedErrors = contextAwareErrors.sort((a, b) => {
      // First by impact level
      const impactOrder = ['critical', 'systemic', 'cascading', 'localized', 'isolated'];
      const aImpact = impactOrder.indexOf(a.contextAnalysis.estimatedImpact);
      const bImpact = impactOrder.indexOf(b.contextAnalysis.estimatedImpact);

      if (aImpact !== bImpact) return aImpact - bImpact;

      // Then by file importance
      return b.contextAnalysis.fileImportance.overall - a.contextAnalysis.fileImportance.overall;
    });

    // Top priority fixes
    const topErrors = prioritizedErrors.slice(0, 3);
    if (topErrors.length > 0) {
      recommendations.push({
        priority: 'critical',
        type: 'prioritize_fixes',
        description: `Focus on ${topErrors.length} highest-impact errors first`,
        items: topErrors.map(e => ({
          file: e.file,
          error: `${e.type} error: ${e.message}`,
          impact: e.contextAnalysis.estimatedImpact,
          importance: Math.round(e.contextAnalysis.fileImportance.overall),
        })),
      });
    }

    // Pattern-based recommendations
    patterns.forEach(pattern => {
      recommendations.push({
        priority: pattern.severity === 'critical' ? 'high' : pattern.severity,
        type: 'pattern_fix',
        description: pattern.recommendation,
        pattern: pattern.description,
      });
    });

    // Impact-based recommendations
    if (impact && impact.riskAssessment === 'high') {
      recommendations.push({
        priority: 'critical',
        type: 'system_stability',
        description: 'High-risk error patterns detected - consider comprehensive testing before deployment',
      });
    }

    return recommendations;
  }

  /**
   * Generate context-aware summary
   * @param {Array} contextAwareErrors - Errors with context analysis
   * @param {Array} patterns - Identified patterns
   * @param {Object} impact - System impact analysis
   * @returns {string} Context-aware summary
   */
  generateContextSummary(contextAwareErrors, patterns, impact) {
    const errorCount = contextAwareErrors.length;
    const patternCount = patterns.length;

    let summary = `Context-aware analysis of ${errorCount} errors`;

    if (impact) {
      summary += ` with ${impact.overall} overall impact`;
      summary += ` affecting ${impact.affectedFiles.length} files`;
    }

    if (patternCount > 0) {
      summary += `. Identified ${patternCount} error patterns.`;
    }

    // Add key insights
    const criticalErrors = contextAwareErrors.filter(e =>
      e.contextAnalysis.estimatedImpact === 'critical'
    );

    if (criticalErrors.length > 0) {
      summary += ` ${criticalErrors.length} errors have critical impact.`;
    }

    const highImportanceFiles = contextAwareErrors.filter(e =>
      e.contextAnalysis.fileImportance.overall > 60
    );

    if (highImportanceFiles.length > 0) {
      summary += ` ${highImportanceFiles.length} errors in highly important files.`;
    }

    return summary;
  }

  /**
   * Collect all files in the codebase
   * @param {string|string[]} filePaths - Input paths
   * @returns {Array} All file paths
   */
  async collectCodebaseFiles(filePaths) {
    const paths = Array.isArray(filePaths) ? filePaths : [filePaths];
    const files = [];

    for (const inputPath of paths) {
      try {
        const stats = await import('fs').then(fs => fs.statSync(inputPath));

        if (stats.isDirectory()) {
          files.push(...this.collectFilesFromDirectory(inputPath));
        } else if (stats.isFile()) {
          files.push(inputPath);
        }
      } catch (error) {
        // Path doesn't exist or can't be accessed, skip
        continue;
      }
    }

    return files;
  }

  /**
   * Recursively collect files from directory
   * @param {string} dirPath - Directory path
   * @returns {Array} File paths
   */
  collectFilesFromDirectory(dirPath) {
    const files = [];

    try {
      const fs = require('fs');
      const entries = fs.readdirSync(dirPath);

      for (const entry of entries) {
        const fullPath = require('path').join(dirPath, entry);

        try {
          const stats = fs.statSync(fullPath);

          if (stats.isDirectory()) {
            // Skip common irrelevant directories
            if (!['node_modules', '.git', 'dist', 'build', '.next', '__pycache__'].includes(entry)) {
              files.push(...this.collectFilesFromDirectory(fullPath));
            }
          } else if (stats.isFile()) {
            // Include relevant file types
            const ext = require('path').extname(fullPath).toLowerCase();
            if (['.js', '.ts', '.jsx', '.tsx', '.py', '.json', '.md'].includes(ext)) {
              files.push(fullPath);
            }
          }
        } catch (error) {
          // Skip files we can't access
          continue;
        }
      }
    } catch (error) {
      // Skip directories we can't read
      return files;
    }

    return files;
  }

  /**
   * Export context-aware error analysis
   * @param {Object} analysis - Analysis result
   * @param {string} format - Export format ('json', 'summary')
   * @returns {string} Formatted output
   */
  exportAnalysis(analysis, format = 'json') {
    switch (format.toLowerCase()) {
      case 'json':
        return JSON.stringify(analysis, null, 2);

      case 'summary':
        let summary = `Context-Aware Error Analysis\n`;
        summary += '=' .repeat(40) + '\n\n';
        summary += analysis.summary + '\n\n';

        if (analysis.impact) {
          summary += `System Impact: ${analysis.impact.overall.toUpperCase()}\n`;
          summary += `Risk Assessment: ${analysis.impact.riskAssessment.toUpperCase()}\n`;
          summary += `Affected Files: ${analysis.impact.affectedFiles.length}\n\n`;
        }

        if (analysis.patterns && analysis.patterns.length > 0) {
          summary += 'Error Patterns:\n';
          analysis.patterns.forEach((pattern, index) => {
            summary += `${index + 1}. ${pattern.description}\n`;
            summary += `   Severity: ${pattern.severity.toUpperCase()}\n`;
            summary += `   Recommendation: ${pattern.recommendation}\n\n`;
          });
        }

        if (analysis.recommendations && analysis.recommendations.length > 0) {
          summary += 'Recommendations:\n';
          analysis.recommendations.forEach((rec, index) => {
            summary += `${index + 1}. ${rec.priority.toUpperCase()}: ${rec.description}\n`;
          });
        }

        return summary;

      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }
}

// Export singleton instance for global use
export const contextErrorAnalyzer = new ContextErrorAnalyzer();
export default contextErrorAnalyzer;
