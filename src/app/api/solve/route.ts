import { NextRequest, NextResponse } from "next/server";
import { fetchTodayPuzzle } from "@/lib/puzzle-decoder";

// Cache for today's puzzle - will auto-refresh when date changes
let cachedPuzzle: {
  grid: string[][];
  validWords: string[];
  bonusWords: string[];
  date: string;
  fetchedAt: number;
} | null = null;

const CACHE_TTL = 60 * 60 * 1000; // 1 hour TTL for same-day refresh

/**
 * GET /api/solve - Get today's Squaredle puzzle with valid words
 * 
 * This endpoint automatically fetches the daily puzzle from Squaredle
 * and decodes the official word list. The cache is date-based, so it
 * will automatically refresh when a new day's puzzle is available.
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const action = searchParams.get("action");

  if (action === "today") {
    const todayDateStr = new Date().toISOString().split('T')[0];
    
    // Check if cache is valid (same date and not expired)
    const cacheIsValid = cachedPuzzle && 
      cachedPuzzle.date === todayDateStr && 
      Date.now() - cachedPuzzle.fetchedAt < CACHE_TTL;
    
    if (cacheIsValid) {
      return NextResponse.json({
        success: true,
        grid: cachedPuzzle.grid,
        words: cachedPuzzle.validWords,
        bonusWords: cachedPuzzle.bonusWords,
        date: cachedPuzzle.date,
        source: "squaredle.app",
        puzzleType: "daily",
        cached: true,
      });
    }

    // Fetch fresh puzzle from Squaredle
    const result = await fetchTodayPuzzle();

    if (result.success && result.grid) {
      cachedPuzzle = {
        grid: result.grid,
        validWords: result.validWords || [],
        bonusWords: result.bonusWords || [],
        date: result.date || todayDateStr,
        fetchedAt: Date.now(),
      };

      return NextResponse.json({
        success: true,
        grid: result.grid,
        words: result.validWords || [],
        bonusWords: result.bonusWords || [],
        date: result.date,
        source: "squaredle.app",
        puzzleType: "daily",
        cached: false,
        wordCount: result.validWords?.length || 0,
        bonusCount: result.bonusWords?.length || 0,
      });
    }

    // Fallback puzzle if fetch fails
    return NextResponse.json({
      success: true,
      grid: [
        ["r", "c", "e", "r"],
        ["g", "a", "f", "l"],
        ["j", "u", "a", "u"],
        ["y", "r", "r", "d"],
      ],
      words: [],
      bonusWords: [],
      source: "fallback",
      date: todayDateStr,
      puzzleType: "daily",
      message: "Could not fetch today's puzzle. Using a sample grid.",
    });
  }

  // API info endpoint
  return NextResponse.json({
    message: "Squaredle Solver API",
    version: "2.0",
    features: {
      dailyPuzzle: "Automatically fetches and decodes official Squaredle word lists",
      cacheStrategy: "Date-based caching - auto-refreshes when new puzzle is available",
    },
    endpoints: {
      "GET /api/solve?action=today": "Get today's official puzzle with decoded word list",
    },
    cache: cachedPuzzle ? {
      date: cachedPuzzle.date,
      wordCount: cachedPuzzle.validWords.length,
      bonusCount: cachedPuzzle.bonusWords.length,
    } : null,
  });
}

/**
 * POST - Not used (client-side solving)
 */
export async function POST() {
  return NextResponse.json({
    message: "Use client-side solver with the word list from GET /api/solve?action=today",
  });
}
