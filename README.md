# Grok Code: Your CLI-Based AI Coding Assistant

![Grok Code Logo](https://via.placeholder.com/800x200?text=Grok+Code) <!-- Replace with actual logo URL if available -->

[![GitHub License](https://img.shields.io/github/license/xai-org/grok-code)](https://github.com/xai-org/grok-code/blob/main/LICENSE)
[![GitHub Stars](https://img.shields.io/github/stars/xai-org/grok-code)](https://github.com/xai-org/grok-code/stargazers)
[![GitHub Forks](https://img.shields.io/github/forks/xai-org/grok-code)](https://github.com/xai-org/grok-code/network)
[![Twitter Follow](https://img.shields.io/twitter/follow/xai?style=social)](https://twitter.com/xai)

## Overview

**Grok Code** is a powerful, terminal-based coding assistant powered by Grok AI from xAI. It transforms your command line into an intelligent coding environment. Whether you're building a simple script, debugging complex code, or generating entire projects (e.g., a Next.js app ready for Vercel deployment), Grok Code handles it all with natural language prompts.

Built for developers who prefer staying in the terminal, Grok Code supports multi-file edits, autonomous workflows, git integration, custom commands, and more. It's stateful, agentic, and optimized for efficiency—leveraging Grok's advanced reasoning to plan, code, test, and iterate.

**Current Version:** 1.0.0 (Released: July 10, 2025)  
**Built by:** nytemode  
**License:** MIT  

## Key Features

Grok Code is designed to be a full-featured coding assistant with enhancements for seamless integration and user control:

- **AI-Powered Coding Assistance**: Interact with Grok AI via natural language. Ask to write code, debug errors, optimize functions, or generate entire projects. Grok thinks step-by-step, proposes plans, and outputs in markdown for clarity.
  
- **Multi-File Management**: 
  - Create, edit, or delete multiple files in one go using XML tags in responses (e.g., `<edit file="path/to/file.js">`).
  - Automatic directory creation for subfolders (e.g., for project structures like Next.js apps).
  - File context: Add files to AI's knowledge with `/add <file>`, remove with `/remove <file>`, or scan all with `/scan`.

- **Autonomous Workflows**: 
  - Propose and run shell commands (e.g., `npm install`, tests, linting) via `<run command="...">` tags.
  - Handle errors iteratively: Grok can suggest fixes based on command outputs.
  - Project generation: E.g., create a deploy-ready Next.js site with all files (app/, components/, package.json, etc.) and suggest deployment commands.

- **Git Integration**:
  - Built-in commands: `/git <command>` for any git action, `/init-git` to initialize a repo, `/commit <message>` to stage and commit, `/push` to push changes.
  - Propose git sequences in responses (e.g., add, commit, push) for PR automation.
  - Supports GitHub/GitLab: Ask Grok to generate commit messages, resolve merge conflicts, or create PRs (if `gh` CLI is installed).

- **Custom Commands**:
  - Define reusable prompts in `.grok/commands/<cmd_name>.txt`.
  - Invoke with `/<cmd_name>`, e.g., `/lint` could trigger "Run ESLint on all JS files".
  - Project-wide or personal: Store in repo for team use.

- **Shell and Environment Awareness**:
  - Detects OS (Windows, macOS, Linux) for adapted commands and paths.
  - Runs arbitrary shell commands with `/run <cmd>`.
  - Stateful REPL-like interaction: Maintains conversation history for context-aware follow-ups.

- **UI/UX Enhancements**:
  - Thinking animation during API calls.
  - Clear screen on `/clear` for fresh starts.
  - Help menu with `/help` listing all commands.
  - Directory listing with `/ls`.

- **Configuration and Extensibility**:
  - `GROK.md`: Place in your repo for project-specific notes (e.g., style guides, build commands). Grok ingests it automatically.
  - API key management: Secure local storage with menu for change/delete.
  - Model flexibility: Defaults to `grok-3-beta`; customizable in code.

- **Security and Best Practices**:
  - User confirmation for all actions (edits, deletes, runs).
  - No auto-execution: Always previews proposed changes.
  - Token-efficient: Manages context to avoid bloating prompts.

## Installation

1. **Prerequisites**:
   - Node.js 16+.
   - xAI API key (get from [x.ai/api](https://x.ai/api)).

2. **Clone the Repo**:
   ```bash
   git clone https://github.com/xai-org/grok-code.git
   cd grok-code
   ```

3. **Install Dependencies**:
   ```bash
   npm install
   ```

4. **Run the CLI**:
   ```bash
   npm start
   ```
   or
   ```bash
   ./bin/grok.js
   ```
   - On first launch, enter your xAI API key (saved securely in `~/.grok/api_key`).

5. **Global Installation (Optional)**:
   ```bash
   npm install -g .
   ```
   Then use `grok` from anywhere.

## Usage

Launch Grok Code in your project directory:

```bash
npm start
```
or
```bash
./bin/grok.js
```
or globally:
```bash
grok
```

- **Basic Interaction**: Type prompts like "Create a JavaScript function to reverse a string" or "Debug this error in app.js".
- **Project Creation**: "Build a Next.js website for a blog, ready to deploy on Vercel."
- **Debugging**: "Fix the bug in this code: [paste code]".
- **Git Workflow**: "/init-git", then "Generate commit message for recent changes", followed by "/commit <msg>".
- **Custom Command Example**: Create `.grok/commands/test.txt` with "Run all unit tests and report failures". Invoke with `/test`.

Exit with `/exit`. Clear session with `/clear`.

### Example Session

```
Welcome to Grok Code! ...

You: Create a simple Pong game in a new folder 'pong'
[Thinking animation...]

Grok: [Plan and proposed actions...]

Proposed actions:
Run command: mkdir -p pong
Edit/Create file: pong/index.html

Apply these actions? (y/n): y
[Applies changes]

You: /commit "Add Pong game"
[Commits changes]
```

## Best Practices

- **GROK.md**: Use for repo-specific info, e.g.:
  ```
  # GROK.md
  Style: Use ESLint with Airbnb preset.
  Build: npm run build
  Test: npm test
  ```

- **Custom Commands**: Keep prompts concise. Example for `/deploy`:
  ```
  Deploy the current Next.js app to Vercel and output the URL.
  ```

- **Context Management**: Use `/scan` for large repos, but add selectively to save tokens.
- **Error Handling**: If a command fails, Grok can iterate—paste errors back in.
- **Performance**: For faster responses, switch to `grok-3-mini-beta` in the code.

## Contributing

We welcome contributions! Fork the repo, create a feature branch, and submit a PR. Follow these steps:

1. Fork on GitHub.
2. Clone your fork: `git clone https://github.com/your-username/grok-code.git`.
3. Create branch: `git checkout -b feature/new-thing`.
4. Commit: `git commit -m "Add new thing"`.
5. Push: `git push origin feature/new-thing`.
6. Open PR.

Report issues [here](https://github.com/xai-org/grok-code/issues).

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.

## Acknowledgments

- Powered by [xAI's Grok](https://x.ai).
- Built by nytemode.

For questions, tweet @xai or join the discussion on GitHub. Happy coding! 🚀 