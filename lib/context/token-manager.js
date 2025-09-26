import { contextWindowOptimizer } from './window-optimizer.js';

/**
 * Smart Context Pruning and Token Management
 * Intelligently manages conversation context to stay within AI model token limits
 */
export class TokenManager {
  constructor() {
    // Token management settings
    this.warningThreshold = 0.8; // Warn at 80% of limit
    this.criticalThreshold = 0.9; // Critical action at 90% of limit
    this.maxContextAge = 30 * 60 * 1000; // 30 minutes in milliseconds

    // Context capacity budgeting
    this.capacityBudget = {
      essentials: 0.15, // 15% for essential project files (package.json, etc.)
      conversation: 0.7, // 70% for actual conversation and work
      buffer: 0.15, // 15% safety buffer
    };

    // Track current usage by category
    this.usageByCategory = {
      essentials: 0,
      conversation: 0,
      buffer: 0,
    };

    // Pruning strategies
    this.strategies = {
      aggressive: {
        name: 'aggressive',
        description: 'Remove oldest, least relevant content first',
        targetUtilization: 0.7,
      },
      conservative: {
        name: 'conservative',
        description: 'Preserve recent high-relevance content',
        targetUtilization: 0.75,
      },
      balanced: {
        name: 'balanced',
        description: 'Balance recency and relevance',
        targetUtilization: 0.8,
      },
    };

    this.currentStrategy = 'balanced';
    this.pruningEnabled = true;
    this.autoPruneEnabled = true;

    // Statistics tracking
    this.stats = {
      totalPrunings: 0,
      tokensRemoved: 0,
      filesPruned: 0,
      lastPruning: null,
    };
  }

  /**
   * Analyze current context and provide pruning recommendations
   * @param {Array} messages - Current conversation messages
   * @param {Object} fileContext - Current file context
   * @param {string} model - AI model being used
   * @returns {Object} Context analysis and recommendations
   */
  analyzeContext(messages, fileContext, model = 'gpt-4') {
    const tokenLimit =
      contextWindowOptimizer.modelLimits[model] ||
      contextWindowOptimizer.modelLimits.default;

    // Estimate current token usage
    const currentTokens = this.estimateTokenUsage(messages, fileContext);
    const utilization = currentTokens / tokenLimit;

    const analysis = {
      currentTokens,
      tokenLimit,
      utilization,
      utilizationPercent: Math.round(utilization * 100),
      status: this.getStatus(utilization),
      recommendations: [],
      canPrune: this.canPruneContext(fileContext),
    };

    // Add status-specific recommendations
    if (utilization >= this.criticalThreshold) {
      analysis.recommendations.push({
        action: 'immediate_pruning',
        priority: 'critical',
        description: 'Context is at critical levels, pruning required',
        strategy: this.currentStrategy,
      });
    } else if (utilization >= this.warningThreshold) {
      analysis.recommendations.push({
        action: 'consider_pruning',
        priority: 'warning',
        description: 'Context is approaching limits, consider pruning',
        strategy: this.currentStrategy,
      });
    }

    // Add general recommendations
    if (analysis.canPrune) {
      analysis.recommendations.push({
        action: 'optimize_files',
        priority: 'info',
        description: 'Consider optimizing file content in context',
      });
    }

    return analysis;
  }

  /**
   * Check if content can be added to a specific budget category
   * @param {string} category - Budget category ('essentials', 'conversation', 'buffer')
   * @param {number} tokenCount - Number of tokens to add
   * @param {string} model - AI model being used
   * @returns {Object} Budget check result
   */
  canAddToBudget(category, tokenCount, model = 'gpt-4') {
    const tokenLimit =
      contextWindowOptimizer.modelLimits[model] ||
      contextWindowOptimizer.modelLimits.default;

    const categoryLimit = Math.floor(
      tokenLimit * this.capacityBudget[category]
    );
    const currentUsage = this.usageByCategory[category];
    const projectedUsage = currentUsage + tokenCount;

    return {
      canAdd: projectedUsage <= categoryLimit,
      currentUsage,
      categoryLimit,
      projectedUsage,
      available: categoryLimit - currentUsage,
      overBy: Math.max(0, projectedUsage - categoryLimit),
    };
  }

  /**
   * Add content to a budget category (tracks usage)
   * @param {string} category - Budget category
   * @param {number} tokenCount - Number of tokens added
   */
  addToBudget(category, tokenCount) {
    if (this.usageByCategory[category] !== undefined) {
      this.usageByCategory[category] += tokenCount;
    }
  }

  /**
   * Remove content from a budget category (tracks usage)
   * @param {string} category - Budget category
   * @param {number} tokenCount - Number of tokens removed
   */
  removeFromBudget(category, tokenCount) {
    if (this.usageByCategory[category] !== undefined) {
      this.usageByCategory[category] = Math.max(
        0,
        this.usageByCategory[category] - tokenCount
      );
    }
  }

  /**
   * Get current budget utilization status
   * @param {string} model - AI model being used
   * @returns {Object} Budget utilization status
   */
  getBudgetStatus(model = 'gpt-4') {
    const tokenLimit =
      contextWindowOptimizer.modelLimits[model] ||
      contextWindowOptimizer.modelLimits.default;

    const status = {};
    let totalUsed = 0;

    for (const [category, budgetPercent] of Object.entries(
      this.capacityBudget
    )) {
      const categoryLimit = Math.floor(tokenLimit * budgetPercent);
      const currentUsage = this.usageByCategory[category];
      const utilization = currentUsage / categoryLimit;

      status[category] = {
        currentUsage,
        categoryLimit,
        utilization,
        utilizationPercent: Math.round(utilization * 100),
        available: categoryLimit - currentUsage,
      };

      totalUsed += currentUsage;
    }

    return {
      categories: status,
      totalUsed,
      totalLimit: tokenLimit,
      totalUtilization: totalUsed / tokenLimit,
      totalUtilizationPercent: Math.round((totalUsed / tokenLimit) * 100),
      availableCapacity: tokenLimit - totalUsed,
    };
  }

  /**
   * Reset budget tracking (useful for new sessions)
   */
  resetBudget() {
    this.usageByCategory = {
      essentials: 0,
      conversation: 0,
      buffer: 0,
    };
  }

  /**
   * Automatically prune context if needed
   * @param {Array} messages - Current conversation messages
   * @param {Object} fileContext - Current file context (modified in place)
   * @param {string} model - AI model being used
   * @returns {Object} Pruning results
   */
  autoPruneContext(messages, fileContext, model = 'gpt-4') {
    if (!this.autoPruneEnabled) {
      return { pruned: false, reason: 'auto-pruning disabled' };
    }

    const analysis = this.analyzeContext(messages, fileContext, model);

    if (
      analysis.status !== 'critical' &&
      analysis.utilization < this.criticalThreshold
    ) {
      return { pruned: false, reason: 'pruning not needed' };
    }

    return this.pruneContext(
      messages,
      fileContext,
      model,
      this.currentStrategy
    );
  }

  /**
   * Manually prune context using specified strategy
   * @param {Array} messages - Current conversation messages
   * @param {Object} fileContext - Current file context (modified in place)
   * @param {string} model - AI model being used
   * @param {string} strategy - Pruning strategy to use
   * @returns {Object} Pruning results
   */
  pruneContext(messages, fileContext, model = 'gpt-4', strategy = 'balanced') {
    const startTime = Date.now();
    const initialAnalysis = this.analyzeContext(messages, fileContext, model);

    if (!this.canPruneContext(fileContext)) {
      return {
        pruned: false,
        reason: 'no prunable content found',
        analysis: initialAnalysis,
      };
    }

    const strategyConfig =
      this.strategies[strategy] || this.strategies.balanced;
    const targetTokens = Math.floor(
      (contextWindowOptimizer.modelLimits[model] ||
        contextWindowOptimizer.modelLimits.default) *
        strategyConfig.targetUtilization
    );

    // Analyze files for pruning priority
    const fileAnalysis = this.analyzeFilesForPruning(fileContext, messages);

    // Select files to prune
    const filesToPrune = this.selectFilesToPrune(
      fileAnalysis,
      initialAnalysis.currentTokens - targetTokens
    );

    // Perform pruning
    let tokensRemoved = 0;
    const prunedFiles = [];

    for (const file of filesToPrune) {
      if (fileContext[file.path]) {
        const fileTokens = this.estimateFileTokens(fileContext[file.path]);
        delete fileContext[file.path];
        tokensRemoved += fileTokens;
        prunedFiles.push({
          path: file.path,
          name: file.name,
          tokensRemoved: fileTokens,
          reason: file.pruneReason,
        });
      }
    }

    // Update statistics
    this.stats.totalPrunings++;
    this.stats.tokensRemoved += tokensRemoved;
    this.stats.filesPruned += prunedFiles.length;
    this.stats.lastPruning = new Date().toISOString();

    const finalAnalysis = this.analyzeContext(messages, fileContext, model);

    return {
      pruned: true,
      strategy: strategyConfig.name,
      filesPruned: prunedFiles.length,
      tokensRemoved,
      targetTokens,
      initialUtilization: initialAnalysis.utilizationPercent,
      finalUtilization: finalAnalysis.utilizationPercent,
      duration: Date.now() - startTime,
      analysis: finalAnalysis,
      prunedFiles,
    };
  }

  /**
   * Estimate token usage for messages and file context
   * @param {Array} messages - Conversation messages
   * @param {Object} fileContext - File context
   * @returns {number} Estimated token count
   */
  estimateTokenUsage(messages, fileContext) {
    let totalTokens = 0;

    // Estimate message tokens (rough approximation)
    for (const message of messages) {
      if (message.content) {
        totalTokens += Math.ceil(message.content.length / 4); // ~4 chars per token
      }
    }

    // Estimate file context tokens
    for (const content of Object.values(fileContext)) {
      totalTokens += this.estimateFileTokens(content);
    }

    return totalTokens;
  }

  /**
   * Estimate tokens for a single file's content
   * @param {string} content - File content
   * @returns {number} Estimated token count
   */
  estimateFileTokens(content) {
    // Rough estimation: ~4 characters per token for code
    // This could be made more sophisticated with actual tokenization
    return Math.ceil(content.length / 4);
  }

  /**
   * Get status based on utilization
   * @param {number} utilization - Token utilization (0-1)
   * @returns {string} Status level
   */
  getStatus(utilization) {
    if (utilization >= this.criticalThreshold) return 'critical';
    if (utilization >= this.warningThreshold) return 'warning';
    if (utilization >= 0.6) return 'moderate';
    return 'healthy';
  }

  /**
   * Check if context can be pruned
   * @param {Object} fileContext - File context
   * @returns {boolean} Whether pruning is possible
   */
  canPruneContext(fileContext) {
    return Object.keys(fileContext).length > 0;
  }

  /**
   * Analyze files for pruning priority
   * @param {Object} fileContext - File context
   * @param {Array} messages - Recent messages for context
   * @returns {Array} Files with pruning metadata
   */
  analyzeFilesForPruning(fileContext, messages) {
    const fileAnalysis = [];
    const recentMessageContent = messages
      .slice(-10)
      .map((m) => m.content || '')
      .join(' ')
      .toLowerCase();

    for (const [filePath, content] of Object.entries(fileContext)) {
      const analysis = {
        path: filePath,
        name: this.getFileName(filePath),
        tokens: this.estimateFileTokens(content),
        content: content,
        priority: this.calculatePruningPriority(
          filePath,
          content,
          recentMessageContent
        ),
        lastReferenced: this.findLastReference(filePath, messages),
        fileType: this.getFileType(filePath),
      };

      // Determine pruning reason based on priority
      if (analysis.priority >= 8) {
        analysis.pruneReason = 'low relevance to current conversation';
      } else if (analysis.priority >= 6) {
        analysis.pruneReason = 'old context, not recently referenced';
      } else if (analysis.priority >= 4) {
        analysis.pruneReason = 'large file, partial relevance';
      } else {
        analysis.pruneReason = 'optimization candidate';
      }

      fileAnalysis.push(analysis);
    }

    // Sort by pruning priority (highest first)
    return fileAnalysis.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Calculate pruning priority for a file (higher = more likely to prune)
   * @param {string} filePath - File path
   * @param {string} content - File content
   * @param {string} recentContext - Recent conversation context
   * @returns {number} Pruning priority score
   */
  calculatePruningPriority(filePath, content, recentContext) {
    let priority = 0;

    // Base priority by file type
    const fileType = this.getFileType(filePath);
    const typePriorities = {
      config: 2, // Less likely to prune config files
      docs: 3, // Documentation somewhat protected
      test: 4, // Test files moderate priority
      source: 6, // Source files can be pruned
      other: 5, // Default priority
    };
    priority += typePriorities[fileType] || 5;

    // Content relevance to recent conversation
    const contentLower = content.toLowerCase();
    const contextWords = recentContext
      .split(/\s+/)
      .filter((word) => word.length > 3);
    let relevanceScore = 0;

    for (const word of contextWords.slice(0, 20)) {
      // Check first 20 words
      if (contentLower.includes(word)) {
        relevanceScore += 0.5;
      }
    }

    // Higher relevance = lower pruning priority
    priority += Math.max(0, 5 - relevanceScore);

    // File size factor (larger files more likely to prune)
    const sizeKB = content.length / 1024;
    if (sizeKB > 50) priority += 2;
    else if (sizeKB > 20) priority += 1;

    // Age factor (older files more likely to prune)
    const age = this.getFileAge(filePath);
    if (age > this.maxContextAge) priority += 2;
    else if (age > this.maxContextAge / 2) priority += 1;

    return Math.min(priority, 10); // Cap at 10
  }

  /**
   * Select files to prune based on target token reduction
   * @param {Array} fileAnalysis - Analyzed files
   * @param {number} tokensToRemove - Target tokens to remove
   * @returns {Array} Selected files for pruning
   */
  selectFilesToPrune(fileAnalysis, tokensToRemove) {
    const selected = [];
    let tokensSelected = 0;

    for (const file of fileAnalysis) {
      if (tokensSelected >= tokensToRemove) break;

      selected.push(file);
      tokensSelected += file.tokens;

      // Stop if we've selected too many files (max 5 at once)
      if (selected.length >= 5) break;
    }

    return selected;
  }

  /**
   * Find when a file was last referenced in conversation
   * @param {string} filePath - File path
   * @param {Array} messages - Conversation messages
   * @returns {number} Timestamp of last reference (0 if never)
   */
  findLastReference(filePath, messages) {
    const fileName = this.getFileName(filePath);

    for (let i = messages.length - 1; i >= 0; i--) {
      const message = messages[i];
      if (
        message.content &&
        (message.content.includes(fileName) ||
          message.content.includes(filePath))
      ) {
        return message.timestamp || Date.now();
      }
    }

    return 0;
  }

  /**
   * Get file type category
   * @param {string} filePath - File path
   * @returns {string} File type
   */
  getFileType(filePath) {
    const ext = filePath.split('.').pop()?.toLowerCase();

    if (
      ['json', 'config', 'conf', 'yml', 'yaml', 'toml', 'ini'].includes(ext)
    ) {
      return 'config';
    }

    if (['md', 'txt', 'rst', 'adoc'].includes(ext)) {
      return 'docs';
    }

    if (
      filePath.includes('.test.') ||
      filePath.includes('.spec.') ||
      filePath.includes('/test')
    ) {
      return 'test';
    }

    if (
      ['js', 'ts', 'jsx', 'tsx', 'py', 'java', 'cpp', 'c', 'go', 'rs'].includes(
        ext
      )
    ) {
      return 'source';
    }

    return 'other';
  }

  /**
   * Get file age in milliseconds
   * @param {string} filePath - File path
   * @returns {number} Age in milliseconds
   */
  getFileAge(filePath) {
    try {
      // For context files, we don't have actual file stats
      // This is a simplified implementation
      return Math.random() * this.maxContextAge; // Random for demo
    } catch (error) {
      return this.maxContextAge;
    }
  }

  /**
   * Get filename from path
   * @param {string} filePath - File path
   * @returns {string} Filename
   */
  getFileName(filePath) {
    return filePath.split('/').pop().split('\\').pop();
  }

  /**
   * Get pruning statistics
   * @returns {Object} Statistics
   */
  getStatistics() {
    return {
      ...this.stats,
      currentStrategy: this.currentStrategy,
      pruningEnabled: this.pruningEnabled,
      autoPruneEnabled: this.autoPruneEnabled,
      thresholds: {
        warning: this.warningThreshold,
        critical: this.criticalThreshold,
      },
    };
  }

  /**
   * Configure token management settings
   * @param {Object} config - Configuration options
   */
  configure(config) {
    if (config.warningThreshold !== undefined) {
      this.warningThreshold = config.warningThreshold;
    }

    if (config.criticalThreshold !== undefined) {
      this.criticalThreshold = config.criticalThreshold;
    }

    if (config.currentStrategy) {
      this.currentStrategy = config.currentStrategy;
    }

    if (config.pruningEnabled !== undefined) {
      this.pruningEnabled = config.pruningEnabled;
    }

    if (config.autoPruneEnabled !== undefined) {
      this.autoPruneEnabled = config.autoPruneEnabled;
    }

    if (config.maxContextAge) {
      this.maxContextAge = config.maxContextAge;
    }
  }

  /**
   * Reset statistics
   */
  resetStatistics() {
    this.stats = {
      totalPrunings: 0,
      tokensRemoved: 0,
      filesPruned: 0,
      lastPruning: null,
    };
  }

  /**
   * Get available pruning strategies
   * @returns {Object} Available strategies
   */
  getAvailableStrategies() {
    return this.strategies;
  }
}

// Export singleton instance for global use
export const tokenManager = new TokenManager();
export default tokenManager;
