# Grok Code - Claude Code Instructions

This file provides guidance for Claude Code instances operating in this repository.

## Project Overview

Grok Code is a Claude Code-compatible AI-powered CLI coding assistant that uses xAI's Grok models instead of Anthropic's Claude. It provides near 1:1 feature parity with Claude Code, including agentic tools, sub-agents, hooks, plugins, session persistence, and checkpointing.

## Build/Lint/Test Commands

```bash
# Start the CLI
npm start
node bin/grok.js

# Linting
npm run lint          # Run ESLint
npm run lint:fix      # Auto-fix linting issues

# Formatting
npm run format        # Run Prettier
```

**Note:** There is no test suite configured. Tests would need to be added.

## High-Level Architecture

```
grok-code/
├── bin/
│   └── grok.js              # Main CLI entry point (very large, ~57K tokens)
│   └── commands/
│       └── debug.js         # Debug command
├── lib/
│   ├── agents/              # Sub-agent system (Explore, Plan, Reviewer, Debugger)
│   ├── analytics/           # Error statistics tracking
│   ├── api/                 # Grok API client (OpenAI-compatible)
│   ├── code-analysis/       # AST parsing and code analysis
│   ├── commands/            # Auto-complete, history, suggestions
│   ├── config/              # Hierarchical configuration management
│   ├── context/             # Memory, token management, auto-context
│   ├── conventions/         # Code style conventions
│   ├── core/                # Core modules (GrokCore, commands, backup, etc.)
│   ├── display/             # UI components (diff viewer, progress, code preview)
│   ├── error-detection/     # Error pattern detection
│   ├── fixes/               # Automated fix suggestions
│   ├── frameworks/          # Framework detection (30+ frameworks)
│   ├── generation/          # Code generation utilities
│   ├── hooks/               # Pre/Post tool hooks system
│   ├── interactive/         # File browser, tool confirmation, streaming
│   ├── learning/            # Learning/improvement system
│   ├── mcp/                 # Model Context Protocol server
│   ├── multimodal/          # Vision/image analysis
│   ├── plugins/             # Plugin system
│   ├── prompts/             # System prompt builder
│   ├── rpg/                 # Repository Planning Graph system
│   ├── session/             # Session persistence, transcripts, checkpoints
│   ├── skills/              # Built-in skills (/commit, /review, etc.)
│   ├── structure/           # Project structure analysis
│   ├── tools/               # Claude Code-compatible tool system
│   ├── utils/               # Utility functions
│   ├── visualization/       # Workflow diagrams, progress tracking
│   └── workflows/           # Error recovery workflows
├── .grok/                   # Project configuration directory
├── GROK.md                  # Project-specific AI instructions
├── CHANGELOG.md             # Detailed changelog with feature list
└── README.md                # Full documentation
```

## Key Modules

### Tool System (`lib/tools/`)
The core agentic tool system, Claude Code-compatible:
- **BaseTool** - Foundation class with permission handling and backups
- **ReadTool** - File reading with offset/limit, 25K token limit
- **WriteTool** - File writing with automatic backups
- **EditTool** - Exact string replacement with `replace_all` option
- **BashTool** - Shell execution with 120s default timeout
- **GrepTool** - Ripgrep-style content search
- **GlobTool** - File pattern matching
- **TodoTool** - Task tracking (pending/in_progress/completed)
- **WebFetchTool** / **WebSearchTool** - Web operations
- **TaskTool** - Sub-agent spawning
- **SkillTool** - Built-in skill execution

### Core System (`lib/core/`)
- **GrokCore** (`grok-core.js`) - Central integration, singleton pattern
- **commands.js** - 83+ slash command handlers (VERY LARGE FILE: 221KB)
- **agentic-handler.js** - Automatic tool selection and execution loop
- **backup-manager.js** - File backup with indexed storage
- **project-instructions.js** - GROK.md/CLAUDE.md loader
- **doctor.js** - System diagnostics

### Configuration (`lib/config/`)
Hierarchical settings: Defaults → User (~/.grok/) → Project (.grok/) → Local → Environment

### Session System (`lib/session/`)
- Auto-save every 30 seconds
- 30-day retention policy
- JSONL transcripts
- Checkpoint create/restore

## Code Conventions

- **ES Modules** - Uses `type: "module"` in package.json, all imports use ESM syntax
- **Node.js 18+** - Required for ES module support
- **Async/await** - Async operations throughout
- **Console logging** - Direct console.log for CLI output with emoji indicators
- **Error handling** - Try/catch with user-friendly error messages

## Important Files

| File | Description | Size |
|------|-------------|------|
| `bin/grok.js` | Main entry point, CLI loop | ~57K tokens |
| `lib/core/commands.js` | All slash command handlers | ~221KB |
| `lib/tools/*.js` | Individual tool implementations | Various |
| `lib/core/grok-core.js` | Core integration module | ~10KB |
| `lib/core/agentic-handler.js` | Tool orchestration | ~20KB |
| `CHANGELOG.md` | Detailed feature documentation | Current |

## When Working in This Codebase

1. **Adding new slash commands**: Edit `lib/core/commands.js` - follow existing patterns
2. **Adding new tools**: Create in `lib/tools/`, export from `lib/tools/index.js`
3. **Adding new agents**: Create in `lib/agents/`, register in AgentRegistry
4. **Adding new skills**: Create in `lib/skills/` or `.grok/skills/*.md`

## Dependencies

Key runtime dependencies:
- `openai` - API client (OpenAI-compatible, used for xAI Grok)
- `commander` - CLI framework
- `inquirer` - Interactive prompts
- `fs-extra` - Enhanced file operations
- `ora` - Spinner/progress indicators
- `xml2js` - XML parsing

Dev dependencies:
- `eslint` + `prettier` - Code quality

## Notes

- The project mirrors Claude Code architecture but uses xAI's Grok models
- xAI API key required: `XAI_API_KEY` environment variable
- `.grok/` directory is equivalent to Claude Code's `.claude/` directory
- GROK.md is equivalent to CLAUDE.md for project instructions
- Default model: `grok-code-fast-1` (optimized for coding)
