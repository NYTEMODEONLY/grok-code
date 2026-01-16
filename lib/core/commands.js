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
📝 Session:   ${status.session.active ? 'Active' : 'None'} ${status.session.id ? `(${status.session.id.substring(0, 8)}...)` : ''}

Core Systems: ✅ Initialized
`);
  return true;
}
