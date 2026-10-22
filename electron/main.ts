import * as electron from "electron";
import { app, BrowserWindow, ipcMain, net, protocol, screen, shell, type IpcMainInvokeEvent, type Rectangle } from "electron";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { AuthManager } from "./auth";
import { fetchLyrics } from "./lyrics";

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

function createWindow(): BrowserWindow {
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

  window.once("ready-to-show", () => window.show());
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
  handle("auth:status", () => auth.status());
  handle("auth:login", (clientId) => auth.login(typeof clientId === "string" ? clientId : ""));
  handle("auth:logout", () => auth.logout());
  handle("auth:token", (force) => auth.accessToken(force === true));
  handle("drm:status", () => drm);
  handle("lyrics:get", (query) => fetchLyrics(query));
  handle("shell:open", (url) => {
    if (typeof url === "string" && url.startsWith("https://")) return shell.openExternal(url);
  });
  handle("window:mini", (on) => setMini(on === true));
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

app.on("second-instance", () => {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.focus();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0 && app.isReady()) mainWindow = createWindow();
});

void app.whenReady().then(async () => {
  registerIpc();
  if (!DEV_SERVER_URL) serveRenderer();
  [drm] = await Promise.all([prepareWidevine(), auth.load()]);
  mainWindow = createWindow();
});
