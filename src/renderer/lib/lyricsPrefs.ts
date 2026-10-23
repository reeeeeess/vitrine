// What the person chose for the lyrics of each song: the source (when the first one is wrong) and a sync
// offset; and whether NetEase, which is not an official API, may be asked. Kept in localStorage.
import type { LyricsKind, LyricsResult, LyricsSource } from "../global";
import { parseLrc, shiftLines, type LyricLine } from "./lrc";
import { createStore } from "./store";
import type { Track } from "./types";
import { LOCALE } from "./i18n";

const KEY = "vitrine.lyricsPrefs";
const NETEASE_KEY = "vitrine.lyricsNetease";
/** the songs remembered at most: the oldest choices go first */
const LIMIT = 500;
export const OFFSET_STEP_MS = 250;
const OFFSET_MAX_MS = 10_000;

export interface SongPrefs {
  source?: LyricsSource;
  offsetMs?: number;
}

export const SOURCE_NAMES: Record<LyricsSource, string> = { amll: "AMLL", lrclib: "LRCLIB", netease: "NetEase", lyricsovh: "lyrics.ovh" };
export const KIND_NAMES: Record<LyricsKind, string> = { word: "mot à mot", synced: "synchronisées", instrumental: "instrumental", plain: "texte seul" };

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // remembered for this run only
  }
}

export const lyricsPrefs = createStore<{ songs: Record<string, SongPrefs>; netease: boolean }>({ songs: read(KEY, {}), netease: read(NETEASE_KEY, true) });

export const prefsOf = (uri: string | undefined): SongPrefs => (uri ? (lyricsPrefs.get().songs[uri] ?? {}) : {});

export function setSongPrefs(uri: string, change: SongPrefs): void {
  const { [uri]: before, ...others } = lyricsPrefs.get().songs;
  const next = { ...before, ...change };
  if (next.offsetMs !== undefined) next.offsetMs = Math.max(-OFFSET_MAX_MS, Math.min(OFFSET_MAX_MS, Math.round(next.offsetMs)));
  // the song just changed goes last: the first ones are the oldest
  const kept = Object.entries(others).slice(-(LIMIT - 1));
  const songs = Object.fromEntries([...kept, ...(next.source || next.offsetMs ? [[uri, next]] : [])]) as Record<string, SongPrefs>;
  lyricsPrefs.set({ songs });
  write(KEY, songs);
}

export function setNetease(on: boolean): void {
  lyricsPrefs.set({ netease: on });
  write(NETEASE_KEY, on);
}

/** The source after this one, for "Ce ne sont pas les bonnes paroles"; null when there is no other. */
export function nextSource(sources: { source: LyricsSource }[] | undefined, current: LyricsSource | undefined): LyricsSource | null {
  if (!sources || sources.length < 2) return null;
  const index = sources.findIndex((entry) => entry.source === current);
  return sources[(index + 1) % sources.length].source;
}

/** "+0,25 s", "−1,5 s", or "" at 0 */
export function offsetLabel(offsetMs: number | undefined): string {
  if (!offsetMs) return "";
  const seconds = (Math.abs(offsetMs) / 1000).toLocaleString(LOCALE, { maximumFractionDigits: 2 });
  return `${offsetMs > 0 ? "+" : "−"}${seconds} s`;
}

/** What the main process is asked for a song: who it is, and what the person chose for it. */
export function lyricsQuery(track: Track) {
  const prefs = prefsOf(track.uri);
  return { track: track.name, artist: track.artists[0] ?? "", artists: track.artists, album: track.albumName, durationMs: track.durationMs, spotifyId: track.id, source: prefs.source, netease: lyricsPrefs.get().netease };
}

/** The timed lines of a result (word by word when the source gives them), moved by the song's offset. */
export const timedLines = (result: LyricsResult | null | undefined, offsetMs = 0): LyricLine[] =>
  shiftLines(result?.lines?.length ? result.lines : result?.synced ? parseLrc(result.synced) : [], offsetMs);
