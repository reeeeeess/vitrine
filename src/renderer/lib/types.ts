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
  /** the smallest (64 px): list thumbnails and blurred backdrops, which need no more */
  thumb?: string;
  durationMs: number;
  explicit: boolean;
  /** the recording's international code, for its credits (MusicBrainz) */
  isrc?: string;
}

export interface Collection {
  id: string;
  uri: string;
  kind: "playlist" | "album";
  name: string;
  subtitle: string;
  description?: string;
  image?: string;
  /** 64 px, for blurred backdrops */
  thumb?: string;
  /** about 300 px, for cards in rows and grids */
  card?: string;
  total?: number;
  /** albums only: "2026-06-21", or just the year or month when Spotify knows no more */
  releaseDate?: string;
  /** playlists only: who owns it, and whether others may add to it */
  ownerId?: string;
  collaborative?: boolean;
  /** albums: the first artist, for "more by this artist" */
  artistId?: string;
  /** albums from an artist's page: "album", "single", "appears_on", "compilation" */
  group?: string;
  /** albums: the label and the © / ℗ lines, when Spotify gives them */
  label?: string;
  copyrights?: string[];
  /** saved albums: when the person added it */
  addedAt?: string;
}

export interface Artist {
  id: string;
  uri: string;
  name: string;
  image?: string;
  /** about 300 px, for round cards */
  card?: string;
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

export function mapTrack(raw: Raw, album?: { name: string; id?: string; image?: string; imageLarge?: string; thumb?: string }): Track | null {
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
    thumb: album?.thumb ?? pickImage(rawAlbum?.images ?? raw.images, 64),
    durationMs: typeof raw.duration_ms === "number" ? raw.duration_ms : 0,
    explicit: raw.explicit === true,
    ...(str(obj(raw.external_ids)?.isrc) ? { isrc: str(obj(raw.external_ids)?.isrc) } : {}),
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
    thumb: pickImage(raw.images, 64),
    card: pickImage(raw.images, 300),
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
    thumb: pickImage(raw.images, 64),
    card: pickImage(raw.images, 300),
    total: typeof raw.total_tracks === "number" ? raw.total_tracks : undefined,
    releaseDate: str(raw.release_date) || undefined,
    artistId: Array.isArray(raw.artists) ? str((raw.artists as Raw[])[0]?.id) || undefined : undefined,
    group: str(raw.album_group) || undefined,
    label: str(raw.label) || undefined,
    copyrights: Array.isArray(raw.copyrights)
      ? (raw.copyrights as Raw[])
          .map((c) => {
            const text = str(c?.text).trim();
            // Spotify writes the symbol in the text most of the time, not always
            return text && !/^[©℗(]/.test(text) ? `${str(c?.type) === "P" ? "℗" : "©"} ${text}` : text;
          })
          .filter(Boolean)
      : undefined,
  };
}

export function mapArtist(raw: Raw): Artist | null {
  if (!raw || !str(raw.id)) return null;
  return {
    id: str(raw.id),
    uri: str(raw.uri),
    name: str(raw.name),
    image: pickImage(raw.images, 640),
    card: pickImage(raw.images, 300),
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
