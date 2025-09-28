import fs from 'fs-extra';
import path from 'path';
import { logger } from '../utils/logger.js';

/**
 * Project Architecture and Layer Mapping System
 * Analyzes project structure to identify architectural patterns and layers
 */
export class ArchitectureMapper {
  constructor(options = {}) {
    this.projectRoot = options.projectRoot || process.cwd();
    this.maxDepth = options.maxDepth || 5;
    this.includeNodeModules = options.includeNodeModules || false;

    // Architecture patterns to detect
    this.architecturePatterns = {
      mvc: {
        name: 'Model-View-Controller',
        indicators: {
          folders: ['models', 'views', 'controllers', 'routes'],
          files: ['*Controller.js', '*Model.js', '*View.js'],
          structure: ['app/controllers', 'app/models', 'app/views'],
        },
        layers: ['Presentation', 'Controller', 'Model', 'Data'],
      },

      layered: {
        name: 'Layered Architecture',
        indicators: {
          folders: [
            'presentation',
            'business',
            'data',
            'infrastructure',
            'domain',
          ],
          files: ['*Service.js', '*Repository.js', '*Controller.js'],
          structure: ['src/presentation', 'src/business', 'src/data'],
        },
        layers: ['Presentation', 'Business', 'Data', 'Infrastructure'],
      },

      clean: {
        name: 'Clean Architecture',
        indicators: {
          folders: ['entities', 'usecases', 'interface-adapters', 'frameworks'],
          files: ['*UseCase.js', '*Interactor.js', '*Presenter.js'],
          structure: ['src/entities', 'src/usecases', 'src/interface-adapters'],
        },
        layers: [
          'Entities',
          'Use Cases',
          'Interface Adapters',
          'Frameworks & Drivers',
        ],
      },

      hexagonal: {
        name: 'Hexagonal Architecture',
        indicators: {
          folders: ['domain', 'application', 'infrastructure', 'adapters'],
          files: ['*Port.js', '*Adapter.js', '*Service.js'],
          structure: ['src/domain', 'src/application', 'src/infrastructure'],
        },
        layers: ['Domain', 'Application', 'Infrastructure', 'Adapters'],
      },

      microservices: {
        name: 'Microservices',
        indicators: {
          folders: ['services', 'api-gateway', 'service-discovery'],
          files: ['docker-compose.yml', 'Dockerfile', '*Service.js'],
          structure: ['services/', 'api-gateway/', 'docker-compose.yml'],
        },
        layers: [
          'API Gateway',
          'Services',
          'Service Discovery',
          'Infrastructure',
        ],
      },

      cqrs: {
        name: 'CQRS (Command Query Responsibility Segregation)',
        indicators: {
          folders: ['commands', 'queries', 'handlers', 'events'],
          files: ['*Command.js', '*Query.js', '*Handler.js', '*Event.js'],
          structure: ['src/commands', 'src/queries', 'src/events'],
        },
        layers: ['Commands', 'Queries', 'Event Handlers', 'Read Models'],
      },

      eventDriven: {
        name: 'Event-Driven Architecture',
        indicators: {
          folders: ['events', 'handlers', 'publishers', 'subscribers'],
          files: ['*Event.js', '*Handler.js', '*Publisher.js'],
          structure: ['src/events', 'src/handlers', 'src/publishers'],
        },
        layers: [
          'Event Publishers',
          'Event Handlers',
          'Event Store',
          'Subscribers',
        ],
      },
    };

    // Analysis results
    this.architecture = {
      detectedPatterns: [],
      confidence: {},
      layers: {},
      components: {},
      relationships: {},
      entryPoints: [],
      recommendations: [],
    };

    logger.info('Architecture mapper initialized', {
      projectRoot: this.projectRoot,
      patternsSupported: Object.keys(this.architecturePatterns).length,
    });
  }

  /**
   * Analyze the project architecture
   * @returns {Object} Architecture analysis results
   */
  async analyzeArchitecture() {
    try {
      logger.info('Starting architecture analysis');

      // Scan project structure
      const structure = await this.scanProjectStructure();

      // Detect architectural patterns
      await this.detectPatterns(structure);

      // Map layers and components
      await this.mapLayersAndComponents(structure);

      // Identify entry points
      await this.identifyEntryPoints(structure);

      // Analyze relationships
      await this.analyzeRelationships(structure);

      // Generate recommendations
      this.generateRecommendations();

      logger.info('Architecture analysis completed', {
        patternsDetected: this.architecture.detectedPatterns.length,
        layersMapped: Object.keys(this.architecture.layers).length,
      });

      return {
        architecture: this.architecture,
        structure: structure,
        summary: this.generateSummary(),
      };
    } catch (error) {
      logger.error('Failed to analyze architecture', { error: error.message });
      throw error;
    }
  }

  /**
   * Scan the project structure
   * @returns {Object} Project structure information
   */
  async scanProjectStructure() {
    const structure = {
      folders: [],
      files: [],
      packageJson: null,
      dockerFiles: [],
      configFiles: [],
    };

    const scanDirectory = async (dir, depth = 0) => {
      if (depth > this.maxDepth) return;

      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          const relativePath = path.relative(this.projectRoot, fullPath);

          // Skip node_modules unless explicitly included
          if (
            !this.includeNodeModules &&
            relativePath.includes('node_modules')
          ) {
            continue;
          }

          if (entry.isDirectory()) {
            structure.folders.push(relativePath);

            // Special handling for certain directories
            if (['src', 'app', 'lib', 'packages'].includes(entry.name)) {
              await scanDirectory(fullPath, depth + 1);
            }
          } else if (entry.isFile()) {
            structure.files.push({
              path: relativePath,
              name: entry.name,
              extension: path.extname(entry.name),
              directory: path.dirname(relativePath),
            });

            // Special files
            if (entry.name === 'package.json') {
              try {
                structure.packageJson = await fs.readJson(fullPath);
              } catch (e) {
                // Ignore JSON parse errors
              }
            } else if (
              ['Dockerfile', 'docker-compose.yml'].includes(entry.name)
            ) {
              structure.dockerFiles.push(relativePath);
            } else if (
              [
                'webpack.config.js',
                'rollup.config.js',
                'vite.config.js',
              ].includes(entry.name)
            ) {
              structure.configFiles.push(relativePath);
            }
          }
        }
      } catch (error) {
        // Skip directories we can't read
      }
    };

    await scanDirectory(this.projectRoot);
    return structure;
  }

  /**
   * Detect architectural patterns in the project
   * @param {Object} structure - Project structure
   */
  async detectPatterns(structure) {
    const patternScores = {};

    for (const [patternKey, pattern] of Object.entries(
      this.architecturePatterns
    )) {
      let score = 0;
      let maxScore = 0;

      // Check folder indicators
      if (pattern.indicators.folders) {
        maxScore += pattern.indicators.folders.length;
        score += pattern.indicators.folders.filter((folder) =>
          structure.folders.some((f) => f.includes(folder))
        ).length;
      }

      // Check file pattern indicators
      if (pattern.indicators.files) {
        maxScore += pattern.indicators.files.length;
        for (const filePattern of pattern.indicators.files) {
          const regex = new RegExp(filePattern.replace('*', '.*'));
          if (structure.files.some((file) => regex.test(file.name))) {
            score += 1;
          }
        }
        maxScore += pattern.indicators.files.length;
      }

      // Check structure indicators
      if (pattern.indicators.structure) {
        maxScore += pattern.indicators.structure.length;
        score += pattern.indicators.structure.filter((structPath) =>
          structure.folders.includes(structPath)
        ).length;
      }

      // Calculate confidence
      const confidence = maxScore > 0 ? (score / maxScore) * 100 : 0;
      patternScores[patternKey] = { score, maxScore, confidence };
    }

    // Select patterns with high confidence
    for (const [patternKey, data] of Object.entries(patternScores)) {
      if (data.confidence >= 60) {
        // 60% confidence threshold
        this.architecture.detectedPatterns.push({
          pattern: patternKey,
          name: this.architecturePatterns[patternKey].name,
          confidence: data.confidence,
          score: data.score,
          maxScore: data.maxScore,
        });

        this.architecture.confidence[patternKey] = data.confidence;
      }
    }

    // Sort by confidence
    this.architecture.detectedPatterns.sort(
      (a, b) => b.confidence - a.confidence
    );
  }

  /**
   * Map layers and components based on detected patterns
   * @param {Object} structure - Project structure
   */
  async mapLayersAndComponents(structure) {
    // Use the highest confidence pattern as primary
    const primaryPattern = this.architecture.detectedPatterns[0];

    if (!primaryPattern) {
      // Fallback to generic layered analysis
      await this.analyzeGenericLayers(structure);
      return;
    }

    const pattern = this.architecturePatterns[primaryPattern.pattern];

    // Map files to layers
    for (const file of structure.files) {
      const layer = this.classifyFileIntoLayer(file, pattern);
      if (layer) {
        if (!this.architecture.layers[layer]) {
          this.architecture.layers[layer] = [];
        }
        this.architecture.layers[layer].push(file);
      }
    }

    // Group components
    this.groupComponentsByLayer();
  }

  /**
   * Classify a file into an architectural layer
   * @param {Object} file - File information
   * @param {Object} pattern - Architecture pattern
   * @returns {string|null} Layer name or null
   */
  classifyFileIntoLayer(file, pattern) {
    const fileName = file.name.toLowerCase();
    const filePath = file.path.toLowerCase();

    // MVC pattern classification
    if (pattern.name === 'Model-View-Controller') {
      if (
        filePath.includes('/controllers/') ||
        fileName.includes('controller')
      ) {
        return 'Controller';
      }
      if (filePath.includes('/models/') || fileName.includes('model')) {
        return 'Model';
      }
      if (filePath.includes('/views/') || fileName.includes('view')) {
        return 'View';
      }
    }

    // Layered architecture classification
    if (pattern.name === 'Layered Architecture') {
      if (
        filePath.includes('/presentation/') ||
        fileName.includes('controller')
      ) {
        return 'Presentation';
      }
      if (filePath.includes('/business/') || fileName.includes('service')) {
        return 'Business';
      }
      if (filePath.includes('/data/') || fileName.includes('repository')) {
        return 'Data';
      }
    }

    // Clean architecture classification
    if (pattern.name === 'Clean Architecture') {
      if (filePath.includes('/entities/')) {
        return 'Entities';
      }
      if (filePath.includes('/usecases/') || fileName.includes('usecase')) {
        return 'Use Cases';
      }
      if (
        filePath.includes('/interface-adapters/') ||
        fileName.includes('presenter')
      ) {
        return 'Interface Adapters';
      }
    }

    // Generic classification as fallback
    if (fileName.includes('controller') || fileName.includes('handler')) {
      return 'Presentation';
    }
    if (fileName.includes('service') || fileName.includes('manager')) {
      return 'Business';
    }
    if (fileName.includes('repository') || fileName.includes('dao')) {
      return 'Data';
    }

    return 'Infrastructure'; // Default layer
  }

  /**
   * Analyze generic layers when no specific pattern is detected
   * @param {Object} structure - Project structure
   */
  async analyzeGenericLayers(structure) {
    // Simple heuristic-based layer classification
    for (const file of structure.files) {
      const layer = this.classifyFileGeneric(file);
      if (layer) {
        if (!this.architecture.layers[layer]) {
          this.architecture.layers[layer] = [];
        }
        this.architecture.layers[layer].push(file);
      }
    }

    this.groupComponentsByLayer();
  }

  /**
   * Generic file classification
   * @param {Object} file - File information
   * @returns {string} Layer name
   */
  classifyFileGeneric(file) {
    const fileName = file.name.toLowerCase();
    const filePath = file.path.toLowerCase();

    // Presentation layer
    if (
      filePath.includes('/routes/') ||
      filePath.includes('/controllers/') ||
      fileName.includes('router') ||
      fileName.includes('controller')
    ) {
      return 'Presentation';
    }

    // Business layer
    if (
      filePath.includes('/services/') ||
      fileName.includes('service') ||
      fileName.includes('business') ||
      fileName.includes('logic')
    ) {
      return 'Business';
    }

    // Data layer
    if (
      filePath.includes('/models/') ||
      filePath.includes('/repositories/') ||
      fileName.includes('model') ||
      fileName.includes('repository') ||
      fileName.includes('dao')
    ) {
      return 'Data';
    }

    // Infrastructure layer
    if (
      filePath.includes('/config/') ||
      filePath.includes('/utils/') ||
      fileName.includes('config') ||
      fileName.includes('util')
    ) {
      return 'Infrastructure';
    }

    return 'Application';
  }

  /**
   * Group components by layer
   */
  groupComponentsByLayer() {
    for (const [layerName, files] of Object.entries(this.architecture.layers)) {
      // Group by directory
      const components = {};

      for (const file of files) {
        const dir = file.directory || '.';
        if (!components[dir]) {
          components[dir] = [];
        }
        components[dir].push(file);
      }

      this.architecture.components[layerName] = components;
    }
  }

  /**
   * Identify entry points of the application
   * @param {Object} structure - Project structure
   */
  async identifyEntryPoints(structure) {
    const entryPoints = [];

    // Check package.json for main entry point
    if (structure.packageJson && structure.packageJson.main) {
      entryPoints.push({
        type: 'main',
        file: structure.packageJson.main,
        description: 'Package.json main entry point',
      });
    }

    // Look for common entry point files
    const commonEntries = [
      'index.js',
      'app.js',
      'server.js',
      'main.js',
      'index.ts',
      'app.ts',
    ];

    for (const file of structure.files) {
      if (commonEntries.includes(file.name)) {
        entryPoints.push({
          type: 'application',
          file: file.path,
          description: `Common entry point file: ${file.name}`,
        });
      }
    }

    // Check for scripts in package.json
    if (structure.packageJson && structure.packageJson.scripts) {
      for (const [scriptName, scriptCommand] of Object.entries(
        structure.packageJson.scripts
      )) {
        if (['start', 'dev', 'serve'].includes(scriptName)) {
          entryPoints.push({
            type: 'script',
            script: scriptName,
            command: scriptCommand,
            description: `npm script: ${scriptName}`,
          });
        }
      }
    }

    this.architecture.entryPoints = entryPoints;
  }

  /**
   * Analyze relationships between components
   * @param {Object} structure - Project structure
   */
  async analyzeRelationships(structure) {
    // This would integrate with the dependency graph from Phase 1
    // For now, provide basic relationship analysis

    const relationships = {
      dependencies: {},
      circularDeps: [],
      layerDependencies: {},
    };

    // Analyze layer dependencies
    for (const [layerName, files] of Object.entries(this.architecture.layers)) {
      relationships.layerDependencies[layerName] =
        this.analyzeLayerDependencies(layerName, files);
    }

    this.architecture.relationships = relationships;
  }

  /**
   * Analyze dependencies within a layer
   * @param {string} layerName - Layer name
   * @param {Array} files - Files in the layer
   * @returns {Object} Layer dependency analysis
   */
  analyzeLayerDependencies(layerName, files) {
    const deps = {
      internal: 0,
      external: 0,
      crossLayer: 0,
    };

    // Simple analysis based on imports/requires in files
    // This would be enhanced with the AST parser from Phase 1

    return deps;
  }

  /**
   * Generate architectural recommendations
   */
  generateRecommendations() {
    const recommendations = [];

    // Check for architectural issues
    if (this.architecture.detectedPatterns.length === 0) {
      recommendations.push({
        type: 'architecture',
        priority: 'medium',
        message:
          'No clear architectural pattern detected. Consider adopting MVC, Layered, or Clean Architecture.',
        suggestion:
          'Review project structure and consider implementing a clear architectural pattern.',
      });
    }

    // Check layer separation
    const layerCount = Object.keys(this.architecture.layers).length;
    if (layerCount < 2) {
      recommendations.push({
        type: 'layers',
        priority: 'high',
        message: 'Project appears to have minimal layer separation.',
        suggestion:
          'Consider separating concerns into distinct layers (Presentation, Business, Data).',
      });
    }

    // Check for too many layers (over-engineering)
    if (layerCount > 5) {
      recommendations.push({
        type: 'complexity',
        priority: 'medium',
        message: 'Project has many layers which may indicate over-engineering.',
        suggestion:
          'Review if all layers are necessary or if some can be consolidated.',
      });
    }

    // Entry point recommendations
    if (this.architecture.entryPoints.length === 0) {
      recommendations.push({
        type: 'entry-points',
        priority: 'high',
        message: 'No clear entry points identified.',
        suggestion:
          'Define clear application entry points in package.json or with standard naming.',
      });
    }

    this.architecture.recommendations = recommendations;
  }

  /**
   * Generate a summary of the architecture analysis
   * @returns {Object} Summary information
   */
  generateSummary() {
    const primaryPattern = this.architecture.detectedPatterns[0];

    return {
      primaryArchitecture: primaryPattern ? primaryPattern.name : 'Unknown',
      confidence: primaryPattern ? primaryPattern.confidence : 0,
      layers: Object.keys(this.architecture.layers).length,
      components: Object.values(this.architecture.layers).reduce(
        (sum, files) => sum + files.length,
        0
      ),
      entryPoints: this.architecture.entryPoints.length,
      patternsDetected: this.architecture.detectedPatterns.length,
      recommendations: this.architecture.recommendations.length,
    };
  }

  /**
   * Generate a detailed report
   * @returns {string} Formatted report
   */
  generateReport() {
    let report = '🏗️ Project Architecture Analysis Report\n';
    report += '='.repeat(45) + '\n\n';

    // Primary architecture
    const primary = this.architecture.detectedPatterns[0];
    if (primary) {
      report += `🎯 Primary Architecture: ${primary.name}\n`;
      report += `📊 Confidence: ${primary.confidence.toFixed(1)}%\n`;
      report += `📈 Score: ${primary.score}/${primary.maxScore}\n\n`;
    } else {
      report += '🎯 Primary Architecture: Not clearly identified\n\n';
    }

    // All detected patterns
    if (this.architecture.detectedPatterns.length > 1) {
      report += '🔍 All Detected Patterns:\n';
      this.architecture.detectedPatterns.forEach((pattern) => {
        report += `  • ${pattern.name}: ${pattern.confidence.toFixed(1)}% confidence\n`;
      });
      report += '\n';
    }

    // Layers
    report += '📚 Architectural Layers:\n';
    for (const [layerName, files] of Object.entries(this.architecture.layers)) {
      report += `  • ${layerName}: ${files.length} files\n`;
    }
    report += '\n';

    // Entry points
    if (this.architecture.entryPoints.length > 0) {
      report += '🚪 Entry Points:\n';
      this.architecture.entryPoints.forEach((entry) => {
        report += `  • ${entry.description}\n`;
      });
      report += '\n';
    }

    // Recommendations
    if (this.architecture.recommendations.length > 0) {
      report += '💡 Recommendations:\n';
      this.architecture.recommendations.forEach((rec) => {
        const priorityIcon =
          rec.priority === 'high'
            ? '🔴'
            : rec.priority === 'medium'
              ? '🟡'
              : '🟢';
        report += `  ${priorityIcon} ${rec.message}\n`;
        report += `     💡 ${rec.suggestion}\n`;
      });
      report += '\n';
    }

    return report;
  }
}
