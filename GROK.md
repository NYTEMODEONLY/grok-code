# 🚀 Grok Code Project Configuration

## Project Overview

**Grok Code** is a revolutionary AI-powered CLI coding assistant that transforms terminals into intelligent coding environments. Features include:

- **Phase 1**: Enhanced Multi-File Intelligence (Semantic parsing, dependency graphs, context inference)
- **Phase 2**: Advanced Error Recovery System (Automated fixing, AI-powered corrections, safe rollback)
- **Phase 3**: IDE-like Terminal Experience (Coming soon)
- **Phase 4**: Project Context Awareness (Coming soon)

## 🧠 Intelligence Features

### Semantic Code Analysis
- AST-based parsing for JavaScript, TypeScript, Python
- Dependency graph generation and circular dependency detection
- Symbol extraction and cross-file relationship mapping

### Context Management
- Intelligent file relevance scoring
- Context window optimization with budgeting (15% essentials, 70% conversation, 15% buffer)
- Session-aware context that learns from interaction patterns

### Error Recovery System
- Automated parsing of ESLint, TypeScript, Prettier errors
- 20+ fix templates for common errors with confidence scoring
- AI-powered complex error resolution with Grok integration
- Safe fix application with automatic rollback capability

### Learning & Intelligence Systems
- Error pattern analysis across sessions and projects
- Personalized fix recommendations based on user history
- Proactive prevention suggestions and configuration guidance
- Continuous learning from fix outcomes and user feedback

## Development Standards

### Code Architecture

- **Language**: JavaScript/Node.js (ES Modules)
- **Structure**: Modular component architecture in `/lib/`
- **Entry Point**: `bin/grok.js` CLI interface
- **Configuration**: Environment variables and `.grok/` directory
- **Memory System**: Persistent conversations with action undo/redo

### Code Quality

- **Linting**: ESLint with Airbnb preset + Prettier
- **Testing**: Unit tests for all components, integration tests for workflows
- **Documentation**: Inline JSDoc comments, comprehensive README
- **Error Handling**: Comprehensive logging and graceful degradation

### Component Structure

```
lib/
├── fixes/           # Error recovery system
│   ├── fix-templates.js     # 20+ automated fix patterns
│   ├── ai-fix-generator.js  # Grok-powered complex fixes
│   ├── safe-applier.js      # Safe application with rollback
│   └── fix-generator.js     # Orchestrates fix selection & application
├── error-detection/ # Intelligent error parsing
│   ├── error-parser.js      # ESLint/TypeScript/Prettier parsing
│   ├── error-classifier.js  # Type/severity/complexity analysis
│   └── context-analyzer.js  # Codebase-aware error analysis
├── code-analysis/   # Semantic intelligence
│   ├── ast-parser.js        # Multi-language AST parsing
│   ├── dependency-mapper.js # Import/export relationship mapping
│   ├── circular-deps.js     # Cycle detection algorithms
│   ├── graph-visualizer.js  # ASCII dependency graphs
│   └── symbol-extractor.js  # Language-agnostic symbol extraction
├── context/         # Context management
│   ├── token-manager.js     # Budgeting & capacity management
│   ├── relevance-scorer.js  # File relevance algorithms
│   ├── window-optimizer.js  # Context optimization
│   ├── file-suggester.js    # Smart file recommendations
│   └── auto-context.js      # Query-based context building
├── learning/        # Intelligence & learning systems
│   ├── error-patterns.js    # Cross-session error pattern analysis
│   ├── personalized-fixes.js # User-specific fix recommendations
│   └── prevention-tips.js   # Proactive error prevention guidance
├── display/         # Visual terminal enhancements
│   └── syntax-highlighter.js # Multi-language syntax highlighting
└── utils/           # Infrastructure
    └── logger.js            # Structured logging system
```

## Build & Testing

### Commands
- **Development**: `npm start` - Launch CLI
- **Linting**: `npm run lint` - ESLint + Prettier
- **Formatting**: `npm run format` - Auto-fix formatting
- **Testing**: Unit tests for all intelligence components

### Testing Strategy
- **Unit Tests**: Individual component functionality
- **Integration Tests**: End-to-end workflows (RPG planning, error recovery)
- **Performance Tests**: Token usage, response times, memory usage
- **Accuracy Tests**: Fix success rates, relevance scoring validation

## AI Assistant Guidelines

### When to Use Features

- **RPG Planning**: Complex projects, multi-file architectures, new applications
- **Error Recovery**: Paste any linting/compiler errors for automatic analysis
- **Context Management**: Use `/budget` to monitor capacity, `/add` for selective inclusion
- **Semantic Search**: `/analyze "auth functions"` for codebase exploration

### Context Budgeting

- **Essentials (15%)**: package.json, README.md, core configs
- **Conversation (70%)**: Active work files and discussions
- **Buffer (15%)**: Safety margin for system operations

### Error Recovery Workflow

1. **Detection**: Automatic parsing and classification
2. **Analysis**: Context-aware impact assessment
3. **Fix Selection**: Template → AI → Hybrid fallback
4. **Safe Application**: Backup → Apply → Validate → Rollback if needed
5. **Learning**: Success rates tracked for continuous improvement

### Learning & Adaptation

- **Pattern Recognition**: Tracks error frequency, hotspots, and temporal patterns
- **Personalization**: Learns user preferences and project-specific patterns
- **Prevention**: Provides proactive configuration and practice recommendations
- **Continuous Improvement**: Adapts recommendations based on success/failure feedback

### Visual Terminal Experience

- **Syntax Highlighting**: Multi-language code highlighting (JS, TS, Python, JSON, Shell, SQL)
- **Color Themes**: Default, dark, and minimal themes with ANSI terminal compatibility
- **Interactive Controls**: Runtime theme switching and highlighting controls
- **Language Detection**: Automatic language recognition for optimal highlighting

## Git Workflow

### Branch Strategy
- **main**: Production-ready code
- **feature/**: New capabilities (RPG planning, error recovery, etc.)
- **fix/**: Bug fixes and improvements
- **docs/**: Documentation updates

### Commit Conventions
- **feat:**: New features (Phase 1 intelligence, Phase 2 error recovery)
- **fix:**: Bug fixes
- **docs:**: Documentation improvements
- **refactor:**: Code restructuring
- **test:**: Testing improvements
- **chore:**: Maintenance tasks

### Release Process
- **Versioning**: Semantic (major.minor.patch)
- **Changelog**: Auto-generated from conventional commits
- **Testing**: Full test suite + integration validation
- **Documentation**: README updates for new features

## Security & Best Practices

### API Security
- **Keys**: Never committed, environment variables only
- **Rate Limiting**: Built-in protection against quota exhaustion
- **Error Handling**: Graceful degradation without exposing sensitive data

### Code Security
- **Dependencies**: Regular audits with `npm audit`
- **Input Validation**: All user inputs sanitized
- **File Operations**: Permission checks and safe rollback
- **Backups**: Automatic file snapshots before modifications

### Data Protection
- **Conversation History**: Local storage, user-controlled retention
- **Context Files**: Temporary loading, no persistent storage
- **Error Logs**: Structured logging without sensitive information

## Performance Optimization

### Token Management
- **Budgeting**: Prevents capacity exhaustion
- **Optimization**: Selective context loading
- **Monitoring**: Real-time capacity tracking with `/budget`

### Response Optimization
- **Model Selection**: Task-appropriate AI models
- **Caching**: Frequently used context optimization
- **Streaming**: Progressive response handling

### Memory Management
- **Garbage Collection**: Automatic cleanup of unused context
- **File Limits**: Capacity-aware file addition
- **Session Management**: Efficient conversation compression

---

_This configuration is automatically loaded by Grok Code when working in this repository._
