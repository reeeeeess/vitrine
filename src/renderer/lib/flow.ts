// Flow: one track at a time, full height, scrolled like TikTok. The feed mixes what the person has
// not liked yet (the new releases of their favourite artists, tracks around those artists) with
// Liked Songs they may have forgotten. Spotify closed its recommendations, related artists and
// artists' top tracks to apps in development mode: everything here comes from endpoints still open.
import { rankByTaste, readTaste, seedArtists } from "./flowTaste";
import * as api from "./spotify";
import { trash, trashed } from "./trash";
import { songKey, type Artist, type Track } from "./types";

export { songKey };

export type FlowSource = "new" | "around" | "forgotten";

export interface FlowItem {
  track: Track;
  source: FlowSource;
  /** why it is in the feed, shown on the card: "Nouveauté · Josman" */
  reason: string;
  saved: boolean;
}

/** Where a track starts: around its first chorus, guessed at a third in, never in the last 30 s. */
export function hookPosition(durationMs: number): number {
  if (durationMs < 90_000) return 0;
  const guess = Math.max(30_000, durationMs * 0.3);
  return Math.round(Math.min(guess, durationMs - 30_000) / 1000) * 1000;
}

/** Takes one item from each list in turn, leaving out songs already met or set aside. */
export function interleave(lists: FlowItem[][], skip: ReadonlySet<string> = new Set()): FlowItem[] {
  const seen = new Set(skip);
  const queues = lists.map((list) => [...list]);
  const out: FlowItem[] = [];
  while (queues.some((queue) => queue.length > 0)) {
    for (const queue of queues) {
      while (queue.length > 0) {
        const item = queue.shift()!;
        const key = songKey(item.track);
        if (seen.has(item.track.id) || seen.has(key)) continue;
        seen.add(item.track.id);
        seen.add(key);
        out.push(item);
        break;
      }
    }
  }
  return out;
}

/** Released at most `days` days before `now`; a bare year or month counts from its first day. */
export function isRecent(releaseDate: string | undefined, now: number, days = 120): boolean {
  if (!releaseDate) return false;
  const full = releaseDate.length === 4 ? `${releaseDate}-01-01` : releaseDate.length === 7 ? `${releaseDate}-01` : releaseDate;
  const time = Date.parse(full);
  return Number.isFinite(time) && time <= now + 86_400_000 && now - time <= days * 86_400_000;
}

export function shuffle<T>(list: readonly T[], random = Math.random): T[] {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/** Puts the tracks the person has not met in Flow before first, keeping the order otherwise. */
export function unseenFirst(items: FlowItem[], seen: ReadonlySet<string>): FlowItem[] {
  return [...items.filter((item) => !seen.has(item.track.id)), ...items.filter((item) => seen.has(item.track.id))];
}

// ── what the person set aside, and what they already saw (this computer only) ──

const HIDDEN_KEY = "vitrine.flow.hidden";
const SEEN_KEY = "vitrine.flow.seen";

function readList(key: string): string[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(key) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === "string") : [];
  } catch {
    return [];
  }
}

function addToList(key: string, values: string[], max: number): void {
  try {
    const next = [...readList(key).filter((value) => !values.includes(value)), ...values].slice(-max);
    localStorage.setItem(key, JSON.stringify(next));
  } catch {
    // remembered for this session only
  }
}

/** "Pas pour moi": the song never comes back to the feed. */
export function hide(track: Track): void {
  addToList(HIDDEN_KEY, [track.id, songKey(track)], 2000);
}

export function markSeen(track: Track): void {
  addToList(SEEN_KEY, [track.id], 3000);
}

export const hiddenSongs = () => new Set(readList(HIDDEN_KEY));
export const seenTracks = () => new Set(readList(SEEN_KEY));

// ── loading the feed ──────────────────────────────────────────────────────

let favourites: Promise<Artist[]> | null = null;

/** The artists the person listens to most lately, then over the last months. */
function favouriteArtists(): Promise<Artist[]> {
  favourites ??= Promise.allSettled([api.topArtists("short_term", 20), api.topArtists("medium_term", 20)]).then((pages) => {
    const all = pages.flatMap((page) => (page.status === "fulfilled" ? page.value : []));
    return all.filter((artist, index) => all.findIndex((other) => other.id === artist.id) === index);
  });
  return favourites;
}

/** `count` artists, moving along the list with each round. */
export function rotate<T>(list: readonly T[], round: number, count: number): T[] {
  if (list.length === 0) return [];
  return Array.from({ length: Math.min(count, list.length) }, (_, i) => list[(round * count + i) % list.length]);
}

async function newReleases(artists: Artist[], now: number): Promise<FlowItem[]> {
  const perArtist = await Promise.all(
    artists.map(async (artist) => {
      const releases = await api.artistReleases(artist.id).catch(() => []);
      const recent = releases.filter((release) => isRecent(release.releaseDate, now));
      // nothing new: the latest release still says where the artist is at
      const picked = recent.length > 0 ? recent.slice(0, 2) : releases.slice(0, 1);
      const reason = recent.length > 0 ? `Nouveauté · ${artist.name}` : `Dernière sortie · ${artist.name}`;
      const albums = await Promise.all(picked.map((release) => api.album(release.id).catch(() => null)));
      return albums.flatMap((album) => (album ? shuffle(album.tracks).slice(0, album.tracks.length > 3 ? 2 : 1) : [])).map((track) => ({ track, reason }));
    }),
  );
  return perArtist.flat().map(({ track, reason }) => ({ track, source: "new" as const, reason, saved: false }));
}

async function aroundArtists(artists: Artist[], round: number): Promise<FlowItem[]> {
  const pages = await Promise.all(artists.map((artist) => api.searchTracks(artist.name, (round % 3) * 10).then((tracks) => ({ artist, tracks }), () => ({ artist, tracks: [] }))));
  return shuffle(
    pages.flatMap(({ artist, tracks }) =>
      tracks.map((track) => ({
        track,
        source: "around" as const,
        reason: track.artistIds.includes(artist.id) ? `À découvrir · ${artist.name}` : `Dans l'univers de ${artist.name}`,
        saved: false,
      })),
    ),
  );
}

let likedTotal: number | null = null;

async function forgottenLiked(): Promise<FlowItem[]> {
  likedTotal ??= (await api.likedPage(0, 1)).total;
  if (likedTotal < 60) return [];
  // the older part of Liked Songs: the most recent ones are still in the person's ears
  const offset = 50 + Math.floor(Math.random() * Math.max(1, likedTotal - 100));
  const page = await api.likedPage(offset, 50);
  return shuffle(page.tracks)
    .slice(0, 4)
    .map((track) => ({ track, source: "forgotten" as const, reason: "Pépite oubliée · dans vos titres likés", saved: true }));
}

/** Which of these tracks are in Liked Songs. */
async function savedIds(ids: string[]): Promise<Set<string>> {
  const batches = Array.from({ length: Math.ceil(ids.length / 50) }, (_, i) => ids.slice(i * 50, i * 50 + 50));
  const answers = await Promise.all(batches.map((batch) => api.areSaved(batch).catch(() => batch.map(() => false))));
  return new Set(batches.flatMap((batch, i) => batch.filter((_, j) => answers[i][j])));
}

/**
 * One batch of the feed; each round moves on to other artists and further search pages. A Flow
 * started from a track (the radio Spotify no longer lets apps make) opens on it and its artists.
 */
export async function loadFlow(round: number, skip: ReadonlySet<string>, now = Date.now(), seed?: Track): Promise<FlowItem[]> {
  const fromSeed = seed ? seed.artistIds.map((id, i) => ({ id, uri: `spotify:artist:${id}`, name: seed.artists[i] ?? "", genres: [] })) : [];
  const taste = readTaste();
  // what Flow learnt weighs in: artists liked in Flow join the seeds, those set aside leave
  const favourites = seedArtists(await favouriteArtists(), taste);
  const artists = [...fromSeed, ...favourites.filter((artist) => !fromSeed.some((s) => s.id === artist.id))];
  const [fresh, around, forgotten] = await Promise.all([
    newReleases(rotate(artists, round, 3), now),
    aroundArtists(rotate(artists, round + 1, 3), round),
    forgottenLiked().catch(() => []),
  ]);
  // tracks the person already liked are no discovery
  const saved = await savedIds([...fresh, ...around].map((item) => item.track.id).concat(seed ? [seed.id] : []));
  const seen = seenTracks();
  const bin = trash.get();
  const discover = (items: FlowItem[]) => rankByTaste(unseenFirst(items.filter((item) => !saved.has(item.track.id) && !trashed(bin, item.track)), seen), taste);
  const others = discover(around);
  const start: FlowItem[] = seed && round === 0 ? [{ track: seed, source: "around", reason: `Votre point de départ · ${seed.artists[0] ?? ""}`, saved: saved.has(seed.id) }] : [];
  // around the artists is where most tracks come from: two of them for each new release
  return [...start, ...interleave([discover(fresh), others, [...others].reverse(), rankByTaste(forgotten.filter((item) => !trashed(bin, item.track)), taste)], new Set([...skip, ...hiddenSongs(), ...start.map((item) => item.track.id)]))];
}

// ── "Trouvé dans Flow": the tracks liked in Flow, gathered in a playlist ──

const COLLECT_KEY = "vitrine.flow.collect";
const PLAYLIST_KEY = "vitrine.flow.playlist";

export function collecting(): boolean {
  try {
    return localStorage.getItem(COLLECT_KEY) === "on";
  } catch {
    return false;
  }
}

export function setCollecting(on: boolean): void {
  try {
    localStorage.setItem(COLLECT_KEY, on ? "on" : "off");
  } catch {
    // for this session only
  }
}

/** Adds the track to the person's "Trouvé dans Flow" playlist, made the first time. */
export async function collect(track: Track): Promise<void> {
  let id: string | null = null;
  try {
    id = localStorage.getItem(PLAYLIST_KEY);
  } catch {
    // a new playlist then
  }
  if (id) {
    try {
      await api.addToPlaylist(id, [track.uri]);
      return;
    } catch (error) {
      // the playlist was deleted: a new one is made below
      if (!(error instanceof api.SpotifyApiError) || ![403, 404].includes(error.status)) throw error;
    }
  }
  const playlist = await api.createPlaylist("Trouvé dans Flow", "Les titres aimés dans Flow, sur Vitrine.");
  try {
    localStorage.setItem(PLAYLIST_KEY, playlist.id);
  } catch {
    // made again next session
  }
  await api.addToPlaylist(playlist.id, [track.uri]);
}
