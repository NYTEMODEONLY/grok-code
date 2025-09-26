import { GrokAPI } from '../api/grok-client.js';
import { logger } from '../utils/logger.js';
import { readFileSync } from 'fs';
import path from 'path';

export class AIFixGenerator {
  constructor() {
    this.grokAPI = new GrokAPI();
    this.maxRetries = 3;
    this.timeoutMs = 30000; // 30 second timeout
  }

  /**
   * Generate an AI-powered fix suggestion for a complex error
   * @param {Object} error - Classified error object
   * @param {Object} context - Full context including file content, related files, project info
   * @returns {Promise<Object>} Fix suggestion with confidence and explanation
   */
  async generateFix(error, context) {
    try {
      logger.info(`Generating AI fix for error: ${error.message}`);

      const prompt = this.buildPrompt(error, context);
      const response = await this.callGrokAPI(prompt);

      return this.parseResponse(response, error, context);
    } catch (error) {
      logger.error('AI fix generation failed', error);
      return {
        success: false,
        reason: `AI fix generation failed: ${error.message}`,
        confidence: 0,
      };
    }
  }

  /**
   * Build a comprehensive prompt for Grok to generate a fix
   */
  buildPrompt(error, context) {
    const {
      filePath,
      fileContent,
      relatedFiles = [],
      projectInfo = {},
      framework = null,
      dependencies = [],
    } = context;

    let prompt = `You are an expert software engineer helping fix a coding error. Please analyze the following error and provide a precise, working fix.

**ERROR DETAILS:**
- File: ${filePath}
- Line: ${error.line}
- Error Type: ${error.type}
- Error Message: ${error.message}
- Severity: ${error.severity}

**CURRENT CODE CONTEXT:**
\`\`\`
${fileContent}
\`\`\`

**PROJECT CONTEXT:**
${this.buildProjectContext(projectInfo, framework, dependencies)}

**RELATED FILES:**
${this.buildRelatedFilesContext(relatedFiles)}

**INSTRUCTIONS:**
1. Analyze the error and understand its root cause
2. Provide a precise code fix that resolves the error
3. Explain why this fix works and any potential side effects
4. If the fix requires changes to multiple files, specify all changes needed
5. Ensure the fix follows best practices and project conventions

**RESPONSE FORMAT:**
Provide your response in JSON format with this structure:
{
  "fix": "The exact code changes needed",
  "explanation": "Why this fix works",
  "confidence": 0.0-1.0,
  "changes": [
    {
      "file": "relative/path/to/file.js",
      "type": "replace|insert|delete",
      "line": 123,
      "oldCode": "existing code to replace",
      "newCode": "new code to insert"
    }
  ],
  "warnings": ["Any potential issues or side effects"]
}

Be precise and provide only the JSON response.`;

    return prompt;
  }

  /**
   * Build project context information for the prompt
   */
  buildProjectContext(projectInfo, framework, dependencies) {
    let context = '';

    if (framework) {
      context += `- Framework: ${framework}\n`;
    }

    if (projectInfo.language) {
      context += `- Language: ${projectInfo.language}\n`;
    }

    if (projectInfo.nodeVersion) {
      context += `- Node.js: ${projectInfo.nodeVersion}\n`;
    }

    if (dependencies.length > 0) {
      context += `- Key Dependencies: ${dependencies.slice(0, 10).join(', ')}\n`;
    }

    if (projectInfo.conventions) {
      context += `- Project Conventions: ${projectInfo.conventions}\n`;
    }

    return context || '- No specific project context available';
  }

  /**
   * Build context from related files
   */
  buildRelatedFilesContext(relatedFiles) {
    if (relatedFiles.length === 0) {
      return 'No related files provided';
    }

    let context = '';
    for (const file of relatedFiles.slice(0, 3)) {
      // Limit to 3 most relevant files
      context += `\n**${file.path}:**\n`;
      context += '```javascript\n';
      context += file.content || '// File content not available';
      context += '\n```\n';
    }

    return context;
  }

  /**
   * Call Grok API with retry logic
   */
  async callGrokAPI(prompt, retryCount = 0) {
    try {
      const response = await Promise.race([
        this.grokAPI.generateFix(prompt),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Timeout')), this.timeoutMs)
        ),
      ]);

      return response;
    } catch (error) {
      if (retryCount < this.maxRetries) {
        logger.warn(
          `Grok API call failed, retrying (${retryCount + 1}/${this.maxRetries})`,
          error.message
        );
        await this.delay(1000 * (retryCount + 1)); // Exponential backoff
        return this.callGrokAPI(prompt, retryCount + 1);
      }
      throw error;
    }
  }

  /**
   * Parse Grok's response into structured fix data
   */
  parseResponse(response, error, context) {
    try {
      // Extract JSON from response (handle potential markdown formatting)
      let jsonText = response;

      // Remove markdown code blocks if present
      if (jsonText.includes('```json')) {
        jsonText = jsonText.split('```json')[1].split('```')[0].trim();
      } else if (jsonText.includes('```')) {
        jsonText = jsonText.split('```')[1].split('```')[0].trim();
      }

      const fixData = JSON.parse(jsonText);

      // Validate required fields
      if (!fixData.fix || !fixData.explanation) {
        throw new Error('Invalid response format: missing required fields');
      }

      // Ensure confidence is a number between 0 and 1
      const confidence =
        typeof fixData.confidence === 'number'
          ? Math.max(0, Math.min(1, fixData.confidence))
          : 0.7;

      return {
        success: true,
        fix: fixData.fix,
        explanation: fixData.explanation,
        confidence: confidence,
        changes: fixData.changes || [],
        warnings: fixData.warnings || [],
        metadata: {
          aiGenerated: true,
          model: 'grok',
          timestamp: new Date().toISOString(),
          errorType: error.type,
          complexity: this.assessFixComplexity(fixData.changes || []),
        },
      };
    } catch (parseError) {
      logger.error('Failed to parse AI response', parseError);
      return {
        success: false,
        reason: `Failed to parse AI response: ${parseError.message}`,
        confidence: 0,
        rawResponse: response,
      };
    }
  }

  /**
   * Assess the complexity of a proposed fix
   */
  assessFixComplexity(changes) {
    if (!changes || changes.length === 0) return 'simple';

    let complexity = 0;

    for (const change of changes) {
      switch (change.type) {
        case 'insert':
        case 'delete':
          complexity += 1;
          break;
        case 'replace':
          complexity += 2;
          break;
      }

      // Add complexity for multi-line changes
      if (change.newCode && change.newCode.split('\n').length > 3) {
        complexity += 2;
      }
    }

    // Multi-file changes are more complex
    if (changes.length > 1) {
      complexity += changes.length;
    }

    if (complexity <= 2) return 'simple';
    if (complexity <= 5) return 'medium';
    return 'complex';
  }

  /**
   * Utility delay function for retry logic
   */
  delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get statistics about AI fix generation performance
   */
  getStats() {
    return {
      totalRequests: this.grokAPI ? this.grokAPI.requestCount || 0 : 0,
      averageResponseTime: this.grokAPI
        ? this.grokAPI.averageResponseTime || 0
        : 0,
      successRate: this.grokAPI ? this.grokAPI.successRate || 0 : 0,
    };
  }
}
