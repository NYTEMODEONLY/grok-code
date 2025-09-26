/**
 * Fix Templates for Common Coding Errors
 * Provides automated fix generation for classified errors
 */
export class FixTemplates {
  constructor() {
    // Fix templates organized by error type
    this.templates = {
      // Syntax Error Fixes
      syntax: {
        missing_semicolon: {
          pattern: /missing semicolon/i,
          fix: (error, content, context) =>
            this.fixMissingSemicolon(error, content, context),
          confidence: 0.9,
          autoFixable: true,
        },
        unexpected_token: {
          pattern: /unexpected token/i,
          fix: (error, content, context) =>
            this.fixUnexpectedToken(error, content, context),
          confidence: 0.7,
          autoFixable: false, // Usually needs manual intervention
        },
        missing_bracket: {
          pattern: /missing.*bracket|unclosed.*bracket/i,
          fix: (error, content, context) =>
            this.fixMissingBracket(error, content, context),
          confidence: 0.8,
          autoFixable: true,
        },
      },

      // Type Error Fixes
      type: {
        cannot_find_name: {
          pattern: /cannot find name/i,
          fix: (error, content, context) =>
            this.fixCannotFindName(error, content, context),
          confidence: 0.6,
          autoFixable: false, // Usually needs import or declaration
        },
        property_not_exist: {
          pattern: /property.*does not exist/i,
          fix: (error, content, context) =>
            this.fixPropertyNotExist(error, content, context),
          confidence: 0.5,
          autoFixable: false,
        },
        type_not_assignable: {
          pattern: /type.*is not assignable/i,
          fix: (error, content, context) =>
            this.fixTypeNotAssignable(error, content, context),
          confidence: 0.4,
          autoFixable: false,
        },
      },

      // Import/Module Error Fixes
      import: {
        cannot_find_module: {
          pattern: /cannot find module/i,
          fix: (error, content, context) =>
            this.fixCannotFindModule(error, content, context),
          confidence: 0.8,
          autoFixable: true,
        },
        missing_import: {
          pattern: /missing import/i,
          fix: (error, content, context) =>
            this.fixMissingImport(error, content, context),
          confidence: 0.7,
          autoFixable: true,
        },
      },

      // Unused Code Fixes
      unused: {
        unused_variable: {
          pattern: /is defined but never used|unused variable/i,
          fix: (error, content, context) =>
            this.fixUnusedVariable(error, content, context),
          confidence: 0.9,
          autoFixable: true,
        },
        unused_import: {
          pattern: /unused import/i,
          fix: (error, content, context) =>
            this.fixUnusedImport(error, content, context),
          confidence: 0.9,
          autoFixable: true,
        },
        unreachable_code: {
          pattern: /unreachable code/i,
          fix: (error, content, context) =>
            this.fixUnreachableCode(error, content, context),
          confidence: 0.8,
          autoFixable: true,
        },
      },

      // Scope Error Fixes
      scope: {
        not_defined: {
          pattern: /is not defined/i,
          fix: (error, content, context) =>
            this.fixNotDefined(error, content, context),
          confidence: 0.5,
          autoFixable: false,
        },
        reference_error: {
          pattern: /reference error/i,
          fix: (error, content, context) =>
            this.fixReferenceError(error, content, context),
          confidence: 0.4,
          autoFixable: false,
        },
      },

      // Style/Linting Fixes
      style: {
        missing_quotes: {
          pattern: /quotes|quotation/i,
          fix: (error, content, context) =>
            this.fixQuotes(error, content, context),
          confidence: 0.9,
          autoFixable: true,
        },
        indentation: {
          pattern: /indentation|indent/i,
          fix: (error, content, context) =>
            this.fixIndentation(error, content, context),
          confidence: 0.8,
          autoFixable: true,
        },
        trailing_spaces: {
          pattern: /trailing|whitespace/i,
          fix: (error, content, context) =>
            this.fixTrailingSpaces(error, content, context),
          confidence: 0.95,
          autoFixable: true,
        },
        no_console: {
          pattern: /unexpected console|console statement|Unexpected console/i,
          fix: (error, content, context) =>
            this.fixConsoleStatement(error, content, context),
          confidence: 0.9,
          autoFixable: true,
        },
        no_debugger: {
          pattern: /unexpected debugger/i,
          fix: (error, content, context) =>
            this.fixDebuggerStatement(error, content, context),
          confidence: 0.9,
          autoFixable: true,
        },
      },

      // React-specific Fixes
      react: {
        missing_key: {
          pattern: /missing key/i,
          fix: (error, content, context) =>
            this.fixMissingKey(error, content, context),
          confidence: 0.8,
          autoFixable: true,
        },
        jsx_syntax: {
          pattern: /jsx/i,
          fix: (error, content, context) =>
            this.fixJsxSyntax(error, content, context),
          confidence: 0.6,
          autoFixable: false,
        },
      },
    };

    this.fixStats = {
      totalFixes: 0,
      successfulFixes: 0,
      failedFixes: 0,
      autoFixableErrors: 0,
    };
  }

  /**
   * Generate fix for a classified error
   * @param {Object} error - Classified error object
   * @param {string} fileContent - Original file content
   * @param {Object} context - Additional context (optional)
   * @returns {Object} Fix result
   */
  generateFix(error, fileContent, context = {}) {
    const errorType = error.type;
    const templates = this.templates[errorType];

    if (!templates) {
      return {
        success: false,
        reason: `No fix templates available for error type: ${errorType}`,
        fixType: null,
      };
    }

    // Find matching template
    let matchedTemplate = null;
    let bestConfidence = 0;

    for (const [templateName, template] of Object.entries(templates)) {
      if (template.pattern.test(error.message)) {
        if (template.confidence > bestConfidence) {
          bestConfidence = template.confidence;
          matchedTemplate = { name: templateName, ...template };
        }
      }
    }

    if (!matchedTemplate) {
      return {
        success: false,
        reason: `No matching fix template found for error message: ${error.message}`,
        fixType: null,
      };
    }

    // Attempt to generate fix
    try {
      // Debug: Check if method exists
      if (typeof matchedTemplate.fix !== 'function') {
        return {
          success: false,
          reason: `Fix method ${matchedTemplate.name} is not a function`,
          fixType: matchedTemplate.name,
        };
      }

      const fixResult = matchedTemplate.fix(error, fileContent, context);

      if (fixResult.success) {
        this.fixStats.successfulFixes++;
        return {
          success: true,
          fixType: matchedTemplate.name,
          confidence: matchedTemplate.confidence,
          autoFixable: matchedTemplate.autoFixable,
          fix: fixResult.fix,
          description: fixResult.description,
          changes: fixResult.changes,
        };
      } else {
        this.fixStats.failedFixes++;
        return {
          success: false,
          reason: fixResult.reason || 'Fix generation failed',
          fixType: matchedTemplate.name,
          confidence: matchedTemplate.confidence,
        };
      }
    } catch (error) {
      this.fixStats.failedFixes++;
      return {
        success: false,
        reason: `Fix generation error: ${error.message}`,
        fixType: matchedTemplate.name,
        confidence: matchedTemplate.confidence,
      };
    }
  }

  // ===== SYNTAX ERROR FIXES =====

  fixMissingSemicolon(error, fileContent) {
    const lines = fileContent.split('\n');
    const lineIndex = error.line - 1; // Convert to 0-based

    if (lineIndex >= 0 && lineIndex < lines.length) {
      let line = lines[lineIndex];

      // Remove trailing whitespace for checking
      const trimmedLine = line.trim();

      // Only add semicolon if line doesn't already end with one
      // and it's not a comment, brace, or already has punctuation
      if (
        !trimmedLine.endsWith(';') &&
        !trimmedLine.endsWith(',') &&
        !trimmedLine.endsWith('{') &&
        !trimmedLine.endsWith('}') &&
        !trimmedLine.startsWith('//') &&
        !trimmedLine.startsWith('/*') &&
        !trimmedLine.includes('return ') &&
        !trimmedLine.includes('throw ') &&
        !trimmedLine.includes('break') &&
        !trimmedLine.includes('continue') &&
        trimmedLine.length > 0
      ) {
        // Add semicolon to the end of the original line (preserving whitespace)
        lines[lineIndex] = line + ';';
        const newContent = lines.join('\n');

        return {
          success: true,
          fix: newContent,
          description: 'Added missing semicolon',
          changes: [
            {
              type: 'insert',
              line: error.line,
              column: line.length,
              text: ';',
            },
          ],
        };
      }
    }

    return {
      success: false,
      reason: 'Could not safely add semicolon',
    };
  }

  fixUnexpectedToken(error, fileContent) {
    // This is typically too complex for automatic fixing
    // Would need more sophisticated parsing
    return {
      success: false,
      reason: 'Unexpected token errors usually require manual review',
    };
  }

  fixMissingBracket(error, fileContent) {
    // Simple bracket matching - this is a basic implementation
    const lines = fileContent.split('\n');
    let openBraces = 0;
    let openParens = 0;
    let openBrackets = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      for (const char of line) {
        switch (char) {
          case '{':
            openBraces++;
            break;
          case '}':
            openBraces--;
            break;
          case '(':
            openParens++;
            break;
          case ')':
            openParens--;
            break;
          case '[':
            openBrackets++;
            break;
          case ']':
            openBrackets--;
            break;
        }
      }

      // If we find a line where braces go negative, we might be missing an opening brace
      if (openBraces < 0) {
        lines.splice(i, 0, '  {');
        return {
          success: true,
          fix: lines.join('\n'),
          description: 'Added missing opening brace',
          changes: [
            {
              type: 'insert',
              line: i + 1,
              column: 1,
              text: '  {',
            },
          ],
        };
      }
    }

    // Check for unclosed braces at end
    if (openBraces > 0) {
      lines.push('}');
      return {
        success: true,
        fix: lines.join('\n'),
        description: 'Added missing closing brace',
        changes: [
          {
            type: 'insert',
            line: lines.length,
            column: 1,
            text: '}',
          },
        ],
      };
    }

    return {
      success: false,
      reason: 'Could not determine bracket issue location',
    };
  }

  // ===== TYPE ERROR FIXES =====

  fixCannotFindName(error, fileContent) {
    // Extract the missing name from the error
    const nameMatch = error.message.match(/cannot find name ['"](.+?)['"]/i);
    if (!nameMatch) {
      return { success: false, reason: 'Could not extract variable name' };
    }

    const missingName = nameMatch[1];

    // This is complex - would need to determine if it's a missing import,
    // variable declaration, or type. For now, suggest import.
    const lines = fileContent.split('\n');
    const importsSection = this.findImportsSection(lines);

    if (importsSection && importsSection.end >= 0) {
      // Suggest adding import (but don't auto-apply as it requires user choice)
      const suggestion = `import { ${missingName} } from './path-to-module';`;

      return {
        success: false, // Don't auto-apply import suggestions
        reason: 'Import suggestion generated',
        suggestion,
        description: `Consider adding import for '${missingName}'`,
      };
    }

    return {
      success: false,
      reason: 'Cannot automatically determine fix for missing name',
    };
  }

  fixPropertyNotExist(error, fileContent) {
    // This typically requires understanding the object's type
    // Suggest using optional chaining or type assertion
    return {
      success: false,
      reason: 'Property access issues usually require manual type checking',
    };
  }

  fixTypeNotAssignable(error, fileContent) {
    // Complex type casting - usually needs manual intervention
    return {
      success: false,
      reason: 'Type assignment issues require understanding of intended types',
    };
  }

  // ===== IMPORT ERROR FIXES =====

  fixCannotFindModule(error, fileContent) {
    const moduleMatch = error.message.match(
      /cannot find module ['"](.+?)['"]/i
    );
    if (!moduleMatch) {
      return { success: false, reason: 'Could not extract module name' };
    }

    const moduleName = moduleMatch[1];

    // Check if it's a relative import that needs extension
    if (moduleName.startsWith('./') || moduleName.startsWith('../')) {
      const fs = require('fs');
      const path = require('path');

      // Try adding .js extension
      const currentDir = path.dirname(error.file);
      const modulePath = path.resolve(currentDir, moduleName);

      if (fs.existsSync(modulePath + '.js')) {
        return {
          success: true,
          fix: fileContent.replace(
            new RegExp(`['"]${this.escapeRegExp(moduleName)}['"]`, 'g'),
            `'${moduleName}.js'`
          ),
          description: 'Added .js extension to import',
          changes: [
            {
              type: 'modify',
              description: `Changed '${moduleName}' to '${moduleName}.js'`,
            },
          ],
        };
      }
    }

    return {
      success: false,
      reason: 'Cannot automatically resolve module path',
    };
  }

  fixMissingImport(error, fileContent) {
    // This would require sophisticated analysis of what needs to be imported
    // For now, provide guidance
    return {
      success: false,
      reason:
        'Missing import detection requires understanding of available modules',
    };
  }

  // ===== UNUSED CODE FIXES =====

  fixUnusedVariable(error, fileContent) {
    // Extract variable name from different possible message formats
    let varName;
    const patterns = [
      /'(.+?)' is defined but never used/i,
      /"(.+?)" is defined but never used/i,
      /unused variable (.+?)$/i,
    ];

    for (const pattern of patterns) {
      const match = error.message.match(pattern);
      if (match) {
        varName = match[1];
        break;
      }
    }

    if (!varName) {
      return {
        success: false,
        reason: 'Could not extract variable name from error message',
      };
    }

    const lines = fileContent.split('\n');
    const lineIndex = error.line - 1; // Convert to 0-based

    // Check if the error line itself contains the variable declaration
    if (lineIndex >= 0 && lineIndex < lines.length) {
      const errorLine = lines[lineIndex];

      // Match variable and function declarations (basic patterns)
      const patterns = [
        new RegExp(`\\bconst\\s+${this.escapeRegExp(varName)}\\s*=[^;]*;?`),
        new RegExp(`\\blet\\s+${this.escapeRegExp(varName)}\\s*=[^;]*;?`),
        new RegExp(`\\bvar\\s+${this.escapeRegExp(varName)}\\s*=[^;]*;?`),
        new RegExp(`\\bconst\\s+${this.escapeRegExp(varName)}\\s*;`), // Just declaration
        new RegExp(`\\blet\\s+${this.escapeRegExp(varName)}\\s*;`), // Just declaration
        new RegExp(`\\bvar\\s+${this.escapeRegExp(varName)}\\s*;`), // Just declaration
        new RegExp(`\\bfunction\\s+${this.escapeRegExp(varName)}\\s*\\(`), // Function declaration
        new RegExp(
          `\\basync\\s+function\\s+${this.escapeRegExp(varName)}\\s*\\(`
        ), // Async function
      ];

      for (const pattern of patterns) {
        if (pattern.test(errorLine.trim())) {
          // Remove the entire line
          lines.splice(lineIndex, 1);
          return {
            success: true,
            fix: lines.join('\n'),
            description: `Removed unused variable '${varName}'`,
            changes: [
              {
                type: 'delete',
                line: error.line,
                text: errorLine,
              },
            ],
          };
        }
      }
    }

    // If not found on error line, search nearby lines (within 3 lines)
    const searchStart = Math.max(0, lineIndex - 3);
    const searchEnd = Math.min(lines.length, lineIndex + 3);

    for (let i = searchStart; i < searchEnd; i++) {
      const line = lines[i];

      const patterns = [
        new RegExp(`\\bconst\\s+${this.escapeRegExp(varName)}\\s*=[^;]*;?`),
        new RegExp(`\\blet\\s+${this.escapeRegExp(varName)}\\s*=[^;]*;?`),
        new RegExp(`\\bvar\\s+${this.escapeRegExp(varName)}\\s*=[^;]*;?`),
        new RegExp(`\\bconst\\s+${this.escapeRegExp(varName)}\\s*;`),
        new RegExp(`\\blet\\s+${this.escapeRegExp(varName)}\\s*;`),
        new RegExp(`\\bvar\\s+${this.escapeRegExp(varName)}\\s*;`),
        new RegExp(`\\bfunction\\s+${this.escapeRegExp(varName)}\\s*\\(`),
        new RegExp(
          `\\basync\\s+function\\s+${this.escapeRegExp(varName)}\\s*\\(`
        ),
      ];

      for (const pattern of patterns) {
        if (pattern.test(line.trim())) {
          lines.splice(i, 1);
          return {
            success: true,
            fix: lines.join('\n'),
            description: `Removed unused variable '${varName}'`,
            changes: [
              {
                type: 'delete',
                line: i + 1,
                text: line,
              },
            ],
          };
        }
      }
    }

    return {
      success: false,
      reason: `Could not locate unused variable '${varName}' declaration`,
    };
  }

  fixUnusedImport(error, fileContent) {
    const importMatch = error.message.match(
      /['"](.+?)['"] is imported but never used/i
    );
    if (!importMatch) {
      return { success: false, reason: 'Could not extract import name' };
    }

    const importName = importMatch[1];
    const lines = fileContent.split('\n');

    // Find and remove the unused import
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (
        line.includes(`import ${importName}`) ||
        line.includes(`, ${importName}`) ||
        line.includes(`{ ${importName}`)
      ) {
        // Remove the entire import line (simplified - real implementation would handle multi-import lines)
        lines.splice(i, 1);
        return {
          success: true,
          fix: lines.join('\n'),
          description: `Removed unused import '${importName}'`,
          changes: [
            {
              type: 'delete',
              line: i + 1,
              text: line,
            },
          ],
        };
      }
    }

    return {
      success: false,
      reason: 'Could not locate unused import',
    };
  }

  fixUnreachableCode(error, fileContent) {
    const lines = fileContent.split('\n');
    const startLine = error.line - 1;

    // Remove from the error line to the end of the block/function
    // This is a simplified implementation
    let endLine = startLine;
    let braceCount = 0;

    for (let i = startLine; i < lines.length; i++) {
      const line = lines[i];

      for (const char of line) {
        if (char === '{') braceCount++;
        if (char === '}') braceCount--;
      }

      if (braceCount <= 0 && line.trim() === '') {
        endLine = i;
        break;
      }

      if (
        line.includes('return') ||
        line.includes('throw') ||
        line.includes('break')
      ) {
        endLine = i + 1;
        break;
      }
    }

    if (endLine > startLine) {
      lines.splice(startLine, endLine - startLine);
      return {
        success: true,
        fix: lines.join('\n'),
        description: 'Removed unreachable code',
        changes: [
          {
            type: 'delete',
            startLine: error.line,
            endLine: endLine,
            text: 'unreachable code block',
          },
        ],
      };
    }

    return {
      success: false,
      reason: 'Could not safely identify unreachable code boundaries',
    };
  }

  // ===== STYLE FIXES =====

  fixQuotes(error, fileContent) {
    // This is complex - would need to know project quote preferences
    // For now, provide guidance
    return {
      success: false,
      reason: 'Quote style fixes require project configuration',
    };
  }

  fixIndentation(error, fileContent) {
    // Would need to know indentation preferences (spaces vs tabs, count)
    return {
      success: false,
      reason: 'Indentation fixes require style configuration',
    };
  }

  fixTrailingSpaces(error, fileContent) {
    const lines = fileContent.split('\n');
    let hasChanges = false;

    for (let i = 0; i < lines.length; i++) {
      const trimmed = lines[i].trimEnd();
      if (trimmed !== lines[i]) {
        lines[i] = trimmed;
        hasChanges = true;
      }
    }

    if (hasChanges) {
      return {
        success: true,
        fix: lines.join('\n'),
        description: 'Removed trailing whitespace',
        changes: [
          {
            type: 'cleanup',
            description: 'Removed trailing spaces from multiple lines',
          },
        ],
      };
    }

    return {
      success: false,
      reason: 'No trailing whitespace found',
    };
  }

  fixConsoleStatement(error, fileContent) {
    const lines = fileContent.split('\n');
    const lineIndex = error.line - 1;

    if (lineIndex >= 0 && lineIndex < lines.length) {
      const line = lines[lineIndex];

      // Comment out console statements instead of removing them
      if (line.includes('console.')) {
        lines[lineIndex] = '// ' + line;
        return {
          success: true,
          fix: lines.join('\n'),
          description: 'Commented out console statement',
          changes: [
            {
              type: 'modify',
              line: error.line,
              text: '// ' + line.trim(),
            },
          ],
        };
      }
    }

    return {
      success: false,
      reason: 'Could not locate console statement',
    };
  }

  fixDebuggerStatement(error, fileContent) {
    const lines = fileContent.split('\n');
    const lineIndex = error.line - 1;

    if (lineIndex >= 0 && lineIndex < lines.length) {
      const line = lines[lineIndex];

      if (line.includes('debugger')) {
        lines.splice(lineIndex, 1);
        return {
          success: true,
          fix: lines.join('\n'),
          description: 'Removed debugger statement',
          changes: [
            {
              type: 'delete',
              line: error.line,
              text: line.trim(),
            },
          ],
        };
      }
    }

    return {
      success: false,
      reason: 'Could not locate debugger statement',
    };
  }

  // ===== REACT FIXES =====

  fixMissingKey(error, fileContent) {
    // This is complex - would need JSX parsing
    return {
      success: false,
      reason: 'Missing key fixes require JSX AST parsing',
    };
  }

  fixJsxSyntax(error, fileContent) {
    return {
      success: false,
      reason: 'JSX syntax errors usually require manual intervention',
    };
  }

  // ===== UTILITY METHODS =====

  findImportsSection(lines) {
    let start = -1;
    let end = -1;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      if (line.startsWith('import ') && start === -1) {
        start = i;
      }

      if (
        start !== -1 &&
        !line.startsWith('import ') &&
        !line.startsWith('//') &&
        line !== ''
      ) {
        end = i;
        break;
      }
    }

    return { start, end };
  }

  escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Get fix statistics
   * @returns {Object} Statistics
   */
  getStatistics() {
    return {
      ...this.fixStats,
      successRate:
        this.fixStats.totalFixes > 0
          ? (
              (this.fixStats.successfulFixes / this.fixStats.totalFixes) *
              100
            ).toFixed(1)
          : 0,
    };
  }

  /**
   * Get available fix types
   * @returns {Array} Fix types
   */
  getAvailableFixTypes() {
    const types = [];
    for (const [errorType, templates] of Object.entries(this.templates)) {
      for (const templateName of Object.keys(templates)) {
        types.push(`${errorType}.${templateName}`);
      }
    }
    return types;
  }

  /**
   * Check if an error is auto-fixable
   * @param {Object} error - Classified error
   * @returns {boolean} Whether error can be auto-fixed
   */
  isAutoFixable(error) {
    const templates = this.templates[error.type];
    if (!templates) return false;

    for (const template of Object.values(templates)) {
      if (template.pattern.test(error.message)) {
        return template.autoFixable;
      }
    }

    return false;
  }

  /**
   * Reset fix statistics
   */
  resetStatistics() {
    this.fixStats = {
      totalFixes: 0,
      successfulFixes: 0,
      failedFixes: 0,
      autoFixableErrors: 0,
    };
  }
}

// Export singleton instance for global use
export const fixTemplates = new FixTemplates();
export default fixTemplates;
