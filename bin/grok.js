#!/usr/bin/env node

// Built by nytemode

import { program } from 'commander';
import inquirer from 'inquirer';
import fs from 'fs-extra';
import path from 'path';
import { execSync } from 'child_process';
import OpenAI from 'openai';
import ora from 'ora';
import xml2js from 'xml2js';
import https from 'https';
import os from 'os';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { fileSuggester } from '../lib/context/file-suggester.js';
import { autoContextBuilder } from '../lib/context/auto-context.js';
import { tokenManager } from '../lib/context/token-manager.js';
import { SyntaxHighlighter } from '../lib/display/syntax-highlighter.js';
import { DiffViewer } from '../lib/display/diff-viewer.js';
import { ProgressIndicator } from '../lib/display/progress-indicator.js';
import { FileBrowser } from '../lib/interactive/file-browser.js';
import { CodePreview } from '../lib/display/code-preview.js';
import { CodeSearch } from '../lib/interactive/code-search.js';
import { ErrorRecoveryWorkflow } from '../lib/workflows/error-recovery.js';
import { DebugCommand } from './commands/debug.js';
import { ErrorStats } from '../lib/analytics/error-stats.js';
import { AutoComplete } from '../lib/commands/auto-complete.js';
import { HistorySearch } from '../lib/commands/history-search.js';
import { ContextualSuggestions } from '../lib/commands/suggestions.js';
import { WorkflowDiagram } from '../lib/visualization/workflow-diagram.js';
import { ProgressTracker } from '../lib/visualization/progress-tracker.js';
import { ConfirmDialog } from '../lib/interactive/confirm-dialog.js';

/**
 * Error Logging System
 * Manages logging to a file and console.
 */

/**
 * Process and highlight code blocks in text
 * @param {string} text - Text containing code blocks
 * @param {SyntaxHighlighter} highlighter - Syntax highlighter instance
 * @returns {string} Text with highlighted code blocks
 */
function processCodeBlocks(text, highlighter) {
  // Match code blocks with optional language specification
  // ```language\ncode\n```
  const codeBlockRegex = /```(\w+)?\n?([\s\S]*?)```/g;

  return text.replace(codeBlockRegex, (match, language, code) => {
    if (!code.trim()) return match; // Skip empty code blocks

    const detectedLang = language || highlighter.detectLanguage(code);
    const highlighted = highlighter.highlight(code, detectedLang);

    // Return the highlighted code in the same format
    return `\`\`\`${detectedLang}\n${highlighted}\`\`\``;
  });
}
class ErrorLogger {
  /**
   * Creates an instance of ErrorLogger.
   * @param {string} [logFile='.grok/error.log'] - Path to the error log file.
   */
  constructor(logFile = '.grok/error.log') {
    this.logFile = path.join(process.cwd(), logFile);
    fs.ensureDirSync(path.dirname(this.logFile));
  }

  /**
   * Logs an entry to the error log file.
   * @param {string} level - Log level (e.g., 'info', 'warn', 'error', 'debug').
   * @param {string} message - The message to log.
   * @param {Error|null} error - The error object (if applicable).
   * @param {Object} context - Additional context for the log entry.
   */
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
          stack: error.stack,
        },
      }),
    };

    // Only console for errors; suppress info/warn/debug for clean UX
    if (level === 'error') {
      const logLine = `[${timestamp}] ${level.toUpperCase()}: ${message}`;
      console.error(logLine, error ? error.message : '');
    } else if (level === 'warn') {
      // Optional: console.warn for warnings if needed, but suppress for minimalism
      // console.warn(`[${timestamp}] WARN: ${message}`);
    }
    // Info and debug: silent on console

    try {
      fs.appendFileSync(this.logFile, JSON.stringify(logEntry) + '\n');
    } catch (logError) {
      // Fallback if file write fails
      if (level === 'error') {
        console.error('Failed to write to error log:', logError.message);
      }
    }
  }

  /**
   * Logs an informational message.
   * @param {string} message - The message to log.
   * @param {Object} context - Additional context for the log entry.
   */
  info(message, context = {}) {
    this.log('info', message, null, context);
  }

  /**
   * Logs a warning message.
   * @param {string} message - The message to log.
   * @param {Object} context - Additional context for the log entry.
   */
  warn(message, context = {}) {
    this.log('warn', message, null, context);
  }

  /**
   * Logs an error message.
   * @param {string} message - The message to log.
   * @param {Error|null} error - The error object (if applicable).
   * @param {Object} context - Additional context for the log entry.
   */
  error(message, error = null, context = {}) {
    this.log('error', message, error, context);
  }

  /**
   * Logs a debug message if DEBUG environment variable is set.
   * @param {string} message - The message to log.
   * @param {Object} context - Additional context for the log entry.
   */
  debug(message, context = {}) {
    if (process.env.DEBUG) {
      this.log('debug', message, null, context);
    }
  }
}

const logger = new ErrorLogger();

program
  .name('grok')
  .description('Grok Code CLI - built by nytemode')
  .version('1.1.1');

program.action(async () => {
  await main();
});

program.parse();

/**
 * Sets up process event handlers for graceful shutdown.
 */
function setupExitHandlers() {
  let isShuttingDown = false;

  process.on('SIGINT', () => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    logger.info('Received SIGINT, shutting down gracefully');
    console.log('\n\nExiting Grok Code...');
    process.exit(0);
  });

  process.on('exit', (code) => {
    logger.info('Process exiting', { exitCode: code });
  });

  process.on('uncaughtException', (err) => {
    logger.error('Uncaught exception occurred', err);
    if (!isShuttingDown) {
      isShuttingDown = true;
      console.error(
        '\n💥 An unexpected error occurred. Check .grok/error.log for details.'
      );
      process.exit(1);
    }
  });

  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled promise rejection', reason);
    console.error(
      '\n💥 An unhandled promise rejection occurred. Check .grok/error.log for details.'
    );
  });
}

// GitHub Update Functions
/**
 * Compare two semantic version strings
 * @param {string} v1 - First version
 * @param {string} v2 - Second version
 * @returns {number} -1 if v1 < v2, 0 if equal, 1 if v1 > v2
 */
function compareVersions(v1, v2) {
  const parts1 = v1.split('.').map(Number);
  const parts2 = v2.split('.').map(Number);

  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const part1 = parts1[i] || 0;
    const part2 = parts2[i] || 0;

    if (part1 > part2) return 1;
    if (part1 < part2) return -1;
  }

  return 0;
}

async function checkForUpdates() {
  return new Promise((resolve) => {
    const options = {
      hostname: 'api.github.com',
      path: '/repos/NYTEMODEONLY/grok-code/releases/latest',
      headers: { 'User-Agent': 'grok-code-cli' },
    };

    const req = https.get(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const release = JSON.parse(data);

          // Check if the response has the expected structure
          if (!release || !release.tag_name) {
            resolve({ hasUpdate: false, error: 'No releases found on GitHub' });
            return;
          }

          const latestVersion = release.tag_name.replace(/^v/, '');
          const __filename = fileURLToPath(import.meta.url);
          const __dirname = dirname(__filename);
          const packageJson = JSON.parse(
            readFileSync(path.join(__dirname, '../package.json'), 'utf8')
          );
          const currentVersion = packageJson.version;

          // Compare versions properly
          const versionComparison = compareVersions(
            latestVersion,
            currentVersion
          );
          const hasUpdate = versionComparison > 0; // latest > current
          const isAhead = versionComparison < 0; // current > latest (development version)

          resolve({
            hasUpdate,
            isAhead,
            currentVersion,
            latestVersion,
            downloadUrl: release.zipball_url,
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
    const tempDir = path.join(os.tmpdir(), 'grok-update');
    fs.ensureDirSync(tempDir);

    const zipPath = path.join(tempDir, 'update.zip');
    const writeStream = fs.createWriteStream(zipPath);

    await new Promise((resolve, reject) => {
      https
        .get(downloadUrl, (res) => {
          res.pipe(writeStream);
          writeStream.on('finish', resolve);
          writeStream.on('error', reject);
        })
        .on('error', reject);
    });

    spinner.text = 'Extracting update...';

    // Extract and replace files (simplified approach)
    execSync(`cd ${tempDir} && unzip -q update.zip`);
    const extractedDir = fs
      .readdirSync(tempDir)
      .find((d) => d.startsWith('NYTEMODEONLY-grok-code-'));
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
  } catch (_e) {
    // If history file is corrupted, start fresh
  }
  return [];
}

function saveCommandHistory(commands) {
  const historyPath = getWorkspaceHistoryPath();
  try {
    fs.writeFileSync(historyPath, JSON.stringify({ commands }, null, 2));
  } catch (_e) {
    // Silently fail if we can't save history
  }
}

// Conversation Memory Functions
function getConversationPath() {
  const currentDir = process.cwd();
  const grokDir = path.join(currentDir, '.grok');
  fs.ensureDirSync(grokDir);
  return path.join(grokDir, 'conversation.json');
}

// Action History Functions for Undo/Redo
function getActionHistoryPath() {
  const currentDir = process.cwd();
  const grokDir = path.join(currentDir, '.grok');
  fs.ensureDirSync(grokDir);
  return path.join(grokDir, 'action-history.json');
}

function loadActionHistory() {
  const historyPath = getActionHistoryPath();
  try {
    if (fs.existsSync(historyPath)) {
      const history = JSON.parse(fs.readFileSync(historyPath, 'utf8'));
      return history.actions || [];
    }
  } catch (_e) {
    // If history file is corrupted, start fresh
  }
  return [];
}

function saveActionHistory(actions) {
  const historyPath = getActionHistoryPath();
  try {
    // Keep only last 20 actions to prevent file from growing too large
    const recentActions = actions.slice(-20);
    fs.writeFileSync(
      historyPath,
      JSON.stringify(
        {
          actions: recentActions,
          lastUpdated: new Date().toISOString(),
        },
        null,
        2
      )
    );
  } catch (_e) {
    // Silently fail if we can't save history
  }
}

function recordAction(action) {
  const actions = loadActionHistory();
  actions.push({
    ...action,
    timestamp: new Date().toISOString(),
    id: Date.now(),
  });
  saveActionHistory(actions);
}

function undoLastAction() {
  const actions = loadActionHistory();
  if (actions.length === 0) {
    return { success: false, message: 'No actions to undo.' };
  }

  const lastAction = actions.pop();
  let result = { success: true, message: 'Action undone successfully.' };

  try {
    switch (lastAction.type) {
      case 'file_edit':
        // Restore original content
        if (lastAction.originalContent !== undefined) {
          fs.writeFileSync(lastAction.filepath, lastAction.originalContent);
        } else if (fs.existsSync(lastAction.filepath)) {
          fs.unlinkSync(lastAction.filepath); // File was created, so delete it
        }
        break;
      case 'file_delete':
        // Restore deleted file
        if (lastAction.originalContent) {
          fs.writeFileSync(lastAction.filepath, lastAction.originalContent);
        }
        break;
      default:
        result = {
          success: false,
          message: `Cannot undo action type: ${lastAction.type}`,
        };
    }

    if (result.success) {
      saveActionHistory(actions); // Save updated history
    }
  } catch (error) {
    result = {
      success: false,
      message: `Failed to undo action: ${error.message}`,
    };
  }

  return result;
}

function loadConversationHistory() {
  const conversationPath = getConversationPath();
  try {
    if (fs.existsSync(conversationPath)) {
      const conversation = JSON.parse(
        fs.readFileSync(conversationPath, 'utf8')
      );
      return conversation.messages || [];
    }
  } catch (_e) {
    // If conversation file is corrupted, start fresh
  }
  return [];
}

function saveConversationHistory(messages) {
  const conversationPath = getConversationPath();
  try {
    // Only save non-system messages to avoid bloating the file
    const conversationMessages = messages.filter(
      (msg) => msg.role !== 'system'
    );
    // Limit to last 50 messages to prevent file from growing too large
    const recentMessages = conversationMessages.slice(-50);
    fs.writeFileSync(
      conversationPath,
      JSON.stringify(
        {
          messages: recentMessages,
          lastUpdated: new Date().toISOString(),
        },
        null,
        2
      )
    );
  } catch (_e) {
    // Silently fail if we can't save conversation
  }
}

// Context Window Management
function manageContextWindow(messages, maxTokens = 8000) {
  // Keep system message always
  const systemMessage = messages.find((msg) => msg.role === 'system');
  const conversationMessages = messages.filter((msg) => msg.role !== 'system');

  // Rough token estimation: ~4 characters per token
  const estimatedTokens = conversationMessages.reduce((total, msg) => {
    return total + msg.content.length / 4;
  }, 0);

  // If under limit, return as-is
  if (estimatedTokens < maxTokens) {
    return messages;
  }

  console.log(
    `📏 Compressing context (${Math.round(estimatedTokens)} tokens → ${maxTokens})`
  );

  // Keep recent messages and summarize older ones
  const recentMessages = conversationMessages.slice(-10); // Keep last 10 messages
  const olderMessages = conversationMessages.slice(0, -10);

  if (olderMessages.length > 0) {
    // Create a summary of older conversation
    const summaryMessage = {
      role: 'system',
      content: `Previous conversation summary: ${olderMessages.length} messages exchanged. Key topics included coding assistance and file operations.`,
    };

    return [systemMessage, summaryMessage, ...recentMessages].filter(Boolean);
  }

  return [systemMessage, ...recentMessages].filter(Boolean);
}

function addToHistory(command, history) {
  // Don't add duplicate consecutive commands or commands that start with /
  if (command.startsWith('/') || command.toLowerCase() === 'exit')
    return history;

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

    logger.debug('Making RPG planning request', {
      promptLength: planningPrompt.length,
      model,
    });

    openai.chat.completions
      .create({
        model: model,
        messages: [
          {
            role: 'system',
            content:
              'You are a precise code planner. Respond with valid JSON only.',
          },
          { role: 'user', content: planningPrompt },
        ],
        max_tokens: 500,
      })
      .then((response) => {
        try {
          const rawResponse = response.choices[0].message.content.trim();
          logger.debug('Received RPG planning response', {
            responseLength: rawResponse.length,
            responsePreview: rawResponse.substring(0, 200),
          });

          const plan = JSON.parse(rawResponse);
          logger.info('Successfully parsed RPG planning JSON', {
            features: plan.features?.length || 0,
            files: Object.keys(plan.files || {}).length,
          });

          // Validate plan structure
          if (!plan.features || !Array.isArray(plan.features)) {
            throw new Error('Plan missing required "features" array');
          }
          if (!plan.files || typeof plan.files !== 'object') {
            throw new Error('Plan missing required "files" object');
          }
          if (!plan.flows || !Array.isArray(plan.flows)) {
            throw new Error('Plan missing required "flows" array');
          }
          if (!plan.deps || !Array.isArray(plan.deps)) {
            throw new Error('Plan missing required "deps" array');
          }

          resolve({ plan });
        } catch (e) {
          logger.error('Failed to parse RPG planning response', e, {
            rawResponse:
              response.choices[0]?.message?.content?.substring(0, 500) ||
              'No response',
          });
          reject(e);
        }
      })
      .catch((error) => {
        logger.error('RPG planning API request failed', error);
        reject(error);
      });
  });
}

/**
 * Generates code using RPG planning.
 * @param {string} prompt - User request
 * @param {Object} openai - OpenAI client
 * @param {string} model - AI model name
 * @param {Object} fileContext - Existing files context
 * @returns {Promise<Object>} Generated code files
 */
async function generateCodeWithRPG(prompt, openai, model, fileContext = {}) {
  try {
    logger.info('Starting RPG code generation', {
      prompt: prompt.substring(0, 100),
    });

    // Step 1: Generate RPG with progress indicator
    const planSpinner = ora('🔄 Planning project structure...').start();

    // Get existing file information to provide context
    const existingFiles =
      Object.keys(fileContext).length > 0
        ? Object.keys(fileContext).join(', ')
        : 'none';

    logger.debug('Making RPG plan request', {
      existingFiles,
      promptLength: prompt.length,
    });

    const rpg = await makeRPG(prompt, openai, model, existingFiles);
    const plan = rpg.plan;
    planSpinner.succeed('📋 Project structure planned');

    logger.info('RPG plan generated', {
      features: plan.features.length,
      files: Object.keys(plan.files).length,
    });

    // Step 2: Guide code gen with plan
    const codeSpinner = ora('⚙️ Generating code files...').start();

    // Include existing file contents for context
    const existingFileContents =
      Object.keys(fileContext).length > 0
        ? '\nExisting files:\n' +
          Object.entries(fileContext)
            .map(([path, content]) => `=== ${path} ===\n${content}\n`)
            .join('')
        : '';

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

    logger.debug('Making code generation API request', {
      promptLength: codePrompt.length,
    });

    const response = await openai.chat.completions.create({
      model: model,
      messages: [
        {
          role: 'system',
          content:
            'You are a precise code generator. Respond with valid JSON only.',
        },
        { role: 'user', content: codePrompt },
      ],
      max_tokens: 2000,
    });

    const rawResponse = response.choices[0].message.content.trim();
    logger.debug('Received code generation response', {
      responseLength: rawResponse.length,
      responsePreview: rawResponse.substring(0, 200),
    });

    let codeOutput;
    try {
      codeOutput = JSON.parse(rawResponse);
      logger.info('Successfully parsed code generation JSON', {
        fileCount: Object.keys(codeOutput.files || {}).length,
      });
    } catch (parseError) {
      logger.error(
        'Failed to parse code generation response as JSON',
        parseError,
        { rawResponse: rawResponse.substring(0, 500) }
      );
      throw new Error(`AI response was not valid JSON: ${parseError.message}`);
    }

    if (!codeOutput.files || typeof codeOutput.files !== 'object') {
      logger.error('Code output missing files object', { codeOutput });
      throw new Error('AI response did not contain a valid files object');
    }

    codeSpinner.succeed('✨ Code generation complete');

    // Write files to disk with progress
    const writeSpinner = ora('📁 Writing files to disk...').start();
    const fileCount = Object.keys(codeOutput.files).length;
    let filesWritten = 0;
    let filesFailed = 0;

    logger.info('Starting file writing', { fileCount });

    Object.entries(codeOutput.files).forEach(([filepath, code]) => {
      try {
        fs.ensureDirSync(path.dirname(filepath));
        fs.writeFileSync(filepath, code);
        filesWritten++;
        logger.debug('File written successfully', {
          filepath,
          codeLength: code.length,
        });
        writeSpinner.text = `📁 Writing files to disk... (${filesWritten}/${fileCount})`;
      } catch (fileError) {
        filesFailed++;
        logger.error('Failed to write file', fileError, { filepath });
        console.error(`❌ Failed to write ${filepath}: ${fileError.message}`);
      }
    });

    writeSpinner.succeed(
      `✅ Generated ${filesWritten} files successfully${filesFailed > 0 ? ` (${filesFailed} failed)` : ''}`
    );

    if (filesFailed > 0) {
      logger.warn('Some files failed to write', { filesWritten, filesFailed });
    }

    return codeOutput;
  } catch (error) {
    logger.error('RPG code generation failed', error, {
      prompt: prompt.substring(0, 100),
    });
    throw error;
  }
}

/**
 * Main entry point for the Grok Code CLI.
 * Handles setup, user interaction, and AI integration.
 */
export async function main() {
  const logger = new ErrorLogger();
  logger.info('Starting Grok Code CLI');

  setupExitHandlers();

  const configDir = path.join(
    process.env.HOME || process.env.USERPROFILE,
    '.grok'
  );
  const keyFile = path.join(configDir, 'api_key');
  const modelFile = path.join(configDir, 'model');

  try {
    fs.ensureDirSync(configDir);
  } catch (error) {
    logger.error('Failed to create config directory', error, { configDir });
    console.error(
      '❌ Failed to create configuration directory. Check permissions.'
    );
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
          choices: ['Use existing key', 'Change key', 'Delete key'],
        },
      ]);
      const choice = answers.choice;
      if (choice === 'Change key') {
        const keyAnswers = await inquirer.prompt([
          { type: 'input', name: 'key', message: 'Enter new xAI API key:' },
        ]);
        apiKey = keyAnswers.key.trim();
        fs.writeFileSync(keyFile, apiKey);
      } else if (choice === 'Delete key') {
        fs.unlinkSync(keyFile);
        apiKey = null;
      }
    }
    if (!apiKey) {
      const keyAnswers = await inquirer.prompt([
        { type: 'input', name: 'key', message: 'Enter your xAI API key:' },
      ]);
      apiKey = keyAnswers.key.trim();
      fs.writeFileSync(keyFile, apiKey);
    }
  }

  // Update OpenAI client for v5.x
  const client = new OpenAI({
    baseURL: 'https://api.x.ai/v1',
    apiKey: apiKey,
  });

  // Model configuration
  let model = process.env.GROK_MODEL || 'grok-code-fast-1'; // Default to grok-code-fast-1 (optimized for coding)
  if (fs.existsSync(modelFile)) {
    const savedModel = fs.readFileSync(modelFile, 'utf8').trim();
    if (savedModel) {
      model = savedModel;
    }
  }

  const currentDateTime = new Date()
    .toISOString()
    .slice(0, 19)
    .replace('T', ' ');
  const currentOS =
    process.platform === 'darwin'
      ? 'macOS'
      : process.platform === 'win32'
        ? 'Windows'
        : 'Linux';
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

  // Load conversation history for persistent memory
  let conversationHistory = loadConversationHistory();

  let messages = [{ role: 'system', content: systemPrompt }];
  let fileContext = {};

  // Initialize syntax highlighter for code display
  const syntaxHighlighter = new SyntaxHighlighter();

  // Initialize diff viewer for color-coded diffs
  const diffViewer = new DiffViewer({ syntaxHighlighter });

  // Initialize progress indicator for operation feedback
  const progressIndicator = new ProgressIndicator();

  // Initialize file browser for interactive navigation
  const fileBrowser = new FileBrowser({ syntaxHighlighter });

  // Initialize code preview for enhanced code display
  const codePreview = new CodePreview({ syntaxHighlighter });

  // Initialize code search for interactive codebase search
  const codeSearch = new CodeSearch({ syntaxHighlighter, codePreview });

  // Initialize error recovery workflow system
  const errorRecoveryWorkflow = new ErrorRecoveryWorkflow({
    progress: progressIndicator,
  });

  // Initialize debug command for interactive error analysis
  const debugCommand = new DebugCommand();

  // Initialize error analytics for recovery statistics
  const errorStats = new ErrorStats();

  // Initialize auto-complete system for intelligent command completion
  const autoComplete = new AutoComplete({
    currentDir: currentDir,
    maxSuggestions: 10,
  });

  // Initialize command history search system
  const historySearch = new HistorySearch({
    maxHistorySize: 500,
  });

  // Initialize contextual suggestions system
  const contextualSuggestions = new ContextualSuggestions({
    maxSuggestions: 5,
    confidenceThreshold: 0.3,
  });

  // Initialize workflow diagram generator
  const workflowDiagram = new WorkflowDiagram({
    maxWidth: 100,
    maxHeight: 50,
    style: 'default',
  });

  // Initialize progress tracking system
  const progressTracker = new ProgressTracker({
    maxConcurrent: 5,
    showDetails: true,
    autoCleanup: true,
    updateInterval: 100,
  });

  // Initialize confirmation dialog system
  const confirmDialog = new ConfirmDialog({
    maxPreviewLines: 15,
    showFilePreviews: true,
    showImpactAssessment: true,
    enableSafetyMode: true,
  });

  // Append previous conversation history to maintain memory
  if (conversationHistory.length > 0) {
    messages.push(...conversationHistory);
  }

  // Reset context budget for new session
  tokenManager.resetBudget();

  // Automatic codebase scanning on start (with budget constraints)
  const essentialFiles = ['package.json', 'README.md', 'GROK.md'];
  let loadedFiles = 0;
  let skippedFiles = 0;

  // Load essential project context silently (no verbose output)
  for (const f of essentialFiles) {
    const filePath = path.join(currentDir, f);
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8');
      const estimatedTokens = Math.ceil(content.length / 4); // Rough token estimation

      // Check if we can add this file to the essentials budget
      const budgetCheck = tokenManager.canAddToBudget(
        'essentials',
        estimatedTokens,
        model
      );

      if (budgetCheck.canAdd) {
        fileContext[f] = content;
        messages.push({
          role: 'system',
          content: `Auto-added essential file ${f}:\n${content}`,
        });

        // Track the token usage in the essentials budget
        tokenManager.addToBudget('essentials', estimatedTokens);
        loadedFiles++;
      } else {
        skippedFiles++;
        // Silently skip files that would exceed budget
      }
    }
  }

  // Check for updates on startup (synchronously to avoid cursor issues)
  console.log('🔍 Checking for updates...');
  let updateCheck;
  try {
    updateCheck = await checkForUpdates();
  } catch (error) {
    updateCheck = { error: error.message };
  }

  if (updateCheck.hasUpdate) {
    console.log(
      `🔄 Update available! Current: v${updateCheck.currentVersion} → Latest: v${updateCheck.latestVersion}`
    );
    console.log("Type '/update' to update to the latest version.\n");
  } else if (updateCheck.isAhead) {
    console.log(
      `🚀 Development version! Current: v${updateCheck.currentVersion} (ahead of latest release: v${updateCheck.latestVersion})`
    );
    console.log("You're running a development version.\n");
  }
  // Only show error if it's not the common "no releases" case
  else if (
    updateCheck.error &&
    !updateCheck.error.includes('No releases found')
  ) {
    console.log(
      `⚠️  Could not check for updates: ${updateCheck.error}\n`
    );
  } else {
    console.log('✅ Up to date!\n');
  }

  // Load command history for this workspace
  let commandHistory = loadCommandHistory();

  // Show conversation loading message if history exists
  if (conversationHistory.length > 0) {
    console.log(
      `💬 Loaded ${conversationHistory.length} previous conversation messages.\n`
    );
  }

  console.log(
    "Welcome to Grok Code! Type your message or use /help for commands. Type 'exit' or '/exit' to quit.\n"
  );

  const mainPrompt = {
    type: 'input',
    name: 'userInput',
    message: 'You: ',
  };

  while (true) {
    try {
      const { userInput } = await inquirer.prompt([mainPrompt]);
      const trimmedInput = userInput.trim();
      if (!trimmedInput) continue;

      if (
        trimmedInput.toLowerCase() === 'exit' ||
        trimmedInput.toLowerCase() === '/exit'
      ) {
        // Save command history before exit
        historySearch.endSession();
        logger.info('User requested exit');
        console.log('Exiting Grok Code. Happy coding!');
        process.exit(0);
      }

      // Always add user message to conversation memory first
      messages.push({ role: 'user', content: trimmedInput });

      // Update command history with enhanced search system
      commandHistory = addToHistory(trimmedInput, commandHistory);
      saveCommandHistory(commandHistory);
      historySearch.addCommand(trimmedInput, {
        hasResponse: true,
        conversationLength: messages.length,
      });

      // Handle commands
      const handled = await handleCommand(
        trimmedInput,
        messages,
        fileContext,
        client,
        model,
        currentDir,
        systemPrompt,
        modelFile
      );
      if (handled) {
        // For commands, add a brief assistant acknowledgment to maintain conversation flow
        messages.push({
          role: 'assistant',
          content: `Command executed: ${trimmedInput}`,
        });
        // Save conversation after command execution
        saveConversationHistory(messages);
        continue;
      }

      // Auto-context analysis and file addition
      try {
        const autoAddResult = await autoContextBuilder.analyzeAndAutoAdd(
          trimmedInput,
          fileContext,
          messages.slice(-5) // Last 5 messages for context
        );

        if (autoAddResult.autoAdded && autoAddResult.filesAdded.length > 0) {
          console.log(
            `🤖 Auto-added ${autoAddResult.filesAdded.length} relevant file(s) to context:`
          );
          autoAddResult.filesAdded.forEach((file) => {
            console.log(`   ✅ ${file.name} (${file.tokens} tokens)`);
          });

          // Add to conversation context
          messages.push({
            role: 'system',
            content: `Automatically added ${autoAddResult.filesAdded.length} relevant files to context for query: "${trimmedInput}"`,
          });
        }
      } catch (autoContextError) {
        // Don't break the conversation flow for auto-context errors
        logger.warn('Auto-context addition failed', autoContextError);
      }

      // Token management and context pruning
      try {
        const tokenAnalysis = tokenManager.analyzeContext(
          messages,
          fileContext,
          model
        );
        const budgetStatus = tokenManager.getBudgetStatus(model);

        if (tokenAnalysis.status === 'critical') {
          console.log(
            `🚨 Context at ${tokenAnalysis.utilizationPercent}% capacity (${tokenAnalysis.currentTokens}/${tokenAnalysis.tokenLimit} tokens)`
          );
          console.log('💰 Budget breakdown:');
          console.log(
            `   Essentials: ${budgetStatus.categories.essentials.utilizationPercent}% (${budgetStatus.categories.essentials.currentUsage} tokens)`
          );
          console.log(
            `   Conversation: ${budgetStatus.categories.conversation.utilizationPercent}% (${budgetStatus.categories.conversation.currentUsage} tokens)`
          );
          console.log('🔄 Auto-pruning context...');

          const pruneResult = tokenManager.autoPruneContext(
            messages,
            fileContext,
            model
          );
          if (pruneResult.pruned) {
            console.log(
              `✅ Pruned ${pruneResult.filesPruned} files, removed ${pruneResult.tokensRemoved} tokens`
            );
            const newBudgetStatus = tokenManager.getBudgetStatus(model);
            console.log(
              `📊 Context now at ${newBudgetStatus.totalUtilizationPercent}% capacity (${newBudgetStatus.availableCapacity} tokens free)`
            );
          }
        } else if (tokenAnalysis.status === 'warning') {
          console.log(
            `⚠️ Context at ${tokenAnalysis.utilizationPercent}% capacity (${budgetStatus.availableCapacity} tokens remaining)`
          );
          console.log(
            '💡 Tip: Use /prune-context if you need more space for conversation'
          );
        }
      } catch (tokenError) {
        logger.warn('Token management failed', tokenError);
      }

      // RPG check
      const shouldUseRPG =
        trimmedInput.toLowerCase().includes('generate repo') ||
        trimmedInput.toLowerCase().includes('build') ||
        trimmedInput.toLowerCase().includes('create a') ||
        trimmedInput.toLowerCase().includes('implement a') ||
        trimmedInput.toLowerCase().includes('develop a') ||
        trimmedInput.toLowerCase().includes('add ') ||
        trimmedInput.toLowerCase().includes('make ') ||
        trimmedInput.toLowerCase().includes('modify ') ||
        trimmedInput.toLowerCase().includes('update') ||
        trimmedInput.toLowerCase().includes('change ') ||
        trimmedInput.toLowerCase().includes('fix ') ||
        trimmedInput.toLowerCase().includes('improve ') ||
        trimmedInput.toLowerCase().includes('enhance ') ||
        trimmedInput.toLowerCase().includes('extend ') ||
        // Additional code-related patterns
        trimmedInput.toLowerCase().includes('write code') ||
        trimmedInput.toLowerCase().includes('code for') ||
        (trimmedInput.toLowerCase().includes('create ') &&
          trimmedInput.toLowerCase().includes('function')) ||
        (trimmedInput.toLowerCase().includes('create ') &&
          trimmedInput.toLowerCase().includes('component')) ||
        (trimmedInput.toLowerCase().includes('create ') &&
          trimmedInput.toLowerCase().includes('class')) ||
        (trimmedInput.toLowerCase().includes('generate ') &&
          trimmedInput.toLowerCase().includes('code')) ||
        (trimmedInput.toLowerCase().includes('implement ') &&
          trimmedInput.toLowerCase().includes('feature')) ||
        (trimmedInput.toLowerCase().includes('add ') &&
          trimmedInput.toLowerCase().includes('feature')) ||
        (trimmedInput.toLowerCase().includes('create ') &&
          trimmedInput.toLowerCase().includes('file')) ||
        (trimmedInput.toLowerCase().includes('new ') &&
          trimmedInput.toLowerCase().includes('file'));

      if (shouldUseRPG) {
        logger.info('RPG mode triggered', {
          userInput,
          existingFiles: Object.keys(fileContext),
        });
        try {
          const result = await generateCodeWithRPG(
            trimmedInput,
            client,
            model,
            fileContext
          );
          // Add RPG result to conversation memory
          const rpgResponse = `RPG planning completed. Generated ${Object.keys(result.files || {}).length} files successfully.`;
          messages.push({ role: 'assistant', content: rpgResponse });
          // Save conversation after RPG interaction
          saveConversationHistory(messages);
        } catch (_error) {
          const errorResponse =
            'RPG code generation failed. Please try again or use regular chat mode.';
          messages.push({ role: 'assistant', content: errorResponse });
          // Save conversation after RPG error
          saveConversationHistory(messages);
        }
        continue;
      }

      // Regular chat continues below...

      if (Object.keys(fileContext).length > 0) {
        const contextStr = Object.entries(fileContext)
          .map(([f, c]) => `File ${f}:\n${c}`)
          .join('\n');
        messages.push({
          role: 'system',
          content: `Current file context:\n${contextStr}`,
        });
      }

      // Manage context window before API call
      messages = manageContextWindow(messages);

      const spinner = ora('Thinking').start();

      try {
        logger.debug('Making API request', {
          model,
          messageCount: messages.length,
        });

        const response = await client.chat.completions.create({
          model,
          messages,
          max_tokens: 4096,
          temperature: 0.7,
        });

        spinner.stop();

        let grokResponse = response.choices[0].message.content;

        // Apply syntax highlighting to code blocks
        grokResponse = processCodeBlocks(grokResponse, syntaxHighlighter);

        console.log(`\nGrok: ${grokResponse}\n`);

        logger.info('Received API response', {
          responseLength: grokResponse.length,
        });

        await parseAndApplyActions(grokResponse, messages, fileContext);

        messages.push({ role: 'assistant', content: grokResponse });

        // Save conversation after each interaction
        saveConversationHistory(messages);

        if (Object.keys(fileContext).length > 0) {
          messages.splice(messages.length - 2, 1); // Remove temp context
        }
      } catch (error) {
        spinner.stop();
        logger.error('API request failed', error, {
          model,
          lastMessage: messages[messages.length - 1]?.content?.substring(
            0,
            100
          ),
        });
        console.error(
          '❌ API request failed. Check your connection and API key.'
        );
        console.log('💡 Try again or check .grok/error.log for details.');
      }
    } catch (error) {
      if (error.isTtyError) {
        logger.warn('User aborted prompt (Ctrl+C)');
        process.exit(0); // Or continue; but for abort, exit clean
      }
      logger.error('Input error', error);
      continue;
    }
  }
}

async function handleCommand(
  input,
  messages,
  fileContext,
  client,
  model,
  currentDir,
  systemPrompt,
  modelFile
) {
  if (input.startsWith('/add ')) {
    const filename = input.split(' ').slice(1).join(' ');
    if (fs.existsSync(filename)) {
      const content = fs.readFileSync(filename, 'utf8');
      const estimatedTokens = Math.ceil(content.length / 4);

      // Check if we can add this file to the conversation budget
      const budgetCheck = tokenManager.canAddToBudget(
        'conversation',
        estimatedTokens,
        model
      );

      if (budgetCheck.canAdd) {
        fileContext[filename] = content;
        messages.push({
          role: 'system',
          content: `File ${filename} added to context:\n${content}`,
        });

        // Track the token usage in the conversation budget
        tokenManager.addToBudget('conversation', estimatedTokens);

        console.log(
          `✅ Added ${filename} to context (${estimatedTokens} tokens).`
        );
        const budgetStatus = tokenManager.getBudgetStatus(model);
        console.log(
          `💰 Conversation capacity: ${budgetStatus.categories.conversation.available} tokens remaining`
        );
      } else {
        console.log(
          `❌ Cannot add ${filename} (${estimatedTokens} tokens) - would exceed conversation budget.`
        );
        console.log(
          `💰 Available: ${budgetCheck.available} tokens, Need: ${estimatedTokens}`
        );
        console.log(
          '💡 Try /prune-context to free up space, or use /scan to selectively add files.'
        );
      }
    } else {
      console.log(`❌ File ${filename} not found.`);
    }
    return true;
  } else if (input.startsWith('/remove ')) {
    const filename = input.split(' ').slice(1).join(' ');
    if (filename in fileContext) {
      const content = fileContext[filename];
      const estimatedTokens = Math.ceil(content.length / 4);

      delete fileContext[filename];
      messages.push({
        role: 'system',
        content: `File ${filename} removed from context.`,
      });

      // Remove tokens from the appropriate budget category
      // (Could be either essentials or conversation, but we'll remove from conversation as it's more common)
      tokenManager.removeFromBudget('conversation', estimatedTokens);

      console.log(
        `✅ Removed ${filename} from context (${estimatedTokens} tokens freed).`
      );
      const budgetStatus = tokenManager.getBudgetStatus(model);
      console.log(
        `💰 Conversation capacity: ${budgetStatus.categories.conversation.available} tokens now available`
      );
    } else {
      console.log(`❌ File ${filename} not in context.`);
    }
    return true;
  } else if (input === '/scan') {
    const files = fs
      .readdirSync('.')
      .filter((f) => fs.statSync(f).isFile() && !f.startsWith('.'));
    files.forEach((f) => {
      const content = fs.readFileSync(f, 'utf8');
      fileContext[f] = content;
      messages.push({
        role: 'system',
        content: `File ${f} added to context:\n${content}`,
      });
    });
    console.log(`Scanned and added ${files.length} files to context.`);
    return true;
  } else if (input === '/ls') {
    const files = fs.readdirSync('.');
    console.log('Files in current directory:');
    files.forEach((f) => console.log(`- ${f}`));
    return true;
  } else if (input === '/model') {
    const availableModels = [
      'grok-code-fast-1', // Optimized for coding, fast & cost-effective (default)
      'grok-4-fast-reasoning', // Best for complex reasoning (RPG planning), 2M context
      'grok-4-fast-non-reasoning', // Fast for simple tasks, 2M context
      'grok-3-beta', // Legacy: Most capable, balanced performance
      'grok-3-mini-beta', // Legacy: Faster, lower cost
      'grok-beta', // Legacy: Original model
    ];

    const modelAnswers = await inquirer.prompt([
      {
        type: 'list',
        name: 'selectedModel',
        message: `Current model: ${model}. Select a new model:`,
        choices: availableModels.map((m) => ({
          name: `${m}${m === model ? ' (current)' : ''}`,
          value: m,
        })),
      },
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
  } else if (input.startsWith('/semantic-search ')) {
    const query = input.substring('/semantic-search '.length).trim();
    if (!query) {
      console.log('❌ Usage: /semantic-search "your coding query"');
      console.log('Example: /semantic-search "fix authentication bug"');
      return true;
    }

    console.log(`🔍 Analyzing codebase for: "${query}"`);
    console.log('─'.repeat(50));

    try {
      const result = await fileSuggester.suggestFiles(query, ['.'], {
        maxSuggestions: 5,
        includeContext: false, // Don't optimize context for CLI display
      });

      if (result.suggestions.length === 0) {
        console.log('❌ No relevant files found for this query.');
        return true;
      }

      console.log(
        `🎯 Task Type: ${result.task.analysis.type} (${result.task.analysis.confidence}% confidence)`
      );
      console.log(`📂 Found ${result.suggestions.length} relevant files:\n`);

      result.suggestions.forEach((suggestion, index) => {
        const priorityEmoji =
          {
            critical: '🔴',
            high: '🟠',
            medium: '🟡',
            low: '🟢',
            optional: '⚪',
          }[suggestion.priority] || '⚪';

        console.log(`${index + 1}. ${priorityEmoji} ${suggestion.file.name}`);
        console.log(
          `   Relevance: ${suggestion.relevance.level} (${suggestion.relevance.score} pts)`
        );
        console.log(`   Action: ${suggestion.action}`);
        console.log(`   Why: ${suggestion.reasoning}`);
        console.log('');
      });

      console.log('💡 Recommendations:');
      result.recommendations.forEach((rec) => {
        console.log(`   ${rec}`);
      });

      // Add to conversation context
      messages.push({
        role: 'system',
        content: `Semantic search results for "${query}": Found ${result.suggestions.length} relevant files. ${result.recommendations[0]}`,
      });
    } catch (error) {
      console.log(`❌ Semantic search failed: ${error.message}`);
      logger.error('Semantic search error', error, { query });
    }

    return true;
  } else if (input.startsWith('/analyze ')) {
    const query = input.substring('/analyze '.length).trim();
    if (!query) {
      console.log('❌ Usage: /analyze "your coding query"');
      console.log('Example: /analyze "implement user login"');
      return true;
    }

    console.log(`🔬 Deep analysis for: "${query}"`);
    console.log('─'.repeat(50));

    try {
      const result = await fileSuggester.suggestFiles(query, ['.'], {
        maxSuggestions: 10,
        includeContext: true,
        model: 'grok-code-fast-1',
        detailLevel: 'detailed',
      });

      if (result.suggestions.length === 0) {
        console.log('❌ No relevant files found for deep analysis.');
        return true;
      }

      console.log(
        `🎯 Task Analysis: ${result.task.analysis.type} (${result.task.analysis.confidence}% confidence)`
      );
      console.log(
        `📊 Context Optimization: ${result.optimization.tokenUtilization}% of ${result.optimization.tokenLimit} tokens used`
      );
      console.log(`📂 Selected ${result.files.length} files for context:\n`);

      result.files.forEach((file, index) => {
        console.log(
          `${index + 1}. ${file.shortName} (${file.relevanceScore} pts, ${file.tokens} tokens)`
        );
        console.log(`   Language: ${file.language}`);

        if (file.optimization) {
          console.log(
            `   Optimized: ${file.optimization.compressionRatio}% of original size`
          );
        }

        // Show first few lines of content
        const lines = file.content.split('\n').slice(0, 3);
        console.log(
          `   Preview: ${lines.join(' ').substring(0, 80)}${file.content.length > 80 ? '...' : ''}`
        );
        console.log('');
      });

      // Automatically add top files to context
      console.log('🔄 Auto-adding relevant files to context...');
      result.files.slice(0, 3).forEach((file) => {
        fileContext[file.filePath] = file.content;
        console.log(`   ✅ Added ${file.shortName} to context`);
      });

      console.log('\n💡 Analysis complete. Top recommendations:');
      result.recommendations.slice(0, 3).forEach((rec) => {
        console.log(`   ${rec}`);
      });

      // Add comprehensive analysis to conversation
      messages.push({
        role: 'system',
        content: `Deep analysis for "${query}": ${result.files.length} files optimized for context (${result.totalTokens} tokens). ${result.recommendations[0]}`,
      });
    } catch (error) {
      console.log(`❌ Analysis failed: ${error.message}`);
      logger.error('Analysis error', error, { query });
    }

    return true;
  } else if (input.startsWith('/auto-context')) {
    const parts = input.split(' ').slice(1);
    const command = parts[0];

    if (command === 'on') {
      autoContextBuilder.configure({ autoAddEnabled: true });
      console.log('✅ Auto-context building enabled');
    } else if (command === 'off') {
      autoContextBuilder.configure({ autoAddEnabled: false });
      console.log('❌ Auto-context building disabled');
    } else if (command === 'status') {
      const stats = autoContextBuilder.getStatistics();
      console.log('🤖 Auto-Context Status:');
      console.log(
        `   Enabled: ${autoContextBuilder.autoAddEnabled ? '✅' : '❌'}`
      );
      console.log(`   Files tracked: ${stats.totalFilesTracked}`);
      console.log(`   Learned patterns: ${stats.learnedPatterns}`);
      console.log(`   Auto-adds performed: ${stats.autoAddedFiles}`);
      console.log(
        `   Conversation memory: ${stats.conversationMemorySize} items`
      );

      if (
        stats.taskTypeDistribution &&
        Object.keys(stats.taskTypeDistribution).length > 0
      ) {
        console.log('   Task types learned:');
        Object.entries(stats.taskTypeDistribution).forEach(([type, count]) => {
          console.log(`     ${type}: ${count} queries`);
        });
      }
    } else if (command === 'clear') {
      autoContextBuilder.clearLearning();
      console.log('🧹 Auto-context learning cleared');
    } else {
      console.log('Usage: /auto-context <on|off|status|clear>');
      console.log('  on    - Enable automatic context building');
      console.log('  off   - Disable automatic context building');
      console.log('  status - Show auto-context statistics');
      console.log('  clear - Clear learned patterns');
    }
    return true;
  } else if (input.startsWith('/prune-context')) {
    const parts = input.split(' ').slice(1);
    const command = parts[0];

    if (command === 'status') {
      const analysis = tokenManager.analyzeContext(
        messages,
        fileContext,
        model
      );
      const stats = tokenManager.getStatistics();

      console.log('📊 Context Status:');
      console.log(
        `   Current tokens: ${analysis.currentTokens}/${analysis.tokenLimit}`
      );
      console.log(
        `   Utilization: ${analysis.utilizationPercent}% (${analysis.status})`
      );
      console.log(`   Files in context: ${Object.keys(fileContext).length}`);
      console.log(`   Strategy: ${stats.currentStrategy}`);
      console.log(`   Auto-pruning: ${stats.autoPruneEnabled ? '✅' : '❌'}`);
      console.log(`   Total prunings: ${stats.totalPrunings}`);
    } else if (command === 'prune') {
      const strategy = parts[1] || tokenManager.currentStrategy;
      console.log(`🔄 Pruning context using ${strategy} strategy...`);

      const result = tokenManager.pruneContext(
        messages,
        fileContext,
        model,
        strategy
      );
      if (result.pruned) {
        console.log(
          `✅ Pruned ${result.filesPruned} files, removed ${result.tokensRemoved} tokens`
        );
        console.log(`📊 Context now at ${result.finalUtilization}% capacity`);
        console.log('Pruned files:');
        result.prunedFiles.forEach((file) => {
          console.log(`   🗑️ ${file.name} (${file.tokensRemoved} tokens)`);
        });
      } else {
        console.log(`❌ ${result.reason}`);
      }
    } else if (command === 'strategy') {
      const newStrategy = parts[1];
      if (newStrategy && tokenManager.getAvailableStrategies()[newStrategy]) {
        tokenManager.configure({ currentStrategy: newStrategy });
        console.log(`✅ Pruning strategy changed to: ${newStrategy}`);
      } else {
        console.log('Available strategies:');
        Object.entries(tokenManager.getAvailableStrategies()).forEach(
          ([key, strategy]) => {
            console.log(`   ${key}: ${strategy.description}`);
          }
        );
        console.log(`Current: ${tokenManager.currentStrategy}`);
      }
    } else if (command === 'auto') {
      const enabled = parts[1] !== 'off';
      tokenManager.configure({ autoPruneEnabled: enabled });
      console.log(
        `${enabled ? '✅' : '❌'} Auto-pruning ${enabled ? 'enabled' : 'disabled'}`
      );
    } else {
      console.log('Usage: /prune-context <status|prune|strategy|auto>');
      console.log('  status          - Show current context status');
      console.log('  prune [strategy] - Manually prune context');
      console.log(
        '  strategy <name>  - Set pruning strategy (balanced/aggressive/conservative)'
      );
      console.log('  auto <on|off>    - Enable/disable auto-pruning');
    }
    return true;
  } else if (input === '/help') {
    console.log(`Commands:
- /add <file>: Add file to context
- /remove <file>: Remove file from context
- /scan: Scan and add all files to context
- /ls: List files in directory
- /model: Change AI model (grok-code-fast-1, grok-4-fast-reasoning, grok-4-fast-non-reasoning, etc.)
- /semantic-search "query": Find relevant files for coding tasks (e.g., /semantic-search "fix auth bug")
- /analyze "query": Deep analysis with automatic context building (e.g., /analyze "implement login")
- /auto-context <on|off|status|clear>: Control automatic context building
- /prune-context <status|prune|strategy|auto>: Manage context size and token limits
- /update or update: Check for and install updates from GitHub
- /run <cmd>: Run shell command
- /git <command>: Run git command (e.g., /git status)
- /init-git: Initialize git repo
- /commit <message>: Commit changes
- /push: Push to remote
- /pr <title>: Create a pull request (requires gh CLI)
- /highlight <on|off|theme|status>: Control syntax highlighting (themes: default/dark/minimal)
- /diff <status|test|git|show>: Color-coded diff display and git integration
- /progress <status|test|spinner|multistep>: Progress indicators and status displays
- /browse <start|find|preview|stats>: Interactive file browser and navigation
- /preview <file|code|line|search|config>: Enhanced code preview with line numbers
- /search <query|regex|word|fuzzy|interactive|history|stats>: Interactive code search across codebase
- /debug <interactive|file|errors|fix|history|stats>: Interactive error analysis and recovery
- /complete <test|status|config>: Auto-complete system for commands and file paths
- /history <search|recent|stats|clear|delete|export>: Advanced command history search and management
- /suggest <show|stats|reset>: Intelligent contextual command suggestions
- /diagram <show|style|types>: ASCII art workflow diagrams from RPG plans
- /progress <status|history|report>: Track operations with visual progress indicators
- /confirm <demo|stats|history>: Rich confirmation dialogs with previews and warnings
- /logs: View recent error logs
- /clear: Clear conversation history
- /undo: Undo the last file operation
- exit or /exit: Quit
- Custom: /<custom_name> for user-defined in .grok/commands/

🔧 Workspace Features:
- Command history: Shows your last 3 commands at each prompt
- Conversation memory: Remembers your conversation across sessions
- Action history: Tracks file operations for undo capability
- Auto-update check: Notifies you of new versions on startup
- Error logging: Automatic logging to .grok/error.log
- Smart code generation: Automatically detects requests like "build", "add", "update", "make", etc. and generates code
- Intelligent file analysis: /semantic-search and /analyze commands use AI to find and prioritize relevant files
- Automatic context building: Proactively adds relevant files to context during conversation (/auto-context to control)
- Smart token management: Monitors and manages context size to stay within AI model limits (/prune-context to control)
`);
    return true;
  } else if (input.startsWith('/run ')) {
    const cmd = input.split(' ').slice(1).join(' ');
    try {
      const result = execSync(cmd, { encoding: 'utf8' });
      console.log(result);
      messages.push({
        role: 'system',
        content: `Run command '${cmd}' output:\n${result}`,
      });
    } catch (e) {
      console.log(`Error: ${e.stderr}`);
      messages.push({
        role: 'system',
        content: `Run command '${cmd}' error:\n${e.stderr}`,
      });
    }
    return true;
  } else if (input.startsWith('/git ')) {
    const cmd = input.split(' ').slice(1).join(' ');
    try {
      const result = execSync(`git ${cmd}`, { encoding: 'utf8' });
      console.log(result);
      messages.push({
        role: 'system',
        content: `Git command '${cmd}' output:\n${result}`,
      });
    } catch (e) {
      console.log(`Error: ${e.stderr}`);
      messages.push({
        role: 'system',
        content: `Git command '${cmd}' error:\n${e.stderr}`,
      });
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
      const result = execSync(`git commit -m "${message}"`, {
        encoding: 'utf8',
      });
      console.log(result);
      messages.push({
        role: 'system',
        content: `Git commit output:\n${result}`,
      });
    } catch (e) {
      console.log(`Error: ${e.stderr}`);
    }
    return true;
  } else if (input.startsWith('/pr ')) {
    const title = input.split(' ').slice(1).join(' ');
    try {
      const body = 'Auto-generated by Grok Code'; // Could prompt for body or generate via AI
      const result = execSync(
        `gh pr create --title "${title}" --body "${body}"`,
        { encoding: 'utf8' }
      );
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
        const lines = logs.split('\n').filter((line) => line.trim());
        const recentLogs = lines.slice(-20); // Show last 20 entries

        console.log('\n📋 Recent Error Logs (last 20 entries):');
        console.log('='.repeat(50));
        recentLogs.forEach((line, index) => {
          try {
            const entry = JSON.parse(line);
            const time = new Date(entry.timestamp).toLocaleString();
            console.log(
              `${index + 1}. [${time}] ${entry.level.toUpperCase()}: ${entry.message}`
            );
            if (entry.error) {
              console.log(`   Error: ${entry.error.message}`);
            }
          } catch (_parseError) {
            console.log(`${index + 1}. ${line}`);
          }
        });
        console.log('='.repeat(50));
        console.log(`Full logs available at: ${logFile}`);
      } else {
        console.log(
          '📋 No error logs found. Logs will be created when errors occur.'
        );
      }
    } catch (error) {
      console.log(`❌ Error reading logs: ${error.message}`);
    }
    return true;
  } else if (input === '/budget') {
    const budgetStatus = tokenManager.getBudgetStatus(model);
    console.log('\n💰 Context Budget Status:');
    console.log('═'.repeat(50));
    console.log(
      `Total Usage: ${budgetStatus.totalUtilizationPercent}% (${budgetStatus.totalUsed}/${budgetStatus.totalLimit} tokens)`
    );
    console.log(`Available: ${budgetStatus.availableCapacity} tokens\n`);

    console.log('Budget Categories:');
    Object.entries(budgetStatus.categories).forEach(([category, stats]) => {
      const bar =
        '█'.repeat(Math.floor(stats.utilization * 20)) +
        '░'.repeat(20 - Math.floor(stats.utilization * 20));
      console.log(
        `  ${category.padEnd(12)} ${bar} ${stats.utilizationPercent}% (${stats.currentUsage}/${stats.categoryLimit})`
      );
    });

    console.log('\n💡 Tips:');
    if (budgetStatus.categories.conversation.available < 1000) {
      console.log('   • Low conversation space - consider /prune-context');
    }
    if (budgetStatus.categories.essentials.utilization > 0.8) {
      console.log(
        '   • High essentials usage - project files taking most space'
      );
    }
    console.log('   • Use /add <file> to add files to conversation context');
    console.log('   • Use /remove <file> to free up space');

    return true;
  } else if (input.startsWith('/highlight')) {
    const parts = input.split(' ');
    const subcommand = parts[1];

    if (!subcommand || subcommand === 'status') {
      const stats = syntaxHighlighter.getStats();
      console.log('\n🎨 Syntax Highlighting Status:');
      console.log('═'.repeat(40));
      console.log(`Enabled: ${stats.enabled ? '✅' : '❌'}`);
      console.log(`Theme: ${stats.theme}`);
      console.log(`Languages: ${stats.supportedLanguages.join(', ')}`);
      console.log(`Themes: ${stats.availableThemes.join(', ')}`);
    } else if (subcommand === 'on') {
      syntaxHighlighter.setEnabled(true);
      console.log('✅ Syntax highlighting enabled');
    } else if (subcommand === 'off') {
      syntaxHighlighter.setEnabled(false);
      console.log('❌ Syntax highlighting disabled');
    } else if (subcommand === 'theme') {
      const theme = parts[2];
      if (theme) {
        try {
          syntaxHighlighter.setTheme(theme);
          console.log(`🎨 Theme changed to: ${theme}`);
        } catch (error) {
          console.log(`❌ Invalid theme: ${theme}`);
          console.log(
            `Available themes: ${syntaxHighlighter.getStats().availableThemes.join(', ')}`
          );
        }
      } else {
        console.log(`Current theme: ${syntaxHighlighter.getStats().theme}`);
        console.log(
          `Available themes: ${syntaxHighlighter.getStats().availableThemes.join(', ')}`
        );
      }
    } else {
      console.log('Usage: /highlight <on|off|theme [name]|status>');
      console.log('Examples:');
      console.log('  /highlight on          - Enable syntax highlighting');
      console.log('  /highlight off         - Disable syntax highlighting');
      console.log('  /highlight theme dark  - Change to dark theme');
      console.log('  /highlight status      - Show current settings');
    }

    return true;
  } else if (input.startsWith('/diff')) {
    const parts = input.split(' ');
    const subcommand = parts[1];

    if (!subcommand) {
      console.log('Usage: /diff <command>');
      console.log('Commands:');
      console.log('  /diff status        - Show diff viewer status');
      console.log('  /diff test          - Run diff viewer test');
      console.log(
        '  /diff git <args>    - Run git diff with color highlighting'
      );
      console.log('  /diff show <file>   - Show git diff for specific file');
      console.log('Examples:');
      console.log('  /diff git status');
      console.log('  /diff git diff HEAD~1');
      console.log('  /diff show src/app.js');
    } else if (subcommand === 'status') {
      const stats = diffViewer.getStats();
      console.log('\n📊 Diff Viewer Status:');
      console.log('═'.repeat(30));
      console.log(
        `Syntax highlighting: ${stats.syntaxHighlighterEnabled ? '✅' : '❌'}`
      );
      console.log(`Theme: ${stats.theme}`);
      console.log(`Context lines: ${stats.contextLines}`);
    } else if (subcommand === 'test') {
      console.log('\n🧪 Running Diff Viewer Test...\n');
      console.log(diffViewer.testDiffViewer('unified'));
    } else if (subcommand === 'git') {
      const gitArgs = parts.slice(2).join(' ');
      if (!gitArgs) {
        console.log('Usage: /diff git <git-diff-command>');
        console.log(
          'Examples: /diff git diff, /diff git diff --staged, /diff git diff HEAD~1'
        );
        return true;
      }

      try {
        const { execSync } = await import('child_process');
        const gitCommand = `git ${gitArgs}`;
        const diffOutput = execSync(gitCommand, { encoding: 'utf8' });

        if (diffOutput.trim()) {
          console.log(`\n🔍 Git diff output (${gitCommand}):`);
          console.log('═'.repeat(50));
          console.log(diffViewer.displayDiff(diffOutput));

          // Show summary
          const summary = diffViewer.getDiffSummary(diffOutput);
          console.log('\n📈 Summary:');
          console.log(diffViewer.formatDiffSummary(summary));
        } else {
          console.log(`No differences found for: ${gitCommand}`);
        }
      } catch (error) {
        console.log(`❌ Error running git command: ${error.message}`);
      }
    } else if (subcommand === 'show') {
      const filePath = parts[2];
      if (!filePath) {
        console.log('Usage: /diff show <file-path>');
        return true;
      }

      try {
        const { execSync } = await import('child_process');
        const diffOutput = execSync(`git diff ${filePath}`, {
          encoding: 'utf8',
        });

        if (diffOutput.trim()) {
          console.log(`\n🔍 Git diff for ${filePath}:`);
          console.log('═'.repeat(40));
          console.log(diffViewer.displayDiff(diffOutput));
        } else {
          console.log(`No changes found for ${filePath}`);
        }
      } catch (error) {
        console.log(`❌ Error showing diff for ${filePath}: ${error.message}`);
      }
    } else {
      console.log(`Unknown diff subcommand: ${subcommand}`);
      console.log('Use /diff for help');
    }

    return true;
  } else if (input.startsWith('/progress')) {
    const parts = input.split(' ');
    const subcommand = parts[1];

    if (!subcommand) {
      console.log('Usage: /progress <command>');
      console.log('Commands:');
      console.log('  /progress status     - Show progress indicator status');
      console.log('  /progress test       - Run progress indicator test');
      console.log('  /progress spinner    - Start a test spinner');
      console.log('  /progress multistep  - Show multi-step progress demo');
      console.log('Examples:');
      console.log('  /progress status');
      console.log('  /progress test');
    } else if (subcommand === 'status') {
      const stats = progressIndicator.getStats();
      console.log('\n⏳ Progress Indicator Status:');
      console.log('═'.repeat(35));
      console.log(`Active Spinners: ${stats.activeSpinners}`);
      console.log(`Active Progress Bars: ${stats.activeProgressBars}`);
      console.log(`Theme: ${stats.theme}`);
      console.log(`Show Time: ${stats.showTime}`);
    } else if (subcommand === 'test') {
      console.log('\n🧪 Running Progress Indicator Test...\n');
      progressIndicator.testIndicators('all');
    } else if (subcommand === 'spinner') {
      console.log('Starting test spinner...');
      const spinner = progressIndicator.startSpinner(
        'analyzing',
        'Testing spinner functionality...'
      );

      // Auto-complete after 3 seconds
      setTimeout(() => {
        progressIndicator.succeedSpinner(
          spinner.id,
          'Test spinner completed successfully'
        );
      }, 3000);
    } else if (subcommand === 'multistep') {
      const steps = [
        { name: 'Initializing', operation: 'loading' },
        { name: 'Processing', operation: 'processing' },
        { name: 'Validating', operation: 'validating' },
        { name: 'Completing', operation: 'saving' },
      ];

      const multiStep = progressIndicator.showMultiStepProgress(
        steps,
        'Demo Multi-Step Operation'
      );

      let stepIndex = 0;
      const runNextStep = () => {
        if (stepIndex < steps.length) {
          const spinner = multiStep.next();
          setTimeout(() => {
            progressIndicator.succeedSpinner(spinner.id);
            stepIndex++;
            runNextStep();
          }, 1500);
        } else {
          console.log('✅ Multi-step demo completed!');
        }
      };

      runNextStep();
    } else {
      console.log(`Unknown progress subcommand: ${subcommand}`);
      console.log('Use /progress for help');
    }

    return true;
  } else if (input.startsWith('/browse')) {
    const parts = input.split(' ');
    const subcommand = parts[1];

    if (!subcommand) {
      console.log('Usage: /browse <command>');
      console.log('Commands:');
      console.log('  /browse start          - Start interactive file browser');
      console.log('  /browse find <pattern> - Find files matching pattern');
      console.log('  /browse preview <file> - Preview a specific file');
      console.log('  /browse stats          - Show browser statistics');
      console.log('Examples:');
      console.log('  /browse start');
      console.log('  /browse find .js');
      console.log('  /browse preview package.json');
    } else if (subcommand === 'start') {
      console.log('Starting interactive file browser...');
      console.log(
        'Use arrow keys to navigate, Enter to select files, Ctrl+C to finish.'
      );

      fileBrowser
        .browse()
        .then((selectedFiles) => {
          if (selectedFiles.length > 0) {
            console.log(
              `\n📋 Adding ${selectedFiles.length} selected files to context:`
            );
            selectedFiles.forEach((file) => {
              const relativePath = path.relative(currentDir, file);
              console.log(`  ✅ ${relativePath}`);
              // Add to context if not already there
              if (!fileContext[relativePath]) {
                try {
                  const content = fs.readFileSync(file, 'utf8');
                  fileContext[relativePath] = content;
                  messages.push({
                    role: 'system',
                    content: `Auto-added file ${relativePath} from browser:\n${content}`,
                  });
                } catch (error) {
                  console.log(
                    `  ❌ Error reading ${relativePath}: ${error.message}`
                  );
                }
              }
            });
            console.log(`\n💾 ${selectedFiles.length} files added to context.`);
          }
        })
        .catch((error) => {
          console.log(`❌ Browser error: ${error.message}`);
        });
    } else if (subcommand === 'find') {
      const pattern = parts.slice(2).join(' ');
      if (!pattern) {
        console.log('Usage: /browse find <pattern>');
        return true;
      }

      const results = fileBrowser.findFiles(pattern);
      console.log(`\n🔍 Found ${results.length} files matching "${pattern}":`);

      if (results.length === 0) {
        console.log('  No files found.');
      } else {
        results.slice(0, 20).forEach((file) => {
          const relativePath = path.relative(currentDir, file.fullPath);
          console.log(`  ${file.icon} ${relativePath} (${file.readable})`);
        });
        if (results.length > 20) {
          console.log(`  ... and ${results.length - 20} more files`);
        }
      }
    } else if (subcommand === 'preview') {
      const filePath = parts.slice(2).join(' ');
      if (!filePath) {
        console.log('Usage: /browse preview <file-path>');
        return true;
      }

      const fullPath = path.isAbsolute(filePath)
        ? filePath
        : path.join(currentDir, filePath);

      if (!fs.existsSync(fullPath)) {
        console.log(`❌ File not found: ${filePath}`);
        return true;
      }

      console.log(`\n👁️  Previewing: ${path.relative(currentDir, fullPath)}`);
      console.log('═'.repeat(50));
      console.log(fileBrowser.previewFile(fullPath));
    } else if (subcommand === 'stats') {
      const stats = fileBrowser.getStats();
      console.log('\n🗂️  File Browser Statistics:');
      console.log('═'.repeat(35));
      console.log(
        `Current Path: ${path.relative(process.cwd(), stats.currentPath)}`
      );
      console.log(`Selected Files: ${stats.selectedFiles}`);
      console.log(`Show Hidden: ${stats.showHidden ? '✅' : '❌'}`);
      console.log(`Max Preview Lines: ${stats.maxPreviewLines}`);

      // Show current directory info
      const contents = fileBrowser.getDirectoryContents(stats.currentPath);
      const dirs = contents.filter(
        (item) => item.isDirectory && !item.isParent
      ).length;
      const files = contents.filter((item) => !item.isDirectory).length;
      console.log(`Current Directory: ${dirs} directories, ${files} files`);
    } else {
      console.log(`Unknown browse subcommand: ${subcommand}`);
      console.log('Use /browse for help');
    }

    return true;
  } else if (input.startsWith('/preview')) {
    const parts = input.split(' ');
    const subcommand = parts[1];

    if (!subcommand) {
      console.log('Usage: /preview <command>');
      console.log('Commands:');
      console.log(
        '  /preview file <path>     - Preview a file with line numbers'
      );
      console.log(
        '  /preview code <language> - Preview code from clipboard/input'
      );
      console.log(
        '  /preview line <file> <n> - Navigate to specific line in file'
      );
      console.log(
        '  /preview search <file> <term> - Search and highlight in file'
      );
      console.log('  /preview config          - Show preview configuration');
      console.log('Examples:');
      console.log('  /preview file package.json');
      console.log('  /preview line src/app.js 25');
      console.log('  /preview search lib/utils.js function');
    } else if (subcommand === 'file') {
      const filePath = parts.slice(2).join(' ');
      if (!filePath) {
        console.log('Usage: /preview file <file-path>');
        return true;
      }

      const fullPath = path.isAbsolute(filePath)
        ? filePath
        : path.join(currentDir, filePath);

      if (!fs.existsSync(fullPath)) {
        console.log(`❌ File not found: ${filePath}`);
        return true;
      }

      console.log(
        `\n👁️  Enhanced preview: ${path.relative(currentDir, fullPath)}`
      );
      console.log('═'.repeat(60));
      console.log(
        codePreview.previewFile(fullPath, {
          showLineNumbers: true,
          showHeader: true,
          showFileInfo: true,
          maxLines: 50,
        })
      );
    } else if (subcommand === 'code') {
      const language = parts[2] || 'auto';
      console.log(
        `Enter code to preview (${language} syntax). Type 'END' on a new line to finish:`
      );

      let codeLines = [];
      const originalPrompt = '> ';
      process.stdout.write(originalPrompt);

      process.stdin.setEncoding('utf8');
      process.stdin.resume();

      process.stdin.on('data', function (chunk) {
        const input = chunk.toString().trim();
        if (input === 'END') {
          process.stdin.pause();
          const code = codeLines.join('\n');
          console.log('\n📄 Code Preview:');
          console.log('═'.repeat(50));
          console.log(
            codePreview.previewCode(code, language, {
              showLineNumbers: true,
              showHeader: true,
              maxLines: 30,
            })
          );
          console.log('\n✅ Code preview complete.');
          process.stdout.write('\nYou: ');
          return;
        }
        codeLines.push(input);
        process.stdout.write(originalPrompt);
      });
    } else if (subcommand === 'line') {
      const filePath = parts[2];
      const lineNumber = parseInt(parts[3]);

      if (!filePath || !lineNumber) {
        console.log('Usage: /preview line <file-path> <line-number>');
        return true;
      }

      const fullPath = path.isAbsolute(filePath)
        ? filePath
        : path.join(currentDir, filePath);

      if (!fs.existsSync(fullPath)) {
        console.log(`❌ File not found: ${filePath}`);
        return true;
      }

      console.log(
        `\n🎯 Navigating to line ${lineNumber} in: ${path.relative(currentDir, fullPath)}`
      );
      console.log('═'.repeat(60));
      console.log(
        codePreview.navigateToLine(
          fs.readFileSync(fullPath, 'utf8'),
          lineNumber,
          3, // context lines
          undefined, // auto-detect language
          { showLineNumbers: true }
        )
      );
    } else if (subcommand === 'search') {
      const filePath = parts[2];
      const searchTerm = parts.slice(3).join(' ');

      if (!filePath || !searchTerm) {
        console.log('Usage: /preview search <file-path> <search-term>');
        return true;
      }

      const fullPath = path.isAbsolute(filePath)
        ? filePath
        : path.join(currentDir, filePath);

      if (!fs.existsSync(fullPath)) {
        console.log(`❌ File not found: ${filePath}`);
        return true;
      }

      console.log(
        `\n🔍 Searching for "${searchTerm}" in: ${path.relative(currentDir, fullPath)}`
      );
      console.log('═'.repeat(60));
      console.log(
        codePreview.searchAndHighlight(
          fs.readFileSync(fullPath, 'utf8'),
          searchTerm,
          undefined, // auto-detect language
          { showLineNumbers: true, showHeader: true, maxLines: 30 }
        )
      );
    } else if (subcommand === 'config') {
      const stats = codePreview.getStats();
      console.log('\n📄 Code Preview Configuration:');
      console.log('═'.repeat(40));
      console.log(`Show Line Numbers: ${stats.showLineNumbers ? '✅' : '❌'}`);
      console.log(`Line Number Padding: ${stats.lineNumberPadding}`);
      console.log(`Max Lines: ${stats.maxLines}`);
      console.log(`Wrap Lines: ${stats.wrapLines ? '✅' : '❌'}`);
      console.log(
        `Highlight Current Line: ${stats.highlightCurrentLine ? '✅' : '❌'}`
      );
      console.log(`Show Gutter: ${stats.showGutter ? '✅' : '❌'}`);
    } else {
      console.log(`Unknown preview subcommand: ${subcommand}`);
      console.log('Use /preview for help');
    }

    return true;
  } else if (input.startsWith('/search')) {
    const parts = input.split(' ');
    const subcommand = parts[1];

    if (!subcommand) {
      console.log('Usage: /search <command>');
      console.log('Commands:');
      console.log('  /search query "<term>"    - Search for exact term');
      console.log('  /search regex "<pattern>" - Search with regex');
      console.log('  /search word "<term>"     - Search for whole word');
      console.log('  /search fuzzy "<term>"    - Fuzzy search');
      console.log('  /search interactive        - Interactive search mode');
      console.log('  /search history           - Show search history');
      console.log('  /search stats             - Show search statistics');
      console.log('Examples:');
      console.log('  /search query "function"');
      console.log('  /search regex "\\bconst\\s+\\w+"');
      console.log('  /search word "import"');
    } else if (subcommand === 'interactive') {
      console.log('Starting interactive code search...');
      codeSearch.interactiveSearch().catch((error) => {
        console.log(`❌ Search error: ${error.message}`);
      });
    } else if (
      subcommand === 'query' ||
      subcommand === 'regex' ||
      subcommand === 'word' ||
      subcommand === 'fuzzy'
    ) {
      const query = parts
        .slice(2)
        .join(' ')
        .replace(/^["']|["']$/g, ''); // Remove surrounding quotes

      if (!query) {
        console.log(`Usage: /search ${subcommand} "<search term>"`);
        return true;
      }

      console.log(`🔍 Searching for "${query}" (${subcommand} mode)...\n`);

      const results = await codeSearch.search(query, {
        mode: subcommand === 'query' ? 'exact' : subcommand,
        directory: currentDir,
        maxResults: 20,
      });

      if (results.length === 0) {
        console.log('❌ No matches found.');
      } else {
        console.log(
          `✅ Found ${results.length} matches in ${new Set(results.map((r) => r.file)).size} files:\n`
        );

        // Group by file
        const fileGroups = {};
        results.forEach((result) => {
          if (!fileGroups[result.file]) {
            fileGroups[result.file] = [];
          }
          fileGroups[result.file].push(result);
        });

        let matchCount = 1;
        for (const [filePath, fileResults] of Object.entries(fileGroups)) {
          const relativePath = path.relative(currentDir, filePath);
          console.log(`📄 ${relativePath} (${fileResults.length} matches):`);

          fileResults.forEach((result) => {
            const truncated =
              result.content.length > 80
                ? result.content.substring(0, 77) + '...'
                : result.content;
            console.log(`  ${matchCount}. Line ${result.line}: ${truncated}`);
            matchCount++;
          });
          console.log();
        }

        // Show context for first result
        if (results.length > 0) {
          const firstResult = results[0];
          console.log('📋 First match context:');
          console.log(firstResult.preview);
        }
      }
    } else if (subcommand === 'history') {
      const history = codeSearch.getSearchHistory();
      console.log('\n📚 Search History:');
      console.log('═'.repeat(30));

      if (history.length === 0) {
        console.log('No search history available.');
      } else {
        history.forEach((entry, index) => {
          const time = entry.timestamp.toLocaleString();
          const mode = entry.options?.mode || 'exact';
          console.log(`${index + 1}. "${entry.query}" (${mode}) - ${time}`);
        });
      }
    } else if (subcommand === 'stats') {
      const stats = codeSearch.getStats();
      console.log('\n📊 Search Statistics:');
      console.log('═'.repeat(25));
      console.log(`Total searches: ${stats.totalSearches}`);

      console.log('\nSearch modes used:');
      Object.entries(stats.searchModes).forEach(([mode, count]) => {
        console.log(`  ${mode}: ${count}`);
      });

      console.log('\nFile type filters used:');
      Object.entries(stats.fileTypes).forEach(([type, count]) => {
        console.log(`  ${type}: ${count}`);
      });

      if (stats.recentQueries.length > 0) {
        console.log('\nRecent queries:');
        stats.recentQueries.forEach((query, index) => {
          console.log(`  ${index + 1}. "${query}"`);
        });
      }
    } else {
      console.log(`Unknown search subcommand: ${subcommand}`);
      console.log('Use /search for help');
    }

    return true;
  } else if (input.startsWith('/history')) {
    const parts = input.split(' ');
    const subcommand = parts[1];
    const query = parts.slice(2).join(' ');

    if (!subcommand || subcommand === 'search' || subcommand === 'find') {
      if (!query) {
        console.log('Usage: /history search "<query>" [options]');
        console.log('Examples:');
        console.log(
          '  /history search "add file"    - Search for file-related commands'
        );
        console.log(
          '  /history search "/debug"      - Search for debug commands'
        );
        console.log('  /history search              - Show recent commands');
        console.log('\nOptions:');
        console.log(
          '  --limit 10                   - Limit results (default: 20)'
        );
        console.log(
          '  --sort relevance             - Sort by relevance/frequency/timestamp'
        );
        console.log("  --today                      - Only today's commands");
        console.log(
          "  --week                       - Only this week's commands"
        );
        return true;
      }

      // Parse options
      const options = {};
      const cleanQuery = query
        .replace(/--\w+(\s+\w+)?/g, (match) => {
          const [option, value] = match.trim().split(/\s+/);
          const optName = option.substring(2);

          if (optName === 'limit' && value) {
            options.limit = parseInt(value);
          } else if (optName === 'sort' && value) {
            options.sortBy = value;
          } else if (['today', 'week', 'month'].includes(optName)) {
            options.timeRange = optName;
          }

          return '';
        })
        .trim();

      console.log(
        `🔍 Searching command history for: "${cleanQuery || 'recent commands'}"`
      );
      console.log('═'.repeat(50));

      const results = historySearch.searchHistory(cleanQuery, options);

      if (results.length === 0) {
        console.log('❌ No matching commands found.');
      } else {
        console.log(
          historySearch.formatResults(results, {
            showTimestamps: true,
            showScores: !!cleanQuery,
            maxLength: 100,
          })
        );
      }
    } else if (subcommand === 'recent' || subcommand === 'last') {
      const limit = parseInt(parts[2]) || 10;
      console.log(`📋 Recent command history (last ${limit} commands):`);
      console.log('═'.repeat(50));

      const results = historySearch.getRecentHistory(limit);
      console.log(
        historySearch.formatResults(results, {
          showTimestamps: true,
          maxLength: 80,
        })
      );
    } else if (subcommand === 'stats' || subcommand === 'info') {
      const stats = historySearch.getStatistics();
      console.log('\n📊 Command History Statistics:');
      console.log('═'.repeat(35));
      console.log(`Total Commands: ${stats.totalCommands}`);
      console.log(`Session Commands: ${stats.sessionCommands}`);
      console.log(`Unique Commands: ${stats.uniqueCommands}`);
      console.log(`Today's Commands: ${stats.todayCommands}`);
      console.log(`This Week: ${stats.weekCommands}`);
      console.log(`This Month: ${stats.monthCommands}`);
      console.log(`Avg/Day (30d): ${stats.averageCommandsPerDay.toFixed(1)}`);

      if (stats.topCommands.length > 0) {
        console.log('\n🏆 Most Used Commands:');
        stats.topCommands.slice(0, 5).forEach((cmd, index) => {
          console.log(`  ${index + 1}. "${cmd.command}" (${cmd.count} times)`);
        });
      }
    } else if (subcommand === 'clear') {
      const { inquirer } = await import('inquirer');
      const { confirm } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirm',
          message: 'Are you sure you want to clear all command history?',
          default: false,
        },
      ]);

      if (confirm) {
        historySearch.clearHistory();
        console.log('✅ Command history cleared.');
      } else {
        console.log('❌ History clear cancelled.');
      }
    } else if (subcommand === 'delete') {
      const deleteQuery = parts.slice(2).join(' ');
      if (!deleteQuery) {
        console.log('Usage: /history delete "<query>"');
        console.log('Examples:');
        console.log(
          '  /history delete "old command"    - Delete specific command'
        );
        console.log(
          '  /history delete --older-than 2024-01-01  - Delete old commands'
        );
        return true;
      }

      const criteria = {};
      if (deleteQuery.startsWith('--older-than')) {
        const dateStr = deleteQuery.split(' ')[1];
        if (dateStr) {
          criteria.olderThan = dateStr;
        }
      } else {
        criteria.query = deleteQuery;
      }

      const deletedCount = historySearch.deleteFromHistory(criteria);
      console.log(`🗑️ Deleted ${deletedCount} command(s) from history.`);
    } else if (subcommand === 'export') {
      const format = parts[2] || 'json';
      const exportedData = historySearch.exportHistory(format, { limit: 100 });

      const filename = `command-history.${format}`;
      const exportPath = path.join(currentDir, filename);

      fs.writeFileSync(exportPath, exportedData);
      console.log(`📤 Command history exported to: ${filename}`);
      console.log(
        `Format: ${format}, Commands: ${historySearch.getStatistics().totalCommands}`
      );
    } else if (subcommand === 'help') {
      console.log('🕐 Command History Help');
      console.log('═'.repeat(25));
      console.log('Search and manage your command history.\n');
      console.log('Commands:');
      console.log('  /history search "<query>"    - Search command history');
      console.log('  /history recent [limit]      - Show recent commands');
      console.log('  /history stats               - Show history statistics');
      console.log('  /history clear               - Clear all history');
      console.log('  /history delete "<query>"    - Delete specific commands');
      console.log(
        '  /history export [format]     - Export history (json/csv/txt)'
      );
      console.log('  /history help                - Show this help');
      console.log('\nSearch Options:');
      console.log('  --limit N                    - Limit results');
      console.log('  --sort relevance|frequency|timestamp - Sort order');
      console.log('  --today/--week/--month       - Time range filter');
    } else {
      console.log(
        'Unknown history subcommand. Use /history help for available commands.'
      );
    }

    return true;
  } else if (input.startsWith('/suggest')) {
    const parts = input.split(' ');
    const subcommand = parts[1];

    if (!subcommand || subcommand === 'show' || subcommand === 'get') {
      console.log('🧠 Analyzing your current context...\n');

      // Gather current context
      const context = {
        currentDir: currentDir,
        recentCommands: commandHistory.slice(-5).map(cmd => typeof cmd === 'string' ? cmd : ''),
        openFiles: Object.keys(fileContext),
        conversationHistory: messages.slice(-10),
        projectInfo: {},
        timeOfDay: new Date().getHours(),
        userPreferences: {}
      };

      // Generate suggestions
      const suggestions = contextualSuggestions.generateSuggestions(context);

      if (suggestions.length === 0) {
        console.log('🤔 No contextual suggestions available at this time.');
        console.log('Try using more commands or working with files to get personalized suggestions.');
      } else {
        console.log(contextualSuggestions.formatSuggestions(suggestions));
      }
    } else if (subcommand === 'stats') {
      const stats = contextualSuggestions.getStats();
      console.log('\n🧠 Contextual Suggestions Statistics:');
      console.log('═'.repeat(40));
      console.log(`Max Suggestions: ${stats.maxSuggestions}`);
      console.log(`Confidence Threshold: ${stats.confidenceThreshold}`);
      console.log(`Learning Enabled: ${stats.learningEnabled ? '✅' : '❌'}`);
      console.log('\nLearning Data:');
      console.log(`  User Preferences: ${stats.learningDataSize.userPreferences}`);
      console.log(`  Command Sequences: ${stats.learningDataSize.commandSequences}`);
      console.log(`  Context Patterns: ${stats.learningDataSize.contextPatterns}`);
      console.log(`  Temporal Patterns: ${stats.learningDataSize.temporalPatterns}`);
    } else if (subcommand === 'reset') {
      const { inquirer } = await import('inquirer');
      const { confirm } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirm',
          message: 'Reset all learning data for contextual suggestions?',
          default: false
        }
      ]);

      if (confirm) {
        contextualSuggestions.resetLearningData();
        console.log('✅ Contextual suggestions learning data reset.');
      } else {
        console.log('❌ Reset cancelled.');
      }
    } else if (subcommand === 'help') {
      console.log('🧠 Contextual Suggestions Help');
      console.log('═'.repeat(30));
      console.log('Get intelligent command suggestions based on your current context.\n');
      console.log('Commands:');
      console.log('  /suggest show     - Show contextual suggestions');
      console.log('  /suggest stats    - Show suggestion statistics');
      console.log('  /suggest reset    - Reset learning data');
      console.log('  /suggest help     - Show this help');
      console.log('\nThe system learns from your usage patterns and suggests');
      console.log('commands that might be useful based on:');
      console.log('• Current project and files');
      console.log('• Recent command history');
      console.log('• Time of day and work patterns');
      console.log('• Conversation context and topics');
    } else {
      console.log('Unknown suggest subcommand. Use /suggest help for available commands.');
    }

    return true;
  } else if (input.startsWith('/diagram')) {
    const parts = input.split(' ');
    const subcommand = parts[1];
    const args = parts.slice(2);

    if (!subcommand || subcommand === 'show' || subcommand === 'generate') {
      console.log('🖼️  Generating workflow diagram...\n');

      // Try to get RPG plan from conversation history
      let rpgPlan = null;

      // Look for RPG plan in recent messages
      for (let i = messages.length - 1; i >= Math.max(0, messages.length - 10); i--) {
        const message = messages[i];
        if (message.role === 'assistant' && message.content) {
          try {
            // Try to extract JSON from the message
            const jsonMatch = message.content.match(/```json\s*(\{[\s\S]*?\})\s*```/);
            if (jsonMatch) {
              const parsed = JSON.parse(jsonMatch[1]);
              if (parsed.features && parsed.files) {
                rpgPlan = parsed;
                break;
              }
            }
          } catch (error) {
            // Continue searching
          }
        }
      }

      if (!rpgPlan) {
        // Create a demo plan for testing
        rpgPlan = {
          features: ['user_auth', 'data_processing', 'api_endpoints', 'frontend_ui'],
          files: {
            'src/auth.js': 'user_auth',
            'src/middleware.js': 'user_auth',
            'src/data.js': 'data_processing',
            'src/processor.js': 'data_processing',
            'src/api.js': 'api_endpoints',
            'src/routes.js': 'api_endpoints',
            'src/app.js': 'frontend_ui',
            'src/components.js': 'frontend_ui'
          },
          flows: [
            ['user_auth', 'data_processing'],
            ['data_processing', 'api_endpoints'],
            ['api_endpoints', 'frontend_ui']
          ],
          deps: [
            ['src/auth.js', 'src/middleware.js'],
            ['src/data.js', 'src/processor.js'],
            ['src/api.js', 'src/routes.js'],
            ['src/app.js', 'src/components.js'],
            ['src/middleware.js', 'src/api.js']
          ]
        };

        console.log('📝 Using demo RPG plan (no recent plan found)\n');
      }

      // Determine diagram type
      let diagramType = 'flowchart';
      let diagramTitle = 'RPG Plan Visualization';
      let compact = false;

      if (args.length > 0) {
        const typeArg = args[0].toLowerCase();
        if (['flowchart', 'mindmap', 'dependency', 'overview'].includes(typeArg)) {
          diagramType = typeArg;
        }

        if (args.includes('--compact')) {
          compact = true;
        }

        // Check for title
        const titleIndex = args.findIndex(arg => arg === '--title');
        if (titleIndex !== -1 && args[titleIndex + 1]) {
          diagramTitle = args[titleIndex + 1];
        }
      }

      try {
        const diagram = workflowDiagram.generateDiagram(rpgPlan, {
          type: diagramType,
          title: diagramTitle,
          compact,
          showStats: true
        });

        console.log(diagram);
      } catch (error) {
        console.log(`❌ Failed to generate diagram: ${error.message}`);
        console.log('Try: /diagram flowchart --compact');
      }
    } else if (subcommand === 'style') {
      const style = args[0];
      if (style && workflowDiagram.getAvailableStyles().includes(style)) {
        workflowDiagram.setStyle(style);
        console.log(`🎨 Diagram style changed to: ${style}`);
      } else {
        console.log(`❌ Invalid style. Available styles: ${workflowDiagram.getAvailableStyles().join(', ')}`);
      }
    } else if (subcommand === 'styles') {
      const styles = workflowDiagram.getAvailableStyles();
      console.log('🎨 Available diagram styles:');
      styles.forEach(style => {
        console.log(`  • ${style}`);
      });
    } else if (subcommand === 'types') {
      console.log('📊 Available diagram types:');
      console.log('  • flowchart  - Flowchart-style diagram');
      console.log('  • mindmap    - Mind map with hierarchical layout');
      console.log('  • dependency - File dependency graph');
      console.log('  • overview   - Statistical overview');
    } else if (subcommand === 'help') {
      console.log('🖼️  Workflow Diagram Help');
      console.log('═'.repeat(25));
      console.log('Generate beautiful ASCII art diagrams from RPG plans.\n');
      console.log('Commands:');
      console.log('  /diagram show [type] [options]  - Generate diagram from recent RPG plan');
      console.log('  /diagram style <style>          - Change diagram style');
      console.log('  /diagram styles                 - List available styles');
      console.log('  /diagram types                  - List available diagram types');
      console.log('  /diagram help                   - Show this help');
      console.log('\nDiagram Types:');
      console.log('  flowchart  - Feature and file flow diagram');
      console.log('  mindmap    - Hierarchical mind map layout');
      console.log('  dependency - File dependency relationships');
      console.log('  overview   - Statistical summary');
      console.log('\nOptions:');
      console.log('  --compact    - Use compact layout');
      console.log('  --title "T"  - Custom diagram title');
      console.log('\nStyles: default, minimal, fancy');
    } else {
      console.log('Unknown diagram subcommand. Use /diagram help for available commands.');
    }

    return true;
  } else if (input.startsWith('/progress')) {
    const parts = input.split(' ');
    const subcommand = parts[1];
    const args = parts.slice(2);

    if (!subcommand || subcommand === 'status' || subcommand === 'show') {
      console.log('📊 Progress Tracking Status\n');

      const activeOps = progressTracker.getActiveOperations();
      const stats = progressTracker.getStats();

      if (activeOps.length === 0) {
        console.log('✅ No active operations currently running.\n');
      } else {
        console.log('🔄 Active Operations:');
        activeOps.forEach(op => {
          const duration = Math.round((Date.now() - op.startTime) / 1000);
          const eta = op.estimatedDuration ? Math.round((op.estimatedDuration - (Date.now() - op.startTime)) / 1000) : null;

          console.log(`  📋 ${op.name} (${op.id})`);
          console.log(`     Progress: ${op.progress.toFixed(1)}% (${op.currentStep}/${op.totalSteps} steps)`);
          console.log(`     Duration: ${duration}s${eta ? ` | ETA: ${eta}s` : ''}`);
          console.log(`     Status: ${op.status}`);
          if (op.errors.length > 0) {
            console.log(`     ⚠️  Errors: ${op.errors.length}`);
          }
          console.log('');
        });
      }

      // Show statistics
      console.log('📈 Overall Statistics:');
      console.log(`  Total Operations: ${stats.totalOperations}`);
      console.log(`  Completed: ${stats.completedOperations}`);
      console.log(`  Failed: ${stats.failedOperations}`);
      console.log(`  Success Rate: ${stats.successRate.toFixed(1)}%`);
      console.log(`  Average Duration: ${Math.round(stats.averageDuration / 1000)}s`);
      console.log(`  Active Now: ${stats.activeOperations}`);
    } else if (subcommand === 'history') {
      const limit = args[0] ? parseInt(args[0]) : 10;
      const history = progressTracker.getOperationHistory({ limit });

      if (history.length === 0) {
        console.log('📜 No operation history available.');
        return true;
      }

      console.log(`📜 Operation History (Last ${limit} operations):\n`);

      history.forEach(op => {
        const duration = Math.round(op.duration / 1000);
        const statusIcon = op.status === 'completed' ? '✅' : '❌';
        const timeAgo = Math.round((Date.now() - op.endTime) / 1000 / 60); // minutes ago

        console.log(`${statusIcon} ${op.name}`);
        console.log(`   Duration: ${duration}s | ${timeAgo}min ago | ${op.status}`);
        if (op.errors && op.errors.length > 0) {
          console.log(`   ⚠️  Errors: ${op.errors.length}`);
        }
        console.log('');
      });
    } else if (subcommand === 'report') {
      console.log('📊 Performance Report\n');

      const report = progressTracker.generatePerformanceReport();

      console.log('Overall Statistics:');
      console.log(`  Total Operations: ${report.stats.totalOperations}`);
      console.log(`  Success Rate: ${report.stats.successRate.toFixed(1)}%`);
      console.log(`  Average Duration: ${Math.round(report.stats.averageDuration / 1000)}s`);
      console.log(`  Currently Active: ${report.activeOperations}\n`);

      console.log('Category Breakdown:');
      Object.entries(report.categoryBreakdown).forEach(([category, stats]) => {
        console.log(`  ${category}:`);
        console.log(`    Total: ${stats.total} | Success: ${stats.completed} | Failed: ${stats.failed}`);
        console.log(`    Avg Duration: ${Math.round(stats.averageDuration / 1000)}s`);
      });

      if (report.recentHistory.length > 0) {
        console.log('\nRecent Operations:');
        report.recentHistory.slice(-5).forEach(op => {
          const duration = Math.round(op.duration / 1000);
          const statusIcon = op.status === 'completed' ? '✅' : '❌';
          console.log(`  ${statusIcon} ${op.name} (${duration}s)`);
        });
      }
    } else if (subcommand === 'export') {
      const format = args[0] || 'json';
      const data = progressTracker.exportOperations(format);

      console.log(`📄 Operation Data Export (${format.toUpperCase()}):\n`);
      console.log(data);
      console.log(`\n💡 Tip: Save this output to a file for external analysis`);
    } else if (subcommand === 'reset') {
      const { inquirer } = await import('inquirer');
      const { confirm } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirm',
          message: 'Reset all progress tracking data? This cannot be undone.',
          default: false
        }
      ]);

      if (confirm) {
        progressTracker.reset();
        console.log('✅ Progress tracking data has been reset.');
      } else {
        console.log('❌ Reset cancelled.');
      }
    } else if (subcommand === 'demo') {
      console.log('🎭 Running Progress Tracker Demo...\n');

      // Create a demo operation with multiple steps
      const demoOpId = progressTracker.startOperation('Progress Tracker Demo', {
        totalSteps: 5,
        category: 'demo',
        showProgress: true,
        showETA: true
      });

      // Simulate a multi-step operation
      setTimeout(() => {
        progressTracker.updateProgress(demoOpId, 20, { step: 1, stepName: 'Initializing' });
      }, 500);

      setTimeout(() => {
        progressTracker.updateProgress(demoOpId, 40, { step: 2, stepName: 'Processing Data' });
      }, 1500);

      setTimeout(() => {
        progressTracker.updateProgress(demoOpId, 60, { step: 3, stepName: 'Analyzing Results' });
      }, 2500);

      setTimeout(() => {
        progressTracker.updateProgress(demoOpId, 80, { step: 4, stepName: 'Generating Output' });
      }, 3500);

      setTimeout(() => {
        progressTracker.updateProgress(demoOpId, 100, { step: 5, stepName: 'Finalizing' });
        progressTracker.completeOperation(demoOpId, { success: true });
        console.log('\n✅ Demo completed! Use /progress status to see the results.');
      }, 4500);

      console.log('🎬 Demo operation started! Watch the progress indicators above.');
      console.log('💡 Use /progress status during the demo to see live updates.\n');
    } else if (subcommand === 'help') {
      console.log('📊 Progress Tracking Help');
      console.log('═'.repeat(25));
      console.log('Track and monitor long-running operations with visual feedback.\n');
      console.log('Commands:');
      console.log('  /progress status       - Show current operation status and statistics');
      console.log('  /progress history [N]  - Show last N operations (default: 10)');
      console.log('  /progress report       - Generate detailed performance report');
      console.log('  /progress export [fmt] - Export operation data (json/csv)');
      console.log('  /progress reset        - Reset all tracking data');
      console.log('  /progress demo         - Run a demonstration of progress tracking');
      console.log('  /progress help         - Show this help');
      console.log('\nFeatures:');
      console.log('• Real-time progress bars for multi-step operations');
      console.log('• ETA calculations and duration tracking');
      console.log('• Operation history and performance analytics');
      console.log('• Nested operation support (parent/child relationships)');
      console.log('• Success rate and error tracking');
      console.log('• Category-based operation organization');
    } else {
      console.log('Unknown progress subcommand. Use /progress help for available commands.');
    }

    return true;
  } else if (input.startsWith('/confirm')) {
    const parts = input.split(' ');
    const subcommand = parts[1];
    const args = parts.slice(2);

    if (!subcommand || subcommand === 'demo') {
      console.log('🎭 Running Confirmation Dialog Demo...\n');

      // Demo 1: Basic file operation confirmation
      console.log('Demo 1: File Operation Confirmation');
      const confirmed1 = await confirmDialog.confirmFileOperation({
        operation: 'modify_source_files',
        files: [
          'src/main.js',
          'src/utils.js',
          'package.json'
        ],
        action: 'modify',
        description: 'This will refactor the main application files to use async/await patterns.',
        warnings: ['May break existing functionality if not tested thoroughly']
      });

      console.log(`Result: ${confirmed1 ? '✅ Confirmed' : '❌ Cancelled'}\n`);

      if (!confirmed1) return true;

      // Demo 2: Destructive operation with typing confirmation
      console.log('Demo 2: Destructive Operation (requires typing confirmation)');
      const confirmed2 = await confirmDialog.confirmDestructiveOperation({
        operation: 'delete_database',
        description: 'This will permanently delete the development database and all associated data.',
        impact: {
          affectedFiles: 1,
          affectedLines: 0,
          dependencies: ['application data', 'user sessions']
        },
        requiresTyping: true,
        confirmationPhrase: 'DELETE DATABASE'
      });

      console.log(`Result: ${confirmed2 ? '✅ Confirmed' : '❌ Cancelled'}\n`);

      // Demo 3: Multiple choice confirmation
      console.log('Demo 3: Multiple Choice Confirmation');
      const confirmed3 = await confirmDialog.confirm({
        message: 'Choose how to handle the configuration conflict:',
        type: 'warning',
        operation: 'resolve_config_conflict',
        choices: [
          { label: 'Overwrite local config with remote', value: 'overwrite' },
          { label: 'Keep local config and ignore remote', value: 'keep_local' },
          { label: 'Merge configurations manually', value: 'merge' },
          { label: 'Cancel operation', value: 'cancel' }
        ],
        impact: {
          riskLevel: 'medium',
          affectedFiles: 2,
          breakingChanges: false
        }
      });

      console.log(`Result: ${confirmed3 ? '✅ Option selected' : '❌ Cancelled'}\n`);

    } else if (subcommand === 'stats') {
      const stats = confirmDialog.getStatistics();
      console.log('\n📊 Confirmation Dialog Statistics:\n');
      console.log(`Total Confirmations: ${stats.total}`);
      console.log(`Confirmed: ${stats.confirmed}`);
      console.log(`Denied: ${stats.denied}`);
      console.log(`Confirmation Rate: ${stats.confirmationRate}%`);

      if (stats.lastConfirmation) {
        const lastTime = new Date(stats.lastConfirmation.timestamp).toLocaleString();
        console.log(`Last Confirmation: ${lastTime} (${stats.lastConfirmation.operation})`);
      }
    } else if (subcommand === 'history') {
      const limit = args[0] ? parseInt(args[0]) : 5;
      const history = confirmDialog.getConfirmationHistory({ limit });

      if (history.length === 0) {
        console.log('📜 No confirmation history available.');
        return true;
      }

      console.log(`📜 Confirmation History (Last ${limit} entries):\n`);

      history.forEach(entry => {
        const time = new Date(entry.timestamp).toLocaleString();
        const status = entry.confirmed ? '✅' : '❌';
        console.log(`${status} ${entry.operation} - ${time}`);
        console.log(`   Files: ${entry.files} | Changes: ${entry.changes} | Warnings: ${entry.warnings}\n`);
      });
    } else if (subcommand === 'reset') {
      const { inquirer } = await import('inquirer');
      const { confirm } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirm',
          message: 'Reset confirmation history?',
          default: false
        }
      ]);

      if (confirm) {
        confirmDialog.resetHistory();
        console.log('✅ Confirmation history reset.');
      } else {
        console.log('❌ Reset cancelled.');
      }
    } else if (subcommand === 'help') {
      console.log('✅ Confirmation Dialog Help');
      console.log('═'.repeat(27));
      console.log('Rich confirmation dialogs with previews, warnings, and impact assessment.\n');
      console.log('Commands:');
      console.log('  /confirm demo     - Run interactive confirmation demos');
      console.log('  /confirm stats    - Show confirmation statistics');
      console.log('  /confirm history  - Show confirmation history');
      console.log('  /confirm reset    - Reset confirmation history');
      console.log('  /confirm help     - Show this help');
      console.log('\nFeatures:');
      console.log('• File previews with syntax highlighting');
      console.log('• Change previews with diff display');
      console.log('• Impact assessment and risk analysis');
      console.log('• Warning system with safety checks');
      console.log('• Typing confirmations for dangerous operations');
      console.log('• Multiple choice options');
      console.log('• Confirmation history and analytics');
    } else {
      console.log('Unknown confirm subcommand. Use /confirm help for available commands.');
    }

    return true;
  } else if (input.startsWith('/complete')) {
    const parts = input.split(' ');
    const subcommand = parts[1];
    const query = parts.slice(2).join(' ');

    if (!subcommand || subcommand === 'test') {
      if (!query) {
        console.log('Usage: /complete test "<partial command or path>"');
        console.log('Examples:');
        console.log('  /complete test "/add"');
        console.log('  /complete test "lib/"');
        console.log('  /complete test "/debug"');
        return true;
      }

      console.log(`\n🧠 Testing auto-complete for: "${query}"`);
      console.log('═'.repeat(40));

      const completions = autoComplete.getCompletions(query, query.length, {
        currentDir: currentDir,
        fileContext: fileContext,
      });

      if (completions.completions.length === 0) {
        console.log('❌ No completions found.');
      } else {
        console.log(
          `✅ Found ${completions.completions.length} completions:\n`
        );

        completions.completions.forEach((completion, index) => {
          const icon = this.getCompletionIcon(completion.type);
          console.log(`${index + 1}. ${icon} ${completion.display}`);
          if (completion.description) {
            console.log(`   ${completion.description}`);
          }
          console.log(`   → ${completion.value}\n`);
        });
      }
    } else if (subcommand === 'status') {
      const stats = autoComplete.getStats();
      console.log('\n⚡ Auto-Complete Status:');
      console.log('═'.repeat(35));
      console.log(`Max Suggestions: ${stats.maxSuggestions}`);
      console.log(`Include Hidden Files: ${stats.includeHidden ? '✅' : '❌'}`);
      console.log(`Case Sensitive: ${stats.caseSensitive ? '✅' : '❌'}`);
      console.log(`Fuzzy Matching: ${stats.fuzzyMatch ? '✅' : '❌'}`);
      console.log(`Available Commands: ${stats.availableCommands}`);
      console.log(`Available Models: ${stats.availableModels}`);
      console.log(`Cache Size: ${stats.cacheSize} entries`);
    } else if (subcommand === 'config') {
      const configArgs = parts.slice(2);
      const config = {};

      for (let i = 0; i < configArgs.length; i += 2) {
        const key = configArgs[i];
        const value = configArgs[i + 1];

        if (value !== undefined) {
          if (value === 'true' || value === 'false') {
            config[key] = value === 'true';
          } else if (!isNaN(value)) {
            config[key] = parseInt(value);
          } else {
            config[key] = value;
          }
        }
      }

      if (Object.keys(config).length === 0) {
        console.log('Usage: /complete config <option> <value> [...]');
        console.log('Options:');
        console.log('  maxSuggestions <number>  - Max completion suggestions');
        console.log('  includeHidden <true|false> - Include hidden files');
        console.log('  caseSensitive <true|false> - Case sensitive matching');
        console.log('  fuzzyMatch <true|false>   - Enable fuzzy matching');
        console.log('Examples:');
        console.log('  /complete config maxSuggestions 20 fuzzyMatch false');
        return true;
      }

      autoComplete.updateConfig(config);
      console.log('✅ Auto-complete configuration updated');
      console.log('Current config:', autoComplete.getStats());
    } else {
      console.log('Usage: /complete <test|status|config>');
      console.log('Commands:');
      console.log(
        '  /complete test "<query>"    - Test completion for a query'
      );
      console.log('  /complete status            - Show auto-complete status');
      console.log(
        '  /complete config <options>  - Configure auto-complete settings'
      );
    }

    return true;
  } else if (input.startsWith('/debug')) {
    const args = input.split(' ').slice(1);
    const result = await debugCommand.execute(args, {
      cwd: currentDir,
      messages,
      fileContext,
      client,
      model,
      ora,
      inquirer,
    });

    if (result && result.success !== false) {
      return true;
    }

    return true;
  }

  // Helper function for completion icons
  function getCompletionIcon(type) {
    const icons = {
      command: '📝',
      builtin: '⚡',
      custom: '🔧',
      file: '📄',
      directory: '📁',
      model: '🤖',
      setting: '⚙️',
      action: '🔄',
      'git-command': '🔀',
      'highlight-command': '🎨',
      'diff-command': '📊',
      'progress-command': '⏳',
      'browse-command': '🗂️',
      'preview-command': '👁️',
      'search-mode': '🔍',
      'debug-command': '🐛',
      'pr-template': '📋',
      theme: '🎭',
    };
    return icons[type] || '❓';
  }

  if (input === '/clear') {
    messages = [{ role: 'system', content: systemPrompt }];
    fileContext = {};
    console.clear();
    console.log(
      "Welcome to Grok Code! Type your message or use /help for commands. Type 'exit' or '/exit' to quit.\n"
    );
    return true;
  } else if (input === '/undo') {
    const result = undoLastAction();
    if (result.success) {
      console.log(`✅ ${result.message}`);
      // Add undo action to conversation memory
      messages.push({ role: 'assistant', content: result.message });
      saveConversationHistory(messages);
    } else {
      console.log(`❌ ${result.message}`);
      messages.push({ role: 'assistant', content: result.message });
      saveConversationHistory(messages);
    }
    return true;
  } else if (input === '/update' || input.toLowerCase() === 'update') {
    console.log('Checking for updates...');
    const updateCheck = await checkForUpdates();

    if (updateCheck.hasUpdate) {
      console.log(
        `🔄 Update available! Current: v${updateCheck.currentVersion} → Latest: v${updateCheck.latestVersion}`
      );
      const updateAnswers = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirm',
          message: 'Would you like to update now?',
        },
      ]);
      if (updateAnswers.confirm) {
        const success = await performUpdate(updateCheck.downloadUrl);
        if (success) {
          process.exit(0); // Exit after successful update
        }
      }
    } else if (updateCheck.isAhead) {
      console.log(
        `🚀 Development version! Current: v${updateCheck.currentVersion} (ahead of latest release: v${updateCheck.latestVersion})`
      );
      console.log(
        'You are already running a development version newer than the latest release.'
      );
      console.log(
        'To get the latest stable release, you may need to switch to the main branch or wait for a new release.'
      );
    } else {
      console.log(
        `✅ You are running the latest version: v${updateCheck.currentVersion}`
      );
    }

    if (updateCheck.error) {
      console.log(`❌ Could not check for updates: ${updateCheck.error}`);
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
          temperature: 0.7,
        });
        spinner.stop();
        let grokResponse = response.choices[0].message.content;

        // Apply syntax highlighting to code blocks
        grokResponse = processCodeBlocks(grokResponse, syntaxHighlighter);

        console.log(`\nGrok: ${grokResponse}\n`);
        await parseAndApplyActions(grokResponse, messages, fileContext);
        messages.push({ role: 'assistant', content: grokResponse });
      } catch (error) {
        spinner.stop();
        console.error('API error:', error);
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
    logger.debug('Parsing and applying actions', {
      responseLength: responseText.length,
    });

    const parser = new xml2js.Parser({ explicitArray: false });

    // Pre-process responseText to escape unescaped ampersands in command attributes
    let processedText = responseText.replace(
      /<run command="([^"]*)">/g,
      (match, commandAttr) => {
        // Escape unescaped ampersands in command attributes
        const escapedCommand = commandAttr.replace(
          /&(?!(?:amp|lt|gt|quot|apos);)/g,
          '&amp;'
        );
        return `<run command="${escapedCommand}">`;
      }
    );

    const edits = processedText.match(/<edit[^>]*>[\s\S]*?<\/edit>/g) || [];
    const deletes = processedText.match(/<delete[^>]*><\/delete>/g) || [];
    const runs = processedText.match(/<run[^>]*><\/run>/g) || [];

    if (edits.length === 0 && deletes.length === 0 && runs.length === 0) {
      logger.debug('No actions found in response');
      return;
    }

    console.log('\nProposed actions:');
    for (const run of runs) {
      const parsed = await parser.parseStringPromise(run);
      console.log(
        `Run command: ${parsed.run.$.command.replace(/&amp;/g, '&')}`
      );
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
      answers = await inquirer.prompt([
        { type: 'confirm', name: 'confirm', message: 'Apply these actions?' },
      ]);
    } catch (promptError) {
      logger.error('Error with confirmation prompt', promptError);
      console.log('❌ Error with confirmation prompt. Actions not applied.');
      return;
    }

    if (!answers.confirm) {
      logger.info('User declined to apply actions');
      console.log('Actions not applied.');
      return;
    }

    logger.info('User confirmed actions', {
      runs: runs.length,
      edits: edits.length,
      deletes: deletes.length,
    });

    // Apply runs first
    for (const run of runs) {
      try {
        const parsed = await parser.parseStringPromise(run);
        const cmd = parsed.run.$.command.replace(/&amp;/g, '&'); // Unescape ampersands back for execution

        logger.debug('Executing command', { command: cmd });

        try {
          const result = execSync(cmd, { encoding: 'utf8' }); // 10 second timeout
          console.log(`Command '${cmd}' output:\n${result}`);
          messages.push({
            role: 'system',
            content: `Command '${cmd}' output:\n${result}`,
          });
          logger.info('Command executed successfully', {
            command: cmd,
            outputLength: result.length,
          });
        } catch (execError) {
          logger.warn('Command execution failed', {
            command: cmd,
            error: execError.message,
          });
          console.log(
            `Error executing '${cmd}': ${execError.stderr || execError.message}`
          );
          messages.push({
            role: 'system',
            content: `Command '${cmd}' error:\n${execError.stderr || execError.message}`,
          });
        }
      } catch (parseError) {
        logger.error('Failed to parse run command', parseError, {
          runTag: run,
        });
        console.log(`❌ Failed to parse command: ${parseError.message}`);
      }
    }

    // Apply edits
    for (const edit of edits) {
      try {
        const parsed = await parser.parseStringPromise(edit);
        const filename = parsed.edit.$.file;
        const content = parsed.edit._; // Assuming CDATA is handled as text

        logger.debug('Applying file edit', { filename });

        try {
          // Record action for undo capability
          const originalContent = fs.existsSync(filename)
            ? fs.readFileSync(filename, 'utf8')
            : undefined;
          recordAction({
            type: 'file_edit',
            filepath: filename,
            originalContent,
            newContent: content,
          });

          fs.ensureDirSync(path.dirname(filename));
          fs.writeFileSync(filename, content);
          console.log(`✅ Saved ${filename}.`);
          fileContext[filename] = content;
          logger.info('File saved successfully', {
            filename,
            contentLength: content.length,
          });
        } catch (fileError) {
          logger.error('Failed to save file', fileError, { filename });
          console.log(`❌ Failed to save ${filename}: ${fileError.message}`);
        }
      } catch (parseError) {
        logger.error('Failed to parse edit command', parseError, {
          editTag: edit,
        });
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
            // Record action for undo capability
            const originalContent = fs.readFileSync(filename, 'utf8');
            recordAction({
              type: 'file_delete',
              filepath: filename,
              originalContent,
            });

            fs.unlinkSync(filename);
            console.log(`🗑️  Deleted ${filename}.`);
            delete fileContext[filename];
            logger.info('File deleted successfully', { filename });
          } catch (deleteError) {
            logger.error('Failed to delete file', deleteError, { filename });
            console.log(
              `❌ Failed to delete ${filename}: ${deleteError.message}`
            );
          }
        } else {
          logger.warn('File not found for deletion', { filename });
          console.log(`⚠️  File ${filename} not found for deletion.`);
        }
      } catch (parseError) {
        logger.error('Failed to parse delete command', parseError, {
          deleteTag: del,
        });
        console.log(`❌ Failed to parse delete: ${parseError.message}`);
      }
    }

    try {
      const updatedFiles = fs.readdirSync('.');
      messages.push({
        role: 'system',
        content: `Actions applied. Updated files in directory: ${updatedFiles.join(', ')}`,
      });
      logger.info('All actions completed successfully');
    } catch (fsError) {
      logger.error('Failed to read directory after actions', fsError);
    }
  } catch (error) {
    logger.error('Critical error in parseAndApplyActions', error, {
      responseText: responseText.substring(0, 500),
    });
    console.log(
      `💥 Critical error processing actions. Check .grok/error.log for details.`
    );
  }
}
