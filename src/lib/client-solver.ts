/**
 * Client-Side Squaredle Solver
 * Uses entropy-based scoring to rank words by rarity
 * Higher score = rarer/more valuable word
 */

// Letter frequency in English (lower = more common, higher = rarer)
const LETTER_FREQUENCY: Record<string, number> = {
  e: 1, t: 2, a: 3, o: 4, i: 5, n: 6, s: 7, h: 8, r: 9,
  d: 10, l: 11, c: 12, u: 13, m: 14, w: 15, f: 16, g: 17, y: 18,
  p: 19, b: 20, v: 21, k: 22, j: 23, x: 24, q: 25, z: 26
};

// Cache for loaded dictionary
let wordSet: Set<string> | null = null;
let prefixSet: Set<string> | null = null;
let wordScores: Map<string, number> | null = null;

// 8 directions for grid traversal
const DIRECTIONS = [
  [-1, -1], [-1, 0], [-1, 1],
  [0, -1],           [0, 1],
  [1, -1],  [1, 0],  [1, 1]
];

export interface FoundWord {
  word: string;
  length: number;
  score: number;
  path: Array<{ row: number; col: number }>;
}

export interface SolverResult {
  words: FoundWord[];
  totalWords: number;
  byLength: Record<number, FoundWord[]>;
  executionTime: number;
}

/**
 * Calculate entropy-based score for a word
 * Higher score = rarer word (less common letters + longer = higher score)
 */
function calculateWordScore(word: string): number {
  let score = 0;
  const wordLower = word.toLowerCase();
  
  // Sum of letter rarity scores
  for (const char of wordLower) {
    score += LETTER_FREQUENCY[char] || 15;
  }
  
  // Bonus for longer words (exponential)
  const lengthBonus = Math.pow(word.length, 1.5);
  
  // Multiply by length bonus for final score
  return Math.round(score * lengthBonus);
}

/**
 * Load dictionary from words file
 */
export async function loadDictionary(onProgress?: (progress: number) => void): Promise<number> {
  if (wordSet) {
    return wordSet.size;
  }

  try {
    // Try to load from public folder
    const response = await fetch('/words_alpha.txt');
    
    if (!response.ok) {
      throw new Error('Failed to load dictionary');
    }

    const text = await response.text();
    const words = text
      .split('\n')
      .map(w => w.trim().toLowerCase())
      .filter(w => w.length >= 2 && /^[a-z]+$/.test(w));

    wordSet = new Set(words);
    prefixSet = new Set();
    wordScores = new Map();

    // Build prefix set and calculate scores
    let processed = 0;
    const total = words.length;

    for (const word of words) {
      // Add all prefixes
      for (let i = 1; i < word.length; i++) {
        prefixSet.add(word.substring(0, i));
      }
      
      // Calculate and store word score
      wordScores.set(word, calculateWordScore(word));
      
      processed++;
      if (onProgress && processed % 50000 === 0) {
        onProgress(Math.round((processed / total) * 100));
      }
    }

    return wordSet.size;
  } catch (error) {
    console.error('Failed to load dictionary:', error);
    throw error;
  }
}

/**
 * Check if dictionary is loaded
 */
export function isDictionaryLoaded(): boolean {
  return wordSet !== null;
}

/**
 * Get dictionary size
 */
export function getDictionarySize(): number {
  return wordSet?.size || 0;
}

/**
 * Solve a Squaredle puzzle
 */
export function solveSquaredle(
  grid: string[][],
  minWordLength: number = 2
): SolverResult {
  const startTime = performance.now();

  if (!wordSet || !prefixSet) {
    throw new Error('Dictionary not loaded. Call loadDictionary first.');
  }

  if (!grid || grid.length === 0 || grid[0].length === 0) {
    return { words: [], totalWords: 0, byLength: {}, executionTime: 0 };
  }

  const rows = grid.length;
  const cols = grid[0].length;
  const foundWords = new Map<string, FoundWord>();

  // Normalize grid
  const normalizedGrid: string[][] = [];
  for (let r = 0; r < rows; r++) {
    normalizedGrid[r] = [];
    for (let c = 0; c < cols; c++) {
      normalizedGrid[r][c] = (grid[r][c] || '').toLowerCase().trim();
    }
  }

  // DFS from each cell
  for (let startRow = 0; startRow < rows; startRow++) {
    for (let startCol = 0; startCol < cols; startCol++) {
      const startChar = normalizedGrid[startRow][startCol];
      if (!startChar) continue;

      if (!prefixSet.has(startChar) && !wordSet.has(startChar)) continue;

      const visited: boolean[][] = Array(rows)
        .fill(null)
        .map(() => Array(cols).fill(false));

      dfs(
        startRow,
        startCol,
        startChar,
        [{ row: startRow, col: startCol }],
        visited,
        normalizedGrid,
        rows,
        cols,
        foundWords
      );
    }
  }

  // Convert to array and sort by score (highest first), then by length
  const words = Array.from(foundWords.values()).sort((a, b) => {
    // Primary: sort by score (highest first)
    if (b.score !== a.score) return b.score - a.score;
    // Secondary: sort by length (longer first)
    if (b.length !== a.length) return b.length - a.length;
    // Tertiary: alphabetical
    return a.word.localeCompare(b.word);
  });

  // Group by length
  const byLength: Record<number, FoundWord[]> = {};
  for (const word of words) {
    if (!byLength[word.length]) {
      byLength[word.length] = [];
    }
    byLength[word.length].push(word);
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
 * DFS helper
 */
function dfs(
  row: number,
  col: number,
  currentPrefix: string,
  path: Array<{ row: number; col: number }>,
  visited: boolean[][],
  grid: string[][],
  rows: number,
  cols: number,
  foundWords: Map<string, FoundWord>
): void {
  visited[row][col] = true;

  // Check if it's a valid word
  if (wordSet!.has(currentPrefix)) {
    const existingWord = foundWords.get(currentPrefix);
    const score = wordScores!.get(currentPrefix) || 0;
    
    // Only add if not found or this path has higher score
    if (!existingWord) {
      foundWords.set(currentPrefix, {
        word: currentPrefix,
        length: currentPrefix.length,
        score,
        path: [...path]
      });
    }
  }

  // Explore neighbors
  for (const [dr, dc] of DIRECTIONS) {
    const newRow = row + dr;
    const newCol = col + dc;

    if (newRow < 0 || newRow >= rows || newCol < 0 || newCol >= cols) continue;
    if (visited[newRow][newCol]) continue;

    const nextChar = grid[newRow][newCol];
    if (!nextChar) continue;

    const newPrefix = currentPrefix + nextChar;

    // Check if prefix exists
    if (!prefixSet!.has(newPrefix) && !wordSet!.has(newPrefix)) continue;

    path.push({ row: newRow, col: newCol });
    dfs(newRow, newCol, newPrefix, path, visited, grid, rows, cols, foundWords);
    path.pop();
  }

  visited[row][col] = false;
}

/**
 * Validate grid
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
  }

  return { valid: true };
}
