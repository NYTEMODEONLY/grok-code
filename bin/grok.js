#!/usr/bin/env node

const { program } = require('commander');
const inquirer = require('inquirer');
const fs = require('fs-extra');
const path = require('path');
const { execSync } = require('child_process');
const OpenAI = require('openai');
const ora = require('ora');
const xml2js = require('xml2js');

program
  .name('grok')
  .description('Grok Code CLI')
  .version('1.0.0');

program.action(async () => {
  await main();
});

program.parse();

async function main() {
  const configDir = path.join(process.env.HOME || process.env.USERPROFILE, '.grok');
  const keyFile = path.join(configDir, 'api_key');
  fs.ensureDirSync(configDir);

  let apiKey = process.env.XAI_API_KEY;
  if (!apiKey) {
    if (fs.existsSync(keyFile)) {
      apiKey = fs.readFileSync(keyFile, 'utf8').trim();
      const { choice } = await inquirer.prompt([
        {
          type: 'list',
          name: 'choice',
          message: 'Found saved API key. What would you like to do?',
          choices: ['Use existing key', 'Change key', 'Delete key']
        }
      ]);
      if (choice === 'Change key') {
        apiKey = (await inquirer.prompt([{ type: 'input', name: 'key', message: 'Enter new xAI API key:' }])).key.trim();
        fs.writeFileSync(keyFile, apiKey);
      } else if (choice === 'Delete key') {
        fs.unlinkSync(keyFile);
        apiKey = null;
      }
    }
    if (!apiKey) {
      apiKey = (await inquirer.prompt([{ type: 'input', name: 'key', message: 'Enter your xAI API key:' }])).key.trim();
      fs.writeFileSync(keyFile, apiKey);
    }
  }

  const client = new OpenAI({
    baseURL: 'https://api.x.ai/v1',
    apiKey
  });

  const model = 'grok-3-beta';

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

  let messages = [{ role: 'system', content: systemPrompt }];
  let fileContext = {};

  console.log("Welcome to Grok Code! Type your message or use /help for commands. Type '/exit' to quit.\n");

  while (true) {
    const { input } = await inquirer.prompt([{ type: 'input', name: 'input', message: 'You:', prefix: '' }]);
    let userInput = input.trim();

    if (userInput.toLowerCase() === '/exit') {
      console.log("Exiting Grok Code. Happy coding!");
      break;
    }

    const handled = await handleCommand(userInput, messages, fileContext, client, model);
    if (handled) continue;

    messages.push({ role: 'user', content: userInput });

    if (Object.keys(fileContext).length > 0) {
      const contextStr = Object.entries(fileContext).map(([f, c]) => `File ${f}:\n${c}`).join('\n');
      messages.push({ role: 'system', content: `Current file context:\n${contextStr}` });
    }

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

      if (Object.keys(fileContext).length > 0) {
        messages.splice(messages.length - 2, 1);  // Remove temp context
      }
    } catch (error) {
      spinner.stop();
      console.error("API error:", error);
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
  } else if (input === '/help') {
    console.log(`Commands:
- /add <file>: Add file to context
- /remove <file>: Remove file from context
- /scan: Scan and add all files to context
- /ls: List files in directory
- /run <cmd>: Run shell command
- /git <command>: Run git command (e.g., /git status)
- /init-git: Initialize git repo
- /commit <message>: Commit changes
- /push: Push to remote
- /clear: Clear conversation history
- /exit: Quit
- Custom: /<custom_name> for user-defined in .grok/commands/
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
  } else if (input === '/push') {
    try {
      const result = execSync('git push', { encoding: 'utf8' });
      console.log(result);
      messages.push({ role: 'system', content: `Git push output:\n${result}` });
    } catch (e) {
      console.log(`Error: ${e.stderr}`);
    }
    return true;
  } else if (input === '/clear') {
    messages = [{ role: 'system', content: systemPrompt }];
    fileContext = {};
    console.clear();
    console.log("Welcome to Grok Code! Type your message or use /help for commands. Type '/exit' to quit.\n");
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
  const parser = new xml2js.Parser({ explicitArray: false });
  const edits = responseText.match(/<edit[^>]*>[\s\S]*?<\/edit>/g) || [];
  const deletes = responseText.match(/<delete[^>]*><\/delete>/g) || [];
  const runs = responseText.match(/<run[^>]*><\/run>/g) || [];

  if (edits.length === 0 && deletes.length === 0 && runs.length === 0) return;

  console.log("\nProposed actions:");
  for (const run of runs) {
    const parsed = await parser.parseStringPromise(run);
    console.log(`Run command: ${parsed.run.$.command}`);
  }
  for (const edit of edits) {
    const parsed = await parser.parseStringPromise(edit);
    console.log(`Edit/Create file: ${parsed.edit.$.file}`);
  }
  for (const del of deletes) {
    const parsed = await parser.parseStringPromise(del);
    console.log(`Delete file: ${parsed.delete.$.file}`);
  }

  const { confirm } = await inquirer.prompt([{ type: 'confirm', name: 'confirm', message: 'Apply these actions?' }]);
  if (!confirm) {
    console.log("Actions not applied.");
    return;
  }

  // Apply runs first
  for (const run of runs) {
    const parsed = await parser.parseStringPromise(run);
    const cmd = parsed.run.$.command;
    try {
      const result = execSync(cmd, { encoding: 'utf8' });
      console.log(`Command '${cmd}' output:\n${result}`);
      messages.push({ role: 'system', content: `Command '${cmd}' output:\n${result}` });
    } catch (e) {
      console.log(`Error: ${e.stderr}`);
      messages.push({ role: 'system', content: `Command '${cmd}' error:\n${e.stderr}` });
    }
  }

  // Apply edits
  for (const edit of edits) {
    const parsed = await parser.parseStringPromise(edit);
    const filename = parsed.edit.$.file;
    const content = parsed.edit._;  // Assuming CDATA is handled as text
    fs.ensureDirSync(path.dirname(filename));
    fs.writeFileSync(filename, content);
    console.log(`Saved ${filename}.`);
    fileContext[filename] = content;
  }

  // Apply deletes
  for (const del of deletes) {
    const parsed = await parser.parseStringPromise(del);
    const filename = parsed.delete.$.file;
    if (fs.existsSync(filename)) {
      fs.unlinkSync(filename);
      console.log(`Deleted ${filename}.`);
      delete fileContext[filename];
    } else {
      console.log(`File ${filename} not found for deletion.`);
    }
  }

  const updatedFiles = fs.readdirSync('.');
  messages.push({ role: 'system', content: `Actions applied. Updated files in directory: ${updatedFiles.join(', ')}` });
} 