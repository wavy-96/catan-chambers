'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js'
import { Bar } from 'react-chartjs-2'
import { TrendingUp, BarChart3, PieChart as PieChartIcon, Award, ChevronLeft, ChevronRight } from 'lucide-react'
import { supabase, Player, Game, GameScore } from '@/lib/supabase'

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
)

interface AnalyticsProps {
  isOpen?: boolean
  onClose?: () => void
}

interface ChartData {
  gameNumber: number
  [key: string]: number | string
}

interface AchievementData {
  name: string
  value: number
  color: string
  [key: string]: string | number
}

const COLORS = ['#f59e0b', '#ef4444', '#10b981', '#3b82f6']

export default function Analytics({ isOpen, onClose }: AnalyticsProps) {
  const [players, setPlayers] = useState<Player[]>([])
  const [games, setGames] = useState<Game[]>([])
  const [gameScores, setGameScores] = useState<GameScore[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedGame, setSelectedGame] = useState<number>(1)

  // In-page render by default

  useEffect(() => {
    fetchAnalyticsData()

    // Set up real-time subscriptions with error handling
    const gamesSubscription = supabase
      .channel('analytics-games', {
        config: {
          broadcast: { self: true }
        }
      })
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'games' 
      }, (payload) => {
        console.log('Analytics: Games table changed:', payload)
        fetchAnalyticsData()
      })
      .subscribe((status) => {
        console.log('Analytics: Games subscription status:', status)
      })

    const scoresSubscription = supabase
      .channel('analytics-scores', {
        config: {
          broadcast: { self: true }
        }
      })
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'game_scores' 
      }, (payload) => {
        console.log('Analytics: Game scores table changed:', payload)
        fetchAnalyticsData()
      })
      .subscribe((status) => {
        console.log('Analytics: Scores subscription status:', status)
      })

    const statsSubscription = supabase
      .channel('analytics-stats', {
        config: {
          broadcast: { self: true }
        }
      })
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'player_stats' 
      }, (payload) => {
        console.log('Analytics: Player stats table changed:', payload)
        fetchAnalyticsData()
      })
      .subscribe((status) => {
        console.log('Analytics: Stats subscription status:', status)
      })

    return () => {
      gamesSubscription.unsubscribe()
      scoresSubscription.unsubscribe()
      statsSubscription.unsubscribe()
    }
  }, [])

  const fetchAnalyticsData = async () => {
    try {
      setLoading(true)
      console.log('Analytics: Starting data fetch...')
      
      // Fetch all data
      const [playersRes, gamesRes, scoresRes] = await Promise.all([
        supabase.from('players').select('*').order('name'),
        supabase.from('games').select('*').order('game_number'),
        supabase.from('game_scores').select('*').order('created_at')
      ])

      console.log('Analytics: Fetched data:', {
        players: playersRes.data?.length || 0,
        games: gamesRes.data?.length || 0,
        scores: scoresRes.data?.length || 0
      })

      setPlayers(playersRes.data || [])
      setGames(gamesRes.data || [])
      setGameScores(scoresRes.data || [])
      
      // Set selected game to the latest game if available
      if (gamesRes.data && gamesRes.data.length > 0) {
        const latestGame = Math.max(...gamesRes.data.map(g => g.game_number))
        console.log('Analytics: Setting selected game to:', latestGame)
        setSelectedGame(latestGame)
      } else {
        console.log('Analytics: No games found')
      }
    } catch (error) {
      console.error('Error fetching analytics data:', error)
    } finally {
      setLoading(false)
    }
  }

  const getPlayerName = (playerId: string) => {
    return players.find(p => p.id === playerId)?.name || 'Unknown'
  }

  const getGameData = (gameNumber: number) => {
    // Get all games up to and including the selected game number
    const gamesUpToSelected = games.filter(g => g.game_number <= gameNumber)
    console.log('Analytics: getGameData called with gameNumber:', gameNumber)
    console.log('Analytics: gamesUpToSelected:', gamesUpToSelected)
    console.log('Analytics: gameScores:', gameScores)
    
    return players.map(player => {
      // Calculate cumulative points from all games up to the selected game
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
    }).sort((a, b) => b.points - a.points) // Sort by cumulative points descending
  }

  const getAvailableGames = () => {
    return games.map(g => g.game_number).sort((a, b) => a - b)
  }

  const getWinRateData = () => {
    return players.map(player => {
      const playerGames = games.filter(g => 
        gameScores.some(gs => gs.game_id === g.id && gs.player_id === player.id)
      )
      const wins = games.filter(g => g.winner_id === player.id).length
      const winRate = playerGames.length > 0 ? (wins / playerGames.length) * 100 : 0
      
      return {
        name: player.name,
        wins,
        totalGames: playerGames.length,
        winRate: Math.round(winRate)
      }
    })
  }

  const getAchievementData = (): AchievementData[] => {
    return players.map((player, index) => {
      const longestRoad = gameScores.filter(gs => 
        gs.player_id === player.id && gs.longest_road
      ).length
      const largestArmy = gameScores.filter(gs => 
        gs.player_id === player.id && gs.largest_army
      ).length
      
      return {
        name: player.name,
        value: longestRoad + largestArmy,
        color: COLORS[index % COLORS.length]
      }
    })
  }

  const getTotalPointsData = () => {
    return players.map(player => {
      const totalPoints = gameScores
        .filter(gs => gs.player_id === player.id)
        .reduce((sum, gs) => sum + gs.points, 0)
      
      return {
        name: player.name,
        points: totalPoints
      }
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-red-50 p-4">
        <div className="max-w-6xl mx-auto flex items-center justify-center min-h-[400px]">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            className="w-8 h-8 border-4 border-amber-400 border-t-transparent rounded-full"
          />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-red-50 p-4">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="space-y-6">
            {getAvailableGames().length > 0 ? (
              <>
                {/* Game Navigation */}
                <div className="bg-white/80 backdrop-blur rounded-lg p-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <button
                      onClick={() => {
                        const availableGames = getAvailableGames()
                        const currentIndex = availableGames.indexOf(selectedGame)
                        if (currentIndex > 0) {
                          setSelectedGame(availableGames[currentIndex - 1])
                        }
                      }}
                      disabled={getAvailableGames().indexOf(selectedGame) === 0}
                      className="p-2 rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed hover:bg-amber-100 text-amber-700"
                    >
                      <ChevronLeft className="w-6 h-6" />
                    </button>
                    
                    <div className="text-center">
                      <div className="text-lg font-semibold text-gray-800">
                        Game {selectedGame}
                      </div>
                      <div className="text-sm text-gray-500">
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
                      className="p-2 rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed hover:bg-amber-100 text-amber-700"
                    >
                      <ChevronRight className="w-6 h-6" />
                    </button>
                  </div>
                </div>

                {/* Horizontal Bar Chart */}
                <div className="bg-white/70 backdrop-blur rounded-lg p-6 shadow-sm border-0">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">
                    Cumulative Points After Game {selectedGame}
                  </h3>
                  <div className="h-[400px] sm:h-[500px] bg-white/50 rounded-lg p-4" style={{ minHeight: '400px' }}>
                    <Bar
                      data={{
                        labels: getGameData(selectedGame).map(d => d.name),
                        datasets: [
                          {
                            label: 'Cumulative Points',
                            data: getGameData(selectedGame).map(d => d.points),
                            backgroundColor: getGameData(selectedGame).map(d => d.color),
                            borderColor: getGameData(selectedGame).map(d => d.color),
                            borderWidth: 1,
                            borderRadius: 4,
                          },
                        ],
                      }}
                      options={{
                        indexAxis: 'y' as const,
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                          legend: {
                            display: false,
                          },
                          title: {
                            display: false,
                          },
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
                            grid: {
                              color: '#e5e7eb',
                            },
                            ticks: {
                              color: '#6b7280',
                            },
                          },
                          y: {
                            grid: {
                              display: false,
                            },
                            ticks: {
                              color: '#6b7280',
                            },
                          },
                        },
                        animation: {
                          duration: 800,
                          easing: 'easeOutQuart',
                        },
                      }}
                    />
                  </div>
                </div>
              </>
            ) : (
              <div className="bg-white/70 backdrop-blur rounded-lg p-6 shadow-sm border-0">
                <div className="h-[400px] sm:h-[500px] bg-white/50 rounded-lg p-4 flex items-center justify-center">
                  <div className="text-center text-gray-500">
                    <TrendingUp className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                    <p>No games played yet</p>
                    <p className="text-sm">Start playing to see game results!</p>
                  </div>
                </div>
              </div>
            )}
        </div>
      </div>
    </div>
  )
}
