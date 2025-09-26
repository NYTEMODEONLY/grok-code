import fs from 'fs-extra';
import path from 'path';
import { logger } from '../utils/logger.js';

/**
 * Application Flow and Entry Point Analyzer
 * Analyzes application execution flows and identifies key entry points and user journeys
 */
export class FlowAnalyzer {
  constructor(options = {}) {
    this.projectRoot = options.projectRoot || process.cwd();
    this.maxDepth = options.maxDepth || 3;
    this.architectureMapper = options.architectureMapper;

    // Flow analysis results
    this.flows = {
      entryPoints: [],
      userJourneys: [],
      apiEndpoints: [],
      commandFlows: [],
      dataFlows: [],
      errorFlows: []
    };

    logger.info('Flow analyzer initialized', {
      projectRoot: this.projectRoot,
      maxDepth: this.maxDepth
    });
  }

  /**
   * Analyze application flows and entry points
   * @returns {Object} Flow analysis results
   */
  async analyzeFlows() {
    try {
      logger.info('Starting flow analysis');

      // Get architecture information if available
      let architecture = null;
      if (this.architectureMapper) {
        const archResult = await this.architectureMapper.analyzeArchitecture();
        architecture = archResult.architecture;
      }

      // Analyze entry points
      await this.analyzeEntryPoints(architecture);

      // Analyze user journeys
      await this.analyzeUserJourneys();

      // Analyze API endpoints and routes
      await this.analyzeApiEndpoints();

      // Analyze command-line interfaces
      await this.analyzeCommandInterfaces();

      // Analyze data flows
      await this.analyzeDataFlows();

      // Analyze error handling flows
      await this.analyzeErrorFlows();

      logger.info('Flow analysis completed', {
        entryPoints: this.flows.entryPoints.length,
        userJourneys: this.flows.userJourneys.length,
        apiEndpoints: this.flows.apiEndpoints.length
      });

      return {
        flows: this.flows,
        summary: this.generateSummary()
      };

    } catch (error) {
      logger.error('Failed to analyze flows', { error: error.message });
      throw error;
    }
  }

  /**
   * Analyze application entry points
   * @param {Object} architecture - Architecture information
   */
  async analyzeEntryPoints(architecture) {
    const entryPoints = [];

    // 1. Package.json main and scripts
    if (architecture?.entryPoints) {
      entryPoints.push(...architecture.entryPoints);
    }

    // 2. Web server entry points (Express, FastAPI, etc.)
    const serverEntries = await this.findServerEntryPoints();
    entryPoints.push(...serverEntries);

    // 3. CLI entry points
    const cliEntries = await this.findCliEntryPoints();
    entryPoints.push(...cliEntries);

    // 4. Background service entry points
    const serviceEntries = await this.findServiceEntryPoints();
    entryPoints.push(...serviceEntries);

    // 5. Test entry points
    const testEntries = await this.findTestEntryPoints();
    entryPoints.push(...testEntries);

    // Remove duplicates and categorize
    this.flows.entryPoints = this.deduplicateEntryPoints(entryPoints);
  }

  /**
   * Find server entry points
   * @returns {Array} Server entry points
   */
  async findServerEntryPoints() {
    const servers = [];

    try {
      const packageJson = await fs.readJson(path.join(this.projectRoot, 'package.json'));

      // Check for common server frameworks
      const serverDeps = ['express', 'fastify', 'koa', 'hapi', 'restify', 'sails', 'loopback'];
      const hasServerDep = serverDeps.some(dep =>
        packageJson.dependencies && packageJson.dependencies[dep]
      );

      if (hasServerDep) {
        // Look for server startup files
        const serverFiles = await this.findFilesByPattern([
          '*server*.js', '*app*.js', '*index*.js', '*main*.js',
          '*server*.ts', '*app*.ts', '*index*.ts', '*main*.ts'
        ]);

        serverFiles.forEach(file => {
          if (this.containsServerCode(file)) {
            servers.push({
              type: 'web-server',
              file: file.path,
              purpose: 'HTTP server startup',
              framework: this.detectServerFramework(file),
              port: this.extractServerPort(file)
            });
          }
        });
      }

      // Python servers
      if (packageJson.dependencies && packageJson.dependencies.fastapi ||
          packageJson.dependencies && packageJson.dependencies.flask ||
          packageJson.dependencies && packageJson.dependencies.django) {

        const pythonServers = await this.findFilesByPattern(['*server*.py', '*app*.py', '*main*.py']);
        pythonServers.forEach(file => {
          servers.push({
            type: 'web-server',
            file: file.path,
            purpose: 'Python web server',
            framework: this.detectPythonFramework(file)
          });
        });
      }

    } catch (error) {
      // Ignore missing package.json
    }

    return servers;
  }

  /**
   * Find CLI entry points
   * @returns {Array} CLI entry points
   */
  async findCliEntryPoints() {
    const cliEntries = [];

    try {
      const packageJson = await fs.readJson(path.join(this.projectRoot, 'package.json'));

      // Check if it's a CLI package
      const isCli = packageJson.bin ||
                   (packageJson.dependencies && packageJson.dependencies.commander) ||
                   (packageJson.dependencies && packageJson.dependencies.yargs);

      if (isCli) {
        // Look for CLI entry files
        const cliFiles = await this.findFilesByPattern([
          '*cli*.js', '*bin*.js', '*index*.js', '*main*.js',
          '*cli*.ts', '*bin*.ts', '*index*.ts', '*main*.ts'
        ]);

        cliFiles.forEach(file => {
          if (this.containsCliCode(file)) {
            cliEntries.push({
              type: 'cli',
              file: file.path,
              purpose: 'Command-line interface',
              commands: this.extractCliCommands(file)
            });
          }
        });
      }

    } catch (error) {
      // Ignore missing package.json
    }

    return cliEntries;
  }

  /**
   * Find service/background entry points
   * @returns {Array} Service entry points
   */
  async findServiceEntryPoints() {
    const services = [];

    // Look for service files
    const serviceFiles = await this.findFilesByPattern([
      '*service*.js', '*worker*.js', '*daemon*.js', '*scheduler*.js',
      '*service*.ts', '*worker*.ts', '*daemon*.ts', '*scheduler*.ts'
    ]);

    serviceFiles.forEach(file => {
      if (this.containsServiceCode(file)) {
        services.push({
          type: 'background-service',
          file: file.path,
          purpose: 'Background service or worker',
          serviceType: this.detectServiceType(file)
        });
      }
    });

    return services;
  }

  /**
   * Find test entry points
   * @returns {Array} Test entry points
   */
  async findTestEntryPoints() {
    const tests = [];

    // Look for test files and configurations
    const testFiles = await this.findFilesByPattern([
      '*.test.js', '*.spec.js', '*test*.js', '*spec*.js',
      '*.test.ts', '*.spec.ts', '*test*.ts', '*spec*.ts',
      '*test*.py', '*test*.java'
    ]);

    if (testFiles.length > 0) {
      tests.push({
        type: 'test-suite',
        files: testFiles.map(f => f.path),
        purpose: 'Test execution',
        count: testFiles.length
      });
    }

    return tests;
  }

  /**
   * Analyze user journeys and workflows
   */
  async analyzeUserJourneys() {
    const journeys = [];

    // Analyze based on application type and entry points
    for (const entry of this.flows.entryPoints) {
      if (entry.type === 'web-server') {
        journeys.push({
          name: 'Web Application User Journey',
          entryPoint: entry.file,
          steps: [
            'User accesses application URL',
            'Server processes request',
            'Business logic executes',
            'Data is retrieved/processed',
            'Response is generated',
            'User receives result'
          ],
          keyFlows: await this.analyzeWebFlows(entry)
        });
      } else if (entry.type === 'cli') {
        journeys.push({
          name: 'CLI User Journey',
          entryPoint: entry.file,
          steps: [
            'User runs command',
            'CLI parses arguments',
            'Command logic executes',
            'Results are displayed'
          ],
          keyFlows: entry.commands || []
        });
      }
    }

    this.flows.userJourneys = journeys;
  }

  /**
   * Analyze API endpoints and routes
   */
  async analyzeApiEndpoints() {
    const endpoints = [];

    // Look for route definitions in server files
    for (const entry of this.flows.entryPoints) {
      if (entry.type === 'web-server') {
        try {
          const content = await fs.readFile(entry.file, 'utf8');
          const routes = this.extractRoutes(content, entry.framework);

          if (routes.length > 0) {
            endpoints.push({
              server: entry.file,
              framework: entry.framework,
              routes: routes,
              count: routes.length
            });
          }
        } catch (error) {
          // Skip files that can't be read
        }
      }
    }

    this.flows.apiEndpoints = endpoints;
  }

  /**
   * Analyze command-line interfaces
   */
  async analyzeCommandInterfaces() {
    const commands = [];

    for (const entry of this.flows.entryPoints) {
      if (entry.type === 'cli') {
        commands.push({
          entryPoint: entry.file,
          commands: entry.commands || [],
          flows: await this.analyzeCliFlows(entry)
        });
      }
    }

    this.flows.commandFlows = commands;
  }

  /**
   * Analyze data flows through the application
   */
  async analyzeDataFlows() {
    const dataFlows = [];

    // Analyze based on detected frameworks and patterns
    // This would integrate with the dependency graph from Phase 1

    // For now, provide basic data flow analysis
    dataFlows.push({
      name: 'Application Data Flow',
      description: 'Data movement through the application layers',
      steps: [
        'Input data received',
        'Data validation and sanitization',
        'Business logic processing',
        'Data persistence/storage',
        'Data retrieval for responses',
        'Output data formatting'
      ]
    });

    this.flows.dataFlows = dataFlows;
  }

  /**
   * Analyze error handling flows
   */
  async analyzeErrorFlows() {
    const errorFlows = [];

    // Look for error handling patterns
    const errorFiles = await this.findFilesByPattern(['*error*.js', '*exception*.js']);

    if (errorFiles.length > 0) {
      errorFlows.push({
        name: 'Error Handling Flow',
        files: errorFiles.map(f => f.path),
        patterns: ['Try-catch blocks', 'Error middleware', 'Custom error classes'],
        coverage: 'Partial analysis available'
      });
    }

    this.flows.errorFlows = errorFlows;
  }

  /**
   * Helper: Find files by pattern
   * @param {Array} patterns - Glob patterns
   * @returns {Array} Matching files
   */
  async findFilesByPattern(patterns) {
    const files = [];

    const scanDirectory = async (dir, depth = 0) => {
      if (depth > this.maxDepth) return;

      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          const relativePath = path.relative(this.projectRoot, fullPath);

          // Skip node_modules
          if (relativePath.includes('node_modules')) continue;

          if (entry.isDirectory() && !['.git', 'dist', 'build'].includes(entry.name)) {
            await scanDirectory(fullPath, depth + 1);
          } else if (entry.isFile()) {
            const matchesPattern = patterns.some(pattern => {
              const regex = new RegExp(pattern.replace(/\*/g, '.*'));
              return regex.test(entry.name);
            });

            if (matchesPattern) {
              files.push({
                path: relativePath,
                name: entry.name,
                directory: path.dirname(relativePath)
              });
            }
          }
        }
      } catch (error) {
        // Skip directories that can't be read
      }
    };

    await scanDirectory(this.projectRoot);
    return files;
  }

  /**
   * Helper: Check if file contains server code
   * @param {Object} file - File info
   * @returns {boolean} True if server code detected
   */
  containsServerCode(file) {
    try {
      const content = fs.readFileSync(path.join(this.projectRoot, file.path), 'utf8');
      return /(app\.listen|server\.listen|createServer|fastify|express\(\))/.test(content);
    } catch (error) {
      return false;
    }
  }

  /**
   * Helper: Check if file contains CLI code
   * @param {Object} file - File info
   * @returns {boolean} True if CLI code detected
   */
  containsCliCode(file) {
    try {
      const content = fs.readFileSync(path.join(this.projectRoot, file.path), 'utf8');
      return /(commander|program\.|yargs|process\.argv)/.test(content);
    } catch (error) {
      return false;
    }
  }

  /**
   * Helper: Check if file contains service code
   * @param {Object} file - File info
   * @returns {boolean} True if service code detected
   */
  containsServiceCode(file) {
    try {
      const content = fs.readFileSync(path.join(this.projectRoot, file.path), 'utf8');
      return /(worker|daemon|scheduler|service|queue)/.test(content);
    } catch (error) {
      return false;
    }
  }

  /**
   * Helper: Detect server framework
   * @param {Object} file - File info
   * @returns {string} Framework name
   */
  detectServerFramework(file) {
    try {
      const content = fs.readFileSync(path.join(this.projectRoot, file.path), 'utf8');

      if (content.includes('express(')) return 'Express.js';
      if (content.includes('fastify(')) return 'Fastify';
      if (content.includes('koa(')) return 'Koa.js';
      if (content.includes('createServer')) return 'Node.js HTTP';

      return 'Unknown';
    } catch (error) {
      return 'Unknown';
    }
  }

  /**
   * Helper: Detect Python framework
   * @param {Object} file - File info
   * @returns {string} Framework name
   */
  detectPythonFramework(file) {
    try {
      const content = fs.readFileSync(path.join(this.projectRoot, file.path), 'utf8');

      if (content.includes('FastAPI')) return 'FastAPI';
      if (content.includes('Flask')) return 'Flask';
      if (content.includes('Django')) return 'Django';

      return 'Unknown Python Framework';
    } catch (error) {
      return 'Unknown';
    }
  }

  /**
   * Helper: Extract server port
   * @param {Object} file - File info
   * @returns {number|null} Port number
   */
  extractServerPort(file) {
    try {
      const content = fs.readFileSync(path.join(this.projectRoot, file.path), 'utf8');
      const portMatch = content.match(/listen\((\d+)/);
      return portMatch ? parseInt(portMatch[1]) : null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Helper: Extract CLI commands
   * @param {Object} file - File info
   * @returns {Array} Command names
   */
  extractCliCommands(file) {
    try {
      const content = fs.readFileSync(path.join(this.projectRoot, file.path), 'utf8');
      const commands = [];
      const commandMatches = content.match(/\.command\(['"]([^'"]+)/g);

      if (commandMatches) {
        commands.push(...commandMatches.map(match => match.replace(/\.command\(['"]/, '')));
      }

      return commands;
    } catch (error) {
      return [];
    }
  }

  /**
   * Helper: Detect service type
   * @param {Object} file - File info
   * @returns {string} Service type
   */
  detectServiceType(file) {
    const fileName = file.name.toLowerCase();

    if (fileName.includes('worker')) return 'Worker Process';
    if (fileName.includes('daemon')) return 'Daemon Service';
    if (fileName.includes('scheduler')) return 'Task Scheduler';
    if (fileName.includes('service')) return 'Background Service';

    return 'Generic Service';
  }

  /**
   * Helper: Extract routes from server code
   * @param {string} content - File content
   * @param {string} framework - Server framework
   * @returns {Array} Route definitions
   */
  extractRoutes(content, framework) {
    const routes = [];

    if (framework === 'Express.js') {
      const routeMatches = content.match(/app\.(get|post|put|delete|patch|options|head)\(['"]([^'"]+)/g);
      if (routeMatches) {
        routes.push(...routeMatches.map(match => {
          const parts = match.split(/['"]/);
          return { method: parts[0].split('.')[1], path: parts[1] };
        }));
      }
    }

    return routes;
  }

  /**
   * Helper: Analyze web application flows
   * @param {Object} entry - Entry point
   * @returns {Array} Web flows
   */
  async analyzeWebFlows(entry) {
    const flows = [];

    try {
      const content = await fs.readFile(entry.file, 'utf8');

      // Look for middleware usage
      if (content.includes('app.use(')) {
        flows.push('Middleware pipeline processing');
      }

      // Look for authentication
      if (content.includes('passport') || content.includes('auth')) {
        flows.push('Authentication and authorization');
      }

      // Look for database operations
      if (content.includes('mongoose') || content.includes('sequelize')) {
        flows.push('Database operations and ORM');
      }

      // Look for file uploads
      if (content.includes('multer') || content.includes('upload')) {
        flows.push('File upload handling');
      }

    } catch (error) {
      // Ignore read errors
    }

    return flows;
  }

  /**
   * Helper: Analyze CLI flows
   * @param {Object} entry - CLI entry point
   * @returns {Array} CLI flows
   */
  async analyzeCliFlows(entry) {
    const flows = [];

    try {
      const content = await fs.readFile(entry.file, 'utf8');

      // Look for interactive prompts
      if (content.includes('inquirer') || content.includes('prompt')) {
        flows.push('Interactive user prompts');
      }

      // Look for file operations
      if (content.includes('fs.') || content.includes('readFile')) {
        flows.push('File system operations');
      }

      // Look for network operations
      if (content.includes('http') || content.includes('fetch')) {
        flows.push('Network operations');
      }

      // Look for progress indicators
      if (content.includes('ora') || content.includes('spinner')) {
        flows.push('Progress indication');
      }

    } catch (error) {
      // Ignore read errors
    }

    return flows;
  }

  /**
   * Helper: Remove duplicate entry points
   * @param {Array} entryPoints - Raw entry points
   * @returns {Array} Deduplicated entry points
   */
  deduplicateEntryPoints(entryPoints) {
    const seen = new Set();
    return entryPoints.filter(entry => {
      const key = `${entry.type}:${entry.file}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  /**
   * Generate analysis summary
   * @returns {Object} Summary statistics
   */
  generateSummary() {
    return {
      entryPoints: this.flows.entryPoints.length,
      userJourneys: this.flows.userJourneys.length,
      apiEndpoints: this.flows.apiEndpoints.reduce((sum, api) => sum + api.count, 0),
      commandFlows: this.flows.commandFlows.length,
      dataFlows: this.flows.dataFlows.length,
      errorFlows: this.flows.errorFlows.length,
      primaryEntryPoint: this.flows.entryPoints[0]?.file || null
    };
  }

  /**
   * Generate detailed report
   * @returns {string} Formatted report
   */
  generateReport() {
    let report = '🌊 Application Flow Analysis Report\n';
    report += '='.repeat(40) + '\n\n';

    // Entry Points
    report += '🚪 Entry Points:\n';
    if (this.flows.entryPoints.length > 0) {
      this.flows.entryPoints.forEach((entry, index) => {
        report += `  ${index + 1}. ${entry.type.toUpperCase()}: ${entry.file}\n`;
        if (entry.purpose) report += `     Purpose: ${entry.purpose}\n`;
        if (entry.framework) report += `     Framework: ${entry.framework}\n`;
        if (entry.port) report += `     Port: ${entry.port}\n`;
        report += '\n';
      });
    } else {
      report += '  No entry points identified\n\n';
    }

    // User Journeys
    if (this.flows.userJourneys.length > 0) {
      report += '👤 User Journeys:\n';
      this.flows.userJourneys.forEach(journey => {
        report += `  • ${journey.name}\n`;
        report += `    Entry: ${journey.entryPoint}\n`;
        report += `    Steps: ${journey.steps.join(' → ')}\n`;
        if (journey.keyFlows.length > 0) {
          report += `    Key Flows: ${journey.keyFlows.join(', ')}\n`;
        }
        report += '\n';
      });
    }

    // API Endpoints
    if (this.flows.apiEndpoints.length > 0) {
      report += '🔗 API Endpoints:\n';
      this.flows.apiEndpoints.forEach(api => {
        report += `  • ${api.server} (${api.framework})\n`;
        report += `    Routes: ${api.count}\n`;
        api.routes.slice(0, 5).forEach(route => {
          report += `      - ${route.method.toUpperCase()} ${route.path}\n`;
        });
        if (api.routes.length > 5) {
          report += `      ... and ${api.routes.length - 5} more\n`;
        }
        report += '\n';
      });
    }

    // Command Flows
    if (this.flows.commandFlows.length > 0) {
      report += '💻 Command-Line Interfaces:\n';
      this.flows.commandFlows.forEach(cli => {
        report += `  • ${cli.entryPoint}\n`;
        if (cli.commands.length > 0) {
          report += `    Commands: ${cli.commands.join(', ')}\n`;
        }
        if (cli.flows.length > 0) {
          report += `    Flows: ${cli.flows.join(', ')}\n`;
        }
        report += '\n';
      });
    }

    // Data Flows
    if (this.flows.dataFlows.length > 0) {
      report += '📊 Data Flows:\n';
      this.flows.dataFlows.forEach(flow => {
        report += `  • ${flow.name}: ${flow.description}\n`;
        report += `    Steps: ${flow.steps.join(' → ')}\n\n`;
      });
    }

    return report;
  }
}
