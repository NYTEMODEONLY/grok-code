import { logger } from '../utils/logger.js';

/**
 * Framework-Specific Prompt and Rules Loader
 * Dynamically loads prompts and behavioral rules based on detected frameworks
 */
export class FrameworkPromptLoader {
  constructor(options = {}) {
    this.projectRoot = options.projectRoot || process.cwd();
    this.frameworkPrompts = this.initializeFrameworkPrompts();
    this.frameworkRules = this.initializeFrameworkRules();

    logger.info('Framework prompt loader initialized', {
      frameworksWithPrompts: Object.keys(this.frameworkPrompts).length,
      frameworksWithRules: Object.keys(this.frameworkRules).length
    });
  }

  /**
   * Initialize framework-specific prompts
   */
  initializeFrameworkPrompts() {
    return {
      react: {
        systemPrompt: `You are working with a React application. Always consider:
- Component lifecycle, hooks, and state management patterns
- JSX syntax and React-specific conventions
- Performance optimization with useMemo, useCallback, React.memo
- Proper key props for list rendering
- Controlled vs uncontrolled components
- Error boundaries and error handling
- Testing with React Testing Library and Jest`,

        codeGenerationPrompt: `Generate React code following these patterns:
- Use functional components with hooks over class components
- Prefer custom hooks for reusable logic
- Use TypeScript interfaces for props and state
- Implement proper error boundaries
- Follow React performance best practices
- Use meaningful component and hook names`,

        reviewPrompt: `Review this React code for:
- Proper hook usage and dependencies
- Component composition and reusability
- Performance optimizations
- Accessibility compliance
- React best practices and patterns`
      },

      vue: {
        systemPrompt: `You are working with a Vue.js application. Always consider:
- Vue 3 Composition API vs Options API patterns
- Reactive data with ref() and reactive()
- Lifecycle hooks and their timing
- Component communication (props, emit, provide/inject)
- Vue Router for navigation
- Pinia/Vuex for state management
- SFC (Single File Component) structure`,

        codeGenerationPrompt: `Generate Vue.js code following these patterns:
- Use Composition API for new components
- Define props with proper TypeScript interfaces
- Use reactive() for complex objects, ref() for primitives
- Implement proper component lifecycle management
- Follow Vue 3 script setup syntax
- Use meaningful component and composable names`,

        reviewPrompt: `Review this Vue.js code for:
- Proper reactive data usage
- Composition API best practices
- Component lifecycle management
- Performance optimizations
- Vue.js conventions and patterns`
      },

      angular: {
        systemPrompt: `You are working with an Angular application. Always consider:
- Angular component lifecycle and change detection
- Dependency injection and service patterns
- RxJS observables and operators
- Angular modules and component architecture
- Template syntax and data binding
- Angular CLI conventions
- Testing with Jasmine and Karma`,

        codeGenerationPrompt: `Generate Angular code following these patterns:
- Use standalone components where possible
- Implement proper dependency injection
- Use Angular signals for reactive state (Angular 17+)
- Follow Angular style guide conventions
- Use meaningful component and service names
- Implement OnPush change detection strategy`,

        reviewPrompt: `Review this Angular code for:
- Proper dependency injection usage
- Change detection optimization
- RxJS best practices
- Angular style guide compliance
- Performance optimizations`
      },

      express: {
        systemPrompt: `You are working with an Express.js application. Always consider:
- RESTful API design patterns
- Middleware usage and order
- Error handling with next() and error middleware
- Route organization and modular structure
- Authentication and authorization patterns
- Database integration patterns
- Input validation and sanitization`,

        codeGenerationPrompt: `Generate Express.js code following these patterns:
- Use router modules for route organization
- Implement proper middleware chains
- Use async/await with proper error handling
- Validate input data with middleware
- Follow REST API conventions
- Implement proper error responses`,

        reviewPrompt: `Review this Express.js code for:
- Proper middleware usage and ordering
- Error handling patterns
- Security best practices
- REST API conventions
- Input validation and sanitization`
      },

      django: {
        systemPrompt: `You are working with a Django application. Always consider:
- Django MTV (Model-Template-View) architecture
- Django ORM and query optimization
- URL routing and view patterns
- Django forms and validation
- Authentication and permissions
- Django admin customization
- Testing with Django's test framework`,

        codeGenerationPrompt: `Generate Django code following these patterns:
- Use class-based views where appropriate
- Implement proper model relationships
- Use Django forms for data validation
- Follow Django URL naming conventions
- Implement proper permission checking
- Use meaningful model and view names`,

        reviewPrompt: `Review this Django code for:
- Proper ORM usage and query optimization
- Security best practices
- Django conventions and patterns
- Model design and relationships
- View and URL organization`
      },

      flask: {
        systemPrompt: `You are working with a Flask application. Always consider:
- Flask application factory pattern
- Blueprint organization for large apps
- Flask-WTF for form handling
- Flask-SQLAlchemy for database operations
- Flask-Login for authentication
- Error handling and logging
- Testing with pytest and Flask's test client`,

        codeGenerationPrompt: `Generate Flask code following these patterns:
- Use application factory pattern
- Organize routes with blueprints
- Implement proper error handling
- Use Flask-WTF for form validation
- Follow Flask naming conventions
- Implement proper logging`,

        reviewPrompt: `Review this Flask code for:
- Proper application structure
- Security best practices
- Error handling patterns
- Blueprint organization
- Database interaction patterns`
      },

      fastapi: {
        systemPrompt: `You are working with a FastAPI application. Always consider:
- Async/await patterns and coroutines
- Pydantic models for data validation
- FastAPI dependency injection system
- OpenAPI/Swagger documentation generation
- HTTP status codes and response models
- Authentication and authorization
- Testing with pytest and httpx`,

        codeGenerationPrompt: `Generate FastAPI code following these patterns:
- Use async functions for I/O operations
- Define proper Pydantic models
- Implement dependency injection
- Use proper HTTP status codes
- Document APIs with docstrings
- Implement proper error responses`,

        reviewPrompt: `Review this FastAPI code for:
- Proper async/await usage
- Pydantic model validation
- API documentation quality
- Dependency injection patterns
- Error handling and status codes`
      },

      commander: {
        systemPrompt: `You are working with a Commander.js CLI application. Always consider:
- Command structure and subcommand organization
- Option parsing and validation
- Help text and command descriptions
- Error handling and user feedback
- Configuration management
- Interactive prompts with inquirer
- Progress indicators with ora`,

        codeGenerationPrompt: `Generate Commander.js code following these patterns:
- Use program.command() for subcommands
- Implement proper option validation
- Provide helpful help text and examples
- Handle errors gracefully with user feedback
- Use async/await for asynchronous operations
- Implement proper exit codes`,

        reviewPrompt: `Review this Commander.js code for:
- Command structure and organization
- Option handling and validation
- User experience and help text
- Error handling patterns
- CLI conventions and best practices`
      },

      ora: {
        systemPrompt: `You are working with Ora for CLI progress indicators. Always consider:
- Spinner states: start(), succeed(), fail(), warn(), info()
- Spinner customization and styling
- Integration with async operations
- Proper cleanup and error handling
- User experience and feedback timing
- Combining with other CLI libraries`,

        codeGenerationPrompt: `Generate Ora code following these patterns:
- Use descriptive spinner messages
- Handle async operations with proper spinner states
- Implement error states with fail() and warn()
- Use succeed() for successful operations
- Clean up spinners in error cases
- Provide meaningful progress feedback`,

        reviewPrompt: `Review this Ora code for:
- Proper spinner state management
- Error handling and cleanup
- User experience and timing
- Integration with async operations
- Spinner message clarity and usefulness`
      },

      inquirer: {
        systemPrompt: `You are working with Inquirer.js for interactive CLI prompts. Always consider:
- Question types: input, confirm, list, checkbox, password, etc.
- Validation and filtering of user input
- Default values and choices
- Error handling and retry logic
- Integration with Commander.js commands
- User experience and prompt flow
- Accessibility and usability`,

        codeGenerationPrompt: `Generate Inquirer.js code following these patterns:
- Use appropriate question types for data collection
- Implement proper validation functions
- Provide meaningful prompts and help text
- Handle user input errors gracefully
- Use async/await with prompt() method
- Structure prompts as reusable arrays
- Consider prompt flow and user experience`,

        reviewPrompt: `Review this Inquirer.js code for:
- Question type appropriateness
- Input validation and error handling
- User experience and prompt clarity
- Integration with CLI workflow
- Accessibility considerations
- Error recovery and retry logic`
      },

      nodejs: {
        systemPrompt: `You are working with a Node.js application. Always consider:
- CommonJS vs ES modules patterns
- Asynchronous programming with promises/async-await
- Error handling and propagation
- Stream usage for large data processing
- Memory management and garbage collection
- npm package management
- Node.js best practices and security`,

        codeGenerationPrompt: `Generate Node.js code following these patterns:
- Use async/await for asynchronous operations
- Implement proper error handling
- Use streams for large data processing
- Follow Node.js naming conventions
- Implement proper module exports
- Handle process signals and graceful shutdown`,

        reviewPrompt: `Review this Node.js code for:
- Asynchronous programming patterns
- Error handling and propagation
- Memory usage and performance
- Security best practices
- Module organization and exports`
      }
    };
  }

  /**
   * Initialize framework-specific behavioral rules
   */
  initializeFrameworkRules() {
    return {
      react: {
        fileNaming: {
          components: 'PascalCase',
          hooks: 'camelCase with use prefix',
          utils: 'camelCase',
          types: 'PascalCase'
        },
        importOrder: ['react', 'third-party', 'local components', 'local utils', 'types'],
        componentPatterns: {
          preferFunctional: true,
          useCustomHooks: true,
          avoidClassComponents: true
        }
      },

      vue: {
        fileNaming: {
          components: 'PascalCase',
          composables: 'camelCase with use prefix',
          stores: 'camelCase',
          types: 'PascalCase'
        },
        importOrder: ['vue', 'third-party', 'local composables', 'local components', 'types'],
        componentPatterns: {
          preferCompositionApi: true,
          useScriptSetup: true,
          avoidOptionsApi: false // Allow both for compatibility
        }
      },

      angular: {
        fileNaming: {
          components: 'kebab-case for selectors, PascalCase for classes',
          services: 'PascalCase with Service suffix',
          modules: 'PascalCase with Module suffix',
          types: 'PascalCase'
        },
        importOrder: ['angular core', 'angular common', 'third-party', 'local services', 'local components', 'types'],
        componentPatterns: {
          preferStandalone: true,
          useSignals: true,
          implementOnPush: true
        }
      },

      express: {
        fileNaming: {
          routes: 'camelCase',
          middleware: 'camelCase',
          controllers: 'camelCase',
          models: 'PascalCase'
        },
        importOrder: ['express', 'third-party middleware', 'local middleware', 'local routes', 'utils'],
        apiPatterns: {
          useAsyncAwait: true,
          validateInput: true,
          implementErrorHandling: true
        }
      },

      commander: {
        fileNaming: {
          commands: 'camelCase',
          utils: 'camelCase',
          config: 'camelCase'
        },
        importOrder: ['commander', 'inquirer', 'ora', 'fs-extra', 'local utils'],
        cliPatterns: {
          useSubcommands: true,
          provideHelp: true,
          handleErrors: true
        }
      },

      ora: {
        fileNaming: {
          spinners: 'camelCase',
          utils: 'camelCase',
          config: 'camelCase'
        },
        importOrder: ['ora', 'chalk', 'local utils'],
        cliPatterns: {
          handleAsyncOperations: true,
          provideUserFeedback: true,
          cleanupOnError: true
        }
      },

      inquirer: {
        fileNaming: {
          prompts: 'camelCase',
          validators: 'camelCase',
          utils: 'camelCase'
        },
        importOrder: ['inquirer', 'chalk', 'fs-extra', 'local utils'],
        cliPatterns: {
          validateUserInput: true,
          provideHelpText: true,
          handleErrorsGracefully: true
        }
      }
    };
  }

  /**
   * Load prompts for detected frameworks
   * @param {Array} detectedFrameworks - Array of detected framework objects
   * @returns {Object} Combined prompts for all frameworks
   */
  loadPrompts(detectedFrameworks) {
    const prompts = {
      systemPrompt: '',
      codeGenerationPrompt: '',
      reviewPrompt: '',
      frameworks: []
    };

    // Filter frameworks that have prompts
    const frameworksWithPrompts = detectedFrameworks.filter(fw =>
      this.hasPrompts(fw.name)
    );

    if (frameworksWithPrompts.length === 0) {
      prompts.systemPrompt = 'You are working with a general software development project. Provide helpful, accurate coding assistance.';
      return prompts;
    }

    // Combine prompts from all detected frameworks
    const systemPrompts = [];
    const codeGenPrompts = [];
    const reviewPrompts = [];

    frameworksWithPrompts.forEach(fw => {
      const normalizedName = this.normalizeFrameworkName(fw.name);
      const fwPrompts = this.frameworkPrompts[normalizedName];
      if (fwPrompts) {
        systemPrompts.push(fwPrompts.systemPrompt);
        codeGenPrompts.push(fwPrompts.codeGenerationPrompt);
        reviewPrompts.push(fwPrompts.reviewPrompt);
      }

      prompts.frameworks.push({
        name: fw.name,
        category: fw.category,
        confidence: fw.confidence
      });
    });

    // Combine all framework prompts
    prompts.systemPrompt = systemPrompts.join('\n\n');
    prompts.codeGenerationPrompt = codeGenPrompts.join('\n\n');
    prompts.reviewPrompt = reviewPrompts.join('\n\n');

    logger.debug('Loaded framework prompts', {
      frameworks: prompts.frameworks.length,
      combinedPrompts: true
    });

    return prompts;
  }

  /**
   * Get behavioral rules for detected frameworks
   * @param {Array} detectedFrameworks - Array of detected framework objects
   * @returns {Object} Combined behavioral rules
   */
  getRules(detectedFrameworks) {
    const rules = {
      fileNaming: {},
      importOrder: [],
      patterns: {},
      frameworks: []
    };

    // Get rules for each detected framework
    detectedFrameworks.forEach(fw => {
      const normalizedName = this.normalizeFrameworkName(fw.name);
      if (this.frameworkRules[normalizedName]) {
        const fwRules = this.frameworkRules[normalizedName];

        // Merge file naming rules
        Object.assign(rules.fileNaming, fwRules.fileNaming);

        // Merge import order (avoid duplicates)
        fwRules.importOrder.forEach(order => {
          if (!rules.importOrder.includes(order)) {
            rules.importOrder.push(order);
          }
        });

        // Merge patterns
        Object.assign(rules.patterns, fwRules.componentPatterns || fwRules.apiPatterns || fwRules.cliPatterns);

        rules.frameworks.push({
          name: fw.name,
          category: fw.category,
          confidence: fw.confidence
        });
      }
    });

    return rules;
  }

  /**
   * Get contextual prompts based on operation type
   * @param {Array} detectedFrameworks - Detected frameworks
   * @param {string} operationType - Type of operation (codegen, review, general)
   * @returns {string} Contextual prompt
   */
  getContextualPrompt(detectedFrameworks, operationType = 'general') {
    const frameworks = detectedFrameworks.filter(fw =>
      this.frameworkPrompts[fw.name.toLowerCase()]
    );

    if (frameworks.length === 0) {
      return 'Provide helpful coding assistance for this project.';
    }

    const prompts = frameworks.map(fw => {
      const normalizedName = this.normalizeFrameworkName(fw.name);
      const fwPrompts = this.frameworkPrompts[normalizedName];
      if (!fwPrompts) return '';

      switch (operationType) {
        case 'codegen':
          return fwPrompts.codeGenerationPrompt;
        case 'review':
          return fwPrompts.reviewPrompt;
        default:
          return fwPrompts.systemPrompt;
      }
    }).filter(p => p);

    return prompts.join('\n\n');
  }

  /**
   * Normalize framework name for matching
   * @param {string} frameworkName - Raw framework name
   * @returns {string} Normalized framework name
   */
  normalizeFrameworkName(frameworkName) {
    return frameworkName
      .toLowerCase()
      .replace(/\s*\.js$/, '') // Remove .js suffix
      .replace(/\s+/g, '') // Remove spaces
      .replace(/\./g, ''); // Remove dots
  }

  /**
   * Check if a framework has specific prompts available
   * @param {string} frameworkName - Name of the framework
   * @returns {boolean} Whether prompts are available
   */
  hasPrompts(frameworkName) {
    const normalized = this.normalizeFrameworkName(frameworkName);
    return !!this.frameworkPrompts[normalized];
  }

  /**
   * Check if a framework has specific rules available
   * @param {string} frameworkName - Name of the framework
   * @returns {boolean} Whether rules are available
   */
  hasRules(frameworkName) {
    const normalized = this.normalizeFrameworkName(frameworkName);
    return !!this.frameworkRules[normalized];
  }

  /**
   * Get all supported frameworks with prompts
   * @returns {Array} Array of supported framework names
   */
  getSupportedFrameworks() {
    return Object.keys(this.frameworkPrompts);
  }
}
