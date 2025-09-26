import fs from 'fs';
import path from 'path';
import os from 'os';
import * as acorn from 'acorn';
import { parse as tsParse } from '@typescript-eslint/parser';
import { PythonShell } from 'python-shell';

/**
 * AST Parser for JavaScript/TypeScript Code Analysis
 * Provides semantic code understanding capabilities for Grok Code
 */
export class ASTParser {
  constructor() {
    this.cache = new Map(); // Cache parsed ASTs for performance
  }

  /**
   * Parse a JavaScript or TypeScript file and extract semantic information
   * @param {string} filePath - Path to the file to parse
   * @returns {Object} Parsed AST with extracted symbols
   */
  async parseFile(filePath) {
    try {
      if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`);
      }

      let fileContent = fs.readFileSync(filePath, 'utf8');
      const languageType = this.getLanguageType(filePath);

      // Remove shebang line if present (common in executables)
      if (fileContent.startsWith('#!')) {
        const lines = fileContent.split('\n');
        if (lines[0].startsWith('#!')) {
          lines.shift(); // Remove the shebang line
          fileContent = lines.join('\n');
        }
      }

      let ast, symbols;
      if (languageType === 'python') {
        const result = await this.parsePython(fileContent, filePath);
        ast = result.ast;
        symbols = result.symbols;
      } else {
        ast =
          languageType === 'typescript'
            ? this.parseTypeScript(fileContent, filePath)
            : this.parseJavaScript(fileContent);

        symbols = this.extractSymbols(ast, filePath, languageType);
      }

      return {
        filePath,
        language: languageType,
        ast,
        symbols,
        metadata: {
          size: fileContent.length,
          lines: fileContent.split('\n').length,
          lastModified: fs.statSync(filePath).mtime,
        },
      };
    } catch (error) {
      console.error(`Error parsing ${filePath}:`, error.message);
      throw error;
    }
  }

  /**
   * Parse JavaScript code using Acorn
   * @param {string} code - JavaScript code to parse
   * @returns {Object} AST
   */
  parseJavaScript(code) {
    return acorn.parse(code, {
      ecmaVersion: 2022,
      sourceType: 'module',
      allowImportExportEverywhere: true,
      allowReturnOutsideFunction: true,
    });
  }

  /**
   * Parse TypeScript code using TypeScript ESLint parser
   * @param {string} code - TypeScript code to parse
   * @param {string} filePath - File path for better error reporting
   * @returns {Object} AST
   */
  parseTypeScript(code, filePath) {
    return tsParse(code, {
      filePath,
      ecmaVersion: 2022,
      sourceType: 'module',
    });
  }

  /**
   * Parse Python code using Python's ast module via python-shell
   * @param {string} code - Python code to parse
   * @param {string} filePath - File path for context
   * @returns {Promise<Object>} Object with ast and symbols
   */
  async parsePython(code, _filePath) {
    return new Promise((resolve, reject) => {
      // Create a temporary Python script to parse the code
      const pythonScript = `
import ast
import json
import sys

def extract_symbols(node, symbols=None, lineno_offset=0):
    if symbols is None:
        symbols = {
            'functions': [],
            'classes': [],
            'variables': [],
            'imports': [],
            'exports': [],  # Python doesn't have explicit exports like JS
            'types': []
        }

    if isinstance(node, ast.FunctionDef):
        symbols['functions'].append({
            'name': node.name,
            'type': 'function',
            'location': {
                'start': node.lineno or 0,
                'end': getattr(node, 'end_lineno', node.lineno) or 0,
                'line': (node.lineno or 0) + lineno_offset
            },
            'params': [arg.arg for arg in node.args.args],
            'async': False,  # Python async is handled differently
            'generator': False
        })
    elif isinstance(node, ast.AsyncFunctionDef):
        symbols['functions'].append({
            'name': node.name,
            'type': 'asyncFunction',
            'location': {
                'start': node.lineno or 0,
                'end': getattr(node, 'end_lineno', node.lineno) or 0,
                'line': (node.lineno or 0) + lineno_offset
            },
            'params': [arg.arg for arg in node.args.args],
            'async': True,
            'generator': False
        })
    elif isinstance(node, ast.ClassDef):
        symbols['classes'].append({
            'name': node.name,
            'type': 'class',
            'location': {
                'start': node.lineno or 0,
                'end': getattr(node, 'end_lineno', node.lineno) or 0,
                'line': (node.lineno or 0) + lineno_offset
            },
            'superClass': [base.id for base in node.bases if hasattr(base, 'id')],
            'methods': []  # Will be populated when traversing class body
        })
    elif isinstance(node, ast.Import):
        for alias in node.names:
            symbols['imports'].append({
                'type': 'import',
                'source': alias.name,
                'specifiers': [{
                    'type': 'default',
                    'local': alias.asname or alias.name,
                    'imported': alias.name
                }],
                'location': {
                    'start': node.lineno or 0,
                    'end': node.lineno or 0,
                    'line': (node.lineno or 0) + lineno_offset
                }
            })
    elif isinstance(node, ast.ImportFrom):
        module_name = node.module or ''
        for alias in node.names:
            symbols['imports'].append({
                'type': 'importFrom',
                'source': module_name,
                'specifiers': [{
                    'type': 'named',
                    'local': alias.asname or alias.name,
                    'imported': alias.name
                }],
                'location': {
                    'start': node.lineno or 0,
                    'end': node.lineno or 0,
                    'line': (node.lineno or 0) + lineno_offset
                }
            })

    # Recursively traverse child nodes
    for child in ast.iter_child_nodes(node):
        extract_symbols(child, symbols, lineno_offset)

    return symbols

try:
    # Read code from stdin
    code = sys.stdin.read()

    # Parse the AST
    tree = ast.parse(code)

    # Extract symbols
    symbols = extract_symbols(tree)

    # Return result as JSON
    result = {
        'ast': {'type': 'Program', 'body': []},  # Simplified AST representation
        'symbols': symbols
    }

    print(json.dumps(result))

except SyntaxError as e:
    print(json.dumps({'error': f'SyntaxError: {e.msg} at line {e.lineno}'}))
except Exception as e:
    print(json.dumps({'error': str(e)}))
`;

      // Write the Python script to a temporary file
      const tempScriptPath = path.join(
        os.tmpdir(),
        `ast_parser_${Date.now()}.py`
      );
      fs.writeFileSync(tempScriptPath, pythonScript);

      const pyshell = new PythonShell(tempScriptPath, {
        mode: 'text',
        pythonPath: 'python3', // Use python3 if available, fallback to python
      });

      pyshell.send(code);

      pyshell.on('message', (message) => {
        try {
          const result = JSON.parse(message);
          if (result.error) {
            reject(new Error(result.error));
          } else {
            resolve(result);
          }
        } catch (error) {
          reject(new Error(`Failed to parse Python output: ${error.message}`));
        }
      });

      pyshell.on('error', (error) => {
        reject(new Error(`Python shell error: ${error.message}`));
      });

      pyshell.end((err) => {
        // Clean up temporary file
        try {
          if (fs.existsSync(tempScriptPath)) {
            fs.unlinkSync(tempScriptPath);
          }
        } catch (_cleanupError) {
          // Ignore cleanup errors
        }

        if (err) {
          reject(new Error(`Python execution failed: ${err.message}`));
        }
      });
    });
  }

  /**
   * Get language type based on file extension
   * @param {string} filePath - File path to check
   * @returns {string} Language type: 'javascript', 'typescript', 'python', or 'unknown'
   */
  getLanguageType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    if (['.ts', '.tsx'].includes(ext)) return 'typescript';
    if (ext === '.py') return 'python';
    if (['.js', '.jsx', '.mjs', '.cjs'].includes(ext)) return 'javascript';
    return 'unknown';
  }

  /**
   * Check if file is TypeScript based on extension
   * @param {string} filePath - File path to check
   * @returns {boolean} True if TypeScript file
   */
  isTypeScriptFile(filePath) {
    return this.getLanguageType(filePath) === 'typescript';
  }

  /**
   * Check if file is Python based on extension
   * @param {string} filePath - File path to check
   * @returns {boolean} True if Python file
   */
  isPythonFile(filePath) {
    return this.getLanguageType(filePath) === 'python';
  }

  /**
   * Extract symbols (functions, classes, imports, exports) from AST
   * @param {Object} ast - Abstract Syntax Tree
   * @param {string} _filePath - Source file path (unused for now)
   * @param {string} languageType - Language type for context
   * @returns {Object} Extracted symbols
   */
  extractSymbols(ast, _filePath, _languageType = 'javascript') {
    const symbols = {
      functions: [],
      classes: [],
      variables: [],
      imports: [],
      exports: [],
      types: [], // For TypeScript
    };

    this.traverseAST(ast, {
      FunctionDeclaration: (node) => {
        symbols.functions.push({
          name: node.id?.name || 'anonymous',
          type: 'function',
          location: {
            start: node.start,
            end: node.end,
            line: this.getLineNumber(ast, node.start),
          },
          params: node.params.map(
            (param) => param.name || param.left?.name || 'unknown'
          ),
          async: node.async || false,
          generator: node.generator || false,
        });
      },

      ArrowFunctionExpression: (node) => {
        // Only track if it's assigned to a variable
        if (node.parent && node.parent.type === 'VariableDeclarator') {
          symbols.functions.push({
            name: node.parent.id?.name || 'anonymous',
            type: 'arrowFunction',
            location: {
              start: node.start,
              end: node.end,
              line: this.getLineNumber(ast, node.start),
            },
            params: node.params.map((param) => param.name || 'unknown'),
            async: node.async || false,
          });
        }
      },

      ClassDeclaration: (node) => {
        symbols.classes.push({
          name: node.id?.name || 'anonymous',
          type: 'class',
          location: {
            start: node.start,
            end: node.end,
            line: this.getLineNumber(ast, node.start),
          },
          superClass: node.superClass?.name || null,
          methods: this.extractClassMethods(node.body),
        });
      },

      ImportDeclaration: (node) => {
        symbols.imports.push({
          type: 'import',
          source: node.source.value,
          specifiers: node.specifiers.map((spec) => ({
            type: spec.type,
            local: spec.local?.name,
            imported: spec.imported?.name || spec.local?.name,
          })),
          location: {
            start: node.start,
            end: node.end,
            line: this.getLineNumber(ast, node.start),
          },
        });
      },

      ExportNamedDeclaration: (node) => {
        if (node.declaration) {
          // Export const/let/var or function/class
          const exportedSymbol = this.getDeclarationName(node.declaration);
          if (exportedSymbol) {
            symbols.exports.push({
              type: 'named',
              name: exportedSymbol,
              location: {
                start: node.start,
                end: node.end,
                line: this.getLineNumber(ast, node.start),
              },
            });
          }
        } else if (node.specifiers) {
          // Export { foo, bar }
          node.specifiers.forEach((spec) => {
            symbols.exports.push({
              type: 'named',
              name: spec.exported.name,
              local: spec.local?.name,
              location: {
                start: node.start,
                end: node.end,
                line: this.getLineNumber(ast, node.start),
              },
            });
          });
        }
      },

      ExportDefaultDeclaration: (node) => {
        const defaultName =
          this.getDeclarationName(node.declaration) || 'default';
        symbols.exports.push({
          type: 'default',
          name: defaultName,
          location: {
            start: node.start,
            end: node.end,
            line: this.getLineNumber(ast, node.start),
          },
        });
      },

      // TypeScript specific nodes
      TSInterfaceDeclaration: (node) => {
        symbols.types.push({
          name: node.id?.name,
          type: 'interface',
          location: {
            start: node.start,
            end: node.end,
            line: this.getLineNumber(ast, node.start),
          },
        });
      },

      TSTypeAliasDeclaration: (node) => {
        symbols.types.push({
          name: node.id?.name,
          type: 'typeAlias',
          location: {
            start: node.start,
            end: node.end,
            line: this.getLineNumber(ast, node.start),
          },
        });
      },
    });

    return symbols;
  }

  /**
   * Extract methods from class body
   * @param {Object} classBody - Class body AST node
   * @returns {Array} Array of method names
   */
  extractClassMethods(classBody) {
    const methods = [];

    if (classBody && classBody.body) {
      classBody.body.forEach((member) => {
        if (member.type === 'MethodDefinition' && member.key) {
          methods.push({
            name: member.key.name,
            kind: member.kind || 'method',
            static: member.static || false,
          });
        }
      });
    }

    return methods;
  }

  /**
   * Get declaration name from various declaration types
   * @param {Object} declaration - AST declaration node
   * @returns {string|null} Declaration name
   */
  getDeclarationName(declaration) {
    switch (declaration.type) {
      case 'FunctionDeclaration':
        return declaration.id?.name;
      case 'ClassDeclaration':
        return declaration.id?.name;
      case 'VariableDeclaration':
        return declaration.declarations[0]?.id?.name;
      default:
        return null;
    }
  }

  /**
   * Get line number from character position
   * @param {Object} ast - AST with location info
   * @param {number} position - Character position
   * @returns {number} Line number
   */
  getLineNumber(_ast, position) {
    // This is a simplified implementation
    // In a real implementation, you'd need source code to calculate line numbers
    // For now, we'll use a basic estimation
    return Math.floor(position / 80) + 1; // Rough estimate
  }

  /**
   * Traverse AST and call visitor functions
   * @param {Object} node - AST node to traverse
   * @param {Object} visitors - Visitor functions keyed by node type
   */
  traverseAST(node, visitors) {
    if (!node || typeof node !== 'object') return;

    // Call visitor for this node type
    if (visitors[node.type]) {
      visitors[node.type](node);
    }

    // Recursively traverse child nodes
    for (const key in node) {
      if (node[key] && typeof node[key] === 'object') {
        if (Array.isArray(node[key])) {
          node[key].forEach((child) => this.traverseAST(child, visitors));
        } else {
          this.traverseAST(node[key], visitors);
        }
      }
    }
  }

  /**
   * Clear the AST cache
   */
  clearCache() {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   * @returns {Object} Cache stats
   */
  getCacheStats() {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }
}

// Export singleton instance for global use
export const astParser = new ASTParser();
export default astParser;
