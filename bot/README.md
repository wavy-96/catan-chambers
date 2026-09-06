# Catan Chambers WhatsApp companion

Runs on a computer with Node 22.18+ and a linked WhatsApp account. There is no paid model/API dependency: questions are answered deterministically from the private app's recorded data. This supports common stats questions, not arbitrary conversational reasoning.

The client is unofficial. Its maintainers warn that accounts can be blocked. See https://wwebjs.dev/guide/. Keep the computer awake for continuous operation. Vercel hosts the web app; it does not run this persistent linked client.

## Setup

1. `npm ci` in this directory.
2. Copy `.env.example` to `.env` and set the app URL and the server's BOT_API_TOKEN. Never commit this file or the `.state` directory.
3. Run `npm start`.
4. Open `.state/link-whatsapp.png` and scan through WhatsApp Settings → Linked devices → Link a device. QR images refresh as needed.
5. The client pins the unique group named **Catan Chambers**. If multiple groups match, setup stops instead of guessing. Later name/ID mismatches also stop startup.

Only messages in that pinned group beginning with `!catan` are commands. Result posts must be sent by the linked account itself. Other members can ask stats questions. The bot never processes arbitrary chat as instructions, edits historical results, or accepts nullification commands; nullify through the admin app.

## Result template

Use the **active** season, actual game number/date, and points for that individual game:

```text
!catan result
Season: Catan 4.0
Game: 1
Date: 2026-09-05
Ezzy: 10
Anas: 8
Akif: 7
Tamim: 6
Road: Ezzy
Army: Anas
```

Use `None` when nobody held Road or Army. Include all ten lines with no extra commentary. Each player appears once, points must be integers 0–12, and exactly one player must reach 10. The group example does not create a new season; use the app's admin controls to create one first.

Accepted results save atomically, then the bot captures the authenticated scorecard and posts it to the same group. A stable message-derived request ID prevents duplicate game writes. Pending deliveries are retained locally and retried on startup. Delivery itself is at-least-once: a crash after WhatsApp accepts a screenshot but before its receipt is persisted may cause the screenshot to be resent, but never a duplicate game.

## Stats questions

```text
!catan standings season 3
!catan Tamim stats season 3
!catan Ezzy vs Tamim season 3
!catan who won the last game?
!catan most roads season 3
!catan game 10 season 3
!catan screenshot season 3
!catan help
```

Unsupported questions receive examples rather than an invented answer. Commands are queued and throttled per sender. Unknown seasons and malformed templates are rejected. The bot handles only newly delivered commands; it does not bulk-import chat history.

## Operation

- Start manually with `npm start`; stop with Ctrl-C.
- Session state, group ID, processed message IDs, and delivery queue live under `.state` with restricted file permissions. No phone numbers are embedded in source.
- If linking fails, stop the process and relink using WhatsApp's Linked devices controls. Do not share the QR or session files.
- Change BOT_API_TOKEN in the private app and local `.env` together to revoke old bot access.
- Test parser behaviour with `npm test`.
- The Puppeteer override selects a patched release; refresh it with the WhatsApp client dependency and recheck account linking and scorecard capture together.
