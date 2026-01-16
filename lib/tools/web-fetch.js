/**
 * WebFetch Tool
 * Fetches and processes web content for AI analysis
 */

import { BaseTool } from './base-tool.js';

export class WebFetchTool extends BaseTool {
  constructor(options = {}) {
    super({
      name: 'WebFetch',
      description: 'Fetches content from a URL and processes it for AI analysis. Converts HTML to markdown and can answer questions about the content.',
      parameters: {
        type: 'object',
        properties: {
          url: {
            type: 'string',
            description: 'The URL to fetch content from (will be upgraded to HTTPS automatically)',
            format: 'uri'
          },
          prompt: {
            type: 'string',
            description: 'The prompt describing what information to extract from the page'
          }
        },
        required: ['url', 'prompt']
      },
      requiresPermission: false,
      isReadOnly: true,
      timeout: 30000, // 30 seconds
      ...options
    });

    // Simple cache with 15-minute expiration
    this.cache = new Map();
    this.cacheTTL = 15 * 60 * 1000; // 15 minutes
  }

  /**
   * Execute the web fetch
   * @param {Object} params - { url, prompt }
   * @param {Object} context - Execution context
   */
  async execute(params, context = {}) {
    const { url, prompt } = params;

    try {
      // Upgrade HTTP to HTTPS
      let fetchUrl = url;
      if (fetchUrl.startsWith('http://')) {
        fetchUrl = fetchUrl.replace('http://', 'https://');
      }

      // Check cache
      const cacheKey = fetchUrl;
      const cached = this.cache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
        return {
          success: true,
          output: this.processContent(cached.content, prompt),
          cached: true,
          url: fetchUrl
        };
      }

      // Fetch the content
      const response = await this.fetchWithTimeout(fetchUrl, this.timeout);

      // Check for redirects to different hosts
      const originalHost = new URL(fetchUrl).host;
      const finalHost = new URL(response.url).host;

      if (originalHost !== finalHost) {
        return {
          success: false,
          redirected: true,
          redirectUrl: response.url,
          message: `URL redirected to different host: ${response.url}. Please make a new request with this URL.`
        };
      }

      if (!response.ok) {
        return {
          success: false,
          error: `HTTP ${response.status}: ${response.statusText}`,
          url: fetchUrl
        };
      }

      const contentType = response.headers.get('content-type') || '';
      const content = await response.text();

      // Convert HTML to markdown-like text
      let processedContent;
      if (contentType.includes('text/html')) {
        processedContent = this.htmlToMarkdown(content);
      } else if (contentType.includes('application/json')) {
        processedContent = this.formatJson(content);
      } else {
        processedContent = content;
      }

      // Cache the content
      this.cache.set(cacheKey, {
        content: processedContent,
        timestamp: Date.now()
      });

      // Clean old cache entries
      this.cleanCache();

      return {
        success: true,
        output: this.processContent(processedContent, prompt),
        url: fetchUrl,
        contentType,
        contentLength: content.length
      };

    } catch (error) {
      return {
        success: false,
        error: error.message,
        url
      };
    }
  }

  /**
   * Fetch with timeout
   * @param {string} url - URL to fetch
   * @param {number} timeout - Timeout in ms
   */
  async fetchWithTimeout(url, timeout) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Grok-Code/2.0 (AI Coding Assistant)',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.7'
        }
      });
      return response;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Convert HTML to markdown-like text
   * @param {string} html - HTML content
   * @returns {string} Markdown-like text
   */
  htmlToMarkdown(html) {
    // Remove script, style, and other non-content elements
    let text = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
      .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
      .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
      .replace(/<!--[\s\S]*?-->/g, '');

    // Convert common elements to markdown
    text = text
      // Headers
      .replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, '\n# $1\n')
      .replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, '\n## $1\n')
      .replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, '\n### $1\n')
      .replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, '\n#### $1\n')
      .replace(/<h5[^>]*>([\s\S]*?)<\/h5>/gi, '\n##### $1\n')
      .replace(/<h6[^>]*>([\s\S]*?)<\/h6>/gi, '\n###### $1\n')
      // Lists
      .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '- $1\n')
      .replace(/<ul[^>]*>/gi, '\n')
      .replace(/<\/ul>/gi, '\n')
      .replace(/<ol[^>]*>/gi, '\n')
      .replace(/<\/ol>/gi, '\n')
      // Links
      .replace(/<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, '[$2]($1)')
      // Code
      .replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gi, '\n```\n$1\n```\n')
      .replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, '`$1`')
      // Paragraphs and breaks
      .replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, '\n$1\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<hr\s*\/?>/gi, '\n---\n')
      // Bold and italic
      .replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, '**$1**')
      .replace(/<b[^>]*>([\s\S]*?)<\/b>/gi, '**$1**')
      .replace(/<em[^>]*>([\s\S]*?)<\/em>/gi, '*$1*')
      .replace(/<i[^>]*>([\s\S]*?)<\/i>/gi, '*$1*')
      // Blockquotes
      .replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, '\n> $1\n')
      // Tables (simplified)
      .replace(/<th[^>]*>([\s\S]*?)<\/th>/gi, '| $1 ')
      .replace(/<td[^>]*>([\s\S]*?)<\/td>/gi, '| $1 ')
      .replace(/<tr[^>]*>/gi, '\n')
      .replace(/<\/tr>/gi, ' |')
      // Images (extract alt text)
      .replace(/<img[^>]*alt=["']([^"']+)["'][^>]*>/gi, '[Image: $1]')
      // Remove remaining tags
      .replace(/<[^>]+>/g, '');

    // Clean up whitespace
    text = text
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\n\s*\n\s*\n/g, '\n\n')
      .replace(/  +/g, ' ')
      .trim();

    // Limit length to avoid huge responses
    if (text.length > 50000) {
      text = text.substring(0, 50000) + '\n\n[Content truncated...]';
    }

    return text;
  }

  /**
   * Format JSON content
   * @param {string} json - JSON string
   * @returns {string} Formatted JSON
   */
  formatJson(json) {
    try {
      const parsed = JSON.parse(json);
      return JSON.stringify(parsed, null, 2);
    } catch {
      return json;
    }
  }

  /**
   * Process content with the given prompt
   * @param {string} content - Processed content
   * @param {string} prompt - User's prompt
   * @returns {string} Formatted response
   */
  processContent(content, prompt) {
    // For now, return the content with the prompt context
    // In a full implementation, this would use the AI to process
    return `## Web Content Analysis

**Prompt:** ${prompt}

**Content:**

${content}`;
  }

  /**
   * Clean expired cache entries
   */
  cleanCache() {
    const now = Date.now();
    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp > this.cacheTTL) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Clear the entire cache
   */
  clearCache() {
    this.cache.clear();
  }
}

export default WebFetchTool;
