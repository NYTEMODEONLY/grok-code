# 🚀 Grok Code: AI-Powered CLI Coding Assistant with RPG Planning

<div align="center">

![Grok Code Logo](https://img.shields.io/badge/Grok_Code-CLI_AI_Assistant-000?style=for-the-badge&logo=terminal&logoColor=white)
![xAI Powered](https://img.shields.io/badge/Powered_by-xAI-000?style=for-the-badge&logo=x&logoColor=white)
![RPG Planning](https://img.shields.io/badge/Planning-RPG_Graph-FF6B35?style=for-the-badge&logo=graph&logoColor=white)

**Transform your terminal into an intelligent coding environment with AI planning and generation**

[Installation](#installation) • [Quick Start](#usage) • [RPG Planning](#-rpg-repository-planning) • [Features](#key-features)

</div>

---

## ✨ Overview

**Grok Code** is a revolutionary, terminal-based coding assistant powered by Grok AI from xAI. It elevates your command line into an intelligent coding environment with **Repository Planning Graph (RPG)** technology - a structured approach to software architecture that ensures modular, well-planned code generation.

### 🎯 What Makes Grok Code Special?

- **🤖 AI-First Architecture**: Natural language prompts for any coding task
- **📊 RPG Planning**: Inspired by ["RPG: A Repository Planning Graph"](https://arxiv.org/abs/2401.04276) - structured planning before code generation
- **🔄 Stateful & Agentic**: Maintains context, plans ahead, and iterates autonomously
- **⚡ Full-Stack Ready**: From simple scripts to deploy-ready Next.js apps
- **🎨 Terminal-Native**: Designed for developers who live in the command line

**Current Version:** 1.0.0 (Released: September 26, 2025)  
**Built by:** nytemode  
**License:** MIT  
**Repository:** [NYTEMODEONLY/grok-code](https://github.com/NYTEMODEONLY/grok-code)  

## 🏗️ RPG Repository Planning

**Repository Planning Graph (RPG)** is a cutting-edge approach to software architecture that structures code generation around modular planning. Inspired by the paper ["RPG: A Repository Planning Graph"](https://arxiv.org/abs/2401.04276), this feature ensures your generated codebases are well-organized, maintainable, and scalable.

### How RPG Works

1. **📋 Planning Phase**: Grok analyzes your request and creates a structured JSON plan with:
   - **Features**: High-level functionalities (e.g., `data_processing`, `model_training`)
   - **Files**: Feature-to-file mappings (e.g., `data_processing` → `src/data.js`)
   - **Data Flows**: How features interact (e.g., data → processing → output)
   - **Dependencies**: File relationships and imports

2. **🗂️ Graph Construction**: Builds a dependency graph with nodes (features/files) and edges (flows/dependencies)

3. **⚙️ Guided Generation**: Uses the plan to generate modular, well-structured code

4. **💾 Direct Output**: Writes files directly to your filesystem with proper organization

### When RPG Activates

RPG planning automatically triggers for prompts containing:
- `"generate repo"`
- `"build a"`
- `"create a"`
- `"implement a"`
- `"develop a"`

**Example**: `"Build a simple ML library in JavaScript"` → RPG generates `src/data.js`, `src/model.js`, etc.

---

## ⚡ Key Features

Grok Code combines AI assistance with structured planning for unparalleled coding productivity:

### 🤖 AI-Powered Coding with RPG Planning

- **Intelligent Code Generation**: Natural language prompts powered by Grok AI
- **RPG Planning Integration**: Structured repository planning for complex projects
- **Step-by-Step Reasoning**: Grok thinks ahead, plans, and iterates on solutions
- **Multi-Paradigm Support**: Scripts, libraries, web apps, APIs, and more
  
- **🗂️ Multi-File Management**:
  - Create, edit, or delete multiple files simultaneously using XML tags
  - Automatic directory creation for complex project structures
  - File context management: Add files to AI knowledge with `/add <file>`, scan with `/scan`

- **🔄 Autonomous Workflows**:
  - Execute shell commands via `<run command="...">` tags (npm install, tests, linting)
  - Iterative error handling with AI-suggested fixes
  - End-to-end project generation with deployment commands

- **🌐 Git Integration**:
  - Built-in commands: `/git <command>`, `/init-git`, `/commit <message>`, `/push`
  - Automated git workflows and PR creation (requires `gh` CLI)
  - Conflict resolution and commit message generation

- **⚙️ Custom Commands**:
  - Define reusable prompts in `.grok/commands/<cmd_name>.txt`
  - Team-shared commands for project consistency
  - Example: `/lint` → "Run ESLint on all JS files"

- **🖥️ Environment Awareness**:
  - Cross-platform support (Windows, macOS, Linux)
  - OS-adapted commands and paths
  - Stateful conversation with full context retention

- **🎨 Terminal-First UX**:
  - Thinking animations during API calls
  - Interactive confirmation for all actions
  - Comprehensive help system with `/help`
  - Session management with `/clear`

- **🔧 Configuration & Extensibility**:
  - `GROK.md`: Project-specific guidelines and commands
  - Secure API key management with local storage
  - **Model Selection**: Choose from multiple Grok models via `/model` command:
    - `grok-3-beta`: Most capable model (default)
    - `grok-3-mini-beta`: Faster, cost-effective
    - `grok-beta`: Legacy model
  - Environment variables: Set `GROK_MODEL` to override default

- **🛡️ Security & Best Practices**:
  - User confirmation required for all destructive actions
  - Token-efficient context management
  - No automatic execution without approval

## Installation

1. **Prerequisites**:
   - Node.js 16+.
   - xAI API key (get from [x.ai/api](https://x.ai/api)).

2. **Clone the Repo**:
   ```bash
   git clone https://github.com/xai-org/grok-code.git
   cd grok-code
   ```

3. **Install Dependencies**:
   ```bash
   npm install
   ```

4. **Run the CLI**:
   ```bash
   npm start
   ```
   or
   ```bash
   ./bin/grok.js
   ```
   - On first launch, enter your xAI API key (saved securely in `~/.grok/api_key`).

5. **Global Installation (Optional)**:
   ```bash
   npm install -g .
   ```
   Then use `grok` from anywhere.

## 🚀 Quick Start

Get started with Grok Code in seconds:

```bash
# Clone and install
git clone https://github.com/NYTEMODEONLY/grok-code.git
cd grok-code
npm install

# Launch
npm start
```

Or install globally for system-wide access:
```bash
npm install -g @xai/grok-code
grok
```

### 💡 Usage Examples

#### 🏗️ RPG Planning (Recommended for Complex Projects)
```bash
# Automatic RPG activation
"Build a simple ML library in JavaScript"
"Create a REST API for task management"
"Implement a React dashboard with charts"
"Develop a Node.js CLI tool for file processing"
```

#### 🤖 Regular AI Chat
```bash
# General coding assistance
"Write a function to validate email addresses"
"Debug this JavaScript error: [paste error]"
"Optimize this SQL query for performance"
```

#### 🔧 Workflow Commands
```bash
# Model selection
"/model"                       # Change AI model (interactive menu)

# Git operations
"/init-git"                    # Initialize repository
"/commit Add new feature"      # Stage and commit
"/push"                        # Push to remote

# File management
"/add src/app.js"              # Add file to context
"/scan"                        # Scan all files
"/ls"                          # List directory

# Custom commands
"/test"                        # Run tests (if defined)
```

Exit anytime with `/exit`. Clear session with `/clear`.

### 📋 Example Sessions

#### 🏗️ RPG Planning Example
```bash
Welcome to Grok Code! Type your message or use /help for commands.

You: Build a simple ML library in JavaScript

Grok: Using RPG planning for code generation...
RPG Plan Generated: {
  "features": ["data_loading", "model_training", "prediction"],
  "files": {"data_loading": "src/data.js", "model_training": "src/model.js"},
  "flows": [["data_loading", "model_training"]],
  "deps": [["data.js", "model.js"]]
}

Generated: src/data.js
Generated: src/model.js
Generated: package.json

Repository generation completed!
```

#### 🤖 Regular Chat Example
```bash
You: Create a function to reverse a string in JavaScript

Grok: Here's a simple function to reverse a string:

```javascript
function reverseString(str) {
  return str.split('').reverse().join('');
}
```

You: /run node -e "console.log(reverseString('hello'))"
[Command executed: node -e "console.log(reverseString('hello'))"]
Output: olleh
```

## 💡 Best Practices & Tips

### 🏗️ RPG Planning Tips
- **Use Descriptive Prompts**: "Build a REST API for user authentication" works better than "Make an API"
- **Complex Projects**: Always use RPG for multi-feature projects to ensure proper architecture
- **Review Plans**: RPG plans are logged to console—review them before generation
- **Fallback Available**: If RPG fails, Grok Code automatically falls back to regular chat

### 🤖 General AI Usage
- **Context Matters**: Add relevant files with `/add <file>` before complex tasks
- **Iterative Development**: Use Grok's error analysis for debugging workflows
- **Token Efficiency**: Add files selectively rather than scanning everything

### 📁 Project Configuration
- **GROK.md**: Define project standards:
  ```markdown
  # Project Standards
  - Style: ESLint with Airbnb preset
  - Build: npm run build
  - Test: npm test
  - Architecture: Feature-based folder structure
  ```

- **Custom Commands**: Create reusable workflows:
  ```bash
  # .grok/commands/deploy.txt
  Deploy the current Next.js app to Vercel and output the URL.
  ```

### ⚡ Performance Optimization
- **Model Selection**: Use `/model` command to switch between models:
  - `grok-3-beta`: Best quality (default)
  - `grok-3-mini-beta`: Faster responses, lower cost
  - `grok-beta`: Legacy option
- **Context Management**: Clear context with `/clear` for fresh sessions
- **Selective Scanning**: Use `/add` instead of `/scan` for large codebases

## 🤝 Contributing

We love contributions! Whether it's bug fixes, new features, or documentation improvements, every contribution helps make Grok Code better.

### 🚀 How to Contribute

1. **Fork** the repository on GitHub
2. **Clone** your fork: `git clone https://github.com/your-username/grok-code.git`
3. **Create** a feature branch: `git checkout -b feature/amazing-feature`
4. **Make** your changes and test thoroughly
5. **Commit** with clear messages: `git commit -m "Add amazing feature"`
6. **Push** to your branch: `git push origin feature/amazing-feature`
7. **Open** a Pull Request with a detailed description

### 🐛 Found a Bug?

- Check [existing issues](https://github.com/NYTEMODEONLY/grok-code/issues) first
- Open a new issue with detailed steps to reproduce
- Include your OS, Node.js version, and error messages

### 💡 Feature Requests

- Use GitHub Discussions for feature ideas
- Check if the feature aligns with RPG planning principles
- Provide use cases and examples

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **🤖 Powered by** [xAI's Grok](https://x.ai) - The foundation of intelligent assistance
- **📚 Inspired by** ["RPG: A Repository Planning Graph"](https://arxiv.org/abs/2401.04276) - Structured planning for better code generation
- **👨‍💻 Built by** nytemode - Crafting the future of AI-powered development
- **🌟 Community** - Every contributor and user making this tool better

## 📞 Support & Community

- **🐛 Issues**: [GitHub Issues](https://github.com/NYTEMODEONLY/grok-code/issues)
- **💬 Discussions**: [GitHub Discussions](https://github.com/NYTEMODEONLY/grok-code/discussions)
- **🐦 Twitter**: Follow [@xai](https://twitter.com/xai) for updates
- **📧 Contact**: Open an issue for direct support

---

<div align="center">

**Ready to revolutionize your coding workflow?** 🚀

[Get Started](#-quick-start) • [RPG Planning](#-rpg-repository-planning) • [Contribute](#-contributing)

*Made with ❤️ by the AI coding community*

</div> 