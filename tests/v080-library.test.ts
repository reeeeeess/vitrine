import { describe, expect, it, vi } from "vitest";
import { cliCommand } from "../electron/cli";
import type { HistoryPlay } from "../src/renderer/global";
import { iceberg, lastPlayedLabel, lastWeek, milestones, momentMix, quickPicks, trackStats } from "../src/renderer/lib/insights";

vi.mock("electron", () => ({ app: { isPackaged: false, setJumpList: vi.fn() } }));
const memory = new Map<string, string>();
Object.assign(globalThis, {
  localStorage: { getItem: (k: string) => memory.get(k) ?? null, setItem: (k: string, v: string) => memory.set(k, v), removeItem: (k: string) => memory.delete(k) },
  window: { vitrine: { auth: { token: async () => "t" } } },
});
const { cleanPins, jumpList } = await import("../electron/pins");
const { sortCollections } = await import("../src/renderer/views/Library");
const { sortLiked } = await import("../src/renderer/views/Liked");
const { matchesQuery, rememberSearch } = await import("../src/renderer/views/Search");
const { latestRelease } = await import("../src/renderer/views/Artist");
const { releaseLabel } = await import("../src/renderer/views/Collection");

const play = (over: Partial<HistoryPlay>): HistoryPlay => ({
  at: "2026-10-20T20:00:00.000Z",
  id: "t1",
  uri: "spotify:track:t1",
  name: "Titre",
  artists: ["Artiste"],
  artistIds: ["ar1"],
  album: "Album",
  albumId: "al1",
  durationMs: 180_000,
  playedMs: 180_000,
  ...over,
});

describe("pins (C1)", () => {
  it("keeps only real pins: six at most, no duplicates, nothing but playlists, albums and artists", () => {
    const pins = cleanPins([
      { uri: "spotify:playlist:abc", name: "Nuit", kind: "playlist", image: "https://i.scdn.co/x" },
      { uri: "spotify:playlist:abc", name: "Encore", kind: "playlist" },
      { uri: "spotify:track:t1", name: "Un titre", kind: "playlist" },
      { uri: "javascript:alert(1)", name: "x", kind: "album" },
      { uri: "spotify:album:al1", name: "Album", kind: "album", image: "file:///etc/passwd" },
      ...Array.from({ length: 8 }, (_, i) => ({ uri: `spotify:artist:a${i}`, name: `A${i}`, kind: "artist" })),
    ]);
    expect(pins).toHaveLength(6);
    expect(pins[0]).toEqual({ uri: "spotify:playlist:abc", name: "Nuit", kind: "playlist", image: "https://i.scdn.co/x" });
    expect(pins[1]).toEqual({ uri: "spotify:album:al1", name: "Album", kind: "album" });
    expect(cleanPins("nope")).toEqual([]);
  });

  it("puts them in the taskbar's jump list, each starting Vitrine with --play", () => {
    const [group] = jumpList([{ uri: "spotify:album:al1", name: "Album", kind: "album" }], "C:\\Vitrine.exe");
    expect(group.name).toBe("Épinglés");
    expect(group.items?.[0]).toMatchObject({ type: "task", title: "Album", program: "C:\\Vitrine.exe", args: "--play=spotify:album:al1" });
    expect(jumpList([], "x")).toEqual([]);
  });

  it("accepts --play only for a playlist, an album or an artist", () => {
    expect(cliCommand(["Vitrine.exe", "--play=spotify:playlist:37i9dQ"])).toBe("play:spotify:playlist:37i9dQ");
    expect(cliCommand(["Vitrine.exe", "--play=spotify:track:abc"])).toBeNull();
    expect(cliCommand(["Vitrine.exe", "--play=https://evil.example"])).toBeNull();
  });
});

describe("library order and recent additions (C2, C3)", () => {
  const items = [
    { id: "1", uri: "u1", kind: "album", name: "Zénith", subtitle: "B", addedAt: "2026-01-02" },
    { id: "2", uri: "u2", kind: "album", name: "écho", subtitle: "A", addedAt: "2026-05-01" },
    { id: "3", uri: "u3", kind: "album", name: "Ambre", subtitle: "A", addedAt: "2025-12-01" },
  ] as never[];
  it("sorts by name (accents aside), by creator, by date added, or keeps Spotify's order", () => {
    expect(sortCollections(items, "name").map((c: { id: string }) => c.id)).toEqual(["3", "2", "1"]);
    expect(sortCollections(items, "creator").map((c: { id: string }) => c.id)).toEqual(["3", "2", "1"]);
    expect(sortCollections(items, "added").map((c: { id: string }) => c.id)).toEqual(["2", "1", "3"]);
    expect(sortCollections(items, "spotify")).toBe(items);
  });
});

describe("plays and last play in Liked Songs (C4)", () => {
  it("counts plays of 30 s or more, and keeps the latest", () => {
    const stats = trackStats([play({}), play({ at: "2026-10-21T08:00:00.000Z" }), play({ playedMs: 10_000, at: "2026-10-22T08:00:00.000Z" })]);
    expect(stats["spotify:track:t1"]).toEqual({ plays: 2, last: "2026-10-21T08:00:00.000Z" });
  });

  it("sorts by plays, by last play, or the never played first", () => {
    const tracks = [{ uri: "a" }, { uri: "b" }, { uri: "c" }];
    const stats = { a: { plays: 1, last: "2026-01-01" }, c: { plays: 5, last: "2025-01-01" } };
    expect(sortLiked(tracks, "plays", stats).map((t) => t.uri)).toEqual(["c", "a", "b"]);
    expect(sortLiked(tracks, "recent", stats).map((t) => t.uri)).toEqual(["a", "c", "b"]);
    expect(sortLiked(tracks, "never", stats)[0].uri).toBe("b");
  });

  it("says when a track was last played, in words", () => {
    const now = new Date(2026, 9, 23, 15).getTime();
    expect(lastPlayedLabel(undefined, now)).toBe("jamais");
    expect(lastPlayedLabel(new Date(2026, 9, 23, 9).toISOString(), now)).toBe("aujourd'hui");
    expect(lastPlayedLabel(new Date(2026, 9, 22, 23).toISOString(), now)).toBe("hier");
    expect(lastPlayedLabel(new Date(2026, 9, 13).toISOString(), now)).toBe("il y a 10 j");
    expect(lastPlayedLabel(new Date(2026, 5, 1).toISOString(), now)).toBe("il y a 4 mois");
    expect(lastPlayedLabel(new Date(2023, 9, 1).toISOString(), now)).toBe("il y a 3 ans");
  });
});

describe("album and artist pages (D1, D2)", () => {
  it("writes a release date as precisely as Spotify knows it", () => {
    expect(releaseLabel("2024-03-12")).toBe("12 mars 2024");
    expect(releaseLabel("2024-03")).toBe("mars 2024");
    expect(releaseLabel("1999")).toBe("1999");
  });

  it("finds the latest release among albums and singles, not appearances", () => {
    const releases = [
      { id: "a", releaseDate: "2025-01-01", group: "album" },
      { id: "s", releaseDate: "2026-06-01", group: "single" },
      { id: "f", releaseDate: "2026-09-01", group: "appears_on" },
    ] as never[];
    expect((latestRelease(releases) as unknown as { id: string }).id).toBe("s");
  });
});

describe("search (D3)", () => {
  it("remembers searches newest first, without duplicates, ten at most", () => {
    let list: string[] = [];
    for (const q of ["damso", "PNL", "Damso", "a"]) list = rememberSearch(list, q);
    expect(list).toEqual(["Damso", "PNL"]);
    for (let i = 0; i < 12; i++) list = rememberSearch(list, `q${i}`);
    expect(list).toHaveLength(10);
  });

  it("finds every word in the library, accents and case aside", () => {
    expect(matchesQuery(["Évidemment", "Angèle"], "angele evidem")).toBe(true);
    expect(matchesQuery(["Évidemment", "Angèle"], "angele damso")).toBe(false);
  });
});

describe("quick access, the moment, the iceberg, the week, milestones (P5, T7, T3, T8, I3)", () => {
  const now = new Date(2026, 9, 21, 20, 30).getTime(); // a Wednesday evening

  it("picks the albums and artists played most this month", () => {
    const plays = [
      ...Array.from({ length: 4 }, (_, i) => play({ at: new Date(now - i * 3_600_000).toISOString(), albumId: "al1", album: "Ipséité" })),
      ...Array.from({ length: 3 }, (_, i) => play({ at: new Date(now - i * 3_600_000).toISOString(), albumId: "al2", album: "QALF", artistIds: ["ar2"], artists: ["Damso"] })),
      play({ at: new Date(now - 60 * 86_400_000).toISOString(), albumId: "old", album: "Ancien" }),
    ];
    const picks = quickPicks(plays, 30, now);
    expect(picks[0]).toMatchObject({ kind: "album", id: "al1", plays: 4 });
    expect(picks.some((pick) => pick.id === "old")).toBe(false);
    expect(picks.some((pick) => pick.kind === "artist" && pick.id === "ar1")).toBe(true);
  });

  it("makes a daylist of what is played on this day around this hour", () => {
    const wednesdayEvening = (i: number, uri: string) => play({ at: new Date(now - i * 7 * 86_400_000 - 1_800_000).toISOString(), uri, name: uri, artists: ["Tiakola"] });
    const plays = [...["a", "b", "c", "d", "e"].flatMap((uri) => [wednesdayEvening(1, uri), wednesdayEvening(2, uri)]), play({ at: new Date(now - 10 * 3_600_000).toISOString(), uri: "morning" })];
    const moment = momentMix(plays, now);
    expect(moment?.title).toBe("Mercredi soir · Tiakola et plus");
    expect(moment?.tracks.map((t) => t.uri)).not.toContain("morning");
    expect(momentMix([], now)).toBeNull();
  });

  it("draws the iceberg of the person's own artists, the rarely played at the bottom", () => {
    const plays = Array.from({ length: 20 }, (_, artist) => Array.from({ length: 20 - artist }, () => play({ artists: [`Artiste ${artist}`] }))).flat();
    const levels = iceberg(plays)!;
    expect(levels[0].artists[0]).toBe("Artiste 0");
    expect(levels[4].artists).toContain("Artiste 19");
    expect(iceberg(plays.slice(0, 5))).toBeNull();
  });

  it("sums up last week, Monday to Sunday", () => {
    const monday = new Date(2026, 9, 19, 10).getTime(); // the Monday of `now`'s week
    const plays = [play({ at: new Date(monday - 2 * 86_400_000).toISOString() }), play({ at: new Date(monday - 3 * 86_400_000).toISOString(), artists: ["Damso"] }), play({ at: new Date(now).toISOString() })];
    const recap = lastWeek(plays, now)!;
    expect(recap.week).toBe("2026-10-12");
    expect(recap.plays).toBe(2);
    expect(recap.ms).toBe(360_000);
  });

  it("says a milestone once, the biggest of its kind", () => {
    const plays = Array.from({ length: 100 }, (_, i) => play({ at: new Date(now - i * 60_000).toISOString() }));
    const found = milestones(plays, plays[0], new Set());
    expect(found.map((m) => m.text)).toContain("100e écoute de « Titre »");
    expect(found.filter((m) => m.key.startsWith("track:")).length).toBe(1);
    expect(milestones(plays, plays[0], new Set(found.map((m) => m.key)).add("track:spotify:track:t1:50"))).toEqual([]);
  });
});
