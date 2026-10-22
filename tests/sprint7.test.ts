import { deflateRawSync } from "node:zlib";
import { describe, expect, it, vi } from "vitest";
import { cliCommand } from "../electron/cli";
import { fromRecentlyPlayed, fromStreamingHistory, newPlays, type Play } from "../electron/historyFile";
import { parseOverlayLine } from "../electron/overlay";
import { readZip } from "../electron/zip";
import { learn, rankByTaste, seedArtists, scoreOf, type Taste } from "../src/renderer/lib/flowTaste";
import { summarize } from "../src/renderer/lib/listening";

vi.mock("electron", () => ({ BrowserWindow: class {}, screen: {} }));

const play = (at: string, overrides: Partial<Play> = {}): Play => ({
  at,
  id: "t1",
  uri: "spotify:track:t1",
  name: "Titre",
  artists: ["A"],
  artistIds: ["a"],
  album: "Album",
  durationMs: 180_000,
  playedMs: 180_000,
  ...overrides,
});

describe("every device of the account", () => {
  it("reads Spotify's recently played, a play starting a track length before it was logged", () => {
    const [p] = fromRecentlyPlayed([
      { played_at: "2026-10-22T20:03:00.000Z", track: { id: "x", uri: "spotify:track:x", name: "Omens", duration_ms: 180_000, artists: [{ id: "a1", name: "Drake" }], album: { id: "al", name: "Album", images: [{ url: "https://i.scdn.co/640", width: 640 }, { url: "https://i.scdn.co/300", width: 300 }] } } },
      { played_at: "pas une date", track: { uri: "spotify:track:y", name: "Y" } },
      { played_at: "2026-10-22T20:00:00.000Z", track: null },
    ]);
    expect(p).toMatchObject({ at: "2026-10-22T20:00:00.000Z", name: "Omens", artists: ["Drake"], artistIds: ["a1"], image: "https://i.scdn.co/300", source: "spotify", playedMs: 180_000 });
  });

  it("counts a play once when this computer and Spotify both report it, but keeps real repeats", () => {
    const local = play("2026-10-22T20:00:10.000Z", { source: "vitrine", playedMs: 60_000 });
    const sameFromSpotify = play("2026-10-22T20:00:00.000Z", { source: "spotify" });
    const laterFromSpotify = play("2026-10-22T21:00:00.000Z", { source: "spotify" });
    expect(newPlays([local], [sameFromSpotify, laterFromSpotify])).toEqual([laterFromSpotify]);
    // the same song three times in a row, from one import: three plays
    const repeats = [0, 3, 6].map((m) => play(`2026-01-01T10:0${m}:00.000Z`, { source: "import" }));
    expect(newPlays([], repeats)).toHaveLength(3);
    // the same file imported twice: nothing new
    expect(newPlays(repeats, repeats)).toHaveLength(0);
  });
});

describe("Spotify's downloadable history", () => {
  it("reads the extended history, leaving out podcasts and plays under 30 s", () => {
    const plays = fromStreamingHistory([
      { ts: "2024-03-01T18:45:00Z", ms_played: 200_000, master_metadata_track_name: "Titre", master_metadata_album_artist_name: "Artiste", master_metadata_album_album_name: "Album", spotify_track_uri: "spotify:track:abc", platform: "Android OS 14 API 34" },
      { ts: "2024-03-01T18:46:00Z", ms_played: 12_000, master_metadata_track_name: "Sauté", master_metadata_album_artist_name: "Artiste", spotify_track_uri: "spotify:track:def" },
      { ts: "2024-03-01T19:00:00Z", ms_played: 900_000, master_metadata_track_name: null, spotify_track_uri: null, episode_name: "Podcast" },
    ]);
    expect(plays).toHaveLength(1);
    expect(plays[0]).toMatchObject({ at: "2024-03-01T18:41:40.000Z", id: "abc", uri: "spotify:track:abc", playedMs: 200_000, source: "import", device: "android" });
  });

  it("reads the yearly history, which has no links", () => {
    const [p] = fromStreamingHistory([{ endTime: "2024-03-01 18:45", artistName: "Artiste", trackName: "Titre", msPlayed: 60_000 }]);
    expect(p).toMatchObject({ at: "2024-03-01T18:44:00.000Z", name: "Titre", artists: ["Artiste"], source: "import" });
    expect(p.uri.startsWith("vitrine:song:")).toBe(true);
  });
});

/** A ZIP archive with these files, the first stored and the others deflated. */
function makeZip(files: { name: string; text: string }[]): Buffer {
  const locals: Buffer[] = [];
  const entries: Buffer[] = [];
  let offset = 0;
  files.forEach(({ name, text }, i) => {
    const raw = Buffer.from(text);
    const method = i === 0 ? 0 : 8;
    const data = method === 0 ? raw : deflateRawSync(raw);
    const nameBytes = Buffer.from(name);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(method, 8);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(nameBytes.length, 26);
    const entry = Buffer.alloc(46);
    entry.writeUInt32LE(0x02014b50, 0);
    entry.writeUInt16LE(method, 10);
    entry.writeUInt32LE(data.length, 20);
    entry.writeUInt32LE(raw.length, 24);
    entry.writeUInt16LE(nameBytes.length, 28);
    entry.writeUInt32LE(offset, 42);
    locals.push(local, nameBytes, data);
    entries.push(entry, nameBytes);
    offset += 30 + nameBytes.length + data.length;
  });
  const directory = Buffer.concat(entries);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, directory, end]);
}

describe("ZIP archive from Spotify", () => {
  it("reads the history files, stored or deflated, and nothing else", () => {
    const zip = makeZip([
      { name: "Spotify Extended Streaming History/Streaming_History_Audio_2023_0.json", text: "[1]" },
      { name: "Spotify Extended Streaming History/Streaming_History_Audio_2024_1.json", text: '[{"a":2}]' },
      { name: "Spotify Extended Streaming History/ReadMeFirst.pdf", text: "pdf" },
    ]);
    const files = readZip(zip, (name) => name.endsWith(".json"));
    expect(files.map((f) => [f.name.split("/")[1], f.data.toString()])).toEqual([
      ["Streaming_History_Audio_2023_0.json", "[1]"],
      ["Streaming_History_Audio_2024_1.json", '[{"a":2}]'],
    ]);
  });

  it("says when a file is no archive", () => {
    expect(() => readZip(Buffer.from("pas un zip du tout, vraiment pas"), () => true)).toThrow(/ZIP/);
  });
});

describe("a Flow that learns", () => {
  const track = { artists: ["Drake", "Lila"], artistIds: ["drake", "lila"] };
  const empty: Taste = { artists: {} };

  it("weighs the main artist fully and the featured ones by half", () => {
    const taste = learn(empty, track, "like");
    expect(scoreOf(taste, "drake")).toBe(3);
    expect(scoreOf(taste, "lila")).toBe(1.5);
    expect(scoreOf(learn(taste, track, "notForMe"), "drake")).toBe(0);
  });

  it("brings liked artists into the seeds and leaves banned ones out", () => {
    let taste = learn(empty, { artists: ["Nouveau"], artistIds: ["new"] }, "like");
    taste = learn(learn(taste, { artists: ["Banni"], artistIds: ["ban"] }, "notForMe"), { artists: ["Banni"], artistIds: ["ban"] }, "skipped");
    const favourites = [
      { id: "fav", uri: "", name: "Favori", genres: [] },
      { id: "ban", uri: "", name: "Banni", genres: [] },
    ];
    expect(seedArtists(favourites, taste).map((a) => a.id)).toEqual(["fav", "new"]);
    const items = [{ track: { artistIds: ["x"] } }, { track: { artistIds: ["ban"] } }, { track: { artistIds: ["new"] } }];
    expect(rankByTaste(items, taste).map((i) => i.track.artistIds[0])).toEqual(["new", "x"]);
  });
});

describe("yearly calendar", () => {
  it("covers 53 weeks from a Monday to today, whatever the period asked", () => {
    const now = Date.parse("2026-10-22T20:00:00");
    const old = new Date("2026-03-03T10:00:00").toISOString();
    const summary = summarize([play(old)], now - 7 * 86_400_000, now);
    expect(summary.plays).toBe(0);
    expect(new Date(`${summary.calendar[0].day}T12:00:00`).getDay()).toBe(1);
    expect(summary.calendar.at(-1)?.day).toBe("2026-10-22");
    expect(summary.calendar.length).toBeGreaterThan(52 * 7);
    expect(summary.calendar.find((d) => d.day === "2026-03-03")?.ms).toBe(180_000);
  });
});

describe("lyrics overlay and its command", () => {
  it("passes only text, cut to size", () => {
    expect(parseOverlayLine({ line: "x".repeat(400), next: 3, title: "T" })).toEqual({ line: "x".repeat(300), next: "", title: "T" });
    expect(parseOverlayLine(null)).toBeNull();
    expect(cliCommand(["vitrine", "--lyrics"])).toBe("lyrics");
  });
});

describe("trash bin", () => {
  it("says why a track is skipped: itself, or one of its artists", async () => {
    const { trashed } = await import("../src/renderer/lib/trash");
    const bin = { tracks: { "spotify:track:x": "Titre X" }, artists: { feat: "Lila" } };
    expect(trashed(bin, { uri: "spotify:track:x", artistIds: ["a"] })).toBe("« Titre X » est à la corbeille");
    expect(trashed(bin, { uri: "spotify:track:y", artistIds: ["a", "feat"] })).toBe("Lila est à la corbeille");
    expect(trashed(bin, { uri: "spotify:track:y", artistIds: ["a"] })).toBeNull();
  });
});
