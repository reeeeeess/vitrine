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
  /** Monday's recap of the week and the milestones, as notifications */
  recaps: boolean;
}

/** a playlist, album or artist pinned at the top of the library (Apple Music, iOS 26) */
export interface Pin {
  uri: string;
  name: string;
  image?: string;
  kind: "playlist" | "album" | "artist";
}

export interface Config {
  clientId?: string;
  discord?: DiscordSettings;
  desktop?: Partial<DesktopSettings>;
  /** `after` and `lastSync`: where the reading of Spotify's "recently played" got to, epoch ms */
  history?: { enabled: boolean; after?: number; lastSync?: number };
  pins?: Pin[];
  /** instants of tracks with a note (Moments) */
  moments?: import("./moments").Moment[];
  /** the equalizer's bands, applied at Windows' sound output by Equalizer APO */
  equalizer?: { enabled: boolean; preset: string; gains: number[] };
  /** the milestones already said (I3), and the last week whose recap was given (T8) */
  milestones?: string[];
  weekTold?: string;
  /** Last.fm: the person's application keys, the session once authorised, listens waiting to be sent */
  lastfm?: import("./lastfm").LastfmSettings;
  /** the translation of lyrics: the service, the person's DeepL key, the language wanted */
  translation?: import("./translate").TranslationSettings;
  /** the interface's language, as chosen in Vitrine ("auto": the system's) */
  language?: "auto" | "fr" | "en";
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
