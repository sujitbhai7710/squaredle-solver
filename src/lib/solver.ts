/**
 * Squaredle Solver Algorithm
 * Uses DFS (Depth-First Search) with backtracking to find all valid words
 */

import { Trie, TrieNode, getDictionary } from './trie';

export interface FoundWord {
  word: string;
  path: Array<{ row: number; col: number }>;
  length: number;
}

export interface SolverResult {
  words: FoundWord[];
  totalWords: number;
  byLength: Map<number, FoundWord[]>;
  executionTime: number;
}

// 8 directions: up, down, left, right, and 4 diagonals
const DIRECTIONS = [
  [-1, -1], [-1, 0], [-1, 1],
  [0, -1],           [0, 1],
  [1, -1],  [1, 0],  [1, 1]
];

/**
 * Solve a Squaredle puzzle and find all valid words
 * @param grid - 2D array of letters representing the puzzle
 * @param minWordLength - Minimum word length (default: 4 for Squaredle)
 * @returns SolverResult with all found words
 */
export function solveSquaredle(
  grid: string[][],
  minWordLength: number = 2
): SolverResult {
  const startTime = performance.now();
  const trie = getDictionary();
  
  if (!trie) {
    throw new Error('Dictionary not initialized. Call initializeDictionary first.');
  }

  if (!grid || grid.length === 0 || grid[0].length === 0) {
    return {
      words: [],
      totalWords: 0,
      byLength: new Map(),
      executionTime: 0
    };
  }

  const rows = grid.length;
  const cols = grid[0].length;
  const foundWords = new Map<string, FoundWord>();
  
  // Normalize grid to lowercase
  const normalizedGrid: string[][] = [];
  for (let r = 0; r < rows; r++) {
    normalizedGrid[r] = [];
    for (let c = 0; c < cols; c++) {
      normalizedGrid[r][c] = (grid[r][c] || '').toLowerCase().trim();
    }
  }

  // Start DFS from each cell
  for (let startRow = 0; startRow < rows; startRow++) {
    for (let startCol = 0; startCol < cols; startCol++) {
      const startChar = normalizedGrid[startRow][startCol];
      if (!startChar) continue;

      const startNode = trie.findNode(startChar);
      if (!startNode) continue;

      // Initialize visited matrix for this path
      const visited: boolean[][] = Array(rows)
        .fill(null)
        .map(() => Array(cols).fill(false));

      // Start DFS from this cell
      dfs(
        startRow,
        startCol,
        startChar,
        startNode,
        [{ row: startRow, col: startCol }],
        visited,
        normalizedGrid,
        trie,
        foundWords,
        minWordLength,
        rows,
        cols
      );
    }
  }

  // Convert to array and sort
  const words = Array.from(foundWords.values()).sort((a, b) => {
    if (a.length !== b.length) return a.length - b.length;
    return a.word.localeCompare(b.word);
  });

  // Group by length
  const byLength = new Map<number, FoundWord[]>();
  for (const word of words) {
    if (!byLength.has(word.length)) {
      byLength.set(word.length, []);
    }
    byLength.get(word.length)!.push(word);
  }

  const endTime = performance.now();

  return {
    words,
    totalWords: words.length,
    byLength,
    executionTime: endTime - startTime
  };
}

/**
 * DFS helper function for word finding
 */
function dfs(
  row: number,
  col: number,
  currentPrefix: string,
  currentNode: TrieNode,
  path: Array<{ row: number; col: number }>,
  visited: boolean[][],
  grid: string[][],
  trie: Trie,
  foundWords: Map<string, FoundWord>,
  minWordLength: number,
  rows: number,
  cols: number
): void {
  // Mark current cell as visited
  visited[row][col] = true;

  // Check if current prefix is a valid word
  if (currentNode.isEndOfWord && currentPrefix.length >= minWordLength) {
    // Only add if not already found (keep first occurrence)
    if (!foundWords.has(currentPrefix)) {
      foundWords.set(currentPrefix, {
        word: currentPrefix,
        path: [...path],
        length: currentPrefix.length
      });
    }
  }

  // Explore all 8 directions
  for (const [dr, dc] of DIRECTIONS) {
    const newRow = row + dr;
    const newCol = col + dc;

    // Check bounds
    if (newRow < 0 || newRow >= rows || newCol < 0 || newCol >= cols) {
      continue;
    }

    // Check if already visited
    if (visited[newRow][newCol]) {
      continue;
    }

    const nextChar = grid[newRow][newCol];
    if (!nextChar) continue;

    // Check if this character leads to a valid prefix
    const nextNode = currentNode.children.get(nextChar);
    if (!nextNode) {
      continue; // No words with this prefix
    }

    // Continue DFS
    path.push({ row: newRow, col: newCol });
    dfs(
      newRow,
      newCol,
      currentPrefix + nextChar,
      nextNode,
      path,
      visited,
      grid,
      trie,
      foundWords,
      minWordLength,
      rows,
      cols
    );
    path.pop();
  }

  // Backtrack: unmark current cell
  visited[row][col] = false;
}

/**
 * Validate a grid input
 */
export function validateGrid(grid: string[][]): { valid: boolean; error?: string } {
  if (!grid || !Array.isArray(grid)) {
    return { valid: false, error: 'Grid must be an array' };
  }

  if (grid.length === 0) {
    return { valid: false, error: 'Grid cannot be empty' };
  }

  const cols = grid[0]?.length || 0;
  
  for (let r = 0; r < grid.length; r++) {
    if (!Array.isArray(grid[r])) {
      return { valid: false, error: `Row ${r} must be an array` };
    }
    if (grid[r].length !== cols) {
      return { valid: false, error: 'All rows must have the same number of columns' };
    }
    for (let c = 0; c < grid[r].length; c++) {
      const cell = grid[r][c];
      if (typeof cell !== 'string') {
        return { valid: false, error: `Cell [${r}][${c}] must be a string` };
      }
      if (cell.length > 1) {
        // Allow for multi-character cells (like "Qu")
        if (!/^[a-zA-Z]+$/.test(cell)) {
          return { valid: false, error: `Cell [${r}][${c}] contains invalid characters` };
        }
      }
    }
  }

  return { valid: true };
}

/**
 * Parse a string grid into a 2D array
 * Supports various formats: comma-separated, space-separated, or one row per line
 */
export function parseGridInput(input: string): string[][] {
  const lines = input.trim().split('\n').map(line => line.trim()).filter(line => line.length > 0);
  
  if (lines.length === 0) {
    return [];
  }

  const grid: string[][] = [];

  for (const line of lines) {
    // Try different separators
    let cells: string[];
    
    if (line.includes(',')) {
      cells = line.split(',').map(c => c.trim());
    } else if (line.includes(' ')) {
      cells = line.split(/\s+/).map(c => c.trim());
    } else {
      // Each character is a cell
      cells = line.split('').map(c => c.trim()).filter(c => c.length > 0);
    }

    if (cells.length > 0) {
      grid.push(cells);
    }
  }

  return grid;
}
