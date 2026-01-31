'use client'

import { useEffect, useMemo, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'
import { supabase, Game, GameScore, Player } from '@/lib/supabase'
import { useTournament } from '@/lib/tournament-context'
import Image from 'next/image'
import { Trophy, Trash2 } from 'lucide-react'

interface HistoryDialogProps {
  open: boolean
  onClose: () => void
}

export default function HistoryDialog({ open, onClose }: HistoryDialogProps) {
  const { selectedTournament, activeTournament } = useTournament()
  const [games, setGames] = useState<Game[]>([])
  const [scores, setScores] = useState<GameScore[]>([])
  const [players, setPlayers] = useState<Player[]>([])
  const [loading, setLoading] = useState(false)
  const [password, setPassword] = useState('')
  const [deleting, setDeleting] = useState<string | null>(null)

  useEffect(() => {
    if (!open || !selectedTournament) return
    
    const load = async () => {
      setLoading(true)
      const [gamesRes, scoresRes, playersRes] = await Promise.all([
        supabase.from('games')
        .select('*')
        .eq('tournament_id', selectedTournament.id)
        .order('game_number', { ascending: false }),
        supabase.from('game_scores').select('*'),
        supabase.from('players').select('*')
      ])
      
      setGames(gamesRes.data || [])
      
      // Filter scores to only include games from this tournament
      const gameIds = (gamesRes.data || []).map(g => g.id)
      const filteredScores = (scoresRes.data || []).filter(s => gameIds.includes(s.game_id))
      setScores(filteredScores)
      
      setPlayers(playersRes.data || [])
      setLoading(false)
    }
    load()
  }, [open, selectedTournament])

  const playerName = (id: string) => players.find(p => p.id === id)?.name || 'Unknown'

  const gameWithScores = useMemo(() => {
    return games.map(g => ({
      ...g,
      scores: scores.filter(s => s.game_id === g.id).sort((a, b) => b.points - a.points)
    }))
  }, [games, scores])

  const handleDelete = async (gameId: string) => {
    if (!password) {
      toast.error('Enter the admin password to delete')
      return
    }
    setDeleting(gameId)
    try {
      const res = await fetch('/api/games/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameId, password })
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body?.error || 'Delete failed')
      toast.success('Game deleted')
      setGames(prev => prev.filter(g => g.id !== gameId))
      setScores(prev => prev.filter(s => s.game_id !== gameId))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Delete failed')
    } finally {
      setDeleting(null)
    }
  }

  const isViewingCompleted = selectedTournament?.status === 'completed'
  const canDelete = selectedTournament?.id === activeTournament?.id

  if (!open) return null

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col glass-panel p-0 gap-0 border-0">
        <DialogHeader className="p-6 pb-2">
          <DialogTitle className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl shadow-md ${
              isViewingCompleted 
                ? 'bg-slate-200' 
                : 'bg-gradient-to-br from-amber-400 to-orange-500'
            }`}>
              <Trophy className={`w-5 h-5 ${isViewingCompleted ? 'text-slate-600' : 'text-white'}`} />
            </div>
            <div>
              <div className="text-xl font-bold font-macondo text-gray-800">{selectedTournament?.name}</div>
              <div className="text-sm font-normal text-gray-500">Game History Archive</div>
            </div>
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="list" className="flex-1 overflow-hidden flex flex-col p-6 pt-2">
          <TabsList className="flex-shrink-0 grid w-full grid-cols-2 bg-gray-100/50 mb-4">
            <TabsTrigger value="list">History Log</TabsTrigger>
            {canDelete && <TabsTrigger value="settings">Admin Controls</TabsTrigger>}
          </TabsList>

          <TabsContent value="list" className="space-y-4 flex-1 overflow-y-auto pr-2 mt-0 custom-scrollbar">
            {loading && (
              <div className="flex justify-center py-12">
                 <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600"></div>
              </div>
            )}
            {!loading && gameWithScores.length === 0 && (
              <div className="text-center py-12 glass-card rounded-xl">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
                  <Trophy className="w-8 h-8 text-gray-300" />
                </div>
                <div className="font-medium text-gray-500">No games recorded yet.</div>
              </div>
            )}
            {!loading && gameWithScores.map(g => (
              <Card key={g.id} className="glass-card border-0 mb-3 last:mb-0 bg-white/40 hover:bg-white/60 transition-colors">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-4">
                      <div className="flex items-center justify-between">
                         <div className="flex items-center gap-2">
                            <span className="bg-amber-100 text-amber-800 text-xs font-bold px-2 py-1 rounded-md uppercase tracking-wider">Game #{g.game_number}</span>
                            <span className="text-xs text-gray-400 font-medium">{g.date}</span>
                         </div>
                      </div>
                      
                      <div className="space-y-2">
                        {g.scores.map((s, idx) => (
                          <div 
                            key={s.id} 
                            className={`flex items-center justify-between text-sm p-2 rounded-lg transition-colors ${
                              idx === 0 ? 'bg-amber-50/50 border border-amber-100/50' : 'hover:bg-gray-50/50'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              {idx === 0 && (
                                <div className="w-4 h-4 relative">
                                  <Image src="/icon-crown.png" alt="Winner" fill className="object-contain" />
                                </div>
                              )}
                              <span className={`font-medium ${idx === 0 ? 'text-gray-900' : 'text-gray-600'}`}>{playerName(s.player_id)}</span>
                              <div className="flex gap-1">
                                {s.longest_road && (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] uppercase font-bold bg-blue-50 text-blue-600 rounded border border-blue-100">
                                    Road
                                  </span>
                                )}
                                {s.largest_army && (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] uppercase font-bold bg-green-50 text-green-600 rounded border border-green-100">
                                    Army
                                  </span>
                                )}
                              </div>
                            </div>
                            <span className={`font-bold font-mono ${idx === 0 ? 'text-amber-600' : 'text-gray-400'}`}>
                              {s.points}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    {canDelete && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(g.id)}
                        disabled={deleting === g.id}
                        className="text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          {canDelete && (
            <TabsContent value="settings" className="flex-1 mt-0">
              <div className="space-y-4 p-6 bg-red-50/50 rounded-xl border border-red-100">
                <div>
                  <div className="text-sm font-bold text-red-900 mb-2 uppercase tracking-wide">Admin Zone</div>
                  <div className="text-sm text-red-700/80 mb-4">
                    Enter the master password to enable game deletion. This action cannot be undone.
                  </div>
                  <Input
                    type="password"
                    placeholder="Enter admin password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="max-w-xs bg-white"
                  />
                </div>
              </div>
            </TabsContent>
          )}
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
