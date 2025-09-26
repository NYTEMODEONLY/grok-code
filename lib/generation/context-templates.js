import fs from 'fs-extra';
import path from 'path';
import { logger } from '../utils/logger.js';

/**
 * Context-Aware Code Template Generator
 * Generates code templates that respect project architecture, frameworks, and conventions
 */
export class ContextTemplateGenerator {
  constructor(options = {}) {
    this.projectRoot = options.projectRoot || process.cwd();
    this.frameworkDetector = options.frameworkDetector;
    this.conventionAnalyzer = options.conventionAnalyzer;
    this.architectureMapper = options.architectureMapper;
    this.filePlacementAdvisor = options.filePlacementAdvisor;

    // Template categories
    this.templates = {
      components: {},
      services: {},
      controllers: {},
      models: {},
      routes: {},
      utilities: {},
      configs: {},
      tests: {}
    };

    // Framework-specific template overrides
    this.frameworkTemplates = {
      'React': this.getReactTemplates(),
      'Express.js': this.getExpressTemplates(),
      'Angular': this.getAngularTemplates(),
      'Vue.js': this.getVueTemplates(),
      'Django': this.getDjangoTemplates(),
      'FastAPI': this.getFastApiTemplates()
    };

    logger.info('Context template generator initialized', {
      projectRoot: this.projectRoot
    });
  }

  /**
   * Generate a context-aware code template
   * @param {string} templateType - Type of template (component, service, etc.)
   * @param {string} name - Name for the generated code
   * @param {Object} context - Additional context for generation
   * @returns {Object} Generated template with code and metadata
   */
  async generateTemplate(templateType, name, context = {}) {
    try {
      logger.info('Generating context-aware template', { templateType, name });

      // Analyze project context
      const projectContext = await this.analyzeProjectContext();

      // Determine framework-specific templates
      const framework = this.determinePrimaryFramework(projectContext);
      const frameworkTemplates = this.frameworkTemplates[framework] || {};

      // Get base template
      const baseTemplate = this.getBaseTemplate(templateType, name, context);

      // Apply framework-specific customizations
      const frameworkTemplate = frameworkTemplates[templateType];
      if (frameworkTemplate) {
        this.applyFrameworkTemplate(baseTemplate, frameworkTemplate, name, context);
      }

      // Apply architectural patterns
      this.applyArchitecturalPatterns(baseTemplate, projectContext, templateType);

      // Apply project conventions
      await this.applyProjectConventions(baseTemplate, projectContext, templateType);

      // Generate final code
      const generatedCode = this.renderTemplate(baseTemplate, {
        name,
        context,
        projectContext,
        framework
      });

      // Suggest optimal file placement
      const placementSuggestion = await this.suggestFilePlacement(name, templateType, context);

      logger.info('Template generated successfully', {
        templateType,
        name,
        framework,
        codeLength: generatedCode.length
      });

      return {
        code: generatedCode,
        template: baseTemplate,
        metadata: {
          type: templateType,
          name,
          framework,
          conventions: projectContext.conventions,
          placement: placementSuggestion,
          dependencies: this.extractDependencies(generatedCode),
          imports: this.extractImports(generatedCode)
        }
      };

    } catch (error) {
      logger.error('Failed to generate template', { error: error.message, templateType, name });
      throw error;
    }
  }

  /**
   * Analyze the current project context
   * @returns {Object} Project context analysis
   */
  async analyzeProjectContext() {
    const context = {
      frameworks: [],
      conventions: {},
      architecture: null,
      structure: {},
      patterns: {}
    };

    try {
      // Get framework information
      if (this.frameworkDetector) {
        const frameworkResult = await this.frameworkDetector.detectFrameworks();
        context.frameworks = frameworkResult.frameworks || [];
      }

      // Get convention information
      if (this.conventionAnalyzer) {
        const conventionResult = await this.conventionAnalyzer.analyzeProject();
        context.conventions = conventionResult || {};
      }

      // Get architecture information
      if (this.architectureMapper) {
        const archResult = await this.architectureMapper.analyzeArchitecture();
        context.architecture = archResult.architecture;
      }

      // Analyze project structure
      context.structure = await this.analyzeProjectStructure();

    } catch (error) {
      logger.warn('Project context analysis partially failed', { error: error.message });
    }

    return context;
  }

  /**
   * Determine the primary framework for template generation
   * @param {Object} projectContext - Project context
   * @returns {string} Primary framework name
   */
  determinePrimaryFramework(projectContext) {
    const frameworks = projectContext.frameworks || [];

    // Find framework with highest confidence
    let primary = 'JavaScript';
    let maxConfidence = 0;

    for (const fw of frameworks) {
      if (fw.confidence > maxConfidence) {
        primary = fw.name;
        maxConfidence = fw.confidence;
      }
    }

    return primary;
  }

  /**
   * Get base template structure
   * @param {string} templateType - Template type
   * @param {string} name - Template name
   * @param {Object} context - Context
   * @returns {Object} Base template structure
   */
  getBaseTemplate(templateType, name, context) {
    const templates = {
      component: {
        structure: {
          imports: [],
          classDeclaration: `class ${this.pascalCase(name)} extends Component`,
          constructor: 'constructor(props)',
          renderMethod: 'render()',
          exports: [`export default ${this.pascalCase(name)};`]
        },
        patterns: {
          props: 'this.props.',
          state: 'this.state.',
          lifecycle: ['componentDidMount', 'componentDidUpdate', 'componentWillUnmount']
        }
      },

      service: {
        structure: {
          imports: ['import logger from \'../utils/logger\';'],
          classDeclaration: `class ${this.pascalCase(name)}`,
          constructor: 'constructor()',
          methods: ['async getAll()', 'async getById(id)', 'async create(data)', 'async update(id, data)', 'async delete(id)'],
          exports: [`export default new ${this.pascalCase(name)}();`]
        },
        patterns: {
          errorHandling: 'try { ... } catch (error) { logger.error(error); throw error; }',
          validation: 'if (!data) throw new Error(\'Invalid data\');'
        }
      },

      controller: {
        structure: {
          imports: ['import { Request, Response } from \'express\';'],
          classDeclaration: `class ${this.pascalCase(name)}Controller`,
          constructor: 'constructor()',
          methods: [
            'async getAll(req: Request, res: Response)',
            'async getById(req: Request, res: Response)',
            'async create(req: Request, res: Response)',
            'async update(req: Request, res: Response)',
            'async delete(req: Request, res: Response)'
          ],
          exports: [`export default new ${this.pascalCase(name)}Controller();`]
        },
        patterns: {
          response: 'res.json({ success: true, data });',
          error: 'res.status(500).json({ success: false, error: error.message });'
        }
      },

      model: {
        structure: {
          imports: ['import mongoose from \'mongoose\';'],
          schema: `const ${this.pascalCase(name)}Schema = new mongoose.Schema({`,
          fields: ['name: String', 'createdAt: { type: Date, default: Date.now }'],
          exports: [`export default mongoose.model('${this.pascalCase(name)}', ${this.pascalCase(name)}Schema);`]
        },
        patterns: {
          validation: 'required: true',
          indexing: 'index: true'
        }
      },

      route: {
        structure: {
          imports: [`import ${this.camelCase(name)}Controller from '../controllers/${this.camelCase(name)}Controller';`],
          router: `const router = express.Router();`,
          routes: [
            `router.get('/', ${this.camelCase(name)}Controller.getAll);`,
            `router.get('/:id', ${this.camelCase(name)}Controller.getById);`,
            `router.post('/', ${this.camelCase(name)}Controller.create);`,
            `router.put('/:id', ${this.camelCase(name)}Controller.update);`,
            `router.delete('/:id', ${this.camelCase(name)}Controller.delete);`
          ],
          exports: ['export default router;']
        }
      },

      utility: {
        structure: {
          imports: [],
          functions: [`export const ${this.camelCase(name)} = () => {\n  // TODO: Implement ${name}\n};`],
          exports: []
        },
        patterns: {
          errorHandling: 'try { ... } catch (error) { console.error(error); return null; }'
        }
      },

      config: {
        structure: {
          imports: [],
          config: `const ${this.camelCase(name)}Config = {\n  // TODO: Add configuration\n};`,
          exports: [`export default ${this.camelCase(name)}Config;`]
        }
      },

      test: {
        structure: {
          imports: [
            `import ${this.pascalCase(name)} from '../${this.camelCase(name)}';`,
            'import { expect } from \'chai\';'
          ],
          describes: [`describe('${this.pascalCase(name)}', () => {`],
          its: ['it(\'should work correctly\', () => {', '  // TODO: Write test', '});'],
          exports: []
        },
        patterns: {
          assertion: 'expect(result).to.equal(expected);',
          setup: 'beforeEach(() => { ... });'
        }
      }
    };

    return templates[templateType] || templates.utility;
  }

  /**
   * Apply framework-specific template customizations
   * @param {Object} template - Base template
   * @param {Object} frameworkTemplate - Framework-specific template
   * @param {string} name - Template name
   * @param {Object} context - Context
   */
  applyFrameworkTemplate(template, frameworkTemplate, name, context) {
    // Merge framework-specific structure
    if (frameworkTemplate.structure) {
      Object.assign(template.structure, frameworkTemplate.structure);
    }

    // Merge framework-specific patterns
    if (frameworkTemplate.patterns) {
      Object.assign(template.patterns, frameworkTemplate.patterns);
    }

    // Apply framework-specific transformations
    if (frameworkTemplate.transform) {
      frameworkTemplate.transform(template, name, context);
    }
  }

  /**
   * Apply architectural patterns to template
   * @param {Object} template - Template to modify
   * @param {Object} projectContext - Project context
   * @param {string} templateType - Template type
   */
  applyArchitecturalPatterns(template, projectContext, templateType) {
    const architecture = projectContext.architecture;

    if (!architecture) return;

    // MVC Architecture
    if (architecture.pattern === 'MVC') {
      if (templateType === 'controller') {
        template.structure.methods = template.structure.methods.map(method =>
          method.replace('async ', 'async ').replace(')', ', next)')
        );
      }
    }

    // Layered Architecture
    if (architecture.pattern === 'Layered') {
      if (templateType === 'service') {
        template.structure.imports.push('import Repository from \'../repositories/Repository\';');
        template.structure.methods = template.structure.methods.map(method =>
          method.replace('async ', 'async ').replace(' {', ' {\n    const repository = new Repository();\n    ')
        );
      }
    }

    // Clean Architecture
    if (architecture.pattern === 'Clean') {
      template.structure.imports.push('// Clean Architecture: Use Cases and Entities');
      if (templateType === 'service') {
        template.structure.methods = template.structure.methods.map(method =>
          method.replace('async ', 'async ').replace(' {', ' {\n    // Use Case: ${method.split(\'(\')[0]}\n    ')
        );
      }
    }
  }

  /**
   * Apply project-specific conventions to template
   * @param {Object} template - Template to modify
   * @param {Object} projectContext - Project context
   * @param {string} templateType - Template type
   */
  async applyProjectConventions(template, projectContext, templateType) {
    const conventions = projectContext.conventions;

    if (!conventions) return;

    // Apply naming conventions
    if (conventions.naming) {
      // Apply to class names, method names, etc.
      if (conventions.naming.classes === 'PascalCase') {
        // Already using PascalCase
      }
      if (conventions.naming.methods === 'camelCase') {
        // Already using camelCase
      }
    }

    // Apply import conventions
    if (conventions.imports) {
      if (conventions.imports.style === 'named') {
        // Convert default imports to named imports where appropriate
        template.structure.imports = template.structure.imports.map(imp => {
          if (imp.includes('import ') && imp.includes(' from ')) {
            return imp.replace(/import (\w+) from/, 'import { $1 } from');
          }
          return imp;
        });
      }
    }

    // Apply quote conventions
    if (conventions.quotes) {
      const preferredQuote = conventions.quotes.preferred === 'single' ? '\'' : '"';
      // Apply to string literals in template
      template.quotePreference = preferredQuote;
    }

    // Apply semicolon conventions
    if (conventions.semicolons) {
      template.semicolonPreference = conventions.semicolons.required ? ';' : '';
    }
  }

  /**
   * Render the final template code
   * @param {Object} template - Template structure
   * @param {Object} variables - Variables for rendering
   * @returns {string} Generated code
   */
  renderTemplate(template, variables) {
    const { name, context, projectContext, framework } = variables;

    let code = '';

    // Add file header comment
    code += `/**\n`;
    code += ` * ${this.pascalCase(name)} ${template.structure.classDeclaration ? 'Class' : 'Module'}\n`;
    code += ` * Generated by Grok Code - Context-Aware Template Generator\n`;
    code += ` * Framework: ${framework}\n`;
    code += ` * Generated: ${new Date().toISOString()}\n`;
    code += ` */\n\n`;

    // Add imports
    if (template.structure.imports && template.structure.imports.length > 0) {
      code += template.structure.imports.join('\n') + '\n\n';
    }

    // Add class/interface declaration
    if (template.structure.classDeclaration) {
      code += template.structure.classDeclaration + ' {\n';
    }

    // Add constructor
    if (template.structure.constructor) {
      code += `  ${template.structure.constructor} {\n`;
      code += `    // TODO: Initialize ${name}\n`;
      code += `  }\n\n`;
    }

    // Add methods
    if (template.structure.methods) {
      template.structure.methods.forEach(method => {
        code += `  ${method} {\n`;
        code += `    // TODO: Implement ${method.split('(')[0]}\n`;
        code += `  }\n\n`;
      });
    }

    // Add schema for models
    if (template.structure.schema) {
      code += template.structure.schema + '\n';
      if (template.structure.fields) {
        code += '  ' + template.structure.fields.join(',\n  ') + '\n';
      }
      code += '});\n\n';
    }

    // Add router configuration for routes
    if (template.structure.router) {
      code += template.structure.router + '\n\n';
      if (template.structure.routes) {
        code += template.structure.routes.join('\n') + '\n\n';
      }
    }

    // Add config object
    if (template.structure.config) {
      code += template.structure.config + '\n\n';
    }

    // Add test structure
    if (template.structure.describes) {
      code += template.structure.describes[0] + '\n';
      if (template.structure.its) {
        template.structure.its.forEach(it => {
          code += '  ' + it + '\n';
        });
      }
      code += '});\n\n';
    }

    // Close class
    if (template.structure.classDeclaration) {
      code += '}\n\n';
    }

    // Add exports
    if (template.structure.exports && template.structure.exports.length > 0) {
      code += template.structure.exports.join('\n') + '\n';
    }

    return code;
  }

  /**
   * Suggest optimal file placement for generated code
   * @param {string} name - Template name
   * @param {string} templateType - Template type
   * @param {Object} context - Context
   * @returns {Object} Placement suggestion
   */
  async suggestFilePlacement(name, templateType, context) {
    if (!this.filePlacementAdvisor) {
      return { path: `src/${templateType}s/${this.kebabCase(name)}.js` };
    }

    try {
      const fileName = `${this.pascalCase(name)}.js`;
      const suggestion = await this.filePlacementAdvisor.suggestPlacement(fileName, templateType, context);

      return suggestion.suggestions[0] || { path: `src/${templateType}s/${this.kebabCase(name)}.js` };
    } catch (error) {
      logger.warn('File placement suggestion failed', { error: error.message });
      return { path: `src/${templateType}s/${this.kebabCase(name)}.js` };
    }
  }

  /**
   * Extract dependencies from generated code
   * @param {string} code - Generated code
   * @returns {Array} Dependencies
   */
  extractDependencies(code) {
    const dependencies = [];
    const importRegex = /import\s+.*?\s+from\s+['"]([^'"]+)['"]/g;
    let match;

    while ((match = importRegex.exec(code)) !== null) {
      dependencies.push(match[1]);
    }

    return [...new Set(dependencies)]; // Remove duplicates
  }

  /**
   * Extract imports from generated code
   * @param {string} code - Generated code
   * @returns {Array} Import statements
   */
  extractImports(code) {
    const imports = [];
    const importRegex = /import\s+.*?\s+from\s+['"][^'"]+['"];?\s*$/gm;
    let match;

    while ((match = importRegex.exec(code)) !== null) {
      imports.push(match[0].trim());
    }

    return imports;
  }

  /**
   * Analyze project structure for context
   * @returns {Object} Project structure analysis
   */
  async analyzeProjectStructure() {
    const structure = {
      hasSrc: false,
      hasLib: false,
      hasApp: false,
      hasComponents: false,
      hasServices: false,
      hasControllers: false,
      hasModels: false,
      hasRoutes: false
    };

    try {
      const entries = await fs.readdir(this.projectRoot);

      structure.hasSrc = entries.includes('src');
      structure.hasLib = entries.includes('lib');
      structure.hasApp = entries.includes('app');

      if (structure.hasSrc) {
        const srcEntries = await fs.readdir(path.join(this.projectRoot, 'src'));
        structure.hasComponents = srcEntries.includes('components');
        structure.hasServices = srcEntries.includes('services');
        structure.hasControllers = srcEntries.includes('controllers');
        structure.hasModels = srcEntries.includes('models');
        structure.hasRoutes = srcEntries.includes('routes');
      }

    } catch (error) {
      // Ignore structure analysis errors
    }

    return structure;
  }

  /**
   * Get React-specific templates
   * @returns {Object} React templates
   */
  getReactTemplates() {
    return {
      component: {
        structure: {
          imports: ['import React, { useState, useEffect } from \'react\';'],
          classDeclaration: null, // React uses functional components by default
          functionalComponent: `const ${this.pascalCase('{{name}}')} = ({ {{props}} }) => {`,
          hooks: ['const [state, setState] = useState(initialState);'],
          effects: ['useEffect(() => {\n    // Component effect\n    return () => {\n      // Cleanup\n    };\n  }, []);'],
          render: 'return (\n    <div>\n      {/* TODO: Render component */}\n    </div>\n  );',
          exports: ['export default {{name}};']
        },
        patterns: {
          props: '{children}',
          state: 'useState',
          effects: 'useEffect'
        },
        transform: (template, name, context) => {
          // Convert to functional component structure
          template.structure.functionalComponent = template.structure.functionalComponent.replace('{{name}}', this.pascalCase(name));
          template.structure.functionalComponent = template.structure.functionalComponent.replace('{{props}}', context.props || '');
        }
      },

      service: {
        structure: {
          imports: [],
          functions: [
            `export const get{{name}} = async () => {\n  // TODO: Implement get{{name}}\n};`,
            `export const create{{name}} = async (data) => {\n  // TODO: Implement create{{name}}\n};`,
            `export const update{{name}} = async (id, data) => {\n  // TODO: Implement update{{name}}\n};`,
            `export const delete{{name}} = async (id) => {\n  // TODO: Implement delete{{name}}\n};`
          ]
        },
        transform: (template, name, context) => {
          const pascalName = this.pascalCase(name);
          template.structure.functions = template.structure.functions.map(fn =>
            fn.replace(/\{\{name\}\}/g, pascalName)
          );
        }
      }
    };
  }

  /**
   * Get Express-specific templates
   * @returns {Object} Express templates
   */
  getExpressTemplates() {
    return {
      controller: {
        structure: {
          imports: ['import { Request, Response, NextFunction } from \'express\';'],
          methods: [
            'async getAll(req: Request, res: Response, next: NextFunction)',
            'async getById(req: Request, res: Response, next: NextFunction)',
            'async create(req: Request, res: Response, next: NextFunction)',
            'async update(req: Request, res: Response, next: NextFunction)',
            'async delete(req: Request, res: Response, next: NextFunction)'
          ]
        },
        patterns: {
          middleware: 'try {\n    // Controller logic\n    res.json({ success: true, data });\n  } catch (error) {\n    next(error);\n  }',
          validation: 'const { error } = validateData(req.body);\n  if (error) return res.status(400).json({ success: false, error: error.details[0].message });'
        }
      },

      route: {
        structure: {
          imports: [
            'import express, { Router } from \'express\';',
            'import rateLimit from \'express-rate-limit\';'
          ],
          router: 'const router = Router();',
          middleware: [
            '// Rate limiting\nrouter.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }));',
            '// Authentication middleware would go here'
          ]
        }
      }
    };
  }

  /**
   * Get Angular-specific templates
   * @returns {Object} Angular templates
   */
  getAngularTemplates() {
    return {
      component: {
        structure: {
          imports: [
            'import { Component, OnInit } from \'@angular/core\';',
            'import { CommonModule } from \'@angular/common\';'
          ],
          decorator: '@Component({\n  selector: \'app-{{name}}\',\n  standalone: true,\n  imports: [CommonModule],\n  templateUrl: \'./{{name}}.component.html\',\n  styleUrl: \'./{{name}}.component.scss\'\n})',
          classDeclaration: 'export class {{name}}Component implements OnInit',
          lifecycle: ['ngOnInit(): void {\n    // Component initialization\n  }']
        },
        transform: (template, name, context) => {
          const kebabName = this.kebabCase(name);
          template.structure.decorator = template.structure.decorator.replace(/\{\{name\}\}/g, kebabName);
          template.structure.classDeclaration = template.structure.classDeclaration.replace('{{name}}', this.pascalCase(name));
        }
      },

      service: {
        structure: {
          imports: ['import { Injectable } from \'@angular/core\';'],
          decorator: '@Injectable({\n  providedIn: \'root\'\n})',
          classDeclaration: 'export class {{name}}Service',
          methods: [
            'getAll(): Observable<any[]> {\n    // TODO: Implement getAll\n    return of([]);\n  }',
            'getById(id: string): Observable<any> {\n    // TODO: Implement getById\n    return of(null);\n  }',
            'create(data: any): Observable<any> {\n    // TODO: Implement create\n    return of(null);\n  }'
          ]
        },
        transform: (template, name, context) => {
          template.structure.classDeclaration = template.structure.classDeclaration.replace('{{name}}', this.pascalCase(name));
        }
      }
    };
  }

  /**
   * Get Vue-specific templates
   * @returns {Object} Vue templates
   */
  getVueTemplates() {
    return {
      component: {
        structure: {
          template: '<template>\n  <div>\n    <!-- TODO: Component template -->\n  </div>\n</template>',
          script: '<script setup lang="ts">\n// TODO: Component logic\n</script>',
          style: '<style scoped>\n/* TODO: Component styles */\n</style>'
        }
      }
    };
  }

  /**
   * Get Django-specific templates
   * @returns {Object} Django templates
   */
  getDjangoTemplates() {
    return {
      model: {
        structure: {
          imports: ['from django.db import models'],
          classDeclaration: 'class {{name}}(models.Model):',
          fields: [
            'name = models.CharField(max_length=100)',
            'created_at = models.DateTimeField(auto_now_add=True)',
            'updated_at = models.DateTimeField(auto_now=True)'
          ],
          meta: 'class Meta:\n        ordering = [\'-created_at\']',
          methods: ['def __str__(self):\n        return self.name']
        },
        transform: (template, name, context) => {
          template.structure.classDeclaration = template.structure.classDeclaration.replace('{{name}}', this.pascalCase(name));
        }
      },

      view: {
        structure: {
          imports: [
            'from django.shortcuts import render, get_object_or_404',
            'from django.http import JsonResponse',
            'from .models import {{name}}'
          ],
          functions: [
            'def {{name}}_list(request):\n    {{name}}s = {{name}}.objects.all()\n    return render(request, \'{{name}}/list.html\', {\'{{name}}s\': {{name}}s})',
            'def {{name}}_detail(request, pk):\n    {{name}} = get_object_or_404({{name}}, pk=pk)\n    return render(request, \'{{name}}/detail.html\', {\'{{name}}\': {{name}}})'
          ]
        },
        transform: (template, name, context) => {
          const pascalName = this.pascalCase(name);
          const camelName = this.camelCase(name);
          template.structure.imports = template.structure.imports.map(imp =>
            imp.replace(/\{\{name\}\}/g, pascalName)
          );
          template.structure.functions = template.structure.functions.map(fn =>
            fn.replace(/\{\{name\}\}/g, camelName)
          );
        }
      }
    };
  }

  /**
   * Get FastAPI-specific templates
   * @returns {Object} FastAPI templates
   */
  getFastApiTemplates() {
    return {
      model: {
        structure: {
          imports: [
            'from pydantic import BaseModel',
            'from typing import Optional',
            'from datetime import datetime'
          ],
          classDeclaration: 'class {{name}}Base(BaseModel):',
          fields: [
            'name: str',
            'created_at: Optional[datetime] = None'
          ]
        },
        transform: (template, name, context) => {
          template.structure.classDeclaration = template.structure.classDeclaration.replace('{{name}}', this.pascalCase(name));
        }
      },

      route: {
        structure: {
          imports: [
            'from fastapi import APIRouter, Depends, HTTPException',
            'from sqlalchemy.orm import Session',
            'from ..database import get_db',
            'from ..models import {{name}}',
            'from ..schemas import {{name}}Base'
          ],
          router: 'router = APIRouter(prefix="/{{name}}s", tags=["{{name}}s"])',
          endpoints: [
            '@router.get("/", response_model=List[{{name}}Base])\ndef get_{{name}}s(db: Session = Depends(get_db)):\n    return db.query({{name}}).all()',
            '@router.post("/", response_model={{name}}Base)\ndef create_{{name}}({{name}}: {{name}}Base, db: Session = Depends(get_db)):\n    db_{{name}} = {{name}}(**{{name}}.dict())\n    db.add(db_{{name}})\n    db.commit()\n    return db_{{name}}'
          ]
        },
        transform: (template, name, context) => {
          const pascalName = this.pascalCase(name);
          const camelName = this.camelCase(name);
          template.structure.imports = template.structure.imports.map(imp =>
            imp.replace(/\{\{name\}\}/g, pascalName)
          );
          template.structure.router = template.structure.router.replace(/\{\{name\}\}/g, camelName);
          template.structure.endpoints = template.structure.endpoints.map(ep =>
            ep.replace(/\{\{name\}\}/g, camelName)
          );
        }
      }
    };
  }

  // Utility methods for case conversion
  pascalCase(str) {
    return str.replace(/(^\w|-\w)/g, (match) => match.replace('-', '').toUpperCase());
  }

  camelCase(str) {
    return str.replace(/(^\w|-\w)/g, (match, index) => index === 0 ? match.toLowerCase() : match.replace('-', '').toUpperCase());
  }

  kebabCase(str) {
    return str.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
  }
}
