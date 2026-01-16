/**
 * Backup Manager
 * Manages file backups for safe editing operations
 */

import fs from 'fs-extra';
import path from 'path';
import crypto from 'crypto';

export class BackupManager {
  constructor(options = {}) {
    this.backupsDir = options.backupsDir || path.join(process.cwd(), '.grok', 'backups');
    this.maxBackupsPerFile = options.maxBackupsPerFile || 10;
    this.maxTotalBackups = options.maxTotalBackups || 100;
    this.maxBackupAge = options.maxBackupAge || 7 * 24 * 60 * 60 * 1000; // 7 days

    // Backup index for quick lookup
    this.backupIndex = new Map();
  }

  /**
   * Initialize the backup system
   */
  async initialize() {
    await fs.ensureDir(this.backupsDir);
    await this.loadIndex();
    await this.cleanupOldBackups();
  }

  /**
   * Load backup index from disk
   */
  async loadIndex() {
    const indexPath = path.join(this.backupsDir, 'index.json');

    try {
      if (await fs.pathExists(indexPath)) {
        const data = await fs.readJson(indexPath);
        this.backupIndex = new Map(Object.entries(data));
      }
    } catch (error) {
      // Start with empty index if load fails
      this.backupIndex = new Map();
    }
  }

  /**
   * Save backup index to disk
   */
  async saveIndex() {
    const indexPath = path.join(this.backupsDir, 'index.json');
    const data = Object.fromEntries(this.backupIndex);
    await fs.writeJson(indexPath, data, { spaces: 2 });
  }

  /**
   * Create a backup of a file before modification
   * @param {string} filePath - Path to the file to backup
   * @param {string} reason - Reason for the backup (e.g., 'edit', 'write')
   * @returns {Promise<Object>} Backup info
   */
  async createBackup(filePath, reason = 'edit') {
    const absolutePath = path.resolve(filePath);

    // Check if file exists
    if (!await fs.pathExists(absolutePath)) {
      return {
        success: false,
        error: 'File does not exist',
        filePath: absolutePath
      };
    }

    // Read file content
    const content = await fs.readFile(absolutePath);
    const stats = await fs.stat(absolutePath);

    // Generate backup ID
    const timestamp = Date.now();
    const hash = crypto.createHash('md5').update(content).digest('hex').substring(0, 8);
    const backupId = `${timestamp}-${hash}`;

    // Create backup filename
    const relativePath = path.relative(process.cwd(), absolutePath);
    const safePath = relativePath.replace(/[/\\]/g, '_').replace(/[^a-zA-Z0-9._-]/g, '_');
    const backupFilename = `${safePath}.${backupId}.bak`;
    const backupPath = path.join(this.backupsDir, backupFilename);

    // Save backup
    await fs.writeFile(backupPath, content);

    // Create backup metadata
    const backupInfo = {
      id: backupId,
      originalPath: absolutePath,
      relativePath,
      backupPath,
      backupFilename,
      reason,
      timestamp: new Date(timestamp).toISOString(),
      size: stats.size,
      hash,
      mtime: stats.mtime.toISOString()
    };

    // Update index
    const fileKey = absolutePath;
    if (!this.backupIndex.has(fileKey)) {
      this.backupIndex.set(fileKey, []);
    }

    const fileBackups = this.backupIndex.get(fileKey);
    fileBackups.unshift(backupInfo);

    // Limit backups per file
    if (fileBackups.length > this.maxBackupsPerFile) {
      const removed = fileBackups.splice(this.maxBackupsPerFile);
      for (const old of removed) {
        await this.deleteBackupFile(old.backupPath);
      }
    }

    await this.saveIndex();

    return {
      success: true,
      backup: backupInfo
    };
  }

  /**
   * Restore a file from a backup
   * @param {string} backupId - Backup ID to restore
   * @returns {Promise<Object>} Restore result
   */
  async restoreBackup(backupId) {
    // Find backup in index
    let backupInfo = null;
    let fileKey = null;

    for (const [key, backups] of this.backupIndex) {
      const found = backups.find(b => b.id === backupId);
      if (found) {
        backupInfo = found;
        fileKey = key;
        break;
      }
    }

    if (!backupInfo) {
      return {
        success: false,
        error: 'Backup not found'
      };
    }

    // Check if backup file exists
    if (!await fs.pathExists(backupInfo.backupPath)) {
      return {
        success: false,
        error: 'Backup file is missing'
      };
    }

    // Create backup of current state before restoring
    if (await fs.pathExists(backupInfo.originalPath)) {
      await this.createBackup(backupInfo.originalPath, 'pre-restore');
    }

    // Restore the file
    await fs.copy(backupInfo.backupPath, backupInfo.originalPath);

    return {
      success: true,
      restoredFrom: backupInfo,
      path: backupInfo.originalPath
    };
  }

  /**
   * Restore the most recent backup for a file
   * @param {string} filePath - Path to the file
   * @returns {Promise<Object>} Restore result
   */
  async restoreLatest(filePath) {
    const absolutePath = path.resolve(filePath);
    const backups = this.backupIndex.get(absolutePath);

    if (!backups || backups.length === 0) {
      return {
        success: false,
        error: 'No backups found for this file'
      };
    }

    return this.restoreBackup(backups[0].id);
  }

  /**
   * List backups for a specific file
   * @param {string} filePath - Path to the file
   * @returns {Array} List of backups
   */
  listBackups(filePath) {
    const absolutePath = path.resolve(filePath);
    return this.backupIndex.get(absolutePath) || [];
  }

  /**
   * List all backups
   * @returns {Array} All backups sorted by timestamp
   */
  listAllBackups() {
    const allBackups = [];

    for (const [, backups] of this.backupIndex) {
      allBackups.push(...backups);
    }

    // Sort by timestamp (newest first)
    allBackups.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    return allBackups;
  }

  /**
   * Delete a specific backup
   * @param {string} backupId - Backup ID to delete
   * @returns {Promise<boolean>} Success
   */
  async deleteBackup(backupId) {
    for (const [fileKey, backups] of this.backupIndex) {
      const index = backups.findIndex(b => b.id === backupId);

      if (index !== -1) {
        const backup = backups[index];
        await this.deleteBackupFile(backup.backupPath);
        backups.splice(index, 1);

        if (backups.length === 0) {
          this.backupIndex.delete(fileKey);
        }

        await this.saveIndex();
        return true;
      }
    }

    return false;
  }

  /**
   * Delete backup file from disk
   * @param {string} backupPath - Path to backup file
   */
  async deleteBackupFile(backupPath) {
    try {
      if (await fs.pathExists(backupPath)) {
        await fs.remove(backupPath);
      }
    } catch (error) {
      // Ignore deletion errors
    }
  }

  /**
   * Cleanup old backups
   */
  async cleanupOldBackups() {
    const now = Date.now();
    const cutoff = now - this.maxBackupAge;
    let totalBackups = 0;

    for (const [fileKey, backups] of this.backupIndex) {
      // Remove old backups
      const validBackups = [];

      for (const backup of backups) {
        const backupTime = new Date(backup.timestamp).getTime();

        if (backupTime >= cutoff) {
          validBackups.push(backup);
        } else {
          await this.deleteBackupFile(backup.backupPath);
        }
      }

      if (validBackups.length === 0) {
        this.backupIndex.delete(fileKey);
      } else {
        this.backupIndex.set(fileKey, validBackups);
        totalBackups += validBackups.length;
      }
    }

    // If still too many backups, remove oldest
    if (totalBackups > this.maxTotalBackups) {
      const allBackups = this.listAllBackups();
      const toRemove = allBackups.slice(this.maxTotalBackups);

      for (const backup of toRemove) {
        await this.deleteBackup(backup.id);
      }
    }

    await this.saveIndex();
  }

  /**
   * Get backup statistics
   * @returns {Object} Statistics
   */
  getStats() {
    const allBackups = this.listAllBackups();
    const totalSize = allBackups.reduce((sum, b) => sum + (b.size || 0), 0);

    return {
      totalBackups: allBackups.length,
      totalSize,
      totalSizeFormatted: this.formatSize(totalSize),
      uniqueFiles: this.backupIndex.size,
      oldestBackup: allBackups.length > 0 ? allBackups[allBackups.length - 1].timestamp : null,
      newestBackup: allBackups.length > 0 ? allBackups[0].timestamp : null
    };
  }

  /**
   * Format file size for display
   * @param {number} bytes - Size in bytes
   * @returns {string} Formatted size
   */
  formatSize(bytes) {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(1)} ${units[unitIndex]}`;
  }

  /**
   * Compare a backup with current file state
   * @param {string} backupId - Backup ID
   * @returns {Promise<Object>} Comparison result
   */
  async compareWithCurrent(backupId) {
    let backupInfo = null;

    for (const [, backups] of this.backupIndex) {
      const found = backups.find(b => b.id === backupId);
      if (found) {
        backupInfo = found;
        break;
      }
    }

    if (!backupInfo) {
      return { error: 'Backup not found' };
    }

    const backupContent = await fs.readFile(backupInfo.backupPath, 'utf8');

    let currentContent = null;
    let currentExists = false;

    if (await fs.pathExists(backupInfo.originalPath)) {
      currentContent = await fs.readFile(backupInfo.originalPath, 'utf8');
      currentExists = true;
    }

    return {
      backup: {
        id: backupId,
        timestamp: backupInfo.timestamp,
        content: backupContent,
        size: backupInfo.size
      },
      current: {
        exists: currentExists,
        content: currentContent,
        size: currentContent ? Buffer.byteLength(currentContent) : 0
      },
      identical: currentContent === backupContent
    };
  }
}

/**
 * Action History for undo/redo functionality
 */
export class ActionHistory {
  constructor(options = {}) {
    this.maxActions = options.maxActions || 50;
    this.actions = [];
    this.undoneActions = [];
    this.backupManager = options.backupManager;
  }

  /**
   * Record an action
   * @param {Object} action - Action details
   */
  record(action) {
    this.actions.push({
      ...action,
      timestamp: new Date().toISOString(),
      id: Date.now()
    });

    // Clear redo stack when new action is recorded
    this.undoneActions = [];

    // Limit history size
    if (this.actions.length > this.maxActions) {
      this.actions.shift();
    }
  }

  /**
   * Undo the last action
   * @returns {Promise<Object>} Undo result
   */
  async undo() {
    if (this.actions.length === 0) {
      return { success: false, message: 'Nothing to undo' };
    }

    const action = this.actions.pop();
    this.undoneActions.push(action);

    try {
      switch (action.type) {
        case 'file_edit':
        case 'file_write':
          if (action.backupId && this.backupManager) {
            const result = await this.backupManager.restoreBackup(action.backupId);
            return {
              success: result.success,
              action,
              message: result.success ? `Restored ${action.filePath}` : result.error
            };
          }
          break;

        case 'file_delete':
          if (action.backupId && this.backupManager) {
            const result = await this.backupManager.restoreBackup(action.backupId);
            return {
              success: result.success,
              action,
              message: result.success ? `Restored deleted file ${action.filePath}` : result.error
            };
          }
          break;

        case 'file_create':
          // Delete the created file
          if (await fs.pathExists(action.filePath)) {
            await fs.remove(action.filePath);
            return {
              success: true,
              action,
              message: `Removed created file ${action.filePath}`
            };
          }
          break;

        default:
          return {
            success: false,
            message: `Cannot undo action type: ${action.type}`
          };
      }

      return { success: false, message: 'Unable to undo action' };
    } catch (error) {
      // Put action back if undo failed
      this.undoneActions.pop();
      this.actions.push(action);

      return {
        success: false,
        message: `Undo failed: ${error.message}`
      };
    }
  }

  /**
   * Redo the last undone action
   * @returns {Promise<Object>} Redo result
   */
  async redo() {
    if (this.undoneActions.length === 0) {
      return { success: false, message: 'Nothing to redo' };
    }

    const action = this.undoneActions.pop();
    this.actions.push(action);

    // Note: Redo would need to re-execute the original action
    // This is a simplified implementation
    return {
      success: true,
      action,
      message: `Action marked as redone (manual verification may be needed)`
    };
  }

  /**
   * Get recent actions
   * @param {number} limit - Max actions to return
   * @returns {Array} Recent actions
   */
  getRecent(limit = 10) {
    return this.actions.slice(-limit).reverse();
  }

  /**
   * Clear history
   */
  clear() {
    this.actions = [];
    this.undoneActions = [];
  }
}
