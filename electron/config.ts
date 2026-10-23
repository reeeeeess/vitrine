// Settings kept in userData/config.json. Every change is merged into what is there, so one part of
// the app saving its settings never wipes another's.
import { app } from "electron";
import fs from "node:fs";
import path from "node:path";

export interface DiscordSettings {
  enabled: boolean;
  appId: string;
}

export interface DesktopSettings {
  closeToTray: boolean;
  notifications: boolean;
  openAtLogin: boolean;
  /** Ctrl+Alt+Space and the others, wherever the focus is */
  globalShortcuts: boolean;
  /** the page closes after a minute in the tray, when the music does not play in it */
  freeWhenHidden: boolean;
}

export interface Config {
  clientId?: string;
  discord?: DiscordSettings;
  desktop?: Partial<DesktopSettings>;
  /** `after` and `lastSync`: where the reading of Spotify's "recently played" got to, epoch ms */
  history?: { enabled: boolean; after?: number; lastSync?: number };
}

const file = () => path.join(app.getPath("userData"), "config.json");
let cache: Config | null = null;

export function readConfig(): Config {
  if (cache) return cache;
  try {
    const parsed: unknown = JSON.parse(fs.readFileSync(file(), "utf8"));
    cache = parsed && typeof parsed === "object" ? (parsed as Config) : {};
  } catch {
    cache = {};
  }
  return cache;
}

export function updateConfig(patch: Partial<Config>): Config {
  cache = { ...readConfig(), ...patch };
  fs.mkdirSync(path.dirname(file()), { recursive: true });
  fs.writeFileSync(file(), JSON.stringify(cache, null, 2));
  return cache;
}
