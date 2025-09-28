import { ProgressIndicator } from '../display/progress-indicator.js';
import { logger } from '../utils/logger.js';

/**
 * Advanced Progress Tracking System with Visual Indicators
 * Provides comprehensive progress tracking for complex multi-step operations
 */
export class ProgressTracker {
  constructor(options = {}) {
    this.maxConcurrent = options.maxConcurrent || 5;
    this.showDetails = options.showDetails !== false;
    this.autoCleanup = options.autoCleanup !== false;
    this.updateInterval = options.updateInterval || 100; // ms

    // Core progress indicator
    this.progressIndicator =
      options.progressIndicator || new ProgressIndicator();

    // Active operations tracking
    this.operations = new Map();
    this.operationHistory = [];
    this.nextOperationId = 1;

    // Statistics
    this.stats = {
      totalOperations: 0,
      completedOperations: 0,
      failedOperations: 0,
      averageDuration: 0,
      successRate: 100,
    };

    // Performance monitoring
    this.performanceData = new Map();

    logger.info('Progress tracker initialized', {
      maxConcurrent: this.maxConcurrent,
      showDetails: this.showDetails,
      updateInterval: this.updateInterval,
    });
  }

  /**
   * Start tracking a new operation
   * @param {string} name - Operation name
   * @param {Object} options - Operation options
   * @returns {string} Operation ID
   */
  startOperation(name, options = {}) {
    const operationId = `op_${this.nextOperationId++}`;
    const {
      totalSteps = 0,
      showProgress = true,
      showETA = true,
      category = 'general',
      priority = 'normal',
      parentOperation = null,
    } = options;

    const operation = {
      id: operationId,
      name,
      category,
      priority,
      startTime: Date.now(),
      endTime: null,
      status: 'running',
      progress: 0,
      totalSteps,
      currentStep: 0,
      steps: [],
      errors: [],
      warnings: [],
      metadata: {},
      parentOperation,
      childOperations: new Set(),
      spinner: null,
      progressBar: null,
      showProgress,
      showETA,
      estimatedDuration: null,
      lastUpdate: Date.now(),
    };

    // Link to parent operation if specified
    if (parentOperation && this.operations.has(parentOperation)) {
      const parent = this.operations.get(parentOperation);
      parent.childOperations.add(operationId);
    }

    this.operations.set(operationId, operation);
    this.stats.totalOperations++;

    // Start visual indicators
    if (showProgress) {
      this.startVisualIndicators(operation);
    }

    logger.info('Operation started', {
      operationId,
      name,
      category,
      totalSteps,
      parentOperation,
    });

    return operationId;
  }

  /**
   * Update operation progress
   * @param {string} operationId - Operation ID
   * @param {number} progress - Progress value (0-100)
   * @param {Object} update - Additional update data
   */
  updateProgress(operationId, progress, update = {}) {
    const operation = this.operations.get(operationId);
    if (!operation) {
      logger.warn('Operation not found for progress update', { operationId });
      return;
    }

    operation.progress = Math.max(0, Math.min(100, progress));
    operation.lastUpdate = Date.now();

    // Update step information
    if (update.step) {
      operation.currentStep = update.step;
      operation.steps.push({
        step: update.step,
        name: update.stepName || `Step ${update.step}`,
        progress,
        timestamp: Date.now(),
        duration: update.duration || 0,
      });
    }

    // Update metadata
    if (update.metadata) {
      Object.assign(operation.metadata, update.metadata);
    }

    // Update visual indicators
    if (operation.showProgress) {
      this.updateVisualIndicators(operation);
    }

    // Update estimated duration
    if (operation.progress > 0 && operation.progress < 100) {
      const elapsed = Date.now() - operation.startTime;
      operation.estimatedDuration = (elapsed / operation.progress) * 100;
    }

    logger.debug('Operation progress updated', {
      operationId,
      progress,
      step: update.step,
      metadata: update.metadata,
    });
  }

  /**
   * Complete an operation
   * @param {string} operationId - Operation ID
   * @param {Object} result - Completion result
   */
  completeOperation(operationId, result = {}) {
    const operation = this.operations.get(operationId);
    if (!operation) {
      logger.warn('Operation not found for completion', { operationId });
      return;
    }

    operation.endTime = Date.now();
    operation.status = result.success !== false ? 'completed' : 'failed';
    operation.progress = 100;

    const duration = operation.endTime - operation.startTime;
    operation.metadata.duration = duration;

    // Update statistics
    if (operation.status === 'completed') {
      this.stats.completedOperations++;
    } else {
      this.stats.failedOperations++;
      operation.errors.push(result.error || 'Operation failed');
    }

    // Calculate success rate
    this.stats.successRate =
      (this.stats.completedOperations / this.stats.totalOperations) * 100;

    // Update average duration
    const totalDuration =
      this.stats.averageDuration * (this.stats.totalOperations - 1) + duration;
    this.stats.averageDuration = totalDuration / this.stats.totalOperations;

    // Update visual indicators
    if (operation.showProgress) {
      this.completeVisualIndicators(operation, result);
    }

    // Move to history
    this.operationHistory.push({ ...operation, result });

    // Cleanup old operations
    if (this.autoCleanup) {
      this.cleanupOldOperations();
    }

    // Update parent operation if it exists
    if (operation.parentOperation) {
      this.updateParentProgress(operation.parentOperation);
    }

    logger.info('Operation completed', {
      operationId,
      status: operation.status,
      duration,
      progress: operation.progress,
    });
  }

  /**
   * Fail an operation
   * @param {string} operationId - Operation ID
   * @param {Error|string} error - Error information
   */
  failOperation(operationId, error) {
    const operation = this.operations.get(operationId);
    if (!operation) {
      logger.warn('Operation not found for failure', { operationId });
      return;
    }

    operation.errors.push(error.message || error);
    operation.metadata.error = error.message || error;

    this.completeOperation(operationId, { success: false, error });
  }

  /**
   * Add a step to an operation
   * @param {string} operationId - Operation ID
   * @param {string} stepName - Step name
   * @param {Function} stepFunction - Step function to execute
   * @returns {Promise} Step execution promise
   */
  async addStep(operationId, stepName, stepFunction) {
    const operation = this.operations.get(operationId);
    if (!operation) {
      throw new Error(`Operation ${operationId} not found`);
    }

    const stepNumber = operation.steps.length + 1;
    const stepStartTime = Date.now();

    // Update progress to indicate step start
    this.updateProgress(
      operationId,
      ((stepNumber - 1) / operation.totalSteps) * 100,
      {
        step: stepNumber,
        stepName,
        status: 'starting',
      }
    );

    try {
      // Execute the step function
      const result = await stepFunction();

      // Update progress to indicate step completion
      const stepDuration = Date.now() - stepStartTime;
      this.updateProgress(
        operationId,
        (stepNumber / operation.totalSteps) * 100,
        {
          step: stepNumber,
          stepName,
          status: 'completed',
          duration: stepDuration,
          result,
        }
      );

      return result;
    } catch (error) {
      // Update progress to indicate step failure
      const stepDuration = Date.now() - stepStartTime;
      this.updateProgress(operationId, operation.progress, {
        step: stepNumber,
        stepName,
        status: 'failed',
        duration: stepDuration,
        error: error.message,
      });

      throw error;
    }
  }

  /**
   * Start visual indicators for an operation
   * @param {Object} operation - Operation object
   */
  startVisualIndicators(operation) {
    if (operation.totalSteps > 1) {
      // Use progress bar for multi-step operations
      operation.progressBar = this.progressIndicator.showProgressBar({
        total: 100,
        current: operation.progress,
        title: operation.name,
        showETA: operation.showETA,
      });
    } else {
      // Use spinner for single operations
      operation.spinner = this.progressIndicator.startSpinner(
        operation.name,
        `Starting ${operation.name}...`
      );
    }
  }

  /**
   * Update visual indicators for an operation
   * @param {Object} operation - Operation object
   */
  updateVisualIndicators(operation) {
    if (operation.progressBar) {
      this.progressIndicator.updateProgressBar(operation.progressBar.id, {
        current: operation.progress,
        title: operation.name,
      });
    } else if (operation.spinner) {
      const currentStep = operation.steps[operation.steps.length - 1];
      const stepInfo = currentStep ? ` (${currentStep.name})` : '';
      this.progressIndicator.updateSpinner(
        operation.spinner.id,
        `${operation.name}${stepInfo}: ${operation.progress.toFixed(1)}%`
      );
    }
  }

  /**
   * Complete visual indicators for an operation
   * @param {Object} operation - Operation object
   * @param {Object} result - Completion result
   */
  completeVisualIndicators(operation, result) {
    if (operation.progressBar) {
      this.progressIndicator.completeProgressBar(
        operation.progressBar.id,
        result.success !== false ? 'success' : 'error'
      );
    } else if (operation.spinner) {
      const success = result.success !== false;
      const message = success
        ? `${operation.name} completed successfully`
        : `${operation.name} failed: ${result.error || 'Unknown error'}`;

      if (success) {
        this.progressIndicator.succeedSpinner(operation.spinner.id, message);
      } else {
        this.progressIndicator.failSpinner(operation.spinner.id, message);
      }
    }
  }

  /**
   * Update parent operation progress based on child operations
   * @param {string} parentOperationId - Parent operation ID
   */
  updateParentProgress(parentOperationId) {
    const parent = this.operations.get(parentOperationId);
    if (!parent) return;

    const childOperations = Array.from(parent.childOperations)
      .map((id) => this.operations.get(id))
      .filter((op) => op); // Filter out completed/removed operations

    if (childOperations.length === 0) return;

    // Calculate average progress of child operations
    const totalProgress = childOperations.reduce(
      (sum, op) => sum + op.progress,
      0
    );
    const averageProgress = totalProgress / childOperations.length;

    // Update parent progress
    parent.progress = averageProgress;

    // Check if all children are completed
    const allCompleted = childOperations.every(
      (op) => op.status === 'completed'
    );
    const anyFailed = childOperations.some((op) => op.status === 'failed');

    if (allCompleted) {
      this.completeOperation(parentOperationId, { success: true });
    } else if (anyFailed) {
      this.failOperation(
        parentOperationId,
        new Error('Child operation failed')
      );
    } else {
      this.updateVisualIndicators(parent);
    }
  }

  /**
   * Create a nested operation (child of parent)
   * @param {string} parentOperationId - Parent operation ID
   * @param {string} name - Child operation name
   * @param {Object} options - Child operation options
   * @returns {string} Child operation ID
   */
  createChildOperation(parentOperationId, name, options = {}) {
    return this.startOperation(name, {
      ...options,
      parentOperation: parentOperationId,
    });
  }

  /**
   * Get operation status
   * @param {string} operationId - Operation ID
   * @returns {Object} Operation status
   */
  getOperationStatus(operationId) {
    const operation = this.operations.get(operationId);
    if (!operation) {
      return { error: 'Operation not found' };
    }

    return {
      id: operation.id,
      name: operation.name,
      status: operation.status,
      progress: operation.progress,
      currentStep: operation.currentStep,
      totalSteps: operation.totalSteps,
      startTime: operation.startTime,
      endTime: operation.endTime,
      duration: operation.endTime
        ? operation.endTime - operation.startTime
        : Date.now() - operation.startTime,
      estimatedDuration: operation.estimatedDuration,
      errors: operation.errors,
      warnings: operation.warnings,
      metadata: operation.metadata,
    };
  }

  /**
   * Get all active operations
   * @returns {Array} Active operations
   */
  getActiveOperations() {
    return Array.from(this.operations.values())
      .filter((op) => op.status === 'running')
      .map((op) => this.getOperationStatus(op.id));
  }

  /**
   * Get operation history
   * @param {Object} filters - History filters
   * @returns {Array} Operation history
   */
  getOperationHistory(filters = {}) {
    let history = [...this.operationHistory];

    // Apply filters
    if (filters.category) {
      history = history.filter((op) => op.category === filters.category);
    }

    if (filters.status) {
      history = history.filter((op) => op.status === filters.status);
    }

    if (filters.limit) {
      history = history.slice(-filters.limit);
    }

    return history.map((op) => ({
      id: op.id,
      name: op.name,
      status: op.status,
      duration: op.endTime - op.startTime,
      startTime: op.startTime,
      endTime: op.endTime,
      progress: op.progress,
      errors: op.errors,
      metadata: op.metadata,
    }));
  }

  /**
   * Cleanup old completed operations
   */
  cleanupOldOperations() {
    const maxHistory = 100; // Keep last 100 operations in memory
    const cutoffTime = Date.now() - 24 * 60 * 60 * 1000; // 24 hours ago

    // Remove very old operations
    for (const [id, operation] of this.operations) {
      if (operation.endTime && operation.endTime < cutoffTime) {
        this.operations.delete(id);
      }
    }

    // Limit operation history size
    if (this.operationHistory.length > maxHistory) {
      this.operationHistory = this.operationHistory.slice(-maxHistory);
    }
  }

  /**
   * Generate performance report
   * @returns {Object} Performance report
   */
  generatePerformanceReport() {
    const report = {
      stats: { ...this.stats },
      activeOperations: this.getActiveOperations().length,
      recentHistory: this.getOperationHistory({ limit: 10 }),
      categoryBreakdown: {},
      averageDurations: {},
    };

    // Category breakdown
    this.operationHistory.forEach((op) => {
      const category = op.category || 'general';
      if (!report.categoryBreakdown[category]) {
        report.categoryBreakdown[category] = {
          total: 0,
          completed: 0,
          failed: 0,
          averageDuration: 0,
        };
      }

      const cat = report.categoryBreakdown[category];
      cat.total++;
      if (op.status === 'completed') cat.completed++;
      if (op.status === 'failed') cat.failed++;

      const duration = op.endTime - op.startTime;
      cat.averageDuration =
        (cat.averageDuration * (cat.total - 1) + duration) / cat.total;
    });

    return report;
  }

  /**
   * Export operation data
   * @param {string} format - Export format ('json', 'csv')
   * @returns {string} Exported data
   */
  exportOperations(format = 'json') {
    const operations = this.getOperationHistory();

    switch (format) {
      case 'json':
        return JSON.stringify(operations, null, 2);

      case 'csv':
        if (operations.length === 0) return 'No operations to export';

        const headers = [
          'id',
          'name',
          'status',
          'duration',
          'startTime',
          'endTime',
          'progress',
        ];
        const rows = operations.map((op) => [
          op.id,
          `"${op.name}"`,
          op.status,
          op.duration,
          op.startTime,
          op.endTime,
          op.progress,
        ]);

        return [headers, ...rows].map((row) => row.join(',')).join('\n');

      default:
        return JSON.stringify(operations, null, 2);
    }
  }

  /**
   * Reset all tracking data
   */
  reset() {
    this.operations.clear();
    this.operationHistory.length = 0;
    this.nextOperationId = 1;
    this.stats = {
      totalOperations: 0,
      completedOperations: 0,
      failedOperations: 0,
      averageDuration: 0,
      successRate: 100,
    };

    logger.info('Progress tracker reset');
  }

  /**
   * Get system statistics
   * @returns {Object} System statistics
   */
  getStats() {
    return {
      ...this.stats,
      activeOperations: this.operations.size,
      totalHistory: this.operationHistory.length,
      memoryUsage: process.memoryUsage(),
      uptime: process.uptime(),
    };
  }
}
