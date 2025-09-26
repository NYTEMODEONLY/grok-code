import https from 'https';
import { logger } from '../utils/logger.js';

export class GrokAPI {
  constructor() {
    this.apiKey = process.env.GROK_API_KEY || process.env.XAI_API_KEY;
    this.baseUrl = 'https://api.x.ai/v1';
    this.model = 'grok-beta'; // or grok-vision-beta for vision tasks

    // Statistics tracking
    this.requestCount = 0;
    this.successCount = 0;
    this.totalResponseTime = 0;
    this.lastRequestTime = null;

    // Rate limiting
    this.requestsPerMinute = 0;
    this.rateLimitWindow = Date.now();
    this.maxRequestsPerMinute = 10; // Conservative limit

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
}
