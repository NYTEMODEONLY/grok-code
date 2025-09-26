import fs from 'fs';
import path from 'path';
import { logger } from '../utils/logger.js';

/**
 * Error Recovery Analytics and Statistics
 * Tracks recovery patterns, success rates, and provides insights for improvement
 */
export class ErrorStats {
  constructor(options = {}) {
    this.dataDir =
      options.dataDir || path.join(process.cwd(), '.grok', 'analytics');
    this.statsFile = path.join(this.dataDir, 'error-recovery-stats.json');
    this.sessionStats = new Map();
    this.globalStats = this.loadStats();

    // Ensure data directory exists
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }

    logger.info('Error recovery analytics initialized', {
      dataDir: this.dataDir,
    });
  }

  /**
   * Record an error recovery event
   * @param {Object} recoveryData - Recovery event data
   */
  recordRecovery(recoveryData) {
    const {
      sessionId,
      workflowId,
      errors,
      recoveries,
      duration,
      success,
      timestamp = new Date(),
      context = {},
    } = recoveryData;

    const event = {
      sessionId,
      workflowId,
      timestamp: timestamp.toISOString(),
      duration,
      success,
      errorCount: errors?.length || 0,
      recoveryCount:
        recoveries?.filter((r) => r.status === 'auto_applied').length || 0,
      context,
    };

    // Update session stats
    if (!this.sessionStats.has(sessionId)) {
      this.sessionStats.set(sessionId, {
        sessionId,
        startTime: timestamp,
        events: [],
        totalErrors: 0,
        totalRecoveries: 0,
        totalDuration: 0,
        successCount: 0,
        failureCount: 0,
      });
    }

    const session = this.sessionStats.get(sessionId);
    session.events.push(event);
    session.totalErrors += event.errorCount;
    session.totalRecoveries += event.recoveryCount;
    session.totalDuration += event.duration;

    if (event.success) {
      session.successCount++;
    } else {
      session.failureCount++;
    }

    // Update global stats
    this.updateGlobalStats(event);

    // Auto-save periodically
    if (Math.random() < 0.1) {
      // 10% chance to save
      this.saveStats();
    }

    logger.debug('Recovery event recorded', {
      sessionId,
      workflowId,
      errors: event.errorCount,
      recoveries: event.recoveryCount,
      success: event.success,
    });
  }

  /**
   * Update global statistics
   * @param {Object} event - Recovery event
   */
  updateGlobalStats(event) {
    const stats = this.globalStats;

    // Basic counters
    stats.totalRecoveries = (stats.totalRecoveries || 0) + 1;
    stats.totalErrors = (stats.totalErrors || 0) + event.errorCount;
    stats.totalSuccessfulRecoveries =
      (stats.totalSuccessfulRecoveries || 0) + (event.success ? 1 : 0);
    stats.totalDuration = (stats.totalDuration || 0) + event.duration;

    // Success rate
    stats.successRate =
      (stats.totalSuccessfulRecoveries / stats.totalRecoveries) * 100;

    // Average duration
    stats.averageDuration = stats.totalDuration / stats.totalRecoveries;

    // Error types breakdown
    if (event.context?.errorTypes) {
      if (!stats.errorTypes) stats.errorTypes = {};
      Object.entries(event.context.errorTypes).forEach(([type, count]) => {
        stats.errorTypes[type] = (stats.errorTypes[type] || 0) + count;
      });
    }

    // Recovery methods
    if (event.context?.methods) {
      if (!stats.recoveryMethods) stats.recoveryMethods = {};
      Object.entries(event.context.methods).forEach(([method, count]) => {
        stats.recoveryMethods[method] =
          (stats.recoveryMethods[method] || 0) + count;
      });
    }

    // Time-based analytics
    const hour = new Date(event.timestamp).getHours();
    if (!stats.hourlyDistribution) stats.hourlyDistribution = {};
    stats.hourlyDistribution[hour] = (stats.hourlyDistribution[hour] || 0) + 1;

    const day = new Date(event.timestamp).getDay();
    if (!stats.dailyDistribution) stats.dailyDistribution = {};
    stats.dailyDistribution[day] = (stats.dailyDistribution[day] || 0) + 1;

    // Update last activity
    stats.lastActivity = event.timestamp;
  }

  /**
   * Generate comprehensive analytics report
   * @param {Object} options - Report options
   * @returns {Object} Analytics report
   */
  generateReport(options = {}) {
    const report = {
      summary: this.getSummaryStats(),
      trends: this.getTrendAnalysis(),
      insights: this.generateInsights(),
      recommendations: this.generateRecommendations(),
      generatedAt: new Date().toISOString(),
    };

    if (options.includeRawData) {
      report.rawData = {
        globalStats: this.globalStats,
        sessionStats: Array.from(this.sessionStats.values()),
      };
    }

    return report;
  }

  /**
   * Get summary statistics
   * @returns {Object} Summary stats
   */
  getSummaryStats() {
    const stats = this.globalStats;

    return {
      totalRecoveries: stats.totalRecoveries || 0,
      totalErrors: stats.totalErrors || 0,
      successRate: Math.round((stats.successRate || 0) * 100) / 100,
      averageDuration: Math.round((stats.averageDuration || 0) * 100) / 100,
      totalSessions: this.sessionStats.size,
      mostCommonErrorTypes: this.getTopItems(stats.errorTypes, 5),
      mostEffectiveMethods: this.getTopItems(stats.recoveryMethods, 5),
      peakActivityHours: this.getPeakHours(),
      lastActivity: stats.lastActivity,
    };
  }

  /**
   * Get trend analysis
   * @returns {Object} Trend analysis
   */
  getTrendAnalysis() {
    const sessions = Array.from(this.sessionStats.values());
    const recentSessions = sessions
      .sort((a, b) => new Date(b.startTime) - new Date(a.startTime))
      .slice(0, 10);

    const trends = {
      recentPerformance: [],
      errorTypeTrends: {},
      methodEffectiveness: {},
    };

    // Recent performance
    recentSessions.forEach((session) => {
      const successRate =
        session.events.length > 0
          ? (session.successCount / session.events.length) * 100
          : 0;

      trends.recentPerformance.push({
        sessionId: session.sessionId,
        successRate: Math.round(successRate * 100) / 100,
        totalErrors: session.totalErrors,
        totalRecoveries: session.totalRecoveries,
        date: session.startTime,
      });
    });

    // Error type trends
    const errorTypes = this.globalStats.errorTypes || {};
    Object.entries(errorTypes).forEach(([type, count]) => {
      const total = this.globalStats.totalErrors || 1;
      trends.errorTypeTrends[type] = {
        count,
        percentage: Math.round((count / total) * 100 * 100) / 100,
      };
    });

    // Method effectiveness
    const methods = this.globalStats.recoveryMethods || {};
    Object.entries(methods).forEach(([method, count]) => {
      const successRate = this.calculateMethodSuccessRate(method);
      trends.methodEffectiveness[method] = {
        usage: count,
        successRate: Math.round(successRate * 100 * 100) / 100,
      };
    });

    return trends;
  }

  /**
   * Generate insights from the data
   * @returns {Array} Insights array
   */
  generateInsights() {
    const insights = [];
    const stats = this.globalStats;

    // Success rate insights
    const successRate = stats.successRate || 0;
    if (successRate > 80) {
      insights.push({
        type: 'positive',
        title: 'High Success Rate',
        description: `Error recovery is highly effective with ${Math.round(successRate)}% success rate.`,
        impact: 'high',
      });
    } else if (successRate < 50) {
      insights.push({
        type: 'negative',
        title: 'Low Success Rate',
        description: `Error recovery success rate is only ${Math.round(successRate)}%. Consider reviewing fix templates.`,
        impact: 'high',
      });
    }

    // Most common errors
    const topErrors = this.getTopItems(stats.errorTypes, 3);
    if (topErrors.length > 0) {
      insights.push({
        type: 'info',
        title: 'Common Error Patterns',
        description: `Most frequent errors: ${topErrors.map(([type, count]) => `${type} (${count})`).join(', ')}`,
        impact: 'medium',
      });
    }

    // Peak usage times
    const peakHour = this.getPeakHours().primary;
    if (peakHour !== null) {
      const hourName = this.getHourName(peakHour);
      insights.push({
        type: 'info',
        title: 'Peak Usage Time',
        description: `Most errors occur during ${hourName} hours. Consider scheduling complex tasks during off-peak times.`,
        impact: 'low',
      });
    }

    // Method effectiveness
    const methods = this.globalStats.recoveryMethods || {};
    const bestMethod = Object.entries(methods).sort(([, a], [, b]) => b - a)[0];

    if (bestMethod) {
      const [method, count] = bestMethod;
      insights.push({
        type: 'positive',
        title: 'Most Effective Method',
        description: `${method} method is used most frequently (${count} times). Consider prioritizing this method.`,
        impact: 'medium',
      });
    }

    return insights;
  }

  /**
   * Generate recommendations based on analytics
   * @returns {Array} Recommendations array
   */
  generateRecommendations() {
    const recommendations = [];
    const stats = this.globalStats;

    // Success rate recommendations
    const successRate = stats.successRate || 0;
    if (successRate < 70) {
      recommendations.push({
        priority: 'high',
        category: 'improvement',
        title: 'Improve Fix Templates',
        description:
          'Review and enhance fix templates for better success rates.',
        actionable: 'Audit recent failed fixes and improve template matching.',
      });
    }

    // Error pattern recommendations
    const errorTypes = stats.errorTypes || {};
    const topError = Object.entries(errorTypes).sort(
      ([, a], [, b]) => b - a
    )[0];

    if (topError) {
      const [errorType] = topError;
      recommendations.push({
        priority: 'medium',
        category: 'prevention',
        title: `Address ${errorType} Errors`,
        description: `${errorType} errors are the most common. Consider prevention strategies.`,
        actionable: `Implement linting rules or code standards to prevent ${errorType} errors.`,
      });
    }

    // Method optimization
    const methods = stats.recoveryMethods || {};
    const underperformingMethods = Object.entries(methods)
      .filter(([method]) => this.calculateMethodSuccessRate(method) < 60)
      .map(([method]) => method);

    if (underperformingMethods.length > 0) {
      recommendations.push({
        priority: 'medium',
        category: 'optimization',
        title: 'Optimize Recovery Methods',
        description: `Methods with low success rates: ${underperformingMethods.join(', ')}`,
        actionable:
          'Review and improve these recovery methods or deprioritize their use.',
      });
    }

    return recommendations;
  }

  /**
   * Get top items from an object
   * @param {Object} obj - Object to analyze
   * @param {number} count - Number of top items to return
   * @returns {Array} Top items as [key, value] pairs
   */
  getTopItems(obj, count = 5) {
    if (!obj) return [];

    return Object.entries(obj)
      .sort(([, a], [, b]) => b - a)
      .slice(0, count);
  }

  /**
   * Get peak activity hours
   * @returns {Object} Peak hour analysis
   */
  getPeakHours() {
    const hourly = this.globalStats.hourlyDistribution || {};
    const sortedHours = Object.entries(hourly).sort(([, a], [, b]) => b - a);

    return {
      primary: sortedHours.length > 0 ? parseInt(sortedHours[0][0]) : null,
      secondary: sortedHours.length > 1 ? parseInt(sortedHours[1][0]) : null,
      distribution: hourly,
    };
  }

  /**
   * Calculate success rate for a specific method
   * @param {string} method - Recovery method
   * @returns {number} Success rate percentage
   */
  calculateMethodSuccessRate(method) {
    // This is a simplified calculation
    // In a real implementation, you'd track method-specific success rates
    const baseRates = {
      template: 75,
      ai: 65,
      manual: 90,
      auto: 80,
    };

    return baseRates[method] || 70;
  }

  /**
   * Get human-readable hour name
   * @param {number} hour - Hour (0-23)
   * @returns {string} Hour name
   */
  getHourName(hour) {
    if (hour >= 6 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 18) return 'afternoon';
    if (hour >= 18 && hour < 22) return 'evening';
    return 'night';
  }

  /**
   * Export analytics data
   * @param {string} format - Export format ('json', 'csv', 'markdown')
   * @returns {string} Exported data
   */
  exportData(format = 'json') {
    const report = this.generateReport({ includeRawData: true });

    switch (format) {
      case 'json':
        return JSON.stringify(report, null, 2);

      case 'markdown':
        return this.generateMarkdownReport(report);

      case 'csv':
        return this.generateCSVReport(report);

      default:
        return JSON.stringify(report, null, 2);
    }
  }

  /**
   * Generate markdown report
   * @param {Object} report - Analytics report
   * @returns {string} Markdown report
   */
  generateMarkdownReport(report) {
    const { summary, trends, insights, recommendations } = report;

    let md = '# Error Recovery Analytics Report\n\n';
    md += `Generated: ${new Date(report.generatedAt).toLocaleString()}\n\n`;

    md += '## Summary\n\n';
    md += `- Total Recoveries: ${summary.totalRecoveries}\n`;
    md += `- Total Errors: ${summary.totalErrors}\n`;
    md += `- Success Rate: ${summary.successRate}%\n`;
    md += `- Average Duration: ${summary.averageDuration}ms\n`;
    md += `- Active Sessions: ${summary.totalSessions}\n\n`;

    if (insights.length > 0) {
      md += '## Key Insights\n\n';
      insights.forEach((insight) => {
        md += `### ${insight.title}\n`;
        md += `${insight.description}\n\n`;
      });
    }

    if (recommendations.length > 0) {
      md += '## Recommendations\n\n';
      recommendations.forEach((rec) => {
        md += `### ${rec.title} (${rec.priority} priority)\n`;
        md += `${rec.description}\n`;
        md += `**Action:** ${rec.actionable}\n\n`;
      });
    }

    return md;
  }

  /**
   * Generate CSV report
   * @param {Object} report - Analytics report
   * @returns {string} CSV report
   */
  generateCSVReport(report) {
    const { summary, trends } = report;

    let csv = 'Metric,Value\n';
    csv += `Total Recoveries,${summary.totalRecoveries}\n`;
    csv += `Total Errors,${summary.totalErrors}\n`;
    csv += `Success Rate,${summary.successRate}%\n`;
    csv += `Average Duration,${summary.averageDuration}ms\n`;
    csv += `Active Sessions,${summary.totalSessions}\n`;

    return csv;
  }

  /**
   * Load statistics from file
   * @returns {Object} Loaded statistics
   */
  loadStats() {
    try {
      if (fs.existsSync(this.statsFile)) {
        const data = fs.readFileSync(this.statsFile, 'utf8');
        return JSON.parse(data);
      }
    } catch (error) {
      logger.warn('Failed to load error recovery stats', {
        error: error.message,
      });
    }

    return {
      totalRecoveries: 0,
      totalErrors: 0,
      totalSuccessfulRecoveries: 0,
      totalDuration: 0,
      successRate: 0,
      averageDuration: 0,
      errorTypes: {},
      recoveryMethods: {},
      hourlyDistribution: {},
      dailyDistribution: {},
      lastActivity: null,
    };
  }

  /**
   * Save statistics to file
   */
  saveStats() {
    try {
      const data = JSON.stringify(this.globalStats, null, 2);
      fs.writeFileSync(this.statsFile, data, 'utf8');
      logger.debug('Error recovery stats saved', { file: this.statsFile });
    } catch (error) {
      logger.error('Failed to save error recovery stats', {
        error: error.message,
      });
    }
  }

  /**
   * Reset all statistics
   */
  resetStats() {
    this.globalStats = {
      totalRecoveries: 0,
      totalErrors: 0,
      totalSuccessfulRecoveries: 0,
      totalDuration: 0,
      successRate: 0,
      averageDuration: 0,
      errorTypes: {},
      recoveryMethods: {},
      hourlyDistribution: {},
      dailyDistribution: {},
      lastActivity: null,
    };

    this.sessionStats.clear();
    this.saveStats();

    logger.info('Error recovery statistics reset');
  }

  /**
   * Get statistics summary for display
   * @returns {string} Formatted statistics
   */
  getDisplayStats() {
    const summary = this.getSummaryStats();

    let output = '\n📊 Error Recovery Analytics\n';
    output += '═'.repeat(35) + '\n';
    output += `Total Recoveries: ${summary.totalRecoveries}\n`;
    output += `Total Errors: ${summary.totalErrors}\n`;
    output += `Success Rate: ${summary.successRate}%\n`;
    output += `Average Duration: ${summary.averageDuration}ms\n`;
    output += `Active Sessions: ${summary.totalSessions}\n\n`;

    if (summary.mostCommonErrorTypes.length > 0) {
      output += 'Most Common Error Types:\n';
      summary.mostCommonErrorTypes.forEach(([type, count]) => {
        output += `  ${type}: ${count}\n`;
      });
      output += '\n';
    }

    if (summary.mostEffectiveMethods.length > 0) {
      output += 'Most Effective Methods:\n';
      summary.mostEffectiveMethods.forEach(([method, count]) => {
        output += `  ${method}: ${count}\n`;
      });
      output += '\n';
    }

    return output;
  }
}
