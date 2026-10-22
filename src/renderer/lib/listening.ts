// What the listening history says: time spent, favourites, when in the week and in the year. Pure,
// so the main process sums up a history of years without sending it all to the page.
import type { HistoryPlay } from "../global";

export interface Ranked {
  key: string;
  name: string;
  detail: string;
  id?: string;
  image?: string;
  uri?: string;
  plays: number;
  ms: number;
}

export interface ListeningSummary {
  totalMs: number;
  plays: number;
  distinctTracks: number;
  /** days with at least one play, then the run of such days ending today or yesterday */
  activeDays: number;
  streak: number;
  topTracks: Ranked[];
  topArtists: Ranked[];
  /** listening time by weekday (Monday first) and hour, local time */
  heatmap: number[][];
  /** listening time of each of the last 53 weeks' days, oldest first ("2026-10-22") */
  calendar: { day: string; ms: number }[];
  recent: HistoryPlay[];
}

export interface HistoryInfo {
  plays: number;
  bySource: Record<"vitrine" | "spotify" | "import", number>;
  first?: string;
  /** when "recently played" was last read, epoch ms */
  lastSync?: number;
}

const DAY_MS = 86_400_000;

/** "2026-10-22" in local time. */
export function dayKey(time: number): string {
  const date = new Date(time);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function rank(entries: Map<string, Ranked>, limit: number): Ranked[] {
  return [...entries.values()].sort((a, b) => b.ms - a.ms || b.plays - a.plays).slice(0, limit);
}

/** The plays since `since` (epoch ms; 0 for all of them), summed up. */
export function summarize(all: HistoryPlay[], since: number, now = Date.now()): ListeningSummary {
  const plays = all.filter((play) => {
    const time = Date.parse(play.at);
    return time >= since && time <= now + DAY_MS;
  });
  const tracks = new Map<string, Ranked>();
  const artists = new Map<string, Ranked>();
  const heatmap = Array.from({ length: 7 }, () => Array<number>(24).fill(0));
  const days = new Set<string>();
  let totalMs = 0;

  for (const play of plays) {
    const time = Date.parse(play.at);
    const ms = Math.max(0, play.playedMs);
    totalMs += ms;
    days.add(dayKey(time));
    const date = new Date(time);
    heatmap[(date.getDay() + 6) % 7][date.getHours()] += ms;

    const track = tracks.get(play.uri) ?? { key: play.uri, name: play.name, detail: play.artists.join(", "), id: play.id, image: play.image, uri: play.uri, plays: 0, ms: 0 };
    // an imported play has no artwork: one heard through Spotify gives it
    track.image ??= play.image;
    track.plays += 1;
    track.ms += ms;
    tracks.set(play.uri, track);

    // a featuring counts for every artist on the track
    play.artists.forEach((name, index) => {
      const id = play.artistIds[index];
      const key = id || name.toLowerCase();
      const artist = artists.get(key) ?? { key, name, detail: "", id, plays: 0, ms: 0 };
      artist.plays += 1;
      artist.ms += ms;
      artists.set(key, artist);
    });
  }

  let streak = 0;
  const today = dayKey(now);
  let cursor = days.has(today) ? now : now - DAY_MS;
  while (days.has(dayKey(cursor))) {
    streak += 1;
    cursor -= DAY_MS;
  }

  for (const artist of artists.values()) artist.detail = `${artist.plays} écoute${artist.plays > 1 ? "s" : ""}`;
  // the calendar always shows the year: 53 weeks back to a Monday, up to today, whatever the period
  const startDate = new Date(now - 52 * 7 * DAY_MS);
  startDate.setDate(startDate.getDate() - ((startDate.getDay() + 6) % 7));
  startDate.setHours(0, 0, 0, 0);
  const byDay = new Map<string, number>();
  for (const play of all) {
    const time = Date.parse(play.at);
    if (time < startDate.getTime()) continue;
    const key = dayKey(time);
    byDay.set(key, (byDay.get(key) ?? 0) + Math.max(0, play.playedMs));
  }
  const calendar: { day: string; ms: number }[] = [];
  for (let cursorDay = new Date(startDate); dayKey(cursorDay.getTime()) <= today; cursorDay.setDate(cursorDay.getDate() + 1)) {
    const key = dayKey(cursorDay.getTime());
    calendar.push({ day: key, ms: byDay.get(key) ?? 0 });
  }
  return {
    totalMs,
    plays: plays.length,
    distinctTracks: tracks.size,
    activeDays: days.size,
    streak,
    topTracks: rank(tracks, 5),
    topArtists: rank(artists, 5),
    heatmap,
    calendar,
    recent: [...plays].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 8),
  };
}

/** "3 h 25", "42 min", "50 s". */
export function formatListening(ms: number): string {
  const minutes = Math.floor(ms / 60_000);
  if (minutes >= 60) return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, "0")}`;
  if (minutes >= 1) return `${minutes} min`;
  return `${Math.round(ms / 1000)} s`;
}
