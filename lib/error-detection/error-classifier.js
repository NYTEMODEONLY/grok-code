import { errorParser } from './error-parser.js';

/**
 * Error Classifier for Intelligent Error Analysis
 * Classifies parsed errors by type, severity, fix complexity, and patterns
 */
export class ErrorClassifier {
  constructor() {
    // Severity levels (higher number = more severe)
    this.severityLevels = {
      critical: 5, // Breaking errors that prevent execution
      high: 4, // Serious errors affecting functionality
      medium: 3, // Moderate issues affecting code quality
      low: 2, // Minor issues, style violations
      info: 1, // Informational, warnings
    };

    // Fix complexity levels
    this.complexityLevels = {
      trivial: 1, // One-line fixes, auto-fixable
      simple: 2, // Few lines, straightforward
      moderate: 3, // Requires understanding, moderate changes
      complex: 4, // Significant refactoring needed
      architectural: 5, // Major design changes required
    };

    // Error type definitions with classification rules
    this.errorTypes = {
      // Syntax Errors
      syntax: {
        patterns: [
          /syntax/i,
          /unexpected token/i,
          /expected/i,
          /missing/i,
          /invalid syntax/i,
          /parse error/i,
        ],
        severity: 'critical',
        complexity: 'simple',
        description: 'Syntax errors preventing code execution',
        autoFixable: false,
        category: 'syntax',
      },

      // Type Errors
      type: {
        patterns: [
          /cannot find name/i,
          /property .* does not exist/i,
          /type .* is not assignable/i,
          /type mismatch/i,
          /does not satisfy the constraint/i,
          /types have no overlap/i,
        ],
        severity: 'high',
        complexity: 'moderate',
        description: 'Type system violations',
        autoFixable: false,
        category: 'type-safety',
      },

      // Import/Module Errors
      import: {
        patterns: [
          /cannot find module/i,
          /module not found/i,
          /unable to resolve/i,
          /missing import/i,
          /no such file or directory/i,
        ],
        severity: 'critical',
        complexity: 'trivial',
        description: 'Module resolution failures',
        autoFixable: true,
        category: 'dependencies',
      },

      // Unused Code
      unused: {
        patterns: [
          /is defined but never used/i,
          /unused variable/i,
          /unused import/i,
          /unreachable code/i,
          /declared but never/i,
        ],
        severity: 'low',
        complexity: 'trivial',
        description: 'Unused code that can be safely removed',
        autoFixable: true,
        category: 'code-quality',
      },

      // Scope Issues
      scope: {
        patterns: [
          /is not defined/i,
          /cannot access/i,
          /out of scope/i,
          /reference error/i,
          /undeclared/i,
        ],
        severity: 'high',
        complexity: 'simple',
        description: 'Variable scope and declaration issues',
        autoFixable: false,
        category: 'scope',
      },

      // Style/Linting Issues
      style: {
        patterns: [
          /missing semicolon/i,
          /indentation/i,
          /quotes/i,
          /spacing/i,
          /line length/i,
          /max-len/i,
          /no-console/i,
          /no-debugger/i,
        ],
        severity: 'low',
        complexity: 'trivial',
        description: 'Code style and formatting violations',
        autoFixable: true,
        category: 'style',
      },

      // Logic Errors (inferred from patterns)
      logic: {
        patterns: [
          /condition always/i,
          /unreachable/i,
          /dead code/i,
          /constant condition/i,
          /infinite loop/i,
        ],
        severity: 'medium',
        complexity: 'moderate',
        description: 'Potential logic errors in code flow',
        autoFixable: false,
        category: 'logic',
      },

      // Performance Issues
      performance: {
        patterns: [
          /inefficient/i,
          /performance/i,
          /memory leak/i,
          /n\+1 query/i,
          /expensive operation/i,
        ],
        severity: 'medium',
        complexity: 'complex',
        description: 'Performance-related issues',
        autoFixable: false,
        category: 'performance',
      },

      // Security Issues
      security: {
        patterns: [
          /security/i,
          /vulnerability/i,
          /injection/i,
          /xss/i,
          /csrf/i,
          /unsafe/i,
          /sanitization/i,
        ],
        severity: 'critical',
        complexity: 'moderate',
        description: 'Potential security vulnerabilities',
        autoFixable: false,
        category: 'security',
      },

      // React-specific Issues
      react: {
        patterns: [
          /react\/jsx/i,
          /react\/prop/i,
          /react\/state/i,
          /react\/effect/i,
          /react\/key/i,
          /missing key/i,
        ],
        severity: 'medium',
        complexity: 'simple',
        description: 'React-specific issues',
        autoFixable: true,
        category: 'framework',
      },

      // Generic fallback
      generic: {
        patterns: [],
        severity: 'medium',
        complexity: 'moderate',
        description: 'Unclassified error',
        autoFixable: false,
        category: 'general',
      },
    };

    this.classifiedErrors = [];
    this.classificationStats = {
      totalErrors: 0,
      byType: {},
      bySeverity: {},
      byComplexity: {},
      autoFixable: 0,
      patterns: {},
    };
  }

  /**
   * Classify parsed errors with detailed analysis
   * @param {Array} parsedErrors - Errors from ErrorParser
   * @returns {Object} Classified error analysis
   */
  classifyErrors(parsedErrors) {
    this.classifiedErrors = [];
    this.resetStats();

    for (const error of parsedErrors) {
      const classifiedError = this.classifySingleError(error);
      this.classifiedErrors.push(classifiedError);
      this.updateStats(classifiedError);
    }

    return {
      totalErrors: this.classifiedErrors.length,
      errors: this.classifiedErrors,
      stats: this.classificationStats,
      patterns: this.identifyPatterns(),
      recommendations: this.generateRecommendations(),
      summary: this.generateSummary(),
    };
  }

  /**
   * Classify a single error with detailed analysis
   * @param {Object} error - Parsed error from ErrorParser
   * @returns {Object} Classified error with analysis
   */
  classifySingleError(error) {
    const classified = {
      ...error,
      type: 'generic',
      severity: 'medium',
      severityScore: this.severityLevels.medium,
      complexity: 'moderate',
      complexityScore: this.complexityLevels.moderate,
      autoFixable: false,
      category: 'general',
      description: '',
      fixSuggestions: [],
      relatedErrors: [],
      confidence: 0,
      metadata: {},
    };

    // Determine error type based on patterns
    classified.type = this.identifyErrorType(error);
    const typeDefinition = this.errorTypes[classified.type];

    if (typeDefinition) {
      classified.severity = typeDefinition.severity;
      classified.severityScore = this.severityLevels[typeDefinition.severity];
      classified.complexity = typeDefinition.complexity;
      classified.complexityScore =
        this.complexityLevels[typeDefinition.complexity];
      classified.autoFixable = typeDefinition.autoFixable;
      classified.category = typeDefinition.category;
      classified.description = typeDefinition.description;
      classified.confidence = this.calculateConfidence(error, typeDefinition);
    }

    // Generate fix suggestions
    classified.fixSuggestions = this.generateFixSuggestions(
      error,
      classified.type
    );

    // Add metadata based on error type
    classified.metadata = this.extractMetadata(error, classified.type);

    return classified;
  }

  /**
   * Identify error type based on message patterns
   * @param {Object} error - Parsed error
   * @returns {string} Error type identifier
   */
  identifyErrorType(error) {
    const message = (error.message || '').toLowerCase();
    const rule = (error.rule || '').toLowerCase();
    const code = (error.code || '').toLowerCase();

    // Check each error type for pattern matches
    for (const [typeName, typeDef] of Object.entries(this.errorTypes)) {
      if (typeName === 'generic') continue;

      // Check message patterns
      for (const pattern of typeDef.patterns) {
        if (pattern.test(message) || pattern.test(rule) || pattern.test(code)) {
          return typeName;
        }
      }

      // TypeScript specific code matching
      if (error.source === 'TypeScript' && code) {
        if (
          typeName === 'type' &&
          ['2304', '2339', '2322', '2345'].some((c) => code.includes(c))
        ) {
          return typeName;
        }
        if (
          typeName === 'import' &&
          ['2307', '2300'].some((c) => code.includes(c))
        ) {
          return typeName;
        }
        if (
          typeName === 'unused' &&
          ['6133', '6196'].some((c) => code.includes(c))
        ) {
          return typeName;
        }
      }

      // ESLint specific rule matching
      if (error.source === 'ESLint' && rule) {
        if (typeName === 'unused' && rule.includes('no-unused'))
          return typeName;
        if (typeName === 'scope' && rule.includes('no-undef')) return typeName;
        if (
          typeName === 'style' &&
          ['semi', 'indent', 'quotes'].some((r) => rule.includes(r))
        )
          return typeName;
        if (typeName === 'react' && rule.startsWith('react/')) return typeName;
      }
    }

    return 'generic';
  }

  /**
   * Calculate confidence score for error classification
   * @param {Object} error - Parsed error
   * @param {Object} typeDefinition - Type definition
   * @returns {number} Confidence score (0-100)
   */
  calculateConfidence(error, typeDefinition) {
    let confidence = 50; // Base confidence

    const message = (error.message || '').toLowerCase();
    const rule = (error.rule || '').toLowerCase();

    // Higher confidence for exact pattern matches
    for (const pattern of typeDefinition.patterns) {
      if (pattern.test(message) || pattern.test(rule)) {
        confidence += 20;
      }
    }

    // Higher confidence for specific error codes
    if (error.code) confidence += 15;

    // Higher confidence for specific rules
    if (error.rule) confidence += 10;

    // Lower confidence for generic messages
    if (message.length < 10) confidence -= 10;

    return Math.min(100, Math.max(0, confidence));
  }

  /**
   * Generate fix suggestions for an error
   * @param {Object} error - Parsed error
   * @param {string} errorType - Classified error type
   * @returns {Array} Array of fix suggestions
   */
  generateFixSuggestions(error, errorType) {
    const suggestions = [];

    switch (errorType) {
      case 'syntax':
        suggestions.push(
          'Check for missing brackets, parentheses, or semicolons'
        );
        suggestions.push('Verify correct JavaScript/TypeScript syntax');
        break;

      case 'type':
        suggestions.push('Check variable types and type annotations');
        suggestions.push('Ensure imported types are correctly defined');
        suggestions.push('Consider using type assertions if appropriate');
        break;

      case 'import':
        suggestions.push('Verify file path and extension');
        suggestions.push('Check if package is installed (npm/yarn)');
        suggestions.push('Ensure correct import/export syntax');
        break;

      case 'unused':
        suggestions.push('Remove unused variable/function');
        suggestions.push('Prefix with underscore if intentionally unused');
        suggestions.push('Check if variable is used in commented code');
        break;

      case 'scope':
        suggestions.push('Declare variable in correct scope');
        suggestions.push('Check for typos in variable names');
        suggestions.push('Ensure variable is imported if from another module');
        break;

      case 'style':
        if (error.rule?.includes('semi')) {
          suggestions.push('Add missing semicolon');
        } else if (error.rule?.includes('indent')) {
          suggestions.push('Fix indentation to match project style');
        } else if (error.rule?.includes('quotes')) {
          suggestions.push('Use consistent quote style (single/double)');
        }
        suggestions.push('Run code formatter (prettier, eslint --fix)');
        break;

      case 'react':
        if (error.rule?.includes('key')) {
          suggestions.push('Add unique key prop to list items');
        }
        suggestions.push('Check React component structure and props');
        break;

      default:
        suggestions.push('Review error message and surrounding code');
        suggestions.push('Check documentation for specific error');
    }

    return suggestions;
  }

  /**
   * Extract additional metadata based on error type
   * @param {Object} error - Parsed error
   * @param {string} errorType - Error type
   * @returns {Object} Metadata object
   */
  extractMetadata(error, errorType) {
    const metadata = {};

    switch (errorType) {
      case 'type':
        // Extract type information from TypeScript errors
        if (error.code) {
          metadata.tsErrorCode = error.code;
          metadata.tsCategory = this.getTSErrorCategory(error.code);
        }
        break;

      case 'import':
        // Extract module information
        const importMatch = error.message.match(
          /cannot find module ['"](.+?)['"]/i
        );
        if (importMatch) {
          metadata.missingModule = importMatch[1];
        }
        break;

      case 'unused':
        // Extract unused variable/function name
        const unusedMatch = error.message.match(
          /['"](.+?)['"] is defined but never used/i
        );
        if (unusedMatch) {
          metadata.unusedIdentifier = unusedMatch[1];
        }
        break;
    }

    return metadata;
  }

  /**
   * Get TypeScript error category from code
   * @param {string} code - TypeScript error code
   * @returns {string} Category description
   */
  getTSErrorCategory(code) {
    const categories = {
      2304: 'Cannot find name',
      2307: 'Cannot find module',
      2322: 'Type not assignable',
      2339: 'Property does not exist',
      2345: 'Argument type mismatch',
      6133: 'Declared but never used',
    };

    const numCode = code.replace('TS', '');
    return categories[numCode] || 'TypeScript error';
  }

  /**
   * Identify patterns across multiple errors
   * @returns {Array} Identified patterns
   */
  identifyPatterns() {
    const patterns = [];

    if (this.classifiedErrors.length < 2) return patterns;

    // Pattern: Multiple errors in same file
    const fileErrors = {};
    this.classifiedErrors.forEach((error) => {
      fileErrors[error.file] = (fileErrors[error.file] || 0) + 1;
    });

    Object.entries(fileErrors).forEach(([file, count]) => {
      if (count >= 3) {
        patterns.push({
          type: 'file-cluster',
          description: `${count} errors in ${file}`,
          severity: 'high',
          files: [file],
          suggestion: 'Focus on fixing errors in this file first',
        });
      }
    });

    // Pattern: Same error type across multiple files
    const typeErrors = {};
    this.classifiedErrors.forEach((error) => {
      typeErrors[error.type] = (typeErrors[error.type] || 0) + 1;
    });

    Object.entries(typeErrors).forEach(([type, count]) => {
      if (count >= 3) {
        patterns.push({
          type: 'type-cluster',
          description: `${count} ${type} errors across codebase`,
          severity: 'medium',
          suggestion: `Address ${type} issues systematically`,
        });
      }
    });

    // Pattern: Import errors (often systematic)
    const importErrors = this.classifiedErrors.filter(
      (e) => e.type === 'import'
    );
    if (importErrors.length >= 2) {
      patterns.push({
        type: 'import-issues',
        description: `${importErrors.length} import/module resolution errors`,
        severity: 'high',
        suggestion: 'Check module paths and package installations',
      });
    }

    return patterns;
  }

  /**
   * Generate recommendations based on error analysis
   * @returns {Array} Recommendations
   */
  generateRecommendations() {
    const recommendations = [];

    // Priority-based recommendations
    const criticalErrors = this.classifiedErrors.filter(
      (e) => e.severityScore >= 4
    );
    const autoFixableErrors = this.classifiedErrors.filter(
      (e) => e.autoFixable
    );

    if (criticalErrors.length > 0) {
      recommendations.push({
        priority: 'critical',
        action: 'fix_critical_errors',
        description: `Address ${criticalErrors.length} critical errors first`,
        count: criticalErrors.length,
      });
    }

    if (autoFixableErrors.length > 0) {
      recommendations.push({
        priority: 'low',
        action: 'run_auto_fix',
        description: `Run linter auto-fix for ${autoFixableErrors.length} auto-fixable errors`,
        count: autoFixableErrors.length,
      });
    }

    // Type-specific recommendations
    const typeCounts = {};
    this.classifiedErrors.forEach((error) => {
      typeCounts[error.type] = (typeCounts[error.type] || 0) + 1;
    });

    if (typeCounts.import > 0) {
      recommendations.push({
        priority: 'high',
        action: 'check_dependencies',
        description:
          'Verify all dependencies are installed and paths are correct',
      });
    }

    if (typeCounts.type > 0) {
      recommendations.push({
        priority: 'medium',
        action: 'review_types',
        description: 'Review type definitions and annotations',
      });
    }

    return recommendations;
  }

  /**
   * Generate summary of classification results
   * @returns {string} Summary text
   */
  generateSummary() {
    const total = this.classifiedErrors.length;
    const critical = this.classifiedErrors.filter(
      (e) => e.severity === 'critical'
    ).length;
    const autoFixable = this.classifiedErrors.filter(
      (e) => e.autoFixable
    ).length;

    let summary = `Classified ${total} errors`;

    if (critical > 0) {
      summary += ` (${critical} critical)`;
    }

    if (autoFixable > 0) {
      summary += `, ${autoFixable} auto-fixable`;
    }

    // Add top error types
    const topTypes = Object.entries(this.classificationStats.byType)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([type, count]) => `${type} (${count})`);

    if (topTypes.length > 0) {
      summary += `. Top types: ${topTypes.join(', ')}`;
    }

    return summary;
  }

  /**
   * Update classification statistics
   * @param {Object} classifiedError - Classified error
   */
  updateStats(classifiedError) {
    this.classificationStats.totalErrors++;

    // By type
    this.classificationStats.byType[classifiedError.type] =
      (this.classificationStats.byType[classifiedError.type] || 0) + 1;

    // By severity
    this.classificationStats.bySeverity[classifiedError.severity] =
      (this.classificationStats.bySeverity[classifiedError.severity] || 0) + 1;

    // By complexity
    this.classificationStats.byComplexity[classifiedError.complexity] =
      (this.classificationStats.byComplexity[classifiedError.complexity] || 0) +
      1;

    // Auto-fixable count
    if (classifiedError.autoFixable) {
      this.classificationStats.autoFixable++;
    }
  }

  /**
   * Reset classification statistics
   */
  resetStats() {
    this.classificationStats = {
      totalErrors: 0,
      byType: {},
      bySeverity: {},
      byComplexity: {},
      autoFixable: 0,
      patterns: {},
    };
  }

  /**
   * Filter classified errors by criteria
   * @param {Object} filters - Filter criteria
   * @returns {Array} Filtered errors
   */
  filterErrors(filters = {}) {
    const { type, severity, complexity, autoFixable, category } = filters;

    return this.classifiedErrors.filter((error) => {
      if (type && error.type !== type) return false;
      if (severity && error.severity !== severity) return false;
      if (complexity && error.complexity !== complexity) return false;
      if (autoFixable !== undefined && error.autoFixable !== autoFixable)
        return false;
      if (category && error.category !== category) return false;
      return true;
    });
  }

  /**
   * Get errors grouped by priority for fixing
   * @returns {Object} Errors grouped by fix priority
   */
  getErrorsByPriority() {
    const priorities = {
      critical: [],
      high: [],
      medium: [],
      low: [],
      info: [],
    };

    this.classifiedErrors.forEach((error) => {
      const priority = this.getFixPriority(error);
      priorities[priority].push(error);
    });

    return priorities;
  }

  /**
   * Determine fix priority for an error
   * @param {Object} error - Classified error
   * @returns {string} Priority level
   */
  getFixPriority(error) {
    // Critical errors first
    if (error.severityScore >= 5) return 'critical';

    // High severity or complex issues
    if (error.severityScore >= 4 || error.complexityScore >= 4) return 'high';

    // Medium severity
    if (error.severityScore >= 3) return 'medium';

    // Auto-fixable low severity
    if (error.autoFixable) return 'low';

    // Everything else
    return 'info';
  }

  /**
   * Export classified errors in various formats
   * @param {string} format - Export format ('json', 'csv', 'summary')
   * @returns {string} Formatted output
   */
  exportClassifiedErrors(format = 'json') {
    switch (format.toLowerCase()) {
      case 'json':
        return JSON.stringify(
          {
            summary: this.generateSummary(),
            stats: this.classificationStats,
            errors: this.classifiedErrors,
            patterns: this.identifyPatterns(),
            recommendations: this.generateRecommendations(),
          },
          null,
          2
        );

      case 'csv':
        let csv =
          'file,line,column,type,severity,complexity,category,message,rule,code,auto_fixable,confidence\n';
        this.classifiedErrors.forEach((error) => {
          csv += `"${error.file}",${error.line},${error.column},"${error.type}","${error.severity}","${error.complexity}","${error.category}","${error.message.replace(/"/g, '""')}","${error.rule}","${error.code}",${error.autoFixable},${error.confidence}\n`;
        });
        return csv;

      case 'summary':
        let summary = `Error Classification Summary\n`;
        summary += '='.repeat(35) + '\n\n';
        summary += this.generateSummary() + '\n\n';

        summary += 'By Type:\n';
        Object.entries(this.classificationStats.byType).forEach(
          ([type, count]) => {
            summary += `  ${type}: ${count}\n`;
          }
        );

        summary += '\nBy Severity:\n';
        Object.entries(this.classificationStats.bySeverity).forEach(
          ([severity, count]) => {
            summary += `  ${severity}: ${count}\n`;
          }
        );

        summary += '\nFix Priority Order:\n';
        const byPriority = this.getErrorsByPriority();
        Object.entries(byPriority).forEach(([priority, errors]) => {
          if (errors.length > 0) {
            summary += `  ${priority.toUpperCase()}: ${errors.length} errors\n`;
          }
        });

        if (this.classificationStats.autoFixable > 0) {
          summary += `\nAuto-fixable: ${this.classificationStats.autoFixable} errors\n`;
        }

        const patterns = this.identifyPatterns();
        if (patterns.length > 0) {
          summary += '\nIdentified Patterns:\n';
          patterns.forEach((pattern) => {
            summary += `  • ${pattern.description}\n`;
          });
        }

        return summary;

      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }
}

// Export singleton instance for global use
export const errorClassifier = new ErrorClassifier();
export default errorClassifier;
