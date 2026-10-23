// The other versions of a track on Spotify, the official ones the artists publish: sped up and slowed
// (TikTok's favourites), acoustic, instrumental, live, remix. Instrumental versions also make a karaoke
// without the voice, by playing one at the same moment of the song with the original's lyrics. Nothing
// is done to the sound: these are tracks like any other, which is all Spotify allows.
import type { Track } from "./types";

export type VersionKind = "spedup" | "slowed" | "acoustic" | "instrumental" | "live" | "remix";

export const VERSION_KINDS: { kind: VersionKind; label: string; words: RegExp }[] = [
  { kind: "spedup", label: "Accélérée", words: /\b(sped[\s-]?up|speed[\s-]?up|nightcore|fast(er)? version)\b/i },
  { kind: "slowed", label: "Ralentie", words: /\b(slowed|slow(er)? version|reverb)\b/i },
  { kind: "instrumental", label: "Instrumentale", words: /\b(instrumental|karaok[eé]|backing track|sans voix)\b/i },
  { kind: "acoustic", label: "Acoustique", words: /\b(acoustic|acoustique|unplugged|piano version|stripped)\b/i },
  { kind: "live", label: "Live", words: /\b(live|en concert|session)\b/i },
  { kind: "remix", label: "Remix", words: /\b(remix|rmx|mix|edit|rework|version)\b/i },
];

const fold = (text: string) => text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** The title without what tells versions apart: "Sure Thing (Sped Up)" → "sure thing". */
export function baseTitle(name: string): string {
  return fold(name)
    .replace(/\s*[([].*?[)\]]/g, "")
    .replace(/\s+[-–—]\s+.*$/, "")
    .replace(/\b(feat|ft)\.?\s.*$/, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

export interface Version {
  track: Track;
  kind: VersionKind;
  /** by the same artist as the original: an official version, most likely */
  sameArtist: boolean;
  /** its length minus the original's, ms */
  deltaMs: number;
}

/** What version of `original` this candidate is, or null when it is the same track or another song. */
export function classifyVersion(original: Track, candidate: Track): Version | null {
  if (candidate.uri === original.uri || baseTitle(candidate.name) !== baseTitle(original.name)) return null;
  // the words that tell it apart, in its title only: the original's own words do not count
  const extra = fold(candidate.name).replace(fold(original.name), "");
  const kind = VERSION_KINDS.find((entry) => entry.words.test(extra))?.kind;
  if (!kind) return null;
  return { track: candidate, kind, sameArtist: candidate.artistIds.includes(original.artistIds[0] ?? ""), deltaMs: candidate.durationMs - original.durationMs };
}

/** The versions found among search results, grouped by kind, the artist's own first. */
export function groupVersions(original: Track, results: Track[]): Map<VersionKind, Version[]> {
  const groups = new Map<VersionKind, Version[]>();
  const seen = new Set<string>();
  for (const candidate of results) {
    if (seen.has(candidate.uri)) continue;
    seen.add(candidate.uri);
    const version = classifyVersion(original, candidate);
    if (!version) continue;
    groups.set(version.kind, [...(groups.get(version.kind) ?? []), version]);
  }
  for (const list of groups.values()) list.sort((a, b) => Number(b.sameArtist) - Number(a.sameArtist) || Math.abs(a.deltaMs) - Math.abs(b.deltaMs));
  return new Map(VERSION_KINDS.filter(({ kind }) => groups.has(kind)).map(({ kind }) => [kind, groups.get(kind)!]));
}

/**
 * The instrumental to sing on: the artist's own (same master, so the same timing) before a karaoke
 * label's cover, the one closest in length; null when there is none.
 */
export function bestInstrumental(original: Track, results: Track[]): Version | null {
  const candidates = groupVersions(original, results).get("instrumental") ?? [];
  const score = (version: Version) =>
    (version.sameArtist ? 4 : 0) + (/instrumental/i.test(version.track.name) ? 2 : 0) + (Math.abs(version.deltaMs) <= 2000 ? 3 : Math.abs(version.deltaMs) <= 10_000 ? 1 : 0);
  return [...candidates].sort((a, b) => score(b) - score(a))[0] ?? null;
}

/** Where to be in `to` for the same moment of the song as `positionMs` in `from` (same length: the same). */
export function mapPosition(positionMs: number, fromMs: number, toMs: number): number {
  if (!fromMs || !toMs || Math.abs(fromMs - toMs) <= 2000) return positionMs;
  return Math.round((positionMs * toMs) / fromMs);
}

/** The searches that find a track's versions: its title by its artist (two pages), and karaoke covers. */
export function versionQueries(track: Track): { query: string; offset: number }[] {
  const title = baseTitle(track.name);
  const artist = track.artists[0] ?? "";
  return [
    { query: `track:"${title}" artist:"${artist}"`, offset: 0 },
    { query: `track:"${title}" artist:"${artist}"`, offset: 10 },
    { query: `${title} ${artist} instrumental`, offset: 0 },
  ];
}
