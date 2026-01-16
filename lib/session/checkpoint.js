/**
 * Checkpoint Manager
 * Manages session checkpoints for save/restore functionality
 */

import fs from 'fs-extra';
import path from 'path';
import crypto from 'crypto';

export class CheckpointManager {
  constructor(options = {}) {
    this.sessionsDir = options.sessionsDir ||
      path.join(process.env.HOME || '', '.grok', 'sessions');
    this.maxCheckpoints = options.maxCheckpoints || 10;
  }

  /**
   * Get checkpoints directory for a session
   * @param {string} sessionId - Session ID
   * @returns {string} Checkpoints directory path
   */
  getCheckpointsDir(sessionId) {
    return path.join(this.sessionsDir, sessionId, 'checkpoints');
  }

  /**
   * Create a checkpoint
   * @param {string} sessionId - Session ID
   * @param {Object} data - Checkpoint data
   * @returns {Promise<string>} Checkpoint ID
   */
  async create(sessionId, data) {
    const checkpointsDir = this.getCheckpointsDir(sessionId);
    await fs.ensureDir(checkpointsDir);

    // Generate checkpoint ID
    const checkpointId = `cp-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;

    // Create checkpoint
    const checkpoint = {
      id: checkpointId,
      name: data.name || `Checkpoint ${new Date().toLocaleString()}`,
      timestamp: data.timestamp || new Date().toISOString(),
      session: data.session,
      metadata: {
        messageCount: data.session?.messages?.length || 0,
        filesInContext: Object.keys(data.session?.fileContext || {}).length
      }
    };

    // Save checkpoint
    const checkpointPath = path.join(checkpointsDir, `${checkpointId}.json`);
    await fs.writeJson(checkpointPath, checkpoint, { spaces: 2 });

    // Clean up old checkpoints if needed
    await this.cleanup(sessionId);

    return checkpointId;
  }

  /**
   * Restore from a checkpoint
   * @param {string} sessionId - Session ID
   * @param {string} checkpointId - Checkpoint ID
   * @returns {Promise<Object|null>} Checkpoint data or null
   */
  async restore(sessionId, checkpointId) {
    const checkpointPath = path.join(
      this.getCheckpointsDir(sessionId),
      `${checkpointId}.json`
    );

    try {
      if (!await fs.pathExists(checkpointPath)) {
        return null;
      }

      return await fs.readJson(checkpointPath);
    } catch (error) {
      return null;
    }
  }

  /**
   * List all checkpoints for a session
   * @param {string} sessionId - Session ID
   * @returns {Promise<Array>} Checkpoints
   */
  async list(sessionId) {
    const checkpointsDir = this.getCheckpointsDir(sessionId);
    const checkpoints = [];

    try {
      if (!await fs.pathExists(checkpointsDir)) {
        return checkpoints;
      }

      const files = await fs.readdir(checkpointsDir);

      for (const file of files) {
        if (!file.endsWith('.json')) continue;

        const checkpointPath = path.join(checkpointsDir, file);

        try {
          const checkpoint = await fs.readJson(checkpointPath);
          checkpoints.push({
            id: checkpoint.id,
            name: checkpoint.name,
            timestamp: checkpoint.timestamp,
            metadata: checkpoint.metadata
          });
        } catch (e) {
          continue;
        }
      }

      // Sort by timestamp (most recent first)
      checkpoints.sort((a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );

      return checkpoints;
    } catch (error) {
      return checkpoints;
    }
  }

  /**
   * Delete a checkpoint
   * @param {string} sessionId - Session ID
   * @param {string} checkpointId - Checkpoint ID
   * @returns {Promise<boolean>} Success
   */
  async delete(sessionId, checkpointId) {
    const checkpointPath = path.join(
      this.getCheckpointsDir(sessionId),
      `${checkpointId}.json`
    );

    try {
      if (await fs.pathExists(checkpointPath)) {
        await fs.remove(checkpointPath);
        return true;
      }
      return false;
    } catch (error) {
      return false;
    }
  }

  /**
   * Clean up old checkpoints
   * @param {string} sessionId - Session ID
   */
  async cleanup(sessionId) {
    const checkpoints = await this.list(sessionId);

    if (checkpoints.length > this.maxCheckpoints) {
      // Delete oldest checkpoints
      const toDelete = checkpoints.slice(this.maxCheckpoints);

      for (const checkpoint of toDelete) {
        await this.delete(sessionId, checkpoint.id);
      }
    }
  }

  /**
   * Get the latest checkpoint
   * @param {string} sessionId - Session ID
   * @returns {Promise<Object|null>} Latest checkpoint or null
   */
  async getLatest(sessionId) {
    const checkpoints = await this.list(sessionId);

    if (checkpoints.length === 0) {
      return null;
    }

    return this.restore(sessionId, checkpoints[0].id);
  }

  /**
   * Compare two checkpoints
   * @param {string} sessionId - Session ID
   * @param {string} checkpointId1 - First checkpoint ID
   * @param {string} checkpointId2 - Second checkpoint ID
   * @returns {Promise<Object>} Comparison result
   */
  async compare(sessionId, checkpointId1, checkpointId2) {
    const cp1 = await this.restore(sessionId, checkpointId1);
    const cp2 = await this.restore(sessionId, checkpointId2);

    if (!cp1 || !cp2) {
      return { error: 'One or both checkpoints not found' };
    }

    const messages1 = cp1.session?.messages || [];
    const messages2 = cp2.session?.messages || [];
    const files1 = Object.keys(cp1.session?.fileContext || {});
    const files2 = Object.keys(cp2.session?.fileContext || {});

    return {
      checkpoint1: {
        id: checkpointId1,
        name: cp1.name,
        timestamp: cp1.timestamp,
        messageCount: messages1.length,
        fileCount: files1.length
      },
      checkpoint2: {
        id: checkpointId2,
        name: cp2.name,
        timestamp: cp2.timestamp,
        messageCount: messages2.length,
        fileCount: files2.length
      },
      differences: {
        messagesDelta: messages2.length - messages1.length,
        filesDelta: files2.length - files1.length,
        newMessages: messages2.slice(messages1.length),
        newFiles: files2.filter(f => !files1.includes(f)),
        removedFiles: files1.filter(f => !files2.includes(f))
      }
    };
  }
}
