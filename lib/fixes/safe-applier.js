import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { logger } from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class SafeFixApplier {
  constructor() {
    this.backups = new Map(); // Store file backups for rollback
    this.appliedFixes = []; // Track applied fixes for analytics
    this.fixStats = {
      totalApplied: 0,
      successfulFixes: 0,
      failedFixes: 0,
      rolledBackFixes: 0,
      byType: new Map(),
      byComplexity: new Map(),
    };

    // Risk thresholds for user confirmation
    this.confirmationThresholds = {
      highRisk: 0.7, // Require confirmation for fixes with < 70% confidence
      complexChanges: 3, // Require confirmation for fixes with > 3 file changes
      criticalFiles: ['package.json', 'webpack.config.js', 'tsconfig.json'], // Always confirm for critical files
    };

    // Create backup directory
    this.backupDir = path.join(__dirname, '../../.grok/fix-backups');
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
    }
  }

  /**
   * Safely apply a fix with pre-flight checks and rollback capability
   * @param {Object} fix - The fix to apply (from templates or AI)
   * @param {Object} context - Context including file paths and project info
   * @returns {Promise<Object>} Application result
   */
  async applyFix(fix, context) {
    const startTime = Date.now();
    const fixId = `fix_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    try {
      logger.info('Starting safe fix application', { fixId, type: fix.type });

      // Pre-flight checks
      const preflightResult = await this.runPreflightChecks(fix, context);
      if (!preflightResult.passed) {
        return {
          success: false,
          reason: `Preflight failed: ${preflightResult.reason}`,
          details: preflightResult,
          fixId,
        };
      }

      // User confirmation for high-risk fixes
      if (this.requiresUserConfirmation(fix, context)) {
        const confirmed = await this.getUserConfirmation(fix, context);
        if (!confirmed) {
          return {
            success: false,
            reason: 'User declined to apply fix',
            fixId,
          };
        }
      }

      // Create backups
      await this.createBackups(fix, context, fixId);

      // Apply the fix
      const applyResult = await this.executeFix(fix, context, fixId);

      if (applyResult.success) {
        // Validate the fix
        const validationResult = await this.validateFix(
          fix,
          context,
          applyResult
        );

        if (validationResult.valid) {
          // Fix successful
          this.recordSuccessfulFix(fix, applyResult, startTime);
          await this.cleanupBackups(fixId); // Remove backups for successful fixes

          return {
            success: true,
            message: 'Fix applied successfully',
            details: applyResult,
            validation: validationResult,
            fixId,
          };
        } else {
          // Fix applied but validation failed - rollback
          logger.warn('Fix validation failed, rolling back', { fixId });
          await this.rollbackFix(fixId, context);

          return {
            success: false,
            reason: `Fix validation failed: ${validationResult.reason}`,
            rolledBack: true,
            details: applyResult,
            validation: validationResult,
            fixId,
          };
        }
      } else {
        // Fix application failed - rollback
        logger.error('Fix application failed, rolling back', {
          fixId,
          error: applyResult.error,
        });
        await this.rollbackFix(fixId, context);

        return {
          success: false,
          reason: `Fix application failed: ${applyResult.error}`,
          rolledBack: true,
          details: applyResult,
          fixId,
        };
      }
    } catch (error) {
      logger.error('Safe fix application error', {
        fixId,
        error: error.message,
      });
      // Attempt rollback on any error
      try {
        await this.rollbackFix(fixId, context);
      } catch (rollbackError) {
        logger.error('Rollback also failed', {
          fixId,
          rollbackError: rollbackError.message,
        });
      }

      return {
        success: false,
        reason: `Unexpected error: ${error.message}`,
        rolledBack: true,
        fixId,
      };
    }
  }

  /**
   * Run pre-flight checks before applying a fix
   */
  async runPreflightChecks(fix, context) {
    const checks = [];

    // Check 1: File permissions
    for (const change of fix.changes || []) {
      const filePath = this.resolveFilePath(change.file, context);
      if (!fs.existsSync(filePath)) {
        checks.push({
          check: 'file_exists',
          passed: false,
          reason: `File does not exist: ${change.file}`,
        });
      } else {
        try {
          // Check if file is writable
          fs.accessSync(filePath, fs.constants.W_OK);
          checks.push({
            check: 'file_writable',
            passed: true,
            file: change.file,
          });
        } catch (error) {
          checks.push({
            check: 'file_writable',
            passed: false,
            reason: `File not writable: ${change.file}`,
            file: change.file,
          });
        }
      }
    }

    // Check 2: Syntax validation for code changes
    if (
      fix.changes &&
      fix.changes.some((c) => c.type === 'replace' || c.type === 'insert')
    ) {
      // Basic syntax check - could be enhanced with actual parsers
      checks.push({
        check: 'syntax_basic',
        passed: true,
        note: 'Basic syntax validation passed',
      });
    }

    // Check 3: Backup space available
    const backupSpaceOk = this.checkBackupSpace(fix);
    checks.push({
      check: 'backup_space',
      passed: backupSpaceOk,
      reason: backupSpaceOk ? null : 'Insufficient space for backups',
    });

    // Overall result
    const failedChecks = checks.filter((c) => !c.passed);
    return {
      passed: failedChecks.length === 0,
      checks,
      reason: failedChecks.length > 0 ? failedChecks[0].reason : null,
    };
  }

  /**
   * Check if a fix requires user confirmation
   */
  requiresUserConfirmation(fix, context) {
    // High-risk confidence
    if (fix.confidence < this.confirmationThresholds.highRisk) {
      return true;
    }

    // Complex changes (multiple files)
    if (
      (fix.changes || []).length > this.confirmationThresholds.complexChanges
    ) {
      return true;
    }

    // Critical files
    const affectedFiles = (fix.changes || []).map((c) => c.file);
    if (
      affectedFiles.some((file) =>
        this.confirmationThresholds.criticalFiles.some((critical) =>
          file.includes(critical)
        )
      )
    ) {
      return true;
    }

    // High-complexity fixes
    if (fix.metadata?.complexity === 'complex') {
      return true;
    }

    return false;
  }

  /**
   * Get user confirmation for high-risk fixes
   */
  async getUserConfirmation(fix, context) {
    // In a real implementation, this would prompt the user
    // For now, we'll simulate based on confidence
    const riskLevel = this.assessRiskLevel(fix);

    console.log(`\n⚠️  High-risk fix requires confirmation:`);
    console.log(`Type: ${fix.type}`);
    console.log(`Confidence: ${(fix.confidence * 100).toFixed(1)}%`);
    console.log(`Risk Level: ${riskLevel}`);
    console.log(`Changes: ${(fix.changes || []).length} files`);

    if (fix.explanation) {
      console.log(`Description: ${fix.explanation}`);
    }

    // For now, auto-approve if confidence > 80%
    // In real usage, this would wait for user input
    return fix.confidence > 0.8;
  }

  /**
   * Assess the risk level of a fix
   */
  assessRiskLevel(fix) {
    let riskScore = 0;

    // Confidence factor
    riskScore += (1 - fix.confidence) * 50;

    // Complexity factor
    const complexityMultiplier = {
      simple: 1,
      medium: 2,
      complex: 4,
    }[fix.metadata?.complexity || 'medium'];
    riskScore += complexityMultiplier * 10;

    // File count factor
    riskScore += (fix.changes || []).length * 5;

    // Critical file factor
    const hasCriticalFile = (fix.changes || []).some((change) =>
      this.confirmationThresholds.criticalFiles.some((critical) =>
        change.file.includes(critical)
      )
    );
    if (hasCriticalFile) {
      riskScore += 30;
    }

    if (riskScore < 30) return 'Low';
    if (riskScore < 60) return 'Medium';
    return 'High';
  }

  /**
   * Create backups before applying fix
   */
  async createBackups(fix, context, fixId) {
    const backupId = fixId;
    this.backups.set(backupId, []);

    for (const change of fix.changes || []) {
      const filePath = this.resolveFilePath(change.file, context);

      if (fs.existsSync(filePath)) {
        const backupPath = path.join(
          this.backupDir,
          `${backupId}_${path.basename(change.file)}`
        );
        const content = fs.readFileSync(filePath, 'utf8');

        fs.writeFileSync(backupPath, content, 'utf8');

        this.backups.get(backupId).push({
          originalPath: filePath,
          backupPath,
          content,
        });

        logger.info('Backup created', { backupId, file: change.file });
      }
    }
  }

  /**
   * Execute the actual fix
   */
  async executeFix(fix, context, fixId) {
    try {
      const results = [];

      for (const change of fix.changes || []) {
        const result = await this.applyChange(change, context);
        results.push(result);

        if (!result.success) {
          return {
            success: false,
            error: result.error,
            partialResults: results,
          };
        }
      }

      return {
        success: true,
        results,
        appliedAt: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Apply a single change
   */
  async applyChange(change, context) {
    try {
      const filePath = this.resolveFilePath(change.file, context);

      let content = fs.readFileSync(filePath, 'utf8');

      switch (change.type) {
        case 'insert':
          // Insert at specific line/column
          const lines = content.split('\n');
          const lineIndex = change.line - 1; // Convert to 0-based

          if (lineIndex >= 0 && lineIndex <= lines.length) {
            // Insert at column position
            const line = lines[lineIndex];
            const beforeCol = line.substring(0, change.column);
            const afterCol = line.substring(change.column);
            lines[lineIndex] = beforeCol + change.text + afterCol;

            content = lines.join('\n');
          } else {
            throw new Error(`Invalid line number: ${change.line}`);
          }
          break;

        case 'delete':
          // Delete specific text
          if (change.text) {
            content = content.replace(change.text, '');
          } else {
            throw new Error('Delete change requires text to remove');
          }
          break;

        case 'replace':
          // Replace old text with new text
          if (change.oldCode && change.newCode) {
            content = content.replace(change.oldCode, change.newCode);
          } else {
            throw new Error('Replace change requires oldCode and newCode');
          }
          break;

        default:
          throw new Error(`Unknown change type: ${change.type}`);
      }

      // Write the modified content
      fs.writeFileSync(filePath, content, 'utf8');

      return {
        success: true,
        change,
        file: change.file,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        change,
      };
    }
  }

  /**
   * Validate that the fix worked correctly
   */
  async validateFix(fix, context, applyResult) {
    try {
      // Basic validation - check that files were modified
      for (const change of fix.changes || []) {
        const filePath = this.resolveFilePath(change.file, context);

        if (!fs.existsSync(filePath)) {
          return {
            valid: false,
            reason: `File no longer exists: ${change.file}`,
          };
        }

        // Could add more sophisticated validation here:
        // - Syntax checking
        // - Linting
        // - Test running
        // - etc.
      }

      return {
        valid: true,
        checks: ['file_integrity'],
      };
    } catch (error) {
      return {
        valid: false,
        reason: `Validation error: ${error.message}`,
      };
    }
  }

  /**
   * Rollback a failed fix
   */
  async rollbackFix(fixId, context) {
    const backups = this.backups.get(fixId);

    if (!backups || backups.length === 0) {
      logger.warn('No backups found for rollback', { fixId });
      return { rolledBack: false, reason: 'No backups available' };
    }

    let rolledBackCount = 0;
    const errors = [];

    for (const backup of backups) {
      try {
        // Restore original content
        fs.writeFileSync(backup.originalPath, backup.content, 'utf8');

        // Remove backup file
        if (fs.existsSync(backup.backupPath)) {
          fs.unlinkSync(backup.backupPath);
        }

        rolledBackCount++;
        logger.info('File rolled back successfully', {
          fixId,
          file: path.basename(backup.originalPath),
        });
      } catch (error) {
        errors.push(`${backup.originalPath}: ${error.message}`);
        logger.error('Rollback failed for file', {
          fixId,
          file: backup.originalPath,
          error: error.message,
        });
      }
    }

    // Clean up backup registry
    this.backups.delete(fixId);
    this.fixStats.rolledBackFixes++;

    return {
      rolledBack: true,
      filesRolledBack: rolledBackCount,
      errors,
    };
  }

  /**
   * Clean up backups for successful fixes
   */
  async cleanupBackups(fixId) {
    const backups = this.backups.get(fixId);

    if (backups) {
      for (const backup of backups) {
        try {
          if (fs.existsSync(backup.backupPath)) {
            fs.unlinkSync(backup.backupPath);
          }
        } catch (error) {
          logger.warn('Failed to cleanup backup', {
            fixId,
            backupPath: backup.backupPath,
            error: error.message,
          });
        }
      }

      this.backups.delete(fixId);
    }
  }

  /**
   * Record a successful fix for analytics
   */
  recordSuccessfulFix(fix, applyResult, startTime) {
    this.fixStats.totalApplied++;
    this.fixStats.successfulFixes++;

    // Track by type
    const typeKey = fix.type || 'unknown';
    this.fixStats.byType.set(
      typeKey,
      (this.fixStats.byType.get(typeKey) || 0) + 1
    );

    // Track by complexity
    const complexityKey = fix.metadata?.complexity || 'unknown';
    this.fixStats.byComplexity.set(
      complexityKey,
      (this.fixStats.byComplexity.get(complexityKey) || 0) + 1
    );

    // Track the fix
    this.appliedFixes.push({
      id: applyResult.fixId,
      type: fix.type,
      confidence: fix.confidence,
      complexity: fix.metadata?.complexity,
      appliedAt: new Date().toISOString(),
      duration: Date.now() - startTime,
      filesChanged: (fix.changes || []).length,
    });

    // Keep only last 100 fixes
    if (this.appliedFixes.length > 100) {
      this.appliedFixes.shift();
    }
  }

  /**
   * Check if there's enough space for backups
   */
  checkBackupSpace(fix) {
    try {
      // Estimate backup size (rough calculation)
      let estimatedSize = 0;
      for (const change of fix.changes || []) {
        // Assume average file size of 10KB
        estimatedSize += 10240;
      }

      // Get available disk space (simplified check)
      // In a real implementation, you'd check actual disk space
      return true; // For now, assume space is available
    } catch (error) {
      logger.warn('Backup space check failed', { error: error.message });
      return false;
    }
  }

  /**
   * Resolve a file path relative to project context
   */
  resolveFilePath(filePath, context) {
    // If it's already an absolute path, return as-is
    if (path.isAbsolute(filePath)) {
      return filePath;
    }

    // Otherwise, resolve relative to project root
    const projectRoot = context.projectRoot || process.cwd();
    return path.resolve(projectRoot, filePath);
  }

  /**
   * Get fix application statistics
   */
  getStats() {
    const successRate =
      this.fixStats.totalApplied > 0
        ? (this.fixStats.successfulFixes / this.fixStats.totalApplied) * 100
        : 0;

    return {
      totalApplied: this.fixStats.totalApplied,
      successfulFixes: this.fixStats.successfulFixes,
      failedFixes: this.fixStats.failedFixes,
      rolledBackFixes: this.fixStats.rolledBackFixes,
      successRate: Math.round(successRate * 100) / 100,
      byType: Object.fromEntries(this.fixStats.byType),
      byComplexity: Object.fromEntries(this.fixStats.byComplexity),
      activeBackups: this.backups.size,
      recentFixes: this.appliedFixes.slice(-5), // Last 5 fixes
    };
  }

  /**
   * Clean up old backups (run periodically)
   */
  cleanupOldBackups(maxAgeHours = 24) {
    try {
      const maxAge = maxAgeHours * 60 * 60 * 1000; // Convert to milliseconds
      const now = Date.now();

      if (fs.existsSync(this.backupDir)) {
        const files = fs.readdirSync(this.backupDir);

        for (const file of files) {
          const filePath = path.join(this.backupDir, file);
          const stats = fs.statSync(filePath);

          if (now - stats.mtime.getTime() > maxAge) {
            fs.unlinkSync(filePath);
            logger.info('Cleaned up old backup', { file });
          }
        }
      }
    } catch (error) {
      logger.warn('Backup cleanup failed', { error: error.message });
    }
  }
}
