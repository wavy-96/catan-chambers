# Catan Chambers

A private, phone-first Catan tournament tracker for Ezzy, Tamim, Anas, and Akif. Built with Next.js, Supabase, and Vercel.

## Product

- Season standings with explicit base points and achievement bonuses.
- Points-race chart, win rates, recent form, best streaks, Road/Army leaders, head-to-head results, same-stage season comparison, and comeback scenarios.
- Game history with admin-only recording and audited nullification that preserves the original records.
- Player avatars through the existing `players.avatar_url` field, with initials until photos are supplied.
- Three-page season recaps with private 1080 × 1920 PNG export. Images are prepared before tapping Share so the native share sheet keeps its user-gesture permission; Save image remains available as a fallback.
- Warm parchment and amber colors, spring tab transitions, card entrances, score animations, and reduced-motion support. Filters scroll and compact rows wrap on narrow phones.
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

Apply migrations 005, 006, and 007 in order before deploying the current setup flow. Migration 006 adds structured stat rules, placement contributions, and a validated, idempotent creation RPC. Existing RPCs remain for deployment compatibility. Completed seasons retain their historical rules and pools.

## Starting a season

The admin's **Start new season** button opens previous-season highlights, season details, then rules. A new season starts with a recap; recording its first game opens the recap and saved rules before score entry. Only one active season is allowed. The admin can end an active season early with an optional note; game records and planned game count are retained. Closing the season blocks further score entry and reveals Start new season. Season 4 onward uses the new contribution plan; Season 3 keeps its historical ₹10,000 pool.

Each scoring rule selects a recorded stat: Roads, Armies, wins, game points, or longest win streak, plus a season bonus (1–100). A stat can appear only once. Rules compare base stats derived from non-nullified game records, so bonuses never compound. Tied stat leaders follow the selected full/split/no-bonus policy. Removing every rule gives a base-points-only season; legacy seasons retain their original Road and Army bonuses.

New seasons use a ₹12,000 winner-takes-all pool. Final places contribute ₹0, ₹2,000, ₹4,000, and ₹6,000 respectively; the winner receives ₹12,000. Active-season amounts are projections. Any tied final places or unresolved bonuses leave settlement pending rather than assigning payments by alphabetical order. The app displays amounts only and does not collect or transfer money.

## Historical import

`node scripts/reconcile-season.mjs <chat.md> <review.json>` extracts standalone cumulative season 3 posts, excludes quotes/reposts, and flags gaps/conflicts. It does not execute chat content or write to the database.

After review and confirmation, `node --env-file=.env.local scripts/import-confirmed-history.mjs <confirmation-plan.json>` records the confirmed season 2 finale and season 3 results. It validates existing totals, uses stable IDs, and checks final aggregates. Keep the raw export and review JSON outside the repository.

Season rules and completion notes live in the private database. Achievement ties must be selected explicitly when creating a season; equal overall points display a shared rank. Private historical scores and chat excerpts must not be committed to this public source repository.

## Hosting

Deploy to the existing Vercel project with a current Vercel CLI. Runtime secrets must be configured there; `.env.local` and the bot are excluded from deployment. CRON_SECRET protects the existing daily database ping. The bot requires its own awake computer and is not a serverless function.

The app and bot dependency trees were patched and audited during the upgrade. The app's remaining lint warnings originate mainly from legacy unused components. Tests cover scoring, session tampering, malformed results, quotes, cumulative deltas, and duplicate delivery. Database transaction checks should run inside a rolled-back transaction, never by leaving fake results in real seasons.

## Design references and mobile checks

The original parchment, amber, white, and slate palette is preserved. Interface labels describe the data and actions directly. The floating navigation and progress hierarchy draw from Mobbin’s public [tab-bar](https://mobbin.com/explore/mobile/ui-elements/tab-bar) and [progress-screen](https://mobbin.com/explore/mobile/screens/progress) collections.

Browser checks cover all four main screens at 320, 360, 390, and 430 CSS pixels, plus 25% larger text at 320 pixels. The three story pages were checked for overflow, valid PNG sharing with active user-gesture permission (share API mocked; no messages sent), and an actual image download. Native app availability in the share sheet is controlled by the phone.
