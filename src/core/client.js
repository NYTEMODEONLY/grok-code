const OpenAI = require('openai');
const config = require('./config');
const display = require('../ui/display');

class GrokClient {
  constructor() {
    this.apiKey = config.getApiKey();
    this.model = config.getModel();
    this.maxTokens = config.getMaxTokens();
    this.temperature = config.getTemperature();
    
    if (!this.apiKey) {
      throw new Error('API key not configured. Please set your xAI API key.');
    }

    this.client = new OpenAI({
      baseURL: 'https://api.x.ai/v1',
      apiKey: this.apiKey
    });

    this.sessionStats = {
      requests: 0,
      tokens: 0,
      totalResponseTime: 0,
      errors: 0,
      startTime: Date.now()
    };
  }

  // Update client configuration
  updateConfig() {
    this.model = config.getModel();
    this.maxTokens = config.getMaxTokens();
    this.temperature = config.getTemperature();
  }

  // Send message to Grok with enhanced features
  async sendMessage(messages, options = {}) {
    const startTime = Date.now();
    const thinking = display.showThinking('Grok is thinking...');
    
    try {
      this.updateConfig();
      
      const requestOptions = {
        model: options.model || this.model,
        messages: messages,
        max_tokens: options.maxTokens || this.maxTokens,
        temperature: options.temperature || this.temperature,
        stream: options.stream || false
      };

      // Add additional options if provided
      if (options.topP !== undefined) requestOptions.top_p = options.topP;
      if (options.frequencyPenalty !== undefined) requestOptions.frequency_penalty = options.frequencyPenalty;
      if (options.presencePenalty !== undefined) requestOptions.presence_penalty = options.presencePenalty;

      const response = await this.client.chat.completions.create(requestOptions);
      
      const endTime = Date.now();
      const responseTime = endTime - startTime;
      
      thinking.stop();

      // Update session statistics
      this.sessionStats.requests++;
      this.sessionStats.totalResponseTime += responseTime;
      
      if (response.usage) {
        this.sessionStats.tokens += response.usage.total_tokens;
      }

      // Update global statistics if analytics is enabled
      if (config.isAnalyticsEnabled()) {
        config.updateStatistics({
          requests: 1,
          tokens: response.usage ? response.usage.total_tokens : 0,
          responseTime: responseTime
        });
      }

      return {
        content: response.choices[0].message.content,
        usage: response.usage,
        responseTime: responseTime,
        model: response.model
      };

    } catch (error) {
      thinking.stop();
      this.sessionStats.errors++;
      
      // Enhanced error handling
      const errorInfo = this.handleError(error);
      
      if (config.isAnalyticsEnabled()) {
        config.updateStatistics({
          errors: 1
        });
      }

      throw errorInfo;
    }
  }

  // Enhanced error handling with retry logic
  async sendMessageWithRetry(messages, options = {}, maxRetries = 3) {
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await this.sendMessage(messages, options);
      } catch (error) {
        lastError = error;
        
        // Don't retry on certain errors
        if (this.isNonRetryableError(error)) {
          throw error;
        }
        
        if (attempt < maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000); // Exponential backoff
          display.warning(`Request failed, retrying in ${delay/1000}s... (attempt ${attempt}/${maxRetries})`);
          await this.sleep(delay);
        }
      }
    }
    
    throw lastError;
  }

  // Determine if error is non-retryable
  isNonRetryableError(error) {
    const nonRetryableCodes = [400, 401, 403, 413];
    return nonRetryableCodes.includes(error.status) || 
           error.message.includes('invalid') ||
           error.message.includes('authentication');
  }

  // Handle different types of errors
  handleError(error) {
    let errorInfo = {
      message: error.message,
      status: error.status,
      type: 'unknown'
    };

    if (error.status === 401) {
      errorInfo = {
        message: 'Invalid API key. Please check your xAI API key configuration.',
        status: 401,
        type: 'authentication'
      };
    } else if (error.status === 429) {
      errorInfo = {
        message: 'Rate limit exceeded. Please wait a moment before trying again.',
        status: 429,
        type: 'rate_limit'
      };
    } else if (error.status === 500) {
      errorInfo = {
        message: 'xAI service is temporarily unavailable. Please try again later.',
        status: 500,
        type: 'service_error'
      };
    } else if (error.code === 'ENOTFOUND') {
      errorInfo = {
        message: 'Network error. Please check your internet connection.',
        status: 0,
        type: 'network'
      };
    } else if (error.message.includes('timeout')) {
      errorInfo = {
        message: 'Request timed out. Please try again.',
        status: 0,
        type: 'timeout'
      };
    }

    return errorInfo;
  }

  // Stream messages for real-time output
  async streamMessage(messages, options = {}) {
    const startTime = Date.now();
    
    try {
      this.updateConfig();
      
      const requestOptions = {
        model: options.model || this.model,
        messages: messages,
        max_tokens: options.maxTokens || this.maxTokens,
        temperature: options.temperature || this.temperature,
        stream: true
      };

      const stream = await this.client.chat.completions.create(requestOptions);
      
      let fullContent = '';
      let totalTokens = 0;
      
      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || '';
        fullContent += content;
        
        if (content) {
          process.stdout.write(content);
        }
        
        if (chunk.usage) {
          totalTokens = chunk.usage.total_tokens;
        }
      }
      
      const endTime = Date.now();
      const responseTime = endTime - startTime;
      
      // Update statistics
      this.sessionStats.requests++;
      this.sessionStats.totalResponseTime += responseTime;
      this.sessionStats.tokens += totalTokens;
      
      if (config.isAnalyticsEnabled()) {
        config.updateStatistics({
          requests: 1,
          tokens: totalTokens,
          responseTime: responseTime
        });
      }
      
      console.log('\n'); // Add newline after streaming
      
      return {
        content: fullContent,
        usage: { total_tokens: totalTokens },
        responseTime: responseTime,
        model: this.model
      };
      
    } catch (error) {
      this.sessionStats.errors++;
      
      if (config.isAnalyticsEnabled()) {
        config.updateStatistics({
          errors: 1
        });
      }
      
      throw this.handleError(error);
    }
  }

  // Get session statistics
  getSessionStats() {
    const duration = Date.now() - this.sessionStats.startTime;
    return {
      ...this.sessionStats,
      duration: duration,
      avgResponseTime: this.sessionStats.requests > 0 
        ? this.sessionStats.totalResponseTime / this.sessionStats.requests 
        : 0
    };
  }

  // Reset session statistics
  resetSessionStats() {
    this.sessionStats = {
      requests: 0,
      tokens: 0,
      totalResponseTime: 0,
      errors: 0,
      startTime: Date.now()
    };
  }

  // Utility function for delays
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Test API connection
  async testConnection() {
    try {
      const response = await this.sendMessage([
        { role: 'user', content: 'Hello, this is a test message.' }
      ], { maxTokens: 10 });
      
      return {
        success: true,
        responseTime: response.responseTime,
        model: response.model
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Get available models (if API supports it)
  async getAvailableModels() {
    try {
      const models = await this.client.models.list();
      return models.data.filter(model => model.id.includes('grok'));
    } catch (error) {
      // Fallback to known Grok models
      return [
        { id: 'grok-3-beta', name: 'Grok 3 Beta' },
        { id: 'grok-3-mini-beta', name: 'Grok 3 Mini Beta' }
      ];
    }
  }

  // Estimate token count for messages
  estimateTokens(messages) {
    // Rough estimation: 1 token ≈ 4 characters for English text
    let totalChars = 0;
    messages.forEach(msg => {
      totalChars += msg.content.length;
    });
    return Math.ceil(totalChars / 4);
  }

  // Check if message would exceed token limit
  wouldExceedLimit(messages, maxTokens = null) {
    const estimatedTokens = this.estimateTokens(messages);
    const limit = maxTokens || this.maxTokens;
    return estimatedTokens > limit;
  }

  // Truncate messages to fit within token limit
  truncateMessages(messages, maxTokens = null) {
    const limit = maxTokens || this.maxTokens;
    const estimatedTokens = this.estimateTokens(messages);
    
    if (estimatedTokens <= limit) {
      return messages;
    }
    
    // Simple truncation strategy: remove oldest messages first
    const truncated = [...messages];
    while (this.estimateTokens(truncated) > limit && truncated.length > 1) {
      truncated.shift(); // Remove oldest message (keep system message)
    }
    
    return truncated;
  }
}

module.exports = GrokClient;