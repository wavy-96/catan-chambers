# Catan Chambers

A mobile-first Catan tournament leaderboard app built with Next.js, Supabase, and shadcn/ui.

## Features

- **Multi-Tournament Support** - Track multiple tournaments (Catan 1.0, 2.0, etc.) with independent stats
- **Real-time leaderboard** with player standings and tournament-specific statistics
- **Tournament Comparison** - "At this stage" metrics comparing current tournament to previous ones
- **Interactive analytics** showing cumulative points progression over time
- **Game entry form** with achievements tracking (Longest Road, Largest Army)
- **Prize pool tracking** with configurable amounts per tournament
- **Comprehensive stats** including most wins, achievements, and leaderboard positions
- **Mobile-optimized interface** with bottom navigation
- **Animated splash screen** with rotating logo
- **Supabase real-time updates** for instant data synchronization

## Players

- **Anas** - Strategic mastermind
- **Ezzy** - Resource collector
- **Akif** - Road builder
- **Tamim** - Knight commander

## Tech Stack

- **Next.js 15+** (App Router)
- **Supabase** (PostgreSQL, Real-time subscriptions)
- **shadcn/ui** components
- **Tailwind CSS** with custom fonts (Roboto, Macondo)
- **Framer Motion** for animations
- **Chart.js** for interactive charts
- **Vercel** for deployment

## Getting Started

1. Clone the repository
2. Install dependencies: `npm install`
3. Set up environment variables in `.env.local`
4. Run database migrations (see below)
5. Run the development server: `npm run dev`

## Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
ADMIN_PASSWORD=your_admin_password
```

## Database Setup

Run the SQL migration scripts in the Supabase SQL Editor in this order:

1. `migrations/001_add_tournaments.sql` - Creates tournaments table and updates schema
2. `migrations/002_migrate_tournament_data.sql` - Migrates existing data to tournaments
3. `migrations/003_tournament_triggers.sql` - Creates triggers for automatic stats updates

### Database Schema

The app uses the following tables:

- **tournaments** - Tournament definitions (name, total_games, prize_pool, status)
- **players** - Player profiles
- **games** - Individual game records (linked to tournament)
- **game_scores** - Per-player scores for each game
- **player_stats** - Global career statistics
- **tournament_player_stats** - Per-tournament statistics

## Tournament Features

### Creating a New Tournament
1. Click the tournament selector dropdown
2. Select "Create New Tournament"
3. Enter tournament name, total games, and prize pool
4. Enter admin password to confirm

### Viewing Past Tournaments
- Use the tournament selector to switch between active and completed tournaments
- Completed tournaments show in grayscale/muted styling
- Game entry is disabled for completed tournaments

### Tournament Comparison
When viewing an active tournament (e.g., Catan 2.0), a comparison card shows:
- Player standings at the same game count from the previous tournament
- Point differentials showing who is ahead/behind their previous pace

## Deployment

The app is configured for deployment on Vercel with:
- Automatic deployments from main branch
- Supabase keep-alive cron job
- Environment variables configured
- Custom fonts (Roboto for body, Macondo for splash screen)

## Tournament Rules

- Configurable number of games per tournament (default: 20)
- **Last place** buys the **winner** something worth the prize pool
- **Real-time probability** calculations for prize outcomes
- **Achievement tracking** for Longest Road and Largest Army
