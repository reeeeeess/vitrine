import { describe, expect, it } from "vitest";
import { parseLrc } from "../src/renderer/lib/lrc";
import { fill, lineLook, splitBacking, stageLyrics, wordTimes } from "../src/renderer/lib/lyricsView";
import { needsRomanization, romanize } from "../src/renderer/lib/romanize";

describe("lyrics staged like Apple Music's", () => {
  it("puts dots in the intro and in silences of 5 s or more, not in short breaths (B1)", () => {
    const entries = stageLyrics([
      { timeMs: 12_000, text: "first line here" },
      { timeMs: 14_000, text: "" },
      { timeMs: 15_000, text: "second line" },
      { timeMs: 40_000, text: "after the solo" },
    ]);
    expect(entries.map((entry) => entry.kind)).toEqual(["gap", "line", "line", "gap", "line"]);
    expect(entries[0]).toMatchObject({ kind: "gap", timeMs: 0, endMs: 12_000 });
    expect(entries[3]).toMatchObject({ kind: "gap", endMs: 40_000 });
    // a blank LRCLIB line is no silence of its own: no dots for a 3 s gap
    expect(stageLyrics([{ timeMs: 1000, text: "a b" }, { timeMs: 4000, text: "" }, { timeMs: 6000, text: "c" }]).filter((e) => e.kind === "gap")).toHaveLength(0);
  });

  it("sets backing vocals apart, but not credits or repeats (B3)", () => {
    expect(splitBacking("I'm on my way (on my way)")).toEqual({ main: "I'm on my way", backing: "on my way" });
    expect(splitBacking("(Ooh, ooh)")).toEqual({ main: "", backing: "Ooh, ooh" });
    expect(splitBacking("Tout l'été (feat. Tiakola)")).toEqual({ main: "Tout l'été (feat. Tiakola)", backing: "" });
    expect(splitBacking("Encore une fois (x2)").backing).toBe("");
  });

  it("times each word: the file's own times, or shared out by word length (B2)", () => {
    const [line] = parseLrc("[00:10.00] <00:10.00> Never <00:10.60> gonna <00:11.20> give");
    expect(line.text).toBe("Never gonna give");
    expect(wordTimes(line, line.text, 12_000)).toEqual([
      { text: "Never", startMs: 10_000, endMs: 10_600 },
      { text: "gonna", startMs: 10_600, endMs: 11_200 },
      { text: "give", startMs: 11_200, endMs: 12_000 },
    ]);
    const estimated = wordTimes({ timeMs: 0, text: "a bbbbbbb" }, "a bbbbbbb", 1000);
    expect(estimated[0].endMs).toBe(200);
    expect(estimated[1]).toMatchObject({ startMs: 200, endMs: 1000 });
    expect(fill(200, 1000, 600)).toBe(0.5);
  });

  it("blurs and shrinks the lines with their distance to the sung one (B5)", () => {
    expect(lineLook(0)).toEqual({ blur: 0, scale: 1, opacity: 1 });
    expect(lineLook(-2).blur).toBeCloseTo(1.2);
    expect(lineLook(9).blur).toBeCloseTo(2.4);
    expect(lineLook(3).scale).toBeCloseTo(0.94);
    expect(lineLook(20).opacity).toBe(0.22);
  });
});

describe("pronunciation in Latin letters (B8)", () => {
  it("reads Korean, carrying a final consonant over to a following vowel", () => {
    expect(romanize("사랑해")).toBe("saranghae");
    expect(romanize("음악")).toBe("eumak");
    expect(romanize("안녕하세요")).toBe("annyeonghaseyo");
    expect(romanize("한국어")).toBe("hangugeo");
  });

  it("reads Japanese kana, small kana and doubled consonants included; kanji stay", () => {
    expect(romanize("ありがとう")).toBe("arigatou");
    expect(romanize("きゃりーぱみゅぱみゅ")).toBe("kyariipamyupamyu");
    expect(romanize("がっこう")).toBe("gakkou");
    expect(romanize("カタカナ")).toBe("katakana");
    expect(romanize("ちょっと待って")).toBe("chotto待tte");
  });

  it("reads Cyrillic and Greek letter by letter, capitals kept", () => {
    expect(romanize("Привет, мир")).toBe("Privet, mir");
    expect(romanize("Щастя")).toBe("Shchastya");
    expect(romanize("Ελλάδα")).toBe("Ellada");
  });

  it("leaves Latin lines alone, and offers itself only for songs mostly in another script", () => {
    expect(romanize("Bonjour")).toBeNull();
    expect(needsRomanization(["사랑해", "I love you", "사랑해"])).toBe(true);
    expect(needsRomanization(["Hello", "Bonjour", "Hola", "안녕"])).toBe(false);
  });
});
