// Moments (Spicetify's Bookmark, SoundCloud's timed comments): an instant of a track, with a note,
// kept on this computer in config.json. Nothing is sent anywhere.

export interface Moment {
  id: string;
  uri: string;
  name: string;
  artists: string[];
  image?: string;
  atMs: number;
  note: string;
  createdAt: string;
}

export const MAX_MOMENTS = 300;

/** What the page sent, kept only as real moments of Spotify tracks, the newest 300. */
export function cleanMoments(value: unknown): Moment[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const moments: Moment[] = [];
  for (const item of value) {
    const m = item as Partial<Moment> | null;
    if (!m || typeof m.id !== "string" || seen.has(m.id) || typeof m.uri !== "string" || !/^spotify:track:[A-Za-z0-9]+$/.test(m.uri)) continue;
    if (typeof m.atMs !== "number" || !Number.isFinite(m.atMs) || m.atMs < 0) continue;
    seen.add(m.id);
    moments.push({
      id: m.id.slice(0, 40),
      uri: m.uri,
      name: String(m.name ?? "").slice(0, 200),
      artists: Array.isArray(m.artists) ? m.artists.map(String).slice(0, 10) : [],
      ...(typeof m.image === "string" && m.image.startsWith("https://") ? { image: m.image } : {}),
      atMs: Math.round(m.atMs),
      note: String(m.note ?? "").slice(0, 280),
      createdAt: typeof m.createdAt === "string" ? m.createdAt : new Date().toISOString(),
    });
  }
  return moments.slice(0, MAX_MOMENTS);
}
