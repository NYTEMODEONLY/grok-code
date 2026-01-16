# Changelog

All notable changes to Grok Code will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - 2025-01-16

### Added - Claude Code Feature Parity

This release brings near 1:1 feature parity with Anthropic's Claude Code, while leveraging xAI's Grok models.

#### Tools System (`lib/tools/`)
- **BaseTool** - Foundation class for all tools with permission handling and backups
- **ReadTool** - File reading with offset/limit, binary detection, 25K token limit
- **WriteTool** - File writing with automatic backup creation
- **EditTool** - Exact string replacement with `replace_all` option
- **BashTool** - Shell execution with timeout (120s default, 600s max), dangerous command detection
- **GrepTool** - Ripgrep-style content search with regex, glob filtering, output modes
- **GlobTool** - File pattern matching sorted by modification time
- **TodoTool** - Task tracking with states (pending, in_progress, completed)
- **WebFetchTool** - Fetch and process web content with HTML-to-markdown conversion, caching
- **WebSearchTool** - Web search with DuckDuckGo integration, domain filtering, result caching
- **AskUserQuestionTool** - Interactive user prompts with single/multi-select options
- **NotebookEditTool** - Jupyter notebook (.ipynb) editing with cell replace/insert/delete
- **KillShellTool** - Kill running background shell processes
- **TaskOutputTool** - Retrieve output from background tasks with blocking/non-blocking modes
- **EnterPlanModeTool** - Start structured planning workflow for complex tasks
- **ExitPlanModeTool** - Complete planning and request user approval with permission grants
- **TaskManager** - Background process and async agent management
- **PlanModeManager** - Planning state and permission management
- **ToolRegistry** - Central tool registration and discovery
- **ToolExecutor** - Orchestration with hooks integration and undo support
- **TaskTool** - Launch specialized sub-agents for complex tasks
  - Explore, Plan, Bash, general-purpose agent types
  - Background task execution
  - Resume capability for long-running tasks
- **SkillTool** - Execute skills/workflows within conversations
  - Built-in skills: commit, review, explain, refactor, test, docs, fix, debug
  - Custom skill support via .grok/skills/*.md

#### System Prompt Builder (`lib/prompts/system-prompt-builder.js`)
- **SystemPromptBuilder** - Construct comprehensive system prompts
  - Base prompt with core guidelines
  - Tool descriptions injection
  - Environment information
  - Project instructions (GROK.md)
  - Session and file context
  - Agent-specific prompt variants

#### Agents System (`lib/agents/`)
- **BaseAgent** - Foundation with tools, model, and permission modes
- **AgentRegistry** - Agent lifecycle management (start/stop/resume)
- **AgentLoader** - Load custom agents from .md files with YAML frontmatter
- **ExploreAgent** - Fast read-only codebase exploration
- **PlanAgent** - Software architecture and implementation planning
- **ReviewerAgent** - Code review with security focus
- **DebuggerAgent** - Error analysis and debugging

#### Hooks System (`lib/hooks/`)
- **HooksManager** - Central hooks coordination
- **HookRunner** - Execute command and prompt hooks with JSON communication
- **HookLoader** - Load hooks from settings files
- Supported events:
  - `PreToolUse` - Before tool execution
  - `PostToolUse` - After tool execution
  - `PermissionRequest` - When permission is needed
  - `UserPromptSubmit` - When user submits a prompt
  - `SessionStart` / `SessionEnd` - Session lifecycle
  - `Stop` / `SubagentStop` - Stopping events
  - `Notification` / `PreCompact` - Other events

#### Plugins System (`lib/plugins/`)
- **BasePlugin** - Plugin foundation with commands, agents, hooks, skills
- **PluginManager** - Plugin lifecycle and dependency management
- **PluginLoader** - Load plugins from directories with manifest.json

#### Session System (`lib/session/`)
- **SessionManager** - Persistence with auto-save (30s interval) and 30-day retention
- **TranscriptManager** - JSONL transcript logging
- **CheckpointManager** - Checkpoint create/restore/compare

#### Configuration System (`lib/config/`)
- **ConfigManager** - Hierarchical settings loading
  - Defaults → User (`~/.grok/`) → Project (`.grok/`) → Local (`.grok/settings.local.json`) → Environment
- **SettingsSchema** - Validation and default values
- `initProject()` - Creates `.grok/` directory structure

#### Core Integration (`lib/core/`)
- **GrokCore** - Central integration module connecting all subsystems
- Singleton pattern for easy access across the application
- Automatic initialization on startup
- Graceful shutdown on exit

#### Skills System (`lib/skills/`)
- **SkillsManager** - Load and execute built-in and custom skills
- **BuiltInSkills** - Pre-defined AI workflow skills:
  - `/commit [hint]` - Smart git commit with AI-generated message
  - `/review [file]` - Code review for staged changes
  - `/explain [file:line]` - Explain code in context
  - `/refactor [file]` - Refactoring suggestions
  - `/test [file]` - Generate tests (auto-detects framework)
  - `/docs [file]` - Generate documentation
  - `/fix [error]` - Analyze and fix errors
  - `/debug [description]` - Debug assistance
- Custom skills via `.grok/skills/*.md` with YAML frontmatter

#### MCP Server (`lib/mcp/`)
- **MCPServer** - Model Context Protocol implementation
- Built-in tools: read_file, write_file, list_directory, search_files, execute_command
- Built-in resources: cwd, env, project-config
- Built-in prompts: explain_code, review_code, fix_error, generate_tests
- JSON-RPC request handling

#### Agentic Handler (`lib/core/agentic-handler.js`)
- **AgenticHandler** - Automatic tool selection and conversation loop
  - Parallel tool execution for read-only operations
  - Smart conflict detection for file operations
  - Hook integration (PreToolUse, PostToolUse, etc.)
- **PermissionManager** - Pattern-based permission control
  - Allow/deny patterns (e.g., `Bash(git:*)`, `Bash(npm test)`)
  - Wildcard support for flexible rules
  - Session-level approval caching

#### Backup System (`lib/core/backup-manager.js`)
- **BackupManager** - File backup management with indexed storage
- Auto-backup before edits with retention policies
- **ActionHistory** - Undo/redo functionality

#### Project Instructions (`lib/core/project-instructions.js`)
- **ProjectInstructionsLoader** - Load GROK.md instruction files
- Supports: GROK.md, grok.md, .grok.md, CLAUDE.md (compatibility)
- Global (~/.grok/GROK.md) and project-level instructions
- Section parsing, rules extraction, preferences detection

#### Doctor Diagnostics (`lib/core/doctor.js`)
- System health checks: Node.js version, API key, connection, configs
- `/doctor` - Full diagnostics
- `/doctor quick` - Essential checks only

#### Memory Manager (`lib/context/memory-manager.js`)
- Conversation memory with auto-summarization
- Token estimation and budget management
- File context with LRU eviction
- Save/load conversation state

#### Tool Confirmation (`lib/interactive/tool-confirmation.js`)
- Interactive confirmation dialogs with previews
- Risk assessment (low/medium/high)
- Session-level permission grants
- Pattern-based blocking

#### New Slash Commands
- `/agents <list|info|start|stop|running|create>` - Manage sub-agents/specialists
- `/hooks <list|events|test>` - View and test pre/post tool hooks
- `/plugins <list|info|enable|disable|create>` - Plugin management
- `/session <list|info|resume|save>` - Session persistence management
- `/checkpoint <create|list|restore|delete>` - Save and restore session checkpoints
- `/tools <list|info>` - View available tools
- `/status` - System status overview
- `/mcp <status|tools|resources|prompts|call|read|prompt>` - MCP server management
- `/backup <list|restore|stats|cleanup>` - Backup management
- `/skills <list|info|run|create|delete>` - Skills management
- `/init <grok|config|full>` - Project initialization
- `/instructions <show|status|create|reload>` - GROK.md management
- `/doctor [quick]` - System diagnostics
- `/memory <status|clear|compress|search|save|load>` - Memory and context management
- `/config <show|get|set|reset|path|edit>` - Configuration management
- `/tasks <list|running|output|kill|cleanup>` - Background task management
- `/undo [list|clear|n]` - Undo file operations with history
- `/compact [status|aggressive]` - Context compression
- `/permissions <list|allow|deny|clear|reset>` - Permission rule management
- `/context <list|add|remove|clear|size>` - Context file management
- `/model [list|set|info]` - Model selection and info
- `/export <format>` - Export conversation transcripts (markdown, json, html, text, jsonl)
- `/vision <command>` - Image analysis and vision features
- `/summarize` - AI-powered conversation and code summarization
- `/web <fetch|search>` - Web operations (fetch pages, search web)

#### Interactive Module (`lib/interactive/`)
- **StreamingHandler** - Real-time streaming response display
  - Token-by-token output with visual feedback
  - Speed calculation (tokens/sec)
  - Live token count display
  - Configurable display options
- **TokenCounter** - Token estimation and budget management
  - Model-specific context limits (128K-2M tokens)
  - Input/output/conversation tracking
  - Budget warnings at configurable thresholds
  - Formatted summaries for display
- **ProgressIndicator** - Visual progress for long operations
  - Animated spinner with custom frames
  - Progress bar with percentage
  - ETA calculation
  - Completion animation
- **DiffPreview** - File change visualization
  - Unified diff format with line numbers
  - Color-coded additions/deletions
  - Context lines around changes
  - Edit preview for string replacements

#### Auto-Summarization (`lib/context/auto-summarizer.js`)
- **AutoSummarizer** - AI-powered conversation compression
  - Uses Grok API for intelligent summarization
  - Progressive summarization for very long conversations
  - Configurable compression ratio (default 10%)
  - Summary caching to avoid redundant API calls
  - Fallback to basic summarization when API unavailable
  - Action extraction from assistant messages
  - Summary consolidation for multiple summaries

#### Multimodal Vision (`lib/multimodal/vision.js`)
- **VisionHandler** - Image analysis and vision support
  - Support for PNG, JPG, JPEG, GIF, WebP, BMP formats
  - Base64 encoding for API compatibility
  - Image analysis with customizable prompts
  - Screenshot analysis for debugging
  - Image comparison (before/after)
  - OCR-like text extraction
  - UI design/mockup analysis
  - Image caching with LRU eviction
- **ScreenshotHelper** - Platform-specific screenshot capture
  - macOS, Windows, Linux support
  - Automatic filename generation

#### Transcript Export (`lib/session/transcript-export.js`)
- **TranscriptExporter** - Multi-format conversation export
  - Markdown export with full formatting
  - JSON export (pretty or compact)
  - HTML export with dark/light themes
  - Plain text export with configurable width
  - JSONL export for training/analysis
  - Multi-format batch export
  - Export listing and management

#### Enhanced API Client (`lib/api/grok-client.js`)
- Streaming response support with token-by-token callbacks
- Tool calling integration (OpenAI-compatible function calling)
- Automatic tool execution loop with `chatWithTools()`
- Event emitter for response, error, token, and tool events
- Improved rate limiting (30 req/min default)
- Token usage tracking

### Changed
- Version bumped to 2.0.0
- Welcome banner now shows "Claude Code Compatible"
- Default model changed to `grok-code-fast-1` (optimized for coding)
- Updated `/help` to include all new Claude Code-compatible commands
- Package description updated to reflect new capabilities

### Migration from v1.x
1. The `.grok/` directory structure is now used for project configuration
2. New commands are available but backward compatible
3. Existing workflows continue to work unchanged
4. To use new features:
   - Run `/agents list` to see available agents
   - Run `/plugins list` to see available plugins
   - Run `/checkpoint create "name"` to save session state

---

## [1.20.0] - Previous Release

### Features (Pre-2.0)
- Repository Planning Graph (RPG) system
- Multi-file semantic parsing (AST-based)
- Dependency graphing and context inference
- Framework detection (30+ frameworks)
- Syntax highlighting with multiple themes
- Color-coded diffs
- Interactive file browser
- Git integration (status, commit, push, PRs)
- Token budget management
- Auto-context building
- Error recovery workflow
- Command history with search
- Contextual suggestions

---

## Comparison: Grok Code vs Claude Code

| Feature | Grok Code 2.0 | Claude Code |
|---------|---------------|-------------|
| Agentic Terminal Tool | ✅ | ✅ |
| Tool System (Read/Write/Edit/Bash/Grep/Glob) | ✅ | ✅ |
| Sub-agents/Specialists | ✅ | ✅ |
| Hooks (Pre/Post Tool Use) | ✅ | ✅ |
| Plugin System | ✅ | ✅ |
| Session Persistence | ✅ | ✅ |
| Checkpointing & Undo | ✅ | ✅ |
| Project Configuration (.grok/) | ✅ | ✅ (.claude/) |
| Streaming Responses | ✅ | ✅ |
| Tool Calling | ✅ | ✅ |
| **RPG Planning System** | ✅ | ❌ |
| **Multi-File Intelligence** | ✅ | Partial |
| **Framework Detection** | ✅ | ❌ |
| **2M Token Context** | ✅ | 200K |

---

## Acknowledgments

- **xAI** for the Grok AI models
- **Anthropic** for Claude Code architecture inspiration
- The open-source community

---

[2.0.0]: https://github.com/NYTEMODEONLY/grok-code/compare/v1.20.0...v2.0.0
[1.20.0]: https://github.com/NYTEMODEONLY/grok-code/releases/tag/v1.20.0
