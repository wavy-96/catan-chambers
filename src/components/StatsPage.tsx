'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import Image from 'next/image'
import { supabase, Player, Game, GameScore, TournamentPlayerStats } from '@/lib/supabase'
import { useTournament } from '@/lib/tournament-context'
import { Trophy, Route, Shield, Crown, ThumbsDown, TrendingUp, TrendingDown, Minus } from 'lucide-react'

interface StatLeader {
  player: Player
  value: number
  previousValue?: number
}

export default function StatsPage() {
  const { selectedTournament, tournaments } = useTournament()
  const [players, setPlayers] = useState<Player[]>([])
  const [games, setGames] = useState<Game[]>([])
  const [gameScores, setGameScores] = useState<GameScore[]>([])
  const [playerStats, setPlayerStats] = useState<TournamentPlayerStats[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (selectedTournament) {
      fetchStatsData()
    }
  }, [selectedTournament])

  const fetchStatsData = async () => {
    if (!selectedTournament) return
    
    try {
      setLoading(true)
      
      const [playersRes, gamesRes, scoresRes, statsRes] = await Promise.all([
        supabase.from('players').select('*').order('name'),
        supabase.from('games').select('*').eq('tournament_id', selectedTournament.id).order('game_number'),
        supabase.from('game_scores').select('*'),
        supabase.from('tournament_player_stats').select('*').eq('tournament_id', selectedTournament.id)
      ])

      setPlayers(playersRes.data || [])
      setGames(gamesRes.data || [])
      
      // Filter scores to only include games from this tournament
      const gameIds = (gamesRes.data || []).map(g => g.id)
      const filteredScores = (scoresRes.data || []).filter(s => gameIds.includes(s.game_id))
      setGameScores(filteredScores)
      
      setPlayerStats(statsRes.data || [])
    } catch (error) {
      console.error('Error fetching stats data:', error)
    } finally {
      setLoading(false)
    }
  }

  const getPlayerStats = (playerId: string): TournamentPlayerStats => {
    return playerStats.find(s => s.player_id === playerId) || {
      id: '',
      tournament_id: selectedTournament?.id || '',
      total_games: 0,
      wins: 0,
      total_points: 0,
      longest_road_count: 0,
      largest_army_count: 0,
      win_streak: 0,
      best_win_streak: 0
    }
  }

  const getMostWins = (): StatLeader[] => {
    return players
      .map(player => ({
        player,
        value: getPlayerStats(player.id).wins
      }))
      .sort((a, b) => b.value - a.value)
  }

  const getMostLongestRoads = (): StatLeader[] => {
    return players
      .map(player => ({
        player,
        value: getPlayerStats(player.id).longest_road_count
      }))
      .sort((a, b) => b.value - a.value)
  }

  const getMostLargestArmy = (): StatLeader[] => {
    return players
      .map(player => ({
        player,
        value: getPlayerStats(player.id).largest_army_count
      }))
      .sort((a, b) => b.value - a.value)
  }

  const getMostGamesAtTop = (): StatLeader[] => {
    const topPositions: { [playerId: string]: number } = {}
    const sortedGames = [...games].sort((a, b) => a.game_number - b.game_number)
    
    sortedGames.forEach((game, gameIndex) => {
      const cumulativeScores: { [playerId: string]: number } = {}
      
      players.forEach(player => {
        let totalPoints = 0
        for (let i = 0; i <= gameIndex; i++) {
          const gameToCheck = sortedGames[i]
          const playerScore = gameScores.find(gs => 
            gs.game_id === gameToCheck.id && gs.player_id === player.id
          )
          if (playerScore) {
            totalPoints += playerScore.points
          }
        }
        cumulativeScores[player.id] = totalPoints
      })
      
      if (Object.keys(cumulativeScores).length > 0) {
        const topPlayerId = Object.keys(cumulativeScores).reduce((prev, current) => 
          cumulativeScores[current] > cumulativeScores[prev] ? current : prev
        )
        topPositions[topPlayerId] = (topPositions[topPlayerId] || 0) + 1
      }
    })

    return players
      .map(player => ({
        player,
        value: topPositions[player.id] || 0
      }))
      .sort((a, b) => b.value - a.value)
  }

  const getMostGamesAtBottom = (): StatLeader[] => {
    const bottomPositions: { [playerId: string]: number } = {}
    const sortedGames = [...games].sort((a, b) => a.game_number - b.game_number)
    
    sortedGames.forEach((game, gameIndex) => {
      const cumulativeScores: { [playerId: string]: number } = {}
      
      players.forEach(player => {
        let totalPoints = 0
        for (let i = 0; i <= gameIndex; i++) {
          const gameToCheck = sortedGames[i]
          const playerScore = gameScores.find(gs => 
            gs.game_id === gameToCheck.id && gs.player_id === player.id
          )
          if (playerScore) {
            totalPoints += playerScore.points
          }
        }
        cumulativeScores[player.id] = totalPoints
      })
      
      if (Object.keys(cumulativeScores).length > 0) {
        const bottomPlayerId = Object.keys(cumulativeScores).reduce((prev, current) => 
          cumulativeScores[current] < cumulativeScores[prev] ? current : prev
        )
        bottomPositions[bottomPlayerId] = (bottomPositions[bottomPlayerId] || 0) + 1
      }
    })

    return players
      .map(player => ({
        player,
        value: bottomPositions[player.id] || 0
      }))
      .sort((a, b) => b.value - a.value)
  }

  const StatTable = ({ title, data, icon, highlightColor = 'amber', className = '', index = 0 }: { 
    title: string
    data: StatLeader[]
    icon: React.ReactNode
    highlightColor?: string
    className?: string
    index?: number
  }) => {
    const isViewingCompleted = selectedTournament?.status === 'completed'
    
    return (
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.1, duration: 0.5 }}
        className={`glass-card rounded-2xl p-6 relative overflow-hidden ${className}`}
      >
        <div className="flex items-center gap-3 mb-6 relative z-10">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-white to-gray-50 shadow-sm border border-gray-100">
            {icon}
          </div>
          <h3 className="text-xl font-bold text-gray-800 font-macondo">{title}</h3>
        </div>
        
        <div className="overflow-hidden relative z-10">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200/50">
                <th className="text-left py-2 text-[10px] uppercase font-bold text-gray-400 tracking-wider">Rank</th>
                <th className="text-left py-2 text-[10px] uppercase font-bold text-gray-400 tracking-wider">Player</th>
                <th className="text-right py-2 text-[10px] uppercase font-bold text-gray-400 tracking-wider">Count</th>
              </tr>
            </thead>
            <tbody>
              {data.map((item, index) => (
                <tr key={item.player.id} className="border-b border-gray-100/50 last:border-b-0 hover:bg-white/40 transition-colors">
                  <td className="py-3">
                    <div className="flex items-center">
                      {index === 0 && item.value > 0 && (
                        <div className="w-5 h-5 relative mr-1">
                          <Image src="/icon-crown.png" alt="Winner" fill className="object-contain" />
                        </div>
                      )}
                      {index === data.length - 1 && item.value > 0 && title.includes('Bottom') && (
                        <div className="w-5 h-5 relative mr-1">
                          <Image src="/icon-shackles.png" alt="Last" fill className="object-contain" />
                        </div>
                      )}
                      <span className={`text-sm font-bold ${index === 0 ? 'text-amber-600' : 'text-gray-500'}`}>#{index + 1}</span>
                    </div>
                  </td>
                  <td className="py-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg shadow-sm flex items-center justify-center font-bold text-xs ${
                        isViewingCompleted 
                          ? 'bg-slate-100 text-slate-600' 
                          : 'bg-gradient-to-br from-amber-50 to-orange-50 text-amber-800 border border-amber-100'
                      }`}>
                        {item.player.name.slice(0, 1)}
                      </div>
                      <span className="font-semibold text-gray-700">{item.player.name}</span>
                    </div>
                  </td>
                  <td className="py-3 text-right">
                    <span className="text-lg font-black text-gray-900 font-mono">{item.value}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>
    )
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
              <Image src="/icon-chalice.png" alt="Statistics" fill className={`object-contain ${isViewingCompleted ? 'grayscale opacity-70' : ''}`} />
            </div>
          </div>
          <div>
            <h2 className="font-bold text-gray-800 text-lg leading-none mb-1 font-macondo">{selectedTournament?.name} Statistics</h2>
            <p className="text-xs text-gray-500 font-medium">
              {games.length} games recorded
              {isViewingCompleted && ' • Archived'}
            </p>
          </div>
        </div>
      </div>

      {games.length === 0 ? (
        <div className="text-center py-16 glass-panel rounded-2xl">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-amber-50 flex items-center justify-center shadow-inner">
            <Trophy className="w-10 h-10 text-amber-300" />
          </div>
          <h3 className="text-xl font-bold text-gray-800 mb-2 font-macondo">No Data to Analyze</h3>
          <p className="text-gray-500 max-w-xs mx-auto">The scribes are waiting for the first game to be played.</p>
        </div>
      ) : (
        <div className="space-y-6">
          <StatTable 
            title="Most Wins" 
            data={getMostWins()} 
            icon={<div className="relative w-8 h-8"><Image src="/icon-chalice.png" alt="Wins" fill className="object-contain" /></div>}
            className="border-t-4 border-t-yellow-400"
            index={0}
          />
          
          <div className="grid gap-6 sm:grid-cols-2">
            <StatTable 
              title="Road Builder" 
              data={getMostLongestRoads()} 
              icon={<div className="relative w-8 h-8"><Image src="/icon-road.png" alt="Road" fill className="object-contain" /></div>}
              className="border-t-4 border-t-blue-400"
              index={1}
            />
            
            <StatTable 
              title="Army Commander" 
              data={getMostLargestArmy()} 
              icon={<div className="relative w-8 h-8"><Image src="/icon-army.png" alt="Army" fill className="object-contain" /></div>}
              className="border-t-4 border-t-green-500"
              index={2}
            />
          </div>
          
          <StatTable 
            title="Dominance (Time in Lead)" 
            data={getMostGamesAtTop()} 
            icon={<div className="relative w-8 h-8"><Image src="/icon-crown.png" alt="Crown" fill className="object-contain" /></div>}
            className="border-t-4 border-t-purple-400"
            index={3}
          />
          
          <StatTable 
            title="The Struggle (Time at Bottom)" 
            data={getMostGamesAtBottom()} 
            icon={<div className="relative w-8 h-8"><Image src="/icon-shackles.png" alt="Shackles" fill className="object-contain" /></div>}
            className="border-t-4 border-t-rose-400 opacity-90"
            index={4}
          />
        </div>
      )}
    </div>
  )
}
