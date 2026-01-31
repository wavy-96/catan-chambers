'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Plus, Minus, AlertCircle, Calendar } from 'lucide-react'
import { supabase, Player } from '@/lib/supabase'
import { toast } from 'sonner'
import { useTournament } from '@/lib/tournament-context'

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
  const { activeTournament, selectedTournament } = useTournament()
  const [players, setPlayers] = useState<Player[]>([])
  const [gameNumber, setGameNumber] = useState(1)
  const [gameDate, setGameDate] = useState<string>(() => new Date().toISOString().slice(0, 10))
  const [scores, setScores] = useState<PlayerScore[]>([])
  const [loading, setLoading] = useState(false)

  // Use active tournament, not selected (can only add games to active tournament)
  const tournament = activeTournament

  useEffect(() => {
    if (isOpen && tournament) {
      fetchPlayers()
      fetchNextGameNumber()
    }
  }, [isOpen, tournament])

  const fetchPlayers = async () => {
    try {
      const { data } = await supabase
        .from('players')
        .select('*')
        .order('name')
      
      if (data) {
        setPlayers(data)
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
    if (!tournament) return
    
    try {
      const { data } = await supabase
        .from('games')
        .select('game_number')
        .eq('tournament_id', tournament.id)
        .order('game_number', { ascending: false })
        .limit(1)
      
      if (data && data.length > 0) {
        setGameNumber(data[0].game_number + 1)
      } else {
        setGameNumber(1)
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
    if (!tournament) {
      toast.error('No active tournament')
      return
    }

    const winnerId = getWinner()
    if (!winnerId) {
      toast.error('Someone must reach 10 points to win!')
      return
    }

    // Check if tournament is full
    const { count } = await supabase
      .from('games')
      .select('*', { count: 'exact', head: true })
      .eq('tournament_id', tournament.id)

    if (count !== null && count >= tournament.total_games) {
      toast.error(`${tournament.name} is complete! Create a new tournament to continue.`)
      return
    }

    setLoading(true)
    try {
      // Create game with tournament_id
      const { data: gameData, error: gameError } = await supabase
        .from('games')
        .insert({
          game_number: gameNumber,
          winner_id: winnerId,
          date: gameDate,
          tournament_id: tournament.id
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

      toast.success(`Game ${gameNumber} added to ${tournament.name}!`)
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

  // Show warning if trying to add game when viewing completed tournament
  const isViewingCompleted = selectedTournament?.status === 'completed'

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md w-[92vw] p-0 overflow-hidden border-0 bg-gradient-to-br from-amber-50 to-orange-50 shadow-2xl">
        <div className="p-5 pb-3 bg-gradient-to-r from-amber-100/50 to-orange-100/50 border-b border-amber-100">
          <DialogTitle className="text-xl font-bold font-macondo text-gray-800">Record Game Results</DialogTitle>
          <div className="text-sm text-gray-500 font-medium">
            {tournament ? (
              <span className="flex items-center gap-1">
                Game {gameNumber} <span className="text-gray-300">•</span> {tournament.name}
              </span>
            ) : (
              <span className="text-red-500">No active tournament</span>
            )}
          </div>
        </div>

        {isViewingCompleted && tournament && (
          <div className="mx-5 mt-4 p-3 bg-amber-50/80 border border-amber-200/50 rounded-xl flex items-start gap-2 shadow-sm">
            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <div className="font-bold text-amber-800">Note</div>
              <div className="text-amber-700">This game will be added to the active tournament ({tournament.name}).</div>
            </div>
          </div>
        )}

        <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto custom-scrollbar">
          <div className="grid grid-cols-2 gap-4 pb-2">
            <div className="space-y-1.5">
              <Label htmlFor="gameNumber" className="text-xs font-bold text-gray-500 uppercase tracking-wide">Game Number</Label>
              <div className="relative">
                <Input 
                  id="gameNumber" 
                  type="number" 
                  value={gameNumber} 
                  onChange={(e) => setGameNumber(parseInt(e.target.value) || 1)} 
                  min="1" 
                  className="bg-white/60 border-gray-200 focus:bg-white transition-colors pl-9"
                />
                <div className="absolute left-3 top-2.5 text-gray-400 font-bold text-xs">#</div>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="gameDate" className="text-xs font-bold text-gray-500 uppercase tracking-wide">Date Played</Label>
              <div className="relative">
                <Input 
                  id="gameDate" 
                  type="date" 
                  value={gameDate} 
                  onChange={(e) => setGameDate(e.target.value)} 
                  className="bg-white/60 border-gray-200 focus:bg-white transition-colors pl-9"
                />
                <Calendar className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
              </div>
            </div>
          </div>

          {scores.map((score, index) => (
            <motion.div
              key={score.playerId}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className={`p-3 rounded-2xl border transition-all ${
                score.points >= 10 
                  ? 'bg-amber-50 border-amber-200 shadow-[0_0_15px_-3px_rgba(245,158,11,0.2)]' 
                  : 'bg-white/40 border-white/40 hover:bg-white/60'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-lg shadow-sm ${
                    score.points >= 10 
                      ? 'bg-gradient-to-br from-amber-400 to-orange-500 text-white' 
                      : 'bg-white text-gray-700'
                  }`}>
                    {getPlayerName(score.playerId).slice(0,1)}
                  </div>
                  <div>
                    <div className={`font-bold ${score.points >= 10 ? 'text-amber-900' : 'text-gray-700'}`}>
                      {getPlayerName(score.playerId)}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-2 bg-white/50 rounded-full p-1 shadow-inner border border-white/60">
                  <button
                    aria-label="decrease"
                    onClick={() => updateScore(score.playerId, 'points', Math.max(0, score.points - 1))}
                    className="w-8 h-8 rounded-full hover:bg-white text-gray-500 hover:text-red-500 flex items-center justify-center transition-colors"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <div className={`w-6 text-center font-black text-lg ${
                    score.points >= 10 ? 'text-amber-600' : 'text-gray-700'
                  }`}>
                    {score.points}
                  </div>
                  <button
                    aria-label="increase"
                    onClick={() => updateScore(score.playerId, 'points', score.points + 1)}
                    className="w-8 h-8 rounded-full hover:bg-white text-gray-500 hover:text-green-600 flex items-center justify-center transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2 pl-[3.25rem]">
                <button
                  onClick={() => toggleLongestRoad(score.playerId)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wide border-2 transition-all ${
                    score.longestRoad 
                      ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-white border-amber-700 shadow-md scale-[1.02]' 
                      : 'bg-white/50 text-gray-400 border-gray-200 hover:bg-white hover:text-gray-600 hover:border-gray-300'
                  }`}
                >
                  Longest Road
                </button>
                <button
                  onClick={() => toggleLargestArmy(score.playerId)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wide border-2 transition-all ${
                    score.largestArmy 
                      ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-white border-amber-700 shadow-md scale-[1.02]' 
                      : 'bg-white/50 text-gray-400 border-gray-200 hover:bg-white hover:text-gray-600 hover:border-gray-300'
                  }`}
                >
                  Largest Army
                </button>
              </div>
            </motion.div>
          ))}
        </div>

        <div className="p-5 pt-0 flex justify-center">
          <Button
            className="w-full max-w-[240px] bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-bold py-6 rounded-xl shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all text-lg"
            onClick={handleSubmit}
            disabled={loading || !getWinner() || !tournament}
          >
            {loading ? 'Recording...' : 'Finalize Game'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
