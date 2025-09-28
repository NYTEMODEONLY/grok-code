import fs from 'fs-extra';
import path from 'path';
import { logger } from '../utils/logger.js';

/**
 * Framework-Specific Code Generator
 * Generates complete, production-ready code for specific frameworks and patterns
 */
export class FrameworkCodeGenerator {
  constructor(options = {}) {
    this.projectRoot = options.projectRoot || process.cwd();
    this.contextTemplateGenerator = options.contextTemplateGenerator;
    this.frameworkDetector = options.frameworkDetector;
    this.conventionAnalyzer = options.conventionAnalyzer;

    // Framework-specific generators
    this.generators = {
      React: new ReactCodeGenerator(),
      'Express.js': new ExpressCodeGenerator(),
      Angular: new AngularCodeGenerator(),
      'Vue.js': new VueCodeGenerator(),
      Django: new DjangoCodeGenerator(),
      FastAPI: new FastApiCodeGenerator(),
      'Next.js': new NextJsCodeGenerator(),
      NestJS: new NestJsCodeGenerator(),
    };

    logger.info('Framework code generator initialized', {
      projectRoot: this.projectRoot,
      supportedFrameworks: Object.keys(this.generators),
    });
  }

  /**
   * Generate framework-specific code
   * @param {string} framework - Target framework (React, Express, Angular, etc.)
   * @param {string} componentType - Type of component (component, service, controller, etc.)
   * @param {string} name - Name for the generated code
   * @param {Object} specifications - Detailed specifications for generation
   * @returns {Object} Generated code with metadata
   */
  async generateFrameworkCode(
    framework,
    componentType,
    name,
    specifications = {}
  ) {
    try {
      logger.info('Generating framework-specific code', {
        framework,
        componentType,
        name,
      });

      // Get framework generator
      const generator = this.generators[framework];
      if (!generator) {
        throw new Error(`Unsupported framework: ${framework}`);
      }

      // Analyze project context
      const projectContext = await this.analyzeProjectContext();

      // Generate code based on specifications
      const result = await generator.generate(componentType, name, {
        specifications,
        projectContext,
        conventions: projectContext.conventions,
      });

      // Apply project conventions
      await this.applyProjectConventions(result, projectContext);

      // Validate generated code
      const validation = await this.validateGeneratedCode(result, framework);

      // Suggest file placement
      const placement = await this.suggestFilePlacement(result, projectContext);

      logger.info('Framework-specific code generated successfully', {
        framework,
        componentType,
        name,
        codeLength: result.code.length,
      });

      return {
        ...result,
        validation,
        placement,
        metadata: {
          framework,
          componentType,
          name,
          generated: new Date().toISOString(),
          specifications,
          projectContext: {
            architecture: projectContext.architecture?.pattern,
            conventions: Object.keys(projectContext.conventions || {}),
          },
        },
      };
    } catch (error) {
      logger.error('Failed to generate framework-specific code', {
        error: error.message,
        framework,
        componentType,
        name,
      });
      throw error;
    }
  }

  /**
   * Generate complete feature sets
   * @param {string} framework - Target framework
   * @param {string} featureName - Name of the feature
   * @param {Object} featureSpec - Feature specifications
   * @returns {Array} Generated files for the feature
   */
  async generateFeature(framework, featureName, featureSpec = {}) {
    try {
      logger.info('Generating complete feature', { framework, featureName });

      const generator = this.generators[framework];
      if (!generator || !generator.generateFeature) {
        throw new Error(
          `Feature generation not supported for framework: ${framework}`
        );
      }

      const projectContext = await this.analyzeProjectContext();
      const featureFiles = await generator.generateFeature(featureName, {
        ...featureSpec,
        projectContext,
      });

      // Apply conventions to all files
      for (const file of featureFiles) {
        await this.applyProjectConventions(file, projectContext);
        file.placement = await this.suggestFilePlacement(file, projectContext);
      }

      logger.info('Feature generated successfully', {
        framework,
        featureName,
        filesGenerated: featureFiles.length,
      });

      return featureFiles;
    } catch (error) {
      logger.error('Failed to generate feature', {
        error: error.message,
        framework,
        featureName,
      });
      throw error;
    }
  }

  /**
   * Analyze project context for generation
   * @returns {Object} Project context
   */
  async analyzeProjectContext() {
    const context = {
      architecture: null,
      conventions: {},
      frameworks: [],
      structure: {},
      dependencies: {},
    };

    try {
      if (this.frameworkDetector) {
        const fwResult = await this.frameworkDetector.detectFrameworks();
        context.frameworks = fwResult.frameworks || [];
      }

      if (this.conventionAnalyzer) {
        const convResult = await this.conventionAnalyzer.analyzeProject();
        context.conventions = convResult || {};
      }

      // Get package.json dependencies
      const packageJsonPath = path.join(this.projectRoot, 'package.json');
      if (await fs.pathExists(packageJsonPath)) {
        const packageJson = await fs.readJson(packageJsonPath);
        context.dependencies = {
          ...packageJson.dependencies,
          ...packageJson.devDependencies,
        };
      }

      // Analyze existing structure
      context.structure = await this.analyzeExistingStructure();
    } catch (error) {
      logger.warn('Project context analysis failed', { error: error.message });
    }

    return context;
  }

  /**
   * Apply project conventions to generated code
   * @param {Object} result - Generated code result
   * @param {Object} projectContext - Project context
   */
  async applyProjectConventions(result, projectContext) {
    const conventions = projectContext.conventions;

    if (!conventions) return;

    // Apply quote conventions
    if (conventions.quotes && result.code) {
      const preferredQuote =
        conventions.quotes.preferred === 'single' ? "'" : '"';
      // Simple quote normalization (more complex logic would be needed for production)
      if (preferredQuote === "'") {
        result.code = result.code.replace(/"/g, "'");
      }
    }

    // Apply semicolon conventions
    if (conventions.semicolons && result.code) {
      const needsSemicolons = conventions.semicolons.required;
      if (needsSemicolons) {
        // Add semicolons where missing (simplified)
        result.code = result.code.replace(/([a-zA-Z0-9)\]}])\n/g, '$1;\n');
      }
    }
  }

  /**
   * Validate generated code
   * @param {Object} result - Generated code result
   * @param {string} framework - Target framework
   * @returns {Object} Validation results
   */
  async validateGeneratedCode(result, framework) {
    const validation = {
      valid: true,
      errors: [],
      warnings: [],
      suggestions: [],
    };

    try {
      // Basic syntax validation
      if (
        result.language === 'javascript' ||
        result.language === 'typescript'
      ) {
        // Check for common syntax issues
        const code = result.code;

        // Check for unmatched brackets
        const openBraces = (code.match(/\{/g) || []).length;
        const closeBraces = (code.match(/\}/g) || []).length;
        if (openBraces !== closeBraces) {
          validation.errors.push('Unmatched braces');
          validation.valid = false;
        }

        // Check for unmatched parentheses
        const openParens = (code.match(/\(/g) || []).length;
        const closeParens = (code.match(/\)/g) || []).length;
        if (openParens !== closeParens) {
          validation.errors.push('Unmatched parentheses');
          validation.valid = false;
        }

        // Framework-specific validations
        if (framework === 'React' && code.includes('React.')) {
          validation.warnings.push(
            'Consider using ES6 imports instead of React namespace'
          );
        }
      }
    } catch (error) {
      validation.errors.push(`Validation failed: ${error.message}`);
      validation.valid = false;
    }

    return validation;
  }

  /**
   * Suggest file placement for generated code
   * @param {Object} result - Generated code result
   * @param {Object} projectContext - Project context
   * @returns {Object} Placement suggestion
   */
  async suggestFilePlacement(result, projectContext) {
    // Use file placement advisor if available
    if (this.contextTemplateGenerator?.filePlacementAdvisor) {
      try {
        const suggestion =
          await this.contextTemplateGenerator.filePlacementAdvisor.suggestPlacement(
            result.fileName,
            result.componentType
          );
        return suggestion.suggestions[0] || { path: result.fileName };
      } catch (error) {
        logger.warn('File placement suggestion failed', {
          error: error.message,
        });
      }
    }

    // Fallback to basic placement
    return {
      path: result.fileName,
      reasoning: 'Generated based on component type and framework conventions',
    };
  }

  /**
   * Analyze existing project structure
   * @returns {Object} Structure analysis
   */
  async analyzeExistingStructure() {
    const structure = {
      hasSrc: false,
      hasComponents: false,
      hasServices: false,
      hasControllers: false,
      hasModels: false,
      directories: [],
    };

    try {
      const entries = await fs.readdir(this.projectRoot);

      for (const entry of entries) {
        const fullPath = path.join(this.projectRoot, entry);
        const stat = await fs.stat(fullPath);

        if (stat.isDirectory()) {
          structure.directories.push(entry);

          if (entry === 'src') structure.hasSrc = true;
          if (entry === 'components') structure.hasComponents = true;
          if (entry === 'services') structure.hasServices = true;
          if (entry === 'controllers') structure.hasControllers = true;
          if (entry === 'models') structure.hasModels = true;
        }
      }
    } catch (error) {
      // Ignore analysis errors
    }

    return structure;
  }

  /**
   * Get supported frameworks
   * @returns {Array} List of supported frameworks
   */
  getSupportedFrameworks() {
    return Object.keys(this.generators);
  }

  /**
   * Get supported component types for a framework
   * @param {string} framework - Framework name
   * @returns {Array} Supported component types
   */
  getSupportedComponentTypes(framework) {
    const generator = this.generators[framework];
    return generator ? generator.getSupportedTypes() : [];
  }
}

// Framework-specific generators

class ReactCodeGenerator {
  async generate(componentType, name, context) {
    const { specifications, projectContext } = context;

    switch (componentType) {
      case 'component':
        return this.generateReactComponent(name, specifications);
      case 'hook':
        return this.generateReactHook(name, specifications);
      case 'context':
        return this.generateReactContext(name, specifications);
      case 'service':
        return this.generateReactService(name, specifications);
      default:
        throw new Error(`Unsupported React component type: ${componentType}`);
    }
  }

  async generateReactComponent(name, specs) {
    const pascalName = this.pascalCase(name);
    const props = specs.props || ['data', 'onAction'];
    const hooks = specs.hooks || ['useState', 'useEffect'];

    const code = `import React, { ${hooks.join(', ')} } from 'react';
import PropTypes from 'prop-types';
import './${this.kebabCase(name)}.css';

const ${pascalName} = ({ ${props.join(', ')} }) => {
  ${hooks.includes('useState') ? `const [state, setState] = useState(${specs.initialState || 'null'});` : ''}

  ${
    hooks.includes('useEffect')
      ? `useEffect(() => {
    // Component initialization
    ${specs.effectLogic || '// TODO: Add effect logic'}

    return () => {
      // Cleanup
      ${specs.cleanupLogic || '// TODO: Add cleanup logic'}
    };
  }, [${specs.dependencies ? specs.dependencies.join(', ') : ''}]);`
      : ''
  }

  const handleAction = () => {
    // TODO: Implement action handler
    ${specs.actionLogic || "console.log('Action triggered');"}
  };

  return (
    <div className="${this.kebabCase(name)}">
      ${
        specs.renderLogic ||
        `<h2>${name}</h2>
      {/* TODO: Add component content */}
      <button onClick={handleAction}>
        ${specs.buttonText || 'Action'}
      </button>`
      }
    </div>
  );
};

${pascalName}.propTypes = {
  ${props.map((prop) => `${prop}: PropTypes.any`).join(',\n  ')}
};

${pascalName}.defaultProps = {
  ${props.map((prop) => `${prop}: ${specs.defaultProps ? specs.defaultProps[prop] : 'null'}`).join(',\n  ')}
};

export default ${pascalName};
`;

    const cssCode = `.${this.kebabCase(name)} {
  /* TODO: Add component styles */
  padding: 1rem;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.${this.kebabCase(name)} h2 {
  margin-top: 0;
  color: #333;
}

.${this.kebabCase(name)} button {
  background: #007bff;
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 4px;
  cursor: pointer;
}

.${this.kebabCase(name)} button:hover {
  background: #0056b3;
}
`;

    return {
      code,
      additionalFiles: [
        {
          fileName: `${this.kebabCase(name)}.css`,
          code: cssCode,
          language: 'css',
        },
      ],
      fileName: `${pascalName}.jsx`,
      componentType: 'component',
      language: 'javascript',
      framework: 'React',
    };
  }

  async generateReactHook(name, specs) {
    const camelName = this.camelCase(name);
    const dependencies = specs.dependencies || [];

    const code = `import { useState, useEffect, useCallback } from 'react';

/**
 * Custom hook for ${name}
 * @param {Object} config - Configuration object
 * @returns {Object} Hook state and actions
 */
export const use${this.pascalCase(name)} = (config = {}) => {
  const [data, setData] = useState(${specs.initialData || 'null'});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      ${specs.fetchLogic || '// TODO: Implement data fetching'}

      setData(fetchedData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [${dependencies.join(', ')}]);

  const updateData = useCallback((newData) => {
    setData(newData);
    ${specs.updateLogic || '// TODO: Implement data update'}
  }, []);

  useEffect(() => {
    ${specs.autoFetch ? 'fetchData();' : '// TODO: Add effect logic'}
  }, [${dependencies.join(', ')}]);

  return {
    data,
    loading,
    error,
    fetchData,
    updateData,
    refetch: fetchData
  };
};

export default use${this.pascalCase(name)};
`;

    return {
      code,
      fileName: `use${this.pascalCase(name)}.js`,
      componentType: 'hook',
      language: 'javascript',
      framework: 'React',
    };
  }

  getSupportedTypes() {
    return ['component', 'hook', 'context', 'service'];
  }

  // Utility methods
  pascalCase(str) {
    return str.replace(/(^\w|-\w)/g, (match) =>
      match.replace('-', '').toUpperCase()
    );
  }

  camelCase(str) {
    return str.replace(/(^\w|-\w)/g, (match, index) =>
      index === 0 ? match.toLowerCase() : match.replace('-', '').toUpperCase()
    );
  }

  kebabCase(str) {
    return str.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
  }
}

class ExpressCodeGenerator {
  async generate(componentType, name, context) {
    const { specifications, projectContext } = context;

    switch (componentType) {
      case 'controller':
        return this.generateExpressController(name, specifications);
      case 'route':
        return this.generateExpressRoute(name, specifications);
      case 'middleware':
        return this.generateExpressMiddleware(name, specifications);
      case 'service':
        return this.generateExpressService(name, specifications);
      default:
        throw new Error(`Unsupported Express component type: ${componentType}`);
    }
  }

  async generateExpressController(name, specs) {
    const pascalName = this.pascalCase(name);
    const methods = specs.methods || [
      'getAll',
      'getById',
      'create',
      'update',
      'delete',
    ];

    const code = `import { validationResult } from 'express-validator';
import logger from '../utils/logger.js';

/**
 * ${pascalName} Controller
 * Handles HTTP requests for ${name} operations
 */
class ${pascalName}Controller {
  constructor(${specs.serviceName ? `${this.camelCase(specs.serviceName)}Service` : ''}) {
    ${specs.serviceName ? `this.${this.camelCase(specs.serviceName)}Service = ${this.camelCase(specs.serviceName)}Service;` : ''}
  }

  /**
   * Get all ${name}s
   */
  async getAll(req, res, next) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }

      ${specs.serviceName ? `const result = await this.${this.camelCase(specs.serviceName)}Service.getAll(req.query);` : '// TODO: Implement getAll logic'}

      res.json({
        success: true,
        data: ${specs.serviceName ? 'result' : '[]'},
        message: '${name}s retrieved successfully'
      });

    } catch (error) {
      logger.error('Failed to get ${name}s', {
        error: error.message,
        userId: req.user?.id
      });
      next(error);
    }
  }

  /**
   * Get ${name} by ID
   */
  async getById(req, res, next) {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'ID is required'
        });
      }

      ${specs.serviceName ? `const result = await this.${this.camelCase(specs.serviceName)}Service.getById(id);` : '// TODO: Implement getById logic'}

      if (!${specs.serviceName ? 'result' : 'true'}) {
        return res.status(404).json({
          success: false,
          message: '${name} not found'
        });
      }

      res.json({
        success: true,
        data: ${specs.serviceName ? 'result' : 'null'},
        message: '${name} retrieved successfully'
      });

    } catch (error) {
      logger.error('Failed to get ${name}', {
        error: error.message,
        id: req.params.id,
        userId: req.user?.id
      });
      next(error);
    }
  }

  /**
   * Create new ${name}
   */
  async create(req, res, next) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }

      ${specs.serviceName ? `const result = await this.${this.camelCase(specs.serviceName)}Service.create(req.body);` : '// TODO: Implement create logic'}

      res.status(201).json({
        success: true,
        data: ${specs.serviceName ? 'result' : 'null'},
        message: '${name} created successfully'
      });

    } catch (error) {
      logger.error('Failed to create ${name}', {
        error: error.message,
        userId: req.user?.id
      });
      next(error);
    }
  }

  /**
   * Update ${name}
   */
  async update(req, res, next) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }

      const { id } = req.params;

      ${specs.serviceName ? `const result = await this.${this.camelCase(specs.serviceName)}Service.update(id, req.body);` : '// TODO: Implement update logic'}

      if (!${specs.serviceName ? 'result' : 'true'}) {
        return res.status(404).json({
          success: false,
          message: '${name} not found'
        });
      }

      res.json({
        success: true,
        data: ${specs.serviceName ? 'result' : 'null'},
        message: '${name} updated successfully'
      });

    } catch (error) {
      logger.error('Failed to update ${name}', {
        error: error.message,
        id: req.params.id,
        userId: req.user?.id
      });
      next(error);
    }
  }

  /**
   * Delete ${name}
   */
  async delete(req, res, next) {
    try {
      const { id } = req.params;

      ${specs.serviceName ? `const result = await this.${this.camelCase(specs.serviceName)}Service.delete(id);` : '// TODO: Implement delete logic'}

      if (!${specs.serviceName ? 'result' : 'true'}) {
        return res.status(404).json({
          success: false,
          message: '${name} not found'
        });
      }

      res.json({
        success: true,
        message: '${name} deleted successfully'
      });

    } catch (error) {
      logger.error('Failed to delete ${name}', {
        error: error.message,
        id: req.params.id,
        userId: req.user?.id
      });
      next(error);
    }
  }
}

export default ${pascalName}Controller;
`;

    return {
      code,
      fileName: `${pascalName}Controller.js`,
      componentType: 'controller',
      language: 'javascript',
      framework: 'Express.js',
    };
  }

  getSupportedTypes() {
    return ['controller', 'route', 'middleware', 'service'];
  }

  // Utility methods
  pascalCase(str) {
    return str.replace(/(^\w|-\w)/g, (match) =>
      match.replace('-', '').toUpperCase()
    );
  }

  camelCase(str) {
    return str.replace(/(^\w|-\w)/g, (match, index) =>
      index === 0 ? match.toLowerCase() : match.replace('-', '').toUpperCase()
    );
  }
}

// Placeholder classes for other frameworks
class AngularCodeGenerator {
  async generate(componentType, name, context) {
    throw new Error('Angular code generation not yet implemented');
  }

  getSupportedTypes() {
    return ['component', 'service', 'directive', 'pipe', 'guard'];
  }
}

class VueCodeGenerator {
  async generate(componentType, name, context) {
    throw new Error('Vue.js code generation not yet implemented');
  }

  getSupportedTypes() {
    return ['component', 'composable', 'plugin', 'directive'];
  }
}

class DjangoCodeGenerator {
  async generate(componentType, name, context) {
    throw new Error('Django code generation not yet implemented');
  }

  getSupportedTypes() {
    return ['model', 'view', 'form', 'serializer', 'admin'];
  }
}

class FastApiCodeGenerator {
  async generate(componentType, name, context) {
    throw new Error('FastAPI code generation not yet implemented');
  }

  getSupportedTypes() {
    return ['model', 'route', 'schema', 'dependency'];
  }
}

class NextJsCodeGenerator {
  async generate(componentType, name, context) {
    throw new Error('Next.js code generation not yet implemented');
  }

  getSupportedTypes() {
    return ['page', 'component', 'api', 'middleware'];
  }
}

class NestJsCodeGenerator {
  async generate(componentType, name, context) {
    throw new Error('NestJS code generation not yet implemented');
  }

  getSupportedTypes() {
    return ['controller', 'service', 'module', 'guard', 'decorator'];
  }
}
