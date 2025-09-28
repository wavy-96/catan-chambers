'use client'

import { useState, useEffect } from 'react'
import { supabase, Player, Game, GameScore, PlayerStats } from '@/lib/supabase'
import { Trophy, Route, Shield, Crown, ThumbsDown } from 'lucide-react'

interface StatLeader {
  player: Player
  value: number
  percentage?: number
}

export default function StatsPage() {
  const [players, setPlayers] = useState<Player[]>([])
  const [games, setGames] = useState<Game[]>([])
  const [gameScores, setGameScores] = useState<GameScore[]>([])
  const [playerStats, setPlayerStats] = useState<PlayerStats[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchStatsData()
  }, [])

  const fetchStatsData = async () => {
    try {
      setLoading(true)
      
      const [playersRes, gamesRes, scoresRes, statsRes] = await Promise.all([
        supabase.from('players').select('*').order('name'),
        supabase.from('games').select('*').order('game_number'),
        supabase.from('game_scores').select('*'),
        supabase.from('player_stats').select('*')
      ])

      setPlayers(playersRes.data || [])
      setGames(gamesRes.data || [])
      setGameScores(scoresRes.data || [])
      setPlayerStats(statsRes.data || [])
    } catch (error) {
      console.error('Error fetching stats data:', error)
    } finally {
      setLoading(false)
    }
  }

  const getPlayerStats = (playerId: string): PlayerStats => {
    return playerStats.find(s => s.player_id === playerId) || {
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
    // Calculate how many times each player was #1 in cumulative score after each game
    const topPositions: { [playerId: string]: number } = {}
    
    // Sort games by game_number to process them in order
    const sortedGames = [...games].sort((a, b) => a.game_number - b.game_number)
    
    sortedGames.forEach(game => {
      // Calculate cumulative scores up to this game
      const cumulativeScores: { [playerId: string]: number } = {}
      
      players.forEach(player => {
        let totalPoints = 0
        // Sum all points from games up to and including current game
        for (let i = 0; i <= sortedGames.indexOf(game); i++) {
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
      
      // Find the player with highest cumulative score after this game
      const topPlayerId = Object.keys(cumulativeScores).reduce((prev, current) => 
        cumulativeScores[current] > cumulativeScores[prev] ? current : prev
      )
      
      topPositions[topPlayerId] = (topPositions[topPlayerId] || 0) + 1
    })

    return players
      .map(player => ({
        player,
        value: topPositions[player.id] || 0
      }))
      .sort((a, b) => b.value - a.value)
  }

  const getMostGamesAtBottom = (): StatLeader[] => {
    // Calculate how many times each player was last in cumulative score after each game
    const bottomPositions: { [playerId: string]: number } = {}
    
    // Sort games by game_number to process them in order
    const sortedGames = [...games].sort((a, b) => a.game_number - b.game_number)
    
    sortedGames.forEach(game => {
      // Calculate cumulative scores up to this game
      const cumulativeScores: { [playerId: string]: number } = {}
      
      players.forEach(player => {
        let totalPoints = 0
        // Sum all points from games up to and including current game
        for (let i = 0; i <= sortedGames.indexOf(game); i++) {
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
      
      // Find the player with lowest cumulative score after this game
      const bottomPlayerId = Object.keys(cumulativeScores).reduce((prev, current) => 
        cumulativeScores[current] < cumulativeScores[prev] ? current : prev
      )
      
      bottomPositions[bottomPlayerId] = (bottomPositions[bottomPlayerId] || 0) + 1
    })

    return players
      .map(player => ({
        player,
        value: bottomPositions[player.id] || 0
      }))
      .sort((a, b) => b.value - a.value)
  }

  const StatTable = ({ title, data, icon }: { title: string, data: StatLeader[], icon: React.ReactNode }) => (
    <div className="bg-white/70 backdrop-blur rounded-lg p-6 shadow-sm border-0">
      <div className="flex items-center gap-2 mb-4">
        {icon}
        <h3 className="text-lg font-semibold text-gray-800">{title}</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-2 text-sm font-medium text-gray-600">Rank</th>
              <th className="text-left py-2 text-sm font-medium text-gray-600">Player</th>
              <th className="text-right py-2 text-sm font-medium text-gray-600">Count</th>
            </tr>
          </thead>
          <tbody>
            {data.map((item, index) => (
              <tr key={item.player.id} className="border-b border-gray-100 last:border-b-0">
                <td className="py-3">
                  <div className="flex items-center">
                    {index === 0 && <Crown className="w-4 h-4 text-yellow-500 mr-1" />}
                    {index === data.length - 1 && item.value > 0 && <ThumbsDown className="w-4 h-4 text-red-500 mr-1" />}
                    <span className="text-sm font-medium">#{index + 1}</span>
                  </div>
                </td>
                <td className="py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-amber-200/60 ring-1 ring-amber-300 flex items-center justify-center text-amber-800 font-semibold text-sm">
                      {item.player.name.slice(0, 1)}
                    </div>
                    <span className="font-medium">{item.player.name}</span>
                  </div>
                </td>
                <td className="py-3 text-right">
                  <span className="text-lg font-bold text-gray-900">{item.value}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-red-50 p-4">
        <div className="max-w-6xl mx-auto flex items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-red-50 p-4">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-1">
          <StatTable 
            title="Most Wins" 
            data={getMostWins()} 
            icon={<Trophy className="w-5 h-5 text-yellow-500" />}
          />
          
          <StatTable 
            title="Most Longest Roads" 
            data={getMostLongestRoads()} 
            icon={<Route className="w-5 h-5 text-blue-500" />}
          />
          
          <StatTable 
            title="Most Largest Army" 
            data={getMostLargestArmy()} 
            icon={<Shield className="w-5 h-5 text-green-500" />}
          />
          
          <StatTable 
            title="Most Games at Top" 
            data={getMostGamesAtTop()} 
            icon={<Crown className="w-5 h-5 text-yellow-500" />}
          />
          
          <StatTable 
            title="Most Games at Bottom" 
            data={getMostGamesAtBottom()} 
            icon={<ThumbsDown className="w-5 h-5 text-red-500" />}
          />
        </div>
      </div>
    </div>
  )
}
