/**
 * Transcript Export
 * Export conversation transcripts in various formats
 * Supports Markdown, JSON, HTML, and plain text
 */

import fs from 'fs-extra';
import path from 'path';

export class TranscriptExporter {
  constructor(options = {}) {
    this.exportDir = options.exportDir || path.join(process.cwd(), '.grok', 'exports');
    this.includeToolCalls = options.includeToolCalls ?? true;
    this.includeMetadata = options.includeMetadata ?? true;
  }

  /**
   * Initialize exporter
   */
  async initialize() {
    await fs.ensureDir(this.exportDir);
  }

  /**
   * Export transcript to Markdown
   * @param {Array} messages - Conversation messages
   * @param {Object} options - Export options
   * @returns {Promise<string>} Export file path
   */
  async exportToMarkdown(messages, options = {}) {
    const {
      title = 'Grok Code Conversation',
      sessionId = Date.now().toString(),
      includeTimestamps = true
    } = options;

    let markdown = `# ${title}\n\n`;
    markdown += `**Session ID:** ${sessionId}\n`;
    markdown += `**Exported:** ${new Date().toISOString()}\n`;
    markdown += `**Messages:** ${messages.length}\n\n`;
    markdown += '---\n\n';

    for (const msg of messages) {
      const role = this.formatRole(msg.role);
      const timestamp = includeTimestamps && msg.timestamp
        ? `_${new Date(msg.timestamp).toLocaleString()}_`
        : '';

      markdown += `## ${role} ${timestamp}\n\n`;
      markdown += `${this.formatContent(msg.content, 'markdown')}\n\n`;

      // Include tool calls if present
      if (this.includeToolCalls && msg.tool_calls) {
        markdown += '### Tool Calls\n\n';
        for (const tc of msg.tool_calls) {
          markdown += `- **${tc.function?.name || tc.name}**\n`;
          if (tc.function?.arguments) {
            markdown += `  \`\`\`json\n  ${tc.function.arguments}\n  \`\`\`\n`;
          }
        }
        markdown += '\n';
      }

      markdown += '---\n\n';
    }

    const filename = `transcript-${sessionId}.md`;
    const filePath = path.join(this.exportDir, filename);
    await fs.writeFile(filePath, markdown, 'utf8');

    return filePath;
  }

  /**
   * Export transcript to JSON
   * @param {Array} messages - Conversation messages
   * @param {Object} options - Export options
   * @returns {Promise<string>} Export file path
   */
  async exportToJSON(messages, options = {}) {
    const {
      sessionId = Date.now().toString(),
      pretty = true
    } = options;

    const transcript = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      sessionId,
      messageCount: messages.length,
      messages: messages.map(msg => ({
        role: msg.role,
        content: msg.content,
        timestamp: msg.timestamp,
        id: msg.id,
        ...(msg.tool_calls && this.includeToolCalls ? { tool_calls: msg.tool_calls } : {})
      }))
    };

    if (this.includeMetadata && options.metadata) {
      transcript.metadata = options.metadata;
    }

    const filename = `transcript-${sessionId}.json`;
    const filePath = path.join(this.exportDir, filename);
    await fs.writeJson(filePath, transcript, { spaces: pretty ? 2 : 0 });

    return filePath;
  }

  /**
   * Export transcript to HTML
   * @param {Array} messages - Conversation messages
   * @param {Object} options - Export options
   * @returns {Promise<string>} Export file path
   */
  async exportToHTML(messages, options = {}) {
    const {
      title = 'Grok Code Conversation',
      sessionId = Date.now().toString(),
      theme = 'dark'
    } = options;

    const styles = this.getHTMLStyles(theme);
    let html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${this.escapeHtml(title)}</title>
  <style>${styles}</style>
</head>
<body>
  <div class="container">
    <header>
      <h1>${this.escapeHtml(title)}</h1>
      <p class="meta">Session: ${sessionId} | Exported: ${new Date().toLocaleString()}</p>
    </header>
    <main>
`;

    for (const msg of messages) {
      const roleClass = msg.role.toLowerCase();
      const timestamp = msg.timestamp
        ? `<span class="timestamp">${new Date(msg.timestamp).toLocaleString()}</span>`
        : '';

      html += `      <div class="message ${roleClass}">
        <div class="message-header">
          <span class="role">${this.formatRole(msg.role)}</span>
          ${timestamp}
        </div>
        <div class="message-content">
          ${this.formatContentHTML(msg.content)}
        </div>
`;

      if (this.includeToolCalls && msg.tool_calls) {
        html += `        <div class="tool-calls">
          <h4>Tool Calls:</h4>
`;
        for (const tc of msg.tool_calls) {
          html += `          <div class="tool-call">
            <strong>${this.escapeHtml(tc.function?.name || tc.name)}</strong>
            <pre>${this.escapeHtml(tc.function?.arguments || '')}</pre>
          </div>
`;
        }
        html += `        </div>
`;
      }

      html += `      </div>
`;
    }

    html += `    </main>
    <footer>
      <p>Generated by Grok Code</p>
    </footer>
  </div>
</body>
</html>`;

    const filename = `transcript-${sessionId}.html`;
    const filePath = path.join(this.exportDir, filename);
    await fs.writeFile(filePath, html, 'utf8');

    return filePath;
  }

  /**
   * Export transcript to plain text
   * @param {Array} messages - Conversation messages
   * @param {Object} options - Export options
   * @returns {Promise<string>} Export file path
   */
  async exportToText(messages, options = {}) {
    const {
      sessionId = Date.now().toString(),
      lineWidth = 80
    } = options;

    let text = '='.repeat(lineWidth) + '\n';
    text += 'GROK CODE CONVERSATION TRANSCRIPT\n';
    text += `Session: ${sessionId}\n`;
    text += `Exported: ${new Date().toISOString()}\n`;
    text += `Messages: ${messages.length}\n`;
    text += '='.repeat(lineWidth) + '\n\n';

    for (const msg of messages) {
      const role = this.formatRole(msg.role).toUpperCase();
      const timestamp = msg.timestamp
        ? ` [${new Date(msg.timestamp).toLocaleString()}]`
        : '';

      text += '-'.repeat(lineWidth) + '\n';
      text += `${role}${timestamp}\n`;
      text += '-'.repeat(lineWidth) + '\n';
      text += `${msg.content}\n\n`;

      if (this.includeToolCalls && msg.tool_calls) {
        text += 'TOOL CALLS:\n';
        for (const tc of msg.tool_calls) {
          text += `  - ${tc.function?.name || tc.name}\n`;
          if (tc.function?.arguments) {
            text += `    Args: ${tc.function.arguments}\n`;
          }
        }
        text += '\n';
      }
    }

    text += '='.repeat(lineWidth) + '\n';
    text += 'END OF TRANSCRIPT\n';
    text += '='.repeat(lineWidth) + '\n';

    const filename = `transcript-${sessionId}.txt`;
    const filePath = path.join(this.exportDir, filename);
    await fs.writeFile(filePath, text, 'utf8');

    return filePath;
  }

  /**
   * Export in JSONL format (for training/analysis)
   * @param {Array} messages - Conversation messages
   * @param {Object} options - Export options
   * @returns {Promise<string>} Export file path
   */
  async exportToJSONL(messages, options = {}) {
    const { sessionId = Date.now().toString() } = options;

    const lines = messages.map(msg => JSON.stringify({
      role: msg.role,
      content: msg.content,
      timestamp: msg.timestamp,
      ...(msg.tool_calls && this.includeToolCalls ? { tool_calls: msg.tool_calls } : {})
    }));

    const filename = `transcript-${sessionId}.jsonl`;
    const filePath = path.join(this.exportDir, filename);
    await fs.writeFile(filePath, lines.join('\n') + '\n', 'utf8');

    return filePath;
  }

  /**
   * Export to multiple formats at once
   * @param {Array} messages - Conversation messages
   * @param {Array<string>} formats - Formats to export
   * @param {Object} options - Export options
   * @returns {Promise<Object>} Export results
   */
  async exportMultiple(messages, formats = ['markdown', 'json'], options = {}) {
    const results = {};

    for (const format of formats) {
      try {
        switch (format.toLowerCase()) {
          case 'markdown':
          case 'md':
            results.markdown = await this.exportToMarkdown(messages, options);
            break;
          case 'json':
            results.json = await this.exportToJSON(messages, options);
            break;
          case 'html':
            results.html = await this.exportToHTML(messages, options);
            break;
          case 'text':
          case 'txt':
            results.text = await this.exportToText(messages, options);
            break;
          case 'jsonl':
            results.jsonl = await this.exportToJSONL(messages, options);
            break;
        }
      } catch (error) {
        results[format] = { error: error.message };
      }
    }

    return results;
  }

  /**
   * Format role name for display
   * @param {string} role - Role string
   * @returns {string} Formatted role
   */
  formatRole(role) {
    const roleMap = {
      user: 'User',
      assistant: 'Grok',
      system: 'System',
      tool: 'Tool Result'
    };
    return roleMap[role] || role;
  }

  /**
   * Format content for output
   * @param {string} content - Message content
   * @param {string} format - Output format
   * @returns {string} Formatted content
   */
  formatContent(content, format) {
    if (!content) return '';

    if (format === 'markdown') {
      return content;
    }

    return content;
  }

  /**
   * Format content for HTML output
   * @param {string} content - Message content
   * @returns {string} HTML formatted content
   */
  formatContentHTML(content) {
    if (!content) return '';

    // Escape HTML
    let html = this.escapeHtml(content);

    // Convert code blocks
    html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
      return `<pre><code class="language-${lang}">${code}</code></pre>`;
    });

    // Convert inline code
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

    // Convert newlines to <br> outside of code blocks
    html = html.replace(/\n/g, '<br>');

    return html;
  }

  /**
   * Escape HTML special characters
   * @param {string} text - Text to escape
   * @returns {string} Escaped text
   */
  escapeHtml(text) {
    const escapeMap = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, char => escapeMap[char]);
  }

  /**
   * Get HTML styles for export
   * @param {string} theme - Theme name
   * @returns {string} CSS styles
   */
  getHTMLStyles(theme) {
    const isDark = theme === 'dark';

    return `
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
        background: ${isDark ? '#1a1a2e' : '#ffffff'};
        color: ${isDark ? '#eee' : '#333'};
        line-height: 1.6;
      }
      .container {
        max-width: 900px;
        margin: 0 auto;
        padding: 2rem;
      }
      header {
        margin-bottom: 2rem;
        padding-bottom: 1rem;
        border-bottom: 1px solid ${isDark ? '#333' : '#ddd'};
      }
      header h1 {
        color: ${isDark ? '#fff' : '#000'};
        margin-bottom: 0.5rem;
      }
      .meta {
        color: ${isDark ? '#888' : '#666'};
        font-size: 0.9rem;
      }
      .message {
        margin-bottom: 1.5rem;
        padding: 1rem;
        border-radius: 8px;
        background: ${isDark ? '#16213e' : '#f5f5f5'};
      }
      .message.user {
        background: ${isDark ? '#0f3460' : '#e3f2fd'};
        border-left: 4px solid #2196f3;
      }
      .message.assistant {
        background: ${isDark ? '#1a1a2e' : '#f5f5f5'};
        border-left: 4px solid #4caf50;
      }
      .message.system {
        background: ${isDark ? '#2d132c' : '#fff3e0'};
        border-left: 4px solid #ff9800;
      }
      .message.tool {
        background: ${isDark ? '#1b262c' : '#f3e5f5'};
        border-left: 4px solid #9c27b0;
      }
      .message-header {
        display: flex;
        justify-content: space-between;
        margin-bottom: 0.5rem;
        font-size: 0.85rem;
      }
      .role {
        font-weight: bold;
        text-transform: uppercase;
      }
      .timestamp {
        color: ${isDark ? '#888' : '#666'};
      }
      .message-content {
        white-space: pre-wrap;
        word-wrap: break-word;
      }
      pre {
        background: ${isDark ? '#0f0f23' : '#272822'};
        color: ${isDark ? '#f8f8f2' : '#f8f8f2'};
        padding: 1rem;
        border-radius: 4px;
        overflow-x: auto;
        margin: 0.5rem 0;
      }
      code {
        background: ${isDark ? '#333' : '#e0e0e0'};
        padding: 0.2rem 0.4rem;
        border-radius: 3px;
        font-family: 'Monaco', 'Menlo', 'Consolas', monospace;
      }
      pre code {
        background: none;
        padding: 0;
      }
      .tool-calls {
        margin-top: 1rem;
        padding-top: 1rem;
        border-top: 1px dashed ${isDark ? '#333' : '#ddd'};
      }
      .tool-call {
        margin: 0.5rem 0;
      }
      footer {
        margin-top: 2rem;
        padding-top: 1rem;
        border-top: 1px solid ${isDark ? '#333' : '#ddd'};
        color: ${isDark ? '#666' : '#999'};
        text-align: center;
        font-size: 0.85rem;
      }
    `;
  }

  /**
   * List available exports
   * @returns {Promise<Array>} List of export files
   */
  async listExports() {
    await fs.ensureDir(this.exportDir);
    const files = await fs.readdir(this.exportDir);

    const exports = [];
    for (const file of files) {
      const filePath = path.join(this.exportDir, file);
      const stats = await fs.stat(filePath);

      exports.push({
        name: file,
        path: filePath,
        size: stats.size,
        created: stats.birthtime,
        format: path.extname(file).slice(1)
      });
    }

    return exports.sort((a, b) => b.created - a.created);
  }

  /**
   * Delete an export file
   * @param {string} filename - File to delete
   * @returns {Promise<boolean>} Success
   */
  async deleteExport(filename) {
    const filePath = path.join(this.exportDir, filename);
    if (await fs.pathExists(filePath)) {
      await fs.remove(filePath);
      return true;
    }
    return false;
  }
}

export default TranscriptExporter;
