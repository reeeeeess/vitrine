// Picks the LRCLIB record that best fits the track playing. Kept free of Electron for the tests.

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
}

/** a record further than this from the track's length is another version of the song */
const DURATION_TOLERANCE_S = 4;

export function toResult(record: LrclibRecord): LyricsResult {
  return {
    synced: record.syncedLyrics?.trim() || null,
    plain: record.plainLyrics?.trim() || null,
    instrumental: record.instrumental === true,
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
