---
active: true
iteration: 13
max_iterations: 20
completion_promise: null
started_at: "2026-01-16T07:16:09Z"
---

Here is the rewritten prompt in completely plain text with no special characters, markdown, bold, italics, or hyperlinks. You can copy-paste it directly into Claude.

You are an expert full-stack developer and systems architect specializing in building advanced AI-powered CLI coding assistants. Your task is to create a complete, production-ready 1:1 functional clone of Anthropic's official Claude Code tool (the agentic terminal-based coding assistant with full source code available at the official repository https://github.com/anthropics/claude-code), but re-engineered to use xAI's Grok API and models exclusively instead of any Anthropic/Claude models.

The cloned project must be named Grok Code and must build directly upon, extend, and improve the existing open-source repository at https://github.com/NYTEMODEONLY/grok-code (which is already a Grok-powered CLI coding assistant with features like Repository Planning Graph (RPG), multi-file intelligence, error recovery, IDE-like terminal UI, syntax highlighting, git integration, context management, and more).

Aim for damn near 1:1 feature parity with Claude Code where possible, but make Grok Code even better by leveraging Grok's unique strengths (longer context, faster inference where available, better code-specific capabilities, and the existing advanced features already in the grok-code repo).

Key requirements for the clone:

1. Feature Parity (or Better) with Claude Code:
- Agentic coding in the terminal: natural language commands to understand codebase, edit files, run shell commands, explain code, handle git workflows (commit, diff, push, PRs via gh CLI if available), debug, refactor, add features, etc.
- Automatic codebase mapping and context understanding (agentic search over files, no manual context selection needed).
- Tool use: read/write files, bash/shell execution, grep/glob, git operations, etc., all in a safe, controlled way.
- Sub-agents/skills system: support for specialized agents (e.g., reviewer, debugger, planner) that can be invoked automatically or manually.
- Custom commands, hooks (pre/post tool use, notifications), and project-specific configuration (e.g., via .grok/ directory mirroring .claude/).
- Session persistence, context saving/restoring, undo/redo, and token budget awareness.
- Interactive file browser, syntax-highlighted previews/diffs, progress indicators, and rich terminal UI.
- Plugin system similar to Claude Code's extensible plugins directory.

2. Backend Switch to Grok:
- Replace all Anthropic/Claude API calls with xAI Grok API calls.
- Use the most capable Grok models available (e.g., grok-4 for reasoning, any code-fast variants where applicable).
- Implement streaming responses, tool calling (if supported by Grok API), and structured output parsing compatible with Grok's capabilities.
- Handle Grok-specific rate limits, context windows, and budgeting intelligently.

3. Integration with Existing Grok Code Repo:
- Preserve and enhance all current features from https://github.com/NYTEMODEONLY/grok-code, including:
  - Repository Planning Graph (RPG) system with JSON planning, framework detection, architecture analysis, and visual ASCII graphs.
  - Multi-file semantic parsing (AST-based for JS/TS/Python), dependency graphing, context inference, and intelligent file linking.
  - Advanced error recovery with linting/parsing integration.
  - IDE-like features: syntax highlighting (multiple themes), color-coded diffs, interactive search/browser, git commands.
  - Unified RPG Orchestrator, multi-language support, autonomous workflows, memory/compression.
- Merge Claude Code's agentic patterns (e.g., automatic tool selection, sub-agents, hooks, plugin system) into the existing structure without breaking anything.
- Use or adapt the existing directory structure (bin/, lib/, examples/, etc.) and configuration files (GROK.md, map.md, etc.) while adding .grok/ for project-local config.

4. Implementation Details:
- Primary language: JavaScript/Node.js (matching the existing repo).
- Dependencies: Keep existing ones; add only what's strictly needed for Grok API integration.
- CLI entrypoint: Executable via grok command (or similar).
- Configuration: Support global (~/.grok/) and project-local (.grok/) directories for commands, agents, hooks, plugins, and prompts.
- Security/Safety: Sandbox shell commands where possible, backups before edits, risk assessment for changes.
- Extensibility: Easy to add custom commands, sub-agents, plugins, and hooks.
- Make improvements where Grok excels (e.g., better long-context handling for massive repos, superior code generation speed/quality).

Output Format:
- Provide the complete updated repository structure with all new/modified files.
- For each file, show the full code content.
- Include a detailed README.md update explaining installation, usage, differences from Claude Code, how it surpasses it, and how it leverages Grok's strengths.
- Include a migration guide for users of the existing grok-code repo.
- End with a changelog summarizing the changes to achieve near-1:1 parity while making improvements.

Begin by analyzing both the official Claude Code repository and the current grok-code repo, then generate the full cloned and enhanced implementation. Also always commit to the github after every iteration. End users should be able to install Grok Code and use the command 'grok' in their terminals to start it up.
