import fs from 'fs';
import path from 'path';
import { logger } from '../utils/logger.js';

/**
 * Contextual Command Suggestions System
 * Provides intelligent command recommendations based on user context and behavior patterns
 */
export class ContextualSuggestions {
  constructor(options = {}) {
    this.maxSuggestions = options.maxSuggestions || 5;
    this.confidenceThreshold = options.confidenceThreshold || 0.3;
    this.learningEnabled = options.learningEnabled !== false;

    // Context analyzers
    this.contextAnalyzers = {
      project: this.analyzeProjectContext.bind(this),
      files: this.analyzeFileContext.bind(this),
      commands: this.analyzeCommandContext.bind(this),
      time: this.analyzeTimeContext.bind(this),
      conversation: this.analyzeConversationContext.bind(this)
    };

    // Command patterns and their contextual triggers
    this.commandPatterns = {
      // Development workflow commands
      'add': {
        triggers: ['modified files', 'new files', 'recent changes'],
        confidence: 0.8,
        description: 'Add files to context for discussion'
      },
      'remove': {
        triggers: ['unused files', 'large context', 'performance issues'],
        confidence: 0.6,
        description: 'Remove files to optimize context'
      },
      'scan': {
        triggers: ['new project', 'missing context', 'broad questions'],
        confidence: 0.7,
        description: 'Scan entire project for context'
      },
      'analyze': {
        triggers: ['complex tasks', 'architecture questions', 'design decisions'],
        confidence: 0.9,
        description: 'Deep analysis with automatic context building'
      },

      // Code inspection commands
      'preview': {
        triggers: ['specific files', 'code review', 'file exploration'],
        confidence: 0.8,
        description: 'Enhanced preview of code files'
      },
      'search': {
        triggers: ['code patterns', 'function names', 'variable usage'],
        confidence: 0.7,
        description: 'Search across codebase for patterns'
      },
      'diff': {
        triggers: ['changes', 'git status', 'code review'],
        confidence: 0.6,
        description: 'View git differences with syntax highlighting'
      },

      // Error handling commands
      'debug': {
        triggers: ['errors', 'failures', 'testing issues'],
        confidence: 0.8,
        description: 'Interactive debugging and error recovery'
      },

      // History and utility commands
      'history': {
        triggers: ['repeated tasks', 'forgotten commands', 'usage patterns'],
        confidence: 0.5,
        description: 'Search through command history'
      },
      'complete': {
        triggers: ['learning', 'exploration', 'command discovery'],
        confidence: 0.4,
        description: 'Test auto-complete functionality'
      },

      // Display and formatting commands
      'highlight': {
        triggers: ['code display', 'readability', 'presentation'],
        confidence: 0.5,
        description: 'Control syntax highlighting'
      },
      'browse': {
        triggers: ['file navigation', 'project exploration', 'directory changes'],
        confidence: 0.6,
        description: 'Interactive file browser'
      }
    };

    // Learning data for personalized suggestions
    this.learningData = {
      userPreferences: new Map(),
      commandSequences: new Map(),
      contextPatterns: new Map(),
      temporalPatterns: new Map()
    };

    // Load learning data if it exists
    this.loadLearningData();

    logger.info('Contextual suggestions system initialized', {
      maxSuggestions: this.maxSuggestions,
      confidenceThreshold: this.confidenceThreshold
    });
  }

  /**
   * Generate contextual command suggestions
   * @param {Object} context - Current user context
   * @returns {Array} Ranked command suggestions
   */
  generateSuggestions(context = {}) {
    try {
      const {
        currentDir = process.cwd(),
        recentCommands = [],
        openFiles = [],
        conversationHistory = [],
        projectInfo = {},
        timeOfDay = new Date().getHours(),
        userPreferences = {}
      } = context;

      // Analyze different context dimensions
      const contextAnalyses = {};
      for (const [analyzerName, analyzer] of Object.entries(this.contextAnalyzers)) {
        try {
          contextAnalyses[analyzerName] = analyzer({
            currentDir,
            recentCommands,
            openFiles,
            conversationHistory,
            projectInfo,
            timeOfDay,
            userPreferences
          });
        } catch (error) {
          logger.warn(`Context analyzer ${analyzerName} failed`, { error: error.message });
          contextAnalyses[analyzerName] = {};
        }
      }

      // Generate suggestions based on context analysis
      const suggestions = this.generateSuggestionsFromAnalysis(contextAnalyses);

      // Apply learning and personalization
      const personalizedSuggestions = this.applyPersonalization(suggestions, context);

      // Rank and filter suggestions
      const rankedSuggestions = this.rankAndFilterSuggestions(personalizedSuggestions);

      // Update learning data
      if (this.learningEnabled) {
        this.updateLearningData(context, rankedSuggestions);
      }

      return rankedSuggestions.slice(0, this.maxSuggestions);

    } catch (error) {
      logger.error('Failed to generate contextual suggestions', { error: error.message });
      return [];
    }
  }

  /**
   * Analyze project context
   * @param {Object} context - Context data
   * @returns {Object} Project analysis
   */
  analyzeProjectContext(context) {
    const { currentDir, projectInfo } = context;
    const analysis = {
      projectType: 'unknown',
      hasPackageJson: false,
      hasGit: false,
      languages: new Set(),
      frameworks: new Set(),
      fileTypes: new Map(),
      projectSize: 'small'
    };

    try {
      // Check for package.json
      const packageJsonPath = path.join(currentDir, 'package.json');
      if (fs.existsSync(packageJsonPath)) {
        analysis.hasPackageJson = true;
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        analysis.projectType = 'nodejs';

        // Detect frameworks
        const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
        if (deps.react) analysis.frameworks.add('react');
        if (deps.vue) analysis.frameworks.add('vue');
        if (deps.angular) analysis.frameworks.add('angular');
        if (deps.express) analysis.frameworks.add('express');
        if (deps.next) analysis.frameworks.add('nextjs');
      }

      // Check for git
      analysis.hasGit = fs.existsSync(path.join(currentDir, '.git'));

      // Analyze file types in project
      this.analyzeProjectFiles(currentDir, analysis);

    } catch (error) {
      logger.debug('Project context analysis failed', { error: error.message });
    }

    return analysis;
  }

  /**
   * Analyze file context
   * @param {Object} context - Context data
   * @returns {Object} File analysis
   */
  analyzeFileContext(context) {
    const { openFiles = [], recentCommands = [] } = context;
    const analysis = {
      recentFileTypes: new Set(),
      fileOperations: [],
      filePatterns: new Map(),
      contextSize: openFiles.length
    };

    // Analyze file types from recent activity
    openFiles.forEach(file => {
      const ext = path.extname(file).toLowerCase();
      if (ext) analysis.recentFileTypes.add(ext);
    });

    // Analyze file-related commands
    recentCommands.forEach(cmd => {
      if (cmd.includes('/add') || cmd.includes('/remove') || cmd.includes('/preview')) {
        analysis.fileOperations.push(cmd);
      }
    });

    return analysis;
  }

  /**
   * Analyze command context
   * @param {Object} context - Context data
   * @returns {Object} Command analysis
   */
  analyzeCommandContext(context) {
    const { recentCommands = [] } = context;
    const analysis = {
      recentCommandTypes: new Map(),
      commandFrequency: new Map(),
      commandSequences: [],
      lastCommandType: null
    };

    // Analyze recent commands
    recentCommands.slice(-10).forEach((cmd, index) => {
      const cmdType = this.categorizeCommand(cmd);
      analysis.recentCommandTypes.set(cmdType, (analysis.recentCommandTypes.get(cmdType) || 0) + 1);
      analysis.commandFrequency.set(cmd, (analysis.commandFrequency.get(cmd) || 0) + 1);

      if (index === recentCommands.length - 1) {
        analysis.lastCommandType = cmdType;
      }
    });

    // Look for command sequences
    if (recentCommands.length >= 2) {
      for (let i = 1; i < recentCommands.length; i++) {
        analysis.commandSequences.push({
          from: this.categorizeCommand(recentCommands[i-1]),
          to: this.categorizeCommand(recentCommands[i])
        });
      }
    }

    return analysis;
  }

  /**
   * Analyze time context
   * @param {Object} context - Context data
   * @returns {Object} Time analysis
   */
  analyzeTimeContext(context) {
    const { timeOfDay } = context;
    const analysis = {
      timeOfDay,
      timeCategory: this.getTimeCategory(timeOfDay),
      isWorkHours: this.isWorkHours(timeOfDay),
      dayOfWeek: new Date().getDay(),
      isWeekend: [0, 6].includes(new Date().getDay())
    };

    return analysis;
  }

  /**
   * Analyze conversation context
   * @param {Object} context - Context data
   * @returns {Object} Conversation analysis
   */
  analyzeConversationContext(context) {
    const { conversationHistory = [] } = context;
    const analysis = {
      conversationLength: conversationHistory.length,
      recentTopics: new Set(),
      questionTypes: new Map(),
      complexity: 'simple'
    };

    // Analyze recent conversation
    const recentMessages = conversationHistory.slice(-5);
    recentMessages.forEach(message => {
      const content = message.content?.toLowerCase() || '';

      // Detect question types
      if (content.includes('?')) {
        if (content.includes('how')) analysis.questionTypes.set('how-to', true);
        if (content.includes('why')) analysis.questionTypes.set('explanation', true);
        if (content.includes('what')) analysis.questionTypes.set('information', true);
        if (content.includes('error') || content.includes('bug')) analysis.questionTypes.set('debugging', true);
      }

      // Detect topics
      if (content.includes('test')) analysis.recentTopics.add('testing');
      if (content.includes('error') || content.includes('bug')) analysis.recentTopics.add('debugging');
      if (content.includes('git') || content.includes('commit')) analysis.recentTopics.add('version-control');
      if (content.includes('file') || content.includes('directory')) analysis.recentTopics.add('file-management');
    });

    // Determine complexity
    if (analysis.questionTypes.size > 2 || analysis.conversationLength > 10) {
      analysis.complexity = 'complex';
    } else if (analysis.questionTypes.size > 0 || analysis.conversationLength > 3) {
      analysis.complexity = 'moderate';
    }

    return analysis;
  }

  /**
   * Generate suggestions based on context analysis
   * @param {Object} analyses - Context analyses
   * @returns {Array} Raw suggestions
   */
  generateSuggestionsFromAnalysis(analyses) {
    const suggestions = [];

    // Project-based suggestions
    if (analyses.project) {
      suggestions.push(...this.generateProjectSuggestions(analyses.project));
    }

    // File-based suggestions
    if (analyses.files) {
      suggestions.push(...this.generateFileSuggestions(analyses.files));
    }

    // Command-based suggestions
    if (analyses.commands) {
      suggestions.push(...this.generateCommandSuggestions(analyses.commands));
    }

    // Time-based suggestions
    if (analyses.time) {
      suggestions.push(...this.generateTimeSuggestions(analyses.time));
    }

    // Conversation-based suggestions
    if (analyses.conversation) {
      suggestions.push(...this.generateConversationSuggestions(analyses.conversation));
    }

    return suggestions;
  }

  /**
   * Generate project-based suggestions
   * @param {Object} projectAnalysis - Project analysis
   * @returns {Array} Project suggestions
   */
  generateProjectSuggestions(projectAnalysis) {
    const suggestions = [];

    // Node.js project suggestions
    if (projectAnalysis.projectType === 'nodejs') {
      if (projectAnalysis.hasPackageJson) {
        suggestions.push({
          command: 'scan',
          confidence: 0.7,
          reason: 'Node.js project detected - scan for full context',
          category: 'project-setup'
        });
      }

      if (projectAnalysis.frameworks.has('react')) {
        suggestions.push({
          command: 'preview',
          confidence: 0.6,
          reason: 'React project - preview component files',
          category: 'framework-specific'
        });
      }
    }

    // Git repository suggestions
    if (projectAnalysis.hasGit) {
      suggestions.push({
        command: 'diff',
        confidence: 0.5,
        reason: 'Git repository detected - check for changes',
        category: 'version-control'
      });
    }

    return suggestions;
  }

  /**
   * Generate file-based suggestions
   * @param {Object} fileAnalysis - File analysis
   * @returns {Array} File suggestions
   */
  generateFileSuggestions(fileAnalysis) {
    const suggestions = [];

    // Large context suggestions
    if (fileAnalysis.contextSize > 10) {
      suggestions.push({
        command: 'remove',
        confidence: 0.6,
        reason: 'Large context detected - consider removing unused files',
        category: 'context-management'
      });
    }

    // Recent file operations
    if (fileAnalysis.fileOperations.length > 0) {
      suggestions.push({
        command: 'preview',
        confidence: 0.5,
        reason: 'Recent file operations - preview current context',
        category: 'file-inspection'
      });
    }

    // File type specific suggestions
    if (fileAnalysis.recentFileTypes.has('.js') || fileAnalysis.recentFileTypes.has('.ts')) {
      suggestions.push({
        command: 'search',
        confidence: 0.5,
        reason: 'JavaScript/TypeScript files - search for patterns',
        category: 'code-analysis'
      });
    }

    return suggestions;
  }

  /**
   * Generate command-based suggestions
   * @param {Object} commandAnalysis - Command analysis
   * @returns {Array} Command suggestions
   */
  generateCommandSuggestions(commandAnalysis) {
    const suggestions = [];

    // Command sequence suggestions
    const lastCommandType = commandAnalysis.lastCommandType;
    if (lastCommandType === 'file-operation') {
      suggestions.push({
        command: 'preview',
        confidence: 0.7,
        reason: 'Recent file operation - preview the results',
        category: 'workflow-continuation'
      });
    } else if (lastCommandType === 'search') {
      suggestions.push({
        command: 'preview',
        confidence: 0.6,
        reason: 'Recent search - preview found files',
        category: 'workflow-continuation'
      });
    }

    // Frequent command suggestions
    const topCommand = this.getMostFrequentCommand(commandAnalysis.commandFrequency);
    if (topCommand && topCommand !== commandAnalysis.lastCommandType) {
      suggestions.push({
        command: topCommand,
        confidence: 0.4,
        reason: `Frequently used command: ${topCommand}`,
        category: 'usage-pattern'
      });
    }

    return suggestions;
  }

  /**
   * Generate time-based suggestions
   * @param {Object} timeAnalysis - Time analysis
   * @returns {Array} Time suggestions
   */
  generateTimeSuggestions(timeAnalysis) {
    const suggestions = [];

    // Work hours suggestions
    if (timeAnalysis.isWorkHours && !timeAnalysis.isWeekend) {
      suggestions.push({
        command: 'analyze',
        confidence: 0.5,
        reason: 'Work hours - ready for complex analysis tasks',
        category: 'productivity'
      });
    }

    // End of day suggestions
    if (timeAnalysis.timeOfDay >= 17) {
      suggestions.push({
        command: 'history',
        confidence: 0.4,
        reason: 'End of day - review command history',
        category: 'reflection'
      });
    }

    return suggestions;
  }

  /**
   * Generate conversation-based suggestions
   * @param {Object} conversationAnalysis - Conversation analysis
   * @returns {Array} Conversation suggestions
   */
  generateConversationSuggestions(conversationAnalysis) {
    const suggestions = [];

    // Question type suggestions
    if (conversationAnalysis.questionTypes.has('debugging')) {
      suggestions.push({
        command: 'debug',
        confidence: 0.8,
        reason: 'Debugging questions detected - use debug command',
        category: 'problem-solving'
      });
    }

    if (conversationAnalysis.questionTypes.has('how-to')) {
      suggestions.push({
        command: 'analyze',
        confidence: 0.7,
        reason: 'How-to questions - comprehensive analysis needed',
        category: 'learning'
      });
    }

    // Topic-based suggestions
    if (conversationAnalysis.recentTopics.has('testing')) {
      suggestions.push({
        command: 'run',
        confidence: 0.6,
        reason: 'Testing discussion - run test commands',
        category: 'development-workflow'
      });
    }

    if (conversationAnalysis.recentTopics.has('version-control')) {
      suggestions.push({
        command: 'diff',
        confidence: 0.6,
        reason: 'Git discussion - check differences',
        category: 'version-control'
      });
    }

    // Complexity-based suggestions
    if (conversationAnalysis.complexity === 'complex') {
      suggestions.push({
        command: 'analyze',
        confidence: 0.8,
        reason: 'Complex discussion - deep analysis recommended',
        category: 'complexity-handling'
      });
    }

    return suggestions;
  }

  /**
   * Apply personalization to suggestions
   * @param {Array} suggestions - Raw suggestions
   * @param {Object} context - User context
   * @returns {Array} Personalized suggestions
   */
  applyPersonalization(suggestions, context) {
    const { userPreferences = {} } = context;

    return suggestions.map(suggestion => {
      let adjustedConfidence = suggestion.confidence;

      // Apply user preferences
      const prefKey = `prefer_${suggestion.command}`;
      if (userPreferences[prefKey]) {
        adjustedConfidence *= 1.2;
      }

      // Apply learning data
      const learnedPreference = this.learningData.userPreferences.get(suggestion.command);
      if (learnedPreference) {
        adjustedConfidence *= learnedPreference;
      }

      return {
        ...suggestion,
        confidence: Math.min(adjustedConfidence, 1.0),
        personalized: true
      };
    });
  }

  /**
   * Rank and filter suggestions
   * @param {Array} suggestions - Suggestions to rank
   * @returns {Array} Ranked and filtered suggestions
   */
  rankAndFilterSuggestions(suggestions) {
    return suggestions
      .filter(suggestion => suggestion.confidence >= this.confidenceThreshold)
      .sort((a, b) => b.confidence - a.confidence)
      .map((suggestion, index) => ({
        ...suggestion,
        rank: index + 1,
        id: `suggestion_${Date.now()}_${index}`
      }));
  }

  /**
   * Update learning data based on context and suggestions
   * @param {Object} context - User context
   * @param {Array} suggestions - Generated suggestions
   */
  updateLearningData(context, suggestions) {
    try {
      // Update user preferences based on accepted suggestions
      suggestions.forEach(suggestion => {
        const current = this.learningData.userPreferences.get(suggestion.command) || 1.0;
        // Slight preference boost for highly ranked suggestions
        const boost = suggestion.rank === 1 ? 1.05 : 1.02;
        this.learningData.userPreferences.set(suggestion.command, Math.min(current * boost, 2.0));
      });

      // Update command sequences
      if (context.recentCommands && context.recentCommands.length >= 2) {
        const lastTwo = context.recentCommands.slice(-2);
        const sequenceKey = `${this.categorizeCommand(lastTwo[0])}->${this.categorizeCommand(lastTwo[1])}`;
        const current = this.learningData.commandSequences.get(sequenceKey) || 0;
        this.learningData.commandSequences.set(sequenceKey, current + 1);
      }

      // Save learning data periodically
      if (Math.random() < 0.1) { // 10% chance
        this.saveLearningData();
      }
    } catch (error) {
      logger.debug('Learning data update failed', { error: error.message });
    }
  }

  /**
   * Categorize a command
   * @param {string} command - Command to categorize
   * @returns {string} Command category
   */
  categorizeCommand(command) {
    if (!command) return 'unknown';

    const cmd = command.toLowerCase();

    if (cmd.includes('/add') || cmd.includes('/remove') || cmd.includes('/scan')) {
      return 'context-management';
    }
    if (cmd.includes('/preview') || cmd.includes('/search') || cmd.includes('/diff')) {
      return 'file-inspection';
    }
    if (cmd.includes('/debug')) {
      return 'debugging';
    }
    if (cmd.includes('/analyze')) {
      return 'analysis';
    }
    if (cmd.includes('/run') || cmd.includes('/git')) {
      return 'execution';
    }

    return 'general';
  }

  /**
   * Get time category
   * @param {number} hour - Hour of day (0-23)
   * @returns {string} Time category
   */
  getTimeCategory(hour) {
    if (hour >= 6 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 17) return 'afternoon';
    if (hour >= 17 && hour < 22) return 'evening';
    return 'night';
  }

  /**
   * Check if it's work hours
   * @param {number} hour - Hour of day (0-23)
   * @returns {boolean} Whether it's work hours
   */
  isWorkHours(hour) {
    return hour >= 9 && hour <= 17;
  }

  /**
   * Analyze project files for context
   * @param {string} projectDir - Project directory
   * @param {Object} analysis - Analysis object to update
   */
  analyzeProjectFiles(projectDir, analysis) {
    try {
      const files = this.getProjectFiles(projectDir, 3); // Max depth 3

      files.forEach(file => {
        const ext = path.extname(file).toLowerCase();
        analysis.fileTypes.set(ext, (analysis.fileTypes.get(ext) || 0) + 1);

        // Detect languages
        if (['.js', '.jsx', '.mjs', '.cjs'].includes(ext)) analysis.languages.add('javascript');
        if (['.ts', '.tsx'].includes(ext)) analysis.languages.add('typescript');
        if (ext === '.py') analysis.languages.add('python');
        if (['.java', '.kt'].includes(ext)) analysis.languages.add('java');
        if (ext === '.go') analysis.languages.add('go');
        if (['.rs'].includes(ext)) analysis.languages.add('rust');
      });

      // Determine project size
      if (files.length > 100) analysis.projectSize = 'large';
      else if (files.length > 50) analysis.projectSize = 'medium';

    } catch (error) {
      logger.debug('Project file analysis failed', { error: error.message });
    }
  }

  /**
   * Get project files recursively
   * @param {string} dir - Directory to scan
   * @param {number} maxDepth - Maximum depth
   * @param {number} currentDepth - Current depth
   * @returns {Array} File paths
   */
  getProjectFiles(dir, maxDepth = 3, currentDepth = 0) {
    if (currentDepth > maxDepth) return [];

    try {
      const items = fs.readdirSync(dir, { withFileTypes: true });
      let files = [];

      for (const item of items) {
        if (item.isDirectory()) {
          // Skip common non-code directories
          if (!['node_modules', '.git', '.next', 'dist', 'build'].includes(item.name)) {
            files.push(...this.getProjectFiles(path.join(dir, item.name), maxDepth, currentDepth + 1));
          }
        } else {
          files.push(path.join(dir, item.name));
        }
      }

      return files;
    } catch (error) {
      return [];
    }
  }

  /**
   * Get most frequent command from frequency map
   * @param {Map} frequencyMap - Command frequency map
   * @returns {string} Most frequent command
   */
  getMostFrequentCommand(frequencyMap) {
    let maxCount = 0;
    let mostFrequent = null;

    for (const [command, count] of frequencyMap) {
      if (count > maxCount) {
        maxCount = count;
        mostFrequent = command;
      }
    }

    return mostFrequent;
  }

  /**
   * Load learning data from file
   */
  loadLearningData() {
    try {
      const dataPath = path.join(process.cwd(), '.grok', 'learning-data.json');
      if (fs.existsSync(dataPath)) {
        const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
        this.learningData = {
          userPreferences: new Map(data.userPreferences || []),
          commandSequences: new Map(data.commandSequences || []),
          contextPatterns: new Map(data.contextPatterns || []),
          temporalPatterns: new Map(data.temporalPatterns || [])
        };
      }
    } catch (error) {
      logger.debug('Failed to load learning data', { error: error.message });
    }
  }

  /**
   * Save learning data to file
   */
  saveLearningData() {
    try {
      const dataPath = path.join(process.cwd(), '.grok', 'learning-data.json');
      const dir = path.dirname(dataPath);

      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      const data = {
        userPreferences: Array.from(this.learningData.userPreferences),
        commandSequences: Array.from(this.learningData.commandSequences),
        contextPatterns: Array.from(this.learningData.contextPatterns),
        temporalPatterns: Array.from(this.learningData.temporalPatterns)
      };

      fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
      logger.debug('Learning data saved');
    } catch (error) {
      logger.error('Failed to save learning data', { error: error.message });
    }
  }

  /**
   * Get suggestion statistics
   * @returns {Object} Statistics
   */
  getStats() {
    return {
      maxSuggestions: this.maxSuggestions,
      confidenceThreshold: this.confidenceThreshold,
      learningEnabled: this.learningEnabled,
      learningDataSize: {
        userPreferences: this.learningData.userPreferences.size,
        commandSequences: this.learningData.commandSequences.size,
        contextPatterns: this.learningData.contextPatterns.size,
        temporalPatterns: this.learningData.temporalPatterns.size
      }
    };
  }

  /**
   * Format suggestions for display
   * @param {Array} suggestions - Suggestions to format
   * @returns {string} Formatted suggestions
   */
  formatSuggestions(suggestions) {
    if (suggestions.length === 0) {
      return '🤔 No contextual suggestions available.';
    }

    let output = `💡 Contextual Command Suggestions:\n\n`;

    suggestions.forEach((suggestion, index) => {
      const confidencePercent = Math.round(suggestion.confidence * 100);
      const icon = this.getSuggestionIcon(suggestion.category);

      output += `${index + 1}. ${icon} \`/${suggestion.command}\`\n`;
      output += `   ${suggestion.description || 'Suggested command'}\n`;
      output += `   Reason: ${suggestion.reason}\n`;
      output += `   Confidence: ${confidencePercent}%\n\n`;
    });

    return output;
  }

  /**
   * Get icon for suggestion category
   * @param {string} category - Suggestion category
   * @returns {string} Icon
   */
  getSuggestionIcon(category) {
    const icons = {
      'project-setup': '🏗️',
      'framework-specific': '⚛️',
      'version-control': '🔀',
      'context-management': '📦',
      'file-inspection': '👁️',
      'code-analysis': '🔍',
      'debugging': '🐛',
      'workflow-continuation': '🔄',
      'usage-pattern': '📊',
      'productivity': '⚡',
      'reflection': '🤔',
      'problem-solving': '🛠️',
      'learning': '📚',
      'development-workflow': '🔧'
    };

    return icons[category] || '💡';
  }

  /**
   * Reset learning data
   */
  resetLearningData() {
    this.learningData = {
      userPreferences: new Map(),
      commandSequences: new Map(),
      contextPatterns: new Map(),
      temporalPatterns: new Map()
    };
    this.saveLearningData();
    logger.info('Learning data reset');
  }
}
