/**
 * Squaredle Solver Algorithm - Optimized for production
 * Uses Set for O(1) word lookups instead of Trie for faster initialization
 */

// Singleton dictionary
let wordSet: Set<string> | null = null;
let wordList: string[] = [];

// 8 directions: up, down, left, right, and 4 diagonals
const DIRECTIONS = [
  [-1, -1], [-1, 0], [-1, 1],
  [0, -1],           [0, 1],
  [1, -1],  [1, 0],  [1, 1]
];

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

/**
 * Initialize dictionary with words
 */
export function initializeDictionary(words: string[]): void {
  if (!wordSet) {
    wordSet = new Set(words.map(w => w.toLowerCase()));
    wordList = words;
    console.log(`Dictionary initialized with ${wordSet.size} words`);
  }
}

/**
 * Check if a word exists
 */
export function hasWord(word: string): boolean {
  return wordSet?.has(word.toLowerCase()) ?? false;
}

/**
 * Check if any word starts with the given prefix
 */
export function hasPrefix(prefix: string): boolean {
  if (!wordSet) return false;
  const lowerPrefix = prefix.toLowerCase();
  // Check if any word in our set starts with this prefix
  // For performance, we check if the prefix itself could be valid
  for (const word of wordList) {
    if (word.startsWith(lowerPrefix)) return true;
  }
  return false;
}

/**
 * Get dictionary status
 */
export function getDictionary(): { getWordCount: () => number } | null {
  return wordSet ? { getWordCount: () => wordSet!.size } : null;
}

/**
 * Solve a Squaredle puzzle and find all valid words
 */
export function solveSquaredle(
  grid: string[][],
  minWordLength: number = 2
): SolverResult {
  const startTime = performance.now();
  
  if (!wordSet) {
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

  // Build prefix set for fast prefix checking
  const prefixSet = new Set<string>();
  for (const word of wordList) {
    for (let i = 1; i < word.length; i++) {
      prefixSet.add(word.substring(0, i));
    }
  }

  // Start DFS from each cell
  for (let startRow = 0; startRow < rows; startRow++) {
    for (let startCol = 0; startCol < cols; startCol++) {
      const startChar = normalizedGrid[startRow][startCol];
      if (!startChar) continue;

      // Check if any word starts with this character
      if (!prefixSet.has(startChar) && !wordSet.has(startChar)) continue;

      // Initialize visited matrix for this path
      const visited: boolean[][] = Array(rows)
        .fill(null)
        .map(() => Array(cols).fill(false));

      // Start DFS from this cell
      dfs(
        startRow,
        startCol,
        startChar,
        [{ row: startRow, col: startCol }],
        visited,
        normalizedGrid,
        wordSet,
        prefixSet,
        foundWords,
        minWordLength,
        rows,
        cols
      );
    }
  }

  // Convert to array and sort by length (descending) then alphabetically
  const words = Array.from(foundWords.values()).sort((a, b) => {
    if (a.length !== b.length) return b.length - a.length;
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
  path: Array<{ row: number; col: number }>,
  visited: boolean[][],
  grid: string[][],
  wordSet: Set<string>,
  prefixSet: Set<string>,
  foundWords: Map<string, FoundWord>,
  minWordLength: number,
  rows: number,
  cols: number
): void {
  // Mark current cell as visited
  visited[row][col] = true;

  // Check if current prefix is a valid word
  if (currentPrefix.length >= minWordLength && wordSet.has(currentPrefix)) {
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

    const newPrefix = currentPrefix + nextChar;

    // Check if this prefix could lead to a word
    if (!prefixSet.has(newPrefix) && !wordSet.has(newPrefix)) {
      continue;
    }

    // Continue DFS
    path.push({ row: newRow, col: newCol });
    dfs(
      newRow,
      newCol,
      newPrefix,
      path,
      visited,
      grid,
      wordSet,
      prefixSet,
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
        if (!/^[a-zA-Z]+$/.test(cell)) {
          return { valid: false, error: `Cell [${r}][${c}] contains invalid characters` };
        }
      }
    }
  }

  return { valid: true };
}
