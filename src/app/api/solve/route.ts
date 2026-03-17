import { NextRequest, NextResponse } from "next/server";
import { fetchTodayPuzzle } from "@/lib/puzzle-decoder";

// Cache for today's puzzle
let cachedPuzzle: {
  grid: string[][];
  validWords: string[];
  bonusWords: string[];
  date: string;
  fetchedAt: number;
} | null = null;

const CACHE_TTL = 60 * 60 * 1000; // 1 hour

/**
 * GET /api/solve - Get today's Squaredle puzzle with valid words
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const action = searchParams.get("action");

  if (action === "today") {
    // Check cache
    if (cachedPuzzle && Date.now() - cachedPuzzle.fetchedAt < CACHE_TTL) {
      return NextResponse.json({
        success: true,
        grid: cachedPuzzle.grid,
        validWords: cachedPuzzle.validWords,
        bonusWords: cachedPuzzle.bonusWords,
        date: cachedPuzzle.date,
        source: "squaredle.app",
        puzzleType: "daily",
      });
    }

    // Fetch fresh puzzle
    const result = await fetchTodayPuzzle();

    if (result.success && result.grid) {
      cachedPuzzle = {
        grid: result.grid,
        validWords: result.validWords || [],
        bonusWords: result.bonusWords || [],
        date: result.date || new Date().toISOString().split("T")[0],
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
      });
    }

    // Fallback puzzle
    return NextResponse.json({
      success: true,
      grid: [
        ["i", "r", "a", "a"],
        ["e", "d", "w", "c"],
        ["m", "c", "t", "y"],
        ["o", "y", "r", "o"],
      ],
      validWords: [],
      bonusWords: [],
      source: "fallback",
      date: new Date().toISOString().split("T")[0],
      puzzleType: "daily",
      message: "Could not fetch today's puzzle. Using a sample.",
    });
  }

  return NextResponse.json({
    message: "Squaredle Solver API",
    endpoints: {
      "GET /api/solve?action=today": "Get today's puzzle with valid word list",
    },
  });
}

/**
 * POST - Not used (client-side solving)
 */
export async function POST() {
  return NextResponse.json({
    message: "Use client-side solver",
  });
}
