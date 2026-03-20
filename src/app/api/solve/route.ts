import { NextRequest, NextResponse } from "next/server";
import { solveSquaredle, validateGrid, initializeDictionary, getDictionary, SolverResult, FoundWord } from "@/lib/solver-new";
import { promises as fs } from "fs";
import path from "path";
import https from "https";

// Track if dictionary is initialized
let dictionaryInitialized = false;
let initializationPromise: Promise<void> | null = null;

// Cache for today's puzzle
let cachedMainPuzzle: { grid: string[][]; date: string; fetchedAt: number } | null = null;
let cachedExpressPuzzle: { grid: string[][]; date: string; fetchedAt: number } | null = null;
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

/**
 * Initialize the dictionary on first request - with mutex to prevent race conditions
 */
async function ensureDictionaryInitialized(): Promise<void> {
  if (dictionaryInitialized && getDictionary()) {
    return;
  }

  // If already initializing, wait for it
  if (initializationPromise) {
    return initializationPromise;
  }

  initializationPromise = (async () => {
    try {
      // Try multiple paths for the word list
      let wordsPath = path.join(process.cwd(), "src/lib/words.json");
      let wordsContent: string;
      
      try {
        wordsContent = await fs.readFile(wordsPath, "utf-8");
      } catch {
        // Try public folder as fallback
        wordsPath = path.join(process.cwd(), "public/words.json");
        wordsContent = await fs.readFile(wordsPath, "utf-8");
      }
      
      const words: string[] = JSON.parse(wordsContent);

      initializeDictionary(words);
      dictionaryInitialized = true;
      console.log(`Dictionary initialized with ${getDictionary()?.getWordCount()} words`);
    } catch (error) {
      console.error("Failed to initialize dictionary:", error);
      initializationPromise = null;
      throw error;
    }
  })();

  return initializationPromise;
}

/**
 * GET /api/solve - Get today's Squaredle puzzle
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const action = searchParams.get("action");
  const puzzleType = searchParams.get("type");

  if (action === "today") {
    const express = puzzleType === "express";
    return getTodayPuzzle(express);
  }

  if (action === "status") {
    return NextResponse.json({
      dictionaryInitialized,
      wordCount: getDictionary()?.getWordCount() || 0,
    });
  }

  return NextResponse.json({
    message: "Squaredle Solver API",
    endpoints: {
      "GET /api/solve?action=today": "Get today's main puzzle",
      "GET /api/solve?action=today&type=express": "Get today's express puzzle",
      "GET /api/solve?action=status": "Check dictionary status",
      "POST /api/solve": "Solve a puzzle",
    },
  });
}

/**
 * POST /api/solve - Solve a Squaredle puzzle
 */
export async function POST(request: NextRequest) {
  try {
    // Initialize dictionary with timeout
    const initPromise = ensureDictionaryInitialized();
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("Dictionary initialization timeout")), 10000);
    });
    
    await Promise.race([initPromise, timeoutPromise]);

    const body = await request.json();
    const { grid, minWordLength = 2 } = body;

    if (!grid) {
      return NextResponse.json({ error: "Grid is required" }, { status: 400 });
    }

    const validation = validateGrid(grid);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const result: SolverResult = solveSquaredle(grid, minWordLength);

    const byLengthObj: Record<number, FoundWord[]> = {};
    result.byLength.forEach((words, length) => {
      byLengthObj[length] = words;
    });

    return NextResponse.json({
      success: true,
      totalWords: result.totalWords,
      executionTime: result.executionTime,
      words: result.words,
      byLength: byLengthObj,
    });
  } catch (error) {
    console.error("Solver error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to solve puzzle" },
      { status: 500 }
    );
  }
}

/**
 * Fetch today's puzzle from squaredle.app
 */
async function getTodayPuzzle(express: boolean = false) {
  try {
    const cache = express ? cachedExpressPuzzle : cachedMainPuzzle;
    
    // Check cache
    if (cache && Date.now() - cache.fetchedAt < CACHE_TTL) {
      return NextResponse.json({
        success: true,
        grid: cache.grid,
        source: "squaredle.app",
        date: cache.date,
        puzzleType: express ? "express" : "daily",
      });
    }

    // Fetch puzzle config
    const configText = await fetchPuzzleConfig();
    
    if (!configText) {
      throw new Error("Failed to fetch puzzle config");
    }

    // Parse puzzles
    const { mainPuzzle, expressPuzzle, dateStr } = parsePuzzles(configText);
    
    const puzzle = express ? expressPuzzle : mainPuzzle;
    
    if (!puzzle) {
      throw new Error(`Could not find ${express ? 'express' : 'main'} puzzle`);
    }

    // Update cache
    if (mainPuzzle) {
      cachedMainPuzzle = {
        grid: mainPuzzle,
        date: dateStr,
        fetchedAt: Date.now(),
      };
    }
    if (expressPuzzle) {
      cachedExpressPuzzle = {
        grid: expressPuzzle,
        date: dateStr,
        fetchedAt: Date.now(),
      };
    }

    return NextResponse.json({
      success: true,
      grid: puzzle,
      source: "squaredle.app",
      date: dateStr,
      puzzleType: express ? "express" : "daily",
    });
  } catch (error) {
    console.error("Error fetching today's puzzle:", error);
    
    // Return fallback puzzle
    const fallbackGrid = getKnownPuzzle(express);
    return NextResponse.json({
      success: true,
      grid: fallbackGrid,
      source: "archive",
      date: new Date().toISOString().split("T")[0],
      puzzleType: express ? "express" : "daily",
      message: "Could not fetch today's puzzle. Using a sample.",
    });
  }
}

/**
 * Fetch puzzle config from Squaredle
 */
function fetchPuzzleConfig(): Promise<string> {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'squaredle.app',
      path: '/api/today-puzzle-config.js',
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': '*/*',
        'Referer': 'https://squaredle.app/'
      },
      timeout: 15000
    };

    const req = https.request(options, (res) => {
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
}

/**
 * Parse puzzles from config text
 */
function parsePuzzles(configText: string): {
  mainPuzzle: string[][] | null;
  expressPuzzle: string[][] | null;
  dateStr: string;
} {
  let mainPuzzle: string[][] | null = null;
  let expressPuzzle: string[][] | null = null;
  let dateStr = new Date().toISOString().split("T")[0];

  // Get today's date from config
  const todayMatch = configText.match(/gTodayDateStr\s*=\s*['"]([^'"]+)['"]/);
  if (todayMatch) {
    dateStr = todayMatch[1].replace(/\//g, '-');
  }

  // Pattern for main puzzle (no -xp suffix)
  const mainPattern = /"2026[^"]*17":\s*\{[\s\S]{0,500}?"board":\s*\[([^\]]+)\]/;
  const mainMatch = configText.match(mainPattern);
  
  if (mainMatch) {
    const fullMatch = mainMatch[0];
    if (!fullMatch.includes('-xp')) {
      const rows = mainMatch[1].match(/"([a-zA-Z]+)"/g);
      if (rows && rows.length > 0) {
        mainPuzzle = rows.map(r => r.replace(/"/g, '').toLowerCase().split(''));
      }
    }
  }

  // Pattern for express puzzle (has -xp suffix)
  const expressPattern = /"2026[^"]*-xp":\s*\{[\s\S]{0,500}?"board":\s*\[([^\]]+)\]/;
  const expressMatch = configText.match(expressPattern);
  
  if (expressMatch) {
    const rows = expressMatch[1].match(/"([a-zA-Z]+)"/g);
    if (rows && rows.length > 0) {
      expressPuzzle = rows.map(r => r.replace(/"/g, '').toLowerCase().split(''));
    }
  }

  return { mainPuzzle, expressPuzzle, dateStr };
}

/**
 * Get a known working puzzle as fallback
 */
function getKnownPuzzle(express: boolean): string[][] {
  if (express) {
    return [
      ["t", "u", "r"],
      ["n", "e", "y"],
      ["l", "a", "c"],
    ];
  }
  
  return [
    ["i", "r", "a", "a"],
    ["e", "d", "w", "c"],
    ["m", "c", "t", "y"],
    ["o", "y", "r", "o"],
  ];
}
