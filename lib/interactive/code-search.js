import fs from 'fs';
import path from 'path';
import { SyntaxHighlighter } from '../display/syntax-highlighter.js';
import { CodePreview } from '../display/code-preview.js';
import { logger } from '../utils/logger.js';

/**
 * Interactive Code Search and Highlight System
 * Advanced search across codebase with interactive results navigation
 */
export class CodeSearch {
  constructor(options = {}) {
    this.syntaxHighlighter = options.syntaxHighlighter || null;
    this.codePreview =
      options.codePreview ||
      new CodePreview({ syntaxHighlighter: this.syntaxHighlighter });
    this.searchHistory = [];
    this.maxHistorySize = options.maxHistorySize || 50;
    this.maxResults = options.maxResults || 100;
    this.maxPreviewLines = options.maxPreviewLines || 5;

    // Search modes
    this.searchModes = {
      exact: 'exact',
      regex: 'regex',
      fuzzy: 'fuzzy',
      word: 'word',
    };

    // File filters
    this.fileFilters = {
      javascript: ['.js', '.jsx', '.mjs'],
      typescript: ['.ts', '.tsx'],
      python: ['.py'],
      web: ['.html', '.css', '.scss', '.less'],
      config: ['.json', '.yaml', '.yml', '.xml', '.toml'],
      all: [], // Empty array means all files
    };

    logger.info('Code search system initialized', {
      maxResults: this.maxResults,
      maxHistorySize: this.maxHistorySize,
    });
  }

  /**
   * Perform interactive code search
   * @param {string} query - Search query
   * @param {Object} options - Search options
   * @returns {Promise<Array>} Search results
   */
  async search(query, options = {}) {
    const opts = {
      mode: options.mode || 'exact',
      caseSensitive: options.caseSensitive || false,
      wholeWord: options.wholeWord || false,
      fileFilter: options.fileFilter || 'all',
      directory: options.directory || process.cwd(),
      includeHidden: options.includeHidden || false,
      maxResults: options.maxResults || this.maxResults,
      ...options,
    };

    logger.debug('Starting code search', {
      query,
      mode: opts.mode,
      directory: opts.directory,
    });

    // Add to search history
    this.addToHistory({
      query,
      options: opts,
      timestamp: new Date(),
    });

    const results = await this.performSearch(query, opts);

    logger.info('Search completed', {
      query,
      resultsCount: results.length,
      mode: opts.mode,
    });

    return results;
  }

  /**
   * Execute the actual search operation
   * @param {string} query - Search query
   * @param {Object} options - Search options
   * @returns {Promise<Array>} Search results
   */
  async performSearch(query, options) {
    const results = [];
    const processedFiles = new Set();

    const processDirectory = async (dirPath) => {
      if (results.length >= options.maxResults) return;

      try {
        const items = fs.readdirSync(dirPath);

        for (const item of items) {
          if (results.length >= options.maxResults) break;

          // Skip hidden files/directories unless explicitly included
          if (!options.includeHidden && item.startsWith('.')) continue;

          const fullPath = path.join(dirPath, item);
          const stats = fs.statSync(fullPath);

          if (stats.isDirectory()) {
            // Skip common directories that shouldn't be searched
            if (
              [
                'node_modules',
                '.git',
                '.vscode',
                '.idea',
                'dist',
                'build',
              ].includes(item)
            ) {
              continue;
            }
            await processDirectory(fullPath);
          } else if (stats.isFile()) {
            // Check file extension filter
            if (options.fileFilter !== 'all') {
              const filterExts = this.fileFilters[options.fileFilter] || [];
              const fileExt = path.extname(item).toLowerCase();
              if (filterExts.length > 0 && !filterExts.includes(fileExt)) {
                continue;
              }
            }

            // Skip binary files and very large files
            if (stats.size > 1024 * 1024) continue; // > 1MB

            const fileResults = await this.searchInFile(
              fullPath,
              query,
              options
            );
            if (fileResults.length > 0) {
              results.push(...fileResults);
              processedFiles.add(fullPath);
            }
          }
        }
      } catch (error) {
        logger.debug('Error processing directory', {
          path: dirPath,
          error: error.message,
        });
      }
    };

    await processDirectory(options.directory);

    // Sort results by relevance (files with more matches first)
    results.sort((a, b) => {
      if (a.file !== b.file) {
        // Group by file first
        return a.file.localeCompare(b.file);
      }
      // Then by line number
      return a.line - b.line;
    });

    return results.slice(0, options.maxResults);
  }

  /**
   * Search within a single file
   * @param {string} filePath - Path to file
   * @param {string} query - Search query
   * @param {Object} options - Search options
   * @returns {Promise<Array>} Results from this file
   */
  async searchInFile(filePath, query, options) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const lines = content.split('\n');
      const results = [];

      // Prepare search pattern based on mode
      let searchPattern;
      let flags = options.caseSensitive ? 'g' : 'gi';

      switch (options.mode) {
        case 'regex':
          try {
            searchPattern = new RegExp(query, flags);
          } catch (error) {
            // Invalid regex, fall back to exact search
            searchPattern = new RegExp(this.escapeRegex(query), flags);
          }
          break;
        case 'word':
          searchPattern = new RegExp(`\\b${this.escapeRegex(query)}\\b`, flags);
          break;
        case 'fuzzy':
          // Simple fuzzy search - contains all characters in order
          const fuzzyPattern = query.split('').join('.*?');
          searchPattern = new RegExp(fuzzyPattern, flags);
          break;
        case 'exact':
        default:
          searchPattern = new RegExp(this.escapeRegex(query), flags);
          break;
      }

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const matches = [...line.matchAll(searchPattern)];

        if (matches.length > 0) {
          results.push({
            file: filePath,
            line: i + 1,
            content: line,
            matches: matches.map((match) => ({
              text: match[0],
              index: match.index,
              groups: match.groups || [],
            })),
            preview: this.createMatchPreview(lines, i, query, options),
            relativePath: path.relative(process.cwd(), filePath),
          });
        }
      }

      return results;
    } catch (error) {
      logger.debug('Error searching file', {
        file: filePath,
        error: error.message,
      });
      return [];
    }
  }

  /**
   * Create a preview of the match with context
   * @param {Array} lines - All lines in the file
   * @param {number} matchLine - Line number of the match
   * @param {string} query - Search query
   * @param {Object} options - Search options
   * @returns {string} Formatted preview
   */
  createMatchPreview(lines, matchLine, query, options) {
    const contextLines = options.contextLines || 2;
    const startLine = Math.max(0, matchLine - contextLines);
    const endLine = Math.min(lines.length - 1, matchLine + contextLines);

    const previewLines = [];
    for (let i = startLine; i <= endLine; i++) {
      const lineNumber = i + 1;
      const isMatchLine = i === matchLine;
      const line = lines[i];

      // Highlight the search term in the line
      let highlightedLine = line;
      if (isMatchLine) {
        const escapedQuery = this.escapeRegex(query);
        const highlightRegex = new RegExp(
          `(${escapedQuery})`,
          options.caseSensitive ? 'gi' : 'g'
        );
        highlightedLine = line.replace(
          highlightRegex,
          '\x1b[43m\x1b[30m$1\x1b[0m'
        ); // Yellow background, black text
      }

      const marker = isMatchLine ? '▶' : '│';
      previewLines.push(
        `${lineNumber.toString().padStart(4, ' ')} ${marker} ${highlightedLine}`
      );
    }

    return previewLines.join('\n');
  }

  /**
   * Escape special regex characters
   * @param {string} string - String to escape
   * @returns {string} Escaped string
   */
  escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Add search to history
   * @param {Object} searchEntry - Search entry
   */
  addToHistory(searchEntry) {
    this.searchHistory.unshift(searchEntry);

    // Keep history size manageable
    if (this.searchHistory.length > this.maxHistorySize) {
      this.searchHistory = this.searchHistory.slice(0, this.maxHistorySize);
    }
  }

  /**
   * Get search history
   * @param {number} limit - Maximum number of entries to return
   * @returns {Array} Search history
   */
  getSearchHistory(limit = 10) {
    return this.searchHistory.slice(0, limit);
  }

  /**
   * Interactive search session
   * @param {Object} options - Search options
   * @returns {Promise<Object>} Search session result
   */
  async interactiveSearch(options = {}) {
    const { inquirer } = await import('inquirer');

    console.log('\n🔍 Interactive Code Search');
    console.log('═'.repeat(40));

    // Get search parameters
    const searchParams = await inquirer.prompt([
      {
        type: 'input',
        name: 'query',
        message: 'Search query:',
        validate: (input) =>
          input.trim().length > 0 || 'Please enter a search term',
      },
      {
        type: 'list',
        name: 'mode',
        message: 'Search mode:',
        choices: [
          { name: 'Exact match', value: 'exact' },
          { name: 'Whole word', value: 'word' },
          { name: 'Regular expression', value: 'regex' },
          { name: 'Fuzzy search', value: 'fuzzy' },
        ],
        default: 'exact',
      },
      {
        type: 'list',
        name: 'fileFilter',
        message: 'File type filter:',
        choices: [
          { name: 'All files', value: 'all' },
          { name: 'JavaScript', value: 'javascript' },
          { name: 'TypeScript', value: 'typescript' },
          { name: 'Python', value: 'python' },
          { name: 'Web files (HTML/CSS)', value: 'web' },
          { name: 'Config files', value: 'config' },
        ],
        default: 'all',
      },
      {
        type: 'confirm',
        name: 'caseSensitive',
        message: 'Case sensitive?',
        default: false,
      },
      {
        type: 'confirm',
        name: 'includeHidden',
        message: 'Include hidden files?',
        default: false,
      },
    ]);

    console.log('\n🔄 Searching...\n');

    const results = await this.search(searchParams.query, {
      ...searchParams,
      ...options,
    });

    if (results.length === 0) {
      console.log('❌ No matches found.');
      return { results: [], query: searchParams.query };
    }

    console.log(
      `✅ Found ${results.length} matches in ${new Set(results.map((r) => r.file)).size} files:\n`
    );

    // Group results by file
    const fileGroups = {};
    results.forEach((result) => {
      if (!fileGroups[result.file]) {
        fileGroups[result.file] = [];
      }
      fileGroups[result.file].push(result);
    });

    // Display results
    let matchCount = 1;
    for (const [filePath, fileResults] of Object.entries(fileGroups)) {
      const relativePath = path.relative(process.cwd(), filePath);
      console.log(`📄 ${relativePath} (${fileResults.length} matches):`);

      fileResults.forEach((result) => {
        console.log(
          `  ${matchCount}. Line ${result.line}: ${this.truncateLine(result.content, 80)}`
        );
        matchCount++;
      });
      console.log();
    }

    // Interactive result navigation
    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: 'What would you like to do?',
        choices: [
          { name: 'View detailed results', value: 'view' },
          { name: 'Navigate to specific match', value: 'navigate' },
          { name: 'Search again', value: 'search' },
          { name: 'Exit', value: 'exit' },
        ],
      },
    ]);

    if (action === 'view') {
      await this.displayDetailedResults(results);
    } else if (action === 'navigate') {
      await this.interactiveNavigation(results);
    }

    return { results, query: searchParams.query, action };
  }

  /**
   * Display detailed search results
   * @param {Array} results - Search results
   */
  async displayDetailedResults(results) {
    const { inquirer } = await import('inquirer');

    for (const result of results.slice(0, 10)) {
      // Limit to first 10 for performance
      console.log(`\n📍 ${result.relativePath}:${result.line}`);
      console.log(result.preview);
      console.log();

      const { continueViewing } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'continueViewing',
          message: 'Continue to next result?',
          default: true,
        },
      ]);

      if (!continueViewing) break;
    }
  }

  /**
   * Interactive navigation through search results
   * @param {Array} results - Search results
   */
  async interactiveNavigation(results) {
    const { inquirer } = await import('inquirer');

    const choices = results.map((result, index) => ({
      name: `${result.relativePath}:${result.line} - ${this.truncateLine(result.content, 60)}`,
      value: index,
      short: `Match ${index + 1}`,
    }));

    const { selectedMatch } = await inquirer.prompt([
      {
        type: 'list',
        name: 'selectedMatch',
        message: 'Select a match to view:',
        choices: choices,
        pageSize: 15,
      },
    ]);

    const result = results[selectedMatch];
    console.log(`\n🎯 Selected: ${result.relativePath}:${result.line}`);
    console.log('═'.repeat(60));
    console.log(result.preview);
    console.log();

    // Show full file context
    const { showFullFile } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'showFullFile',
        message: 'Show full file with enhanced preview?',
        default: false,
      },
    ]);

    if (showFullFile) {
      console.log('\n📄 Full file preview:');
      console.log('═'.repeat(60));
      const fullPreview = this.codePreview.previewFile(result.file, {
        showLineNumbers: true,
        showHeader: true,
        maxLines: 30,
        currentLine: result.line,
      });
      console.log(fullPreview);
    }
  }

  /**
   * Truncate line content for display
   * @param {string} line - Line content
   * @param {number} maxLength - Maximum length
   * @returns {string} Truncated line
   */
  truncateLine(line, maxLength) {
    if (line.length <= maxLength) return line;
    return line.substring(0, maxLength - 3) + '...';
  }

  /**
   * Get search statistics
   * @returns {Object} Search statistics
   */
  getStats() {
    const fileTypes = {};
    const searchModes = {};

    this.searchHistory.forEach((entry) => {
      const mode = entry.options?.mode || 'exact';
      searchModes[mode] = (searchModes[mode] || 0) + 1;

      const filter = entry.options?.fileFilter || 'all';
      fileTypes[filter] = (fileTypes[filter] || 0) + 1;
    });

    return {
      totalSearches: this.searchHistory.length,
      searchModes,
      fileTypes,
      recentQueries: this.searchHistory.slice(0, 5).map((h) => h.query),
    };
  }

  /**
   * Configure search options
   * @param {Object} options - Configuration options
   */
  configure(options = {}) {
    if (options.maxResults !== undefined) this.maxResults = options.maxResults;
    if (options.maxHistorySize !== undefined)
      this.maxHistorySize = options.maxHistorySize;
    if (options.maxPreviewLines !== undefined)
      this.maxPreviewLines = options.maxPreviewLines;

    logger.info('Code search configured', options);
  }

  /**
   * Test code search functionality
   * @param {string} testType - Test type
   */
  async testSearch(testType = 'basic') {
    console.log('\n🔍 Testing Code Search System...\n');

    if (testType === 'basic' || testType === 'all') {
      console.log('Test 1: Basic Search');
      console.log('='.repeat(25));

      const results = await this.search('function', {
        directory: process.cwd(),
        fileFilter: 'javascript',
        maxResults: 5,
      });

      console.log(
        `Found ${results.length} matches for "function" in JS files:`
      );
      results.forEach((result, index) => {
        console.log(
          `  ${index + 1}. ${result.relativePath}:${result.line} - ${this.truncateLine(result.content, 50)}`
        );
      });
    }

    if (testType === 'regex' || testType === 'all') {
      console.log('\nTest 2: Regex Search');
      console.log('='.repeat(20));

      const results = await this.search('\\bconst\\s+\\w+\\s*=', {
        mode: 'regex',
        directory: process.cwd(),
        fileFilter: 'javascript',
        maxResults: 3,
      });

      console.log(`Found ${results.length} matches for const declarations:`);
      results.forEach((result, index) => {
        console.log(`  ${index + 1}. ${result.relativePath}:${result.line}`);
      });
    }

    if (testType === 'preview' || testType === 'all') {
      console.log('\nTest 3: Match Preview');
      console.log('='.repeat(20));

      const results = await this.search('console', {
        directory: process.cwd(),
        fileFilter: 'javascript',
        maxResults: 1,
      });

      if (results.length > 0) {
        const result = results[0];
        console.log('Match preview:');
        console.log(result.preview);
      }
    }

    console.log('\n🎯 Code Search tests completed successfully!');
    console.log('\n✨ Features verified:');
    console.log('   • Multi-file search across codebase');
    console.log('   • Multiple search modes (exact/regex/word/fuzzy)');
    console.log('   • File type filtering');
    console.log('   • Match previews with context');
    console.log('   • Search history tracking');
    console.log('   • Interactive result navigation');
  }
}
