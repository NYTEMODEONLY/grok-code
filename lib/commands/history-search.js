import fs from 'fs';
import path from 'path';
import { logger } from '../utils/logger.js';

/**
 * Command History Search System
 * Provides advanced search and navigation through command history
 */
export class HistorySearch {
  constructor(options = {}) {
    this.maxHistorySize = options.maxHistorySize || 1000;
    this.historyFile =
      options.historyFile ||
      path.join(process.cwd(), '.grok', 'command-history.json');
    this.sessionHistory = [];
    this.globalHistory = this.loadHistory();

    // Search settings
    this.caseSensitive = options.caseSensitive || false;
    this.fuzzyMatch = options.fuzzyMatch !== false;
    this.includeCommands = options.includeCommands !== false; // Include /commands
    this.includeExits = options.includeExits || false; // Include exit commands

    // Initialize session
    this.currentSession = {
      id: Date.now().toString(),
      startTime: new Date(),
      commands: [],
    };

    logger.info('Command history search initialized', {
      maxHistorySize: this.maxHistorySize,
      historyFile: this.historyFile,
    });
  }

  /**
   * Add a command to history
   * @param {string} command - Command to add
   * @param {Object} metadata - Additional metadata
   */
  addCommand(command, metadata = {}) {
    if (!command || command.trim() === '') return;

    const trimmedCommand = command.trim();

    // Skip commands based on settings
    if (!this.includeCommands && trimmedCommand.startsWith('/')) return;
    if (!this.includeExits && trimmedCommand.toLowerCase() === 'exit') return;

    const historyEntry = {
      command: trimmedCommand,
      timestamp: new Date().toISOString(),
      sessionId: this.currentSession.id,
      ...metadata,
    };

    // Add to session history
    this.sessionHistory.push(historyEntry);

    // Add to global history
    this.globalHistory.push(historyEntry);

    // Maintain history size limit
    if (this.globalHistory.length > this.maxHistorySize) {
      this.globalHistory = this.globalHistory.slice(-this.maxHistorySize);
    }

    // Auto-save periodically (every 10 commands)
    if (this.globalHistory.length % 10 === 0) {
      this.saveHistory();
    }

    logger.debug('Command added to history', {
      command: trimmedCommand.substring(0, 50),
      sessionCommands: this.sessionHistory.length,
      totalCommands: this.globalHistory.length,
    });
  }

  /**
   * Search command history
   * @param {string} query - Search query
   * @param {Object} options - Search options
   * @returns {Array} Matching history entries
   */
  searchHistory(query, options = {}) {
    if (!query || query.trim() === '') {
      return this.getRecentHistory(options.limit || 10);
    }

    const {
      limit = 20,
      caseSensitive = this.caseSensitive,
      fuzzyMatch = this.fuzzyMatch,
      sortBy = 'timestamp', // 'timestamp', 'relevance', 'frequency'
      includeSession = true,
      includeGlobal = true,
      timeRange, // 'today', 'week', 'month', or {start, end}
    } = options;

    let candidates = [];

    // Add session history if requested
    if (includeSession) {
      candidates.push(...this.sessionHistory);
    }

    // Add global history if requested
    if (includeGlobal) {
      candidates.push(...this.globalHistory);
    }

    // Remove duplicates (keep most recent)
    const seen = new Set();
    candidates = candidates
      .filter((entry) => {
        if (seen.has(entry.command)) return false;
        seen.add(entry.command);
        return true;
      })
      .reverse(); // Most recent first

    // Apply time range filter
    if (timeRange) {
      candidates = this.filterByTimeRange(candidates, timeRange);
    }

    // Search and score
    const scoredResults = candidates
      .map((entry) => ({
        entry,
        score: this.calculateRelevanceScore(entry.command, query, {
          caseSensitive,
          fuzzyMatch,
        }),
      }))
      .filter((result) => result.score > 0)
      .sort((a, b) => {
        if (sortBy === 'relevance') {
          return b.score - a.score;
        } else if (sortBy === 'frequency') {
          // Would need frequency tracking for this
          return new Date(b.entry.timestamp) - new Date(a.entry.timestamp);
        } else {
          // timestamp (default)
          return new Date(b.entry.timestamp) - new Date(a.entry.timestamp);
        }
      })
      .slice(0, limit);

    return scoredResults.map((result) => ({
      ...result.entry,
      relevanceScore: result.score,
    }));
  }

  /**
   * Get recent command history
   * @param {number} limit - Maximum number of entries to return
   * @returns {Array} Recent history entries
   */
  getRecentHistory(limit = 10) {
    // Combine and deduplicate session + global history
    const combined = [...this.sessionHistory, ...this.globalHistory];
    const seen = new Set();

    return combined
      .filter((entry) => {
        if (seen.has(entry.command)) return false;
        seen.add(entry.command);
        return true;
      })
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, limit);
  }

  /**
   * Get command statistics
   * @param {Object} options - Options for statistics
   * @returns {Object} History statistics
   */
  getStatistics(options = {}) {
    const { timeRange, includeCommands = true, includeExits = false } = options;

    let candidates = [...this.globalHistory];

    if (timeRange) {
      candidates = this.filterByTimeRange(candidates, timeRange);
    }

    if (!includeCommands) {
      candidates = candidates.filter((entry) => !entry.command.startsWith('/'));
    }

    if (!includeExits) {
      candidates = candidates.filter(
        (entry) => entry.command.toLowerCase() !== 'exit'
      );
    }

    // Command frequency
    const commandFreq = {};
    candidates.forEach((entry) => {
      commandFreq[entry.command] = (commandFreq[entry.command] || 0) + 1;
    });

    // Time-based stats
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const thisWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thisMonth = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

    const todayCount = candidates.filter(
      (entry) => new Date(entry.timestamp) >= today
    ).length;
    const weekCount = candidates.filter(
      (entry) => new Date(entry.timestamp) >= thisWeek
    ).length;
    const monthCount = candidates.filter(
      (entry) => new Date(entry.timestamp) >= thisMonth
    ).length;

    // Top commands
    const topCommands = Object.entries(commandFreq)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([command, count]) => ({ command, count }));

    return {
      totalCommands: candidates.length,
      sessionCommands: this.sessionHistory.length,
      uniqueCommands: Object.keys(commandFreq).length,
      todayCommands: todayCount,
      weekCommands: weekCount,
      monthCommands: monthCount,
      topCommands,
      averageCommandsPerDay: monthCount / 30,
      mostUsedCommand: topCommands[0]?.command || null,
      commandFrequency: commandFreq,
    };
  }

  /**
   * Delete commands from history
   * @param {Object} criteria - Deletion criteria
   * @returns {number} Number of commands deleted
   */
  deleteFromHistory(criteria = {}) {
    const { query, olderThan, command, sessionId } = criteria;
    let deletedCount = 0;

    // Delete from global history
    let newGlobalHistory = [...this.globalHistory];

    if (query) {
      newGlobalHistory = newGlobalHistory.filter(
        (entry) => !this.matchesQuery(entry.command, query)
      );
    }

    if (olderThan) {
      const cutoffDate = new Date(olderThan);
      newGlobalHistory = newGlobalHistory.filter(
        (entry) => new Date(entry.timestamp) >= cutoffDate
      );
    }

    if (command) {
      newGlobalHistory = newGlobalHistory.filter(
        (entry) => entry.command !== command
      );
    }

    if (sessionId) {
      newGlobalHistory = newGlobalHistory.filter(
        (entry) => entry.sessionId !== sessionId
      );
    }

    deletedCount = this.globalHistory.length - newGlobalHistory.length;
    this.globalHistory = newGlobalHistory;

    // Also clean session history if applicable
    if (sessionId === this.currentSession.id) {
      this.sessionHistory = this.sessionHistory.filter(
        (entry) => !this.matchesCriteria(entry, criteria)
      );
    }

    if (deletedCount > 0) {
      this.saveHistory();
    }

    logger.info('Deleted commands from history', { deletedCount, criteria });
    return deletedCount;
  }

  /**
   * Export history data
   * @param {string} format - Export format ('json', 'csv', 'txt')
   * @param {Object} options - Export options
   * @returns {string} Exported data
   */
  exportHistory(format = 'json', options = {}) {
    const { limit, timeRange, includeMetadata = true } = options;
    let data = [...this.globalHistory];

    if (timeRange) {
      data = this.filterByTimeRange(data, timeRange);
    }

    if (limit) {
      data = data.slice(-limit);
    }

    switch (format) {
      case 'json':
        return JSON.stringify(data, null, 2);

      case 'csv':
        const headers = ['timestamp', 'command', 'sessionId'];
        if (includeMetadata) {
          headers.push('metadata');
        }
        const csvLines = [
          headers.join(','),
          ...data.map((entry) =>
            [
              entry.timestamp,
              `"${entry.command.replace(/"/g, '""')}"`,
              entry.sessionId,
              includeMetadata
                ? `"${JSON.stringify(entry).replace(/"/g, '""')}"`
                : '',
            ].join(',')
          ),
        ];
        return csvLines.join('\n');

      case 'txt':
        return data
          .map((entry) => `${entry.timestamp}: ${entry.command}`)
          .join('\n');

      default:
        return JSON.stringify(data, null, 2);
    }
  }

  /**
   * Get command suggestions based on partial input
   * @param {string} partial - Partial command input
   * @param {number} limit - Maximum suggestions to return
   * @returns {Array} Command suggestions
   */
  getSuggestions(partial, limit = 5) {
    if (!partial || partial.trim() === '') {
      return this.getRecentHistory(limit).map((entry) => entry.command);
    }

    const results = this.searchHistory(partial, {
      limit,
      sortBy: 'frequency',
      fuzzyMatch: true,
    });

    return results.map((result) => result.command);
  }

  /**
   * Navigate through history (like shell history navigation)
   * @param {string} currentInput - Current input line
   * @param {string} direction - 'up' or 'down'
   * @returns {string} Next history command or current input
   */
  navigateHistory(currentInput, direction = 'up') {
    // This would be used for actual readline-style history navigation
    // For now, return suggestions
    const suggestions = this.getSuggestions(currentInput, 1);
    return suggestions[0] || currentInput;
  }

  /**
   * Calculate relevance score for search matching
   * @param {string} command - Command text
   * @param {string} query - Search query
   * @param {Object} options - Search options
   * @returns {number} Relevance score (0-100)
   */
  calculateRelevanceScore(command, query, options = {}) {
    const { caseSensitive = false, fuzzyMatch = true } = options;

    if (!query) return 0;

    const cmd = caseSensitive ? command : command.toLowerCase();
    const qry = caseSensitive ? query : query.toLowerCase();

    // Exact match gets highest score
    if (cmd === qry) return 100;

    // Starts with query
    if (cmd.startsWith(qry)) return 90;

    // Contains query
    if (cmd.includes(qry)) return 70;

    // Fuzzy matching (contains all characters in order)
    if (fuzzyMatch) {
      let queryIndex = 0;
      for (const char of cmd) {
        if (char === qry[queryIndex]) {
          queryIndex++;
          if (queryIndex === qry.length) {
            return 50; // Fuzzy match score
          }
        }
      }
    }

    // Word boundary match
    const words = cmd.split(/\s+/);
    if (words.some((word) => word.startsWith(qry))) {
      return 60;
    }

    return 0; // No match
  }

  /**
   * Filter entries by time range
   * @param {Array} entries - History entries
   * @param {string|Object} timeRange - Time range specification
   * @returns {Array} Filtered entries
   */
  filterByTimeRange(entries, timeRange) {
    const now = new Date();

    let startDate,
      endDate = now;

    if (typeof timeRange === 'string') {
      switch (timeRange) {
        case 'today':
          startDate = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate()
          );
          break;
        case 'week':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'month':
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        default:
          return entries;
      }
    } else if (typeof timeRange === 'object') {
      startDate = timeRange.start ? new Date(timeRange.start) : null;
      endDate = timeRange.end ? new Date(timeRange.end) : now;
    } else {
      return entries;
    }

    return entries.filter((entry) => {
      const entryDate = new Date(entry.timestamp);
      return (!startDate || entryDate >= startDate) && entryDate <= endDate;
    });
  }

  /**
   * Check if command matches search query
   * @param {string} command - Command to check
   * @param {string} query - Search query
   * @returns {boolean} Whether it matches
   */
  matchesQuery(command, query) {
    return this.calculateRelevanceScore(command, query) > 0;
  }

  /**
   * Check if entry matches deletion criteria
   * @param {Object} entry - History entry
   * @param {Object} criteria - Deletion criteria
   * @returns {boolean} Whether it matches
   */
  matchesCriteria(entry, criteria) {
    const { query, olderThan, command, sessionId } = criteria;

    if (query && !this.matchesQuery(entry.command, query)) return false;
    if (olderThan && new Date(entry.timestamp) >= new Date(olderThan))
      return false;
    if (command && entry.command !== command) return false;
    if (sessionId && entry.sessionId !== sessionId) return false;

    return true;
  }

  /**
   * Load history from file
   * @returns {Array} Loaded history entries
   */
  loadHistory() {
    try {
      if (fs.existsSync(this.historyFile)) {
        const data = fs.readFileSync(this.historyFile, 'utf8');
        const parsed = JSON.parse(data);
        return Array.isArray(parsed) ? parsed : parsed.history || [];
      }
    } catch (error) {
      logger.warn('Failed to load command history', { error: error.message });
    }
    return [];
  }

  /**
   * Save history to file
   */
  saveHistory() {
    try {
      // Ensure directory exists
      const dir = path.dirname(this.historyFile);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(
        this.historyFile,
        JSON.stringify(this.globalHistory, null, 2)
      );
      logger.debug('Command history saved', {
        file: this.historyFile,
        commands: this.globalHistory.length,
      });
    } catch (error) {
      logger.error('Failed to save command history', { error: error.message });
    }
  }

  /**
   * Clear all history
   */
  clearHistory() {
    this.globalHistory = [];
    this.sessionHistory = [];
    this.saveHistory();
    logger.info('Command history cleared');
  }

  /**
   * Get formatted display of history search results
   * @param {Array} results - Search results
   * @param {Object} options - Display options
   * @returns {string} Formatted results
   */
  formatResults(results, options = {}) {
    const {
      showTimestamps = true,
      showScores = false,
      maxLength = 80,
    } = options;

    if (results.length === 0) {
      return '❌ No matching commands found.';
    }

    let output = `📚 Found ${results.length} command(s):\n\n`;

    results.forEach((result, index) => {
      const truncatedCommand =
        result.command.length > maxLength
          ? result.command.substring(0, maxLength - 3) + '...'
          : result.command;

      output += `${index + 1}. ${truncatedCommand}`;

      if (showTimestamps) {
        const date = new Date(result.timestamp);
        const timeStr = date.toLocaleString();
        output += ` (${timeStr})`;
      }

      if (showScores && result.relevanceScore) {
        output += ` [${result.relevanceScore}% match]`;
      }

      output += '\n';
    });

    return output;
  }

  /**
   * End current session and save final state
   */
  endSession() {
    this.saveHistory();
    logger.info('Command history session ended', {
      sessionId: this.currentSession.id,
      sessionCommands: this.sessionHistory.length,
      totalCommands: this.globalHistory.length,
    });
  }

  /**
   * Get system statistics
   * @returns {Object} System stats
   */
  getSystemStats() {
    const stats = this.getStatistics();
    const fileSize = fs.existsSync(this.historyFile)
      ? fs.statSync(this.historyFile).size
      : 0;

    return {
      ...stats,
      historyFileSize: fileSize,
      maxHistorySize: this.maxHistorySize,
      caseSensitive: this.caseSensitive,
      fuzzyMatch: this.fuzzyMatch,
      includeCommands: this.includeCommands,
      includeExits: this.includeExits,
      currentSessionId: this.currentSession.id,
      sessionStartTime: this.currentSession.startTime,
    };
  }
}
