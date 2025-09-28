import fs from 'fs-extra';
import path from 'path';
import { logger } from '../utils/logger.js';

/**
 * Team-Specific Patterns Learning System
 * Learns and adapts to team coding preferences through user interactions
 */
export class TeamPatternsLearner {
  constructor(options = {}) {
    this.projectRoot = options.projectRoot || process.cwd();
    this.patternsFile = path.join(
      this.projectRoot,
      '.grok',
      'team-patterns.json'
    );
    this.maxHistorySize = options.maxHistorySize || 1000;
    this.confidenceThreshold = options.confidenceThreshold || 0.7;

    // Learning data
    this.patterns = {
      naming: {
        accepted: {},
        rejected: {},
        confidence: {},
      },
      style: {
        accepted: {},
        rejected: {},
        confidence: {},
      },
      structure: {
        accepted: {},
        rejected: {},
        confidence: {},
      },
      corrections: [],
      sessions: [],
    };

    this.sessionStartTime = Date.now();
    this.currentSession = {
      interactions: [],
      patterns: {},
      startTime: this.sessionStartTime,
    };

    this.loadPatterns();
    logger.debug('Team patterns learner initialized', {
      patternsFile: this.patternsFile,
      existingPatterns: Object.keys(this.patterns.naming.accepted).length,
    });
  }

  /**
   * Load persisted team patterns
   */
  async loadPatterns() {
    try {
      await fs.ensureDir(path.dirname(this.patternsFile));
      if (await fs.pathExists(this.patternsFile)) {
        const data = await fs.readJson(this.patternsFile);
        this.patterns = { ...this.patterns, ...data };
        logger.info('Loaded team patterns from disk', {
          corrections: this.patterns.corrections.length,
          sessions: this.patterns.sessions.length,
        });
      }
    } catch (error) {
      logger.warn('Failed to load team patterns, starting fresh', {
        error: error.message,
      });
    }
  }

  /**
   * Save team patterns to disk
   */
  async savePatterns() {
    try {
      await fs.ensureDir(path.dirname(this.patternsFile));
      await fs.writeJson(this.patternsFile, this.patterns, { spaces: 2 });
      logger.debug('Saved team patterns to disk');
    } catch (error) {
      logger.error('Failed to save team patterns', { error: error.message });
    }
  }

  /**
   * Record user interaction with a suggestion
   * @param {Object} interaction - Interaction data
   */
  recordInteraction(interaction) {
    const record = {
      timestamp: Date.now(),
      type: interaction.type, // 'accepted', 'rejected', 'corrected'
      category: interaction.category, // 'naming', 'style', 'structure'
      pattern: interaction.pattern, // the pattern used
      correction: interaction.correction, // what user changed it to (if corrected)
      context: interaction.context || {}, // file type, framework, etc.
      confidence: interaction.confidence || 0,
    };

    // Add to current session
    this.currentSession.interactions.push(record);

    // Update patterns based on interaction
    this.updatePatterns(record);

    // Keep corrections history bounded
    if (this.patterns.corrections.length >= this.maxHistorySize) {
      this.patterns.corrections.shift();
    }
    this.patterns.corrections.push(record);

    logger.debug('Recorded team interaction', {
      type: record.type,
      category: record.category,
      pattern: record.pattern,
    });
  }

  /**
   * Update pattern learning based on interaction
   * @param {Object} interaction - The interaction record
   */
  updatePatterns(interaction) {
    const { type, category, pattern, correction } = interaction;

    if (!this.patterns[category]) {
      this.patterns[category] = { accepted: {}, rejected: {}, confidence: {} };
    }

    const categoryPatterns = this.patterns[category];

    if (type === 'accepted') {
      categoryPatterns.accepted[pattern] =
        (categoryPatterns.accepted[pattern] || 0) + 1;
    } else if (type === 'rejected') {
      categoryPatterns.rejected[pattern] =
        (categoryPatterns.rejected[pattern] || 0) + 1;
    } else if (type === 'corrected' && correction) {
      // Learn that user prefers correction over pattern
      categoryPatterns.rejected[pattern] =
        (categoryPatterns.rejected[pattern] || 0) + 1;
      categoryPatterns.accepted[correction] =
        (categoryPatterns.accepted[correction] || 0) + 1;
    }

    // Update confidence scores
    this.updateConfidence(category);
  }

  /**
   * Update confidence scores for patterns in a category
   * @param {string} category - Category to update
   */
  updateConfidence(category) {
    const catPatterns = this.patterns[category];
    const totalAccepted = Object.values(catPatterns.accepted).reduce(
      (a, b) => a + b,
      0
    );
    const totalRejected = Object.values(catPatterns.rejected).reduce(
      (a, b) => a + b,
      0
    );
    const totalInteractions = totalAccepted + totalRejected;

    if (totalInteractions < 5) return; // Need minimum data

    // Calculate confidence for each pattern
    const allPatterns = new Set([
      ...Object.keys(catPatterns.accepted),
      ...Object.keys(catPatterns.rejected),
    ]);

    for (const pattern of allPatterns) {
      const accepted = catPatterns.accepted[pattern] || 0;
      const rejected = catPatterns.rejected[pattern] || 0;
      const total = accepted + rejected;

      if (total > 0) {
        // Wilson score confidence interval approximation
        const p = accepted / total;
        const n = total;
        const z = 1.96; // 95% confidence

        const confidence =
          (p +
            (z * z) / (2 * n) -
            z * Math.sqrt((p * (1 - p) + (z * z) / (4 * n)) / n)) /
          (1 + (z * z) / n);
        catPatterns.confidence[pattern] = Math.max(0, Math.min(1, confidence));
      }
    }
  }

  /**
   * Get team preference for a pattern category
   * @param {string} category - Category (naming, style, structure)
   * @param {Object} context - Additional context
   * @returns {Object} Team preferences with confidence
   */
  getTeamPreferences(category, context = {}) {
    if (!this.patterns[category]) {
      return { preferences: {}, confidence: 0 };
    }

    const catPatterns = this.patterns[category];
    const preferences = {};

    // Get patterns above confidence threshold
    for (const [pattern, confidence] of Object.entries(
      catPatterns.confidence
    )) {
      if (confidence >= this.confidenceThreshold) {
        const accepted = catPatterns.accepted[pattern] || 0;
        const rejected = catPatterns.rejected[pattern] || 0;
        preferences[pattern] = {
          confidence,
          score: accepted - rejected,
          totalInteractions: accepted + rejected,
        };
      }
    }

    // Sort by confidence and score
    const sortedPreferences = Object.entries(preferences)
      .sort(([, a], [, b]) => {
        if (Math.abs(b.confidence - a.confidence) > 0.1)
          return b.confidence - a.confidence;
        return b.score - a.score;
      })
      .reduce((obj, [key, value]) => {
        obj[key] = value;
        return obj;
      }, {});

    return {
      preferences: sortedPreferences,
      totalPatterns: Object.keys(catPatterns.confidence).length,
      highConfidencePatterns: Object.keys(sortedPreferences).length,
    };
  }

  /**
   * Get recommended pattern for a category
   * @param {string} category - Category to get recommendation for
   * @param {Array} options - Available options to choose from
   * @returns {string|null} Recommended pattern or null
   */
  getRecommendedPattern(category, options = []) {
    const prefs = this.getTeamPreferences(category);

    // If we have team preferences, use them
    if (Object.keys(prefs.preferences).length > 0) {
      const topPreference = Object.keys(prefs.preferences)[0];
      if (options.length === 0 || options.includes(topPreference)) {
        return topPreference;
      }
    }

    // Fallback to most common pattern if available
    if (options.length > 0) {
      return this.getMostCommonPattern(category, options);
    }

    return null;
  }

  /**
   * Get most common pattern from historical data
   * @param {string} category - Category
   * @param {Array} options - Available options
   * @returns {string|null} Most common pattern
   */
  getMostCommonPattern(category, options = []) {
    if (!this.patterns[category]) return null;

    const catPatterns = this.patterns[category];
    let maxCount = 0;
    let mostCommon = null;

    for (const option of options) {
      const count = catPatterns.accepted[option] || 0;
      if (count > maxCount) {
        maxCount = count;
        mostCommon = option;
      }
    }

    return mostCommon;
  }

  /**
   * Learn from user correction of a suggestion
   * @param {string} originalPattern - What was suggested
   * @param {string} correctedPattern - What user changed it to
   * @param {string} category - Category of the pattern
   * @param {Object} context - Additional context
   */
  learnFromCorrection(
    originalPattern,
    correctedPattern,
    category,
    context = {}
  ) {
    this.recordInteraction({
      type: 'corrected',
      category,
      pattern: originalPattern,
      correction: correctedPattern,
      context,
    });
  }

  /**
   * Learn from user acceptance of a suggestion
   * @param {string} pattern - Accepted pattern
   * @param {string} category - Category
   * @param {Object} context - Additional context
   */
  learnFromAcceptance(pattern, category, context = {}) {
    this.recordInteraction({
      type: 'accepted',
      category,
      pattern,
      context,
    });
  }

  /**
   * Learn from user rejection of a suggestion
   * @param {string} pattern - Rejected pattern
   * @param {string} category - Category
   * @param {Object} context - Additional context
   */
  learnFromRejection(pattern, category, context = {}) {
    this.recordInteraction({
      type: 'rejected',
      category,
      pattern,
      context,
    });
  }

  /**
   * End current session and save patterns
   */
  async endSession() {
    this.currentSession.endTime = Date.now();
    this.currentSession.duration =
      this.currentSession.endTime - this.currentSession.startTime;

    // Add session summary
    this.currentSession.summary = {
      interactions: this.currentSession.interactions.length,
      categories: [
        ...new Set(this.currentSession.interactions.map((i) => i.category)),
      ],
      patterns: this.currentSession.interactions.reduce((acc, i) => {
        acc[i.pattern] = (acc[i.pattern] || 0) + 1;
        return acc;
      }, {}),
    };

    // Keep sessions history bounded
    if (this.patterns.sessions.length >= 100) {
      this.patterns.sessions.shift();
    }
    this.patterns.sessions.push(this.currentSession);

    await this.savePatterns();

    logger.info('Team patterns session ended', {
      duration: this.currentSession.duration,
      interactions: this.currentSession.interactions.length,
    });
  }

  /**
   * Get learning statistics
   * @returns {Object} Learning statistics
   */
  getStatistics() {
    const stats = {
      totalInteractions: this.patterns.corrections.length,
      sessionsCount: this.patterns.sessions.length,
      categories: {},
      patternsLearned: {},
      avgConfidence: {},
    };

    // Category statistics
    for (const category of ['naming', 'style', 'structure']) {
      if (this.patterns[category]) {
        const cat = this.patterns[category];
        stats.categories[category] = {
          accepted: Object.keys(cat.accepted).length,
          rejected: Object.keys(cat.rejected).length,
          confident: Object.values(cat.confidence).filter(
            (c) => c >= this.confidenceThreshold
          ).length,
        };

        // Average confidence
        const confidences = Object.values(cat.confidence);
        if (confidences.length > 0) {
          stats.avgConfidence[category] =
            confidences.reduce((a, b) => a + b, 0) / confidences.length;
        }
      }
    }

    // Pattern counts
    const allPatterns = new Set();
    for (const category of ['naming', 'style', 'structure']) {
      if (this.patterns[category]) {
        Object.keys(this.patterns[category].accepted).forEach((p) =>
          allPatterns.add(p)
        );
        Object.keys(this.patterns[category].rejected).forEach((p) =>
          allPatterns.add(p)
        );
      }
    }
    stats.patternsLearned = allPatterns.size;

    return stats;
  }

  /**
   * Generate insights report
   * @returns {string} Human-readable insights
   */
  generateInsightsReport() {
    const stats = this.getStatistics();
    let report = '🧠 Team Learning Insights\n';
    report += '='.repeat(25) + '\n\n';

    report += `📊 Learning Statistics:\n`;
    report += `  • Total Interactions: ${stats.totalInteractions}\n`;
    report += `  • Sessions: ${stats.sessionsCount}\n`;
    report += `  • Patterns Learned: ${stats.patternsLearned}\n\n`;

    for (const [category, catStats] of Object.entries(stats.categories)) {
      report += `🎯 ${category.charAt(0).toUpperCase() + category.slice(1)} Patterns:\n`;
      report += `  • Learned: ${catStats.accepted + catStats.rejected}\n`;
      report += `  • High Confidence: ${catStats.confident}\n`;
      if (stats.avgConfidence[category]) {
        report += `  • Avg Confidence: ${(stats.avgConfidence[category] * 100).toFixed(1)}%\n`;
      }
      report += '\n';
    }

    // Top preferences
    report += '⭐ Top Team Preferences:\n';
    for (const category of ['naming', 'style', 'structure']) {
      const prefs = this.getTeamPreferences(category);
      if (Object.keys(prefs.preferences).length > 0) {
        const topPattern = Object.keys(prefs.preferences)[0];
        const confidence = prefs.preferences[topPattern].confidence;
        report += `  • ${category}: "${topPattern}" (${(confidence * 100).toFixed(1)}% confidence)\n`;
      }
    }

    return report;
  }

  /**
   * Reset all learned patterns (for testing/debugging)
   */
  async reset() {
    this.patterns = {
      naming: { accepted: {}, rejected: {}, confidence: {} },
      style: { accepted: {}, rejected: {}, confidence: {} },
      structure: { accepted: {}, rejected: {}, confidence: {} },
      corrections: [],
      sessions: [],
    };

    await this.savePatterns();
    logger.info('Team patterns reset');
  }
}
