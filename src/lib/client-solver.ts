/**
 * Client-Side Squaredle Solver
 * Uses entropy-based scoring to rank words by rarity
 * Can filter to only official puzzle words when provided
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
  isBonus?: boolean;
}

export interface SolverResult {
  words: FoundWord[];
  totalWords: number;
  byLength: Record<number, FoundWord[]>;
  executionTime: number;
}

export interface OfficialPuzzle {
  grid: string[][];
  words: string[];
  bonusWords: string[];
  date: string;
  puzzleType: string;
}

/**
 * Calculate entropy-based score for a word
 */
function calculateWordScore(word: string): number {
  let score = 0;
  const wordLower = word.toLowerCase();
  for (const char of wordLower) {
    score += LETTER_FREQUENCY[char] || 15;
  }
  const lengthBonus = Math.pow(word.length, 1.5);
  return Math.round(score * lengthBonus);
}

/**
 * Decompress gzipped data using DecompressionStream API (modern browsers)
 */
async function decompressGzip(response: Response): Promise<string> {
  // Check if DecompressionStream is available (Chrome 80+, Firefox 113+, Safari 16.4+)
  if (typeof DecompressionStream !== 'undefined') {
    const ds = new DecompressionStream('gzip');
    const decompressedStream = response.body!.pipeThrough(ds);
    const reader = decompressedStream.getReader();
    const chunks: Uint8Array[] = [];
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
    
    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const combined = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      combined.set(chunk, offset);
      offset += chunk.length;
    }
    
    return new TextDecoder().decode(combined);
  }
  
  // Fallback: fetch uncompressed file
  const fallbackResponse = await fetch('/words_alpha.txt');
  return fallbackResponse.text();
}

/**
 * Load dictionary from compressed words file (gzipped for faster loading)
 */
export async function loadDictionary(onProgress?: (progress: number) => void): Promise<number> {
  if (wordSet) return wordSet.size;

  try {
    // Try loading gzipped version first (1.05 MB vs 4.1 MB)
    let text: string;
    try {
      const response = await fetch('/words_alpha.txt.gz');
      if (response.ok) {
        text = await decompressGzip(response);
        console.log('Loaded compressed dictionary');
      } else {
        throw new Error('Compressed file not found');
      }
    } catch {
      // Fallback to uncompressed
      console.log('Loading uncompressed dictionary...');
      const response = await fetch('/words_alpha.txt');
      if (!response.ok) throw new Error('Failed to load dictionary');
      text = await response.text();
    }

    const words = text.split('\n').map(w => w.trim().toLowerCase()).filter(w => w.length >= 2 && /^[a-z]+$/.test(w));

    wordSet = new Set(words);
    prefixSet = new Set();
    wordScores = new Map();

    let processed = 0;
    const total = words.length;

    for (const word of words) {
      for (let i = 1; i < word.length; i++) {
        prefixSet.add(word.substring(0, i));
      }
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
 * @param grid - The letter grid
 * @param minWordLength - Minimum word length (default 2)
 * @param officialWords - Optional set of official puzzle words to filter to
 * @param bonusWords - Optional set of bonus words to mark
 */
export function solveSquaredle(
  grid: string[][],
  minWordLength: number = 2,
  officialWords?: Set<string>,
  bonusWords?: Set<string>
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

  // If official words provided, only find those
  // Otherwise, find all words
  const targetWords = officialWords || wordSet;
  const targetPrefixes = officialWords ? buildPrefixSet(officialWords) : prefixSet;

  // Start DFS from each cell
  for (let startRow = 0; startRow < rows; startRow++) {
    for (let startCol = 0; startCol < cols; startCol++) {
      const startChar = normalizedGrid[startRow][startCol];
      if (!startChar) continue;

      if (!targetPrefixes.has(startChar) && !targetWords.has(startChar)) continue;

      const visited: boolean[][] = Array(rows).fill(null).map(() => Array(cols).fill(false));
      dfs(
        startRow, startCol, startChar,
        [{ row: startRow, col: startCol }],
        visited, normalizedGrid, rows, cols,
        foundWords, targetWords, targetPrefixes, bonusWords
      );
    }
  }

  // Convert to array and sort by score (highest first), then by length
  const words = Array.from(foundWords.values()).sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.length !== a.length) return b.length - a.length;
    return a.word.localeCompare(b.word);
  });

  // Group by length
  const byLength: Record<number, FoundWord[]> = {};
  for (const word of words) {
    if (!byLength[word.length]) byLength[word.length] = [];
    byLength[word.length].push(word);
  }

  return {
    words,
    totalWords: words.length,
    byLength,
    executionTime: performance.now() - startTime
  };
}

/**
 * Build a prefix set from a word list
 */
function buildPrefixSet(words: Set<string>): Set<string> {
  const prefixes = new Set<string>();
  for (const word of words) {
    for (let i = 1; i < word.length; i++) {
      prefixes.add(word.substring(0, i));
    }
  }
  return prefixes;
}

/**
 * DFS helper
 */
function dfs(
  row: number, col: number, currentPrefix: string,
  path: Array<{ row: number; col: number }>,
  visited: boolean[][], grid: string[][],
  rows: number, cols: number,
  foundWords: Map<string, FoundWord>,
  targetWords: Set<string>,
  targetPrefixes: Set<string>,
  bonusWords?: Set<string>
): void {
  visited[row][col] = true;

  // Check if it's a valid word
  if (targetWords.has(currentPrefix)) {
    const score = wordScores!.get(currentPrefix) || calculateWordScore(currentPrefix);
    if (!foundWords.has(currentPrefix)) {
      foundWords.set(currentPrefix, {
        word: currentPrefix,
        length: currentPrefix.length,
        score,
        path: [...path],
        isBonus: bonusWords?.has(currentPrefix) || false
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
    if (!targetPrefixes.has(newPrefix) && !targetWords.has(newPrefix)) continue;

    path.push({ row: newRow, col: newCol });
    dfs(newRow, newCol, newPrefix, path, visited, grid, rows, cols, foundWords, targetWords, targetPrefixes, bonusWords);
    path.pop();
  }

  visited[row][col] = false;
}

/**
 * Fetch today's puzzle from API
 */
export async function fetchTodayPuzzle(express: boolean = false): Promise<OfficialPuzzle | null> {
  try {
    const url = `/api/solve?action=today${express ? '&type=express' : ''}`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.success && data.grid) {
      return {
        grid: data.grid,
        words: data.words || data.validWords || [],
        bonusWords: data.bonusWords || [],
        date: data.date,
        puzzleType: data.puzzleType || 'daily'
      };
    }
    return null;
  } catch (error) {
    console.error('Failed to fetch today puzzle:', error);
    return null;
  }
}

export function validateGrid(grid: string[][]): { valid: boolean; error?: string } {
  if (!grid || !Array.isArray(grid)) return { valid: false, error: 'Grid must be an array' };
  if (grid.length === 0) return { valid: false, error: 'Grid cannot be empty' };
  return { valid: true };
}
