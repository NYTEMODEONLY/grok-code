/**
 * Session Manager
 * Manages Grok Code sessions with persistence and context
 */

import { EventEmitter } from 'events';
import fs from 'fs-extra';
import path from 'path';
import crypto from 'crypto';
import { TranscriptManager } from './transcript.js';
import { CheckpointManager } from './checkpoint.js';

export class SessionManager extends EventEmitter {
  constructor(options = {}) {
    super();

    this.sessionsDir = options.sessionsDir ||
      path.join(process.env.HOME || '', '.grok', 'sessions');
    this.projectSessionsDir = options.projectSessionsDir || '.grok/sessions';
    this.cwd = options.cwd || process.cwd();

    // Session state
    this.currentSession = null;
    this.sessionId = null;

    // Managers
    this.transcriptManager = new TranscriptManager({ sessionsDir: this.sessionsDir });
    this.checkpointManager = new CheckpointManager({ sessionsDir: this.sessionsDir });

    // Configuration
    this.autoSave = options.autoSave !== false;
    this.autoSaveInterval = options.autoSaveInterval || 30000; // 30 seconds
    this.maxSessionAge = options.maxSessionAge || 30 * 24 * 60 * 60 * 1000; // 30 days
    this.autoSaveTimer = null;
  }

  /**
   * Start a new session
   * @param {Object} options - Session options
   * @returns {Object} Session info
   */
  async startSession(options = {}) {
    // Generate session ID
    this.sessionId = options.sessionId || this.generateSessionId();

    // Create session object
    this.currentSession = {
      id: this.sessionId,
      startTime: new Date().toISOString(),
      cwd: this.cwd,
      model: options.model || 'grok-code-fast-1',
      messages: [],
      fileContext: {},
      metadata: {
        os: process.platform,
        nodeVersion: process.version,
        grokVersion: options.grokVersion || '1.20.0'
      }
    };

    // Create session directory
    const sessionDir = this.getSessionDir();
    await fs.ensureDir(sessionDir);

    // Save initial session state
    await this.saveSession();

    // Start auto-save if enabled
    if (this.autoSave) {
      this.startAutoSave();
    }

    this.emit('session:started', {
      sessionId: this.sessionId,
      cwd: this.cwd
    });

    return this.currentSession;
  }

  /**
   * Resume an existing session
   * @param {string} sessionId - Session ID to resume
   * @returns {Object|null} Session info or null
   */
  async resumeSession(sessionId) {
    const sessionPath = path.join(this.sessionsDir, sessionId, 'session.json');

    try {
      if (!await fs.pathExists(sessionPath)) {
        return null;
      }

      const session = await fs.readJson(sessionPath);

      this.sessionId = sessionId;
      this.currentSession = session;

      // Load transcript
      const transcript = await this.transcriptManager.load(sessionId);
      if (transcript) {
        this.currentSession.messages = transcript;
      }

      // Start auto-save
      if (this.autoSave) {
        this.startAutoSave();
      }

      this.emit('session:resumed', {
        sessionId,
        messageCount: this.currentSession.messages.length
      });

      return this.currentSession;
    } catch (error) {
      console.error(`Failed to resume session ${sessionId}: ${error.message}`);
      return null;
    }
  }

  /**
   * End the current session
   * @param {Object} options - End options
   */
  async endSession(options = {}) {
    if (!this.currentSession) return;

    // Stop auto-save
    this.stopAutoSave();

    // Update session end time
    this.currentSession.endTime = new Date().toISOString();

    // Save final state
    await this.saveSession();

    // Save transcript
    await this.transcriptManager.save(this.sessionId, this.currentSession.messages);

    this.emit('session:ended', {
      sessionId: this.sessionId,
      duration: Date.now() - new Date(this.currentSession.startTime).getTime()
    });

    this.currentSession = null;
    this.sessionId = null;
  }

  /**
   * Save current session state
   */
  async saveSession() {
    if (!this.currentSession) return;

    const sessionDir = this.getSessionDir();
    const sessionPath = path.join(sessionDir, 'session.json');

    await fs.ensureDir(sessionDir);
    await fs.writeJson(sessionPath, {
      ...this.currentSession,
      lastSaved: new Date().toISOString()
    }, { spaces: 2 });

    this.emit('session:saved', { sessionId: this.sessionId });
  }

  /**
   * Add a message to the session
   * @param {Object} message - Message to add
   */
  async addMessage(message) {
    if (!this.currentSession) return;

    this.currentSession.messages.push({
      ...message,
      timestamp: new Date().toISOString()
    });

    // Append to transcript
    await this.transcriptManager.append(this.sessionId, message);

    this.emit('message:added', {
      sessionId: this.sessionId,
      role: message.role
    });
  }

  /**
   * Update file context
   * @param {string} filePath - File path
   * @param {string} content - File content
   */
  updateFileContext(filePath, content) {
    if (!this.currentSession) return;

    this.currentSession.fileContext[filePath] = {
      content,
      addedAt: new Date().toISOString()
    };
  }

  /**
   * Remove from file context
   * @param {string} filePath - File path
   */
  removeFromFileContext(filePath) {
    if (!this.currentSession) return;

    delete this.currentSession.fileContext[filePath];
  }

  /**
   * Create a checkpoint
   * @param {string} name - Checkpoint name
   * @returns {Promise<string>} Checkpoint ID
   */
  async createCheckpoint(name) {
    if (!this.currentSession) return null;

    return this.checkpointManager.create(this.sessionId, {
      name,
      session: this.currentSession,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Restore from checkpoint
   * @param {string} checkpointId - Checkpoint ID
   * @returns {Promise<boolean>} Success
   */
  async restoreCheckpoint(checkpointId) {
    if (!this.sessionId) return false;

    const checkpoint = await this.checkpointManager.restore(this.sessionId, checkpointId);

    if (checkpoint) {
      this.currentSession = checkpoint.session;
      await this.saveSession();
      return true;
    }

    return false;
  }

  /**
   * List checkpoints for current session
   * @returns {Promise<Array>} Checkpoints
   */
  async listCheckpoints() {
    if (!this.sessionId) return [];

    return this.checkpointManager.list(this.sessionId);
  }

  /**
   * Get session directory
   * @returns {string} Session directory path
   */
  getSessionDir() {
    return path.join(this.sessionsDir, this.sessionId);
  }

  /**
   * Generate a unique session ID
   * @returns {string} Session ID
   */
  generateSessionId() {
    const timestamp = Date.now().toString(36);
    const random = crypto.randomBytes(4).toString('hex');
    return `${timestamp}-${random}`;
  }

  /**
   * Start auto-save timer
   */
  startAutoSave() {
    if (this.autoSaveTimer) return;

    this.autoSaveTimer = setInterval(() => {
      this.saveSession().catch(() => {});
    }, this.autoSaveInterval);
  }

  /**
   * Stop auto-save timer
   */
  stopAutoSave() {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
      this.autoSaveTimer = null;
    }
  }

  /**
   * List recent sessions
   * @param {number} limit - Maximum sessions to return
   * @returns {Promise<Array>} Recent sessions
   */
  async listRecentSessions(limit = 10) {
    const sessions = [];

    try {
      if (!await fs.pathExists(this.sessionsDir)) {
        return sessions;
      }

      const dirs = await fs.readdir(this.sessionsDir);

      for (const dir of dirs) {
        const sessionPath = path.join(this.sessionsDir, dir, 'session.json');

        try {
          if (await fs.pathExists(sessionPath)) {
            const session = await fs.readJson(sessionPath);
            sessions.push({
              id: dir,
              startTime: session.startTime,
              endTime: session.endTime,
              cwd: session.cwd,
              messageCount: session.messages?.length || 0
            });
          }
        } catch (e) {
          continue;
        }
      }

      // Sort by start time (most recent first)
      sessions.sort((a, b) =>
        new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
      );

      return sessions.slice(0, limit);
    } catch (error) {
      return sessions;
    }
  }

  /**
   * Clean up old sessions
   */
  async cleanupOldSessions() {
    try {
      if (!await fs.pathExists(this.sessionsDir)) {
        return;
      }

      const dirs = await fs.readdir(this.sessionsDir);
      const now = Date.now();

      for (const dir of dirs) {
        const sessionPath = path.join(this.sessionsDir, dir, 'session.json');

        try {
          const session = await fs.readJson(sessionPath);
          const sessionTime = new Date(session.startTime).getTime();

          if (now - sessionTime > this.maxSessionAge) {
            await fs.remove(path.join(this.sessionsDir, dir));
          }
        } catch (e) {
          continue;
        }
      }
    } catch (error) {
      console.warn(`Failed to cleanup old sessions: ${error.message}`);
    }
  }

  /**
   * Get current session info
   * @returns {Object|null} Current session
   */
  getCurrentSession() {
    return this.currentSession;
  }

  /**
   * Get session statistics
   * @returns {Object} Statistics
   */
  getStatistics() {
    if (!this.currentSession) {
      return { active: false };
    }

    const messages = this.currentSession.messages;
    const userMessages = messages.filter(m => m.role === 'user').length;
    const assistantMessages = messages.filter(m => m.role === 'assistant').length;
    const systemMessages = messages.filter(m => m.role === 'system').length;

    return {
      active: true,
      sessionId: this.sessionId,
      startTime: this.currentSession.startTime,
      duration: Date.now() - new Date(this.currentSession.startTime).getTime(),
      totalMessages: messages.length,
      userMessages,
      assistantMessages,
      systemMessages,
      filesInContext: Object.keys(this.currentSession.fileContext).length
    };
  }
}
