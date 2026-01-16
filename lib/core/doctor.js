/**
 * Doctor - System Health Check Module
 * Diagnoses common issues with Grok Code installation and configuration
 */

import fs from 'fs-extra';
import path from 'path';
import { execSync } from 'child_process';
import https from 'https';

export class Doctor {
  constructor(options = {}) {
    this.projectRoot = options.projectRoot || process.cwd();
    this.globalDir = options.globalDir || path.join(process.env.HOME || '', '.grok');

    this.checks = [];
    this.results = {
      passed: [],
      warnings: [],
      errors: []
    };
  }

  /**
   * Run all diagnostic checks
   * @returns {Promise<Object>} Diagnostic results
   */
  async runAll() {
    this.results = { passed: [], warnings: [], errors: [] };

    console.log('\n🔍 Running Grok Code diagnostics...\n');

    // Core checks
    await this.checkNodeVersion();
    await this.checkApiKey();
    await this.checkApiConnection();
    await this.checkGlobalConfig();
    await this.checkProjectConfig();
    await this.checkDependencies();
    await this.checkGitInstallation();
    await this.checkDiskSpace();
    await this.checkWritePermissions();

    return this.generateReport();
  }

  /**
   * Check Node.js version
   */
  async checkNodeVersion() {
    const checkName = 'Node.js Version';

    try {
      const version = process.version;
      const major = parseInt(version.slice(1).split('.')[0], 10);

      if (major >= 18) {
        this.pass(checkName, `Node.js ${version} (✓ requires 18+)`);
      } else if (major >= 16) {
        this.warn(checkName, `Node.js ${version} - recommend upgrading to 18+`);
      } else {
        this.fail(checkName, `Node.js ${version} - requires 18+, please upgrade`);
      }
    } catch (error) {
      this.fail(checkName, `Could not determine Node.js version: ${error.message}`);
    }
  }

  /**
   * Check API key configuration
   */
  async checkApiKey() {
    const checkName = 'API Key';

    // Check environment variables
    const envKey = process.env.XAI_API_KEY || process.env.GROK_API_KEY;

    if (envKey) {
      if (envKey.length > 20) {
        this.pass(checkName, 'API key found in environment variable');
        return;
      } else {
        this.warn(checkName, 'API key in environment looks too short');
      }
    }

    // Check global config file
    const keyPath = path.join(this.globalDir, 'api_key');
    if (await fs.pathExists(keyPath)) {
      const key = (await fs.readFile(keyPath, 'utf8')).trim();
      if (key.length > 20) {
        this.pass(checkName, `API key found at ${keyPath}`);
      } else {
        this.warn(checkName, 'API key file exists but appears invalid');
      }
    } else {
      this.fail(checkName, 'No API key found. Set XAI_API_KEY environment variable or run grok to configure.');
    }
  }

  /**
   * Check API connection
   */
  async checkApiConnection() {
    const checkName = 'API Connection';

    const apiKey = process.env.XAI_API_KEY || process.env.GROK_API_KEY;

    if (!apiKey) {
      // Try to load from file
      const keyPath = path.join(this.globalDir, 'api_key');
      if (await fs.pathExists(keyPath)) {
        const key = (await fs.readFile(keyPath, 'utf8')).trim();
        if (key) {
          return this.testApiConnection(checkName, key);
        }
      }
      this.warn(checkName, 'Skipped - no API key available');
      return;
    }

    await this.testApiConnection(checkName, apiKey);
  }

  /**
   * Test the actual API connection
   */
  async testApiConnection(checkName, apiKey) {
    return new Promise((resolve) => {
      const postData = JSON.stringify({
        model: 'grok-3-mini-beta',
        messages: [{ role: 'user', content: 'Hi' }],
        max_tokens: 5
      });

      const options = {
        hostname: 'api.x.ai',
        port: 443,
        path: '/v1/chat/completions',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'Content-Length': Buffer.byteLength(postData)
        },
        timeout: 10000
      };

      const req = https.request(options, (res) => {
        if (res.statusCode === 200) {
          this.pass(checkName, 'Successfully connected to xAI API');
        } else if (res.statusCode === 401) {
          this.fail(checkName, 'API key is invalid (401 Unauthorized)');
        } else if (res.statusCode === 429) {
          this.warn(checkName, 'Rate limited - but connection works');
        } else {
          this.warn(checkName, `API returned status ${res.statusCode}`);
        }
        resolve();
      });

      req.on('error', (error) => {
        this.fail(checkName, `Could not connect to API: ${error.message}`);
        resolve();
      });

      req.on('timeout', () => {
        this.fail(checkName, 'Connection timed out after 10 seconds');
        req.destroy();
        resolve();
      });

      req.write(postData);
      req.end();
    });
  }

  /**
   * Check global configuration
   */
  async checkGlobalConfig() {
    const checkName = 'Global Configuration';

    if (!await fs.pathExists(this.globalDir)) {
      this.warn(checkName, `~/.grok/ directory not found - will be created on first run`);
      return;
    }

    const settingsPath = path.join(this.globalDir, 'settings.json');
    if (await fs.pathExists(settingsPath)) {
      try {
        const settings = await fs.readJson(settingsPath);
        this.pass(checkName, `Global settings found with model: ${settings.model || 'default'}`);
      } catch (error) {
        this.warn(checkName, 'Global settings.json exists but is not valid JSON');
      }
    } else {
      this.pass(checkName, '~/.grok/ exists (no custom settings)');
    }
  }

  /**
   * Check project configuration
   */
  async checkProjectConfig() {
    const checkName = 'Project Configuration';

    const grokDir = path.join(this.projectRoot, '.grok');
    const grokMd = path.join(this.projectRoot, 'GROK.md');

    const hasGrokDir = await fs.pathExists(grokDir);
    const hasGrokMd = await fs.pathExists(grokMd);

    if (hasGrokDir && hasGrokMd) {
      this.pass(checkName, 'Project has both .grok/ and GROK.md');
    } else if (hasGrokDir) {
      this.pass(checkName, 'Project has .grok/ configuration directory');
    } else if (hasGrokMd) {
      this.pass(checkName, 'Project has GROK.md instructions file');
    } else {
      this.warn(checkName, 'No project configuration found (use /init to create)');
    }
  }

  /**
   * Check npm dependencies
   */
  async checkDependencies() {
    const checkName = 'Dependencies';

    const packagePath = path.join(this.projectRoot, 'package.json');

    // Check if we're in the grok-code directory
    if (!await fs.pathExists(packagePath)) {
      this.pass(checkName, 'Not in a Node.js project (OK for general use)');
      return;
    }

    const nodeModules = path.join(this.projectRoot, 'node_modules');
    if (!await fs.pathExists(nodeModules)) {
      this.warn(checkName, 'node_modules not found - run npm install if needed');
      return;
    }

    // Check key dependencies
    const criticalDeps = ['inquirer', 'chalk', 'fs-extra'];
    const missing = [];

    for (const dep of criticalDeps) {
      const depPath = path.join(nodeModules, dep);
      if (!await fs.pathExists(depPath)) {
        missing.push(dep);
      }
    }

    if (missing.length === 0) {
      this.pass(checkName, 'All critical dependencies installed');
    } else {
      this.fail(checkName, `Missing dependencies: ${missing.join(', ')}`);
    }
  }

  /**
   * Check Git installation
   */
  async checkGitInstallation() {
    const checkName = 'Git Installation';

    try {
      const version = execSync('git --version', { encoding: 'utf8' }).trim();
      this.pass(checkName, version);

      // Check if in a git repo
      try {
        execSync('git rev-parse --git-dir', { encoding: 'utf8', cwd: this.projectRoot });
        this.pass('Git Repository', 'Current directory is a git repository');
      } catch {
        this.warn('Git Repository', 'Not in a git repository');
      }
    } catch {
      this.warn(checkName, 'Git not installed - git features will be limited');
    }
  }

  /**
   * Check available disk space
   */
  async checkDiskSpace() {
    const checkName = 'Disk Space';

    try {
      // Use df command (works on macOS and Linux)
      const output = execSync(`df -h "${this.projectRoot}"`, { encoding: 'utf8' });
      const lines = output.trim().split('\n');

      if (lines.length >= 2) {
        const parts = lines[1].split(/\s+/);
        const available = parts[3]; // Available space
        const usePercent = parts[4]; // Use percentage

        const percentUsed = parseInt(usePercent, 10);

        if (percentUsed >= 95) {
          this.fail(checkName, `Only ${available} available (${usePercent} used) - critically low!`);
        } else if (percentUsed >= 85) {
          this.warn(checkName, `${available} available (${usePercent} used) - consider freeing space`);
        } else {
          this.pass(checkName, `${available} available`);
        }
      }
    } catch {
      this.warn(checkName, 'Could not determine disk space');
    }
  }

  /**
   * Check write permissions
   */
  async checkWritePermissions() {
    const checkName = 'Write Permissions';

    const testFile = path.join(this.projectRoot, '.grok-test-write');

    try {
      await fs.writeFile(testFile, 'test');
      await fs.remove(testFile);
      this.pass(checkName, 'Can write to project directory');
    } catch {
      this.fail(checkName, 'Cannot write to project directory - check permissions');
    }
  }

  /**
   * Record a passed check
   */
  pass(name, message) {
    this.results.passed.push({ name, message });
    console.log(`  ✅ ${name}: ${message}`);
  }

  /**
   * Record a warning
   */
  warn(name, message) {
    this.results.warnings.push({ name, message });
    console.log(`  ⚠️  ${name}: ${message}`);
  }

  /**
   * Record a failure
   */
  fail(name, message) {
    this.results.errors.push({ name, message });
    console.log(`  ❌ ${name}: ${message}`);
  }

  /**
   * Generate final report
   */
  generateReport() {
    const total = this.results.passed.length + this.results.warnings.length + this.results.errors.length;

    console.log('\n' + '─'.repeat(50));
    console.log('📊 Diagnostic Summary');
    console.log('─'.repeat(50));
    console.log(`  ✅ Passed:   ${this.results.passed.length}/${total}`);
    console.log(`  ⚠️  Warnings: ${this.results.warnings.length}/${total}`);
    console.log(`  ❌ Errors:   ${this.results.errors.length}/${total}`);
    console.log('');

    if (this.results.errors.length === 0 && this.results.warnings.length === 0) {
      console.log('🎉 All checks passed! Grok Code is healthy.');
    } else if (this.results.errors.length === 0) {
      console.log('✨ No critical issues found. Review warnings above.');
    } else {
      console.log('🔧 Please address the errors above to ensure Grok Code works correctly.');
    }

    console.log('');

    return {
      healthy: this.results.errors.length === 0,
      ...this.results
    };
  }

  /**
   * Run a quick check (fewer tests)
   */
  async runQuick() {
    this.results = { passed: [], warnings: [], errors: [] };

    console.log('\n🔍 Running quick diagnostics...\n');

    await this.checkNodeVersion();
    await this.checkApiKey();
    await this.checkWritePermissions();

    return this.generateReport();
  }
}

/**
 * Handle /doctor command
 */
export async function handleDoctorCommand(input) {
  const parts = input.split(' ');
  const subcommand = parts[1];

  const doctor = new Doctor();

  if (subcommand === 'quick') {
    return await doctor.runQuick();
  }

  if (subcommand === 'help') {
    console.log(`
🩺 Grok Code Doctor
═══════════════════

Commands:
  /doctor          Run full diagnostic checks
  /doctor quick    Run quick essential checks
  /doctor help     Show this help

Checks performed:
  • Node.js version (requires 18+)
  • API key configuration
  • API connection test
  • Global ~/.grok/ configuration
  • Project .grok/ configuration
  • GROK.md instructions file
  • npm dependencies
  • Git installation
  • Disk space
  • Write permissions
`);
    return { healthy: true };
  }

  return await doctor.runAll();
}

export default Doctor;
