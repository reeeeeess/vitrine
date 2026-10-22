// What the views work with, mapped from Spotify's Web API objects. Mapping is defensive: Spotify
// returns null items for removed tracks and unavailable playlists, and leaves fields out.

export interface Track {
  id: string;
  uri: string;
  name: string;
  artists: string[];
  artistIds: string[];
  albumName: string;
  albumId?: string;
  /** about 300 px: cards and lists */
  image?: string;
  /** the largest Spotify has (640 px): the full-screen and mini players */
  imageLarge?: string;
  durationMs: number;
  explicit: boolean;
}

export interface Collection {
  id: string;
  uri: string;
  kind: "playlist" | "album";
  name: string;
  subtitle: string;
  description?: string;
  image?: string;
  total?: number;
  /** albums only: "2026-06-21", or just the year or month when Spotify knows no more */
  releaseDate?: string;
  /** playlists only: who owns it, and whether others may add to it */
  ownerId?: string;
  collaborative?: boolean;
}

export interface Artist {
  id: string;
  uri: string;
  name: string;
  image?: string;
  genres: string[];
  followers?: number;
}

interface RawImage {
  url?: string;
  width?: number | null;
}

type Raw = Record<string, unknown> | null | undefined;

const str = (value: unknown): string => (typeof value === "string" ? value : "");
const obj = (value: unknown): Record<string, unknown> | undefined =>
  value && typeof value === "object" ? (value as Record<string, unknown>) : undefined;

/** "Mon titre (feat. X) - Remix" and "Mon titre" are one song for lists that should not repeat a song. */
export function songKey(track: Pick<Track, "name" | "artists">): string {
  const name = track.name
    .toLowerCase()
    .replace(/\s*[([].*?[)\]]/g, "")
    .replace(/\s+-\s+.*$/, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
  return `${name}|${(track.artists[0] ?? "").toLowerCase()}`;
}

/** The smallest image at least `size` wide, or the largest there is. */
export function pickImage(images: unknown, size = 300): string | undefined {
  if (!Array.isArray(images) || images.length === 0) return undefined;
  const list = (images as RawImage[]).filter((image) => image?.url);
  const fitting = list.filter((image) => (image.width ?? 0) >= size).sort((a, b) => (a.width ?? 0) - (b.width ?? 0));
  return (fitting[0] ?? list[0])?.url;
}

export function mapTrack(raw: Raw, album?: { name: string; id?: string; image?: string; imageLarge?: string }): Track | null {
  if (!raw || !str(raw.uri) || raw.is_local === true) return null;
  const rawAlbum = obj(raw.album) ?? obj(raw.show);
  const artists = Array.isArray(raw.artists)
    ? (raw.artists as Raw[]).map((artist) => str(artist?.name)).filter(Boolean)
    : rawAlbum
      ? [str(rawAlbum.publisher) || str(rawAlbum.name)].filter(Boolean)
      : [];
  const artistIds = Array.isArray(raw.artists) ? (raw.artists as Raw[]).map((artist) => str(artist?.id)).filter(Boolean) : [];
  return {
    id: str(raw.id) || str(raw.uri),
    uri: str(raw.uri),
    name: str(raw.name) || "Titre inconnu",
    artists,
    artistIds,
    albumName: album?.name ?? str(rawAlbum?.name),
    albumId: album?.id ?? (str(rawAlbum?.id) || undefined),
    image: album?.image ?? pickImage(rawAlbum?.images ?? raw.images, 300),
    imageLarge: album?.imageLarge ?? pickImage(rawAlbum?.images ?? raw.images, 640),
    durationMs: typeof raw.duration_ms === "number" ? raw.duration_ms : 0,
    explicit: raw.explicit === true,
  };
}

export function mapPlaylist(raw: Raw): Collection | null {
  if (!raw || !str(raw.id)) return null;
  const owner = str(obj(raw.owner)?.display_name);
  const total = obj(raw.items)?.total ?? obj(raw.tracks)?.total;
  return {
    id: str(raw.id),
    uri: str(raw.uri),
    kind: "playlist",
    name: str(raw.name) || "Playlist",
    subtitle: owner ? `Par ${owner}` : "Playlist",
    description: stripHtml(str(raw.description)) || undefined,
    image: pickImage(raw.images, 640),
    total: typeof total === "number" ? total : undefined,
    ownerId: str(obj(raw.owner)?.id) || undefined,
    collaborative: raw.collaborative === true,
  };
}

export function mapAlbum(raw: Raw): Collection | null {
  if (!raw || !str(raw.id)) return null;
  const artists = Array.isArray(raw.artists) ? (raw.artists as Raw[]).map((a) => str(a?.name)).filter(Boolean) : [];
  const year = str(raw.release_date).slice(0, 4);
  return {
    id: str(raw.id),
    uri: str(raw.uri),
    kind: "album",
    name: str(raw.name) || "Album",
    subtitle: [artists.join(", "), year].filter(Boolean).join(" · "),
    image: pickImage(raw.images, 640),
    total: typeof raw.total_tracks === "number" ? raw.total_tracks : undefined,
    releaseDate: str(raw.release_date) || undefined,
  };
}

export function mapArtist(raw: Raw): Artist | null {
  if (!raw || !str(raw.id)) return null;
  return {
    id: str(raw.id),
    uri: str(raw.uri),
    name: str(raw.name),
    image: pickImage(raw.images, 640),
    genres: Array.isArray(raw.genres) ? (raw.genres as unknown[]).map(str).filter(Boolean) : [],
    followers: typeof obj(raw.followers)?.total === "number" ? (obj(raw.followers)!.total as number) : undefined,
  };
}

export function stripHtml(text: string): string {
  return text
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .trim();
}

/** Keeps the first of each id, in order. */
export function uniqueById<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter((item) => (seen.has(item.id) ? false : (seen.add(item.id), true)));
}
