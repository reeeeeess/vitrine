// Plays on this computer through an installed Microsoft Edge or Google Chrome when Spotify refuses
// Vitrine's own DRM (Widevine without castlabs' VMP signature). Those browsers ship a Widevine that
// Spotify accepts, the one open.spotify.com plays with: a small page of theirs runs Spotify's Web
// Playback SDK and becomes the "Vitrine (cet ordinateur)" Connect device, which Vitrine then drives
// through the Web API like any other.
//
// The page is served from 127.0.0.1 on a random port, and every request must carry a random key,
// so another program cannot ask this server for the access token without that key.
import { BrowserWindow } from "electron";
import { spawn, type ChildProcess } from "node:child_process";
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import path from "node:path";

const READY_TIMEOUT_MS = 30_000;
export const DEVICE_NAME = "Vitrine (cet ordinateur)";

export type BrowserName = "Microsoft Edge" | "Google Chrome";

export type PlayerCommand =
  | { type: "toggle" | "pause" | "resume" | "next" | "previous" }
  | { type: "seek"; ms: number }
  | { type: "volume"; value: number };

/** Checks a command coming from the page before it is passed on. */
export function parseCommand(raw: unknown): PlayerCommand | null {
  const input = (raw ?? {}) as Record<string, unknown>;
  switch (input.type) {
    case "toggle":
    case "pause":
    case "resume":
    case "next":
    case "previous":
      return { type: input.type };
    case "seek":
      return typeof input.ms === "number" && input.ms >= 0 ? { type: "seek", ms: Math.round(input.ms) } : null;
    case "volume":
      return typeof input.value === "number" ? { type: "volume", value: Math.min(1, Math.max(0, input.value)) } : null;
    default:
      return null;
  }
}

export interface BrowserPlayerStatus {
  state: "off" | "starting" | "ready" | "error";
  browser: BrowserName | null;
  deviceId?: string;
  detail?: string;
}

/** The installed browser to play with: Edge first (on every Windows), then Chrome. */
export function findBrowser(platform = process.platform, env = process.env, exists: (file: string) => boolean = fs.existsSync): { name: BrowserName; path: string } | null {
  const candidates: { name: BrowserName; path: string }[] = [];
  if (platform === "win32") {
    const roots = [env["ProgramFiles(x86)"], env.ProgramFiles, env.LOCALAPPDATA].filter((root): root is string => Boolean(root));
    for (const root of roots) candidates.push({ name: "Microsoft Edge", path: path.join(root, "Microsoft", "Edge", "Application", "msedge.exe") });
    for (const root of roots) candidates.push({ name: "Google Chrome", path: path.join(root, "Google", "Chrome", "Application", "chrome.exe") });
  } else if (platform === "darwin") {
    candidates.push(
      { name: "Microsoft Edge", path: "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge" },
      { name: "Google Chrome", path: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" },
    );
  } else {
    candidates.push(
      { name: "Microsoft Edge", path: "/usr/bin/microsoft-edge" },
      { name: "Google Chrome", path: "/usr/bin/google-chrome" },
      { name: "Google Chrome", path: "/opt/google/chrome/chrome" },
    );
  }
  return candidates.find((candidate) => exists(candidate.path)) ?? null;
}

/** The page the browser opens: Spotify's SDK, reporting its device and its errors back here. */
export function playerPage(): string {
  return `<!doctype html>
<html lang="fr"><meta charset="utf-8"><title>Vitrine – lecteur</title>
<body style="margin:0;height:100vh;display:grid;place-items:center;background:#0a0908;color:#b9b3a4;font:14px system-ui,sans-serif">
<p>Lecteur de Vitrine : laissez cette fenêtre ouverte, Vitrine la ferme toute seule.</p>
<script>
const key = new URLSearchParams(location.search).get("k");
const post = (route, body) => fetch(route + "?k=" + key, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).catch(() => {});
window.onSpotifyWebPlaybackSDKReady = () => {
  const player = new Spotify.Player({
    name: ${JSON.stringify(DEVICE_NAME)},
    volume: 0.7,
    getOAuthToken: (cb) =>
      fetch("/token?k=" + key)
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error("session Spotify absente"))))
        .then((j) => cb(j.token))
        .catch((error) => post("/event", { type: "authentication_error", message: error.message })),
  });
  player.addListener("ready", ({ device_id }) => {
    // unlocks the SDK's audio as a click would: without it, Chrome can hold the track at 0:00
    player.activateElement().catch(() => {});
    post("/ready", { deviceId: device_id });
  });
  // the player's own state: the Web API reports a frozen position for this kind of device
  player.addListener("player_state_changed", (state) => post("/state", state ? {
    paused: state.paused, position: state.position, duration: state.duration, shuffle: state.shuffle, repeat_mode: state.repeat_mode,
    context: { uri: state.context?.uri ?? null },
    track_window: { current_track: state.track_window?.current_track ? (({ id, uri, name, duration_ms, artists, album }) => ({
      id, uri, name, duration_ms, artists: artists.map((a) => ({ name: a.name, uri: a.uri })),
      album: { name: album.name, uri: album.uri, images: album.images.map((i) => ({ url: i.url, width: i.width ?? null })) },
    }))(state.track_window.current_track) : null },
  } : null));
  // Vitrine's commands, waited for one at a time; the SDK's own calls keep the position on pause
  const run = (command) => {
    switch (command.type) {
      case "toggle": return player.togglePlay();
      case "pause": return player.pause();
      case "resume": return player.resume();
      case "next": return player.nextTrack();
      case "previous": return player.previousTrack();
      case "seek": return player.seek(command.ms);
      case "volume": return player.setVolume(command.value);
    }
  };
  (async function listen() {
    for (;;) {
      try {
        const response = await fetch("/command?k=" + key);
        if (response.status === 200) {
          const command = await response.json();
          await Promise.resolve(run(command)).then(() => console.log("commande", command.type), (error) => console.warn("commande", command.type, error));
        }
        else if (response.status !== 204) await new Promise((r) => setTimeout(r, 1000));
      } catch {
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
  })();
  player.addListener("autoplay_failed", () => post("/event", { type: "autoplay_failed", message: "lecture automatique bloquée par le navigateur" }));
  if (new URLSearchParams(location.search).get("debug")) {
    setInterval(() => player.getCurrentState().then((s) => s && post("/event", { type: "state", message: JSON.stringify({ paused: s.paused, position: s.position, track: s.track_window?.current_track?.name }) })), 3000);
  }
  player.addListener("not_ready", () => post("/event", { type: "not_ready" }));
  for (const type of ["initialization_error", "authentication_error", "account_error", "playback_error"]) {
    player.addListener(type, ({ message }) => post("/event", { type, message }));
  }
  player.connect().then(() => player.activateElement().catch(() => {}));
};
</script>
<script src="https://sdk.scdn.co/spotify-player.js" onerror="post('/event', { type: 'initialization_error', message: 'SDK Spotify injoignable' })"></script>
</html>`;
}

function readJson(request: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    let body = "";
    request.on("data", (chunk: Buffer) => {
      if (body.length < 10_000) body += chunk.toString("utf8");
    });
    request.on("end", () => {
      try {
        const parsed: unknown = JSON.parse(body);
        resolve(parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {});
      } catch {
        resolve({});
      }
    });
  });
}

/** What the player's browser leaves out to weigh less (measured: see docs/INSPIRATION-MOVIX-MYSTIC.md). */
export const LEAN_FLAGS = [
  "--disable-extensions",
  "--disable-sync",
  "--disable-default-apps",
  "--no-pings",
  "--disable-breakpad",
  "--disable-gpu",
  "--disable-site-isolation-trials",
  "--renderer-process-limit=1",
  "--js-flags=--max-old-space-size=128",
  `--disable-features=${[
    "Translate",
    "MediaRouter",
    "OptimizationHints",
    "AutofillServerCommunication",
    "SpareRendererForSitePerProcess",
    "IsolateOrigins",
    "site-per-process",
    "AudioServiceOutOfProcess",
    "msEdgeSidebarV2",
    "msShoppingExp",
    "EdgeCollections",
    "msUndersideButton",
  ].join(",")}`,
];

export class BrowserPlayer {
  private server: Server | null = null;
  private child: ChildProcess | null = null;
  private key = "";
  private starting: Promise<BrowserPlayerStatus> | null = null;
  /** settles the launch: the device id, or null when the player reported it cannot start */
  private onReady: ((deviceId: string | null) => void) | null = null;
  private commands: PlayerCommand[] = [];
  /** the player's latest state, for the main process when the page is freed */
  lastState: Record<string, unknown> | null = null;
  onState: ((state: Record<string, unknown> | null) => void) | null = null;
  private waiting: ServerResponse | null = null;
  status: BrowserPlayerStatus = { state: "off", browser: findBrowser()?.name ?? null };

  constructor(
    private readonly accessToken: () => Promise<string>,
    private readonly profileDir: string,
    private readonly window: () => BrowserWindow | null,
  ) {}

  start(): Promise<BrowserPlayerStatus> {
    if (this.status.state === "ready" && this.child && this.child.exitCode === null) {
      // a page opened again (it was freed): it learns what plays, once it listens to the player
      setTimeout(() => this.window()?.webContents.send("browser-player:state", this.lastState), 600);
      return Promise.resolve(this.status);
    }
    this.starting ??= this.launch().finally(() => {
      this.starting = null;
    });
    return this.starting;
  }

  /** Hands a command to the page, at once if it is waiting for one. */
  command(command: PlayerCommand): void {
    if (this.status.state !== "ready") return;
    if (this.waiting) {
      const response = this.waiting;
      this.waiting = null;
      response.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify(command));
    } else {
      this.commands.push(command);
    }
  }

  stop(): void {
    this.onReady = null;
    this.lastState = null;
    this.commands = [];
    this.waiting = null;
    this.child?.kill();
    this.child = null;
    this.server?.close();
    this.server = null;
    this.set({ state: "off", deviceId: undefined, detail: undefined });
  }

  private set(patch: Partial<BrowserPlayerStatus>): void {
    this.status = { ...this.status, ...patch };
    this.window()?.webContents.send("browser-player:status", this.status);
  }

  private async launch(): Promise<BrowserPlayerStatus> {
    const browser = findBrowser();
    if (!browser) {
      this.set({ state: "error", browser: null, detail: "Ni Microsoft Edge ni Google Chrome ne sont installés." });
      return this.status;
    }
    this.stop();
    this.set({ state: "starting", browser: browser.name, detail: undefined });
    this.key = randomBytes(24).toString("hex");
    const port = await this.serve();

    const url = `http://127.0.0.1:${port}/player?k=${this.key}${process.env.VITRINE_BROWSER_DEBUG_PORT ? "&debug=1" : ""}`;
    fs.mkdirSync(this.profileDir, { recursive: true });
    const child = spawn(
      browser.path,
      [
        `--app=${url}`,
        // a profile of its own: a separate browser process Vitrine owns, apart from the person's browsing
        `--user-data-dir=${this.profileDir}`,
        "--autoplay-policy=no-user-gesture-required",
        "--no-first-run",
        "--no-default-browser-check",
        // a window out of sight still has to answer at once: Chrome otherwise slows it down and its
        // player ignores pause and seek (next still goes through Spotify's servers)
        "--disable-background-timer-throttling",
        "--disable-renderer-backgrounding",
        "--disable-backgrounding-occluded-windows",
        // memory: this browser only plays sound, everything else it would run is left out (extensions,
        // sync, Edge's shopping and sidebar, the GPU, a process per site, a spare one); the component
        // updater stays on, it installs the Widevine module in a new profile
        ...LEAN_FLAGS,
        // out of sight: the window only hosts the player
        "--window-position=-10000,-10000",
        "--window-size=420,240",
        // Chrome will not start as root on Linux without it; never the case on Windows or macOS
        ...(process.platform === "linux" && process.getuid?.() === 0 ? ["--no-sandbox"] : []),
        // development only: lets a debugger read the player page's console
        ...(process.env.VITRINE_BROWSER_DEBUG_PORT ? [`--remote-debugging-port=${process.env.VITRINE_BROWSER_DEBUG_PORT}`] : []),
      ],
      { stdio: "ignore", windowsHide: true },
    );
    this.child = child;
    child.on("error", (error) => this.set({ state: "error", detail: `${browser.name} n'a pas pu démarrer : ${error.message}` }));
    child.on("exit", () => {
      if (this.child === child) {
        this.child = null;
        this.onReady?.(null);
        if (this.status.state !== "off") this.set({ state: "error", deviceId: undefined, detail: `${browser.name} a été fermé.` });
      }
    });

    const deviceId = await new Promise<string | null>((resolve) => {
      const timer = setTimeout(() => resolve(null), READY_TIMEOUT_MS);
      this.onReady = (id) => {
        clearTimeout(timer);
        resolve(id);
      };
    });
    if (!deviceId) {
      if (this.status.state === "starting") this.set({ state: "error", detail: `Le lecteur ${browser.name} ne s'est pas annoncé à Spotify.` });
      // a player that cannot start is not left running out of sight
      this.child?.kill();
      return this.status;
    }
    this.set({ state: "ready", deviceId, detail: undefined });
    return this.status;
  }

  private serve(): Promise<number> {
    return new Promise((resolve, reject) => {
      const server = createServer(async (request, response) => {
        const url = new URL(request.url ?? "/", "http://127.0.0.1");
        if (url.searchParams.get("k") !== this.key) {
          response.writeHead(403).end();
          return;
        }
        if (request.method === "GET" && url.pathname === "/player") {
          response.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
          response.end(playerPage());
        } else if (request.method === "GET" && url.pathname === "/token") {
          try {
            const token = await this.accessToken();
            response.writeHead(200, { "content-type": "application/json", "cache-control": "no-store" });
            response.end(JSON.stringify({ token }));
          } catch {
            response.writeHead(401).end();
          }
        } else if (request.method === "POST" && url.pathname === "/ready") {
          const body = await readJson(request);
          if (typeof body.deviceId === "string") this.onReady?.(body.deviceId);
          response.writeHead(204).end();
        } else if (request.method === "POST" && url.pathname === "/state") {
          const body = await readJson(request);
          this.lastState = Object.keys(body).length ? body : null;
          this.window()?.webContents.send("browser-player:state", this.lastState);
          this.onState?.(this.lastState);
          response.writeHead(204).end();
        } else if (request.method === "GET" && url.pathname === "/command") {
          // long poll: answered with the next command, or empty after a while so the page asks again
          const queued = this.commands.shift();
          if (queued) {
            response.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify(queued));
          } else {
            this.waiting?.writeHead(204).end();
            this.waiting = response;
            const timer = setTimeout(() => {
              if (this.waiting === response) {
                this.waiting = null;
                response.writeHead(204).end();
              }
            }, 25_000);
            response.on("close", () => {
              clearTimeout(timer);
              // the page went away: the next command waits for it to ask again
              if (this.waiting === response) this.waiting = null;
            });
          }
        } else if (request.method === "POST" && url.pathname === "/event") {
          const body = await readJson(request);
          const type = typeof body.type === "string" ? body.type : "event";
          const message = typeof body.message === "string" ? body.message.slice(0, 300) : "";
          this.window()?.webContents.send("browser-player:event", { type, message });
          if (process.env.VITRINE_BROWSER_DEBUG_PORT) console.log(`[lecteur navigateur] ${type} ${message}`);
          if (type === "state" || type === "autoplay_failed") {
            // diagnostics only
          } else if (type !== "playback_error" && type !== "not_ready") {
            this.set({ state: "error", detail: `${type} ${message}`.trim() });
            this.onReady?.(null);
          }
          response.writeHead(204).end();
        } else {
          response.writeHead(404).end();
        }
      });
      server.on("error", reject);
      server.listen(0, "127.0.0.1", () => {
        this.server = server;
        const address = server.address();
        resolve(typeof address === "object" && address ? address.port : 0);
      });
    });
  }
}
