import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string
const adminPassword = process.env.ADMIN_PASSWORD as string

export async function POST(req: NextRequest) {
  try {
    const { gameId, password } = await req.json()
    if (!gameId || !password) {
      return NextResponse.json({ error: 'Missing gameId or password' }, { status: 400 })
    }
    if (!adminPassword) {
      return NextResponse.json({ error: 'Server missing ADMIN_PASSWORD' }, { status: 500 })
    }
    if (password !== adminPassword) {
      return NextResponse.json({ error: 'Invalid password' }, { status: 401 })
    }

    const supabase = createClient(supabaseUrl, serviceKey)

    // Delete scores first due to FK
    const { error: scoreErr } = await supabase
      .from('game_scores')
      .delete()
      .eq('game_id', gameId)
    if (scoreErr) {
      return NextResponse.json({ error: scoreErr.message }, { status: 500 })
    }

    const { error: gameErr } = await supabase
      .from('games')
      .delete()
      .eq('id', gameId)
    if (gameErr) {
      return NextResponse.json({ error: gameErr.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unknown error' }, { status: 500 })
  }
}


