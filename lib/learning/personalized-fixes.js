import { ErrorPatterns } from './error-patterns.js';
import { logger } from '../utils/logger.js';

/**
 * Personalized Fix Recommendations System
 * Learns from user behavior to provide tailored fix suggestions
 */
export class PersonalizedFixes {
  constructor(options = {}) {
    this.patterns = options.patterns || new ErrorPatterns();
    this.userProfiles = new Map(); // User-specific preferences and patterns
    this.projectProfiles = new Map(); // Project-specific patterns

    // Learning parameters
    this.learningRate = options.learningRate || 0.1;
    this.confidenceBoost = options.confidenceBoost || 0.2; // Boost confidence for preferred methods
    this.adaptationPeriod = options.adaptationPeriod || 7; // Days to adapt to new patterns

    // User preference tracking
    this.userPreferences = {
      preferredMethods: new Map(), // userId -> {method: preference_score}
      rejectedMethods: new Map(),  // userId -> Set of rejected methods
      projectPatterns: new Map(),  // userId -> {projectId: patterns}
      timePreferences: new Map(),  // userId -> {hour: preferred_method}
    };

    logger.info('Personalized fix recommendations system initialized');
  }

  /**
   * Get personalized fix recommendations for a user
   * @param {Object} error - The error to fix
   * @param {Object} context - Context including userId, projectId, session info
   * @param {Array} availableFixes - Available fix options
   * @returns {Array} Personalized fix recommendations
   */
  getPersonalizedRecommendations(error, context, availableFixes = []) {
    const userId = context.userId || 'anonymous';
    const projectId = context.projectId || 'unknown';
    const sessionId = context.sessionId;

    logger.debug('Generating personalized recommendations', {
      userId,
      projectId,
      errorType: error.type,
      availableFixes: availableFixes.length
    });

    // Update user profile with current context
    this.updateUserProfile(userId, context);

    // Get base recommendations from patterns
    const patternAnalysis = this.patterns.analyzePatterns({ userId, projectId });

    // Personalize recommendations
    const personalized = this.personalizeRecommendations(
      error,
      availableFixes,
      patternAnalysis,
      userId,
      projectId
    );

    // Sort by personalized score
    personalized.sort((a, b) => (b.personalizedScore || 0) - (a.personalizedScore || 0));

    // Add personalization metadata
    personalized.forEach(rec => {
      rec.personalized = true;
      rec.userId = userId;
      rec.projectId = projectId;
      rec.generatedAt = new Date().toISOString();
    });

    logger.debug('Generated personalized recommendations', {
      userId,
      count: personalized.length,
      topRecommendation: personalized[0]?.method
    });

    return personalized;
  }

  /**
   * Record user feedback on fix recommendations
   * @param {string} userId - User identifier
   * @param {Object} fix - The fix that was applied
   * @param {boolean} accepted - Whether the user accepted this recommendation
   * @param {Object} context - Additional context
   */
  recordUserFeedback(userId, fix, accepted, context = {}) {
    const preference = this.userPreferences.preferredMethods.get(userId) || {};
    const method = fix.method || 'unknown';

    // Update preference scores based on acceptance
    if (accepted) {
      preference[method] = (preference[method] || 0.5) + this.learningRate;
      preference[method] = Math.min(1.0, preference[method]); // Cap at 1.0

      // Also boost similar methods
      this.boostSimilarMethods(preference, method);
    } else {
      preference[method] = (preference[method] || 0.5) - this.learningRate * 0.5;
      preference[method] = Math.max(0.0, preference[method]); // Floor at 0.0

      // Track rejected methods
      const rejected = this.userPreferences.rejectedMethods.get(userId) || new Set();
      rejected.add(method);
      this.userPreferences.rejectedMethods.set(userId, rejected);
    }

    this.userPreferences.preferredMethods.set(userId, preference);

    // Update project-specific patterns
    this.updateProjectPatterns(userId, context.projectId, fix, accepted);

    logger.debug('Recorded user feedback', {
      userId,
      method,
      accepted,
      newPreference: preference[method]
    });
  }

  /**
   * Learn from fix outcomes to improve future recommendations
   * @param {string} userId - User identifier
   * @param {Object} error - The original error
   * @param {Object} fix - The fix that was applied
   * @param {boolean} success - Whether the fix was successful
   * @param {Object} context - Additional context
   */
  learnFromOutcome(userId, error, fix, success, context = {}) {
    const method = fix.method || 'unknown';
    const errorKey = this.patterns.generateErrorKey(error);

    // Update method effectiveness for this user
    const userProfile = this.getUserProfile(userId);
    if (!userProfile.methodEffectiveness) {
      userProfile.methodEffectiveness = {};
    }

    if (!userProfile.methodEffectiveness[errorKey]) {
      userProfile.methodEffectiveness[errorKey] = {};
    }

    const effectiveness = userProfile.methodEffectiveness[errorKey];
    if (!effectiveness[method]) {
      effectiveness[method] = { attempts: 0, successes: 0 };
    }

    effectiveness[method].attempts++;
    if (success) {
      effectiveness[method].successes++;
    }

    effectiveness[method].successRate = effectiveness[method].successes / effectiveness[method].attempts;

    // Update time-based preferences
    this.updateTimePreferences(userId, context.timestamp || new Date());

    // Update project patterns
    this.updateProjectPatterns(userId, context.projectId, fix, success);

    this.userProfiles.set(userId, userProfile);

    logger.debug('Learned from fix outcome', {
      userId,
      method,
      success,
      errorKey,
      successRate: effectiveness[method].successRate
    });
  }

  /**
   * Personalize recommendations based on user patterns
   */
  personalizeRecommendations(error, availableFixes, patternAnalysis, userId, projectId) {
    const userProfile = this.getUserProfile(userId);
    const preferences = this.userPreferences.preferredMethods.get(userId) || {};
    const rejected = this.userPreferences.rejectedMethods.get(userId) || new Set();

    const personalized = availableFixes.map(fix => {
      let score = fix.confidence || 0.5;
      const method = fix.method || 'unknown';

      // Boost score based on user preferences
      if (preferences[method]) {
        score += preferences[method] * this.confidenceBoost;
      }

      // Penalize rejected methods
      if (rejected.has(method)) {
        score -= 0.3; // Significant penalty for rejected methods
      }

      // Boost based on personal success history
      const errorKey = this.patterns.generateErrorKey(error);
      if (userProfile.methodEffectiveness?.[errorKey]?.[method]) {
        const successRate = userProfile.methodEffectiveness[errorKey][method].successRate;
        score += (successRate - 0.5) * 0.4; // Boost/cut based on personal success rate
      }

      // Consider project patterns
      const projectPatterns = this.userPreferences.projectPatterns.get(userId)?.[projectId];
      if (projectPatterns?.preferredMethods?.[method]) {
        score += projectPatterns.preferredMethods[method] * 0.1;
      }

      // Time-based preferences
      const timePrefs = this.userPreferences.timePreferences.get(userId);
      if (timePrefs) {
        const hour = new Date().getHours();
        if (timePrefs[hour] === method) {
          score += 0.1;
        }
      }

      // Pattern analysis boost
      const fixEffectiveness = patternAnalysis.fixEffectiveness?.[error.type];
      if (fixEffectiveness?.[method]) {
        const globalSuccessRate = fixEffectiveness[method].successRate;
        score += (globalSuccessRate - 0.5) * 0.2;
      }

      return {
        ...fix,
        personalizedScore: Math.max(0, Math.min(1, score)),
        personalizationFactors: {
          userPreference: preferences[method] || 0,
          personalSuccessRate: userProfile.methodEffectiveness?.[errorKey]?.[method]?.successRate,
          projectPattern: projectPatterns?.preferredMethods?.[method] || 0,
          globalPattern: fixEffectiveness?.[method]?.successRate,
          rejected: rejected.has(method)
        }
      };
    });

    return personalized;
  }

  /**
   * Get or create user profile
   */
  getUserProfile(userId) {
    if (!this.userProfiles.has(userId)) {
      this.userProfiles.set(userId, {
        userId,
        firstSeen: new Date().toISOString(),
        totalFixes: 0,
        preferredMethods: {},
        methodEffectiveness: {},
        projectHistory: [],
        learningStats: {
          adaptationRate: this.learningRate,
          totalFeedback: 0,
          lastUpdated: new Date().toISOString()
        }
      });
    }
    return this.userProfiles.get(userId);
  }

  /**
   * Update user profile with current context
   */
  updateUserProfile(userId, context) {
    const profile = this.getUserProfile(userId);

    // Track project history
    if (context.projectId && !profile.projectHistory.includes(context.projectId)) {
      profile.projectHistory.push(context.projectId);
      if (profile.projectHistory.length > 10) {
        profile.projectHistory.shift(); // Keep last 10 projects
      }
    }

    profile.learningStats.lastUpdated = new Date().toISOString();
    this.userProfiles.set(userId, profile);
  }

  /**
   * Boost similar methods when user prefers one
   */
  boostSimilarMethods(preferences, preferredMethod) {
    const similarMethods = {
      template: ['template', 'hybrid'],
      ai: ['ai', 'hybrid'],
      hybrid: ['hybrid', 'template', 'ai']
    };

    const similars = similarMethods[preferredMethod] || [];
    similars.forEach(method => {
      if (method !== preferredMethod) {
        preferences[method] = (preferences[method] || 0.5) + (this.learningRate * 0.3);
        preferences[method] = Math.min(1.0, preferences[method]);
      }
    });
  }

  /**
   * Update project-specific patterns
   */
  updateProjectPatterns(userId, projectId, fix, success) {
    if (!projectId) return;

    const userProjects = this.userPreferences.projectPatterns.get(userId) || {};
    const project = userProjects[projectId] || {
      preferredMethods: {},
      errorPatterns: {},
      totalFixes: 0,
      successfulFixes: 0
    };

    // Update method preferences for this project
    const method = fix.method || 'unknown';
    project.preferredMethods[method] = (project.preferredMethods[method] || 0.5) +
      (success ? this.learningRate : -this.learningRate * 0.5);
    project.preferredMethods[method] = Math.max(0, Math.min(1, project.preferredMethods[method]));

    // Update project stats
    project.totalFixes++;
    if (success) {
      project.successfulFixes++;
    }

    userProjects[projectId] = project;
    this.userPreferences.projectPatterns.set(userId, userProjects);
  }

  /**
   * Update time-based preferences
   */
  updateTimePreferences(userId, timestamp) {
    const hour = new Date(timestamp).getHours();
    const timePrefs = this.userPreferences.timePreferences.get(userId) || {};

    // Simple frequency-based learning
    timePrefs[hour] = timePrefs[hour] || {};
    // This would track which methods work best at different times
    // For now, just track usage patterns

    this.userPreferences.timePreferences.set(userId, timePrefs);
  }

  /**
   * Get user insights and statistics
   */
  getUserInsights(userId) {
    const profile = this.getUserProfile(userId);
    const preferences = this.userPreferences.preferredMethods.get(userId) || {};
    const projects = this.userPreferences.projectPatterns.get(userId) || {};

    // Calculate top preferences
    const topMethods = Object.entries(preferences)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3);

    // Calculate project success rates
    const projectStats = Object.entries(projects).map(([projectId, stats]) => ({
      projectId,
      successRate: stats.totalFixes > 0 ? stats.successfulFixes / stats.totalFixes : 0,
      totalFixes: stats.totalFixes,
      topMethod: Object.entries(stats.preferredMethods || {})
        .sort(([,a], [,b]) => b - a)[0]?.[0]
    }));

    return {
      userId,
      profile: {
        totalFixes: profile.totalFixes,
        firstSeen: profile.firstSeen,
        projectsWorked: profile.projectHistory?.length || 0
      },
      preferences: {
        topMethods,
        rejectedMethods: Array.from(this.userPreferences.rejectedMethods.get(userId) || [])
      },
      projects: projectStats,
      learning: {
        adaptationRate: profile.learningStats?.adaptationRate,
        totalFeedback: profile.learningStats?.totalFeedback,
        lastUpdated: profile.learningStats?.lastUpdated
      }
    };
  }

  /**
   * Reset user data (for testing or privacy)
   */
  resetUserData(userId) {
    this.userProfiles.delete(userId);
    this.userPreferences.preferredMethods.delete(userId);
    this.userPreferences.rejectedMethods.delete(userId);
    this.userPreferences.projectPatterns.delete(userId);
    this.userPreferences.timePreferences.delete(userId);

    logger.info('User data reset', { userId });
  }

  /**
   * Get system-wide personalization statistics
   */
  getPersonalizationStats() {
    const users = Array.from(this.userProfiles.keys());
    const totalProjects = Array.from(this.userPreferences.projectPatterns.values())
      .reduce((sum, userProjects) => sum + Object.keys(userProjects).length, 0);

    return {
      totalUsers: users.length,
      totalProjects,
      averageProjectsPerUser: users.length > 0 ? totalProjects / users.length : 0,
      learningEnabled: true,
      adaptationRate: this.learningRate,
      confidenceBoost: this.confidenceBoost
    };
  }

  /**
   * Export personalization data
   */
  exportPersonalizationData() {
    return {
      userProfiles: Object.fromEntries(this.userProfiles),
      userPreferences: {
        preferredMethods: Object.fromEntries(this.userPreferences.preferredMethods),
        rejectedMethods: Object.fromEntries(
          Array.from(this.userPreferences.rejectedMethods.entries())
            .map(([k, v]) => [k, Array.from(v)])
        ),
        projectPatterns: Object.fromEntries(this.userPreferences.projectPatterns),
        timePreferences: Object.fromEntries(this.userPreferences.timePreferences)
      },
      metadata: {
        exportedAt: new Date().toISOString(),
        version: '1.0',
        stats: this.getPersonalizationStats()
      }
    };
  }

  /**
   * Import personalization data
   */
  importPersonalizationData(data) {
    if (data.userProfiles) {
      this.userProfiles = new Map(Object.entries(data.userProfiles));
    }

    if (data.userPreferences) {
      this.userPreferences.preferredMethods = new Map(
        Object.entries(data.userPreferences.preferredMethods || {})
      );

      this.userPreferences.rejectedMethods = new Map(
        Object.entries(data.userPreferences.rejectedMethods || {})
          .map(([k, v]) => [k, new Set(v)])
      );

      this.userPreferences.projectPatterns = new Map(
        Object.entries(data.userPreferences.projectPatterns || {})
      );

      this.userPreferences.timePreferences = new Map(
        Object.entries(data.userPreferences.timePreferences || {})
      );
    }

    logger.info('Personalization data imported successfully');
  }
}
