import * as electron from "electron";
import { app, BrowserWindow, clipboard, ipcMain, net, protocol, screen, shell, type IpcMainInvokeEvent, type Rectangle } from "electron";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { AuthManager } from "./auth";
import { BrowserPlayer, parseCommand } from "./browserPlayer";
import { cliCommand } from "./cli";
import { Desktop, HIDDEN_ARG, type DesktopNowPlaying } from "./desktop";
import { readConfig, updateConfig } from "./config";
import { DiscordPresence } from "./discord";
import type { NowPlaying } from "./discordProtocol";
import {
  addPlay,
  clearHistory,
  exportHistory,
  extendPlay,
  historyEnabled,
  historyInfo,
  historyInsight,
  historySummary,
  importHistory,
  newMilestones,
  setHistoryEnabled,
  startAccountSync,
  syncAccount,
  weekToTell,
} from "./history";
import { formatListening } from "../src/renderer/lib/listening";
import { clearLyricsCache, fetchLyrics } from "./lyrics";
import { setTranslationSettings, translateLyrics, translationSettings } from "./translate";
import { fetchCredits } from "./credits";
import { connectLastfm, disconnectLastfm, lastfmStatus, nowPlaying as lastfmNowPlaying, scrobble, setLastfmKeys } from "./lastfm";
import { LyricsOverlay, parseOverlayLine } from "./overlay";
import fs from "node:fs";
import { applyEqualizer, cleanEqualizer, DEFAULT_EQUALIZER, equalizerPaths } from "./equalizer";
import { cleanMoments } from "./moments";
import { applyJumpList, cleanPins } from "./pins";
import { RemoteControl, type Playing } from "./remote";
import { setLanguage } from "./locale";
import { launchSpotify } from "./spotifyApp";
import { checkForUpdates, installUpdate, startUpdater, updateState } from "./updater";

const DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;
const RENDERER_DIR = path.join(__dirname, "../dist/renderer");
const APP_URL = "app://vitrine/index.html";

export interface DrmStatus {
  widevine: boolean;
  detail: string;
}

// The renderer is served from app://vitrine rather than file://: a standard, secure scheme gives it
// a real origin, which the Web Playback SDK's DRM (EME) needs.
protocol.registerSchemesAsPrivileged([
  { scheme: "app", privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } },
]);

if (!app.requestSingleInstanceLock()) app.quit();

const auth = new AuthManager();
const discord = new DiscordPresence();
let browserPlayer: BrowserPlayer | null = null;
const startHidden = process.argv.includes(HIDDEN_ARG);

function showWindow(): void {
  if (!mainWindow || mainWindow.isDestroyed()) {
    stopWithoutPage();
    mainWindow = createWindow(true);
    desktop.attach(mainWindow);
    return;
  }
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

const overlay = new LyricsOverlay(DEV_SERVER_URL ?? APP_URL, path.join(__dirname, "preload.js"), (open) => mainWindow?.webContents.send("overlay:status", open));
const desktop = new Desktop(() => mainWindow, showWindow, { lyrics: () => void overlay.toggle() });

// ── freeing the page while Vitrine is hidden ──────────────────────────────
// After a minute in the tray, the page (some 300 MB) closes, unless the music plays inside it
// (Electron's own player) or the lyrics overlay needs it. The main process keeps the tray, the
// taskbar buttons, the shortcuts and Discord going (remote.ts), and the page comes back on a click.
const FREE_AFTER_MS = 60_000;
const POLL_WITHOUT_PAGE_MS = 15_000;
let freeTimer: ReturnType<typeof setTimeout> | undefined;
let pollTimer: ReturnType<typeof setInterval> | undefined;
/** told by the page with each update; unknown until then, so nothing is freed */
let holdsAudio = true;
const remote = new RemoteControl(() => auth.accessToken(), () => browserPlayer);

function scheduleFree(): void {
  clearTimeout(freeTimer);
  if (!desktop.settings().freeWhenHidden) return;
  freeTimer = setTimeout(() => {
    const window = mainWindow;
    if (!window || window.isDestroyed() || window.isVisible() || holdsAudio || overlay.open) return;
    mainWindow = null;
    // the main process takes over first, so closing the last window does not quit the app
    startWithoutPage();
    window.destroy();
  }, FREE_AFTER_MS);
}

function tell(playing: Playing | null): void {
  desktop.update(playing ? { title: playing.title, artist: playing.artist, imageUrl: playing.imageUrl, paused: playing.paused } : null);
  discord.update(playing ? { ...playing } : null);
}

function startWithoutPage(): void {
  const refresh = () => void remote.nowPlaying().then(tell, () => undefined);
  refresh();
  pollTimer = setInterval(refresh, POLL_WITHOUT_PAGE_MS);
  if (browserPlayer) browserPlayer.onState = () => refresh();
  desktop.withoutPage = (command) => {
    if (command === "flow" || command.startsWith("play:")) {
      showWindow();
      mainWindow?.webContents.once("did-finish-load", () => setTimeout(() => desktop.command(command), 1500));
      return;
    }
    void remote.run(command).then(() => setTimeout(refresh, 800), () => undefined);
  };
}

function stopWithoutPage(): void {
  clearInterval(pollTimer);
  pollTimer = undefined;
  if (browserPlayer) browserPlayer.onState = null;
  desktop.withoutPage = null;
  holdsAudio = true;
}
let mainWindow: BrowserWindow | null = null;
let drm: DrmStatus = { widevine: false, detail: "Vérification de Widevine…" };

// Widevine only exists in castlabs' Electron build (Electron for Content Security), which exposes
// `components`. A stock Electron runs too, just without playback on this computer.
async function prepareWidevine(): Promise<DrmStatus> {
  const components = (electron as unknown as { components?: { whenReady(): Promise<unknown> } }).components;
  if (!components) {
    return { widevine: false, detail: "Cette version d'Electron n'embarque pas Widevine : mode télécommande uniquement." };
  }
  try {
    await components.whenReady();
    return { widevine: true, detail: "Widevine prêt" };
  } catch (error) {
    return { widevine: false, detail: `Widevine indisponible : ${error instanceof Error ? error.message : String(error)}` };
  }
}

function serveRenderer(): void {
  protocol.handle("app", (request) => {
    const { pathname } = new URL(request.url);
    const relative = path.normalize(decodeURIComponent(pathname)).replace(/^[/\\]+/, "") || "index.html";
    const file = path.join(RENDERER_DIR, relative);
    if (!file.startsWith(RENDERER_DIR + path.sep)) return new Response("Not found", { status: 404 });
    return net.fetch(pathToFileURL(file).toString());
  });
}

function isAppUrl(url: string): boolean {
  return DEV_SERVER_URL ? url.startsWith(DEV_SERVER_URL) : url.startsWith("app://vitrine/");
}

function createWindow(visible = !startHidden): BrowserWindow {
  const isMac = process.platform === "darwin";
  const window = new BrowserWindow({
    width: 1360,
    height: 880,
    minWidth: FULL_MIN.width,
    minHeight: FULL_MIN.height,
    show: false,
    title: "Vitrine",
    backgroundColor: "#000000",
    titleBarStyle: "hidden",
    ...(isMac
      ? { trafficLightPosition: { x: 18, y: 22 } }
      : { titleBarOverlay: { color: "#00000000", symbolColor: "#ffffff", height: 64 } }),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      spellcheck: false,
      // the Web Playback SDK starts audio from code, not always from a click
      autoplayPolicy: "no-user-gesture-required",
    },
  });

  // started with the session: the window loads (playback, Discord…) but stays in the tray
  window.once("ready-to-show", () => visible && window.show());
  window.on("hide", scheduleFree);
  window.on("show", () => clearTimeout(freeTimer));
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https://")) void shell.openExternal(url);
    return { action: "deny" };
  });
  window.webContents.on("will-navigate", (event, url) => {
    if (!isAppUrl(url)) {
      event.preventDefault();
      if (url.startsWith("https://")) void shell.openExternal(url);
    }
  });

  void window.loadURL(DEV_SERVER_URL ?? APP_URL);
  return window;
}

/** Only the app's own page may call into the main process. */
function trusted(event: IpcMainInvokeEvent): boolean {
  const url = event.senderFrame?.url ?? "";
  return isAppUrl(url);
}

function handle(channel: string, listener: (...args: unknown[]) => unknown): void {
  ipcMain.handle(channel, (event, ...args) => {
    if (!trusted(event)) throw new Error("Origine non autorisée");
    return listener(...args);
  });
}

function registerIpc(): void {
  handle("eq:get", () => applyEqualizer(cleanEqualizer(readConfig().equalizer ?? DEFAULT_EQUALIZER)));
  handle("eq:set", (value) => {
    const settings = cleanEqualizer(value);
    updateConfig({ equalizer: settings });
    return applyEqualizer(settings);
  });
  handle("eq:open", async () => {
    // Equalizer APO's editor when it is installed, its download page otherwise
    const { editor } = equalizerPaths();
    if (process.platform === "win32" && fs.existsSync(editor)) return void (await shell.openPath(editor));
    await shell.openExternal("https://sourceforge.net/projects/equalizerapo/");
  });
  handle("moments:get", () => readConfig().moments ?? []);
  handle("moments:set", (value) => {
    const moments = cleanMoments(value);
    updateConfig({ moments });
    return moments;
  });
  handle("pins:get", () => readConfig().pins ?? []);
  handle("pins:set", (value) => {
    const pins = cleanPins(value);
    updateConfig({ pins });
    applyJumpList(pins);
    desktop.setPins(pins);
    return pins;
  });
  handle("auth:status", () => auth.status());
  handle("auth:login", (clientId) => auth.login(typeof clientId === "string" ? clientId : ""));
  handle("auth:logout", () => {
    browserPlayer?.stop();
    return auth.logout();
  });
  handle("auth:token", (force) => auth.accessToken(force === true));
  handle("drm:status", () => drm);
  handle("lyrics:get", (query) => fetchLyrics(query));
  handle("lyrics:clear", () => clearLyricsCache());
  handle("lyrics:translate", (query) => translateLyrics(query));
  handle("credits:get", (isrc) => fetchCredits(isrc));
  handle("lastfm:status", () => lastfmStatus());
  handle("lastfm:keys", (keys) => setLastfmKeys(keys));
  handle("lastfm:connect", () => connectLastfm());
  handle("lastfm:disconnect", () => disconnectLastfm());
  handle("lastfm:now", (track) => lastfmNowPlaying(track));
  handle("lastfm:scrobble", (listen) => scrobble(listen));
  handle("translation:get", () => translationSettings());
  handle("translation:set", (settings) => setTranslationSettings(settings));
  handle("shell:open", (url) => {
    // web pages, and the Spotify app on a track, album, artist or playlist
    if (typeof url === "string" && (url.startsWith("https://") || /^spotify:(track|album|artist|playlist):[A-Za-z0-9]{1,40}$/.test(url))) return shell.openExternal(url);
  });
  handle("overlay:toggle", () => overlay.toggle());
  handle("overlay:status", () => overlay.open);
  handle("overlay:line", (raw) => {
    const line = parseOverlayLine(raw);
    if (line) overlay.send(line);
  });
  handle("clipboard:write", (text) => {
    if (typeof text === "string") clipboard.writeText(text.slice(0, 2000));
  });
  handle("window:mini", (on) => setMini(on === true));
  handle("spotify:launch", () => launchSpotify());
  handle("browser-player:status", () => browserPlayer?.status);
  handle("browser-player:start", () => browserPlayer?.start());
  handle("browser-player:stop", () => browserPlayer?.stop());
  handle("browser-player:command", (raw) => {
    const command = parseCommand(raw);
    if (command) browserPlayer?.command(command);
  });
  handle("desktop:get", () => desktop.settings());
  handle("desktop:set", (raw) => {
    const input = (raw ?? {}) as Record<string, unknown>;
    return desktop.setSettings({
      closeToTray: input.closeToTray === true,
      notifications: input.notifications === true,
      openAtLogin: input.openAtLogin === true,
      globalShortcuts: input.globalShortcuts === true,
      freeWhenHidden: input.freeWhenHidden === true,
      recaps: input.recaps !== false,
    });
  });
  handle("desktop:update", (raw) => {
    holdsAudio = (raw as { holdsAudio?: unknown } | null)?.holdsAudio === true;
    desktop.update(desktopNowPlaying(raw));
  });
  handle("history:add", (play) => {
    addPlay(play);
    // a milestone crossed by this play (the 100th of a track, 1 000 minutes…)
    const at = (play as { at?: unknown } | null)?.at;
    const crossed = typeof at === "string" ? newMilestones(at) : [];
    if (crossed.length) desktop.announce("Étape franchie", crossed[crossed.length - 1].text);
  });
  handle("history:insight", (kind) => historyInsight(kind));
  handle("history:extend", (at, playedMs) => extendPlay(at, playedMs));
  handle("history:summary", (query) => historySummary(query));
  handle("history:info", () => historyInfo());
  handle("history:sync", () => syncAccount(() => auth.accessToken()));
  handle("history:import", () => importHistory(mainWindow));
  handle("history:clear", () => clearHistory());
  handle("history:export", () => exportHistory(mainWindow));
  handle("history:enabled", () => historyEnabled());
  handle("history:set-enabled", (on) => setHistoryEnabled(on === true));
  handle("app:info", () => ({ version: app.getVersion(), platform: process.platform, packaged: app.isPackaged }));
  handle("app:language", (raw) => {
    setLanguage(raw);
    desktop.relabel();
    applyJumpList(readConfig().pins ?? []);
  });

  handle("discord:get", () => discordInfo());
  handle("discord:set", (raw) => {
    const input = (raw ?? {}) as { enabled?: unknown; appId?: unknown };
    const settings = { enabled: input.enabled === true, appId: typeof input.appId === "string" ? input.appId.trim().slice(0, 32) : "" };
    updateConfig({ discord: settings });
    discord.configure(settings.enabled, settings.appId);
    return discordInfo();
  });
  handle("discord:update", (raw) => discord.update(nowPlaying(raw)));

  handle("update:get", () => updateState());
  handle("update:check", () => checkForUpdates());
  handle("update:install", () => installUpdate());
}

function discordInfo() {
  const settings = readConfig().discord ?? { enabled: false, appId: "" };
  return { ...settings, state: discord.state, detail: discord.detail };
}

function desktopNowPlaying(raw: unknown): DesktopNowPlaying | null {
  if (!raw || typeof raw !== "object") return null;
  const input = raw as Record<string, unknown>;
  const text = (value: unknown) => (typeof value === "string" ? value.slice(0, 200) : "");
  if (!text(input.title)) return null;
  return { title: text(input.title), artist: text(input.artist), imageUrl: text(input.imageUrl) || undefined, paused: input.paused === true, holdsAudio: input.holdsAudio === true };
}

/** What the page says is playing, checked field by field before it reaches Discord. */
function nowPlaying(raw: unknown): NowPlaying | null {
  if (!raw || typeof raw !== "object") return null;
  const input = raw as Record<string, unknown>;
  const text = (value: unknown) => (typeof value === "string" ? value.slice(0, 200) : "");
  const number = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? Math.max(0, value) : 0);
  if (!text(input.title)) return null;
  return {
    title: text(input.title),
    artist: text(input.artist),
    album: text(input.album) || undefined,
    imageUrl: text(input.imageUrl) || undefined,
    durationMs: number(input.durationMs),
    positionMs: number(input.positionMs),
    paused: input.paused === true,
  };
}

const MINI = { width: 340, height: 440 };
const FULL_MIN = { width: 1000, height: 660 };
let boundsBeforeMini: Rectangle | null = null;

/** The mini player: the same window, small and kept above the others, in a screen corner. */
function setMini(on: boolean): boolean {
  const window = mainWindow;
  if (!window || on === (boundsBeforeMini !== null)) return on;
  if (on) {
    boundsBeforeMini = window.getBounds();
    if (window.isMaximized()) window.unmaximize();
    const area = screen.getDisplayMatching(boundsBeforeMini).workArea;
    window.setMinimumSize(280, 360);
    window.setBounds({ x: area.x + area.width - MINI.width - 24, y: area.y + area.height - MINI.height - 24, ...MINI }, true);
    window.setAlwaysOnTop(true, "floating");
  } else {
    window.setAlwaysOnTop(false);
    window.setMinimumSize(FULL_MIN.width, FULL_MIN.height);
    window.setBounds(boundsBeforeMini ?? { ...window.getBounds(), width: 1360, height: 880 }, true);
    boundsBeforeMini = null;
  }
  return on;
}

// started again: a command (vitrine --next, --flow…) goes to this Vitrine, a plain start shows it
app.on("second-instance", (_event, argv) => {
  const command = cliCommand(argv);
  if (command) desktop.command(command);
  else showWindow();
});

app.on("before-quit", () => {
  browserPlayer?.stop();
  overlay.close();
});

app.on("window-all-closed", () => {
  // a page freed in the tray is no reason to quit: the tray, the music and the shortcuts carry on
  if (pollTimer !== undefined) return;
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (app.isReady()) showWindow();
});

/**
 * Spotify says how long to wait after too many requests (Retry-After) but does not let pages read
 * that header: the page would retry blind, and keep Spotify's pause going. Expose it.
 */
function exposeRetryAfter(): void {
  electron.session.defaultSession.webRequest.onHeadersReceived({ urls: ["https://api.spotify.com/*"] }, (details, callback) => {
    const headers = { ...details.responseHeaders };
    const key = Object.keys(headers).find((name) => name.toLowerCase() === "access-control-expose-headers");
    headers[key ?? "Access-Control-Expose-Headers"] = [[...(key ? headers[key] : []), "Retry-After"].join(", ")];
    callback({ responseHeaders: headers });
  });
}

void app.whenReady().then(async () => {
  registerIpc();
  if (!DEV_SERVER_URL) serveRenderer();
  exposeRetryAfter();
  // test machines without a keychain: keep the session with Chromium's fixed key (Linux, opt-in only)
  if (process.platform === "linux" && process.env.VITRINE_DEV_PLAINTEXT_SESSION === "1") {
    (electron.safeStorage as unknown as { setUsePlainTextEncryption?: (on: boolean) => void }).setUsePlainTextEncryption?.(true);
  }
  [drm] = await Promise.all([prepareWidevine(), auth.load()]);
  browserPlayer = new BrowserPlayer(() => auth.accessToken(), path.join(app.getPath("userData"), "browser-player"), () => mainWindow);
  mainWindow = createWindow();
  desktop.start();
  desktop.attach(mainWindow);
  const pins = readConfig().pins ?? [];
  desktop.setPins(pins);
  applyJumpList(pins);
  // a first start with a command runs it once the page is there
  const command = cliCommand(process.argv);
  if (command) mainWindow.webContents.once("did-finish-load", () => setTimeout(() => desktop.command(command), 1500));
  const settings = readConfig().discord;
  if (settings) discord.configure(settings.enabled, settings.appId);
  startUpdater(() => mainWindow);
  startAccountSync(() => auth.accessToken(), () => auth.status().then((status) => status.loggedIn));
  // Monday's recap of the week before (Airbuds), checked now and every few hours
  const tellWeek = () => {
    if (!desktop.settings().recaps) return;
    const recap = weekToTell();
    if (recap) {
      const parts = [`${formatListening(recap.ms)} d'écoute`, recap.topArtist && `artiste n° 1 : ${recap.topArtist}`, recap.topTrack && `titre n° 1 : ${recap.topTrack}`];
      desktop.announce("Votre semaine en musique", parts.filter(Boolean).join(" · "));
    }
  };
  setTimeout(tellWeek, 60_000);
  setInterval(tellWeek, 6 * 3_600_000);
});
