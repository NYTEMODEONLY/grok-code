# Grok Code Project Configuration

## Project Overview

This is the official Grok Code repository - an AI-powered CLI coding assistant with RPG planning capabilities.

## Development Standards

### Code Style

- **Language**: JavaScript/Node.js (ES Modules)
- **Style Guide**: Airbnb ESLint preset
- **Formatting**: Prettier with 2-space indentation
- **Naming**: camelCase for variables/functions, PascalCase for classes

### Architecture

- **Structure**: Minimal CLI tool with modular components
- **Dependencies**: Focused on essential functionality
- **Documentation**: Inline comments and README
- **Memory System**: Persistent conversations and action history

### Git Workflow

- **Branching**: Feature branches from main
- **Commits**: Conventional commits (feat:, fix:, docs:, etc.)
- **PRs**: Require review and passing CI
- **Releases**: Semantic versioning

## Build & Deploy

- **Build**: `npm run build`
- **Test**: `npm test`
- **Lint**: `npm run lint`
- **Deploy**: Manual release to npm registry

## AI Assistant Guidelines

- **RPG Planning**: Use for complex multi-file projects
- **Context**: Add relevant files before complex tasks
- **Commands**: Define custom commands in `.grok/commands/`
- **Error Handling**: Paste errors back for AI analysis

## Security

- **API Keys**: Never commit to repository
- **Dependencies**: Audit regularly with `npm audit`
- **Code Review**: Required for all changes

---

_This configuration is automatically loaded by Grok Code when working in this repository._
