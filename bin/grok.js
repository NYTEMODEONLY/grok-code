#!/usr/bin/env node

const { program } = require('commander');
const inquirer = require('inquirer');
const fs = require('fs-extra');
const path = require('path');
const { execSync } = require('child_process');
const OpenAI = require('openai');
const ora = require('ora');
const xml2js = require('xml2js');
const readline = require('readline');
const https = require('https');
const { promisify } = require('util');
const stream = require('stream');
const pipeline = promisify(stream.pipeline);
const os = require('os');

// Error Logging System
class ErrorLogger {
  constructor(logFile = '.grok/error.log') {
    this.logFile = path.join(process.cwd(), logFile);
    fs.ensureDirSync(path.dirname(this.logFile));
  }

  log(level, message, error = null, context = {}) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      context,
      ...(error && {
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack
        }
      })
    };

    const logLine = `[${timestamp}] ${level.toUpperCase()}: ${message}`;
    if (error) {
      console.error(logLine, error.message);
    } else {
      console.log(logLine);
    }

    try {
      fs.appendFileSync(this.logFile, JSON.stringify(logEntry) + '\n');
    } catch (logError) {
      console.error('Failed to write to error log:', logError.message);
    }
  }

  info(message, context = {}) {
    this.log('info', message, null, context);
  }

  warn(message, context = {}) {
    this.log('warn', message, null, context);
  }

  error(message, error = null, context = {}) {
    this.log('error', message, error, context);
  }

  debug(message, context = {}) {
    if (process.env.DEBUG) {
      this.log('debug', message, null, context);
    }
  }
}

const logger = new ErrorLogger();

program
  .name('grok')
  .description('Grok Code CLI')
  .version('1.0.0');

program.action(async () => {
  await main();
});

program.parse();


// Set up proper exit handling
function setupExitHandlers(rl = null) {
  let isShuttingDown = false;
  let intentionalExit = false;

  // Handle Ctrl+C
  process.on('SIGINT', () => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    logger.info('Received SIGINT, shutting down gracefully');
    console.log('\n\nExiting Grok Code...');
    try {
      if (rl && !rl.closed) {
        rl.close();
      }
    } catch (error) {
      logger.error('Error closing readline interface', error);
    }
    process.exit(0);
  });

  // Handle normal exit
  process.on('exit', (code) => {
    logger.info('Process exiting', { exitCode: code });
  });

  // Handle uncaught exceptions
  process.on('uncaughtException', (err) => {
    logger.error('Uncaught exception occurred', err, { stack: err.stack });
    if (!isShuttingDown) {
      isShuttingDown = true;
      console.error('\n💥 An unexpected error occurred. Check .grok/error.log for details.');
      try {
        if (rl && !rl.closed) {
          rl.close();
        }
      } catch (closeError) {
        // Silent fail during emergency shutdown
      }
      process.exit(1);
    }
  });

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled promise rejection', reason, { promise: promise.toString() });
    console.error('\n💥 An unhandled promise rejection occurred. Check .grok/error.log for details.');
  });
}

// GitHub Update Functions
async function checkForUpdates() {
  return new Promise((resolve) => {
    const options = {
      hostname: 'api.github.com',
      path: '/repos/NYTEMODEONLY/grok-code/releases/latest',
      headers: { 'User-Agent': 'grok-code-cli' }
    };

    const req = https.get(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const release = JSON.parse(data);
          
          // Check if the response has the expected structure
          if (!release || !release.tag_name) {
            resolve({ hasUpdate: false, error: 'No releases found on GitHub' });
            return;
          }
          
          const latestVersion = release.tag_name.replace(/^v/, '');
          const currentVersion = require('../package.json').version;
          resolve({ 
            hasUpdate: latestVersion !== currentVersion,
            currentVersion,
            latestVersion,
            downloadUrl: release.zipball_url
          });
        } catch (e) {
          resolve({ hasUpdate: false, error: e.message });
        }
      });
    });

    req.on('error', (e) => resolve({ hasUpdate: false, error: e.message }));
    req.setTimeout(5000, () => {
      req.abort();
      resolve({ hasUpdate: false, error: 'Timeout' });
    });
  });
}

async function performUpdate(downloadUrl) {
  const spinner = ora('Downloading update...').start();
  try {
    const tempDir = path.join(require('os').tmpdir(), 'grok-update');
    fs.ensureDirSync(tempDir);
    
    const zipPath = path.join(tempDir, 'update.zip');
    const writeStream = fs.createWriteStream(zipPath);
    
    await new Promise((resolve, reject) => {
      https.get(downloadUrl, (res) => {
        res.pipe(writeStream);
        writeStream.on('finish', resolve);
        writeStream.on('error', reject);
      }).on('error', reject);
    });

    spinner.text = 'Extracting update...';
    
    // Extract and replace files (simplified approach)
    execSync(`cd ${tempDir} && unzip -q update.zip`);
    const extractedDir = fs.readdirSync(tempDir).find(d => d.startsWith('NYTEMODEONLY-grok-code-'));
    const sourcePath = path.join(tempDir, extractedDir);
    
    // Get the global npm modules path for grok-code-cli
    const globalPath = execSync('npm root -g', { encoding: 'utf8' }).trim();
    const grokPath = path.join(globalPath, 'grok-code-cli');
    
    spinner.text = 'Installing update...';
    
    // Copy new files
    fs.copySync(sourcePath, grokPath, { overwrite: true });
    
    // Clean up
    fs.removeSync(tempDir);
    
    spinner.succeed('Update completed successfully! Please restart grok.');
    return true;
  } catch (error) {
    spinner.fail(`Update failed: ${error.message}`);
    return false;
  }
}

// Workspace History Functions
function getWorkspaceHistoryPath() {
  const currentDir = process.cwd();
  const grokDir = path.join(currentDir, '.grok');
  fs.ensureDirSync(grokDir);
  return path.join(grokDir, 'history.json');
}

function loadCommandHistory() {
  const historyPath = getWorkspaceHistoryPath();
  try {
    if (fs.existsSync(historyPath)) {
      const history = JSON.parse(fs.readFileSync(historyPath, 'utf8'));
      return history.commands || [];
    }
  } catch (e) {
    // If history file is corrupted, start fresh
  }
  return [];
}

function saveCommandHistory(commands) {
  const historyPath = getWorkspaceHistoryPath();
  try {
    fs.writeFileSync(historyPath, JSON.stringify({ commands }, null, 2));
  } catch (e) {
    // Silently fail if we can't save history
  }
}

function addToHistory(command, history) {
  // Don't add duplicate consecutive commands or commands that start with /
  if (command.startsWith('/') || command.toLowerCase() === 'exit') return history;
  
  if (history.length === 0 || history[history.length - 1] !== command) {
    history.push(command);
    // Keep only last 3 commands
    if (history.length > 3) {
      history.shift();
    }
  }
  return history;
}

// RPG Planning Function
function makeRPG(prompt, openai, model, existingFiles = 'none') {
  return new Promise((resolve, reject) => {
    const planningPrompt = `
You are an expert software architect. For the user prompt: '${prompt}', create a structured plan for a code repository.

Existing files in the project: ${existingFiles}

If existing files are present, consider this a modification/enhancement request rather than creating a new project from scratch. Adapt your plan to work with and extend the existing codebase.

Output ONLY a JSON object with:
- "features": Array of high-level functionalities (e.g., ["data_loading", "model_training"]).
- "files": Object mapping features to file paths (e.g., {"data_loading": "src/data.js"}).
- "flows": Array of data flow edges (e.g., [["data_loading", "model_training"]]).
- "deps": Array of dependency edges (e.g., [["data.js", "model.js"]]).
Keep it concise and modular.
    `;

    openai.chat.completions.create({
      model: model,
      messages: [
        { role: "system", content: "You are a precise code planner. Respond with valid JSON only." },
        { role: "user", content: planningPrompt }
      ],
      max_tokens: 500
    }).then(response => {
      try {
        const plan = JSON.parse(response.choices[0].message.content.trim());

        // Build simple graph as JSON (nodes + edges)
        const graph = {
          nodes: [
            ...plan.features.map(f => ({ id: f, type: 'feature' })),
            ...Object.entries(plan.files).map(([f, file]) => ({ id: file, type: 'file' }))
          ],
          edges: [
            ...Object.entries(plan.files).map(([f, file]) => ({ from: f, to: file, type: 'implements' })),
            ...plan.flows.map(([src, dst]) => ({ from: src, to: dst, type: 'data_flow' })),
            ...plan.deps.map(([src, dst]) => ({ from: src, to: dst, type: 'depends' }))
          ]
        };

        resolve({ graph, plan });
      } catch (e) {
        reject(e);
      }
    }).catch(reject);
  });
}

// RPG-Guided Code Generation
async function generateCodeWithRPG(prompt, openai, model, fileContext = {}) {
  // Step 1: Generate RPG with progress indicator
  const planSpinner = ora('🔄 Planning project structure...').start();

  // Get existing file information to provide context
  const existingFiles = Object.keys(fileContext).length > 0 ?
    Object.keys(fileContext).join(', ') : 'none';

  const rpg = await makeRPG(prompt, openai, model, existingFiles);
  const plan = rpg.plan;
  const graph = rpg.graph;
  planSpinner.succeed('📋 Project structure planned');

  // Step 2: Guide code gen with plan
  const codeSpinner = ora('⚙️ Generating code files...').start();

  // Include existing file contents for context
  const existingFileContents = Object.keys(fileContext).length > 0 ?
    '\nExisting files:\n' + Object.entries(fileContext).map(([path, content]) =>
      `=== ${path} ===\n${content}\n`
    ).join('') : '';

  const codePrompt = `
Using this repository plan:
Features: ${JSON.stringify(plan.features)}
Files: ${JSON.stringify(plan.files)}
Data Flows: ${JSON.stringify(plan.flows)}
Dependencies: ${JSON.stringify(plan.deps)}

User request: '${prompt}'

${existingFileContents}

Generate complete, modular code for the user's request.
For each file in Files, create a code block. Respect deps and flows.
If modifying existing files, ensure the new code integrates properly with the existing codebase.
Output ONLY JSON: { "files": { "path/to/file.js": "full code here", ... } }
  `;

  const response = await openai.chat.completions.create({
    model: model,
    messages: [
      { role: "system", content: "You are a precise code generator. Respond with valid JSON only." },
      { role: "user", content: codePrompt }
    ],
    max_tokens: 2000
  });

  const codeOutput = JSON.parse(response.choices[0].message.content.trim());
  codeSpinner.succeed('✨ Code generation complete');

  // Write files to disk with progress
  const writeSpinner = ora('📁 Writing files to disk...').start();
  const fileCount = Object.keys(codeOutput.files).length;
  let filesWritten = 0;
  
  Object.entries(codeOutput.files).forEach(([filepath, code]) => {
    fs.ensureDirSync(path.dirname(filepath));
    fs.writeFileSync(filepath, code);
    filesWritten++;
    writeSpinner.text = `📁 Writing files to disk... (${filesWritten}/${fileCount})`;
  });
  
  writeSpinner.succeed(`✅ Generated ${fileCount} files successfully`);
  return codeOutput;
}

async function main() {
  logger.info('Starting Grok Code CLI');

  // Set up exit handlers first
  setupExitHandlers();

  const configDir = path.join(process.env.HOME || process.env.USERPROFILE, '.grok');
  const keyFile = path.join(configDir, 'api_key');
  const modelFile = path.join(configDir, 'model');

  try {
    fs.ensureDirSync(configDir);
  } catch (error) {
    logger.error('Failed to create config directory', error, { configDir });
    console.error('❌ Failed to create configuration directory. Check permissions.');
    process.exit(1);
  }

  let apiKey = process.env.XAI_API_KEY;
  if (!apiKey) {
    if (fs.existsSync(keyFile)) {
      apiKey = fs.readFileSync(keyFile, 'utf8').trim();
      const answers = await inquirer.prompt([
        {
          type: 'list',
          name: 'choice',
          message: 'Found saved API key. What would you like to do?',
          choices: ['Use existing key', 'Change key', 'Delete key']
        }
      ]);
      const choice = answers.choice;
      if (choice === 'Change key') {
        const keyAnswers = await inquirer.prompt([{ type: 'input', name: 'key', message: 'Enter new xAI API key:' }]);
        apiKey = keyAnswers.key.trim();
        fs.writeFileSync(keyFile, apiKey);
      } else if (choice === 'Delete key') {
        fs.unlinkSync(keyFile);
        apiKey = null;
      }
    }
    if (!apiKey) {
      const keyAnswers = await inquirer.prompt([{ type: 'input', name: 'key', message: 'Enter your xAI API key:' }]);
      apiKey = keyAnswers.key.trim();
      fs.writeFileSync(keyFile, apiKey);
    }
  }

  const client = new OpenAI({
    baseURL: 'https://api.x.ai/v1',
    apiKey
  });

  // Model configuration
  let model = process.env.GROK_MODEL || 'grok-code-fast-1'; // Default to grok-code-fast-1 (optimized for coding)
  if (fs.existsSync(modelFile)) {
    const savedModel = fs.readFileSync(modelFile, 'utf8').trim();
    if (savedModel) {
      model = savedModel;
    }
  }

  const currentDateTime = new Date().toISOString().slice(0, 19).replace('T', ' ');
  const currentOS = process.platform === 'darwin' ? 'macOS' : process.platform === 'win32' ? 'Windows' : 'Linux';
  const currentDir = process.cwd();
  const fileList = fs.readdirSync(currentDir);
  let grokMdContent = '';
  const grokMdPath = path.join(currentDir, 'GROK.md');
  if (fs.existsSync(grokMdPath)) {
    grokMdContent = fs.readFileSync(grokMdPath, 'utf8');
  }

  const systemPrompt = `You are Grok, a helpful AI built by xAI, acting as a CLI-based coding assistant like Claude Code.
Current date and time: ${currentDateTime}
Running on: ${currentOS}
Current working directory: ${currentDir}
Files in directory: ${fileList.join(', ')}
Project config (GROK.md): ${grokMdContent}

Focus on coding tasks: write, debug, explain, optimize code, and manage files. Be agentic: think step-by-step, plan multi-file edits, automate tasks like testing, linting, debugging. Be concise, use markdown for code blocks.

CRITICAL: When users ask for ANY code-related tasks (create, add, modify, update, build, fix, improve, etc.), ALWAYS generate or modify code using <edit> tags. Even for simple requests like "add a button" or "create a function", provide working code solutions.

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
Always plan actions, confirm before assuming applied, and suggest next steps like testing or deployment.

BE PROACTIVE: If a user asks to modify, create, or work with code in ANY way, assume they want you to generate the actual code changes, not just explain how to do it.`;

  let messages = [{ role: 'system', content: systemPrompt }];
  let fileContext = {};

  // Automatic codebase scanning on start
  const essentialFiles = ['package.json', 'README.md', 'GROK.md'];
  essentialFiles.forEach(f => {
    const filePath = path.join(currentDir, f);
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8');
      fileContext[f] = content;
      messages.push({ role: 'system', content: `Auto-added essential file ${f}:\n${content}` });
    }
  });
  console.log('Auto-scanned essential files for initial context.');

  // Check for updates on startup (non-blocking)
  checkForUpdates().then(updateCheck => {
    if (updateCheck.hasUpdate) {
      console.log(`\n🔄 Update available! Current: v${updateCheck.currentVersion} → Latest: v${updateCheck.latestVersion}`);
      console.log("Type '/update' to update to the latest version.\n");
    }
    // Only show error if it's not the common "no releases" case
    else if (updateCheck.error && !updateCheck.error.includes('No releases found')) {
      console.log(`\n⚠️  Could not check for updates: ${updateCheck.error}\n`);
    }
  }).catch(() => {
    // Silently fail on startup update check
  });


  // Load command history for this workspace
  let commandHistory = loadCommandHistory();

  console.log("Welcome to Grok Code! Type your message or use /help for commands. Type 'exit' or '/exit' to quit.\n");

  // Create persistent readline interface for arrow key history
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    history: [...commandHistory].reverse() // Most recent first for up arrow
  });

  // Update exit handlers with readline reference
  setupExitHandlers(rl);

  while (true) {
    let userInput;

    try {
      userInput = await new Promise((resolve, reject) => {
        rl.question('You: ', (answer) => {
          resolve(answer.trim());
        });

        // Add timeout to prevent hanging
        setTimeout(() => {
          reject(new Error('Readline timeout'));
        }, 30000); // 30 second timeout
      });
    } catch (error) {
      logger.warn('Error reading user input', { error: error.message });
      userInput = '';
    }

    if (userInput.toLowerCase() === '/exit' || userInput.toLowerCase() === 'exit') {
      logger.info('User requested exit');
      console.log("Exiting Grok Code. Happy coding!");
      // Force immediate exit to prevent hanging
      setImmediate(() => process.exit(0));
      return; // Don't continue processing
    }

    try {
      const handled = await handleCommand(userInput, messages, fileContext, client, model);
      if (handled) continue;
    } catch (error) {
      logger.error('Error handling command', error, { userInput });
      console.error('❌ Error processing command. Check .grok/error.log for details.');
      continue;
    }

    // Add command to history and save
    commandHistory = addToHistory(userInput, commandHistory);
    saveCommandHistory(commandHistory);
    
    // Update readline history
    rl.history = [...commandHistory].reverse();

    // Check if prompt should use RPG planning - comprehensive detection
    const shouldUseRPG = userInput.toLowerCase().includes('generate repo') ||
                         userInput.toLowerCase().includes('build') ||
                         userInput.toLowerCase().includes('create a') ||
                         userInput.toLowerCase().includes('implement a') ||
                         userInput.toLowerCase().includes('develop a') ||
                         userInput.toLowerCase().includes('add ') ||
                         userInput.toLowerCase().includes('make ') ||
                         userInput.toLowerCase().includes('modify ') ||
                         userInput.toLowerCase().includes('update') ||
                         userInput.toLowerCase().includes('change ') ||
                         userInput.toLowerCase().includes('fix ') ||
                         userInput.toLowerCase().includes('improve ') ||
                         userInput.toLowerCase().includes('enhance ') ||
                         userInput.toLowerCase().includes('extend ') ||
                         // Additional code-related patterns
                         userInput.toLowerCase().includes('write code') ||
                         userInput.toLowerCase().includes('code for') ||
                         userInput.toLowerCase().includes('create ') && userInput.toLowerCase().includes('function') ||
                         userInput.toLowerCase().includes('create ') && userInput.toLowerCase().includes('component') ||
                         userInput.toLowerCase().includes('create ') && userInput.toLowerCase().includes('class') ||
                         userInput.toLowerCase().includes('generate ') && userInput.toLowerCase().includes('code') ||
                         userInput.toLowerCase().includes('implement ') && userInput.toLowerCase().includes('feature') ||
                         userInput.toLowerCase().includes('add ') && userInput.toLowerCase().includes('feature') ||
                         userInput.toLowerCase().includes('create ') && userInput.toLowerCase().includes('file') ||
                         userInput.toLowerCase().includes('new ') && userInput.toLowerCase().includes('file');

    if (shouldUseRPG) {
      logger.info('RPG mode triggered', { userInput, existingFiles: Object.keys(fileContext) });
      try {
        await generateCodeWithRPG(userInput, client, model, fileContext);
        continue;
      } catch (error) {
        logger.error('RPG generation failed, falling back to regular chat', error, { userInput });
        const errorSpinner = ora().start();
        errorSpinner.fail("Generation failed, falling back to regular chat...");
        // Continue to regular chat flow
      }
    } else {
      logger.debug('Using regular chat mode', { userInput });
    }

    messages.push({ role: 'user', content: userInput });

    if (Object.keys(fileContext).length > 0) {
      const contextStr = Object.entries(fileContext).map(([f, c]) => `File ${f}:\n${c}`).join('\n');
      messages.push({ role: 'system', content: `Current file context:\n${contextStr}` });
    }

    const spinner = ora('Thinking').start();

    try {
      logger.debug('Making API request', { model, messageCount: messages.length });

      const response = await client.chat.completions.create({
        model,
        messages,
        max_tokens: 4096,
        temperature: 0.7
      });

      spinner.stop();

      const grokResponse = response.choices[0].message.content;
      console.log(`\nGrok: ${grokResponse}\n`);

      logger.info('Received API response', { responseLength: grokResponse.length });

      await parseAndApplyActions(grokResponse, messages, fileContext);

      messages.push({ role: 'assistant', content: grokResponse });

      if (Object.keys(fileContext).length > 0) {
        messages.splice(messages.length - 2, 1);  // Remove temp context
      }
    } catch (error) {
      spinner.stop();
      logger.error('API request failed', error, {
        model,
        lastMessage: messages[messages.length - 1]?.content?.substring(0, 100)
      });
      console.error("❌ API request failed. Check your connection and API key.");
      console.log("💡 Try again or check .grok/error.log for details.");
    }
  }
}

async function handleCommand(input, messages, fileContext, client, model) {
  if (input.startsWith('/add ')) {
    const filename = input.split(' ').slice(1).join(' ');
    if (fs.existsSync(filename)) {
      const content = fs.readFileSync(filename, 'utf8');
      fileContext[filename] = content;
      messages.push({ role: 'system', content: `File ${filename} added to context:\n${content}` });
      console.log(`Added ${filename} to context.`);
    } else {
      console.log(`File ${filename} not found.`);
    }
    return true;
  } else if (input.startsWith('/remove ')) {
    const filename = input.split(' ').slice(1).join(' ');
    if (filename in fileContext) {
      delete fileContext[filename];
      messages.push({ role: 'system', content: `File ${filename} removed from context.` });
      console.log(`Removed ${filename} from context.`);
    } else {
      console.log(`File ${filename} not in context.`);
    }
    return true;
  } else if (input === '/scan') {
    const files = fs.readdirSync('.').filter(f => fs.statSync(f).isFile() && !f.startsWith('.'));
    files.forEach(f => {
      const content = fs.readFileSync(f, 'utf8');
      fileContext[f] = content;
      messages.push({ role: 'system', content: `File ${f} added to context:\n${content}` });
    });
    console.log(`Scanned and added ${files.length} files to context.`);
    return true;
  } else if (input === '/ls') {
    const files = fs.readdirSync('.');
    console.log("Files in current directory:");
    files.forEach(f => console.log(`- ${f}`));
    return true;
  } else if (input === '/model') {
    const availableModels = [
      'grok-code-fast-1',        // Optimized for coding, fast & cost-effective (default)
      'grok-4-fast-reasoning',   // Best for complex reasoning (RPG planning), 2M context
      'grok-4-fast-non-reasoning', // Fast for simple tasks, 2M context
      'grok-3-beta',             // Legacy: Most capable, balanced performance
      'grok-3-mini-beta',        // Legacy: Faster, lower cost
      'grok-beta'                // Legacy: Original model
    ];

    const modelAnswers = await inquirer.prompt([
      {
        type: 'list',
        name: 'selectedModel',
        message: `Current model: ${model}. Select a new model:`,
        choices: availableModels.map(m => ({
          name: `${m}${m === model ? ' (current)' : ''}`,
          value: m
        }))
      }
    ]);

    const newModel = modelAnswers.selectedModel;
    if (newModel !== model) {
      fs.writeFileSync(modelFile, newModel);
      model = newModel;
      console.log(`Model changed to: ${model}`);
      messages.push({ role: 'system', content: `Model changed to: ${model}` });
    } else {
      console.log(`Model remains: ${model}`);
    }
    return true;
  } else if (input === '/help') {
    console.log(`Commands:
- /add <file>: Add file to context
- /remove <file>: Remove file from context
- /scan: Scan and add all files to context
- /ls: List files in directory
- /model: Change AI model (grok-code-fast-1, grok-4-fast-reasoning, grok-4-fast-non-reasoning, etc.)
- /update or update: Check for and install updates from GitHub
- /run <cmd>: Run shell command
- /git <command>: Run git command (e.g., /git status)
- /init-git: Initialize git repo
- /commit <message>: Commit changes
- /push: Push to remote
- /pr <title>: Create a pull request (requires gh CLI)
- /logs: View recent error logs
- /clear: Clear conversation history
- exit or /exit: Quit
- Custom: /<custom_name> for user-defined in .grok/commands/

🔧 Workspace Features:
- Command history: Shows your last 3 commands at each prompt
- Auto-update check: Notifies you of new versions on startup
- Error logging: Automatic logging to .grok/error.log
- Smart code generation: Automatically detects requests like "build", "add", "update", "make", etc. and generates code
`);
    return true;
  } else if (input.startsWith('/run ')) {
    const cmd = input.split(' ').slice(1).join(' ');
    try {
      const result = execSync(cmd, { encoding: 'utf8' });
      console.log(result);
      messages.push({ role: 'system', content: `Run command '${cmd}' output:\n${result}` });
    } catch (e) {
      console.log(`Error: ${e.stderr}`);
      messages.push({ role: 'system', content: `Run command '${cmd}' error:\n${e.stderr}` });
    }
    return true;
  } else if (input.startsWith('/git ')) {
    const cmd = input.split(' ').slice(1).join(' ');
    try {
      const result = execSync(`git ${cmd}`, { encoding: 'utf8' });
      console.log(result);
      messages.push({ role: 'system', content: `Git command '${cmd}' output:\n${result}` });
    } catch (e) {
      console.log(`Error: ${e.stderr}`);
      messages.push({ role: 'system', content: `Git command '${cmd}' error:\n${e.stderr}` });
    }
    return true;
  } else if (input === '/init-git') {
    try {
      const result = execSync('git init', { encoding: 'utf8' });
      console.log(result);
      messages.push({ role: 'system', content: `Git init output:\n${result}` });
    } catch (e) {
      console.log(`Error: ${e.stderr}`);
    }
    return true;
  } else if (input.startsWith('/commit ')) {
    const message = input.split(' ').slice(1).join(' ');
    try {
      execSync('git add .');
      const result = execSync(`git commit -m "${message}"`, { encoding: 'utf8' });
      console.log(result);
      messages.push({ role: 'system', content: `Git commit output:\n${result}` });
    } catch (e) {
      console.log(`Error: ${e.stderr}`);
    }
    return true;
  } else if (input.startsWith('/pr ')) {
    const title = input.split(' ').slice(1).join(' ');
    try {
      const body = 'Auto-generated by Grok Code';  // Could prompt for body or generate via AI
      const result = execSync(`gh pr create --title "${title}" --body "${body}"`, { encoding: 'utf8' });
      console.log(result);
      messages.push({ role: 'system', content: `PR created: ${result}` });
    } catch (e) {
      console.log(`Error: Install gh CLI or check setup. ${e.stderr}`);
    }
    return true;
  } else if (input === '/push') {
    try {
      const result = execSync('git push', { encoding: 'utf8' });
      console.log(result);
      messages.push({ role: 'system', content: `Git push output:\n${result}` });
    } catch (e) {
      console.log(`Error: ${e.stderr}`);
    }
    return true;
  } else if (input === '/logs') {
    try {
      const logFile = path.join(process.cwd(), '.grok/error.log');
      if (fs.existsSync(logFile)) {
        const logs = fs.readFileSync(logFile, 'utf8');
        const lines = logs.split('\n').filter(line => line.trim());
        const recentLogs = lines.slice(-20); // Show last 20 entries

        console.log('\n📋 Recent Error Logs (last 20 entries):');
        console.log('=' .repeat(50));
        recentLogs.forEach((line, index) => {
          try {
            const entry = JSON.parse(line);
            const time = new Date(entry.timestamp).toLocaleString();
            console.log(`${index + 1}. [${time}] ${entry.level.toUpperCase()}: ${entry.message}`);
            if (entry.error) {
              console.log(`   Error: ${entry.error.message}`);
            }
          } catch (parseError) {
            console.log(`${index + 1}. ${line}`);
          }
        });
        console.log('=' .repeat(50));
        console.log(`Full logs available at: ${logFile}`);
      } else {
        console.log('📋 No error logs found. Logs will be created when errors occur.');
      }
    } catch (error) {
      console.log(`❌ Error reading logs: ${error.message}`);
    }
    return true;
  } else if (input === '/clear') {
    messages = [{ role: 'system', content: systemPrompt }];
    fileContext = {};
    console.clear();
    console.log("Welcome to Grok Code! Type your message or use /help for commands. Type 'exit' or '/exit' to quit.\n");
    return true;
  } else if (input === '/update' || input.toLowerCase() === 'update') {
    console.log('Checking for updates...');
    const updateCheck = await checkForUpdates();
    if (updateCheck.hasUpdate) {
      console.log(`🔄 Update available! Current: v${updateCheck.currentVersion} → Latest: v${updateCheck.latestVersion}`);
      const updateAnswers = await inquirer.prompt([{
        type: 'confirm',
        name: 'confirm',
        message: 'Would you like to update now?'
      }]);
      if (updateAnswers.confirm) {
        const success = await performUpdate(updateCheck.downloadUrl);
        if (success) {
          process.exit(0); // Exit after successful update
        }
      }
    } else if (updateCheck.error) {
      console.log(`❌ Could not check for updates: ${updateCheck.error}`);
    } else {
      console.log(`✅ You're already running the latest version (v${updateCheck.currentVersion})`);
    }
    return true;
  } else if (input.startsWith('/')) {
    const cmdName = input.slice(1).split(' ')[0];
    const cmdDir = path.join(currentDir, '.grok/commands');
    const cmdPath = path.join(cmdDir, `${cmdName}.txt`);
    if (fs.existsSync(cmdPath)) {
      const prompt = fs.readFileSync(cmdPath, 'utf8').trim();
      // Process as user input
      messages.push({ role: 'user', content: prompt });
      // Then trigger API call (similar to main loop)
      const spinner = ora('Thinking').start();
      try {
        const response = await client.chat.completions.create({
          model,
          messages,
          max_tokens: 4096,
          temperature: 0.7
        });
        spinner.stop();
        const grokResponse = response.choices[0].message.content;
        console.log(`\nGrok: ${grokResponse}\n`);
        await parseAndApplyActions(grokResponse, messages, fileContext);
        messages.push({ role: 'assistant', content: grokResponse });
      } catch (error) {
        spinner.stop();
        console.error("API error:", error);
      }
      return true;
    } else {
      console.log(`Custom command /${cmdName} not found in .grok/commands.`);
      return true;
    }
  }
  return false;
}

async function parseAndApplyActions(responseText, messages, fileContext) {
  try {
    logger.debug('Parsing and applying actions', { responseLength: responseText.length });

    const parser = new xml2js.Parser({ explicitArray: false });

    // Pre-process responseText to escape unescaped ampersands in command attributes
    let processedText = responseText.replace(/<run command="([^"]*)">/g, (match, commandAttr) => {
      // Escape unescaped ampersands in command attributes
      const escapedCommand = commandAttr.replace(/&(?!(?:amp|lt|gt|quot|apos);)/g, '&amp;');
      return `<run command="${escapedCommand}">`;
    });

    const edits = processedText.match(/<edit[^>]*>[\s\S]*?<\/edit>/g) || [];
    const deletes = processedText.match(/<delete[^>]*><\/delete>/g) || [];
    const runs = processedText.match(/<run[^>]*><\/run>/g) || [];

    if (edits.length === 0 && deletes.length === 0 && runs.length === 0) {
      logger.debug('No actions found in response');
      return;
    }

    console.log("\nProposed actions:");
    for (const run of runs) {
      const parsed = await parser.parseStringPromise(run);
      console.log(`Run command: ${parsed.run.$.command.replace(/&amp;/g, '&')}`);
    }
    for (const edit of edits) {
      const parsed = await parser.parseStringPromise(edit);
      console.log(`Edit/Create file: ${parsed.edit.$.file}`);
    }
    for (const del of deletes) {
      const parsed = await parser.parseStringPromise(del);
      console.log(`Delete file: ${parsed.delete.$.file}`);
    }

    // Use safer prompt handling
    let answers;
    try {
      answers = await inquirer.prompt([{ type: 'confirm', name: 'confirm', message: 'Apply these actions?' }]);
    } catch (promptError) {
      logger.error('Error with confirmation prompt', promptError);
      console.log("❌ Error with confirmation prompt. Actions not applied.");
      return;
    }

    if (!answers.confirm) {
      logger.info('User declined to apply actions');
      console.log("Actions not applied.");
      return;
    }

    logger.info('User confirmed actions', { runs: runs.length, edits: edits.length, deletes: deletes.length });

    // Apply runs first
    for (const run of runs) {
      try {
        const parsed = await parser.parseStringPromise(run);
        const cmd = parsed.run.$.command.replace(/&amp;/g, '&'); // Unescape ampersands back for execution

        logger.debug('Executing command', { command: cmd });

        try {
          const result = execSync(cmd, { encoding: 'utf8', timeout: 10000 }); // 10 second timeout
          console.log(`Command '${cmd}' output:\n${result}`);
          messages.push({ role: 'system', content: `Command '${cmd}' output:\n${result}` });
          logger.info('Command executed successfully', { command: cmd, outputLength: result.length });
        } catch (execError) {
          logger.warn('Command execution failed', { command: cmd, error: execError.message });
          console.log(`Error executing '${cmd}': ${execError.stderr || execError.message}`);
          messages.push({ role: 'system', content: `Command '${cmd}' error:\n${execError.stderr || execError.message}` });
        }
      } catch (parseError) {
        logger.error('Failed to parse run command', parseError, { runTag: run });
        console.log(`❌ Failed to parse command: ${parseError.message}`);
      }
    }

    // Apply edits
    for (const edit of edits) {
      try {
        const parsed = await parser.parseStringPromise(edit);
        const filename = parsed.edit.$.file;
        const content = parsed.edit._;  // Assuming CDATA is handled as text

        logger.debug('Applying file edit', { filename });

        try {
          fs.ensureDirSync(path.dirname(filename));
          fs.writeFileSync(filename, content);
          console.log(`✅ Saved ${filename}.`);
          fileContext[filename] = content;
          logger.info('File saved successfully', { filename, contentLength: content.length });
        } catch (fileError) {
          logger.error('Failed to save file', fileError, { filename });
          console.log(`❌ Failed to save ${filename}: ${fileError.message}`);
        }
      } catch (parseError) {
        logger.error('Failed to parse edit command', parseError, { editTag: edit });
        console.log(`❌ Failed to parse edit: ${parseError.message}`);
      }
    }

    // Apply deletes
    for (const del of deletes) {
      try {
        const parsed = await parser.parseStringPromise(del);
        const filename = parsed.delete.$.file;

        logger.debug('Applying file deletion', { filename });

        if (fs.existsSync(filename)) {
          try {
            fs.unlinkSync(filename);
            console.log(`🗑️  Deleted ${filename}.`);
            delete fileContext[filename];
            logger.info('File deleted successfully', { filename });
          } catch (deleteError) {
            logger.error('Failed to delete file', deleteError, { filename });
            console.log(`❌ Failed to delete ${filename}: ${deleteError.message}`);
          }
        } else {
          logger.warn('File not found for deletion', { filename });
          console.log(`⚠️  File ${filename} not found for deletion.`);
        }
      } catch (parseError) {
        logger.error('Failed to parse delete command', parseError, { deleteTag: del });
        console.log(`❌ Failed to parse delete: ${parseError.message}`);
      }
    }

    try {
      const updatedFiles = fs.readdirSync('.');
      messages.push({ role: 'system', content: `Actions applied. Updated files in directory: ${updatedFiles.join(', ')}` });
      logger.info('All actions completed successfully');
    } catch (fsError) {
      logger.error('Failed to read directory after actions', fsError);
    }

  } catch (error) {
    logger.error('Critical error in parseAndApplyActions', error, { responseText: responseText.substring(0, 500) });
    console.log(`💥 Critical error processing actions. Check .grok/error.log for details.`);
  }
}