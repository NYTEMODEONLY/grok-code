import fs from 'fs-extra';
import path from 'path';
import { logger } from '../utils/logger.js';

/**
 * Intelligent File Placement Advisor
 * Suggests optimal file placements based on project architecture, patterns, and conventions
 */
export class FilePlacementAdvisor {
  constructor(options = {}) {
    this.projectRoot = options.projectRoot || process.cwd();
    this.architectureMapper = options.architectureMapper;
    this.flowAnalyzer = options.flowAnalyzer;
    this.frameworkDetector = options.frameworkDetector;
    this.conventionAnalyzer = options.conventionAnalyzer;

    // Placement rules and patterns
    this.placementRules = {
      // Architectural layer mappings
      layers: {
        presentation: ['controllers', 'views', 'templates', 'components', 'pages'],
        business: ['services', 'logic', 'managers', 'handlers', 'processors'],
        data: ['models', 'entities', 'repositories', 'daos', 'migrations'],
        infrastructure: ['config', 'middleware', 'utils', 'helpers', 'adapters']
      },

      // Framework-specific patterns
      frameworks: {
        'React': {
          components: 'src/components/',
          pages: 'src/pages/',
          hooks: 'src/hooks/',
          utils: 'src/utils/',
          types: 'src/types/',
          tests: '__tests__/',
          stories: 'src/stories/'
        },
        'Express.js': {
          routes: 'routes/',
          controllers: 'controllers/',
          middleware: 'middleware/',
          models: 'models/',
          services: 'services/',
          config: 'config/',
          utils: 'utils/'
        },
        'Angular': {
          components: 'src/app/components/',
          services: 'src/app/services/',
          models: 'src/app/models/',
          guards: 'src/app/guards/',
          pipes: 'src/app/pipes/',
          directives: 'src/app/directives/'
        },
        'Django': {
          views: 'app/views/',
          models: 'app/models/',
          templates: 'templates/',
          static: 'static/',
          migrations: 'app/migrations/',
          management: 'app/management/commands/'
        }
      },

      // File type patterns
      fileTypes: {
        component: /\.(jsx?|tsx?|vue|svelte)$/,
        controller: /controller\.|routes?\./,
        service: /service\.|manager\./,
        model: /model\.|entity\.|schema\./,
        config: /config\.|settings\.|env\./,
        test: /\.test\.|\.spec\.|__tests__/,
        util: /util\.|helper\.|common\./,
        migration: /migration\.|seed\./
      },

      // Naming patterns that indicate purpose
      namingPatterns: {
        component: /^(use[A-Z]|Component|[A-Z][a-zA-Z]*Component)$/,
        service: /Service$|Manager$|Provider$/,
        controller: /Controller$|Handler$|Router$/,
        model: /Model$|Entity$|Schema$/,
        config: /Config$|Settings$|Constants$/,
        test: /Test$|Spec$/
      }
    };

    logger.info('File placement advisor initialized', {
      projectRoot: this.projectRoot
    });
  }

  /**
   * Suggest optimal file placement for a new file
   * @param {string} fileName - Name of the new file
   * @param {string} fileType - Type/category of the file
   * @param {Object} context - Additional context about the file
   * @returns {Object} Placement suggestions with reasoning
   */
  async suggestPlacement(fileName, fileType, context = {}) {
    try {
      logger.info('Analyzing file placement suggestion', { fileName, fileType });

      // Analyze project structure first
      const projectAnalysis = await this.analyzeProjectStructure();

      // Determine file characteristics
      const fileCharacteristics = this.analyzeFileCharacteristics(fileName, fileType, context);

      // Generate placement suggestions
      const suggestions = await this.generatePlacementSuggestions(
        fileCharacteristics,
        projectAnalysis,
        context
      );

      // Rank and prioritize suggestions
      const rankedSuggestions = this.rankSuggestions(suggestions);

      logger.info('File placement analysis completed', {
        fileName,
        suggestions: rankedSuggestions.length
      });

      return {
        fileName,
        fileType,
        characteristics: fileCharacteristics,
        suggestions: rankedSuggestions,
        reasoning: this.generateReasoning(rankedSuggestions, projectAnalysis)
      };

    } catch (error) {
      logger.error('Failed to suggest file placement', { error: error.message, fileName });
      throw error;
    }
  }

  /**
   * Analyze the current project structure
   * @returns {Object} Project structure analysis
   */
  async analyzeProjectStructure() {
    const analysis = {
      architecture: null,
      frameworks: [],
      conventions: null,
      directoryStructure: {},
      filePatterns: {},
      layerMappings: {}
    };

    try {
      // Get architecture information
      if (this.architectureMapper) {
        const archResult = await this.architectureMapper.analyzeArchitecture();
        analysis.architecture = archResult.architecture;
      }

      // Get framework information
      if (this.frameworkDetector) {
        const frameworkResult = await this.frameworkDetector.detectFrameworks();
        analysis.frameworks = frameworkResult.frameworks;
      }

      // Get convention information
      if (this.conventionAnalyzer) {
        const conventionResult = await this.conventionAnalyzer.analyzeProject();
        analysis.conventions = conventionResult;
      }

      // Analyze directory structure
      analysis.directoryStructure = await this.scanDirectoryStructure();
      analysis.filePatterns = this.analyzeFilePatterns(analysis.directoryStructure);
      analysis.layerMappings = this.mapLayersToDirectories(analysis.directoryStructure);

    } catch (error) {
      logger.warn('Project structure analysis partially failed', { error: error.message });
    }

    return analysis;
  }

  /**
   * Analyze file characteristics to determine placement
   * @param {string} fileName - File name
   * @param {string} fileType - File type
   * @param {Object} context - Additional context
   * @returns {Object} File characteristics
   */
  analyzeFileCharacteristics(fileName, fileType, context) {
    const characteristics = {
      primaryType: fileType,
      secondaryTypes: [],
      architecturalLayer: null,
      frameworkSpecific: null,
      namingConvention: null,
      dependencies: context.dependencies || [],
      relatedFiles: context.relatedFiles || []
    };

    // Determine architectural layer
    characteristics.architecturalLayer = this.determineArchitecturalLayer(fileName, fileType);

    // Check naming patterns
    characteristics.namingConvention = this.analyzeNamingConvention(fileName);

    // Determine framework-specific patterns
    if (this.frameworkDetector) {
      characteristics.frameworkSpecific = this.determineFrameworkSpecificPlacement(fileName, fileType);
    }

    // Analyze file relationships
    characteristics.secondaryTypes = this.determineSecondaryTypes(fileName, fileType);

    return characteristics;
  }

  /**
   * Generate placement suggestions based on analysis
   * @param {Object} characteristics - File characteristics
   * @param {Object} projectAnalysis - Project analysis
   * @param {Object} context - Context information
   * @returns {Array} Placement suggestions
   */
  async generatePlacementSuggestions(characteristics, projectAnalysis, context) {
    const suggestions = [];

    // Framework-specific suggestions
    if (characteristics.frameworkSpecific) {
      suggestions.push(...this.generateFrameworkSuggestions(characteristics, projectAnalysis));
    }

    // Architecture-based suggestions
    suggestions.push(...this.generateArchitectureSuggestions(characteristics, projectAnalysis));

    // Convention-based suggestions
    if (projectAnalysis.conventions) {
      suggestions.push(...this.generateConventionSuggestions(characteristics, projectAnalysis));
    }

    // Existing pattern-based suggestions
    suggestions.push(...this.generatePatternSuggestions(characteristics, projectAnalysis));

    // Relationship-based suggestions
    if (characteristics.relatedFiles.length > 0) {
      suggestions.push(...this.generateRelationshipSuggestions(characteristics, projectAnalysis));
    }

    return suggestions;
  }

  /**
   * Rank suggestions by confidence and appropriateness
   * @param {Array} suggestions - Raw suggestions
   * @returns {Array} Ranked suggestions
   */
  rankSuggestions(suggestions) {
    return suggestions
      .map(suggestion => ({
        ...suggestion,
        confidence: this.calculateConfidence(suggestion),
        score: this.calculateScore(suggestion)
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5); // Top 5 suggestions
  }

  /**
   * Generate reasoning for placement suggestions
   * @param {Array} suggestions - Ranked suggestions
   * @param {Object} projectAnalysis - Project analysis
   * @returns {string} Reasoning text
   */
  generateReasoning(suggestions, projectAnalysis) {
    if (suggestions.length === 0) {
      return 'No specific placement recommendations available. Consider organizing by feature or domain.';
    }

    const topSuggestion = suggestions[0];
    let reasoning = `Based on your project structure, the recommended placement for this file is:\n\n`;

    reasoning += `**${topSuggestion.path}**\n`;
    reasoning += `Confidence: ${Math.round(topSuggestion.confidence * 100)}%\n\n`;

    reasoning += `**Reasoning:**\n`;
    reasoning += `${topSuggestion.reasoning}\n\n`;

    if (suggestions.length > 1) {
      reasoning += `**Alternative locations:**\n`;
      suggestions.slice(1, 3).forEach((suggestion, index) => {
        reasoning += `${index + 1}. ${suggestion.path} (${Math.round(suggestion.confidence * 100)}% confidence)\n`;
      });
    }

    return reasoning;
  }

  /**
   * Scan and analyze directory structure
   * @returns {Object} Directory structure analysis
   */
  async scanDirectoryStructure() {
    const structure = {};
    const maxDepth = 4;

    const scanDir = async (dir, depth = 0) => {
      if (depth > maxDepth) return;

      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        const relativePath = path.relative(this.projectRoot, dir);

        structure[relativePath] = {
          files: [],
          directories: [],
          purpose: this.inferDirectoryPurpose(relativePath)
        };

        for (const entry of entries) {
          if (entry.isDirectory() && !['node_modules', '.git', 'dist', 'build'].includes(entry.name)) {
            structure[relativePath].directories.push(entry.name);
            await scanDir(path.join(dir, entry.name), depth + 1);
          } else if (entry.isFile() && !entry.name.startsWith('.')) {
            structure[relativePath].files.push({
              name: entry.name,
              type: this.inferFileType(entry.name)
            });
          }
        }
      } catch (error) {
        // Skip inaccessible directories
      }
    };

    await scanDir(this.projectRoot);
    return structure;
  }

  /**
   * Analyze patterns in file organization
   * @param {Object} directoryStructure - Directory structure
   * @returns {Object} File patterns
   */
  analyzeFilePatterns(directoryStructure) {
    const patterns = {
      componentDirectories: [],
      serviceDirectories: [],
      modelDirectories: [],
      testDirectories: [],
      configDirectories: []
    };

    for (const [dirPath, info] of Object.entries(directoryStructure)) {
      if (info.purpose === 'components') patterns.componentDirectories.push(dirPath);
      if (info.purpose === 'services') patterns.serviceDirectories.push(dirPath);
      if (info.purpose === 'models') patterns.modelDirectories.push(dirPath);
      if (info.purpose === 'tests') patterns.testDirectories.push(dirPath);
      if (info.purpose === 'config') patterns.configDirectories.push(dirPath);
    }

    return patterns;
  }

  /**
   * Map architectural layers to directories
   * @param {Object} directoryStructure - Directory structure
   * @returns {Object} Layer mappings
   */
  mapLayersToDirectories(directoryStructure) {
    const mappings = {
      presentation: [],
      business: [],
      data: [],
      infrastructure: []
    };

    for (const [dirPath, info] of Object.entries(directoryStructure)) {
      const layer = this.determineDirectoryLayer(dirPath, info);
      if (layer && mappings[layer]) {
        mappings[layer].push(dirPath);
      }
    }

    return mappings;
  }

  /**
   * Determine architectural layer for a file
   * @param {string} fileName - File name
   * @param {string} fileType - File type
   * @returns {string} Architectural layer
   */
  determineArchitecturalLayer(fileName, fileType) {
    const fileNameLower = fileName.toLowerCase();

    // Check file type patterns
    for (const [layer, patterns] of Object.entries(this.placementRules.layers)) {
      if (patterns.some(pattern => fileNameLower.includes(pattern))) {
        return layer;
      }
    }

    // Check naming patterns
    for (const [type, regex] of Object.entries(this.placementRules.namingPatterns)) {
      if (regex.test(fileName)) {
        if (['component', 'controller'].includes(type)) return 'presentation';
        if (['service', 'manager'].includes(type)) return 'business';
        if (['model'].includes(type)) return 'data';
        if (['config'].includes(type)) return 'infrastructure';
      }
    }

    // Default based on file type
    switch (fileType) {
      case 'component':
      case 'controller':
      case 'view':
        return 'presentation';
      case 'service':
      case 'logic':
        return 'business';
      case 'model':
      case 'entity':
        return 'data';
      case 'config':
      case 'util':
        return 'infrastructure';
      default:
        return 'business'; // Default layer
    }
  }

  /**
   * Analyze naming convention of file
   * @param {string} fileName - File name
   * @returns {string} Naming convention
   */
  analyzeNamingConvention(fileName) {
    const baseName = path.basename(fileName, path.extname(fileName));

    for (const [convention, regex] of Object.entries(this.placementRules.namingPatterns)) {
      if (regex.test(baseName)) {
        return convention;
      }
    }

    return 'standard';
  }

  /**
   * Determine framework-specific placement
   * @param {string} fileName - File name
   * @param {string} fileType - File type
   * @returns {Object} Framework-specific placement
   */
  determineFrameworkSpecificPlacement(fileName, fileType) {
    // This would integrate with framework detector to get specific patterns
    // For now, return basic framework info
    return {
      framework: 'generic',
      patterns: {}
    };
  }

  /**
   * Determine secondary types for a file
   * @param {string} fileName - File name
   * @param {string} fileType - File type
   * @returns {Array} Secondary types
   */
  determineSecondaryTypes(fileName, fileType) {
    const types = [];
    const fileNameLower = fileName.toLowerCase();

    if (this.placementRules.fileTypes.test.test(fileNameLower)) {
      types.push('test');
    }
    if (this.placementRules.fileTypes.config.test(fileNameLower)) {
      types.push('config');
    }
    if (this.placementRules.fileTypes.util.test(fileNameLower)) {
      types.push('utility');
    }

    return types;
  }

  /**
   * Generate framework-specific suggestions
   * @param {Object} characteristics - File characteristics
   * @param {Object} projectAnalysis - Project analysis
   * @returns {Array} Framework suggestions
   */
  generateFrameworkSuggestions(characteristics, projectAnalysis) {
    const suggestions = [];

    // Check detected frameworks
    for (const framework of projectAnalysis.frameworks || []) {
      const frameworkRules = this.placementRules.frameworks[framework.name];
      if (frameworkRules) {
        const fileType = characteristics.primaryType;
        const suggestedPath = frameworkRules[fileType];

        if (suggestedPath) {
          suggestions.push({
            path: suggestedPath,
            reasoning: `Follows ${framework.name} framework conventions`,
            source: 'framework',
            framework: framework.name,
            confidence: framework.confidence || 0.8
          });
        }
      }
    }

    return suggestions;
  }

  /**
   * Generate architecture-based suggestions
   * @param {Object} characteristics - File characteristics
   * @param {Object} projectAnalysis - Project analysis
   * @returns {Array} Architecture suggestions
   */
  generateArchitectureSuggestions(characteristics, projectAnalysis) {
    const suggestions = [];
    const layer = characteristics.architecturalLayer;

    if (layer && projectAnalysis.layerMappings[layer]) {
      for (const dirPath of projectAnalysis.layerMappings[layer]) {
        suggestions.push({
          path: dirPath + '/',
          reasoning: `Belongs to ${layer} architectural layer`,
          source: 'architecture',
          layer: layer,
          confidence: 0.7
        });
      }
    }

    return suggestions;
  }

  /**
   * Generate convention-based suggestions
   * @param {Object} characteristics - File characteristics
   * @param {Object} projectAnalysis - Project analysis
   * @returns {Array} Convention suggestions
   */
  generateConventionSuggestions(characteristics, projectAnalysis) {
    const suggestions = [];

    // This would use the convention analyzer results
    // For now, provide basic suggestions
    if (characteristics.namingConvention === 'component') {
      suggestions.push({
        path: 'src/components/',
        reasoning: 'Component naming convention suggests component directory',
        source: 'convention',
        confidence: 0.6
      });
    }

    return suggestions;
  }

  /**
   * Generate pattern-based suggestions
   * @param {Object} characteristics - File characteristics
   * @param {Object} projectAnalysis - Project analysis
   * @returns {Array} Pattern suggestions
   */
  generatePatternSuggestions(characteristics, projectAnalysis) {
    const suggestions = [];
    const fileType = characteristics.primaryType;

    // Look for existing patterns
    const patterns = projectAnalysis.filePatterns || {};
    const patternKey = `${fileType}Directories`;

    if (patterns[patternKey] && patterns[patternKey].length > 0) {
      for (const dirPath of patterns[patternKey]) {
        suggestions.push({
          path: dirPath + '/',
          reasoning: `Follows existing project pattern for ${fileType} files`,
          source: 'pattern',
          confidence: 0.8
        });
      }
    }

    return suggestions;
  }

  /**
   * Generate relationship-based suggestions
   * @param {Object} characteristics - File characteristics
   * @param {Object} projectAnalysis - Project analysis
   * @returns {Array} Relationship suggestions
   */
  generateRelationshipSuggestions(characteristics, projectAnalysis) {
    const suggestions = [];

    // Suggest placing near related files
    for (const relatedFile of characteristics.relatedFiles) {
      const relatedDir = path.dirname(relatedFile);
      if (relatedDir !== '.') {
        suggestions.push({
          path: relatedDir + '/',
          reasoning: `Related to existing file: ${path.basename(relatedFile)}`,
          source: 'relationship',
          confidence: 0.5
        });
      }
    }

    return suggestions;
  }

  /**
   * Infer purpose of a directory
   * @param {string} dirPath - Directory path
   * @returns {string} Directory purpose
   */
  inferDirectoryPurpose(dirPath) {
    const dirName = path.basename(dirPath).toLowerCase();

    if (['components', 'component'].includes(dirName)) return 'components';
    if (['services', 'service'].includes(dirName)) return 'services';
    if (['models', 'model', 'entities'].includes(dirName)) return 'models';
    if (['controllers', 'controller'].includes(dirName)) return 'controllers';
    if (['utils', 'util', 'helpers'].includes(dirName)) return 'utils';
    if (['config', 'configs'].includes(dirName)) return 'config';
    if (['test', 'tests', '__tests__'].includes(dirName)) return 'tests';

    return 'general';
  }

  /**
   * Infer file type from name
   * @param {string} fileName - File name
   * @returns {string} File type
   */
  inferFileType(fileName) {
    const ext = path.extname(fileName).toLowerCase();

    if (['.js', '.jsx', '.ts', '.tsx'].includes(ext)) return 'javascript';
    if (['.py'].includes(ext)) return 'python';
    if (['.java'].includes(ext)) return 'java';
    if (['.json'].includes(ext)) return 'config';

    return 'other';
  }

  /**
   * Determine architectural layer for a directory
   * @param {string} dirPath - Directory path
   * @param {Object} info - Directory info
   * @returns {string} Architectural layer
   */
  determineDirectoryLayer(dirPath, info) {
    const dirName = path.basename(dirPath).toLowerCase();

    if (['controllers', 'views', 'templates', 'components', 'pages'].includes(dirName)) {
      return 'presentation';
    }
    if (['services', 'logic', 'managers', 'handlers'].includes(dirName)) {
      return 'business';
    }
    if (['models', 'entities', 'repositories', 'daos'].includes(dirName)) {
      return 'data';
    }
    if (['config', 'middleware', 'utils', 'helpers'].includes(dirName)) {
      return 'infrastructure';
    }

    return null;
  }

  /**
   * Calculate confidence score for a suggestion
   * @param {Object} suggestion - Placement suggestion
   * @returns {number} Confidence score (0-1)
   */
  calculateConfidence(suggestion) {
    let confidence = 0.5; // Base confidence

    // Framework-based suggestions are highly confident
    if (suggestion.source === 'framework') {
      confidence += 0.3;
    }

    // Pattern-based suggestions are confident
    if (suggestion.source === 'pattern') {
      confidence += 0.2;
    }

    // Architecture-based suggestions are moderately confident
    if (suggestion.source === 'architecture') {
      confidence += 0.1;
    }

    // Apply framework confidence multiplier
    if (suggestion.confidence) {
      confidence *= suggestion.confidence;
    }

    return Math.min(confidence, 1.0);
  }

  /**
   * Calculate overall score for ranking
   * @param {Object} suggestion - Placement suggestion
   * @returns {number} Score for ranking
   */
  calculateScore(suggestion) {
    let score = suggestion.confidence * 100;

    // Boost framework suggestions
    if (suggestion.source === 'framework') {
      score += 20;
    }

    // Boost pattern-based suggestions
    if (suggestion.source === 'pattern') {
      score += 15;
    }

    // Boost architecture-based suggestions
    if (suggestion.source === 'architecture') {
      score += 10;
    }

    return score;
  }

  /**
   * Get placement suggestions for multiple files
   * @param {Array} files - Array of file objects {name, type, context}
   * @returns {Array} Placement suggestions for each file
   */
  async suggestMultiplePlacements(files) {
    const results = [];

    for (const file of files) {
      try {
        const suggestion = await this.suggestPlacement(
          file.name,
          file.type,
          file.context || {}
        );
        results.push(suggestion);
      } catch (error) {
        logger.warn('Failed to suggest placement for file', {
          file: file.name,
          error: error.message
        });
        results.push({
          fileName: file.name,
          error: error.message
        });
      }
    }

    return results;
  }

  /**
   * Validate a suggested placement
   * @param {string} filePath - Suggested file path
   * @param {Object} projectAnalysis - Project analysis
   * @returns {Object} Validation result
   */
  validatePlacement(filePath, projectAnalysis) {
    const validation = {
      valid: true,
      warnings: [],
      suggestions: []
    };

    // Check if path exists
    const fullPath = path.resolve(this.projectRoot, filePath);
    if (!fs.existsSync(path.dirname(fullPath))) {
      validation.warnings.push('Directory does not exist and will be created');
    }

    // Check naming conventions
    const fileName = path.basename(filePath);
    if (!this.followsNamingConvention(fileName, projectAnalysis)) {
      validation.warnings.push('File name may not follow project naming conventions');
    }

    return validation;
  }

  /**
   * Check if file name follows project conventions
   * @param {string} fileName - File name
   * @param {Object} projectAnalysis - Project analysis
   * @returns {boolean} True if follows conventions
   */
  followsNamingConvention(fileName, projectAnalysis) {
    // This would integrate with convention analyzer
    // For now, basic checks
    const baseName = path.basename(fileName, path.extname(fileName));

    // Check for kebab-case, camelCase, PascalCase patterns
    const hasValidCase = /[a-zA-Z][a-zA-Z0-9-_]*/.test(baseName);

    return hasValidCase;
  }
}
