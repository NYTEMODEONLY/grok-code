import { ErrorRecoveryWorkflow } from '../../lib/workflows/error-recovery.js';
import { CodePreview } from '../../lib/display/code-preview.js';
import { ProgressIndicator } from '../../lib/display/progress-indicator.js';
import fs from 'fs';
import path from 'path';

/**
 * Interactive Debugging Sessions Command
 * Provides interactive error analysis and recovery sessions
 */
export class DebugCommand {
  constructor() {
    this.workflow = new ErrorRecoveryWorkflow({
      progress: new ProgressIndicator(),
    });
    this.codePreview = new CodePreview();
    this.currentSession = null;
    this.sessionHistory = [];
  }

  /**
   * Execute debug command
   * @param {Array} args - Command arguments
   * @param {Object} context - Execution context
   */
  async execute(args, context) {
    const subcommand = args[0] || 'interactive';

    switch (subcommand) {
      case 'interactive':
      case 'start':
        return await this.startInteractiveSession(args.slice(1), context);
      case 'file':
        return await this.debugFile(args.slice(1), context);
      case 'errors':
        return await this.analyzeErrors(args.slice(1), context);
      case 'fix':
        return await this.applyFix(args.slice(1), context);
      case 'history':
        return this.showSessionHistory();
      case 'stats':
        return this.showStatistics();
      case 'help':
      default:
        return this.showHelp();
    }
  }

  /**
   * Start an interactive debugging session
   * @param {Array} args - Additional arguments
   * @param {Object} context - Execution context
   */
  async startInteractiveSession(args, context) {
    const { inquirer } = await import('inquirer');

    console.log('🐛 Interactive Debug Session');
    console.log('═'.repeat(30));
    console.log(
      'Analyze errors, generate fixes, and apply solutions interactively.\n'
    );

    const sessionId = `debug_${Date.now()}`;
    this.currentSession = {
      id: sessionId,
      startTime: new Date(),
      steps: [],
      errors: [],
      fixes: [],
    };

    while (true) {
      const { action } = await inquirer.prompt([
        {
          type: 'list',
          name: 'action',
          message: 'What would you like to do?',
          choices: [
            { name: '📄 Analyze file for errors', value: 'analyze_file' },
            { name: '📝 Analyze error output', value: 'analyze_errors' },
            { name: '🔧 Generate fixes', value: 'generate_fixes' },
            { name: '✅ Apply fixes', value: 'apply_fixes' },
            { name: '👁️  Preview fixes', value: 'preview_fixes' },
            { name: '📊 Show session summary', value: 'show_summary' },
            { name: '🔄 Start over', value: 'restart' },
            { name: '🚪 Exit debug session', value: 'exit' },
          ],
        },
      ]);

      try {
        switch (action) {
          case 'analyze_file':
            await this.interactiveFileAnalysis(context);
            break;
          case 'analyze_errors':
            await this.interactiveErrorAnalysis(context);
            break;
          case 'generate_fixes':
            await this.interactiveFixGeneration(context);
            break;
          case 'apply_fixes':
            await this.interactiveFixApplication(context);
            break;
          case 'preview_fixes':
            await this.previewFixes();
            break;
          case 'show_summary':
            this.showSessionSummary();
            break;
          case 'restart':
            this.currentSession = {
              id: `debug_${Date.now()}`,
              startTime: new Date(),
              steps: [],
              errors: [],
              fixes: [],
            };
            console.log('🔄 Session restarted.\n');
            break;
          case 'exit':
            this.finalizeSession();
            return { success: true, message: 'Debug session ended.' };
        }
      } catch (error) {
        console.log(`❌ Error: ${error.message}\n`);
        this.currentSession.steps.push({
          type: 'error',
          message: error.message,
          timestamp: new Date(),
        });
      }
    }
  }

  /**
   * Interactive file analysis
   * @param {Object} context - Execution context
   */
  async interactiveFileAnalysis(context) {
    const { inquirer } = await import('inquirer');

    const { filePath } = await inquirer.prompt([
      {
        type: 'input',
        name: 'filePath',
        message: 'Enter file path to analyze:',
        validate: (input) => {
          if (!input.trim()) return 'File path is required';
          const fullPath = path.isAbsolute(input)
            ? input
            : path.join(context.cwd, input);
          if (!fs.existsSync(fullPath)) return 'File does not exist';
          return true;
        },
      },
    ]);

    const fullPath = path.isAbsolute(filePath)
      ? filePath
      : path.join(context.cwd, filePath);

    console.log(`\n📄 Analyzing: ${path.relative(context.cwd, fullPath)}\n`);

    // Show file preview
    const preview = this.codePreview.previewFile(fullPath, {
      showLineNumbers: true,
      showHeader: true,
      maxLines: 20,
    });
    console.log(preview);

    // Run linter/checker if available
    const { runChecks } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'runChecks',
        message: 'Run error checking on this file?',
        default: true,
      },
    ]);

    if (runChecks) {
      await this.runFileChecks(fullPath, context);
    }

    this.currentSession.steps.push({
      type: 'file_analysis',
      file: fullPath,
      timestamp: new Date(),
    });
  }

  /**
   * Run error checking on a file
   * @param {string} filePath - Path to file
   * @param {Object} context - Execution context
   */
  async runFileChecks(filePath, context) {
    const { execSync } = await import('child_process');

    console.log('\n🔍 Running error checks...\n');

    const checks = [];
    const ext = path.extname(filePath).toLowerCase();

    // JavaScript/TypeScript checks
    if (['.js', '.jsx', '.ts', '.tsx'].includes(ext)) {
      try {
        // Try ESLint
        const eslintOutput = execSync(`npx eslint ${filePath} --format unix`, {
          encoding: 'utf8',
          timeout: 10000,
        });
        if (eslintOutput.trim()) {
          checks.push({ tool: 'ESLint', output: eslintOutput });
        }
      } catch (error) {
        if (error.stdout) {
          checks.push({ tool: 'ESLint', output: error.stdout });
        }
      }

      try {
        // Try TypeScript compiler for .ts files
        if (ext === '.ts' || ext === '.tsx') {
          const tscOutput = execSync(`npx tsc --noEmit ${filePath}`, {
            encoding: 'utf8',
            timeout: 10000,
          });
          if (tscOutput.trim()) {
            checks.push({ tool: 'TypeScript', output: tscOutput });
          }
        }
      } catch (error) {
        if (error.stdout) {
          checks.push({ tool: 'TypeScript', output: error.stdout });
        }
      }
    }

    // Python checks
    if (ext === '.py') {
      try {
        const pylintOutput = execSync(`python -m pylint ${filePath}`, {
          encoding: 'utf8',
          timeout: 10000,
        });
        if (pylintOutput.trim()) {
          checks.push({ tool: 'Pylint', output: pylintOutput });
        }
      } catch (error) {
        if (error.stdout) {
          checks.push({ tool: 'Pylint', output: error.stdout });
        }
      }
    }

    if (checks.length === 0) {
      console.log('✅ No errors found or no compatible checkers available.\n');
      return;
    }

    // Combine all error outputs
    const combinedErrors = checks.map((check) => check.output).join('\n\n');

    console.log('📋 Error Analysis Results:');
    console.log('═'.repeat(30));

    for (const check of checks) {
      console.log(`\n${check.tool}:`);
      console.log(check.output);
    }

    // Store for later use
    this.currentSession.errors.push({
      file: filePath,
      checks,
      combinedOutput: combinedErrors,
      timestamp: new Date(),
    });

    const { analyzeErrors } = await (
      await import('inquirer')
    ).prompt([
      {
        type: 'confirm',
        name: 'analyzeErrors',
        message: 'Analyze these errors and suggest fixes?',
        default: true,
      },
    ]);

    if (analyzeErrors) {
      await this.analyzeStoredErrors(combinedErrors, context);
    }
  }

  /**
   * Interactive error analysis
   * @param {Object} context - Execution context
   */
  async interactiveErrorAnalysis(context) {
    const { inquirer } = await import('inquirer');

    const { errorSource } = await inquirer.prompt([
      {
        type: 'list',
        name: 'errorSource',
        message: 'How would you like to provide errors?',
        choices: [
          { name: '📝 Paste error output', value: 'paste' },
          { name: '📄 Load from file', value: 'file' },
          { name: '🔄 Use last analysis', value: 'last' },
        ],
      },
    ]);

    let errorOutput = '';

    switch (errorSource) {
      case 'paste': {
        const { pastedErrors } = await inquirer.prompt([
          {
            type: 'editor',
            name: 'pastedErrors',
            message: 'Paste your error output:',
          },
        ]);
        errorOutput = pastedErrors;
        break;
      }

      case 'file': {
        const { errorFile } = await inquirer.prompt([
          {
            type: 'input',
            name: 'errorFile',
            message: 'Enter path to error file:',
          },
        ]);
        const fullPath = path.isAbsolute(errorFile)
          ? errorFile
          : path.join(context.cwd, errorFile);
        errorOutput = fs.readFileSync(fullPath, 'utf8');
        break;
      }

      case 'last':
        if (this.currentSession.errors.length > 0) {
          const lastError =
            this.currentSession.errors[this.currentSession.errors.length - 1];
          errorOutput = lastError.combinedOutput;
        } else {
          console.log('❌ No previous error analysis found.\n');
          return;
        }
        break;
    }

    if (errorOutput.trim()) {
      await this.analyzeStoredErrors(errorOutput, context);
    }
  }

  /**
   * Analyze stored errors using the workflow system
   * @param {string} errorOutput - Error output to analyze
   * @param {Object} context - Execution context
   */
  async analyzeStoredErrors(errorOutput, context) {
    console.log('\n🔄 Analyzing errors and generating recovery plan...\n');

    const result = await this.workflow.executeRecoveryWorkflow(errorOutput, {
      ...context,
      sessionId: this.currentSession.id,
      interactive: true,
    });

    console.log('📊 Analysis Complete:');
    console.log('═'.repeat(20));
    console.log(`Errors Found: ${result.parsedErrors?.length || 0}`);
    console.log(
      `Auto-fixable: ${result.fixResults?.filter((r) => r.canAutoApply).length || 0}`
    );
    console.log(
      `Manual Fixes: ${result.fixResults?.filter((r) => !r.canAutoApply && r.fixResult).length || 0}`
    );
    console.log(
      `Unfixable: ${result.fixResults?.filter((r) => !r.fixResult).length || 0}`
    );
    console.log(`Duration: ${result.duration}ms\n`);

    this.currentSession.errors.push({
      output: errorOutput,
      analysis: result,
      timestamp: new Date(),
    });

    this.currentSession.steps.push({
      type: 'error_analysis',
      errorCount: result.parsedErrors?.length || 0,
      fixableCount:
        result.fixResults?.filter((r) => r.canAutoApply).length || 0,
      timestamp: new Date(),
    });
  }

  /**
   * Interactive fix generation
   * @param {Object} context - Execution context
   */
  async interactiveFixGeneration(context) {
    if (this.currentSession.errors.length === 0) {
      console.log(
        '❌ No errors to generate fixes for. Please analyze errors first.\n'
      );
      return;
    }

    const { inquirer } = await import('inquirer');
    const lastAnalysis =
      this.currentSession.errors[this.currentSession.errors.length - 1];

    if (!lastAnalysis.analysis?.fixResults) {
      console.log(
        '❌ No fix results available. Please run error analysis first.\n'
      );
      return;
    }

    const fixResults = lastAnalysis.analysis.fixResults;
    const autoFixes = fixResults.filter((r) => r.canAutoApply);
    const manualFixes = fixResults.filter(
      (r) => !r.canAutoApply && r.fixResult
    );

    console.log(`\n🔧 Fix Generation Results:`);
    console.log(`Auto-applicable fixes: ${autoFixes.length}`);
    console.log(`Manual fixes needed: ${manualFixes.length}`);
    console.log(
      `Unfixable errors: ${fixResults.filter((r) => !r.fixResult).length}\n`
    );

    this.currentSession.fixes = fixResults;

    const { showDetails } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'showDetails',
        message: 'Show detailed fix information?',
        default: true,
      },
    ]);

    if (showDetails) {
      this.displayFixDetails(fixResults);
    }

    this.currentSession.steps.push({
      type: 'fix_generation',
      autoFixes: autoFixes.length,
      manualFixes: manualFixes.length,
      timestamp: new Date(),
    });
  }

  /**
   * Display detailed fix information
   * @param {Array} fixResults - Fix results to display
   */
  displayFixDetails(fixResults) {
    console.log('\n📋 Detailed Fix Information:');
    console.log('═'.repeat(30));

    fixResults.forEach((result, index) => {
      const { error, fixResult, canAutoApply, confidence } = result;

      console.log(`\n${index + 1}. ${error.message}`);
      console.log(`   File: ${error.file || 'unknown'}:${error.line || '?'}`);
      console.log(`   Type: ${error.classification?.type || 'unknown'}`);
      console.log(
        `   Severity: ${error.classification?.severity || 'unknown'}`
      );
      console.log(
        `   Auto-fixable: ${canAutoApply ? '✅' : '❌'} (${Math.round(confidence * 100)}% confidence)`
      );

      if (fixResult) {
        console.log(`   Fix: ${fixResult.description || 'Generated fix'}`);
        if (fixResult.changes && fixResult.changes.length > 0) {
          console.log(`   Changes: ${fixResult.changes.length} file(s)`);
        }
      } else {
        console.log(`   Status: No fix available`);
      }
    });

    console.log();
  }

  /**
   * Interactive fix application
   * @param {Object} context - Execution context
   */
  async interactiveFixApplication(context) {
    if (!this.currentSession.fixes || this.currentSession.fixes.length === 0) {
      console.log('❌ No fixes available. Please generate fixes first.\n');
      return;
    }

    const { inquirer } = await import('inquirer');
    const fixResults = this.currentSession.fixes;

    const autoFixes = fixResults.filter((r) => r.canAutoApply);
    const manualFixes = fixResults.filter(
      (r) => !r.canAutoApply && r.fixResult
    );

    console.log(`\n✅ Available Fixes:`);
    console.log(`Auto-applicable: ${autoFixes.length}`);
    console.log(`Manual fixes: ${manualFixes.length}\n`);

    const { applyAutoFixes } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'applyAutoFixes',
        message: `Apply ${autoFixes.length} auto-fixable errors automatically?`,
        default: true,
      },
    ]);

    if (applyAutoFixes && autoFixes.length > 0) {
      console.log('\n🔄 Applying auto-fixes...\n');

      for (const fixResult of autoFixes) {
        try {
          const result = await this.workflow.fixGenerator.applyFix(
            fixResult.fixResult,
            fixResult.error,
            context
          );

          if (result.success) {
            console.log(`✅ Applied: ${fixResult.error.message}`);
          } else {
            console.log(
              `❌ Failed: ${fixResult.error.message} - ${result.message}`
            );
          }
        } catch (error) {
          console.log(
            `❌ Error: ${fixResult.error.message} - ${error.message}`
          );
        }
      }
    }

    if (manualFixes.length > 0) {
      console.log(
        `\n📝 ${manualFixes.length} fixes require manual application.`
      );
      console.log(
        'You can view the suggested fixes above and apply them manually.\n'
      );
    }

    this.currentSession.steps.push({
      type: 'fix_application',
      autoApplied: applyAutoFixes ? autoFixes.length : 0,
      manualRemaining: manualFixes.length,
      timestamp: new Date(),
    });
  }

  /**
   * Preview available fixes
   */
  async previewFixes() {
    if (!this.currentSession.fixes || this.currentSession.fixes.length === 0) {
      console.log('❌ No fixes available to preview.\n');
      return;
    }

    const { inquirer } = await import('inquirer');
    const fixResults = this.currentSession.fixes.filter((r) => r.fixResult);

    if (fixResults.length === 0) {
      console.log('❌ No fix details available to preview.\n');
      return;
    }

    const choices = fixResults.map((result, index) => ({
      name: `${index + 1}. ${result.error.message.substring(0, 60)}...`,
      value: index,
      short: `Fix ${index + 1}`,
    }));

    const { selectedFix } = await inquirer.prompt([
      {
        type: 'list',
        name: 'selectedFix',
        message: 'Select a fix to preview:',
        choices: choices,
        pageSize: 10,
      },
    ]);

    const fixResult = fixResults[selectedFix];
    const fix = fixResult.fixResult;

    console.log(`\n👁️  Fix Preview for: ${fixResult.error.message}`);
    console.log('═'.repeat(50));

    if (fix.changes && fix.changes.length > 0) {
      for (const change of fix.changes) {
        console.log(`\n📄 ${change.file}`);
        console.log('─'.repeat(30));

        if (change.type === 'replace') {
          console.log('OLD:');
          console.log(change.oldContent || '(empty)');
          console.log('\nNEW:');
          console.log(change.newContent || '(empty)');
        } else if (change.type === 'insert') {
          console.log('INSERT:');
          console.log(change.content);
        } else if (change.type === 'delete') {
          console.log('DELETE:');
          console.log(change.content);
        }
      }
    } else {
      console.log('No detailed changes available for preview.');
    }

    console.log();
  }

  /**
   * Show session summary
   */
  showSessionSummary() {
    if (!this.currentSession) {
      console.log('❌ No active session.\n');
      return;
    }

    const session = this.currentSession;
    const duration = new Date() - session.startTime;

    console.log('\n📊 Debug Session Summary:');
    console.log('═'.repeat(25));
    console.log(`Session ID: ${session.id}`);
    console.log(`Duration: ${Math.round(duration / 1000)}s`);
    console.log(`Steps Completed: ${session.steps.length}`);
    console.log(`Errors Analyzed: ${session.errors.length}`);
    console.log(`Fixes Generated: ${session.fixes.length}`);

    if (session.steps.length > 0) {
      console.log('\n📋 Session Steps:');
      session.steps.forEach((step, index) => {
        const time = step.timestamp.toLocaleTimeString();
        console.log(`  ${index + 1}. ${step.type} (${time})`);
        if (step.message) console.log(`     ${step.message}`);
        if (step.errorCount !== undefined)
          console.log(
            `     Errors: ${step.errorCount}, Fixable: ${step.fixableCount || 0}`
          );
        if (step.autoApplied !== undefined)
          console.log(
            `     Auto-applied: ${step.autoApplied}, Manual: ${step.manualRemaining || 0}`
          );
      });
    }

    console.log();
  }

  /**
   * Show session history
   */
  showSessionHistory() {
    console.log('\n📚 Debug Session History:');
    console.log('═'.repeat(25));

    if (this.sessionHistory.length === 0) {
      console.log('No previous sessions.\n');
      return;
    }

    this.sessionHistory.slice(-5).forEach((session, index) => {
      const duration = session.endTime
        ? (session.endTime - session.startTime) / 1000
        : 0;
      console.log(
        `${index + 1}. ${session.id} (${Math.round(duration)}s) - ${session.startTime.toLocaleString()}`
      );
    });

    console.log();
  }

  /**
   * Show debugging statistics
   */
  showStatistics() {
    const stats = this.workflow.getStatistics();

    console.log('\n📊 Error Recovery Statistics:');
    console.log('═'.repeat(30));
    console.log(`Total Errors Processed: ${stats.totalErrors}`);
    console.log(`Errors Recovered: ${stats.recoveredErrors}`);
    console.log(`Auto-fixed Errors: ${stats.autoFixedErrors}`);
    console.log(`Manual Interventions: ${stats.manualInterventions}`);

    if (stats.successRates && stats.successRates.size > 0) {
      console.log('\nSuccess Rates:');
      for (const [method, rate] of stats.successRates) {
        console.log(`  ${method}: ${Math.round(rate)}%`);
      }
    }

    if (stats.errorCategories && stats.errorCategories.size > 0) {
      console.log('\nError Categories:');
      for (const [category, count] of stats.errorCategories) {
        console.log(`  ${category}: ${count}`);
      }
    }

    console.log(`\nSystem Uptime: ${Math.round(stats.uptime)}s`);
    console.log(`Workflow Version: ${stats.version}\n`);
  }

  /**
   * Finalize the current session
   */
  finalizeSession() {
    if (this.currentSession) {
      this.currentSession.endTime = new Date();
      this.sessionHistory.push({ ...this.currentSession });
      this.currentSession = null;
    }
  }

  /**
   * Show help information
   */
  showHelp() {
    console.log('🐛 Debug Command Help');
    console.log('═'.repeat(25));
    console.log('Interactive error analysis and recovery tool.\n');
    console.log('Commands:');
    console.log('  /debug                    Start interactive debug session');
    console.log('  /debug start              Same as above');
    console.log('  /debug file <path>        Analyze specific file for errors');
    console.log('  /debug errors <output>    Analyze error output directly');
    console.log('  /debug fix <error-id>     Apply fix for specific error');
    console.log('  /debug history            Show debug session history');
    console.log('  /debug stats              Show error recovery statistics');
    console.log('  /debug help               Show this help message\n');
    console.log('In interactive mode:');
    console.log('  - Analyze files and error output');
    console.log('  - Generate and preview fixes');
    console.log('  - Apply fixes automatically or manually');
    console.log('  - View session summaries and statistics\n');

    return { success: true, message: 'Help displayed.' };
  }
}

// Export for use in main CLI
export default DebugCommand;
