import { fileSuggester } from './file-suggester.js';
import { contextWindowOptimizer } from './window-optimizer.js';

/**
 * Automatic Context Builder
 * Proactively manages conversation context by automatically adding relevant files
 */
export class AutoContextBuilder {
  constructor() {
    this.contextHistory = new Map(); // Track files added to context
    this.queryPatterns = new Map(); // Track query patterns and their file associations
    this.conversationMemory = []; // Recent conversation context
    this.maxMemorySize = 10; // Maximum conversation items to remember

    // Auto-add triggers
    this.autoAddTriggers = {
      keywords: [
        'fix',
        'implement',
        'add',
        'create',
        'update',
        'modify',
        'change',
        'refactor',
        'optimize',
        'improve',
        'debug',
        'test',
        'build',
        'inspect',
        'analyze',
        'examine',
        'review',
        'check',
        'explore',
        'investigate',
        'workspace',
        'folder',
        'directory',
        'project',
      ],
      confidenceThreshold: 70, // Minimum confidence to auto-add
      maxAutoAddFiles: 3, // Maximum files to auto-add at once
      cooldownPeriod: 30000, // 30 seconds between auto-adds
    };

    this.lastAutoAdd = 0; // Timestamp of last auto-add
    this.autoAddEnabled = true;
  }

  /**
   * Analyze user input and automatically add relevant files to context
   * @param {string} userInput - User message/query
   * @param {Object} fileContext - Current file context object
   * @param {Array} conversationHistory - Recent conversation messages
   * @param {Object} options - Auto-add options
   * @returns {Object} Auto-add results
   */
  async analyzeAndAutoAdd(
    userInput,
    fileContext,
    conversationHistory = [],
    options = {}
  ) {
    const {
      enableAutoAdd = this.autoAddEnabled,
      confidenceThreshold = this.autoAddTriggers.confidenceThreshold,
      maxFiles = this.autoAddTriggers.maxAutoAddFiles,
    } = options;

    if (!enableAutoAdd) {
      return { autoAdded: false, reason: 'auto-add disabled' };
    }

    // Check cooldown period
    const now = Date.now();
    if (now - this.lastAutoAdd < this.autoAddTriggers.cooldownPeriod) {
      return { autoAdded: false, reason: 'cooldown active' };
    }

    // Update conversation memory
    this.updateConversationMemory(userInput, conversationHistory);

    // Check if input triggers auto-add
    if (!this.shouldTriggerAutoAdd(userInput)) {
      return { autoAdded: false, reason: 'no trigger keywords' };
    }

    try {
      // Special handling for inspection requests - be more aggressive
      const isInspectionRequest = ['inspect', 'analyze', 'examine', 'review', 'check', 'explore', 'investigate'].some((keyword) =>
        userInput.toLowerCase().includes(keyword)
      );

      const suggestionOptions = isInspectionRequest ? {
        maxSuggestions: maxFiles * 4, // More suggestions for inspection
        includeContext: true, // Include more context
        detailLevel: 'detailed', // More detailed analysis
      } : {
        maxSuggestions: maxFiles * 2,
        includeContext: false,
        detailLevel: 'standard',
      };

      // Get file suggestions
      const suggestions = await fileSuggester.suggestFiles(userInput, ['.'], suggestionOptions);

      if (suggestions.suggestions.length === 0) {
        return { autoAdded: false, reason: 'no relevant files found' };
      }

      // Filter by confidence and avoid duplicates
      // Use lower confidence threshold for inspection requests
      const effectiveThreshold = isInspectionRequest ? Math.max(30, confidenceThreshold - 20) : confidenceThreshold;

      const candidates = suggestions.suggestions.filter((suggestion) => {
        const confidence = suggestions.task.analysis.confidence;
        const alreadyInContext = fileContext.hasOwnProperty(
          suggestion.file.path
        );
        return confidence >= effectiveThreshold && !alreadyInContext;
      });

      if (candidates.length === 0) {
        return {
          autoAdded: false,
          reason: 'insufficient confidence or files already in context',
        };
      }

      // Select top candidates
      const toAdd = candidates.slice(0, maxFiles);
      const addedFiles = [];

      // Get optimized content for selected files
      const contextResult = await contextWindowOptimizer.optimizeContext(
        userInput,
        ['.'],
        {
          maxFiles: toAdd.length,
          model: 'grok-code-fast-1',
          includeStats: false,
        }
      );

      // Add files to context
      for (const file of contextResult.files) {
        if (!fileContext[file.filePath]) {
          fileContext[file.filePath] = file.content;
          addedFiles.push({
            path: file.filePath,
            name: file.shortName,
            relevanceScore: file.relevanceScore,
            tokens: file.tokens,
          });

          // Track in history
          this.contextHistory.set(file.filePath, {
            addedAt: now,
            query: userInput,
            relevanceScore: file.relevanceScore,
            autoAdded: true,
          });
        }
      }

      if (addedFiles.length > 0) {
        this.lastAutoAdd = now;

        // Learn from this addition
        this.learnFromAddition(
          userInput,
          addedFiles,
          suggestions.task.analysis
        );

        return {
          autoAdded: true,
          filesAdded: addedFiles,
          totalFiles: addedFiles.length,
          taskType: suggestions.task.analysis.type,
          confidence: suggestions.task.analysis.confidence,
          reason: 'relevant files automatically added to context',
        };
      }
    } catch (error) {
      console.warn('Auto-context addition failed:', error.message);
      return { autoAdded: false, reason: `error: ${error.message}` };
    }

    return { autoAdded: false, reason: 'no suitable files to add' };
  }

  /**
   * Check if user input should trigger automatic context addition
   * @param {string} userInput - User input to analyze
   * @returns {boolean} Whether to trigger auto-add
   */
  shouldTriggerAutoAdd(userInput) {
    const input = userInput.toLowerCase().trim();

    // Check for trigger keywords
    const hasTriggerKeyword = this.autoAddTriggers.keywords.some((keyword) =>
      input.includes(keyword)
    );

    if (!hasTriggerKeyword) {
      return false;
    }

    // Special handling for inspection/analysis keywords - always trigger
    const inspectionKeywords = ['inspect', 'analyze', 'examine', 'review', 'check', 'explore', 'investigate'];
    const isInspectionRequest = inspectionKeywords.some((keyword) =>
      input.includes(keyword)
    );

    if (isInspectionRequest) {
      return true; // Always trigger for inspection requests
    }

    // Additional heuristics for other keywords
    const wordCount = input.split(/\s+/).length;

    // Must be a substantial query (not just "fix" or "add")
    if (wordCount < 3) {
      return false;
    }

    // Should look like a coding task, not just casual conversation
    const codingIndicators = [
      'function',
      'class',
      'method',
      'variable',
      'file',
      'code',
      'component',
      'module',
      'api',
      'database',
      'error',
      'bug',
      'feature',
      'implement',
      'create',
      'build',
    ];

    const hasCodingIndicator = codingIndicators.some((indicator) =>
      input.includes(indicator)
    );

    return hasCodingIndicator;
  }

  /**
   * Update conversation memory for context awareness
   * @param {string} userInput - Current user input
   * @param {Array} conversationHistory - Recent conversation
   */
  updateConversationMemory(userInput, conversationHistory) {
    // Add current input to memory
    this.conversationMemory.push({
      input: userInput,
      timestamp: Date.now(),
      type: 'user',
    });

    // Keep only recent items
    if (this.conversationMemory.length > this.maxMemorySize) {
      this.conversationMemory = this.conversationMemory.slice(
        -this.maxMemorySize
      );
    }

    // Add recent conversation context
    if (conversationHistory && conversationHistory.length > 0) {
      const recentMessages = conversationHistory.slice(-3);
      recentMessages.forEach((msg) => {
        if (msg.role === 'user') {
          this.conversationMemory.push({
            input: msg.content,
            timestamp: Date.now(),
            type: 'historical',
          });
        }
      });
    }

    // Deduplicate memory
    const seen = new Set();
    this.conversationMemory = this.conversationMemory.filter((item) => {
      if (seen.has(item.input)) return false;
      seen.add(item.input);
      return true;
    });
  }

  /**
   * Learn from successful file additions to improve future suggestions
   * @param {string} query - Original query
   * @param {Array} addedFiles - Files that were added
   * @param {Object} taskAnalysis - Task analysis results
   */
  learnFromAddition(query, addedFiles, taskAnalysis) {
    const queryKey = this.normalizeQuery(query);

    if (!this.queryPatterns.has(queryKey)) {
      this.queryPatterns.set(queryKey, {
        taskType: taskAnalysis.type,
        files: new Map(),
        frequency: 0,
      });
    }

    const pattern = this.queryPatterns.get(queryKey);
    pattern.frequency++;

    // Track which files are commonly associated with this query pattern
    addedFiles.forEach((file) => {
      const fileKey = file.path;
      if (!pattern.files.has(fileKey)) {
        pattern.files.set(fileKey, {
          name: file.name,
          relevanceScore: file.relevanceScore,
          frequency: 0,
        });
      }
      pattern.files.get(fileKey).frequency++;
    });
  }

  /**
   * Get suggestions for proactive context building
   * @param {string} currentQuery - Current user query
   * @param {Object} fileContext - Current context
   * @returns {Array} Proactive suggestions
   */
  getProactiveSuggestions(currentQuery, fileContext) {
    const suggestions = [];
    const queryKey = this.normalizeQuery(currentQuery);

    // Check if we have learned patterns for similar queries
    for (const [patternKey, pattern] of this.queryPatterns) {
      if (this.queriesAreSimilar(queryKey, patternKey)) {
        for (const [filePath, fileData] of pattern.files) {
          if (!fileContext.hasOwnProperty(filePath) && fileData.frequency > 1) {
            suggestions.push({
              filePath,
              fileName: fileData.name,
              confidence: Math.min(fileData.frequency * 20, 80), // Max 80% confidence
              reason: `Frequently used with similar queries (${fileData.frequency} times)`,
              relevanceScore: fileData.relevanceScore,
            });
          }
        }
      }
    }

    return suggestions.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Check if two queries are similar
   * @param {string} query1 - First query
   * @param {string} query2 - Second query
   * @returns {boolean} Whether queries are similar
   */
  queriesAreSimilar(query1, query2) {
    const words1 = new Set(query1.split(/\s+/));
    const words2 = new Set(query2.split(/\s+/));

    const intersection = new Set([...words1].filter((x) => words2.has(x)));
    const union = new Set([...words1, ...words2]);

    const similarity = intersection.size / union.size;
    return similarity > 0.3; // 30% word overlap
  }

  /**
   * Normalize query for pattern matching
   * @param {string} query - Raw query
   * @returns {string} Normalized query
   */
  normalizeQuery(query) {
    return query
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter((word) => word.length > 2)
      .sort()
      .join(' ');
  }

  /**
   * Get context statistics
   * @returns {Object} Context statistics
   */
  getStatistics() {
    const filesInContext = Array.from(this.contextHistory.keys());
    const autoAddedFiles = Array.from(this.contextHistory.values()).filter(
      (entry) => entry.autoAdded
    );

    const taskTypeStats = {};
    for (const pattern of this.queryPatterns.values()) {
      taskTypeStats[pattern.taskType] =
        (taskTypeStats[pattern.taskType] || 0) + pattern.frequency;
    }

    return {
      totalFilesTracked: filesInContext.length,
      autoAddedFiles: autoAddedFiles.length,
      learnedPatterns: this.queryPatterns.size,
      taskTypeDistribution: taskTypeStats,
      conversationMemorySize: this.conversationMemory.length,
      lastAutoAdd: this.lastAutoAdd,
    };
  }

  /**
   * Clear learned patterns and history
   */
  clearLearning() {
    this.contextHistory.clear();
    this.queryPatterns.clear();
    this.conversationMemory = [];
    this.lastAutoAdd = 0;
  }

  /**
   * Configure auto-add behavior
   * @param {Object} config - New configuration
   */
  configure(config) {
    if (config.autoAddTriggers) {
      this.autoAddTriggers = {
        ...this.autoAddTriggers,
        ...config.autoAddTriggers,
      };
    }

    if (config.hasOwnProperty('autoAddEnabled')) {
      this.autoAddEnabled = config.autoAddEnabled;
    }

    if (config.maxMemorySize) {
      this.maxMemorySize = config.maxMemorySize;
    }
  }

  /**
   * Export learned patterns for persistence
   * @returns {Object} Exportable learning data
   */
  exportLearning() {
    const patterns = {};
    for (const [key, pattern] of this.queryPatterns) {
      patterns[key] = {
        taskType: pattern.taskType,
        frequency: pattern.frequency,
        files: Object.fromEntries(pattern.files),
      };
    }

    return {
      patterns,
      statistics: this.getStatistics(),
      exportedAt: new Date().toISOString(),
    };
  }

  /**
   * Import learned patterns
   * @param {Object} data - Imported learning data
   */
  importLearning(data) {
    if (data.patterns) {
      for (const [key, pattern] of Object.entries(data.patterns)) {
        const files = new Map();
        for (const [fileKey, fileData] of Object.entries(pattern.files)) {
          files.set(fileKey, fileData);
        }

        this.queryPatterns.set(key, {
          taskType: pattern.taskType,
          frequency: pattern.frequency,
          files,
        });
      }
    }
  }
}

// Export singleton instance for global use
export const autoContextBuilder = new AutoContextBuilder();
export default autoContextBuilder;
