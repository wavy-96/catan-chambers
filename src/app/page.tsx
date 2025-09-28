'use client'

import React, { useEffect, useState } from 'react'
import SplashScreen from '@/components/SplashScreen'
import Leaderboard from '@/components/Leaderboard'
import GameEntryForm from '@/components/GameEntryForm'
import Analytics from '@/components/Analytics'
import HistoryDialog from '@/components/HistoryDialog'
import StatsPage from '@/components/StatsPage'
import { Toaster } from '@/components/ui/sonner'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Trophy, BarChart3, History, TrendingUp } from 'lucide-react'

export default function Home() {
  const [showSplash, setShowSplash] = useState(true)
  const [showGameForm, setShowGameForm] = useState(false)
  const [showHistory, setShowHistory] = useState(false)

  const handleSplashComplete = () => {
    setShowSplash(false)
  }

  const handleAddGame = () => {
    setShowGameForm(true)
  }

  const handleGameAdded = () => {
    setShowGameForm(false)
  }

  const handleShowAnalytics = () => setActiveTab('analytics')

  const [activeTab, setActiveTab] = useState('leaderboard')

  if (showSplash) {
    return <SplashScreen onComplete={handleSplashComplete} />
  }

  return (
    <>
      <div className="fixed bottom-0 left-0 right-0 z-30 bg-gradient-to-br from-amber-50 via-orange-50 to-red-50 backdrop-blur border-t border-amber-100">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="max-w-md mx-auto">
          <TabsList className="grid grid-cols-3 w-full h-16 bg-transparent">
            <TabsTrigger value="leaderboard" className="flex flex-col items-center justify-center gap-1 py-2 data-[state=active]:text-amber-600 data-[state=active]:bg-white/50">
              <Trophy className="w-6 h-6" />
              <span className="text-[11px]">Leaderboard</span>
            </TabsTrigger>
            <TabsTrigger value="stats" className="flex flex-col items-center justify-center gap-1 py-2 data-[state=active]:text-amber-600 data-[state=active]:bg-white/50">
              <TrendingUp className="w-6 h-6" />
              <span className="text-[11px]">Stats</span>
            </TabsTrigger>
            <TabsTrigger value="analytics" className="flex flex-col items-center justify-center gap-1 py-2 data-[state=active]:text-amber-600 data-[state=active]:bg-white/50">
              <BarChart3 className="w-6 h-6" />
              <span className="text-[11px]">History</span>
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="max-w-6xl mx-auto pb-20">
        <TabsContent value="leaderboard">
          <Leaderboard 
            onAddGame={handleAddGame}
            onShowAnalytics={() => setActiveTab('stats')}
            onShowHistory={() => setShowHistory(true)}
          />
        </TabsContent>

        <TabsContent value="stats" className="p-0">
          <StatsPage />
        </TabsContent>

        <TabsContent value="analytics" className="p-0">
          <Analytics isOpen={true} onClose={() => setActiveTab('leaderboard')} />
        </TabsContent>
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
    </>
  )
}