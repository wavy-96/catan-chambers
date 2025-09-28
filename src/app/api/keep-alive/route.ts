import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function GET() {
  try {
    // Create a Supabase client with service role key
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    
    // Perform a simple query to keep the database active
    const { data, error } = await supabase
      .from('players')
      .select('count')
      .limit(1)
    
    if (error) {
      console.error('Supabase keep-alive error:', error)
      return NextResponse.json(
        { error: 'Failed to ping Supabase', details: error.message },
        { status: 500 }
      )
    }
    
    console.log('Supabase keep-alive successful at:', new Date().toISOString())
    
    return NextResponse.json({
      success: true,
      message: 'Supabase keep-alive successful',
      timestamp: new Date().toISOString(),
      data: data
    })
    
  } catch (error) {
    console.error('Keep-alive error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
