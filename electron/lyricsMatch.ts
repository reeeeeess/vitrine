// Picks the LRCLIB record that best fits the track playing. Kept free of Electron for the tests.
import { parseSections } from "./lyricsProviders";

export interface LrclibRecord {
  trackName?: string;
  artistName?: string;
  duration?: number;
  instrumental?: boolean;
  plainLyrics?: string | null;
  syncedLyrics?: string | null;
}

export interface LyricsResult {
  synced: string | null;
  plain: string | null;
  instrumental: boolean;
  /** word by word, with the duets and backing vocals (TTML) */
  lines?: import("./lyricsProviders").TimedLine[];
  /** where these lyrics come from */
  source?: import("./lyricsProviders").LyricsSource;
  /** the song's parts with who sings them (Genius's headings), to put each artist of a feat on their side */
  sections?: import("./lyricsProviders").SungSection[];
  /** every source that has the song, best first, to pick another */
  sources?: { source: import("./lyricsProviders").LyricsSource; kind: import("./lyricsProviders").LyricsKind }[];
}

/** a record further than this from the track's length is another version of the song */
const DURATION_TOLERANCE_S = 4;

export function toResult(record: LrclibRecord): LyricsResult {
  const sections = record.plainLyrics ? parseSections(record.plainLyrics) : [];
  return {
    synced: record.syncedLyrics?.trim() || null,
    plain: record.plainLyrics?.trim() || null,
    instrumental: record.instrumental === true,
    ...(sections.length ? { sections } : {}),
  };
}

export function pickBest(records: LrclibRecord[], durationMs?: number): LrclibRecord | null {
  const durationS = durationMs ? durationMs / 1000 : undefined;
  const fits = (record: LrclibRecord) =>
    durationS === undefined || record.duration === undefined || Math.abs(record.duration - durationS) <= DURATION_TOLERANCE_S;
  const distance = (record: LrclibRecord) =>
    durationS === undefined || record.duration === undefined ? 0 : Math.abs(record.duration - durationS);
  const usable = records.filter((record) => fits(record) && (record.syncedLyrics || record.plainLyrics || record.instrumental));
  if (usable.length === 0) return null;
  // synced first, then the closest length
  return [...usable].sort((a, b) => Number(Boolean(b.syncedLyrics)) - Number(Boolean(a.syncedLyrics)) || distance(a) - distance(b))[0];
}
