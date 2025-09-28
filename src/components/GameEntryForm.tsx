'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Plus, Minus } from 'lucide-react'
import { supabase, Player } from '@/lib/supabase'
import { toast } from 'sonner'

interface GameEntryFormProps {
  isOpen: boolean
  onClose: () => void
  onGameAdded: () => void
}

interface PlayerScore {
  playerId: string
  points: number
  longestRoad: boolean
  largestArmy: boolean
}

export default function GameEntryForm({ isOpen, onClose, onGameAdded }: GameEntryFormProps) {
  const [players, setPlayers] = useState<Player[]>([])
  const [gameNumber, setGameNumber] = useState(1)
  const [gameDate, setGameDate] = useState<string>(() => new Date().toISOString().slice(0, 10))
  const [scores, setScores] = useState<PlayerScore[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (isOpen) {
      fetchPlayers()
      fetchNextGameNumber()
    }
  }, [isOpen])

  const fetchPlayers = async () => {
    try {
      const { data } = await supabase
        .from('players')
        .select('*')
        .order('name')
      
      if (data) {
        setPlayers(data)
        // Initialize scores for all players
        setScores(data.map(player => ({
          playerId: player.id,
          points: 0,
          longestRoad: false,
          largestArmy: false
        })))
      }
    } catch (error) {
      console.error('Error fetching players:', error)
      toast.error('Failed to load players')
    }
  }

  const fetchNextGameNumber = async () => {
    try {
      const { data } = await supabase
        .from('games')
        .select('game_number')
        .order('game_number', { ascending: false })
        .limit(1)
      
      if (data && data.length > 0) {
        setGameNumber(data[0].game_number + 1)
      }
    } catch (error) {
      console.error('Error fetching game number:', error)
    }
  }

  const updateScore = (playerId: string, field: keyof PlayerScore, value: string | number | boolean) => {
    setScores(prev => prev.map(score => 
      score.playerId === playerId 
        ? { ...score, [field]: value }
        : score
    ))
  }

  const getPlayerName = (playerId: string) => {
    return players.find(p => p.id === playerId)?.name || 'Unknown'
  }

  const getWinner = () => {
    return scores.find(score => score.points >= 10)?.playerId || null
  }

  const toggleLongestRoad = (playerId: string) => {
    setScores(prev => prev.map(s => ({
      ...s,
      longestRoad: s.playerId === playerId ? !s.longestRoad : false,
    })))
  }

  const toggleLargestArmy = (playerId: string) => {
    setScores(prev => prev.map(s => ({
      ...s,
      largestArmy: s.playerId === playerId ? !s.largestArmy : false,
    })))
  }

  const handleSubmit = async () => {
    const winnerId = getWinner()
    if (!winnerId) {
      toast.error('Someone must reach 10 points to win!')
      return
    }

    setLoading(true)
    try {
      // Create game
      const { data: gameData, error: gameError } = await supabase
        .from('games')
        .insert({
          game_number: gameNumber,
          winner_id: winnerId,
          date: gameDate
        })
        .select()
        .single()

      if (gameError) throw gameError

      // Create game scores
      const gameScores = scores.map(score => ({
        game_id: gameData.id,
        player_id: score.playerId,
        points: score.points,
        longest_road: score.longestRoad,
        largest_army: score.largestArmy
      }))

      const { error: scoresError } = await supabase
        .from('game_scores')
        .insert(gameScores)

      if (scoresError) throw scoresError

      toast.success(`Game ${gameNumber} added successfully!`)
      onGameAdded()
      onClose()
      
      // Reset form
      setScores(players.map(player => ({
        playerId: player.id,
        points: 0,
        longestRoad: false,
        largestArmy: false
      })))
      setGameDate(new Date().toISOString().slice(0, 10))
      
    } catch (error) {
      console.error('Error adding game:', error)
      toast.error('Failed to add game')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md w-[92vw] p-0 overflow-hidden">
        <div className="p-4 pb-2 border-b">
          <h2 className="text-xl font-semibold">Enter Scores</h2>
          <div className="text-sm text-gray-500">Game {gameNumber}</div>
        </div>

        <div className="p-4 space-y-4">
          {scores.map((score, index) => (
            <motion.div
              key={score.playerId}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="flex flex-col gap-2"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-amber-200/60 ring-1 ring-amber-300 flex items-center justify-center text-amber-800 font-semibold">
                    {getPlayerName(score.playerId).slice(0,1)}
                  </div>
                  <div>
                    <div className="font-medium">{getPlayerName(score.playerId)}</div>
                    <div className="text-xs text-gray-500">Points</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    aria-label="decrease"
                    onClick={() => updateScore(score.playerId, 'points', Math.max(0, score.points - 1))}
                    className="w-9 h-9 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center shadow-sm active:scale-95"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <div className="w-6 text-center font-semibold">{score.points}</div>
                  <button
                    aria-label="increase"
                    onClick={() => updateScore(score.playerId, 'points', score.points + 1)}
                    className="w-9 h-9 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center shadow-sm active:scale-95"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-start gap-3 pl-13">
                <button
                  onClick={() => toggleLongestRoad(score.playerId)}
                  className={`px-3 py-1 rounded-full text-xs border ${score.longestRoad ? 'bg-green-100 text-green-700 border-green-300' : 'bg-white text-gray-600 border-gray-200'}`}
                >
                  Longest Road
                </button>
                <button
                  onClick={() => toggleLargestArmy(score.playerId)}
                  className={`px-3 py-1 rounded-full text-xs border ${score.largestArmy ? 'bg-blue-100 text-blue-700 border-blue-300' : 'bg-white text-gray-600 border-gray-200'}`}
                >
                  Largest Army
                </button>
              </div>
            </motion.div>
          ))}

          <div className="grid grid-cols-2 gap-3 pt-2">
            <div>
              <Label htmlFor="gameNumber" className="text-xs text-gray-500">Game #</Label>
              <Input id="gameNumber" type="number" value={gameNumber} onChange={(e)=>setGameNumber(parseInt(e.target.value)||1)} min="1" />
            </div>
            <div>
              <Label htmlFor="gameDate" className="text-xs text-gray-500">Date</Label>
              <Input id="gameDate" type="date" value={gameDate} onChange={(e)=>setGameDate(e.target.value)} />
            </div>
          </div>
        </div>

        <div className="p-4 pt-0">
          <Button
            className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600"
            onClick={handleSubmit}
            disabled={loading || !getWinner()}
          >
            {loading ? 'Saving...' : 'Save Scores'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
