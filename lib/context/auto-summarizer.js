/**
 * Auto-Summarizer
 * AI-powered conversation summarization for context compaction
 * Uses Grok API to generate intelligent summaries
 */

import fs from 'fs-extra';
import path from 'path';

export class AutoSummarizer {
  constructor(options = {}) {
    this.grokClient = options.grokClient;
    this.maxSummaryTokens = options.maxSummaryTokens || 2000;
    this.compressionRatio = options.compressionRatio || 0.1; // Target 10% of original
    this.minMessagesForSummary = options.minMessagesForSummary || 5;

    // Summary cache
    this.summaryCache = new Map();

    // Summarization prompts
    this.systemPrompt = `You are a conversation summarizer. Your task is to create concise, accurate summaries of conversations between a user and an AI coding assistant.

Focus on:
1. Key user requests and intents
2. Important decisions made
3. Files created, modified, or discussed
4. Code changes and their purposes
5. Errors encountered and resolutions
6. Important context for future reference

Output format:
- Use bullet points for clarity
- Group related items together
- Include file paths when relevant
- Note any unresolved issues
- Keep technical accuracy`;
  }

  /**
   * Summarize a batch of messages using AI
   * @param {Array} messages - Messages to summarize
   * @param {Object} options - Summarization options
   * @returns {Promise<Object>} Summary object
   */
  async summarize(messages, options = {}) {
    if (messages.length < this.minMessagesForSummary) {
      return this.createBasicSummary(messages);
    }

    // Check cache
    const cacheKey = this.getCacheKey(messages);
    if (this.summaryCache.has(cacheKey)) {
      return this.summaryCache.get(cacheKey);
    }

    // If no API client, fall back to basic summary
    if (!this.grokClient) {
      return this.createBasicSummary(messages);
    }

    try {
      const prompt = this.buildSummarizationPrompt(messages, options);

      const response = await this.grokClient.chat({
        messages: [
          { role: 'system', content: this.systemPrompt },
          { role: 'user', content: prompt }
        ],
        maxTokens: this.maxSummaryTokens,
        temperature: 0.3, // Lower temperature for factual accuracy
        stream: false
      });

      const summaryContent = response.choices[0].message.content;

      const summary = {
        content: summaryContent,
        messageCount: messages.length,
        messageRange: {
          start: messages[0].id || 0,
          end: messages[messages.length - 1].id || messages.length - 1
        },
        timeRange: {
          start: messages[0].timestamp || Date.now(),
          end: messages[messages.length - 1].timestamp || Date.now()
        },
        originalTokens: this.estimateTokens(messages.map(m => m.content).join('\n')),
        summaryTokens: this.estimateTokens(summaryContent),
        createdAt: Date.now(),
        type: 'ai-generated'
      };

      // Cache the summary
      this.summaryCache.set(cacheKey, summary);

      return summary;
    } catch (error) {
      // Fallback to basic summary on error
      console.error('AI summarization failed, using basic summary:', error.message);
      return this.createBasicSummary(messages);
    }
  }

  /**
   * Create a basic summary without AI
   * @param {Array} messages - Messages to summarize
   * @returns {Object} Basic summary object
   */
  createBasicSummary(messages) {
    const userMessages = messages.filter(m => m.role === 'user');
    const assistantMessages = messages.filter(m => m.role === 'assistant');
    const toolMessages = messages.filter(m => m.role === 'tool');

    let content = '## Conversation Summary\n\n';

    // User requests
    if (userMessages.length > 0) {
      content += '### User Requests\n';
      for (const msg of userMessages) {
        const preview = msg.content.substring(0, 150).replace(/\n/g, ' ').trim();
        content += `- ${preview}${msg.content.length > 150 ? '...' : ''}\n`;
      }
      content += '\n';
    }

    // Assistant actions
    if (assistantMessages.length > 0) {
      content += '### Actions Taken\n';
      const actions = this.extractActions(assistantMessages);
      for (const action of actions) {
        content += `- ${action}\n`;
      }
      content += '\n';
    }

    // Tool usage summary
    if (toolMessages.length > 0) {
      content += `### Tools Used\n`;
      content += `- ${toolMessages.length} tool calls executed\n\n`;
    }

    // Metadata
    const startTime = messages[0]?.timestamp
      ? new Date(messages[0].timestamp).toLocaleString()
      : 'Unknown';
    const endTime = messages[messages.length - 1]?.timestamp
      ? new Date(messages[messages.length - 1].timestamp).toLocaleString()
      : 'Unknown';

    content += `_Period: ${startTime} to ${endTime}_\n`;
    content += `_Messages: ${messages.length}_\n`;

    return {
      content,
      messageCount: messages.length,
      messageRange: {
        start: messages[0]?.id || 0,
        end: messages[messages.length - 1]?.id || messages.length - 1
      },
      timeRange: {
        start: messages[0]?.timestamp || Date.now(),
        end: messages[messages.length - 1]?.timestamp || Date.now()
      },
      originalTokens: this.estimateTokens(messages.map(m => m.content).join('\n')),
      summaryTokens: this.estimateTokens(content),
      createdAt: Date.now(),
      type: 'basic'
    };
  }

  /**
   * Build prompt for AI summarization
   * @param {Array} messages - Messages to summarize
   * @param {Object} options - Options
   * @returns {string} Prompt text
   */
  buildSummarizationPrompt(messages, options = {}) {
    let prompt = 'Please summarize the following conversation:\n\n';
    prompt += '---\n\n';

    for (const msg of messages) {
      const role = msg.role.toUpperCase();
      const content = msg.content.substring(0, 2000); // Limit individual message length
      prompt += `**${role}:**\n${content}\n\n`;
    }

    prompt += '---\n\n';
    prompt += 'Create a concise summary that captures the key points, decisions, and actions from this conversation.';

    if (options.focusAreas) {
      prompt += ` Focus particularly on: ${options.focusAreas.join(', ')}.`;
    }

    return prompt;
  }

  /**
   * Extract actions from assistant messages
   * @param {Array} messages - Assistant messages
   * @returns {Array} Extracted actions
   */
  extractActions(messages) {
    const actions = new Set();

    for (const msg of messages) {
      const content = msg.content;

      // File operations
      if (content.match(/(?:created?|wrote?|updated?)\s+(?:file|the file)\s+[`"]?([^\s`"]+)/i)) {
        const match = content.match(/(?:created?|wrote?|updated?)\s+(?:file|the file)\s+[`"]?([^\s`"]+)/i);
        actions.add(`Modified file: ${match[1]}`);
      }

      // Edit operations
      if (content.includes('Edit') || content.includes('<edit>')) {
        actions.add('Made code edits');
      }

      // Read operations
      if (content.match(/(?:read|reading|analyzed)\s+(?:file|the file)/i)) {
        actions.add('Read and analyzed files');
      }

      // Code generation
      if (content.includes('```')) {
        actions.add('Generated code');
      }

      // Bash commands
      if (content.match(/(?:ran|executed|running)\s+(?:command|bash)/i)) {
        actions.add('Executed shell commands');
      }

      // Explanations
      if (content.length > 500 && !content.includes('```')) {
        actions.add('Provided explanations');
      }

      // Git operations
      if (content.match(/(?:committed|pushed|created\s+(?:branch|pr|pull request))/i)) {
        actions.add('Performed git operations');
      }
    }

    return Array.from(actions);
  }

  /**
   * Progressive summarization for very long conversations
   * @param {Array} summaries - Existing summaries to consolidate
   * @returns {Promise<Object>} Consolidated summary
   */
  async consolidateSummaries(summaries) {
    if (summaries.length < 2) {
      return summaries[0] || null;
    }

    if (!this.grokClient) {
      // Basic consolidation without AI
      return {
        content: summaries.map(s => s.content).join('\n\n---\n\n'),
        messageCount: summaries.reduce((sum, s) => sum + s.messageCount, 0),
        summaryTokens: this.estimateTokens(summaries.map(s => s.content).join('\n')),
        createdAt: Date.now(),
        type: 'consolidated-basic'
      };
    }

    const prompt = `Please consolidate these conversation summaries into a single, coherent summary:

${summaries.map((s, i) => `### Summary ${i + 1}\n${s.content}`).join('\n\n')}

Create a unified summary that:
1. Removes redundancy
2. Maintains chronological order where relevant
3. Preserves all important details
4. Is more concise than the combined summaries`;

    try {
      const response = await this.grokClient.chat({
        messages: [
          { role: 'system', content: this.systemPrompt },
          { role: 'user', content: prompt }
        ],
        maxTokens: this.maxSummaryTokens,
        temperature: 0.3,
        stream: false
      });

      return {
        content: response.choices[0].message.content,
        messageCount: summaries.reduce((sum, s) => sum + s.messageCount, 0),
        summaryTokens: this.estimateTokens(response.choices[0].message.content),
        consolidatedFrom: summaries.length,
        createdAt: Date.now(),
        type: 'consolidated-ai'
      };
    } catch (error) {
      // Fallback
      return {
        content: summaries.map(s => s.content).join('\n\n---\n\n'),
        messageCount: summaries.reduce((sum, s) => sum + s.messageCount, 0),
        summaryTokens: this.estimateTokens(summaries.map(s => s.content).join('\n')),
        createdAt: Date.now(),
        type: 'consolidated-basic'
      };
    }
  }

  /**
   * Estimate token count
   * @param {string} text - Text to estimate
   * @returns {number} Estimated tokens
   */
  estimateTokens(text) {
    if (!text) return 0;
    return Math.ceil(text.length / 4);
  }

  /**
   * Get cache key for messages
   * @param {Array} messages - Messages
   * @returns {string} Cache key
   */
  getCacheKey(messages) {
    const ids = messages.map(m => m.id || m.timestamp).join(',');
    return `summary:${ids}`;
  }

  /**
   * Clear summary cache
   */
  clearCache() {
    this.summaryCache.clear();
  }

  /**
   * Get cache stats
   * @returns {Object} Cache statistics
   */
  getCacheStats() {
    return {
      size: this.summaryCache.size,
      keys: Array.from(this.summaryCache.keys())
    };
  }
}

export default AutoSummarizer;
