# 🏗️ RPG Repository Planning Guide

## Overview

**Repository Planning Graph (RPG)** is Grok Code's revolutionary approach to structured software architecture and code generation. Inspired by the research paper ["RPG: A Repository Planning Graph"](https://arxiv.org/abs/2401.04276), RPG transforms how AI generates complex codebases by introducing systematic planning before implementation.

---

## 🎯 What is RPG?

RPG is a **planning-first** approach to software development that ensures generated codebases are:

- **Well-structured**: Modular architecture with clear component relationships
- **Maintainable**: Proper separation of concerns and dependencies
- **Scalable**: Easy to extend and modify
- **Coherent**: All components work together harmoniously

Unlike traditional AI code generation that jumps straight to implementation, RPG follows a **structured workflow**:

```
User Request → Planning Phase → Graph Construction → Guided Generation → File Output
```

---

## 🔄 How RPG Works in Grok Code

### Phase 1: Intelligent Activation

RPG automatically activates when your prompts match these patterns:

```bash
# Repository-level planning triggers
"generate repo"
"build a library"
"create a framework"
"implement a system"
"develop a platform"

# Complex multi-component triggers
"build a web application"
"create a REST API"
"implement a data pipeline"
"develop a CLI tool"
```

**Non-RPG triggers** (regular chat mode):
```bash
"write a function"
"fix this bug"
"explain this code"
"optimize this query"
```

### Phase 2: Planning Prompt Generation

When activated, Grok Code generates a sophisticated planning prompt:

```
You are an expert software architect. For the user prompt: '[USER_PROMPT]',
create a structured plan for a code repository.

Output ONLY a JSON object with:
- "features": Array of high-level functionalities
- "files": Object mapping features to file paths
- "flows": Array of data flow edges
- "deps": Array of dependency edges

Keep it concise and modular.
```

### Phase 3: JSON Plan Generation

The AI architect creates a comprehensive JSON plan:

```json
{
  "features": [
    "data_processing",
    "model_training",
    "api_endpoints",
    "error_handling"
  ],
  "files": {
    "data_processing": "src/data.js",
    "model_training": "src/model.js",
    "api_endpoints": "src/api.js",
    "error_handling": "src/utils.js"
  },
  "flows": [
    ["data_processing", "model_training"],
    ["model_training", "api_endpoints"]
  ],
  "deps": [
    ["data.js", "model.js"],
    ["utils.js", "api.js"]
  ]
}
```

### Phase 4: Graph Construction

The JSON plan is transformed into a **Repository Planning Graph** with:

- **Nodes**: Features and files as interconnected components
- **Edges**: Relationships between components (flows and dependencies)

```
Features Layer:
├── data_processing
├── model_training
├── api_endpoints
└── error_handling

Files Layer:
├── src/data.js (implements data_processing)
├── src/model.js (implements model_training)
├── src/api.js (implements api_endpoints)
└── src/utils.js (implements error_handling)

Relationships:
data_processing → model_training (data flow)
model_training → api_endpoints (data flow)
data.js → model.js (dependency)
utils.js → api.js (dependency)
```

### Phase 5: Guided Code Generation

The plan becomes the blueprint for code generation:

```
Using this repository plan:
Features: ["data_processing", "model_training", "api_endpoints", "error_handling"]
Files: {"data_processing": "src/data.js", "model_training": "src/model.js", ...}
Data Flows: [["data_processing", "model_training"], ["model_training", "api_endpoints"]]
Dependencies: [["data.js", "model.js"], ["utils.js", "api.js"]]

Generate complete, modular code for: '[USER_PROMPT]'.
For each file in Files, create a code block. Respect deps and flows.
Output ONLY JSON: { "files": { "path/to/file.js": "full code here", ... } }
```

### Phase 6: File System Integration

Generated code is written directly to disk:

```
Generated: src/data.js
Generated: src/model.js
Generated: src/api.js
Generated: src/utils.js
Generated: package.json

Repository generation completed!
```

---

## 📊 RPG Plan Structure

### Features Array
High-level functionalities that define what the system does:

```json
"features": [
  "user_authentication",
  "data_validation",
  "api_routing",
  "database_operations",
  "error_handling"
]
```

**Best Practices:**
- Use snake_case naming
- Keep features atomic and focused
- Aim for 3-8 features per project
- Ensure features are independent when possible

### Files Object
Mapping between features and their implementation files:

```json
"files": {
  "user_authentication": "src/auth.js",
  "data_validation": "src/validation.js",
  "api_routing": "src/routes.js",
  "database_operations": "src/database.js",
  "error_handling": "src/errors.js"
}
```

**Best Practices:**
- Use logical file paths (src/, lib/, etc.)
- One feature per file (avoid feature sprawl)
- Consistent naming patterns
- Proper file extensions (.js, .ts, .py, etc.)

### Flows Array
Data flow relationships between features:

```json
"flows": [
  ["user_authentication", "api_routing"],
  ["data_validation", "database_operations"],
  ["database_operations", "api_routing"]
]
```

**Best Practices:**
- Represent data transformation pipelines
- Show logical processing order
- Avoid circular dependencies
- Keep flows unidirectional when possible

### Dependencies Array
File-level import relationships:

```json
"deps": [
  ["validation.js", "database.js"],
  ["auth.js", "routes.js"],
  ["errors.js", "routes.js"]
]
```

**Best Practices:**
- Mirror actual import/export relationships
- Include utility dependencies
- Consider shared libraries
- Document cross-cutting concerns

---

## 🎯 RPG in Action: Examples

### Example 1: ML Library

**User Prompt:** `"Build a simple ML library in JavaScript"`

**Generated Plan:**
```json
{
  "features": ["data_loading", "model_training", "prediction", "evaluation"],
  "files": {
    "data_loading": "src/data.js",
    "model_training": "src/model.js",
    "prediction": "src/predict.js",
    "evaluation": "src/eval.js"
  },
  "flows": [
    ["data_loading", "model_training"],
    ["model_training", "prediction"],
    ["prediction", "evaluation"]
  ],
  "deps": [
    ["data.js", "model.js"],
    ["model.js", "predict.js"],
    ["predict.js", "eval.js"]
  ]
}
```

**Result:** Modular ML library with proper separation of concerns.

### Example 2: REST API

**User Prompt:** `"Create a REST API for task management"`

**Generated Plan:**
```json
{
  "features": ["task_crud", "user_auth", "data_storage", "api_routing", "validation"],
  "files": {
    "task_crud": "src/tasks.js",
    "user_auth": "src/auth.js",
    "data_storage": "src/database.js",
    "api_routing": "src/routes.js",
    "validation": "src/validate.js"
  },
  "flows": [
    ["user_auth", "api_routing"],
    ["validation", "task_crud"],
    ["task_crud", "data_storage"]
  ],
  "deps": [
    ["auth.js", "routes.js"],
    ["validate.js", "tasks.js"],
    ["database.js", "tasks.js"]
  ]
}
```

**Result:** Well-structured API with proper authentication and validation layers.

---

## 🛠️ Technical Implementation

### RPG Function Architecture

```javascript
// Phase 1: Planning
function makeRPG(prompt, openai, model) {
  // Generate planning prompt
  // Call Grok API with planning instructions
  // Parse JSON response
  // Construct graph from plan
  return { graph, plan };
}

// Phase 2: Generation
async function generateCodeWithRPG(prompt, openai, model) {
  // Get RPG plan
  // Generate guided code prompt
  // Call Grok API for code generation
  // Parse file outputs
  // Write to filesystem
  return codeOutput;
}
```

### Integration Points

RPG integrates seamlessly with Grok Code's CLI:

```javascript
// In main chat loop
const shouldUseRPG = userInput.toLowerCase().includes('generate repo') ||
                     userInput.toLowerCase().includes('build a') ||
                     // ... other triggers

if (shouldUseRPG) {
  console.log("Using RPG planning for code generation...");
  await generateCodeWithRPG(userInput, client, model);
}
```

### Error Handling

- **Plan Generation Failure**: Falls back to regular chat mode
- **Invalid JSON**: Retries with corrected prompt
- **File Write Errors**: Reports specific file write failures
- **API Errors**: Graceful degradation with user notification

---

## 🎨 Best Practices for RPG Planning

### Writing Effective Prompts

**Good Prompts:**
- "Build a REST API for user management with authentication"
- "Create a data processing pipeline for CSV files"
- "Implement a task management system with web interface"

**Less Effective Prompts:**
- "Make an app" (too vague)
- "Build something cool" (insufficient detail)
- "Write code for me" (no specific requirements)

### Optimizing Plan Quality

1. **Be Specific**: Include technologies, features, and constraints
2. **Think Modular**: Break complex systems into manageable components
3. **Consider Dependencies**: Think about how components interact
4. **Plan for Scale**: Design for future extension

### Recommended Models for RPG

- **Planning Phase**: Use `grok-4-fast-reasoning` - Excellent reasoning capabilities with 2M context for complex architecture planning
- **Code Generation**: Use `grok-code-fast-1` - Optimized specifically for coding tasks and implementation
- **Large Projects**: Use `grok-4-fast-non-reasoning` - 2M context window handles large codebases efficiently

**Model Switching During RPG:**
```bash
# Start with reasoning model for planning
/model
# Select: grok-4-fast-reasoning

# Then switch to coding model for implementation
/model
# Select: grok-code-fast-1
```

### Reviewing Generated Plans

Always review the RPG plan output:
```bash
RPG Plan Generated: {
  "features": [...],
  "files": {...},
  "flows": [...],
  "deps": [...]
}
```

**Check for:**
- Logical feature separation
- Proper file organization
- Realistic dependency relationships
- Missing critical components

---

## 🔧 Advanced Configuration

### Environment Variables

```bash
# Force RPG mode for all prompts
export GROK_FORCE_RPG=true

# Custom model for RPG planning (recommended: grok-4-fast-reasoning)
export GROK_RPG_MODEL=grok-4-fast-reasoning

# Disable RPG fallback
export GROK_NO_RPG_FALLBACK=true

# Set default model for all interactions
export GROK_MODEL=grok-code-fast-1
```

### Custom RPG Triggers

Modify the trigger detection in `bin/grok.js`:

```javascript
const shouldUseRPG = userInput.toLowerCase().includes('generate repo') ||
                     userInput.toLowerCase().includes('build a') ||
                     userInput.toLowerCase().includes('create a') ||
                     // Add your custom triggers here
                     userInput.toLowerCase().includes('my custom trigger');
```

### Extending RPG Plans

Add custom fields to RPG plans:

```json
{
  "features": [...],
  "files": {...},
  "flows": [...],
  "deps": [...],
  "tests": ["src/data.test.js"],           // Custom: test files
  "docs": ["README.md", "API.md"],        // Custom: documentation
  "config": ["package.json", ".env"]      // Custom: configuration
}
```

---

## 📈 Benefits of RPG

### For Users
- **Quality**: Well-architected codebases from day one
- **Speed**: Faster development through structured planning
- **Reliability**: Consistent patterns and proper dependencies
- **Maintainability**: Easy to understand and modify code

### For AI
- **Guidance**: Structured prompts reduce ambiguity
- **Context**: Clear component relationships improve coherence
- **Modularity**: Break complex tasks into manageable pieces
- **Verification**: Plan review allows for early corrections

### For Teams
- **Consistency**: Standardized architecture patterns
- **Onboarding**: Clear component separation aids understanding
- **Collaboration**: Well-defined interfaces between components
- **Scaling**: Modular design supports team growth

---

## 🚀 Future Enhancements

### Planned Features
- **Visual Graph Display**: ASCII/Unicode graph visualization
- **Plan Persistence**: Save and reload RPG plans
- **Interactive Planning**: User-guided plan refinement
- **Template Library**: Pre-built plans for common patterns
- **Multi-language Support**: RPG for Python, Go, Rust, etc.

### Research Integration
- **Advanced Graph Algorithms**: Improved dependency resolution
- **Machine Learning Optimization**: AI-improved plan generation
- **Collaborative Planning**: Multi-user plan development
- **Plan Validation**: Automated quality checks

---

## 📚 Resources

- **Paper**: ["RPG: A Repository Planning Graph"](https://arxiv.org/abs/2401.04276)
- **Documentation**: [Grok Code README](../README.md)
- **Examples**: [Example RPG Plans](./examples/)
- **Community**: [GitHub Discussions](https://github.com/NYTEMODEONLY/grok-code/discussions)

---

*RPG represents the future of AI-assisted software development - where planning meets execution to create exceptional codebases.*
