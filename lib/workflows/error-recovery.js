import { ErrorParser } from '../error-detection/error-parser.js';
import { ErrorClassifier } from '../error-detection/error-classifier.js';
import { ContextAnalyzer } from '../error-detection/context-analyzer.js';
import { FixGenerator } from '../fixes/fix-generator.js';
import { ErrorPatterns } from '../learning/error-patterns.js';
import { PersonalizedFixes } from '../learning/personalized-fixes.js';
import { PreventionTips } from '../learning/prevention-tips.js';
import { ProgressIndicator } from '../display/progress-indicator.js';
import { logger } from '../utils/logger.js';

/**
 * Automated Error Recovery Workflow System
 * Orchestrates the complete error recovery process from detection to resolution
 */
export class ErrorRecoveryWorkflow {
  constructor(options = {}) {
    this.parser = new ErrorParser();
    this.classifier = new ErrorClassifier();
    this.contextAnalyzer = new ContextAnalyzer();
    this.fixGenerator = new FixGenerator({
      patterns: new ErrorPatterns(),
      personalized: new PersonalizedFixes(),
    });
    this.prevention = new PreventionTips();
    this.progress = options.progress || new ProgressIndicator();

    // Workflow configuration
    this.autoApplyThreshold = options.autoApplyThreshold || 0.8;
    this.maxRecoveryAttempts = options.maxRecoveryAttempts || 3;
    this.enableLearning = options.enableLearning !== false;
    this.enablePrevention = options.enablePrevention !== false;

    // Recovery statistics
    this.stats = {
      totalErrors: 0,
      recoveredErrors: 0,
      failedRecoveries: 0,
      autoFixedErrors: 0,
      manualInterventions: 0,
      averageRecoveryTime: 0,
      recoveryAttempts: [],
      errorCategories: new Map(),
      successRates: new Map(),
    };

    logger.info('Error recovery workflow system initialized');
  }

  /**
   * Execute complete error recovery workflow
   * @param {string} errorOutput - Raw error output from linters/compilers
   * @param {Object} context - Execution context (file, user, project, etc.)
   * @returns {Promise<Object>} Recovery result
   */
  async executeRecoveryWorkflow(errorOutput, context = {}) {
    const startTime = Date.now();
    const workflowId = `recovery_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    logger.info('Starting error recovery workflow', { workflowId, context });

    const result = {
      workflowId,
      success: false,
      errors: [],
      recoveries: [],
      recommendations: [],
      preventionTips: [],
      duration: 0,
      stats: {},
    };

    try {
      // Phase 1: Error Detection and Parsing
      const parseResult = await this.executePhase('parsing', () =>
        this.parseErrors(errorOutput, context)
      );

      if (!parseResult.success || parseResult.errors.length === 0) {
        result.errors.push('No errors detected in the provided output');
        return this.finalizeResult(result, startTime);
      }

      result.parsedErrors = parseResult.errors;

      // Phase 2: Error Classification and Analysis
      const analysisResult = await this.executePhase('analysis', () =>
        this.analyzeErrors(parseResult.errors, context)
      );

      if (!analysisResult.success) {
        result.errors.push('Error analysis failed');
        return this.finalizeResult(result, startTime);
      }

      result.analyzedErrors = analysisResult.analyzedErrors;

      // Phase 3: Fix Generation
      const fixResult = await this.executePhase('fix_generation', () =>
        this.generateFixes(analysisResult.analyzedErrors, context)
      );

      if (!fixResult.success) {
        result.errors.push('Fix generation failed');
        return this.finalizeResult(result, startTime);
      }

      result.fixResults = fixResult.fixResults;

      // Phase 4: Automated Fix Application
      const applicationResult = await this.executePhase('fix_application', () =>
        this.applyFixes(fixResult.fixResults, context)
      );

      result.applicationResults = applicationResult.results;
      result.success = applicationResult.success;

      // Phase 5: Learning and Prevention (if enabled)
      if (this.enableLearning) {
        await this.executePhase('learning', () =>
          this.updateLearning(result, context)
        );
      }

      if (this.enablePrevention) {
        const preventionResult = await this.executePhase('prevention', () =>
          this.generatePreventionTips(context)
        );
        result.preventionTips = preventionResult.tips;
      }

      // Update statistics
      this.updateStatistics(result);
    } catch (error) {
      logger.error('Error recovery workflow failed', {
        workflowId,
        error: error.message,
      });
      result.errors.push(`Workflow execution failed: ${error.message}`);
    }

    return this.finalizeResult(result, startTime);
  }

  /**
   * Execute a workflow phase with progress tracking
   * @param {string} phaseName - Name of the phase
   * @param {Function} phaseFunction - Function to execute
   * @returns {Promise<Object>} Phase result
   */
  async executePhase(phaseName, phaseFunction) {
    const spinner = this.progress.startSpinner(
      phaseName,
      `Executing ${phaseName} phase...`
    );

    try {
      const result = await phaseFunction();
      this.progress.succeedSpinner(spinner.id, `${phaseName} phase completed`);
      return result;
    } catch (error) {
      this.progress.failSpinner(
        spinner.id,
        `${phaseName} phase failed: ${error.message}`
      );
      throw error;
    }
  }

  /**
   * Parse raw error output
   * @param {string} errorOutput - Raw error output
   * @param {Object} context - Execution context
   * @returns {Promise<Object>} Parse result
   */
  async parseErrors(errorOutput, context) {
    const parsedErrors = this.parser.parseErrors(errorOutput, context);

    return {
      success: true,
      errors: parsedErrors,
      count: parsedErrors.length,
    };
  }

  /**
   * Analyze and classify errors
   * @param {Array} errors - Parsed errors
   * @param {Object} context - Execution context
   * @returns {Promise<Object>} Analysis result
   */
  async analyzeErrors(errors, context) {
    const analyzedErrors = [];

    for (const error of errors) {
      const classifiedError = this.classifier.classifyError(error);
      const contextAnalysis = await this.contextAnalyzer.analyzeErrorContext(
        error,
        context
      );

      analyzedErrors.push({
        ...error,
        classification: classifiedError,
        context: contextAnalysis,
        priority: this.calculatePriority(classifiedError, contextAnalysis),
      });
    }

    // Sort by priority (highest first)
    analyzedErrors.sort((a, b) => b.priority - a.priority);

    return {
      success: true,
      analyzedErrors,
      totalErrors: analyzedErrors.length,
      highPriorityErrors: analyzedErrors.filter((e) => e.priority >= 8).length,
    };
  }

  /**
   * Generate fixes for analyzed errors
   * @param {Array} analyzedErrors - Analyzed errors
   * @param {Object} context - Execution context
   * @returns {Promise<Object>} Fix generation result
   */
  async generateFixes(analyzedErrors, context) {
    const fixResults = [];

    for (const error of analyzedErrors) {
      try {
        const fixResult = await this.fixGenerator.generateAndApplyFix(error, {
          ...context,
          autoApply: false, // We'll handle application separately
        });

        fixResults.push({
          error,
          fixResult,
          confidence: fixResult.confidence || 0,
          canAutoApply: fixResult.confidence >= this.autoApplyThreshold,
        });
      } catch (fixError) {
        logger.warn('Fix generation failed for error', {
          errorId: error.id,
          error: fixError.message,
        });

        fixResults.push({
          error,
          fixResult: null,
          confidence: 0,
          canAutoApply: false,
          fixError: fixError.message,
        });
      }
    }

    return {
      success: true,
      fixResults,
      autoApplicableFixes: fixResults.filter((r) => r.canAutoApply).length,
      manualFixes: fixResults.filter((r) => !r.canAutoApply && r.fixResult)
        .length,
      unfixableErrors: fixResults.filter((r) => !r.fixResult).length,
    };
  }

  /**
   * Apply generated fixes
   * @param {Array} fixResults - Fix results to apply
   * @param {Object} context - Execution context
   * @returns {Promise<Object>} Application result
   */
  async applyFixes(fixResults, context) {
    const results = [];
    let success = true;

    for (const fixResult of fixResults) {
      const { error, canAutoApply, fixResult: fix } = fixResult;

      if (canAutoApply && fix) {
        try {
          const applicationResult = await this.fixGenerator.applyFix(
            fix,
            error,
            context
          );

          if (applicationResult.success) {
            results.push({
              error,
              status: 'auto_applied',
              fix,
              result: applicationResult,
            });
          } else {
            results.push({
              error,
              status: 'auto_failed',
              fix,
              result: applicationResult,
              requiresManual: true,
            });
            success = false;
          }
        } catch (applyError) {
          results.push({
            error,
            status: 'application_error',
            fix,
            applyError: applyError.message,
            requiresManual: true,
          });
          success = false;
        }
      } else {
        results.push({
          error,
          status: fix ? 'manual_required' : 'unfixable',
          fix,
          requiresManual: true,
        });
        if (!fix) success = false;
      }
    }

    return {
      success,
      results,
      autoApplied: results.filter((r) => r.status === 'auto_applied').length,
      manualRequired: results.filter((r) => r.requiresManual).length,
      failed: results.filter(
        (r) => r.status === 'auto_failed' || r.status === 'application_error'
      ).length,
    };
  }

  /**
   * Update learning systems with recovery results
   * @param {Object} workflowResult - Complete workflow result
   * @param {Object} context - Execution context
   */
  async updateLearning(workflowResult, context) {
    // Update error patterns and personalized fixes
    for (const recovery of workflowResult.applicationResults || []) {
      if (recovery.status === 'auto_applied') {
        this.fixGenerator.patterns.recordFixAttempt(
          recovery.error,
          { method: 'auto', confidence: 1.0 },
          true, // success
          context
        );
      }
    }
  }

  /**
   * Generate prevention tips based on workflow results
   * @param {Object} context - Execution context
   * @returns {Promise<Object>} Prevention tips
   */
  async generatePreventionTips(context) {
    const tips = this.prevention.generatePreventionTips(context);

    return {
      success: true,
      tips: tips.immediate.slice(0, 3), // Top 3 immediate tips
      metrics: tips.metrics,
    };
  }

  /**
   * Calculate error priority based on classification and context
   * @param {Object} classification - Error classification
   * @param {Object} context - Error context analysis
   * @returns {number} Priority score (0-10)
   */
  calculatePriority(classification, context) {
    let priority = 5; // Base priority

    // Severity multiplier
    const severityMultiplier =
      {
        error: 3,
        warning: 2,
        info: 1,
      }[classification.severity] || 1;

    priority *= severityMultiplier;

    // Context impact
    if (context.impact === 'high') priority += 2;
    else if (context.impact === 'critical') priority += 3;

    // Fixability
    if (classification.autoFixable) priority += 1;

    // Frequency (if we have pattern data)
    if (classification.frequency && classification.frequency > 5) priority += 1;

    return Math.min(priority, 10);
  }

  /**
   * Update workflow statistics
   * @param {Object} result - Workflow result
   */
  updateStatistics(result) {
    this.stats.totalErrors += result.parsedErrors?.length || 0;

    if (result.applicationResults) {
      const autoApplied = result.applicationResults.filter(
        (r) => r.status === 'auto_applied'
      ).length;
      const manualRequired = result.applicationResults.filter(
        (r) => r.requiresManual
      ).length;

      this.stats.recoveredErrors += autoApplied;
      this.stats.manualInterventions += manualRequired;
      this.stats.autoFixedErrors += autoApplied;
    }

    // Update error categories
    if (result.analyzedErrors) {
      result.analyzedErrors.forEach((error) => {
        const category = error.classification?.type || 'unknown';
        this.stats.errorCategories.set(
          category,
          (this.stats.errorCategories.get(category) || 0) + 1
        );
      });
    }

    // Calculate success rates
    if (this.stats.totalErrors > 0) {
      this.stats.successRates.set(
        'auto_fix',
        (this.stats.autoFixedErrors / this.stats.totalErrors) * 100
      );
    }
  }

  /**
   * Finalize workflow result
   * @param {Object} result - Workflow result
   * @param {number} startTime - Workflow start time
   * @returns {Object} Finalized result
   */
  finalizeResult(result, startTime) {
    result.duration = Date.now() - startTime;
    result.stats = { ...this.stats };

    // Determine overall success
    if (!result.success && result.applicationResults) {
      const hasAnySuccess = result.applicationResults.some(
        (r) => r.status === 'auto_applied'
      );
      result.success = hasAnySuccess;
    }

    logger.info('Error recovery workflow completed', {
      workflowId: result.workflowId,
      success: result.success,
      duration: result.duration,
      errorsProcessed: result.parsedErrors?.length || 0,
    });

    return result;
  }

  /**
   * Get workflow statistics
   * @returns {Object} Workflow statistics
   */
  getStatistics() {
    return {
      ...this.stats,
      errorCategories: Object.fromEntries(this.stats.errorCategories),
      successRates: Object.fromEntries(this.stats.successRates),
      uptime: process.uptime(),
      version: '2.4.0', // Phase 2.4 completion
    };
  }

  /**
   * Reset workflow statistics
   */
  resetStatistics() {
    this.stats = {
      totalErrors: 0,
      recoveredErrors: 0,
      failedRecoveries: 0,
      autoFixedErrors: 0,
      manualInterventions: 0,
      averageRecoveryTime: 0,
      recoveryAttempts: [],
      errorCategories: new Map(),
      successRates: new Map(),
    };

    logger.info('Workflow statistics reset');
  }

  /**
   * Execute batch error recovery on multiple error sources
   * @param {Array} errorSources - Array of error source objects
   * @param {Object} context - Execution context
   * @returns {Promise<Object>} Batch recovery result
   */
  async executeBatchRecovery(errorSources, context = {}) {
    const batchResult = {
      totalSources: errorSources.length,
      successfulRecoveries: 0,
      failedRecoveries: 0,
      results: [],
      summary: {},
    };

    const multiStep = this.progress.showMultiStepProgress(
      errorSources.map((source, index) => ({
        name: `Processing ${source.name || `source ${index + 1}`}`,
        operation: 'processing',
      })),
      'Batch Error Recovery'
    );

    for (let i = 0; i < errorSources.length; i++) {
      const source = errorSources[i];
      const spinner = multiStep.next(
        `Processing ${source.name || `source ${i + 1}`}`
      );

      try {
        const result = await this.executeRecoveryWorkflow(source.errorOutput, {
          ...context,
          source: source.name,
          batchIndex: i,
        });

        batchResult.results.push({
          source: source.name,
          result,
          success: result.success,
        });

        if (result.success) {
          batchResult.successfulRecoveries++;
          this.progress.succeedSpinner(
            spinner.id,
            `${source.name} recovered successfully`
          );
        } else {
          batchResult.failedRecoveries++;
          this.progress.warnSpinner(
            spinner.id,
            `${source.name} recovery incomplete`
          );
        }
      } catch (error) {
        batchResult.failedRecoveries++;
        batchResult.results.push({
          source: source.name,
          error: error.message,
          success: false,
        });
        this.progress.failSpinner(spinner.id, `${source.name} recovery failed`);
      }
    }

    batchResult.summary = {
      successRate:
        (batchResult.successfulRecoveries / batchResult.totalSources) * 100,
      totalErrorsProcessed: batchResult.results.reduce(
        (sum, r) => sum + (r.result?.parsedErrors?.length || 0),
        0
      ),
      totalRecoveries: batchResult.results.reduce(
        (sum, r) =>
          sum +
          (r.result?.applicationResults?.filter(
            (ar) => ar.status === 'auto_applied'
          ).length || 0),
        0
      ),
    };

    return batchResult;
  }
}
