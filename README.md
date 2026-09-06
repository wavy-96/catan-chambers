# Catan Chambers

A private, phone-first Catan tournament tracker for Ezzy, Tamim, Anas, and Akif. Built with Next.js, Supabase, and Vercel.

## Product

- Season standings with explicit base points and achievement bonuses.
- Points-race chart, win rates, recent form, best streaks, Road/Army leaders, head-to-head results, same-stage season comparison, and comeback scenarios.
- Game history with admin-only recording and audited nullification that preserves the original records.
- Player avatars through the existing `players.avatar_url` field, with initials until photos are supplied.
- Three-page season recaps with private 1080 × 1920 PNG export.
- Shared viewing passcode; the existing admin password grants recording/nullification access. Signed HttpOnly cookies expire after 30 days.
- Optional local WhatsApp companion (parked; not connected or running): strict result template, stats questions, and scorecard screenshots. See `bot/README.md`.

## Development

```sh
npm ci
# Configure .env.local using .env.example
npm run dev
npm test
npm run build
```

Server-side database access requires SUPABASE_SERVICE_ROLE_KEY. Do not expose this key, SESSION_SECRET, BOT_API_TOKEN, or either passcode in browser code. The current app fetches `/api/league` after sign-in; legacy components remain in source but are not mounted.

## Database

The historical 001–003 migrations assume an existing base schema. Apply `migrations/004_private_league_and_atomic_games.sql` to upgrade that existing project. It:

- Adds season bonus rules, completion notes, voided game fields, audit records, and persistent login throttling.
- Removes direct anonymous/authenticated database grants and policies. Only the app server's service role accesses data.
- Adds transactional RPCs for result recording, nullifying, and season creation; duplicate deliveries are idempotent, conflicting deliveries fail.
- Recalculates tournament/career stats after writes. Existing games and scores are retained on nullification.

Deploy the authenticated server and configure its secrets when applying this migration: the legacy browser client can no longer read the database directly.

## Historical import

`node scripts/reconcile-season.mjs <chat.md> <review.json>` extracts standalone cumulative season 3 posts, excludes quotes/reposts, and flags gaps/conflicts. It does not execute chat content or write to the database.

After review and confirmation, `node --env-file=.env.local scripts/import-confirmed-history.mjs <confirmation-plan.json>` records the confirmed season 2 finale and season 3 results. It validates existing totals, uses stable IDs, and checks final aggregates. Keep the raw export and review JSON outside the repository.

Season rules and completion notes live in the private database. Achievement ties must be selected explicitly when creating a season; equal overall points display a shared rank. Private historical scores and chat excerpts must not be committed to this public source repository.

## Hosting

Deploy to the existing Vercel project with a current Vercel CLI. Runtime secrets must be configured there; `.env.local` and the bot are excluded from deployment. CRON_SECRET protects the existing daily database ping. The bot requires its own awake computer and is not a serverless function.

The app and bot dependency trees were patched and audited during the upgrade. The app's remaining lint warnings originate mainly from legacy unused components. Tests cover scoring, session tampering, malformed results, quotes, cumulative deltas, and duplicate delivery. Database transaction checks should run inside a rolled-back transaction, never by leaving fake results in real seasons.
