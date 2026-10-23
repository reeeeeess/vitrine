// What the listening history tells beyond the stats page: plays per track (the "Plays" column), the most
// played albums and artists (quick access), what the person plays at this time of the week (a local
// daylist), the iceberg of their artists, the week's recap and the milestones. Pure, so the main
// process computes it all over years of plays, and the page only gets the answer.
import type { HistoryPlay } from "../global";

const DAY_MS = 86_400_000;
const time = (play: HistoryPlay) => Date.parse(play.at);

export interface TrackStat {
  plays: number;
  /** the last play, ISO */
  last: string;
}

/** Plays and last play of each track (by uri), counted when heard for 30 s or more. */
export function trackStats(plays: HistoryPlay[]): Record<string, TrackStat> {
  const stats: Record<string, TrackStat> = {};
  for (const play of plays) {
    if (play.playedMs < 30_000) continue;
    const stat = (stats[play.uri] ??= { plays: 0, last: play.at });
    stat.plays += 1;
    if (play.at > stat.last) stat.last = play.at;
  }
  return stats;
}

/** "aujourd'hui", "hier", "il y a 5 j", "il y a 3 mois", or "jamais". */
export function lastPlayedLabel(iso: string | undefined, now = Date.now()): string {
  if (!iso) return "jamais";
  const then = new Date(iso);
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const days = Math.floor((today.getTime() - new Date(then.getFullYear(), then.getMonth(), then.getDate()).getTime()) / DAY_MS);
  if (days <= 0) return "aujourd'hui";
  if (days === 1) return "hier";
  if (days < 31) return `il y a ${days} j`;
  if (days < 365) return `il y a ${Math.floor(days / 30)} mois`;
  return `il y a ${Math.floor(days / 365)} an${days >= 730 ? "s" : ""}`;
}

export interface QuickPick {
  kind: "album" | "artist";
  id: string;
  name: string;
  detail: string;
  image?: string;
  plays: number;
}

/** The albums and artists played most over the last `days` days, for the home's quick access (YouTube Music). */
export function quickPicks(plays: HistoryPlay[], days: number, now = Date.now(), limit = 8): QuickPick[] {
  const since = now - days * DAY_MS;
  const albums = new Map<string, QuickPick>();
  const artists = new Map<string, QuickPick>();
  for (const play of plays) {
    if (time(play) < since || play.playedMs < 30_000) continue;
    if (play.albumId) {
      const album = albums.get(play.albumId) ?? { kind: "album", id: play.albumId, name: play.album, detail: play.artists[0] ?? "", image: play.image, plays: 0 };
      album.image ??= play.image;
      album.plays += 1;
      albums.set(play.albumId, album);
    }
    const artistId = play.artistIds[0];
    if (artistId) {
      // the history keeps no artist photo: the artwork of their track stands in, shown round
      const artist = artists.get(artistId) ?? { kind: "artist", id: artistId, name: play.artists[0] ?? "", detail: "Artiste", image: play.image, plays: 0 };
      artist.image ??= play.image;
      artist.plays += 1;
      artists.set(artistId, artist);
    }
  }
  const byPlays = (a: QuickPick, b: QuickPick) => b.plays - a.plays;
  const topAlbums = [...albums.values()].filter((album) => album.plays >= 2).sort(byPlays);
  const topArtists = [...artists.values()].filter((artist) => artist.plays >= 3).sort(byPlays);
  // mostly albums (they have artwork), with the two or three artists played most
  const picks = [...topAlbums.slice(0, limit - Math.min(3, topArtists.length)), ...topArtists.slice(0, 3)];
  return picks.sort(byPlays).slice(0, limit);
}

const WEEKDAYS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];

/** "matin", "après-midi", "soir", "nuit" */
export function partOfDay(hour: number): string {
  if (hour >= 5 && hour < 12) return "matin";
  if (hour >= 12 && hour < 18) return "après-midi";
  if (hour >= 18 && hour < 23) return "soir";
  return "nuit";
}

export interface Moment {
  title: string;
  tracks: { uri: string; name: string; artists: string[]; image?: string }[];
}

/**
 * Spotify's daylist, made here: the tracks this person plays most on this day of the week around this
 * hour (± 2 h), then on any day around this hour; named after the moment and its artists.
 */
export function momentMix(plays: HistoryPlay[], now = Date.now(), limit = 30): Moment | null {
  const date = new Date(now);
  const weekday = date.getDay();
  const hour = date.getHours();
  const near = (play: HistoryPlay) => {
    const at = new Date(time(play));
    const gap = Math.abs(at.getHours() - hour);
    return Math.min(gap, 24 - gap) <= 2;
  };
  const score = new Map<string, { track: Moment["tracks"][number]; score: number }>();
  for (const play of plays) {
    if (play.playedMs < 30_000 || !near(play)) continue;
    const sameDay = new Date(time(play)).getDay() === weekday;
    const entry = score.get(play.uri) ?? { track: { uri: play.uri, name: play.name, artists: play.artists, image: play.image }, score: 0 };
    entry.score += sameDay ? 3 : 1;
    score.set(play.uri, entry);
  }
  const tracks = [...score.values()].sort((a, b) => b.score - a.score).slice(0, limit).map((entry) => entry.track);
  if (tracks.length < 5) return null;
  const artists = [...new Set(tracks.flatMap((track) => track.artists[0] ?? []))].slice(0, 2);
  const name = `${WEEKDAYS[weekday][0].toUpperCase()}${WEEKDAYS[weekday].slice(1)} ${partOfDay(hour)}`;
  return { title: `${name} · ${artists.join(", ")} et plus`, tracks };
}

export interface IcebergLevel {
  /** 0: above the water, 4: the very bottom */
  depth: number;
  label: string;
  artists: string[];
}

const LEVELS = ["Au-dessus de l'eau", "Juste sous la surface", "Les profondeurs", "Les abysses", "Le fond de l'océan"];

/**
 * The iceberg of the person's own artists (Icebergify, without the popularity Spotify no longer gives):
 * the ones they play most above the water, the ones they met once or twice at the bottom.
 */
export function iceberg(plays: HistoryPlay[], perLevel = 6): IcebergLevel[] | null {
  const counts = new Map<string, number>();
  for (const play of plays) {
    if (play.playedMs < 30_000) continue;
    for (const artist of play.artists) counts.set(artist, (counts.get(artist) ?? 0) + 1);
  }
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([name]) => name);
  if (ranked.length < 15) return null;
  // spread the ranking over five levels, the deepest from the very end
  const step = Math.max(perLevel, Math.floor(ranked.length / 5));
  return LEVELS.map((label, depth) => ({
    depth,
    label,
    artists: depth === 4 ? ranked.slice(-perLevel) : ranked.slice(depth * step, depth * step + perLevel),
  }));
}

export interface WeekRecap {
  /** the Monday the week began, "2026-10-12" */
  week: string;
  ms: number;
  plays: number;
  topArtist?: string;
  topTrack?: string;
}

/** Last week's listening (Monday to Sunday before `now`), for Monday's notification (Airbuds). */
export function lastWeek(plays: HistoryPlay[], now = Date.now()): WeekRecap | null {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const monday = new Date(today.getTime() - ((today.getDay() + 6) % 7) * DAY_MS);
  const start = monday.getTime() - 7 * DAY_MS;
  const end = monday.getTime();
  const week = plays.filter((play) => time(play) >= start && time(play) < end && play.playedMs >= 30_000);
  if (week.length === 0) return null;
  const artists = new Map<string, number>();
  const tracks = new Map<string, { name: string; plays: number }>();
  let ms = 0;
  for (const play of week) {
    ms += play.playedMs;
    if (play.artists[0]) artists.set(play.artists[0], (artists.get(play.artists[0]) ?? 0) + play.playedMs);
    const track = tracks.get(play.uri) ?? { name: play.name, plays: 0 };
    track.plays += 1;
    tracks.set(play.uri, track);
  }
  const start8 = new Date(start);
  return {
    week: `${start8.getFullYear()}-${String(start8.getMonth() + 1).padStart(2, "0")}-${String(start8.getDate()).padStart(2, "0")}`,
    ms,
    plays: week.length,
    topArtist: [...artists.entries()].sort((a, b) => b[1] - a[1])[0]?.[0],
    topTrack: [...tracks.values()].sort((a, b) => b.plays - a.plays)[0]?.name,
  };
}

export interface Milestone {
  key: string;
  text: string;
}

const TRACK_STEPS = [50, 100, 250, 500];
const ARTIST_STEPS = [100, 250, 500, 1000];
const MINUTE_STEPS = [1000, 5000, 10_000, 25_000, 50_000];

/**
 * The milestones crossed by the latest play (100th play of a track, 1 000 minutes in all…), each said
 * once: `told` holds the keys already said.
 */
export function milestones(plays: HistoryPlay[], latest: HistoryPlay, told: ReadonlySet<string>): Milestone[] {
  const found: Milestone[] = [];
  const counted = plays.filter((play) => play.playedMs >= 30_000);
  const trackPlays = counted.filter((play) => play.uri === latest.uri).length;
  for (const step of TRACK_STEPS) {
    const key = `track:${latest.uri}:${step}`;
    if (trackPlays >= step && !told.has(key)) found.push({ key, text: `${step}e écoute de « ${latest.name} »` });
  }
  const artist = latest.artists[0];
  if (artist) {
    const artistPlays = counted.filter((play) => play.artists[0] === artist).length;
    for (const step of ARTIST_STEPS) {
      const key = `artist:${artist}:${step}`;
      if (artistPlays >= step && !told.has(key)) found.push({ key, text: `${step} écoutes de ${artist}` });
    }
  }
  const minutes = Math.floor(counted.reduce((sum, play) => sum + play.playedMs, 0) / 60_000);
  for (const step of MINUTE_STEPS) {
    const key = `minutes:${step}`;
    if (minutes >= step && !told.has(key)) found.push({ key, text: `${new Intl.NumberFormat("fr-FR").format(step)} minutes d'écoute avec Vitrine` });
  }
  // only the biggest of each kind is worth saying when several are crossed at once (a first import)
  const latestOfKind = new Map<string, Milestone>();
  for (const milestone of found) latestOfKind.set(milestone.key.split(":").slice(0, -1).join(":"), milestone);
  return [...latestOfKind.values()];
}
