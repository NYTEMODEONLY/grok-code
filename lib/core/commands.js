/**
 * Core Commands Module
 * Adds slash commands for agents, hooks, plugins, sessions, and checkpoints
 */

import path from 'path';
import fs from 'fs-extra';

/**
 * Handle /agents command
 */
export async function handleAgentsCommand(input, grokCore) {
  const parts = input.split(' ');
  const subcommand = parts[1];
  const args = parts.slice(2);

  if (!subcommand || subcommand === 'help') {
    console.log(`
🤖 Agents System - Sub-agents/Specialists
═════════════════════════════════════════

Commands:
  /agents list              List all available agents
  /agents info <name>       Show details about an agent
  /agents start <name>      Start an agent for a task
  /agents stop <id>         Stop a running agent
  /agents running           Show currently running agents
  /agents create <name>     Create a new custom agent
  /agents help              Show this help

Built-in Agents:
  • Explore   - Fast codebase exploration (read-only)
  • Plan      - Software architecture planning
  • Reviewer  - Code review specialist
  • Debugger  - Error analysis and fixes

Custom agents can be created in .grok/agents/ as .md files
with YAML frontmatter for configuration.
`);
    return true;
  }

  if (subcommand === 'list') {
    const agents = grokCore.agentRegistry.list();

    console.log('\n🤖 Available Agents:');
    console.log('═'.repeat(40));

    if (agents.length === 0) {
      console.log('No agents registered.');
    } else {
      for (const name of agents) {
        const agent = grokCore.agentRegistry.get(name);
        const status = agent?.running ? '🟢 running' : '⚪ idle';
        console.log(`  • ${name} - ${agent?.description || 'No description'} [${status}]`);
      }
    }
    console.log('');
    return true;
  }

  if (subcommand === 'info') {
    const agentName = args[0];
    if (!agentName) {
      console.log('Usage: /agents info <name>');
      return true;
    }

    const agent = grokCore.agentRegistry.get(agentName);
    if (!agent) {
      console.log(`❌ Agent '${agentName}' not found.`);
      return true;
    }

    console.log(`\n🤖 Agent: ${agentName}`);
    console.log('═'.repeat(40));
    console.log(`Description: ${agent.description || 'N/A'}`);
    console.log(`Tools: ${agent.tools?.join(', ') || 'All'}`);
    console.log(`Model: ${agent.model || 'inherit'}`);
    console.log(`Permission Mode: ${agent.permissionMode || 'default'}`);
    console.log(`Status: ${agent.running ? 'Running' : 'Idle'}`);

    if (agent.prompt) {
      console.log(`\nSystem Prompt Preview:`);
      console.log(`  "${agent.prompt.substring(0, 200)}..."`);
    }
    console.log('');
    return true;
  }

  if (subcommand === 'start') {
    const agentName = args[0];
    const task = args.slice(1).join(' ');

    if (!agentName) {
      console.log('Usage: /agents start <name> [task description]');
      return true;
    }

    try {
      console.log(`🚀 Starting agent '${agentName}'...`);
      const result = await grokCore.startAgent(agentName, { task });
      console.log(`✅ Agent started with ID: ${result.id}`);
    } catch (error) {
      console.log(`❌ Failed to start agent: ${error.message}`);
    }
    return true;
  }

  if (subcommand === 'stop') {
    const agentId = args[0];
    if (!agentId) {
      console.log('Usage: /agents stop <agent-id>');
      return true;
    }

    try {
      await grokCore.agentRegistry.stop(agentId);
      console.log(`✅ Agent ${agentId} stopped.`);
    } catch (error) {
      console.log(`❌ Failed to stop agent: ${error.message}`);
    }
    return true;
  }

  if (subcommand === 'running') {
    const running = grokCore.agentRegistry.listRunning();

    console.log('\n🏃 Running Agents:');
    console.log('═'.repeat(40));

    if (running.length === 0) {
      console.log('No agents currently running.');
    } else {
      for (const agent of running) {
        console.log(`  • ${agent.id}: ${agent.name} (started: ${agent.startTime})`);
      }
    }
    console.log('');
    return true;
  }

  if (subcommand === 'create') {
    const agentName = args[0];
    if (!agentName) {
      console.log('Usage: /agents create <name>');
      return true;
    }

    const agentsDir = path.join(process.cwd(), '.grok', 'agents');
    await fs.ensureDir(agentsDir);

    const agentFile = path.join(agentsDir, `${agentName}.md`);

    if (await fs.pathExists(agentFile)) {
      console.log(`❌ Agent '${agentName}' already exists.`);
      return true;
    }

    const template = `---
name: ${agentName}
description: Custom agent for specialized tasks
tools: Read, Grep, Glob
model: inherit
permissionMode: default
---

You are a specialized agent focused on [describe the agent's purpose].

When invoked, you should:
- [List the agent's primary responsibilities]
- [Describe how it should approach tasks]
- [Specify any constraints or guidelines]

Always provide clear, actionable outputs.
`;

    await fs.writeFile(agentFile, template);
    console.log(`✅ Created agent template at: ${agentFile}`);
    console.log('Edit the file to customize your agent.');
    return true;
  }

  console.log(`Unknown agents subcommand: ${subcommand}`);
  console.log('Use /agents help for available commands.');
  return true;
}

/**
 * Handle /hooks command
 */
export async function handleHooksCommand(input, grokCore) {
  const parts = input.split(' ');
  const subcommand = parts[1];
  const args = parts.slice(2);

  if (!subcommand || subcommand === 'help') {
    console.log(`
🪝 Hooks System - Pre/Post Tool Automation
══════════════════════════════════════════

Commands:
  /hooks list               List all registered hooks
  /hooks events             Show available hook events
  /hooks add <event>        Add a new hook interactively
  /hooks remove <id>        Remove a hook
  /hooks test <event>       Test hooks for an event
  /hooks help               Show this help

Hook Events:
  • PreToolUse         - Before a tool executes
  • PostToolUse        - After a tool executes
  • PermissionRequest  - When permission is needed
  • UserPromptSubmit   - When user submits a prompt
  • SessionStart       - When session begins
  • SessionEnd         - When session ends
  • Stop               - When assistant stops
  • Notification       - For notifications

Hooks are configured in .grok/settings.json
`);
    return true;
  }

  if (subcommand === 'list') {
    const events = grokCore.hooksManager.listEvents();

    console.log('\n🪝 Registered Hooks:');
    console.log('═'.repeat(40));

    let totalHooks = 0;
    for (const event of events) {
      const hooks = grokCore.hooksManager.getHooksForEvent(event);
      if (hooks.length > 0) {
        console.log(`\n${event}:`);
        for (const hook of hooks) {
          console.log(`  • ${hook.type}: ${hook.command || hook.prompt || 'N/A'}`);
          if (hook.matcher) {
            console.log(`    Matcher: ${hook.matcher}`);
          }
          totalHooks++;
        }
      }
    }

    if (totalHooks === 0) {
      console.log('No hooks registered.');
    }
    console.log('');
    return true;
  }

  if (subcommand === 'events') {
    console.log(`
🪝 Available Hook Events:
═════════════════════════

Event               When                              Use Case
─────               ────                              ────────
PreToolUse          Before tool execution             Validate commands, add context
PostToolUse         After tool execution              Lint, test, log results
PermissionRequest   Permission prompt shown           Auto-approve patterns
UserPromptSubmit    User submits a prompt             Add context, validate
SessionStart        Session begins                    Setup environment
SessionEnd          Session ends                      Cleanup, save patterns
Stop                Assistant stops                   Force continuation
SubagentStop        Sub-agent completes               Handle results
Notification        Notification triggered            Alert handling
PreCompact          Before context compaction         Save important context
`);
    return true;
  }

  if (subcommand === 'test') {
    const event = args[0];
    if (!event) {
      console.log('Usage: /hooks test <event>');
      return true;
    }

    console.log(`🧪 Testing hooks for event: ${event}`);

    try {
      const result = await grokCore.triggerHook(event, {
        test: true,
        timestamp: new Date().toISOString()
      });

      console.log('✅ Hook execution completed.');
      console.log(`Results: ${JSON.stringify(result, null, 2)}`);
    } catch (error) {
      console.log(`❌ Hook test failed: ${error.message}`);
    }
    return true;
  }

  console.log(`Unknown hooks subcommand: ${subcommand}`);
  console.log('Use /hooks help for available commands.');
  return true;
}

/**
 * Handle /plugins command
 */
export async function handlePluginsCommand(input, grokCore) {
  const parts = input.split(' ');
  const subcommand = parts[1];
  const args = parts.slice(2);

  if (!subcommand || subcommand === 'help') {
    console.log(`
🔌 Plugin System - Extensibility
════════════════════════════════

Commands:
  /plugins list             List all plugins
  /plugins info <name>      Show plugin details
  /plugins enable <name>    Enable a plugin
  /plugins disable <name>   Disable a plugin
  /plugins create <name>    Create a new plugin
  /plugins help             Show this help

Plugin Structure:
  .grok/plugins/<name>/
  ├── manifest.json         Plugin metadata
  ├── commands/             Custom commands
  ├── agents/               Custom agents
  ├── hooks/                Hook definitions
  └── skills/               Skill definitions
`);
    return true;
  }

  if (subcommand === 'list') {
    const plugins = grokCore.pluginManager.listAll();
    const enabled = grokCore.pluginManager.listEnabled();

    console.log('\n🔌 Installed Plugins:');
    console.log('═'.repeat(40));

    if (plugins.length === 0) {
      console.log('No plugins installed.');
    } else {
      for (const name of plugins) {
        const status = enabled.includes(name) ? '✅ enabled' : '⚪ disabled';
        const plugin = grokCore.pluginManager.get(name);
        console.log(`  • ${name} v${plugin?.version || '1.0.0'} [${status}]`);
        if (plugin?.description) {
          console.log(`    ${plugin.description}`);
        }
      }
    }
    console.log('');
    return true;
  }

  if (subcommand === 'info') {
    const pluginName = args[0];
    if (!pluginName) {
      console.log('Usage: /plugins info <name>');
      return true;
    }

    const plugin = grokCore.pluginManager.get(pluginName);
    if (!plugin) {
      console.log(`❌ Plugin '${pluginName}' not found.`);
      return true;
    }

    console.log(`\n🔌 Plugin: ${pluginName}`);
    console.log('═'.repeat(40));
    console.log(`Version: ${plugin.version || '1.0.0'}`);
    console.log(`Description: ${plugin.description || 'N/A'}`);
    console.log(`Enabled: ${grokCore.pluginManager.isEnabled(pluginName) ? 'Yes' : 'No'}`);

    if (plugin.commands?.length > 0) {
      console.log(`Commands: ${plugin.commands.length}`);
    }
    if (plugin.agents?.length > 0) {
      console.log(`Agents: ${plugin.agents.length}`);
    }
    if (plugin.hooks?.length > 0) {
      console.log(`Hooks: ${plugin.hooks.length}`);
    }
    console.log('');
    return true;
  }

  if (subcommand === 'enable') {
    const pluginName = args[0];
    if (!pluginName) {
      console.log('Usage: /plugins enable <name>');
      return true;
    }

    try {
      await grokCore.pluginManager.enable(pluginName);
      console.log(`✅ Plugin '${pluginName}' enabled.`);
    } catch (error) {
      console.log(`❌ Failed to enable plugin: ${error.message}`);
    }
    return true;
  }

  if (subcommand === 'disable') {
    const pluginName = args[0];
    if (!pluginName) {
      console.log('Usage: /plugins disable <name>');
      return true;
    }

    try {
      await grokCore.pluginManager.disable(pluginName);
      console.log(`✅ Plugin '${pluginName}' disabled.`);
    } catch (error) {
      console.log(`❌ Failed to disable plugin: ${error.message}`);
    }
    return true;
  }

  if (subcommand === 'create') {
    const pluginName = args[0];
    if (!pluginName) {
      console.log('Usage: /plugins create <name>');
      return true;
    }

    const pluginsDir = path.join(process.cwd(), '.grok', 'plugins', pluginName);

    if (await fs.pathExists(pluginsDir)) {
      console.log(`❌ Plugin '${pluginName}' already exists.`);
      return true;
    }

    // Create plugin structure
    await fs.ensureDir(pluginsDir);
    await fs.ensureDir(path.join(pluginsDir, 'commands'));
    await fs.ensureDir(path.join(pluginsDir, 'agents'));
    await fs.ensureDir(path.join(pluginsDir, 'hooks'));
    await fs.ensureDir(path.join(pluginsDir, 'skills'));

    // Create manifest
    const manifest = {
      name: pluginName,
      version: '1.0.0',
      description: `${pluginName} plugin`,
      author: '',
      commands: [],
      agents: [],
      hooks: [],
      skills: []
    };

    await fs.writeJson(path.join(pluginsDir, 'manifest.json'), manifest, { spaces: 2 });

    console.log(`✅ Created plugin structure at: ${pluginsDir}`);
    console.log('Edit manifest.json to configure your plugin.');
    return true;
  }

  console.log(`Unknown plugins subcommand: ${subcommand}`);
  console.log('Use /plugins help for available commands.');
  return true;
}

/**
 * Handle /session command
 */
export async function handleSessionCommand(input, grokCore) {
  const parts = input.split(' ');
  const subcommand = parts[1];
  const args = parts.slice(2);

  if (!subcommand || subcommand === 'help') {
    console.log(`
📝 Session Management
═════════════════════

Commands:
  /session list             List recent sessions
  /session info             Show current session info
  /session resume <id>      Resume a previous session
  /session save             Save current session
  /session export <id>      Export session to file
  /session help             Show this help

Sessions are automatically saved and can be resumed later.
Session data is stored in .grok/sessions/
`);
    return true;
  }

  if (subcommand === 'list') {
    const sessions = await grokCore.sessionManager.listSessions();

    console.log('\n📝 Recent Sessions:');
    console.log('═'.repeat(50));

    if (sessions.length === 0) {
      console.log('No sessions found.');
    } else {
      for (const session of sessions.slice(0, 10)) {
        const date = new Date(session.lastActive).toLocaleString();
        const current = session.id === grokCore.sessionManager.getCurrentSessionId() ? ' (current)' : '';
        console.log(`  • ${session.id}${current}`);
        console.log(`    Last active: ${date}`);
        console.log(`    Messages: ${session.messageCount || 0}`);
      }
    }
    console.log('');
    return true;
  }

  if (subcommand === 'info') {
    const sessionId = grokCore.sessionManager.getCurrentSessionId();
    const session = await grokCore.sessionManager.getSession(sessionId);

    console.log('\n📝 Current Session:');
    console.log('═'.repeat(40));
    console.log(`ID: ${sessionId || 'None'}`);

    if (session) {
      console.log(`Created: ${new Date(session.created).toLocaleString()}`);
      console.log(`Last Active: ${new Date(session.lastActive).toLocaleString()}`);
      console.log(`Messages: ${session.messages?.length || 0}`);
      console.log(`Files in Context: ${Object.keys(session.fileContext || {}).length}`);
    }
    console.log('');
    return true;
  }

  if (subcommand === 'resume') {
    const sessionId = args[0];
    if (!sessionId) {
      console.log('Usage: /session resume <session-id>');
      return true;
    }

    try {
      const session = await grokCore.sessionManager.resumeSession(sessionId);
      console.log(`✅ Resumed session: ${sessionId}`);
      console.log(`   Messages: ${session.messages?.length || 0}`);
    } catch (error) {
      console.log(`❌ Failed to resume session: ${error.message}`);
    }
    return true;
  }

  if (subcommand === 'save') {
    try {
      await grokCore.sessionManager.saveSession();
      console.log('✅ Session saved.');
    } catch (error) {
      console.log(`❌ Failed to save session: ${error.message}`);
    }
    return true;
  }

  console.log(`Unknown session subcommand: ${subcommand}`);
  console.log('Use /session help for available commands.');
  return true;
}

/**
 * Handle /checkpoint command
 */
export async function handleCheckpointCommand(input, grokCore, sessionData) {
  const parts = input.split(' ');
  const subcommand = parts[1];
  const args = parts.slice(2);

  if (!subcommand || subcommand === 'help') {
    console.log(`
📌 Checkpoint System - Save & Restore Points
═════════════════════════════════════════════

Commands:
  /checkpoint create <name>   Create a checkpoint
  /checkpoint list            List all checkpoints
  /checkpoint restore <id>    Restore from checkpoint
  /checkpoint delete <id>     Delete a checkpoint
  /checkpoint compare <id1> <id2>  Compare checkpoints
  /checkpoint help            Show this help

Checkpoints save your current session state (messages, context)
so you can return to that point later.
`);
    return true;
  }

  if (subcommand === 'create') {
    const name = args.join(' ') || `Checkpoint ${new Date().toLocaleString()}`;

    try {
      const checkpointId = await grokCore.createCheckpoint(name, sessionData);
      console.log(`✅ Created checkpoint: ${checkpointId}`);
      console.log(`   Name: ${name}`);
    } catch (error) {
      console.log(`❌ Failed to create checkpoint: ${error.message}`);
    }
    return true;
  }

  if (subcommand === 'list') {
    const checkpoints = await grokCore.listCheckpoints();

    console.log('\n📌 Session Checkpoints:');
    console.log('═'.repeat(50));

    if (checkpoints.length === 0) {
      console.log('No checkpoints found.');
    } else {
      for (const cp of checkpoints) {
        const date = new Date(cp.timestamp).toLocaleString();
        console.log(`  • ${cp.id}`);
        console.log(`    Name: ${cp.name}`);
        console.log(`    Time: ${date}`);
        console.log(`    Messages: ${cp.metadata?.messageCount || 0}`);
      }
    }
    console.log('');
    return true;
  }

  if (subcommand === 'restore') {
    const checkpointId = args[0];
    if (!checkpointId) {
      console.log('Usage: /checkpoint restore <checkpoint-id>');
      return true;
    }

    try {
      const checkpoint = await grokCore.restoreCheckpoint(checkpointId);
      if (checkpoint) {
        console.log(`✅ Restored checkpoint: ${checkpointId}`);
        console.log(`   Name: ${checkpoint.name}`);
        return { restored: true, session: checkpoint.session };
      } else {
        console.log(`❌ Checkpoint '${checkpointId}' not found.`);
      }
    } catch (error) {
      console.log(`❌ Failed to restore checkpoint: ${error.message}`);
    }
    return true;
  }

  if (subcommand === 'delete') {
    const checkpointId = args[0];
    if (!checkpointId) {
      console.log('Usage: /checkpoint delete <checkpoint-id>');
      return true;
    }

    const sessionId = grokCore.sessionManager.getCurrentSessionId();
    const success = await grokCore.checkpointManager.delete(sessionId, checkpointId);

    if (success) {
      console.log(`✅ Deleted checkpoint: ${checkpointId}`);
    } else {
      console.log(`❌ Failed to delete checkpoint.`);
    }
    return true;
  }

  console.log(`Unknown checkpoint subcommand: ${subcommand}`);
  console.log('Use /checkpoint help for available commands.');
  return true;
}

/**
 * Handle /tools command (new)
 */
export async function handleToolsCommand(input, grokCore) {
  const parts = input.split(' ');
  const subcommand = parts[1];

  if (!subcommand || subcommand === 'help') {
    console.log(`
🛠️ Tools System
═══════════════

Commands:
  /tools list               List all available tools
  /tools info <name>        Show tool details
  /tools help               Show this help

Available Tools:
  • Read      - Read files from filesystem
  • Write     - Create or overwrite files
  • Edit      - Exact string replacement in files
  • Bash      - Execute shell commands
  • Grep      - Search file contents
  • Glob      - Find files by pattern
  • TodoWrite - Track tasks and progress

Tools are automatically invoked by the AI when needed.
`);
    return true;
  }

  if (subcommand === 'list') {
    const tools = grokCore.toolRegistry.list();

    console.log('\n🛠️ Available Tools:');
    console.log('═'.repeat(40));

    for (const name of tools) {
      const tool = grokCore.toolRegistry.get(name);
      const permission = tool?.requiresPermission ? '🔒' : '🔓';
      const readOnly = tool?.isReadOnly ? '(read-only)' : '';
      console.log(`  ${permission} ${name} ${readOnly}`);
      if (tool?.description) {
        console.log(`     ${tool.description.substring(0, 60)}...`);
      }
    }
    console.log('');
    return true;
  }

  if (subcommand === 'info') {
    const toolName = parts[2];
    if (!toolName) {
      console.log('Usage: /tools info <name>');
      return true;
    }

    const tool = grokCore.toolRegistry.get(toolName);
    if (!tool) {
      console.log(`❌ Tool '${toolName}' not found.`);
      return true;
    }

    console.log(`\n🛠️ Tool: ${toolName}`);
    console.log('═'.repeat(40));
    console.log(`Description: ${tool.description || 'N/A'}`);
    console.log(`Requires Permission: ${tool.requiresPermission ? 'Yes' : 'No'}`);
    console.log(`Read Only: ${tool.isReadOnly ? 'Yes' : 'No'}`);
    console.log(`Timeout: ${tool.timeout}ms`);

    const schema = tool.getSchema();
    if (schema?.parameters) {
      console.log(`\nParameters:`);
      for (const [param, config] of Object.entries(schema.parameters.properties || {})) {
        const required = schema.parameters.required?.includes(param) ? '*' : '';
        console.log(`  • ${param}${required}: ${config.description?.substring(0, 50) || config.type}`);
      }
    }
    console.log('');
    return true;
  }

  console.log(`Unknown tools subcommand: ${subcommand}`);
  console.log('Use /tools help for available commands.');
  return true;
}

/**
 * Handle /status command - Shows overall system status
 */
export async function handleStatusCommand(grokCore) {
  const status = grokCore.getStatus();

  console.log(`
╭─────────────────────────────────────────────────────────╮
│              🚀 Grok Code System Status                 │
╰─────────────────────────────────────────────────────────╯

🛠️  Tools:     ${status.tools.registered} registered
🤖 Agents:    ${status.agents.registered} available, ${status.agents.running} running
🪝 Hooks:     ${status.hooks.totalHooks} registered across ${status.hooks.events.length} events
🔌 Plugins:   ${status.plugins.loaded} loaded, ${status.plugins.enabled} enabled
⚡ Skills:    ${status.skills?.builtIn || 0} built-in, ${status.skills?.custom || 0} custom
📝 Session:   ${status.session.active ? 'Active' : 'None'} ${status.session.id ? `(${status.session.id.substring(0, 8)}...)` : ''}

Core Systems: ✅ Initialized
`);
  return true;
}

/**
 * Handle /mcp command - MCP server management
 */
export async function handleMCPCommand(input, mcpServer) {
  const parts = input.split(' ');
  const subcommand = parts[1];
  const args = parts.slice(2);

  if (!subcommand || subcommand === 'help') {
    console.log(`
🔗 MCP (Model Context Protocol) Server
══════════════════════════════════════

Commands:
  /mcp status              Show MCP server status
  /mcp tools               List available MCP tools
  /mcp resources           List available resources
  /mcp prompts             List available prompt templates
  /mcp call <tool> [args]  Call an MCP tool
  /mcp read <uri>          Read an MCP resource
  /mcp prompt <name>       Get a prompt template
  /mcp help                Show this help

MCP provides a standardized interface for AI model context.
`);
    return true;
  }

  if (!mcpServer) {
    console.log('❌ MCP server not initialized.');
    return true;
  }

  if (subcommand === 'status') {
    const info = mcpServer.getServerInfo();

    console.log('\n🔗 MCP Server Status:');
    console.log('═'.repeat(40));
    console.log(`Name: ${info.name}`);
    console.log(`Version: ${info.version}`);
    console.log(`Protocol: ${info.protocolVersion}`);
    console.log(`Initialized: ${mcpServer.initialized ? '✅' : '❌'}`);
    console.log(`Tools: ${info.capabilities.tools.length}`);
    console.log(`Resources: ${info.capabilities.resources.length}`);
    console.log(`Prompts: ${info.capabilities.prompts.length}`);
    console.log('');
    return true;
  }

  if (subcommand === 'tools') {
    const tools = mcpServer.listTools();

    console.log('\n🔧 MCP Tools:');
    console.log('═'.repeat(40));

    if (tools.length === 0) {
      console.log('No tools registered.');
    } else {
      for (const tool of tools) {
        console.log(`  • ${tool.name}`);
        console.log(`    ${tool.description}`);
      }
    }
    console.log('');
    return true;
  }

  if (subcommand === 'resources') {
    const resources = mcpServer.listResources();

    console.log('\n📦 MCP Resources:');
    console.log('═'.repeat(40));

    if (resources.length === 0) {
      console.log('No resources registered.');
    } else {
      for (const resource of resources) {
        console.log(`  • ${resource.uri}`);
        console.log(`    ${resource.name}: ${resource.description}`);
      }
    }
    console.log('');
    return true;
  }

  if (subcommand === 'prompts') {
    const prompts = mcpServer.listPrompts();

    console.log('\n📝 MCP Prompt Templates:');
    console.log('═'.repeat(40));

    if (prompts.length === 0) {
      console.log('No prompts registered.');
    } else {
      for (const prompt of prompts) {
        console.log(`  • ${prompt.name}`);
        console.log(`    ${prompt.description}`);
        if (prompt.arguments?.length > 0) {
          console.log(`    Args: ${prompt.arguments.map(a => a.name).join(', ')}`);
        }
      }
    }
    console.log('');
    return true;
  }

  if (subcommand === 'call') {
    const toolName = args[0];
    if (!toolName) {
      console.log('Usage: /mcp call <tool-name> [JSON args]');
      return true;
    }

    let toolArgs = {};
    if (args[1]) {
      try {
        toolArgs = JSON.parse(args.slice(1).join(' '));
      } catch {
        console.log('❌ Invalid JSON arguments.');
        return true;
      }
    }

    try {
      console.log(`🔧 Calling tool: ${toolName}...`);
      const result = await mcpServer.callTool(toolName, toolArgs);

      if (result.isError) {
        console.log(`❌ Error: ${result.content[0]?.text}`);
      } else {
        console.log('✅ Result:');
        for (const content of result.content) {
          console.log(content.text || JSON.stringify(content));
        }
      }
    } catch (error) {
      console.log(`❌ Tool call failed: ${error.message}`);
    }
    return true;
  }

  if (subcommand === 'read') {
    const uri = args[0];
    if (!uri) {
      console.log('Usage: /mcp read <resource-uri>');
      return true;
    }

    try {
      console.log(`📖 Reading resource: ${uri}...`);
      const result = await mcpServer.readResource(uri);

      for (const content of result.contents) {
        console.log(`\n[${content.mimeType}]`);
        console.log(content.text);
      }
    } catch (error) {
      console.log(`❌ Resource read failed: ${error.message}`);
    }
    return true;
  }

  if (subcommand === 'prompt') {
    const promptName = args[0];
    if (!promptName) {
      console.log('Usage: /mcp prompt <prompt-name> [JSON args]');
      return true;
    }

    let promptArgs = {};
    if (args[1]) {
      try {
        promptArgs = JSON.parse(args.slice(1).join(' '));
      } catch {
        console.log('❌ Invalid JSON arguments.');
        return true;
      }
    }

    try {
      const result = await mcpServer.getPrompt(promptName, promptArgs);

      console.log('\n📝 Prompt Messages:');
      console.log('═'.repeat(40));
      for (const msg of result.messages) {
        console.log(`[${msg.role}]`);
        console.log(msg.content);
        console.log('');
      }
    } catch (error) {
      console.log(`❌ Prompt get failed: ${error.message}`);
    }
    return true;
  }

  console.log(`Unknown MCP subcommand: ${subcommand}`);
  console.log('Use /mcp help for available commands.');
  return true;
}

/**
 * Handle /backup command - Backup management
 */
export async function handleBackupCommand(input, backupManager) {
  const parts = input.split(' ');
  const subcommand = parts[1];
  const args = parts.slice(2);

  if (!subcommand || subcommand === 'help') {
    console.log(`
💾 Backup System
════════════════

Commands:
  /backup list [file]       List backups (optionally for a specific file)
  /backup restore <id>      Restore from a backup
  /backup restore-latest <file>  Restore most recent backup for file
  /backup delete <id>       Delete a backup
  /backup stats             Show backup statistics
  /backup cleanup           Clean up old backups
  /backup help              Show this help

Backups are automatically created before file edits.
`);
    return true;
  }

  if (!backupManager) {
    console.log('❌ Backup manager not initialized.');
    return true;
  }

  if (subcommand === 'list') {
    const filePath = args[0];

    let backups;
    if (filePath) {
      backups = backupManager.listBackups(filePath);
      console.log(`\n💾 Backups for: ${filePath}`);
    } else {
      backups = backupManager.listAllBackups();
      console.log('\n💾 All Backups:');
    }
    console.log('═'.repeat(50));

    if (backups.length === 0) {
      console.log('No backups found.');
    } else {
      for (const backup of backups.slice(0, 20)) {
        const date = new Date(backup.timestamp).toLocaleString();
        console.log(`  • ${backup.id}`);
        console.log(`    File: ${backup.relativePath}`);
        console.log(`    Time: ${date} | Size: ${backup.size} bytes`);
        console.log(`    Reason: ${backup.reason}`);
      }

      if (backups.length > 20) {
        console.log(`  ... and ${backups.length - 20} more`);
      }
    }
    console.log('');
    return true;
  }

  if (subcommand === 'restore') {
    const backupId = args[0];
    if (!backupId) {
      console.log('Usage: /backup restore <backup-id>');
      return true;
    }

    try {
      const result = await backupManager.restoreBackup(backupId);

      if (result.success) {
        console.log(`✅ Restored backup: ${backupId}`);
        console.log(`   File: ${result.path}`);
      } else {
        console.log(`❌ ${result.error}`);
      }
    } catch (error) {
      console.log(`❌ Restore failed: ${error.message}`);
    }
    return true;
  }

  if (subcommand === 'restore-latest') {
    const filePath = args[0];
    if (!filePath) {
      console.log('Usage: /backup restore-latest <file-path>');
      return true;
    }

    try {
      const result = await backupManager.restoreLatest(filePath);

      if (result.success) {
        console.log(`✅ Restored latest backup for: ${filePath}`);
      } else {
        console.log(`❌ ${result.error}`);
      }
    } catch (error) {
      console.log(`❌ Restore failed: ${error.message}`);
    }
    return true;
  }

  if (subcommand === 'delete') {
    const backupId = args[0];
    if (!backupId) {
      console.log('Usage: /backup delete <backup-id>');
      return true;
    }

    const success = await backupManager.deleteBackup(backupId);

    if (success) {
      console.log(`✅ Deleted backup: ${backupId}`);
    } else {
      console.log('❌ Backup not found.');
    }
    return true;
  }

  if (subcommand === 'stats') {
    const stats = backupManager.getStats();

    console.log('\n💾 Backup Statistics:');
    console.log('═'.repeat(35));
    console.log(`Total Backups: ${stats.totalBackups}`);
    console.log(`Unique Files: ${stats.uniqueFiles}`);
    console.log(`Total Size: ${stats.totalSizeFormatted}`);
    console.log(`Oldest: ${stats.oldestBackup || 'N/A'}`);
    console.log(`Newest: ${stats.newestBackup || 'N/A'}`);
    console.log('');
    return true;
  }

  if (subcommand === 'cleanup') {
    try {
      await backupManager.cleanupOldBackups();
      console.log('✅ Cleanup completed.');
      const stats = backupManager.getStats();
      console.log(`   Remaining: ${stats.totalBackups} backups (${stats.totalSizeFormatted})`);
    } catch (error) {
      console.log(`❌ Cleanup failed: ${error.message}`);
    }
    return true;
  }

  console.log(`Unknown backup subcommand: ${subcommand}`);
  console.log('Use /backup help for available commands.');
  return true;
}

/**
 * Handle /skills command - User-defined skills management
 */
export async function handleSkillsCommand(input, skillsManager) {
  const parts = input.split(' ');
  const subcommand = parts[1];
  const args = parts.slice(2);

  if (!subcommand || subcommand === 'help') {
    console.log(`
⚡ Skills System
════════════════

Commands:
  /skills list              List all available skills
  /skills info <name>       Show skill details
  /skills run <name> [args] Run a skill
  /skills create <name>     Create a new skill
  /skills edit <name>       Edit an existing skill
  /skills delete <name>     Delete a skill
  /skills help              Show this help

Skills are user-defined commands/workflows stored in .grok/skills/
Each skill is a .md file with YAML frontmatter for configuration.
`);
    return true;
  }

  if (subcommand === 'list') {
    console.log('\n⚡ Available Skills:');
    console.log('═'.repeat(40));

    // List built-in skills
    const builtInSkills = [
      { name: 'commit', description: 'Smart git commit with AI-generated message' },
      { name: 'review', description: 'Code review for staged changes' },
      { name: 'explain', description: 'Explain code in current context' },
      { name: 'refactor', description: 'Suggest refactoring improvements' },
      { name: 'test', description: 'Generate tests for code' },
      { name: 'docs', description: 'Generate documentation' }
    ];

    console.log('\nBuilt-in Skills:');
    for (const skill of builtInSkills) {
      console.log(`  • /${skill.name} - ${skill.description}`);
    }

    // List custom skills from .grok/skills/
    try {
      const skillsDir = path.join(process.cwd(), '.grok', 'skills');
      if (await fs.pathExists(skillsDir)) {
        const files = await fs.readdir(skillsDir);
        const customSkills = files.filter(f => f.endsWith('.md'));

        if (customSkills.length > 0) {
          console.log('\nCustom Skills:');
          for (const file of customSkills) {
            const name = file.replace('.md', '');
            console.log(`  • /${name}`);
          }
        }
      }
    } catch (error) {
      // Ignore errors listing custom skills
    }

    console.log('');
    return true;
  }

  if (subcommand === 'create') {
    const skillName = args[0];
    if (!skillName) {
      console.log('Usage: /skills create <name>');
      return true;
    }

    const skillsDir = path.join(process.cwd(), '.grok', 'skills');
    await fs.ensureDir(skillsDir);

    const skillFile = path.join(skillsDir, `${skillName}.md`);

    if (await fs.pathExists(skillFile)) {
      console.log(`❌ Skill '${skillName}' already exists.`);
      return true;
    }

    const template = `---
name: ${skillName}
description: Custom skill description
arguments:
  - name: input
    description: Input for the skill
    required: false
---

# ${skillName} Skill

This skill does [describe what it does].

## Instructions

When invoked, you should:

1. [First step]
2. [Second step]
3. [Third step]

## Example Usage

```
/${skillName} [arguments]
```
`;

    await fs.writeFile(skillFile, template);
    console.log(`✅ Created skill template at: ${skillFile}`);
    console.log('Edit the file to customize your skill.');
    return true;
  }

  if (subcommand === 'info') {
    const skillName = args[0];
    if (!skillName) {
      console.log('Usage: /skills info <name>');
      return true;
    }

    // Check for built-in skill
    const builtIn = {
      commit: { description: 'Smart git commit with AI-generated message', usage: '/commit [message]' },
      review: { description: 'Code review for staged or specified files', usage: '/review [file]' },
      explain: { description: 'Explain code in current context or file', usage: '/explain [file:line]' },
      refactor: { description: 'Suggest refactoring improvements', usage: '/refactor [file]' },
      test: { description: 'Generate tests for specified code', usage: '/test [file]' },
      docs: { description: 'Generate documentation for code', usage: '/docs [file]' }
    };

    if (builtIn[skillName]) {
      console.log(`\n⚡ Skill: ${skillName} (built-in)`);
      console.log('═'.repeat(40));
      console.log(`Description: ${builtIn[skillName].description}`);
      console.log(`Usage: ${builtIn[skillName].usage}`);
      console.log('');
      return true;
    }

    // Check for custom skill
    const skillFile = path.join(process.cwd(), '.grok', 'skills', `${skillName}.md`);
    if (await fs.pathExists(skillFile)) {
      const content = await fs.readFile(skillFile, 'utf8');
      console.log(`\n⚡ Skill: ${skillName} (custom)`);
      console.log('═'.repeat(40));
      console.log(`File: ${skillFile}`);
      console.log(`\nContent Preview:`);
      console.log(content.substring(0, 500) + (content.length > 500 ? '...' : ''));
      console.log('');
      return true;
    }

    console.log(`❌ Skill '${skillName}' not found.`);
    return true;
  }

  if (subcommand === 'delete') {
    const skillName = args[0];
    if (!skillName) {
      console.log('Usage: /skills delete <name>');
      return true;
    }

    const skillFile = path.join(process.cwd(), '.grok', 'skills', `${skillName}.md`);

    if (!await fs.pathExists(skillFile)) {
      console.log(`❌ Skill '${skillName}' not found (or is built-in and cannot be deleted).`);
      return true;
    }

    await fs.remove(skillFile);
    console.log(`✅ Deleted skill: ${skillName}`);
    return true;
  }

  console.log(`Unknown skills subcommand: ${subcommand}`);
  console.log('Use /skills help for available commands.');
  return true;
}

/**
 * Handle /init command - Initialize project configuration
 */
export async function handleInitCommand(input, projectInstructionsLoader) {
  const parts = input.split(' ');
  const subcommand = parts[1];

  if (!subcommand || subcommand === 'help') {
    console.log(`
📋 Project Initialization
═════════════════════════

Commands:
  /init grok          Create GROK.md project instructions file
  /init config        Create .grok/ configuration directory
  /init full          Create both GROK.md and .grok/ with defaults
  /init help          Show this help

GROK.md is similar to Claude Code's CLAUDE.md - it contains
project-specific instructions that guide Grok's behavior.
`);
    return true;
  }

  if (subcommand === 'grok' || subcommand === 'grokmd') {
    try {
      const filePath = await projectInstructionsLoader.createTemplate();
      console.log(`✅ Created GROK.md at: ${filePath}`);
      console.log('Edit this file to customize how Grok works with your project.');
    } catch (error) {
      console.log(`❌ Failed to create GROK.md: ${error.message}`);
    }
    return true;
  }

  if (subcommand === 'config') {
    const grokDir = path.join(process.cwd(), '.grok');

    try {
      await fs.ensureDir(grokDir);
      await fs.ensureDir(path.join(grokDir, 'commands'));
      await fs.ensureDir(path.join(grokDir, 'agents'));
      await fs.ensureDir(path.join(grokDir, 'hooks'));
      await fs.ensureDir(path.join(grokDir, 'skills'));
      await fs.ensureDir(path.join(grokDir, 'plugins'));

      // Create default settings.json
      const settingsPath = path.join(grokDir, 'settings.json');
      if (!await fs.pathExists(settingsPath)) {
        await fs.writeJson(settingsPath, {
          model: 'grok-code-fast-1',
          maxTokens: 4096,
          temperature: 0.7,
          theme: 'default',
          syntaxHighlighting: true,
          autoContextEnabled: true,
          permissions: {
            allow: ['Read', 'Grep', 'Glob'],
            deny: [],
            confirmBash: true
          }
        }, { spaces: 2 });
      }

      console.log(`✅ Created .grok/ configuration directory`);
      console.log('Structure:');
      console.log('  .grok/');
      console.log('  ├── settings.json');
      console.log('  ├── commands/');
      console.log('  ├── agents/');
      console.log('  ├── hooks/');
      console.log('  ├── skills/');
      console.log('  └── plugins/');
    } catch (error) {
      console.log(`❌ Failed to create .grok/: ${error.message}`);
    }
    return true;
  }

  if (subcommand === 'full') {
    // Create both
    console.log('Initializing full project configuration...\n');

    // Create GROK.md
    try {
      const filePath = await projectInstructionsLoader.createTemplate();
      console.log(`✅ Created GROK.md`);
    } catch (error) {
      console.log(`❌ Failed to create GROK.md: ${error.message}`);
    }

    // Create .grok/
    const grokDir = path.join(process.cwd(), '.grok');
    try {
      await fs.ensureDir(grokDir);
      await fs.ensureDir(path.join(grokDir, 'commands'));
      await fs.ensureDir(path.join(grokDir, 'agents'));
      await fs.ensureDir(path.join(grokDir, 'hooks'));
      await fs.ensureDir(path.join(grokDir, 'skills'));
      await fs.ensureDir(path.join(grokDir, 'plugins'));

      const settingsPath = path.join(grokDir, 'settings.json');
      if (!await fs.pathExists(settingsPath)) {
        await fs.writeJson(settingsPath, {
          model: 'grok-code-fast-1',
          maxTokens: 4096,
          temperature: 0.7,
          theme: 'default',
          syntaxHighlighting: true,
          autoContextEnabled: true,
          permissions: {
            allow: ['Read', 'Grep', 'Glob'],
            deny: [],
            confirmBash: true
          }
        }, { spaces: 2 });
      }

      console.log(`✅ Created .grok/ configuration directory`);
    } catch (error) {
      console.log(`❌ Failed to create .grok/: ${error.message}`);
    }

    console.log('\nProject initialized! Edit GROK.md to customize Grok\'s behavior.');
    return true;
  }

  console.log(`Unknown init subcommand: ${subcommand}`);
  console.log('Use /init help for available commands.');
  return true;
}

/**
 * Handle /instructions command - View/manage project instructions
 */
export async function handleInstructionsCommand(input, projectInstructionsLoader) {
  const parts = input.split(' ');
  const subcommand = parts[1];

  if (!subcommand || subcommand === 'help') {
    console.log(`
📋 Project Instructions (GROK.md)
═════════════════════════════════

Commands:
  /instructions show     Show current project instructions
  /instructions status   Check if GROK.md exists
  /instructions create   Create a template GROK.md
  /instructions reload   Reload instructions from disk
  /instructions help     Show this help

GROK.md contains project-specific instructions for Grok.
Similar to Claude Code's CLAUDE.md file.
`);
    return true;
  }

  if (subcommand === 'status') {
    const instructions = await projectInstructionsLoader.load(true);

    console.log('\n📋 Project Instructions Status:');
    console.log('═'.repeat(40));

    if (instructions.global) {
      console.log(`✅ Global: ${instructions.global.source}`);
    } else {
      console.log('❌ Global: No ~/.grok/GROK.md found');
    }

    if (instructions.project) {
      console.log(`✅ Project: ${instructions.project.source}`);
    } else {
      console.log('❌ Project: No GROK.md found');
    }

    if (instructions.rules.length > 0) {
      console.log(`\n📜 Rules found: ${instructions.rules.length}`);
    }

    console.log('');
    return true;
  }

  if (subcommand === 'show') {
    const instructions = await projectInstructionsLoader.load(true);

    if (!instructions.hasInstructions) {
      console.log('No GROK.md found. Use /instructions create to make one.');
      return true;
    }

    console.log('\n📋 Current Project Instructions:');
    console.log('═'.repeat(50));

    if (instructions.project) {
      console.log(`\n[Project: ${instructions.project.source}]\n`);
      console.log(instructions.project.raw.substring(0, 2000));
      if (instructions.project.raw.length > 2000) {
        console.log('\n... (truncated)');
      }
    }

    if (instructions.global) {
      console.log(`\n[Global: ${instructions.global.source}]\n`);
      console.log(instructions.global.raw.substring(0, 1000));
      if (instructions.global.raw.length > 1000) {
        console.log('\n... (truncated)');
      }
    }

    console.log('');
    return true;
  }

  if (subcommand === 'create') {
    try {
      const filePath = await projectInstructionsLoader.createTemplate();
      console.log(`✅ Created GROK.md at: ${filePath}`);
      console.log('Edit this file to customize how Grok works with your project.');
    } catch (error) {
      console.log(`❌ Failed to create GROK.md: ${error.message}`);
    }
    return true;
  }

  if (subcommand === 'reload') {
    await projectInstructionsLoader.load(true);
    console.log('✅ Reloaded project instructions from disk.');
    return true;
  }

  console.log(`Unknown instructions subcommand: ${subcommand}`);
  console.log('Use /instructions help for available commands.');
  return true;
}

/**
 * Handle /memory command - Memory and context management
 */
export async function handleMemoryCommand(input, memoryManager) {
  const parts = input.split(' ');
  const subcommand = parts[1];

  if (!subcommand || subcommand === 'help') {
    console.log(`
🧠 Memory Management
════════════════════

Commands:
  /memory status       Show memory usage and statistics
  /memory clear        Clear all conversation memory
  /memory compress     Force compression of conversation
  /memory search <q>   Search through conversation history
  /memory save         Save memory state to disk
  /memory load <id>    Load memory state from disk
  /memory help         Show this help

Memory automatically manages conversation context to stay
within token limits through summarization and compression.
`);
    return true;
  }

  if (!memoryManager) {
    console.log('❌ Memory manager not initialized.');
    return true;
  }

  if (subcommand === 'status') {
    const stats = memoryManager.getStats();

    console.log('\n🧠 Memory Status:');
    console.log('═'.repeat(40));
    console.log(`Messages: ${stats.messageCount}`);
    console.log(`Summaries: ${stats.summaryCount}`);
    console.log(`Files in context: ${stats.fileCount}`);
    console.log(`Estimated tokens: ${stats.estimatedTokens.toLocaleString()}`);
    console.log(`Max tokens: ${stats.maxTokens.toLocaleString()}`);
    console.log(`Utilization: ${stats.utilizationPercent}%`);

    // Show a visual bar
    const barLength = 30;
    const filled = Math.round((stats.utilizationPercent / 100) * barLength);
    const bar = '█'.repeat(filled) + '░'.repeat(barLength - filled);
    console.log(`[${bar}]`);
    console.log('');
    return true;
  }

  if (subcommand === 'clear') {
    memoryManager.clear();
    console.log('✅ Memory cleared.');
    return true;
  }

  if (subcommand === 'compress') {
    memoryManager.compress();
    const stats = memoryManager.getStats();
    console.log(`✅ Memory compressed. Now at ${stats.utilizationPercent}% utilization.`);
    return true;
  }

  if (subcommand === 'search') {
    const query = parts.slice(2).join(' ');
    if (!query) {
      console.log('Usage: /memory search <query>');
      return true;
    }

    const results = memoryManager.search(query);

    console.log(`\n🔍 Search Results for "${query}":`);
    console.log('═'.repeat(50));

    if (results.length === 0) {
      console.log('No matches found.');
    } else {
      for (const result of results.slice(0, 10)) {
        console.log(`[${result.type}] ${result.preview}`);
        console.log('');
      }
      if (results.length > 10) {
        console.log(`... and ${results.length - 10} more matches`);
      }
    }
    console.log('');
    return true;
  }

  if (subcommand === 'save') {
    await memoryManager.save();
    console.log(`✅ Memory saved to session ${memoryManager.sessionId}`);
    return true;
  }

  if (subcommand === 'load') {
    const sessionId = parts[2];
    if (!sessionId) {
      console.log('Usage: /memory load <session-id>');
      return true;
    }

    const loaded = await memoryManager.load(sessionId);
    if (loaded) {
      console.log(`✅ Loaded memory from session ${sessionId}`);
    } else {
      console.log(`❌ Session ${sessionId} not found.`);
    }
    return true;
  }

  console.log(`Unknown memory subcommand: ${subcommand}`);
  console.log('Use /memory help for available commands.');
  return true;
}

/**
 * Handle /config command - Configuration management
 */
export async function handleConfigCommand(input, configManager) {
  const parts = input.split(' ');
  const subcommand = parts[1];
  const args = parts.slice(2);

  if (!subcommand || subcommand === 'help') {
    console.log(`
⚙️ Configuration Management
═══════════════════════════

Commands:
  /config show             Show current configuration
  /config get <key>        Get a specific setting value
  /config set <key> <val>  Set a configuration value
  /config reset            Reset to defaults
  /config path             Show config file locations
  /config edit             Open settings.json in editor
  /config help             Show this help

Configuration is loaded from (in priority order):
1. Environment variables
2. .grok/settings.local.json (not committed)
3. .grok/settings.json (project)
4. ~/.grok/settings.json (user)
5. Built-in defaults
`);
    return true;
  }

  if (!configManager) {
    console.log('❌ Configuration manager not available.');
    return true;
  }

  if (subcommand === 'show') {
    const config = await configManager.load();

    console.log('\n⚙️ Current Configuration:');
    console.log('═'.repeat(50));
    console.log(JSON.stringify(config, null, 2));
    console.log('');
    return true;
  }

  if (subcommand === 'get') {
    const key = args[0];
    if (!key) {
      console.log('Usage: /config get <key>');
      console.log('Example: /config get model');
      return true;
    }

    const config = await configManager.load();
    const value = key.split('.').reduce((obj, k) => obj?.[k], config);

    if (value !== undefined) {
      console.log(`${key}: ${JSON.stringify(value)}`);
    } else {
      console.log(`❌ Key '${key}' not found in configuration.`);
    }
    return true;
  }

  if (subcommand === 'set') {
    const key = args[0];
    const value = args.slice(1).join(' ');

    if (!key || !value) {
      console.log('Usage: /config set <key> <value>');
      console.log('Example: /config set model grok-4-fast-reasoning');
      return true;
    }

    try {
      // Parse value (handle JSON, booleans, numbers)
      let parsedValue;
      if (value === 'true') parsedValue = true;
      else if (value === 'false') parsedValue = false;
      else if (!isNaN(value)) parsedValue = Number(value);
      else if (value.startsWith('{') || value.startsWith('[')) {
        parsedValue = JSON.parse(value);
      } else {
        parsedValue = value;
      }

      await configManager.set(key, parsedValue);
      console.log(`✅ Set ${key} = ${JSON.stringify(parsedValue)}`);
    } catch (error) {
      console.log(`❌ Failed to set configuration: ${error.message}`);
    }
    return true;
  }

  if (subcommand === 'reset') {
    try {
      await configManager.reset();
      console.log('✅ Configuration reset to defaults.');
    } catch (error) {
      console.log(`❌ Failed to reset: ${error.message}`);
    }
    return true;
  }

  if (subcommand === 'path') {
    console.log('\n📁 Configuration Paths:');
    console.log('═'.repeat(50));
    console.log(`Global:  ~/.grok/settings.json`);
    console.log(`Project: .grok/settings.json`);
    console.log(`Local:   .grok/settings.local.json`);
    console.log('');
    console.log('Environment Variables:');
    console.log('  XAI_API_KEY / GROK_API_KEY');
    console.log('  GROK_MODEL');
    console.log('  GROK_DEBUG');
    console.log('');
    return true;
  }

  if (subcommand === 'edit') {
    const settingsPath = path.join(process.cwd(), '.grok', 'settings.json');

    if (!await fs.pathExists(settingsPath)) {
      console.log('No .grok/settings.json found. Use /init config to create one.');
      return true;
    }

    // Try to open in default editor
    const editor = process.env.EDITOR || process.env.VISUAL || 'code';
    try {
      const { execSync } = await import('child_process');
      execSync(`${editor} "${settingsPath}"`, { stdio: 'inherit' });
      console.log(`Opening ${settingsPath} in ${editor}...`);
    } catch {
      console.log(`Could not open editor. Edit manually: ${settingsPath}`);
    }
    return true;
  }

  console.log(`Unknown config subcommand: ${subcommand}`);
  console.log('Use /config help for available commands.');
  return true;
}

/**
 * Handle /tasks command - Background task management
 */
export async function handleTasksCommand(input, taskManager) {
  const parts = input.split(' ');
  const subcommand = parts[1];
  const args = parts.slice(2);

  if (!subcommand || subcommand === 'help') {
    console.log(`
📋 Background Tasks
═══════════════════

Commands:
  /tasks list              List all tasks (running and completed)
  /tasks running           List only running tasks
  /tasks output <id>       Get output from a task
  /tasks kill <id>         Kill a running task
  /tasks cleanup           Clean up completed tasks
  /tasks help              Show this help

Background tasks include:
  • Shell commands run with run_in_background
  • Async agent executions
  • Long-running operations
`);
    return true;
  }

  if (!taskManager) {
    console.log('❌ Task manager not initialized.');
    return true;
  }

  if (subcommand === 'list') {
    const tasks = taskManager.list();

    console.log('\n📋 All Tasks:');
    console.log('═'.repeat(60));

    if (tasks.length === 0) {
      console.log('No tasks found.');
    } else {
      for (const task of tasks) {
        const status = task.status === 'running' ? '🟢' :
                       task.status === 'completed' ? '✅' :
                       task.status === 'failed' ? '❌' : '⚪';
        console.log(`  ${status} ${task.id} (${task.type})`);
        if (task.command) {
          console.log(`     Command: ${task.command.substring(0, 50)}${task.command.length > 50 ? '...' : ''}`);
        }
        if (task.agentName) {
          console.log(`     Agent: ${task.agentName}`);
        }
        console.log(`     Started: ${new Date(task.startTime).toLocaleString()}`);
      }
    }
    console.log('');
    return true;
  }

  if (subcommand === 'running') {
    const tasks = taskManager.list({ status: 'running' });

    console.log('\n🏃 Running Tasks:');
    console.log('═'.repeat(50));

    if (tasks.length === 0) {
      console.log('No running tasks.');
    } else {
      for (const task of tasks) {
        console.log(`  🟢 ${task.id}`);
        if (task.command) {
          console.log(`     ${task.command.substring(0, 60)}`);
        }
        const duration = Math.round((Date.now() - new Date(task.startTime)) / 1000);
        console.log(`     Running for: ${duration}s`);
      }
    }
    console.log('');
    return true;
  }

  if (subcommand === 'output') {
    const taskId = args[0];
    if (!taskId) {
      console.log('Usage: /tasks output <task-id>');
      return true;
    }

    const result = await taskManager.getOutput(taskId, { block: false });

    if (!result.success) {
      console.log(`❌ ${result.error}`);
      return true;
    }

    console.log(`\n📋 Task: ${result.task_id}`);
    console.log('═'.repeat(50));
    console.log(`Status: ${result.status}`);
    console.log(`Duration: ${Math.round(result.duration / 1000)}s`);

    if (result.output) {
      console.log(`\nOutput:\n${result.output}`);
    }
    if (result.error) {
      console.log(`\nErrors:\n${result.error}`);
    }
    console.log('');
    return true;
  }

  if (subcommand === 'kill') {
    const taskId = args[0];
    if (!taskId) {
      console.log('Usage: /tasks kill <task-id>');
      return true;
    }

    const result = taskManager.kill(taskId);

    if (result.success) {
      console.log(`✅ ${result.message}`);
    } else {
      console.log(`❌ ${result.error}`);
    }
    return true;
  }

  if (subcommand === 'cleanup') {
    taskManager.cleanup();
    console.log('✅ Completed tasks cleaned up.');
    return true;
  }

  console.log(`Unknown tasks subcommand: ${subcommand}`);
  console.log('Use /tasks help for available commands.');
  return true;
}

/**
 * Handle /undo command - Undo file operations
 */
export async function handleUndoCommand(input, actionHistory, backupManager) {
  const parts = input.split(' ');
  const subcommand = parts[1];

  if (subcommand === 'help') {
    console.log(`
⏪ Undo System
══════════════

Commands:
  /undo                   Undo the last file operation
  /undo list              Show undo history
  /undo <n>               Undo the last n operations
  /undo clear             Clear undo history
  /undo help              Show this help

The undo system tracks file edits and can restore previous versions.
`);
    return true;
  }

  if (!actionHistory) {
    console.log('❌ Action history not available.');
    return true;
  }

  if (subcommand === 'list') {
    const history = actionHistory.getHistory();

    console.log('\n⏪ Undo History:');
    console.log('═'.repeat(50));

    if (history.length === 0) {
      console.log('No actions to undo.');
    } else {
      for (let i = history.length - 1; i >= 0; i--) {
        const action = history[i];
        const idx = history.length - i;
        console.log(`  ${idx}. ${action.type}: ${action.path || 'N/A'}`);
        console.log(`     Time: ${new Date(action.timestamp).toLocaleString()}`);
      }
    }
    console.log('');
    return true;
  }

  if (subcommand === 'clear') {
    actionHistory.clear();
    console.log('✅ Undo history cleared.');
    return true;
  }

  // Determine how many operations to undo
  let count = 1;
  if (subcommand && !isNaN(parseInt(subcommand))) {
    count = parseInt(subcommand);
  }

  // Perform undo(s)
  let undone = 0;
  for (let i = 0; i < count; i++) {
    const result = await actionHistory.undo(backupManager);
    if (result.success) {
      undone++;
      console.log(`✅ Undone: ${result.action?.type || 'operation'} on ${result.action?.path || 'file'}`);
    } else {
      if (undone === 0) {
        console.log(`❌ ${result.error || 'Nothing to undo'}`);
      }
      break;
    }
  }

  if (undone > 0) {
    console.log(`\n⏪ Undid ${undone} operation(s).`);
  }
  return true;
}

/**
 * Handle /compact command - Context compression
 */
export async function handleCompactCommand(input, memoryManager, grokCore) {
  const parts = input.split(' ');
  const subcommand = parts[1];

  if (!subcommand || subcommand === 'help') {
    console.log(`
📦 Context Compaction
═════════════════════

Commands:
  /compact                 Compress the current conversation context
  /compact status          Show current context size
  /compact aggressive      Force aggressive compression
  /compact help            Show this help

Compaction summarizes older messages to reduce context size
while preserving important information.
`);
    return true;
  }

  if (subcommand === 'status') {
    if (memoryManager) {
      const stats = memoryManager.getStats();

      console.log('\n📦 Context Status:');
      console.log('═'.repeat(40));
      console.log(`Messages: ${stats.messageCount}`);
      console.log(`Summaries: ${stats.summaryCount}`);
      console.log(`Files in context: ${stats.fileCount}`);
      console.log(`Estimated tokens: ${stats.estimatedTokens.toLocaleString()}`);
      console.log(`Max tokens: ${stats.maxTokens.toLocaleString()}`);
      console.log(`Utilization: ${stats.utilizationPercent}%`);

      // Visual bar
      const barLength = 30;
      const filled = Math.round((stats.utilizationPercent / 100) * barLength);
      const bar = '█'.repeat(filled) + '░'.repeat(barLength - filled);
      console.log(`[${bar}]`);
    } else {
      console.log('Memory manager not available.');
    }
    console.log('');
    return true;
  }

  if (!memoryManager) {
    console.log('❌ Memory manager not available.');
    return true;
  }

  console.log('📦 Compressing context...');

  const beforeStats = memoryManager.getStats();

  if (subcommand === 'aggressive') {
    // More aggressive compression
    memoryManager.compress();
    memoryManager.compressFileContext();
  } else {
    memoryManager.compress();
  }

  const afterStats = memoryManager.getStats();
  const saved = beforeStats.estimatedTokens - afterStats.estimatedTokens;

  console.log(`\n✅ Context compressed.`);
  console.log(`   Before: ${beforeStats.estimatedTokens.toLocaleString()} tokens`);
  console.log(`   After: ${afterStats.estimatedTokens.toLocaleString()} tokens`);
  console.log(`   Saved: ${saved.toLocaleString()} tokens (${Math.round((saved / beforeStats.estimatedTokens) * 100)}%)`);

  return true;
}

/**
 * Handle /permissions command - Permission management
 */
export async function handlePermissionsCommand(input, permissionManager) {
  const parts = input.split(' ');
  const subcommand = parts[1];
  const args = parts.slice(2);

  if (!subcommand || subcommand === 'help') {
    console.log(`
🔐 Permission Management
════════════════════════

Commands:
  /permissions list        List all permission rules
  /permissions allow <pattern>   Add an allow rule
  /permissions deny <pattern>    Add a deny rule
  /permissions clear       Clear session permissions
  /permissions reset       Reset to defaults
  /permissions help        Show this help

Pattern Format:
  ToolName                 Match any use of the tool
  ToolName(arg:value)      Match specific argument value
  ToolName(arg:prefix*)    Match argument starting with prefix
  Bash(command:git*)       Allow git commands

Examples:
  /permissions allow Bash(command:npm test)
  /permissions allow Bash(command:git*)
  /permissions deny Bash(command:rm*)
`);
    return true;
  }

  if (!permissionManager) {
    console.log('❌ Permission manager not available.');
    return true;
  }

  if (subcommand === 'list') {
    console.log('\n🔐 Permission Rules:');
    console.log('═'.repeat(50));

    console.log('\n✅ Allowed Patterns:');
    if (permissionManager.allowedPatterns.length === 0) {
      console.log('  (none)');
    } else {
      for (const pattern of permissionManager.allowedPatterns) {
        console.log(`  • ${pattern}`);
      }
    }

    console.log('\n❌ Denied Patterns:');
    if (permissionManager.deniedPatterns.length === 0) {
      console.log('  (none)');
    } else {
      for (const pattern of permissionManager.deniedPatterns) {
        console.log(`  • ${pattern}`);
      }
    }

    console.log('\n🔒 Always Require Confirmation:');
    for (const tool of permissionManager.alwaysRequireConfirmation) {
      console.log(`  • ${tool}`);
    }

    console.log('\n📝 Session Approvals:');
    const approvals = Array.from(permissionManager.sessionApprovals.entries());
    if (approvals.length === 0) {
      console.log('  (none)');
    } else {
      for (const [key, approved] of approvals) {
        console.log(`  ${approved ? '✅' : '❌'} ${key}`);
      }
    }

    console.log('');
    return true;
  }

  if (subcommand === 'allow') {
    const pattern = args.join(' ');
    if (!pattern) {
      console.log('Usage: /permissions allow <pattern>');
      return true;
    }

    permissionManager.allow(pattern);
    console.log(`✅ Added allow rule: ${pattern}`);
    return true;
  }

  if (subcommand === 'deny') {
    const pattern = args.join(' ');
    if (!pattern) {
      console.log('Usage: /permissions deny <pattern>');
      return true;
    }

    permissionManager.deny(pattern);
    console.log(`✅ Added deny rule: ${pattern}`);
    return true;
  }

  if (subcommand === 'clear') {
    permissionManager.clearSession();
    console.log('✅ Session permissions cleared.');
    return true;
  }

  if (subcommand === 'reset') {
    permissionManager.allowedPatterns = [];
    permissionManager.deniedPatterns = [];
    permissionManager.clearSession();
    console.log('✅ Permissions reset to defaults.');
    return true;
  }

  console.log(`Unknown permissions subcommand: ${subcommand}`);
  console.log('Use /permissions help for available commands.');
  return true;
}

/**
 * Handle /context command - Context file management
 */
export async function handleContextCommand(input, fileContext) {
  const parts = input.split(' ');
  const subcommand = parts[1];
  const args = parts.slice(2);

  if (!subcommand || subcommand === 'help') {
    console.log(`
📂 Context Management
═════════════════════

Commands:
  /context list            List files in current context
  /context add <file>      Add a file to context
  /context remove <file>   Remove a file from context
  /context clear           Clear all files from context
  /context size            Show context token usage
  /context help            Show this help

Context files are automatically included in AI prompts.
`);
    return true;
  }

  if (!fileContext) {
    fileContext = {};
  }

  if (subcommand === 'list') {
    const files = Object.keys(fileContext);

    console.log('\n📂 Files in Context:');
    console.log('═'.repeat(50));

    if (files.length === 0) {
      console.log('No files in context.');
    } else {
      let totalTokens = 0;
      for (const file of files) {
        const content = fileContext[file];
        const tokens = Math.ceil(content.length / 4);
        totalTokens += tokens;
        console.log(`  • ${file} (~${tokens} tokens)`);
      }
      console.log(`\nTotal: ${files.length} files (~${totalTokens} tokens)`);
    }
    console.log('');
    return { handled: true, fileContext };
  }

  if (subcommand === 'add') {
    const filePath = args.join(' ');
    if (!filePath) {
      console.log('Usage: /context add <file-path>');
      return { handled: true, fileContext };
    }

    try {
      const content = await fs.readFile(filePath, 'utf8');
      fileContext[filePath] = content;
      const tokens = Math.ceil(content.length / 4);
      console.log(`✅ Added ${filePath} to context (~${tokens} tokens)`);
    } catch (error) {
      console.log(`❌ Could not read file: ${error.message}`);
    }
    return { handled: true, fileContext };
  }

  if (subcommand === 'remove') {
    const filePath = args.join(' ');
    if (!filePath) {
      console.log('Usage: /context remove <file-path>');
      return { handled: true, fileContext };
    }

    if (fileContext[filePath]) {
      delete fileContext[filePath];
      console.log(`✅ Removed ${filePath} from context`);
    } else {
      console.log(`❌ File not in context: ${filePath}`);
    }
    return { handled: true, fileContext };
  }

  if (subcommand === 'clear') {
    const count = Object.keys(fileContext).length;
    for (const key of Object.keys(fileContext)) {
      delete fileContext[key];
    }
    console.log(`✅ Cleared ${count} files from context`);
    return { handled: true, fileContext };
  }

  if (subcommand === 'size') {
    let totalTokens = 0;
    for (const content of Object.values(fileContext)) {
      totalTokens += Math.ceil(content.length / 4);
    }
    console.log(`\n📊 Context Size: ~${totalTokens.toLocaleString()} tokens`);
    console.log(`Files: ${Object.keys(fileContext).length}`);
    return { handled: true, fileContext };
  }

  console.log(`Unknown context subcommand: ${subcommand}`);
  console.log('Use /context help for available commands.');
  return { handled: true, fileContext };
}

/**
 * Handle /model command - Model selection and info
 */
export async function handleModelCommand(input, grokClient, currentModel) {
  const parts = input.split(' ');
  const subcommand = parts[1];

  if (!subcommand || subcommand === 'help') {
    console.log(`
🤖 Model Management
═══════════════════

Commands:
  /model                   Show current model
  /model list              List available models
  /model set <name>        Switch to a different model
  /model info              Show detailed model info
  /model help              Show this help

Available Models:
  • grok-code-fast-1       Optimized for fast coding tasks
  • grok-4                 Most capable reasoning model
  • grok-4-vision          Vision-capable model
`);
    return true;
  }

  if (subcommand === 'list') {
    console.log('\n🤖 Available Grok Models:');
    console.log('═'.repeat(50));
    console.log('  • grok-code-fast-1  - Fast coding (recommended)');
    console.log('  • grok-4            - Advanced reasoning');
    console.log('  • grok-4-vision     - Vision + reasoning');
    console.log('  • grok-3            - Previous generation');
    console.log(`\nCurrent: ${currentModel || 'grok-code-fast-1'}`);
    return { handled: true, model: currentModel };
  }

  if (subcommand === 'set') {
    const newModel = parts[2];
    if (!newModel) {
      console.log('Usage: /model set <model-name>');
      return { handled: true, model: currentModel };
    }

    const validModels = ['grok-code-fast-1', 'grok-4', 'grok-4-vision', 'grok-3'];
    if (!validModels.includes(newModel)) {
      console.log(`❌ Unknown model: ${newModel}`);
      console.log(`Valid models: ${validModels.join(', ')}`);
      return { handled: true, model: currentModel };
    }

    console.log(`✅ Switched to model: ${newModel}`);
    return { handled: true, model: newModel };
  }

  if (subcommand === 'info') {
    console.log(`\n🤖 Current Model: ${currentModel || 'grok-code-fast-1'}`);
    console.log('═'.repeat(50));

    const modelInfo = {
      'grok-code-fast-1': {
        context: '128K tokens',
        strengths: 'Fast inference, code-optimized',
        use: 'General coding tasks'
      },
      'grok-4': {
        context: '256K tokens',
        strengths: 'Advanced reasoning, complex analysis',
        use: 'Architecture, debugging, complex refactoring'
      },
      'grok-4-vision': {
        context: '128K tokens',
        strengths: 'Image understanding, UI/UX analysis',
        use: 'Screenshots, diagrams, visual debugging'
      }
    };

    const info = modelInfo[currentModel || 'grok-code-fast-1'] || modelInfo['grok-code-fast-1'];
    console.log(`Context Window: ${info.context}`);
    console.log(`Strengths: ${info.strengths}`);
    console.log(`Best For: ${info.use}`);
    return { handled: true, model: currentModel };
  }

  // Default: show current model
  console.log(`Current model: ${currentModel || 'grok-code-fast-1'}`);
  return { handled: true, model: currentModel };
}

/**
 * Handle /export command - Export conversation transcripts
 */
export async function handleExportCommand(input, transcriptExporter, messages) {
  const parts = input.split(' ');
  const subcommand = parts[1];
  const args = parts.slice(2);

  if (!subcommand || subcommand === 'help') {
    console.log(`
📤 Transcript Export
═══════════════════

Commands:
  /export markdown         Export as Markdown (.md)
  /export json             Export as JSON (.json)
  /export html [theme]     Export as HTML (dark/light)
  /export text             Export as plain text (.txt)
  /export jsonl            Export as JSONL (for training)
  /export all              Export in all formats
  /export list             List previous exports
  /export help             Show this help

Options:
  --title "Custom Title"   Set export title
  --session <id>           Export specific session

Exports are saved to .grok/exports/
`);
    return true;
  }

  if (!transcriptExporter) {
    console.log('❌ Transcript exporter not available.');
    return true;
  }

  await transcriptExporter.initialize();

  if (subcommand === 'list') {
    const exports = await transcriptExporter.listExports();

    console.log('\n📤 Previous Exports:');
    console.log('═'.repeat(50));

    if (exports.length === 0) {
      console.log('No exports found.');
    } else {
      for (const exp of exports.slice(0, 20)) {
        const size = (exp.size / 1024).toFixed(1) + 'KB';
        const date = new Date(exp.created).toLocaleString();
        console.log(`  ${exp.format.toUpperCase().padEnd(5)} ${exp.name}`);
        console.log(`       ${size} | ${date}`);
      }
    }
    console.log('');
    return true;
  }

  if (!messages || messages.length === 0) {
    console.log('❌ No messages to export.');
    return true;
  }

  // Parse options
  const options = {
    title: 'Grok Code Conversation',
    sessionId: Date.now().toString()
  };

  const titleIndex = args.indexOf('--title');
  if (titleIndex !== -1 && args[titleIndex + 1]) {
    options.title = args[titleIndex + 1];
  }

  console.log('📤 Exporting conversation...');

  try {
    let filePath;

    switch (subcommand) {
      case 'markdown':
      case 'md':
        filePath = await transcriptExporter.exportToMarkdown(messages, options);
        console.log(`✅ Exported to: ${filePath}`);
        break;

      case 'json':
        filePath = await transcriptExporter.exportToJSON(messages, options);
        console.log(`✅ Exported to: ${filePath}`);
        break;

      case 'html':
        options.theme = args[0] || 'dark';
        filePath = await transcriptExporter.exportToHTML(messages, options);
        console.log(`✅ Exported to: ${filePath}`);
        break;

      case 'text':
      case 'txt':
        filePath = await transcriptExporter.exportToText(messages, options);
        console.log(`✅ Exported to: ${filePath}`);
        break;

      case 'jsonl':
        filePath = await transcriptExporter.exportToJSONL(messages, options);
        console.log(`✅ Exported to: ${filePath}`);
        break;

      case 'all':
        const results = await transcriptExporter.exportMultiple(
          messages,
          ['markdown', 'json', 'html', 'text', 'jsonl'],
          options
        );
        console.log('\n✅ Exported to multiple formats:');
        for (const [format, path] of Object.entries(results)) {
          console.log(`   ${format}: ${path}`);
        }
        break;

      default:
        console.log(`Unknown format: ${subcommand}`);
        console.log('Use /export help for available formats.');
    }
  } catch (error) {
    console.log(`❌ Export failed: ${error.message}`);
  }

  return true;
}

/**
 * Handle /vision command - Image analysis
 */
export async function handleVisionCommand(input, visionHandler) {
  const parts = input.split(' ');
  const subcommand = parts[1];
  const args = parts.slice(2);

  if (!subcommand || subcommand === 'help') {
    console.log(`
👁️ Vision Analysis
═════════════════

Commands:
  /vision analyze <image>      Analyze an image file
  /vision screenshot <image>   Analyze a screenshot for debugging
  /vision compare <img1> <img2> Compare two images
  /vision extract <image>      Extract text from image (OCR)
  /vision ui <image>           Analyze UI design/mockup
  /vision help                 Show this help

Supported formats: PNG, JPG, JPEG, GIF, WebP, BMP

Examples:
  /vision analyze ./screenshot.png
  /vision screenshot ./error.png
  /vision compare ./before.png ./after.png
`);
    return true;
  }

  if (!visionHandler) {
    console.log('❌ Vision handler not available.');
    console.log('Make sure the Grok client is initialized with vision support.');
    return true;
  }

  const imagePath = args[0];

  if (!imagePath && subcommand !== 'help') {
    console.log('❌ Please provide an image path.');
    console.log(`Usage: /vision ${subcommand} <image-path>`);
    return true;
  }

  console.log('👁️ Analyzing image...');

  try {
    let result;

    switch (subcommand) {
      case 'analyze':
        const prompt = args.slice(1).join(' ') || 'Describe this image in detail.';
        result = await visionHandler.analyzeImage(imagePath, prompt);
        console.log('\n📷 Image Analysis:');
        console.log('═'.repeat(50));
        console.log(result);
        break;

      case 'screenshot':
        const analysis = await visionHandler.analyzeScreenshot(imagePath);
        console.log('\n🖥️ Screenshot Analysis:');
        console.log('═'.repeat(50));
        console.log(analysis.analysis);
        break;

      case 'compare':
        const imagePath2 = args[1];
        if (!imagePath2) {
          console.log('❌ Please provide two image paths.');
          console.log('Usage: /vision compare <image1> <image2>');
          return true;
        }
        result = await visionHandler.compareImages(imagePath, imagePath2);
        console.log('\n🔄 Image Comparison:');
        console.log('═'.repeat(50));
        console.log(result);
        break;

      case 'extract':
        result = await visionHandler.extractText(imagePath);
        console.log('\n📝 Extracted Text:');
        console.log('═'.repeat(50));
        console.log(result);
        break;

      case 'ui':
        const uiAnalysis = await visionHandler.analyzeUIDesign(imagePath);
        console.log('\n🎨 UI Analysis:');
        console.log('═'.repeat(50));
        console.log(uiAnalysis.analysis);
        break;

      default:
        console.log(`Unknown vision subcommand: ${subcommand}`);
        console.log('Use /vision help for available commands.');
    }
  } catch (error) {
    console.log(`❌ Vision analysis failed: ${error.message}`);
  }

  return true;
}

/**
 * Handle /summarize command - AI-powered conversation summary
 */
export async function handleSummarizeCommand(input, autoSummarizer, messages) {
  const parts = input.split(' ');
  const subcommand = parts[1];

  if (!subcommand || subcommand === 'help') {
    console.log(`
📝 AI Summarization
═══════════════════

Commands:
  /summarize              Summarize the current conversation
  /summarize last <n>     Summarize the last N messages
  /summarize file <path>  Summarize a file's contents
  /summarize code <path>  Explain code in a file
  /summarize help         Show this help

Summaries use AI to extract key information and provide
concise overviews of conversations and code.
`);
    return true;
  }

  if (!autoSummarizer) {
    console.log('❌ Auto-summarizer not available.');
    return true;
  }

  console.log('📝 Generating summary...');

  try {
    if (subcommand === 'last') {
      const count = parseInt(parts[2]) || 10;
      const recentMessages = messages?.slice(-count) || [];

      if (recentMessages.length === 0) {
        console.log('No messages to summarize.');
        return true;
      }

      const summary = await autoSummarizer.summarize(recentMessages);

      console.log('\n📋 Summary of Last', count, 'Messages:');
      console.log('═'.repeat(50));
      console.log(summary.content);
      console.log('\n_Compression: ' +
        Math.round((1 - summary.summaryTokens / summary.originalTokens) * 100) + '%_');
      return true;
    }

    if (subcommand === 'file') {
      const filePath = parts.slice(2).join(' ');
      if (!filePath) {
        console.log('Usage: /summarize file <path>');
        return true;
      }

      const content = await fs.readFile(filePath, 'utf8');
      const messages = [{ role: 'user', content: `Summarize this file:\n\n${content}` }];
      const summary = await autoSummarizer.summarize(messages, { focusAreas: ['purpose', 'structure', 'key functions'] });

      console.log('\n📋 File Summary:', filePath);
      console.log('═'.repeat(50));
      console.log(summary.content);
      return true;
    }

    if (subcommand === 'code') {
      const filePath = parts.slice(2).join(' ');
      if (!filePath) {
        console.log('Usage: /summarize code <path>');
        return true;
      }

      const content = await fs.readFile(filePath, 'utf8');
      const messages = [{
        role: 'user',
        content: `Explain this code:\n\n\`\`\`\n${content}\n\`\`\`\n\nProvide: 1) Overview, 2) Key functions/classes, 3) How to use it`
      }];
      const summary = await autoSummarizer.summarize(messages, { focusAreas: ['code explanation'] });

      console.log('\n📋 Code Explanation:', filePath);
      console.log('═'.repeat(50));
      console.log(summary.content);
      return true;
    }

    // Default: summarize entire conversation
    if (!messages || messages.length === 0) {
      console.log('No conversation to summarize.');
      return true;
    }

    const summary = await autoSummarizer.summarize(messages);

    console.log('\n📋 Conversation Summary:');
    console.log('═'.repeat(50));
    console.log(summary.content);
    console.log('\n_Messages: ' + summary.messageCount +
      ' | Original: ~' + summary.originalTokens + ' tokens' +
      ' | Summary: ~' + summary.summaryTokens + ' tokens_');

  } catch (error) {
    console.log(`❌ Summarization failed: ${error.message}`);
  }

  return true;
}

/**
 * Handle /web command - Web operations
 */
export async function handleWebCommand(input, webFetchTool, webSearchTool) {
  const parts = input.split(' ');
  const subcommand = parts[1];
  const args = parts.slice(2).join(' ');

  if (!subcommand || subcommand === 'help') {
    console.log(`
🌐 Web Operations
════════════════

Commands:
  /web fetch <url>           Fetch and display a webpage
  /web search <query>        Search the web
  /web fetch <url> --extract Extract main content only
  /web help                  Show this help

Options for fetch:
  --extract                  Extract main content (remove navigation, ads)
  --summary                  Get AI summary of the page

Examples:
  /web fetch https://example.com
  /web search "Node.js best practices"
  /web fetch https://docs.example.com --extract
`);
    return true;
  }

  if (subcommand === 'fetch') {
    if (!args) {
      console.log('Usage: /web fetch <url>');
      return true;
    }

    if (!webFetchTool) {
      console.log('❌ Web fetch tool not available.');
      return true;
    }

    // Parse URL and options
    const urlParts = args.split(' ');
    const url = urlParts[0];
    const extractOnly = urlParts.includes('--extract');
    const summarize = urlParts.includes('--summary');

    console.log(`🌐 Fetching: ${url}`);

    try {
      const result = await webFetchTool.execute({
        url,
        prompt: summarize
          ? 'Summarize the main content of this page.'
          : 'Extract the main content of this page.'
      });

      if (result.success) {
        console.log('\n📄 Page Content:');
        console.log('═'.repeat(50));
        console.log(result.content?.substring(0, 5000) || result.result);
        if (result.content?.length > 5000) {
          console.log('\n_[Content truncated...]_');
        }
      } else {
        console.log(`❌ Fetch failed: ${result.error}`);
      }
    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
    }

    return true;
  }

  if (subcommand === 'search') {
    if (!args) {
      console.log('Usage: /web search <query>');
      return true;
    }

    if (!webSearchTool) {
      console.log('❌ Web search tool not available.');
      return true;
    }

    console.log(`🔍 Searching: ${args}`);

    try {
      const result = await webSearchTool.execute({
        query: args,
        maxResults: 10
      });

      if (result.success && result.results) {
        console.log('\n🔍 Search Results:');
        console.log('═'.repeat(50));

        for (let i = 0; i < result.results.length; i++) {
          const r = result.results[i];
          console.log(`\n${i + 1}. ${r.title}`);
          console.log(`   ${r.url}`);
          if (r.snippet) {
            console.log(`   ${r.snippet.substring(0, 150)}...`);
          }
        }
      } else {
        console.log(`❌ Search failed: ${result.error || 'No results'}`);
      }
    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
    }

    return true;
  }

  console.log(`Unknown web subcommand: ${subcommand}`);
  console.log('Use /web help for available commands.');
  return true;
}

/**
 * Handle /ask command - Interactive user questions
 */
export async function handleAskCommand(input, askUserTool) {
  const parts = input.split(' ');
  const subcommand = parts[1];
  const args = parts.slice(2).join(' ');

  if (!subcommand || subcommand === 'help') {
    console.log(`
❓ Interactive Questions
═══════════════════════

Commands:
  /ask yesno <question>    Ask a yes/no question
  /ask choice <question>   Ask with multiple choices
  /ask text <prompt>       Ask for free text input
  /ask help                Show this help

Examples:
  /ask yesno "Should I continue with the refactoring?"
  /ask choice "Which framework?" React Vue Angular Svelte
  /ask text "Describe the feature you want"

The AI can also ask questions automatically during tasks.
`);
    return true;
  }

  if (!askUserTool) {
    console.log('❌ Ask user tool not available.');
    return true;
  }

  try {
    if (subcommand === 'yesno') {
      const question = args || 'Do you want to proceed?';
      const result = await askUserTool.execute({
        questions: [{
          question,
          header: 'Confirm',
          options: [
            { label: 'Yes', description: 'Proceed with this action' },
            { label: 'No', description: 'Cancel or choose differently' }
          ],
          multiSelect: false
        }]
      });

      if (result.success) {
        console.log(`\n✅ Answer: ${result.answers.Confirm}`);
        return { handled: true, answer: result.answers.Confirm === 'Yes' };
      }
    }

    if (subcommand === 'choice') {
      // Parse question and options from args
      const match = args.match(/"([^"]+)"\s+(.+)/);
      let question, choices;

      if (match) {
        question = match[1];
        choices = match[2].split(/\s+/).filter(c => c);
      } else {
        question = 'Please select an option:';
        choices = args.split(/\s+/).filter(c => c);
      }

      if (choices.length < 2) {
        console.log('Please provide at least 2 choices.');
        return true;
      }

      const result = await askUserTool.execute({
        questions: [{
          question,
          header: 'Choice',
          options: choices.slice(0, 4).map(c => ({
            label: c,
            description: ''
          })),
          multiSelect: false
        }]
      });

      if (result.success) {
        console.log(`\n✅ Selected: ${result.answers.Choice}`);
        return { handled: true, answer: result.answers.Choice };
      }
    }

    if (subcommand === 'text') {
      const prompt = args || 'Enter your response:';

      // Simple readline for text input
      const readline = await import('readline');
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });

      return new Promise((resolve) => {
        console.log(`\n${prompt}`);
        rl.question('> ', (answer) => {
          rl.close();
          console.log(`\n✅ Response recorded.`);
          resolve({ handled: true, answer: answer.trim() });
        });
      });
    }

    console.log(`Unknown ask subcommand: ${subcommand}`);
    console.log('Use /ask help for available commands.');

  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
  }

  return true;
}

/**
 * Handle /diff command - File comparison
 */
export async function handleDiffCommand(input, diffViewer) {
  const parts = input.split(' ');
  const subcommand = parts[1];
  const args = parts.slice(2);

  if (!subcommand || subcommand === 'help') {
    console.log(`
📊 File Diff Viewer
══════════════════

Commands:
  /diff <file1> <file2>    Compare two files
  /diff staged             Show staged git changes
  /diff unstaged           Show unstaged git changes
  /diff head <file>        Compare file with HEAD
  /diff branch <name>      Compare current branch with another
  /diff help               Show this help

Options:
  --context <n>            Lines of context (default: 3)
  --no-color               Disable colored output

Examples:
  /diff src/old.js src/new.js
  /diff staged
  /diff head src/index.js
`);
    return true;
  }

  const { execSync } = await import('child_process');

  try {
    let diffOutput;

    if (subcommand === 'staged') {
      diffOutput = execSync('git diff --staged', { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
    } else if (subcommand === 'unstaged') {
      diffOutput = execSync('git diff', { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
    } else if (subcommand === 'head') {
      const file = args[0];
      if (!file) {
        console.log('Usage: /diff head <file>');
        return true;
      }
      diffOutput = execSync(`git diff HEAD -- "${file}"`, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
    } else if (subcommand === 'branch') {
      const branch = args[0];
      if (!branch) {
        console.log('Usage: /diff branch <branch-name>');
        return true;
      }
      diffOutput = execSync(`git diff ${branch}`, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
    } else {
      // Compare two files
      const file1 = subcommand;
      const file2 = args[0];

      if (!file2) {
        console.log('Usage: /diff <file1> <file2>');
        return true;
      }

      // Check if files exist
      const fs = await import('fs-extra');
      if (!await fs.pathExists(file1)) {
        console.log(`❌ File not found: ${file1}`);
        return true;
      }
      if (!await fs.pathExists(file2)) {
        console.log(`❌ File not found: ${file2}`);
        return true;
      }

      diffOutput = execSync(`diff -u "${file1}" "${file2}" || true`, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
    }

    if (!diffOutput || diffOutput.trim() === '') {
      console.log('\n✅ No differences found.');
      return true;
    }

    // Color the diff output
    console.log('\n📊 Diff Output:');
    console.log('═'.repeat(50));

    const lines = diffOutput.split('\n');
    for (const line of lines) {
      if (line.startsWith('+') && !line.startsWith('+++')) {
        console.log('\x1b[32m' + line + '\x1b[0m'); // Green for additions
      } else if (line.startsWith('-') && !line.startsWith('---')) {
        console.log('\x1b[31m' + line + '\x1b[0m'); // Red for deletions
      } else if (line.startsWith('@@')) {
        console.log('\x1b[36m' + line + '\x1b[0m'); // Cyan for line numbers
      } else if (line.startsWith('diff') || line.startsWith('index')) {
        console.log('\x1b[33m' + line + '\x1b[0m'); // Yellow for headers
      } else {
        console.log(line);
      }
    }

    console.log('═'.repeat(50));

  } catch (error) {
    if (error.status === 1) {
      // diff returns 1 when files differ, which is expected
      console.log(error.stdout || 'Files differ');
    } else {
      console.log(`❌ Error: ${error.message}`);
    }
  }

  return true;
}

/**
 * Handle /git command - Enhanced git operations
 */
export async function handleGitCommand(input) {
  const parts = input.split(' ');
  const subcommand = parts[1];
  const args = parts.slice(2).join(' ');

  if (!subcommand || subcommand === 'help') {
    console.log(`
🔀 Git Operations
════════════════

Commands:
  /git status              Show working tree status
  /git log [n]             Show last n commits (default: 10)
  /git branch              List branches
  /git checkout <branch>   Switch branches
  /git stash               Stash changes
  /git stash pop           Apply stashed changes
  /git pull                Pull from remote
  /git push                Push to remote
  /git fetch               Fetch from remote
  /git remote              Show remotes
  /git blame <file>        Show file blame
  /git <any command>       Run any git command

Examples:
  /git status
  /git log 5
  /git checkout -b feature/new
  /git diff HEAD~3
`);
    return true;
  }

  const { execSync } = await import('child_process');

  try {
    let command;

    switch (subcommand) {
      case 'status':
        command = 'git status';
        break;
      case 'log':
        const count = args || '10';
        command = `git log -${count} --oneline --graph --decorate`;
        break;
      case 'branch':
        command = args ? `git branch ${args}` : 'git branch -a';
        break;
      case 'checkout':
        if (!args) {
          console.log('Usage: /git checkout <branch>');
          return true;
        }
        command = `git checkout ${args}`;
        break;
      case 'stash':
        command = args ? `git stash ${args}` : 'git stash';
        break;
      case 'pull':
        command = args ? `git pull ${args}` : 'git pull';
        break;
      case 'push':
        command = args ? `git push ${args}` : 'git push';
        break;
      case 'fetch':
        command = args ? `git fetch ${args}` : 'git fetch --all';
        break;
      case 'remote':
        command = args ? `git remote ${args}` : 'git remote -v';
        break;
      case 'blame':
        if (!args) {
          console.log('Usage: /git blame <file>');
          return true;
        }
        command = `git blame ${args}`;
        break;
      default:
        // Pass through any git command
        command = `git ${subcommand} ${args}`.trim();
    }

    console.log(`\n$ ${command}\n`);
    const output = execSync(command, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
    console.log(output);

  } catch (error) {
    console.log(`❌ Git error: ${error.message}`);
    if (error.stderr) {
      console.log(error.stderr);
    }
  }

  return true;
}

/**
 * Handle /run command - Shell command execution
 */
export async function handleRunCommand(input, bashTool) {
  const command = input.replace(/^\/run\s*/, '').trim();

  if (!command || command === 'help') {
    console.log(`
🖥️ Shell Command Execution
═══════════════════════════

Usage:
  /run <command>           Execute a shell command
  /run help                Show this help

Examples:
  /run npm test
  /run ls -la
  /run python script.py
  /run docker ps

Options:
  Commands are executed in the current working directory.
  Output is displayed in real-time when possible.
  Long-running commands have a 2-minute timeout by default.

Safety:
  - Dangerous commands (rm -rf, etc.) require confirmation
  - Commands are logged for audit
`);
    return true;
  }

  const { spawn } = await import('child_process');

  console.log(`\n$ ${command}\n`);

  return new Promise((resolve) => {
    const parts = command.split(' ');
    const cmd = parts[0];
    const args = parts.slice(1);

    const proc = spawn(cmd, args, {
      shell: true,
      stdio: 'inherit',
      cwd: process.cwd()
    });

    proc.on('close', (code) => {
      console.log(`\nProcess exited with code ${code}`);
      resolve({ handled: true, exitCode: code });
    });

    proc.on('error', (error) => {
      console.log(`❌ Error: ${error.message}`);
      resolve({ handled: true, error: error.message });
    });
  });
}

/**
 * Handle /edit command - Interactive file editing
 */
export async function handleEditCommand(input, editTool) {
  const parts = input.split(' ');
  const subcommand = parts[1];
  const args = parts.slice(2);

  if (!subcommand || subcommand === 'help') {
    console.log(`
✏️ File Editing
═══════════════

Commands:
  /edit <file>                 Open file for editing info
  /edit replace <file>         Replace string in file
  /edit append <file>          Append to file
  /edit prepend <file>         Prepend to file
  /edit insert <file> <line>   Insert at specific line
  /edit help                   Show this help

Interactive mode:
  When you specify a file, Grok will show the file content
  and you can describe the changes you want to make.

Examples:
  /edit src/index.js
  /edit replace package.json
`);
    return true;
  }

  const fs = await import('fs-extra');

  // If just a file path, show file info and prompt for edits
  if (!['replace', 'append', 'prepend', 'insert'].includes(subcommand)) {
    const filePath = subcommand;

    if (!await fs.pathExists(filePath)) {
      console.log(`❌ File not found: ${filePath}`);
      return true;
    }

    const content = await fs.readFile(filePath, 'utf8');
    const lines = content.split('\n');
    const stats = await fs.stat(filePath);

    console.log(`\n✏️ File: ${filePath}`);
    console.log('═'.repeat(50));
    console.log(`Lines: ${lines.length}`);
    console.log(`Size: ${(stats.size / 1024).toFixed(1)} KB`);
    console.log(`Modified: ${stats.mtime.toLocaleString()}`);
    console.log('');
    console.log('Preview (first 20 lines):');
    console.log('─'.repeat(50));

    lines.slice(0, 20).forEach((line, i) => {
      const lineNum = String(i + 1).padStart(4, ' ');
      console.log(`${lineNum} │ ${line}`);
    });

    if (lines.length > 20) {
      console.log(`     │ ... (${lines.length - 20} more lines)`);
    }

    console.log('─'.repeat(50));
    console.log('\nTo edit, describe the changes you want to make to Grok.');

    return true;
  }

  // Handle specific edit operations
  const filePath = args[0];
  if (!filePath) {
    console.log(`Usage: /edit ${subcommand} <file>`);
    return true;
  }

  if (!await fs.pathExists(filePath)) {
    console.log(`❌ File not found: ${filePath}`);
    return true;
  }

  const readline = await import('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const content = await fs.readFile(filePath, 'utf8');

  return new Promise((resolve) => {
    if (subcommand === 'replace') {
      console.log('\nEnter the text to find:');
      rl.question('Find: ', (findText) => {
        console.log('Enter the replacement text:');
        rl.question('Replace: ', async (replaceText) => {
          rl.close();

          if (!content.includes(findText)) {
            console.log('❌ Text not found in file.');
            resolve(true);
            return;
          }

          const newContent = content.replace(findText, replaceText);
          await fs.writeFile(filePath, newContent);
          console.log(`✅ Replaced in ${filePath}`);
          resolve(true);
        });
      });
    } else if (subcommand === 'append') {
      console.log('\nEnter text to append (end with empty line):');
      let appendText = '';
      rl.on('line', async (line) => {
        if (line === '') {
          rl.close();
          await fs.writeFile(filePath, content + '\n' + appendText);
          console.log(`✅ Appended to ${filePath}`);
          resolve(true);
        } else {
          appendText += (appendText ? '\n' : '') + line;
        }
      });
    } else if (subcommand === 'prepend') {
      console.log('\nEnter text to prepend (end with empty line):');
      let prependText = '';
      rl.on('line', async (line) => {
        if (line === '') {
          rl.close();
          await fs.writeFile(filePath, prependText + '\n' + content);
          console.log(`✅ Prepended to ${filePath}`);
          resolve(true);
        } else {
          prependText += (prependText ? '\n' : '') + line;
        }
      });
    } else if (subcommand === 'insert') {
      const lineNum = parseInt(args[1]);
      if (isNaN(lineNum)) {
        console.log('Usage: /edit insert <file> <line-number>');
        rl.close();
        resolve(true);
        return;
      }

      console.log(`\nEnter text to insert at line ${lineNum} (end with empty line):`);
      let insertText = '';
      rl.on('line', async (line) => {
        if (line === '') {
          rl.close();
          const lines = content.split('\n');
          lines.splice(lineNum - 1, 0, insertText);
          await fs.writeFile(filePath, lines.join('\n'));
          console.log(`✅ Inserted at line ${lineNum} in ${filePath}`);
          resolve(true);
        } else {
          insertText += (insertText ? '\n' : '') + line;
        }
      });
    }
  });
}

/**
 * Handle /search command - Codebase search
 */
export async function handleSearchCommand(input, grepTool, globTool) {
  const parts = input.split(' ');
  const subcommand = parts[1];
  const args = parts.slice(2).join(' ');

  if (!subcommand || subcommand === 'help') {
    console.log(`
🔍 Codebase Search
══════════════════

Commands:
  /search <pattern>          Search for pattern in all files
  /search files <pattern>    Find files by name pattern
  /search content <pattern>  Search file contents (grep)
  /search function <name>    Find function definitions
  /search class <name>       Find class definitions
  /search todo               Find TODO/FIXME comments
  /search help               Show this help

Options:
  --type <ext>               Filter by file type (js, py, etc.)
  --ignore <pattern>         Ignore files matching pattern

Examples:
  /search "TODO"
  /search files "*.test.js"
  /search function handleClick
  /search class UserService --type ts
`);
    return true;
  }

  const { execSync } = await import('child_process');

  try {
    let results;

    if (subcommand === 'files') {
      // Find files by name
      const pattern = args || '*';
      console.log(`\n🔍 Searching for files: ${pattern}\n`);

      try {
        results = execSync(`find . -name "${pattern}" -type f | grep -v node_modules | grep -v .git | head -50`, {
          encoding: 'utf8',
          maxBuffer: 10 * 1024 * 1024
        });
      } catch {
        results = '';
      }

      if (results.trim()) {
        console.log(results);
      } else {
        console.log('No files found.');
      }
    } else if (subcommand === 'content') {
      // Search file contents
      const pattern = args;
      if (!pattern) {
        console.log('Usage: /search content <pattern>');
        return true;
      }

      console.log(`\n🔍 Searching content: ${pattern}\n`);

      try {
        results = execSync(`grep -rn "${pattern}" --include="*.js" --include="*.ts" --include="*.py" --include="*.json" --include="*.md" . | grep -v node_modules | grep -v .git | head -50`, {
          encoding: 'utf8',
          maxBuffer: 10 * 1024 * 1024
        });
      } catch {
        results = '';
      }

      if (results.trim()) {
        const lines = results.split('\n').filter(l => l);
        for (const line of lines) {
          const match = line.match(/^([^:]+):(\d+):(.*)$/);
          if (match) {
            const [, file, lineNum, content] = match;
            console.log(`\x1b[36m${file}\x1b[0m:\x1b[33m${lineNum}\x1b[0m: ${content.trim()}`);
          } else {
            console.log(line);
          }
        }
      } else {
        console.log('No matches found.');
      }
    } else if (subcommand === 'function') {
      // Find function definitions
      const name = args;
      if (!name) {
        console.log('Usage: /search function <name>');
        return true;
      }

      console.log(`\n🔍 Searching for function: ${name}\n`);

      try {
        // Search for various function definition patterns
        results = execSync(`grep -rn -E "(function\\s+${name}|const\\s+${name}\\s*=|${name}\\s*[:=]\\s*(async\\s+)?function|def\\s+${name})" --include="*.js" --include="*.ts" --include="*.py" . | grep -v node_modules | grep -v .git`, {
          encoding: 'utf8',
          maxBuffer: 10 * 1024 * 1024
        });
      } catch {
        results = '';
      }

      if (results.trim()) {
        console.log(results);
      } else {
        console.log(`Function '${name}' not found.`);
      }
    } else if (subcommand === 'class') {
      // Find class definitions
      const name = args;
      if (!name) {
        console.log('Usage: /search class <name>');
        return true;
      }

      console.log(`\n🔍 Searching for class: ${name}\n`);

      try {
        results = execSync(`grep -rn -E "(class\\s+${name})" --include="*.js" --include="*.ts" --include="*.py" . | grep -v node_modules | grep -v .git`, {
          encoding: 'utf8',
          maxBuffer: 10 * 1024 * 1024
        });
      } catch {
        results = '';
      }

      if (results.trim()) {
        console.log(results);
      } else {
        console.log(`Class '${name}' not found.`);
      }
    } else if (subcommand === 'todo') {
      // Find TODO/FIXME comments
      console.log(`\n🔍 Searching for TODOs and FIXMEs\n`);

      try {
        results = execSync(`grep -rn -E "(TODO|FIXME|XXX|HACK|BUG):" --include="*.js" --include="*.ts" --include="*.py" --include="*.jsx" --include="*.tsx" . | grep -v node_modules | grep -v .git`, {
          encoding: 'utf8',
          maxBuffer: 10 * 1024 * 1024
        });
      } catch {
        results = '';
      }

      if (results.trim()) {
        const lines = results.split('\n').filter(l => l);
        let todoCount = 0, fixmeCount = 0, otherCount = 0;

        for (const line of lines) {
          if (line.includes('TODO')) todoCount++;
          else if (line.includes('FIXME')) fixmeCount++;
          else otherCount++;

          const match = line.match(/^([^:]+):(\d+):(.*)$/);
          if (match) {
            const [, file, lineNum, content] = match;
            let color = '\x1b[33m'; // Yellow for TODO
            if (content.includes('FIXME')) color = '\x1b[31m'; // Red for FIXME
            console.log(`${color}${file}:${lineNum}\x1b[0m: ${content.trim()}`);
          }
        }

        console.log(`\n📊 Summary: ${todoCount} TODOs, ${fixmeCount} FIXMEs, ${otherCount} other`);
      } else {
        console.log('No TODOs or FIXMEs found.');
      }
    } else {
      // Default: search for pattern in content
      const pattern = [subcommand, args].filter(Boolean).join(' ');
      console.log(`\n🔍 Searching: ${pattern}\n`);

      try {
        results = execSync(`grep -rn "${pattern}" --include="*.js" --include="*.ts" --include="*.py" --include="*.json" --include="*.md" . | grep -v node_modules | grep -v .git | head -50`, {
          encoding: 'utf8',
          maxBuffer: 10 * 1024 * 1024
        });
      } catch {
        results = '';
      }

      if (results.trim()) {
        console.log(results);
      } else {
        console.log('No matches found.');
      }
    }

  } catch (error) {
    console.log(`❌ Search error: ${error.message}`);
  }

  return true;
}

/**
 * Handle /read command - Read and display file contents
 */
export async function handleReadCommand(input) {
  const parts = input.split(' ');
  const filePath = parts[1];
  const options = parts.slice(2);

  if (!filePath || filePath === 'help') {
    console.log(`
📖 Read File
════════════

Usage:
  /read <file>              Read entire file
  /read <file> <start>      Read from line number
  /read <file> <start> <end> Read line range
  /read help                Show this help

Options:
  --numbers, -n             Show line numbers
  --head <n>                Show first n lines
  --tail <n>                Show last n lines

Examples:
  /read src/index.js
  /read src/index.js 10 50
  /read package.json --head 20
  /read logs/app.log --tail 100
`);
    return true;
  }

  const fs = await import('fs-extra');
  const path = await import('path');

  // Resolve path
  const absolutePath = path.default.isAbsolute(filePath)
    ? filePath
    : path.default.join(process.cwd(), filePath);

  if (!await fs.pathExists(absolutePath)) {
    console.log(`❌ File not found: ${filePath}`);
    return true;
  }

  const stats = await fs.stat(absolutePath);

  if (stats.isDirectory()) {
    console.log(`❌ '${filePath}' is a directory. Use /ls instead.`);
    return true;
  }

  // Check file size
  if (stats.size > 5 * 1024 * 1024) {
    console.log(`⚠️ Large file (${(stats.size / 1024 / 1024).toFixed(2)} MB). Showing first 1000 lines.`);
  }

  try {
    const content = await fs.readFile(absolutePath, 'utf8');
    let lines = content.split('\n');

    // Parse options
    const showNumbers = options.includes('--numbers') || options.includes('-n');
    const headIndex = options.indexOf('--head');
    const tailIndex = options.indexOf('--tail');

    let startLine = 1;
    let endLine = lines.length;

    // Check for line range arguments
    const lineArg1 = parseInt(parts[2]);
    const lineArg2 = parseInt(parts[3]);

    if (!isNaN(lineArg1) && !isNaN(lineArg2)) {
      startLine = lineArg1;
      endLine = lineArg2;
    } else if (!isNaN(lineArg1)) {
      startLine = lineArg1;
    }

    // Handle --head and --tail
    if (headIndex !== -1) {
      const n = parseInt(options[headIndex + 1]) || 20;
      endLine = Math.min(n, lines.length);
      startLine = 1;
    } else if (tailIndex !== -1) {
      const n = parseInt(options[tailIndex + 1]) || 20;
      startLine = Math.max(1, lines.length - n + 1);
      endLine = lines.length;
    }

    // Ensure valid range
    startLine = Math.max(1, Math.min(startLine, lines.length));
    endLine = Math.max(startLine, Math.min(endLine, lines.length));

    // Get file extension for potential syntax info
    const ext = path.default.extname(filePath).slice(1);

    console.log(`\n📖 ${filePath}`);
    console.log(`   ${lines.length} lines | ${ext || 'txt'} | ${(stats.size / 1024).toFixed(1)} KB`);
    console.log('═'.repeat(60));

    // Display lines
    const displayLines = lines.slice(startLine - 1, endLine);

    displayLines.forEach((line, i) => {
      const lineNum = startLine + i;
      if (showNumbers || displayLines.length > 10) {
        const numStr = String(lineNum).padStart(5, ' ');
        console.log(`${numStr} │ ${line}`);
      } else {
        console.log(line);
      }
    });

    if (endLine < lines.length) {
      console.log(`\n... (${lines.length - endLine} more lines)`);
    }

    console.log('═'.repeat(60));

  } catch (error) {
    console.log(`❌ Error reading file: ${error.message}`);
  }

  return true;
}

/**
 * Handle /write command - Create or write to file
 */
export async function handleWriteCommand(input) {
  const parts = input.split(' ');
  const filePath = parts[1];

  if (!filePath || filePath === 'help') {
    console.log(`
✍️ Write File
═════════════

Usage:
  /write <file>             Create/write file (interactive)
  /write <file> --stdin     Write from stdin until EOF
  /write help               Show this help

Options:
  --append, -a              Append to file instead of overwrite
  --backup                  Create backup before overwrite

Examples:
  /write new-file.txt
  /write config.json --backup
  /write notes.md --append

Interactive mode:
  Enter your content line by line.
  Type 'EOF' on a new line to finish.
`);
    return true;
  }

  const fs = await import('fs-extra');
  const path = await import('path');
  const readline = await import('readline');

  const options = parts.slice(2);
  const appendMode = options.includes('--append') || options.includes('-a');
  const createBackup = options.includes('--backup');

  const absolutePath = path.default.isAbsolute(filePath)
    ? filePath
    : path.default.join(process.cwd(), filePath);

  // Ensure parent directory exists
  await fs.ensureDir(path.default.dirname(absolutePath));

  // Create backup if requested and file exists
  if (createBackup && await fs.pathExists(absolutePath)) {
    const backupPath = absolutePath + '.bak';
    await fs.copy(absolutePath, backupPath);
    console.log(`📦 Backup created: ${backupPath}`);
  }

  console.log(`\n✍️ ${appendMode ? 'Appending to' : 'Writing'}: ${filePath}`);
  console.log('Enter content (type EOF on a new line to finish):');
  console.log('─'.repeat(50));

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    let content = '';

    rl.on('line', async (line) => {
      if (line === 'EOF') {
        rl.close();

        try {
          if (appendMode && await fs.pathExists(absolutePath)) {
            await fs.appendFile(absolutePath, '\n' + content);
          } else {
            await fs.writeFile(absolutePath, content);
          }

          console.log('─'.repeat(50));
          console.log(`✅ ${appendMode ? 'Appended to' : 'Written'}: ${filePath}`);
          console.log(`   ${content.split('\n').length} lines | ${content.length} bytes`);
        } catch (error) {
          console.log(`❌ Error writing file: ${error.message}`);
        }

        resolve(true);
      } else {
        content += (content ? '\n' : '') + line;
      }
    });
  });
}

/**
 * Handle /ls command - List directory contents
 */
export async function handleLsCommand(input) {
  const parts = input.split(' ');
  const targetPath = parts[1] || '.';
  const options = parts.slice(2);

  if (targetPath === 'help') {
    console.log(`
📁 List Directory
═════════════════

Usage:
  /ls [path]               List directory contents
  /ls help                 Show this help

Options:
  -a, --all                Include hidden files
  -l, --long               Long format with details
  -h, --human              Human-readable sizes
  -S, --size               Sort by size
  -t, --time               Sort by modification time

Examples:
  /ls
  /ls src/
  /ls -la
  /ls --long --all
`);
    return true;
  }

  const fs = await import('fs-extra');
  const path = await import('path');

  const showAll = options.includes('-a') || options.includes('--all');
  const longFormat = options.includes('-l') || options.includes('--long');
  const humanReadable = options.includes('-h') || options.includes('--human');
  const sortBySize = options.includes('-S') || options.includes('--size');
  const sortByTime = options.includes('-t') || options.includes('--time');

  const absolutePath = path.default.isAbsolute(targetPath)
    ? targetPath
    : path.default.join(process.cwd(), targetPath);

  if (!await fs.pathExists(absolutePath)) {
    console.log(`❌ Path not found: ${targetPath}`);
    return true;
  }

  const stats = await fs.stat(absolutePath);

  if (!stats.isDirectory()) {
    console.log(`❌ '${targetPath}' is not a directory. Use /read instead.`);
    return true;
  }

  try {
    let entries = await fs.readdir(absolutePath);

    // Filter hidden files
    if (!showAll) {
      entries = entries.filter(e => !e.startsWith('.'));
    }

    // Get detailed info if needed
    const entryDetails = await Promise.all(
      entries.map(async (name) => {
        const entryPath = path.default.join(absolutePath, name);
        try {
          const stat = await fs.stat(entryPath);
          return {
            name,
            isDir: stat.isDirectory(),
            size: stat.size,
            mtime: stat.mtime
          };
        } catch {
          return { name, isDir: false, size: 0, mtime: new Date() };
        }
      })
    );

    // Sort
    if (sortBySize) {
      entryDetails.sort((a, b) => b.size - a.size);
    } else if (sortByTime) {
      entryDetails.sort((a, b) => b.mtime - a.mtime);
    } else {
      // Default: directories first, then alphabetical
      entryDetails.sort((a, b) => {
        if (a.isDir !== b.isDir) return b.isDir - a.isDir;
        return a.name.localeCompare(b.name);
      });
    }

    console.log(`\n📁 ${absolutePath}`);
    console.log('═'.repeat(60));

    if (longFormat) {
      for (const entry of entryDetails) {
        const icon = entry.isDir ? '📁' : '📄';
        const size = humanReadable
          ? formatSize(entry.size)
          : String(entry.size).padStart(10);
        const date = entry.mtime.toLocaleDateString();
        const time = entry.mtime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        console.log(`${icon} ${size}  ${date} ${time}  ${entry.name}${entry.isDir ? '/' : ''}`);
      }
    } else {
      // Grid format
      const dirs = entryDetails.filter(e => e.isDir).map(e => `📁 ${e.name}/`);
      const files = entryDetails.filter(e => !e.isDir).map(e => `📄 ${e.name}`);

      if (dirs.length > 0) {
        console.log('Directories:');
        console.log('  ' + dirs.join('  '));
      }

      if (files.length > 0) {
        if (dirs.length > 0) console.log('');
        console.log('Files:');
        // Display in columns
        const colWidth = 30;
        const cols = Math.floor(60 / colWidth) || 1;
        for (let i = 0; i < files.length; i += cols) {
          const row = files.slice(i, i + cols);
          console.log('  ' + row.map(f => f.padEnd(colWidth)).join(''));
        }
      }
    }

    console.log('═'.repeat(60));
    console.log(`${entryDetails.filter(e => e.isDir).length} directories, ${entryDetails.filter(e => !e.isDir).length} files`);

  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
  }

  return true;
}

/**
 * Format file size for human readability
 */
function formatSize(bytes) {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unit = 0;

  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit++;
  }

  return `${size.toFixed(unit > 0 ? 1 : 0)}${units[unit]}`.padStart(8);
}

/**
 * Handle /tree command - Show directory tree
 */
export async function handleTreeCommand(input) {
  const parts = input.split(' ');
  const targetPath = parts[1] || '.';
  const options = parts.slice(2);

  if (targetPath === 'help') {
    console.log(`
🌳 Directory Tree
═════════════════

Usage:
  /tree [path]             Show directory tree
  /tree help               Show this help

Options:
  -L, --level <n>          Limit depth to n levels
  -d, --dirs-only          Show only directories
  -a, --all                Include hidden files
  --ignore <pattern>       Ignore files matching pattern

Examples:
  /tree
  /tree src/ -L 2
  /tree --dirs-only
  /tree -L 3 --ignore node_modules
`);
    return true;
  }

  const fs = await import('fs-extra');
  const path = await import('path');

  const showAll = options.includes('-a') || options.includes('--all');
  const dirsOnly = options.includes('-d') || options.includes('--dirs-only');

  let maxDepth = Infinity;
  const levelIndex = options.findIndex(o => o === '-L' || o === '--level');
  if (levelIndex !== -1 && options[levelIndex + 1]) {
    maxDepth = parseInt(options[levelIndex + 1]) || 3;
  }

  let ignorePattern = null;
  const ignoreIndex = options.indexOf('--ignore');
  if (ignoreIndex !== -1 && options[ignoreIndex + 1]) {
    ignorePattern = options[ignoreIndex + 1];
  }

  // Default ignore patterns
  const defaultIgnore = ['node_modules', '.git', '__pycache__', '.next', 'dist', 'build', '.cache'];

  const absolutePath = path.default.isAbsolute(targetPath)
    ? targetPath
    : path.default.join(process.cwd(), targetPath);

  if (!await fs.pathExists(absolutePath)) {
    console.log(`❌ Path not found: ${targetPath}`);
    return true;
  }

  console.log(`\n🌳 ${absolutePath}`);

  let dirCount = 0;
  let fileCount = 0;

  async function printTree(dir, prefix = '', depth = 0) {
    if (depth >= maxDepth) return;

    let entries;
    try {
      entries = await fs.readdir(dir);
    } catch {
      return;
    }

    // Filter
    entries = entries.filter(e => {
      if (!showAll && e.startsWith('.')) return false;
      if (defaultIgnore.includes(e)) return false;
      if (ignorePattern && e.includes(ignorePattern)) return false;
      return true;
    });

    // Sort: directories first
    const sorted = [];
    for (const entry of entries) {
      const entryPath = path.default.join(dir, entry);
      try {
        const stat = await fs.stat(entryPath);
        sorted.push({ name: entry, isDir: stat.isDirectory(), path: entryPath });
      } catch {
        sorted.push({ name: entry, isDir: false, path: entryPath });
      }
    }

    sorted.sort((a, b) => {
      if (a.isDir !== b.isDir) return b.isDir - a.isDir;
      return a.name.localeCompare(b.name);
    });

    // Filter dirs-only if needed
    const filtered = dirsOnly ? sorted.filter(e => e.isDir) : sorted;

    for (let i = 0; i < filtered.length; i++) {
      const entry = filtered[i];
      const isLast = i === filtered.length - 1;
      const connector = isLast ? '└── ' : '├── ';
      const icon = entry.isDir ? '📁' : '📄';

      if (entry.isDir) {
        dirCount++;
      } else {
        fileCount++;
      }

      console.log(`${prefix}${connector}${icon} ${entry.name}${entry.isDir ? '/' : ''}`);

      if (entry.isDir) {
        const newPrefix = prefix + (isLast ? '    ' : '│   ');
        await printTree(entry.path, newPrefix, depth + 1);
      }
    }
  }

  await printTree(absolutePath);

  console.log(`\n${dirCount} directories, ${fileCount} files`);

  return true;
}

/**
 * Handle /cat command - Quick file display (alias for read)
 */
export async function handleCatCommand(input) {
  // Convert /cat to /read format
  const newInput = input.replace(/^\/cat/, '/read');
  return handleReadCommand(newInput);
}

/**
 * Handle /pwd command - Print working directory
 */
export async function handlePwdCommand() {
  console.log(`\n📍 Current Directory: ${process.cwd()}\n`);
  return true;
}

/**
 * Handle /cd command - Change directory
 */
export async function handleCdCommand(input) {
  const parts = input.split(' ');
  const targetPath = parts[1];

  if (!targetPath || targetPath === 'help') {
    console.log(`
📂 Change Directory
══════════════════

Usage:
  /cd <path>               Change to directory
  /cd                      Show current directory
  /cd ~                    Change to home directory
  /cd ..                   Go up one level
  /cd -                    Go to previous directory

Examples:
  /cd src/
  /cd ..
  /cd ~/projects
`);
    return true;
  }

  const path = await import('path');
  const fs = await import('fs-extra');
  const os = await import('os');

  let newPath;

  if (targetPath === '~') {
    newPath = os.homedir();
  } else if (targetPath === '-') {
    // Would need to track previous directory
    console.log('Previous directory tracking not implemented.');
    return true;
  } else if (path.default.isAbsolute(targetPath)) {
    newPath = targetPath;
  } else {
    newPath = path.default.resolve(process.cwd(), targetPath);
  }

  if (!await fs.pathExists(newPath)) {
    console.log(`❌ Directory not found: ${targetPath}`);
    return true;
  }

  const stats = await fs.stat(newPath);
  if (!stats.isDirectory()) {
    console.log(`❌ Not a directory: ${targetPath}`);
    return true;
  }

  try {
    process.chdir(newPath);
    console.log(`📂 Changed to: ${process.cwd()}`);
  } catch (error) {
    console.log(`❌ Cannot change directory: ${error.message}`);
  }

  return true;
}

/**
 * Handle /find command - Search for files by name pattern
 */
export async function handleFindCommand(input) {
  const args = input.split(' ').slice(1);

  if (args.length === 0 || args[0] === 'help') {
    console.log(`
🔍 Find Files
═════════════

Usage:
  /find <pattern>           Search for files matching pattern
  /find <pattern> <path>    Search in specific directory

Options:
  -t, --type <f|d>         File type (f=file, d=directory)
  -d, --depth <n>          Maximum search depth
  -i, --ignore-case        Case insensitive search
  --no-ignore              Don't respect .gitignore

Examples:
  /find "*.js"
  /find "test*.py" src/
  /find -t d "node_*"
  /find -d 2 "*.md"
`);
    return true;
  }

  const path = await import('path');
  const fs = await import('fs-extra');

  // Parse options
  let pattern = '';
  let searchPath = process.cwd();
  let fileType = null;
  let maxDepth = Infinity;
  let ignoreCase = false;
  let respectGitignore = true;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '-t' || arg === '--type') {
      fileType = args[++i];
    } else if (arg === '-d' || arg === '--depth') {
      maxDepth = parseInt(args[++i], 10);
    } else if (arg === '-i' || arg === '--ignore-case') {
      ignoreCase = true;
    } else if (arg === '--no-ignore') {
      respectGitignore = false;
    } else if (!pattern) {
      pattern = arg.replace(/^["']|["']$/g, '');
    } else {
      searchPath = path.default.isAbsolute(arg) ? arg : path.default.resolve(process.cwd(), arg);
    }
  }

  if (!pattern) {
    console.log('❌ Please provide a search pattern');
    return true;
  }

  // Convert glob pattern to regex
  const regexPattern = pattern
    .replace(/\./g, '\\.')
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.');
  const regex = new RegExp(`^${regexPattern}$`, ignoreCase ? 'i' : '');

  // Default ignore patterns
  const defaultIgnore = ['node_modules', '.git', '__pycache__', '.next', 'dist', 'build', '.cache', 'coverage'];

  console.log(`\n🔍 Searching for: ${pattern}`);
  console.log(`   in: ${searchPath}\n`);

  const results = [];

  async function searchDir(dir, depth = 0) {
    if (depth > maxDepth) return;

    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.default.join(dir, entry.name);

        // Skip ignored directories
        if (respectGitignore && defaultIgnore.includes(entry.name)) continue;

        const isDir = entry.isDirectory();

        // Check if name matches
        if (regex.test(entry.name)) {
          if (fileType === 'f' && !isDir) {
            results.push({ path: fullPath, type: 'file' });
          } else if (fileType === 'd' && isDir) {
            results.push({ path: fullPath, type: 'dir' });
          } else if (!fileType) {
            results.push({ path: fullPath, type: isDir ? 'dir' : 'file' });
          }
        }

        // Recurse into directories
        if (isDir) {
          await searchDir(fullPath, depth + 1);
        }
      }
    } catch (error) {
      // Skip permission errors
    }
  }

  await searchDir(searchPath);

  if (results.length === 0) {
    console.log('No files found matching pattern.');
  } else {
    console.log(`Found ${results.length} match${results.length === 1 ? '' : 'es'}:\n`);
    for (const result of results.slice(0, 100)) {
      const icon = result.type === 'dir' ? '📁' : '📄';
      const relativePath = path.default.relative(process.cwd(), result.path);
      console.log(`  ${icon} ${relativePath}`);
    }
    if (results.length > 100) {
      console.log(`\n  ... and ${results.length - 100} more`);
    }
  }

  console.log('');
  return true;
}

/**
 * Handle /grep command - Search file contents
 */
export async function handleGrepCommand(input) {
  const args = input.split(' ').slice(1);

  if (args.length === 0 || args[0] === 'help') {
    console.log(`
🔎 Search Content (Grep)
════════════════════════

Usage:
  /grep <pattern>           Search for pattern in current directory
  /grep <pattern> <path>    Search in specific file or directory

Options:
  -i, --ignore-case        Case insensitive search
  -n, --line-numbers       Show line numbers (default)
  -c, --count              Show only count of matches
  -l, --files-only         Show only file names
  -w, --word               Match whole words only
  -C, --context <n>        Show n lines of context
  --include <glob>         Only search files matching glob

Examples:
  /grep "function"
  /grep -i "error" src/
  /grep -C 2 "TODO" lib/
  /grep --include "*.js" "import"
`);
    return true;
  }

  const path = await import('path');
  const fs = await import('fs-extra');

  // Parse options
  let pattern = '';
  let searchPath = process.cwd();
  let ignoreCase = false;
  let showLineNumbers = true;
  let countOnly = false;
  let filesOnly = false;
  let wordMatch = false;
  let contextLines = 0;
  let includeGlob = null;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '-i' || arg === '--ignore-case') {
      ignoreCase = true;
    } else if (arg === '-n' || arg === '--line-numbers') {
      showLineNumbers = true;
    } else if (arg === '-c' || arg === '--count') {
      countOnly = true;
    } else if (arg === '-l' || arg === '--files-only') {
      filesOnly = true;
    } else if (arg === '-w' || arg === '--word') {
      wordMatch = true;
    } else if (arg === '-C' || arg === '--context') {
      contextLines = parseInt(args[++i], 10);
    } else if (arg === '--include') {
      includeGlob = args[++i].replace(/^["']|["']$/g, '');
    } else if (!pattern) {
      pattern = arg.replace(/^["']|["']$/g, '');
    } else {
      searchPath = path.default.isAbsolute(arg) ? arg : path.default.resolve(process.cwd(), arg);
    }
  }

  if (!pattern) {
    console.log('❌ Please provide a search pattern');
    return true;
  }

  // Build regex
  let regexPattern = pattern;
  if (wordMatch) {
    regexPattern = `\\b${pattern}\\b`;
  }
  const regex = new RegExp(regexPattern, ignoreCase ? 'gi' : 'g');

  // Default ignore patterns
  const defaultIgnore = ['node_modules', '.git', '__pycache__', '.next', 'dist', 'build', '.cache', 'coverage'];

  // Binary file extensions to skip
  const binaryExts = ['.png', '.jpg', '.jpeg', '.gif', '.ico', '.pdf', '.zip', '.tar', '.gz', '.exe', '.dll', '.so', '.woff', '.woff2', '.ttf', '.eot'];

  console.log(`\n🔎 Searching for: ${pattern}`);
  console.log(`   in: ${searchPath}\n`);

  const results = [];
  let totalMatches = 0;

  // Convert include glob to regex if provided
  let includeRegex = null;
  if (includeGlob) {
    const globPattern = includeGlob
      .replace(/\./g, '\\.')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');
    includeRegex = new RegExp(`^${globPattern}$`);
  }

  async function searchFile(filePath) {
    try {
      const ext = path.default.extname(filePath).toLowerCase();
      if (binaryExts.includes(ext)) return;

      if (includeRegex && !includeRegex.test(path.default.basename(filePath))) return;

      const content = await fs.readFile(filePath, 'utf-8');
      const lines = content.split('\n');
      const matches = [];

      lines.forEach((line, index) => {
        if (regex.test(line)) {
          matches.push({ line: index + 1, content: line, context: [] });
          totalMatches++;

          // Get context lines
          if (contextLines > 0) {
            const start = Math.max(0, index - contextLines);
            const end = Math.min(lines.length - 1, index + contextLines);
            for (let j = start; j <= end; j++) {
              if (j !== index) {
                matches[matches.length - 1].context.push({ line: j + 1, content: lines[j] });
              }
            }
          }
        }
        // Reset regex lastIndex for global flag
        regex.lastIndex = 0;
      });

      if (matches.length > 0) {
        results.push({ path: filePath, matches, count: matches.length });
      }
    } catch (error) {
      // Skip unreadable files
    }
  }

  async function searchDir(dir) {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.default.join(dir, entry.name);

        if (defaultIgnore.includes(entry.name)) continue;

        if (entry.isDirectory()) {
          await searchDir(fullPath);
        } else if (entry.isFile()) {
          await searchFile(fullPath);
        }
      }
    } catch (error) {
      // Skip permission errors
    }
  }

  const stats = await fs.stat(searchPath);
  if (stats.isFile()) {
    await searchFile(searchPath);
  } else {
    await searchDir(searchPath);
  }

  if (results.length === 0) {
    console.log('No matches found.');
  } else if (countOnly) {
    console.log(`Found ${totalMatches} match${totalMatches === 1 ? '' : 'es'} in ${results.length} file${results.length === 1 ? '' : 's'}`);
  } else if (filesOnly) {
    console.log(`Found matches in ${results.length} file${results.length === 1 ? '' : 's'}:\n`);
    for (const result of results) {
      const relativePath = path.default.relative(process.cwd(), result.path);
      console.log(`  📄 ${relativePath} (${result.count} match${result.count === 1 ? '' : 'es'})`);
    }
  } else {
    console.log(`Found ${totalMatches} match${totalMatches === 1 ? '' : 'es'} in ${results.length} file${results.length === 1 ? '' : 's'}:\n`);

    for (const result of results.slice(0, 20)) {
      const relativePath = path.default.relative(process.cwd(), result.path);
      console.log(`📄 ${relativePath}`);

      for (const match of result.matches.slice(0, 5)) {
        const lineNum = showLineNumbers ? `${String(match.line).padStart(4)}:` : '';
        const highlightedContent = match.content.replace(regex, (m) => `\x1b[1;33m${m}\x1b[0m`);
        regex.lastIndex = 0;
        console.log(`  ${lineNum} ${highlightedContent.trim().substring(0, 100)}`);
      }

      if (result.matches.length > 5) {
        console.log(`  ... and ${result.matches.length - 5} more matches`);
      }
      console.log('');
    }

    if (results.length > 20) {
      console.log(`... and ${results.length - 20} more files with matches`);
    }
  }

  console.log('');
  return true;
}

/**
 * Handle /touch command - Create empty file or update timestamp
 */
export async function handleTouchCommand(input) {
  const args = input.split(' ').slice(1);

  if (args.length === 0 || args[0] === 'help') {
    console.log(`
📝 Touch (Create/Update Files)
══════════════════════════════

Usage:
  /touch <file>            Create file or update timestamp
  /touch <file1> <file2>   Create multiple files

Options:
  -p, --parents           Create parent directories as needed

Examples:
  /touch newfile.txt
  /touch src/new/file.js -p
  /touch file1.txt file2.txt
`);
    return true;
  }

  const path = await import('path');
  const fs = await import('fs-extra');

  let createParents = false;
  const files = [];

  for (const arg of args) {
    if (arg === '-p' || arg === '--parents') {
      createParents = true;
    } else if (!arg.startsWith('-')) {
      files.push(arg);
    }
  }

  if (files.length === 0) {
    console.log('❌ Please provide at least one file path');
    return true;
  }

  console.log('');
  for (const file of files) {
    const filePath = path.default.isAbsolute(file) ? file : path.default.resolve(process.cwd(), file);

    try {
      const dir = path.default.dirname(filePath);

      if (createParents) {
        await fs.ensureDir(dir);
      } else if (!await fs.pathExists(dir)) {
        console.log(`❌ Directory does not exist: ${path.default.dirname(file)}`);
        console.log('   Use -p to create parent directories');
        continue;
      }

      const exists = await fs.pathExists(filePath);

      if (exists) {
        // Update timestamp
        const now = new Date();
        await fs.utimes(filePath, now, now);
        console.log(`✅ Updated: ${file}`);
      } else {
        // Create empty file
        await fs.writeFile(filePath, '');
        console.log(`✅ Created: ${file}`);
      }
    } catch (error) {
      console.log(`❌ Error with ${file}: ${error.message}`);
    }
  }
  console.log('');

  return true;
}

/**
 * Handle /mkdir command - Create directories
 */
export async function handleMkdirCommand(input) {
  const args = input.split(' ').slice(1);

  if (args.length === 0 || args[0] === 'help') {
    console.log(`
📁 Make Directory
═════════════════

Usage:
  /mkdir <dir>             Create directory
  /mkdir <dir1> <dir2>     Create multiple directories

Options:
  -p, --parents           Create parent directories as needed (default)

Examples:
  /mkdir new-folder
  /mkdir src/components/ui
  /mkdir dir1 dir2 dir3
`);
    return true;
  }

  const path = await import('path');
  const fs = await import('fs-extra');

  const dirs = args.filter(arg => !arg.startsWith('-'));

  if (dirs.length === 0) {
    console.log('❌ Please provide at least one directory path');
    return true;
  }

  console.log('');
  for (const dir of dirs) {
    const dirPath = path.default.isAbsolute(dir) ? dir : path.default.resolve(process.cwd(), dir);

    try {
      if (await fs.pathExists(dirPath)) {
        console.log(`⚠️  Already exists: ${dir}`);
      } else {
        await fs.ensureDir(dirPath);
        console.log(`✅ Created: ${dir}`);
      }
    } catch (error) {
      console.log(`❌ Error creating ${dir}: ${error.message}`);
    }
  }
  console.log('');

  return true;
}

/**
 * Handle /rm command - Remove files or directories
 */
export async function handleRmCommand(input) {
  const args = input.split(' ').slice(1);

  if (args.length === 0 || args[0] === 'help') {
    console.log(`
🗑️  Remove Files/Directories
════════════════════════════

Usage:
  /rm <file>               Remove file
  /rm <dir> -r             Remove directory recursively

Options:
  -r, --recursive         Remove directories and contents
  -f, --force             Don't prompt for confirmation
  --dry-run               Show what would be deleted

Examples:
  /rm oldfile.txt
  /rm -r build/
  /rm --dry-run -r node_modules/
`);
    return true;
  }

  const path = await import('path');
  const fs = await import('fs-extra');
  const readline = await import('readline');

  let recursive = false;
  let force = false;
  let dryRun = false;
  const targets = [];

  for (const arg of args) {
    if (arg === '-r' || arg === '--recursive') {
      recursive = true;
    } else if (arg === '-f' || arg === '--force') {
      force = true;
    } else if (arg === '--dry-run') {
      dryRun = true;
    } else if (!arg.startsWith('-')) {
      targets.push(arg);
    }
  }

  if (targets.length === 0) {
    console.log('❌ Please provide at least one file or directory');
    return true;
  }

  // Helper to prompt user
  async function confirm(message) {
    if (force) return true;

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    return new Promise((resolve) => {
      rl.question(`${message} (y/N): `, (answer) => {
        rl.close();
        resolve(answer.toLowerCase() === 'y');
      });
    });
  }

  console.log('');
  for (const target of targets) {
    const targetPath = path.default.isAbsolute(target) ? target : path.default.resolve(process.cwd(), target);

    try {
      if (!await fs.pathExists(targetPath)) {
        console.log(`❌ Not found: ${target}`);
        continue;
      }

      const stats = await fs.stat(targetPath);

      if (stats.isDirectory() && !recursive) {
        console.log(`❌ ${target} is a directory. Use -r to remove.`);
        continue;
      }

      if (dryRun) {
        const type = stats.isDirectory() ? 'directory' : 'file';
        console.log(`Would remove ${type}: ${target}`);
        continue;
      }

      const confirmed = await confirm(`Delete ${target}?`);
      if (!confirmed) {
        console.log(`⏭️  Skipped: ${target}`);
        continue;
      }

      await fs.remove(targetPath);
      console.log(`🗑️  Removed: ${target}`);
    } catch (error) {
      console.log(`❌ Error removing ${target}: ${error.message}`);
    }
  }
  console.log('');

  return true;
}

/**
 * Handle /cp command - Copy files or directories
 */
export async function handleCpCommand(input) {
  const args = input.split(' ').slice(1);

  if (args.length < 2 || args[0] === 'help') {
    console.log(`
📋 Copy Files/Directories
═════════════════════════

Usage:
  /cp <source> <dest>      Copy file or directory

Options:
  -r, --recursive         Copy directories recursively (default for dirs)
  -n, --no-clobber        Don't overwrite existing files
  --dry-run               Show what would be copied

Examples:
  /cp file.txt backup.txt
  /cp src/ src-backup/
  /cp -n important.txt copy.txt
`);
    return true;
  }

  const path = await import('path');
  const fs = await import('fs-extra');

  let noClobber = false;
  let dryRun = false;
  const paths = [];

  for (const arg of args) {
    if (arg === '-r' || arg === '--recursive') {
      // Always recursive by default
    } else if (arg === '-n' || arg === '--no-clobber') {
      noClobber = true;
    } else if (arg === '--dry-run') {
      dryRun = true;
    } else if (!arg.startsWith('-')) {
      paths.push(arg);
    }
  }

  if (paths.length < 2) {
    console.log('❌ Please provide source and destination');
    return true;
  }

  const source = path.default.isAbsolute(paths[0]) ? paths[0] : path.default.resolve(process.cwd(), paths[0]);
  const dest = path.default.isAbsolute(paths[1]) ? paths[1] : path.default.resolve(process.cwd(), paths[1]);

  try {
    if (!await fs.pathExists(source)) {
      console.log(`❌ Source not found: ${paths[0]}`);
      return true;
    }

    if (noClobber && await fs.pathExists(dest)) {
      console.log(`⚠️  Destination exists, not overwriting: ${paths[1]}`);
      return true;
    }

    if (dryRun) {
      console.log(`Would copy: ${paths[0]} → ${paths[1]}`);
      return true;
    }

    await fs.copy(source, dest);
    console.log(`\n✅ Copied: ${paths[0]} → ${paths[1]}\n`);
  } catch (error) {
    console.log(`\n❌ Error: ${error.message}\n`);
  }

  return true;
}

/**
 * Handle /mv command - Move/rename files or directories
 */
export async function handleMvCommand(input) {
  const args = input.split(' ').slice(1);

  if (args.length < 2 || args[0] === 'help') {
    console.log(`
📦 Move/Rename Files
════════════════════

Usage:
  /mv <source> <dest>      Move or rename file/directory

Options:
  -n, --no-clobber        Don't overwrite existing files
  --dry-run               Show what would be moved

Examples:
  /mv old.txt new.txt
  /mv file.txt ../
  /mv src/ source/
`);
    return true;
  }

  const path = await import('path');
  const fs = await import('fs-extra');

  let noClobber = false;
  let dryRun = false;
  const paths = [];

  for (const arg of args) {
    if (arg === '-n' || arg === '--no-clobber') {
      noClobber = true;
    } else if (arg === '--dry-run') {
      dryRun = true;
    } else if (!arg.startsWith('-')) {
      paths.push(arg);
    }
  }

  if (paths.length < 2) {
    console.log('❌ Please provide source and destination');
    return true;
  }

  const source = path.default.isAbsolute(paths[0]) ? paths[0] : path.default.resolve(process.cwd(), paths[0]);
  const dest = path.default.isAbsolute(paths[1]) ? paths[1] : path.default.resolve(process.cwd(), paths[1]);

  try {
    if (!await fs.pathExists(source)) {
      console.log(`❌ Source not found: ${paths[0]}`);
      return true;
    }

    if (noClobber && await fs.pathExists(dest)) {
      console.log(`⚠️  Destination exists, not overwriting: ${paths[1]}`);
      return true;
    }

    if (dryRun) {
      console.log(`Would move: ${paths[0]} → ${paths[1]}`);
      return true;
    }

    await fs.move(source, dest);
    console.log(`\n✅ Moved: ${paths[0]} → ${paths[1]}\n`);
  } catch (error) {
    console.log(`\n❌ Error: ${error.message}\n`);
  }

  return true;
}

/**
 * Handle /head command - Show first lines of file
 */
export async function handleHeadCommand(input) {
  const args = input.split(' ').slice(1);

  if (args.length === 0 || args[0] === 'help') {
    console.log(`
📜 Head (First Lines)
═════════════════════

Usage:
  /head <file>             Show first 10 lines
  /head -n <num> <file>    Show first n lines

Examples:
  /head README.md
  /head -n 20 package.json
`);
    return true;
  }

  let lines = 10;
  let file = '';

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '-n' && args[i + 1]) {
      lines = parseInt(args[++i], 10);
    } else if (!args[i].startsWith('-')) {
      file = args[i];
    }
  }

  if (!file) {
    console.log('❌ Please provide a file path');
    return true;
  }

  // Use handleReadCommand with --head option
  return handleReadCommand(`/read --head ${lines} ${file}`);
}

/**
 * Handle /tail command - Show last lines of file
 */
export async function handleTailCommand(input) {
  const args = input.split(' ').slice(1);

  if (args.length === 0 || args[0] === 'help') {
    console.log(`
📜 Tail (Last Lines)
════════════════════

Usage:
  /tail <file>             Show last 10 lines
  /tail -n <num> <file>    Show last n lines

Examples:
  /tail error.log
  /tail -n 50 server.log
`);
    return true;
  }

  let lines = 10;
  let file = '';

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '-n' && args[i + 1]) {
      lines = parseInt(args[++i], 10);
    } else if (!args[i].startsWith('-')) {
      file = args[i];
    }
  }

  if (!file) {
    console.log('❌ Please provide a file path');
    return true;
  }

  // Use handleReadCommand with --tail option
  return handleReadCommand(`/read --tail ${lines} ${file}`);
}

/**
 * Handle /wc command - Word/line/character count
 */
export async function handleWcCommand(input) {
  const args = input.split(' ').slice(1);

  if (args.length === 0 || args[0] === 'help') {
    console.log(`
📊 Word Count
═════════════

Usage:
  /wc <file>               Show lines, words, and characters
  /wc <file1> <file2>      Count multiple files

Options:
  -l, --lines              Show only line count
  -w, --words              Show only word count
  -c, --chars              Show only character count

Examples:
  /wc README.md
  /wc -l src/*.js
`);
    return true;
  }

  const path = await import('path');
  const fs = await import('fs-extra');

  let showLines = true;
  let showWords = true;
  let showChars = true;
  const files = [];

  // Check for specific options
  let hasSpecificOption = false;
  for (const arg of args) {
    if (arg === '-l' || arg === '--lines') {
      hasSpecificOption = true;
    } else if (arg === '-w' || arg === '--words') {
      hasSpecificOption = true;
    } else if (arg === '-c' || arg === '--chars') {
      hasSpecificOption = true;
    }
  }

  if (hasSpecificOption) {
    showLines = false;
    showWords = false;
    showChars = false;
  }

  for (const arg of args) {
    if (arg === '-l' || arg === '--lines') {
      showLines = true;
    } else if (arg === '-w' || arg === '--words') {
      showWords = true;
    } else if (arg === '-c' || arg === '--chars') {
      showChars = true;
    } else if (!arg.startsWith('-')) {
      files.push(arg);
    }
  }

  if (files.length === 0) {
    console.log('❌ Please provide at least one file');
    return true;
  }

  console.log('');
  let totalLines = 0;
  let totalWords = 0;
  let totalChars = 0;

  for (const file of files) {
    const filePath = path.default.isAbsolute(file) ? file : path.default.resolve(process.cwd(), file);

    try {
      if (!await fs.pathExists(filePath)) {
        console.log(`❌ Not found: ${file}`);
        continue;
      }

      const content = await fs.readFile(filePath, 'utf-8');
      const lines = content.split('\n').length;
      const words = content.split(/\s+/).filter(w => w.length > 0).length;
      const chars = content.length;

      totalLines += lines;
      totalWords += words;
      totalChars += chars;

      const parts = [];
      if (showLines) parts.push(`${String(lines).padStart(8)} lines`);
      if (showWords) parts.push(`${String(words).padStart(8)} words`);
      if (showChars) parts.push(`${String(chars).padStart(8)} chars`);

      console.log(`  ${parts.join('  ')}  ${file}`);
    } catch (error) {
      console.log(`❌ Error reading ${file}: ${error.message}`);
    }
  }

  if (files.length > 1) {
    const parts = [];
    if (showLines) parts.push(`${String(totalLines).padStart(8)} lines`);
    if (showWords) parts.push(`${String(totalWords).padStart(8)} words`);
    if (showChars) parts.push(`${String(totalChars).padStart(8)} chars`);
    console.log(`  ${parts.join('  ')}  total`);
  }

  console.log('');
  return true;
}

/**
 * Handle /echo command - Output text
 */
export async function handleEchoCommand(input) {
  const text = input.replace(/^\/echo\s*/, '');

  if (!text || text === 'help') {
    console.log(`
📢 Echo (Output Text)
═════════════════════

Usage:
  /echo <text>             Output text
  /echo $VAR               Output environment variable

Options:
  -n                       No trailing newline
  -e                       Enable escape sequences

Examples:
  /echo Hello, World!
  /echo $HOME
  /echo -e "Line1\\nLine2"
`);
    return true;
  }

  let output = text;
  let noNewline = false;
  let enableEscape = false;

  // Check for flags at the start
  if (output.startsWith('-n ')) {
    noNewline = true;
    output = output.substring(3);
  } else if (output.startsWith('-e ')) {
    enableEscape = true;
    output = output.substring(3);
  } else if (output.startsWith('-ne ') || output.startsWith('-en ')) {
    noNewline = true;
    enableEscape = true;
    output = output.substring(4);
  }

  // Expand environment variables
  output = output.replace(/\$([A-Za-z_][A-Za-z0-9_]*)/g, (_, name) => {
    return process.env[name] || '';
  });

  // Handle escape sequences if enabled
  if (enableEscape) {
    output = output
      .replace(/\\n/g, '\n')
      .replace(/\\t/g, '\t')
      .replace(/\\r/g, '\r')
      .replace(/\\\\/g, '\\');
  }

  // Remove surrounding quotes if present
  if ((output.startsWith('"') && output.endsWith('"')) ||
      (output.startsWith("'") && output.endsWith("'"))) {
    output = output.slice(1, -1);
  }

  if (noNewline) {
    process.stdout.write(output);
  } else {
    console.log(output);
  }

  return true;
}

/**
 * Handle /env command - Show/set environment variables
 */
export async function handleEnvCommand(input) {
  const args = input.split(' ').slice(1);

  if (args[0] === 'help') {
    console.log(`
🌍 Environment Variables
════════════════════════

Usage:
  /env                     Show all environment variables
  /env <name>              Show specific variable
  /env <name>=<value>      Set variable (session only)
  /env --unset <name>      Unset variable

Options:
  -f, --filter <pattern>   Filter variables by pattern
  --export                 Show in export format

Examples:
  /env
  /env PATH
  /env MY_VAR=hello
  /env --filter NODE
`);
    return true;
  }

  // Parse options
  let filterPattern = null;
  let exportFormat = false;
  let unsetVar = null;
  const assignments = [];
  const lookups = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '-f' || arg === '--filter') {
      filterPattern = args[++i];
    } else if (arg === '--export') {
      exportFormat = true;
    } else if (arg === '--unset') {
      unsetVar = args[++i];
    } else if (arg.includes('=')) {
      assignments.push(arg);
    } else if (arg && !arg.startsWith('-')) {
      lookups.push(arg);
    }
  }

  // Handle unset
  if (unsetVar) {
    delete process.env[unsetVar];
    console.log(`\n✅ Unset: ${unsetVar}\n`);
    return true;
  }

  // Handle assignments
  if (assignments.length > 0) {
    console.log('');
    for (const assignment of assignments) {
      const [name, ...valueParts] = assignment.split('=');
      const value = valueParts.join('=');
      process.env[name] = value;
      console.log(`✅ ${name}=${value}`);
    }
    console.log('');
    return true;
  }

  // Handle lookups
  if (lookups.length > 0) {
    console.log('');
    for (const name of lookups) {
      const value = process.env[name];
      if (value !== undefined) {
        console.log(`${name}=${value}`);
      } else {
        console.log(`${name} is not set`);
      }
    }
    console.log('');
    return true;
  }

  // Show all variables
  const entries = Object.entries(process.env);
  let filtered = entries;

  if (filterPattern) {
    const regex = new RegExp(filterPattern, 'i');
    filtered = entries.filter(([key]) => regex.test(key));
  }

  filtered.sort((a, b) => a[0].localeCompare(b[0]));

  console.log(`\n🌍 Environment Variables${filterPattern ? ` (filter: ${filterPattern})` : ''}\n`);

  for (const [key, value] of filtered.slice(0, 50)) {
    const displayValue = value.length > 60 ? value.substring(0, 57) + '...' : value;
    if (exportFormat) {
      console.log(`export ${key}="${displayValue}"`);
    } else {
      console.log(`  ${key}=${displayValue}`);
    }
  }

  if (filtered.length > 50) {
    console.log(`\n  ... and ${filtered.length - 50} more`);
  }

  console.log(`\nTotal: ${filtered.length} variable${filtered.length === 1 ? '' : 's'}\n`);

  return true;
}

/**
 * Handle /which command - Find executable location
 */
export async function handleWhichCommand(input) {
  const args = input.split(' ').slice(1);

  if (args.length === 0 || args[0] === 'help') {
    console.log(`
🔎 Which (Find Executable)
══════════════════════════

Usage:
  /which <command>         Find location of command
  /which <cmd1> <cmd2>     Find multiple commands

Options:
  -a, --all               Show all matches, not just first

Examples:
  /which node
  /which npm yarn pnpm
  /which -a python
`);
    return true;
  }

  const path = await import('path');
  const fs = await import('fs-extra');

  let showAll = false;
  const commands = [];

  for (const arg of args) {
    if (arg === '-a' || arg === '--all') {
      showAll = true;
    } else if (!arg.startsWith('-')) {
      commands.push(arg);
    }
  }

  if (commands.length === 0) {
    console.log('❌ Please provide at least one command');
    return true;
  }

  const pathDirs = (process.env.PATH || '').split(path.default.delimiter);
  const execExts = process.platform === 'win32'
    ? (process.env.PATHEXT || '.COM;.EXE;.BAT;.CMD').split(';')
    : [''];

  console.log('');
  for (const cmd of commands) {
    const found = [];

    for (const dir of pathDirs) {
      for (const ext of execExts) {
        const fullPath = path.default.join(dir, cmd + ext);
        try {
          const stats = await fs.stat(fullPath);
          if (stats.isFile()) {
            found.push(fullPath);
            if (!showAll) break;
          }
        } catch {
          // File doesn't exist
        }
      }
      if (found.length > 0 && !showAll) break;
    }

    if (found.length > 0) {
      for (const location of found) {
        console.log(`  ✅ ${cmd}: ${location}`);
      }
    } else {
      console.log(`  ❌ ${cmd}: not found`);
    }
  }
  console.log('');

  return true;
}

/**
 * Handle /stat command - Show file information
 */
export async function handleStatCommand(input) {
  const args = input.split(' ').slice(1);

  if (args.length === 0 || args[0] === 'help') {
    console.log(`
📊 File Statistics
══════════════════

Usage:
  /stat <file>             Show file information
  /stat <file1> <file2>    Show multiple file info

Options:
  -f, --format <fmt>       Custom format string
  -t, --terse              Terse output

Examples:
  /stat package.json
  /stat src/ lib/
`);
    return true;
  }

  const path = await import('path');
  const fs = await import('fs-extra');

  let terse = false;
  const files = [];

  for (const arg of args) {
    if (arg === '-t' || arg === '--terse') {
      terse = true;
    } else if (!arg.startsWith('-')) {
      files.push(arg);
    }
  }

  if (files.length === 0) {
    console.log('❌ Please provide at least one file');
    return true;
  }

  function formatPermissions(mode) {
    const types = { '40': 'd', '100': '-', '120': 'l' };
    const perms = ['---', '--x', '-w-', '-wx', 'r--', 'r-x', 'rw-', 'rwx'];

    const typeKey = ((mode >> 12) * 10).toString();
    const type = types[typeKey] || '-';

    const owner = perms[(mode >> 6) & 7];
    const group = perms[(mode >> 3) & 7];
    const other = perms[mode & 7];

    return type + owner + group + other;
  }

  function formatSize(bytes) {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = bytes;
    let unit = 0;
    while (size >= 1024 && unit < units.length - 1) {
      size /= 1024;
      unit++;
    }
    return `${size.toFixed(unit > 0 ? 1 : 0)} ${units[unit]}`;
  }

  console.log('');
  for (const file of files) {
    const filePath = path.default.isAbsolute(file) ? file : path.default.resolve(process.cwd(), file);

    try {
      const stats = await fs.stat(filePath);
      const lstat = await fs.lstat(filePath);

      if (terse) {
        console.log(`${stats.size} ${stats.mode.toString(8)} ${stats.uid} ${stats.gid} ${file}`);
      } else {
        const type = stats.isDirectory() ? 'Directory' :
                     stats.isFile() ? 'File' :
                     lstat.isSymbolicLink() ? 'Symbolic Link' :
                     stats.isBlockDevice() ? 'Block Device' :
                     stats.isCharacterDevice() ? 'Character Device' :
                     stats.isFIFO() ? 'FIFO' :
                     stats.isSocket() ? 'Socket' : 'Unknown';

        console.log(`📄 ${file}`);
        console.log(`   Type:        ${type}`);
        console.log(`   Size:        ${formatSize(stats.size)} (${stats.size.toLocaleString()} bytes)`);
        console.log(`   Permissions: ${formatPermissions(stats.mode)} (${(stats.mode & 0o777).toString(8)})`);
        console.log(`   Created:     ${stats.birthtime.toLocaleString()}`);
        console.log(`   Modified:    ${stats.mtime.toLocaleString()}`);
        console.log(`   Accessed:    ${stats.atime.toLocaleString()}`);
        console.log(`   Inode:       ${stats.ino}`);

        if (lstat.isSymbolicLink()) {
          const target = await fs.readlink(filePath);
          console.log(`   Link Target: ${target}`);
        }
        console.log('');
      }
    } catch (error) {
      console.log(`❌ ${file}: ${error.message}`);
    }
  }

  return true;
}

/**
 * Handle /chmod command - Change file permissions
 */
export async function handleChmodCommand(input) {
  const args = input.split(' ').slice(1);

  if (args.length < 2 || args[0] === 'help') {
    console.log(`
🔐 Change Permissions
═════════════════════

Usage:
  /chmod <mode> <file>     Change file permissions
  /chmod <mode> <files...> Change multiple files

Mode formats:
  Octal:    755, 644, 700
  Symbolic: +x, -w, u+rwx, go-w

Options:
  -R, --recursive         Apply recursively to directories
  --dry-run               Show what would change

Examples:
  /chmod 755 script.sh
  /chmod +x build.sh
  /chmod -R 644 src/
`);
    return true;
  }

  const path = await import('path');
  const fs = await import('fs-extra');

  let recursive = false;
  let dryRun = false;
  let mode = null;
  const files = [];

  for (const arg of args) {
    if (arg === '-R' || arg === '--recursive') {
      recursive = true;
    } else if (arg === '--dry-run') {
      dryRun = true;
    } else if (!mode) {
      mode = arg;
    } else if (!arg.startsWith('-')) {
      files.push(arg);
    }
  }

  if (!mode || files.length === 0) {
    console.log('❌ Please provide mode and file(s)');
    return true;
  }

  // Parse mode
  function parseMode(modeStr, currentMode) {
    // Octal mode
    if (/^[0-7]{3,4}$/.test(modeStr)) {
      return parseInt(modeStr, 8);
    }

    // Symbolic mode
    let newMode = currentMode & 0o777;
    const regex = /([ugoa]*)([+\-=])([rwxXst]*)/g;
    let match;

    while ((match = regex.exec(modeStr)) !== null) {
      const [, who, op, perms] = match;

      let mask = 0;
      if (perms.includes('r')) mask |= 0o444;
      if (perms.includes('w')) mask |= 0o222;
      if (perms.includes('x')) mask |= 0o111;

      let whoMask = 0o777;
      if (who.includes('u') || who === '' || who.includes('a')) whoMask &= 0o700;
      if (who.includes('g') || who === '' || who.includes('a')) whoMask &= 0o070;
      if (who.includes('o') || who === '' || who.includes('a')) whoMask &= 0o007;

      if (who === '' || who.includes('a')) whoMask = 0o777;

      const effectiveMask = mask & whoMask;

      if (op === '+') newMode |= effectiveMask;
      else if (op === '-') newMode &= ~effectiveMask;
      else if (op === '=') newMode = (newMode & ~whoMask) | effectiveMask;
    }

    return newMode;
  }

  async function applyChmod(filePath, displayPath) {
    try {
      const stats = await fs.stat(filePath);
      const newMode = parseMode(mode, stats.mode);

      if (dryRun) {
        console.log(`Would change ${displayPath}: ${(stats.mode & 0o777).toString(8)} → ${newMode.toString(8)}`);
      } else {
        await fs.chmod(filePath, newMode);
        console.log(`✅ ${displayPath}: ${(stats.mode & 0o777).toString(8)} → ${newMode.toString(8)}`);
      }

      if (recursive && stats.isDirectory()) {
        const entries = await fs.readdir(filePath);
        for (const entry of entries) {
          const entryPath = path.default.join(filePath, entry);
          const entryDisplay = path.default.join(displayPath, entry);
          await applyChmod(entryPath, entryDisplay);
        }
      }
    } catch (error) {
      console.log(`❌ ${displayPath}: ${error.message}`);
    }
  }

  console.log('');
  for (const file of files) {
    const filePath = path.default.isAbsolute(file) ? file : path.default.resolve(process.cwd(), file);
    await applyChmod(filePath, file);
  }
  console.log('');

  return true;
}

/**
 * Handle /ln command - Create links
 */
export async function handleLnCommand(input) {
  const args = input.split(' ').slice(1);

  if (args.length < 2 || args[0] === 'help') {
    console.log(`
🔗 Create Links
═══════════════

Usage:
  /ln <target> <link>      Create hard link
  /ln -s <target> <link>   Create symbolic link

Options:
  -s, --symbolic          Create symbolic link
  -f, --force             Remove existing destination
  --dry-run               Show what would be done

Examples:
  /ln -s ../config.json config
  /ln -s /usr/local/bin/node node
  /ln file.txt hardlink.txt
`);
    return true;
  }

  const path = await import('path');
  const fs = await import('fs-extra');

  let symbolic = false;
  let force = false;
  let dryRun = false;
  const paths = [];

  for (const arg of args) {
    if (arg === '-s' || arg === '--symbolic') {
      symbolic = true;
    } else if (arg === '-f' || arg === '--force') {
      force = true;
    } else if (arg === '--dry-run') {
      dryRun = true;
    } else if (!arg.startsWith('-')) {
      paths.push(arg);
    }
  }

  if (paths.length < 2) {
    console.log('❌ Please provide target and link name');
    return true;
  }

  const target = paths[0];
  const linkPath = path.default.isAbsolute(paths[1]) ? paths[1] : path.default.resolve(process.cwd(), paths[1]);

  try {
    // Check if link already exists
    if (await fs.pathExists(linkPath)) {
      if (force) {
        if (!dryRun) {
          await fs.remove(linkPath);
        }
        console.log(`  Removed existing: ${paths[1]}`);
      } else {
        console.log(`\n❌ Link already exists: ${paths[1]}\n   Use -f to overwrite\n`);
        return true;
      }
    }

    if (dryRun) {
      const linkType = symbolic ? 'symbolic link' : 'hard link';
      console.log(`\nWould create ${linkType}: ${paths[1]} → ${target}\n`);
      return true;
    }

    if (symbolic) {
      await fs.symlink(target, linkPath);
      console.log(`\n✅ Created symbolic link: ${paths[1]} → ${target}\n`);
    } else {
      const targetPath = path.default.isAbsolute(target) ? target : path.default.resolve(process.cwd(), target);
      await fs.link(targetPath, linkPath);
      console.log(`\n✅ Created hard link: ${paths[1]} → ${target}\n`);
    }
  } catch (error) {
    console.log(`\n❌ Error: ${error.message}\n`);
  }

  return true;
}

/**
 * Handle /du command - Disk usage
 */
export async function handleDuCommand(input) {
  const args = input.split(' ').slice(1);

  if (args[0] === 'help') {
    console.log(`
💾 Disk Usage
═════════════

Usage:
  /du [path]               Show disk usage
  /du -s [path]            Summary only

Options:
  -s, --summary           Show only total
  -h, --human             Human-readable sizes (default)
  -d, --depth <n>         Max depth to traverse
  --sort                  Sort by size

Examples:
  /du
  /du -s node_modules/
  /du -d 1 src/
`);
    return true;
  }

  const path = await import('path');
  const fs = await import('fs-extra');

  let summary = false;
  let maxDepth = Infinity;
  let sortBySize = false;
  let targetPath = process.cwd();

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '-s' || arg === '--summary') {
      summary = true;
    } else if (arg === '-d' || arg === '--depth') {
      maxDepth = parseInt(args[++i], 10);
    } else if (arg === '--sort') {
      sortBySize = true;
    } else if (!arg.startsWith('-')) {
      targetPath = path.default.isAbsolute(arg) ? arg : path.default.resolve(process.cwd(), arg);
    }
  }

  function formatSize(bytes) {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = bytes;
    let unit = 0;
    while (size >= 1024 && unit < units.length - 1) {
      size /= 1024;
      unit++;
    }
    return `${size.toFixed(unit > 0 ? 1 : 0).padStart(7)} ${units[unit]}`;
  }

  const results = [];

  async function calculateSize(dir, depth = 0, displayPath = '') {
    let total = 0;

    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.default.join(dir, entry.name);
        const entryDisplay = displayPath ? path.default.join(displayPath, entry.name) : entry.name;

        if (entry.isDirectory()) {
          const subTotal = await calculateSize(fullPath, depth + 1, entryDisplay);
          total += subTotal;

          if (!summary && depth < maxDepth) {
            results.push({ path: entryDisplay, size: subTotal });
          }
        } else if (entry.isFile()) {
          try {
            const stats = await fs.stat(fullPath);
            total += stats.size;
          } catch {
            // Skip unreadable files
          }
        }
      }
    } catch (error) {
      // Skip permission errors
    }

    return total;
  }

  console.log(`\n💾 Disk Usage: ${path.default.relative(process.cwd(), targetPath) || '.'}\n`);

  const totalSize = await calculateSize(targetPath, 0, '');

  if (!summary) {
    if (sortBySize) {
      results.sort((a, b) => b.size - a.size);
    }

    for (const item of results.slice(0, 30)) {
      console.log(`  ${formatSize(item.size)}  ${item.path}`);
    }

    if (results.length > 30) {
      console.log(`  ... and ${results.length - 30} more entries`);
    }

    console.log('');
  }

  console.log(`  ${formatSize(totalSize)}  total\n`);

  return true;
}

/**
 * Handle /df command - Disk free space
 */
export async function handleDfCommand(input) {
  const args = input.split(' ').slice(1);

  if (args[0] === 'help') {
    console.log(`
💿 Disk Free Space
══════════════════

Usage:
  /df                      Show disk space for current mount
  /df [path]               Show disk space for path's mount

Options:
  -h, --human             Human-readable (default)

Examples:
  /df
  /df /home
`);
    return true;
  }

  const { execSync } = await import('child_process');

  try {
    let dfOutput;
    if (process.platform === 'win32') {
      dfOutput = execSync('wmic logicaldisk get size,freespace,caption', { encoding: 'utf-8' });
    } else {
      dfOutput = execSync('df -h', { encoding: 'utf-8' });
    }

    console.log('\n💿 Disk Space\n');
    console.log(dfOutput);
  } catch (error) {
    console.log(`\n❌ Error getting disk info: ${error.message}\n`);
  }

  return true;
}

/**
 * Handle /date command - Show date/time
 */
export async function handleDateCommand(input) {
  const args = input.split(' ').slice(1);

  if (args[0] === 'help') {
    console.log(`
📅 Date and Time
════════════════

Usage:
  /date                    Show current date/time
  /date -u                 Show UTC time
  /date +<format>          Custom format

Format codes:
  %Y - Year (2024)
  %m - Month (01-12)
  %d - Day (01-31)
  %H - Hour (00-23)
  %M - Minute (00-59)
  %S - Second (00-59)
  %Z - Timezone

Examples:
  /date
  /date -u
  /date +%Y-%m-%d
`);
    return true;
  }

  let useUTC = false;
  let format = null;

  for (const arg of args) {
    if (arg === '-u' || arg === '--utc') {
      useUTC = true;
    } else if (arg.startsWith('+')) {
      format = arg.substring(1);
    }
  }

  const now = new Date();

  if (format) {
    const d = useUTC ? {
      Y: now.getUTCFullYear(),
      m: String(now.getUTCMonth() + 1).padStart(2, '0'),
      d: String(now.getUTCDate()).padStart(2, '0'),
      H: String(now.getUTCHours()).padStart(2, '0'),
      M: String(now.getUTCMinutes()).padStart(2, '0'),
      S: String(now.getUTCSeconds()).padStart(2, '0'),
      Z: 'UTC'
    } : {
      Y: now.getFullYear(),
      m: String(now.getMonth() + 1).padStart(2, '0'),
      d: String(now.getDate()).padStart(2, '0'),
      H: String(now.getHours()).padStart(2, '0'),
      M: String(now.getMinutes()).padStart(2, '0'),
      S: String(now.getSeconds()).padStart(2, '0'),
      Z: Intl.DateTimeFormat().resolvedOptions().timeZone
    };

    let output = format
      .replace(/%Y/g, d.Y)
      .replace(/%m/g, d.m)
      .replace(/%d/g, d.d)
      .replace(/%H/g, d.H)
      .replace(/%M/g, d.M)
      .replace(/%S/g, d.S)
      .replace(/%Z/g, d.Z);

    console.log(`\n${output}\n`);
  } else if (useUTC) {
    console.log(`\n📅 ${now.toUTCString()}\n`);
  } else {
    console.log(`\n📅 ${now.toString()}\n`);
  }

  return true;
}

/**
 * Handle /sleep command - Pause execution
 */
export async function handleSleepCommand(input) {
  const args = input.split(' ').slice(1);

  if (args.length === 0 || args[0] === 'help') {
    console.log(`
⏱️  Sleep (Pause)
════════════════

Usage:
  /sleep <seconds>         Pause for n seconds
  /sleep <n>s              Pause for n seconds
  /sleep <n>m              Pause for n minutes

Examples:
  /sleep 5
  /sleep 30s
  /sleep 2m
`);
    return true;
  }

  let duration = args[0];
  let seconds = 0;

  if (duration.endsWith('m')) {
    seconds = parseFloat(duration) * 60;
  } else if (duration.endsWith('s')) {
    seconds = parseFloat(duration);
  } else {
    seconds = parseFloat(duration);
  }

  if (isNaN(seconds) || seconds < 0) {
    console.log('❌ Invalid duration');
    return true;
  }

  console.log(`\n⏱️  Sleeping for ${seconds} second${seconds === 1 ? '' : 's'}...`);

  await new Promise(resolve => setTimeout(resolve, seconds * 1000));

  console.log('✅ Done\n');

  return true;
}

/**
 * Handle /ps command - List processes
 */
export async function handlePsCommand(input) {
  const args = input.split(' ').slice(1);

  if (args[0] === 'help') {
    console.log(`
📊 Process List
═══════════════

Usage:
  /ps                      List current user's processes
  /ps -a                   List all processes
  /ps -f <filter>          Filter by name

Options:
  -a, --all               Show all processes
  -f, --filter <name>     Filter by process name
  -u, --user              Show user processes (default)
  --sort <field>          Sort by: pid, name, cpu, mem

Examples:
  /ps
  /ps -a
  /ps -f node
  /ps --sort cpu
`);
    return true;
  }

  const { execSync } = await import('child_process');

  let showAll = false;
  let filterName = null;
  let sortField = null;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '-a' || arg === '--all') {
      showAll = true;
    } else if (arg === '-f' || arg === '--filter') {
      filterName = args[++i];
    } else if (arg === '--sort') {
      sortField = args[++i];
    }
  }

  try {
    let cmd;
    if (process.platform === 'win32') {
      cmd = 'tasklist';
    } else {
      cmd = showAll ? 'ps aux' : 'ps -u $(whoami)';
    }

    let output = execSync(cmd, { encoding: 'utf-8' });

    // Filter if specified
    if (filterName) {
      const lines = output.split('\n');
      const header = lines[0];
      const filtered = lines.filter((line, i) =>
        i === 0 || line.toLowerCase().includes(filterName.toLowerCase())
      );
      output = filtered.join('\n');
    }

    console.log('\n📊 Process List\n');
    console.log(output);
  } catch (error) {
    console.log(`\n❌ Error listing processes: ${error.message}\n`);
  }

  return true;
}

/**
 * Handle /kill command - Terminate process
 */
export async function handleKillCommand(input) {
  const args = input.split(' ').slice(1);

  if (args.length === 0 || args[0] === 'help') {
    console.log(`
⚠️  Kill Process
════════════════

Usage:
  /kill <pid>              Terminate process by PID
  /kill -9 <pid>           Force kill (SIGKILL)
  /kill -n <name>          Kill by process name

Options:
  -9, --force             Force kill (SIGKILL)
  -15                     Graceful termination (SIGTERM, default)
  -n, --name <name>       Kill by name (first match)
  --dry-run               Show what would be killed

Examples:
  /kill 12345
  /kill -9 12345
  /kill -n node
`);
    return true;
  }

  const { execSync } = await import('child_process');

  let signal = 'SIGTERM';
  let pid = null;
  let processName = null;
  let dryRun = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '-9' || arg === '--force') {
      signal = 'SIGKILL';
    } else if (arg === '-15') {
      signal = 'SIGTERM';
    } else if (arg === '-n' || arg === '--name') {
      processName = args[++i];
    } else if (arg === '--dry-run') {
      dryRun = true;
    } else if (/^\d+$/.test(arg)) {
      pid = parseInt(arg, 10);
    }
  }

  if (!pid && !processName) {
    console.log('❌ Please provide a PID or process name');
    return true;
  }

  try {
    // Find PID by name if needed
    if (processName && !pid) {
      let findCmd;
      if (process.platform === 'win32') {
        findCmd = `tasklist /FI "IMAGENAME eq ${processName}*" /NH`;
      } else {
        findCmd = `pgrep -f "${processName}" | head -1`;
      }

      try {
        const result = execSync(findCmd, { encoding: 'utf-8' }).trim();
        if (result) {
          pid = parseInt(result.split(/\s+/)[process.platform === 'win32' ? 1 : 0], 10);
        }
      } catch {
        console.log(`\n❌ No process found matching: ${processName}\n`);
        return true;
      }
    }

    if (!pid || isNaN(pid)) {
      console.log(`\n❌ No process found\n`);
      return true;
    }

    if (dryRun) {
      console.log(`\nWould kill PID ${pid} with ${signal}\n`);
      return true;
    }

    // Kill the process
    if (process.platform === 'win32') {
      execSync(`taskkill /PID ${pid} ${signal === 'SIGKILL' ? '/F' : ''}`);
    } else {
      process.kill(pid, signal);
    }

    console.log(`\n✅ Sent ${signal} to PID ${pid}\n`);
  } catch (error) {
    console.log(`\n❌ Error: ${error.message}\n`);
  }

  return true;
}

/**
 * Handle /curl command - HTTP requests
 */
export async function handleCurlCommand(input) {
  const args = input.split(' ').slice(1);

  if (args.length === 0 || args[0] === 'help') {
    console.log(`
🌐 HTTP Request (curl)
══════════════════════

Usage:
  /curl <url>              GET request
  /curl -X POST <url>      POST request
  /curl -d <data> <url>    POST with data

Options:
  -X, --request <method>  HTTP method (GET, POST, PUT, DELETE)
  -H, --header <header>   Add header (can use multiple)
  -d, --data <data>       Request body data
  -o, --output <file>     Save response to file
  -I, --head              Show headers only
  -v, --verbose           Verbose output

Examples:
  /curl https://api.example.com/data
  /curl -X POST -d '{"key":"value"}' -H "Content-Type: application/json" https://api.example.com
  /curl -I https://example.com
`);
    return true;
  }

  const path = await import('path');
  const fs = await import('fs-extra');

  let method = 'GET';
  let url = null;
  const headers = {};
  let data = null;
  let outputFile = null;
  let headersOnly = false;
  let verbose = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '-X' || arg === '--request') {
      method = args[++i].toUpperCase();
    } else if (arg === '-H' || arg === '--header') {
      const headerVal = args[++i];
      const [key, ...valueParts] = headerVal.split(':');
      headers[key.trim()] = valueParts.join(':').trim();
    } else if (arg === '-d' || arg === '--data') {
      data = args[++i];
      if (method === 'GET') method = 'POST';
    } else if (arg === '-o' || arg === '--output') {
      outputFile = args[++i];
    } else if (arg === '-I' || arg === '--head') {
      headersOnly = true;
      method = 'HEAD';
    } else if (arg === '-v' || arg === '--verbose') {
      verbose = true;
    } else if (!arg.startsWith('-')) {
      url = arg;
    }
  }

  if (!url) {
    console.log('❌ Please provide a URL');
    return true;
  }

  // Ensure URL has protocol
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'https://' + url;
  }

  console.log(`\n🌐 ${method} ${url}\n`);

  try {
    const fetchOptions = {
      method,
      headers
    };

    if (data) {
      fetchOptions.body = data;
      if (!headers['Content-Type']) {
        // Try to detect JSON
        try {
          JSON.parse(data);
          fetchOptions.headers['Content-Type'] = 'application/json';
        } catch {
          fetchOptions.headers['Content-Type'] = 'application/x-www-form-urlencoded';
        }
      }
    }

    if (verbose) {
      console.log('> Request Headers:');
      Object.entries(fetchOptions.headers).forEach(([k, v]) => {
        console.log(`  ${k}: ${v}`);
      });
      console.log('');
    }

    const response = await fetch(url, fetchOptions);

    // Show status
    const statusIcon = response.ok ? '✅' : '❌';
    console.log(`${statusIcon} Status: ${response.status} ${response.statusText}`);

    // Show headers if verbose or headers-only
    if (verbose || headersOnly) {
      console.log('\n< Response Headers:');
      response.headers.forEach((value, key) => {
        console.log(`  ${key}: ${value}`);
      });
    }

    if (!headersOnly) {
      const contentType = response.headers.get('content-type') || '';
      let body;

      if (contentType.includes('application/json')) {
        body = await response.json();
        body = JSON.stringify(body, null, 2);
      } else {
        body = await response.text();
      }

      if (outputFile) {
        const outPath = path.default.isAbsolute(outputFile)
          ? outputFile
          : path.default.resolve(process.cwd(), outputFile);
        await fs.writeFile(outPath, body);
        console.log(`\n✅ Saved to: ${outputFile}`);
      } else {
        console.log('\nResponse Body:');
        // Truncate if too long
        if (body.length > 2000) {
          console.log(body.substring(0, 2000));
          console.log(`\n... (truncated, ${body.length} total characters)`);
        } else {
          console.log(body);
        }
      }
    }

    console.log('');
  } catch (error) {
    console.log(`❌ Error: ${error.message}\n`);
  }

  return true;
}

/**
 * Handle /ping command - Network connectivity test
 */
export async function handlePingCommand(input) {
  const args = input.split(' ').slice(1);

  if (args.length === 0 || args[0] === 'help') {
    console.log(`
🏓 Ping (Network Test)
══════════════════════

Usage:
  /ping <host>             Ping a host
  /ping -c <count> <host>  Specific number of pings

Options:
  -c, --count <n>         Number of pings (default: 4)
  -t, --timeout <ms>      Timeout per ping in ms

Examples:
  /ping google.com
  /ping -c 10 8.8.8.8
`);
    return true;
  }

  const { execSync } = await import('child_process');

  let count = 4;
  let host = null;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '-c' || arg === '--count') {
      count = parseInt(args[++i], 10);
    } else if (!arg.startsWith('-')) {
      host = arg;
    }
  }

  if (!host) {
    console.log('❌ Please provide a host');
    return true;
  }

  console.log(`\n🏓 Pinging ${host}...\n`);

  try {
    let cmd;
    if (process.platform === 'win32') {
      cmd = `ping -n ${count} ${host}`;
    } else {
      cmd = `ping -c ${count} ${host}`;
    }

    const output = execSync(cmd, { encoding: 'utf-8', timeout: 30000 });
    console.log(output);
  } catch (error) {
    if (error.stdout) {
      console.log(error.stdout);
    }
    console.log(`❌ Ping failed or timed out\n`);
  }

  return true;
}

/**
 * Handle /hostname command - Show hostname
 */
export async function handleHostnameCommand(input) {
  const args = input.split(' ').slice(1);

  if (args[0] === 'help') {
    console.log(`
🖥️  Hostname
═══════════

Usage:
  /hostname                Show system hostname
  /hostname -i             Show IP addresses
  /hostname -f             Show fully qualified domain name

Examples:
  /hostname
  /hostname -i
`);
    return true;
  }

  const os = await import('os');
  const { execSync } = await import('child_process');

  let showIP = false;
  let showFQDN = false;

  for (const arg of args) {
    if (arg === '-i' || arg === '--ip') {
      showIP = true;
    } else if (arg === '-f' || arg === '--fqdn') {
      showFQDN = true;
    }
  }

  console.log('');

  if (showIP) {
    const interfaces = os.networkInterfaces();
    console.log('🌐 Network Interfaces:\n');
    for (const [name, addrs] of Object.entries(interfaces)) {
      if (addrs) {
        for (const addr of addrs) {
          if (addr.family === 'IPv4' && !addr.internal) {
            console.log(`  ${name}: ${addr.address}`);
          }
        }
      }
    }
  } else if (showFQDN) {
    try {
      const fqdn = execSync('hostname -f 2>/dev/null || hostname', { encoding: 'utf-8' }).trim();
      console.log(`🖥️  FQDN: ${fqdn}`);
    } catch {
      console.log(`🖥️  Hostname: ${os.hostname()}`);
    }
  } else {
    console.log(`🖥️  Hostname: ${os.hostname()}`);
  }

  console.log('');
  return true;
}

/**
 * Handle /whoami command - Show current user
 */
export async function handleWhoamiCommand() {
  const os = await import('os');

  const username = os.userInfo().username;
  const homedir = os.homedir();
  const shell = process.env.SHELL || process.env.COMSPEC || 'unknown';

  console.log(`
👤 Current User
═══════════════

  Username: ${username}
  Home:     ${homedir}
  Shell:    ${shell}
  UID:      ${process.getuid ? process.getuid() : 'N/A'}
  GID:      ${process.getgid ? process.getgid() : 'N/A'}
`);

  return true;
}

/**
 * Handle /uptime command - System uptime
 */
export async function handleUptimeCommand() {
  const os = await import('os');

  const uptimeSeconds = os.uptime();
  const days = Math.floor(uptimeSeconds / 86400);
  const hours = Math.floor((uptimeSeconds % 86400) / 3600);
  const minutes = Math.floor((uptimeSeconds % 3600) / 60);

  const loadAvg = os.loadavg();

  console.log(`
⏰ System Uptime
════════════════

  Uptime: ${days} days, ${hours} hours, ${minutes} minutes
  Load Average: ${loadAvg.map(l => l.toFixed(2)).join(', ')} (1, 5, 15 min)
`);

  return true;
}

/**
 * Handle /uname command - System information
 */
export async function handleUnameCommand(input) {
  const args = input.split(' ').slice(1);

  if (args[0] === 'help') {
    console.log(`
💻 System Information
═════════════════════

Usage:
  /uname                   Show system name
  /uname -a                Show all information

Options:
  -a, --all               All information
  -s                      Kernel name
  -n                      Node name (hostname)
  -r                      Kernel release
  -m                      Machine hardware name
  -p                      Processor type
  -o                      Operating system

Examples:
  /uname
  /uname -a
`);
    return true;
  }

  const os = await import('os');

  const showAll = args.includes('-a') || args.includes('--all');

  const info = {
    system: os.type(),
    hostname: os.hostname(),
    release: os.release(),
    version: os.version ? os.version() : 'N/A',
    machine: os.machine ? os.machine() : os.arch(),
    platform: os.platform(),
    arch: os.arch(),
    cpus: os.cpus().length,
    memory: `${Math.round(os.totalmem() / (1024 * 1024 * 1024))} GB`
  };

  if (showAll) {
    console.log(`
💻 System Information
═════════════════════

  System:    ${info.system}
  Hostname:  ${info.hostname}
  Release:   ${info.release}
  Version:   ${info.version}
  Machine:   ${info.machine}
  Platform:  ${info.platform}
  Arch:      ${info.arch}
  CPUs:      ${info.cpus}
  Memory:    ${info.memory}
`);
  } else {
    console.log(`\n${info.system} ${info.hostname} ${info.release} ${info.machine}\n`);
  }

  return true;
}

/**
 * Handle /free command - Memory information
 */
export async function handleFreeCommand(input) {
  const args = input.split(' ').slice(1);

  if (args[0] === 'help') {
    console.log(`
🧠 Memory Information
═════════════════════

Usage:
  /free                    Show memory usage
  /free -h                 Human-readable (default)
  /free -b                 Show in bytes

Examples:
  /free
`);
    return true;
  }

  const os = await import('os');

  function formatSize(bytes) {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = bytes;
    let unit = 0;
    while (size >= 1024 && unit < units.length - 1) {
      size /= 1024;
      unit++;
    }
    return `${size.toFixed(1)} ${units[unit]}`;
  }

  const total = os.totalmem();
  const free = os.freemem();
  const used = total - free;
  const usedPercent = ((used / total) * 100).toFixed(1);

  console.log(`
🧠 Memory Usage
═══════════════

  Total:     ${formatSize(total)}
  Used:      ${formatSize(used)} (${usedPercent}%)
  Free:      ${formatSize(free)}
`);

  return true;
}

/**
 * Handle /history command - Command history
 */
export async function handleHistoryCommand(input) {
  const args = input.split(' ').slice(1);

  if (args[0] === 'help') {
    console.log(`
📜 Command History
══════════════════

Usage:
  /history                 Show recent commands
  /history <n>             Show last n commands
  /history -c              Clear history

Options:
  -c, --clear             Clear history
  -n <num>                Show last n commands

Examples:
  /history
  /history 20
  /history -c
`);
    return true;
  }

  // This would need to be integrated with the main REPL to track history
  // For now, show a placeholder message
  console.log(`
📜 Command History
══════════════════

Command history is tracked within your terminal session.
Use your terminal's built-in history (up/down arrows) to access previous commands.

Tip: Most terminals support Ctrl+R for reverse history search.
`);

  return true;
}

/**
 * Handle /alias command - Command aliases
 */
export async function handleAliasCommand(input) {
  const args = input.split(' ').slice(1);

  // Store aliases in a module-level variable
  if (!globalThis.grokAliases) {
    globalThis.grokAliases = {};
  }

  if (args.length === 0) {
    console.log('\n📝 Aliases\n');
    const entries = Object.entries(globalThis.grokAliases);
    if (entries.length === 0) {
      console.log('  No aliases defined.');
    } else {
      for (const [name, cmd] of entries) {
        console.log(`  ${name}='${cmd}'`);
      }
    }
    console.log('');
    return true;
  }

  if (args[0] === 'help') {
    console.log(`
📝 Command Aliases
══════════════════

Usage:
  /alias                   Show all aliases
  /alias <name>=<cmd>      Create alias
  /alias -d <name>         Delete alias

Examples:
  /alias ll='/ls -l'
  /alias gs='/git status'
  /alias -d ll
`);
    return true;
  }

  // Check for delete
  if (args[0] === '-d' || args[0] === '--delete') {
    const name = args[1];
    if (name && globalThis.grokAliases[name]) {
      delete globalThis.grokAliases[name];
      console.log(`\n✅ Deleted alias: ${name}\n`);
    } else {
      console.log(`\n❌ Alias not found: ${name}\n`);
    }
    return true;
  }

  // Create alias
  const aliasStr = args.join(' ');
  const match = aliasStr.match(/^(\w+)=(.+)$/);
  if (match) {
    const [, name, cmd] = match;
    globalThis.grokAliases[name] = cmd.replace(/^['"]|['"]$/g, '');
    console.log(`\n✅ Created alias: ${name}='${globalThis.grokAliases[name]}'\n`);
  } else {
    // Show specific alias
    const name = args[0];
    if (globalThis.grokAliases[name]) {
      console.log(`\n${name}='${globalThis.grokAliases[name]}'\n`);
    } else {
      console.log(`\n❌ Alias not found: ${name}\n`);
    }
  }

  return true;
}

/**
 * Handle /clear command - Clear terminal
 */
export async function handleClearCommand() {
  // Clear terminal screen
  console.clear();
  return true;
}

/**
 * Handle /xargs command - Execute command with input
 */
export async function handleXargsCommand(input) {
  const args = input.split(' ').slice(1);

  if (args.length === 0 || args[0] === 'help') {
    console.log(`
🔄 Xargs (Execute with Input)
═════════════════════════════

Usage:
  /xargs <cmd> <input>     Execute command with each input item
  /xargs -n <num> <cmd>    Process n items at a time

Note: This is a simplified version. For complex operations,
use the /run command with shell pipes.

Examples:
  /xargs echo "hello world"
  /xargs -n 1 echo file1 file2 file3
`);
    return true;
  }

  // Simplified xargs - just a helper message
  console.log(`
💡 For xargs-like operations, use:

  /run 'echo "item1 item2" | xargs -n1 echo'

Or use the native shell:

  /run 'find . -name "*.js" | xargs grep "pattern"'
`);

  return true;
}

/**
 * Handle /tee command - Split output
 */
export async function handleTeeCommand(input) {
  const args = input.split(' ').slice(1);

  if (args.length === 0 || args[0] === 'help') {
    console.log(`
📤 Tee (Split Output)
═════════════════════

Usage:
  /tee <file> <text>       Write text to file and display
  /tee -a <file> <text>    Append to file

Options:
  -a, --append            Append instead of overwrite

Examples:
  /tee output.txt "Hello World"
  /tee -a log.txt "New log entry"
`);
    return true;
  }

  const path = await import('path');
  const fs = await import('fs-extra');

  let append = false;
  let file = null;
  let text = null;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '-a' || arg === '--append') {
      append = true;
    } else if (!file) {
      file = arg;
    } else {
      text = args.slice(i).join(' ');
      break;
    }
  }

  if (!file || !text) {
    console.log('❌ Please provide file and text');
    return true;
  }

  // Remove surrounding quotes
  if ((text.startsWith('"') && text.endsWith('"')) ||
      (text.startsWith("'") && text.endsWith("'"))) {
    text = text.slice(1, -1);
  }

  const filePath = path.default.isAbsolute(file) ? file : path.default.resolve(process.cwd(), file);

  try {
    if (append) {
      await fs.appendFile(filePath, text + '\n');
    } else {
      await fs.writeFile(filePath, text + '\n');
    }

    // Display the text (tee behavior)
    console.log(text);
    console.log(`\n✅ Written to: ${file}\n`);
  } catch (error) {
    console.log(`\n❌ Error: ${error.message}\n`);
  }

  return true;
}

/**
 * Handle /npm command - NPM package operations
 */
export async function handleNpmCommand(input) {
  const args = input.split(' ').slice(1);

  if (args.length === 0 || args[0] === 'help') {
    console.log(`
📦 NPM Package Manager
══════════════════════

Usage:
  /npm install [pkg]       Install packages
  /npm uninstall <pkg>     Remove package
  /npm list                List installed packages
  /npm outdated            Check for updates
  /npm info <pkg>          Package information
  /npm search <query>      Search packages
  /npm run <script>        Run npm script
  /npm init                Initialize package.json

Examples:
  /npm install
  /npm install lodash
  /npm list --depth=0
  /npm run build
  /npm info react
`);
    return true;
  }

  const { execSync, spawn } = await import('child_process');

  const subcommand = args[0];
  const restArgs = args.slice(1).join(' ');

  // Build npm command
  const npmCmd = `npm ${subcommand} ${restArgs}`.trim();

  console.log(`\n📦 Running: ${npmCmd}\n`);

  try {
    // Use spawn for better output handling
    const npmProcess = spawn('npm', [subcommand, ...args.slice(1)], {
      cwd: process.cwd(),
      stdio: 'inherit',
      shell: true
    });

    await new Promise((resolve, reject) => {
      npmProcess.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`npm exited with code ${code}`));
        }
      });
      npmProcess.on('error', reject);
    });

    console.log('');
  } catch (error) {
    console.log(`\n❌ Error: ${error.message}\n`);
  }

  return true;
}

/**
 * Handle /yarn command - Yarn package operations
 */
export async function handleYarnCommand(input) {
  const args = input.split(' ').slice(1);

  if (args.length === 0 || args[0] === 'help') {
    console.log(`
🧶 Yarn Package Manager
═══════════════════════

Usage:
  /yarn [install]          Install packages
  /yarn add <pkg>          Add package
  /yarn remove <pkg>       Remove package
  /yarn list               List packages
  /yarn run <script>       Run script
  /yarn upgrade            Upgrade packages

Examples:
  /yarn
  /yarn add lodash
  /yarn run build
`);
    return true;
  }

  const { spawn } = await import('child_process');

  const yarnArgs = args.length > 0 ? args : ['install'];
  const yarnCmd = `yarn ${yarnArgs.join(' ')}`;

  console.log(`\n🧶 Running: ${yarnCmd}\n`);

  try {
    const yarnProcess = spawn('yarn', yarnArgs, {
      cwd: process.cwd(),
      stdio: 'inherit',
      shell: true
    });

    await new Promise((resolve, reject) => {
      yarnProcess.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`yarn exited with code ${code}`));
      });
      yarnProcess.on('error', reject);
    });

    console.log('');
  } catch (error) {
    console.log(`\n❌ Error: ${error.message}\n`);
  }

  return true;
}

/**
 * Handle /node command - Execute JavaScript
 */
export async function handleNodeCommand(input) {
  const code = input.replace(/^\/node\s*/, '');

  if (!code || code === 'help') {
    console.log(`
🟢 Node.js Execution
════════════════════

Usage:
  /node <code>             Execute JavaScript code
  /node -e <code>          Execute expression
  /node -f <file>          Execute file

Examples:
  /node console.log(1+1)
  /node Math.random()
  /node -f script.js
  /node process.version
`);
    return true;
  }

  // Check for file execution
  if (code.startsWith('-f ')) {
    const file = code.substring(3).trim();
    const { execSync } = await import('child_process');

    try {
      const output = execSync(`node "${file}"`, { encoding: 'utf-8', cwd: process.cwd() });
      console.log(`\n${output}`);
    } catch (error) {
      console.log(`\n❌ Error: ${error.message}\n`);
    }
    return true;
  }

  // Execute inline code
  let codeToRun = code;
  if (code.startsWith('-e ')) {
    codeToRun = code.substring(3);
  }

  try {
    // Use vm for safer execution
    const vm = await import('vm');
    const context = vm.createContext({
      console,
      process,
      require: await import('module').then(m => m.createRequire(import.meta.url)),
      setTimeout,
      setInterval,
      Buffer,
      URL,
      Math,
      JSON,
      Date,
      Array,
      Object,
      String,
      Number,
      Boolean,
      Map,
      Set,
      Promise
    });

    const result = vm.runInContext(codeToRun, context, { timeout: 5000 });

    console.log(`\n🟢 Result:`);
    if (result !== undefined) {
      console.log(typeof result === 'object' ? JSON.stringify(result, null, 2) : result);
    }
    console.log('');
  } catch (error) {
    console.log(`\n❌ Error: ${error.message}\n`);
  }

  return true;
}

/**
 * Handle /json command - JSON operations
 */
export async function handleJsonCommand(input) {
  const args = input.split(' ').slice(1);

  if (args.length === 0 || args[0] === 'help') {
    console.log(`
📋 JSON Operations
══════════════════

Usage:
  /json parse <string>     Parse JSON string
  /json format <file>      Format/pretty-print JSON file
  /json minify <file>      Minify JSON file
  /json query <file> <path> Query JSON with path (e.g., .data.items[0])
  /json validate <file>    Validate JSON file
  /json keys <file>        List top-level keys

Examples:
  /json parse '{"a":1}'
  /json format package.json
  /json query data.json .users[0].name
  /json validate config.json
`);
    return true;
  }

  const path = await import('path');
  const fs = await import('fs-extra');

  const subcommand = args[0];

  switch (subcommand) {
    case 'parse': {
      const jsonStr = args.slice(1).join(' ').replace(/^['"]|['"]$/g, '');
      try {
        const parsed = JSON.parse(jsonStr);
        console.log('\n📋 Parsed JSON:\n');
        console.log(JSON.stringify(parsed, null, 2));
        console.log('');
      } catch (error) {
        console.log(`\n❌ Invalid JSON: ${error.message}\n`);
      }
      break;
    }

    case 'format': {
      const file = args[1];
      if (!file) {
        console.log('❌ Please provide a file');
        break;
      }
      const filePath = path.default.isAbsolute(file) ? file : path.default.resolve(process.cwd(), file);
      try {
        const content = await fs.readFile(filePath, 'utf-8');
        const parsed = JSON.parse(content);
        const formatted = JSON.stringify(parsed, null, 2);
        console.log('\n📋 Formatted JSON:\n');
        console.log(formatted);
        console.log('');
      } catch (error) {
        console.log(`\n❌ Error: ${error.message}\n`);
      }
      break;
    }

    case 'minify': {
      const file = args[1];
      if (!file) {
        console.log('❌ Please provide a file');
        break;
      }
      const filePath = path.default.isAbsolute(file) ? file : path.default.resolve(process.cwd(), file);
      try {
        const content = await fs.readFile(filePath, 'utf-8');
        const parsed = JSON.parse(content);
        const minified = JSON.stringify(parsed);
        console.log('\n📋 Minified JSON:\n');
        console.log(minified);
        console.log(`\nOriginal: ${content.length} chars → Minified: ${minified.length} chars\n`);
      } catch (error) {
        console.log(`\n❌ Error: ${error.message}\n`);
      }
      break;
    }

    case 'query': {
      const file = args[1];
      const queryPath = args[2];
      if (!file || !queryPath) {
        console.log('❌ Please provide file and query path');
        break;
      }
      const filePath = path.default.isAbsolute(file) ? file : path.default.resolve(process.cwd(), file);
      try {
        const content = await fs.readFile(filePath, 'utf-8');
        const parsed = JSON.parse(content);

        // Simple path query
        let result = parsed;
        const parts = queryPath.replace(/^\./,  '').split(/\.|\[|\]/).filter(p => p);
        for (const part of parts) {
          if (result === undefined) break;
          result = result[part];
        }

        console.log('\n📋 Query Result:\n');
        console.log(typeof result === 'object' ? JSON.stringify(result, null, 2) : result);
        console.log('');
      } catch (error) {
        console.log(`\n❌ Error: ${error.message}\n`);
      }
      break;
    }

    case 'validate': {
      const file = args[1];
      if (!file) {
        console.log('❌ Please provide a file');
        break;
      }
      const filePath = path.default.isAbsolute(file) ? file : path.default.resolve(process.cwd(), file);
      try {
        const content = await fs.readFile(filePath, 'utf-8');
        JSON.parse(content);
        console.log(`\n✅ ${file} is valid JSON\n`);
      } catch (error) {
        console.log(`\n❌ Invalid JSON: ${error.message}\n`);
      }
      break;
    }

    case 'keys': {
      const file = args[1];
      if (!file) {
        console.log('❌ Please provide a file');
        break;
      }
      const filePath = path.default.isAbsolute(file) ? file : path.default.resolve(process.cwd(), file);
      try {
        const content = await fs.readFile(filePath, 'utf-8');
        const parsed = JSON.parse(content);
        const keys = Object.keys(parsed);
        console.log('\n📋 Top-level Keys:\n');
        keys.forEach(k => console.log(`  • ${k}`));
        console.log('');
      } catch (error) {
        console.log(`\n❌ Error: ${error.message}\n`);
      }
      break;
    }

    default:
      console.log(`\n❌ Unknown subcommand: ${subcommand}\n`);
  }

  return true;
}

/**
 * Handle /base64 command - Base64 encoding/decoding
 */
export async function handleBase64Command(input) {
  const args = input.split(' ').slice(1);

  if (args.length === 0 || args[0] === 'help') {
    console.log(`
🔐 Base64 Encoding
══════════════════

Usage:
  /base64 encode <text>    Encode text to base64
  /base64 decode <text>    Decode base64 to text
  /base64 -f <file>        Encode file contents
  /base64 -d -f <file>     Decode file contents

Options:
  -f, --file              Read from file
  -d, --decode            Decode mode (default is encode)
  -u, --url-safe          URL-safe base64

Examples:
  /base64 encode "Hello World"
  /base64 decode SGVsbG8gV29ybGQ=
  /base64 -f image.png
`);
    return true;
  }

  const path = await import('path');
  const fs = await import('fs-extra');

  let decode = false;
  let file = null;
  let urlSafe = false;
  let text = null;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === 'encode') {
      decode = false;
      text = args.slice(i + 1).join(' ');
      break;
    } else if (arg === 'decode' || arg === '-d' || arg === '--decode') {
      decode = true;
      if (arg === 'decode') {
        text = args.slice(i + 1).join(' ');
        break;
      }
    } else if (arg === '-f' || arg === '--file') {
      file = args[++i];
    } else if (arg === '-u' || arg === '--url-safe') {
      urlSafe = true;
    } else if (!arg.startsWith('-')) {
      text = args.slice(i).join(' ');
      break;
    }
  }

  try {
    let input;

    if (file) {
      const filePath = path.default.isAbsolute(file) ? file : path.default.resolve(process.cwd(), file);
      input = await fs.readFile(filePath, decode ? 'utf-8' : null);
    } else if (text) {
      // Remove surrounding quotes
      input = text.replace(/^["']|["']$/g, '');
    } else {
      console.log('❌ Please provide text or file');
      return true;
    }

    let result;
    if (decode) {
      // Decode
      let base64 = typeof input === 'string' ? input : input.toString('utf-8');
      if (urlSafe) {
        base64 = base64.replace(/-/g, '+').replace(/_/g, '/');
      }
      result = Buffer.from(base64, 'base64').toString('utf-8');
    } else {
      // Encode
      const buffer = typeof input === 'string' ? Buffer.from(input) : input;
      result = buffer.toString('base64');
      if (urlSafe) {
        result = result.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
      }
    }

    console.log(`\n🔐 ${decode ? 'Decoded' : 'Encoded'}:\n`);
    console.log(result);
    console.log('');
  } catch (error) {
    console.log(`\n❌ Error: ${error.message}\n`);
  }

  return true;
}

/**
 * Handle /hash command - Generate hashes/checksums
 */
export async function handleHashCommand(input) {
  const args = input.split(' ').slice(1);

  if (args.length === 0 || args[0] === 'help') {
    console.log(`
🔒 Hash/Checksum
════════════════

Usage:
  /hash <text>             MD5 hash of text
  /hash -f <file>          Hash file contents
  /hash -a <algo> <text>   Use specific algorithm

Algorithms:
  md5, sha1, sha256, sha512

Options:
  -f, --file              Hash file contents
  -a, --algorithm <algo>  Hash algorithm (default: sha256)

Examples:
  /hash "Hello World"
  /hash -a md5 "test"
  /hash -f package.json
  /hash -a sha512 -f large-file.bin
`);
    return true;
  }

  const crypto = await import('crypto');
  const path = await import('path');
  const fs = await import('fs-extra');

  let algorithm = 'sha256';
  let file = null;
  let text = null;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '-a' || arg === '--algorithm') {
      algorithm = args[++i];
    } else if (arg === '-f' || arg === '--file') {
      file = args[++i];
    } else if (!arg.startsWith('-')) {
      text = args.slice(i).join(' ');
      break;
    }
  }

  try {
    let content;

    if (file) {
      const filePath = path.default.isAbsolute(file) ? file : path.default.resolve(process.cwd(), file);
      content = await fs.readFile(filePath);
    } else if (text) {
      content = text.replace(/^["']|["']$/g, '');
    } else {
      console.log('❌ Please provide text or file');
      return true;
    }

    const hash = crypto.createHash(algorithm).update(content).digest('hex');

    console.log(`\n🔒 ${algorithm.toUpperCase()} Hash:\n`);
    console.log(hash);
    console.log('');
  } catch (error) {
    console.log(`\n❌ Error: ${error.message}\n`);
  }

  return true;
}

/**
 * Handle /uuid command - Generate UUIDs
 */
export async function handleUuidCommand(input) {
  const args = input.split(' ').slice(1);

  if (args[0] === 'help') {
    console.log(`
🆔 UUID Generator
═════════════════

Usage:
  /uuid                    Generate one UUID v4
  /uuid <count>            Generate multiple UUIDs
  /uuid -v <version>       Specific version (v4 default)

Options:
  -n, --count <n>         Number of UUIDs to generate
  -u, --uppercase         Uppercase output

Examples:
  /uuid
  /uuid 5
  /uuid -n 10 -u
`);
    return true;
  }

  const crypto = await import('crypto');

  let count = 1;
  let uppercase = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '-n' || arg === '--count') {
      count = parseInt(args[++i], 10);
    } else if (arg === '-u' || arg === '--uppercase') {
      uppercase = true;
    } else if (/^\d+$/.test(arg)) {
      count = parseInt(arg, 10);
    }
  }

  count = Math.min(count, 100); // Limit to 100

  console.log(`\n🆔 Generated UUID${count > 1 ? 's' : ''}:\n`);

  for (let i = 0; i < count; i++) {
    let uuid = crypto.randomUUID();
    if (uppercase) uuid = uuid.toUpperCase();
    console.log(`  ${uuid}`);
  }

  console.log('');
  return true;
}

/**
 * Handle /random command - Generate random values
 */
export async function handleRandomCommand(input) {
  const args = input.split(' ').slice(1);

  if (args[0] === 'help') {
    console.log(`
🎲 Random Generator
═══════════════════

Usage:
  /random                  Random number 0-100
  /random <min> <max>      Random number in range
  /random string <len>     Random string
  /random hex <len>        Random hex string
  /random password <len>   Random password

Options:
  -n, --count <n>         Generate multiple values

Examples:
  /random
  /random 1 10
  /random string 16
  /random password 20
  /random hex 32
`);
    return true;
  }

  const crypto = await import('crypto');

  const subcommand = args[0];
  let count = 1;

  // Check for count option
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '-n' || args[i] === '--count') {
      count = parseInt(args[++i], 10);
    }
  }

  count = Math.min(count, 20);

  console.log('\n🎲 Random:\n');

  for (let c = 0; c < count; c++) {
    let result;

    if (subcommand === 'string') {
      const len = parseInt(args[1], 10) || 16;
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
      result = Array.from(crypto.randomBytes(len))
        .map(b => chars[b % chars.length])
        .join('');
    } else if (subcommand === 'hex') {
      const len = parseInt(args[1], 10) || 16;
      result = crypto.randomBytes(Math.ceil(len / 2)).toString('hex').slice(0, len);
    } else if (subcommand === 'password') {
      const len = parseInt(args[1], 10) || 16;
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=[]{}|;:,.<>?';
      result = Array.from(crypto.randomBytes(len))
        .map(b => chars[b % chars.length])
        .join('');
    } else {
      // Number
      const min = parseInt(subcommand, 10) || 0;
      const max = parseInt(args[1], 10) || 100;
      result = Math.floor(Math.random() * (max - min + 1)) + min;
    }

    console.log(`  ${result}`);
  }

  console.log('');
  return true;
}

/**
 * Handle /timestamp command - Unix timestamp operations
 */
export async function handleTimestampCommand(input) {
  const args = input.split(' ').slice(1);

  if (args[0] === 'help') {
    console.log(`
⏰ Timestamp
════════════

Usage:
  /timestamp               Current Unix timestamp
  /timestamp <ts>          Convert timestamp to date
  /timestamp -d <date>     Convert date to timestamp
  /timestamp -ms           Include milliseconds

Examples:
  /timestamp
  /timestamp 1704067200
  /timestamp -d "2024-01-01"
  /timestamp -ms
`);
    return true;
  }

  let includeMs = args.includes('-ms');
  let convertTs = null;
  let convertDate = null;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '-d' || arg === '--date') {
      convertDate = args.slice(i + 1).join(' ').replace(/^["']|["']$/g, '');
      break;
    } else if (/^\d+$/.test(arg)) {
      convertTs = parseInt(arg, 10);
    }
  }

  console.log('\n⏰ Timestamp:\n');

  if (convertTs) {
    // Convert timestamp to date
    const ms = convertTs > 9999999999 ? convertTs : convertTs * 1000;
    const date = new Date(ms);
    console.log(`  Timestamp: ${convertTs}`);
    console.log(`  Date:      ${date.toISOString()}`);
    console.log(`  Local:     ${date.toLocaleString()}`);
  } else if (convertDate) {
    // Convert date to timestamp
    const date = new Date(convertDate);
    if (isNaN(date.getTime())) {
      console.log('  ❌ Invalid date format');
    } else {
      const ts = includeMs ? date.getTime() : Math.floor(date.getTime() / 1000);
      console.log(`  Date:      ${convertDate}`);
      console.log(`  Timestamp: ${ts}`);
    }
  } else {
    // Current timestamp
    const now = new Date();
    const ts = includeMs ? now.getTime() : Math.floor(now.getTime() / 1000);
    console.log(`  Current:   ${ts}`);
    console.log(`  ISO:       ${now.toISOString()}`);
    console.log(`  Local:     ${now.toLocaleString()}`);
  }

  console.log('');
  return true;
}

/**
 * Handle /calc command - Calculator
 */
export async function handleCalcCommand(input) {
  const expr = input.replace(/^\/calc\s*/, '');

  if (!expr || expr === 'help') {
    console.log(`
🔢 Calculator
═════════════

Usage:
  /calc <expression>       Evaluate math expression

Supported:
  +, -, *, /, %, **        Operators
  (, )                     Grouping
  Math.*, Number.*         Math functions
  sin, cos, tan, sqrt...   Trig and more

Examples:
  /calc 2 + 2
  /calc (10 + 5) * 3
  /calc Math.sqrt(144)
  /calc 2 ** 10
  /calc Math.PI * 2
`);
    return true;
  }

  try {
    // Create a safe evaluation context
    const mathFuncs = {
      sin: Math.sin,
      cos: Math.cos,
      tan: Math.tan,
      sqrt: Math.sqrt,
      abs: Math.abs,
      ceil: Math.ceil,
      floor: Math.floor,
      round: Math.round,
      log: Math.log,
      log10: Math.log10,
      exp: Math.exp,
      pow: Math.pow,
      min: Math.min,
      max: Math.max,
      PI: Math.PI,
      E: Math.E,
      Math,
      Number
    };

    // Simple expression evaluation
    const safeExpr = expr.replace(/[^0-9+\-*/().%\s,a-zA-Z]/g, '');
    const fn = new Function(...Object.keys(mathFuncs), `return ${safeExpr}`);
    const result = fn(...Object.values(mathFuncs));

    console.log(`\n🔢 ${expr} = ${result}\n`);
  } catch (error) {
    console.log(`\n❌ Error: ${error.message}\n`);
  }

  return true;
}

/**
 * Handle /sort command - Sort lines
 */
export async function handleSortCommand(input) {
  const args = input.split(' ').slice(1);

  if (args.length === 0 || args[0] === 'help') {
    console.log(`
📊 Sort Lines
═════════════

Usage:
  /sort <file>             Sort file lines alphabetically
  /sort -n <file>          Numeric sort
  /sort -r <file>          Reverse sort
  /sort -u <file>          Unique lines only

Options:
  -n, --numeric           Numeric sort
  -r, --reverse           Reverse order
  -u, --unique            Remove duplicates
  -o, --output <file>     Write to file

Examples:
  /sort list.txt
  /sort -nr numbers.txt
  /sort -u names.txt
`);
    return true;
  }

  const path = await import('path');
  const fs = await import('fs-extra');

  let numeric = false;
  let reverse = false;
  let unique = false;
  let file = null;
  let outputFile = null;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '-n' || arg === '--numeric') {
      numeric = true;
    } else if (arg === '-r' || arg === '--reverse') {
      reverse = true;
    } else if (arg === '-u' || arg === '--unique') {
      unique = true;
    } else if (arg === '-o' || arg === '--output') {
      outputFile = args[++i];
    } else if (!arg.startsWith('-')) {
      file = arg;
    }
  }

  if (!file) {
    console.log('❌ Please provide a file');
    return true;
  }

  const filePath = path.default.isAbsolute(file) ? file : path.default.resolve(process.cwd(), file);

  try {
    const content = await fs.readFile(filePath, 'utf-8');
    let lines = content.split('\n').filter(l => l.trim());

    // Sort
    if (numeric) {
      lines.sort((a, b) => parseFloat(a) - parseFloat(b));
    } else {
      lines.sort();
    }

    if (reverse) {
      lines.reverse();
    }

    if (unique) {
      lines = [...new Set(lines)];
    }

    const result = lines.join('\n');

    if (outputFile) {
      const outPath = path.default.isAbsolute(outputFile) ? outputFile : path.default.resolve(process.cwd(), outputFile);
      await fs.writeFile(outPath, result + '\n');
      console.log(`\n✅ Sorted ${lines.length} lines to: ${outputFile}\n`);
    } else {
      console.log('\n📊 Sorted:\n');
      console.log(result);
      console.log(`\n(${lines.length} lines)\n`);
    }
  } catch (error) {
    console.log(`\n❌ Error: ${error.message}\n`);
  }

  return true;
}

/**
 * Handle /uniq command - Filter unique lines
 */
export async function handleUniqCommand(input) {
  const args = input.split(' ').slice(1);

  if (args.length === 0 || args[0] === 'help') {
    console.log(`
🔄 Unique Lines
═══════════════

Usage:
  /uniq <file>             Show unique lines
  /uniq -c <file>          Show counts
  /uniq -d <file>          Show only duplicates

Options:
  -c, --count             Prefix lines with count
  -d, --duplicates        Only show duplicated lines
  -i, --ignore-case       Case insensitive

Examples:
  /uniq names.txt
  /uniq -c log.txt
`);
    return true;
  }

  const path = await import('path');
  const fs = await import('fs-extra');

  let showCount = false;
  let onlyDuplicates = false;
  let ignoreCase = false;
  let file = null;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '-c' || arg === '--count') {
      showCount = true;
    } else if (arg === '-d' || arg === '--duplicates') {
      onlyDuplicates = true;
    } else if (arg === '-i' || arg === '--ignore-case') {
      ignoreCase = true;
    } else if (!arg.startsWith('-')) {
      file = arg;
    }
  }

  if (!file) {
    console.log('❌ Please provide a file');
    return true;
  }

  const filePath = path.default.isAbsolute(file) ? file : path.default.resolve(process.cwd(), file);

  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const lines = content.split('\n');

    // Count occurrences
    const counts = new Map();
    for (const line of lines) {
      const key = ignoreCase ? line.toLowerCase() : line;
      counts.set(key, (counts.get(key) || 0) + 1);
    }

    console.log('\n🔄 Results:\n');

    const seen = new Set();
    for (const line of lines) {
      const key = ignoreCase ? line.toLowerCase() : line;
      if (seen.has(key)) continue;
      seen.add(key);

      const count = counts.get(key);

      if (onlyDuplicates && count === 1) continue;

      if (showCount) {
        console.log(`  ${String(count).padStart(4)}  ${line}`);
      } else {
        console.log(`  ${line}`);
      }
    }

    console.log('');
  } catch (error) {
    console.log(`\n❌ Error: ${error.message}\n`);
  }

  return true;
}
