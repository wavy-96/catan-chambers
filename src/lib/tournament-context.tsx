'use client'

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'
import { supabase, Tournament } from './supabase'

interface TournamentContextType {
  tournaments: Tournament[]
  activeTournament: Tournament | null
  selectedTournament: Tournament | null
  setSelectedTournament: (tournament: Tournament | null) => void
  loading: boolean
  error: string | null
  refreshTournaments: () => Promise<void>
}

const TournamentContext = createContext<TournamentContextType | undefined>(undefined)

export function TournamentProvider({ children }: { children: ReactNode }) {
  const [tournaments, setTournaments] = useState<Tournament[]>([])
  const [selectedTournament, setSelectedTournament] = useState<Tournament | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchTournaments = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const { data, error: fetchError } = await supabase
        .from('tournaments')
        .select('*')
        .order('created_at', { ascending: false })

      if (fetchError) {
        throw new Error(fetchError.message)
      }

      const tournamentsData = (data || []) as Tournament[]
      setTournaments(tournamentsData)

      // Auto-select the active tournament, or the most recent if none active
      const active = tournamentsData.find(t => t.status === 'active')
      if (!selectedTournament) {
        setSelectedTournament(active || tournamentsData[0] || null)
      }
    } catch (err) {
      console.error('Error fetching tournaments:', err)
      setError(err instanceof Error ? err.message : 'Failed to load tournaments')
    } finally {
      setLoading(false)
    }
  }, [selectedTournament])

  useEffect(() => {
    fetchTournaments()

    // Subscribe to tournament changes
    const subscription = supabase
      .channel('tournaments-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'tournaments'
      }, () => {
        fetchTournaments()
      })
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [fetchTournaments])

  const activeTournament = tournaments.find(t => t.status === 'active') || null

  const value: TournamentContextType = {
    tournaments,
    activeTournament,
    selectedTournament,
    setSelectedTournament,
    loading,
    error,
    refreshTournaments: fetchTournaments
  }

  return (
    <TournamentContext.Provider value={value}>
      {children}
    </TournamentContext.Provider>
  )
}

export function useTournament() {
  const context = useContext(TournamentContext)
  if (context === undefined) {
    throw new Error('useTournament must be used within a TournamentProvider')
  }
  return context
}
