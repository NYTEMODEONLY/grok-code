/**
 * Memory Manager
 * Handles conversation memory, summarization, and context compression
 * for maintaining long conversations within token limits
 */

import fs from 'fs-extra';
import path from 'path';

export class MemoryManager {
  constructor(options = {}) {
    this.maxTokens = options.maxTokens || 128000; // Default context window
    this.targetTokens = options.targetTokens || 100000; // Target after compression
    this.summaryTokens = options.summaryTokens || 2000; // Tokens for summaries

    // Conversation state
    this.messages = [];
    this.summaries = [];
    this.fileContext = {};

    // Memory store
    this.memoryDir = options.memoryDir || path.join(process.cwd(), '.grok', 'memory');
    this.sessionId = options.sessionId || Date.now().toString();

    // Token estimation (rough)
    this.tokensPerChar = 0.25; // ~4 chars per token

    // Important message markers
    this.importantRoles = ['system', 'user'];
    this.recentMessageCount = 10; // Always keep last N messages
  }

  /**
   * Initialize memory manager
   */
  async initialize() {
    await fs.ensureDir(this.memoryDir);
  }

  /**
   * Add a message to memory
   * @param {Object} message - Message object {role, content}
   */
  addMessage(message) {
    this.messages.push({
      ...message,
      timestamp: Date.now(),
      id: this.messages.length
    });

    // Check if compression is needed
    const totalTokens = this.estimateTotalTokens();
    if (totalTokens > this.targetTokens) {
      this.compress();
    }
  }

  /**
   * Add file to context
   * @param {string} filePath - File path
   * @param {string} content - File content
   */
  addFileContext(filePath, content) {
    this.fileContext[filePath] = {
      content,
      addedAt: Date.now(),
      tokens: this.estimateTokens(content)
    };
  }

  /**
   * Remove file from context
   * @param {string} filePath - File path
   */
  removeFileContext(filePath) {
    delete this.fileContext[filePath];
  }

  /**
   * Estimate tokens in text
   * @param {string} text - Text to estimate
   * @returns {number} Estimated token count
   */
  estimateTokens(text) {
    if (!text) return 0;
    return Math.ceil(text.length * this.tokensPerChar);
  }

  /**
   * Estimate total tokens in current context
   * @returns {number} Total estimated tokens
   */
  estimateTotalTokens() {
    let total = 0;

    // Messages
    for (const msg of this.messages) {
      total += this.estimateTokens(msg.content);
    }

    // Summaries
    for (const summary of this.summaries) {
      total += this.estimateTokens(summary.content);
    }

    // File context
    for (const file of Object.values(this.fileContext)) {
      total += file.tokens;
    }

    return total;
  }

  /**
   * Compress conversation by summarizing older messages
   */
  compress() {
    // Keep recent messages
    const recentMessages = this.messages.slice(-this.recentMessageCount);
    const olderMessages = this.messages.slice(0, -this.recentMessageCount);

    if (olderMessages.length === 0) {
      return; // Nothing to compress
    }

    // Create a summary of older messages
    const summary = this.createSummary(olderMessages);

    // Store the summary
    this.summaries.push({
      content: summary,
      messageRange: {
        start: olderMessages[0].id,
        end: olderMessages[olderMessages.length - 1].id
      },
      timestamp: Date.now()
    });

    // Keep only recent messages
    this.messages = recentMessages;

    // Compress file context if still over limit
    if (this.estimateTotalTokens() > this.targetTokens) {
      this.compressFileContext();
    }
  }

  /**
   * Create a summary of messages
   * @param {Array} messages - Messages to summarize
   * @returns {string} Summary text
   */
  createSummary(messages) {
    // Group messages by theme/topic
    const userMessages = messages.filter(m => m.role === 'user');
    const assistantMessages = messages.filter(m => m.role === 'assistant');

    let summary = '## Conversation Summary\n\n';

    // Summarize user requests
    if (userMessages.length > 0) {
      summary += '### User Requests:\n';
      for (const msg of userMessages) {
        const preview = msg.content.substring(0, 200).replace(/\n/g, ' ');
        summary += `- ${preview}${msg.content.length > 200 ? '...' : ''}\n`;
      }
      summary += '\n';
    }

    // Summarize key assistant actions
    if (assistantMessages.length > 0) {
      summary += '### Key Actions Taken:\n';

      for (const msg of assistantMessages) {
        // Extract key information from assistant messages
        const content = msg.content;

        // Check for file operations
        if (content.includes('<edit>') || content.includes('Edit tool')) {
          const fileMatch = content.match(/file[:\s]+([^\s\n]+)/i);
          if (fileMatch) {
            summary += `- Edited file: ${fileMatch[1]}\n`;
          }
        }

        // Check for code generation
        if (content.includes('```')) {
          summary += `- Generated code\n`;
        }

        // Check for explanations
        if (content.length > 500 && !content.includes('```')) {
          summary += `- Provided explanation/analysis\n`;
        }
      }
      summary += '\n';
    }

    // Note the time range
    const startTime = new Date(messages[0].timestamp).toLocaleString();
    const endTime = new Date(messages[messages.length - 1].timestamp).toLocaleString();
    summary += `_Messages from ${startTime} to ${endTime}_\n`;

    return summary;
  }

  /**
   * Compress file context by removing least recently used files
   */
  compressFileContext() {
    const files = Object.entries(this.fileContext);

    if (files.length === 0) return;

    // Sort by addedAt (oldest first)
    files.sort((a, b) => a[1].addedAt - b[1].addedAt);

    // Remove oldest files until under target
    while (this.estimateTotalTokens() > this.targetTokens && files.length > 1) {
      const [oldestPath] = files.shift();
      delete this.fileContext[oldestPath];
    }
  }

  /**
   * Get messages for API call
   * @returns {Array} Messages array for API
   */
  getMessagesForAPI() {
    const apiMessages = [];

    // Add summaries first (as system messages)
    if (this.summaries.length > 0) {
      const allSummaries = this.summaries.map(s => s.content).join('\n\n');
      apiMessages.push({
        role: 'system',
        content: `Previous conversation context:\n\n${allSummaries}`
      });
    }

    // Add recent messages
    for (const msg of this.messages) {
      apiMessages.push({
        role: msg.role,
        content: msg.content
      });
    }

    return apiMessages;
  }

  /**
   * Get file context for system prompt
   * @returns {string} File context string
   */
  getFileContextPrompt() {
    const files = Object.entries(this.fileContext);

    if (files.length === 0) return '';

    let prompt = '## Files in Context\n\n';

    for (const [filePath, info] of files) {
      prompt += `### ${filePath}\n\`\`\`\n${info.content}\n\`\`\`\n\n`;
    }

    return prompt;
  }

  /**
   * Save memory state to disk
   */
  async save() {
    const statePath = path.join(this.memoryDir, `${this.sessionId}.json`);

    await fs.writeJson(statePath, {
      sessionId: this.sessionId,
      messages: this.messages,
      summaries: this.summaries,
      fileContext: Object.keys(this.fileContext), // Only save paths, not content
      savedAt: new Date().toISOString()
    }, { spaces: 2 });
  }

  /**
   * Load memory state from disk
   * @param {string} sessionId - Session ID to load
   */
  async load(sessionId) {
    const statePath = path.join(this.memoryDir, `${sessionId}.json`);

    if (await fs.pathExists(statePath)) {
      const state = await fs.readJson(statePath);

      this.sessionId = state.sessionId;
      this.messages = state.messages || [];
      this.summaries = state.summaries || [];

      // Reload file content
      for (const filePath of state.fileContext || []) {
        if (await fs.pathExists(filePath)) {
          const content = await fs.readFile(filePath, 'utf8');
          this.addFileContext(filePath, content);
        }
      }

      return true;
    }

    return false;
  }

  /**
   * Get memory statistics
   * @returns {Object} Memory stats
   */
  getStats() {
    return {
      messageCount: this.messages.length,
      summaryCount: this.summaries.length,
      fileCount: Object.keys(this.fileContext).length,
      estimatedTokens: this.estimateTotalTokens(),
      maxTokens: this.maxTokens,
      utilizationPercent: Math.round((this.estimateTotalTokens() / this.maxTokens) * 100)
    };
  }

  /**
   * Clear all memory
   */
  clear() {
    this.messages = [];
    this.summaries = [];
    this.fileContext = {};
  }

  /**
   * Forget specific messages (by index range)
   * @param {number} startIndex - Start index
   * @param {number} endIndex - End index
   */
  forget(startIndex, endIndex) {
    this.messages.splice(startIndex, endIndex - startIndex + 1);
  }

  /**
   * Search through memory
   * @param {string} query - Search query
   * @returns {Array} Matching messages
   */
  search(query) {
    const results = [];
    const lowerQuery = query.toLowerCase();

    // Search messages
    for (const msg of this.messages) {
      if (msg.content.toLowerCase().includes(lowerQuery)) {
        results.push({
          type: 'message',
          ...msg,
          preview: this.getMatchPreview(msg.content, query)
        });
      }
    }

    // Search summaries
    for (const summary of this.summaries) {
      if (summary.content.toLowerCase().includes(lowerQuery)) {
        results.push({
          type: 'summary',
          ...summary,
          preview: this.getMatchPreview(summary.content, query)
        });
      }
    }

    return results;
  }

  /**
   * Get preview around match
   * @param {string} text - Full text
   * @param {string} query - Search query
   * @returns {string} Preview with context
   */
  getMatchPreview(text, query) {
    const index = text.toLowerCase().indexOf(query.toLowerCase());
    if (index === -1) return text.substring(0, 100);

    const start = Math.max(0, index - 50);
    const end = Math.min(text.length, index + query.length + 50);

    let preview = text.substring(start, end);
    if (start > 0) preview = '...' + preview;
    if (end < text.length) preview = preview + '...';

    return preview;
  }
}

export default MemoryManager;
