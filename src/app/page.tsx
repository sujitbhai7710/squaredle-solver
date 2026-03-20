'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Progress } from '@/components/ui/progress'
import { 
  Loader2, 
  Sparkles, 
  Grid3X3, 
  Play, 
  Download, 
  RefreshCw,
  Search,
  Clock,
  ExternalLink,
  Info,
  Zap,
  CheckCircle,
  Star
} from 'lucide-react'
import { 
  loadDictionary, 
  solveSquaredle, 
  isDictionaryLoaded, 
  getDictionarySize,
  fetchTodayPuzzle,
  FoundWord,
  SolverResult,
  OfficialPuzzle
} from '@/lib/client-solver'

export default function SquaredleSolver() {
  // Initialize grid immediately with proper size
  const createEmptyGrid = (size: number): string[][] => {
    return Array(size).fill(null).map(() => Array(size).fill(''))
  }
  
  const [gridSize, setGridSize] = useState(5)
  const [grid, setGrid] = useState<string[][]>(() => createEmptyGrid(5))
  const [isSolving, setIsSolving] = useState(false)
  const [isLoadingToday, setIsLoadingToday] = useState(false)
  const [isLoadingDict, setIsLoadingDict] = useState(true)
  const [dictProgress, setDictProgress] = useState(0)
  const [dictSize, setDictSize] = useState(0)
  const [result, setResult] = useState<SolverResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [highlightedWord, setHighlightedWord] = useState<FoundWord | null>(null)
  const [selectedLength, setSelectedLength] = useState<number | null>(null)
  const [windowWidth, setWindowWidth] = useState(1024)
  const [isOfficialPuzzle, setIsOfficialPuzzle] = useState(false)
  const [officialWordCount, setOfficialWordCount] = useState(0)
  const [officialBonusCount, setOfficialBonusCount] = useState(0)
  const isFetchingRef = useRef(false)

  // Track window width
  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth)
    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Load dictionary on mount
  useEffect(() => {
    const initDict = async () => {
      try {
        const size = await loadDictionary((progress) => {
          setDictProgress(progress)
        })
        setDictSize(size)
        setIsLoadingDict(false)
      } catch (err) {
        setError('Failed to load dictionary')
        console.error(err)
      }
    }
    initDict()
  }, [])

  const handleCellChange = (row: number, col: number, value: string) => {
    const newGrid = [...grid]
    newGrid[row] = [...newGrid[row]]
    newGrid[row][col] = value.slice(-1).toLowerCase()
    setGrid(newGrid)
    setResult(null)
    setError(null)
    setIsOfficialPuzzle(false)
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    const text = e.clipboardData.getData('text')
    const lines = text.split('\n').filter(line => line.trim())
    
    const newGrid: string[][] = []
    for (const line of lines) {
      const cells = line.split(/[\s,]+/).filter(c => c.length > 0)
      if (cells.length > 0) {
        newGrid.push(cells.map(c => c.slice(-1).toLowerCase()))
      }
    }
    
    if (newGrid.length > 0) {
      const maxSize = Math.max(newGrid.length, ...newGrid.map(r => r.length))
      while (newGrid.length < maxSize) {
        newGrid.push(Array(maxSize).fill(''))
      }
      for (let i = 0; i < newGrid.length; i++) {
        while (newGrid[i].length < maxSize) {
          newGrid[i].push('')
        }
      }
      setGridSize(maxSize)
      setGrid(newGrid)
      setResult(null)
      setIsOfficialPuzzle(false)
    }
  }

  const handleSolve = useCallback(() => {
    if (!isDictionaryLoaded()) {
      setError('Dictionary is still loading...')
      return
    }

    const hasLetters = grid.some(row => row.some(cell => cell.trim() !== ''))
    if (!hasLetters) {
      setError('Please enter some letters in the grid')
      return
    }

    setIsSolving(true)
    setError(null)

    setTimeout(() => {
      try {
        const solveResult = solveSquaredle(grid, 2)
        setResult(solveResult)
        setSelectedLength(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to solve puzzle')
      } finally {
        setIsSolving(false)
      }
    }, 10)
  }, [grid])

  const handleGetToday = useCallback(async () => {
    if (isFetchingRef.current || isLoadingToday) return
    isFetchingRef.current = true
    setIsLoadingToday(true)
    setError(null)

    try {
      const puzzleData = await fetchTodayPuzzle(false) // false = daily puzzle
      
      if (puzzleData && puzzleData.grid) {
        setGridSize(puzzleData.grid.length)
        setGrid(puzzleData.grid)
        setResult(null)
        setError(null)
        setIsOfficialPuzzle(true)
        setOfficialWordCount(puzzleData.words.length)
        setOfficialBonusCount(puzzleData.bonusWords.length)
      } else {
        throw new Error('Failed to get today\'s puzzle')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load today\'s puzzle')
    } finally {
      setIsLoadingToday(false)
      isFetchingRef.current = false
    }
  }, [isLoadingToday])

  const handleSolveOfficial = useCallback(async () => {
    if (!isDictionaryLoaded()) {
      setError('Dictionary is still loading...')
      return
    }

    const hasLetters = grid.some(row => row.some(cell => cell.trim() !== ''))
    if (!hasLetters) {
      setError('Please enter some letters in the grid')
      return
    }

    setIsSolving(true)
    setError(null)

    try {
      // Fetch official words
      const puzzleData = await fetchTodayPuzzle(false)
      
      if (puzzleData) {
        const officialWords = new Set([...puzzleData.words, ...puzzleData.bonusWords])
        const bonusWords = new Set(puzzleData.bonusWords)
        
        const solveResult = solveSquaredle(grid, 2, officialWords, bonusWords)
        setResult(solveResult)
        setSelectedLength(null)
      } else {
        // Fallback to regular solve
        const solveResult = solveSquaredle(grid, 2)
        setResult(solveResult)
        setSelectedLength(null)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to solve puzzle')
    } finally {
      setIsSolving(false)
    }
  }, [grid])

  const handleClearGrid = () => {
    setGrid(createEmptyGrid(gridSize))
    setResult(null)
    setError(null)
    setIsOfficialPuzzle(false)
  }

  const isHighlighted = (row: number, col: number) => {
    if (!highlightedWord) return false
    return highlightedWord.path.some(p => p.row === row && p.col === col)
  }

  const getPathIndex = (row: number, col: number) => {
    if (!highlightedWord) return -1
    return highlightedWord.path.findIndex(p => p.row === row && p.col === col)
  }

  const allLengths = result ? Object.keys(result.byLength).map(Number).sort((a, b) => b - a) : []

  const getCellSize = () => {
    if (windowWidth < 400) return 36
    if (windowWidth < 640) return 42
    if (windowWidth < 768) return 48
    if (windowWidth < 1024) return 52
    return 56
  }

  const cellSize = getCellSize()
  const gridWidth = Math.min(gridSize * cellSize + (gridSize + 1) * 6, windowWidth - 48)

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-6xl mx-auto px-3 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-red-500 to-red-700 rounded-lg flex items-center justify-center flex-shrink-0">
                <Grid3X3 className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-lg font-bold text-slate-900">Squaredle Solver</h1>
            </div>
            <div className="flex items-center gap-3">
              {!isLoadingDict && (
                <Badge variant="outline" className="text-xs hidden sm:flex">
                  <Zap className="w-3 h-3 mr-1 text-amber-500" />
                  {dictSize.toLocaleString()} words
                </Badge>
              )}
              <a href="https://squaredle.app" target="_blank" rel="noopener noreferrer"
                className="text-xs sm:text-sm text-red-600 hover:text-red-700 flex items-center gap-1">
                Play Squaredle <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-3 py-4">
        {isLoadingDict && (
          <Card className="mb-4 border-amber-200 bg-amber-50">
            <CardContent className="py-3 px-4">
              <div className="flex items-center gap-3">
                <Loader2 className="w-5 h-5 animate-spin text-amber-600" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-amber-800">Loading dictionary...</p>
                  <Progress value={dictProgress} className="h-2 mt-1" />
                </div>
                <span className="text-xs text-amber-600">{dictProgress}%</span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Official puzzle indicator */}
        {isOfficialPuzzle && !result && (
          <Card className="mb-4 border-green-200 bg-green-50">
            <CardContent className="py-3 px-4">
              <div className="flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <div>
                  <p className="text-sm font-medium text-green-800">Today's Official Puzzle Loaded</p>
                  <p className="text-xs text-green-600">
                    {officialWordCount} words + {officialBonusCount} bonus words • 
                    Click "Solve Official" to find only valid Squaredle words
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid lg:grid-cols-5 gap-4">
          <div className="lg:col-span-2 space-y-3">
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="pb-2 pt-3 px-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-500" />
                    Puzzle Grid
                  </CardTitle>
                  <select value={gridSize}
                    onChange={(e) => {
                      const newSize = Number(e.target.value)
                      setGridSize(newSize)
                      setGrid(createEmptyGrid(newSize))
                      setResult(null)
                      setError(null)
                      setIsOfficialPuzzle(false)
                    }}
                    className="text-xs border border-slate-300 rounded px-1.5 py-1 bg-white">
                    {[3, 4, 5, 6, 7, 8].map(size => (
                      <option key={size} value={size}>{size}×{size}</option>
                    ))}
                  </select>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 px-3 pb-3">
                <div className="bg-gradient-to-br from-red-600 to-red-800 p-2 sm:p-2.5 rounded-xl shadow-lg mx-auto"
                  style={{ width: gridWidth, maxWidth: '100%' }} onPaste={handlePaste}>
                  <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${gridSize}, minmax(0, 1fr))` }}>
                    {grid.map((row, rowIdx) =>
                      row.map((cell, colIdx) => {
                        const highlighted = isHighlighted(rowIdx, colIdx)
                        const pathIdx = getPathIndex(rowIdx, colIdx)
                        const isLast = highlightedWord && pathIdx === highlightedWord.path.length - 1
                        
                        return (
                          <div key={`${rowIdx}-${colIdx}`} className="relative" style={{ aspectRatio: '1' }}>
                            <Input type="text" value={cell}
                              onChange={(e) => handleCellChange(rowIdx, colIdx, e.target.value)}
                              className={`w-full h-full text-center font-bold uppercase transition-all duration-150 rounded border-2
                                ${highlighted ? `bg-yellow-400 text-slate-900 border-yellow-500 z-10 ${isLast ? 'scale-110' : 'scale-105'}`
                                  : 'bg-white text-slate-800 border-slate-300 hover:border-red-400 focus:border-red-500'}`}
                              style={{ fontSize: `${Math.max(14, cellSize * 0.4)}px`, padding: '0', aspectRatio: '1' }}
                              maxLength={1} />
                            {highlighted && (
                              <div className={`absolute -top-4 left-1/2 -translate-x-1/2 
                                ${isLast ? 'bg-red-500' : 'bg-yellow-500'} 
                                text-slate-900 text-[9px] font-bold rounded-full w-3.5 h-3.5 flex items-center justify-center`}>
                                {pathIdx + 1}
                              </div>
                            )}
                          </div>
                        )
                      })
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <Button type="button" onClick={handleGetToday} disabled={isLoadingToday || isSolving}
                    variant="outline" size="sm" className="border-green-600 text-green-700 hover:bg-green-50">
                    {isLoadingToday ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Download className="w-4 h-4 mr-1.5" />}
                    Today's Puzzle
                  </Button>
                  {isOfficialPuzzle ? (
                    <Button type="button" onClick={handleSolveOfficial} disabled={isSolving || isLoadingToday || isLoadingDict}
                      size="sm" className="bg-green-600 hover:bg-green-700 text-white">
                      {isSolving ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-1.5" />}
                      Solve Official
                    </Button>
                  ) : (
                    <Button type="button" onClick={handleSolve} disabled={isSolving || isLoadingToday || isLoadingDict}
                      size="sm" className="bg-red-600 hover:bg-red-700 text-white">
                      {isSolving ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Play className="w-4 h-4 mr-1.5" />}
                      Solve All
                    </Button>
                  )}
                </div>
                <Button type="button" onClick={handleClearGrid} variant="ghost" className="w-full text-slate-600" size="sm">
                  <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Clear Grid
                </Button>

                {error && (
                  <div className="p-2 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs">{error}</div>
                )}

                <div className="text-xs text-slate-500 space-y-0.5 bg-slate-50 p-2 rounded">
                  <p>💡 Click cells and type letters, or paste from clipboard</p>
                  <p>🏆 <strong>Solve Official</strong> = Squaredle words only | <strong>Solve All</strong> = Full dictionary</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-3">
            {result ? (
              <Card className="border-slate-200 shadow-sm h-full">
                <CardHeader className="pb-2 pt-3 px-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Search className="w-4 h-4 text-green-600" /> Found Words
                      </CardTitle>
                      <Badge variant="secondary" className="text-xs">{result.totalWords}</Badge>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-slate-500">
                      <Clock className="w-3 h-3" /> {result.executionTime.toFixed(0)}ms
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="px-3 pb-3">
                  <div className="flex flex-wrap gap-1 mb-3 pb-2 border-b border-slate-200">
                    <Button type="button" onClick={() => setSelectedLength(null)}
                      variant={selectedLength === null ? "default" : "outline"} size="sm"
                      className={`h-7 text-xs px-2 ${selectedLength === null ? "bg-red-600 hover:bg-red-700" : ""}`}>
                      All ({result.totalWords})
                    </Button>
                    {allLengths.map(length => (
                      <Button key={length} type="button" onClick={() => setSelectedLength(length)}
                        variant={selectedLength === length ? "default" : "outline"} size="sm"
                        className={`h-7 text-xs px-2 ${selectedLength === length ? "bg-red-600 hover:bg-red-700" : ""}`}>
                        {length}L ({result.byLength[length]?.length || 0})
                      </Button>
                    ))}
                  </div>

                  <ScrollArea className="h-[280px] sm:h-[320px] lg:h-[380px]">
                    <div className="space-y-3">
                      {selectedLength === null ? (
                        allLengths.map(length => (
                          <div key={length}>
                            <h3 className="text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-2">
                              <Badge variant="outline" className="font-mono text-xs">{length} letters</Badge>
                              <span className="text-slate-400">({result.byLength[length]?.length || 0})</span>
                            </h3>
                            <div className="flex flex-wrap gap-1">
                              {result.byLength[length]?.map((word, idx) => (
                                <Badge key={`${length}-${idx}`} variant="outline"
                                  className={`cursor-pointer py-1 px-2 text-xs font-mono transition-all duration-150 border
                                    ${highlightedWord?.word === word.word
                                      ? 'bg-yellow-400 text-slate-900 border-yellow-500 shadow-sm'
                                      : word.isBonus 
                                        ? 'bg-amber-50 text-amber-800 border-amber-300 hover:border-amber-400'
                                        : 'bg-white text-slate-700 border-slate-300 hover:border-red-400 hover:bg-red-50'}`}
                                  onMouseEnter={() => setHighlightedWord(word)}
                                  onMouseLeave={() => setHighlightedWord(null)}>
                                  {word.word}
                                  {word.isBonus && <Star className="w-3 h-3 ml-1 inline" />}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {result.byLength[selectedLength]?.map((word, idx) => (
                            <Badge key={idx} variant="outline"
                              className={`cursor-pointer py-1 px-2 text-xs font-mono transition-all duration-150 border
                                ${highlightedWord?.word === word.word
                                  ? 'bg-yellow-400 text-slate-900 border-yellow-500 shadow-sm'
                                  : word.isBonus 
                                    ? 'bg-amber-50 text-amber-800 border-amber-300 hover:border-amber-400'
                                    : 'bg-white text-slate-700 border-slate-300 hover:border-red-400 hover:bg-red-50'}`}
                              onMouseEnter={() => setHighlightedWord(word)}
                              onMouseLeave={() => setHighlightedWord(null)}>
                              {word.word}
                              {word.isBonus && <Star className="w-3 h-3 ml-1 inline" />}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </ScrollArea>

                  <div className="text-xs text-slate-500 flex items-center gap-1 mt-2 pt-2 border-t border-slate-200">
                    <Info className="w-3 h-3" /> Hover to highlight path
                    {result.words.some(w => w.isBonus) && (
                      <><Star className="w-3 h-3 mx-1 text-amber-500" /> = Bonus word</>
                    )}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="border-slate-200 shadow-sm h-full min-h-[300px] sm:min-h-[380px] flex items-center justify-center">
                <CardContent className="text-center py-8">
                  <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Grid3X3 className="w-6 h-6 text-slate-400" />
                  </div>
                  <h3 className="text-base font-semibold text-slate-700 mb-1">No Results Yet</h3>
                  <p className="text-slate-500 text-xs max-w-xs mx-auto">Enter letters and click "Solve" to find all words</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>

      <footer className="border-t border-slate-200 bg-white mt-6">
        <div className="max-w-6xl mx-auto px-3 py-3 text-center text-xs text-slate-500">
          <p>Squaredle Solver • {isLoadingDict ? 'Loading dictionary...' : `${dictSize.toLocaleString()} words loaded`}</p>
        </div>
      </footer>
    </div>
  )
}
