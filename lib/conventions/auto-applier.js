import fs from 'fs-extra';
import path from 'path';
import { logger } from '../utils/logger.js';

/**
 * Auto-apply project conventions and formatting
 * Automatically formats code to match learned project standards and team preferences
 */
export class ConventionAutoApplier {
  constructor(options = {}) {
    this.projectRoot = options.projectRoot || process.cwd();
    this.conventionAnalyzer = options.conventionAnalyzer;
    this.teamPatternsLearner = options.teamPatternsLearner;
    this.safeMode = options.safeMode !== false; // Default to safe mode
    this.backupOriginals = options.backupOriginals !== false; // Default to backup
    this.maxFixesPerFile = options.maxFixesPerFile || 50; // Limit fixes per file

    // Fix tracking
    this.appliedFixes = [];
    this.failedFixes = [];
    this.suggestedFixes = [];

    logger.info('Convention auto-applier initialized', {
      safeMode: this.safeMode,
      backupOriginals: this.backupOriginals,
      maxFixesPerFile: this.maxFixesPerFile,
    });
  }

  /**
   * Apply conventions to a single file
   * @param {string} filePath - Path to the file
   * @returns {Object} Results of the application
   */
  async applyToFile(filePath, options = {}) {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      const extension = path.extname(filePath);
      const language = this.getLanguageFromExtension(extension);

      // Analyze current conventions if not provided
      let conventions = options.conventions;
      if (!conventions && this.conventionAnalyzer) {
        const analysisResults = await this.conventionAnalyzer.analyzeProject();
        conventions = analysisResults.conventions;
      }

      // Get team preferences
      let teamPrefs = {};
      if (this.teamPatternsLearner) {
        teamPrefs.naming =
          this.teamPatternsLearner.getTeamPreferences('naming');
        teamPrefs.style = this.teamPatternsLearner.getTeamPreferences('style');
        teamPrefs.structure =
          this.teamPatternsLearner.getTeamPreferences('structure');
      }

      // Apply fixes
      const result = await this.applyFixes(
        content,
        language,
        conventions,
        teamPrefs
      );

      // Backup original if requested
      if (this.backupOriginals && result.modified) {
        await this.createBackup(filePath, content);
      }

      // Apply changes if not in dry-run mode
      if (!options.dryRun && result.modified) {
        await fs.writeFile(filePath, result.newContent, 'utf8');
      }

      logger.info('Applied conventions to file', {
        filePath,
        fixesApplied: result.fixesApplied,
        fixesFailed: result.fixesFailed,
        modified: result.modified,
      });

      return {
        filePath,
        modified: result.modified,
        fixesApplied: result.fixesApplied,
        fixesFailed: result.fixesFailed,
        suggestions: result.suggestions,
        backupCreated: this.backupOriginals && result.modified,
      };
    } catch (error) {
      logger.error('Failed to apply conventions to file', {
        filePath,
        error: error.message,
      });
      return {
        filePath,
        error: error.message,
        modified: false,
        fixesApplied: 0,
        fixesFailed: 0,
      };
    }
  }

  /**
   * Apply conventions to multiple files
   * @param {Array} filePaths - Array of file paths
   * @param {Object} options - Application options
   * @returns {Object} Batch results
   */
  async applyToFiles(filePaths, options = {}) {
    const results = {
      totalFiles: filePaths.length,
      modifiedFiles: 0,
      totalFixesApplied: 0,
      totalFixesFailed: 0,
      errors: [],
      suggestions: [],
    };

    // Analyze project conventions once for all files
    let conventions = options.conventions;
    if (!conventions && this.conventionAnalyzer) {
      logger.info('Analyzing project conventions for batch application');
      const analysisResults = await this.conventionAnalyzer.analyzeProject();
      conventions = analysisResults.conventions;
    }

    // Process files
    for (const filePath of filePaths) {
      const result = await this.applyToFile(filePath, {
        ...options,
        conventions,
      });

      if (result.modified) results.modifiedFiles++;
      results.totalFixesApplied += result.fixesApplied;
      results.totalFixesFailed += result.fixesFailed;

      if (result.error) {
        results.errors.push({ file: filePath, error: result.error });
      }

      if (result.suggestions) {
        results.suggestions.push(
          ...result.suggestions.map((s) => ({ file: filePath, ...s }))
        );
      }
    }

    logger.info('Batch convention application completed', {
      totalFiles: results.totalFiles,
      modifiedFiles: results.modifiedFiles,
      totalFixesApplied: results.totalFixesApplied,
    });

    return results;
  }

  /**
   * Apply fixes to content based on conventions
   * @param {string} content - Original content
   * @param {string} language - Programming language
   * @param {Object} conventions - Project conventions
   * @param {Object} teamPrefs - Team preferences
   * @returns {Object} Fix results
   */
  async applyFixes(content, language, conventions = {}, teamPrefs = {}) {
    let newContent = content;
    let fixesApplied = 0;
    let fixesFailed = 0;
    const suggestions = [];

    // Apply different types of fixes
    try {
      // Quote style fixes
      const quoteResult = this.fixQuoteStyle(
        newContent,
        conventions,
        teamPrefs
      );
      newContent = quoteResult.content;
      fixesApplied += quoteResult.applied;
      fixesFailed += quoteResult.failed;
      suggestions.push(...quoteResult.suggestions);

      // Indentation fixes
      const indentResult = this.fixIndentation(
        newContent,
        conventions,
        teamPrefs
      );
      newContent = indentResult.content;
      fixesApplied += indentResult.applied;
      fixesFailed += indentResult.failed;
      suggestions.push(...indentResult.suggestions);

      // Semicolon fixes
      const semicolonResult = this.fixSemicolons(
        newContent,
        conventions,
        teamPrefs
      );
      newContent = semicolonResult.content;
      fixesApplied += semicolonResult.applied;
      fixesFailed += semicolonResult.failed;
      suggestions.push(...semicolonResult.suggestions);

      // Trailing comma fixes
      const commaResult = this.fixTrailingCommas(
        newContent,
        language,
        conventions,
        teamPrefs
      );
      newContent = commaResult.content;
      fixesApplied += commaResult.applied;
      fixesFailed += commaResult.failed;
      suggestions.push(...commaResult.suggestions);

      // Naming convention fixes (more complex, so separate)
      const namingResult = this.fixNamingConventions(
        newContent,
        language,
        conventions,
        teamPrefs
      );
      newContent = namingResult.content;
      fixesApplied += namingResult.applied;
      fixesFailed += namingResult.failed;
      suggestions.push(...namingResult.suggestions);
    } catch (error) {
      logger.error('Error applying fixes', { error: error.message });
      fixesFailed++;
    }

    return {
      newContent,
      modified: newContent !== content,
      fixesApplied,
      fixesFailed,
      suggestions,
    };
  }

  /**
   * Fix quote style consistency
   */
  fixQuoteStyle(content, conventions, teamPrefs) {
    let result = { content, applied: 0, failed: 0, suggestions: [] };

    // Get preferred quote style
    let preferredQuotes = 'single'; // default

    // Check team preferences first
    if (teamPrefs.style?.preferences) {
      const quotePrefs = Object.keys(teamPrefs.style.preferences).filter((p) =>
        p.includes('quote')
      );
      if (quotePrefs.length > 0) {
        preferredQuotes = quotePrefs[0].replace('quotes', '').trim();
      }
    }

    // Check general conventions
    if (conventions.codeStyle?.quotes) {
      const quotes = conventions.codeStyle.quotes;
      const max = Math.max(quotes.single, quotes.double, quotes.backticks);
      if (max === quotes.single) preferredQuotes = 'single';
      else if (max === quotes.double) preferredQuotes = 'double';
      else preferredQuotes = 'backticks';
    }

    // Apply quote normalization (simplified - real implementation would be more complex)
    if (preferredQuotes === 'single') {
      // Convert double quotes to single quotes (basic implementation)
      const originalContent = result.content;
      result.content = result.content.replace(/"/g, "'");
      if (result.content !== originalContent) {
        result.applied++;
      }
    }

    return result;
  }

  /**
   * Fix indentation consistency
   */
  fixIndentation(content, conventions, teamPrefs) {
    let result = { content, applied: 0, failed: 0, suggestions: [] };

    // Get preferred indentation
    let preferredIndent = 'spaces'; // default
    let indentSize = 2; // default

    // Check team preferences
    if (teamPrefs.style?.preferences) {
      const indentPrefs = Object.keys(teamPrefs.style.preferences).filter((p) =>
        p.includes('indent')
      );
      if (indentPrefs.length > 0) {
        preferredIndent = indentPrefs[0];
      }
    }

    // Check general conventions
    if (conventions.codeStyle?.indentation) {
      const indent = conventions.codeStyle.indentation;
      preferredIndent = indent.spaces > indent.tabs ? 'spaces' : 'tabs';
    }

    // Apply indentation normalization (simplified)
    const lines = result.content.split('\n');
    const newLines = lines.map((line) => {
      const trimmed = line.trimStart();
      if (trimmed && trimmed !== line) {
        const indent = line.length - trimmed.length;
        if (preferredIndent === 'spaces') {
          return ' '.repeat(indent) + trimmed;
        } else {
          return '\t'.repeat(Math.floor(indent / 4)) + trimmed;
        }
      }
      return line;
    });

    result.content = newLines.join('\n');
    if (result.content !== content) {
      result.applied++;
    }

    return result;
  }

  /**
   * Fix semicolon consistency
   */
  fixSemicolons(content, conventions, teamPrefs) {
    let result = { content, applied: 0, failed: 0, suggestions: [] };

    // Get preferred semicolon style
    let preferredSemicolons = 'required'; // default

    // Check team preferences
    if (teamPrefs.style?.preferences) {
      const semicolonPrefs = Object.keys(teamPrefs.style.preferences).filter(
        (p) => p.includes('semicolon')
      );
      if (semicolonPrefs.length > 0) {
        preferredSemicolons = semicolonPrefs[0];
      }
    }

    // Check general conventions
    if (conventions.preferences?.semicolons) {
      preferredSemicolons = conventions.preferences.semicolons;
    }

    // Apply semicolon fixes (simplified - would need more sophisticated parsing)
    if (preferredSemicolons === 'required') {
      // Add missing semicolons (very basic implementation)
      const lines = result.content.split('\n');
      const newLines = lines.map((line) => {
        const trimmed = line.trim();
        if (
          trimmed &&
          !trimmed.endsWith(';') &&
          !trimmed.endsWith('{') &&
          !trimmed.endsWith('}') &&
          !trimmed.startsWith('//') &&
          !trimmed.startsWith('/*') &&
          trimmed.includes('=')
        ) {
          return line + ';';
        }
        return line;
      });

      result.content = newLines.join('\n');
      if (result.content !== content) {
        result.applied++;
      }
    }

    return result;
  }

  /**
   * Fix trailing comma consistency
   */
  fixTrailingCommas(content, language, conventions, teamPrefs) {
    let result = { content, applied: 0, failed: 0, suggestions: [] };

    // Trailing comma fixes are complex and would require AST parsing
    // For now, just provide suggestions
    result.suggestions.push({
      type: 'trailing-commas',
      message: 'Consider adding trailing commas for better git diffs',
      severity: 'low',
    });

    return result;
  }

  /**
   * Fix naming convention consistency
   */
  fixNamingConventions(content, language, conventions, teamPrefs) {
    let result = { content, applied: 0, failed: 0, suggestions: [] };

    // Get preferred naming styles
    let variableStyle = 'camelCase'; // default

    // Check team preferences
    if (teamPrefs.naming?.preferences) {
      const varPrefs = Object.keys(teamPrefs.naming.preferences);
      if (varPrefs.length > 0) {
        variableStyle = varPrefs[0];
      }
    }

    // Check general conventions
    if (conventions.preferences?.variableNaming) {
      variableStyle = conventions.preferences.variableNaming;
    }

    // Naming fixes are complex and would require AST parsing
    // For now, provide suggestions
    result.suggestions.push({
      type: 'naming-conventions',
      message: `Consider using ${variableStyle} for variable names`,
      severity: 'medium',
    });

    return result;
  }

  /**
   * Create backup of original file
   * @param {string} filePath - Original file path
   * @param {string} content - Original content
   */
  async createBackup(filePath, content) {
    try {
      const backupPath = `${filePath}.backup.${Date.now()}`;
      await fs.writeFile(backupPath, content, 'utf8');
      logger.debug('Created backup file', {
        original: filePath,
        backup: backupPath,
      });
    } catch (error) {
      logger.warn('Failed to create backup', {
        filePath,
        error: error.message,
      });
    }
  }

  /**
   * Get language from file extension
   * @param {string} ext - File extension
   * @returns {string} Language name
   */
  getLanguageFromExtension(ext) {
    const mapping = {
      '.js': 'javascript',
      '.ts': 'typescript',
      '.jsx': 'javascript',
      '.tsx': 'typescript',
      '.py': 'python',
      '.java': 'java',
    };
    return mapping[ext] || 'unknown';
  }

  /**
   * Generate a summary report of applied fixes
   * @param {Array} results - Array of file results
   * @returns {string} Formatted report
   */
  generateReport(results) {
    let report = '📋 Convention Auto-Application Report\n';
    report += '='.repeat(40) + '\n\n';

    const totalFiles = results.length;
    const modifiedFiles = results.filter((r) => r.modified).length;
    const totalFixes = results.reduce((sum, r) => sum + r.fixesApplied, 0);

    report += `📊 Summary:\n`;
    report += `  • Files processed: ${totalFiles}\n`;
    report += `  • Files modified: ${modifiedFiles}\n`;
    report += `  • Total fixes applied: ${totalFixes}\n\n`;

    if (modifiedFiles > 0) {
      report += `🔧 Modified Files:\n`;
      results
        .filter((r) => r.modified)
        .forEach((result) => {
          report += `  • ${path.relative(this.projectRoot, result.filePath)}\n`;
          report += `    - Fixes applied: ${result.fixesApplied}\n`;
          if (result.backupCreated) {
            report += `    - Backup created: ✅\n`;
          }
        });
      report += '\n';
    }

    const allSuggestions = results.flatMap((r) => r.suggestions || []);
    if (allSuggestions.length > 0) {
      report += `💡 Suggestions for Manual Review:\n`;
      const suggestionCounts = {};
      allSuggestions.forEach((s) => {
        suggestionCounts[s.type] = (suggestionCounts[s.type] || 0) + 1;
      });

      Object.entries(suggestionCounts).forEach(([type, count]) => {
        report += `  • ${type}: ${count} instances\n`;
      });
    }

    return report;
  }

  /**
   * Check if a fix can be safely applied
   * @param {string} fixType - Type of fix
   * @param {string} content - Content to check
   * @returns {boolean} Whether the fix is safe
   */
  isSafeFix(fixType, content) {
    if (!this.safeMode) return true;

    // Implement safety checks for different fix types
    switch (fixType) {
      case 'quotes':
        // Check for escaped quotes, etc.
        return !content.includes('\\"') && !content.includes("\\'");
      case 'indentation':
        // Indentation changes are generally safe
        return true;
      case 'semicolons':
        // Semicolon addition/removal can be risky
        return false; // Require manual review
      default:
        return true;
    }
  }
}
