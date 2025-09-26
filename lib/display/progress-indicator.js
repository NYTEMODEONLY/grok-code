import ora from 'ora';
import { logger } from '../utils/logger.js';

/**
 * Progress Indicator System for Terminal Operations
 * Provides spinners, progress bars, and status displays for long-running operations
 */
export class ProgressIndicator {
  constructor(options = {}) {
    this.theme = options.theme || 'default';
    this.showTime = options.showTime !== false;
    this.spinnerStyle = options.spinnerStyle || 'dots';

    // Active indicators
    this.activeSpinners = new Map();
    this.activeProgressBars = new Map();

    // Spinner configurations for different operation types
    this.spinnerConfigs = {
      default: {
        analyzing: { text: 'Analyzing code...', spinner: 'dots' },
        generating: { text: 'Generating code...', spinner: 'dots2' },
        processing: { text: 'Processing files...', spinner: 'line' },
        loading: { text: 'Loading...', spinner: 'bouncingBar' },
        saving: { text: 'Saving files...', spinner: 'arrow3' },
        searching: { text: 'Searching...', spinner: 'dots3' },
        parsing: { text: 'Parsing...', spinner: 'binary' },
        validating: { text: 'Validating...', spinner: 'squareCorners' },
        compiling: { text: 'Compiling...', spinner: 'triangle' },
        testing: { text: 'Running tests...', spinner: 'circleQuarters' },
        deploying: { text: 'Deploying...', spinner: 'moon' },
      },
      minimal: {
        analyzing: { text: 'Analyzing...', spinner: 'line' },
        generating: { text: 'Generating...', spinner: 'dots' },
        processing: { text: 'Processing...', spinner: 'pipe' },
        loading: { text: 'Loading...', spinner: 'bouncingBar' },
        saving: { text: 'Saving...', spinner: 'arrow' },
        searching: { text: 'Searching...', spinner: 'dots' },
        parsing: { text: 'Parsing...', spinner: 'binary' },
        validating: { text: 'Validating...', spinner: 'squareCorners' },
        compiling: { text: 'Compiling...', spinner: 'triangle' },
        testing: { text: 'Testing...', spinner: 'circleQuarters' },
        deploying: { text: 'Deploying...', spinner: 'moon' },
      }
    };

    // Success/failure indicators
    this.indicators = {
      success: '✅',
      error: '❌',
      warning: '⚠️',
      info: 'ℹ️',
      pending: '⏳',
      completed: '✅',
      failed: '❌',
      skipped: '⏭️',
    };

    logger.info('Progress indicator system initialized', { theme: this.theme });
  }

  /**
   * Start a spinner for an ongoing operation
   * @param {string} operation - Operation type (analyzing, generating, etc.)
   * @param {string} customText - Custom text (optional)
   * @param {string} id - Unique identifier for the spinner
   * @returns {object} Spinner instance
   */
  startSpinner(operation, customText = null, id = null) {
    const spinnerId = id || `spinner_${Date.now()}_${Math.random()}`;
    const config = this.spinnerConfigs[this.theme]?.[operation] || this.spinnerConfigs.default[operation];

    if (!config) {
      logger.warn('Unknown operation type for spinner', { operation });
      return null;
    }

    const text = customText || config.text;
    const spinner = ora({
      text,
      spinner: config.spinner,
      color: 'cyan',
    }).start();

    this.activeSpinners.set(spinnerId, {
      spinner,
      operation,
      startTime: Date.now(),
      text,
    });

    logger.debug('Started spinner', { id: spinnerId, operation, text });
    return { id: spinnerId, spinner };
  }

  /**
   * Update spinner text
   * @param {string} id - Spinner ID
   * @param {string} text - New text
   */
  updateSpinner(id, text) {
    const spinnerData = this.activeSpinners.get(id);
    if (spinnerData) {
      spinnerData.spinner.text = text;
      spinnerData.text = text;
      logger.debug('Updated spinner text', { id, text });
    }
  }

  /**
   * Stop a spinner with success
   * @param {string} id - Spinner ID
   * @param {string} message - Success message
   */
  succeedSpinner(id, message = null) {
    const spinnerData = this.activeSpinners.get(id);
    if (spinnerData) {
      const duration = this.showTime ? this.formatDuration(Date.now() - spinnerData.startTime) : '';
      const successMessage = message || `${spinnerData.text.replace('...', '')} completed${duration}`;
      spinnerData.spinner.succeed(successMessage);
      this.activeSpinners.delete(id);
      logger.debug('Spinner succeeded', { id, message: successMessage });
    }
  }

  /**
   * Stop a spinner with failure
   * @param {string} id - Spinner ID
   * @param {string} message - Error message
   */
  failSpinner(id, message = null) {
    const spinnerData = this.activeSpinners.get(id);
    if (spinnerData) {
      const errorMessage = message || `${spinnerData.operation} failed`;
      spinnerData.spinner.fail(errorMessage);
      this.activeSpinners.delete(id);
      logger.debug('Spinner failed', { id, message: errorMessage });
    }
  }

  /**
   * Stop a spinner with warning
   * @param {string} id - Spinner ID
   * @param {string} message - Warning message
   */
  warnSpinner(id, message = null) {
    const spinnerData = this.activeSpinners.get(id);
    if (spinnerData) {
      const warningMessage = message || `${spinnerData.operation} completed with warnings`;
      spinnerData.spinner.warn(warningMessage);
      this.activeSpinners.delete(id);
      logger.debug('Spinner warned', { id, message: warningMessage });
    }
  }

  /**
   * Stop a spinner with info
   * @param {string} id - Spinner ID
   * @param {string} message - Info message
   */
  infoSpinner(id, message = null) {
    const spinnerData = this.activeSpinners.get(id);
    if (spinnerData) {
      const infoMessage = message || `${spinnerData.operation} info`;
      spinnerData.spinner.info(infoMessage);
      this.activeSpinners.delete(id);
      logger.debug('Spinner info', { id, message: infoMessage });
    }
  }

  /**
   * Create a progress bar for quantifiable operations
   * @param {number} total - Total items to process
   * @param {string} text - Progress bar text
   * @param {string} id - Unique identifier
   * @returns {object} Progress bar instance
   */
  createProgressBar(total, text = 'Processing...', id = null) {
    const progressId = id || `progress_${Date.now()}_${Math.random()}`;

    // Simple text-based progress bar (since ora doesn't support progress bars)
    const progressBar = {
      total,
      current: 0,
      text,
      startTime: Date.now(),
      update: (current, newText = null) => {
        progressBar.current = current;
        if (newText) progressBar.text = newText;
        progressBar.render();
      },
      increment: (amount = 1) => {
        progressBar.current += amount;
        progressBar.render();
      },
      render: () => {
        const percentage = Math.round((progressBar.current / progressBar.total) * 100);
        const filled = Math.round((progressBar.current / progressBar.total) * 20);
        const bar = '█'.repeat(filled) + '░'.repeat(20 - filled);
        const duration = this.showTime ? this.formatDuration(Date.now() - progressBar.startTime) : '';

        console.log(`\r${progressBar.text} [${bar}] ${percentage}% (${progressBar.current}/${progressBar.total})${duration}`);
      },
      complete: (message = 'Completed') => {
        const duration = this.showTime ? this.formatDuration(Date.now() - progressBar.startTime) : '';
        console.log(`\r${message} ✅${duration}\n`);
        this.activeProgressBars.delete(progressId);
      },
      fail: (message = 'Failed') => {
        console.log(`\r${message} ❌\n`);
        this.activeProgressBars.delete(progressId);
      }
    };

    this.activeProgressBars.set(progressId, progressBar);
    logger.debug('Created progress bar', { id: progressId, total, text });

    return { id: progressId, progressBar };
  }

  /**
   * Show multi-step operation progress
   * @param {Array} steps - Array of step objects {name, operation, duration?}
   * @param {string} title - Overall operation title
   * @returns {object} Multi-step progress instance
   */
  showMultiStepProgress(steps, title = 'Operation Progress') {
    console.log(`\n${title}\n${'═'.repeat(title.length)}\n`);

    const multiStep = {
      steps,
      currentStep: 0,
      spinners: [],

      next: (customText = null) => {
        if (multiStep.currentStep < steps.length) {
          const step = steps[multiStep.currentStep];
          const spinner = multiStep.spinners[multiStep.currentStep] ||
            this.startSpinner(step.operation, customText || step.name);
          multiStep.spinners[multiStep.currentStep] = spinner;
          multiStep.currentStep++;
          return spinner;
        }
        return null;
      },

      complete: (message = null) => {
        // Stop all active spinners
        multiStep.spinners.forEach((spinnerData, index) => {
          if (spinnerData) {
            const step = steps[index];
            const stepMessage = message || `${step.name} completed`;
            this.succeedSpinner(spinnerData.id, stepMessage);
          }
        });
        multiStep.spinners = [];
      },

      fail: (stepIndex, message = null) => {
        if (stepIndex < multiStep.spinners.length && multiStep.spinners[stepIndex]) {
          const step = steps[stepIndex];
          const stepMessage = message || `${step.name} failed`;
          this.failSpinner(multiStep.spinners[stepIndex].id, stepMessage);
        }
      }
    };

    logger.debug('Created multi-step progress', { title, stepCount: steps.length });
    return multiStep;
  }

  /**
   * Show status with indicators
   * @param {string} type - Status type (success, error, warning, info, pending)
   * @param {string} message - Status message
   * @param {object} data - Additional data to display
   */
  showStatus(type, message, data = null) {
    const indicator = this.indicators[type] || this.indicators.info;
    let statusMessage = `${indicator} ${message}`;

    if (data) {
      if (typeof data === 'object') {
        const dataStr = Object.entries(data)
          .map(([key, value]) => `${key}: ${value}`)
          .join(', ');
        statusMessage += ` (${dataStr})`;
      } else {
        statusMessage += ` (${data})`;
      }
    }

    console.log(statusMessage);

    if (type === 'error') {
      logger.error('Status error displayed', { message, data });
    } else {
      logger.debug('Status displayed', { type, message, data });
    }
  }

  /**
   * Show operation summary
   * @param {object} summary - Summary data
   */
  showSummary(summary) {
    console.log('\n📊 Operation Summary');
    console.log('═'.repeat(20));

    Object.entries(summary).forEach(([key, value]) => {
      if (typeof value === 'object' && value !== null) {
        console.log(`${key}:`);
        Object.entries(value).forEach(([subKey, subValue]) => {
          console.log(`  ${subKey}: ${subValue}`);
        });
      } else {
        console.log(`${key}: ${value}`);
      }
    });

    console.log();
  }

  /**
   * Format duration for display
   * @param {number} milliseconds - Duration in milliseconds
   * @returns {string} Formatted duration
   */
  formatDuration(milliseconds) {
    if (milliseconds < 1000) {
      return ` (${milliseconds}ms)`;
    } else if (milliseconds < 60000) {
      return ` (${(milliseconds / 1000).toFixed(1)}s)`;
    } else {
      const minutes = Math.floor(milliseconds / 60000);
      const seconds = ((milliseconds % 60000) / 1000).toFixed(1);
      return ` (${minutes}m ${seconds}s)`;
    }
  }

  /**
   * Clean up all active indicators
   */
  cleanup() {
    // Stop all active spinners
    this.activeSpinners.forEach((spinnerData, id) => {
      spinnerData.spinner.stop();
      logger.debug('Cleaned up spinner', { id });
    });
    this.activeSpinners.clear();

    // Clear progress bars
    this.activeProgressBars.clear();

    logger.info('Progress indicator system cleaned up');
  }

  /**
   * Get system statistics
   * @returns {object} Statistics
   */
  getStats() {
    return {
      activeSpinners: this.activeSpinners.size,
      activeProgressBars: this.activeProgressBars.size,
      theme: this.theme,
      showTime: this.showTime,
    };
  }

  /**
   * Test progress indicators
   * @param {string} type - Test type
   */
  async testIndicators(type = 'all') {
    console.log('\n🧪 Testing Progress Indicators...\n');

    if (type === 'all' || type === 'spinner') {
      console.log('Testing Spinners:');
      const spinner = this.startSpinner('analyzing', 'Testing spinner...');
      await this.delay(2000);
      this.succeedSpinner(spinner.id, 'Spinner test completed');

      const failSpinner = this.startSpinner('processing', 'Testing failure...');
      await this.delay(1500);
      this.failSpinner(failSpinner.id, 'Spinner test failed');
    }

    if (type === 'all' || type === 'multistep') {
      console.log('\nTesting Multi-Step Progress:');
      const steps = [
        { name: 'Initializing', operation: 'loading' },
        { name: 'Processing data', operation: 'processing' },
        { name: 'Validating results', operation: 'validating' },
        { name: 'Finalizing', operation: 'saving' },
      ];

      const multiStep = this.showMultiStepProgress(steps, 'Multi-Step Test');

      for (let i = 0; i < steps.length; i++) {
        const spinner = multiStep.next();
        await this.delay(1000);
        this.succeedSpinner(spinner.id);
      }

      console.log('✅ Multi-step test completed');
    }

    if (type === 'all' || type === 'status') {
      console.log('\nTesting Status Indicators:');
      this.showStatus('success', 'Operation completed successfully');
      this.showStatus('error', 'An error occurred', { code: 'E001' });
      this.showStatus('warning', 'Warning message');
      this.showStatus('info', 'Information message');
      this.showStatus('pending', 'Operation in progress');
    }

    if (type === 'all' || type === 'summary') {
      console.log('\nTesting Summary Display:');
      const summary = {
        totalFiles: 15,
        processed: 12,
        skipped: 2,
        errors: 1,
        duration: '2.5s',
        stats: {
          success: '80%',
          warnings: '13%',
          errors: '7%'
        }
      };
      this.showSummary(summary);
    }

    console.log('🎉 Progress indicator tests completed!');
  }

  /**
   * Utility delay function for testing
   * @param {number} ms - Milliseconds to delay
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
