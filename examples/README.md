# RPG Examples

This directory contains example Repository Planning Graph (RPG) plans that demonstrate how Grok Code structures complex projects.

## 📁 Directory Structure

```
examples/
├── rpg-plans/           # Sample RPG plans in JSON format
│   ├── ml-library.json  # Machine learning library structure
│   ├── rest-api.json    # REST API with full backend stack
│   └── cli-tool.json    # Command-line tool architecture
└── README.md           # This file
```

## 🔍 RPG Plan Structure

Each RPG plan is a JSON object with four key components:

### Features

High-level functionalities that define what the system does:

```json
"features": ["data_loading", "model_training", "prediction"]
```

### Files

Mapping between features and their implementation files:

```json
"files": {
  "data_loading": "src/data.js",
  "model_training": "src/model.js"
}
```

### Flows

Data flow relationships showing how features interact:

```json
"flows": [
  ["data_loading", "model_training"],
  ["model_training", "prediction"]
]
```

### Dependencies

File-level import relationships:

```json
"deps": [
  ["data.js", "model.js"],
  ["model.js", "predict.js"]
]
```

## 📖 How to Use

1. **Study the examples** to understand RPG planning patterns
2. **Adapt the structures** for your own projects
3. **Use as templates** when designing complex systems
4. **Reference in prompts** when working with Grok Code

## 🎯 Example Usage

When you run Grok Code with a prompt like "Build a machine learning library in JavaScript", it generates an RPG plan similar to `ml-library.json`, then creates all the files according to the planned structure.

## 📚 Learn More

- **[RPG Planning](../README.md#rpg-repository-planning)**: Comprehensive documentation of how RPG works
- **[Main README](./README.md)**: General Grok Code documentation
- **[Paper Reference](https://arxiv.org/abs/2401.04276)**: Original research paper

## 🤝 Contributing

Add more example RPG plans to help users understand different project patterns!

- Follow the JSON structure outlined above
- Include a variety of project types (web apps, APIs, libraries, tools)
- Add comments explaining complex relationships
- Test that the plan structure makes logical sense
