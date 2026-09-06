import {
  mkdirSync,
  existsSync,
  readFileSync,
  writeFileSync,
  renameSync,
  chmodSync,
} from "node:fs";
import path from "node:path";
import wweb from "whatsapp-web.js";
import QRCode from "qrcode";
import { parseResult, requestId, statAnswer } from "./commands.mjs";
const { Client, LocalAuth, MessageMedia } = wweb;
const app = new URL(process.env.CHAMBERS_APP_URL || "http://localhost:3000");
if (!process.env.BOT_API_TOKEN)
  throw new Error("Set BOT_API_TOKEN in bot/.env.");
if (
  !["localhost", "127.0.0.1"].includes(app.hostname) &&
  app.protocol !== "https:"
)
  throw new Error("Remote app must use HTTPS.");
const stateDir = path.resolve(process.env.BOT_STATE_DIR || ".state");
mkdirSync(stateDir, { recursive: true, mode: 0o700 });
chmodSync(stateDir, 0o700);
const statePath = path.join(stateDir, "state.json");
const state = existsSync(statePath)
  ? JSON.parse(readFileSync(statePath, "utf8"))
  : { groupId: null, completed: [], pending: {} };
state.pending ||= {};
function saveState() {
  writeFileSync(statePath + ".tmp", JSON.stringify(state), { mode: 0o600 });
  renameSync(statePath + ".tmp", statePath);
}
const client = new Client({
  authStrategy: new LocalAuth({
    clientId: "catan-chambers",
    dataPath: path.join(stateDir, "auth"),
  }),
  puppeteer: { headless: true },
  deviceName: "Catan Chambers bot",
});
client.on("qr", async (qr) => {
  const file = path.join(stateDir, "link-whatsapp.png");
  await QRCode.toFile(file, qr, { width: 400, margin: 3 });
  chmodSync(file, 0o600);
  console.log("Link WhatsApp using this QR image:", file);
});
client.on("auth_failure", () =>
  console.error("WhatsApp linking failed. Relink the account."),
);
client.on("disconnected", (reason) =>
  console.error("WhatsApp disconnected:", reason),
);
client.on("ready", async () => {
  try {
    const chats = await client.getChats();
    if (!state.groupId) {
      const matches = chats.filter(
        (c) => c.isGroup && c.name === "Catan Chambers",
      );
      if (matches.length !== 1)
        throw new Error(
          "Expected exactly one Catan Chambers group; set the correct group before starting.",
        );
      state.groupId = matches[0].id._serialized;
      saveState();
    }
    if (
      !chats.some(
        (c) =>
          c.id._serialized === state.groupId &&
          c.isGroup &&
          c.name === "Catan Chambers",
      )
    )
      throw new Error("Pinned Catan Chambers group is unavailable or renamed.");
    console.log(
      "Ready. Only the pinned Catan Chambers group is monitored. Only your own result posts can write.",
    );
    for (const [id, pending] of Object.entries(state.pending)) {
      await deliverResult(pending);
      state.completed.push(id);
      delete state.pending[id];
      saveState();
    }
  } catch (e) {
    console.error(e.message);
    await client.destroy();
    process.exitCode = 1;
  }
});
async function api(route, body) {
  const r = await fetch(new URL(route, app), {
    method: body ? "POST" : "GET",
    headers: {
      Authorization: `Bearer ${process.env.BOT_API_TOKEN}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(30000),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || "App request failed.");
  return data;
}
async function screenshot(seasonId) {
  const page = await client.pupBrowser.newPage();
  try {
    await page.setViewport({ width: 480, height: 900, deviceScaleFactor: 2 });
    await page.setExtraHTTPHeaders({
      Authorization: `Bearer ${process.env.BOT_API_TOKEN}`,
    });
    const url = new URL("/scorecard", app);
    url.searchParams.set("season", seasonId);
    const response = await page.goto(url.href, {
      waitUntil: "networkidle0",
      timeout: 30000,
    });
    if (!response?.ok() || new URL(page.url()).pathname !== "/scorecard")
      throw new Error("Scorecard could not be loaded.");
    const target = await page.$("#scorecard");
    if (!target) throw new Error("Scorecard not found.");
    const png = await target.screenshot({ type: "png" });
    return new MessageMedia(
      "image/png",
      Buffer.from(png).toString("base64"),
      "chambers-scorecard.png",
    );
  } finally {
    await page.close();
  }
}
async function deliverResult(pending) {
  await api("/api/games", pending.result);
  const media = await screenshot(pending.result.seasonId);
  await client.sendMessage(state.groupId, media, {
    caption: `Game ${pending.result.gameNumber} recorded. The chamber has spoken.`,
  });
}
let queue = Promise.resolve();
const cooldown = new Map();
client.on("message_create", (message) => {
  queue = queue
    .then(async () => {
      const chatId = message.fromMe ? message.to : message.from;
      if (
        !state.groupId ||
        chatId !== state.groupId ||
        typeof message.body !== "string" ||
        !/^!catan(?:\s|$)/.test(message.body) ||
        message.body.length > 2000
      )
        return;
      const id = message.id._serialized;
      if (state.completed.includes(id)) return;
      if (message.body.startsWith("!catan result") && !message.fromMe) return;
      const sender = message.author || message.from;
      if (Date.now() - (cooldown.get(sender) || 0) < 3000) return;
      cooldown.set(sender, Date.now());
      try {
        const league = await api("/api/league");
        const result = parseResult(message.body, league);
        if (result) {
          const pending = { result: { ...result, requestId: requestId(id) } };
          state.pending[id] = pending;
          saveState();
          await deliverResult(pending);
          delete state.pending[id];
        } else if (/^!catan screenshot(?:\s|$)/i.test(message.body)) {
          const n = message.body.match(/season\s+(\d+)/i)?.[1];
          const season = n
            ? league.seasons.find((s) => s.name === `Catan ${n}.0`)
            : league.seasons[0];
          if (!season) throw new Error("Season not found.");
          await client.sendMessage(state.groupId, await screenshot(season.id), {
            caption: `${season.name} standings`,
          });
        } else await message.reply(statAnswer(message.body, league));
        state.completed.push(id);
        state.completed = state.completed.slice(-5000);
        saveState();
      } catch (e) {
        console.error("Command failed:", e.message);
        await message.reply(`Could not complete that command: ${e.message}`);
      }
    })
    .catch((e) => console.error("WhatsApp handler failed:", e.message));
});
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, async () => {
    saveState();
    await client.destroy();
    process.exit(0);
  });
await client.initialize();
