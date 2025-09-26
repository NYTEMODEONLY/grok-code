import { ErrorPatterns } from './error-patterns.js';
import { PersonalizedFixes } from './personalized-fixes.js';
import { logger } from '../utils/logger.js';

/**
 * Error Prevention Suggestions System
 * Proactively suggests ways to avoid common errors based on learned patterns
 */
export class PreventionTips {
  constructor(options = {}) {
    this.patterns = options.patterns || new ErrorPatterns();
    this.personalized =
      options.personalized ||
      new PersonalizedFixes({ patterns: this.patterns });

    // Prevention strategies by error type
    this.preventionStrategies = {
      syntax: {
        semi: {
          title: 'Missing Semicolons',
          suggestions: [
            'Enable ESLint semi rule with "always"',
            'Configure Prettier to insert semicolons automatically',
            'Use a linter that enforces semicolon consistency',
          ],
          configExample: {
            eslint: { rules: { semi: ['error', 'always'] } },
            prettier: { semi: true },
          },
        },
        'no-unused-vars': {
          title: 'Unused Variables',
          suggestions: [
            'Enable strict ESLint no-unused-vars rule',
            'Use TypeScript strict mode to catch unused declarations',
            'Regular code cleanup to remove unused imports/variables',
          ],
          configExample: {
            eslint: { rules: { 'no-unused-vars': 'error' } },
            typescript: { noUnusedLocals: true, noUnusedParameters: true },
          },
        },
      },
      type: {
        'property-not-exist': {
          title: 'Type Safety Issues',
          suggestions: [
            'Enable TypeScript strict mode',
            'Use interface definitions for all object types',
            'Implement proper type guards and validation',
            'Enable ESLint @typescript-eslint rules',
          ],
          configExample: {
            typescript: {
              strict: true,
              noImplicitAny: true,
              strictNullChecks: true,
            },
          },
        },
      },
      import: {
        'module-not-found': {
          title: 'Import/Module Issues',
          suggestions: [
            'Use consistent import paths and aliases',
            'Configure TypeScript path mapping',
            'Implement proper module resolution strategy',
            'Use ESLint import plugin for validation',
          ],
          configExample: {
            typescript: {
              baseUrl: '.',
              paths: { '@/*': ['src/*'] },
            },
          },
        },
      },
    };

    logger.info('Error prevention suggestions system initialized');
  }

  /**
   * Generate comprehensive prevention tips based on error patterns
   * @param {Object} context - Context including userId, projectId, timeRange
   * @returns {Object} Prevention recommendations and insights
   */
  generatePreventionTips(context = {}) {
    const patternAnalysis = this.patterns.analyzePatterns(context);
    const userInsights = context.userId
      ? this.personalized.getUserInsights(context.userId)
      : null;

    const tips = {
      immediate: [], // High-priority fixes to implement now
      configuration: [], // Linting/tooling configuration changes
      practices: [], // Coding practice improvements
      architectural: [], // Structural/architectural suggestions
      training: [], // Learning and awareness suggestions
      insights: [], // Pattern-based insights
      metrics: this.calculatePreventionMetrics(patternAnalysis, userInsights),
    };

    // Generate tips based on error patterns
    this.analyzeFrequentErrors(patternAnalysis, tips);
    this.analyzeLocationHotspots(patternAnalysis, tips);
    this.analyzeUserPatterns(userInsights, tips);
    this.analyzeTemporalPatterns(patternAnalysis, tips);

    // Sort by priority and impact
    this.prioritizeTips(tips);

    logger.debug('Generated prevention tips', {
      immediate: tips.immediate.length,
      configuration: tips.configuration.length,
      practices: tips.practices.length,
      total: this.countTotalTips(tips),
    });

    return tips;
  }

  /**
   * Analyze frequent errors and suggest prevention strategies
   */
  analyzeFrequentErrors(patternAnalysis, tips) {
    const frequentErrors = patternAnalysis.frequentErrors || [];

    for (const error of frequentErrors) {
      if (error.frequency >= 3) {
        // Only for significant patterns
        const preventionStrategy = this.getPreventionStrategy(error.error);

        if (preventionStrategy) {
          tips.configuration.push({
            type: 'linting_config',
            priority: error.riskLevel === 'high' ? 'high' : 'medium',
            title: preventionStrategy.title,
            description: `Prevent ${error.frequency} ${error.error.type} errors per session`,
            suggestions: preventionStrategy.suggestions,
            configExample: preventionStrategy.configExample,
            impact: `Could reduce ${error.error.type} errors by ${this.estimateImpact(error)}%`,
            errorPattern: error,
          });
        }

        // Add practice-based prevention
        if (error.error.type === 'syntax' && error.frequency > 5) {
          tips.practices.push({
            type: 'coding_practice',
            priority: 'medium',
            title: 'Syntax Error Prevention',
            description:
              'Implement consistent syntax practices to reduce errors',
            suggestions: [
              'Use auto-formatting tools (Prettier) consistently',
              'Enable real-time linting in your IDE',
              'Review code before committing to catch syntax issues',
              'Pair program on complex logic to catch syntax errors early',
            ],
            impact: 'Reduces syntax errors through consistent practices',
          });
        }
      }
    }
  }

  /**
   * Analyze error hotspots and suggest targeted improvements
   */
  analyzeLocationHotspots(patternAnalysis, tips) {
    const hotspots = patternAnalysis.locationHotspots || [];

    for (const hotspot of hotspots.slice(0, 3)) {
      // Top 3 hotspots
      if (hotspot.errorCount >= 5) {
        const fileType = this.getFileType(hotspot.filePath);

        tips.architectural.push({
          type: 'file_focus',
          priority: 'high',
          title: `High Error Rate in ${fileType} Files`,
          description: `${hotspot.filePath} has ${hotspot.errorCount} errors across ${hotspot.errorTypes.size} types`,
          suggestions: [
            `Conduct targeted code review for ${fileType} files`,
            `Implement additional linting rules for ${fileType} files`,
            `Consider refactoring complex logic in ${hotspot.filePath}`,
            `Add unit tests for functions in ${hotspot.filePath}`,
          ],
          impact: `Could significantly reduce errors in ${fileType} files`,
          hotspot: hotspot,
        });
      }
    }

    // General architectural suggestions based on patterns
    if (hotspots.some((h) => h.errorCount > 10)) {
      tips.architectural.push({
        type: 'architecture_review',
        priority: 'high',
        title: 'Architecture Review Recommended',
        description:
          'Multiple files showing high error rates suggests architectural issues',
        suggestions: [
          'Review code organization and separation of concerns',
          'Consider implementing design patterns to reduce complexity',
          'Add comprehensive error handling and validation layers',
          'Implement automated testing for critical code paths',
        ],
        impact: 'Addresses root causes of systemic error patterns',
      });
    }
  }

  /**
   * Analyze user-specific patterns for personalized prevention
   */
  analyzeUserPatterns(userInsights, tips) {
    if (!userInsights) return;

    // Based on user's preferred methods and success rates
    const lowSuccessMethods = Object.entries(
      userInsights.preferences?.methodSuccess || {}
    )
      .filter(([, rate]) => rate < 0.5)
      .map(([method]) => method);

    if (lowSuccessMethods.length > 0) {
      tips.training.push({
        type: 'skill_development',
        priority: 'medium',
        title: 'Method-Specific Training Recommended',
        description: `Low success rates with: ${lowSuccessMethods.join(', ')}`,
        suggestions: [
          `Practice and improve skills with ${lowSuccessMethods.join(', ')} approaches`,
          'Review documentation for preferred methods',
          'Consider mentorship or training for challenging techniques',
          'Start with simpler approaches and gradually increase complexity',
        ],
        impact: 'Improves success rates with preferred development methods',
      });
    }

    // Project-specific patterns
    const strugglingProjects =
      userInsights.projects?.filter((p) => p.successRate < 0.7) || [];
    if (strugglingProjects.length > 0) {
      tips.practices.push({
        type: 'project_focus',
        priority: 'high',
        title: 'Project-Specific Error Patterns',
        description: `Lower success rates in: ${strugglingProjects.map((p) => p.projectId).join(', ')}`,
        suggestions: [
          'Review project-specific coding standards and conventions',
          'Analyze differences between successful and struggling projects',
          'Implement project-specific linting rules',
          'Consider additional testing or code review processes',
        ],
        impact: 'Improves consistency and reduces errors across projects',
      });
    }
  }

  /**
   * Analyze temporal patterns for scheduling recommendations
   */
  analyzeTemporalPatterns(patternAnalysis, tips) {
    const temporal = patternAnalysis.temporalPatterns || {};

    // Peak error times
    if (temporal.peakHours && temporal.peakHours.length > 0) {
      const peakHour = temporal.peakHours[0];
      tips.practices.push({
        type: 'workflow_timing',
        priority: 'low',
        title: 'Error-Prone Work Times Identified',
        description: `Most errors occur around ${peakHour.index}:00 hours`,
        suggestions: [
          `Schedule complex coding tasks during lower-error times`,
          `Take breaks during high-error periods`,
          `Consider pair programming during peak error times`,
          `Review code more carefully during identified high-risk hours`,
        ],
        impact: 'Reduces errors by working during optimal times',
      });
    }

    // Weekly patterns
    if (temporal.peakDays && temporal.peakDays.length > 0) {
      const peakDay = temporal.peakDays[0];
      const dayNames = [
        'Sunday',
        'Monday',
        'Tuesday',
        'Wednesday',
        'Thursday',
        'Friday',
        'Saturday',
      ];

      tips.practices.push({
        type: 'weekly_planning',
        priority: 'low',
        title: 'Weekly Error Patterns',
        description: `${dayNames[peakDay.index]} shows highest error rates`,
        suggestions: [
          `Schedule complex tasks for lower-error days`,
          `Use high-error days for code review and testing`,
          `Plan important deliverables for optimal days`,
          `Track fatigue levels and adjust workload accordingly`,
        ],
        impact: 'Optimizes work scheduling based on error patterns',
      });
    }
  }

  /**
   * Get prevention strategy for a specific error
   */
  getPreventionStrategy(error) {
    const errorType = error.type;
    const errorRule = error.rule;

    if (
      this.preventionStrategies[errorType] &&
      this.preventionStrategies[errorType][errorRule]
    ) {
      return this.preventionStrategies[errorType][errorRule];
    }

    // Fallback to general strategies by error type
    return this.getGeneralPreventionStrategy(errorType);
  }

  /**
   * Get general prevention strategy for error type
   */
  getGeneralPreventionStrategy(errorType) {
    const generalStrategies = {
      syntax: {
        title: 'Syntax Error Prevention',
        suggestions: [
          'Enable comprehensive linting rules',
          'Use auto-formatting tools consistently',
          'Implement pre-commit hooks for syntax checking',
          'Enable real-time syntax checking in IDE',
        ],
      },
      type: {
        title: 'Type Error Prevention',
        suggestions: [
          'Enable TypeScript strict mode',
          'Use comprehensive type definitions',
          'Implement type guards and validation',
          'Enable strict type checking rules',
        ],
      },
      import: {
        title: 'Import Error Prevention',
        suggestions: [
          'Use consistent import paths and aliases',
          'Configure proper module resolution',
          'Implement import validation rules',
          'Use build tools with strict import checking',
        ],
      },
      reference: {
        title: 'Reference Error Prevention',
        suggestions: [
          'Enable strict variable declaration rules',
          'Use consistent scoping practices',
          'Implement proper error handling',
          'Enable reference checking linting rules',
        ],
      },
    };

    return (
      generalStrategies[errorType] || {
        title: 'General Error Prevention',
        suggestions: [
          'Enable comprehensive linting and error checking',
          'Implement code review processes',
          'Add automated testing for error-prone code',
          'Use static analysis tools regularly',
        ],
      }
    );
  }

  /**
   * Calculate prevention impact metrics
   */
  calculatePreventionMetrics(patternAnalysis, userInsights) {
    const totalErrors =
      patternAnalysis.frequentErrors?.reduce(
        (sum, e) => sum + e.frequency,
        0
      ) || 0;
    const highRiskErrors =
      patternAnalysis.frequentErrors?.filter((e) => e.riskLevel === 'high')
        .length || 0;
    const userSuccessRate =
      userInsights?.profile?.totalFixes > 0
        ? (userInsights.projects?.reduce(
            (sum, p) => sum + p.successRate * p.totalFixes,
            0
          ) || 0) /
          (userInsights.projects?.reduce((sum, p) => sum + p.totalFixes, 0) ||
            1)
        : 0;

    return {
      totalErrorsTracked: totalErrors,
      highRiskErrors,
      userSuccessRate: Math.round(userSuccessRate * 100) / 100,
      patternMaturity: patternAnalysis.insights?.some(
        (i) => i.type === 'learning_progress'
      )
        ? 'mature'
        : 'developing',
      preventionPotential: this.estimatePreventionPotential(patternAnalysis),
    };
  }

  /**
   * Estimate prevention potential based on patterns
   */
  estimatePreventionPotential(patternAnalysis) {
    let potential = 0;

    // Frequent errors suggest high prevention potential
    if (patternAnalysis.frequentErrors?.length > 0) {
      potential += Math.min(patternAnalysis.frequentErrors.length * 10, 40);
    }

    // Hotspots suggest architectural prevention opportunities
    if (patternAnalysis.locationHotspots?.length > 0) {
      potential += Math.min(patternAnalysis.locationHotspots.length * 15, 30);
    }

    // Temporal patterns suggest workflow optimization
    if (patternAnalysis.temporalPatterns?.peakHours?.length > 0) {
      potential += 10;
    }

    return Math.min(potential, 100); // Cap at 100%
  }

  /**
   * Estimate impact of implementing a prevention strategy
   */
  estimateImpact(error) {
    // Simple estimation based on error frequency and type
    const baseImpact = 60; // Base 60% reduction
    const frequencyBonus = Math.min(error.frequency * 5, 30); // Up to 30% for very frequent errors
    const typeMultiplier =
      {
        syntax: 0.8, // Easier to prevent
        type: 1.0, // Standard prevention
        import: 0.9, // Moderately preventable
        reference: 0.7, // Harder to prevent
      }[error.error.type] || 1.0;

    return Math.round((baseImpact + frequencyBonus) * typeMultiplier);
  }

  /**
   * Prioritize tips by impact and feasibility
   */
  prioritizeTips(tips) {
    const priorityOrder = { high: 3, medium: 2, low: 1 };

    for (const category of [
      'immediate',
      'configuration',
      'practices',
      'architectural',
      'training',
    ]) {
      tips[category].sort((a, b) => {
        const priorityDiff =
          priorityOrder[b.priority] - priorityOrder[a.priority];
        if (priorityDiff !== 0) return priorityDiff;

        // Secondary sort by estimated impact
        return (b.estimatedImpact || 0) - (a.estimatedImpact || 0);
      });
    }
  }

  /**
   * Get file type from path
   */
  getFileType(filePath) {
    if (!filePath) return 'unknown';

    const ext = filePath.split('.').pop()?.toLowerCase();
    const typeMap = {
      js: 'JavaScript',
      ts: 'TypeScript',
      jsx: 'React',
      tsx: 'React/TypeScript',
      py: 'Python',
      java: 'Java',
      cpp: 'C++',
      c: 'C',
      go: 'Go',
      rs: 'Rust',
      php: 'PHP',
    };

    return typeMap[ext] || `${ext?.toUpperCase() || 'Unknown'} files`;
  }

  /**
   * Count total tips across all categories
   */
  countTotalTips(tips) {
    return Object.values(tips)
      .filter(Array.isArray)
      .reduce((sum, category) => sum + category.length, 0);
  }

  /**
   * Get actionable prevention plan
   */
  getActionablePlan(context = {}) {
    const tips = this.generatePreventionTips(context);

    return {
      summary: {
        totalTips: this.countTotalTips(tips),
        highPriority:
          tips.immediate.length +
          tips.configuration.filter((t) => t.priority === 'high').length,
        potentialImpact: tips.metrics.preventionPotential,
      },
      immediateActions: tips.immediate.slice(0, 3),
      quickWins: tips.configuration
        .filter((t) => t.priority === 'high')
        .slice(0, 2),
      longTerm: tips.architectural.slice(0, 2),
      nextSteps: this.generateNextSteps(tips),
    };
  }

  /**
   * Generate next steps based on tips
   */
  generateNextSteps(tips) {
    const steps = [];

    if (tips.configuration.length > 0) {
      steps.push(
        'Review and implement recommended linting/tooling configurations'
      );
    }

    if (tips.architectural.length > 0) {
      steps.push('Schedule architecture review for high-error files');
    }

    if (tips.practices.length > 0) {
      steps.push('Update team coding practices and standards');
    }

    if (tips.training.length > 0) {
      steps.push('Plan training sessions for identified skill gaps');
    }

    return steps;
  }

  /**
   * Export prevention tips for external analysis
   */
  exportTips(context = {}) {
    const tips = this.generatePreventionTips(context);

    return {
      generatedAt: new Date().toISOString(),
      context,
      tips,
      summary: this.getActionablePlan(context).summary,
    };
  }
}
