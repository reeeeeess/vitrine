// The listening history's file, without Electron: one JSON object per line. Plays come from three
// places: this computer (written once a play counts, 30 seconds or half a shorter track, its length
// added later as a line of its own), Spotify's "recently played" for every device of the account, and
// the "extended streaming history" a person can download from Spotify. The file is only appended to.

export type PlaySource = "vitrine" | "spotify" | "import";

export interface Play {
  /** when the play started, ISO 8601: also the play's identity */
  at: string;
  id: string;
  uri: string;
  name: string;
  artists: string[];
  artistIds: string[];
  album: string;
  albumId?: string;
  image?: string;
  durationMs: number;
  playedMs: number;
  /** where the play was learnt of; none for plays written before v0.6 (this computer) */
  source?: PlaySource;
  /** the device it played on, when Spotify says ("android", "windows"…) */
  device?: string;
}

const SOURCES: PlaySource[] = ["vitrine", "spotify", "import"];

const text = (value: unknown, max = 300) => (typeof value === "string" ? value.slice(0, max) : "");
const texts = (value: unknown) => (Array.isArray(value) ? value.map((item) => text(item, 200)).filter(Boolean).slice(0, 20) : []);
const count = (value: unknown) => (typeof value === "number" && Number.isFinite(value) && value >= 0 ? Math.round(value) : 0);

/** A play as the page sent it, field by field, or null when it is not one. */
export function parsePlay(raw: unknown): Play | null {
  if (!raw || typeof raw !== "object") return null;
  const input = raw as Record<string, unknown>;
  const at = text(input.at, 40);
  if (!at || Number.isNaN(Date.parse(at)) || !text(input.uri) || !text(input.name)) return null;
  return {
    at,
    id: text(input.id, 100),
    uri: text(input.uri),
    name: text(input.name),
    artists: texts(input.artists),
    artistIds: texts(input.artistIds),
    album: text(input.album),
    albumId: text(input.albumId, 100) || undefined,
    image: text(input.image).startsWith("https://") ? text(input.image) : undefined,
    durationMs: count(input.durationMs),
    playedMs: count(input.playedMs),
    source: SOURCES.includes(input.source as PlaySource) ? (input.source as PlaySource) : undefined,
    device: text(input.device, 60) || undefined,
  };
}

/** The 300 px image of an album, or the largest. */
function albumImage(images: unknown): string | undefined {
  if (!Array.isArray(images)) return undefined;
  const list = (images as { url?: unknown; width?: unknown }[]).filter((image) => typeof image?.url === "string");
  const fitting = list.filter((image) => typeof image.width === "number" && image.width >= 300).sort((a, b) => (a.width as number) - (b.width as number));
  return text((fitting[0] ?? list[0])?.url) || undefined;
}

/**
 * Spotify's "recently played" (every device of the account, the last 50 plays). `played_at` is when
 * the play was logged, at its end: the play started a track length earlier.
 */
export function fromRecentlyPlayed(items: unknown[]): Play[] {
  const plays: Play[] = [];
  for (const raw of items) {
    const item = (raw ?? {}) as { played_at?: unknown; track?: Record<string, unknown> | null };
    const track = item.track;
    const end = Date.parse(text(item.played_at, 40));
    if (!track || Number.isNaN(end)) continue;
    const album = (track.album ?? {}) as Record<string, unknown>;
    const artists = Array.isArray(track.artists) ? (track.artists as Record<string, unknown>[]) : [];
    const durationMs = count(track.duration_ms);
    const play = parsePlay({
      at: new Date(end - durationMs).toISOString(),
      id: track.id,
      uri: track.uri,
      name: track.name,
      artists: artists.map((artist) => artist?.name),
      artistIds: artists.map((artist) => artist?.id),
      album: album.name,
      albumId: album.id,
      image: albumImage(album.images),
      durationMs,
      playedMs: durationMs,
      source: "spotify",
    });
    if (play) plays.push(play);
  }
  return plays;
}

/** Streams shorter than this are not plays, as Spotify counts them. */
const IMPORT_MIN_MS = 30_000;

/**
 * Spotify's downloadable history: the extended one (Streaming_History_Audio_*.json: ts, ms_played,
 * spotify_track_uri…) or the yearly one (StreamingHistory_music_*.json: endTime, artistName, trackName,
 * msPlayed, no links). Podcasts and streams under 30 seconds are left out.
 */
export function fromStreamingHistory(entries: unknown[]): Play[] {
  const plays: Play[] = [];
  for (const raw of entries) {
    const entry = (raw ?? {}) as Record<string, unknown>;
    const extended = "ms_played" in entry;
    const playedMs = count(extended ? entry.ms_played : entry.msPlayed);
    const name = text(extended ? entry.master_metadata_track_name : entry.trackName);
    const artist = text(extended ? entry.master_metadata_album_artist_name : entry.artistName);
    if (playedMs < IMPORT_MIN_MS || !name) continue;
    // the yearly file writes its times as "2024-03-01 18:42", in UTC
    const end = extended ? Date.parse(text(entry.ts, 40)) : Date.parse(`${text(entry.endTime, 40).replace(" ", "T")}:00Z`);
    if (Number.isNaN(end)) continue;
    const uri = extended ? text(entry.spotify_track_uri) : "";
    if (extended && !uri.startsWith("spotify:track:")) continue;
    const play = parsePlay({
      at: new Date(end - playedMs).toISOString(),
      id: uri ? uri.split(":")[2] : "",
      // no link in the yearly file: the song is known by its title and artist
      uri: uri || `vitrine:song:${encodeURIComponent(artist.toLowerCase())}:${encodeURIComponent(name.toLowerCase())}`,
      name,
      artists: artist ? [artist] : [],
      artistIds: [],
      album: extended ? entry.master_metadata_album_album_name : "",
      durationMs: 0,
      playedMs,
      source: "import",
      device: extended ? text(entry.platform, 60).split(" ")[0].toLowerCase() : undefined,
    });
    if (play) plays.push(play);
  }
  return plays;
}

/**
 * The plays of `incoming` not already known. From the same source, a known play is one that started
 * at the same second (a file imported twice, a sync seeing a play again). From another source, a
 * play of the same track that started within a track length and 5 minutes is the same play heard of
 * twice: on this computer, and through Spotify's "recently played".
 */
export function newPlays(known: Play[], incoming: Play[]): Play[] {
  const starts = new Map<string, { time: number; source: PlaySource }[]>();
  const remember = (play: Play) => {
    const list = starts.get(play.uri) ?? [];
    list.push({ time: Date.parse(play.at), source: play.source ?? "vitrine" });
    starts.set(play.uri, list);
  };
  known.forEach(remember);
  const fresh: Play[] = [];
  for (const play of incoming) {
    const time = Date.parse(play.at);
    const source = play.source ?? "vitrine";
    const window = Math.max(play.durationMs, play.playedMs) + 5 * 60_000;
    const seen = (starts.get(play.uri) ?? []).some((other) => Math.abs(other.time - time) < (other.source === source ? 2000 : window));
    if (seen) continue;
    remember(play);
    fresh.push(play);
  }
  return fresh;
}

/** The plays in the file, oldest first, each with the longest duration recorded for it. */
export function readPlays(content: string): Play[] {
  const plays = new Map<string, Play>();
  // a play of this computer gets its length later, by its start time alone
  const byStart = new Map<string, Play>();
  for (const line of content.split("\n")) {
    if (!line.trim()) continue;
    let raw: unknown;
    try {
      raw = JSON.parse(line);
    } catch {
      continue; // a line cut short by a crash
    }
    const extension = raw as { extend?: unknown; at?: unknown; playedMs?: unknown };
    if (extension?.extend === true) {
      const play = byStart.get(text(extension.at, 40));
      if (play) play.playedMs = Math.max(play.playedMs, count(extension.playedMs));
      continue;
    }
    const play = parsePlay(raw);
    if (!play) continue;
    plays.set(`${play.at}|${play.uri}`, play);
    if ((play.source ?? "vitrine") === "vitrine") byStart.set(play.at, play);
  }
  return [...plays.values()].sort((a, b) => a.at.localeCompare(b.at));
}

export const playLine = (play: Play) => `${JSON.stringify(play)}\n`;
export const extendLine = (at: string, playedMs: number) => `${JSON.stringify({ extend: true, at, playedMs: count(playedMs) })}\n`;

/** For a spreadsheet: one play per row, ";"-separated as French Excel expects, with a BOM for the accents. */
export function toCsv(plays: Play[]): string {
  const cell = (value: string | number) => {
    const raw = String(value);
    // a cell starting with = + - @ would run as a formula in a spreadsheet
    const safe = /^[=+\-@]/.test(raw) ? `'${raw}` : raw;
    return /[";\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };
  const rows = [
    ["date", "titre", "artistes", "album", "duree_s", "ecoute_s", "uri"],
    ...plays.map((play) => [play.at, play.name, play.artists.join(", "), play.album, Math.round(play.durationMs / 1000), Math.round(play.playedMs / 1000), play.uri]),
  ];
  return `﻿${rows.map((row) => row.map(cell).join(";")).join("\r\n")}\r\n`;
}
