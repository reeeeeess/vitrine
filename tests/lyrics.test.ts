import { describe, expect, it } from "vitest";
import { pickBest, toResult } from "../electron/lyricsMatch";
import { activeLineIndex, parseLrc } from "../src/renderer/lib/lrc";

describe("parseLrc", () => {
  it("reads timestamps, fractions and tags", () => {
    const lines = parseLrc("[ar:Someone]\n[00:12.50]Hello\n[01:02.05] World \n[00:00.5]Start");
    expect(lines).toEqual([
      { timeMs: 500, text: "Start" },
      { timeMs: 12_500, text: "Hello" },
      { timeMs: 62_050, text: "World" },
    ]);
  });

  it("repeats a line with several timestamps and keeps empty breaks", () => {
    const lines = parseLrc("[00:10.00][00:30.00]Chorus\n[00:20.000]");
    expect(lines.map((line) => [line.timeMs, line.text])).toEqual([
      [10_000, "Chorus"],
      [20_000, ""],
      [30_000, "Chorus"],
    ]);
  });

  it("applies the offset tag", () => {
    expect(parseLrc("[offset:+500]\n[00:10.00]Early")[0].timeMs).toBe(9_500);
    expect(parseLrc("[offset:-250]\n[00:10.00]Late")[0].timeMs).toBe(10_250);
  });
});

describe("activeLineIndex", () => {
  const lines = parseLrc("[00:01.00]a\n[00:05.00]b\n[00:09.00]c");
  it("finds the line being sung", () => {
    expect(activeLineIndex(lines, 0)).toBe(-1);
    expect(activeLineIndex(lines, 1000)).toBe(0);
    expect(activeLineIndex(lines, 7000)).toBe(1);
    expect(activeLineIndex(lines, 60_000)).toBe(2);
    expect(activeLineIndex([], 1000)).toBe(-1);
  });
});

describe("pickBest", () => {
  it("prefers synced lyrics of the right length", () => {
    const best = pickBest(
      [
        { duration: 200, plainLyrics: "plain" },
        { duration: 260, syncedLyrics: "[00:01.00]other version" },
        { duration: 201, syncedLyrics: "[00:01.00]right" },
      ],
      200_000,
    );
    expect(best?.syncedLyrics).toContain("right");
  });

  it("returns nothing when no record fits", () => {
    expect(pickBest([{ duration: 300, syncedLyrics: "x" }], 200_000)).toBeNull();
    expect(pickBest([{ duration: 200 }], 200_000)).toBeNull();
  });

  it("maps records to results", () => {
    expect(toResult({ plainLyrics: "  la  ", syncedLyrics: "", instrumental: false })).toEqual({ synced: null, plain: "la", instrumental: false });
  });
});
