# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build Commands

```bash
npm start              # Run CLI (or: node bin/grok.js)
npm run lint           # ESLint
npm run lint:fix       # Auto-fix lint issues
npm run format         # Prettier
```

No test suite is configured.

## Architecture Overview

Grok Code is a Claude Code-compatible CLI that uses xAI's Grok models instead of Anthropic's Claude. The architecture mirrors Claude Code with agentic tools, sub-agents, hooks, plugins, and session persistence.

### Entry Point Flow

`bin/grok.js` → imports from `lib/` → GrokCore singleton orchestrates subsystems

### Core Subsystems

**Tool System** (`lib/tools/`) - Claude Code-compatible agentic tools:
- Each tool extends `BaseTool` with `name`, `description`, `parameters`, `execute()`
- Tools are registered in `ToolRegistry` and orchestrated by `ToolExecutor`
- `agentic-handler.js` runs the automatic tool selection loop with parallel execution for read-only ops

**Command System** (`lib/core/commands.js`) - 83+ slash command handlers in one 221KB file. All handlers follow pattern: `async function handleXxxCommand(input, grokCore)`.

**Agent System** (`lib/agents/`) - Sub-agents (Explore, Plan, Reviewer, Debugger) extend `BaseAgent`, managed by `AgentRegistry`. Custom agents via `.grok/agents/*.md` with YAML frontmatter.

**Hooks System** (`lib/hooks/`) - Pre/Post tool hooks. Events: PreToolUse, PostToolUse, PermissionRequest, UserPromptSubmit, SessionStart/End.

**Session System** (`lib/session/`) - Auto-save (30s), 30-day retention, JSONL transcripts, checkpoint create/restore.

**Config System** (`lib/config/`) - Hierarchical: Defaults → ~/.grok/ → .grok/ → .grok/settings.local.json → env vars.

### Key Integration Points

- **GrokCore** (`lib/core/grok-core.js`) - Singleton connecting all subsystems
- **SystemPromptBuilder** (`lib/prompts/`) - Constructs prompts with tool descriptions, env info, project instructions
- **PermissionManager** - Pattern-based permissions (e.g., `Bash(git:*)`, `Bash(npm test)`)
- **BackupManager** - Auto-backup before edits with undo/redo history

## Adding New Features

| Feature | Location | Pattern |
|---------|----------|---------|
| Slash command | `lib/core/commands.js` | `async function handleXxxCommand(input, grokCore)` |
| Tool | `lib/tools/xxx.js` + export in `index.js` | Extend `BaseTool`, implement `execute()` |
| Agent | `lib/agents/xxx.js` | Extend `BaseAgent`, register in `AgentRegistry` |
| Skill | `lib/skills/` or `.grok/skills/*.md` | YAML frontmatter + markdown body |

## Technical Notes

- ES Modules throughout (`type: "module"`)
- Node.js 18+ required
- xAI API via OpenAI-compatible client (`XAI_API_KEY` env var)
- `.grok/` = Claude Code's `.claude/`; `GROK.md` = `CLAUDE.md`
- Default model: `grok-code-fast-1`

## Workflow Rule

From .cursor: Update documentation of any changes and commit to GitHub.
