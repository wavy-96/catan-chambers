import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string
const adminPassword = process.env.ADMIN_PASSWORD as string

// GET: List all tournaments
export async function GET() {
  try {
    const supabase = createClient(supabaseUrl, serviceKey)

    const { data, error } = await supabase
      .from('tournaments')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ tournaments: data })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// POST: Create a new tournament
export async function POST(req: NextRequest) {
  try {
    const { name, totalGames, prizePool, password } = await req.json()

    // Validate inputs
    if (!name || typeof name !== 'string') {
      return NextResponse.json({ error: 'Tournament name is required' }, { status: 400 })
    }

    if (!password) {
      return NextResponse.json({ error: 'Admin password is required' }, { status: 400 })
    }

    if (!adminPassword) {
      return NextResponse.json({ error: 'Server missing ADMIN_PASSWORD' }, { status: 500 })
    }

    if (password !== adminPassword) {
      return NextResponse.json({ error: 'Invalid password' }, { status: 401 })
    }

    const supabase = createClient(supabaseUrl, serviceKey)

    // Check if a tournament with this name already exists
    const { data: existing } = await supabase
      .from('tournaments')
      .select('id')
      .eq('name', name.trim())
      .single()

    if (existing) {
      return NextResponse.json({ error: 'A tournament with this name already exists' }, { status: 400 })
    }

    // Mark any currently active tournament as completed
    await supabase
      .from('tournaments')
      .update({ status: 'completed' })
      .eq('status', 'active')

    // Create the new tournament
    const { data: tournament, error: createError } = await supabase
      .from('tournaments')
      .insert({
        name: name.trim(),
        total_games: totalGames || 20,
        prize_pool: prizePool || 10000,
        status: 'active'
      })
      .select()
      .single()

    if (createError) {
      return NextResponse.json({ error: createError.message }, { status: 500 })
    }

    // Initialize tournament_player_stats for all players
    const { data: players } = await supabase
      .from('players')
      .select('id')

    if (players && players.length > 0) {
      const statsToInsert = players.map(player => ({
        tournament_id: tournament.id,
        player_id: player.id,
        total_games: 0,
        wins: 0,
        total_points: 0,
        longest_road_count: 0,
        largest_army_count: 0,
        win_streak: 0,
        best_win_streak: 0
      }))

      const { error: statsError } = await supabase
        .from('tournament_player_stats')
        .insert(statsToInsert)

      if (statsError) {
        console.error('Error initializing player stats:', statsError)
        // Don't fail the request, just log the error
      }
    }

    return NextResponse.json({ tournament })
  } catch (e) {
    console.error('Error creating tournament:', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
