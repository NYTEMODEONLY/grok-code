# 🚀 Grok Code: AI-Powered CLI Coding Assistant

<div align="center">

![Grok Code Logo](https://img.shields.io/badge/Grok_Code-CLI_AI_Assistant-000?style=for-the-badge&logo=terminal&logoColor=white)
![xAI Powered](https://img.shields.io/badge/Powered_by-xAI_Grok-000?style=for-the-badge&logo=x&logoColor=white)
![Claude Code Compatible](https://img.shields.io/badge/Claude_Code-Compatible-purple?style=for-the-badge)
![RPG Planning](https://img.shields.io/badge/Planning-RPG_Graph-FF6B35?style=for-the-badge)

**The terminal-native AI coding assistant powered by xAI's Grok models**

**Feature parity with Anthropic's Claude Code, but enhanced with Grok's unique capabilities**

[Installation](#installation) • [Quick Start](#quick-start) • [Features](#key-features) • [Configuration](#configuration) • [Agents](#sub-agents) • [Hooks](#hooks-system) • [Plugins](#plugins)

</div>

---

## ✨ Overview

**Grok Code** is an agentic terminal-based coding assistant that brings the power of xAI's Grok models to your command line. It provides near-1:1 feature parity with Anthropic's Claude Code while leveraging Grok's unique strengths:

- **Longer Context Windows**: Handle massive codebases with up to 2M tokens
- **Faster Inference**: Optimized models for rapid code generation
- **Repository Planning Graph (RPG)**: Structured planning for complex projects
- **Full Terminal IDE**: Syntax highlighting, diff viewing, file browsing

### 🎯 Key Capabilities

| Feature | Grok Code | Claude Code |
|---------|-----------|-------------|
| Agentic Terminal Tool | ✅ | ✅ |
| Tool System (Read/Write/Edit/Bash/Grep/Glob) | ✅ | ✅ |
| Sub-agents/Specialists | ✅ | ✅ |
| Hooks (Pre/Post Tool Use) | ✅ | ✅ |
| Plugin System | ✅ | ✅ |
| Session Persistence | ✅ | ✅ |
| Checkpointing & Undo | ✅ | ✅ |
| .grok/ Project Config | ✅ | ✅ (.claude/) |
| RPG Planning System | ✅ | ❌ |
| Multi-File Intelligence | ✅ | Partial |
| Framework Detection | ✅ | ❌ |
| 2M Token Context | ✅ | 200K |

---

## 📦 Installation

### Quick Install (Recommended)

```bash
# Clone the repository
git clone https://github.com/NYTEMODEONLY/grok-code.git
cd grok-code

# Install dependencies
npm install

# Link globally
npm link

# Start Grok Code
grok
```

### NPM Install

```bash
npm install -g grok-code-cli
grok
```

### Requirements

- Node.js 18+
- xAI API Key (get one at [console.x.ai](https://console.x.ai))

---

## 🚀 Quick Start

```bash
# Start Grok Code in your project
cd your-project
grok

# First run will prompt for your xAI API key
# Key is stored securely in ~/.grok/api_key
```

### Basic Usage

```
You: explain how authentication works in this codebase
Grok: [Analyzes your code and provides detailed explanation]

You: add a logout button to the header component
Grok: [Generates code with <edit> tags, prompts for confirmation]

You: run the tests
Grok: [Executes tests with <run> command]
```

---

## 🛠️ Key Features

### Agentic Tool System

Grok Code uses a Claude Code-compatible tool system for autonomous code operations:

| Tool | Purpose | Permission |
|------|---------|------------|
| **Read** | Read files from filesystem | Read-only |
| **Write** | Create or overwrite files | Requires confirmation |
| **Edit** | Exact string replacement in files | Requires confirmation |
| **Bash** | Execute shell commands | Requires confirmation |
| **Grep** | Search file contents (ripgrep-style) | Read-only |
| **Glob** | Find files by pattern | Read-only |
| **TodoWrite** | Track tasks and progress | Auto |

### RPG Planning System

Repository Planning Graph (RPG) ensures structured, well-planned code generation:

```
You: build a REST API for user management

Grok: 🔄 Planning project structure...
📋 Project structure planned

Features: [user_auth, user_crud, middleware]
Files: {
  "user_auth": "src/auth/index.js",
  "user_crud": "src/users/controller.js",
  "middleware": "src/middleware/auth.js"
}

⚙️ Generating code files...
✨ Code generation complete

✅ Generated 5 files successfully
```

### Sub-Agents System

Specialized agents for different tasks:

```bash
# Built-in agents
/agents list

Available Agents:
- Explore: Fast codebase exploration (read-only)
- Plan: Software architecture planning
- Reviewer: Code review specialist
- Debugger: Error analysis and fixes
```

#### Creating Custom Agents

Create `.grok/agents/my-agent.md`:

```markdown
---
name: security-reviewer
description: Security-focused code review specialist
tools: Read, Grep, Glob
model: inherit
---

You are a security expert. When invoked, analyze code for:
- SQL injection vulnerabilities
- XSS risks
- Authentication issues
- Exposed secrets
```

### Hooks System

Automate workflows with pre/post tool hooks:

```json
// .grok/settings.json
{
  "hooks": {
    "PreToolUse": [{
      "matcher": "Bash",
      "hooks": [{
        "type": "command",
        "command": "./scripts/validate-command.sh"
      }]
    }],
    "PostToolUse": [{
      "matcher": "Edit|Write",
      "hooks": [{
        "type": "command",
        "command": "npm run lint --fix"
      }]
    }]
  }
}
```

#### Available Hook Events

| Event | When | Use Case |
|-------|------|----------|
| `PreToolUse` | Before tool execution | Validate commands, add context |
| `PostToolUse` | After tool execution | Lint, test, log |
| `PermissionRequest` | Permission prompt shown | Auto-approve patterns |
| `UserPromptSubmit` | User submits prompt | Add context, validate |
| `SessionStart` | Session begins | Setup environment |
| `SessionEnd` | Session ends | Cleanup, save patterns |
| `Stop` | Assistant stops | Force continuation |

### Plugin System

Extend Grok Code with plugins:

```bash
# Create a plugin
mkdir -p .grok/plugins/my-plugin
cd .grok/plugins/my-plugin

# Create manifest.json
{
  "name": "my-plugin",
  "version": "1.0.0",
  "description": "My custom plugin"
}

# Add commands in commands/
# Add agents in agents/
# Add hooks in hooks/hooks.json
```

### Session Persistence

Sessions are automatically saved and can be resumed:

```bash
# List recent sessions
/session list

# Resume a session
/session resume <session-id>

# Create checkpoint
/checkpoint create "before refactor"

# Restore checkpoint
/checkpoint restore <checkpoint-id>
```

### MCP (Model Context Protocol) Server

Built-in MCP server for standardized AI model context:

```bash
# Show MCP server status
/mcp status

# List available MCP tools
/mcp tools

# List resources
/mcp resources

# Call an MCP tool
/mcp call read_file {"path": "src/index.js"}

# Read a resource
/mcp read file://project-config
```

### Backup System

Automatic file backups before edits:

```bash
# List all backups
/backup list

# List backups for specific file
/backup list src/index.js

# Restore a backup
/backup restore <backup-id>

# Restore latest backup for file
/backup restore-latest src/index.js

# View backup stats
/backup stats

# Cleanup old backups
/backup cleanup
```

### Skills System

User-defined skills and workflows:

```bash
# List available skills
/skills list

# Show skill details
/skills info commit

# Create a custom skill
/skills create my-workflow

# Delete a custom skill
/skills delete my-workflow
```

**Built-in Skills:**
- `/commit` - Smart git commit with AI-generated message
- `/review` - Code review for staged changes
- `/explain` - Explain code in current context
- `/refactor` - Suggest refactoring improvements
- `/test` - Generate tests for code
- `/docs` - Generate documentation

Custom skills are markdown files in `.grok/skills/` with YAML frontmatter.

### Agentic Handler & Permissions

Advanced permission management for autonomous operation:

```json
// .grok/settings.json
{
  "permissions": {
    "allow": [
      "Read",
      "Grep",
      "Glob",
      "Bash(git:*)",
      "Bash(npm test)",
      "Bash(npm run lint)"
    ],
    "deny": [
      "Bash(rm -rf *)",
      "Bash(sudo *)"
    ],
    "autoApprove": {
      "Explore": true,
      "Plan": true
    }
  }
}
```

Pattern matching supports wildcards (`*`) for flexible permission rules.

---

## ⚙️ Configuration

### Configuration Hierarchy

1. **Defaults** (built-in)
2. **User Settings** (`~/.grok/settings.json`)
3. **Project Settings** (`.grok/settings.json`)
4. **Local Settings** (`.grok/settings.local.json`) - not committed
5. **Environment Variables**

### Key Settings

```json
{
  "model": "grok-code-fast-1",
  "maxTokens": 4096,
  "temperature": 0.7,
  "theme": "default",
  "syntaxHighlighting": true,
  "autoContextEnabled": true,
  "backupEnabled": true,
  "permissions": {
    "allowBash": true,
    "confirmBash": true,
    "deny": [],
    "allow": ["Bash(git:*)"]
  }
}
```

### Environment Variables

```bash
export XAI_API_KEY="your-api-key"
export GROK_MODEL="grok-code-fast-1"
export GROK_DEBUG=true
export GROK_VERBOSE=true
```

### Available Models

| Model | Best For | Context |
|-------|----------|---------|
| `grok-code-fast-1` | Coding tasks (default) | Optimized |
| `grok-4-fast-reasoning` | Complex reasoning | 2M tokens |
| `grok-4-fast-non-reasoning` | Simple tasks | 2M tokens |
| `grok-3-beta` | Balanced | Large |
| `grok-3-mini-beta` | Speed/cost | Medium |

---

## 📋 Commands Reference

### Essential Commands

| Command | Description |
|---------|-------------|
| `/help` | Show all commands |
| `/add <file>` | Add file to context |
| `/remove <file>` | Remove file from context |
| `/scan` | Scan and add all project files |
| `/model` | Change AI model |
| `/clear` | Clear conversation history |
| `/undo` | Undo last file operation |
| `exit` | Quit Grok Code |

### Search & Navigation

| Command | Description |
|---------|-------------|
| `/semantic-search "query"` | Find relevant files |
| `/analyze "query"` | Deep analysis with auto-context |
| `/browse` | Interactive file browser |
| `/search <query>` | Search across codebase |
| `/preview <file>` | Enhanced code preview |

### Development

| Command | Description |
|---------|-------------|
| `/run <cmd>` | Execute shell command |
| `/git <command>` | Run git command |
| `/commit <message>` | Commit changes |
| `/push` | Push to remote |
| `/pr <title>` | Create pull request |
| `/debug` | Interactive debugger |

### Context Management

| Command | Description |
|---------|-------------|
| `/auto-context <on/off>` | Toggle auto-context |
| `/prune-context` | Manage context size |
| `/budget` | Show token budget |

### Framework & Analysis

| Command | Description |
|---------|-------------|
| `/framework detect` | Detect project frameworks |
| `/framework patterns` | Show framework patterns |
| `/diagram` | Show workflow diagrams |

### Claude Code-Compatible

| Command | Description |
|---------|-------------|
| `/agents` | Manage sub-agents/specialists |
| `/hooks` | View and test pre/post hooks |
| `/plugins` | Manage plugins |
| `/session` | Session persistence |
| `/checkpoint` | Save and restore checkpoints |
| `/tools` | View available tools |
| `/status` | Show system status |
| `/mcp` | MCP server management |
| `/backup` | File backup management |
| `/skills` | User-defined skills |

---

## 📁 Project Structure

```
.grok/
├── settings.json          # Project settings (committed)
├── settings.local.json    # Local settings (not committed)
├── commands/              # Custom commands
│   └── my-command.txt     # /my-command
├── agents/                # Custom agents
│   └── reviewer.md        # /agents invoke reviewer
├── skills/                # User-defined skills
│   └── my-workflow.md     # /skills run my-workflow
├── plugins/               # Plugins
│   └── my-plugin/
│       ├── manifest.json
│       ├── commands/
│       ├── agents/
│       ├── skills/
│       └── hooks/
├── sessions/              # Session data
│   └── index.json         # Session index
├── checkpoints/           # Session checkpoints
├── backups/               # File backups
│   └── index.json         # Backup index
└── error.log              # Error logs

~/.grok/                   # User-level configuration
├── settings.json          # User settings
├── api_key                # xAI API key
├── sessions/              # User sessions
└── plugins/               # User plugins

GROK.md                    # Project instructions for Grok
```

---

## 🔄 Migration from Claude Code

If you're coming from Claude Code, Grok Code uses compatible patterns:

| Claude Code | Grok Code |
|-------------|-----------|
| `.claude/` | `.grok/` |
| `~/.claude/` | `~/.grok/` |
| `CLAUDE.md` | `GROK.md` |
| `claude` CLI | `grok` CLI |

Most settings and configurations are compatible. Simply:

1. Rename `.claude/` to `.grok/`
2. Rename `CLAUDE.md` to `GROK.md`
3. Update API key references

---

## 🧠 Advanced Features

### Multi-File Intelligence

- **AST-based code parsing** for JS, TS, Python
- **Dependency graph mapping** with circular dependency detection
- **Intelligent context inference** and optimization
- **Token budget management** across conversation

### Error Recovery System

- **20+ fix templates** for common errors
- **AI-powered complex fixes** with full context
- **Safe application** with automatic backups
- **Learning system** that improves over time

### Framework Detection

Automatically detects 30+ frameworks:
- React, Vue, Angular, Svelte
- Express, Fastify, NestJS
- Django, Flask, FastAPI
- And many more...

---

## 🔧 Troubleshooting

### Common Issues

**API Key Issues**
```bash
# Check API key
cat ~/.grok/api_key

# Reset API key
rm ~/.grok/api_key
grok  # Will prompt for new key
```

**Permission Issues**
```bash
# Make grok executable
chmod +x $(which grok)
```

**Context Too Large**
```bash
# Use context pruning
/prune-context prune

# Or clear non-essential files
/remove large-file.js
```

### Logs

```bash
# View error logs
/logs

# Or directly
cat .grok/error.log
```

---

## 📜 License

MIT License - see [LICENSE](LICENSE) file

---

## 🙏 Acknowledgments

- **xAI** for the Grok AI models
- **Anthropic** for Claude Code architecture inspiration
- The open-source community

---

## 📮 Contributing

Contributions welcome! Please see our [Contributing Guide](CONTRIBUTING.md).

---

<div align="center">

**Built with ❤️ by [nytemode](https://github.com/NYTEMODEONLY)**

[Report Bug](https://github.com/NYTEMODEONLY/grok-code/issues) • [Request Feature](https://github.com/NYTEMODEONLY/grok-code/issues)

</div>
