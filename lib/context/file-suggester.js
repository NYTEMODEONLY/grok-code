import { relevanceScorer } from './relevance-scorer.js';
import { contextWindowOptimizer } from './window-optimizer.js';

/**
 * Intelligent File Suggestions Engine
 * Provides actionable recommendations for file selection and coding tasks
 */
export class FileSuggester {
  constructor() {
    // Task type patterns for intelligent categorization
    this.taskPatterns = {
      bugfix: [
        /\bfix\b/i,
        /\bbug\b/i,
        /\berror\b/i,
        /\bissue\b/i,
        /\bproblem\b/i,
        /\bcrash\b/i,
        /\bfailing\b/i,
        /\bbroken\b/i,
        /\bdebug\b/i,
      ],
      feature: [
        /\badd\b/i,
        /\bimplement\b/i,
        /\bcreate\b/i,
        /\bnew\b/i,
        /\bfeature\b/i,
        /\bbuild\b/i,
        /\bdevelop\b/i,
        /\bmake\b/i,
      ],
      refactor: [
        /\brefactor\b/i,
        /\brestructure\b/i,
        /\bclean\b/i,
        /\boptimize\b/i,
        /\bsimplify\b/i,
        /\bimprove\b/i,
        /\bmodular/i,
        /\breorganize\b/i,
      ],
      test: [
        /\btest\b/i,
        /\bspec\b/i,
        /\bunit\b/i,
        /\bintegration\b/i,
        /\bcoverage\b/i,
        /\bmock\b/i,
        /\bstub\b/i,
      ],
      config: [
        /\bconfig\b/i,
        /\bsetup\b/i,
        /\binstall\b/i,
        /\bdeploy\b/i,
        /\bbuild\b/i,
        /\bwebpack\b/i,
        /\bbabel\b/i,
        /\bpackage\b/i,
      ],
      documentation: [
        /\bdocument\b/i,
        /\breadme\b/i,
        /\bcomment\b/i,
        /\bdoc\b/i,
        /\bguide\b/i,
        /\btutorial\b/i,
        /\bexample\b/i,
      ],
      performance: [
        /\bperformance\b/i,
        /\bspeed\b/i,
        /\bfast\b/i,
        /\bslow\b/i,
        /\boptimize\b/i,
        /\bcache\b/i,
        /\bmemory\b/i,
      ],
      security: [
        /\bsecurity\b/i,
        /\bauth\b/i,
        /\bencrypt\b/i,
        /\bsecure\b/i,
        /\bvulnerab/i,
        /\battack\b/i,
        /\bhack\b/i,
      ],
    };

    // Priority weights for different file types by task
    this.taskFileWeights = {
      bugfix: {
        test: 1.5, // Test files often contain bug reports
        source: 1.2, // Source files where bugs occur
        config: 0.8, // Config changes might cause bugs
        docs: 0.5,
      },
      feature: {
        source: 1.3, // New features go in source files
        test: 1.2, // Features need tests
        config: 1.0, // May need config updates
        docs: 0.8, // Features need documentation
      },
      refactor: {
        source: 1.4, // Refactoring affects source code
        test: 1.3, // Tests may need updates
        docs: 0.6,
        config: 0.7,
      },
      test: {
        test: 1.5, // Obviously test files
        source: 1.2, // Source files being tested
        config: 0.8,
        docs: 0.6,
      },
      config: {
        config: 1.4, // Configuration files
        source: 0.9, // Source files using config
        docs: 0.7,
        test: 0.8,
      },
    };
  }

  /**
   * Generate intelligent file suggestions for a coding task
   * @param {string} task - Coding task description
   * @param {string|string[]} filePaths - Files or directories to search
   * @param {Object} options - Suggestion options
   * @returns {Object} Comprehensive file suggestions
   */
  async suggestFiles(task, filePaths, options = {}) {
    const {
      maxSuggestions = 10,
      includeContext = true,
      taskType = null,
      model = 'gpt-4',
      detailLevel = 'standard', // 'brief', 'standard', 'detailed'
    } = options;

    // Analyze the task to determine its type and requirements
    const taskAnalysis = this.analyzeTask(task, taskType);
    console.log(
      `Task analysis: ${taskAnalysis.type} - ${taskAnalysis.confidence}% confidence`
    );

    // Get relevance scores for files
    const relevanceResults = await relevanceScorer.scoreFileRelevance(
      task,
      filePaths,
      {
        maxFiles: maxSuggestions * 2, // Get more for better selection
        includeDependencies: true,
        minScore: 1,
      }
    );

    if (relevanceResults.length === 0) {
      return this.generateEmptySuggestions(task, taskAnalysis);
    }

    // Apply task-specific weighting
    const weightedResults = this.applyTaskWeighting(
      relevanceResults,
      taskAnalysis
    );

    // Generate context-optimized suggestions
    const contextOptimized = includeContext
      ? await contextWindowOptimizer.optimizeContext(task, filePaths, {
          model,
          maxFiles: maxSuggestions,
          prioritizeDepth: taskAnalysis.type === 'bugfix', // Depth for bug fixes
        })
      : null;

    // Generate final suggestions with reasoning
    const suggestions = this.generateSuggestions(
      weightedResults,
      taskAnalysis,
      contextOptimized,
      {
        maxSuggestions,
        detailLevel,
      }
    );

    return {
      task: {
        original: task,
        analysis: taskAnalysis,
        normalized: this.normalizeTask(task),
      },
      suggestions,
      metadata: {
        totalFilesAnalyzed: relevanceResults.length,
        taskConfidence: taskAnalysis.confidence,
        contextOptimized: includeContext,
        model: includeContext ? model : null,
        generatedAt: new Date().toISOString(),
      },
      recommendations: this.generateRecommendations(suggestions, taskAnalysis),
    };
  }

  /**
   * Analyze a coding task to determine its type and characteristics
   * @param {string} task - Task description
   * @param {string} forcedType - Override task type if known
   * @returns {Object} Task analysis
   */
  analyzeTask(task, forcedType = null) {
    if (forcedType) {
      return {
        type: forcedType,
        confidence: 100,
        keywords: [],
        characteristics: this.getTaskCharacteristics(forcedType),
      };
    }

    const lowerTask = task.toLowerCase();
    const matches = {};

    // Check each task type
    for (const [taskType, patterns] of Object.entries(this.taskPatterns)) {
      let matchCount = 0;
      const matchedKeywords = [];

      for (const pattern of patterns) {
        const match = lowerTask.match(pattern);
        if (match) {
          matchCount++;
          matchedKeywords.push(match[0]);
        }
      }

      if (matchCount > 0) {
        matches[taskType] = {
          count: matchCount,
          keywords: matchedKeywords,
        };
      }
    }

    // Find the best match
    let bestType = 'feature'; // Default
    let bestScore = 0;

    for (const [taskType, match] of Object.entries(matches)) {
      // Score based on keyword count and specificity
      const score = match.count * this.getTaskSpecificity(taskType);
      if (score > bestScore) {
        bestScore = score;
        bestType = taskType;
      }
    }

    // Calculate confidence
    const totalMatches = Object.values(matches).reduce(
      (sum, m) => sum + m.count,
      0
    );
    const confidence =
      totalMatches > 0 ? Math.min(100, (bestScore / totalMatches) * 100) : 30;

    return {
      type: bestType,
      confidence: Math.round(confidence),
      keywords: matches[bestType]?.keywords || [],
      characteristics: this.getTaskCharacteristics(bestType),
      allMatches: matches,
    };
  }

  /**
   * Get specificity score for task types (higher = more specific keywords)
   * @param {string} taskType - Task type
   * @returns {number} Specificity multiplier
   */
  getTaskSpecificity(taskType) {
    const specificityMap = {
      bugfix: 1.5, // Specific technical terms
      security: 1.4, // Domain-specific terms
      performance: 1.3, // Technical optimization
      test: 1.3, // Testing-specific terms
      refactor: 1.2, // Development process
      config: 1.2, // Configuration terms
      feature: 1.0, // General development
      documentation: 1.1, // Documentation terms
    };

    return specificityMap[taskType] || 1.0;
  }

  /**
   * Get characteristics for a task type
   * @param {string} taskType - Task type
   * @returns {Object} Task characteristics
   */
  getTaskCharacteristics(taskType) {
    const characteristics = {
      bugfix: {
        priorityFiles: ['test', 'source', 'error-handling'],
        riskLevel: 'medium',
        typicalFiles: [
          '*.test.js',
          '*.spec.js',
          'error-handler.js',
          'logger.js',
        ],
        focus: 'precision and safety',
      },
      feature: {
        priorityFiles: ['source', 'test', 'api', 'ui'],
        riskLevel: 'medium',
        typicalFiles: ['*.js', '*.ts', '*.component.*', '*.service.*'],
        focus: 'functionality and integration',
      },
      refactor: {
        priorityFiles: ['source', 'test', 'architecture'],
        riskLevel: 'high',
        typicalFiles: ['*.js', '*.ts', 'architecture.md', 'README.md'],
        focus: 'structure and maintainability',
      },
      test: {
        priorityFiles: ['test', 'source', 'coverage'],
        riskLevel: 'low',
        typicalFiles: ['*.test.js', '*.spec.js', 'jest.config.js', 'coverage/'],
        focus: 'quality and reliability',
      },
      config: {
        priorityFiles: ['config', 'build', 'deploy'],
        riskLevel: 'high',
        typicalFiles: ['package.json', 'webpack.config.js', '*.config.js'],
        focus: 'environment and deployment',
      },
      performance: {
        priorityFiles: ['source', 'cache', 'database'],
        riskLevel: 'medium',
        typicalFiles: ['*.cache.js', '*.db.js', 'performance-monitor.js'],
        focus: 'speed and efficiency',
      },
      security: {
        priorityFiles: ['auth', 'api', 'validation'],
        riskLevel: 'critical',
        typicalFiles: ['auth.js', 'security.js', 'validation.js'],
        focus: 'safety and compliance',
      },
      documentation: {
        priorityFiles: ['docs', 'readme', 'comments'],
        riskLevel: 'low',
        typicalFiles: ['README.md', 'docs/', '*.md'],
        focus: 'clarity and usability',
      },
    };

    return characteristics[taskType] || characteristics.feature;
  }

  /**
   * Apply task-specific weighting to relevance scores
   * @param {Array} relevanceResults - Base relevance results
   * @param {Object} taskAnalysis - Task analysis
   * @returns {Array} Weighted results
   */
  applyTaskWeighting(relevanceResults, taskAnalysis) {
    const taskWeights = this.taskFileWeights[taskAnalysis.type] || {};

    return relevanceResults
      .map((result) => {
        let weight = 1.0;

        // Apply file type weighting
        const fileType = this.categorizeFile(result.filePath);
        if (taskWeights[fileType]) {
          weight *= taskWeights[fileType];
        }

        // Apply task-specific keyword bonuses
        const fileName = result.shortName.toLowerCase();
        for (const keyword of taskAnalysis.keywords) {
          if (fileName.includes(keyword.toLowerCase())) {
            weight *= 1.2; // 20% bonus for keyword matches in filename
          }
        }

        // Apply confidence-based weighting
        const confidenceMultiplier =
          0.8 + (taskAnalysis.confidence / 100) * 0.4; // 0.8 to 1.2
        weight *= confidenceMultiplier;

        return {
          ...result,
          score: {
            ...result.score,
            taskWeighted: Math.round(result.score.total * weight),
            weightMultiplier: weight,
          },
        };
      })
      .sort((a, b) => b.score.taskWeighted - a.score.taskWeighted);
  }

  /**
   * Categorize a file by its type/purpose
   * @param {string} filePath - File path
   * @returns {string} File category
   */
  categorizeFile(filePath) {
    const fileName = filePath.toLowerCase();

    if (
      fileName.includes('.test.') ||
      fileName.includes('.spec.') ||
      fileName.includes('/test')
    ) {
      return 'test';
    }

    if (
      fileName.includes('config') ||
      fileName.includes('.config.') ||
      fileName.includes('package.json') ||
      fileName.includes('webpack') ||
      fileName.includes('babel') ||
      fileName.includes('eslint')
    ) {
      return 'config';
    }

    if (
      fileName.includes('readme') ||
      fileName.endsWith('.md') ||
      fileName.includes('doc') ||
      fileName.includes('guide')
    ) {
      return 'docs';
    }

    if (
      fileName.endsWith('.js') ||
      fileName.endsWith('.ts') ||
      fileName.endsWith('.jsx') ||
      fileName.endsWith('.tsx') ||
      fileName.endsWith('.py')
    ) {
      return 'source';
    }

    return 'other';
  }

  /**
   * Generate final suggestions with reasoning
   * @param {Array} weightedResults - Weighted relevance results
   * @param {Object} taskAnalysis - Task analysis
   * @param {Object} contextOptimized - Context optimization results
   * @param {Object} options - Generation options
   * @returns {Array} File suggestions with reasoning
   */
  generateSuggestions(
    weightedResults,
    taskAnalysis,
    contextOptimized,
    options
  ) {
    const { maxSuggestions, detailLevel } = options;
    const suggestions = [];

    // Use context-optimized results if available, otherwise use weighted results
    const candidates = contextOptimized
      ? contextOptimized.files.map((f) => ({
          filePath: f.filePath,
          shortName: f.shortName,
          relevanceScore: f.relevanceScore,
          score: { taskWeighted: f.relevanceScore },
          language: f.language,
          contextOptimized: true,
          tokens: f.tokens,
          sections: f.sections,
        }))
      : weightedResults;

    for (let i = 0; i < Math.min(candidates.length, maxSuggestions); i++) {
      const candidate = candidates[i];
      const reasoning = this.generateReasoning(candidate, taskAnalysis, i + 1);

      const suggestion = {
        rank: i + 1,
        file: {
          path: candidate.filePath,
          name: candidate.shortName,
          language: candidate.language,
        },
        relevance: {
          score: candidate.score.taskWeighted,
          level: this.getRelevanceLevel(candidate.score.taskWeighted),
          factors: reasoning.factors,
        },
        reasoning: reasoning.text,
        action: this.suggestAction(candidate, taskAnalysis),
        priority: this.calculatePriority(candidate, taskAnalysis, i + 1),
      };

      // Add detailed information based on detail level
      if (detailLevel === 'detailed') {
        suggestion.details = {
          sections: candidate.sections || [],
          tokens: candidate.tokens || 0,
          contextOptimized: candidate.contextOptimized || false,
          fileType: this.categorizeFile(candidate.filePath),
        };
      }

      suggestions.push(suggestion);
    }

    return suggestions;
  }

  /**
   * Generate reasoning for why a file is suggested
   * @param {Object} candidate - File candidate
   * @param {Object} taskAnalysis - Task analysis
   * @param {number} rank - Suggestion rank
   * @returns {Object} Reasoning object
   */
  generateReasoning(candidate, taskAnalysis, rank) {
    const factors = [];
    let reasoning = '';

    // Primary factor: relevance score
    if (candidate.score.taskWeighted > 100) {
      factors.push('high_relevance');
      reasoning += `Highly relevant to ${taskAnalysis.type} task`;
    } else if (candidate.score.taskWeighted > 50) {
      factors.push('good_relevance');
      reasoning += `Good match for ${taskAnalysis.type} work`;
    } else {
      factors.push('moderate_relevance');
      reasoning += `Potentially related to ${taskAnalysis.type}`;
    }

    // File type factor
    const fileType = this.categorizeFile(candidate.filePath);
    const taskWeights = this.taskFileWeights[taskAnalysis.type] || {};

    if (taskWeights[fileType] && taskWeights[fileType] > 1.2) {
      factors.push('task_priority_type');
      reasoning += `, prioritizes ${fileType} files`;
    }

    // Keyword factors
    const fileName = candidate.shortName.toLowerCase();
    const keywordMatches = taskAnalysis.keywords.filter((k) =>
      fileName.includes(k.toLowerCase())
    );

    if (keywordMatches.length > 0) {
      factors.push('keyword_match');
      reasoning += `, contains "${keywordMatches.join(', ')}"`;
    }

    // Rank-based reasoning
    if (rank === 1) {
      factors.push('top_candidate');
      reasoning += '. Best starting point';
    } else if (rank <= 3) {
      factors.push('high_priority');
      reasoning += '. Should examine early';
    }

    return {
      text: reasoning,
      factors,
    };
  }

  /**
   * Suggest specific action for a file
   * @param {Object} candidate - File candidate
   * @param {Object} taskAnalysis - Task analysis
   * @returns {string} Suggested action
   */
  suggestAction(candidate, taskAnalysis) {
    const fileType = this.categorizeFile(candidate.filePath);
    const taskType = taskAnalysis.type;

    const actionMap = {
      bugfix: {
        test: 'Examine test cases and error scenarios',
        source: 'Check implementation and error handling',
        config: 'Verify configuration settings',
      },
      feature: {
        source: 'Implement new functionality',
        test: 'Add corresponding tests',
        config: 'Update configuration if needed',
      },
      refactor: {
        source: 'Restructure and optimize code',
        test: 'Update tests for new structure',
        docs: 'Update documentation',
      },
      test: {
        test: 'Write or modify test cases',
        source: 'Understand code under test',
      },
      config: {
        config: 'Modify configuration files',
        source: 'Update code using new config',
      },
    };

    const taskActions = actionMap[taskType] || actionMap.feature;
    return taskActions[fileType] || 'Review and potentially modify';
  }

  /**
   * Calculate priority level for a suggestion
   * @param {Object} candidate - File candidate
   * @param {Object} taskAnalysis - Task analysis
   * @param {number} rank - Suggestion rank
   * @returns {string} Priority level
   */
  calculatePriority(candidate, taskAnalysis, rank) {
    const score = candidate.score.taskWeighted;

    if (rank === 1 && score > 80) return 'critical';
    if (rank <= 3 && score > 50) return 'high';
    if (rank <= 5 && score > 30) return 'medium';
    if (score > 15) return 'low';

    return 'optional';
  }

  /**
   * Get relevance level description
   * @param {number} score - Relevance score
   * @returns {string} Relevance level
   */
  getRelevanceLevel(score) {
    if (score > 100) return 'excellent';
    if (score > 75) return 'very_good';
    if (score > 50) return 'good';
    if (score > 25) return 'fair';
    return 'poor';
  }

  /**
   * Generate recommendations based on suggestions
   * @param {Array} suggestions - File suggestions
   * @param {Object} taskAnalysis - Task analysis
   * @returns {Array} Recommendations
   */
  generateRecommendations(suggestions, taskAnalysis) {
    const recommendations = [];

    if (suggestions.length === 0) {
      return [
        'No specific file recommendations available. Consider exploring the codebase manually.',
      ];
    }

    // Primary recommendation
    const topSuggestion = suggestions[0];
    recommendations.push(
      `🔍 Start with ${topSuggestion.file.name} - ${topSuggestion.reasoning.toLowerCase()}`
    );

    // Task-specific recommendations
    const taskRecs = this.getTaskRecommendations(
      taskAnalysis.type,
      suggestions
    );
    recommendations.push(...taskRecs);

    // General workflow recommendations
    if (suggestions.length > 3) {
      recommendations.push(
        `📋 Review top ${Math.min(3, suggestions.length)} files first, then expand as needed`
      );
    }

    // Risk-based recommendations
    const characteristics = taskAnalysis.characteristics;
    if (
      characteristics.riskLevel === 'high' ||
      characteristics.riskLevel === 'critical'
    ) {
      recommendations.push(
        `⚠️ High-risk task: Consider creating backups and thorough testing`
      );
    }

    return recommendations;
  }

  /**
   * Get task-specific recommendations
   * @param {string} taskType - Task type
   * @param {Array} suggestions - Suggestions
   * @returns {Array} Task-specific recommendations
   */
  getTaskRecommendations(taskType, suggestions) {
    const recommendations = [];

    switch (taskType) {
      case 'bugfix':
        recommendations.push(
          '🐛 Focus on understanding the bug before making changes'
        );
        recommendations.push(
          '🧪 Run existing tests to establish baseline behavior'
        );
        break;

      case 'feature':
        recommendations.push(
          '✨ Plan the feature implementation and required changes'
        );
        recommendations.push('📝 Consider updating documentation and examples');
        break;

      case 'refactor':
        recommendations.push(
          '🔄 Ensure comprehensive test coverage before refactoring'
        );
        recommendations.push('📊 Consider performance implications of changes');
        break;

      case 'test':
        recommendations.push(
          '✅ Follow testing best practices and naming conventions'
        );
        recommendations.push(
          '🎯 Aim for meaningful test coverage and edge cases'
        );
        break;

      case 'security':
        recommendations.push(
          '🔒 Consult security best practices and guidelines'
        );
        recommendations.push(
          '⚡ Consider security implications and attack vectors'
        );
        break;

      case 'performance':
        recommendations.push(
          '⚡ Profile current performance before optimization'
        );
        recommendations.push(
          '📈 Measure improvements and ensure no regressions'
        );
        break;
    }

    return recommendations;
  }

  /**
   * Normalize a task description for better processing
   * @param {string} task - Raw task description
   * @returns {string} Normalized task
   */
  normalizeTask(task) {
    return task
      .toLowerCase()
      .replace(/[^\w\s\-_]/g, ' ') // Replace special chars with spaces
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
  }

  /**
   * Generate empty suggestions response
   * @param {string} task - Original task
   * @param {Object} taskAnalysis - Task analysis
   * @returns {Object} Empty suggestions response
   */
  generateEmptySuggestions(task, taskAnalysis) {
    return {
      task: {
        original: task,
        analysis: taskAnalysis,
        normalized: this.normalizeTask(task),
      },
      suggestions: [],
      metadata: {
        totalFilesAnalyzed: 0,
        taskConfidence: taskAnalysis.confidence,
        contextOptimized: false,
        generatedAt: new Date().toISOString(),
      },
      recommendations: [
        '🔍 No specific files identified. Consider:',
        '• Exploring the codebase structure manually',
        '• Providing more specific task details',
        '• Checking if the task relates to existing functionality',
      ],
    };
  }

  /**
   * Get supported task types
   * @returns {Array} Task types
   */
  getSupportedTaskTypes() {
    return Object.keys(this.taskPatterns);
  }

  /**
   * Configure task patterns and weights
   * @param {Object} config - Configuration object
   */
  configure(config) {
    if (config.taskPatterns) {
      this.taskPatterns = { ...this.taskPatterns, ...config.taskPatterns };
    }

    if (config.taskFileWeights) {
      this.taskFileWeights = {
        ...this.taskFileWeights,
        ...config.taskFileWeights,
      };
    }
  }
}

// Export singleton instance for global use
export const fileSuggester = new FileSuggester();
export default fileSuggester;
