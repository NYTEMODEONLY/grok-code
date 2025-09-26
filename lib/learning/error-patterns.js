import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { logger } from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class ErrorPatterns {
  constructor() {
    this.patternsFile = path.join(__dirname, '../../.grok/error-patterns.json');
    this.sessionPatterns = new Map();

    // Pattern categories (define before loadPatterns)
    this.categories = {
      frequency: 'error_frequency', // How often errors occur
      location: 'error_locations', // Where errors happen (files, functions)
      temporal: 'temporal_patterns', // When errors occur (time-based)
      contextual: 'context_patterns', // Project/file type patterns
      fix_success: 'fix_success_rates', // Which fixes work for which errors
      prevention: 'prevention_opportunities', // Patterns that suggest prevention
    };

    this.globalPatterns = this.loadPatterns();

    // Learning thresholds
    this.thresholds = {
      significantFrequency: 3, // Errors that occur 3+ times are significant
      learningPeriod: 30, // Days to consider for learning
      confidenceThreshold: 0.7, // Minimum confidence for recommendations
      patternMaturity: 5, // Patterns need 5 occurrences to be mature
    };

    logger.info('Error patterns learning system initialized');
  }

  /**
   * Record an error occurrence for pattern analysis
   * @param {Object} error - Classified error object
   * @param {Object} context - Error context (file, project, user, etc.)
   */
  recordError(error, context = {}) {
    const errorKey = this.generateErrorKey(error);
    const timestamp = new Date().toISOString();

    const pattern = {
      error: { ...error },
      context: { ...context },
      timestamp,
      sessionId: context.sessionId || 'unknown',
      userId: context.userId || 'anonymous',
      projectId: context.projectId || this.extractProjectId(context),
      filePath: context.filePath || error.file,
      functionName: this.extractFunctionName(error, context),
      lineNumber: error.line,
      columnNumber: error.column,
      stackTrace: context.stackTrace,
      userAction: context.userAction || 'unknown', // what user was doing
      environment: this.captureEnvironment(context),
    };

    // Add to session patterns
    if (!this.sessionPatterns.has(errorKey)) {
      this.sessionPatterns.set(errorKey, []);
    }
    this.sessionPatterns.get(errorKey).push(pattern);

    // Add to global patterns
    this.addToGlobalPatterns(pattern);

    logger.debug('Error pattern recorded', { errorKey, type: error.type });
  }

  /**
   * Record a fix attempt and outcome for learning
   * @param {Object} error - The error that was fixed
   * @param {Object} fix - The fix that was applied
   * @param {boolean} success - Whether the fix was successful
   * @param {Object} context - Additional context
   */
  recordFixAttempt(error, fix, success, context = {}) {
    const errorKey = this.generateErrorKey(error);
    const fixKey = this.generateFixKey(fix);
    const timestamp = new Date().toISOString();

    const fixRecord = {
      errorKey,
      fixKey,
      fixMethod: fix.method || 'unknown',
      success,
      confidence: fix.confidence || 0,
      duration: context.duration || 0,
      timestamp,
      sessionId: context.sessionId,
      userId: context.userId,
      projectId: context.projectId,
      wasAutoApplied: context.wasAutoApplied || false,
      userFeedback: context.userFeedback,
      rollbackReason: context.rollbackReason,
    };

    // Update global patterns with fix data
    this.updateFixPatterns(errorKey, fixRecord);

    logger.debug('Fix attempt recorded', {
      errorKey,
      fixKey,
      success,
      method: fix.method,
    });
  }

  /**
   * Analyze patterns and generate insights
   * @param {Object} context - Context for analysis (user, project, time range)
   * @returns {Object} Pattern analysis results
   */
  analyzePatterns(context = {}) {
    const analysis = {
      frequentErrors: this.getFrequentErrors(context),
      locationHotspots: this.getLocationHotspots(context),
      temporalPatterns: this.getTemporalPatterns(context),
      fixEffectiveness: this.getFixEffectiveness(context),
      preventionSuggestions: this.getPreventionSuggestions(context),
      recommendations: this.generateRecommendations(context),
      insights: this.generateInsights(context),
    };

    return analysis;
  }

  /**
   * Get frequently occurring errors
   */
  getFrequentErrors(context = {}) {
    const errors = {};

    // Count error frequencies
    for (const [errorKey, patterns] of Object.entries(
      this.globalPatterns.error_frequency || {}
    )) {
      const frequency = patterns.length;
      if (frequency >= this.thresholds.significantFrequency) {
        const latest = patterns[patterns.length - 1];
        errors[errorKey] = {
          frequency,
          lastOccurred: latest.timestamp,
          error: latest.error,
          trend: this.calculateTrend(patterns),
          riskLevel: this.assessRiskLevel(frequency, patterns),
        };
      }
    }

    return Object.values(errors)
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 10); // Top 10
  }

  /**
   * Get error hotspots by location
   */
  getLocationHotspots(context = {}) {
    const hotspots = {};

    for (const [errorKey, patterns] of Object.entries(
      this.globalPatterns.error_locations || {}
    )) {
      for (const pattern of patterns) {
        const locationKey = `${pattern.filePath}:${pattern.functionName || 'global'}`;

        if (!hotspots[locationKey]) {
          hotspots[locationKey] = {
            filePath: pattern.filePath,
            functionName: pattern.functionName,
            errorCount: 0,
            errorTypes: new Set(),
            lastError: null,
          };
        }

        hotspots[locationKey].errorCount++;
        hotspots[locationKey].errorTypes.add(pattern.error.type);
        hotspots[locationKey].lastError = pattern.timestamp;
      }
    }

    // Convert Sets to Arrays for JSON serialization
    Object.values(hotspots).forEach((hotspot) => {
      hotspot.errorTypes = Array.from(hotspot.errorTypes);
    });

    return Object.values(hotspots)
      .sort((a, b) => b.errorCount - a.errorCount)
      .slice(0, 10);
  }

  /**
   * Get temporal patterns (when errors occur)
   */
  getTemporalPatterns(context = {}) {
    const patterns = {
      hourly: new Array(24).fill(0),
      daily: new Array(7).fill(0),
      monthly: new Array(12).fill(0),
    };

    for (const category of Object.values(this.globalPatterns)) {
      if (Array.isArray(category)) {
        for (const pattern of category) {
          const date = new Date(pattern.timestamp);
          patterns.hourly[date.getHours()]++;
          patterns.daily[date.getDay()]++;
          patterns.monthly[date.getMonth()]++;
        }
      }
    }

    return {
      peakHours: this.findPeaks(patterns.hourly, 'hour'),
      peakDays: this.findPeaks(patterns.daily, 'day'),
      peakMonths: this.findPeaks(patterns.monthly, 'month'),
      patterns,
    };
  }

  /**
   * Get fix effectiveness by error type and method
   */
  getFixEffectiveness(context = {}) {
    const effectiveness = {};

    for (const [errorKey, fixRecords] of Object.entries(
      this.globalPatterns.fix_success_rates || {}
    )) {
      const byMethod = {};

      for (const record of fixRecords) {
        if (!byMethod[record.fixMethod]) {
          byMethod[record.fixMethod] = { attempts: 0, successes: 0 };
        }

        byMethod[record.fixMethod].attempts++;
        if (record.success) {
          byMethod[record.fixMethod].successes++;
        }
      }

      // Calculate success rates
      Object.keys(byMethod).forEach((method) => {
        const stats = byMethod[method];
        stats.successRate =
          stats.attempts > 0 ? stats.successes / stats.attempts : 0;
        stats.confidence = Math.min(
          stats.attempts / this.thresholds.patternMaturity,
          1
        );
      });

      effectiveness[errorKey] = byMethod;
    }

    return effectiveness;
  }

  /**
   * Generate prevention suggestions based on patterns
   */
  getPreventionSuggestions(context = {}) {
    const suggestions = [];

    // Suggest linting rules based on frequent errors
    const frequentErrors = this.getFrequentErrors(context);
    for (const error of frequentErrors) {
      if (error.error.type === 'style' && error.frequency > 5) {
        suggestions.push({
          type: 'linting_rule',
          priority: 'high',
          description: `Consider adding ESLint rule for ${error.error.rule || error.error.type}`,
          impact: `Could prevent ${error.frequency} style errors per session`,
          confidence: 0.8,
        });
      }
    }

    // Suggest type checking for type errors
    const typeErrors = frequentErrors.filter((e) => e.error.type === 'type');
    if (typeErrors.length > 3) {
      suggestions.push({
        type: 'type_checking',
        priority: 'high',
        description:
          'Enable strict TypeScript checking or add type annotations',
        impact: `Could prevent ${typeErrors.reduce((sum, e) => sum + e.frequency, 0)} type errors`,
        confidence: 0.9,
      });
    }

    return suggestions;
  }

  /**
   * Generate personalized recommendations
   */
  generateRecommendations(context = {}) {
    const recommendations = [];

    // Recommend best fixes for common errors
    const fixEffectiveness = this.getFixEffectiveness(context);
    for (const [errorKey, methods] of Object.entries(fixEffectiveness)) {
      const bestMethod = Object.entries(methods)
        .filter(
          ([_, stats]) =>
            stats.confidence >= this.thresholds.confidenceThreshold
        )
        .sort(([_, a], [__, b]) => b.successRate - a.successRate)[0];

      if (bestMethod) {
        recommendations.push({
          type: 'fix_preference',
          errorType: errorKey,
          recommendedMethod: bestMethod[0],
          successRate: bestMethod[1].successRate,
          confidence: bestMethod[1].confidence,
          description: `For ${errorKey} errors, ${bestMethod[0]} fixes work ${Math.round(bestMethod[1].successRate * 100)}% of the time`,
        });
      }
    }

    return recommendations;
  }

  /**
   * Generate insights from pattern analysis
   */
  generateInsights(context = {}) {
    const insights = [];

    // Insight 1: Most problematic file types
    const fileTypeErrors = {};
    for (const [errorKey, patterns] of Object.entries(
      this.globalPatterns.error_locations || {}
    )) {
      for (const pattern of patterns) {
        if (pattern.filePath) {
          const ext = path.extname(pattern.filePath);
          fileTypeErrors[ext] = (fileTypeErrors[ext] || 0) + 1;
        }
      }
    }

    const worstFileType = Object.entries(fileTypeErrors).sort(
      ([, a], [, b]) => b - a
    )[0];

    if (worstFileType) {
      insights.push({
        type: 'file_type_risk',
        title: `High error rate in ${worstFileType[0]} files`,
        description: `${worstFileType[1]} errors recorded in ${worstFileType[0]} files`,
        suggestion: `Consider additional linting or code review for ${worstFileType[0]} files`,
      });
    }

    // Insight 2: Learning progress
    const totalPatterns = Object.values(this.globalPatterns).reduce(
      (sum, category) => sum + (Array.isArray(category) ? category.length : 0),
      0
    );

    insights.push({
      type: 'learning_progress',
      title: 'Pattern Learning Progress',
      description: `Learned from ${totalPatterns} error occurrences across all sessions`,
      suggestion:
        totalPatterns > 100
          ? 'System has sufficient data for reliable recommendations'
          : 'Continue using the system to improve pattern recognition',
    });

    return insights;
  }

  // ===== PRIVATE METHODS =====

  /**
   * Generate a unique key for an error
   */
  generateErrorKey(error) {
    const components = [
      error.type,
      error.rule || 'unknown',
      error.message ? error.message.substring(0, 50) : 'no-message',
    ];
    return components.join('|').replace(/[^a-zA-Z0-9|_-]/g, '_');
  }

  /**
   * Generate a unique key for a fix
   */
  generateFixKey(fix) {
    return `${fix.method || 'unknown'}|${fix.type || 'unknown'}`;
  }

  /**
   * Add pattern to global patterns storage
   */
  addToGlobalPatterns(pattern) {
    const errorKey = this.generateErrorKey(pattern.error);

    // Initialize categories if needed
    if (!this.globalPatterns[this.categories.frequency]) {
      this.globalPatterns[this.categories.frequency] = {};
    }
    if (!this.globalPatterns[this.categories.location]) {
      this.globalPatterns[this.categories.location] = {};
    }

    // Add to frequency tracking
    if (!this.globalPatterns[this.categories.frequency][errorKey]) {
      this.globalPatterns[this.categories.frequency][errorKey] = [];
    }
    this.globalPatterns[this.categories.frequency][errorKey].push(pattern);

    // Add to location tracking
    if (!this.globalPatterns[this.categories.location][errorKey]) {
      this.globalPatterns[this.categories.location][errorKey] = [];
    }
    this.globalPatterns[this.categories.location][errorKey].push(pattern);

    // Limit stored patterns to prevent unbounded growth
    this.pruneOldPatterns();
  }

  /**
   * Update fix patterns with new fix attempt data
   */
  updateFixPatterns(errorKey, fixRecord) {
    if (!this.globalPatterns[this.categories.fix_success]) {
      this.globalPatterns[this.categories.fix_success] = {};
    }

    if (!this.globalPatterns[this.categories.fix_success][errorKey]) {
      this.globalPatterns[this.categories.fix_success][errorKey] = [];
    }

    this.globalPatterns[this.categories.fix_success][errorKey].push(fixRecord);
  }

  /**
   * Load patterns from disk
   */
  loadPatterns() {
    try {
      if (fs.existsSync(this.patternsFile)) {
        const data = fs.readFileSync(this.patternsFile, 'utf8');
        return JSON.parse(data);
      }
    } catch (error) {
      logger.warn('Failed to load error patterns', { error: error.message });
    }

    // Return default structure
    return {
      [this.categories.frequency]: {},
      [this.categories.location]: {},
      [this.categories.temporal]: {},
      [this.categories.contextual]: {},
      [this.categories.fix_success]: {},
      [this.categories.prevention]: {},
      metadata: {
        created: new Date().toISOString(),
        version: '1.0',
      },
    };
  }

  /**
   * Save patterns to disk
   */
  savePatterns() {
    try {
      // Update metadata
      this.globalPatterns.metadata = {
        ...this.globalPatterns.metadata,
        lastUpdated: new Date().toISOString(),
        totalPatterns: this.getTotalPatternCount(),
      };

      fs.writeFileSync(
        this.patternsFile,
        JSON.stringify(this.globalPatterns, null, 2)
      );
      logger.debug('Error patterns saved to disk');
    } catch (error) {
      logger.error('Failed to save error patterns', { error: error.message });
    }
  }

  /**
   * Prune old patterns to prevent unbounded growth
   */
  pruneOldPatterns() {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.thresholds.learningPeriod);

    for (const category of Object.values(this.categories)) {
      if (
        this.globalPatterns[category] &&
        typeof this.globalPatterns[category] === 'object'
      ) {
        for (const [key, patterns] of Object.entries(
          this.globalPatterns[category]
        )) {
          if (Array.isArray(patterns)) {
            // Keep only recent patterns
            this.globalPatterns[category][key] = patterns.filter((pattern) => {
              return new Date(pattern.timestamp) > cutoffDate;
            });
          }
        }
      }
    }
  }

  /**
   * Calculate trend for error frequency
   */
  calculateTrend(patterns) {
    if (patterns.length < 2) return 'stable';

    const recent = patterns.slice(-Math.ceil(patterns.length / 2));
    const older = patterns.slice(0, Math.floor(patterns.length / 2));

    const recentAvg = recent.length / 7; // Daily average for recent period
    const olderAvg = older.length / 7; // Daily average for older period

    if (recentAvg > olderAvg * 1.5) return 'increasing';
    if (recentAvg < olderAvg * 0.7) return 'decreasing';
    return 'stable';
  }

  /**
   * Assess risk level based on frequency and patterns
   */
  assessRiskLevel(frequency, patterns) {
    let score = frequency;

    // Increase score for recent occurrences
    const recent = patterns.filter((p) => {
      const age = Date.now() - new Date(p.timestamp).getTime();
      return age < 7 * 24 * 60 * 60 * 1000; // Last 7 days
    });
    score += recent.length * 2;

    if (score >= 20) return 'critical';
    if (score >= 10) return 'high';
    if (score >= 5) return 'medium';
    return 'low';
  }

  /**
   * Find peaks in temporal data
   */
  findPeaks(data, type) {
    const peaks = [];
    const threshold = Math.max(...data) * 0.7; // 70% of max

    for (let i = 0; i < data.length; i++) {
      if (data[i] >= threshold) {
        peaks.push({
          index: i,
          value: data[i],
          type,
        });
      }
    }

    return peaks;
  }

  /**
   * Extract project ID from context
   */
  extractProjectId(context) {
    return context.projectRoot
      ? path.basename(context.projectRoot)
      : 'unknown-project';
  }

  /**
   * Extract function name from error context
   */
  extractFunctionName(error, context) {
    // Try to extract from stack trace or code context
    if (context.stackTrace) {
      const match = context.stackTrace.match(/at\s+(\w+)\s*\(/);
      if (match) return match[1];
    }

    // Could be enhanced with AST analysis
    return null;
  }

  /**
   * Capture environment information
   */
  captureEnvironment(context) {
    return {
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      cwd: process.cwd(),
      timestamp: new Date().toISOString(),
      ...context.environment,
    };
  }

  /**
   * Get total count of all patterns
   */
  getTotalPatternCount() {
    return Object.values(this.globalPatterns).reduce((sum, category) => {
      if (Array.isArray(category)) {
        return sum + category.length;
      } else if (typeof category === 'object') {
        return (
          sum +
          Object.values(category).reduce(
            (catSum, patterns) =>
              catSum + (Array.isArray(patterns) ? patterns.length : 0),
            0
          )
        );
      }
      return sum;
    }, 0);
  }

  /**
   * Get learning statistics
   */
  getStats() {
    return {
      totalPatterns: this.getTotalPatternCount(),
      sessionPatterns: this.sessionPatterns.size,
      categoriesTracked: Object.keys(this.categories).length,
      frequentErrors: Object.keys(
        this.globalPatterns[this.categories.frequency] || {}
      ).length,
      locationHotspots: Object.keys(
        this.globalPatterns[this.categories.location] || {}
      ).length,
      fixRecords: Object.keys(
        this.globalPatterns[this.categories.fix_success] || {}
      ).length,
      learningPeriod: this.thresholds.learningPeriod,
      lastUpdated: this.globalPatterns.metadata?.lastUpdated,
    };
  }

  /**
   * Export patterns for analysis or backup
   */
  exportPatterns() {
    return {
      ...this.globalPatterns,
      exportDate: new Date().toISOString(),
      stats: this.getStats(),
    };
  }

  /**
   * Import patterns (for migration or testing)
   */
  importPatterns(patterns) {
    this.globalPatterns = { ...patterns };
    delete this.globalPatterns.exportDate;
    delete this.globalPatterns.stats;
    this.savePatterns();
    logger.info('Error patterns imported successfully');
  }

  /**
   * Clear all patterns (for testing or reset)
   */
  clearPatterns() {
    this.globalPatterns = this.loadPatterns(); // Reset to default
    this.sessionPatterns.clear();
    this.savePatterns();
    logger.info('Error patterns cleared');
  }

  /**
   * Cleanup method - save patterns and cleanup
   */
  cleanup() {
    this.savePatterns();
  }
}
