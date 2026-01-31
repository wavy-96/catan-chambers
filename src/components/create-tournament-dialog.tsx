'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Trophy, Loader2, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { useTournament } from '@/lib/tournament-context'

interface CreateTournamentDialogProps {
  open: boolean
  onClose: () => void
}

export default function CreateTournamentDialog({ open, onClose }: CreateTournamentDialogProps) {
  const { tournaments, refreshTournaments } = useTournament()
  const [loading, setLoading] = useState(false)
  const [password, setPassword] = useState('')
  const [formData, setFormData] = useState({
    name: '',
    totalGames: 20,
    prizePool: 10000
  })

  // Auto-suggest next tournament name
  const suggestName = () => {
    const catanTournaments = tournaments.filter(t => t.name.startsWith('Catan'))
    if (catanTournaments.length === 0) return 'Catan 1.0'
    
    const versions = catanTournaments
      .map(t => {
        const match = t.name.match(/Catan (\d+)\.(\d+)/)
        if (match) return parseFloat(`${match[1]}.${match[2]}`)
        return 0
      })
      .filter(v => v > 0)
    
    const maxVersion = Math.max(...versions, 0)
    const nextVersion = Math.floor(maxVersion) + 1
    return `Catan ${nextVersion}.0`
  }

  const handleOpen = () => {
    setFormData(prev => ({
      ...prev,
      name: suggestName()
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!password) {
      toast.error('Admin password required')
      return
    }

    if (!formData.name.trim()) {
      toast.error('Tournament name is required')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/tournaments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name.trim(),
          totalGames: formData.totalGames,
          prizePool: formData.prizePool,
          password
        })
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to create tournament')
      }

      toast.success(`${formData.name} created successfully!`)
      await refreshTournaments()
      onClose()
      
      // Reset form
      setFormData({ name: '', totalGames: 20, prizePool: 10000 })
      setPassword('')
    } catch (error) {
      console.error('Error creating tournament:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to create tournament')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (isOpen) handleOpen()
      if (!isOpen) onClose()
    }}>
      <DialogContent className="max-w-md glass-panel p-0 gap-0 border-0 overflow-hidden">
        <DialogHeader className="p-6 pb-4 bg-gradient-to-r from-amber-50 to-orange-50 border-b border-amber-100">
          <DialogTitle className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 shadow-lg">
              <Trophy className="w-5 h-5 text-white" />
            </div>
            <div>
               <div className="font-bold font-macondo text-xl text-gray-800">New Tournament</div>
               <div className="text-sm font-normal text-gray-500">Initialize a new chamber</div>
            </div>
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div className="space-y-2">
            <Label htmlFor="name" className="text-xs font-bold text-gray-500 uppercase tracking-wide">Tournament Name</Label>
            <div className="relative">
               <Input
                 id="name"
                 value={formData.name}
                 onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                 placeholder="e.g., Catan 3.0"
                 className="pl-9 bg-white/50 border-gray-200 focus:bg-white transition-colors"
               />
               <Sparkles className="w-4 h-4 text-amber-500 absolute left-3 top-2.5" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-5">
            <div className="space-y-2">
              <Label htmlFor="totalGames" className="text-xs font-bold text-gray-500 uppercase tracking-wide">Total Games</Label>
              <Input
                id="totalGames"
                type="number"
                min="1"
                max="100"
                value={formData.totalGames}
                onChange={(e) => setFormData(prev => ({ ...prev, totalGames: parseInt(e.target.value) || 20 }))}
                className="bg-white/50 border-gray-200 focus:bg-white transition-colors"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="prizePool" className="text-xs font-bold text-gray-500 uppercase tracking-wide">Prize Pool (₹)</Label>
              <Input
                id="prizePool"
                type="number"
                min="0"
                value={formData.prizePool}
                onChange={(e) => setFormData(prev => ({ ...prev, prizePool: parseInt(e.target.value) || 0 }))}
                className="bg-white/50 border-gray-200 focus:bg-white transition-colors"
              />
            </div>
          </div>

          <div className="space-y-2 pt-2">
            <Label htmlFor="password" className="text-xs font-bold text-gray-500 uppercase tracking-wide">Admin Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter master password"
              className="bg-white/50 border-gray-200 focus:bg-white transition-colors"
            />
            <p className="text-[10px] text-gray-400">Security check required to initiate protocols.</p>
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="ghost"
              className="flex-1 hover:bg-gray-100 text-gray-600"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-[2] bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-bold shadow-lg"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                'Launch Tournament'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
