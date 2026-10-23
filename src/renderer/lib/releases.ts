// The new releases of the person's artists (I6, Apple Music's "New releases" for you): their artists of the
// moment (four weeks, then six months), the last ten releases of each, kept for 12 hours. A budget: two
// requests for the artists and one per artist, fifteen at most, a little apart, never during a pause.
import * as api from "./spotify";
import { createStore } from "./store";
import type { Artist, Collection } from "./types";

const KEY = "vitrine.releases";
const FRESH_MS = 12 * 3_600_000;
const MAX_ARTISTS = 15;
/** what counts as new: released in the last four months */
const WINDOW_DAYS = 120;
const DAY_MS = 86_400_000;

export interface Releases {
  at: number;
  list: Collection[];
}

function read(): Releases | null {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? "null") as Releases | null;
    return saved && Array.isArray(saved.list) && typeof saved.at === "number" ? saved : null;
  } catch {
    return null;
  }
}

export const releases = createStore<{ data: Releases | null; loading: boolean; error: string | null }>({ data: read(), loading: false, error: null });

/** The artists to look at: those of the four weeks first, then those of the six months, each once. */
export function pickArtists(recent: Artist[], longer: Artist[], max = MAX_ARTISTS): Artist[] {
  const seen = new Set<string>();
  const picked: Artist[] = [];
  for (let i = 0; picked.length < max && (i < recent.length || i < longer.length); i++) {
    for (const artist of [recent[i], longer[i]]) {
      if (artist && !seen.has(artist.id) && picked.length < max) {
        seen.add(artist.id);
        picked.push(artist);
      }
    }
  }
  return picked;
}

/** "2026-10-17", "2026-10" or "2026" → the day it came out (the first of the month or year when Spotify knows no more). */
export function releaseTime(date: string | undefined): number | null {
  if (!date) return null;
  const [year, month = "01", day = "01"] = date.split("-");
  const time = Date.UTC(Number(year), Number(month) - 1, Number(day));
  return Number.isFinite(time) ? time : null;
}

/** The releases of the last four months, newest first; a single and the album of the same name count once. */
export function freshReleases(collections: Collection[], now = Date.now(), days = WINDOW_DAYS): Collection[] {
  const recent = collections.filter((collection) => {
    const time = releaseTime(collection.releaseDate);
    return time !== null && time <= now + DAY_MS && now - time <= days * DAY_MS;
  });
  const sorted = recent.sort((a, b) => (releaseTime(b.releaseDate) ?? 0) - (releaseTime(a.releaseDate) ?? 0));
  const seen = new Set<string>();
  return sorted.filter((collection) => {
    const key = `${collection.artistId}|${collection.name.toLowerCase().replace(/\s*[([].*$/, "")}`;
    if (seen.has(key) || seen.has(collection.id)) return false;
    seen.add(key);
    seen.add(collection.id);
    return true;
  });
}

/** The releases in three groups: this week, this month, before. */
export function groupReleases(list: Collection[], now = Date.now()): { label: string; items: Collection[] }[] {
  const groups = [
    { label: "Cette semaine", items: [] as Collection[] },
    { label: "Ce mois-ci", items: [] as Collection[] },
    { label: "Plus tôt", items: [] as Collection[] },
  ];
  for (const collection of list) {
    const age = now - (releaseTime(collection.releaseDate) ?? 0);
    groups[age <= 7 * DAY_MS ? 0 : age <= 31 * DAY_MS ? 1 : 2].items.push(collection);
  }
  return groups.filter((group) => group.items.length);
}

/** "aujourd'hui", "il y a 3 j", "12 oct." */
export function releaseLabel(date: string | undefined, now = Date.now()): string {
  const time = releaseTime(date);
  if (time === null) return "";
  const days = Math.floor((now - time) / DAY_MS);
  if (days <= 0) return "aujourd'hui";
  if (days === 1) return "hier";
  if (days < 7) return `il y a ${days} j`;
  return new Date(time).toLocaleDateString("fr-FR", { day: "numeric", month: "short", timeZone: "UTC" });
}

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Looks again when the last look is more than 12 hours old (or when asked), and keeps the answer. */
export async function loadReleases(force = false): Promise<void> {
  const { data, loading } = releases.get();
  if (loading || (!force && data && Date.now() - data.at < FRESH_MS)) return;
  releases.set({ loading: true, error: null });
  try {
    const [recent, longer] = await Promise.all([api.topArtists("short_term", 15), api.topArtists("medium_term", 15).catch(() => [])]);
    const found: Collection[] = [];
    for (const artist of pickArtists(recent, longer)) {
      found.push(...(await api.artistReleases(artist.id).catch(() => [])));
      // a little apart: Spotify counts the requests of the last 30 s
      await pause(350);
    }
    const next = { at: Date.now(), list: freshReleases(found) };
    releases.set({ data: next, loading: false });
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      // for this run only
    }
  } catch (error) {
    releases.set({ loading: false, error: error instanceof Error ? error.message : String(error) });
  }
}
