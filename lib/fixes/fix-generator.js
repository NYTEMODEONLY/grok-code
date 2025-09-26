import { FixTemplates } from './fix-templates.js';
import { AIFixGenerator } from './ai-fix-generator.js';
import { SafeFixApplier } from './safe-applier.js';
import { logger } from '../utils/logger.js';

/**
 * Main Fix Generator - Orchestrates the entire automated fix process
 * Decides between template-based, AI-powered, or hybrid approaches
 */
export class FixGenerator {
  constructor(options = {}) {
    this.templates = new FixTemplates();
    this.aiGenerator = new AIFixGenerator();
    this.safeApplier = new SafeFixApplier();

    // Configuration
    this.autoApplyThreshold = options.autoApplyThreshold || 0.8; // Auto-apply fixes with >80% confidence
    this.aiFallbackThreshold = options.aiFallbackThreshold || 0.6; // Use AI for fixes <60% template confidence
    this.maxFixAttempts = options.maxFixAttempts || 3;
    this.enableLearning = options.enableLearning !== false;

    // Statistics
    this.stats = {
      totalErrors: 0,
      fixesAttempted: 0,
      fixesSuccessful: 0,
      templateFixes: 0,
      aiFixes: 0,
      hybridFixes: 0,
      byErrorType: new Map(),
      byComplexity: new Map(),
      averageConfidence: 0,
      lastFixTime: null,
    };

    logger.info('Fix Generator initialized', {
      autoApplyThreshold: this.autoApplyThreshold,
      aiFallbackThreshold: this.aiFallbackThreshold,
    });
  }

  /**
   * Main entry point - Generate and apply a fix for an error
   * @param {Object} error - Classified error object
   * @param {Object} context - Full context (files, project info, etc.)
   * @param {Object} options - Fix options
   * @returns {Promise<Object>} Fix result
   */
  async generateAndApplyFix(error, context, options = {}) {
    const startTime = Date.now();
    this.stats.totalErrors++;

    try {
      logger.info('Starting fix generation process', {
        errorType: error.type,
        errorMessage: error.message.substring(0, 100),
      });

      // Step 1: Try template-based fix first
      const templateResult = await this.tryTemplateFix(error, context);

      if (templateResult.success && templateResult.confidence >= this.autoApplyThreshold) {
        // High-confidence template fix - apply directly
        logger.info('Applying high-confidence template fix', {
          confidence: templateResult.confidence,
          type: templateResult.type,
        });

        const applyResult = await this.safeApplier.applyFix(templateResult, context);
        this.recordFixResult('template', applyResult, templateResult, startTime);

        return {
          success: applyResult.success,
          method: 'template',
          fix: templateResult,
          application: applyResult,
          duration: Date.now() - startTime,
        };
      }

      // Step 2: Try AI fix if template confidence is low or template failed
      if (!templateResult.success || templateResult.confidence < this.aiFallbackThreshold) {
        logger.info('Attempting AI-powered fix', {
          templateConfidence: templateResult.confidence,
          templateSuccess: templateResult.success,
        });

        const aiResult = await this.tryAIFix(error, context);

        if (aiResult.success && aiResult.confidence >= this.autoApplyThreshold) {
          // High-confidence AI fix - apply directly
          const applyResult = await this.safeApplier.applyFix(aiResult, context);
          this.recordFixResult('ai', applyResult, aiResult, startTime);

          return {
            success: applyResult.success,
            method: 'ai',
            fix: aiResult,
            application: applyResult,
            duration: Date.now() - startTime,
          };
        }

        // Step 3: Try hybrid approach (combine template + AI insights)
        if (templateResult.success && aiResult.success) {
          const hybridResult = await this.tryHybridFix(templateResult, aiResult, error, context);

          if (hybridResult.success && hybridResult.confidence >= this.autoApplyThreshold) {
            const applyResult = await this.safeApplier.applyFix(hybridResult, context);
            this.recordFixResult('hybrid', applyResult, hybridResult, startTime);

            return {
              success: applyResult.success,
              method: 'hybrid',
              fix: hybridResult,
              application: applyResult,
              duration: Date.now() - startTime,
            };
          }
        }
      }

      // Step 4: Return suggestions without auto-application
      const suggestions = this.generateSuggestions(error, templateResult, context);

      logger.info('Fix generation completed with suggestions only', {
        suggestionsCount: suggestions.length,
      });

      return {
        success: false,
        method: 'suggestions_only',
        suggestions,
        templateResult,
        duration: Date.now() - startTime,
        reason: 'No high-confidence fix available for auto-application',
      };

    } catch (error) {
      logger.error('Fix generation process failed', { error: error.message });
      return {
        success: false,
        method: 'error',
        reason: `Fix generation failed: ${error.message}`,
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Try to generate a fix using templates
   */
  async tryTemplateFix(error, context) {
    try {
      const templateFix = this.templates.generateFix(error, context);

      if (templateFix) {
        logger.debug('Template fix generated', {
          type: templateFix.type,
          confidence: templateFix.confidence,
        });

        return {
          success: true,
          method: 'template',
          ...templateFix,
        };
      }

      return {
        success: false,
        reason: 'No applicable template found',
      };

    } catch (error) {
      logger.warn('Template fix generation failed', { error: error.message });
      return {
        success: false,
        reason: `Template error: ${error.message}`,
      };
    }
  }

  /**
   * Try to generate a fix using AI
   */
  async tryAIFix(error, context) {
    try {
      const aiFix = await this.aiGenerator.generateFix(error, context);

      if (aiFix.success) {
        logger.debug('AI fix generated', {
          confidence: aiFix.confidence,
          complexity: aiFix.metadata?.complexity,
        });

        return {
          success: true,
          method: 'ai',
          ...aiFix,
        };
      }

      return {
        success: false,
        reason: aiFix.reason || 'AI fix generation failed',
      };

    } catch (error) {
      logger.warn('AI fix generation failed', { error: error.message });
      return {
        success: false,
        reason: `AI error: ${error.message}`,
      };
    }
  }

  /**
   * Try to create a hybrid fix combining template and AI insights
   */
  async tryHybridFix(templateFix, aiFix, error, context) {
    try {
      // For now, prefer the higher confidence fix
      // In the future, this could intelligently merge both approaches
      const betterFix = templateFix.confidence >= aiFix.confidence ? templateFix : aiFix;

      logger.debug('Hybrid fix selected higher confidence option', {
        templateConfidence: templateFix.confidence,
        aiConfidence: aiFix.confidence,
        selected: betterFix.method,
      });

      return {
        success: true,
        method: 'hybrid',
        ...betterFix,
        confidence: Math.min(betterFix.confidence + 0.1, 1.0), // Slight boost for hybrid
        metadata: {
          ...betterFix.metadata,
          hybrid: true,
          sources: [templateFix.method, aiFix.method],
        },
      };

    } catch (error) {
      logger.warn('Hybrid fix generation failed', { error: error.message });
      return {
        success: false,
        reason: `Hybrid error: ${error.message}`,
      };
    }
  }

  /**
   * Generate suggestions when auto-application isn't appropriate
   */
  generateSuggestions(error, templateResult, context) {
    const suggestions = [];

    // Template suggestions
    if (templateResult.success) {
      suggestions.push({
        type: 'template',
        confidence: templateResult.confidence,
        description: `Apply template fix: ${templateResult.description || templateResult.type}`,
        fix: templateResult,
        autoApplicable: templateResult.confidence >= this.autoApplyThreshold,
      });
    }

    // General suggestions based on error type
    const errorTypeSuggestions = this.getErrorTypeSuggestions(error);
    suggestions.push(...errorTypeSuggestions);

    // Context-based suggestions
    const contextSuggestions = this.getContextSuggestions(error, context);
    suggestions.push(...contextSuggestions);

    return suggestions.sort((a, b) => (b.confidence || 0) - (a.confidence || 0));
  }

  /**
   * Get suggestions based on error type
   */
  getErrorTypeSuggestions(error) {
    const suggestions = [];

    switch (error.type) {
      case 'type':
        suggestions.push({
          type: 'manual',
          confidence: 0.5,
          description: 'Check TypeScript type definitions and imports',
          action: 'manual_review',
        });
        break;

      case 'syntax':
        suggestions.push({
          type: 'manual',
          confidence: 0.7,
          description: 'Review code syntax around the error line',
          action: 'syntax_check',
        });
        break;

      case 'import':
        suggestions.push({
          type: 'manual',
          confidence: 0.8,
          description: 'Check import/export statements and file paths',
          action: 'import_review',
        });
        break;

      case 'reference':
        suggestions.push({
          type: 'manual',
          confidence: 0.6,
          description: 'Verify variable/function declarations and scope',
          action: 'scope_check',
        });
        break;
    }

    return suggestions;
  }

  /**
   * Get context-based suggestions
   */
  getContextSuggestions(error, context) {
    const suggestions = [];

    // Check for related files
    if (context.relatedFiles && context.relatedFiles.length > 0) {
      suggestions.push({
        type: 'context',
        confidence: 0.4,
        description: `Review related files: ${context.relatedFiles.map(f => f.path).join(', ')}`,
        action: 'check_related',
      });
    }

    // Framework-specific suggestions
    if (context.framework) {
      suggestions.push({
        type: 'framework',
        confidence: 0.3,
        description: `Check ${context.framework} documentation and patterns`,
        action: 'framework_docs',
        framework: context.framework,
      });
    }

    return suggestions;
  }

  /**
   * Record fix results for analytics and learning
   */
  recordFixResult(method, applyResult, fix, startTime) {
    this.stats.fixesAttempted++;

    if (applyResult.success) {
      this.stats.fixesSuccessful++;
    }

    // Track by method
    switch (method) {
      case 'template':
        this.stats.templateFixes++;
        break;
      case 'ai':
        this.stats.aiFixes++;
        break;
      case 'hybrid':
        this.stats.hybridFixes++;
        break;
    }

    // Track by error type
    const errorType = fix.type || 'unknown';
    this.stats.byErrorType.set(
      errorType,
      (this.stats.byErrorType.get(errorType) || 0) + 1
    );

    // Track by complexity
    const complexity = fix.metadata?.complexity || 'unknown';
    this.stats.byComplexity.set(
      complexity,
      (this.stats.byComplexity.get(complexity) || 0) + 1
    );

    // Update average confidence
    const totalFixes = this.stats.fixesAttempted;
    const currentAvg = this.stats.averageConfidence;
    this.stats.averageConfidence = (currentAvg * (totalFixes - 1) + fix.confidence) / totalFixes;

    this.stats.lastFixTime = new Date().toISOString();

    logger.info('Fix result recorded', {
      method,
      success: applyResult.success,
      confidence: fix.confidence,
      type: fix.type,
    });
  }

  /**
   * Get comprehensive fix generation statistics
   */
  getStats() {
    const successRate = this.stats.fixesAttempted > 0
      ? (this.stats.fixesSuccessful / this.stats.fixesAttempted) * 100
      : 0;

    return {
      totalErrors: this.stats.totalErrors,
      fixesAttempted: this.stats.fixesAttempted,
      fixesSuccessful: this.stats.fixesSuccessful,
      successRate: Math.round(successRate * 100) / 100,
      templateFixes: this.stats.templateFixes,
      aiFixes: this.stats.aiFixes,
      hybridFixes: this.stats.hybridFixes,
      averageConfidence: Math.round(this.stats.averageConfidence * 100) / 100,
      byErrorType: Object.fromEntries(this.stats.byErrorType),
      byComplexity: Object.fromEntries(this.stats.byComplexity),
      lastFixTime: this.stats.lastFixTime,
      applierStats: this.safeApplier.getStats(),
      aiStats: this.aiGenerator.getStats(),
    };
  }

  /**
   * Configure fix generation parameters
   */
  configure(options) {
    if (options.autoApplyThreshold !== undefined) {
      this.autoApplyThreshold = options.autoApplyThreshold;
    }
    if (options.aiFallbackThreshold !== undefined) {
      this.aiFallbackThreshold = options.aiFallbackThreshold;
    }
    if (options.maxFixAttempts !== undefined) {
      this.maxFixAttempts = options.maxFixAttempts;
    }
    if (options.enableLearning !== undefined) {
      this.enableLearning = options.enableLearning;
    }

    logger.info('Fix generator reconfigured', options);
  }

  /**
   * Reset all statistics
   */
  resetStats() {
    this.stats = {
      totalErrors: 0,
      fixesAttempted: 0,
      fixesSuccessful: 0,
      templateFixes: 0,
      aiFixes: 0,
      hybridFixes: 0,
      byErrorType: new Map(),
      byComplexity: new Map(),
      averageConfidence: 0,
      lastFixTime: null,
    };

    logger.info('Fix generator statistics reset');
  }
}
