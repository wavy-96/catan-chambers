'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Trophy, Crown, Shield, Route, Plus, ThumbsDown, History, TrendingUp, TrendingDown, Minus, ChevronDown, ChevronUp } from 'lucide-react'
import { supabase, Player, TournamentPlayerStats, GameScore, Game } from '@/lib/supabase'
import { useTournament } from '@/lib/tournament-context'
import TournamentSelector from './tournament-selector'
import Image from 'next/image'

interface LeaderboardProps {
  onAddGame: () => void
  onShowAnalytics: () => void
  onShowHistory?: () => void
}

interface ComparisonData {
  playerId: string
  currentPoints: number
  previousPoints: number
  difference: number
}

export default function Leaderboard({ onAddGame, onShowAnalytics, onShowHistory }: LeaderboardProps) {
  const { selectedTournament, tournaments, activeTournament } = useTournament()
  
  const [data, setData] = useState<{
    players: Player[]
    stats: TournamentPlayerStats[]
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

  const [comparisonData, setComparisonData] = useState<ComparisonData[]>([])
  const [isComparisonOpen, setIsComparisonOpen] = useState(false)

  useEffect(() => {
    if (!selectedTournament) return

    const fetchData = async () => {
      try {
        // Fetch players
        const { data: playersData, error: playersError } = await supabase
          .from('players')
          .select('*')
          .order('name')

        if (playersError) throw new Error(`Players: ${playersError.message}`)

        // Fetch tournament-specific stats
        const { data: statsData, error: statsError } = await supabase
          .from('tournament_player_stats')
          .select('*')
          .eq('tournament_id', selectedTournament.id)

        if (statsError) throw new Error(`Stats: ${statsError.message}`)

        // Fetch games count for this tournament
        const { count: gamesCount, error: gamesError } = await supabase
          .from('games')
          .select('*', { count: 'exact', head: true })
          .eq('tournament_id', selectedTournament.id)

        if (gamesError) throw new Error(`Games: ${gamesError.message}`)

        setData({
          players: playersData || [],
          stats: statsData || [],
          totalGames: gamesCount || 0,
          error: null,
          loaded: true
        })

        // Fetch comparison data if not viewing the first tournament
        await fetchComparisonData(playersData || [], gamesCount || 0)
      } catch (error) {
        console.error('Error fetching data:', error)
        setData(prev => ({
          ...prev,
          error: error instanceof Error ? error.message : 'Failed to load data',
          loaded: true
        }))
      }
    }

    const fetchComparisonData = async (players: Player[], currentGames: number) => {
      if (currentGames === 0) {
        setComparisonData([])
        return
      }

      // Find the previous tournament (Catan 1.0 if viewing 2.0, etc.)
      const sortedTournaments = [...tournaments].sort((a, b) => 
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      )
      
      const currentIndex = sortedTournaments.findIndex(t => t.id === selectedTournament?.id)
      
      if (currentIndex <= 0) {
        setComparisonData([])
        return
      }

      const previousTournament = sortedTournaments[currentIndex - 1]

      try {
        // Get games from previous tournament up to the same game count
        const { data: prevGames } = await supabase
          .from('games')
          .select('id')
          .eq('tournament_id', previousTournament.id)
          .order('game_number', { ascending: true })
          .limit(currentGames)

        if (!prevGames || prevGames.length === 0) {
          setComparisonData([])
          return
        }

        const gameIds = prevGames.map(g => g.id)

        // Get scores for those games
        const { data: prevScores } = await supabase
          .from('game_scores')
          .select('player_id, points')
          .in('game_id', gameIds)

        if (!prevScores) {
          setComparisonData([])
          return
        }

        // Calculate cumulative points per player at that stage
        const prevPointsByPlayer: Record<string, number> = {}
        prevScores.forEach(score => {
          prevPointsByPlayer[score.player_id] = (prevPointsByPlayer[score.player_id] || 0) + score.points
        })

        // Get current tournament stats
        const { data: currentStats } = await supabase
          .from('tournament_player_stats')
          .select('player_id, total_points')
          .eq('tournament_id', selectedTournament?.id)

        const comparison: ComparisonData[] = players.map(player => {
          const currentPoints = currentStats?.find(s => s.player_id === player.id)?.total_points || 0
          const previousPoints = prevPointsByPlayer[player.id] || 0
          return {
            playerId: player.id,
            currentPoints,
            previousPoints,
            difference: currentPoints - previousPoints
          }
        })

        setComparisonData(comparison)
      } catch (error) {
        console.error('Error fetching comparison data:', error)
        setComparisonData([])
      }
    }

    fetchData()

    // Set up real-time subscriptions
    const gamesSubscription = supabase
      .channel('leaderboard-games')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'games' 
      }, () => fetchData())
      .subscribe()

    const scoresSubscription = supabase
      .channel('leaderboard-scores')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'game_scores' 
      }, () => fetchData())
      .subscribe()

    const statsSubscription = supabase
      .channel('leaderboard-stats')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'tournament_player_stats' 
      }, () => fetchData())
      .subscribe()

    return () => {
      gamesSubscription.unsubscribe()
      scoresSubscription.unsubscribe()
      statsSubscription.unsubscribe()
    }
  }, [selectedTournament, tournaments])

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

  const calculateLoseChance = (playerStats: TournamentPlayerStats | ReturnType<typeof getPlayerStats>, playerRank: number) => {
    const totalGamesInTournament = selectedTournament?.total_games || 20
    const gamesPlayed = data.totalGames
    const remainingGames = totalGamesInTournament - gamesPlayed
    const numPlayers = sortedPlayers.length
    
    // Equal chance at start
    if (gamesPlayed === 0 || numPlayers === 0) {
      return Math.round(100 / Math.max(numPlayers, 1))
    }
    
    // Tournament over - actual result
    if (remainingGames <= 0) {
      return playerRank === numPlayers ? 100 : 0
    }

    const myPoints = playerStats.total_points
    const lastPlacePoints = sortedPlayers[numPlayers - 1]?.stats.total_points || 0
    const gapFromLast = myPoints - lastPlacePoints // 0 if you're last, positive otherwise
    
    // In Catan, typical point swing per game between two players is ~3-4 points
    // (winner gets 10+, others get 5-8, so relative position can shift ~3-4 pts/game)
    const avgSwingPerGame = 3.5
    const totalPotentialSwing = remainingGames * avgSwingPerGame
    
    // Safety margin: how protected is your lead over last place?
    // 0 = currently in last, 1 = gap exceeds max possible swing (very safe)
    const safetyMargin = Math.min(gapFromLast / Math.max(totalPotentialSwing, 1), 1)
    
    // Base lose chance based on safety margin
    // Currently last (safety = 0): ~65% chance
    // Very safe (safety = 1): ~8% chance
    const maxLoseChance = 65
    const minLoseChance = 8
    let baseChance = maxLoseChance - (safetyMargin * (maxLoseChance - minLoseChance))
    
    // Small position adjustment - being closer to last increases risk slightly
    const positionPenalty = ((playerRank - 1) / Math.max(numPlayers - 1, 1)) * 8
    baseChance += positionPenalty
    
    // Confidence adjustment based on tournament progress
    // Early tournament: pull toward equal chance (more uncertainty)
    // Late tournament: trust the point gaps more
    const progressRatio = gamesPlayed / totalGamesInTournament
    const confidenceFactor = Math.min(progressRatio * 1.5, 1)
    const equalChance = 100 / numPlayers
    const adjustedChance = equalChance + (baseChance - equalChance) * confidenceFactor
    
    return Math.round(Math.min(90, Math.max(5, adjustedChance)))
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

  const getPlayerComparison = (playerId: string) => {
    return comparisonData.find(c => c.playerId === playerId)
  }

  const getPreviousTournamentName = () => {
    const sortedTournaments = [...tournaments].sort((a, b) => 
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    )
    const currentIndex = sortedTournaments.findIndex(t => t.id === selectedTournament?.id)
    if (currentIndex <= 0) return null
    return sortedTournaments[currentIndex - 1].name
  }

  const isLoading = !data.loaded
  const isViewingCompletedTournament = selectedTournament?.status === 'completed'
  const canAddGames = selectedTournament?.status === 'active'
  const totalGames = selectedTournament?.total_games || 20

  if (data.error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 pb-24">
        <div className="glass-panel p-8 rounded-2xl text-center space-y-4 max-w-md">
          <div className="text-red-500 text-6xl">⚠️</div>
          <h2 className="text-2xl font-bold text-red-600 font-macondo">Error Loading Data</h2>
          <p className="text-gray-600">{data.error}</p>
          <button
            onClick={() => setData(prev => ({ ...prev, loaded: false, error: null }))}
            className="bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 text-white px-6 py-3 rounded-xl font-semibold shadow-lg"
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 pb-32 max-w-2xl mx-auto space-y-6">
      {isLoading && (
        <div className="glass-panel text-center space-y-3 p-8 rounded-2xl">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            className="w-10 h-10 border-4 border-amber-400 border-t-transparent rounded-full mx-auto"
          />
          <p className="text-amber-800 font-medium animate-pulse">Summoning the Council...</p>
        </div>
      )}

      {/* Tournament Selector */}
      <TournamentSelector />

      {/* Completed Tournament Banner */}
      {isViewingCompletedTournament && (
        <div className="glass-panel bg-slate-100/50 rounded-xl p-4 flex items-center gap-3">
          <div className="p-2 bg-slate-200/50 rounded-lg backdrop-blur-sm">
            <Trophy className="w-5 h-5 text-slate-600" />
          </div>
          <div>
            <div className="font-semibold text-slate-800 font-macondo text-lg">Tournament Completed</div>
            <div className="text-sm text-slate-500">Viewing archives from {selectedTournament?.name}</div>
          </div>
        </div>
      )}

      {/* Prize Pool Status */}
      <Card className={`glass-card overflow-hidden border-0 ${
        isViewingCompletedTournament 
          ? 'bg-gradient-to-br from-slate-50 to-gray-100' 
          : 'bg-gradient-to-br from-amber-50/80 to-yellow-50/80'
      }`}>
        <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-400/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div className={`flex items-center gap-3 ${isViewingCompletedTournament ? 'text-slate-700' : 'text-amber-900'}`}>
            <div className="relative">
               <motion.div
                animate={isViewingCompletedTournament ? {} : { 
                  y: [0, -4, 0],
                  filter: ['brightness(1)', 'brightness(1.2)', 'brightness(1)']
                }}
                transition={{ 
                  duration: 3,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
              >
                <div className="w-10 h-10 relative">
                  <Image 
                    src="/icon-leaderboard.png" 
                    alt="Prize" 
                    fill 
                    className="object-contain"
                  />
                </div>
              </motion.div>
            </div>
            <div>
              <div className="text-xs font-bold uppercase tracking-widest opacity-60">Prize Pool</div>
              <span className="text-3xl font-black font-macondo tracking-tight">₹{(selectedTournament?.prize_pool || 10000).toLocaleString()}</span>
            </div>
          </div>
          <button
            onClick={onShowHistory}
            className={`p-2.5 rounded-full shadow-sm border backdrop-blur-md transition-all active:scale-95 ${
              isViewingCompletedTournament 
                ? 'bg-white/40 hover:bg-white/60 border-slate-200' 
                : 'bg-white/40 hover:bg-white/60 border-amber-200/50'
            }`}
            aria-label="View Game History"
          >
            <History className={`w-5 h-5 ${isViewingCompletedTournament ? 'text-slate-600' : 'text-amber-800'}`} />
          </button>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex justify-between text-xs font-medium text-gray-500 uppercase tracking-wider">
              <span>Progress</span>
              <span>{data.totalGames} / {totalGames} Games</span>
            </div>
            <div className="h-3 bg-white/50 rounded-full overflow-hidden p-[1px] shadow-inner">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${(data.totalGames / totalGames) * 100}%` }}
                transition={{ duration: 1, ease: "easeOut" }}
                className={`h-full rounded-full ${
                  isViewingCompletedTournament 
                    ? 'bg-slate-400' 
                    : 'bg-gradient-to-r from-amber-400 to-orange-500 shadow-[0_0_10px_rgba(245,158,11,0.5)]'
                }`} 
              />
            </div>

            {/* Predictions - Only show after 5 games */}
            {!isViewingCompletedTournament && data.totalGames >= 5 && sortedPlayers.length >= 2 && (
              <div className="mt-4 pt-4 border-t border-amber-100/50 grid grid-cols-2 gap-4">
                <div className="text-left">
                  <div className="text-[10px] uppercase font-bold text-amber-700/60 tracking-wider mb-1">Predicted Winner</div>
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center text-[10px] font-bold text-amber-800 border border-amber-200">
                      {getInitials(sortedPlayers[0].name)}
                    </div>
                    <span className="font-bold text-amber-900 text-sm">{sortedPlayers[0].name}</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] uppercase font-bold text-red-800/60 tracking-wider mb-1">Predicted Loser</div>
                  <div className="flex items-center gap-2 justify-end">
                    <span className="font-bold text-red-900 text-sm">
                      {(() => {
                        const highestRiskPlayer = [...sortedPlayers].sort((a, b) => {
                          const riskA = calculateLoseChance(a.stats, sortedPlayers.indexOf(a) + 1)
                          const riskB = calculateLoseChance(b.stats, sortedPlayers.indexOf(b) + 1)
                          return riskB - riskA
                        })[0]
                        return highestRiskPlayer.name
                      })()}
                    </span>
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-red-50 to-red-100 flex items-center justify-center text-[10px] font-bold text-red-800 border border-red-200">
                      {(() => {
                        const highestRiskPlayer = [...sortedPlayers].sort((a, b) => {
                          const riskA = calculateLoseChance(a.stats, sortedPlayers.indexOf(a) + 1)
                          const riskB = calculateLoseChance(b.stats, sortedPlayers.indexOf(b) + 1)
                          return riskB - riskA
                        })[0]
                        return getInitials(highestRiskPlayer.name)
                      })()}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Comparison Card */}
      {comparisonData.length > 0 && getPreviousTournamentName() && data.totalGames > 0 && (
        <Card className="glass-card border-l-4 border-l-stone-400 bg-gradient-to-r from-stone-50/80 to-stone-100/50 transition-all duration-300">
          <CardHeader 
            className="pb-2 cursor-pointer select-none"
            onClick={() => setIsComparisonOpen(!isComparisonOpen)}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 text-stone-800">
                <div className="relative w-8 h-8">
                  <Image src="/icon-trend.png" alt="Trend" fill className="object-contain" />
                </div>
                <div>
                  <span className="font-semibold font-macondo text-lg block leading-none mb-1">At This Stage in {getPreviousTournamentName()}</span>
                  <div className="text-xs text-stone-500 font-medium uppercase tracking-wider">Comparison after {data.totalGames} games</div>
                </div>
              </div>
              <div className={`p-1 rounded-full bg-stone-200/50 text-stone-600 transition-transform duration-300 ${isComparisonOpen ? 'rotate-180' : ''}`}>
                <ChevronDown className="w-5 h-5" />
              </div>
            </div>
          </CardHeader>
          <AnimatePresence>
            {isComparisonOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3, ease: "easeInOut" }}
                className="overflow-hidden"
              >
                <CardContent>
                  <div className="space-y-3 pt-2">
                    {sortedPlayers.map((player, index) => {
                      const comparison = getPlayerComparison(player.id)
                      if (!comparison) return null
                      
                      return (
                        <div key={player.id} className="flex items-center justify-between text-sm py-1 border-b border-stone-200/50 last:border-0">
                          <div className="flex items-center gap-3">
                            <span className="text-stone-400 font-mono w-4 font-bold text-xs">#{index + 1}</span>
                            <span className="font-medium text-slate-700">{player.name}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-stone-400/80 text-xs">
                              prev: {comparison.previousPoints}
                            </span>
                            <div className={`flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold shadow-sm ${
                              comparison.difference > 0 
                                ? 'bg-green-100 text-green-700' 
                                : comparison.difference < 0 
                                  ? 'bg-red-100 text-red-700' 
                                  : 'bg-gray-100 text-gray-600'
                            }`}>
                              {comparison.difference > 0 ? (
                                <TrendingUp className="w-3 h-3" />
                              ) : comparison.difference < 0 ? (
                                <TrendingDown className="w-3 h-3" />
                              ) : (
                                <Minus className="w-3 h-3" />
                              )}
                              {comparison.difference > 0 ? '+' : ''}{comparison.difference}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              </motion.div>
            )}
          </AnimatePresence>
        </Card>
      )}

      {/* Player Cards */}
      <div className="space-y-4">
        {sortedPlayers.map((player, index) => {
          const isFirst = index === 0
          const isLast = index === sortedPlayers.length - 1
          const winPercentage = player.stats.total_games > 0 ? Math.round((player.stats.wins / player.stats.total_games) * 100) : 0
          
          return (
            <motion.div 
              key={player.id} 
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: index * 0.08, type: "spring", stiffness: 50 }}
              whileHover={{ scale: 1.02, translateY: -2 }}
              className={`glass-card rounded-2xl p-5 relative overflow-hidden group ${
                isFirst ? 'ring-2 ring-yellow-400/50 shadow-[0_0_30px_-5px_rgba(251,191,36,0.3)]' : ''
              }`}
            >
              {isFirst && (
                <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-yellow-300/20 to-transparent blur-2xl rounded-bl-full pointer-events-none" />
              )}
              
              <div className="flex items-center justify-between relative z-10">
                {/* Left side - Player info */}
                <div className="flex items-center gap-4">
                  <div className={`text-xl font-black w-8 text-center font-macondo ${
                    index === 0 ? 'text-yellow-600 drop-shadow-sm' : 
                    index === 1 ? 'text-slate-400' : 
                    index === 2 ? 'text-amber-700' : 
                    'text-gray-400/60'
                  }`}>
                    #{index + 1}
                  </div>
                  
                  <div className="relative">
                    <div className={`w-14 h-14 rounded-2xl rotate-3 shadow-md flex items-center justify-center font-bold text-lg transition-transform group-hover:rotate-0 ${
                      isViewingCompletedTournament 
                        ? 'bg-gradient-to-br from-slate-100 to-slate-200 text-slate-600 border border-slate-300' 
                        : 'bg-gradient-to-br from-amber-100 to-orange-100 text-amber-800 border border-amber-200'
                    }`}>
                      {getInitials(player.name)}
                    </div>
                    {isFirst && (
                      <div className="absolute -top-3 -right-2 transform rotate-12 w-6 h-6">
                        <Image src="/icon-crown.png" alt="Winner" fill className="object-contain drop-shadow-md" />
                      </div>
                    )}
                    {isLast && (
                      <div className="absolute -bottom-2 -right-2 transform -rotate-12 w-6 h-6">
                        <Image src="/icon-shackles.png" alt="Last Place" fill className="object-contain drop-shadow-md" />
                      </div>
                    )}
                  </div>
                  
                  <div>
                    <div className="font-bold text-gray-900 text-lg">{player.name}</div>
                    <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                      {player.stats.wins} wins <span className="text-gray-300">•</span> {winPercentage}% WR
                    </div>
                  </div>
                </div>
                
                {/* Right side - Stats */}
                <div className="flex items-center gap-5">
                  <div className="hidden sm:flex items-center gap-5 text-sm">
                    <div className="text-center group-hover:scale-110 transition-transform">
                      <div className="flex items-center gap-1 text-gray-400 text-[10px] uppercase font-bold justify-center mb-0.5">
                        <div className="w-4 h-4 relative">
                          <Image src="/icon-road.png" alt="Road" fill className="object-contain" />
                        </div>
                        <span className="ml-1">Road</span>
                      </div>
                      <div className="font-bold text-slate-700">{player.stats.longest_road_count}</div>
                    </div>
                    <div className="text-center group-hover:scale-110 transition-transform">
                      <div className="flex items-center gap-1 text-gray-400 text-[10px] uppercase font-bold justify-center mb-0.5">
                        <div className="w-4 h-4 relative">
                          <Image src="/icon-army.png" alt="Army" fill className="object-contain" />
                        </div>
                        <span className="ml-1">Army</span>
                      </div>
                      <div className="font-bold text-slate-700">{player.stats.largest_army_count}</div>
                    </div>
                    {!isViewingCompletedTournament && (
                      <div className="text-center group-hover:scale-110 transition-transform">
                        <div className="text-red-900 text-[10px] uppercase font-bold mb-0.5">Risk</div>
                        <div className={`font-bold ${
                          calculateLoseChance(player.stats, index + 1) > 50 ? 'text-red-900' : 'text-green-600'
                        }`}>
                          {Math.round(calculateLoseChance(player.stats, index + 1))}%
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <div className="text-right pl-4 border-l border-gray-100">
                    <div className="text-3xl font-black text-gray-900 leading-none font-macondo">{player.stats.total_points}</div>
                    <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center mt-1">Pts</div>
                  </div>
                </div>
              </div>
              
              {/* Mobile stats row */}
              <div className="sm:hidden mt-4 pt-3 border-t border-gray-100/50 flex justify-between px-2 text-sm bg-gray-50/30 rounded-lg pb-1">
                <div className="text-center">
                  <div className="flex items-center gap-1 text-gray-400 text-[10px] uppercase font-bold justify-center mb-0.5">
                    <div className="w-3 h-3 relative">
                      <Image src="/icon-road.png" alt="Road" fill className="object-contain" />
                    </div>
                    <span className="ml-1">Road</span>
                  </div>
                  <div className="font-bold text-slate-700">{player.stats.longest_road_count}</div>
                </div>
                <div className="text-center">
                  <div className="flex items-center gap-1 text-gray-400 text-[10px] uppercase font-bold justify-center mb-0.5">
                    <div className="w-3 h-3 relative">
                      <Image src="/icon-army.png" alt="Army" fill className="object-contain" />
                    </div>
                    <span className="ml-1">Army</span>
                  </div>
                  <div className="font-bold text-slate-700">{player.stats.largest_army_count}</div>
                </div>
                {!isViewingCompletedTournament && (
                  <div className="text-center">
                    <div className="text-red-900 text-[10px] uppercase font-bold mb-0.5">Risk</div>
                    <div className={`font-bold ${
                      calculateLoseChance(player.stats, index + 1) > 50 ? 'text-red-900' : 'text-green-600'
                    }`}>
                      {Math.round(calculateLoseChance(player.stats, index + 1))}%
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )
        })}
      </div>

      {/* Empty state for new tournament */}
      {data.loaded && data.totalGames === 0 && (
        <div className="text-center py-16 glass-panel rounded-2xl">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center shadow-inner">
            <Trophy className="w-10 h-10 text-amber-600" />
          </div>
          <h3 className="text-xl font-bold text-gray-800 mb-2 font-macondo">The Board is Empty</h3>
          <p className="text-gray-500 mb-6 max-w-xs mx-auto">The lands of Catan await their first conquerors. Begin the saga.</p>
          {canAddGames && (
            <button
              onClick={onAddGame}
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-xl font-bold hover:from-amber-600 hover:to-orange-700 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
            >
              <Plus className="w-5 h-5" />
              Log First Match
            </button>
          )}
        </div>
      )}

      {/* Floating Add Game Button - Only show for active tournament */}
      {canAddGames && (
        <button
          aria-label="Add Game"
          onClick={onAddGame}
          className="fixed bottom-28 right-6 z-40 rounded-full p-4 bg-gradient-to-r from-amber-500 to-orange-600 text-white font-bold shadow-[0_10px_30px_-10px_rgba(245,158,11,0.6)] hover:shadow-[0_20px_40px_-12px_rgba(245,158,11,0.8)] active:scale-95 transition-all hover:-translate-y-1 group"
        >
          <Plus className="w-6 h-6 group-hover:rotate-90 transition-transform duration-300" />
        </button>
      )}
    </div>
  )
}
