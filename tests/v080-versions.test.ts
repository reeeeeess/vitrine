import { describe, expect, it } from "vitest";
import type { Track } from "../src/renderer/lib/types";
import { baseTitle, bestInstrumental, classifyVersion, groupVersions, mapPosition, versionQueries } from "../src/renderer/lib/versions";

const memory = new Map<string, string>();
Object.assign(globalThis, {
  localStorage: { getItem: (k: string) => memory.get(k) ?? null, setItem: (k: string, v: string) => memory.set(k, v), removeItem: (k: string) => memory.delete(k) },
  window: { vitrine: { auth: { token: async () => "t" } } },
});
const { lyricsSource } = await import("../src/renderer/player/karaoke");

const track = (uri: string, name: string, artistId = "miguel", durationMs = 195_000): Track =>
  ({ id: uri, uri: `spotify:track:${uri}`, name, artists: [artistId === "miguel" ? "Miguel" : "Karaoke Hits"], artistIds: [artistId], durationMs, explicit: false }) as Track;

const original = track("o", "Sure Thing");

describe("versions of a track (T5)", () => {
  it("compares titles without what tells versions apart", () => {
    expect(baseTitle("Sure Thing (Sped Up)")).toBe("sure thing");
    expect(baseTitle("Sure Thing - Acoustic Version")).toBe("sure thing");
    expect(baseTitle("Évidemment [Live à Bercy]")).toBe("evidemment");
    expect(baseTitle("Tout l'été (feat. Tiakola)")).toBe("tout l ete");
  });

  it("tells which version a search result is, and ignores other songs", () => {
    expect(classifyVersion(original, track("a", "Sure Thing (Sped Up)", "miguel", 150_000))).toMatchObject({ kind: "spedup", sameArtist: true, deltaMs: -45_000 });
    expect(classifyVersion(original, track("b", "Sure Thing - Slowed + Reverb"))?.kind).toBe("slowed");
    expect(classifyVersion(original, track("c", "Sure Thing (Instrumental)"))?.kind).toBe("instrumental");
    expect(classifyVersion(original, track("d", "Sure Thing (Karaoke Version)", "label"))?.kind).toBe("instrumental");
    expect(classifyVersion(original, track("e", "Sure Thing (Live)"))?.kind).toBe("live");
    expect(classifyVersion(original, track("f", "Sure Thing (Remix)"))?.kind).toBe("remix");
    expect(classifyVersion(original, track("g", "Sure Thing"))).toBeNull();
    expect(classifyVersion(original, track("h", "Adorn (Remix)"))).toBeNull();
    expect(classifyVersion(original, original)).toBeNull();
  });

  it("groups them by kind, in a fixed order, the artist's own first", () => {
    const groups = groupVersions(original, [track("r", "Sure Thing (Remix)"), track("k", "Sure Thing (Karaoke)", "label"), track("i", "Sure Thing (Instrumental)"), track("s", "Sure Thing (Sped Up)")]);
    expect([...groups.keys()]).toEqual(["spedup", "instrumental", "remix"]);
    expect(groups.get("instrumental")!.map((v) => v.track.uri)).toEqual(["spotify:track:i", "spotify:track:k"]);
  });

  it("searches the title by its artist on two pages, and karaoke covers", () => {
    expect(versionQueries(original)).toEqual([
      { query: 'track:"sure thing" artist:"Miguel"', offset: 0 },
      { query: 'track:"sure thing" artist:"Miguel"', offset: 10 },
      { query: "sure thing Miguel instrumental", offset: 0 },
    ]);
  });
});

describe("karaoke without the voice (K2)", () => {
  it("prefers the artist's own instrumental, of the same length, to a karaoke label's", () => {
    const label = track("k", "Sure Thing (Karaoke Version)", "label", 196_000);
    const official = track("i", "Sure Thing (Instrumental)", "miguel", 194_500);
    expect(bestInstrumental(original, [label, official])?.track.uri).toBe("spotify:track:i");
    expect(bestInstrumental(original, [label])?.track.uri).toBe("spotify:track:k");
    expect(bestInstrumental(original, [track("x", "Sure Thing (Live)")])).toBeNull();
  });

  it("keeps the same moment of the song: as is for the same length, stretched otherwise", () => {
    expect(mapPosition(60_000, 195_000, 194_000)).toBe(60_000);
    expect(mapPosition(60_000, 200_000, 220_000)).toBe(66_000);
  });

  it("shows the original's lyrics, in time, while the instrumental plays", () => {
    const instrumental = track("i", "Sure Thing (Instrumental)", "miguel", 234_000);
    const source = lyricsSource(instrumental, { original, instrumental, approximate: true });
    expect(source.track).toBe(original);
    expect(source.toLyrics(117_000)).toBe(97_500);
    expect(lyricsSource(original, { original, instrumental, approximate: true }).track).toBe(original);
    expect(lyricsSource(instrumental, null).track).toBe(instrumental);
  });
});
