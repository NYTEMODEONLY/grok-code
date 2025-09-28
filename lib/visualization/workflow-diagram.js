import { logger } from '../utils/logger.js';

/**
 * ASCII Art Workflow Diagram Generator
 * Creates beautiful terminal visualizations of RPG plans and workflows
 */
export class WorkflowDiagram {
  constructor(options = {}) {
    this.maxWidth = options.maxWidth || 120;
    this.maxHeight = options.maxHeight || 40;
    this.style = options.style || 'default';
    this.showLabels = options.showLabels !== false;
    this.showLegend = options.showLegend !== false;

    // ASCII art symbols and styles
    this.symbols = {
      default: {
        node: '🔸',
        feature: '🎯',
        file: '📄',
        connection: '───',
        vertical: '│',
        corner: '└──',
        branch: '├──',
        arrow: '→',
        flow: '💫',
        dependency: '🔗',
      },
      minimal: {
        node: '○',
        feature: '●',
        file: '□',
        connection: '─',
        vertical: '│',
        corner: '└',
        branch: '├',
        arrow: '→',
        flow: '~',
        dependency: '-',
      },
      fancy: {
        node: '🔹',
        feature: '🏆',
        file: '📋',
        connection: '═══',
        vertical: '║',
        corner: '╚══',
        branch: '╠══',
        arrow: '▶',
        flow: '🌊',
        dependency: '🔗',
      },
    };

    this.currentSymbols = this.symbols[this.style] || this.symbols.default;

    logger.info('Workflow diagram generator initialized', {
      style: this.style,
      maxWidth: this.maxWidth,
      maxHeight: this.maxHeight,
    });
  }

  /**
   * Generate ASCII art diagram from RPG plan
   * @param {Object} plan - RPG plan object
   * @param {Object} options - Generation options
   * @returns {string} ASCII art diagram
   */
  generateDiagram(plan, options = {}) {
    try {
      const {
        type = 'flowchart',
        title = 'RPG Plan Visualization',
        showStats = true,
        compact = false,
      } = options;

      if (!plan || !plan.features) {
        return this.generateErrorDiagram('Invalid or empty RPG plan');
      }

      let diagram = '';

      // Add title
      if (title) {
        diagram += this.centerText(`🎨 ${title}`, this.maxWidth) + '\n';
        diagram += '═'.repeat(this.maxWidth) + '\n\n';
      }

      // Generate diagram based on type
      switch (type) {
        case 'flowchart':
          diagram += this.generateFlowchart(plan, compact);
          break;
        case 'mindmap':
          diagram += this.generateMindMap(plan, compact);
          break;
        case 'dependency':
          diagram += this.generateDependencyGraph(plan, compact);
          break;
        case 'overview':
          diagram += this.generateOverview(plan);
          break;
        default:
          diagram += this.generateFlowchart(plan, compact);
      }

      // Add statistics
      if (showStats) {
        diagram += '\n' + this.generateStats(plan);
      }

      // Add legend
      if (this.showLegend) {
        diagram += '\n' + this.generateLegend(type);
      }

      return diagram;
    } catch (error) {
      logger.error('Failed to generate workflow diagram', {
        error: error.message,
      });
      return this.generateErrorDiagram(
        `Diagram generation failed: ${error.message}`
      );
    }
  }

  /**
   * Generate flowchart-style diagram
   * @param {Object} plan - RPG plan
   * @param {boolean} compact - Compact mode
   * @returns {string} Flowchart diagram
   */
  generateFlowchart(plan, compact = false) {
    const { features, files, flows = [], deps = [] } = plan;
    let diagram = '';

    // Create feature nodes
    const featureNodes = features.map((feature, index) => ({
      id: feature,
      label: this.truncateText(feature, compact ? 15 : 25),
      type: 'feature',
      x: index * (compact ? 20 : 30),
      y: 0,
    }));

    // Create file nodes (positioned below features)
    const fileNodes = [];
    let fileIndex = 0;
    features.forEach((feature) => {
      const featureFiles = Object.entries(files)
        .filter(([, fileFeature]) => fileFeature === feature)
        .map(([filePath]) => filePath);

      featureFiles.forEach((filePath) => {
        fileNodes.push({
          id: filePath,
          label: this.truncateText(
            this.getFileName(filePath),
            compact ? 12 : 20
          ),
          type: 'file',
          feature: feature,
          x: fileIndex * (compact ? 15 : 25),
          y: 3,
        });
        fileIndex++;
      });
    });

    const allNodes = [...featureNodes, ...fileNodes];
    const canvas = this.createCanvas(allNodes);

    // Draw feature nodes
    featureNodes.forEach((node) => {
      this.drawNode(canvas, node.x, node.y, node.label, node.type);
    });

    // Draw file nodes
    fileNodes.forEach((node) => {
      this.drawNode(canvas, node.x, node.y, node.label, node.type);
    });

    // Draw connections
    flows.forEach(([from, to]) => {
      const fromNode = featureNodes.find((n) => n.id === from);
      const toNode = featureNodes.find((n) => n.id === to);
      if (fromNode && toNode) {
        this.drawConnection(
          canvas,
          fromNode.x,
          fromNode.y,
          toNode.x,
          toNode.y,
          'flow'
        );
      }
    });

    // Draw feature-to-file connections
    featureNodes.forEach((featureNode) => {
      const featureFiles = fileNodes.filter(
        (n) => n.feature === featureNode.id
      );
      featureFiles.forEach((fileNode) => {
        this.drawConnection(
          canvas,
          featureNode.x,
          featureNode.y,
          fileNode.x,
          fileNode.y,
          'dependency'
        );
      });
    });

    diagram += this.renderCanvas(canvas);
    return diagram;
  }

  /**
   * Generate mind map style diagram
   * @param {Object} plan - RPG plan
   * @param {boolean} compact - Compact mode
   * @returns {string} Mind map diagram
   */
  generateMindMap(plan, compact = false) {
    const { features, files } = plan;
    let diagram = '';

    // Central node
    const centerText = '🎯 RPG Plan';
    diagram += this.centerText(centerText, this.maxWidth) + '\n';

    // Draw feature branches
    features.forEach((feature, index) => {
      const branchSymbol =
        index === features.length - 1
          ? this.currentSymbols.corner
          : this.currentSymbols.branch;
      const featureLabel = this.truncateText(feature, compact ? 20 : 30);
      const featureIcon = this.currentSymbols.feature;

      diagram += `${branchSymbol}${this.currentSymbols.connection}${featureIcon} ${featureLabel}\n`;

      // Sub-branches for files
      const featureFiles = Object.entries(files)
        .filter(([, fileFeature]) => fileFeature === feature)
        .map(([filePath]) => this.getFileName(filePath));

      featureFiles.forEach((fileName, fileIndex) => {
        const fileSymbol =
          fileIndex === featureFiles.length - 1 ? '    └──' : '    ├──';
        const fileLabel = this.truncateText(fileName, compact ? 18 : 25);
        const fileIcon = this.currentSymbols.file;

        diagram += `${fileSymbol}${this.currentSymbols.connection}${fileIcon} ${fileLabel}\n`;
      });

      if (index < features.length - 1) {
        diagram += `${this.currentSymbols.vertical}\n`;
      }
    });

    return diagram;
  }

  /**
   * Generate dependency graph diagram
   * @param {Object} plan - RPG plan
   * @param {boolean} compact - Compact mode
   * @returns {string} Dependency graph diagram
   */
  generateDependencyGraph(plan, compact = false) {
    const { deps = [] } = plan;
    let diagram = '';

    if (deps.length === 0) {
      return '📊 No dependency relationships found in the plan.\n';
    }

    diagram += '🔗 Dependency Graph:\n\n';

    // Group dependencies by source
    const depMap = {};
    deps.forEach(([from, to]) => {
      if (!depMap[from]) depMap[from] = [];
      depMap[from].push(to);
    });

    // Draw dependency tree
    Object.entries(depMap).forEach(([source, targets], index) => {
      const sourceName = this.getFileName(source);
      const isLast = index === Object.keys(depMap).length - 1;

      diagram += `${isLast ? this.currentSymbols.corner : this.currentSymbols.branch}${this.currentSymbols.file} ${this.truncateText(sourceName, compact ? 20 : 30)}\n`;

      targets.forEach((target, targetIndex) => {
        const targetName = this.getFileName(target);
        const targetIsLast = targetIndex === targets.length - 1;
        const prefix = isLast
          ? '    '
          : `    ${this.currentSymbols.vertical}   `;
        const connector = targetIsLast
          ? this.currentSymbols.corner
          : this.currentSymbols.branch;

        diagram += `${prefix}${connector}${this.currentSymbols.file} ${this.truncateText(targetName, compact ? 18 : 28)}\n`;
      });

      if (!isLast) {
        diagram += `${this.currentSymbols.vertical}\n`;
      }
    });

    return diagram;
  }

  /**
   * Generate overview diagram
   * @param {Object} plan - RPG plan
   * @returns {string} Overview diagram
   */
  generateOverview(plan) {
    const { features = [], files = {}, flows = [], deps = [] } = plan;
    let diagram = '';

    // Feature overview
    diagram += '🎯 Features Overview:\n';
    features.forEach((feature, index) => {
      const featureFiles = Object.values(files).filter(
        (f) => f === feature
      ).length;
      diagram += `  ${index + 1}. ${this.currentSymbols.feature} ${feature} (${featureFiles} files)\n`;
    });

    // File distribution
    diagram += '\n📁 File Distribution:\n';
    const fileExtensions = {};
    Object.keys(files).forEach((filePath) => {
      const ext = this.getFileExtension(filePath);
      fileExtensions[ext] = (fileExtensions[ext] || 0) + 1;
    });

    Object.entries(fileExtensions)
      .sort(([, a], [, b]) => b - a)
      .forEach(([ext, count]) => {
        diagram += `  ${this.currentSymbols.file} ${ext}: ${count} files\n`;
      });

    // Flow summary
    if (flows.length > 0) {
      diagram += '\n🌊 Data Flows:\n';
      diagram += `  ${flows.length} relationships defined\n`;
    }

    // Dependency summary
    if (deps.length > 0) {
      diagram += '\n🔗 Dependencies:\n';
      diagram += `  ${deps.length} file relationships\n`;
    }

    return diagram;
  }

  /**
   * Generate statistics section
   * @param {Object} plan - RPG plan
   * @returns {string} Statistics
   */
  generateStats(plan) {
    const { features = [], files = {}, flows = [], deps = [] } = plan;
    const totalFiles = Object.keys(files).length;
    const avgFilesPerFeature = totalFiles / Math.max(features.length, 1);

    let stats = '\n📊 Plan Statistics:\n';
    stats += `  Features: ${features.length}\n`;
    stats += `  Files: ${totalFiles}\n`;
    stats += `  Flows: ${flows.length}\n`;
    stats += `  Dependencies: ${deps.length}\n`;
    stats += `  Avg Files/Feature: ${avgFilesPerFeature.toFixed(1)}\n`;

    return stats;
  }

  /**
   * Generate legend
   * @param {string} type - Diagram type
   * @returns {string} Legend
   */
  generateLegend(type) {
    let legend = '\n📋 Legend:\n';

    switch (type) {
      case 'flowchart':
        legend += `  ${this.currentSymbols.feature} = Feature\n`;
        legend += `  ${this.currentSymbols.file} = File\n`;
        legend += `  ${this.currentSymbols.flow} = Data Flow\n`;
        legend += `  ${this.currentSymbols.dependency} = Dependency\n`;
        break;
      case 'mindmap':
        legend += `  ${this.currentSymbols.feature} = Feature\n`;
        legend += `  ${this.currentSymbols.file} = File\n`;
        break;
      case 'dependency':
        legend += `  ${this.currentSymbols.file} = File\n`;
        legend += `  ${this.currentSymbols.dependency} = Depends on\n`;
        break;
      default:
        legend += `  ${this.currentSymbols.node} = Node\n`;
        legend += `  ${this.currentSymbols.arrow} = Connection\n`;
    }

    return legend;
  }

  /**
   * Generate error diagram
   * @param {string} message - Error message
   * @returns {string} Error diagram
   */
  generateErrorDiagram(message) {
    return `
❌ Diagram Error
═══════════════════
${message}

Please ensure your RPG plan contains valid features, files, flows, and dependencies.
`;
  }

  /**
   * Create canvas for flowchart rendering
   * @param {Array} nodes - Diagram nodes
   * @returns {Array} Canvas array
   */
  createCanvas(nodes) {
    const maxX = Math.max(...nodes.map((n) => n.x + n.label.length + 4));
    const maxY = Math.max(...nodes.map((n) => n.y + 2));

    const canvas = [];
    for (let y = 0; y < maxY; y++) {
      canvas[y] = new Array(Math.min(maxX, this.maxWidth)).fill(' ');
    }

    return canvas;
  }

  /**
   * Draw node on canvas
   * @param {Array} canvas - Canvas array
   * @param {number} x - X position
   * @param {number} y - Y position
   * @param {string} label - Node label
   * @param {string} type - Node type
   */
  drawNode(canvas, x, y, label, type) {
    if (y >= canvas.length || x >= canvas[y].length) return;

    const icon =
      type === 'feature'
        ? this.currentSymbols.feature
        : this.currentSymbols.file;
    const nodeText = `${icon} ${label}`;

    // Draw node text
    for (let i = 0; i < nodeText.length && x + i < canvas[y].length; i++) {
      canvas[y][x + i] = nodeText[i];
    }
  }

  /**
   * Draw connection between nodes
   * @param {Array} canvas - Canvas array
   * @param {number} x1 - Start X
   * @param {number} y1 - Start Y
   * @param {number} x2 - End X
   * @param {number} y2 - End Y
   * @param {string} type - Connection type
   */
  drawConnection(canvas, x1, y1, x2, y2, type) {
    const symbol =
      type === 'flow' ? this.currentSymbols.flow : this.currentSymbols.arrow;

    // Simple horizontal connection for now
    const startX = Math.min(x1, x2) + 5; // Offset from node
    const endX = Math.max(x1, x2) - 2;
    const connY = Math.max(y1, y2) + 1;

    if (connY < canvas.length) {
      for (let x = startX; x <= endX && x < canvas[connY].length; x++) {
        canvas[connY][x] =
          this.currentSymbols.connection[Math.min(x - startX, 2)];
      }

      // Add arrow at end
      if (endX + 1 < canvas[connY].length) {
        canvas[connY][endX + 1] = symbol;
      }
    }
  }

  /**
   * Render canvas to string
   * @param {Array} canvas - Canvas array
   * @returns {string} Rendered diagram
   */
  renderCanvas(canvas) {
    return canvas.map((row) => row.join('')).join('\n');
  }

  /**
   * Center text within width
   * @param {string} text - Text to center
   * @param {number} width - Total width
   * @returns {string} Centered text
   */
  centerText(text, width) {
    const padding = Math.max(0, width - text.length);
    const leftPad = Math.floor(padding / 2);
    const rightPad = padding - leftPad;
    return ' '.repeat(leftPad) + text + ' '.repeat(rightPad);
  }

  /**
   * Truncate text with ellipsis
   * @param {string} text - Text to truncate
   * @param {number} maxLength - Maximum length
   * @returns {string} Truncated text
   */
  truncateText(text, maxLength) {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + '...';
  }

  /**
   * Get file name from path
   * @param {string} filePath - File path
   * @returns {string} File name
   */
  getFileName(filePath) {
    return filePath.split('/').pop() || filePath;
  }

  /**
   * Get file extension
   * @param {string} filePath - File path
   * @returns {string} File extension
   */
  getFileExtension(filePath) {
    const ext = filePath.split('.').pop();
    return ext && ext !== filePath ? `.${ext}` : '';
  }

  /**
   * Update diagram style
   * @param {string} style - New style ('default', 'minimal', 'fancy')
   */
  setStyle(style) {
    if (this.symbols[style]) {
      this.style = style;
      this.currentSymbols = this.symbols[style];
    }
  }

  /**
   * Get available styles
   * @returns {Array} Available styles
   */
  getAvailableStyles() {
    return Object.keys(this.symbols);
  }

  /**
   * Get diagram statistics
   * @returns {Object} Statistics
   */
  getStats() {
    return {
      maxWidth: this.maxWidth,
      maxHeight: this.maxHeight,
      style: this.style,
      showLabels: this.showLabels,
      showLegend: this.showLegend,
      availableStyles: this.getAvailableStyles(),
    };
  }
}
