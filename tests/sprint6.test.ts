import { describe, expect, it, vi } from "vitest";
import { cliCommand } from "../electron/cli";
import { extendLine, parsePlay, playLine, readPlays, toCsv, type Play } from "../electron/historyFile";
import { hookPosition, interleave, isRecent, rotate, songKey, unseenFirst, type FlowItem } from "../src/renderer/lib/flow";
import { formatListening, summarize } from "../src/renderer/lib/listening";
import { storyFileName, wrap } from "../src/renderer/lib/story";
import type { Track } from "../src/renderer/lib/types";
import { countsAsPlay, createPlayTracker } from "../src/renderer/player/history";

const track = (id: string, name = `Titre ${id}`, artists = ["Artiste"]): Track => ({
  id,
  uri: `spotify:track:${id}`,
  name,
  artists,
  artistIds: artists.map((a) => a.toLowerCase()),
  albumName: "Album",
  durationMs: 200_000,
  explicit: false,
});
const item = (id: string, name?: string, artists?: string[]): FlowItem => ({ track: track(id, name, artists), source: "around", reason: "", saved: false });

describe("Flow", () => {
  it("starts long tracks around their first chorus, short ones from the top", () => {
    expect(hookPosition(60_000)).toBe(0);
    expect(hookPosition(200_000)).toBe(60_000);
    expect(hookPosition(100_000)).toBe(30_000);
    // never in the last 30 seconds
    expect(hookPosition(95_000)).toBeLessThanOrEqual(65_000);
  });

  it("treats versions of one song as the same song", () => {
    expect(songKey(track("a", "Mon titre (feat. X)"))).toBe(songKey(track("b", "Mon titre - Remix")));
    expect(songKey(track("a", "Mon titre"))).not.toBe(songKey(track("b", "Mon titre", ["Autre"])));
  });

  it("takes from each source in turn, without repeats or songs set aside", () => {
    const fresh = [item("n1"), item("n2")];
    const around = [item("a1"), item("n1"), item("a2")];
    const forgotten = [item("f1", "Titre a1")];
    const feed = interleave([fresh, around, forgotten], new Set(["a2"]));
    expect(feed.map((i) => i.track.id)).toEqual(["n1", "a1", "n2"]);
  });

  it("knows a recent release, whatever the precision of its date", () => {
    const now = Date.parse("2026-10-22");
    expect(isRecent("2026-09-01", now)).toBe(true);
    expect(isRecent("2026-01-01", now)).toBe(false);
    expect(isRecent("2026", now, 365)).toBe(true);
    expect(isRecent("2026-10", now)).toBe(true);
    expect(isRecent(undefined, now)).toBe(false);
  });

  it("moves along the artists with each round and puts unseen tracks first", () => {
    expect(rotate(["a", "b", "c", "d"], 0, 3)).toEqual(["a", "b", "c"]);
    expect(rotate(["a", "b", "c", "d"], 1, 3)).toEqual(["d", "a", "b"]);
    expect(rotate([], 2, 3)).toEqual([]);
    expect(unseenFirst([item("x"), item("y")], new Set(["x"])).map((i) => i.track.id)).toEqual(["y", "x"]);
  });
});

describe("story", () => {
  const ctx = { measureText: (text: string) => ({ width: text.length * 10 }) as TextMetrics };

  it("wraps a long title on lines that fit, and shortens the last", () => {
    expect(wrap(ctx, "un deux trois quatre", 120, 3)).toEqual(["un deux", "trois quatre"]);
    const lines = wrap(ctx, "un deux trois quatre cinq six sept", 120, 2);
    expect(lines).toHaveLength(2);
    expect(lines[1].endsWith("…")).toBe(true);
    expect(lines.every((line) => line.length * 10 <= 120)).toBe(true);
  });

  it("names the file after the title", () => {
    expect(storyFileName({ name: "Désolé (feat. Ø)!" })).toBe("vitrine-story-desole-feat.png");
    expect(storyFileName({ name: "???" })).toBe("vitrine-story-titre.png");
  });
});

const play = (at: string, overrides: Partial<Play> = {}): Play => ({
  at,
  id: "t1",
  uri: "spotify:track:t1",
  name: "Titre",
  artists: ["A", "B"],
  artistIds: ["a", "b"],
  album: "Album",
  durationMs: 180_000,
  playedMs: 60_000,
  ...overrides,
});

describe("listening history file", () => {
  it("keeps only well-formed plays", () => {
    expect(parsePlay({ at: "pas une date", uri: "x", name: "y" })).toBeNull();
    expect(parsePlay(null)).toBeNull();
    const parsed = parsePlay({ ...play("2026-10-22T10:00:00.000Z"), image: "http://non-https", playedMs: -5 });
    expect(parsed?.image).toBeUndefined();
    expect(parsed?.playedMs).toBe(0);
  });

  it("adds the length of a play written later, and skips broken lines", () => {
    const content = [playLine(play("2026-10-22T10:00:00.000Z")), "{coupé\n", extendLine("2026-10-22T10:00:00.000Z", 170_000), playLine(play("2026-10-22T09:00:00.000Z"))].join("");
    const plays = readPlays(content);
    expect(plays.map((p) => p.at)).toEqual(["2026-10-22T09:00:00.000Z", "2026-10-22T10:00:00.000Z"]);
    expect(plays[1].playedMs).toBe(170_000);
  });

  it("exports a CSV Excel reads, with no formula slipping in", () => {
    const csv = toCsv([play("2026-10-22T10:00:00.000Z", { name: '=HYPERLINK("x")', artists: ["A; B"] })]);
    expect(csv.startsWith("\uFEFFdate;titre;")).toBe(true);
    expect(csv).toContain(`"'=HYPERLINK(""x"")"`);
    expect(csv).toContain('"A; B"');
  });
});

describe("play tracker", () => {
  const state = (overrides: Record<string, unknown> = {}) => ({
    track: track("t1"),
    device: { id: "d", name: "Vitrine", type: "Computer", local: true },
    paused: false,
    positionMs: 0,
    durationMs: 200_000,
    updatedAt: 0,
    ...overrides,
  });

  it("counts a play after 30 seconds, or half of a short track", () => {
    expect(countsAsPlay(29_000, 200_000)).toBe(false);
    expect(countsAsPlay(30_000, 200_000)).toBe(true);
    expect(countsAsPlay(21_000, 40_000)).toBe(true);
  });

  it("writes a play once it counts, then its full length when the next track starts", () => {
    const add = vi.fn();
    const extend = vi.fn();
    const tracker = createPlayTracker(add, extend);
    for (let t = 0; t <= 31_000; t += 1000) tracker.tick(state(), t);
    expect(add).toHaveBeenCalledTimes(1);
    expect(add.mock.calls[0][0]).toMatchObject({ uri: "spotify:track:t1", playedMs: 30_000 });
    for (let t = 32_000; t <= 60_000; t += 1000) tracker.tick(state(), t);
    tracker.tick(state({ track: track("t2"), updatedAt: 61_000 }), 61_000);
    expect(extend).toHaveBeenCalledWith(add.mock.calls[0][0].at, 60_000);
  });

  it("keeps counting when the position jumps back for a moment, and counts a repeat as a new play", () => {
    const add = vi.fn();
    const tracker = createPlayTracker(add, vi.fn());
    for (let t = 0; t <= 31_000; t += 1000) {
      // every few seconds the frozen Web API says 0:00 while the player says 49 s and on
      const positionMs = t % 5000 === 0 ? 0 : 49_000 + t;
      tracker.tick(state({ positionMs, updatedAt: t }), t);
    }
    expect(add).toHaveBeenCalledTimes(1);
    for (let t = 32_000; t <= 40_000; t += 1000) tracker.tick(state({ positionMs: 195_000, updatedAt: t }), t);
    for (let t = 41_000; t <= 75_000; t += 1000) tracker.tick(state({ positionMs: 1000 + (t - 41_000), updatedAt: t }), t);
    expect(add).toHaveBeenCalledTimes(2);
  });

  it("does not count paused time, music on another device, or a sleeping computer", () => {
    const add = vi.fn();
    const tracker = createPlayTracker(add, vi.fn());
    for (let t = 0; t <= 40_000; t += 1000) tracker.tick(state({ paused: true }), t);
    for (let t = 41_000; t <= 80_000; t += 1000) tracker.tick(state({ device: { id: "p", name: "Téléphone", type: "Smartphone", local: false } }), t);
    tracker.tick(state(), 81_000);
    tracker.tick(state(), 81_000 + 3 * 60 * 60_000);
    expect(add).not.toHaveBeenCalled();
  });
});

describe("listening summary", () => {
  const now = Date.parse("2026-10-22T20:00:00");
  const at = (date: string) => new Date(date).toISOString();
  const plays = [
    play(at("2026-10-22T09:00:00"), { playedMs: 120_000 }),
    play(at("2026-10-21T09:30:00"), { playedMs: 60_000 }),
    play(at("2026-10-20T22:00:00"), { uri: "spotify:track:t2", id: "t2", name: "Autre", artists: ["B"], artistIds: ["b"], playedMs: 30_000 }),
    play(at("2026-09-01T12:00:00"), { playedMs: 600_000 }),
  ];

  it("sums up the period: time, plays, favourites and the run of days", () => {
    const summary = summarize(plays, now - 7 * 86_400_000, now);
    expect(summary.plays).toBe(3);
    expect(summary.totalMs).toBe(210_000);
    expect(summary.distinctTracks).toBe(2);
    expect(summary.streak).toBe(3);
    expect(summary.topTracks[0]).toMatchObject({ name: "Titre", plays: 2, ms: 180_000 });
    // B is on both tracks
    expect(summary.topArtists[0]).toMatchObject({ name: "B", plays: 3 });
    // Thursday 22 October, 9 h
    expect(summary.heatmap[3][9]).toBe(120_000);
    expect(summary.recent[0].at).toBe(plays[0].at);
  });

  it("counts everything for all time", () => {
    expect(summarize(plays, 0, now).totalMs).toBe(810_000);
  });

  it("writes listening time the French way", () => {
    expect(formatListening(3 * 3_600_000 + 5 * 60_000)).toBe("3 h 05");
    expect(formatListening(42 * 60_000)).toBe("42 min");
    expect(formatListening(50_000)).toBe("50 s");
  });
});

describe("command line", () => {
  it("finds the command among the arguments Windows passes", () => {
    expect(cliCommand(["C:\\Vitrine\\Vitrine.exe", "--next"])).toBe("next");
    expect(cliCommand(["vitrine", "--hidden", "--play-pause"])).toBe("toggle");
    expect(cliCommand(["vitrine", "--flow"])).toBe("flow");
    expect(cliCommand(["vitrine"])).toBeNull();
  });
});
