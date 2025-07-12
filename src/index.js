const inquirer = require('inquirer');
const path = require('path');
const fs = require('fs-extra');
const config = require('./core/config');
const GrokClient = require('./core/client');
const CommandManager = require('./commands/manager');
const display = require('./ui/display');

class GrokCodeApp {
  constructor() {
    this.client = null;
    this.commandManager = new CommandManager();
    this.messages = [];
    this.fileContext = {};
    this.sessionStartTime = Date.now();
  }

  async initialize() {
    try {
      // Show welcome banner
      display.showWelcome();

      // Check and setup API key
      await this.setupApiKey();

      // Initialize Grok client
      this.client = new GrokClient();

      // Test connection
      await this.testConnection();

      // Load project context
      await this.loadProjectContext();

      // Start session tracking
      this.startSessionTracking();

      return true;
    } catch (error) {
      display.showError(error, 'Initialization failed');
      return false;
    }
  }

  async setupApiKey() {
    let apiKey = config.getApiKey();
    
    if (!apiKey) {
      display.info('Welcome to Grok Code! Let\'s get you set up.');
      
      const answers = await inquirer.prompt([
        {
          type: 'input',
          name: 'apiKey',
          message: 'Enter your xAI API key:',
          validate: (input) => {
            if (!input.trim()) {
              return 'API key is required';
            }
            return true;
          }
        }
      ]);
      
      apiKey = answers.apiKey.trim();
      config.setApiKey(apiKey);
      display.success('API key saved successfully!');
    } else {
      const answers = await inquirer.prompt([
        {
          type: 'list',
          name: 'choice',
          message: 'Found saved API key. What would you like to do?',
          choices: ['Use existing key', 'Change key', 'Delete key']
        }
      ]);

      if (answers.choice === 'Change key') {
        const keyAnswers = await inquirer.prompt([
          {
            type: 'input',
            name: 'apiKey',
            message: 'Enter new xAI API key:',
            validate: (input) => {
              if (!input.trim()) {
                return 'API key is required';
              }
              return true;
            }
          }
        ]);
        
        apiKey = keyAnswers.apiKey.trim();
        config.setApiKey(apiKey);
        display.success('API key updated successfully!');
      } else if (answers.choice === 'Delete key') {
        config.setApiKey('');
        display.info('API key deleted. Please restart the application.');
        process.exit(0);
      }
    }
  }

  async testConnection() {
    display.info('Testing connection to xAI...');
    
    try {
      const result = await this.client.testConnection();
      
      if (result.success) {
        display.success(`Connected successfully! Response time: ${result.responseTime}ms`);
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      display.error(`Connection test failed: ${error.message}`);
      throw error;
    }
  }

  async loadProjectContext() {
    const currentDir = process.cwd();
    const grokMdPath = path.join(currentDir, 'GROK.md');
    
    if (fs.existsSync(grokMdPath)) {
      const grokMdContent = fs.readFileSync(grokMdPath, 'utf8');
      this.messages.push({
        role: 'system',
        content: `Project configuration (GROK.md):\n${grokMdContent}`
      });
      display.info('Loaded project configuration from GROK.md');
    }

    // Add current directory context
    const fileList = fs.readdirSync(currentDir);
    this.messages.push({
      role: 'system',
      content: `Current working directory: ${currentDir}\nFiles in directory: ${fileList.join(', ')}`
    });
  }

  startSessionTracking() {
    // Update session statistics
    if (config.isAnalyticsEnabled()) {
      config.updateStatistics({
        sessionStart: true
      });
    }
  }

  async run() {
    display.info('Type your message or use /help for commands. Type /exit to quit.\n');

    while (true) {
      try {
        const answers = await inquirer.prompt([
          {
            type: 'input',
            name: 'input',
            message: 'You:',
            prefix: ''
          }
        ]);

        const userInput = answers.input.trim();

        if (!userInput) continue;

        // Handle commands
        if (userInput.startsWith('/')) {
          const result = await this.commandManager.executeCommand(userInput, this.messages, this.fileContext, this.client);
          
          if (result && result.exit) {
            await this.shutdown();
            break;
          }
          
          if (result && result.clearHistory) {
            this.messages = [{ role: 'system', content: this.getSystemPrompt() }];
            continue;
          }
          
          continue;
        }

        // Handle regular user input
        await this.handleUserInput(userInput);

      } catch (error) {
        display.showError(error, 'Error processing input');
      }
    }
  }

  async handleUserInput(userInput) {
    // Add user message
    this.messages.push({ role: 'user', content: userInput });

    // Add file context if available
    if (Object.keys(this.fileContext).length > 0) {
      const contextStr = Object.entries(this.fileContext)
        .map(([f, c]) => `File ${f}:\n${c}`)
        .join('\n');
      this.messages.push({ role: 'system', content: `Current file context:\n${contextStr}` });
    }

    try {
      // Send message to Grok
      const response = await this.client.sendMessageWithRetry(this.messages);
      
      console.log(`\nGrok: ${response.content}\n`);

      // Parse and apply actions
      await this.commandManager.parseAndApplyActions(response.content, this.messages, this.fileContext);

      // Add assistant response
      this.messages.push({ role: 'assistant', content: response.content });

      // Remove temporary context
      if (Object.keys(this.fileContext).length > 0) {
        this.messages.splice(this.messages.length - 2, 1);
      }

    } catch (error) {
      display.showError(error, 'Failed to get response from Grok');
      
      // Remove the failed user message
      this.messages.pop();
    }
  }

  getSystemPrompt() {
    const currentDateTime = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const currentOS = process.platform === 'darwin' ? 'macOS' : process.platform === 'win32' ? 'Windows' : 'Linux';
    const currentDir = process.cwd();

    return `You are Grok, a helpful AI built by xAI, acting as a CLI-based coding assistant like Claude Code. 
Current date and time: ${currentDateTime}
Running on: ${currentOS}
Current working directory: ${currentDir}

Focus on coding tasks: write, debug, explain, optimize code, and manage files. Be agentic: think step-by-step, plan multi-file edits, automate tasks like testing, linting, debugging. Be concise, use markdown for code blocks.
For full projects like Next.js sites, generate all necessary files with multiple <edit> tags, ensuring deploy-ready for Vercel (e.g., app structure, package.json, etc.). Suggest <run> for npm install, tests, etc.
You have access to the current working directory. Users can add files to context with /add <file> or /scan to auto-add relevant files.
To propose file edits or creations (multiple allowed), use this exact XML format:
<edit file="filename.ext">
<![CDATA[
# Full content of the file here
]]>
</edit>
For deletions: <delete file="filename.ext"></delete>
To propose shell commands (e.g., git, npm install, tests; multiple allowed), use:
<run command="full shell command here"></run>
Adapt commands to OS (${currentOS}).
The tool will parse, propose, and apply/run if user confirms. Propose <run> before <edit> if needed (e.g., mkdir before writing to subdir). For debugging, propose <run> to test and iterate on errors.
For GitHub: propose sequences like git add ., git commit, git push; ask for repo URL if needed. Support PR creation via <run> if gh cli installed.
Custom commands: Users can define in .grok/commands/cmd_name.txt with prompts; invoke with /cmd_name.
Always plan actions, confirm before assuming applied, and suggest next steps like testing or deployment.`;
  }

  async shutdown() {
    try {
      // Get final session stats
      const sessionStats = this.commandManager.getSessionStats();
      const clientStats = this.client.getSessionStats();
      
      // Update final statistics
      if (config.isAnalyticsEnabled()) {
        config.updateStatistics({
          sessionStart: true,
          duration: Date.now() - this.sessionStartTime,
          filesCreated: sessionStats.filesCreated,
          filesEdited: sessionStats.filesEdited,
          commandsExecuted: sessionStats.commandsExecuted,
          requests: clientStats.requests,
          tokens: clientStats.tokens,
          responseTime: clientStats.avgResponseTime
        });
      }

      // Show final session summary
      display.showSessionSummary({
        duration: Date.now() - this.sessionStartTime,
        requests: clientStats.requests,
        tokens: clientStats.tokens,
        filesCreated: sessionStats.filesCreated,
        filesEdited: sessionStats.filesEdited,
        commandsExecuted: sessionStats.commandsExecuted,
        avgResponseTime: clientStats.avgResponseTime
      });

      display.success('Thank you for using Grok Code! Happy coding! 🚀');
      
    } catch (error) {
      display.error(`Error during shutdown: ${error.message}`);
    }
  }
}

// Main entry point
async function main() {
  const app = new GrokCodeApp();
  
  try {
    const initialized = await app.initialize();
    if (initialized) {
      await app.run();
    } else {
      process.exit(1);
    }
  } catch (error) {
    display.showError(error, 'Application failed to start');
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n');
  display.info('Received interrupt signal. Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n');
  display.info('Received termination signal. Shutting down gracefully...');
  process.exit(0);
});

// Export for testing
module.exports = GrokCodeApp;

// Run if this is the main module
if (require.main === module) {
  main();
}