import fs from 'fs-extra';
import path from 'path';
import { logger } from '../utils/logger.js';
import { SmartRPG } from '../generation/smart-rpg.js';
import { WorkflowDiagram } from '../visualization/workflow-diagram.js';

/**
 * Unified RPG System Orchestrator
 * Brings together all RPG components for a cohesive planning and generation experience
 */
export class RPGOrchestrator {
  constructor(options = {}) {
    this.projectRoot = options.projectRoot || process.cwd();
    this.client = options.client; // OpenAI client
    this.model = options.model || 'gpt-4';
    this.smartRPG = options.smartRPG;
    this.workflowDiagram = new WorkflowDiagram();

    // RPG system capabilities
    this.capabilities = {
      planning: true,
      enhancement: true,
      visualization: true,
      codeGeneration: true,
      validation: true,
      persistence: true,
    };

    logger.info('RPG Orchestrator initialized', {
      capabilities: Object.keys(this.capabilities).filter(
        (k) => this.capabilities[k]
      ),
    });
  }

  /**
   * Complete RPG workflow from planning to implementation
   * @param {string} prompt - User planning prompt
   * @param {Object} context - Additional context
   * @returns {Object} Complete RPG result with plan, enhancements, and generated code
   */
  async executeFullRPGWorkflow(prompt, context = {}) {
    try {
      logger.info('Starting complete RPG workflow', {
        promptLength: prompt.length,
      });

      // Phase 1: Generate initial plan
      const planResult = await this.generateRPGPlan(prompt, context);
      const basePlan = planResult.plan;

      // Phase 2: Enhance plan with intelligence
      const enhancedPlan = await this.enhancePlanWithIntelligence(
        basePlan,
        context
      );

      // Phase 3: Validate and optimize plan
      const validatedPlan = await this.validateAndOptimizePlan(enhancedPlan);

      // Phase 4: Generate implementation code
      const implementation = await this.generateImplementation(
        validatedPlan,
        context
      );

      // Phase 5: Create visualizations
      const visualizations = await this.createVisualizations(validatedPlan);

      // Phase 6: Generate summary and recommendations
      const summary = this.generateWorkflowSummary(
        validatedPlan,
        implementation
      );

      const finalResult = {
        plan: basePlan,
        enhancedPlan: validatedPlan,
        implementation,
        visualizations,
        summary,
        metadata: {
          timestamp: new Date().toISOString(),
          prompt,
          capabilities: this.capabilities,
          phases: [
            'planning',
            'enhancement',
            'validation',
            'implementation',
            'visualization',
          ],
        },
      };

      logger.info('RPG workflow completed successfully', {
        features: basePlan.features?.length || 0,
        generatedFiles: Object.keys(implementation.files || {}).length,
        visualizations: visualizations.length,
      });

      return finalResult;
    } catch (error) {
      logger.error('RPG workflow failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Generate initial RPG plan using AI
   * @param {string} prompt - Planning prompt
   * @param {Object} context - Context information
   * @returns {Object} Generated plan
   */
  async generateRPGPlan(prompt, context = {}) {
    const existingFiles = context.existingFiles || 'none';

    const planningPrompt = `
You are an expert software architect using the RPG (Recursive Planning Graph) methodology for systematic code generation.

For the user request: "${prompt}"

${existingFiles !== 'none' ? `Existing project files: ${JSON.stringify(existingFiles, null, 2)}` : ''}

Create a comprehensive RPG plan following this structure:

{
  "features": ["Feature 1", "Feature 2", "Feature 3"],
  "files": {
    "path/to/file1.js": "Feature 1",
    "path/to/file2.js": "Feature 2"
  },
  "flows": [
    ["Feature 1", "Feature 2"],
    ["Feature 2", "Feature 3"]
  ],
  "deps": [
    ["path/to/file1.js", "path/to/file2.js"],
    ["path/to/file2.js", "path/to/file3.js"]
  ],
  "architecture": {
    "pattern": "MVC|Layered|Clean|Microservices",
    "layers": ["presentation", "business", "data"],
    "entryPoints": ["main.js", "index.js"]
  },
  "frameworks": ["React", "Express", "MongoDB"],
  "conventions": {
    "naming": "camelCase",
    "structure": "feature-based",
    "imports": "ES6"
  }
}

Guidelines:
- Features should be high-level user-facing capabilities
- Files should map features to specific implementation files
- Flows show feature dependencies and execution order
- Deps show file-level dependencies
- Be specific about technologies and architecture patterns
- Consider the existing codebase when planning modifications

Respond with valid JSON only.`;

    logger.debug('Making RPG planning request', {
      promptLength: planningPrompt.length,
      model: this.model,
    });

    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        {
          role: 'system',
          content:
            'You are a precise RPG planner. Respond with valid JSON only. No explanations or markdown.',
        },
        { role: 'user', content: planningPrompt },
      ],
      max_tokens: 4096,
      temperature: 0.3,
    });

    const rawResponse = response.choices[0].message.content.trim();
    logger.debug('Received RPG planning response', {
      responseLength: rawResponse.length,
    });

    try {
      const plan = JSON.parse(rawResponse);

      // Validate plan structure
      this.validatePlanStructure(plan);

      logger.info('Successfully parsed RPG plan', {
        features: plan.features?.length || 0,
        files: Object.keys(plan.files || {}).length,
        flows: plan.flows?.length || 0,
        deps: plan.deps?.length || 0,
      });

      return { plan, rawResponse };
    } catch (parseError) {
      logger.error('Failed to parse RPG planning response', parseError, {
        rawResponse: rawResponse.substring(0, 500),
      });
      throw new Error(`Invalid RPG plan format: ${parseError.message}`);
    }
  }

  /**
   * Enhance plan with intelligent analysis
   * @param {Object} basePlan - Base RPG plan
   * @param {Object} context - Context information
   * @returns {Object} Enhanced plan
   */
  async enhancePlanWithIntelligence(basePlan, context = {}) {
    if (!this.smartRPG) {
      logger.warn('SmartRPG not available, returning base plan');
      return basePlan;
    }

    try {
      logger.info('Enhancing plan with SmartRPG intelligence');
      const enhancedPlan = await this.smartRPG.enhanceRPGPlan(
        basePlan,
        context
      );

      logger.info('Plan enhancement completed', {
        suggestions: enhancedPlan.suggestions?.length || 0,
        validations: enhancedPlan.validations?.length || 0,
        generatedFiles: Object.keys(enhancedPlan.generatedCode || {}).length,
      });

      return enhancedPlan;
    } catch (error) {
      logger.warn('Plan enhancement failed, using base plan', {
        error: error.message,
      });
      return basePlan;
    }
  }

  /**
   * Validate and optimize the enhanced plan
   * @param {Object} enhancedPlan - Enhanced plan
   * @returns {Object} Validated and optimized plan
   */
  async validateAndOptimizePlan(enhancedPlan) {
    const validatedPlan = { ...enhancedPlan };

    // Validate plan completeness
    const validationIssues = this.validatePlanCompleteness(validatedPlan);
    validatedPlan.validationIssues = validationIssues;

    // Optimize file placements
    if (validatedPlan.generatedCode) {
      for (const [filePath, code] of Object.entries(
        validatedPlan.generatedCode
      )) {
        if (code.placement && code.placement.path !== filePath) {
          // Suggest better placement
          validatedPlan.suggestions = validatedPlan.suggestions || [];
          validatedPlan.suggestions.push({
            type: 'placement',
            file: filePath,
            suggestion: code.placement.path,
            reasoning:
              code.placement.reasoning || 'Better architectural placement',
          });
        }
      }
    }

    // Optimize dependencies
    this.optimizeDependencies(validatedPlan);

    logger.info('Plan validation and optimization completed', {
      issues: validationIssues.length,
      optimizations: validatedPlan.suggestions?.length || 0,
    });

    return validatedPlan;
  }

  /**
   * Generate implementation code
   * @param {Object} validatedPlan - Validated plan
   * @param {Object} context - Context information
   * @returns {Object} Implementation result
   */
  async generateImplementation(validatedPlan, context = {}) {
    const implementation = {
      files: {},
      summary: {},
      status: 'pending',
    };

    try {
      // Generate code for planned files
      if (validatedPlan.generatedCode) {
        implementation.files = { ...validatedPlan.generatedCode };
      } else {
        // Fallback: Generate basic implementation using AI
        implementation.files = await this.generateBasicImplementation(
          validatedPlan,
          context
        );
      }

      // Create implementation summary
      implementation.summary = {
        totalFiles: Object.keys(implementation.files).length,
        features: validatedPlan.features?.length || 0,
        frameworks: validatedPlan.frameworks || [],
        architecture: validatedPlan.architecture?.pattern || 'Unknown',
      };

      implementation.status = 'completed';

      logger.info('Implementation generation completed', {
        filesGenerated: Object.keys(implementation.files).length,
      });
    } catch (error) {
      logger.error('Implementation generation failed', {
        error: error.message,
      });
      implementation.status = 'failed';
      implementation.error = error.message;
    }

    return implementation;
  }

  /**
   * Create visualizations for the plan
   * @param {Object} plan - RPG plan
   * @returns {Array} Visualization results
   */
  async createVisualizations(plan) {
    const visualizations = [];

    try {
      // Flowchart diagram
      const flowchart = this.workflowDiagram.generateDiagram(plan, {
        type: 'flowchart',
        title: 'RPG Implementation Flow',
        showStats: true,
      });
      visualizations.push({
        type: 'flowchart',
        title: 'Implementation Flow',
        content: flowchart,
        format: 'ascii',
      });

      // Dependency graph
      if (plan.deps && plan.deps.length > 0) {
        const dependencyGraph = this.workflowDiagram.generateDiagram(plan, {
          type: 'dependency',
          title: 'File Dependencies',
          compact: true,
        });
        visualizations.push({
          type: 'dependency',
          title: 'File Dependencies',
          content: dependencyGraph,
          format: 'ascii',
        });
      }

      // Mind map view
      const mindmap = this.workflowDiagram.generateDiagram(plan, {
        type: 'mindmap',
        title: 'Feature Organization',
        compact: true,
      });
      visualizations.push({
        type: 'mindmap',
        title: 'Feature Mind Map',
        content: mindmap,
        format: 'ascii',
      });

      logger.info('Visualizations created', {
        count: visualizations.length,
        types: visualizations.map((v) => v.type),
      });
    } catch (error) {
      logger.warn('Visualization generation failed', { error: error.message });
    }

    return visualizations;
  }

  /**
   * Generate workflow summary and recommendations
   * @param {Object} plan - Validated plan
   * @param {Object} implementation - Implementation result
   * @returns {Object} Summary and recommendations
   */
  generateWorkflowSummary(plan, implementation) {
    const summary = {
      overview: {},
      recommendations: [],
      nextSteps: [],
      metrics: {},
    };

    // Overview
    summary.overview = {
      features: plan.features?.length || 0,
      files: Object.keys(plan.files || {}).length,
      generatedCode: Object.keys(implementation.files || {}).length,
      frameworks: plan.frameworks || [],
      architecture: plan.architecture?.pattern || 'Unknown',
    };

    // Metrics
    summary.metrics = {
      complexity: this.calculateComplexity(plan),
      completeness: this.calculateCompleteness(plan, implementation),
      quality: this.assessQuality(plan, implementation),
    };

    // Recommendations
    summary.recommendations = this.generateRecommendations(
      plan,
      implementation
    );

    // Next steps
    summary.nextSteps = this.generateNextSteps(plan, implementation);

    return summary;
  }

  /**
   * Save RPG plan and results to file
   * @param {Object} rpgResult - Complete RPG result
   * @param {string} fileName - Output filename
   * @returns {string} Saved file path
   */
  async saveRPGResult(rpgResult, fileName = null) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const defaultName = `rpg-result-${timestamp}.json`;
    const outputPath = fileName || path.join(this.projectRoot, defaultName);

    try {
      await fs.ensureDir(path.dirname(outputPath));
      await fs.writeJson(outputPath, rpgResult, { spaces: 2 });

      logger.info('RPG result saved', { path: outputPath });
      return outputPath;
    } catch (error) {
      logger.error('Failed to save RPG result', {
        error: error.message,
        path: outputPath,
      });
      throw error;
    }
  }

  /**
   * Load RPG plan from file
   * @param {string} filePath - Path to RPG plan file
   * @returns {Object} Loaded plan
   */
  async loadRPGPlan(filePath) {
    try {
      const plan = await fs.readJson(filePath);
      logger.info('RPG plan loaded', { path: filePath });
      return plan;
    } catch (error) {
      logger.error('Failed to load RPG plan', {
        error: error.message,
        path: filePath,
      });
      throw error;
    }
  }

  // Helper methods

  validatePlanStructure(plan) {
    if (!plan.features || !Array.isArray(plan.features)) {
      throw new Error('Plan must have a "features" array');
    }
    if (!plan.files || typeof plan.files !== 'object') {
      throw new Error('Plan must have a "files" object');
    }
    if (!plan.flows || !Array.isArray(plan.flows)) {
      throw new Error('Plan must have a "flows" array');
    }
    if (!plan.deps || !Array.isArray(plan.deps)) {
      throw new Error('Plan must have a "deps" array');
    }
  }

  validatePlanCompleteness(plan) {
    const issues = [];

    // Check for missing file mappings
    const unmappedFeatures = plan.features.filter(
      (feature) => !Object.values(plan.files).includes(feature)
    );
    if (unmappedFeatures.length > 0) {
      issues.push({
        type: 'warning',
        message: `Features without file mappings: ${unmappedFeatures.join(', ')}`,
      });
    }

    // Check for orphaned files
    const featureSet = new Set(plan.features);
    const orphanedFiles = Object.entries(plan.files)
      .filter(([, feature]) => !featureSet.has(feature))
      .map(([file]) => file);
    if (orphanedFiles.length > 0) {
      issues.push({
        type: 'warning',
        message: `Files mapped to unknown features: ${orphanedFiles.join(', ')}`,
      });
    }

    return issues;
  }

  optimizeDependencies(plan) {
    // Sort dependencies topologically
    if (plan.deps && plan.deps.length > 0) {
      // Simple topological sort for better dependency ordering
      const sortedDeps = this.topologicalSort(plan.deps);
      plan.deps = sortedDeps;
    }
  }

  async generateBasicImplementation(plan, context) {
    // This would use the original generateCodeWithRPG approach
    // For now, return empty implementation
    logger.warn('Basic implementation generation not implemented');
    return {};
  }

  calculateComplexity(plan) {
    const featureCount = plan.features?.length || 0;
    const fileCount = Object.keys(plan.files || {}).length;
    const depCount = plan.deps?.length || 0;

    return Math.round(featureCount * 2 + fileCount * 1.5 + depCount * 0.5);
  }

  calculateCompleteness(plan, implementation) {
    const plannedFiles = Object.keys(plan.files || {}).length;
    const implementedFiles = Object.keys(implementation.files || {}).length;

    return plannedFiles > 0
      ? Math.round((implementedFiles / plannedFiles) * 100)
      : 0;
  }

  assessQuality(plan, implementation) {
    let score = 50; // Base score

    // Architecture bonus
    if (plan.architecture?.pattern) score += 15;

    // Framework specification bonus
    if (plan.frameworks?.length > 0) score += 10;

    // Convention specification bonus
    if (plan.conventions) score += 10;

    // Implementation bonus
    if (implementation.status === 'completed') score += 15;

    return Math.min(score, 100);
  }

  generateRecommendations(plan, implementation) {
    const recommendations = [];

    if (!plan.architecture?.pattern) {
      recommendations.push({
        type: 'architecture',
        priority: 'high',
        message:
          'Consider specifying an architectural pattern (MVC, Layered, Clean, etc.)',
      });
    }

    if (!plan.frameworks || plan.frameworks.length === 0) {
      recommendations.push({
        type: 'frameworks',
        priority: 'medium',
        message:
          'Specify technology frameworks for better implementation guidance',
      });
    }

    if (implementation.status !== 'completed') {
      recommendations.push({
        type: 'implementation',
        priority: 'high',
        message: 'Implementation generation failed - review plan structure',
      });
    }

    const validations = plan.validationIssues || [];
    validations.forEach((issue) => {
      recommendations.push({
        type: 'validation',
        priority: issue.type === 'error' ? 'high' : 'medium',
        message: issue.message,
      });
    });

    return recommendations;
  }

  generateNextSteps(plan, implementation) {
    const nextSteps = [];

    if (implementation.status === 'completed') {
      nextSteps.push({
        step: 'Review generated code',
        description:
          'Examine the generated files and make any necessary adjustments',
      });

      nextSteps.push({
        step: 'Run tests',
        description:
          'Execute the test suite to ensure everything works correctly',
      });

      nextSteps.push({
        step: 'Integration testing',
        description: 'Test the integration between all generated components',
      });
    } else {
      nextSteps.push({
        step: 'Fix implementation issues',
        description: 'Address the issues preventing code generation',
      });

      nextSteps.push({
        step: 'Simplify plan',
        description:
          'Consider breaking down complex plans into smaller, manageable pieces',
      });
    }

    nextSteps.push({
      step: 'Documentation',
      description: 'Document the implemented features and their usage',
    });

    return nextSteps;
  }

  topologicalSort(dependencies) {
    // Simple topological sort implementation
    const result = [];
    const visited = new Set();
    const visiting = new Set();

    const visit = (node) => {
      if (visited.has(node)) return;
      if (visiting.has(node)) return; // Cycle detected, but we'll continue

      visiting.add(node);

      // Find dependencies that have this node as a prerequisite
      dependencies.forEach(([from, to]) => {
        if (from === node) {
          visit(to);
        }
      });

      visiting.delete(node);
      visited.add(node);
      result.unshift(node);
    };

    // Visit all nodes
    const allNodes = new Set();
    dependencies.forEach(([from, to]) => {
      allNodes.add(from);
      allNodes.add(to);
    });

    allNodes.forEach((node) => visit(node));

    return dependencies; // Return original order for now
  }
}
