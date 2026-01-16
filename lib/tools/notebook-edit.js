/**
 * NotebookEdit Tool
 * Edit Jupyter notebooks (.ipynb files)
 */

import { BaseTool } from './base-tool.js';
import fs from 'fs-extra';
import path from 'path';

export class NotebookEditTool extends BaseTool {
  constructor(options = {}) {
    super({
      name: 'NotebookEdit',
      description: 'Edit Jupyter notebooks (.ipynb files). Can replace, insert, or delete cells.',
      parameters: {
        type: 'object',
        properties: {
          notebook_path: {
            type: 'string',
            description: 'Absolute path to the Jupyter notebook file'
          },
          cell_id: {
            type: 'string',
            description: 'The ID of the cell to edit. For insert mode, new cell is inserted after this cell.'
          },
          cell_type: {
            type: 'string',
            enum: ['code', 'markdown'],
            description: 'The type of the cell (required for insert mode)'
          },
          new_source: {
            type: 'string',
            description: 'The new source content for the cell'
          },
          edit_mode: {
            type: 'string',
            enum: ['replace', 'insert', 'delete'],
            description: 'The edit mode: replace (default), insert, or delete',
            default: 'replace'
          }
        },
        required: ['notebook_path', 'new_source']
      },
      requiresPermission: true,
      isReadOnly: false,
      timeout: 30000,
      ...options
    });
  }

  /**
   * Execute the notebook edit
   * @param {Object} params - Edit parameters
   * @param {Object} context - Execution context
   */
  async execute(params, context = {}) {
    const {
      notebook_path,
      cell_id,
      cell_type,
      new_source,
      edit_mode = 'replace'
    } = params;

    try {
      // Validate file path
      if (!notebook_path.endsWith('.ipynb')) {
        return {
          success: false,
          error: 'File must be a Jupyter notebook (.ipynb)'
        };
      }

      // Check if file exists
      const exists = await fs.pathExists(notebook_path);
      if (!exists && edit_mode !== 'insert') {
        return {
          success: false,
          error: `Notebook not found: ${notebook_path}`
        };
      }

      // Create backup before editing
      if (exists) {
        await this.createBackup(notebook_path, fs);
      }

      // Read or create notebook
      let notebook;
      if (exists) {
        const content = await fs.readFile(notebook_path, 'utf8');
        notebook = JSON.parse(content);
      } else {
        notebook = this.createEmptyNotebook();
      }

      // Validate notebook structure
      if (!notebook.cells) {
        notebook.cells = [];
      }

      let result;
      switch (edit_mode) {
        case 'replace':
          result = this.replaceCell(notebook, cell_id, new_source, cell_type);
          break;
        case 'insert':
          result = this.insertCell(notebook, cell_id, new_source, cell_type);
          break;
        case 'delete':
          result = this.deleteCell(notebook, cell_id);
          break;
        default:
          return {
            success: false,
            error: `Unknown edit mode: ${edit_mode}`
          };
      }

      if (!result.success) {
        return result;
      }

      // Write the notebook back
      await fs.writeFile(notebook_path, JSON.stringify(notebook, null, 2));

      return {
        success: true,
        notebook_path,
        edit_mode,
        cell_id: result.cell_id,
        cell_count: notebook.cells.length,
        message: result.message
      };

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Replace a cell's content
   * @param {Object} notebook - Notebook object
   * @param {string} cellId - Cell ID to replace
   * @param {string} newSource - New cell source
   * @param {string} cellType - Optional new cell type
   * @returns {Object} Result
   */
  replaceCell(notebook, cellId, newSource, cellType) {
    // Find cell by ID or index
    let cellIndex = this.findCellIndex(notebook, cellId);

    if (cellIndex === -1) {
      // If no cell found, replace first cell or create one
      if (notebook.cells.length === 0) {
        notebook.cells.push(this.createCell(newSource, cellType || 'code'));
        return {
          success: true,
          cell_id: notebook.cells[0].id || '0',
          message: 'Created new cell'
        };
      }
      cellIndex = 0;
    }

    const cell = notebook.cells[cellIndex];

    // Update source
    cell.source = this.formatSource(newSource);

    // Update type if provided
    if (cellType && cellType !== cell.cell_type) {
      cell.cell_type = cellType;
      // Clear outputs for code cells
      if (cellType === 'code') {
        cell.outputs = [];
        cell.execution_count = null;
      }
    }

    return {
      success: true,
      cell_id: cell.id || String(cellIndex),
      message: `Replaced cell ${cellIndex}`
    };
  }

  /**
   * Insert a new cell
   * @param {Object} notebook - Notebook object
   * @param {string} afterCellId - Insert after this cell ID
   * @param {string} source - Cell source
   * @param {string} cellType - Cell type
   * @returns {Object} Result
   */
  insertCell(notebook, afterCellId, source, cellType) {
    if (!cellType) {
      return {
        success: false,
        error: 'cell_type is required for insert mode'
      };
    }

    const newCell = this.createCell(source, cellType);

    if (!afterCellId || notebook.cells.length === 0) {
      // Insert at beginning
      notebook.cells.unshift(newCell);
      return {
        success: true,
        cell_id: newCell.id,
        message: 'Inserted cell at beginning'
      };
    }

    const afterIndex = this.findCellIndex(notebook, afterCellId);
    if (afterIndex === -1) {
      // Insert at end if cell not found
      notebook.cells.push(newCell);
      return {
        success: true,
        cell_id: newCell.id,
        message: 'Inserted cell at end'
      };
    }

    // Insert after the specified cell
    notebook.cells.splice(afterIndex + 1, 0, newCell);

    return {
      success: true,
      cell_id: newCell.id,
      message: `Inserted cell after index ${afterIndex}`
    };
  }

  /**
   * Delete a cell
   * @param {Object} notebook - Notebook object
   * @param {string} cellId - Cell ID to delete
   * @returns {Object} Result
   */
  deleteCell(notebook, cellId) {
    const cellIndex = this.findCellIndex(notebook, cellId);

    if (cellIndex === -1) {
      return {
        success: false,
        error: `Cell not found: ${cellId}`
      };
    }

    notebook.cells.splice(cellIndex, 1);

    return {
      success: true,
      cell_id: cellId,
      message: `Deleted cell at index ${cellIndex}`
    };
  }

  /**
   * Find cell index by ID or index string
   * @param {Object} notebook - Notebook object
   * @param {string} cellId - Cell ID or index
   * @returns {number} Cell index or -1
   */
  findCellIndex(notebook, cellId) {
    if (!cellId) return -1;

    // Try as numeric index first
    const numericIndex = parseInt(cellId, 10);
    if (!isNaN(numericIndex) && numericIndex >= 0 && numericIndex < notebook.cells.length) {
      return numericIndex;
    }

    // Try as cell ID
    return notebook.cells.findIndex(cell => cell.id === cellId);
  }

  /**
   * Create a new cell
   * @param {string} source - Cell source
   * @param {string} cellType - Cell type
   * @returns {Object} Cell object
   */
  createCell(source, cellType) {
    const cell = {
      id: this.generateCellId(),
      cell_type: cellType,
      source: this.formatSource(source),
      metadata: {}
    };

    if (cellType === 'code') {
      cell.outputs = [];
      cell.execution_count = null;
    }

    return cell;
  }

  /**
   * Format source as array of lines
   * @param {string} source - Source string
   * @returns {Array} Array of lines
   */
  formatSource(source) {
    if (Array.isArray(source)) {
      return source;
    }
    // Split into lines, preserving line endings
    const lines = source.split('\n');
    return lines.map((line, i) => i < lines.length - 1 ? line + '\n' : line);
  }

  /**
   * Generate a unique cell ID
   * @returns {string} Cell ID
   */
  generateCellId() {
    return Math.random().toString(36).substring(2, 10);
  }

  /**
   * Create an empty notebook structure
   * @returns {Object} Empty notebook
   */
  createEmptyNotebook() {
    return {
      nbformat: 4,
      nbformat_minor: 5,
      metadata: {
        kernelspec: {
          display_name: 'Python 3',
          language: 'python',
          name: 'python3'
        },
        language_info: {
          name: 'python',
          version: '3.9.0'
        }
      },
      cells: []
    };
  }

  /**
   * Format result for display
   * @param {Object} result - Execution result
   * @returns {string} Formatted output
   */
  formatResult(result) {
    if (!result.success) {
      return `Notebook edit failed: ${result.error}`;
    }

    return `Notebook edited successfully:
- Path: ${result.notebook_path}
- Mode: ${result.edit_mode}
- Cell: ${result.cell_id}
- Total cells: ${result.cell_count}`;
  }
}

export default NotebookEditTool;
