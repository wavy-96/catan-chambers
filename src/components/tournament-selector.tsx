'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, Trophy, CheckCircle2, Plus, Sparkles } from 'lucide-react'
import Image from 'next/image'
import { useTournament } from '@/lib/tournament-context'
import { Tournament } from '@/lib/supabase'
import CreateTournamentDialog from './create-tournament-dialog'

interface TournamentSelectorProps {
  onCreateClick?: () => void
}

export default function TournamentSelector({ onCreateClick }: TournamentSelectorProps) {
  const { tournaments, selectedTournament, setSelectedTournament, loading } = useTournament()
  const [isOpen, setIsOpen] = useState(false)
  const [showCreateDialog, setShowCreateDialog] = useState(false)

  if (loading) {
    return (
      <div className="h-12 glass-panel rounded-xl animate-pulse" />
    )
  }

  const handleSelect = (tournament: Tournament) => {
    setSelectedTournament(tournament)
    setIsOpen(false)
  }

  const handleCreateClick = () => {
    setIsOpen(false)
    if (onCreateClick) {
      onCreateClick()
    } else {
      setShowCreateDialog(true)
    }
  }

  return (
    <>
      <div className="relative z-50">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-full flex items-center justify-between gap-3 px-4 py-3 glass-panel rounded-xl transition-all duration-200 hover:shadow-lg active:scale-[0.99]"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg shadow-sm bg-gradient-to-br from-stone-50 to-stone-100 border border-stone-200">
              <div className="relative w-6 h-6">
                <Image src="/icon-chalice.png" alt="Tournament" fill className="object-contain" />
              </div>
            </div>
            <div className="text-left">
              <div className="font-bold text-gray-800 font-macondo text-lg leading-none mb-1">
                {selectedTournament?.name || 'Select Tournament'}
              </div>
              <div className="text-xs font-medium text-gray-500 flex items-center gap-1.5">
                {selectedTournament?.status === 'active' ? (
                  <>
                    <Sparkles className="w-3 h-3 text-amber-500" />
                    <span className="text-amber-600 uppercase tracking-wider text-[10px] font-bold">Active</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3 h-3 text-gray-400" />
                    <span className="uppercase tracking-wider text-[10px] font-bold">Completed</span>
                  </>
                )}
                {selectedTournament && (
                  <span className="text-gray-400">• ₹{selectedTournament.prize_pool.toLocaleString()}</span>
                )}
              </div>
            </div>
          </div>
          <motion.div
            animate={{ rotate: isOpen ? 180 : 0 }}
            transition={{ duration: 0.2 }}
            className="p-1 rounded-full bg-gray-100/50"
          >
            <ChevronDown className="w-4 h-4 text-gray-500" />
          </motion.div>
        </button>

        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="absolute top-full left-0 right-0 mt-2 glass-panel rounded-xl overflow-hidden shadow-2xl"
            >
              <div className="max-h-64 overflow-y-auto custom-scrollbar p-1">
                {tournaments.map((tournament) => (
                  <button
                    key={tournament.id}
                    onClick={() => handleSelect(tournament)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors mb-1 ${
                      selectedTournament?.id === tournament.id 
                        ? 'bg-amber-50/80 border border-amber-100' 
                        : 'hover:bg-gray-50/50'
                    }`}
                  >
                    <div className="p-1.5 rounded-lg shadow-sm bg-gradient-to-br from-stone-50 to-stone-100 border border-stone-200">
                      <div className="relative w-5 h-5">
                        <Image src="/icon-chalice.png" alt="Tournament" fill className="object-contain" />
                      </div>
                    </div>
                    <div className="flex-1 text-left">
                      <div className="font-bold text-gray-800 font-macondo">{tournament.name}</div>
                      <div className="text-xs text-gray-500">
                        {tournament.total_games} games • ₹{tournament.prize_pool.toLocaleString()}
                      </div>
                    </div>
                    {tournament.status === 'active' && (
                      <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-gradient-to-r from-amber-100 to-orange-100 text-amber-700 rounded-full border border-amber-200">
                        Active
                      </span>
                    )}
                    {selectedTournament?.id === tournament.id && (
                      <CheckCircle2 className="w-4 h-4 text-amber-500" />
                    )}
                  </button>
                ))}
              </div>
              
              <div className="p-2 border-t border-gray-100/50 bg-gray-50/30">
                <button
                  onClick={handleCreateClick}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-white hover:bg-gray-50 transition-colors text-gray-600 rounded-lg border border-dashed border-gray-300 hover:border-amber-300 group"
                >
                  <div className="p-1 rounded-full bg-gray-100 group-hover:bg-amber-100 transition-colors">
                    <Plus className="w-3 h-3 text-gray-500 group-hover:text-amber-600" />
                  </div>
                  <span className="font-medium text-sm group-hover:text-amber-700">Create New Tournament</span>
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <CreateTournamentDialog 
        open={showCreateDialog} 
        onClose={() => setShowCreateDialog(false)} 
      />
    </>
  )
}
