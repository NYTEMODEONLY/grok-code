/**
 * Language-Agnostic Symbol Extractor
 * Provides a unified interface for extracting symbols from different programming languages
 * Abstracts away language-specific AST structures into a common format
 */

export class SymbolExtractor {
  constructor() {
    // Symbol type mappings for different languages
    this.symbolTypeMappings = {
      javascript: {
        FunctionDeclaration: 'function',
        ArrowFunctionExpression: 'arrowFunction',
        ClassDeclaration: 'class',
        MethodDefinition: 'method',
        VariableDeclarator: 'variable',
        ImportDeclaration: 'import',
        ExportNamedDeclaration: 'export',
        ExportDefaultDeclaration: 'export',
      },
      typescript: {
        FunctionDeclaration: 'function',
        ArrowFunctionExpression: 'arrowFunction',
        ClassDeclaration: 'class',
        MethodDefinition: 'method',
        VariableDeclarator: 'variable',
        ImportDeclaration: 'import',
        ExportNamedDeclaration: 'export',
        ExportDefaultDeclaration: 'export',
        TSInterfaceDeclaration: 'interface',
        TSTypeAliasDeclaration: 'typeAlias',
        TSFunctionType: 'functionType',
      },
      python: {
        function: 'function',
        asyncFunction: 'asyncFunction',
        class: 'class',
        method: 'method',
        variable: 'variable',
        import: 'import',
        importFrom: 'importFrom',
      },
    };
  }

  /**
   * Extract symbols from parsed AST data in a language-agnostic way
   * @param {Object} astData - Parsed AST data from any language parser
   * @param {string} language - Source language ('javascript', 'typescript', 'python')
   * @returns {Object} Standardized symbol extraction results
   */
  extractSymbols(astData, language) {
    if (!astData || !language) {
      throw new Error('AST data and language are required');
    }

    const normalizedSymbols = {
      functions: [],
      classes: [],
      variables: [],
      imports: [],
      exports: [],
      types: [], // TypeScript interfaces, Python type hints, etc.
      metadata: {
        language,
        totalSymbols: 0,
        extractionTime: Date.now(),
      },
    };

    try {
      switch (language.toLowerCase()) {
        case 'javascript':
        case 'typescript':
          this.extractFromJavaScriptAST(astData, normalizedSymbols, language);
          break;
        case 'python':
          this.extractFromPythonAST(astData, normalizedSymbols);
          break;
        default:
          throw new Error(`Unsupported language: ${language}`);
      }

      // Calculate totals
      normalizedSymbols.metadata.totalSymbols =
        normalizedSymbols.functions.length +
        normalizedSymbols.classes.length +
        normalizedSymbols.variables.length +
        normalizedSymbols.imports.length +
        normalizedSymbols.exports.length +
        normalizedSymbols.types.length;

      return normalizedSymbols;
    } catch (error) {
      console.error(`Error extracting symbols for ${language}:`, error.message);
      // Return partial results with error information
      normalizedSymbols.metadata.error = error.message;
      return normalizedSymbols;
    }
  }

  /**
   * Extract symbols from JavaScript/TypeScript AST
   * @param {Object} astData - JavaScript/TypeScript AST data
   * @param {Object} symbols - Output symbols object
   * @param {string} language - Language type
   */
  extractFromJavaScriptAST(astData, symbols, language) {
    if (!astData.symbols) return;

    const typeMappings = this.symbolTypeMappings[language.toLowerCase()];

    // Process functions
    if (astData.symbols.functions) {
      symbols.functions = astData.symbols.functions.map((func) => ({
        name: func.name,
        type: typeMappings[func.type] || func.type,
        language,
        location: func.location,
        signature: this.buildFunctionSignature(func, language),
        metadata: {
          async: func.async || false,
          generator: func.generator || false,
          params: func.params || [],
          visibility: this.inferVisibility(func),
        },
      }));
    }

    // Process classes
    if (astData.symbols.classes) {
      symbols.classes = astData.symbols.classes.map((cls) => ({
        name: cls.name,
        type: 'class',
        language,
        location: cls.location,
        signature: this.buildClassSignature(cls, language),
        metadata: {
          superClass: cls.superClass,
          methods: cls.methods || [],
          visibility: this.inferVisibility(cls),
        },
      }));
    }

    // Process imports
    if (astData.symbols.imports) {
      symbols.imports = astData.symbols.imports.map((imp) => ({
        type: 'import',
        language,
        source: imp.source,
        specifiers: imp.specifiers || [],
        location: imp.location,
        metadata: {
          importType: imp.type || 'named',
        },
      }));
    }

    // Process exports
    if (astData.symbols.exports) {
      symbols.exports = astData.symbols.exports.map((exp) => ({
        type: 'export',
        language,
        name: exp.name,
        location: exp.location,
        metadata: {
          exportType: exp.type || 'named',
          local: exp.local,
        },
      }));
    }

    // Process TypeScript-specific types
    if (language === 'typescript' && astData.symbols.types) {
      symbols.types = astData.symbols.types.map((type) => ({
        name: type.name,
        type: typeMappings[type.type] || type.type,
        language: 'typescript',
        location: type.location,
        signature: type.name,
        metadata: {
          kind: type.type,
        },
      }));
    }
  }

  /**
   * Extract symbols from Python AST
   * @param {Object} astData - Python AST data
   * @param {Object} symbols - Output symbols object
   */
  extractFromPythonAST(astData, symbols) {
    if (!astData.symbols) return;

    // Process functions
    if (astData.symbols.functions) {
      symbols.functions = astData.symbols.functions.map((func) => ({
        name: func.name,
        type: func.type,
        language: 'python',
        location: func.location,
        signature: this.buildPythonFunctionSignature(func),
        metadata: {
          async: func.async || false,
          params: func.params || [],
          visibility: this.inferPythonVisibility(func.name),
          decorators: func.decorators || [],
        },
      }));
    }

    // Process classes
    if (astData.symbols.classes) {
      symbols.classes = astData.symbols.classes.map((cls) => ({
        name: cls.name,
        type: 'class',
        language: 'python',
        location: cls.location,
        signature: this.buildPythonClassSignature(cls),
        metadata: {
          superClass: cls.superClass || [],
          methods: cls.methods || [],
          visibility: this.inferPythonVisibility(cls.name),
          decorators: cls.decorators || [],
        },
      }));
    }

    // Process imports
    if (astData.symbols.imports) {
      symbols.imports = astData.symbols.imports.map((imp) => ({
        type: 'import',
        language: 'python',
        source: imp.source,
        specifiers: imp.specifiers || [],
        location: imp.location,
        metadata: {
          importType: imp.type || 'import',
        },
      }));
    }
  }

  /**
   * Build function signature string
   * @param {Object} func - Function symbol data
   * @param {string} language - Source language
   * @returns {string} Function signature
   */
  buildFunctionSignature(func, language) {
    const params = func.params ? func.params.join(', ') : '';
    const asyncPrefix = func.async ? 'async ' : '';
    const name = func.name || 'anonymous';

    switch (language) {
      case 'typescript':
        return `${asyncPrefix}function ${name}(${params})`;
      case 'javascript':
        return `${asyncPrefix}function ${name}(${params})`;
      default:
        return `${name}(${params})`;
    }
  }

  /**
   * Build Python function signature
   * @param {Object} func - Python function symbol data
   * @returns {string} Function signature
   */
  buildPythonFunctionSignature(func) {
    const params = func.params ? func.params.join(', ') : '';
    const asyncPrefix = func.async ? 'async ' : '';
    const name = func.name;

    return `${asyncPrefix}def ${name}(${params})`;
  }

  /**
   * Build class signature string
   * @param {Object} cls - Class symbol data
   * @param {string} language - Source language
   * @returns {string} Class signature
   */
  buildClassSignature(cls, language) {
    const name = cls.name;
    const superClass = cls.superClass ? ` extends ${cls.superClass}` : '';

    switch (language) {
      case 'typescript':
      case 'javascript':
        return `class ${name}${superClass}`;
      default:
        return `class ${name}`;
    }
  }

  /**
   * Build Python class signature
   * @param {Object} cls - Python class symbol data
   * @returns {string} Class signature
   */
  buildPythonClassSignature(cls) {
    const name = cls.name;
    const superClass =
      cls.superClass && cls.superClass.length > 0
        ? `(${cls.superClass.join(', ')})`
        : '';

    return `class ${name}${superClass}`;
  }

  /**
   * Infer visibility from symbol properties (basic implementation)
   * @param {Object} symbol - Symbol data
   * @returns {string} Visibility level
   */
  inferVisibility(symbol) {
    // Basic heuristics for visibility inference
    if (!symbol.name) return 'unknown';

    // JavaScript/TypeScript conventions
    if (symbol.name.startsWith('_')) return 'private';
    if (symbol.name.startsWith('#')) return 'private';
    if (symbol.static) return 'static';

    return 'public';
  }

  /**
   * Infer Python visibility from naming conventions
   * @param {string} name - Symbol name
   * @returns {string} Visibility level
   */
  inferPythonVisibility(name) {
    if (!name) return 'unknown';

    if (name.startsWith('__') && name.endsWith('__')) return 'special';
    if (name.startsWith('_')) return 'private';
    if (name.startsWith('__')) return 'private';

    return 'public';
  }

  /**
   * Get supported languages
   * @returns {Array<string>} List of supported languages
   */
  getSupportedLanguages() {
    return Object.keys(this.symbolTypeMappings);
  }

  /**
   * Validate symbol data structure
   * @param {Object} symbols - Symbol data to validate
   * @returns {Object} Validation result
   */
  validateSymbols(symbols) {
    const requiredFields = [
      'functions',
      'classes',
      'variables',
      'imports',
      'exports',
      'types',
      'metadata',
    ];
    const missing = requiredFields.filter((field) => !(field in symbols));

    return {
      valid: missing.length === 0,
      missing: missing,
      hasData: symbols.metadata?.totalSymbols > 0,
    };
  }

  /**
   * Merge symbols from multiple sources
   * @param {Array<Object>} symbolSets - Array of symbol objects to merge
   * @returns {Object} Merged symbols
   */
  mergeSymbols(symbolSets) {
    const merged = {
      functions: [],
      classes: [],
      variables: [],
      imports: [],
      exports: [],
      types: [],
      metadata: {
        language: 'mixed',
        totalSymbols: 0,
        extractionTime: Date.now(),
        sources: symbolSets.length,
      },
    };

    symbolSets.forEach((symbolSet) => {
      if (symbolSet.functions) merged.functions.push(...symbolSet.functions);
      if (symbolSet.classes) merged.classes.push(...symbolSet.classes);
      if (symbolSet.variables) merged.variables.push(...symbolSet.variables);
      if (symbolSet.imports) merged.imports.push(...symbolSet.imports);
      if (symbolSet.exports) merged.exports.push(...symbolSet.exports);
      if (symbolSet.types) merged.types.push(...symbolSet.types);
    });

    merged.metadata.totalSymbols =
      merged.functions.length +
      merged.classes.length +
      merged.variables.length +
      merged.imports.length +
      merged.exports.length +
      merged.types.length;

    return merged;
  }
}

// Export singleton instance for global use
export const symbolExtractor = new SymbolExtractor();
export default symbolExtractor;
