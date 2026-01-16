/**
 * Transcript Manager
 * Manages conversation transcripts in JSONL format
 */

import fs from 'fs-extra';
import path from 'path';

export class TranscriptManager {
  constructor(options = {}) {
    this.sessionsDir = options.sessionsDir ||
      path.join(process.env.HOME || '', '.grok', 'sessions');
  }

  /**
   * Get transcript file path
   * @param {string} sessionId - Session ID
   * @returns {string} Transcript file path
   */
  getTranscriptPath(sessionId) {
    return path.join(this.sessionsDir, sessionId, 'transcript.jsonl');
  }

  /**
   * Save entire transcript
   * @param {string} sessionId - Session ID
   * @param {Array} messages - Messages to save
   */
  async save(sessionId, messages) {
    const transcriptPath = this.getTranscriptPath(sessionId);
    await fs.ensureDir(path.dirname(transcriptPath));

    const lines = messages.map(msg => JSON.stringify(msg)).join('\n');
    await fs.writeFile(transcriptPath, lines + '\n');
  }

  /**
   * Append a message to transcript
   * @param {string} sessionId - Session ID
   * @param {Object} message - Message to append
   */
  async append(sessionId, message) {
    const transcriptPath = this.getTranscriptPath(sessionId);
    await fs.ensureDir(path.dirname(transcriptPath));

    const line = JSON.stringify({
      ...message,
      timestamp: message.timestamp || new Date().toISOString()
    }) + '\n';

    await fs.appendFile(transcriptPath, line);
  }

  /**
   * Load transcript
   * @param {string} sessionId - Session ID
   * @returns {Promise<Array|null>} Messages or null
   */
  async load(sessionId) {
    const transcriptPath = this.getTranscriptPath(sessionId);

    try {
      if (!await fs.pathExists(transcriptPath)) {
        return null;
      }

      const content = await fs.readFile(transcriptPath, 'utf8');
      const lines = content.trim().split('\n').filter(Boolean);

      return lines.map(line => {
        try {
          return JSON.parse(line);
        } catch (e) {
          return null;
        }
      }).filter(Boolean);
    } catch (error) {
      return null;
    }
  }

  /**
   * Get transcript length
   * @param {string} sessionId - Session ID
   * @returns {Promise<number>} Number of messages
   */
  async getLength(sessionId) {
    const messages = await this.load(sessionId);
    return messages ? messages.length : 0;
  }

  /**
   * Get last N messages
   * @param {string} sessionId - Session ID
   * @param {number} count - Number of messages
   * @returns {Promise<Array>} Last messages
   */
  async getLastMessages(sessionId, count = 10) {
    const messages = await this.load(sessionId);

    if (!messages) return [];

    return messages.slice(-count);
  }

  /**
   * Search transcript
   * @param {string} sessionId - Session ID
   * @param {string} query - Search query
   * @returns {Promise<Array>} Matching messages
   */
  async search(sessionId, query) {
    const messages = await this.load(sessionId);

    if (!messages) return [];

    const lowerQuery = query.toLowerCase();

    return messages.filter(msg => {
      const content = (msg.content || '').toLowerCase();
      return content.includes(lowerQuery);
    });
  }

  /**
   * Export transcript to various formats
   * @param {string} sessionId - Session ID
   * @param {string} format - Export format (json, markdown, text)
   * @returns {Promise<string>} Exported content
   */
  async export(sessionId, format = 'json') {
    const messages = await this.load(sessionId);

    if (!messages) return '';

    switch (format) {
      case 'markdown':
        return this.exportMarkdown(messages);
      case 'text':
        return this.exportText(messages);
      case 'json':
      default:
        return JSON.stringify(messages, null, 2);
    }
  }

  /**
   * Export to markdown format
   * @param {Array} messages - Messages
   * @returns {string} Markdown content
   */
  exportMarkdown(messages) {
    return messages.map(msg => {
      const role = msg.role === 'user' ? '**You**' :
                   msg.role === 'assistant' ? '**Grok**' :
                   `*${msg.role}*`;

      return `### ${role}\n\n${msg.content}\n`;
    }).join('\n---\n\n');
  }

  /**
   * Export to plain text format
   * @param {Array} messages - Messages
   * @returns {string} Text content
   */
  exportText(messages) {
    return messages.map(msg => {
      const role = msg.role.toUpperCase();
      return `[${role}]\n${msg.content}\n`;
    }).join('\n' + '='.repeat(40) + '\n\n');
  }

  /**
   * Clear transcript
   * @param {string} sessionId - Session ID
   */
  async clear(sessionId) {
    const transcriptPath = this.getTranscriptPath(sessionId);

    if (await fs.pathExists(transcriptPath)) {
      await fs.remove(transcriptPath);
    }
  }
}
