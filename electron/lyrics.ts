// Lyrics from LRCLIB (lrclib.net), a free and open lyrics database with a public API. Fetched from
// the main process so the renderer needs no cross-origin access, and only ever from that host.
import { app, net } from "electron";
import { pickBest, toResult, type LrclibRecord, type LyricsResult } from "./lyricsMatch";

export interface LyricsQuery {
  track: string;
  artist: string;
  album?: string;
  durationMs?: number;
}

const API = "https://lrclib.net/api";
const TIMEOUT_MS = 8_000;
const CACHE_LIMIT = 200;
const cache = new Map<string, LyricsResult | null>();

function text(value: unknown, max = 300): string {
  return typeof value === "string" ? value.slice(0, max).trim() : "";
}

export function parseQuery(raw: unknown): LyricsQuery | null {
  const input = (raw ?? {}) as Record<string, unknown>;
  const track = text(input.track);
  const artist = text(input.artist);
  if (!track || !artist) return null;
  const durationMs = typeof input.durationMs === "number" && input.durationMs > 0 ? input.durationMs : undefined;
  return { track, artist, album: text(input.album) || undefined, durationMs };
}

async function get(path: string, params: Record<string, string>): Promise<unknown> {
  const response = await net.fetch(`${API}${path}?${new URLSearchParams(params).toString()}`, {
    headers: { "user-agent": `Vitrine/${app.getVersion()} (lecteur de bureau)` },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`LRCLIB ${response.status}`);
  return response.json();
}

export async function fetchLyrics(raw: unknown): Promise<LyricsResult | null> {
  const query = parseQuery(raw);
  if (!query) return null;
  const key = JSON.stringify(query);
  if (cache.has(key)) return cache.get(key) ?? null;

  let result: LyricsResult | null = null;
  const exact = (await get("/get", {
    track_name: query.track,
    artist_name: query.artist,
    ...(query.album ? { album_name: query.album } : {}),
    ...(query.durationMs ? { duration: String(Math.round(query.durationMs / 1000)) } : {}),
  }).catch(() => null)) as LrclibRecord | null;
  if (exact && (exact.syncedLyrics || exact.plainLyrics || exact.instrumental)) {
    result = toResult(exact);
  } else {
    const found = await get("/search", { track_name: query.track, artist_name: query.artist });
    const best = Array.isArray(found) ? pickBest(found as LrclibRecord[], query.durationMs) : null;
    result = best ? toResult(best) : null;
  }

  if (cache.size >= CACHE_LIMIT) cache.delete(cache.keys().next().value as string);
  cache.set(key, result);
  return result;
}
