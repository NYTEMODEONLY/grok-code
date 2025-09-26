/**
 * Circular Dependency Detection Engine
 * Detects circular import dependencies in codebases using graph traversal algorithms
 */
export class CircularDependencyDetector {
  constructor() {
    this.visited = new Set(); // Track visited nodes during traversal
    this.recursionStack = new Set(); // Track nodes in current recursion path
    this.cycles = []; // Store detected cycles
  }

  /**
   * Detect circular dependencies in a dependency graph
   * @param {Map} dependencyGraph - Map of file -> dependencies from DependencyMapper
   * @returns {Object} Analysis results with detected cycles
   */
  detectCircularDependencies(dependencyGraph) {
    // Reset state
    this.visited.clear();
    this.recursionStack.clear();
    this.cycles = [];

    // Convert Map to adjacency list for easier traversal
    const adjacencyList = this.buildAdjacencyList(dependencyGraph);

    // Perform DFS on each node to detect cycles
    for (const node of adjacencyList.keys()) {
      if (!this.visited.has(node)) {
        this.dfsDetectCycle(node, adjacencyList, []);
      }
    }

    // Analyze and classify detected cycles
    const cycleAnalysis = this.analyzeCycles(this.cycles, dependencyGraph);

    return {
      hasCircularDependencies: this.cycles.length > 0,
      cycleCount: this.cycles.length,
      cycles: this.cycles,
      cycleAnalysis,
      summary: this.generateSummary(cycleAnalysis),
    };
  }

  /**
   * Convert dependency Map to adjacency list format
   * @param {Map} dependencyGraph - File -> dependencies mapping
   * @returns {Map} Adjacency list representation
   */
  buildAdjacencyList(dependencyGraph) {
    const adjacencyList = new Map();

    for (const [filePath, dependencies] of dependencyGraph) {
      const deps = dependencies
        .filter(dep => dep.path) // Only include resolved dependencies
        .map(dep => dep.path);

      adjacencyList.set(filePath, deps);
    }

    return adjacencyList;
  }

  /**
   * Depth-first search to detect cycles
   * @param {string} node - Current node being visited
   * @param {Map} adjacencyList - Graph adjacency list
   * @param {Array} path - Current path in traversal
   */
  dfsDetectCycle(node, adjacencyList, path) {
    this.visited.add(node);
    this.recursionStack.add(node);
    path.push(node);

    const neighbors = adjacencyList.get(node) || [];

    for (const neighbor of neighbors) {
      if (!this.visited.has(neighbor)) {
        // Not visited, continue DFS
        this.dfsDetectCycle(neighbor, adjacencyList, [...path]);
      } else if (this.recursionStack.has(neighbor)) {
        // Found a cycle!
        const cycleStart = path.indexOf(neighbor);
        const cycle = [...path.slice(cycleStart), neighbor];
        this.cycles.push({
          nodes: cycle,
          length: cycle.length,
          description: this.describeCycle(cycle),
        });
      }
      // If neighbor is visited but not in recursion stack, it's not a cycle
    }

    // Backtrack
    this.recursionStack.delete(node);
  }

  /**
   * Analyze detected cycles for severity and impact
   * @param {Array} cycles - Detected cycles
   * @param {Map} dependencyGraph - Original dependency graph
   * @returns {Object} Detailed cycle analysis
   */
  analyzeCycles(cycles, dependencyGraph) {
    const analysis = {
      totalCycles: cycles.length,
      cyclesByLength: {},
      severityLevels: {
        low: [],    // Length 2-3 cycles (simple to fix)
        medium: [], // Length 4-6 cycles (moderate complexity)
        high: [],   // Length 7+ cycles (complex, architectural issues)
        critical: [], // Cycles involving many files or core modules
      },
      affectedFiles: new Set(),
      recommendations: [],
    };

    for (const cycle of cycles) {
      // Count cycles by length
      const length = cycle.length;
      if (!analysis.cyclesByLength[length]) {
        analysis.cyclesByLength[length] = [];
      }
      analysis.cyclesByLength[length].push(cycle);

      // Classify severity
      let severity;
      if (length <= 3) {
        severity = 'low';
      } else if (length <= 6) {
        severity = 'medium';
      } else {
        severity = 'high';
      }

      // Check if cycle involves core/architectural files
      const isCritical = this.isCriticalCycle(cycle, dependencyGraph);
      if (isCritical) {
        severity = 'critical';
      }

      analysis.severityLevels[severity].push(cycle);

      // Track affected files
      cycle.nodes.forEach(file => analysis.affectedFiles.add(file));
    }

    // Generate recommendations
    analysis.recommendations = this.generateRecommendations(analysis);

    analysis.affectedFiles = Array.from(analysis.affectedFiles);
    return analysis;
  }

  /**
   * Generate human-readable description of a cycle
   * @param {Array} cycle - Cycle nodes
   * @returns {string} Description
   */
  describeCycle(cycle) {
    const names = cycle.map(node => this.getFileName(node));
    return `${names.join(' → ')} → ${names[0]}`;
  }

  /**
   * Extract filename from full path
   * @param {string} filePath - Full file path
   * @returns {string} Filename
   */
  getFileName(filePath) {
    return filePath.split('/').pop().split('\\').pop();
  }

  /**
   * Determine if a cycle involves critical architectural components
   * @param {Object} cycle - Cycle object
   * @param {Map} dependencyGraph - Dependency graph
   * @returns {boolean} True if critical
   */
  isCriticalCycle(cycle, dependencyGraph) {
    const criticalPatterns = [
      /index\.js$/,
      /main\.js$/,
      /app\.js$/,
      /config/,
      /core/,
      /utils/,
      /helpers/,
      /constants/,
    ];

    // Check if cycle involves many files or critical files
    if (cycle.length > 5) return true;

    for (const node of cycle.nodes) {
      const fileName = this.getFileName(node).toLowerCase();
      if (criticalPatterns.some(pattern => pattern.test(fileName))) {
        return true;
      }

      // Check if this file is depended on by many others
      const dependents = this.countDependents(node, dependencyGraph);
      if (dependents > 3) return true;
    }

    return false;
  }

  /**
   * Count how many files depend on a given file
   * @param {string} filePath - File to check
   * @param {Map} dependencyGraph - Dependency graph
   * @returns {number} Number of dependents
   */
  countDependents(filePath, dependencyGraph) {
    let count = 0;
    for (const dependencies of dependencyGraph.values()) {
      if (dependencies.some(dep => dep.path === filePath)) {
        count++;
      }
    }
    return count;
  }

  /**
   * Generate recommendations for fixing circular dependencies
   * @param {Object} analysis - Cycle analysis results
   * @returns {Array} Recommendations
   */
  generateRecommendations(analysis) {
    const recommendations = [];

    if (analysis.totalCycles === 0) {
      return ['✅ No circular dependencies detected. Good job maintaining clean architecture!'];
    }

    // General recommendations
    recommendations.push('🔄 Circular dependencies detected. Consider these fixes:');
    recommendations.push('');

    // Recommendations by severity
    if (analysis.severityLevels.critical.length > 0) {
      recommendations.push('🚨 CRITICAL cycles (address immediately):');
      analysis.severityLevels.critical.forEach(cycle => {
        recommendations.push(`  • ${cycle.description}`);
        recommendations.push('    - Extract common interfaces or base classes');
        recommendations.push('    - Use dependency injection');
        recommendations.push('    - Consider event-driven architecture');
      });
      recommendations.push('');
    }

    if (analysis.severityLevels.high.length > 0) {
      recommendations.push('⚠️ HIGH priority cycles:');
      analysis.severityLevels.high.forEach(cycle => {
        recommendations.push(`  • ${cycle.description}`);
        recommendations.push('    - Apply Interface Segregation Principle');
        recommendations.push('    - Extract shared functionality to separate module');
      });
      recommendations.push('');
    }

    if (analysis.severityLevels.medium.length > 0) {
      recommendations.push('📋 MEDIUM priority cycles:');
      analysis.severityLevels.medium.forEach(cycle => {
        recommendations.push(`  • ${cycle.description}`);
        recommendations.push('    - Consider merging related modules');
        recommendations.push('    - Use factory pattern to break cycle');
      });
      recommendations.push('');
    }

    if (analysis.severityLevels.low.length > 0) {
      recommendations.push('💡 LOW priority cycles (simple fixes):');
      analysis.severityLevels.low.forEach(cycle => {
        recommendations.push(`  • ${cycle.description}`);
        recommendations.push('    - Move import statements inside functions');
        recommendations.push('    - Use dynamic imports');
        recommendations.push('    - Reorganize module responsibilities');
      });
      recommendations.push('');
    }

    // General best practices
    recommendations.push('📚 General Best Practices:');
    recommendations.push('  • Prefer unidirectional data flow');
    recommendations.push('  • Use abstract interfaces instead of concrete classes');
    recommendations.push('  • Consider module boundaries and single responsibility');
    recommendations.push('  • Use tools like madge or dependency-cruiser for ongoing monitoring');

    return recommendations;
  }

  /**
   * Generate summary of circular dependency analysis
   * @param {Object} analysis - Cycle analysis results
   * @returns {Object} Summary statistics
   */
  generateSummary(analysis) {
    const summary = {
      totalCycles: analysis.totalCycles,
      affectedFiles: analysis.affectedFiles.length,
      severityBreakdown: {},
      mostProblematicFiles: [],
    };

    // Severity breakdown
    for (const [severity, cycles] of Object.entries(analysis.severityLevels)) {
      summary.severityBreakdown[severity] = cycles.length;
    }

    // Find most problematic files (files involved in most cycles)
    const fileCycleCount = {};
    for (const cycles of Object.values(analysis.cyclesByLength)) {
      cycles.forEach(cycle => {
        cycle.nodes.forEach(file => {
          fileCycleCount[file] = (fileCycleCount[file] || 0) + 1;
        });
      });
    }

    summary.mostProblematicFiles = Object.entries(fileCycleCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([file, count]) => ({ file, cycleCount: count }));

    return summary;
  }

  /**
   * Get cycle detection statistics
   * @returns {Object} Statistics
   */
  getStatistics() {
    return {
      totalVisited: this.visited.size,
      cyclesDetected: this.cycles.length,
      lastAnalysis: this.cycles.length > 0 ? new Date().toISOString() : null,
    };
  }

  /**
   * Reset detector state for new analysis
   */
  reset() {
    this.visited.clear();
    this.recursionStack.clear();
    this.cycles = [];
  }

  /**
   * Export cycles in various formats
   * @param {Array} cycles - Detected cycles
   * @param {string} format - Export format ('json', 'text', 'csv')
   * @returns {string} Formatted output
   */
  exportCycles(cycles, format = 'json') {
    switch (format.toLowerCase()) {
      case 'json':
        return JSON.stringify(cycles, null, 2);

      case 'text':
        return this.exportAsText(cycles);

      case 'csv':
        return this.exportAsCsv(cycles);

      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  /**
   * Export cycles as human-readable text
   * @param {Array} cycles - Detected cycles
   * @returns {string} Text format
   */
  exportAsText(cycles) {
    if (cycles.length === 0) {
      return 'No circular dependencies detected.';
    }

    let text = `Found ${cycles.length} circular dependencies:\n\n`;

    cycles.forEach((cycle, index) => {
      text += `${index + 1}. ${cycle.description}\n`;
      text += `   Length: ${cycle.length} files\n\n`;
    });

    return text;
  }

  /**
   * Export cycles as CSV
   * @param {Array} cycles - Detected cycles
   * @returns {string} CSV format
   */
  exportAsCsv(cycles) {
    let csv = 'cycle_id,length,nodes\n';

    cycles.forEach((cycle, index) => {
      csv += `${index + 1},${cycle.length},"${cycle.nodes.join(';')}"\n`;
    });

    return csv;
  }
}

// Export singleton instance for global use
export const circularDependencyDetector = new CircularDependencyDetector();
export default circularDependencyDetector;
