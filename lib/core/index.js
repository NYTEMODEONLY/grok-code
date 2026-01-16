/**
 * Grok Core Module
 * Central integration point for Claude Code-compatible features
 */

export { GrokCore, getGrokCore, resetGrokCore } from './grok-core.js';
export { AgenticHandler, PermissionManager } from './agentic-handler.js';
export { BackupManager, ActionHistory } from './backup-manager.js';
export { ProjectInstructionsLoader, getProjectInstructionsLoader } from './project-instructions.js';
export { Doctor, handleDoctorCommand } from './doctor.js';
