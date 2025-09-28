# Catan Chambers

A mobile-first Catan tournament leaderboard app built with Next.js, Supabase, and shadcn/ui.

## Features

- **Real-time leaderboard** with player standings and statistics
- **Interactive analytics** showing cumulative points progression over time
- **Game entry form** with achievements tracking (Longest Road, Largest Army)
- **Prize pool tracking** (₹10,000 tournament with probability calculations)
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

- **Next.js 14+** (App Router)
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
4. Run the development server: `npm run dev`

## Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
ADMIN_PASSWORD=your_admin_password
```

## Database Setup

Run the SQL scripts in the following order:
1. `supabase-schema.sql` - Creates tables and initial data
2. `supabase-realtime-setup.sql` - Enables real-time subscriptions

## Deployment

The app is configured for deployment on Vercel with:
- Automatic deployments from main branch
- Supabase keep-alive cron job
- Environment variables configured
- Custom fonts (Roboto for body, Macondo for splash screen)

## Tournament Rules

- **20 games total** in the tournament
- **Last place** buys the **winner** something worth ₹10,000
- **Real-time probability** calculations for prize outcomes
- **Achievement tracking** for Longest Road and Largest Army