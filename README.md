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

Apply `migrations/005_season_house_rules.sql` before deploying the season setup flow. It adds house-rule notes and an idempotent season-creation RPC. The old RPC remains available for deployment compatibility.

## Starting a season

The admin's **Start new season** button opens previous-season highlights, season details, then rules. A new season starts with a recap; recording its first game opens the recap and saved rules before score entry. Only one active season is allowed.

Road and Army bonuses use explicit whole-number settings (0–100), with a selected rule for ties. These values feed the existing standings calculation. Up to ten house rules are stored as plain text and shown to the group. They are not parsed or applied to scores. A new scoring formula requires an explicit implementation and tests; changes should be agreed before creating the season so past results keep their existing rules.

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
