'use client'

import { useEffect, useMemo, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'
import { supabase, Game, GameScore, Player } from '@/lib/supabase'

interface HistoryDialogProps {
  open: boolean
  onClose: () => void
}

export default function HistoryDialog({ open, onClose }: HistoryDialogProps) {
  const [games, setGames] = useState<Game[]>([])
  const [scores, setScores] = useState<GameScore[]>([])
  const [players, setPlayers] = useState<Player[]>([])
  const [loading, setLoading] = useState(false)
  const [password, setPassword] = useState('')
  const [deleting, setDeleting] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    const load = async () => {
      setLoading(true)
      const [gamesRes, scoresRes, playersRes] = await Promise.all([
        supabase.from('games').select('*').order('game_number', { ascending: false }),
        supabase.from('game_scores').select('*'),
        supabase.from('players').select('*')
      ])
      setGames(gamesRes.data || [])
      setScores(scoresRes.data || [])
      setPlayers(playersRes.data || [])
      setLoading(false)
    }
    load()
  }, [open])

  const playerName = (id: string) => players.find(p => p.id === id)?.name || 'Unknown'

  const gameWithScores = useMemo(() => {
    return games.map(g => ({
      ...g,
      scores: scores.filter(s => s.game_id === g.id)
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

  if (!open) return null

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Game History</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="list" className="space-y-4">
          <TabsList>
            <TabsTrigger value="list">History</TabsTrigger>
            <TabsTrigger value="settings">Admin</TabsTrigger>
          </TabsList>

          <TabsContent value="list" className="space-y-3">
            {loading && (
              <div className="text-sm text-gray-500">Loading...</div>
            )}
            {!loading && gameWithScores.length === 0 && (
              <div className="text-sm text-gray-500">No games yet.</div>
            )}
            {!loading && gameWithScores.map(g => (
              <Card key={g.id}>
                <CardContent className="p-4 flex items-start justify-between gap-4">
                  <div>
                    <div className="font-semibold">Game #{g.game_number} • {g.date}</div>
                    <div className="text-sm text-gray-600">Winner: {playerName(g.winner_id)}</div>
                    <div className="mt-2 text-sm">
                      {g.scores.map(s => (
                        <div key={s.id} className="flex items-center justify-between">
                          <span>{playerName(s.player_id)}</span>
                          <span className="font-medium">{s.points} pts</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <Button
                    variant="destructive"
                    onClick={() => handleDelete(g.id)}
                    disabled={deleting === g.id}
                  >
                    {deleting === g.id ? 'Deleting...' : 'Delete'}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="settings">
            <div className="space-y-2">
              <div className="text-sm text-gray-600">Set admin password (runtime only):</div>
              <Input
                type="password"
                placeholder="Enter password to allow deletions"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <div className="text-xs text-gray-500">This password is checked by the API route.</div>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}


