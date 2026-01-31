'use client'

import React, { useState } from 'react'
import Image from 'next/image'
import SplashScreen from '@/components/SplashScreen'
import Leaderboard from '@/components/Leaderboard'
import GameEntryForm from '@/components/GameEntryForm'
import Analytics from '@/components/Analytics'
import HistoryDialog from '@/components/HistoryDialog'
import StatsPage from '@/components/StatsPage'
import { Toaster } from '@/components/ui/sonner'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { TournamentProvider } from '@/lib/tournament-context'

function AppContent() {
  const [showSplash, setShowSplash] = useState(true)
  const [showGameForm, setShowGameForm] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [activeTab, setActiveTab] = useState('leaderboard')

  const handleSplashComplete = () => {
    setShowSplash(false)
  }

  const handleAddGame = () => {
    setShowGameForm(true)
  }

  const handleGameAdded = () => {
    setShowGameForm(false)
  }

  if (showSplash) {
    return <SplashScreen onComplete={handleSplashComplete} />
  }

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Background decoration */}
      <div className="fixed inset-0 pointer-events-none opacity-40 mix-blend-multiply bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-amber-100 via-transparent to-transparent" />
      <div className="fixed inset-0 pointer-events-none opacity-30 mix-blend-multiply bg-[radial-gradient(ellipse_at_bottom_left,_var(--tw-gradient-stops))] from-red-50 via-transparent to-transparent" />

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="gap-0 relative z-10">
        <TabsContent value="leaderboard" className="mt-0 pt-0 animate-in fade-in duration-500 slide-in-from-bottom-4">
          <Leaderboard 
            onAddGame={handleAddGame}
            onShowAnalytics={() => setActiveTab('stats')}
            onShowHistory={() => setShowHistory(true)}
          />
        </TabsContent>

        <TabsContent value="stats" className="mt-0 pt-0 animate-in fade-in duration-500 slide-in-from-bottom-4">
          <StatsPage />
        </TabsContent>

        <TabsContent value="analytics" className="mt-0 pt-0 animate-in fade-in duration-500 slide-in-from-bottom-4">
          <Analytics isOpen={true} onClose={() => setActiveTab('leaderboard')} />
        </TabsContent>

        {/* Bottom Navigation */}
        <div className="fixed bottom-6 left-4 right-4 z-30">
          <TabsList className="glass-panel h-20 w-full rounded-2xl grid grid-cols-3 p-2 mx-auto max-w-md shadow-2xl border-white/50">
            <TabsTrigger 
              value="leaderboard" 
              className="flex flex-col items-center justify-center gap-1 h-full rounded-xl data-[state=active]:bg-amber-100/50 data-[state=active]:shadow-inner transition-all duration-300 group"
            >
              <div className="relative w-8 h-8 group-data-[state=active]:-translate-y-1 transition-transform duration-300">
                <Image 
                  src="/icon-leaderboard.png" 
                  alt="Leaderboard" 
                  fill
                  className="object-contain drop-shadow-md"
                />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-900/60 group-data-[state=active]:text-amber-800">Leaderboard</span>
            </TabsTrigger>
            
            <TabsTrigger 
              value="stats" 
              className="flex flex-col items-center justify-center gap-1 h-full rounded-xl data-[state=active]:bg-amber-100/50 data-[state=active]:shadow-inner transition-all duration-300 group"
            >
              <div className="relative w-8 h-8 group-data-[state=active]:-translate-y-1 transition-transform duration-300">
                <Image 
                  src="/icon-stats.png" 
                  alt="Stats" 
                  fill
                  className="object-contain drop-shadow-md"
                />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-900/60 group-data-[state=active]:text-amber-800">Stats</span>
            </TabsTrigger>
            
            <TabsTrigger 
              value="analytics" 
              className="flex flex-col items-center justify-center gap-1 h-full rounded-xl data-[state=active]:bg-amber-100/50 data-[state=active]:shadow-inner transition-all duration-300 group"
            >
              <div className="relative w-8 h-8 group-data-[state=active]:-translate-y-1 transition-transform duration-300">
                <Image 
                  src="/icon-history.png" 
                  alt="History" 
                  fill
                  className="object-contain drop-shadow-md"
                />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-900/60 group-data-[state=active]:text-amber-800">History</span>
            </TabsTrigger>
          </TabsList>
        </div>
      </Tabs>

      <GameEntryForm
        isOpen={showGameForm}
        onClose={() => setShowGameForm(false)}
        onGameAdded={handleGameAdded}
      />

      <HistoryDialog 
        open={showHistory} 
        onClose={() => setShowHistory(false)} 
      />

      <Toaster />
    </div>
  )
}

export default function Home() {
  return (
    <TournamentProvider>
      <AppContent />
    </TournamentProvider>
  )
}
