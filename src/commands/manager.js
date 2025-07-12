const fs = require('fs-extra');
const path = require('path');
const { execSync } = require('child_process');
const config = require('../core/config');
const display = require('../ui/display');
const StatsCommand = require('./stats');

class CommandManager {
  constructor() {
    this.commands = new Map();
    this.sessionStats = {
      filesCreated: 0,
      filesEdited: 0,
      commandsExecuted: 0,
      startTime: Date.now()
    };
    
    this.registerBuiltInCommands();
  }

  registerBuiltInCommands() {
    // Register built-in commands
    this.registerCommand('stats', StatsCommand);
    this.registerCommand('help', {
      name: 'help',
      description: 'Show help menu',
      execute: () => display.showHelp()
    });
    this.registerCommand('config', {
      name: 'config',
      description: 'Show current configuration',
      execute: () => display.showConfiguration()
    });
    this.registerCommand('clear', {
      name: 'clear',
      description: 'Clear conversation history',
      execute: () => {
        display.clear();
        display.showWelcome();
        return { clearHistory: true };
      }
    });
    this.registerCommand('exit', {
      name: 'exit',
      description: 'Exit Grok Code',
      execute: () => {
        this.endSession();
        return { exit: true };
      }
    });
  }

  registerCommand(name, command) {
    this.commands.set(name, command);
  }

  async executeCommand(input, messages, fileContext, client) {
    const parts = input.trim().split(' ');
    const commandName = parts[0].slice(1); // Remove leading '/'
    const args = parts.slice(1);

    // Update session stats
    this.sessionStats.commandsExecuted++;

    // Check for built-in commands first
    if (this.commands.has(commandName)) {
      const command = this.commands.get(commandName);
      try {
        const result = await command.execute(args, messages, fileContext, client);
        return result;
      } catch (error) {
        display.error(`Error executing command /${commandName}: ${error.message}`);
        return { error: true };
      }
    }

    // Handle file operations
    if (commandName === 'add') {
      return await this.handleAddFile(args, fileContext, messages);
    } else if (commandName === 'remove') {
      return await this.handleRemoveFile(args, fileContext, messages);
    } else if (commandName === 'scan') {
      return await this.handleScanFiles(fileContext, messages);
    } else if (commandName === 'ls') {
      return await this.handleListFiles();
    }

    // Handle git operations
    if (commandName === 'git') {
      return await this.handleGitCommand(args);
    } else if (commandName === 'init-git') {
      return await this.handleInitGit();
    } else if (commandName === 'commit') {
      return await this.handleCommit(args);
    } else if (commandName === 'push') {
      return await this.handlePush();
    }

    // Handle shell operations
    if (commandName === 'run') {
      return await this.handleRunCommand(args);
    }

    // Handle custom commands
    if (commandName.startsWith('/')) {
      return await this.handleCustomCommand(commandName.slice(1), args, messages, fileContext, client);
    }

    // Unknown command
    display.warning(`Unknown command: /${commandName}`);
    display.info('Type /help for available commands');
    return { error: true };
  }

  async handleAddFile(args, fileContext, messages) {
    if (args.length === 0) {
      display.error('Please specify a file to add');
      return { error: true };
    }

    const filename = args.join(' ');
    if (fs.existsSync(filename)) {
      const content = fs.readFileSync(filename, 'utf8');
      fileContext[filename] = content;
      messages.push({ role: 'system', content: `File ${filename} added to context:\n${content}` });
      display.success(`Added ${filename} to context`);
      return { success: true };
    } else {
      display.error(`File ${filename} not found`);
      return { error: true };
    }
  }

  async handleRemoveFile(args, fileContext, messages) {
    if (args.length === 0) {
      display.error('Please specify a file to remove');
      return { error: true };
    }

    const filename = args.join(' ');
    if (filename in fileContext) {
      delete fileContext[filename];
      messages.push({ role: 'system', content: `File ${filename} removed from context.` });
      display.success(`Removed ${filename} from context`);
      return { success: true };
    } else {
      display.error(`File ${filename} not in context`);
      return { error: true };
    }
  }

  async handleScanFiles(fileContext, messages) {
    const files = fs.readdirSync('.').filter(f => {
      const stat = fs.statSync(f);
      return stat.isFile() && !f.startsWith('.') && !f.includes('node_modules');
    });

    let addedCount = 0;
    files.forEach(f => {
      try {
        const content = fs.readFileSync(f, 'utf8');
        fileContext[f] = content;
        messages.push({ role: 'system', content: `File ${f} added to context:\n${content}` });
        addedCount++;
      } catch (error) {
        display.warning(`Could not read file ${f}: ${error.message}`);
      }
    });

    display.success(`Scanned and added ${addedCount} files to context`);
    return { success: true, filesAdded: addedCount };
  }

  async handleListFiles() {
    const files = fs.readdirSync('.');
    const fileStats = files.map(f => {
      const stat = fs.statSync(f);
      return {
        name: f,
        type: stat.isDirectory() ? 'dir' : 'file',
        size: stat.size,
        modified: stat.mtime
      };
    });

    display.showFileList(fileStats);
    return { success: true };
  }

  async handleGitCommand(args) {
    if (args.length === 0) {
      display.error('Please specify a git command');
      return { error: true };
    }

    const cmd = args.join(' ');
    try {
      const result = execSync(`git ${cmd}`, { encoding: 'utf8' });
      display.showCommandExecution(`git ${cmd}`, result);
      return { success: true, output: result };
    } catch (e) {
      display.showCommandExecution(`git ${cmd}`, null, e.stderr);
      return { error: true, output: e.stderr };
    }
  }

  async handleInitGit() {
    try {
      const result = execSync('git init', { encoding: 'utf8' });
      display.showCommandExecution('git init', result);
      return { success: true, output: result };
    } catch (e) {
      display.showCommandExecution('git init', null, e.stderr);
      return { error: true, output: e.stderr };
    }
  }

  async handleCommit(args) {
    if (args.length === 0) {
      display.error('Please provide a commit message');
      return { error: true };
    }

    const message = args.join(' ');
    try {
      execSync('git add .');
      const result = execSync(`git commit -m "${message}"`, { encoding: 'utf8' });
      display.showCommandExecution(`git commit -m "${message}"`, result);
      return { success: true, output: result };
    } catch (e) {
      display.showCommandExecution(`git commit -m "${message}"`, null, e.stderr);
      return { error: true, output: e.stderr };
    }
  }

  async handlePush() {
    try {
      const result = execSync('git push', { encoding: 'utf8' });
      display.showCommandExecution('git push', result);
      return { success: true, output: result };
    } catch (e) {
      display.showCommandExecution('git push', null, e.stderr);
      return { error: true, output: e.stderr };
    }
  }

  async handleRunCommand(args) {
    if (args.length === 0) {
      display.error('Please specify a command to run');
      return { error: true };
    }

    const cmd = args.join(' ');
    try {
      const result = execSync(cmd, { encoding: 'utf8' });
      display.showCommandExecution(cmd, result);
      return { success: true, output: result };
    } catch (e) {
      display.showCommandExecution(cmd, null, e.stderr);
      return { error: true, output: e.stderr };
    }
  }

  async handleCustomCommand(cmdName, args, messages, fileContext, client) {
    const cmdDir = path.join(process.cwd(), '.grok/commands');
    const cmdPath = path.join(cmdDir, `${cmdName}.txt`);
    
    if (fs.existsSync(cmdPath)) {
      const prompt = fs.readFileSync(cmdPath, 'utf8').trim();
      
      // Process as user input
      messages.push({ role: 'user', content: prompt });
      
      // Trigger API call
      try {
        const response = await client.sendMessage(messages);
        console.log(`\nGrok: ${response.content}\n`);
        
        // Parse and apply actions
        await this.parseAndApplyActions(response.content, messages, fileContext);
        
        messages.push({ role: 'assistant', content: response.content });
        return { success: true };
      } catch (error) {
        display.error(`API error: ${error.message}`);
        return { error: true };
      }
    } else {
      display.error(`Custom command /${cmdName} not found in .grok/commands/`);
      return { error: true };
    }
  }

  async parseAndApplyActions(responseText, messages, fileContext) {
    const xml2js = require('xml2js');
    const parser = new xml2js.Parser({ explicitArray: false });
    
    const edits = responseText.match(/<edit[^>]*>[\s\S]*?<\/edit>/g) || [];
    const deletes = responseText.match(/<delete[^>]*><\/delete>/g) || [];
    const runs = responseText.match(/<run[^>]*><\/run>/g) || [];

    if (edits.length === 0 && deletes.length === 0 && runs.length === 0) return;

    const operations = [];
    
    // Parse operations
    for (const run of runs) {
      const parsed = await parser.parseStringPromise(run);
      operations.push({ type: 'run', command: parsed.run.$.command });
    }
    
    for (const edit of edits) {
      const parsed = await parser.parseStringPromise(edit);
      operations.push({ type: 'edit', file: parsed.edit.$.file, content: parsed.edit._ });
    }
    
    for (const del of deletes) {
      const parsed = await parser.parseStringPromise(del);
      operations.push({ type: 'delete', file: parsed.delete.$.file });
    }

    // Show proposed actions
    display.showProposedActions(operations);

    // Get user confirmation
    const inquirer = require('inquirer');
    const answers = await inquirer.prompt([
      { type: 'confirm', name: 'confirm', message: 'Apply these actions?' }
    ]);

    if (!answers.confirm) {
      display.info('Actions not applied.');
      return;
    }

    // Apply operations
    const results = [];
    
    // Apply runs first
    for (const op of operations.filter(o => o.type === 'run')) {
      try {
        const result = execSync(op.command, { encoding: 'utf8' });
        results.push({ type: 'run', command: op.command, success: true, output: result });
        messages.push({ role: 'system', content: `Command '${op.command}' output:\n${result}` });
      } catch (e) {
        results.push({ type: 'run', command: op.command, success: false, error: e.stderr });
        messages.push({ role: 'system', content: `Command '${op.command}' error:\n${e.stderr}` });
      }
    }

    // Apply edits
    for (const op of operations.filter(o => o.type === 'edit')) {
      try {
        fs.ensureDirSync(path.dirname(op.file));
        fs.writeFileSync(op.file, op.content);
        results.push({ type: 'edit', file: op.file, success: true });
        fileContext[op.file] = op.content;
        
        // Update session stats
        if (fs.existsSync(op.file)) {
          this.sessionStats.filesEdited++;
        } else {
          this.sessionStats.filesCreated++;
        }
      } catch (error) {
        results.push({ type: 'edit', file: op.file, success: false, error: error.message });
      }
    }

    // Apply deletes
    for (const op of operations.filter(o => o.type === 'delete')) {
      try {
        if (fs.existsSync(op.file)) {
          fs.unlinkSync(op.file);
          results.push({ type: 'delete', file: op.file, success: true });
          delete fileContext[op.file];
        } else {
          results.push({ type: 'delete', file: op.file, success: false, error: 'File not found' });
        }
      } catch (error) {
        results.push({ type: 'delete', file: op.file, success: false, error: error.message });
      }
    }

    // Show results
    display.showFileOperations(results);

    // Update global statistics
    if (config.isAnalyticsEnabled()) {
      const filesCreated = results.filter(r => r.type === 'edit' && r.success && !fs.existsSync(r.file)).length;
      const filesEdited = results.filter(r => r.type === 'edit' && r.success && fs.existsSync(r.file)).length;
      
      config.updateStatistics({
        filesCreated: filesCreated,
        filesEdited: filesEdited
      });
    }
  }

  endSession() {
    const duration = Date.now() - this.sessionStats.startTime;
    
    // Update session statistics
    if (config.isAnalyticsEnabled()) {
      config.updateStatistics({
        sessionStart: true,
        duration: duration,
        filesCreated: this.sessionStats.filesCreated,
        filesEdited: this.sessionStats.filesEdited,
        commandsExecuted: this.sessionStats.commandsExecuted
      });
    }

    // Show session summary
    display.showSessionSummary({
      duration: duration,
      requests: 0, // Will be updated by client
      tokens: 0,   // Will be updated by client
      filesCreated: this.sessionStats.filesCreated,
      filesEdited: this.sessionStats.filesEdited,
      commandsExecuted: this.sessionStats.commandsExecuted,
      avgResponseTime: 0 // Will be updated by client
    });
  }

  getSessionStats() {
    return this.sessionStats;
  }
}

module.exports = CommandManager;