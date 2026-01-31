import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Database types
export interface Player {
  id: string
  name: string
  created_at: string
}

export interface Tournament {
  id: string
  name: string
  total_games: number
  prize_pool: number
  status: 'active' | 'completed'
  created_at: string
}

export interface Game {
  id: string
  game_number: number
  date: string
  winner_id: string
  tournament_id: string
  created_at: string
}

export interface GameScore {
  id: string
  game_id: string
  player_id: string
  points: number
  longest_road: boolean
  largest_army: boolean
  created_at: string
}

export interface PlayerStats {
  player_id?: string
  total_games: number
  wins: number
  total_points: number
  longest_road_count: number
  largest_army_count: number
  win_streak: number
  best_win_streak: number
  updated_at?: string
}

export interface TournamentPlayerStats extends PlayerStats {
  id: string
  tournament_id: string
}
