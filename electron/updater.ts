// Automatic updates from the GitHub releases (electron-updater). Windows only: on macOS an update
// must be code-signed by an Apple developer account, which this app does not have yet.
// A new version downloads in the background and installs when the app quits, or at once on request.
import { app, type BrowserWindow } from "electron";
import { autoUpdater } from "electron-updater";

export interface UpdateState {
  status: "unsupported" | "idle" | "checking" | "downloading" | "ready" | "latest" | "error";
  version?: string;
  percent?: number;
  message?: string;
}

const CHECK_EVERY_MS = 6 * 60 * 60_000;

let state: UpdateState = { status: "idle" };
let window: () => BrowserWindow | null = () => null;

function set(next: UpdateState): void {
  state = next;
  window()?.webContents.send("update:status", state);
}

/** The installed Windows version and the Linux AppImage update themselves; elsewhere, a new download. */
export function updatesSupported(): boolean {
  return app.isPackaged && (process.platform === "win32" || (process.platform === "linux" && Boolean(process.env.APPIMAGE)));
}

export function updateState(): UpdateState {
  return updatesSupported() ? state : { status: "unsupported" };
}

export function startUpdater(getWindow: () => BrowserWindow | null): void {
  window = getWindow;
  if (!updatesSupported()) return;
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on("checking-for-update", () => set({ status: "checking" }));
  autoUpdater.on("update-available", (info) => set({ status: "downloading", version: info.version, percent: 0 }));
  autoUpdater.on("download-progress", (progress) => set({ ...state, status: "downloading", percent: Math.round(progress.percent) }));
  autoUpdater.on("update-downloaded", (info) => set({ status: "ready", version: info.version }));
  autoUpdater.on("update-not-available", () => set({ status: "latest" }));
  autoUpdater.on("error", (error) => set({ status: "error", message: error.message.split("\n")[0] }));
  // a first check once the app has settled, then a few times a day
  setTimeout(() => void checkForUpdates(), 10_000);
  setInterval(() => void checkForUpdates(), CHECK_EVERY_MS);
}

export async function checkForUpdates(): Promise<UpdateState> {
  if (!updatesSupported()) return updateState();
  if (state.status === "downloading" || state.status === "ready") return state;
  try {
    await autoUpdater.checkForUpdates();
  } catch (error) {
    set({ status: "error", message: error instanceof Error ? error.message.split("\n")[0] : String(error) });
  }
  return state;
}

export function installUpdate(): void {
  if (state.status === "ready") autoUpdater.quitAndInstall(false, true);
}
