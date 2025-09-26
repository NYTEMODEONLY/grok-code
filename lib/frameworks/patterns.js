import fs from 'fs-extra';
import path from 'path';

// Create a simple console logger to avoid import issues
const logger = {
  info: (...args) => console.log('[INFO]', ...args),
  debug: (...args) => process.env.DEBUG ? console.log('[DEBUG]', ...args) : undefined,
  warn: (...args) => console.warn('[WARN]', ...args),
  error: (...args) => console.error('[ERROR]', ...args)
};

/**
 * Framework Patterns and Conventions Knowledge Base
 * Contains detailed patterns, conventions, and best practices for popular frameworks
 */
export class FrameworkPatterns {
  constructor() {
    this.patterns = {
      react: {
        name: 'React',
        category: 'frontend',
        patterns: {
          hooks: {
            useState: {
              pattern: /const\s*\[\s*\w+\s*,\s*\w+\s*\]\s*=\s*useState\s*\(/,
              description: 'React useState hook for state management',
              example: 'const [count, setCount] = useState(0);',
              conventions: ['Use descriptive names for state variables', 'Prefer functional updates for state changes']
            },
            useEffect: {
              pattern: /useEffect\s*\(\s*\(\)\s*=>\s*\{/,
              description: 'React useEffect hook for side effects',
              example: 'useEffect(() => { fetchData(); }, [dependency]);',
              conventions: ['Always include dependency array', 'Return cleanup function for subscriptions', 'Avoid infinite re-renders']
            },
            useCallback: {
              pattern: /const\s+\w+\s*=\s*useCallback\s*\(/,
              description: 'React useCallback hook for memoizing functions',
              example: 'const memoizedCallback = useCallback(() => { doSomething(a, b); }, [a, b]);',
              conventions: ['Use for functions passed to child components', 'Include all dependencies in dependency array']
            },
            useMemo: {
              pattern: /const\s+\w+\s*=\s*useMemo\s*\(/,
              description: 'React useMemo hook for memoizing expensive computations',
              example: 'const expensiveValue = useMemo(() => computeExpensiveValue(a, b), [a, b]);',
              conventions: ['Use for expensive calculations', 'Include all dependencies in dependency array']
            },
            useContext: {
              pattern: /const\s+\w+\s*=\s*useContext\s*\(/,
              description: 'React useContext hook for consuming context',
              example: 'const theme = useContext(ThemeContext);',
              conventions: ['Prefer useContext over Consumer components', 'Create custom hooks for complex context logic']
            }
          },
          components: {
            functionalComponent: {
              pattern: /function\s+\w+\s*\(\s*props\s*\)\s*\{/,
              description: 'Functional component pattern',
              example: 'function MyComponent(props) { return <div>Hello</div>; }',
              conventions: ['Use arrow functions for consistency', 'Destructure props in function parameters', 'Use PascalCase for component names']
            },
            arrowComponent: {
              pattern: /const\s+\w+\s*=\s*\(\s*props\s*\)\s*=>\s*\{/,
              description: 'Arrow function component pattern',
              example: 'const MyComponent = (props) => { return <div>Hello</div>; };',
              conventions: ['Use implicit return for simple components', 'Destructure props in parameters']
            },
            jsx: {
              pattern: /return\s*\(/,
              description: 'JSX return pattern',
              example: 'return (\n  <div>\n    <h1>Hello</h1>\n  </div>\n);',
              conventions: ['Always wrap JSX in parentheses', 'Use consistent indentation', 'One component per file']
            }
          },
          props: {
            propTypes: {
              pattern: /\w+\.propTypes\s*=\s*\{/,
              description: 'PropTypes validation',
              example: 'MyComponent.propTypes = {\n  name: PropTypes.string.isRequired,\n  age: PropTypes.number\n};',
              conventions: ['Define PropTypes for all components', 'Use isRequired for mandatory props', 'Consider using TypeScript for better type safety']
            },
            defaultProps: {
              pattern: /\w+\.defaultProps\s*=\s*\{/,
              description: 'Default props pattern',
              example: 'MyComponent.defaultProps = {\n  theme: \'light\'\n};',
              conventions: ['Provide sensible defaults', 'Use defaultProps sparingly with destructuring']
            }
          }
        },
        conventions: {
          fileNaming: ['Use PascalCase for component files (.jsx, .tsx)', 'Use index.js for folder-based components'],
          folderStructure: ['Group related components in folders', 'Use descriptive folder names', 'Separate hooks, utils, and types'],
          stateManagement: ['Lift state up when needed', 'Use reducer for complex state logic', 'Consider Context API for global state'],
          performance: ['Use React.memo for expensive components', 'Implement proper key props in lists', 'Lazy load components with React.lazy'],
          testing: ['Test user interactions, not implementation details', 'Use react-testing-library over enzyme', 'Mock external dependencies']
        },
        antiPatterns: [
          'Direct DOM manipulation',
          'Large components without decomposition',
          'Inline functions in render',
          'Deep component nesting',
          'Unnecessary re-renders'
        ]
      },

      vue: {
        name: 'Vue.js',
        category: 'frontend',
        patterns: {
          compositionApi: {
            setupFunction: {
              pattern: /setup\s*\(\s*props\s*,\s*context\s*\)\s*\{/,
              description: 'Vue 3 Composition API setup function',
              example: 'setup(props, { emit }) {\n  const count = ref(0);\n  return { count };\n}',
              conventions: ['Return reactive references', 'Use camelCase for variables', 'Destructure context parameters']
            },
            reactive: {
              pattern: /const\s+\w+\s*=\s*reactive\s*\(/,
              description: 'Vue reactive object pattern',
              example: 'const state = reactive({\n  count: 0,\n  name: \'Vue\'\n});',
              conventions: ['Use reactive for complex objects', 'Avoid mutating reactive objects directly', 'Prefer ref() for primitives']
            },
            ref: {
              pattern: /const\s+\w+\s*=\s*ref\s*\(/,
              description: 'Vue ref pattern for reactive primitives',
              example: 'const count = ref(0);\nconst name = ref(\'Vue\');',
              conventions: ['Use ref() for primitives', 'Access value with .value in setup', 'Use .value in template automatically']
            },
            computed: {
              pattern: /const\s+\w+\s*=\s*computed\s*\(/,
              description: 'Vue computed property pattern',
              example: 'const fullName = computed(() => `${firstName.value} ${lastName.value}`);',
              conventions: ['Use for derived state', 'Computed properties are cached', 'Can be readonly or writable']
            },
            watch: {
              pattern: /watch\s*\(\s*\w+/,
              description: 'Vue watcher pattern',
              example: 'watch(count, (newValue, oldValue) => {\n  console.log(\'Count changed:\', newValue);\n});',
              conventions: ['Use for side effects', 'Can watch multiple sources', 'Use watchEffect for automatic dependency tracking']
            }
          },
          optionsApi: {
            data: {
              pattern: /data\s*\(\)\s*\{/,
              description: 'Vue Options API data function',
              example: 'data() {\n  return {\n    count: 0,\n    message: \'Hello\'\n  };\n}',
              conventions: ['Always return an object', 'Use function syntax (not arrow)', 'Initialize with default values']
            },
            methods: {
              pattern: /methods\s*:\s*\{/,
              description: 'Vue Options API methods',
              example: 'methods: {\n  increment() {\n    this.count++;\n  }\n}',
              conventions: ['Use camelCase for method names', 'Access data with this.', 'Avoid arrow functions']
            },
            computed: {
              pattern: /computed\s*:\s*\{/,
              description: 'Vue Options API computed properties',
              example: 'computed: {\n  fullName() {\n    return `${this.firstName} ${this.lastName}`;\n  }\n}',
              conventions: ['Use function syntax', 'Cache results automatically', 'Can depend on other computed properties']
            }
          },
          template: {
            directives: {
              vIf: {
                pattern: /v-if\s*=\s*["'][^"']*["']/,
                description: 'Vue v-if directive',
                example: '<div v-if="isVisible">Content</div>',
                conventions: ['Use v-else/v-else-if for alternatives', 'Prefer computed properties for conditions', 'Consider v-show for frequent toggling']
              },
              vFor: {
                pattern: /v-for\s*=\s*["'][^"']*["']/,
                description: 'Vue v-for directive',
                example: '<li v-for="item in items" :key="item.id">{{ item.name }}</li>',
                conventions: ['Always use :key for performance', 'Use track-by for simple arrays', 'Prefer computed properties for filtered lists']
              },
              vModel: {
                pattern: /v-model\s*=\s*["'][^"']*["']/,
                description: 'Vue v-model directive',
                example: '<input v-model="message" />',
                conventions: ['Works with all form inputs', 'Can use modifiers (.lazy, .number, .trim)', 'Supports custom v-model in components']
              }
            }
          }
        },
        conventions: {
          fileNaming: ['Use PascalCase for component files (.vue)', 'Use kebab-case for component names in templates'],
          folderStructure: ['Group components by feature', 'Separate composables, utils, and types', 'Use index.js for folder exports'],
          reactivity: ['Avoid mutating props directly', 'Use emit for parent communication', 'Prefer composition API for new projects'],
          performance: ['Use keep-alive for component caching', 'Implement proper key props in v-for', 'Use async components for code splitting'],
          testing: ['Use Vue Test Utils for component testing', 'Test component behavior, not implementation', 'Mock external dependencies']
        },
        antiPatterns: [
          'Mutating props directly',
          'Using this.$parent or this.$children',
          'Large single-file components',
          'Mixing Options and Composition API',
          'Ignoring reactivity principles'
        ]
      },

      angular: {
        name: 'Angular',
        category: 'frontend',
        patterns: {
          decorators: {
            component: {
              pattern: /@Component\s*\(\s*\{/,
              description: 'Angular Component decorator',
              example: '@Component({\n  selector: \'app-my-component\',\n  templateUrl: \'./my-component.component.html\',\n  styleUrls: [\'./my-component.component.css\']\n})',
              conventions: ['Use kebab-case for selectors', 'Follow Angular naming conventions', 'Separate template and styles files']
            },
            injectable: {
              pattern: /@Injectable\s*\(\s*\{/,
              description: 'Angular Injectable decorator',
              example: '@Injectable({\n  providedIn: \'root\'\n})',
              conventions: ['Use providedIn: \'root\' for singleton services', 'Specify provider scope explicitly', 'Use interfaces for better typing']
            },
            input: {
              pattern: /@Input\s*\(\s*\)\s*\w+/,
              description: 'Angular Input decorator',
              example: '@Input() title: string;',
              conventions: ['Use descriptive property names', 'Provide default values when appropriate', 'Use setter/getter for complex logic']
            },
            output: {
              pattern: /@Output\s*\(\)\s*\w+/,
              description: 'Angular Output decorator',
              example: '@Output() itemSelected = new EventEmitter<Item>();',
              conventions: ['Use EventEmitter for outputs', 'Follow Angular naming conventions', 'Emit strongly typed events']
            }
          },
          lifecycle: {
            ngOnInit: {
              pattern: /ngOnInit\s*\(\)\s*\{/,
              description: 'Angular OnInit lifecycle hook',
              example: 'ngOnInit() {\n  this.loadData();\n}',
              conventions: ['Initialize component data here', 'Avoid complex logic in constructor', 'Implement OnInit interface']
            },
            ngOnDestroy: {
              pattern: /ngOnDestroy\s*\(\)\s*\{/,
              description: 'Angular OnDestroy lifecycle hook',
              example: 'ngOnDestroy() {\n  this.subscription.unsubscribe();\n}',
              conventions: ['Clean up subscriptions here', 'Prevent memory leaks', 'Implement OnDestroy interface']
            },
            ngOnChanges: {
              pattern: /ngOnChanges\s*\(\s*changes\s*\)\s*\{/,
              description: 'Angular OnChanges lifecycle hook',
              example: 'ngOnChanges(changes: SimpleChanges) {\n  if (changes.inputValue) {\n    this.processInput();\n  }\n}',
              conventions: ['React to input property changes', 'Use SimpleChanges for performance', 'Implement OnChanges interface']
            }
          },
          services: {
            httpClient: {
              pattern: /this\.http\.\w+\s*\(/,
              description: 'Angular HttpClient usage',
              example: 'this.http.get<User[]>(\'/api/users\').subscribe(users => this.users = users);',
              conventions: ['Use HttpClient for HTTP requests', 'Handle errors with catchError', 'Unsubscribe or use async pipe']
            },
            dependencyInjection: {
              pattern: /constructor\s*\(\s*private\s+\w+/,
              description: 'Angular dependency injection pattern',
              example: 'constructor(private http: HttpClient, private router: Router) {}',
              conventions: ['Use private modifier for DI', 'Inject services in constructor', 'Avoid logic in constructor']
            }
          }
        },
        conventions: {
          fileNaming: ['Use kebab-case for file names', 'Follow Angular CLI naming conventions', 'Use .component.ts, .service.ts, .module.ts suffixes'],
          folderStructure: ['Organize by feature modules', 'Separate core, shared, and feature modules', 'Use barrels (index.ts) for clean imports'],
          stateManagement: ['Use services for state management', 'Consider NgRx for complex applications', 'Use BehaviorSubject for reactive state'],
          performance: ['Use OnPush change detection', 'Implement lazy loading for modules', 'Use trackBy function in *ngFor'],
          testing: ['Use Angular Testing Utilities', 'Test components, services, and pipes separately', 'Use TestBed for dependency injection in tests']
        },
        antiPatterns: [
          'Direct DOM manipulation',
          'Large components without decomposition',
          'Not implementing OnDestroy for subscriptions',
          'Using any type excessively',
          'Mixing template logic with component logic'
        ]
      },

      express: {
        name: 'Express.js',
        category: 'backend',
        patterns: {
          routing: {
            get: {
              pattern: /app\.get\s*\(\s*['"`][^'"`]*['"`]/,
              description: 'Express GET route pattern',
              example: 'app.get(\'/users\', (req, res) => {\n  res.json(users);\n});',
              conventions: ['Use descriptive route paths', 'Validate request parameters', 'Send appropriate HTTP status codes']
            },
            post: {
              pattern: /app\.post\s*\(\s*['"`][^'"`]*['"`]/,
              description: 'Express POST route pattern',
              example: 'app.post(\'/users\', (req, res) => {\n  const user = req.body;\n  // Create user logic\n  res.status(201).json(user);\n});',
              conventions: ['Validate request body', 'Handle validation errors', 'Return created resource with 201 status']
            },
            middleware: {
              pattern: /app\.use\s*\(/,
              description: 'Express middleware pattern',
              example: 'app.use(express.json());\napp.use(cors());\napp.use(\'/api\', apiRoutes);',
              conventions: ['Order middleware carefully', 'Use built-in middleware first', 'Apply route-specific middleware after general middleware']
            }
          },
          errorHandling: {
            errorMiddleware: {
              pattern: /function\s*\(\s*err\s*,\s*req\s*,\s*res\s*,\s*next\s*\)/,
              description: 'Express error handling middleware',
              example: 'app.use((err, req, res, next) => {\n  console.error(err.stack);\n  res.status(500).json({ error: \'Something went wrong!\' });\n});',
              conventions: ['Use four parameters (err, req, res, next)', 'Log errors appropriately', 'Send generic error messages to client']
            },
            asyncErrorHandling: {
              pattern: /catch\s*\(\s*error\s*\)\s*\{/,
              description: 'Async error handling pattern',
              example: 'try {\n  const result = await someAsyncOperation();\n  res.json(result);\n} catch (error) {\n  next(error);\n}',
              conventions: ['Use try-catch in async routes', 'Pass errors to next()', 'Use error handling middleware']
            }
          },
          database: {
            mongoose: {
              pattern: /mongoose\.connect\s*\(/,
              description: 'Mongoose connection pattern',
              example: 'mongoose.connect(process.env.MONGODB_URI)\n  .then(() => console.log(\'MongoDB connected\'))\n  .catch(err => console.error(\'Connection error:\', err));',
              conventions: ['Handle connection errors', 'Use environment variables for connection strings', 'Implement connection retry logic']
            }
          }
        },
        conventions: {
          fileStructure: ['Separate routes, controllers, models, and middleware', 'Use app.js for main application setup', 'Organize routes by feature'],
          middleware: ['Use middleware for cross-cutting concerns', 'Order middleware logically', 'Create custom middleware for business logic'],
          errorHandling: ['Centralize error handling', 'Use appropriate HTTP status codes', 'Log errors but don\'t expose sensitive information'],
          security: ['Use helmet for security headers', 'Implement rate limiting', 'Validate and sanitize input data'],
          performance: ['Use compression middleware', 'Implement caching strategies', 'Use connection pooling for databases']
        },
        antiPatterns: [
          'Mixing business logic in routes',
          'Not handling async errors properly',
          'Exposing sensitive error information',
          'Using synchronous file operations',
          'Not implementing proper middleware order'
        ]
      },

      django: {
        name: 'Django',
        category: 'backend',
        patterns: {
          models: {
            modelClass: {
              pattern: /class\s+\w+\s*\(\s*models\.Model\s*\)\s*:/,
              description: 'Django model class pattern',
              example: 'class Article(models.Model):\n    title = models.CharField(max_length=100)\n    content = models.TextField()\n    pub_date = models.DateTimeField(auto_now_add=True)',
              conventions: ['Inherit from models.Model', 'Use descriptive field names', 'Define __str__ method for admin display']
            },
            modelMethods: {
              pattern: /def\s+__\w+__\s*\(self/,
              description: 'Django model methods pattern',
              example: 'def __str__(self):\n    return self.title',
              conventions: ['Implement __str__ for string representation', 'Use __unicode__ for Python 2 compatibility', 'Override save() and delete() when needed']
            }
          },
          views: {
            functionBased: {
              pattern: /def\s+\w+\s*\(\s*request\s*\)\s*:/,
              description: 'Django function-based view pattern',
              example: 'def article_list(request):\n    articles = Article.objects.all()\n    return render(request, \'articles/list.html\', {\'articles\': articles})',
              conventions: ['Use descriptive function names', 'Handle GET and POST appropriately', 'Return HttpResponse or render shortcut']
            },
            classBased: {
              pattern: /class\s+\w+View\s*\(\s*\w+View\s*\)\s*:/,
              description: 'Django class-based view pattern',
              example: 'class ArticleListView(ListView):\n    model = Article\n    template_name = \'articles/list.html\'',
              conventions: ['Inherit from appropriate base view', 'Override methods as needed', 'Use generic views when possible']
            }
          },
          urls: {
            urlPatterns: {
              pattern: /urlpatterns\s*=\s*\[/,
              description: 'Django URL patterns configuration',
              example: 'urlpatterns = [\n    path(\'articles/\', views.article_list, name=\'article_list\'),\n    path(\'articles/<int:pk>/\', views.article_detail, name=\'article_detail\'),\n]',
              conventions: ['Use path() over url()', 'Include name parameter for reverse URLs', 'Use include() for app URLs']
            }
          }
        },
        conventions: {
          projectStructure: ['Separate settings for different environments', 'Use apps for feature organization', 'Follow Django project layout conventions'],
          models: ['Use appropriate field types', 'Implement model managers for complex queries', 'Use migrations for schema changes'],
          views: ['Keep business logic in models/managers', 'Use Django forms for data validation', 'Implement proper error handling'],
          templates: ['Use Django template language', 'Organize templates by app', 'Use template inheritance for consistency'],
          testing: ['Write unit tests for models and utilities', 'Use Django test client for views', 'Implement integration tests for complex workflows']
        },
        antiPatterns: [
          'Putting business logic in views',
          'Using raw SQL when ORM suffices',
          'Not using Django forms for validation',
          'Hardcoding URLs instead of using reverse()',
          'Ignoring Django security best practices'
        ]
      }
    };

    logger.debug('Framework patterns knowledge base initialized', {
      frameworks: Object.keys(this.patterns).length,
      totalPatterns: this.getTotalPatterns()
    });
  }

  /**
   * Get all patterns for a specific framework
   * @param {string} frameworkName - Name of the framework
   * @returns {Object} Framework patterns
   */
  getFrameworkPatterns(frameworkName) {
    return this.patterns[frameworkName] || null;
  }

  /**
   * Get patterns by category
   * @param {string} category - Pattern category (hooks, components, etc.)
   * @returns {Object} Patterns grouped by framework
   */
  getPatternsByCategory(category) {
    const result = {};

    for (const [frameworkName, framework] of Object.entries(this.patterns)) {
      if (framework.patterns[category]) {
        result[frameworkName] = framework.patterns[category];
      }
    }

    return result;
  }

  /**
   * Find patterns that match a given code snippet
   * @param {string} code - Code snippet to analyze
   * @param {string} frameworkName - Specific framework to check (optional)
   * @returns {Array} Matching patterns
   */
  findMatchingPatterns(code, frameworkName = null) {
    const matches = [];
    const frameworksToCheck = frameworkName ? [frameworkName] : Object.keys(this.patterns);

    for (const fwName of frameworksToCheck) {
      const framework = this.patterns[fwName];
      if (!framework) continue;

      for (const [categoryName, category] of Object.entries(framework.patterns)) {
        for (const [patternName, pattern] of Object.entries(category)) {
          if (pattern.pattern && pattern.pattern.test(code)) {
            matches.push({
              framework: fwName,
              category: categoryName,
              pattern: patternName,
              description: pattern.description,
              example: pattern.example,
              conventions: pattern.conventions
            });
          }
        }
      }
    }

    return matches;
  }

  /**
   * Get conventions for a framework
   * @param {string} frameworkName - Name of the framework
   * @returns {Object} Framework conventions
   */
  getFrameworkConventions(frameworkName) {
    const framework = this.patterns[frameworkName];
    return framework ? framework.conventions : null;
  }

  /**
   * Get anti-patterns for a framework
   * @param {string} frameworkName - Name of the framework
   * @returns {Array} Anti-patterns to avoid
   */
  getFrameworkAntiPatterns(frameworkName) {
    const framework = this.patterns[frameworkName];
    return framework ? framework.antiPatterns : [];
  }

  /**
   * Suggest improvements based on detected patterns
   * @param {Array} detectedPatterns - Patterns found in code
   * @param {string} frameworkName - Framework being used
   * @returns {Array} Improvement suggestions
   */
  suggestImprovements(detectedPatterns, frameworkName) {
    const suggestions = [];
    const framework = this.patterns[frameworkName];

    if (!framework) return suggestions;

    // Check for common issues based on patterns used
    const patternNames = detectedPatterns.map(p => p.pattern);

    // React-specific suggestions
    if (frameworkName === 'react') {
      if (patternNames.includes('useEffect') && !detectedPatterns.some(p => p.category === 'hooks' && p.pattern === 'useCallback')) {
        suggestions.push({
          type: 'performance',
          message: 'Consider using useCallback for functions passed to child components to prevent unnecessary re-renders',
          pattern: 'useCallback'
        });
      }

      if (!patternNames.includes('propTypes') && patternNames.some(p => p.category === 'components')) {
        suggestions.push({
          type: 'maintainability',
          message: 'Consider adding PropTypes to your components for better type checking and documentation',
          pattern: 'propTypes'
        });
      }
    }

    // Vue-specific suggestions
    if (frameworkName === 'vue') {
      if (patternNames.includes('data') && !detectedPatterns.some(p => p.category === 'optionsApi' && p.pattern === 'computed')) {
        suggestions.push({
          type: 'performance',
          message: 'Consider using computed properties for derived data instead of methods',
          pattern: 'computed'
        });
      }
    }

    // Express-specific suggestions
    if (frameworkName === 'express') {
      if (!patternNames.includes('errorMiddleware') && patternNames.some(p => p.category === 'routing')) {
        suggestions.push({
          type: 'reliability',
          message: 'Consider adding error handling middleware to properly handle application errors',
          pattern: 'errorMiddleware'
        });
      }
    }

    return suggestions;
  }

  /**
   * Get total number of patterns across all frameworks
   * @returns {number} Total pattern count
   */
  getTotalPatterns() {
    let count = 0;
    for (const framework of Object.values(this.patterns)) {
      for (const category of Object.values(framework.patterns)) {
        count += Object.keys(category).length;
      }
    }
    return count;
  }

  /**
   * Get all available frameworks
   * @returns {Array} Framework names
   */
  getAvailableFrameworks() {
    return Object.keys(this.patterns);
  }

  /**
   * Get framework categories
   * @returns {Array} Unique categories
   */
  getFrameworkCategories() {
    const categories = new Set();
    for (const framework of Object.values(this.patterns)) {
      categories.add(framework.category);
    }
    return Array.from(categories);
  }

  /**
   * Export patterns data
   * @param {string} format - Export format ('json', 'markdown')
   * @returns {string} Formatted patterns data
   */
  exportPatterns(format = 'json') {
    switch (format) {
      case 'markdown':
        return this.formatMarkdownExport();
      case 'json':
      default:
        return JSON.stringify(this.patterns, null, 2);
    }
  }

  /**
   * Format patterns as markdown
   * @returns {string} Markdown formatted patterns
   */
  formatMarkdownExport() {
    let markdown = '# Framework Patterns and Conventions\n\n';

    for (const [frameworkName, framework] of Object.entries(this.patterns)) {
      markdown += `## ${framework.name} (${framework.category})\n\n`;

      // Patterns
      if (framework.patterns) {
        for (const [categoryName, category] of Object.entries(framework.patterns)) {
          markdown += `### ${categoryName.charAt(0).toUpperCase() + categoryName.slice(1)}\n\n`;

          for (const [patternName, pattern] of Object.entries(category)) {
            markdown += `#### ${patternName}\n`;
            markdown += `${pattern.description}\n\n`;
            markdown += `**Example:**\n\`\`\`\n${pattern.example}\n\`\`\`\n\n`;

            if (pattern.conventions && pattern.conventions.length > 0) {
              markdown += `**Conventions:**\n`;
              pattern.conventions.forEach(convention => {
                markdown += `- ${convention}\n`;
              });
              markdown += '\n';
            }
          }
        }
      }

      // Conventions
      if (framework.conventions) {
        markdown += '### General Conventions\n\n';
        for (const [conventionType, conventionList] of Object.entries(framework.conventions)) {
          markdown += `**${conventionType}:**\n`;
          conventionList.forEach(convention => {
            markdown += `- ${convention}\n`;
          });
          markdown += '\n';
        }
      }

      // Anti-patterns
      if (framework.antiPatterns && framework.antiPatterns.length > 0) {
        markdown += '### Anti-patterns to Avoid\n\n';
        framework.antiPatterns.forEach(antiPattern => {
          markdown += `- ${antiPattern}\n`;
        });
        markdown += '\n';
      }
    }

    return markdown;
  }
}
