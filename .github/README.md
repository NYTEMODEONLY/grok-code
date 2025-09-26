# 🚀 Grok Code: AI-Powered CLI Assistant with RPG Planning

<div align="center">

![Grok Code](https://img.shields.io/badge/Grok_Code-CLI_AI_Assistant-000?style=for-the-badge&logo=terminal&logoColor=white)
![xAI Powered](https://img.shields.io/badge/Powered_by-xAI-000?style=for-the-badge&logo=x&logoColor=white)
![RPG Planning](https://img.shields.io/badge/Planning-RPG_Graph-FF6B35?style=for-the-badge&logo=graph&logoColor=white)

**Transform your terminal into an intelligent coding environment**

[![npm version](https://img.shields.io/npm/v/@xai/grok-code.svg)](https://www.npmjs.com/package/@xai/grok-code)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D16.0.0-brightgreen)](https://nodejs.org/)

</div>

---

## ✨ What is Grok Code?

Grok Code is a revolutionary terminal-based coding assistant that combines the power of xAI's Grok AI with **Repository Planning Graph (RPG)** technology. Inspired by cutting-edge software architecture research, it ensures your generated codebases are well-structured, modular, and maintainable.

### 🎯 Key Features

- **🏗️ RPG Planning**: Structured repository planning for complex projects
- **🤖 AI-Powered**: Natural language prompts powered by Grok AI
- **🎛️ Model Selection**: Choose from multiple Grok models (`/model` command)
- **🔄 Stateful & Agentic**: Maintains context and iterates autonomously
- **⚡ Full-Stack Ready**: From scripts to deploy-ready applications
- **🎨 Terminal-Native**: Designed for developers who live in the command line

### 🚀 Quick Start

```bash
npm install -g @xai/grok-code
grok
```

Then try: **"Build a simple ML library in JavaScript"**

---

## 📊 RPG Planning in Action

When you use RPG-enabled prompts, Grok Code:

1. **Analyzes** your request and creates a structured plan
2. **Builds** a dependency graph with features and files
3. **Generates** modular, well-organized code
4. **Outputs** files directly to your filesystem

**Example Output:**
```
RPG Plan Generated: {
  "features": ["data_processing", "model_training", "api_endpoints"],
  "files": {"data_processing": "src/data.js", "model_training": "src/model.js"},
  "flows": [["data_processing", "model_training"]],
  "deps": [["data.js", "model.js"]]
}

Generated: src/data.js
Generated: src/model.js
Generated: package.json
```

---

## 🛠️ Installation

```bash
# Install globally
npm install -g @xai/grok-code

# Or clone and run locally
git clone https://github.com/NYTEMODEONLY/grok-code.git
cd grok-code
npm install
npm start
```

**Prerequisites:** Node.js 16+, xAI API key

## 🎛️ Model Selection

Choose the right model for your needs:

```bash
# In Grok Code, type:
/model
```

**Available Models:**
- **`grok-3-beta`** (Default): Most capable, balanced performance
- **`grok-3-mini-beta`**: Faster responses, cost-effective
- **`grok-beta`**: Legacy model with proven reliability

Or set via environment variable:
```bash
export GROK_MODEL=grok-3-mini-beta
grok
```

---

## 📚 Learn More

- 📖 [Full Documentation](README.md)
- 🏗️ [RPG Planning Guide](README.md#-rpg-repository-planning)
- 🤝 [Contributing](README.md#-contributing)
- 🐛 [Issues](https://github.com/NYTEMODEONLY/grok-code/issues)

---

<div align="center">

**Built with ❤️ by nytemode | Powered by xAI**

[⭐ Star this repo](https://github.com/NYTEMODEONLY/grok-code) • [🐛 Report Issues](https://github.com/NYTEMODEONLY/grok-code/issues) • [💬 Discussions](https://github.com/NYTEMODEONLY/grok-code/discussions)

</div>
