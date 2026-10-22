// What Flow learns from each gesture, as TikTok's feed does, kept on this computer: an artist liked
// in Flow comes back more, one skipped at once or set aside comes back less, or never.
import type { Artist, Track } from "./types";

export type Signal = "like" | "unlike" | "listened" | "skipped" | "notForMe";

const WEIGHTS: Record<Signal, number> = { like: 3, unlike: -2, listened: 1, skipped: -1, notForMe: -3 };
/** an artist this low is left out of the feed */
export const BANNED_BELOW = -3;
/** an artist this high joins the seeds of the feed, even if Spotify does not count them among the person's favourites */
export const SEED_FROM = 3;
const KEY = "vitrine.flow.taste";
const MAX_ARTISTS = 500;

export interface Taste {
  artists: Record<string, { name: string; score: number }>;
}

export function learn(taste: Taste, track: Pick<Track, "artists" | "artistIds">, signal: Signal): Taste {
  const artists = { ...taste.artists };
  // the main artist carries the signal, the featured ones half of it
  track.artistIds.forEach((id, index) => {
    if (!id) return;
    const previous = artists[id] ?? { name: track.artists[index] ?? "", score: 0 };
    const change = WEIGHTS[signal] * (index === 0 ? 1 : 0.5);
    artists[id] = { name: previous.name || track.artists[index] || "", score: Math.max(-10, Math.min(20, previous.score + change)) };
  });
  // the least telling artists go first when the list is full
  const kept = Object.entries(artists).sort(([, a], [, b]) => Math.abs(b.score) - Math.abs(a.score)).slice(0, MAX_ARTISTS);
  return { artists: Object.fromEntries(kept) };
}

export const scoreOf = (taste: Taste, artistId: string | undefined) => (artistId ? (taste.artists[artistId]?.score ?? 0) : 0);

/** The person's favourites with the artists Flow taught it about woven in, the banned ones left out. */
export function seedArtists(favourites: Artist[], taste: Taste): Artist[] {
  const learnt = Object.entries(taste.artists)
    .filter(([id, entry]) => entry.score >= SEED_FROM && !favourites.some((artist) => artist.id === id))
    .sort(([, a], [, b]) => b.score - a.score)
    .map(([id, entry]) => ({ id, uri: `spotify:artist:${id}`, name: entry.name, genres: [] }));
  const kept = favourites.filter((artist) => scoreOf(taste, artist.id) > BANNED_BELOW);
  const out: Artist[] = [];
  for (let i = 0; i < Math.max(kept.length, learnt.length); i++) {
    if (kept[i]) out.push(kept[i]);
    if (learnt[i]) out.push(learnt[i]);
  }
  return out;
}

/** Leaves out tracks by banned artists and moves those by liked ones forward, keeping the order otherwise. */
export function rankByTaste<T extends { track: Pick<Track, "artistIds"> }>(items: T[], taste: Taste): T[] {
  return items
    .filter((item) => scoreOf(taste, item.track.artistIds[0]) > BANNED_BELOW)
    .map((item, index) => ({ item, index, score: scoreOf(taste, item.track.artistIds[0]) }))
    .sort((a, b) => Math.sign(b.score) - Math.sign(a.score) || a.index - b.index)
    .map(({ item }) => item);
}

export function readTaste(): Taste {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? "null") as Taste | null;
    return parsed && typeof parsed.artists === "object" ? parsed : { artists: {} };
  } catch {
    return { artists: {} };
  }
}

export function teach(track: Pick<Track, "artists" | "artistIds">, signal: Signal): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(learn(readTaste(), track, signal)));
  } catch {
    // learnt for this session only
  }
}
