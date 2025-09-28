'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Trophy, TrendingUp, Crown, Shield, Route, Plus, ThumbsDown, History } from 'lucide-react'
import Image from 'next/image'
import { supabase, Player, PlayerStats } from '@/lib/supabase'

interface LeaderboardProps {
  onAddGame: () => void
  onShowAnalytics: () => void
  onShowHistory?: () => void
}

export default function Leaderboard({ onAddGame, onShowAnalytics, onShowHistory }: LeaderboardProps) {
  console.log('Leaderboard component rendering')
  
  const [data, setData] = useState<{
    players: Player[]
    stats: PlayerStats[]
    totalGames: number
    error: string | null
    loaded: boolean
  }>({
    players: [],
    stats: [],
    totalGames: 0,
    error: null,
    loaded: false
  })

  useEffect(() => {
    console.log('Leaderboard useEffect triggered')
    
    const fetchData = async () => {
      try {
        console.log('Starting data fetch...')
        
        // Fetch all data in parallel with detailed error logging
        const [playersRes, statsRes, gamesRes] = await Promise.all([
          supabase.from('players').select('*').order('name'),
          supabase.from('player_stats').select('*'),
          supabase.from('games').select('*', { count: 'exact', head: true })
        ])

        console.log('Raw responses:', {
          playersRes,
          statsRes,
          gamesRes
        })

        // Check for errors in responses
        if (playersRes.error) {
          console.error('Players fetch error:', playersRes.error)
          throw new Error(`Players: ${playersRes.error.message}`)
        }
        if (statsRes.error) {
          console.error('Stats fetch error:', statsRes.error)
          throw new Error(`Stats: ${statsRes.error.message}`)
        }
        if (gamesRes.error) {
          console.error('Games fetch error:', gamesRes.error)
          throw new Error(`Games: ${gamesRes.error.message}`)
        }

        console.log('All data fetched successfully:', {
          players: playersRes.data?.length || 0,
          stats: statsRes.data?.length || 0,
          games: gamesRes.count || 0
        })

        setData({
          players: playersRes.data || [],
          stats: statsRes.data || [],
          totalGames: gamesRes.count || 0,
          error: null,
          loaded: true
        })
        
        console.log('Data state updated, loaded: true')
      } catch (error) {
        console.error('Error fetching data:', error)
        setData(prev => ({
          ...prev,
          error: error instanceof Error ? error.message : 'Failed to load data',
          loaded: true
        }))
      }
    }

    fetchData()

    // Set up real-time subscriptions with error handling
    const gamesSubscription = supabase
      .channel('leaderboard-games', {
        config: {
          broadcast: { self: true }
        }
      })
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'games' 
      }, (payload) => {
        console.log('Games table changed:', payload)
        fetchData()
      })
      .subscribe((status) => {
        console.log('Games subscription status:', status)
      })

    const scoresSubscription = supabase
      .channel('leaderboard-scores', {
        config: {
          broadcast: { self: true }
        }
      })
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'game_scores' 
      }, (payload) => {
        console.log('Game scores table changed:', payload)
        fetchData()
      })
      .subscribe((status) => {
        console.log('Scores subscription status:', status)
      })

    const statsSubscription = supabase
      .channel('leaderboard-stats', {
        config: {
          broadcast: { self: true }
        }
      })
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'player_stats' 
      }, (payload) => {
        console.log('Player stats table changed:', payload)
        fetchData()
      })
      .subscribe((status) => {
        console.log('Stats subscription status:', status)
      })

    return () => {
      gamesSubscription.unsubscribe()
      scoresSubscription.unsubscribe()
      statsSubscription.unsubscribe()
    }
  }, [])

  const getPlayerStats = (playerId: string) => {
    return data.stats.find(s => s.player_id === playerId) || {
      total_games: 0,
      wins: 0,
      total_points: 0,
      longest_road_count: 0,
      largest_army_count: 0,
      win_streak: 0,
      best_win_streak: 0
    }
  }

  const calculatePrizeProbability = (playerStats: PlayerStats) => {
    if (data.totalGames === 0) return 0
    const winRate = playerStats.wins / playerStats.total_games
    const remainingGames = 20 - data.totalGames
    if (remainingGames <= 0) return playerStats.wins > 0 ? 100 : 0
    
    // Simple probability calculation based on current win rate
    const expectedWins = winRate * remainingGames
    const totalExpectedWins = playerStats.wins + expectedWins
    
    // This is a simplified calculation - in reality, it would be more complex
    return Math.min(95, Math.max(5, totalExpectedWins * 5))
  }

  const calculateLoseChance = (playerStats: PlayerStats, playerRank: number) => {
    if (data.totalGames === 0) return 25 // Equal chance at start
    if (data.totalGames >= 20) {
      // Tournament is over, return actual result
      return playerRank === sortedPlayers.length ? 100 : 0
    }
    
    const remainingGames = 20 - data.totalGames
    const currentPoints = playerStats.total_points
    const avgPointsPerGame = data.totalGames > 0 ? currentPoints / playerStats.total_games : 8
    
    // Calculate expected final points
    const expectedFinalPoints = currentPoints + (avgPointsPerGame * remainingGames)
    
    // Simple calculation based on current position and expected performance
    const totalPlayers = data.players.length
    const positionFactor = (playerRank - 1) / (totalPlayers - 1) // 0 for 1st, 1 for last
    const performanceFactor = Math.max(0, Math.min(1, (10 - avgPointsPerGame) / 5)) // Higher for worse performance
    
    const baseChance = positionFactor * 60 + performanceFactor * 30
    const randomFactor = remainingGames * 2 // More games = more uncertainty
    
    return Math.min(85, Math.max(5, baseChance + randomFactor))
  }

  const sortedPlayers = data.players
    .map(player => ({
      ...player,
      stats: getPlayerStats(player.id)
    }))
    .sort((a, b) => b.stats.total_points - a.stats.total_points || b.stats.wins - a.stats.wins)

  const getInitials = (name: string) => {
    const parts = name.trim().split(/\s+/)
    const first = parts[0]?.[0] || ''
    const second = parts[1]?.[0] || ''
    return (first + second).toUpperCase()
  }

  const isLoading = !data.loaded
  console.log('Render check - isLoading:', isLoading, 'data.loaded:', data.loaded, 'players:', data.players.length, 'stats:', data.stats.length)

  if (data.error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-red-50 flex items-center justify-center p-4">
        <div className="text-center space-y-4 max-w-md">
          <div className="text-red-500 text-6xl">⚠️</div>
          <h2 className="text-2xl font-bold text-red-600">Error Loading Data</h2>
          <p className="text-gray-600">{data.error}</p>
          <button
            onClick={() => {
              setData(prev => ({ ...prev, loaded: false, error: null }))
              // Trigger re-fetch by updating a dependency
            }}
            className="bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 text-white px-6 py-3 rounded-lg font-semibold"
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-red-50 p-4">
      <div className="max-w-6xl mx-auto space-y-6">
        {isLoading && (
          <div className="text-center space-y-2 p-4 bg-amber-50 border border-amber-200 rounded">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              className="w-8 h-8 border-4 border-amber-400 border-t-transparent rounded-full mx-auto"
            />
            <p className="text-amber-700 text-sm">Loading leaderboard...</p>
          </div>
        )}

        {/* Prize Pool Status */}
        <Card className="bg-gradient-to-r from-yellow-50 to-amber-50 border-amber-200">
          <CardHeader className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-amber-800">
              <motion.div
                animate={{ 
                  rotate: [0, -5, 5, -5, 0],
                  scale: [1, 1.05, 1, 1.05, 1]
                }}
                transition={{ 
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
              >
                <Trophy className="w-6 h-6" />
              </motion.div>
              <span className="text-2xl font-bold">₹10,000</span>
            </div>
            <button
              onClick={onShowHistory}
              className="p-2 rounded-full bg-white/60 hover:bg-white/80 shadow-sm border border-amber-200 transition-colors"
              aria-label="View Game History"
            >
              <History className="w-5 h-5 text-amber-700" />
            </button>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Games Completed</span>
                <span>{data.totalGames}/20</span>
              </div>
              <Progress value={(data.totalGames / 20) * 100} className="h-2" />
            </div>
          </CardContent>
        </Card>

        <div className="space-y-3">
          {sortedPlayers.map((player, index) => {
            const isFirst = index === 0
            const isLast = index === sortedPlayers.length - 1
            const prizeProbability = calculatePrizeProbability(player.stats)
            const winPercentage = player.stats.total_games > 0 ? Math.round((player.stats.wins / player.stats.total_games) * 100) : 0
            
            return (
              <div key={player.id} className={`bg-white rounded-lg border p-4 shadow-sm ${
                index === 0 ? 'border-green-500 border-2' : 
                index === sortedPlayers.length - 1 ? 'border-red-500 border-2' : 
                'border-gray-100'
              }`}>
                <div className="flex items-center justify-between">
                  {/* Left side - Player info */}
                  <div className="flex items-center gap-3">
                    <div className="text-sm text-gray-400 font-medium w-6">#{index + 1}</div>
                    <div className="relative">
                      <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center text-amber-800 font-semibold">
                        {getInitials(player.name)}
                      </div>
                      {isFirst && (
                        <Crown className="w-4 h-4 text-yellow-500 absolute -top-1 -right-1" />
                      )}
                      {isLast && (
                        <ThumbsDown className="w-3.5 h-3.5 text-rose-500 absolute -bottom-1 -right-1" />
                      )}
                    </div>
                    <div>
                      <div className="font-semibold text-gray-900">{player.name}</div>
                      <div className="text-sm text-gray-500">
                        {player.stats.wins} wins • {winPercentage}% win rate
                      </div>
                    </div>
                  </div>
                  
                  {/* Right side - Stats */}
                  <div className="flex items-center gap-4">
                    <div className="hidden sm:flex items-center gap-4 text-sm">
                      <div className="text-center">
                        <div className="flex items-center gap-1 text-gray-500 text-xs justify-center">
                          <Route className="w-3 h-3" />
                          <span>Longest Road</span>
                        </div>
                        <div className="font-medium">{player.stats.longest_road_count}</div>
                      </div>
                      <div className="text-center">
                        <div className="flex items-center gap-1 text-gray-500 text-xs justify-center">
                          <Shield className="w-3 h-3" />
                          <span>Largest Army</span>
                        </div>
                        <div className="font-medium">{player.stats.largest_army_count}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-gray-500 text-xs">Lose Chance</div>
                        <div className="font-medium text-red-500">{Math.round(calculateLoseChance(player.stats, index + 1))}%</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-gray-900">{player.stats.total_points}</div>
                      <div className="text-sm text-gray-500">points</div>
                    </div>
                  </div>
                </div>
                
                {/* Mobile stats row */}
                <div className="sm:hidden mt-3 pt-3 border-t border-gray-100 flex justify-around text-sm">
                  <div className="text-center">
                    <div className="flex items-center gap-1 text-gray-500 text-xs justify-center">
                      <Route className="w-3 h-3" />
                      <span>Longest Road</span>
                    </div>
                    <div className="font-medium">{player.stats.longest_road_count}</div>
                  </div>
                  <div className="text-center">
                    <div className="flex items-center gap-1 text-gray-500 text-xs justify-center">
                      <Shield className="w-3 h-3" />
                      <span>Largest Army</span>
                    </div>
                    <div className="font-medium">{player.stats.largest_army_count}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-gray-500 text-xs">Lose Chance</div>
                    <div className="font-medium text-red-500">{Math.round(calculateLoseChance(player.stats, index + 1))}%</div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Floating Add Game Button */}
        <button
          aria-label="Add Game"
          onClick={onAddGame}
          className="fixed bottom-24 right-6 z-40 rounded-full p-4 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold shadow-lg hover:shadow-xl active:scale-95 transition-all"
        >
          <Plus className="w-6 h-6" />
        </button>
      </div>
    </div>
  )
}
