import fs from 'fs-extra';
import path from 'path';

// Create a simple console logger to avoid import issues
const logger = {
  info: (...args) => console.log('[INFO]', ...args),
  debug: (...args) =>
    process.env.DEBUG ? console.log('[DEBUG]', ...args) : undefined,
  warn: (...args) => console.warn('[WARN]', ...args),
  error: (...args) => console.error('[ERROR]', ...args),
};

/**
 * Framework Detection Engine
 * Analyzes project structure and dependencies to detect popular frameworks and libraries
 */
export class FrameworkDetector {
  constructor(options = {}) {
    this.projectRoot = options.projectRoot || process.cwd();
    this.maxFileSize = options.maxFileSize || 1024 * 1024; // 1MB
    this.confidenceThreshold = options.confidenceThreshold || 0.7;

    // Framework detection patterns
    this.frameworks = {
      // Frontend Frameworks
      react: {
        name: 'React',
        category: 'frontend',
        indicators: {
          dependencies: ['react', 'react-dom'],
          devDependencies: ['@types/react', 'react-scripts'],
          files: [
            'src/App.js',
            'src/App.tsx',
            'src/index.js',
            'public/index.html',
          ],
          extensions: ['.jsx', '.tsx'],
          patterns: [
            'ReactDOM\\.render',
            "import React from 'react'",
            'function.*Component',
          ],
        },
        confidence: 0,
      },
      vue: {
        name: 'Vue.js',
        category: 'frontend',
        indicators: {
          dependencies: ['vue', 'vue-router', 'vuex'],
          devDependencies: ['@vue/cli', 'vue-loader'],
          files: ['src/App.vue', 'src/main.js', 'public/index.html'],
          extensions: ['.vue'],
          patterns: [
            'new Vue',
            "import Vue from 'vue'",
            '<template>',
            '<script>',
            '<style>',
          ],
        },
        confidence: 0,
      },
      angular: {
        name: 'Angular',
        category: 'frontend',
        indicators: {
          dependencies: ['@angular/core', '@angular/cli'],
          devDependencies: ['@angular-devkit/build-angular'],
          files: ['src/app/app.component.ts', 'angular.json'],
          extensions: ['.ts'],
          patterns: ['@Component', '@NgModule', "import.*from '@angular"],
        },
        confidence: 0,
      },
      svelte: {
        name: 'Svelte',
        category: 'frontend',
        indicators: {
          dependencies: ['svelte'],
          devDependencies: ['svelte-preprocess', 'rollup-plugin-svelte'],
          files: ['src/App.svelte', 'src/main.js'],
          extensions: ['.svelte'],
          patterns: ['<script>', '<style>', 'export let', 'onMount'],
        },
        confidence: 0,
      },

      // Backend Frameworks
      express: {
        name: 'Express.js',
        category: 'backend',
        indicators: {
          dependencies: ['express'],
          files: ['server.js', 'app.js', 'routes/', 'middleware/'],
          patterns: [
            'app\\.listen',
            'express\\(\\)',
            'app\\.get',
            'app\\.post',
          ],
        },
        confidence: 0,
      },
      fastify: {
        name: 'Fastify',
        category: 'backend',
        indicators: {
          dependencies: ['fastify'],
          patterns: [
            'fastify\\.register',
            'fastify\\.listen',
            'fastify\\.get',
            'fastify\\.post',
          ],
        },
        confidence: 0,
      },
      nestjs: {
        name: 'NestJS',
        category: 'backend',
        indicators: {
          dependencies: ['@nestjs/core', '@nestjs/cli'],
          files: ['src/main.ts', 'src/app.module.ts'],
          patterns: ['@Module', '@Controller', '@Injectable', 'NestFactory'],
        },
        confidence: 0,
      },
      django: {
        name: 'Django',
        category: 'backend',
        indicators: {
          files: ['manage.py', 'settings.py', 'urls.py', 'wsgi.py'],
          patterns: [
            'django',
            'DJANGO_SETTINGS_MODULE',
            'urlpatterns',
            'admin\\.site',
          ],
        },
        confidence: 0,
      },
      flask: {
        name: 'Flask',
        category: 'backend',
        indicators: {
          dependencies: ['flask'],
          files: ['app.py', 'wsgi.py'],
          patterns: [
            'Flask\\(',
            '@app\\.route',
            'render_template',
            'request\\.form',
          ],
        },
        confidence: 0,
      },
      fastapi: {
        name: 'FastAPI',
        category: 'backend',
        indicators: {
          dependencies: ['fastapi'],
          patterns: [
            'FastAPI',
            '@app\\.get',
            '@app\\.post',
            'Depends',
            'HTTPException',
          ],
        },
        confidence: 0,
      },

      // Build Tools & Runtimes
      nextjs: {
        name: 'Next.js',
        category: 'fullstack',
        indicators: {
          dependencies: ['next'],
          files: ['pages/', 'next.config.js', '.next/'],
          patterns: [
            'getServerSideProps',
            'getStaticProps',
            "Link from 'next/link'",
          ],
        },
        confidence: 0,
      },
      nuxtjs: {
        name: 'Nuxt.js',
        category: 'fullstack',
        indicators: {
          dependencies: ['nuxt'],
          files: ['pages/', 'nuxt.config.js', '.nuxt/'],
          patterns: ['asyncData', 'head\\(\\)', 'plugins/'],
        },
        confidence: 0,
      },
      vite: {
        name: 'Vite',
        category: 'build-tool',
        indicators: {
          devDependencies: [
            'vite',
            '@vitejs/plugin-react',
            '@vitejs/plugin-vue',
          ],
          files: ['vite.config.js', 'vite.config.ts'],
        },
        confidence: 0,
      },
      webpack: {
        name: 'Webpack',
        category: 'build-tool',
        indicators: {
          dependencies: ['webpack', 'webpack-cli'],
          files: ['webpack.config.js', 'webpack.config.ts'],
        },
        confidence: 0,
      },

      // Testing Frameworks
      jest: {
        name: 'Jest',
        category: 'testing',
        indicators: {
          devDependencies: ['jest', '@types/jest'],
          files: ['jest.config.js', '__tests__/', 'src/__tests__/'],
          patterns: ['describe\\(', 'it\\(', 'expect\\('],
        },
        confidence: 0,
      },
      cypress: {
        name: 'Cypress',
        category: 'testing',
        indicators: {
          devDependencies: ['cypress'],
          files: ['cypress/', 'cypress.config.js'],
        },
        confidence: 0,
      },

      // Database ORMs
      mongoose: {
        name: 'Mongoose',
        category: 'database',
        indicators: {
          dependencies: ['mongoose'],
          patterns: ['mongoose\\.connect', 'Schema', 'model\\('],
        },
        confidence: 0,
      },
      sequelize: {
        name: 'Sequelize',
        category: 'database',
        indicators: {
          dependencies: ['sequelize'],
          patterns: ['Sequelize', 'DataTypes', 'sequelize\\.define'],
        },
        confidence: 0,
      },
      prisma: {
        name: 'Prisma',
        category: 'database',
        indicators: {
          dependencies: ['prisma', '@prisma/client'],
          files: ['prisma/schema.prisma'],
        },
        confidence: 0,
      },

      // State Management
      redux: {
        name: 'Redux',
        category: 'state-management',
        indicators: {
          dependencies: ['redux', 'react-redux', '@reduxjs/toolkit'],
          patterns: ['createStore', 'useSelector', 'useDispatch'],
        },
        confidence: 0,
      },
      mobx: {
        name: 'MobX',
        category: 'state-management',
        indicators: {
          dependencies: ['mobx', 'mobx-react'],
          patterns: ['observable', 'action', 'computed', '@observer'],
        },
        confidence: 0,
      },

      // CSS Frameworks
      tailwind: {
        name: 'Tailwind CSS',
        category: 'styling',
        indicators: {
          devDependencies: ['tailwindcss'],
          files: ['tailwind.config.js'],
          patterns: [
            'className="[^"]*bg-',
            'className="[^"]*text-',
            'className="[^"]*flex',
          ],
        },
        confidence: 0,
      },
      bootstrap: {
        name: 'Bootstrap',
        category: 'styling',
        indicators: {
          dependencies: ['bootstrap'],
          patterns: [
            'className="[^"]*container',
            'className="[^"]*row',
            'className="[^"]*col',
          ],
        },
        confidence: 0,
      },

      // CLI and Tooling Frameworks
      commander: {
        name: 'Commander.js',
        category: 'cli',
        indicators: {
          dependencies: ['commander'],
          patterns: ['program.', '.command(', '.option(', '.parse('],
        },
        confidence: 0,
      },
      inquirer: {
        name: 'Inquirer.js',
        category: 'cli',
        indicators: {
          dependencies: ['inquirer'],
          patterns: ['inquirer.prompt', '.question', '.choices'],
        },
        confidence: 0,
      },
      ora: {
        name: 'Ora',
        category: 'cli',
        indicators: {
          dependencies: ['ora'],
          patterns: ['ora(', '.start(', '.succeed(', '.fail('],
        },
        confidence: 0,
      },

      // Node.js General
      nodejs: {
        name: 'Node.js',
        category: 'runtime',
        indicators: {
          files: ['package.json', 'node_modules/'],
          patterns: [
            'require\\(',
            'import.*from',
            'module\\.exports',
            'exports\\.',
          ],
        },
        confidence: 0,
      },
    };

    // Language detection
    this.languages = {
      javascript: {
        name: 'JavaScript',
        extensions: ['.js', '.mjs'],
        patterns: ['function ', 'const ', 'let ', 'var ', 'import ', 'export '],
      },
      typescript: {
        name: 'TypeScript',
        extensions: ['.ts', '.tsx'],
        patterns: [
          'interface ',
          'type ',
          ': string',
          ': number',
          ': boolean',
          '<T>',
        ],
      },
      python: {
        name: 'Python',
        extensions: ['.py'],
        patterns: ['def ', 'class ', 'import ', 'from ', 'if __name__'],
      },
      java: {
        name: 'Java',
        extensions: ['.java'],
        patterns: ['public class', 'import java', 'public static void main'],
      },
      go: {
        name: 'Go',
        extensions: ['.go'],
        patterns: ['package ', 'import ', 'func ', 'type ', 'struct '],
      },
      rust: {
        name: 'Rust',
        extensions: ['.rs'],
        patterns: ['fn main', 'use ', 'let ', 'struct ', 'impl '],
      },
      php: {
        name: 'PHP',
        extensions: ['.php'],
        patterns: ['<?php', 'function ', 'class ', 'echo ', '$'],
      },
      ruby: {
        name: 'Ruby',
        extensions: ['.rb'],
        patterns: ['def ', 'class ', 'require ', 'puts ', 'end'],
      },
    };

    this.detectedFrameworks = new Map();
    this.detectedLanguages = new Set();
    this.packageJson = null;
    this.projectStructure = null;

    logger.debug('Framework detector initialized', {
      projectRoot: this.projectRoot,
      frameworks: Object.keys(this.frameworks).length,
      languages: Object.keys(this.languages).length,
    });
  }

  /**
   * Analyze project and detect frameworks
   * @returns {Object} Detection results
   */
  async detectFrameworks() {
    try {
      logger.info('Starting framework detection', {
        projectRoot: this.projectRoot,
      });

      // Reset detection state
      this.resetDetections();

      // Load project structure
      this.projectStructure = await this.analyzeProjectStructure();

      // Load package.json if it exists
      await this.loadPackageJson();

      // Detect languages
      await this.detectLanguages();

      // Detect frameworks
      await this.analyzeFrameworks();

      // Calculate confidence scores
      this.calculateConfidenceScores();

      // Filter by confidence threshold
      const detected = this.getDetectedFrameworks();

      logger.info('Framework detection completed', {
        detectedFrameworks: detected.length,
        detectedLanguages: Array.from(this.detectedLanguages),
      });

      return {
        frameworks: detected,
        languages: Array.from(this.detectedLanguages),
        confidence: this.getOverallConfidence(),
        projectInfo: {
          hasPackageJson: !!this.packageJson,
          fileCount: this.projectStructure?.totalFiles || 0,
          directoryCount: this.projectStructure?.totalDirectories || 0,
        },
      };
    } catch (error) {
      logger.error('Framework detection failed', { error: error.message });
      return {
        frameworks: [],
        languages: [],
        error: error.message,
      };
    }
  }

  /**
   * Reset detection state
   */
  resetDetections() {
    Object.keys(this.frameworks).forEach((key) => {
      this.frameworks[key].confidence = 0;
    });
    this.detectedFrameworks.clear();
    this.detectedLanguages.clear();
    this.packageJson = null;
    this.projectStructure = null;
  }

  /**
   * Load and parse package.json
   */
  async loadPackageJson() {
    try {
      const packagePath = path.join(this.projectRoot, 'package.json');
      const packageContent = await fs.readFile(packagePath, 'utf8');
      this.packageJson = JSON.parse(packageContent);

      logger.debug('Package.json loaded', {
        name: this.packageJson.name,
        version: this.packageJson.version,
        dependencies: Object.keys(this.packageJson.dependencies || {}).length,
        devDependencies: Object.keys(this.packageJson.devDependencies || {})
          .length,
      });
    } catch (error) {
      logger.debug('No package.json found or failed to parse', {
        error: error.message,
      });
    }
  }

  /**
   * Analyze project directory structure
   * @returns {Object} Project structure analysis
   */
  async analyzeProjectStructure() {
    const structure = {
      totalFiles: 0,
      totalDirectories: 0,
      fileTypes: {},
      directories: new Set(),
      keyFiles: new Set(),
    };

    try {
      const items = await fs.readdir(this.projectRoot, { withFileTypes: true });

      for (const item of items) {
        if (item.isDirectory()) {
          structure.totalDirectories++;
          structure.directories.add(item.name);

          // Check for framework-specific directories
          if (
            [
              'node_modules',
              '.next',
              '.nuxt',
              'dist',
              'build',
              'public',
              'src',
            ].includes(item.name)
          ) {
            structure.keyFiles.add(item.name + '/');
          }
        } else if (item.isFile()) {
          structure.totalFiles++;
          const ext = path.extname(item.name);
          structure.fileTypes[ext] = (structure.fileTypes[ext] || 0) + 1;

          // Check for key framework files
          if (
            [
              'package.json',
              'requirements.txt',
              'Pipfile',
              'Gemfile',
              'composer.json',
              'Cargo.toml',
            ].includes(item.name)
          ) {
            structure.keyFiles.add(item.name);
          }
        }
      }

      logger.debug('Project structure analyzed', structure);
      return structure;
    } catch (error) {
      logger.error('Failed to analyze project structure', {
        error: error.message,
      });
      return structure;
    }
  }

  /**
   * Detect primary programming languages
   */
  async detectLanguages() {
    const fileExtensions = Object.keys(this.projectStructure?.fileTypes || {});

    for (const [langKey, langInfo] of Object.entries(this.languages)) {
      let languageScore = 0;

      // Check file extensions
      const matchingExtensions = langInfo.extensions.filter((ext) =>
        fileExtensions.includes(ext)
      );
      if (matchingExtensions.length > 0) {
        languageScore += 0.6;
      }

      // Check for language-specific patterns in files
      if (languageScore > 0) {
        const sampleFiles = await this.findSampleFiles(langInfo.extensions);
        for (const filePath of sampleFiles.slice(0, 3)) {
          // Check up to 3 files
          try {
            const content = await fs.readFile(filePath, 'utf8');
            const patternMatches = langInfo.patterns.filter((pattern) =>
              content.includes(pattern)
            );
            if (patternMatches.length > 0) {
              languageScore +=
                0.4 * (patternMatches.length / langInfo.patterns.length);
            }
          } catch (error) {
            // Continue with next file
          }
        }
      }

      if (languageScore >= 0.5) {
        this.detectedLanguages.add(langKey);
        logger.debug(`Language detected: ${langInfo.name}`, {
          score: languageScore,
        });
      }
    }
  }

  /**
   * Find sample files with given extensions
   * @param {Array} extensions - File extensions to find
   * @returns {Array} File paths
   */
  async findSampleFiles(extensions) {
    const files = [];

    try {
      const walkDir = async (dir) => {
        const items = await fs.readdir(dir, { withFileTypes: true });

        for (const item of items) {
          const fullPath = path.join(dir, item.name);

          if (
            item.isDirectory() &&
            !item.name.startsWith('.') &&
            item.name !== 'node_modules'
          ) {
            await walkDir(fullPath);
          } else if (item.isFile()) {
            const ext = path.extname(item.name);
            if (extensions.includes(ext)) {
              files.push(fullPath);
              if (files.length >= 10) return; // Limit to 10 files
            }
          }
        }
      };

      await walkDir(this.projectRoot);
    } catch (error) {
      logger.debug('Error finding sample files', { error: error.message });
    }

    return files;
  }

  /**
   * Analyze frameworks based on various indicators
   */
  async analyzeFrameworks() {
    const analysisPromises = Object.keys(this.frameworks).map((frameworkKey) =>
      this.analyzeFramework(frameworkKey)
    );

    await Promise.all(analysisPromises);
  }

  /**
   * Analyze a specific framework
   * @param {string} frameworkKey - Framework key
   */
  async analyzeFramework(frameworkKey) {
    const framework = this.frameworks[frameworkKey];
    const indicators = framework.indicators;
    let score = 0;
    let maxScore = 0;

    // Check dependencies
    if (this.packageJson) {
      const allDeps = {
        ...this.packageJson.dependencies,
        ...this.packageJson.devDependencies,
      };

      if (indicators.dependencies) {
        maxScore += indicators.dependencies.length;
        score += indicators.dependencies.filter((dep) => allDeps[dep]).length;
      }

      if (indicators.devDependencies) {
        maxScore += indicators.devDependencies.length;
        score += indicators.devDependencies.filter(
          (dep) => allDeps[dep]
        ).length;
      }
    }

    // Check file structure
    if (indicators.files) {
      maxScore += indicators.files.length;
      for (const filePattern of indicators.files) {
        if (await this.fileExists(filePattern)) {
          score += 1;
        }
      }
    }

    // Check file extensions
    if (indicators.extensions) {
      maxScore += indicators.extensions.length;
      const projectExtensions = Object.keys(
        this.projectStructure?.fileTypes || {}
      );
      score += indicators.extensions.filter((ext) =>
        projectExtensions.includes(ext)
      ).length;
    }

    // Check code patterns
    if (indicators.patterns) {
      maxScore += indicators.patterns.length;
      for (const pattern of indicators.patterns) {
        if (await this.patternExists(pattern, indicators.extensions)) {
          score += 1;
        }
      }
    }

    // Calculate confidence
    framework.confidence = maxScore > 0 ? score / maxScore : 0;

    logger.debug(`Framework analysis: ${framework.name}`, {
      score,
      maxScore,
      confidence: framework.confidence,
    });
  }

  /**
   * Check if file exists (supports globs)
   * @param {string} filePath - File path to check
   * @returns {boolean} Whether file exists
   */
  async fileExists(filePath) {
    try {
      const fullPath = path.join(this.projectRoot, filePath);
      await fs.access(fullPath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if pattern exists in files
   * @param {string} pattern - Pattern to search for
   * @param {Array} extensions - File extensions to search in
   * @returns {boolean} Whether pattern exists
   */
  async patternExists(pattern, extensions) {
    try {
      const sampleFiles = extensions
        ? await this.findSampleFiles(extensions)
        : await this.findSampleFiles(['.js', '.ts', '.py', '.java']);

      for (const filePath of sampleFiles.slice(0, 5)) {
        // Check up to 5 files
        try {
          const content = await fs.readFile(filePath, 'utf8');
          if (content.includes(pattern)) {
            return true;
          }
        } catch (error) {
          // Continue with next file
        }
      }
    } catch (error) {
      logger.debug('Error checking pattern', { pattern, error: error.message });
    }

    return false;
  }

  /**
   * Calculate final confidence scores and mark detections
   */
  calculateConfidenceScores() {
    for (const [key, framework] of Object.entries(this.frameworks)) {
      if (framework.confidence >= this.confidenceThreshold) {
        this.detectedFrameworks.set(key, {
          ...framework,
          confidence: framework.confidence,
          detected: true,
        });
      }
    }
  }

  /**
   * Get detected frameworks above confidence threshold
   * @returns {Array} Detected frameworks
   */
  getDetectedFrameworks() {
    return Array.from(this.detectedFrameworks.values()).sort(
      (a, b) => b.confidence - a.confidence
    );
  }

  /**
   * Get overall confidence score
   * @returns {number} Overall confidence
   */
  getOverallConfidence() {
    const detected = this.getDetectedFrameworks();
    if (detected.length === 0) return 0;

    const avgConfidence =
      detected.reduce((sum, fw) => sum + fw.confidence, 0) / detected.length;
    return Math.min(avgConfidence, 1);
  }

  /**
   * Get framework recommendations based on detected languages
   * @returns {Array} Recommended frameworks
   */
  getRecommendations() {
    const recommendations = [];
    const detectedLangs = Array.from(this.detectedLanguages);

    if (
      detectedLangs.includes('javascript') ||
      detectedLangs.includes('typescript')
    ) {
      recommendations.push(
        {
          framework: 'react',
          reason: 'Popular UI library for web development',
        },
        {
          framework: 'express',
          reason: 'Minimalist web framework for Node.js',
        },
        { framework: 'nextjs', reason: 'Full-stack React framework with SSR' }
      );
    }

    if (detectedLangs.includes('python')) {
      recommendations.push(
        { framework: 'django', reason: 'Full-featured web framework' },
        { framework: 'flask', reason: 'Lightweight web framework' },
        {
          framework: 'fastapi',
          reason: 'Modern API framework with async support',
        }
      );
    }

    return recommendations;
  }

  /**
   * Get detailed analysis report
   * @returns {Object} Detailed report
   */
  getDetailedReport() {
    const detected = this.getDetectedFrameworks();
    const recommendations = this.getRecommendations();

    return {
      summary: {
        totalFrameworks: Object.keys(this.frameworks).length,
        detectedFrameworks: detected.length,
        languages: Array.from(this.detectedLanguages),
        confidence: this.getOverallConfidence(),
      },
      detected: detected.map((fw) => ({
        name: fw.name,
        category: fw.category,
        confidence: Math.round(fw.confidence * 100) / 100,
        indicators: fw.indicators,
      })),
      recommendations,
      projectInfo: {
        hasPackageJson: !!this.packageJson,
        packageName: this.packageJson?.name,
        packageVersion: this.packageJson?.version,
        fileCount: this.projectStructure?.totalFiles || 0,
        directoryCount: this.projectStructure?.totalDirectories || 0,
      },
    };
  }

  /**
   * Export detection results
   * @param {string} format - Export format ('json', 'markdown')
   * @returns {string} Formatted results
   */
  exportResults(format = 'json') {
    const report = this.getDetailedReport();

    switch (format) {
      case 'markdown':
        return this.formatMarkdownReport(report);
      case 'json':
      default:
        return JSON.stringify(report, null, 2);
    }
  }

  /**
   * Format report as markdown
   * @param {Object} report - Report data
   * @returns {string} Markdown report
   */
  formatMarkdownReport(report) {
    let markdown = '# Framework Detection Report\n\n';

    markdown += '## Summary\n\n';
    markdown += `- **Detected Frameworks**: ${report.summary.detectedFrameworks}\n`;
    markdown += `- **Languages**: ${report.summary.languages.join(', ') || 'None detected'}\n`;
    markdown += `- **Overall Confidence**: ${Math.round(report.summary.confidence * 100)}%\n\n`;

    if (report.detected.length > 0) {
      markdown += '## Detected Frameworks\n\n';
      report.detected.forEach((fw) => {
        markdown += `### ${fw.name}\n`;
        markdown += `- **Category**: ${fw.category}\n`;
        markdown += `- **Confidence**: ${Math.round(fw.confidence * 100)}%\n\n`;
      });
    }

    if (report.recommendations.length > 0) {
      markdown += '## Recommendations\n\n';
      report.recommendations.forEach((rec) => {
        markdown += `- **${this.frameworks[rec.framework]?.name || rec.framework}**: ${rec.reason}\n`;
      });
      markdown += '\n';
    }

    markdown += '## Project Info\n\n';
    markdown += `- **Package**: ${report.projectInfo.packageName || 'N/A'} (${report.projectInfo.packageVersion || 'N/A'})\n`;
    markdown += `- **Files**: ${report.projectInfo.fileCount}\n`;
    markdown += `- **Directories**: ${report.projectInfo.directoryCount}\n`;

    return markdown;
  }
}
