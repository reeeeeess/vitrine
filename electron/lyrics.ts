// Lyrics from several sources (lyricsProviders.ts), fetched from the main process so the renderer needs
// no cross-origin access, and only ever from these hosts. Every source is asked at once; what each one
// had is kept on disk (userData/lyrics-cache), so a song asks once, and its lyrics stay there offline.
import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { app, net } from "electron";
import { pickBest, toResult, type LrclibRecord, type LyricsResult } from "./lyricsMatch";
import { cleanNetease, cleanPlain, parseSections, parseTtml, pickNetease, rankSources, SOURCES, ttmlText, type LyricsSource, type NeteaseSong } from "./lyricsProviders";

export interface LyricsQuery {
  track: string;
  artist: string;
  album?: string;
  durationMs?: number;
  /** the Spotify track id: AMLL's word-by-word lyrics are filed under it */
  spotifyId?: string;
  /** the source the person chose for this song */
  source?: LyricsSource;
  /** NetEase's public web search is not an official API: the person can leave it out */
  netease: boolean;
  /** several artists (a feat): Genius's headings, through lyrics.ovh, say who sings which part */
  feat: boolean;
}

const LRCLIB = "https://lrclib.net/api";
const AMLL = "https://raw.githubusercontent.com/amll-dev/amll-ttml-db/main";
const NETEASE = "https://music.163.com/api";
const LYRICS_OVH = "https://api.lyrics.ovh/v1";
const TIMEOUT_MS = 8_000;
const MEMORY_LIMIT = 200;
const DISK_LIMIT = 3000;
/** a song nobody had is asked again after a few days: lyrics get added */
const RETRY_EMPTY_MS = 3 * 86_400_000;

interface Entry {
  at: number;
  /** the sources asked so far (one that failed to answer is asked again next time) */
  searched: LyricsSource[];
  found: Partial<Record<LyricsSource, LyricsResult | null>>;
}

const memory = new Map<string, Entry>();
/** the searches under way: the lyrics card, the full screen and the overlay ask for the same song at once */
const searching = new Map<string, Promise<Entry>>();

function text(value: unknown, max = 300): string {
  return typeof value === "string" ? value.slice(0, max).trim() : "";
}

export function parseQuery(raw: unknown): LyricsQuery | null {
  const input = (raw ?? {}) as Record<string, unknown>;
  const track = text(input.track);
  const artist = text(input.artist);
  if (!track || !artist) return null;
  const durationMs = typeof input.durationMs === "number" && input.durationMs > 0 ? input.durationMs : undefined;
  const spotifyId = typeof input.spotifyId === "string" && /^[0-9A-Za-z]{22}$/.test(input.spotifyId) ? input.spotifyId : undefined;
  const source = SOURCES.includes(input.source as LyricsSource) ? (input.source as LyricsSource) : undefined;
  const artists = Array.isArray(input.artists) ? input.artists.filter((name) => typeof name === "string" && name.trim()) : [];
  return { track, artist, album: text(input.album) || undefined, durationMs, spotifyId, source, netease: input.netease !== false, feat: artists.length >= 2 };
}

const userAgent = () => `Vitrine/${app.getVersion()} (lecteur de bureau)`;

async function getJson(url: string): Promise<unknown> {
  const response = await net.fetch(url, { headers: { "user-agent": userAgent() }, signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`${new URL(url).host} ${response.status}`);
  return response.json();
}

async function getText(url: string): Promise<string | null> {
  const response = await net.fetch(url, { headers: { "user-agent": userAgent() }, signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`${new URL(url).host} ${response.status}`);
  return response.text();
}

const params = (values: Record<string, string | undefined>) => new URLSearchParams(Object.entries(values).filter((pair): pair is [string, string] => Boolean(pair[1]))).toString();

// ── the sources ──────────────────────────────────────────────────────────

async function fromLrclib(query: LyricsQuery): Promise<LyricsResult | null> {
  const exact = (await getJson(
    `${LRCLIB}/get?${params({ track_name: query.track, artist_name: query.artist, album_name: query.album, duration: query.durationMs ? String(Math.round(query.durationMs / 1000)) : undefined })}`,
  ).catch(() => null)) as LrclibRecord | null;
  if (exact && (exact.syncedLyrics || exact.plainLyrics || exact.instrumental)) return toResult(exact);
  const found = await getJson(`${LRCLIB}/search?${params({ track_name: query.track, artist_name: query.artist })}`);
  const best = Array.isArray(found) ? pickBest(found as LrclibRecord[], query.durationMs) : null;
  return best ? toResult(best) : null;
}

async function fromAmll(folder: "spotify-lyrics" | "ncm-lyrics", id: string): Promise<LyricsResult | null> {
  const xml = await getText(`${AMLL}/${folder}/${encodeURIComponent(id)}.ttml`);
  const lines = xml ? parseTtml(xml) : [];
  return lines.length ? { synced: null, plain: ttmlText(lines), instrumental: false, lines } : null;
}

/** NetEase's synced lyrics, and its song id (AMLL files most of its lyrics under it). */
async function fromNetease(query: LyricsQuery): Promise<{ result: LyricsResult | null; id?: number }> {
  const found = (await getJson(`${NETEASE}/cloudsearch/pc?${params({ s: `${query.track} ${query.artist}`, type: "1", limit: "10" })}`)) as { result?: { songs?: NeteaseSong[] } } | null;
  const song = pickNetease(found?.result?.songs ?? [], query);
  if (!song) return { result: null };
  const lyric = (await getJson(`${NETEASE}/song/lyric?id=${song.id}&lv=1&tv=-1`)) as { lrc?: { lyric?: string } } | null;
  return { result: lyric?.lrc?.lyric ? cleanNetease(lyric.lrc.lyric) : null, id: song.id };
}

async function fromLyricsOvh(query: LyricsQuery): Promise<LyricsResult | null> {
  const found = (await getJson(`${LYRICS_OVH}/${encodeURIComponent(query.artist)}/${encodeURIComponent(query.track)}`).catch(() => null)) as { lyrics?: string } | null;
  const plain = found?.lyrics ? cleanPlain(found.lyrics) : null;
  // kept even when empty: it tells the song was asked for its headings
  return plain ? { synced: null, plain, instrumental: false, sections: parseSections(found!.lyrics!) } : null;
}

/**
 * Asks the sources not asked yet, all at once. lyrics.ovh comes in at once for a feat (Genius's headings say
 * who sings what), otherwise only when nobody else has the words.
 */
async function search(query: LyricsQuery, entry: Entry): Promise<boolean> {
  const wanted = (source: LyricsSource) => !entry.searched.includes(source) && (source !== "netease" || query.netease);
  const done = (source: LyricsSource, result: LyricsResult | null) => {
    entry.found[source] = result;
    if (!entry.searched.includes(source)) entry.searched.push(source);
  };
  const tasks: Promise<void>[] = [];
  if (wanted("lrclib")) tasks.push(fromLrclib(query).then((result) => done("lrclib", result), () => undefined));
  if (wanted("amll") && query.spotifyId) tasks.push(fromAmll("spotify-lyrics", query.spotifyId).then((result) => done("amll", result), () => undefined));
  if (wanted("netease")) {
    tasks.push(
      fromNetease(query).then(
        async ({ result, id }) => {
          done("netease", result);
          // AMLL by NetEase id, when AMLL had nothing under the Spotify id
          if (id && !entry.found.amll) {
            const amll = await fromAmll("ncm-lyrics", String(id)).catch(() => null);
            if (amll) done("amll", amll);
          }
        },
        () => undefined,
      ),
    );
  }
  const ovh = () => fromLyricsOvh(query).then((result) => done("lyricsovh", result), () => undefined);
  if (query.feat && wanted("lyricsovh")) tasks.push(ovh());
  if (tasks.length === 0) return false;
  await Promise.all(tasks);
  const words = (["amll", "lrclib", "netease"] as const).some((source) => entry.found[source]?.synced || entry.found[source]?.plain || entry.found[source]?.lines);
  if (!words && wanted("lyricsovh")) await ovh();
  entry.at = Date.now();
  return true;
}

// ── the cache ────────────────────────────────────────────────────────────

const cacheDir = () => path.join(app.getPath("userData"), "lyrics-cache");
const keyOf = (query: LyricsQuery) =>
  query.spotifyId ?? createHash("sha1").update(`${query.artist}|${query.track}|${query.album ?? ""}|${Math.round((query.durationMs ?? 0) / 1000)}`.toLowerCase()).digest("hex");

async function load(key: string): Promise<Entry> {
  const known = memory.get(key);
  if (known) return known;
  const saved = await fs
    .readFile(path.join(cacheDir(), `${key}.json`), "utf8")
    .then((raw) => JSON.parse(raw) as Entry)
    .catch(() => null);
  const entry = saved && Array.isArray(saved.searched) && saved.found && typeof saved.at === "number" ? saved : { at: 0, searched: [], found: {} };
  // kept before v0.8.2, without the headings: lyrics.ovh is asked again when a feat needs them
  if (entry.found.lyricsovh && !("sections" in entry.found.lyricsovh)) entry.searched = entry.searched.filter((source) => source !== "lyricsovh");
  // nobody had it: ask again after a while
  if (rankSources(entry.found).length === 0 && Date.now() - entry.at > RETRY_EMPTY_MS) entry.searched = [];
  remember(key, entry);
  return entry;
}

function remember(key: string, entry: Entry): void {
  memory.delete(key);
  memory.set(key, entry);
  if (memory.size > MEMORY_LIMIT) memory.delete(memory.keys().next().value as string);
}

let pruned = false;
async function save(key: string, entry: Entry): Promise<void> {
  try {
    await fs.mkdir(cacheDir(), { recursive: true });
    await fs.writeFile(path.join(cacheDir(), `${key}.json`), JSON.stringify(entry));
    if (!pruned) {
      pruned = true;
      // once per run: the oldest go when there are too many
      const names = await fs.readdir(cacheDir());
      if (names.length > DISK_LIMIT) {
        const dated = await Promise.all(names.map(async (name) => ({ name, at: (await fs.stat(path.join(cacheDir(), name)).catch(() => null))?.mtimeMs ?? 0 })));
        for (const { name } of dated.sort((a, b) => a.at - b.at).slice(0, names.length - DISK_LIMIT + 500)) await fs.rm(path.join(cacheDir(), name), { force: true });
      }
    }
  } catch {
    // a cache that cannot be written only means asking again next time
  }
}

/** The best lyrics for a song, or the ones from the source chosen, with the list of every source that has it. */
export async function fetchLyrics(raw: unknown): Promise<LyricsResult | null> {
  const query = parseQuery(raw);
  if (!query) return null;
  const key = keyOf(query);
  let pending = searching.get(key);
  if (!pending) {
    pending = (async () => {
      const entry = await load(key);
      if (await search(query, entry)) await save(key, entry);
      return entry;
    })().finally(() => searching.delete(key));
    searching.set(key, pending);
  }
  const entry = await pending;
  const allowed = SOURCES.filter((source) => source !== "netease" || query.netease);
  const sources = rankSources(entry.found, allowed);
  if (sources.length === 0) return null;
  const chosen = sources.find((entry) => entry.source === query.source) ?? sources[0];
  // who sings what, from whichever source has the headings
  const sections = SOURCES.map((source) => entry.found[source]?.sections).find((list) => list && list.length >= 2);
  return { ...(entry.found[chosen.source] as LyricsResult), source: chosen.source, sources, ...(sections ? { sections } : {}) };
}

/** Forgets the lyrics kept for every song (Settings). */
export async function clearLyricsCache(): Promise<void> {
  memory.clear();
  await fs.rm(cacheDir(), { recursive: true, force: true });
}
