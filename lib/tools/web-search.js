/**
 * WebSearch Tool
 * Searches the web for information using search APIs
 */

import { BaseTool } from './base-tool.js';

export class WebSearchTool extends BaseTool {
  constructor(options = {}) {
    super({
      name: 'WebSearch',
      description: 'Searches the web for information. Returns search results with titles, URLs, and snippets.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'The search query to use',
            minLength: 2
          },
          allowed_domains: {
            type: 'array',
            items: { type: 'string' },
            description: 'Only include results from these domains'
          },
          blocked_domains: {
            type: 'array',
            items: { type: 'string' },
            description: 'Never include results from these domains'
          },
          max_results: {
            type: 'number',
            description: 'Maximum number of results to return (default: 10)',
            default: 10
          }
        },
        required: ['query']
      },
      requiresPermission: false,
      isReadOnly: true,
      timeout: 30000,
      ...options
    });

    // Cache for search results (5 minute TTL)
    this.cache = new Map();
    this.cacheTTL = 5 * 60 * 1000;

    // Rate limiting
    this.lastRequestTime = 0;
    this.minRequestInterval = 1000; // 1 second between requests
  }

  /**
   * Execute the web search
   * @param {Object} params - { query, allowed_domains, blocked_domains, max_results }
   * @param {Object} context - Execution context
   */
  async execute(params, context = {}) {
    const {
      query,
      allowed_domains = [],
      blocked_domains = [],
      max_results = 10
    } = params;

    try {
      // Rate limiting
      const now = Date.now();
      if (now - this.lastRequestTime < this.minRequestInterval) {
        await this.sleep(this.minRequestInterval - (now - this.lastRequestTime));
      }
      this.lastRequestTime = Date.now();

      // Check cache
      const cacheKey = JSON.stringify({ query, allowed_domains, blocked_domains });
      const cached = this.cache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
        return {
          success: true,
          results: cached.results.slice(0, max_results),
          cached: true,
          query
        };
      }

      // Try multiple search providers
      let results = [];
      let error = null;

      // Try DuckDuckGo HTML API (no API key required)
      try {
        results = await this.searchDuckDuckGo(query, max_results);
      } catch (e) {
        error = e;
        // Fallback to a simple web scraping approach
        try {
          results = await this.searchFallback(query, max_results);
        } catch (e2) {
          error = e2;
        }
      }

      // Filter results by domain
      if (allowed_domains.length > 0) {
        results = results.filter(r => {
          const host = this.extractHost(r.url);
          return allowed_domains.some(d => host.includes(d));
        });
      }

      if (blocked_domains.length > 0) {
        results = results.filter(r => {
          const host = this.extractHost(r.url);
          return !blocked_domains.some(d => host.includes(d));
        });
      }

      // Cache results
      if (results.length > 0) {
        this.cache.set(cacheKey, {
          results,
          timestamp: Date.now()
        });
        this.cleanCache();
      }

      if (results.length === 0 && error) {
        return {
          success: false,
          error: `Search failed: ${error.message}`,
          query
        };
      }

      return {
        success: true,
        results: results.slice(0, max_results),
        query,
        totalResults: results.length
      };

    } catch (error) {
      return {
        success: false,
        error: error.message,
        query
      };
    }
  }

  /**
   * Search using DuckDuckGo HTML
   * @param {string} query - Search query
   * @param {number} maxResults - Maximum results
   * @returns {Array} Search results
   */
  async searchDuckDuckGo(query, maxResults) {
    const encodedQuery = encodeURIComponent(query);
    const url = `https://html.duckduckgo.com/html/?q=${encodedQuery}`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Grok-Code/2.0)',
        'Accept': 'text/html'
      }
    });

    if (!response.ok) {
      throw new Error(`DuckDuckGo returned ${response.status}`);
    }

    const html = await response.text();
    return this.parseDuckDuckGoResults(html, maxResults);
  }

  /**
   * Parse DuckDuckGo HTML results
   * @param {string} html - HTML content
   * @param {number} maxResults - Maximum results
   * @returns {Array} Parsed results
   */
  parseDuckDuckGoResults(html, maxResults) {
    const results = [];

    // Extract result links
    const resultPattern = /<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>/gi;
    const snippetPattern = /<a[^>]*class="result__snippet"[^>]*>([^<]+)<\/a>/gi;

    let match;
    const links = [];
    const titles = [];
    const snippets = [];

    // Extract URLs and titles
    while ((match = resultPattern.exec(html)) !== null && links.length < maxResults) {
      let url = match[1];
      // DuckDuckGo wraps URLs - extract actual URL
      if (url.includes('uddg=')) {
        const urlMatch = url.match(/uddg=([^&]+)/);
        if (urlMatch) {
          url = decodeURIComponent(urlMatch[1]);
        }
      }
      links.push(url);
      titles.push(this.decodeHtmlEntities(match[2].trim()));
    }

    // Extract snippets
    while ((match = snippetPattern.exec(html)) !== null) {
      snippets.push(this.decodeHtmlEntities(match[1].trim()));
    }

    // Combine into results
    for (let i = 0; i < links.length && i < maxResults; i++) {
      results.push({
        title: titles[i] || 'No title',
        url: links[i],
        snippet: snippets[i] || 'No description available'
      });
    }

    return results;
  }

  /**
   * Fallback search using a simple approach
   * @param {string} query - Search query
   * @param {number} maxResults - Maximum results
   * @returns {Array} Search results
   */
  async searchFallback(query, maxResults) {
    // This is a simplified fallback that suggests common documentation sites
    const suggestions = [
      {
        title: `Search for "${query}" on MDN`,
        url: `https://developer.mozilla.org/en-US/search?q=${encodeURIComponent(query)}`,
        snippet: 'Mozilla Developer Network - Web technology documentation'
      },
      {
        title: `Search for "${query}" on Stack Overflow`,
        url: `https://stackoverflow.com/search?q=${encodeURIComponent(query)}`,
        snippet: 'Stack Overflow - Programming Q&A community'
      },
      {
        title: `Search for "${query}" on GitHub`,
        url: `https://github.com/search?q=${encodeURIComponent(query)}`,
        snippet: 'GitHub - Code hosting and collaboration'
      },
      {
        title: `Search for "${query}" on npm`,
        url: `https://www.npmjs.com/search?q=${encodeURIComponent(query)}`,
        snippet: 'npm - Node.js package registry'
      }
    ];

    return suggestions.slice(0, maxResults);
  }

  /**
   * Extract host from URL
   * @param {string} url - URL string
   * @returns {string} Host portion
   */
  extractHost(url) {
    try {
      return new URL(url).host;
    } catch {
      return url;
    }
  }

  /**
   * Decode HTML entities
   * @param {string} text - Text with HTML entities
   * @returns {string} Decoded text
   */
  decodeHtmlEntities(text) {
    return text
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, ' ');
  }

  /**
   * Sleep for specified milliseconds
   * @param {number} ms - Milliseconds to sleep
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
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
   * Format results for display
   * @param {Object} result - Search result
   * @returns {string} Formatted output
   */
  formatResult(result) {
    if (!result.success) {
      return `Search failed: ${result.error}`;
    }

    let output = `## Search Results for: ${result.query}\n\n`;

    if (result.results.length === 0) {
      output += 'No results found.\n';
    } else {
      for (const r of result.results) {
        output += `### [${r.title}](${r.url})\n`;
        output += `${r.snippet}\n\n`;
      }

      if (result.cached) {
        output += '\n*Results from cache*';
      }
    }

    return output;
  }
}

export default WebSearchTool;
