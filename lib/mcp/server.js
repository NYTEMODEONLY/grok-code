/**
 * MCP (Model Context Protocol) Server
 * Provides a standardized interface for AI model context and tools
 * Compatible with Claude Code's MCP implementation
 */

import { EventEmitter } from 'events';

export class MCPServer extends EventEmitter {
  constructor(options = {}) {
    super();

    this.name = options.name || 'grok-code';
    this.version = options.version || '2.0.0';
    this.description = options.description || 'Grok Code MCP Server';

    // Registered capabilities
    this.tools = new Map();
    this.resources = new Map();
    this.prompts = new Map();

    // Server state
    this.initialized = false;
    this.clients = new Set();
  }

  /**
   * Initialize the MCP server
   * @returns {Promise<Object>} Server info
   */
  async initialize() {
    if (this.initialized) {
      return this.getServerInfo();
    }

    this.emit('initializing');

    // Register built-in capabilities
    this.registerBuiltInTools();
    this.registerBuiltInResources();
    this.registerBuiltInPrompts();

    this.initialized = true;
    this.emit('initialized');

    return this.getServerInfo();
  }

  /**
   * Get server information
   * @returns {Object} Server info
   */
  getServerInfo() {
    return {
      name: this.name,
      version: this.version,
      description: this.description,
      protocolVersion: '1.0',
      capabilities: {
        tools: Array.from(this.tools.keys()),
        resources: Array.from(this.resources.keys()),
        prompts: Array.from(this.prompts.keys())
      }
    };
  }

  /**
   * Register a tool
   * @param {string} name - Tool name
   * @param {Object} definition - Tool definition
   */
  registerTool(name, definition) {
    this.tools.set(name, {
      name,
      description: definition.description,
      inputSchema: definition.inputSchema || definition.parameters,
      handler: definition.handler
    });

    this.emit('toolRegistered', { name });
  }

  /**
   * Register a resource
   * @param {string} uri - Resource URI
   * @param {Object} definition - Resource definition
   */
  registerResource(uri, definition) {
    this.resources.set(uri, {
      uri,
      name: definition.name,
      description: definition.description,
      mimeType: definition.mimeType || 'text/plain',
      handler: definition.handler
    });

    this.emit('resourceRegistered', { uri });
  }

  /**
   * Register a prompt template
   * @param {string} name - Prompt name
   * @param {Object} definition - Prompt definition
   */
  registerPrompt(name, definition) {
    this.prompts.set(name, {
      name,
      description: definition.description,
      arguments: definition.arguments || [],
      template: definition.template,
      handler: definition.handler
    });

    this.emit('promptRegistered', { name });
  }

  /**
   * List available tools
   * @returns {Array} Tool definitions
   */
  listTools() {
    return Array.from(this.tools.values()).map(tool => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema
    }));
  }

  /**
   * List available resources
   * @returns {Array} Resource definitions
   */
  listResources() {
    return Array.from(this.resources.values()).map(resource => ({
      uri: resource.uri,
      name: resource.name,
      description: resource.description,
      mimeType: resource.mimeType
    }));
  }

  /**
   * List available prompts
   * @returns {Array} Prompt definitions
   */
  listPrompts() {
    return Array.from(this.prompts.values()).map(prompt => ({
      name: prompt.name,
      description: prompt.description,
      arguments: prompt.arguments
    }));
  }

  /**
   * Call a tool
   * @param {string} name - Tool name
   * @param {Object} arguments_ - Tool arguments
   * @returns {Promise<Object>} Tool result
   */
  async callTool(name, arguments_) {
    const tool = this.tools.get(name);

    if (!tool) {
      throw new Error(`Tool not found: ${name}`);
    }

    this.emit('toolCalling', { name, arguments: arguments_ });

    try {
      const result = await tool.handler(arguments_);

      this.emit('toolCalled', { name, arguments: arguments_, result });

      return {
        content: Array.isArray(result) ? result : [{ type: 'text', text: String(result) }],
        isError: false
      };
    } catch (error) {
      this.emit('toolError', { name, error });

      return {
        content: [{ type: 'text', text: error.message }],
        isError: true
      };
    }
  }

  /**
   * Read a resource
   * @param {string} uri - Resource URI
   * @returns {Promise<Object>} Resource content
   */
  async readResource(uri) {
    const resource = this.resources.get(uri);

    if (!resource) {
      throw new Error(`Resource not found: ${uri}`);
    }

    this.emit('resourceReading', { uri });

    try {
      const content = await resource.handler();

      this.emit('resourceRead', { uri, content });

      return {
        contents: [{
          uri,
          mimeType: resource.mimeType,
          text: content
        }]
      };
    } catch (error) {
      this.emit('resourceError', { uri, error });
      throw error;
    }
  }

  /**
   * Get a prompt
   * @param {string} name - Prompt name
   * @param {Object} arguments_ - Prompt arguments
   * @returns {Promise<Object>} Prompt messages
   */
  async getPrompt(name, arguments_ = {}) {
    const prompt = this.prompts.get(name);

    if (!prompt) {
      throw new Error(`Prompt not found: ${name}`);
    }

    this.emit('promptGetting', { name, arguments: arguments_ });

    try {
      let messages;

      if (prompt.handler) {
        messages = await prompt.handler(arguments_);
      } else if (prompt.template) {
        // Simple template substitution
        let content = prompt.template;
        for (const [key, value] of Object.entries(arguments_)) {
          content = content.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
        }
        messages = [{ role: 'user', content }];
      } else {
        messages = [];
      }

      this.emit('promptGot', { name, messages });

      return { messages };
    } catch (error) {
      this.emit('promptError', { name, error });
      throw error;
    }
  }

  /**
   * Register built-in tools
   */
  registerBuiltInTools() {
    // File system tools
    this.registerTool('read_file', {
      description: 'Read the contents of a file',
      inputSchema: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Path to the file' }
        },
        required: ['path']
      },
      handler: async ({ path }) => {
        const fs = await import('fs-extra');
        return await fs.default.readFile(path, 'utf8');
      }
    });

    this.registerTool('write_file', {
      description: 'Write content to a file',
      inputSchema: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Path to the file' },
          content: { type: 'string', description: 'Content to write' }
        },
        required: ['path', 'content']
      },
      handler: async ({ path, content }) => {
        const fs = await import('fs-extra');
        await fs.default.writeFile(path, content);
        return `File written: ${path}`;
      }
    });

    this.registerTool('list_directory', {
      description: 'List contents of a directory',
      inputSchema: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Directory path' }
        },
        required: ['path']
      },
      handler: async ({ path }) => {
        const fs = await import('fs-extra');
        const items = await fs.default.readdir(path, { withFileTypes: true });
        return items.map(item => ({
          name: item.name,
          type: item.isDirectory() ? 'directory' : 'file'
        }));
      }
    });

    this.registerTool('search_files', {
      description: 'Search for files matching a pattern',
      inputSchema: {
        type: 'object',
        properties: {
          pattern: { type: 'string', description: 'Glob pattern' },
          path: { type: 'string', description: 'Base path' }
        },
        required: ['pattern']
      },
      handler: async ({ pattern, path }) => {
        const { glob } = await import('glob');
        const matches = await glob(pattern, { cwd: path || process.cwd() });
        return matches;
      }
    });

    this.registerTool('execute_command', {
      description: 'Execute a shell command',
      inputSchema: {
        type: 'object',
        properties: {
          command: { type: 'string', description: 'Command to execute' },
          cwd: { type: 'string', description: 'Working directory' }
        },
        required: ['command']
      },
      handler: async ({ command, cwd }) => {
        const { execSync } = await import('child_process');
        return execSync(command, {
          cwd: cwd || process.cwd(),
          encoding: 'utf8',
          timeout: 30000
        });
      }
    });
  }

  /**
   * Register built-in resources
   */
  registerBuiltInResources() {
    this.registerResource('file://cwd', {
      name: 'Current Working Directory',
      description: 'The current working directory path',
      mimeType: 'text/plain',
      handler: () => process.cwd()
    });

    this.registerResource('file://env', {
      name: 'Environment Variables',
      description: 'Safe environment variables (filtered)',
      mimeType: 'application/json',
      handler: () => {
        // Filter out sensitive variables
        const safe = {};
        const sensitivePatterns = ['KEY', 'SECRET', 'TOKEN', 'PASSWORD', 'CREDENTIAL'];

        for (const [key, value] of Object.entries(process.env)) {
          const isSensitive = sensitivePatterns.some(p => key.toUpperCase().includes(p));
          if (!isSensitive) {
            safe[key] = value;
          }
        }

        return JSON.stringify(safe, null, 2);
      }
    });

    this.registerResource('file://project-config', {
      name: 'Project Configuration',
      description: 'GROK.md project configuration if it exists',
      mimeType: 'text/markdown',
      handler: async () => {
        const fs = await import('fs-extra');
        const path = await import('path');
        const grokMdPath = path.default.join(process.cwd(), 'GROK.md');

        if (await fs.default.pathExists(grokMdPath)) {
          return await fs.default.readFile(grokMdPath, 'utf8');
        }

        return '# No GROK.md found';
      }
    });
  }

  /**
   * Register built-in prompts
   */
  registerBuiltInPrompts() {
    this.registerPrompt('explain_code', {
      description: 'Explain a piece of code',
      arguments: [
        { name: 'code', description: 'The code to explain', required: true },
        { name: 'language', description: 'Programming language', required: false }
      ],
      template: `Please explain the following {{language}} code:

\`\`\`{{language}}
{{code}}
\`\`\`

Provide a clear explanation of what this code does, including:
1. Overall purpose
2. Key components and their roles
3. Any notable patterns or techniques used`
    });

    this.registerPrompt('review_code', {
      description: 'Review code for issues and improvements',
      arguments: [
        { name: 'code', description: 'The code to review', required: true },
        { name: 'language', description: 'Programming language', required: false }
      ],
      template: `Please review the following {{language}} code:

\`\`\`{{language}}
{{code}}
\`\`\`

Provide a code review covering:
1. Potential bugs or errors
2. Security concerns
3. Performance issues
4. Code style and readability
5. Suggestions for improvement`
    });

    this.registerPrompt('fix_error', {
      description: 'Help fix an error in code',
      arguments: [
        { name: 'code', description: 'The code with the error', required: true },
        { name: 'error', description: 'The error message', required: true },
        { name: 'language', description: 'Programming language', required: false }
      ],
      template: `I'm getting this error:

\`\`\`
{{error}}
\`\`\`

In this {{language}} code:

\`\`\`{{language}}
{{code}}
\`\`\`

Please help me fix this error. Explain what's wrong and provide the corrected code.`
    });

    this.registerPrompt('generate_tests', {
      description: 'Generate tests for code',
      arguments: [
        { name: 'code', description: 'The code to test', required: true },
        { name: 'language', description: 'Programming language', required: false },
        { name: 'framework', description: 'Test framework to use', required: false }
      ],
      template: `Please generate comprehensive tests for the following {{language}} code using {{framework}}:

\`\`\`{{language}}
{{code}}
\`\`\`

Include:
1. Unit tests for all functions/methods
2. Edge cases
3. Error handling tests
4. Any necessary mocks or fixtures`
    });
  }

  /**
   * Handle a JSON-RPC request
   * @param {Object} request - JSON-RPC request
   * @returns {Promise<Object>} JSON-RPC response
   */
  async handleRequest(request) {
    const { id, method, params } = request;

    try {
      let result;

      switch (method) {
        case 'initialize':
          result = await this.initialize();
          break;

        case 'tools/list':
          result = { tools: this.listTools() };
          break;

        case 'tools/call':
          result = await this.callTool(params.name, params.arguments);
          break;

        case 'resources/list':
          result = { resources: this.listResources() };
          break;

        case 'resources/read':
          result = await this.readResource(params.uri);
          break;

        case 'prompts/list':
          result = { prompts: this.listPrompts() };
          break;

        case 'prompts/get':
          result = await this.getPrompt(params.name, params.arguments);
          break;

        default:
          throw new Error(`Unknown method: ${method}`);
      }

      return { jsonrpc: '2.0', id, result };
    } catch (error) {
      return {
        jsonrpc: '2.0',
        id,
        error: {
          code: -32603,
          message: error.message
        }
      };
    }
  }
}
