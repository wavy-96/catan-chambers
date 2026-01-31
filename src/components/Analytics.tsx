'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import Image from 'next/image'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js'
import { Bar, Line } from 'react-chartjs-2'
import { TrendingUp, TrendingDown, Minus, ChevronLeft, ChevronRight, Trophy, GitCompare, Route, Shield } from 'lucide-react'
import { supabase, Player, Game, GameScore, Tournament } from '@/lib/supabase'
import { useTournament } from '@/lib/tournament-context'

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend
)

interface AnalyticsProps {
  isOpen?: boolean
  onClose?: () => void
}

interface ComparisonPlayerData {
  playerId: string
  name: string
  currentPoints: number
  previousPoints: number
  currentWins: number
  previousWins: number
  currentLongestRoad: number
  previousLongestRoad: number
  currentLargestArmy: number
  previousLargestArmy: number
  difference: number
}

interface TournamentProgressData {
  gameNumber: number
  currentTournamentPoints: Record<string, number>
  previousTournamentPoints: Record<string, number>
}

// Player colors - bright for current tournament, muted for previous
const PLAYER_COLORS = {
  current: ['#f59e0b', '#ef4444', '#10b981', '#3b82f6'], // amber, red, green, blue
  previous: ['#fcd34d', '#fca5a5', '#6ee7b7', '#93c5fd'], // lighter versions
}
const COLORS = PLAYER_COLORS.current

export default function Analytics({ isOpen, onClose }: AnalyticsProps) {
  const { selectedTournament, tournaments } = useTournament()
  const [players, setPlayers] = useState<Player[]>([])
  const [games, setGames] = useState<Game[]>([])
  const [gameScores, setGameScores] = useState<GameScore[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedGame, setSelectedGame] = useState<number>(1)
  const [comparisonData, setComparisonData] = useState<ComparisonPlayerData[]>([])
  const [previousTournament, setPreviousTournament] = useState<Tournament | null>(null)
  const [progressData, setProgressData] = useState<TournamentProgressData[]>([])
  const [selectedChartPlayer, setSelectedChartPlayer] = useState<string | 'all'>('all')

  useEffect(() => {
    if (selectedTournament) {
      fetchAnalyticsData()
    }

    // Set up real-time subscriptions
    const gamesSubscription = supabase
      .channel('analytics-games')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'games' 
      }, () => fetchAnalyticsData())
      .subscribe()

    const scoresSubscription = supabase
      .channel('analytics-scores')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'game_scores' 
      }, () => fetchAnalyticsData())
      .subscribe()

    return () => {
      gamesSubscription.unsubscribe()
      scoresSubscription.unsubscribe()
    }
  }, [selectedTournament])

  // Fetch comparison data when selected game changes
  useEffect(() => {
    if (selectedTournament && selectedGame > 0 && players.length > 0) {
      fetchComparisonData()
    }
  }, [selectedGame, selectedTournament, players, tournaments, games, gameScores])

  const fetchAnalyticsData = async () => {
    if (!selectedTournament) return
    
    try {
      setLoading(true)
      
      const [playersRes, gamesRes, scoresRes] = await Promise.all([
        supabase.from('players').select('*').order('name'),
        supabase.from('games').select('*').eq('tournament_id', selectedTournament.id).order('game_number'),
        supabase.from('game_scores').select('*')
      ])

      setPlayers(playersRes.data || [])
      setGames(gamesRes.data || [])
      
      // Filter scores to only include games from this tournament
      const gameIds = (gamesRes.data || []).map(g => g.id)
      const filteredScores = (scoresRes.data || []).filter(s => gameIds.includes(s.game_id))
      setGameScores(filteredScores)
      
      // Set selected game to the latest game if available
      if (gamesRes.data && gamesRes.data.length > 0) {
        const latestGame = Math.max(...gamesRes.data.map(g => g.game_number))
        setSelectedGame(latestGame)
      } else {
        setSelectedGame(1)
      }
    } catch (error) {
      console.error('Error fetching analytics data:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchComparisonData = async () => {
    if (!selectedTournament || selectedGame === 0 || players.length === 0) {
      setComparisonData([])
      setPreviousTournament(null)
      setProgressData([])
      return
    }

    // Find the previous tournament
    const sortedTournaments = [...tournaments].sort((a, b) => 
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    )
    
    const currentIndex = sortedTournaments.findIndex(t => t.id === selectedTournament.id)
    
    if (currentIndex <= 0) {
      // No previous tournament to compare
      setComparisonData([])
      setPreviousTournament(null)
      setProgressData([])
      return
    }

    const prevTournament = sortedTournaments[currentIndex - 1]
    setPreviousTournament(prevTournament)

    try {
      // Get ALL games from previous tournament (for the progression chart)
      const { data: allPrevGames } = await supabase
        .from('games')
        .select('*')
        .eq('tournament_id', prevTournament.id)
        .order('game_number', { ascending: true })

      // Get games up to selected game number for comparison
      const prevGamesUpToSelected = (allPrevGames || []).filter(g => g.game_number <= selectedGame)

      if (prevGamesUpToSelected.length === 0) {
        setComparisonData([])
        setProgressData([])
        return
      }

      const prevGameIds = prevGamesUpToSelected.map(g => g.id)
      const allPrevGameIds = (allPrevGames || []).map(g => g.id)

      // Get scores for previous tournament games (up to selected game)
      const { data: prevScores } = await supabase
        .from('game_scores')
        .select('*')
        .in('game_id', prevGameIds)

      // Get ALL scores for previous tournament (for progression chart)
      const { data: allPrevScores } = await supabase
        .from('game_scores')
        .select('*')
        .in('game_id', allPrevGameIds)

      if (!prevScores) {
        setComparisonData([])
        return
      }

      // Calculate stats per player for previous tournament (up to selected game)
      const prevStatsByPlayer: Record<string, { points: number, wins: number, longestRoad: number, largestArmy: number }> = {}
      
      players.forEach(player => {
        prevStatsByPlayer[player.id] = { points: 0, wins: 0, longestRoad: 0, largestArmy: 0 }
      })

      prevScores.forEach(score => {
        if (prevStatsByPlayer[score.player_id]) {
          prevStatsByPlayer[score.player_id].points += score.points
          if (score.longest_road) prevStatsByPlayer[score.player_id].longestRoad += 1
          if (score.largest_army) prevStatsByPlayer[score.player_id].largestArmy += 1
        }
      })

      // Count wins from previous tournament games
      prevGamesUpToSelected.forEach(game => {
        if (game.winner_id && prevStatsByPlayer[game.winner_id]) {
          prevStatsByPlayer[game.winner_id].wins += 1
        }
      })

      // Calculate current tournament stats (up to selected game)
      const currentGamesUpToSelected = games.filter(g => g.game_number <= selectedGame)
      const currentGameIds = currentGamesUpToSelected.map(g => g.id)
      const currentScoresFiltered = gameScores.filter(s => currentGameIds.includes(s.game_id))

      const currentStatsByPlayer: Record<string, { points: number, wins: number, longestRoad: number, largestArmy: number }> = {}
      
      players.forEach(player => {
        currentStatsByPlayer[player.id] = { points: 0, wins: 0, longestRoad: 0, largestArmy: 0 }
      })

      currentScoresFiltered.forEach(score => {
        if (currentStatsByPlayer[score.player_id]) {
          currentStatsByPlayer[score.player_id].points += score.points
          if (score.longest_road) currentStatsByPlayer[score.player_id].longestRoad += 1
          if (score.largest_army) currentStatsByPlayer[score.player_id].largestArmy += 1
        }
      })

      currentGamesUpToSelected.forEach(game => {
        if (game.winner_id && currentStatsByPlayer[game.winner_id]) {
          currentStatsByPlayer[game.winner_id].wins += 1
        }
      })

      // Build comparison data
      const comparison: ComparisonPlayerData[] = players.map(player => {
        const current = currentStatsByPlayer[player.id] || { points: 0, wins: 0, longestRoad: 0, largestArmy: 0 }
        const previous = prevStatsByPlayer[player.id] || { points: 0, wins: 0, longestRoad: 0, largestArmy: 0 }
        
        return {
          playerId: player.id,
          name: player.name,
          currentPoints: current.points,
          previousPoints: previous.points,
          currentWins: current.wins,
          previousWins: previous.wins,
          currentLongestRoad: current.longestRoad,
          previousLongestRoad: previous.longestRoad,
          currentLargestArmy: current.largestArmy,
          previousLargestArmy: previous.largestArmy,
          difference: current.points - previous.points
        }
      }).sort((a, b) => b.currentPoints - a.currentPoints)

      setComparisonData(comparison)

      // Build progression data for the line chart
      const maxGames = Math.max(games.length, (allPrevGames || []).length)
      const progression: TournamentProgressData[] = []

      for (let i = 1; i <= maxGames; i++) {
        const currentTournamentPoints: Record<string, number> = {}
        const previousTournamentPoints: Record<string, number> = {}

        // Calculate cumulative points for current tournament at game i
        const currentGamesUpToI = games.filter(g => g.game_number <= i)
        const currentGameIdsUpToI = currentGamesUpToI.map(g => g.id)
        
        players.forEach(player => {
          let points = 0
          gameScores.filter(s => currentGameIdsUpToI.includes(s.game_id) && s.player_id === player.id)
            .forEach(s => points += s.points)
          currentTournamentPoints[player.id] = points
        })

        // Calculate cumulative points for previous tournament at game i
        const prevGamesUpToI = (allPrevGames || []).filter(g => g.game_number <= i)
        const prevGameIdsUpToI = prevGamesUpToI.map(g => g.id)
        
        players.forEach(player => {
          let points = 0
          ;(allPrevScores || []).filter(s => prevGameIdsUpToI.includes(s.game_id) && s.player_id === player.id)
            .forEach(s => points += s.points)
          previousTournamentPoints[player.id] = points
        })

        progression.push({
          gameNumber: i,
          currentTournamentPoints,
          previousTournamentPoints
        })
      }

      setProgressData(progression)
    } catch (error) {
      console.error('Error fetching comparison data:', error)
      setComparisonData([])
      setProgressData([])
    }
  }

  const getGameData = (gameNumber: number) => {
    const gamesUpToSelected = games.filter(g => g.game_number <= gameNumber)
    
    return players.map(player => {
      let cumulativePoints = 0
      
      gamesUpToSelected.forEach(game => {
        const gameScoresForGame = gameScores.filter(gs => gs.game_id === game.id)
        const playerScore = gameScoresForGame.find(gs => gs.player_id === player.id)
        if (playerScore) {
          cumulativePoints += playerScore.points
        }
      })
      
      return {
        name: player.name,
        points: cumulativePoints,
        color: COLORS[players.indexOf(player) % COLORS.length]
      }
    }).sort((a, b) => b.points - a.points)
  }

  const getAvailableGames = () => {
    return games.map(g => g.game_number).sort((a, b) => a - b)
  }

  const getSinglePlayerProgressionData = (playerId: string) => {
    if (progressData.length === 0 || players.length === 0) return null

    const player = players.find(p => p.id === playerId)
    if (!player) return null

    const playerIndex = players.findIndex(p => p.id === playerId)
    const currentGamesPlayed = games.length
    const previousGamesPlayed = previousTournament ? 
      progressData.filter(d => Object.values(d.previousTournamentPoints).some(v => v > 0)).length : 0
    const maxGames = Math.max(currentGamesPlayed, previousGamesPlayed, selectedTournament?.total_games || 20)
    
    // Calculate average points per game for prediction
    const totalPoints = progressData[currentGamesPlayed - 1]?.currentTournamentPoints[player.id] || 0
    const avgPointsPerGame = currentGamesPlayed > 0 ? totalPoints / currentGamesPlayed : 7

    // Generate labels up to max games
    const labels = Array.from({ length: maxGames }, (_, i) => `G${i + 1}`)
    
    const currentColor = PLAYER_COLORS.current[playerIndex % PLAYER_COLORS.current.length]

    // Current tournament data with predictions
    const currentActualData: (number | null)[] = []
    const currentPredictedData: (number | null)[] = []
    
    for (let i = 0; i < maxGames; i++) {
      if (i < currentGamesPlayed) {
        currentActualData.push(progressData[i]?.currentTournamentPoints[player.id] || 0)
        currentPredictedData.push(null)
      } else {
        currentActualData.push(null)
        const lastActualPoints = progressData[currentGamesPlayed - 1]?.currentTournamentPoints[player.id] || 0
        const predictedPoints = lastActualPoints + avgPointsPerGame * (i - currentGamesPlayed + 1)
        currentPredictedData.push(Math.round(predictedPoints))
      }
    }

    // Add connection point between actual and predicted
    if (currentGamesPlayed > 0 && currentGamesPlayed < maxGames) {
      currentPredictedData[currentGamesPlayed - 1] = currentActualData[currentGamesPlayed - 1]
    }

    // Previous tournament data
    const previousData: (number | null)[] = []
    if (previousTournament) {
      for (let i = 0; i < maxGames; i++) {
        const points = progressData[i]?.previousTournamentPoints[player.id]
        previousData.push(points !== undefined && points > 0 ? points : (i < previousGamesPlayed ? 0 : null))
      }
    }

    const datasets = [
      {
        label: selectedTournament?.name || 'Current',
        data: currentActualData,
        borderColor: currentColor,
        backgroundColor: `${currentColor}30`,
        fill: true,
        tension: 0.3,
        pointRadius: 5,
        pointHoverRadius: 8,
        borderWidth: 3,
      },
      {
        label: `${selectedTournament?.name || 'Current'} (Projected)`,
        data: currentPredictedData,
        borderColor: currentColor,
        backgroundColor: `${currentColor}10`,
        fill: true,
        tension: 0.3,
        pointRadius: 3,
        pointHoverRadius: 6,
        borderWidth: 2,
        borderDash: [6, 4],
      },
    ]

      if (previousTournament && previousData.some(d => d !== null)) {
      datasets.push({
        label: previousTournament.name,
        data: previousData,
        borderColor: '#94a3b8', // Solid slate color
        backgroundColor: '#94a3b815',
        fill: true,
        tension: 0.3,
        pointRadius: 4,
        pointHoverRadius: 6,
        borderWidth: 2,
        // Removed borderDash to make it solid
      })
    }

    return { labels, datasets, currentGamesPlayed, playerColor: currentColor }
  }

  const isViewingCompleted = selectedTournament?.status === 'completed'

  if (loading) {
    return (
      <div className="p-4 pb-32 max-w-2xl mx-auto flex items-center justify-center min-h-[400px]">
        <div className="glass-panel p-8 rounded-full">
           <div className="animate-spin rounded-full h-8 w-8 border-4 border-amber-500 border-t-transparent"></div>
        </div>
      </div>
    )
  }

  // Get progression data for the selected player (or first player if none selected)
  const effectiveChartPlayer = selectedChartPlayer === 'all' && players.length > 0 ? players[0].id : selectedChartPlayer
  const progressionChartData = effectiveChartPlayer !== 'all' ? getSinglePlayerProgressionData(effectiveChartPlayer) : null

  return (
    <div className="p-4 pb-32 max-w-2xl mx-auto space-y-6">
      {/* Tournament Header */}
      <div className={`glass-panel rounded-xl px-4 py-3 ${
        isViewingCompleted 
          ? 'bg-slate-100/80 border-slate-200' 
          : ''
      }`}>
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg shadow-sm border ${
            isViewingCompleted 
              ? 'bg-slate-100 border-slate-200' 
              : 'bg-gradient-to-br from-stone-50 to-stone-100 border-stone-200'
          }`}>
            <div className="relative w-6 h-6">
              <Image src="/icon-chalice.png" alt="History" fill className={`object-contain ${isViewingCompleted ? 'grayscale opacity-70' : ''}`} />
            </div>
          </div>
          <div>
            <h2 className="font-bold text-gray-800 text-lg leading-none mb-1 font-macondo">{selectedTournament?.name} History</h2>
            <p className="text-xs text-gray-500 font-medium">
              {games.length} games played
              {isViewingCompleted && ' • Tournament Complete'}
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {getAvailableGames().length > 0 ? (
          <>
            {/* Game Navigation */}
            <div className={`glass-card p-4 flex items-center justify-between`}>
              <button
                onClick={() => {
                  const availableGames = getAvailableGames()
                  const currentIndex = availableGames.indexOf(selectedGame)
                  if (currentIndex > 0) {
                    setSelectedGame(availableGames[currentIndex - 1])
                  }
                }}
                disabled={getAvailableGames().indexOf(selectedGame) === 0}
                className={`p-2 rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed ${
                  isViewingCompleted 
                    ? 'hover:bg-slate-100 text-slate-700' 
                    : 'hover:bg-amber-100 text-amber-700'
                }`}
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              
              <div className="text-center">
                <div className="text-xl font-bold text-gray-800 font-macondo">
                  Game {selectedGame}
                </div>
                <div className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                  {getAvailableGames().indexOf(selectedGame) + 1} of {getAvailableGames().length}
                </div>
              </div>
              
              <button
                onClick={() => {
                  const availableGames = getAvailableGames()
                  const currentIndex = availableGames.indexOf(selectedGame)
                  if (currentIndex < availableGames.length - 1) {
                    setSelectedGame(availableGames[currentIndex + 1])
                  }
                }}
                disabled={getAvailableGames().indexOf(selectedGame) === getAvailableGames().length - 1}
                className={`p-2 rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed ${
                  isViewingCompleted 
                    ? 'hover:bg-slate-100 text-slate-700' 
                    : 'hover:bg-amber-100 text-amber-700'
                }`}
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            </div>

            {/* Horizontal Bar Chart */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-card p-6"
            >
              <h3 className="text-lg font-bold text-gray-800 mb-6 font-macondo">
                Cumulative Points After Game {selectedGame}
              </h3>
              <div className="h-[300px] sm:h-[350px]">
                <Bar
                  data={{
                    labels: getGameData(selectedGame).map(d => d.name),
                    datasets: [
                      {
                        label: 'Cumulative Points',
                        data: getGameData(selectedGame).map(d => d.points),
                        backgroundColor: isViewingCompleted 
                          ? getGameData(selectedGame).map(() => '#94a3b8')
                          : getGameData(selectedGame).map(d => d.color),
                        borderColor: isViewingCompleted 
                          ? getGameData(selectedGame).map(() => '#64748b')
                          : getGameData(selectedGame).map(d => d.color),
                        borderWidth: 1,
                        borderRadius: 6,
                      },
                    ],
                  }}
                  options={{
                    indexAxis: 'y' as const,
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: { display: false },
                      tooltip: {
                        backgroundColor: 'rgba(255, 255, 255, 0.95)',
                        titleColor: '#374151',
                        bodyColor: '#374151',
                        borderColor: '#e5e7eb',
                        borderWidth: 1,
                        cornerRadius: 8,
                        displayColors: false,
                      },
                    },
                    scales: {
                      x: {
                        beginAtZero: true,
                        grid: { color: 'rgba(0,0,0,0.05)' },
                        ticks: { color: '#6b7280' },
                      },
                      y: {
                        grid: { display: false },
                        ticks: { color: '#6b7280', font: { weight: 500 } },
                      },
                    },
                    animation: { duration: 800, easing: 'easeOutQuart' },
                  }}
                />
              </div>
            </motion.div>

            {/* Tournament Progression Line Chart - Per Player */}
            {previousTournament && players.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 }}
                className="glass-card p-6 bg-gradient-to-br from-stone-50/50 to-stone-100/50 border-stone-200"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="relative w-8 h-8">
                      <Image src="/icon-trend.png" alt="Trend" fill className="object-contain" />
                    </div>
                    <h3 className="text-lg font-bold text-stone-800 font-macondo">
                      Points Progression
                    </h3>
                  </div>
                </div>

                {/* Player Selector Tabs */}
                <div className="flex gap-2 mb-4 overflow-x-auto pb-2 custom-scrollbar">
                  {players.map((player, idx) => {
                    const isSelected = effectiveChartPlayer === player.id
                    const playerColor = PLAYER_COLORS.current[idx % PLAYER_COLORS.current.length]
                    return (
                      <button
                        key={player.id}
                        onClick={() => setSelectedChartPlayer(player.id)}
                        className={`
                          flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-bold transition-all
                          ${isSelected 
                            ? 'text-white shadow-md scale-105' 
                            : 'bg-white/50 text-gray-500 hover:bg-white hover:text-gray-700'
                          }
                        `}
                        style={isSelected ? { backgroundColor: playerColor } : {}}
                      >
                        {player.name}
                      </button>
                    )
                  })}
                </div>

                {/* Legend */}
                <div className="flex flex-wrap gap-3 mb-3 text-xs font-medium">
                  <span className="flex items-center gap-1.5 text-gray-600">
                    <span 
                      className="w-4 h-1 rounded"
                      style={{ backgroundColor: progressionChartData?.playerColor || '#6366f1' }}
                    />
                    {selectedTournament?.name}
                  </span>
                  <span className="flex items-center gap-1.5 text-gray-600">
                    <span 
                      className="w-4 h-0.5 rounded"
                      style={{ 
                        backgroundColor: progressionChartData?.playerColor || '#6366f1',
                        opacity: 0.5,
                        backgroundImage: 'repeating-linear-gradient(90deg, transparent, transparent 2px, currentColor 2px, currentColor 4px)'
                      }}
                    />
                    Projected
                  </span>
                  <span className="flex items-center gap-1.5 text-gray-500">
                    <span className="w-4 h-0.5 bg-slate-400 rounded" />
                    {previousTournament.name}
                  </span>
                </div>

                {/* Chart */}
                {progressionChartData && (
                  <div className="h-[280px]">
                    <Line
                      data={progressionChartData}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        interaction: {
                          mode: 'index' as const,
                          intersect: false,
                        },
                        plugins: {
                          legend: {
                            display: false,
                          },
                          tooltip: {
                            backgroundColor: 'rgba(255, 255, 255, 0.95)',
                            titleColor: '#374151',
                            bodyColor: '#374151',
                            borderColor: '#e5e7eb',
                            borderWidth: 1,
                            cornerRadius: 8,
                            padding: 10,
                          },
                        },
                        scales: {
                          x: {
                            grid: { display: false },
                            ticks: { 
                              color: '#9ca3af',
                              font: { size: 9 },
                              maxRotation: 0,
                            },
                          },
                          y: {
                            beginAtZero: true,
                            grid: { color: 'rgba(0,0,0,0.05)' },
                            ticks: { 
                              color: '#9ca3af',
                              font: { size: 10 },
                            },
                          },
                        },
                      }}
                    />
                  </div>
                )}

                {progressionChartData && progressionChartData.currentGamesPlayed < (selectedTournament?.total_games || 20) && (
                  <p className="text-[10px] uppercase font-bold tracking-wider text-stone-400 mt-4 text-center">
                    Dashed line shows projection based on current average
                  </p>
                )}
              </motion.div>
            )}

            {/* Tournament Comparison Table */}
            {comparisonData.length > 0 && previousTournament && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="glass-card p-0 overflow-hidden bg-gradient-to-br from-stone-50/30 to-stone-100/30 border-stone-200"
              >
                <div className="flex items-center gap-3 p-5 pb-2">
                  <div className="relative w-8 h-8">
                    <Image src="/icon-balance.png" alt="Comparison" fill className="object-contain" />
                  </div>
                  <h3 className="text-lg font-bold text-stone-800 font-macondo">
                    Detailed Comparison
                  </h3>
                </div>
                
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-stone-200 bg-stone-50/30">
                        <th className="text-left py-3 px-4 font-bold text-stone-600 uppercase text-[10px] tracking-wider">Player</th>
                        <th className="text-center py-3 px-2 font-bold text-stone-600 uppercase text-[10px] tracking-wider" colSpan={2}>
                          Points
                        </th>
                        <th className="text-center py-3 px-2 font-bold text-stone-600 uppercase text-[10px] tracking-wider" colSpan={2}>
                          Road
                        </th>
                        <th className="text-center py-3 px-2 font-bold text-stone-600 uppercase text-[10px] tracking-wider" colSpan={2}>
                          Army
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {comparisonData.map((player, index) => (
                        <tr key={player.playerId} className="border-b border-stone-100 last:border-b-0 hover:bg-white/40 transition-colors">
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              <span className="text-xs font-bold text-stone-400 w-4">#{index + 1}</span>
                              <div className="w-7 h-7 rounded-lg bg-white shadow-sm flex items-center justify-center text-stone-700 font-bold text-xs">
                                {player.name.slice(0, 1)}
                              </div>
                              <span className="font-semibold text-gray-700">{player.name}</span>
                            </div>
                          </td>
                          {/* Points */}
                          <td className="py-3 px-1 text-center border-l border-stone-100/50">
                            <span className="font-bold text-gray-900">{player.currentPoints}</span>
                          </td>
                          <td className="py-3 px-1 text-center">
                            <span className="text-gray-400 text-xs">{player.previousPoints}</span>
                            <DiffBadge current={player.currentPoints} previous={player.previousPoints} />
                          </td>
                          {/* Longest Road */}
                          <td className="py-3 px-1 text-center border-l border-stone-100/50">
                            <span className="font-bold text-gray-900">{player.currentLongestRoad}</span>
                          </td>
                          <td className="py-3 px-1 text-center">
                            <span className="text-gray-400 text-xs">{player.previousLongestRoad}</span>
                            <DiffBadge current={player.currentLongestRoad} previous={player.previousLongestRoad} />
                          </td>
                          {/* Largest Army */}
                          <td className="py-3 px-1 text-center border-l border-stone-100/50">
                            <span className="font-bold text-gray-900">{player.currentLargestArmy}</span>
                          </td>
                          <td className="py-3 px-1 text-center">
                            <span className="text-gray-400 text-xs">{player.previousLargestArmy}</span>
                            <DiffBadge current={player.currentLargestArmy} previous={player.previousLargestArmy} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Summary */}
                <div className="p-5 bg-stone-50/30 border-t border-stone-200">
                  <div className="grid grid-cols-3 gap-6 text-sm">
                    <SummaryStat
                      label="Total Points"
                      current={comparisonData.reduce((sum, p) => sum + p.currentPoints, 0)}
                      previous={comparisonData.reduce((sum, p) => sum + p.previousPoints, 0)}
                    />
                    <SummaryStat
                      label="Road Cards"
                      current={comparisonData.reduce((sum, p) => sum + p.currentLongestRoad, 0)}
                      previous={comparisonData.reduce((sum, p) => sum + p.previousLongestRoad, 0)}
                    />
                    <SummaryStat
                      label="Army Cards"
                      current={comparisonData.reduce((sum, p) => sum + p.currentLargestArmy, 0)}
                      previous={comparisonData.reduce((sum, p) => sum + p.previousLargestArmy, 0)}
                    />
                  </div>
                </div>
              </motion.div>
            )}
          </>
        ) : (
          <div className="glass-panel p-12 text-center">
            <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gray-100/50 flex items-center justify-center">
              <Trophy className="w-10 h-10 text-gray-300" />
            </div>
            <h3 className="text-lg font-bold text-gray-800 font-macondo mb-2">The Scroll is Blank</h3>
            <p className="text-gray-500 max-w-xs mx-auto">Start your journey to populate the history books.</p>
          </div>
        )}
      </div>
    </div>
  )
}

// Helper component for difference badges
function DiffBadge({ current, previous }: { current: number, previous: number }) {
  const diff = current - previous
  if (diff === 0) return null
  
  return (
    <span className={`ml-1 text-[10px] font-bold ${diff > 0 ? 'text-green-600' : 'text-red-500'}`}>
      {diff > 0 ? '▲' : '▼'}{Math.abs(diff)}
    </span>
  )
}

// Helper component for summary stats
function SummaryStat({ label, current, previous }: { label: string, current: number, previous: number }) {
  const diff = current - previous
  
  return (
    <div className="text-center">
      <div className="text-[10px] uppercase font-bold text-stone-400 mb-1 tracking-wider">{label}</div>
      <div className="font-black text-xl text-gray-800">{current}</div>
      <div className="text-xs font-medium text-gray-500 mt-1">
        vs {previous}
        <span className={`ml-1 ${diff > 0 ? 'text-green-600' : diff < 0 ? 'text-red-500' : 'text-gray-400'}`}>
          ({diff > 0 ? '+' : ''}{diff})
        </span>
      </div>
    </div>
  )
}
