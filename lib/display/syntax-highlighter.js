import { logger } from '../utils/logger.js';

/**
 * Syntax Highlighter for Terminal Code Display
 * Provides syntax highlighting for multiple programming languages in terminal environments
 */
export class SyntaxHighlighter {
  constructor(options = {}) {
    this.theme = options.theme || 'default';
    this.enabled = options.enabled !== false;

    // Terminal color codes (ANSI escape sequences)
    this.colors = {
      // Basic colors
      reset: '\x1b[0m',
      bold: '\x1b[1m',
      dim: '\x1b[2m',
      italic: '\x1b[3m',
      underline: '\x1b[4m',

      // Foreground colors
      black: '\x1b[30m',
      red: '\x1b[31m',
      green: '\x1b[32m',
      yellow: '\x1b[33m',
      blue: '\x1b[34m',
      magenta: '\x1b[35m',
      cyan: '\x1b[36m',
      white: '\x1b[37m',
      gray: '\x1b[90m',

      // Bright colors
      brightRed: '\x1b[91m',
      brightGreen: '\x1b[92m',
      brightYellow: '\x1b[93m',
      brightBlue: '\x1b[94m',
      brightMagenta: '\x1b[95m',
      brightCyan: '\x1b[96m',
      brightWhite: '\x1b[97m',
    };

    // Syntax highlighting themes
    this.themes = {
      default: {
        keyword: 'brightBlue',
        string: 'green',
        number: 'yellow',
        comment: 'gray',
        function: 'cyan',
        variable: 'white',
        operator: 'brightWhite',
        type: 'brightMagenta',
        builtin: 'brightCyan',
        error: 'brightRed',
      },
      dark: {
        keyword: 'blue',
        string: 'brightGreen',
        number: 'brightYellow',
        comment: 'gray',
        function: 'cyan',
        variable: 'white',
        operator: 'brightWhite',
        type: 'magenta',
        builtin: 'brightCyan',
        error: 'red',
      },
      minimal: {
        keyword: 'bold',
        string: 'green',
        number: 'yellow',
        comment: 'gray',
        function: 'cyan',
        variable: 'white',
        operator: 'white',
        type: 'magenta',
        builtin: 'cyan',
        error: 'red',
      },
    };

    // Language definitions
    this.languages = {
      javascript: this.getJavaScriptPatterns(),
      typescript: this.getTypeScriptPatterns(),
      python: this.getPythonPatterns(),
      json: this.getJsonPatterns(),
      shell: this.getShellPatterns(),
      sql: this.getSqlPatterns(),
    };

    logger.info('Syntax highlighter initialized', {
      theme: this.theme,
      enabled: this.enabled,
    });
  }

  /**
   * Highlight code with syntax coloring
   * @param {string} code - Code to highlight
   * @param {string} language - Programming language
   * @param {Object} options - Highlighting options
   * @returns {string} Syntax highlighted code
   */
  highlight(code, language = 'auto', options = {}) {
    if (!this.enabled) {
      return code;
    }

    try {
      const lang =
        language === 'auto'
          ? this.detectLanguage(code)
          : language.toLowerCase();
      const theme = this.themes[this.theme] || this.themes.default;

      if (!this.languages[lang]) {
        logger.debug('Language not supported for highlighting', {
          language: lang,
        });
        return code;
      }

      let highlighted = code;

      // Apply syntax highlighting patterns
      const patterns = this.languages[lang];
      for (const [tokenType, regex] of Object.entries(patterns)) {
        const color = theme[tokenType];
        if (color && this.colors[color]) {
          highlighted = highlighted.replace(regex, (match) => {
            return `${this.colors[color]}${match}${this.colors.reset}`;
          });
        }
      }

      // Add line numbers if requested
      if (options.lineNumbers) {
        highlighted = this.addLineNumbers(highlighted);
      }

      return highlighted;
    } catch (error) {
      logger.warn('Syntax highlighting failed', {
        error: error.message,
        language,
      });
      return code; // Return original code on error
    }
  }

  /**
   * Detect programming language from code content
   * @param {string} code - Code content
   * @returns {string} Detected language
   */
  detectLanguage(code) {
    const lines = code.split('\n').slice(0, 10); // Check first 10 lines

    // JavaScript/TypeScript patterns
    if (
      lines.some((line) =>
        /\b(import|export|const|let|var|function|class)\b/.test(line)
      )
    ) {
      return lines.some((line) => /\b(interface|type|enum)\b/.test(line))
        ? 'typescript'
        : 'javascript';
    }

    // Python patterns
    if (
      lines.some((line) => /\b(def|class|import|from|if __name__)\b/.test(line))
    ) {
      return 'python';
    }

    // JSON patterns
    if (code.trim().startsWith('{') && code.trim().endsWith('}')) {
      try {
        JSON.parse(code);
        return 'json';
      } catch (e) {
        // Not valid JSON
      }
    }

    // Shell patterns
    if (
      lines.some(
        (line) =>
          /^\s*[#$]\s*!/.test(line) || /\b(echo|cd|ls|mkdir|rm)\b/.test(line)
      )
    ) {
      return 'shell';
    }

    // SQL patterns
    if (
      lines.some((line) =>
        /\b(SELECT|INSERT|UPDATE|DELETE|CREATE|DROP|ALTER)\b/i.test(line)
      )
    ) {
      return 'sql';
    }

    return 'javascript'; // Default fallback
  }

  /**
   * Add line numbers to highlighted code
   * @param {string} code - Highlighted code
   * @returns {string} Code with line numbers
   */
  addLineNumbers(code) {
    const lines = code.split('\n');
    const maxLineNumber = lines.length;
    const lineNumberWidth = String(maxLineNumber).length;

    const numberedLines = lines.map((line, index) => {
      const lineNumber = String(index + 1).padStart(lineNumberWidth, ' ');
      return `${this.colors.gray}${lineNumber} ${this.colors.reset}${line}`;
    });

    return numberedLines.join('\n');
  }

  /**
   * Get JavaScript syntax patterns
   */
  getJavaScriptPatterns() {
    return {
      // Comments
      comment: /(\/\/.*$|\/\*[\s\S]*?\*\/)/gm,

      // Strings
      string: /(["'`])((?:\\.|(?!\1)[^\\\n])*?)\1/g,

      // Numbers
      number: /\b\d+(\.\d+)?\b/g,

      // Keywords
      keyword:
        /\b(const|let|var|function|class|if|else|for|while|do|switch|case|default|try|catch|finally|throw|return|break|continue|async|await|import|export|from|as|new|this|super|extends|implements|interface|type|enum)\b/g,

      // Built-in objects and functions
      builtin:
        /\b(console|Math|Date|Array|Object|String|Number|Boolean|RegExp|Promise|JSON|Error|Map|Set|WeakMap|WeakSet|Symbol|BigInt|Proxy|Reflect)\b/g,

      // Operators
      operator: /([+\-*/%=<>!&|^~?:;,.(){}[\]])/g,
    };
  }

  /**
   * Get TypeScript syntax patterns (extends JavaScript)
   */
  getTypeScriptPatterns() {
    const jsPatterns = this.getJavaScriptPatterns();

    // Add TypeScript-specific patterns
    jsPatterns.keyword =
      /\b(const|let|var|function|class|if|else|for|while|do|switch|case|default|try|catch|finally|throw|return|break|continue|async|await|import|export|from|as|new|this|super|extends|implements|interface|type|enum|namespace|module|declare|abstract|readonly|private|protected|public|static|override)\b/g;

    // Types
    jsPatterns.type =
      /\b(string|number|boolean|any|unknown|never|void|null|undefined|object|symbol|bigint)\b/g;

    return jsPatterns;
  }

  /**
   * Get Python syntax patterns
   */
  getPythonPatterns() {
    return {
      // Comments
      comment: /(#.*$)/gm,

      // Strings
      string:
        /("""[\s\S]*?"""|'''[\s\S]*?'''|"([^"\\]|\\.)*"|'([^'\\]|\\.)*')/g,

      // Numbers
      number: /\b\d+(\.\d+)?\b/g,

      // Keywords
      keyword:
        /\b(def|class|if|elif|else|for|while|try|except|finally|with|as|import|from|return|yield|break|continue|pass|raise|global|nonlocal|lambda|and|or|not|in|is|None|True|False)\b/g,

      // Built-in functions and types
      builtin:
        /\b(print|len|range|enumerate|zip|map|filter|reduce|sum|max|min|abs|round|int|str|float|bool|list|dict|tuple|set|frozenset|open|input|type|isinstance|hasattr|getattr|setattr|dir|help)\b/g,

      // Operators
      operator: /([+\-*/%=<>!&|^~?:;,.(){}[\]])/g,
    };
  }

  /**
   * Get JSON syntax patterns
   */
  getJsonPatterns() {
    return {
      // Strings
      string: /"([^"\\]|\\.)*"/g,

      // Numbers
      number: /\b\d+(\.\d+)?([eE][+-]?\d+)?\b/g,

      // Boolean and null
      keyword: /\b(true|false|null)\b/g,

      // Operators (brackets, commas, colons)
      operator: /([{}[\],:])/g,
    };
  }

  /**
   * Get Shell/Bash syntax patterns
   */
  getShellPatterns() {
    return {
      // Comments
      comment: /(#.*$)/gm,

      // Strings
      string: /(["'`])((?:\\.|(?!\1)[^\\\n])*?)\1/g,

      // Numbers
      number: /\b\d+\b/g,

      // Keywords and commands
      keyword:
        /\b(if|then|else|elif|fi|for|while|do|done|case|esac|function|return|exit|echo|cd|ls|mkdir|rm|cp|mv|cat|grep|sed|awk|curl|wget|git|npm|yarn|node|python|pip)\b/g,

      // Variables
      variable: /\$[a-zA-Z_][a-zA-Z0-9_]*|\$\{[^}]+\}/g,

      // Operators
      operator: /([|&;()<>{}[\]]|>>|<<|&&|\|\|)/g,
    };
  }

  /**
   * Get SQL syntax patterns
   */
  getSqlPatterns() {
    return {
      // Comments
      comment: /(--.*$|\/\*[\s\S]*?\*\/)/gm,

      // Strings
      string: /('([^'\\]|\\.)*')/g,

      // Numbers
      number: /\b\d+(\.\d+)?\b/g,

      // Keywords
      keyword:
        /\b(SELECT|INSERT|UPDATE|DELETE|CREATE|DROP|ALTER|FROM|WHERE|JOIN|INNER|LEFT|RIGHT|FULL|OUTER|ON|GROUP|BY|HAVING|ORDER|LIMIT|OFFSET|UNION|ALL|DISTINCT|AS|AND|OR|NOT|IN|IS|NULL|LIKE|BETWEEN|EXISTS|CASE|WHEN|THEN|ELSE|END|BEGIN|COMMIT|ROLLBACK|SET|DECLARE|WHILE|FOR|LOOP|IF|THEN|ELSE|ELSIF|END|FUNCTION|PROCEDURE|TRIGGER|INDEX|VIEW|TABLE|COLUMN|DATABASE|SCHEMA)\b/gi,

      // Functions
      function:
        /\b(COUNT|SUM|AVG|MIN|MAX|CONCAT|SUBSTRING|REPLACE|TRIM|UPPER|LOWER|NOW|CURDATE|DATE|YEAR|MONTH|DAY|HOUR|MINUTE|SECOND|DATEDIFF|TIMESTAMPDIFF)\b/gi,

      // Operators
      operator: /([+\-*/%=<>!&|^~?:;,.(){}[\]])/g,
    };
  }

  /**
   * Test syntax highlighting with sample code
   * @param {string} language - Language to test
   * @returns {string} Test output
   */
  testHighlighting(language = 'javascript') {
    const testCode = {
      javascript: `function hello(name) {
  const greeting = \`Hello, \${name}!\`;
  console.log(greeting);
  return true;
}

class User {
  constructor(name, age) {
    this.name = name;
    this.age = age;
  }

  greet() {
    return \`Hi, I'm \${this.name}\`;
  }
}`,

      python: `def fibonacci(n):
    """Calculate the nth Fibonacci number"""
    if n <= 1:
        return n
    return fibonacci(n-1) + fibonacci(n-2)

class Calculator:
    def __init__(self):
        self.history = []

    def add(self, a, b):
        result = a + b
        self.history.append(f"{a} + {b} = {result}")
        return result

if __name__ == "__main__":
    calc = Calculator()
    print(calc.add(5, 3))`,

      json: `{
  "user": {
    "name": "John Doe",
    "age": 30,
    "active": true,
    "tags": ["developer", "javascript"],
    "projects": [
      {
        "name": "Grok Code",
        "stars": 1337,
        "languages": ["JavaScript", "TypeScript"]
      }
    ]
  }
}`,
    };

    const code = testCode[language] || testCode.javascript;
    return this.highlight(code, language, { lineNumbers: true });
  }

  /**
   * Get supported languages
   * @returns {Array} List of supported languages
   */
  getSupportedLanguages() {
    return Object.keys(this.languages);
  }

  /**
   * Set highlighting theme
   * @param {string} theme - Theme name
   */
  setTheme(theme) {
    if (this.themes[theme]) {
      this.theme = theme;
      logger.info('Syntax highlighting theme changed', { theme });
    } else {
      logger.warn('Unknown theme', {
        theme,
        available: Object.keys(this.themes),
      });
    }
  }

  /**
   * Enable or disable syntax highlighting
   * @param {boolean} enabled - Whether highlighting is enabled
   */
  setEnabled(enabled) {
    this.enabled = enabled;
    logger.info('Syntax highlighting toggled', { enabled });
  }

  /**
   * Get highlighting statistics
   * @returns {Object} Statistics
   */
  getStats() {
    return {
      enabled: this.enabled,
      theme: this.theme,
      supportedLanguages: this.getSupportedLanguages(),
      availableThemes: Object.keys(this.themes),
    };
  }
}
