/**
 * Squaredle Puzzle Word List Decoder
 * 
 * The word lists are encoded as:
 * 1. Comma-separated words
 * 2. Base64 encoded
 * 3. ROT-12 cipher with custom alphabet
 */

// Custom alphabet used by Squaredle for ROT cipher
const CIPHER_ALPHABET = '5pyf0gcrl1a9oe3ui8d2htn67sqjkxbmw4vzPYFGCRLAOEUIDHTNSQJKXBMWVZ'.split('');

/**
 * Decode a ROT-12 encoded string using Squaredle's custom alphabet
 */
function rot12Decode(encoded: string): string {
  return Array.from(encoded).map(char => {
    const idx = CIPHER_ALPHABET.indexOf(char);
    return idx === -1 ? char : CIPHER_ALPHABET[(idx - 12 + CIPHER_ALPHABET.length) % CIPHER_ALPHABET.length];
  }).join('');
}

/**
 * Fully decode a Squaredle word list
 * @param encoded - The encoded wordScores or optionalWordScores string
 * @returns Array of words
 */
export function decodeWordList(encoded: string): string[] {
  if (!encoded || typeof encoded !== 'string') {
    return [];
  }

  try {
    // Step 1: ROT-12 decode
    const rot12Decoded = rot12Decode(encoded.trim());
    
    // Step 2: Base64 decode
    const base64Decoded = Buffer.from(rot12Decoded, 'base64').toString('utf8');
    
    // Step 3: Split by comma and filter
    return base64Decoded.split(',').filter(w => w.length > 0);
  } catch (error) {
    console.error('Failed to decode word list:', error);
    return [];
  }
}

/**
 * Parse puzzle config and extract word lists
 */
export function parsePuzzleConfig(configText: string): {
  dateStr: string;
  mainPuzzle: {
    board: string[][];
    words: string[];
    bonusWords: string[];
  } | null;
  expressPuzzle: {
    board: string[][];
    words: string[];
    bonusWords: string[];
  } | null;
} {
  let mainPuzzle: { board: string[][]; words: string[]; bonusWords: string[] } | null = null;
  let expressPuzzle: { board: string[][]; words: string[]; bonusWords: string[] } | null = null;
  let dateStr = new Date().toISOString().split('T')[0];

  // Get today's date
  const todayMatch = configText.match(/gTodayDateStr\s*=\s*['"]([^'"]+)['"]/);
  if (todayMatch) {
    dateStr = todayMatch[1].replace(/\//g, '-');
  }

  // Helper to parse a puzzle
  const parsePuzzleData = (dateKey: string, isExpress: boolean) => {
    // Pattern to match the puzzle block
    const pattern = new RegExp(`"${dateKey.replace(/\//g, '\\\\/')}"[\\s\\S]{0,50}?\\{([\\s\\S]{0,5000}?)\\n\\s{8}\\}`, 'g');
    const match = pattern.exec(configText);
    
    if (!match) return null;
    
    const block = match[0];
    
    // Extract board
    const boardMatch = block.match(/"board":\s*\[([^\]]+)\]/);
    let board: string[][] = [];
    if (boardMatch) {
      const rows = boardMatch[1].match(/"([a-zA-Z]+)"/g);
      if (rows) {
        board = rows.map(r => r.replace(/"/g, '').toLowerCase().split(''));
      }
    }
    
    // Extract wordScores
    const wordScoresMatch = block.match(/"wordScores":\s*"([^"]+)"/);
    const words = wordScoresMatch ? decodeWordList(wordScoresMatch[1]) : [];
    
    // Extract optionalWordScores
    const optScoresMatch = block.match(/"optionalWordScores":\s*"([^"]+)"/);
    const bonusWords = optScoresMatch ? decodeWordList(optScoresMatch[1]) : [];
    
    return { board, words, bonusWords };
  };

  // Parse main puzzle (no -xp suffix)
  const mainData = parsePuzzleData(dateStr.replace(/-/g, '/'), false);
  if (mainData) {
    mainPuzzle = mainData;
  }

  // Parse express puzzle (has -xp suffix)
  const expressData = parsePuzzleData(dateStr.replace(/-/g, '/') + '-xp', true);
  if (expressData) {
    expressPuzzle = expressData;
  }

  return { dateStr, mainPuzzle, expressPuzzle };
}

/**
 * Fetch and parse today's puzzle config
 */
export async function fetchTodayPuzzle(): Promise<{
  success: boolean;
  grid?: string[][];
  validWords?: string[];
  bonusWords?: string[];
  date?: string;
  source?: string;
  error?: string;
}> {
  try {
    const https = await import('https');
    
    const configText = await new Promise<string>((resolve, reject) => {
      const req = https.request({
        hostname: 'squaredle.app',
        path: '/api/today-puzzle-config.js',
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': '*/*',
          'Referer': 'https://squaredle.app/'
        },
        timeout: 15000
      }, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
          if (res.statusCode === 200) {
            resolve(data);
          } else {
            reject(new Error(`HTTP ${res.statusCode}`));
          }
        });
      });

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });
      req.end();
    });

    const { dateStr, mainPuzzle } = parsePuzzleConfig(configText);

    if (mainPuzzle) {
      return {
        success: true,
        grid: mainPuzzle.board,
        validWords: mainPuzzle.words,
        bonusWords: mainPuzzle.bonusWords,
        date: dateStr,
        source: 'squaredle.app'
      };
    }

    return {
      success: false,
      error: 'Could not parse puzzle config'
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}
