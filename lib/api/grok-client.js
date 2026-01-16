import https from 'https';
import { EventEmitter } from 'events';
import { logger } from '../utils/logger.js';

export class GrokAPI extends EventEmitter {
  constructor(options = {}) {
    super();

    this.apiKey = options.apiKey || process.env.GROK_API_KEY || process.env.XAI_API_KEY;
    this.baseUrl = 'https://api.x.ai/v1';
    this.model = options.model || 'grok-code-fast-1'; // Default to coding-optimized model

    // Statistics tracking
    this.requestCount = 0;
    this.successCount = 0;
    this.totalResponseTime = 0;
    this.lastRequestTime = null;
    this.totalTokensUsed = 0;

    // Rate limiting
    this.requestsPerMinute = 0;
    this.rateLimitWindow = Date.now();
    this.maxRequestsPerMinute = options.maxRequestsPerMinute || 30; // More reasonable limit

    // Tool definitions for Claude Code-compatible tool calling
    this.tools = new Map();

    this.validateConfig();
  }

  /**
   * Validate API configuration
   */
  validateConfig() {
    if (!this.apiKey) {
      throw new Error(
        'Grok API key not found. Set GROK_API_KEY or XAI_API_KEY environment variable.'
      );
    }

    if (this.apiKey.length < 20) {
      throw new Error(
        'Invalid API key format. Grok API keys should be longer than 20 characters.'
      );
    }
  }

  /**
   * Generate a fix using Grok AI
   * @param {string} prompt - The prompt describing the error and context
   * @returns {Promise<string>} AI-generated fix response
   */
  async generateFix(prompt) {
    this.enforceRateLimit();

    const startTime = Date.now();
    this.requestCount++;
    this.lastRequestTime = startTime;

    try {
      logger.info('Calling Grok API for fix generation');

      const response = await this.makeAPIRequest({
        messages: [
          {
            role: 'system',
            content:
              'You are Grok, a helpful and maximally truthful AI built by xAI. You are an expert software engineer with deep knowledge of programming languages, frameworks, and best practices.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        model: this.model,
        temperature: 0.3, // Lower temperature for more consistent code fixes
        max_tokens: 2000,
        stream: false,
      });

      const responseTime = Date.now() - startTime;
      this.totalResponseTime += responseTime;

      this.successCount++;

      logger.info(`Grok API call successful (${responseTime}ms)`);

      return response.choices[0].message.content;
    } catch (error) {
      logger.error('Grok API call failed', error);
      throw new Error(`Grok API error: ${error.message}`);
    }
  }

  /**
   * Make the actual HTTPS request to Grok API
   */
  async makeAPIRequest(payload) {
    return new Promise((resolve, reject) => {
      const postData = JSON.stringify(payload);

      const options = {
        hostname: 'api.x.ai',
        port: 443,
        path: '/v1/chat/completions',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Length': Buffer.byteLength(postData),
          'User-Agent': 'GrokCode/1.0',
        },
      };

      const req = https.request(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            if (res.statusCode === 200) {
              const response = JSON.parse(data);
              resolve(response);
            } else {
              reject(
                new Error(`API returned status ${res.statusCode}: ${data}`)
              );
            }
          } catch (parseError) {
            reject(
              new Error(`Failed to parse API response: ${parseError.message}`)
            );
          }
        });
      });

      req.on('error', (error) => {
        reject(new Error(`Request failed: ${error.message}`));
      });

      req.setTimeout(30000, () => {
        req.destroy();
        reject(new Error('Request timeout after 30 seconds'));
      });

      req.write(postData);
      req.end();
    });
  }

  /**
   * Enforce rate limiting to avoid API quota issues
   */
  enforceRateLimit() {
    const now = Date.now();
    const windowMs = 60000; // 1 minute

    // Reset counter if window has passed
    if (now - this.rateLimitWindow > windowMs) {
      this.requestsPerMinute = 0;
      this.rateLimitWindow = now;
    }

    // Check if we're over the limit
    if (this.requestsPerMinute >= this.maxRequestsPerMinute) {
      const waitTime = windowMs - (now - this.rateLimitWindow);
      throw new Error(
        `Rate limit exceeded. Wait ${Math.ceil(waitTime / 1000)} seconds before making another request.`
      );
    }

    this.requestsPerMinute++;
  }

  /**
   * Test API connectivity and authentication
   */
  async testConnection() {
    try {
      logger.info('Testing Grok API connection');

      const response = await this.makeAPIRequest({
        messages: [
          {
            role: 'user',
            content:
              'Hello, just testing the connection. Please respond with "Connection successful".',
          },
        ],
        model: this.model,
        max_tokens: 50,
      });

      const success =
        response.choices[0].message.content.includes('successful');
      logger.info(
        `Grok API connection test: ${success ? 'SUCCESS' : 'FAILED'}`
      );

      return success;
    } catch (error) {
      logger.error('Grok API connection test failed', error);
      return false;
    }
  }

  /**
   * Get API usage statistics
   */
  getStats() {
    return {
      totalRequests: this.requestCount,
      successfulRequests: this.successCount,
      failedRequests: this.requestCount - this.successCount,
      successRate:
        this.requestCount > 0 ? this.successCount / this.requestCount : 0,
      averageResponseTime:
        this.requestCount > 0 ? this.totalResponseTime / this.requestCount : 0,
      lastRequestTime: this.lastRequestTime,
      rateLimitRemaining: this.maxRequestsPerMinute - this.requestsPerMinute,
      totalTokensUsed: this.totalTokensUsed,
    };
  }

  /**
   * Estimate token usage for a prompt (rough approximation)
   */
  estimateTokens(text) {
    // Rough approximation: 1 token ≈ 4 characters for English text
    return Math.ceil(text.length / 4);
  }

  /**
   * Check if the API key appears to be valid (basic format check)
   */
  isValidApiKey() {
    return (
      this.apiKey && this.apiKey.length > 20 && this.apiKey.startsWith('xai-')
    );
  }

  /**
   * Register a tool for use with the API
   * @param {string} name - Tool name
   * @param {Object} schema - Tool schema (OpenAI function calling format)
   */
  registerTool(name, schema) {
    this.tools.set(name, {
      type: 'function',
      function: {
        name,
        description: schema.description,
        parameters: schema.parameters
      }
    });
  }

  /**
   * Get all registered tools in OpenAI format
   * @returns {Array} Array of tool definitions
   */
  getToolDefinitions() {
    return Array.from(this.tools.values());
  }

  /**
   * Chat completion with streaming support
   * @param {Object} options - Chat options
   * @param {Array} options.messages - Conversation messages
   * @param {string} options.model - Model to use
   * @param {number} options.temperature - Sampling temperature
   * @param {number} options.maxTokens - Max tokens to generate
   * @param {boolean} options.stream - Enable streaming
   * @param {boolean} options.useTools - Include registered tools
   * @param {Function} options.onToken - Callback for each streamed token
   * @param {Function} options.onToolCall - Callback for tool calls
   * @returns {Promise<Object>} Chat completion response
   */
  async chat(options) {
    const {
      messages,
      model = this.model,
      temperature = 0.7,
      maxTokens = 4096,
      stream = false,
      useTools = false,
      onToken = null,
      onToolCall = null
    } = options;

    this.enforceRateLimit();

    const startTime = Date.now();
    this.requestCount++;
    this.lastRequestTime = startTime;

    const payload = {
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
      stream
    };

    // Add tools if requested
    if (useTools && this.tools.size > 0) {
      payload.tools = this.getToolDefinitions();
      payload.tool_choice = 'auto';
    }

    try {
      if (stream && onToken) {
        return await this.streamChat(payload, onToken, onToolCall);
      } else {
        const response = await this.makeAPIRequest(payload);

        const responseTime = Date.now() - startTime;
        this.totalResponseTime += responseTime;
        this.successCount++;

        // Track token usage
        if (response.usage) {
          this.totalTokensUsed += response.usage.total_tokens || 0;
        }

        // Handle tool calls in response
        const message = response.choices[0].message;
        if (message.tool_calls && onToolCall) {
          for (const toolCall of message.tool_calls) {
            await onToolCall(toolCall);
          }
        }

        this.emit('response', { response, responseTime });
        return response;
      }
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Stream chat completion with token-by-token callbacks
   * @param {Object} payload - Request payload
   * @param {Function} onToken - Callback for each token
   * @param {Function} onToolCall - Callback for tool calls
   * @returns {Promise<Object>} Aggregated response
   */
  async streamChat(payload, onToken, onToolCall) {
    return new Promise((resolve, reject) => {
      const postData = JSON.stringify(payload);

      const options = {
        hostname: 'api.x.ai',
        port: 443,
        path: '/v1/chat/completions',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Length': Buffer.byteLength(postData),
          'User-Agent': 'GrokCode/2.0',
          'Accept': 'text/event-stream'
        }
      };

      const req = https.request(options, (res) => {
        let buffer = '';
        let fullContent = '';
        let toolCalls = [];
        let finishReason = null;

        res.on('data', (chunk) => {
          buffer += chunk.toString();

          // Process complete SSE events
          const lines = buffer.split('\n');
          buffer = lines.pop() || ''; // Keep incomplete line in buffer

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6).trim();

              if (data === '[DONE]') {
                continue;
              }

              try {
                const parsed = JSON.parse(data);
                const delta = parsed.choices?.[0]?.delta;
                finishReason = parsed.choices?.[0]?.finish_reason || finishReason;

                if (delta?.content) {
                  fullContent += delta.content;
                  if (onToken) {
                    onToken(delta.content);
                  }
                  this.emit('token', delta.content);
                }

                // Handle streamed tool calls
                if (delta?.tool_calls) {
                  for (const tc of delta.tool_calls) {
                    if (tc.index !== undefined) {
                      if (!toolCalls[tc.index]) {
                        toolCalls[tc.index] = {
                          id: tc.id || '',
                          type: 'function',
                          function: { name: '', arguments: '' }
                        };
                      }
                      if (tc.id) toolCalls[tc.index].id = tc.id;
                      if (tc.function?.name) toolCalls[tc.index].function.name += tc.function.name;
                      if (tc.function?.arguments) toolCalls[tc.index].function.arguments += tc.function.arguments;
                    }
                  }
                }
              } catch (parseError) {
                // Skip unparseable chunks
              }
            }
          }
        });

        res.on('end', async () => {
          const responseTime = Date.now() - this.lastRequestTime;
          this.totalResponseTime += responseTime;
          this.successCount++;

          // Process completed tool calls
          if (toolCalls.length > 0 && onToolCall) {
            for (const toolCall of toolCalls) {
              if (toolCall.function.name) {
                await onToolCall(toolCall);
              }
            }
          }

          const response = {
            choices: [{
              message: {
                role: 'assistant',
                content: fullContent,
                tool_calls: toolCalls.length > 0 ? toolCalls : undefined
              },
              finish_reason: finishReason
            }]
          };

          this.emit('streamEnd', { response, responseTime });
          resolve(response);
        });

        res.on('error', reject);
      });

      req.on('error', (error) => {
        reject(new Error(`Stream request failed: ${error.message}`));
      });

      req.setTimeout(120000, () => {
        req.destroy();
        reject(new Error('Stream request timeout after 120 seconds'));
      });

      req.write(postData);
      req.end();
    });
  }

  /**
   * Generate completion with automatic tool execution
   * @param {Object} options - Options
   * @param {Array} options.messages - Messages
   * @param {Object} options.toolExecutor - Tool executor instance
   * @param {number} options.maxIterations - Max tool call iterations
   * @returns {Promise<Object>} Final response with tool results
   */
  async chatWithTools(options) {
    const {
      messages,
      toolExecutor,
      maxIterations = 10,
      ...chatOptions
    } = options;

    let currentMessages = [...messages];
    let iterations = 0;
    let finalResponse = null;

    while (iterations < maxIterations) {
      iterations++;

      const response = await this.chat({
        ...chatOptions,
        messages: currentMessages,
        useTools: true
      });

      const message = response.choices[0].message;
      currentMessages.push(message);

      // Check if there are tool calls to execute
      if (!message.tool_calls || message.tool_calls.length === 0) {
        finalResponse = response;
        break;
      }

      // Execute each tool call
      for (const toolCall of message.tool_calls) {
        const toolName = toolCall.function.name;
        let toolArgs;

        try {
          toolArgs = JSON.parse(toolCall.function.arguments);
        } catch {
          toolArgs = {};
        }

        this.emit('toolCall', { name: toolName, arguments: toolArgs });

        try {
          const result = await toolExecutor.execute(toolName, toolArgs);

          currentMessages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify(result)
          });

          this.emit('toolResult', { name: toolName, result });
        } catch (error) {
          currentMessages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify({ error: error.message })
          });

          this.emit('toolError', { name: toolName, error });
        }
      }
    }

    return {
      response: finalResponse,
      messages: currentMessages,
      iterations
    };
  }

  /**
   * Simple text generation without tool support
   * @param {string} prompt - User prompt
   * @param {Object} options - Generation options
   * @returns {Promise<string>} Generated text
   */
  async generate(prompt, options = {}) {
    const response = await this.chat({
      messages: [
        {
          role: 'system',
          content: options.systemPrompt || 'You are Grok, a helpful AI assistant built by xAI.'
        },
        { role: 'user', content: prompt }
      ],
      model: options.model || this.model,
      temperature: options.temperature || 0.7,
      maxTokens: options.maxTokens || 4096,
      stream: false
    });

    return response.choices[0].message.content;
  }
}
