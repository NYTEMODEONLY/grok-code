/**
 * Dependency Graph Visualizer
 * Creates ASCII art and terminal-friendly visualizations of dependency graphs
 */
export class GraphVisualizer {
  constructor() {
    this.styles = {
      tree: 'tree',
      graph: 'graph',
      compact: 'compact',
    };

    this.symbols = {
      branch: '├── ',
      lastBranch: '└── ',
      vertical: '│   ',
      space: '    ',
      arrow: ' → ',
      cycle: ' ↺ ',
    };
  }

  /**
   * Visualize dependency graph in various formats
   * @param {Map} dependencyGraph - Dependencies from DependencyMapper
   * @param {Map} reverseGraph - Reverse dependencies
   * @param {Object} options - Visualization options
   * @returns {string} ASCII art visualization
   */
  visualize(dependencyGraph, reverseGraph = new Map(), options = {}) {
    const {
      style = 'tree',
      maxDepth = 5,
      showCycles = true,
      highlightCycles = true,
      includeStats = true,
      rootNode = null,
    } = options;

    let visualization = '';

    // Add header with statistics
    if (includeStats) {
      const stats = this.generateStats(dependencyGraph, reverseGraph);
      visualization += this.formatHeader(stats) + '\n\n';
    }

    // Generate visualization based on style
    switch (style) {
      case 'tree':
        visualization += this.generateTreeView(
          dependencyGraph,
          rootNode,
          maxDepth,
          showCycles
        );
        break;

      case 'graph':
        visualization += this.generateGraphView(dependencyGraph, showCycles);
        break;

      case 'compact':
        visualization += this.generateCompactView(dependencyGraph);
        break;

      default:
        throw new Error(`Unknown visualization style: ${style}`);
    }

    // Add cycle information if requested
    if (showCycles && highlightCycles) {
      const cycleInfo = this.generateCycleInfo(dependencyGraph);
      if (cycleInfo) {
        visualization += '\n\n' + cycleInfo;
      }
    }

    return visualization;
  }

  /**
   * Generate statistics for the dependency graph
   * @param {Map|Object} dependencyGraph - Dependencies (Map or plain object)
   * @param {Map|Object} reverseGraph - Reverse dependencies (Map or plain object)
   * @returns {Object} Statistics
   */
  generateStats(dependencyGraph, reverseGraph) {
    // Convert to Map if it's a plain object
    const depMap =
      dependencyGraph instanceof Map
        ? dependencyGraph
        : new Map(Object.entries(dependencyGraph));
    const revMap =
      reverseGraph instanceof Map
        ? reverseGraph
        : new Map(Object.entries(reverseGraph || {}));

    const stats = {
      totalFiles: depMap.size,
      totalDependencies: 0,
      maxDependencies: 0,
      avgDependencies: 0,
      mostDependedOn: [],
      isolatedFiles: [],
    };

    let totalDeps = 0;
    const dependencyCounts = [];

    // Calculate basic stats
    for (const [file, deps] of depMap) {
      const depCount = deps.length;
      totalDeps += depCount;
      dependencyCounts.push(depCount);

      if (depCount > stats.maxDependencies) {
        stats.maxDependencies = depCount;
      }

      if (depCount === 0) {
        stats.isolatedFiles.push(file);
      }
    }

    stats.totalDependencies = totalDeps;
    stats.avgDependencies =
      depMap.size > 0 ? (totalDeps / depMap.size).toFixed(1) : 0;

    // Find most depended on files
    const dependentCount = new Map();
    for (const dependents of revMap.values()) {
      for (const dep of dependents) {
        dependentCount.set(dep.path, (dependentCount.get(dep.path) || 0) + 1);
      }
    }

    stats.mostDependedOn = Array.from(dependentCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([file, count]) => ({ file: this.getShortName(file), count }));

    return stats;
  }

  /**
   * Format header with statistics
   * @param {Object} stats - Statistics object
   * @returns {string} Formatted header
   */
  formatHeader(stats) {
    let header = '📊 Dependency Graph Analysis\n';
    header += '='.repeat(40) + '\n';
    header += `📁 Total Files: ${stats.totalFiles}\n`;
    header += `🔗 Total Dependencies: ${stats.totalDependencies}\n`;
    header += `📈 Avg Dependencies/File: ${stats.avgDependencies}\n`;
    header += `🎯 Max Dependencies/File: ${stats.maxDependencies}\n`;

    if (stats.mostDependedOn.length > 0) {
      header += `⭐ Most Depended On:\n`;
      stats.mostDependedOn.forEach(({ file, count }) => {
        header += `   ${file} (${count} dependencies)\n`;
      });
    }

    if (stats.isolatedFiles.length > 0) {
      header += `🧩 Isolated Files: ${stats.isolatedFiles.length}\n`;
    }

    return header;
  }

  /**
   * Generate tree-style visualization
   * @param {Map|Object} dependencyGraph - Dependencies
   * @param {string} rootNode - Root node to start from
   * @param {number} maxDepth - Maximum depth to traverse
   * @param {boolean} showCycles - Whether to show cycle indicators
   * @returns {string} Tree visualization
   */
  generateTreeView(dependencyGraph, rootNode, maxDepth, showCycles) {
    // Convert to Map if needed
    const depMap =
      dependencyGraph instanceof Map
        ? dependencyGraph
        : new Map(Object.entries(dependencyGraph));

    if (depMap.size === 0) {
      return '🌲 (empty dependency graph)';
    }

    let tree = '';

    if (rootNode && depMap.has(rootNode)) {
      // Single tree from root
      tree = this.buildTreeFromNode(
        rootNode,
        depMap,
        '',
        maxDepth,
        showCycles,
        new Set()
      );
    } else {
      // Multiple trees - find root nodes (files with no dependents)
      const allDependents = new Set();
      for (const deps of depMap.values()) {
        deps.forEach((dep) => allDependents.add(dep.path));
      }

      const rootNodes = Array.from(depMap.keys())
        .filter((file) => !allDependents.has(file))
        .sort();

      if (rootNodes.length === 0) {
        // All files have dependencies - pick arbitrary starting points
        rootNodes.push(...Array.from(depMap.keys()).slice(0, 3));
      }

      for (let i = 0; i < Math.min(rootNodes.length, 5); i++) {
        const root = rootNodes[i];
        tree += `🌲 ${this.getShortName(root)}\n`;
        tree += this.buildTreeFromNode(
          root,
          depMap,
          '',
          maxDepth,
          showCycles,
          new Set()
        );
        if (i < Math.min(rootNodes.length, 5) - 1) tree += '\n';
      }

      if (rootNodes.length > 5) {
        tree += `\n... and ${rootNodes.length - 5} more root nodes\n`;
      }
    }

    return tree || '🌲 (no valid root nodes found)';
  }

  /**
   * Build tree structure from a specific node
   * @param {string} node - Current node
   * @param {Map} dependencyGraph - Dependencies
   * @param {string} prefix - Current line prefix
   * @param {number} maxDepth - Maximum depth
   * @param {boolean} showCycles - Show cycle indicators
   * @param {Set} visited - Visited nodes to prevent cycles
   * @returns {string} Tree branch
   */
  buildTreeFromNode(
    node,
    dependencyGraph,
    prefix,
    maxDepth,
    showCycles,
    visited
  ) {
    if (maxDepth <= 0 || visited.has(node)) {
      const indicator = visited.has(node) && showCycles ? ' ↺' : '';
      return `${prefix}${this.symbols.lastBranch}${this.getShortName(node)}${indicator}\n`;
    }

    visited.add(node);
    const deps = dependencyGraph.get(node) || [];
    let tree = '';

    for (let i = 0; i < deps.length; i++) {
      const dep = deps[i];
      const isLast = i === deps.length - 1;
      const branchSymbol = isLast
        ? this.symbols.lastBranch
        : this.symbols.branch;
      const nextPrefix =
        prefix + (isLast ? this.symbols.space : this.symbols.vertical);

      tree += `${prefix}${branchSymbol}${this.getShortName(dep.path)}\n`;

      // Recursively build subtree if not too deep
      if (maxDepth > 1 && dependencyGraph.has(dep.path)) {
        tree += this.buildTreeFromNode(
          dep.path,
          dependencyGraph,
          nextPrefix,
          maxDepth - 1,
          showCycles,
          new Set(visited)
        );
      }
    }

    visited.delete(node);
    return tree;
  }

  /**
   * Generate graph-style visualization (shows all connections)
   * @param {Map|Object} dependencyGraph - Dependencies
   * @param {boolean} showCycles - Show cycle indicators
   * @returns {string} Graph visualization
   */
  generateGraphView(dependencyGraph, showCycles) {
    // Convert to Map if needed
    const depMap =
      dependencyGraph instanceof Map
        ? dependencyGraph
        : new Map(Object.entries(dependencyGraph));

    if (depMap.size === 0) {
      return '🔗 (empty dependency graph)';
    }

    let graph = '🔗 Dependency Connections\n';
    graph += '─'.repeat(30) + '\n\n';

    // Collect all unique connections
    const connections = [];
    const processed = new Set();

    for (const [from, deps] of depMap) {
      for (const dep of deps) {
        const connectionKey = `${from}->${dep.path}`;
        if (!processed.has(connectionKey)) {
          connections.push({
            from: this.getShortName(from),
            to: this.getShortName(dep.path),
            type: dep.dependencyType,
          });
          processed.add(connectionKey);
        }
      }
    }

    // Group connections by type
    const grouped = {};
    connections.forEach((conn) => {
      if (!grouped[conn.type]) grouped[conn.type] = [];
      grouped[conn.type].push(conn);
    });

    // Display grouped connections
    for (const [type, conns] of Object.entries(grouped)) {
      graph += `📂 ${type.toUpperCase()} (${conns.length} connections):\n`;

      conns.slice(0, 10).forEach((conn) => {
        graph += `   ${conn.from} ${this.symbols.arrow} ${conn.to}\n`;
      });

      if (conns.length > 10) {
        graph += `   ... and ${conns.length - 10} more\n`;
      }
      graph += '\n';
    }

    return graph;
  }

  /**
   * Generate compact list view
   * @param {Map|Object} dependencyGraph - Dependencies
   * @returns {string} Compact visualization
   */
  generateCompactView(dependencyGraph) {
    // Convert to Map if needed
    const depMap =
      dependencyGraph instanceof Map
        ? dependencyGraph
        : new Map(Object.entries(dependencyGraph));

    if (depMap.size === 0) {
      return '📦 (empty dependency graph)';
    }

    let compact = '📦 Files by Dependency Count\n';
    compact += '─'.repeat(30) + '\n\n';

    // Group files by dependency count
    const byCount = new Map();

    for (const [file, deps] of depMap) {
      const count = deps.length;
      if (!byCount.has(count)) byCount.set(count, []);
      byCount.get(count).push(file);
    }

    // Sort by dependency count (descending)
    const sortedCounts = Array.from(byCount.keys()).sort((a, b) => b - a);

    for (const count of sortedCounts) {
      const files = byCount.get(count);
      compact += `${count} dependencies: ${files.length} files\n`;

      // Show first few files
      files.slice(0, 3).forEach((file) => {
        compact += `   • ${this.getShortName(file)}\n`;
      });

      if (files.length > 3) {
        compact += `   ... and ${files.length - 3} more\n`;
      }
      compact += '\n';
    }

    return compact;
  }

  /**
   * Generate cycle information section
   * @param {Map} dependencyGraph - Dependencies
   * @returns {string|null} Cycle information or null if no cycles
   */
  generateCycleInfo(dependencyGraph) {
    // This would integrate with circular dependency detector
    // For now, return a placeholder
    const cycleCount = this.detectCycles(dependencyGraph);

    if (cycleCount === 0) {
      return '✅ No circular dependencies detected';
    }

    return `⚠️ ${cycleCount} circular dependencies detected (use circular dependency analyzer for details)`;
  }

  /**
   * Simple cycle detection for visualization (basic implementation)
   * @param {Map|Object} dependencyGraph - Dependencies
   * @returns {number} Number of cycles detected
   */
  detectCycles(dependencyGraph) {
    // Convert to Map if needed
    const depMap =
      dependencyGraph instanceof Map
        ? dependencyGraph
        : new Map(Object.entries(dependencyGraph));

    // This is a simplified cycle detection
    // In production, this should use the CircularDependencyDetector
    let cycleCount = 0;
    const visited = new Set();

    const dfs = (node, path) => {
      if (path.includes(node)) {
        cycleCount++;
        return;
      }

      if (visited.has(node)) return;

      visited.add(node);
      path.push(node);

      const deps = depMap.get(node) || [];
      for (const dep of deps) {
        dfs(dep.path, [...path]);
      }

      path.pop();
    };

    for (const node of depMap.keys()) {
      if (!visited.has(node)) {
        dfs(node, []);
      }
    }

    return cycleCount;
  }

  /**
   * Get short name for file (just filename without path)
   * @param {string} filePath - Full file path
   * @returns {string} Short name
   */
  getShortName(filePath) {
    return filePath.split('/').pop().split('\\').pop();
  }

  /**
   * Create a legend for the visualization
   * @returns {string} Legend text
   */
  createLegend() {
    return `
📖 Legend:
   🌲 Tree View - Hierarchical dependency structure
   🔗 Graph View - All dependency connections
   📦 Compact View - Files grouped by dependency count
   ↺ Cycle Indicator - Circular dependency detected
   📂 Type Indicators - internal/external/alias dependencies
`;
  }

  /**
   * Export visualization in different formats
   * @param {string} visualization - Generated visualization
   * @param {string} format - Export format ('text', 'markdown', 'json')
   * @returns {string} Formatted output
   */
  export(visualization, format = 'text') {
    switch (format.toLowerCase()) {
      case 'text':
        return visualization;

      case 'markdown':
        return this.exportAsMarkdown(visualization);

      case 'json':
        return JSON.stringify(
          { visualization, timestamp: new Date().toISOString() },
          null,
          2
        );

      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  /**
   * Export as Markdown format
   * @param {string} visualization - Text visualization
   * @returns {string} Markdown format
   */
  exportAsMarkdown(visualization) {
    let markdown = '# Dependency Graph Visualization\n\n';
    markdown += '```text\n';
    markdown += visualization;
    markdown += '\n```\n\n';
    markdown += this.createLegend();
    return markdown;
  }

  /**
   * Get available visualization styles
   * @returns {Array<string>} Available styles
   */
  getAvailableStyles() {
    return Object.values(this.styles);
  }

  /**
   * Validate visualization options
   * @param {Object} options - Options to validate
   * @returns {Object} Validated options
   */
  validateOptions(options) {
    const defaults = {
      style: 'tree',
      maxDepth: 5,
      showCycles: true,
      highlightCycles: true,
      includeStats: true,
      rootNode: null,
    };

    const validated = { ...defaults, ...options };

    if (!this.getAvailableStyles().includes(validated.style)) {
      throw new Error(
        `Invalid style: ${validated.style}. Available: ${this.getAvailableStyles().join(', ')}`
      );
    }

    if (validated.maxDepth < 1 || validated.maxDepth > 20) {
      throw new Error('maxDepth must be between 1 and 20');
    }

    return validated;
  }
}

// Export singleton instance for global use
export const graphVisualizer = new GraphVisualizer();
export default graphVisualizer;
