// End-to-end check of the built page (dist/renderer), without Electron nor a Spotify account: the desktop
// bridge and Spotify's API answer with made-up data, and a real Chromium goes through the main screens.
// Run: npm run build:renderer && npm run test:e2e (CI: after `npx playwright install --with-deps chromium`).
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { chromium } from "playwright";

const root = fileURLToPath(new URL("../../dist/renderer/", import.meta.url));
const axe = await readFile(createRequire(import.meta.url).resolve("axe-core/axe.min.js"), "utf8");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".woff2": "font/woff2", ".woff": "font/woff", ".png": "image/png", ".svg": "image/svg+xml" };

const server = createServer(async (request, response) => {
  const path = normalize(decodeURIComponent(new URL(request.url, "http://x").pathname)).replace(/^([/\\])+/, "");
  const file = join(root, path || "index.html");
  try {
    const body = await readFile(file.startsWith(root) ? file : join(root, "index.html"));
    response.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream" });
    response.end(body);
  } catch {
    response.writeHead(404);
    response.end();
  }
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${server.address().port}/`;

// ── made-up Spotify ─────────────────────────────────────────────────────

const cover = (label, hue) =>
  "data:image/svg+xml," + encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='300' height='300'><rect width='300' height='300' fill='hsl(${hue} 70% 45%)'/><text x='20' y='270' font-size='34' fill='white'>${label}</text></svg>`);
const track = (i, name, artist) => ({
  id: `t${i}`.padEnd(22, "0"),
  uri: `spotify:track:${`t${i}`.padEnd(22, "0")}`,
  name,
  duration_ms: 180_000,
  explicit: false,
  artists: [{ id: `ar${i}`, name: artist }],
  album: { id: `al${i}`, name: `Album ${name}`, images: [{ url: cover(name, i * 40), width: 300 }] },
});
const tracks = [track(1, "Minuit à Paris", "Les Ondes"), track(2, "Néons", "Nova Lune"), track(3, "Orbites", "Aria Vent")];
const playlists = ["Nuit Blanche", "Road Trip"].map((name, i) => ({ id: `p${i}`, uri: `spotify:playlist:p${i}`, name, description: "", owner: { id: "me", display_name: "Moi" }, items: { total: 12 }, images: [{ url: cover(name, 200 + i * 50), width: 300 }] }));
const started = Date.now();
const routes = {
  "/me": { id: "me", display_name: "Testeur Vitrine", product: "premium", images: [] },
  "/me/player": () => ({ device: { id: "phone", name: "Téléphone", type: "Smartphone", volume_percent: 60 }, is_playing: true, progress_ms: 40_000 + (Date.now() - started), shuffle_state: false, repeat_state: "off", item: tracks[0] }),
  "/me/player/recently-played": { items: tracks.map((t) => ({ track: t, context: null })) },
  "/me/playlists": { items: playlists, next: null },
  "/me/albums": { items: [], next: null },
  "/me/top/artists": { items: tracks.map((t) => ({ ...t.artists[0], uri: `spotify:artist:${t.artists[0].id}`, genres: [], images: t.album.images })) },
  "/me/top/tracks": { items: tracks },
  "/me/tracks/contains": [false],
  "/me/player/devices": { devices: [] },
  "/me/player/queue": { currently_playing: tracks[0], queue: tracks.slice(1) },
};
const lrc = ["Dans la ville qui s'éteint", "Je cherche encore ton nom", "Les néons dessinent le chemin", "Jusqu'au bout de l'horizon", "Et la nuit nous appartient", "On danse sans raison"]
  .map((line, i) => `[00:${String(36 + i * 4).padStart(2, "0")}.00]${line}`)
  .join("\n");

// ── the run ─────────────────────────────────────────────────────────────

const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "fr-FR" });
await context.addInitScript((lyrics) => {
  try {
    sessionStorage.setItem("vitrine.introShown", "1");
    localStorage.setItem("vitrine.welcomed", "1");
  } catch {}
  // the desktop bridge: what the screens read, and a quiet "nothing" for everything else
  const known = {
    platform: "win32",
    auth: { status: async () => ({ loggedIn: true, clientId: "", clientIdBuiltIn: true, persistent: true }), token: async () => "fake", logout: async () => {} },
    drm: { status: async () => ({ widevine: false, detail: "essai" }) },
    lyrics: { get: async () => ({ synced: lyrics, plain: null, instrumental: false, source: "lrclib", sources: [{ source: "lrclib", kind: "synced" }] }), translate: async (lines) => ({ lines: lines.map(() => null), same: true, service: "mymemory" }), clear: async () => {} },
    history: { insight: async (kind) => (["quickPicks", "monthTop", "yearTop"].includes(kind) ? [] : kind === "trackStats" ? {} : null), summary: async () => null, info: async () => ({ plays: 0, bySource: { vitrine: 0, spotify: 0, import: 0 } }), enabled: async () => true },
    pins: { get: async () => [], set: async (list) => list },
    moments: { get: async () => [], set: async (list) => list },
    info: async () => ({ version: "test", platform: "win32", packaged: false }),
    updates: { get: async () => ({ status: "idle" }), subscribe: () => () => {} },
  };
  // anything else: a part of the bridge that can be read further, called (an empty answer), or listened to
  const anything = () =>
    new Proxy(function () {}, {
      get: (_, name) => (name === "then" ? undefined : typeof name === "string" && (name.startsWith("on") || name === "subscribe") ? () => () => {} : anything()),
      apply: () => Promise.resolve({}),
    });
  const wrap = (target) =>
    new Proxy(target, {
      get(object, name) {
        if (!(name in object)) return typeof name === "string" ? anything() : undefined;
        const value = object[name];
        return value && typeof value === "object" && !Array.isArray(value) ? wrap(value) : value;
      },
    });
  window.vitrine = wrap(known);
}, lrc);
await context.route("https://api.spotify.com/v1/**", (route) => {
  const path = new URL(route.request().url()).pathname.replace("/v1", "");
  const answer = routes[path];
  const body = typeof answer === "function" ? answer() : (answer ?? { items: [] });
  return route.fulfill({ status: route.request().method() === "GET" ? 200 : 204, contentType: "application/json", body: JSON.stringify(body) });
});

const page = await context.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
const steps = [];
const check = async (name, run) => {
  try {
    await run();
    steps.push(`✓ ${name}`);
  } catch (error) {
    steps.push(`✗ ${name} : ${error.message.split("\n")[0]}`);
  }
};

await page.goto(base);
await check("l'accueil s'affiche avec le titre en cours", async () => {
  await page.getByRole("heading", { name: /Bonjour|Bonsoir/ }).waitFor({ timeout: 15_000 });
  await page.locator("footer").getByText("Minuit à Paris").first().waitFor({ timeout: 10_000 });
});
await check("les paroles plein écran suivent la chanson", async () => {
  await page.getByRole("button", { name: "Paroles", exact: true }).click();
  await page.locator(".lyric-line").first().waitFor({ timeout: 10_000 });
  await page.keyboard.press("Escape");
});
await check("les réglages s'ouvrent et le thème Verre s'applique", async () => {
  await page.getByRole("button", { name: "Réglages" }).first().click();
  await page.getByRole("heading", { name: "Réglages" }).waitFor({ timeout: 10_000 });
  await page.getByRole("button", { name: /Verre/ }).first().click();
  await page.waitForFunction(() => document.documentElement.dataset.theme === "glass", null, { timeout: 5000 });
});
await check("le mode salon s'ouvre et se ferme", async () => {
  await page.keyboard.press("Control+Shift+S");
  await page.locator(".z-\\[88\\]").waitFor({ timeout: 5000 });
  await page.keyboard.press("Escape");
  await page.locator(".z-\\[88\\]").waitFor({ state: "detached", timeout: 5000 });
});
await check("en anglais : l'interface traduite, les paroles et les titres intacts", async () => {
  const english = await context.newPage();
  english.on("pageerror", (error) => errors.push(error.message));
  await english.addInitScript(() => localStorage.setItem("vitrine.language", "en"));
  await english.goto(base);
  await english.getByRole("heading", { name: /Good (morning|afternoon|evening)/ }).waitFor({ timeout: 15_000 });
  await english.getByRole("button", { name: "Settings" }).first().waitFor({ timeout: 5000 });
  await english.locator("footer").getByText("Minuit à Paris").first().waitFor({ timeout: 10_000 });
  await english.getByRole("button", { name: "Lyrics", exact: true }).click();
  await english.locator(".lyric-line").getByText("Je cherche encore ton nom").first().waitFor({ timeout: 10_000 });
  const french = await english.evaluate(() => {
    // what is still French outside the names and lyrics: a few known words are enough to tell
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const left = [];
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (node.parentElement?.closest("[translate='no'], script, style")) continue;
      if (/\b(Réglages|Bibliothèque|Accueil|Paroles|Lecture|titres|écoute)\b/.test(node.data)) left.push(node.data.trim());
    }
    return left;
  });
  // the language is kept for the whole site: back to French for the next pages
  await english.evaluate(() => localStorage.removeItem("vitrine.language"));
  await english.close();
  if (french.length) throw new Error(`encore en français : ${french.slice(0, 5).join(" | ")}`);
});
// accessibility: axe's rules (WCAG A and AA), what is serious or critical fails
const audit = async (target) => {
  await target.evaluate(axe + ";0");
  const found = await target.evaluate(async () =>
    (await window.axe.run(document, { resultTypes: ["violations"], rules: { region: { enabled: false } } })).violations
      .filter((rule) => rule.impact === "serious" || rule.impact === "critical")
      .map((rule) => `${rule.id} (${rule.nodes.map((node) => node.html.slice(0, 160)).slice(0, 3).join(", ")})`),
  );
  if (found.length) throw new Error(found.join(" | "));
};
await check("accessibilité de l'accueil et des réglages (axe, WCAG AA)", async () => {
  await page.getByRole("button", { name: "Accueil", exact: true }).first().click();
  await page.waitForTimeout(1200);
  await audit(page);
  await page.getByRole("button", { name: "Réglages" }).first().click();
  await page.waitForTimeout(1200);
  await audit(page);
});
await check("« ? » liste les raccourcis, Échap ferme", async () => {
  await page.evaluate(() => (document.activeElement instanceof HTMLElement ? document.activeElement.blur() : undefined));
  await page.keyboard.press("?");
  await page.getByRole("dialog", { name: "Raccourcis" }).waitFor({ timeout: 5000 });
  await audit(page);
  await page.keyboard.press("Escape");
  await page.getByRole("dialog", { name: "Raccourcis" }).waitFor({ state: "detached", timeout: 5000 });
});
await check("premier lancement : l'accueil en trois écrans, puis le clavier va d'abord au contenu", async () => {
  const first = await context.newPage();
  first.on("pageerror", (error) => errors.push(error.message));
  await first.addInitScript(() => localStorage.removeItem("vitrine.welcomed"));
  await first.goto(base);
  const welcome = first.getByRole("dialog", { name: /Votre musique/ });
  await welcome.waitFor({ timeout: 15_000 });
  await audit(first);
  await first.keyboard.press("ArrowRight");
  await first.keyboard.press("ArrowRight");
  await first.getByRole("button", { name: "C'est parti" }).click();
  await first.getByRole("dialog").waitFor({ state: "detached", timeout: 5000 });
  await first.keyboard.press("Tab");
  const skip = await first.evaluate(() => document.activeElement?.textContent?.trim());
  if (skip !== "Aller au contenu") throw new Error(`premier Tab sur « ${skip} »`);
  await first.close();
});
await check("aucune erreur dans la page", async () => {
  if (errors.length) throw new Error(errors.join(" | "));
});

await browser.close();
server.close();
console.log(steps.join("\n"));
process.exit(steps.some((step) => step.startsWith("✗")) ? 1 : 0);
