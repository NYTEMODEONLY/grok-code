const chalk = require('chalk');
const figlet = require('figlet');
const Table = require('cli-table3');
const moment = require('moment');
const config = require('../core/config');

class Display {
  constructor() {
    this.theme = config.getTheme();
    this.showProgressBars = config.getPreference('showProgressBars');
  }

  // Welcome Banner
  showWelcome() {
    console.clear();
    console.log(chalk.cyan(figlet.textSync('Grok Code', { font: 'Standard' })));
    console.log(chalk.gray('Your AI-powered coding assistant in the terminal\n'));
    
    const stats = config.getStatistics();
    if (stats.totalSessions > 0) {
      console.log(chalk.yellow(`Welcome back! You've used Grok Code ${stats.totalSessions} times before.`));
      if (stats.lastUsed) {
        const lastUsed = moment(stats.lastUsed).fromNow();
        console.log(chalk.gray(`Last used: ${lastUsed}`));
      }
    }
    console.log('');
  }

  // Statistics Display
  showStatistics() {
    const stats = config.getStatistics();
    
    console.log(chalk.cyan.bold('\n📊 GROK CODE STATISTICS\n'));
    
    // Overall Statistics
    const overallTable = new Table({
      head: [chalk.cyan('Metric'), chalk.cyan('Value')],
      colWidths: [25, 20]
    });

    overallTable.push(
      ['Total Sessions', chalk.green(stats.totalSessions)],
      ['Total Requests', chalk.green(stats.totalRequests.toLocaleString())],
      ['Total Tokens Used', chalk.green(stats.totalTokensUsed.toLocaleString())],
      ['Files Created', chalk.green(stats.totalFilesCreated)],
      ['Files Edited', chalk.green(stats.totalFilesEdited)],
      ['Commands Executed', chalk.green(stats.totalCommandsExecuted)],
      ['Avg Response Time', chalk.green(`${stats.averageResponseTime.toFixed(2)}ms`)]
    );

    console.log(overallTable.toString());

    // Recent Activity
    if (stats.sessionHistory && stats.sessionHistory.length > 0) {
      console.log(chalk.cyan.bold('\n🕒 RECENT SESSIONS\n'));
      
      const recentTable = new Table({
        head: [chalk.cyan('Date'), chalk.cyan('Duration'), chalk.cyan('Requests'), chalk.cyan('Tokens')],
        colWidths: [20, 15, 15, 15]
      });

      const recentSessions = stats.sessionHistory.slice(-5).reverse();
      recentSessions.forEach(session => {
        const date = moment(session.start).format('MMM DD, HH:mm');
        const duration = session.duration ? `${Math.round(session.duration / 60)}m` : 'N/A';
        recentTable.push([
          date,
          duration,
          session.requests || 0,
          session.tokens || 0
        ]);
      });

      console.log(recentTable.toString());
    }

    // Daily Usage Chart
    this.showDailyUsageChart(stats.dailyUsage);
  }

  showDailyUsageChart(dailyUsage) {
    if (!dailyUsage || Object.keys(dailyUsage).length === 0) return;

    console.log(chalk.cyan.bold('\n📈 DAILY USAGE (Last 7 Days)\n'));

    const dates = Object.keys(dailyUsage).sort().slice(-7);
    const maxRequests = Math.max(...dates.map(date => dailyUsage[date].requests));

    dates.forEach(date => {
      const dayData = dailyUsage[date];
      const dateStr = moment(date).format('MMM DD');
      const requests = dayData.requests;
      const barLength = maxRequests > 0 ? Math.round((requests / maxRequests) * 20) : 0;
      const bar = '█'.repeat(barLength) + '░'.repeat(20 - barLength);
      
      console.log(`${chalk.gray(dateStr)} ${bar} ${chalk.green(requests)} requests`);
    });
  }

  // Progress Bar
  showProgress(text, progress = 0) {
    if (!this.showProgressBars) return;
    
    const barLength = 30;
    const filledLength = Math.round(barLength * progress);
    const bar = '█'.repeat(filledLength) + '░'.repeat(barLength - filledLength);
    const percentage = Math.round(progress * 100);
    
    process.stdout.write(`\r${chalk.cyan(text)} [${bar}] ${percentage}%`);
    
    if (progress >= 1) {
      process.stdout.write('\n');
    }
  }

  // Status Messages
  success(message) {
    console.log(chalk.green(`✅ ${message}`));
  }

  error(message) {
    console.log(chalk.red(`❌ ${message}`));
  }

  warning(message) {
    console.log(chalk.yellow(`⚠️  ${message}`));
  }

  info(message) {
    console.log(chalk.blue(`ℹ️  ${message}`));
  }

  // File Operations Display
  showFileOperations(operations) {
    console.log(chalk.cyan.bold('\n📁 FILE OPERATIONS\n'));
    
    const table = new Table({
      head: [chalk.cyan('Operation'), chalk.cyan('File'), chalk.cyan('Status')],
      colWidths: [15, 40, 15]
    });

    operations.forEach(op => {
      const status = op.success ? chalk.green('✓ Success') : chalk.red('✗ Failed');
      table.push([op.type, op.file || op.command, status]);
    });

    console.log(table.toString());
  }

  // Show proposed actions
  showProposedActions(operations) {
    console.log(chalk.cyan.bold('\n🔧 PROPOSED ACTIONS\n'));
    
    operations.forEach((op, index) => {
      if (op.type === 'run') {
        console.log(`${index + 1}. Run command: ${chalk.yellow(op.command)}`);
      } else if (op.type === 'edit') {
        console.log(`${index + 1}. Edit/Create file: ${chalk.yellow(op.file)}`);
      } else if (op.type === 'delete') {
        console.log(`${index + 1}. Delete file: ${chalk.red(op.file)}`);
      }
    });
  }

  // Show file list
  showFileList(fileStats) {
    console.log(chalk.cyan.bold('\n📂 FILES IN DIRECTORY\n'));
    
    const table = new Table({
      head: [chalk.cyan('Name'), chalk.cyan('Type'), chalk.cyan('Size'), chalk.cyan('Modified')],
      colWidths: [30, 10, 15, 20]
    });

    fileStats.forEach(file => {
      const type = file.type === 'dir' ? chalk.blue('📁 dir') : chalk.green('📄 file');
      const size = file.type === 'dir' ? '-' : this.formatFileSize(file.size);
      const modified = moment(file.modified).format('MMM DD, HH:mm');
      
      table.push([file.name, type, size, modified]);
    });

    console.log(table.toString());
  }

  // Format file size
  formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  // Command Execution Display
  showCommandExecution(command, output, error = null) {
    console.log(chalk.cyan.bold(`\n💻 EXECUTING: ${command}\n`));
    
    if (error) {
      console.log(chalk.red('Error:'));
      console.log(chalk.red(error));
    } else {
      console.log(chalk.green('Output:'));
      console.log(output);
    }
  }

  // Session Summary
  showSessionSummary(sessionData) {
    console.log(chalk.cyan.bold('\n🎯 SESSION SUMMARY\n'));
    
    const table = new Table({
      head: [chalk.cyan('Metric'), chalk.cyan('Value')],
      colWidths: [25, 20]
    });

    table.push(
      ['Duration', `${Math.round(sessionData.duration / 60)} minutes`],
      ['Requests Made', sessionData.requests],
      ['Tokens Used', sessionData.tokens.toLocaleString()],
      ['Files Created', sessionData.filesCreated],
      ['Files Edited', sessionData.filesEdited],
      ['Commands Executed', sessionData.commandsExecuted],
      ['Average Response', `${sessionData.avgResponseTime.toFixed(2)}ms`]
    );

    console.log(table.toString());
  }

  // Help Menu
  showHelp() {
    console.log(chalk.cyan.bold('\n🆘 GROK CODE HELP\n'));
    
    const helpTable = new Table({
      head: [chalk.cyan('Command'), chalk.cyan('Description')],
      colWidths: [20, 60]
    });

    helpTable.push(
      ['/help', 'Show this help menu'],
      ['/stats', 'Display usage statistics'],
      ['/config', 'Show current configuration'],
      ['/theme <name>', 'Change UI theme'],
      ['/clear', 'Clear conversation history'],
      ['/exit', 'Exit Grok Code'],
      ['', ''],
      ['File Operations:', ''],
      ['/add <file>', 'Add file to context'],
      ['/remove <file>', 'Remove file from context'],
      ['/scan', 'Scan and add all files to context'],
      ['/ls', 'List files in directory'],
      ['', ''],
      ['Git Operations:', ''],
      ['/git <command>', 'Run git command'],
      ['/init-git', 'Initialize git repository'],
      ['/commit <msg>', 'Commit changes'],
      ['/push', 'Push to remote'],
      ['', ''],
      ['Shell Operations:', ''],
      ['/run <cmd>', 'Run shell command'],
      ['', ''],
      ['Custom Commands:', ''],
      ['/<name>', 'Run custom command from .grok/commands/']
    );

    console.log(helpTable.toString());
  }

  // Configuration Display
  showConfiguration() {
    console.log(chalk.cyan.bold('\n⚙️  CURRENT CONFIGURATION\n'));
    
    const configTable = new Table({
      head: [chalk.cyan('Setting'), chalk.cyan('Value')],
      colWidths: [25, 40]
    });

    configTable.push(
      ['Model', config.getModel()],
      ['Max Tokens', config.getMaxTokens()],
      ['Temperature', config.getTemperature()],
      ['Theme', config.getTheme()],
      ['Analytics', config.isAnalyticsEnabled() ? 'Enabled' : 'Disabled'],
      ['Auto Save', config.getPreference('autoSave') ? 'Enabled' : 'Disabled'],
      ['Default Language', config.getPreference('defaultLanguage')],
      ['Max Context Files', config.getPreference('maxContextFiles')]
    );

    console.log(configTable.toString());
  }

  // Thinking Animation
  showThinking(text = 'Thinking') {
    const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    let i = 0;
    
    const interval = setInterval(() => {
      process.stdout.write(`\r${chalk.cyan(frames[i])} ${text}`);
      i = (i + 1) % frames.length;
    }, 80);

    return {
      stop: () => {
        clearInterval(interval);
        process.stdout.write('\r' + ' '.repeat(text.length + 2) + '\r');
      }
    };
  }

  // Loading Bar
  showLoading(text, duration = 2000) {
    return new Promise(resolve => {
      const startTime = Date.now();
      const interval = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        this.showProgress(text, progress);
        
        if (progress >= 1) {
          clearInterval(interval);
          resolve();
        }
      }, 50);
    });
  }

  // Error Display
  showError(error, context = '') {
    console.log(chalk.red.bold('\n💥 ERROR OCCURRED\n'));
    
    if (context) {
      console.log(chalk.yellow(`Context: ${context}`));
    }
    
    console.log(chalk.red('Error Details:'));
    console.log(chalk.red(error.message || error));
    
    if (error.stack && process.env.NODE_ENV === 'development') {
      console.log(chalk.gray('\nStack Trace:'));
      console.log(chalk.gray(error.stack));
    }
  }

  // Success Display
  showSuccess(title, details = []) {
    console.log(chalk.green.bold(`\n🎉 ${title}\n`));
    
    if (details.length > 0) {
      details.forEach(detail => {
        console.log(chalk.green(`  • ${detail}`));
      });
    }
  }

  // Separator
  separator() {
    console.log(chalk.gray('─'.repeat(80)));
  }

  // Clear Screen
  clear() {
    console.clear();
  }
}

module.exports = new Display();