/**
 * AskUserQuestion Tool
 * Interactive prompts for gathering user input during AI execution
 */

import { BaseTool } from './base-tool.js';
import readline from 'readline';

export class AskUserQuestionTool extends BaseTool {
  constructor(options = {}) {
    super({
      name: 'AskUserQuestion',
      description: 'Ask the user questions to gather preferences, clarify requirements, or get decisions during execution. Supports single-select and multi-select questions.',
      parameters: {
        type: 'object',
        properties: {
          questions: {
            type: 'array',
            description: 'Array of questions to ask (1-4 questions)',
            items: {
              type: 'object',
              properties: {
                question: {
                  type: 'string',
                  description: 'The complete question to ask the user'
                },
                header: {
                  type: 'string',
                  description: 'Short label for the question (max 12 chars)'
                },
                options: {
                  type: 'array',
                  description: 'Available choices (2-4 options)',
                  items: {
                    type: 'object',
                    properties: {
                      label: {
                        type: 'string',
                        description: 'Display text for this option (1-5 words)'
                      },
                      description: {
                        type: 'string',
                        description: 'Explanation of what this option means'
                      }
                    },
                    required: ['label', 'description']
                  },
                  minItems: 2,
                  maxItems: 4
                },
                multiSelect: {
                  type: 'boolean',
                  description: 'Allow multiple selections (default: false)',
                  default: false
                }
              },
              required: ['question', 'header', 'options']
            },
            minItems: 1,
            maxItems: 4
          }
        },
        required: ['questions']
      },
      requiresPermission: false,
      isReadOnly: true,
      timeout: 300000, // 5 minutes for user input
      ...options
    });

    this.readline = null;
  }

  /**
   * Execute the user question
   * @param {Object} params - { questions }
   * @param {Object} context - Execution context
   */
  async execute(params, context = {}) {
    const { questions } = params;

    if (!questions || questions.length === 0) {
      return {
        success: false,
        error: 'No questions provided'
      };
    }

    const answers = {};

    try {
      // Create readline interface
      this.readline = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });

      console.log('\n' + '═'.repeat(50));
      console.log('📋 Questions from Grok');
      console.log('═'.repeat(50) + '\n');

      for (const q of questions) {
        const answer = await this.askQuestion(q);
        answers[q.header] = answer;
      }

      // Close readline
      this.readline.close();
      this.readline = null;

      console.log('\n' + '─'.repeat(50) + '\n');

      return {
        success: true,
        answers,
        questionsAsked: questions.length
      };

    } catch (error) {
      if (this.readline) {
        this.readline.close();
        this.readline = null;
      }

      return {
        success: false,
        error: error.message,
        partialAnswers: answers
      };
    }
  }

  /**
   * Ask a single question and get the answer
   * @param {Object} question - Question object
   * @returns {Promise<string|Array>} User's answer
   */
  async askQuestion(question) {
    const { question: text, header, options, multiSelect = false } = question;

    console.log(`\n[${header}]`);
    console.log(`${text}\n`);

    // Display options
    options.forEach((opt, idx) => {
      console.log(`  ${idx + 1}. ${opt.label}`);
      if (opt.description) {
        console.log(`     ${opt.description}`);
      }
    });

    // Add "Other" option
    console.log(`  ${options.length + 1}. Other (enter custom response)`);
    console.log('');

    if (multiSelect) {
      console.log('(Enter numbers separated by commas, e.g., 1,3)');
    }

    const prompt = multiSelect ? 'Your choices: ' : 'Your choice: ';

    return new Promise((resolve) => {
      this.readline.question(prompt, (input) => {
        input = input.trim();

        if (!input) {
          // Default to first option
          resolve(options[0].label);
          return;
        }

        if (multiSelect) {
          // Parse multiple selections
          const selections = input.split(',').map(s => s.trim());
          const results = [];

          for (const sel of selections) {
            const idx = parseInt(sel, 10) - 1;
            if (idx >= 0 && idx < options.length) {
              results.push(options[idx].label);
            } else if (idx === options.length) {
              // "Other" selected
              results.push('Other');
            }
          }

          resolve(results.length > 0 ? results : [options[0].label]);
        } else {
          // Single selection
          const idx = parseInt(input, 10) - 1;

          if (idx >= 0 && idx < options.length) {
            resolve(options[idx].label);
          } else if (idx === options.length) {
            // "Other" selected - prompt for custom input
            this.readline.question('Enter your response: ', (custom) => {
              resolve(custom.trim() || options[0].label);
            });
          } else if (isNaN(idx)) {
            // User typed a custom response directly
            resolve(input);
          } else {
            resolve(options[0].label);
          }
        }
      });
    });
  }

  /**
   * Format result for display
   * @param {Object} result - Tool execution result
   * @returns {string} Formatted output
   */
  formatResult(result) {
    if (!result.success) {
      return `Question failed: ${result.error}`;
    }

    let output = '## User Responses\n\n';

    for (const [header, answer] of Object.entries(result.answers)) {
      const formattedAnswer = Array.isArray(answer) ? answer.join(', ') : answer;
      output += `**${header}:** ${formattedAnswer}\n`;
    }

    return output;
  }

  /**
   * Create a simple yes/no question
   * @param {string} question - The question text
   * @returns {Object} Question object
   */
  static yesNo(question, header = 'Confirm') {
    return {
      question,
      header,
      options: [
        { label: 'Yes', description: 'Proceed with this action' },
        { label: 'No', description: 'Cancel or choose differently' }
      ],
      multiSelect: false
    };
  }

  /**
   * Create a choice question from simple strings
   * @param {string} question - The question text
   * @param {Array<string>} choices - Array of choice strings
   * @param {string} header - Question header
   * @returns {Object} Question object
   */
  static fromChoices(question, choices, header = 'Choice') {
    return {
      question,
      header,
      options: choices.slice(0, 4).map(c => ({
        label: c,
        description: ''
      })),
      multiSelect: false
    };
  }
}

export default AskUserQuestionTool;
