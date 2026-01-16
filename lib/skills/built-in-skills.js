/**
 * Built-in Skills
 * Pre-defined skills for common development workflows
 */

import { execSync } from 'child_process';
import fs from 'fs-extra';
import path from 'path';

export class BuiltInSkills {
  constructor(options = {}) {
    this.grokCore = options.grokCore;
    this.grokClient = options.grokClient;
  }

  /**
   * Register all built-in skills with the skills manager
   * @param {SkillsManager} manager - Skills manager instance
   */
  register(manager) {
    // /commit skill - Smart git commit
    manager.registerBuiltIn('commit', {
      description: 'Smart git commit with AI-generated message',
      usage: '/commit [optional message hint]',
      arguments: [
        { name: 'hint', description: 'Optional hint for commit message', required: false }
      ],
      handler: async (context) => await this.commitHandler(context)
    });

    // /review skill - Code review
    manager.registerBuiltIn('review', {
      description: 'Code review for staged changes or specified files',
      usage: '/review [file]',
      arguments: [
        { name: 'file', description: 'Optional file to review', required: false }
      ],
      handler: async (context) => await this.reviewHandler(context)
    });

    // /explain skill - Code explanation
    manager.registerBuiltIn('explain', {
      description: 'Explain code in the current context or specified file',
      usage: '/explain [file:line] or /explain',
      arguments: [
        { name: 'target', description: 'File and optional line number', required: false }
      ],
      handler: async (context) => await this.explainHandler(context)
    });

    // /refactor skill - Refactoring suggestions
    manager.registerBuiltIn('refactor', {
      description: 'Suggest refactoring improvements for code',
      usage: '/refactor [file]',
      arguments: [
        { name: 'file', description: 'File to refactor', required: false }
      ],
      handler: async (context) => await this.refactorHandler(context)
    });

    // /test skill - Generate tests
    manager.registerBuiltIn('test', {
      description: 'Generate tests for specified code',
      usage: '/test [file]',
      arguments: [
        { name: 'file', description: 'File to generate tests for', required: false }
      ],
      handler: async (context) => await this.testHandler(context)
    });

    // /docs skill - Generate documentation
    manager.registerBuiltIn('docs', {
      description: 'Generate documentation for code',
      usage: '/docs [file]',
      arguments: [
        { name: 'file', description: 'File to document', required: false }
      ],
      handler: async (context) => await this.docsHandler(context)
    });

    // /fix skill - Fix errors
    manager.registerBuiltIn('fix', {
      description: 'Analyze and fix errors in code or output',
      usage: '/fix [error message or file]',
      arguments: [
        { name: 'target', description: 'Error message or file with errors', required: false }
      ],
      handler: async (context) => await this.fixHandler(context)
    });

    // /debug skill - Debug assistance
    manager.registerBuiltIn('debug', {
      description: 'Help debug issues in code',
      usage: '/debug [description or file]',
      arguments: [
        { name: 'target', description: 'Issue description or file', required: false }
      ],
      handler: async (context) => await this.debugHandler(context)
    });
  }

  /**
   * /commit handler - Smart git commit
   */
  async commitHandler(context) {
    const { args } = context;
    const hint = args?.join(' ') || '';

    try {
      // Get git status
      const status = execSync('git status --porcelain', { encoding: 'utf8' }).trim();

      if (!status) {
        return {
          type: 'message',
          content: 'Nothing to commit. Working tree is clean.'
        };
      }

      // Get staged changes
      let diff;
      try {
        diff = execSync('git diff --cached', { encoding: 'utf8' });
      } catch {
        diff = '';
      }

      // If nothing staged, show what could be staged
      if (!diff) {
        diff = execSync('git diff', { encoding: 'utf8' });

        if (!diff) {
          return {
            type: 'message',
            content: 'No changes to commit. Use `git add` to stage files first.'
          };
        }

        return {
          type: 'prompt',
          prompt: `The user wants to commit but has no staged changes. Here's the current git status:

\`\`\`
${status}
\`\`\`

Unstaged changes:
\`\`\`diff
${diff.substring(0, 3000)}${diff.length > 3000 ? '\n... (truncated)' : ''}
\`\`\`

Suggest which files to stage and help them create a good commit. ${hint ? `User hint: ${hint}` : ''}`
        };
      }

      // Generate commit message
      const recentCommits = execSync('git log -5 --oneline', { encoding: 'utf8' }).trim();

      return {
        type: 'prompt',
        prompt: `Generate a git commit message for the following changes. Follow the repository's commit message style based on recent commits.

Recent commits:
\`\`\`
${recentCommits}
\`\`\`

Staged changes:
\`\`\`diff
${diff.substring(0, 5000)}${diff.length > 5000 ? '\n... (truncated)' : ''}
\`\`\`

${hint ? `User hint: ${hint}` : ''}

Generate a concise, descriptive commit message that:
1. Summarizes the changes (what was done and why)
2. Follows conventional commit format if the repo uses it
3. Is 1-2 lines max

Then offer to run the commit command.`
      };

    } catch (error) {
      return {
        type: 'error',
        content: `Git error: ${error.message}`
      };
    }
  }

  /**
   * /review handler - Code review
   */
  async reviewHandler(context) {
    const { args, fileContext } = context;
    const targetFile = args?.[0];

    let codeToReview = '';
    let reviewTarget = '';

    if (targetFile) {
      // Review specific file
      if (await fs.pathExists(targetFile)) {
        codeToReview = await fs.readFile(targetFile, 'utf8');
        reviewTarget = targetFile;
      } else {
        return {
          type: 'error',
          content: `File not found: ${targetFile}`
        };
      }
    } else {
      // Review staged changes
      try {
        codeToReview = execSync('git diff --cached', { encoding: 'utf8' });
        reviewTarget = 'staged changes';

        if (!codeToReview) {
          codeToReview = execSync('git diff', { encoding: 'utf8' });
          reviewTarget = 'unstaged changes';
        }
      } catch {
        // No git, use file context
        if (fileContext && Object.keys(fileContext).length > 0) {
          const files = Object.keys(fileContext);
          reviewTarget = files.join(', ');
          codeToReview = files.map(f => `// ${f}\n${fileContext[f]}`).join('\n\n');
        }
      }
    }

    if (!codeToReview) {
      return {
        type: 'message',
        content: 'No code to review. Stage changes with `git add` or specify a file.'
      };
    }

    return {
      type: 'prompt',
      prompt: `Perform a thorough code review of the following ${reviewTarget}:

\`\`\`
${codeToReview.substring(0, 8000)}${codeToReview.length > 8000 ? '\n... (truncated)' : ''}
\`\`\`

Provide a code review covering:

1. **Bugs & Errors**: Identify potential bugs, edge cases, or logical errors
2. **Security**: Check for security vulnerabilities (XSS, injection, exposed secrets)
3. **Performance**: Note any performance issues or inefficiencies
4. **Code Quality**: Comment on readability, naming, and structure
5. **Best Practices**: Suggest improvements following best practices
6. **Tests**: Note if tests are missing or need improvement

Format your review with clear sections and specific line references where applicable.`
    };
  }

  /**
   * /explain handler - Code explanation
   */
  async explainHandler(context) {
    const { args, fileContext } = context;
    const target = args?.join(' ') || '';

    let codeToExplain = '';
    let explainTarget = '';

    // Parse target (file:line format)
    if (target) {
      const [file, lineNum] = target.split(':');

      if (await fs.pathExists(file)) {
        const content = await fs.readFile(file, 'utf8');
        const lines = content.split('\n');

        if (lineNum) {
          // Show context around the line
          const line = parseInt(lineNum, 10) - 1;
          const start = Math.max(0, line - 10);
          const end = Math.min(lines.length, line + 10);
          codeToExplain = lines.slice(start, end).map((l, i) => {
            const num = start + i + 1;
            const marker = num === line + 1 ? '>>> ' : '    ';
            return `${marker}${num}: ${l}`;
          }).join('\n');
          explainTarget = `${file} around line ${lineNum}`;
        } else {
          codeToExplain = content;
          explainTarget = file;
        }
      }
    } else if (fileContext && Object.keys(fileContext).length > 0) {
      // Use current context
      const files = Object.keys(fileContext);
      explainTarget = 'current context';
      codeToExplain = files.slice(0, 3).map(f => `// ${f}\n${fileContext[f].substring(0, 2000)}`).join('\n\n');
    }

    if (!codeToExplain) {
      return {
        type: 'message',
        content: 'No code to explain. Specify a file or add files to context with /add.'
      };
    }

    return {
      type: 'prompt',
      prompt: `Explain the following code from ${explainTarget}:

\`\`\`
${codeToExplain.substring(0, 6000)}${codeToExplain.length > 6000 ? '\n... (truncated)' : ''}
\`\`\`

Provide a clear explanation covering:

1. **Overview**: What does this code do at a high level?
2. **Key Components**: Explain the main parts/functions
3. **Data Flow**: How does data move through the code?
4. **Notable Patterns**: Any design patterns or techniques used?
5. **Dependencies**: What does this code rely on?

Be concise but thorough. Use simple language.`
    };
  }

  /**
   * /refactor handler - Refactoring suggestions
   */
  async refactorHandler(context) {
    const { args, fileContext } = context;
    const targetFile = args?.[0];

    let codeToRefactor = '';
    let refactorTarget = '';

    if (targetFile && await fs.pathExists(targetFile)) {
      codeToRefactor = await fs.readFile(targetFile, 'utf8');
      refactorTarget = targetFile;
    } else if (fileContext && Object.keys(fileContext).length > 0) {
      const files = Object.keys(fileContext);
      refactorTarget = files[0];
      codeToRefactor = fileContext[files[0]];
    }

    if (!codeToRefactor) {
      return {
        type: 'message',
        content: 'No code to refactor. Specify a file or add files to context.'
      };
    }

    return {
      type: 'prompt',
      prompt: `Analyze the following code from ${refactorTarget} and suggest refactoring improvements:

\`\`\`
${codeToRefactor.substring(0, 6000)}${codeToRefactor.length > 6000 ? '\n... (truncated)' : ''}
\`\`\`

Suggest refactoring improvements for:

1. **Code Structure**: Can functions/classes be broken down or consolidated?
2. **Naming**: Are names clear and descriptive?
3. **DRY Violations**: Is there repeated code that should be abstracted?
4. **Complexity**: Can complex logic be simplified?
5. **Modern Patterns**: Are there outdated patterns to update?
6. **Error Handling**: Is error handling adequate?

For each suggestion:
- Explain why the change improves the code
- Show the before/after code
- Note any risks or considerations`
    };
  }

  /**
   * /test handler - Generate tests
   */
  async testHandler(context) {
    const { args, fileContext } = context;
    const targetFile = args?.[0];

    let codeToTest = '';
    let testTarget = '';
    let framework = 'jest'; // Default

    if (targetFile && await fs.pathExists(targetFile)) {
      codeToTest = await fs.readFile(targetFile, 'utf8');
      testTarget = targetFile;
    } else if (fileContext && Object.keys(fileContext).length > 0) {
      const files = Object.keys(fileContext);
      testTarget = files[0];
      codeToTest = fileContext[files[0]];
    }

    if (!codeToTest) {
      return {
        type: 'message',
        content: 'No code to test. Specify a file or add files to context.'
      };
    }

    // Detect test framework
    try {
      const pkg = await fs.readJson(path.join(process.cwd(), 'package.json'));
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };

      if (deps.vitest) framework = 'vitest';
      else if (deps.mocha) framework = 'mocha';
      else if (deps.ava) framework = 'ava';
      else if (deps.jest) framework = 'jest';
      else if (deps.pytest) framework = 'pytest';
    } catch {
      // Use default
    }

    return {
      type: 'prompt',
      prompt: `Generate comprehensive tests for the following code from ${testTarget} using ${framework}:

\`\`\`
${codeToTest.substring(0, 6000)}${codeToTest.length > 6000 ? '\n... (truncated)' : ''}
\`\`\`

Generate tests that include:

1. **Unit Tests**: Test each function/method individually
2. **Edge Cases**: Handle boundary conditions and unusual inputs
3. **Error Cases**: Test error handling and exceptions
4. **Integration**: Test component interactions if applicable
5. **Mocks/Stubs**: Set up necessary mocks for external dependencies

Use ${framework} syntax and best practices. Include:
- Clear test descriptions
- Setup and teardown where needed
- Appropriate assertions
- Comments explaining what each test verifies`
    };
  }

  /**
   * /docs handler - Generate documentation
   */
  async docsHandler(context) {
    const { args, fileContext } = context;
    const targetFile = args?.[0];

    let codeToDocument = '';
    let docTarget = '';

    if (targetFile && await fs.pathExists(targetFile)) {
      codeToDocument = await fs.readFile(targetFile, 'utf8');
      docTarget = targetFile;
    } else if (fileContext && Object.keys(fileContext).length > 0) {
      const files = Object.keys(fileContext);
      docTarget = files[0];
      codeToDocument = fileContext[files[0]];
    }

    if (!codeToDocument) {
      return {
        type: 'message',
        content: 'No code to document. Specify a file or add files to context.'
      };
    }

    // Detect language for doc style
    const ext = path.extname(docTarget);
    let docStyle = 'JSDoc';
    if (['.py'].includes(ext)) docStyle = 'docstring';
    else if (['.ts', '.tsx'].includes(ext)) docStyle = 'TSDoc';
    else if (['.java'].includes(ext)) docStyle = 'Javadoc';
    else if (['.go'].includes(ext)) docStyle = 'Go doc';

    return {
      type: 'prompt',
      prompt: `Generate documentation for the following code from ${docTarget} using ${docStyle} style:

\`\`\`
${codeToDocument.substring(0, 6000)}${codeToDocument.length > 6000 ? '\n... (truncated)' : ''}
\`\`\`

Generate comprehensive documentation including:

1. **File/Module Overview**: Brief description of the file's purpose
2. **Function/Method Docs**: Document each function with:
   - Description
   - Parameters (name, type, description)
   - Return value (type, description)
   - Throws/Raises (if applicable)
   - Examples where helpful
3. **Class Docs**: Document classes with:
   - Class description
   - Constructor parameters
   - Properties
   - Methods
4. **Type Definitions**: Document interfaces/types if present

Use ${docStyle} format. Show the documented code inline.`
    };
  }

  /**
   * /fix handler - Fix errors
   */
  async fixHandler(context) {
    const { args, fileContext, lastError } = context;
    const target = args?.join(' ') || '';

    let errorInfo = '';
    let codeContext = '';

    if (target) {
      // Check if target is a file
      if (await fs.pathExists(target)) {
        codeContext = await fs.readFile(target, 'utf8');
        errorInfo = 'File provided, analyze for issues';
      } else {
        // Treat as error message
        errorInfo = target;
      }
    } else if (lastError) {
      errorInfo = lastError;
    }

    // Add file context
    if (fileContext && Object.keys(fileContext).length > 0) {
      const files = Object.keys(fileContext).slice(0, 3);
      codeContext = files.map(f => `// ${f}\n${fileContext[f].substring(0, 2000)}`).join('\n\n');
    }

    if (!errorInfo && !codeContext) {
      return {
        type: 'message',
        content: 'No error to fix. Provide an error message or file, or add files to context.'
      };
    }

    return {
      type: 'prompt',
      prompt: `Fix the following error/issue:

${errorInfo ? `**Error:**\n\`\`\`\n${errorInfo}\n\`\`\`` : ''}

${codeContext ? `**Relevant Code:**\n\`\`\`\n${codeContext.substring(0, 5000)}\n\`\`\`` : ''}

Analyze the error and:

1. **Identify the root cause** of the error
2. **Explain why** it's happening
3. **Provide the fix** with corrected code
4. **Suggest prevention** for similar issues in the future

Be specific about what changes are needed and where.`
    };
  }

  /**
   * /debug handler - Debug assistance
   */
  async debugHandler(context) {
    const { args, fileContext, lastOutput } = context;
    const target = args?.join(' ') || '';

    let debugInfo = '';
    let codeContext = '';

    if (target) {
      if (await fs.pathExists(target)) {
        codeContext = await fs.readFile(target, 'utf8');
        debugInfo = `Debug file: ${target}`;
      } else {
        debugInfo = target;
      }
    }

    if (lastOutput) {
      debugInfo += `\n\nRecent output:\n${lastOutput}`;
    }

    if (fileContext && Object.keys(fileContext).length > 0) {
      const files = Object.keys(fileContext).slice(0, 3);
      codeContext = files.map(f => `// ${f}\n${fileContext[f].substring(0, 2000)}`).join('\n\n');
    }

    return {
      type: 'prompt',
      prompt: `Help debug the following issue:

${debugInfo ? `**Issue Description:**\n${debugInfo}` : 'User needs help debugging.'}

${codeContext ? `**Code Context:**\n\`\`\`\n${codeContext.substring(0, 5000)}\n\`\`\`` : ''}

Help debug by:

1. **Identifying potential issues** in the code or description
2. **Suggesting debugging steps** to isolate the problem
3. **Recommending console.log/print statements** to add
4. **Proposing fixes** for likely issues
5. **Suggesting tools** (debugger, profiler) if appropriate

Ask clarifying questions if needed.`
    };
  }
}
