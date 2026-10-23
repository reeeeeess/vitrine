// Spotify's official Web API, with the access token the main process hands out.
import { Gate, pausedUntil, pauseUntil, ShortCache } from "./apiGate";
import { areaOf, pauseLength, pauseMessage } from "./spotifyLimit";
import { mapAlbum, mapArtist, mapPlaylist, mapTrack, pickImage, songKey, uniqueById, type Artist, type Collection, type Track } from "./types";

const BASE = "https://api.spotify.com/v1";

export class SpotifyApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

type Json = Record<string, unknown>;
type TimeRange = "short_term" | "medium_term" | "long_term";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** a pause Spotify asks for up to this long is waited out quietly; a longer one fails at once, and says why */
const QUIET_WAIT_MS = 20_000;
const TRIES_AFTER_429 = 3;
const gate = new Gate(4);
/** readings of the library, artists, albums…: not what plays, which must stay live */
const readings = new ShortCache(60_000);
let strikes = 0;

function request<T = Json>(path: string, init: RequestInit = {}): Promise<T> {
  const url = path.startsWith("https://") ? path : BASE + path;
  if ((init.method ?? "GET").toUpperCase() !== "GET") {
    // a change (a like, a playlist…) makes the readings stale
    readings.clear();
    return send<T>(url, init).finally(() => readings.clear());
  }
  if (url.startsWith(`${BASE}/me/player`)) return send<T>(url, init);
  return readings.get(url, () => send<T>(url, init)).catch((error: unknown) => {
    // Spotify makes this part wait: its last known answer is better than an empty page
    const known = readings.lastGood<T>(url);
    if (known !== undefined && error instanceof SpotifyApiError && error.status === 429) return known;
    throw error;
  });
}

async function waitOutPause(url: string): Promise<void> {
  const until = pausedUntil(url);
  if (!until) return;
  if (until - Date.now() > QUIET_WAIT_MS) throw new SpotifyApiError(429, pauseMessage(until, areaOf(url)));
  await sleep(until - Date.now());
}

async function send<T>(url: string, init: RequestInit): Promise<T> {
  let refreshed = false;
  for (let tries = 0; ; tries++) {
    await waitOutPause(url);
    const response = await gate.run(async () => {
      const token = await window.vitrine.auth.token();
      return fetch(url, {
        ...init,
        headers: {
          authorization: `Bearer ${token}`,
          ...(init.body ? { "content-type": "application/json" } : {}),
          ...init.headers,
        },
      });
    });
    if (response.status === 429) {
      const until = Date.now() + pauseLength(response.headers.get("retry-after"), strikes++);
      pauseUntil(url, until);
      if (tries < TRIES_AFTER_429) continue;
      throw new SpotifyApiError(429, pauseMessage(until, areaOf(url)));
    }
    strikes = 0;
    if (response.status === 401 && !refreshed) {
      refreshed = true;
      await window.vitrine.auth.token(true);
      continue;
    }
    return read<T>(response);
  }
}

async function read<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let message = response.statusText || `Erreur ${response.status}`;
    try {
      const body = (await response.json()) as { error?: { message?: string } };
      message = body.error?.message ?? message;
    } catch {
      // not JSON
    }
    // a session opened before the app asked for a permission does not carry it
    if (response.status === 403 && /scope/i.test(message)) {
      message = "Cette action demande une autorisation Spotify de plus : déconnectez-vous puis reconnectez-vous.";
    }
    throw new SpotifyApiError(response.status, message);
  }
  return parseBody(await response.text()) as T;
}

/**
 * A response body as JSON, or nothing. Spotify's playback commands (play, pause, next, volume…)
 * answer a success with a bare identifier in plain text, which is not JSON and carries nothing used.
 */
export function parseBody(text: string): unknown {
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/** Follows `next` links until `max` items, for the endpoints that page. */
async function collect(path: string, max: number): Promise<unknown[]> {
  const items: unknown[] = [];
  let next: string | null = path;
  while (next && items.length < max) {
    const page: { items?: unknown[]; next?: string | null } = await request(next);
    items.push(...(page.items ?? []));
    next = page.next ?? null;
  }
  return items.slice(0, max);
}

const asTracks = (items: unknown[], key?: string): Track[] =>
  uniqueById(
    items
      .map((item) => mapTrack((key ? (item as Json | null)?.[key] : item) as Json | null))
      .filter((track): track is Track => track !== null),
  );

// ── account and home ──────────────────────────────────────────────────────

export interface Profile {
  id: string;
  name: string;
  image?: string;
  product?: string;
}

let profileCache: Promise<Profile> | null = null;

/** The signed-in person; asked once, then shared by every view that needs it. */
export function me(): Promise<Profile> {
  profileCache ??= fetchProfile().catch((error: unknown) => {
    profileCache = null;
    throw error;
  });
  return profileCache;
}

async function fetchProfile(): Promise<Profile> {
  const raw = await request("/me");
  return {
    id: String(raw.id ?? ""),
    name: String(raw.display_name ?? raw.id ?? ""),
    image: pickImage(raw.images, 64),
    product: typeof raw.product === "string" ? raw.product : undefined,
  };
}

export async function recentlyPlayed(limit = 50): Promise<{ tracks: Track[]; contexts: string[] }> {
  const page = await request<{ items?: Json[] }>(`/me/player/recently-played?limit=${limit}`);
  const items = page.items ?? [];
  const contexts = uniqueById(
    items
      .map((item) => (item.context as Json | null)?.uri)
      .filter((uri): uri is string => typeof uri === "string")
      .map((uri) => ({ id: uri })),
  ).map((context) => context.id);
  return { tracks: asTracks(items, "track"), contexts };
}

export async function topTracks(range: TimeRange = "short_term", limit = 50): Promise<Track[]> {
  const page = await request<{ items?: unknown[] }>(`/me/top/tracks?time_range=${range}&limit=${limit}`);
  return asTracks(page.items ?? []);
}

export async function topArtists(range: TimeRange = "short_term", limit = 50): Promise<Artist[]> {
  const page = await request<{ items?: Json[] }>(`/me/top/artists?time_range=${range}&limit=${limit}`);
  return (page.items ?? []).map(mapArtist).filter((artist): artist is Artist => artist !== null);
}

export async function myPlaylists(max = 200): Promise<Collection[]> {
  const items = await collect("/me/playlists?limit=50", max);
  return items.map((item) => mapPlaylist(item as Json)).filter((c): c is Collection => c !== null);
}

export async function savedAlbums(max = 100): Promise<Collection[]> {
  const items = await collect("/me/albums?limit=50", max);
  return items
    .map((item) => {
      const album = mapAlbum((item as Json).album as Json);
      const addedAt = (item as Json).added_at;
      return album && typeof addedAt === "string" ? { ...album, addedAt } : album;
    })
    .filter((c): c is Collection => c !== null);
}

/** One page of Liked Songs, from `offset` (newest first), and how many there are in all. */
export async function likedPage(offset = 0, limit = 50): Promise<{ tracks: Track[]; total: number }> {
  const page = await request<{ items?: unknown[]; total?: number }>(`/me/tracks?limit=${limit}&offset=${Math.max(0, Math.floor(offset))}`);
  return { tracks: asTracks(page.items ?? [], "track"), total: typeof page.total === "number" ? page.total : 0 };
}

/** Liked Songs, newest first; `total` counts them all even when fewer were loaded. */
export async function likedTracks(max = 1000): Promise<{ tracks: Track[]; total: number }> {
  const first = await request<{ items?: unknown[]; next?: string | null; total?: number }>("/me/tracks?limit=50");
  const rest = first.next && max > 50 ? await collect(first.next, max - 50) : [];
  return {
    tracks: asTracks([...(first.items ?? []), ...rest], "track"),
    total: typeof first.total === "number" ? first.total : (first.items ?? []).length + rest.length,
  };
}

// ── collections ───────────────────────────────────────────────────────────

export async function playlist(id: string): Promise<{ collection: Collection; tracks: Track[] }> {
  const raw = await request(`/playlists/${encodeURIComponent(id)}`);
  const collection = mapPlaylist(raw);
  if (!collection) throw new SpotifyApiError(404, "Playlist introuvable");
  // Spotify moved playlist contents from /tracks to /items; ask for the new one first
  let items: unknown[];
  try {
    items = await collect(`/playlists/${encodeURIComponent(id)}/items?limit=100`, 1000);
  } catch (error) {
    if (!(error instanceof SpotifyApiError) || (error.status !== 404 && error.status !== 403)) throw error;
    items = await collect(`/playlists/${encodeURIComponent(id)}/tracks?limit=100`, 1000);
  }
  const tracks = items
    .map((item) => mapTrack(((item as Json).item ?? (item as Json).track) as Json | null))
    .filter((track): track is Track => track !== null);
  return { collection, tracks };
}

export async function album(id: string): Promise<{ collection: Collection; tracks: Track[] }> {
  const raw = await request(`/albums/${encodeURIComponent(id)}`);
  const collection = mapAlbum(raw);
  if (!collection) throw new SpotifyApiError(404, "Album introuvable");
  const info = { name: collection.name, id: collection.id, image: pickImage(raw.images, 300), imageLarge: pickImage(raw.images, 640), thumb: pickImage(raw.images, 64) };
  const first = (raw.tracks as { items?: unknown[]; next?: string | null } | undefined) ?? {};
  const more = first.next ? await collect(first.next, 500) : [];
  const tracks = [...(first.items ?? []), ...more]
    .map((item) => mapTrack(item as Json, info))
    .filter((track): track is Track => track !== null);
  return { collection, tracks };
}

export async function search(query: string): Promise<{ tracks: Track[]; albums: Collection[]; playlists: Collection[]; artists: Artist[] }> {
  const params = new URLSearchParams({ q: query, type: "track,album,playlist,artist", limit: "10" });
  const raw = await request<Json>(`/search?${params.toString()}`);
  const items = (key: string) => (((raw[key] as Json | undefined)?.items as unknown[] | undefined) ?? []) as Json[];
  return {
    tracks: asTracks(items("tracks")),
    albums: items("albums").map(mapAlbum).filter((c): c is Collection => c !== null),
    playlists: items("playlists").map(mapPlaylist).filter((c): c is Collection => c !== null),
    artists: items("artists").map(mapArtist).filter((a): a is Artist => a !== null),
  };
}

/** Tracks only, ten at a time (the most Spotify gives an app in development mode). */
export async function searchTracks(query: string, offset = 0): Promise<Track[]> {
  const params = new URLSearchParams({ q: query, type: "track", limit: "10", offset: String(offset) });
  const raw = await request<{ tracks?: { items?: unknown[] } }>(`/search?${params.toString()}`);
  return asTracks(raw.tracks?.items ?? []);
}

// ── playback ──────────────────────────────────────────────────────────────

export interface Device {
  id: string;
  name: string;
  type: string;
  isActive: boolean;
  volumePercent: number | null;
}

export async function devices(): Promise<Device[]> {
  const raw = await request<{ devices?: Json[] }>("/me/player/devices");
  return (raw.devices ?? [])
    .filter((device) => typeof device.id === "string")
    .map((device) => ({
      id: device.id as string,
      name: String(device.name ?? "Appareil"),
      type: String(device.type ?? "Unknown"),
      isActive: device.is_active === true,
      volumePercent: typeof device.volume_percent === "number" ? device.volume_percent : null,
    }));
}

export interface RemoteState {
  device: { id: string; name: string; type: string; volumePercent: number | null } | null;
  isPlaying: boolean;
  progressMs: number;
  shuffle: boolean;
  repeat: "off" | "context" | "track";
  contextUri?: string;
  track: Track | null;
}

export async function playerState(): Promise<RemoteState | null> {
  const raw = await request<Json | undefined>("/me/player?additional_types=episode");
  if (!raw) return null;
  const device = raw.device as Json | undefined;
  return {
    device: device?.id
      ? {
          id: String(device.id),
          name: String(device.name ?? "Appareil"),
          type: String(device.type ?? "Unknown"),
          volumePercent: typeof device.volume_percent === "number" ? device.volume_percent : null,
        }
      : null,
    isPlaying: raw.is_playing === true,
    progressMs: typeof raw.progress_ms === "number" ? raw.progress_ms : 0,
    shuffle: raw.shuffle_state === true,
    repeat: raw.repeat_state === "track" || raw.repeat_state === "context" ? raw.repeat_state : "off",
    contextUri: ((raw.context as Json | null)?.uri as string | undefined) ?? undefined,
    track: mapTrack(raw.item as Json | null),
  };
}

const withDevice = (path: string, deviceId?: string, extra: Record<string, string> = {}) => {
  const params = new URLSearchParams({ ...extra, ...(deviceId ? { device_id: deviceId } : {}) });
  const query = params.toString();
  return query ? `${path}?${query}` : path;
};

export type PlayBody = ({ context_uri: string; offset?: { uri: string } | { position: number } } | { uris: string[]; offset?: { position: number } }) & {
  position_ms?: number;
};

export const play = (deviceId?: string, body?: PlayBody) =>
  request(withDevice("/me/player/play", deviceId), { method: "PUT", body: body ? JSON.stringify(body) : undefined });
export const pause = (deviceId?: string) => request(withDevice("/me/player/pause", deviceId), { method: "PUT" });
export const next = (deviceId?: string) => request(withDevice("/me/player/next", deviceId), { method: "POST" });
export const previous = (deviceId?: string) => request(withDevice("/me/player/previous", deviceId), { method: "POST" });
export const seek = (ms: number, deviceId?: string) =>
  request(withDevice("/me/player/seek", deviceId, { position_ms: String(Math.max(0, Math.round(ms))) }), { method: "PUT" });
export const setVolume = (percent: number, deviceId?: string) =>
  request(withDevice("/me/player/volume", deviceId, { volume_percent: String(Math.round(percent)) }), { method: "PUT" });
export const setShuffle = (on: boolean, deviceId?: string) =>
  request(withDevice("/me/player/shuffle", deviceId, { state: String(on) }), { method: "PUT" });
export const setRepeat = (mode: "off" | "context" | "track", deviceId?: string) =>
  request(withDevice("/me/player/repeat", deviceId, { state: mode }), { method: "PUT" });
export const transfer = (deviceId: string, playNow: boolean) =>
  request("/me/player", { method: "PUT", body: JSON.stringify({ device_ids: [deviceId], play: playNow }) });

export const addToQueue = (uri: string, deviceId?: string) =>
  request(withDevice("/me/player/queue", deviceId, { uri }), { method: "POST" });

export async function queue(): Promise<{ current: Track | null; next: Track[] }> {
  const raw = await request<Json | undefined>("/me/player/queue");
  return {
    current: mapTrack((raw?.currently_playing as Json | null) ?? null),
    next: asTracks((raw?.queue as unknown[] | undefined) ?? []).slice(0, 30),
  };
}

// ── artists ───────────────────────────────────────────────────────────────

export async function artist(id: string): Promise<{ artist: Artist; topTracks: Track[]; releases: Collection[] }> {
  // Spotify closed an artist's top tracks to apps in development mode: not asked any more (one request
  // saved per page); search finds the artist's best known instead
  const [info, albums, singles] = await Promise.allSettled([request(`/artists/${encodeURIComponent(id)}`), artistReleases(id, "album"), artistReleases(id, "single")]);
  if (info.status === "rejected") throw info.reason;
  const mapped = mapArtist(info.value);
  if (!mapped) throw new SpotifyApiError(404, "Artiste introuvable");
  const topTracks = await artistTracksBySearch(mapped).catch(() => []);
  const releases = [...(albums.status === "fulfilled" ? albums.value : []), ...(singles.status === "fulfilled" ? singles.value : [])];
  return { artist: mapped, topTracks, releases };
}

const artistCards = new Map<string, Promise<Artist>>();

/** An artist's picture and genres, asked once per run (the "À l'écoute" panel shows it for each new artist). */
export function artistCard(id: string): Promise<Artist> {
  let pending = artistCards.get(id);
  if (!pending) {
    pending = request(`/artists/${encodeURIComponent(id)}`).then((raw) => {
      const mapped = mapArtist(raw);
      if (!mapped) throw new SpotifyApiError(404, "Artiste introuvable");
      return mapped;
    });
    // a failure (a Spotify pause) is asked again later, not remembered
    pending.catch(() => artistCards.delete(id));
    artistCards.set(id, pending);
  }
  return pending;
}

/** An artist's releases of one kind (or albums and singles), newest first, 10 at most in development mode. */
export async function artistReleases(id: string, groups = "album,single"): Promise<Collection[]> {
  const page = await request<{ items?: Json[] }>(`/artists/${encodeURIComponent(id)}/albums?include_groups=${groups}&limit=10`);
  return (page.items ?? []).map(mapAlbum).filter((c): c is Collection => c !== null);
}

/** Tracks search ranks first for the artist's name, kept when the artist is on them. */
export async function artistTracksBySearch(artist: Pick<Artist, "id" | "name">): Promise<Track[]> {
  const pages = await Promise.allSettled([searchTracks(`artist:"${artist.name}"`), searchTracks(artist.name), searchTracks(artist.name, 10)]);
  const tracks = pages.flatMap((page) => (page.status === "fulfilled" ? page.value : []));
  const mine = uniqueById(tracks.filter((track) => track.artistIds.includes(artist.id)));
  // a song shows once, even when it is on the album and on the single
  return mine.filter((track, index) => mine.findIndex((other) => songKey(other) === songKey(track)) === index).slice(0, 10);
}

// ── liked songs ───────────────────────────────────────────────────────────

/** Whether each track is in the person's Liked Songs, in the order given. */
export async function areSaved(ids: string[]): Promise<boolean[]> {
  if (ids.length === 0) return [];
  const result = await request<unknown>(`/me/tracks/contains?ids=${ids.slice(0, 50).map(encodeURIComponent).join(",")}`);
  return Array.isArray(result) ? result.map((value) => value === true) : ids.map(() => false);
}

export const saveTrack = (id: string) => request(`/me/tracks?ids=${encodeURIComponent(id)}`, { method: "PUT" });
export const removeTrack = (id: string) => request(`/me/tracks?ids=${encodeURIComponent(id)}`, { method: "DELETE" });

// ── editing playlists ─────────────────────────────────────────────────────

/** Tries the current endpoint, then the older one Spotify may still serve. */
async function withFallback<T>(current: () => Promise<T>, older: () => Promise<T>): Promise<T> {
  try {
    return await current();
  } catch (error) {
    if (error instanceof SpotifyApiError && (error.status === 404 || error.status === 405)) return older();
    throw error;
  }
}

/** The person's playlists they may add tracks to: their own and the collaborative ones. */
export async function editablePlaylists(): Promise<Collection[]> {
  const [profile, playlists] = await Promise.all([me(), myPlaylists()]);
  return playlists.filter((playlist) => playlist.ownerId === profile.id || playlist.collaborative);
}

export async function createPlaylist(name: string, description = ""): Promise<Collection> {
  const body = JSON.stringify({ name: name.trim().slice(0, 100), description: description.slice(0, 300), public: false });
  const raw = await withFallback(
    () => request<Json>("/me/playlists", { method: "POST", body }),
    async () => request<Json>(`/users/${encodeURIComponent((await me()).id)}/playlists`, { method: "POST", body }),
  );
  const playlist = mapPlaylist(raw);
  if (!playlist) throw new SpotifyApiError(500, "Spotify n'a pas renvoyé la playlist créée");
  return playlist;
}

export async function addToPlaylist(playlistId: string, uris: string[]): Promise<void> {
  const path = `/playlists/${encodeURIComponent(playlistId)}`;
  // Spotify takes a hundred at a time
  for (let i = 0; i < uris.length; i += 100) {
    const body = JSON.stringify({ uris: uris.slice(i, i + 100) });
    await withFallback(
      () => request(`${path}/items`, { method: "POST", body }),
      () => request(`${path}/tracks`, { method: "POST", body }),
    );
  }
}

export async function removeFromPlaylist(playlistId: string, uris: string[]): Promise<void> {
  const path = `/playlists/${encodeURIComponent(playlistId)}`;
  await withFallback(
    () => request(`${path}/items`, { method: "DELETE", body: JSON.stringify({ items: uris.map((uri) => ({ uri })) }) }),
    () => request(`${path}/tracks`, { method: "DELETE", body: JSON.stringify({ tracks: uris.map((uri) => ({ uri })) }) }),
  );
}
