/**
 * Settings Schema
 * Defines the schema for Grok Code configuration
 */

export const SettingsSchema = {
  /**
   * Get default settings
   * @returns {Object} Default settings
   */
  getDefaults() {
    return {
      // Model configuration
      model: 'grok-code-fast-1',
      maxTokens: 4096,
      temperature: 0.7,

      // Display options
      theme: 'default',
      syntaxHighlighting: true,
      showLineNumbers: true,
      showProgress: true,

      // Behavior
      autoContextEnabled: true,
      autoPruneEnabled: true,
      autoSaveEnabled: true,
      safeMode: true,
      backupEnabled: true,

      // Permissions
      permissions: {
        allowBash: true,
        allowFileEdit: true,
        allowFileWrite: true,
        confirmBash: true,
        confirmFileEdit: true,
        confirmFileWrite: true,
        deny: [],
        allow: []
      },

      // Context limits
      contextLimits: {
        maxFiles: 50,
        maxTokensPerFile: 10000,
        maxTotalTokens: 100000,
        essentialsBudget: 0.3,
        conversationBudget: 0.5,
        flexBudget: 0.2
      },

      // Session options
      session: {
        autoSaveInterval: 30000,
        maxSessionAge: 2592000000, // 30 days
        maxCheckpoints: 10
      },

      // Hooks
      hooks: {},

      // Custom commands directory
      commandsDir: '.grok/commands',

      // Agents directory
      agentsDir: '.grok/agents',

      // Plugins directory
      pluginsDir: '.grok/plugins',

      // Logging
      logging: {
        level: 'info',
        file: '.grok/error.log',
        maxSize: 1048576 // 1MB
      }
    };
  },

  /**
   * Validate settings object
   * @param {Object} settings - Settings to validate
   * @returns {Object} Validation result
   */
  validate(settings) {
    const errors = [];
    const warnings = [];

    // Validate model
    const validModels = [
      'grok-code-fast-1',
      'grok-4-fast-reasoning',
      'grok-4-fast-non-reasoning',
      'grok-3-beta',
      'grok-3-mini-beta',
      'grok-beta'
    ];

    if (settings.model && !validModels.includes(settings.model)) {
      warnings.push(`Unknown model: ${settings.model}. Valid models: ${validModels.join(', ')}`);
    }

    // Validate temperature
    if (settings.temperature !== undefined) {
      if (typeof settings.temperature !== 'number' || settings.temperature < 0 || settings.temperature > 2) {
        errors.push('temperature must be a number between 0 and 2');
      }
    }

    // Validate maxTokens
    if (settings.maxTokens !== undefined) {
      if (typeof settings.maxTokens !== 'number' || settings.maxTokens < 1) {
        errors.push('maxTokens must be a positive number');
      }
    }

    // Validate theme
    const validThemes = ['default', 'dark', 'light', 'minimal'];
    if (settings.theme && !validThemes.includes(settings.theme)) {
      warnings.push(`Unknown theme: ${settings.theme}. Valid themes: ${validThemes.join(', ')}`);
    }

    // Validate permissions
    if (settings.permissions) {
      const p = settings.permissions;

      if (p.deny && !Array.isArray(p.deny)) {
        errors.push('permissions.deny must be an array');
      }

      if (p.allow && !Array.isArray(p.allow)) {
        errors.push('permissions.allow must be an array');
      }
    }

    // Validate hooks
    if (settings.hooks) {
      const validEvents = [
        'PreToolUse', 'PostToolUse', 'PermissionRequest',
        'UserPromptSubmit', 'Stop', 'SubagentStop',
        'Notification', 'SessionStart', 'SessionEnd', 'PreCompact'
      ];

      for (const event of Object.keys(settings.hooks)) {
        if (!validEvents.includes(event)) {
          warnings.push(`Unknown hook event: ${event}`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  },

  /**
   * Get documentation for settings
   * @returns {string} Documentation
   */
  getDocumentation() {
    return `# Grok Code Settings

## Model Configuration

- **model**: AI model to use
  - \`grok-code-fast-1\` (default): Optimized for coding tasks
  - \`grok-4-fast-reasoning\`: Best for complex reasoning
  - \`grok-4-fast-non-reasoning\`: Fast for simple tasks
  - \`grok-3-beta\`: Balanced performance
  - \`grok-3-mini-beta\`: Faster, lower cost

- **maxTokens**: Maximum tokens per response (default: 4096)
- **temperature**: Response randomness 0-2 (default: 0.7)

## Display Options

- **theme**: Color theme (default, dark, light, minimal)
- **syntaxHighlighting**: Enable code highlighting (default: true)
- **showLineNumbers**: Show line numbers in code (default: true)
- **showProgress**: Show progress indicators (default: true)

## Behavior

- **autoContextEnabled**: Automatically add relevant files (default: true)
- **autoPruneEnabled**: Automatically prune context (default: true)
- **autoSaveEnabled**: Auto-save sessions (default: true)
- **safeMode**: Require confirmations (default: true)
- **backupEnabled**: Create backups before edits (default: true)

## Permissions

\`\`\`json
{
  "permissions": {
    "allowBash": true,
    "allowFileEdit": true,
    "allowFileWrite": true,
    "confirmBash": true,
    "confirmFileEdit": true,
    "confirmFileWrite": true,
    "deny": ["Tool(Dangerous)"],
    "allow": ["Bash(git:*)"]
  }
}
\`\`\`

## Context Limits

- **maxFiles**: Maximum files in context (default: 50)
- **maxTokensPerFile**: Max tokens per file (default: 10000)
- **maxTotalTokens**: Total context limit (default: 100000)

## Hooks

\`\`\`json
{
  "hooks": {
    "PreToolUse": [{
      "matcher": "Bash",
      "hooks": [{
        "type": "command",
        "command": "./validate.sh"
      }]
    }]
  }
}
\`\`\`

## Session Options

- **autoSaveInterval**: Auto-save interval in ms (default: 30000)
- **maxSessionAge**: Max session age in ms (default: 30 days)
- **maxCheckpoints**: Max checkpoints per session (default: 10)

## File Locations

Configuration files are loaded in this order (later overrides earlier):
1. Defaults
2. ~/.grok/settings.json (global)
3. .grok/settings.json (project)
4. .grok/settings.local.json (local, not committed)
5. Environment variables
`;
  }
};
