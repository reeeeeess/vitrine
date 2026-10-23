import { describe, expect, it } from "vitest";
import { cleanNetease, cleanPlain, normalizeName, parseTtml, pickNetease, rankSources, ttmlTime } from "../electron/lyricsProviders";
import { shiftLines } from "../src/renderer/lib/lrc";
import { stageLyrics } from "../src/renderer/lib/lyricsView";

const memory = new Map<string, string>();
Object.assign(globalThis, {
  localStorage: { getItem: (k: string) => memory.get(k) ?? null, setItem: (k: string, v: string) => memory.set(k, v), removeItem: (k: string) => memory.delete(k) },
});
const { lyricsPrefs, nextSource, offsetLabel, setSongPrefs, timedLines } = await import("../src/renderer/lib/lyricsPrefs");
const { panelShown } = await import("../src/renderer/components/NowPanel");
const { fillPosition, isHeld, plainScroll } = await import("../src/renderer/components/StagedLyrics");

// as AMLL TTML DB files them (APT., shortened): two singers, backing vocals, a Chinese translation, a slip
const DUET = `<tt xmlns="http://www.w3.org/ns/ttml" xmlns:ttm="http://www.w3.org/ns/ttml#metadata"><head><metadata><ttm:agent type="person" xml:id="v1"/><ttm:agent type="other" xml:id="v2"/></metadata></head><body dur="02:49.000"><div begin="00:05.054" end="02:41.269">
<p begin="00:22.988" end="00:24.706" ttm:agent="v1"><span begin="00:22.988" end="00:23.199">I'm</span> <span begin="00:23.199" end="00:23.398">trying</span> <span begin="00:24.417" end="00:24.706">real</span><span ttm:role="x-bg" begin="00:25.012" end="00:26.007"><span begin="00:25.012" end="00:25.186">(Uh</span> <span begin="00:25.644" end="00:26.007">huh)</span></span><span ttm:role="x-translation" xml:lang="zh-CN">但我想献上真实一吻</span></p>
<p begin="01:01.427" end="01:03.404" ttm:agent="v2"><span begin="01:01.427" end="01:01.622">Turn</span> <span begin="01:01.912" end="01:02.017">아</span><span begin="01:02.017" end="01:02.156">파</span><span begin="01:02.156" end="01:02.359">트</span> <span begin="01:03.000" end="01:03.404">club</span></p>
<p begin="02:33.146" end="02:35.143" ttm:agent="v2"><span begin="02:33.146" end="02:33.255">Just</span> <span begin="02:34.041" end="02:34.487">at</span> <span begin="00:00.000" end="00:00.000">the</span></p>
<p begin="02:40.000" end="02:41.000" ttm:agent="v1">Tom &amp; Jerry</p>
</div></body></tt>`;

describe("AMLL's TTML: word by word, duets, backing vocals", () => {
  const lines = parseTtml(DUET);

  it("reads TTML times", () => {
    expect(ttmlTime("00:36.413")).toBe(36_413);
    expect(ttmlTime("1:02:03.5")).toBe(3_723_500);
    expect(ttmlTime("62.3s")).toBe(62_300);
    expect(ttmlTime("abc")).toBeNull();
  });

  it("times each word, and keeps the backing vocals apart, without parentheses nor the translation", () => {
    expect(lines[0]).toMatchObject({ timeMs: 22_988, endMs: 24_706, text: "I'm trying real" });
    expect(lines[0].words.map((w) => [w.text, w.timeMs, w.endMs])).toEqual([
      ["I'm", 22_988, 23_199],
      ["trying", 23_199, 23_398],
      ["real", 24_417, 24_706],
    ]);
    expect(lines[0].backing?.text).toBe("Uh huh");
    expect(lines[0].backing?.words[0]).toMatchObject({ text: "Uh", timeMs: 25_012 });
    expect(lines[0].side).toBeUndefined();
  });

  it("puts the second singer on the right, and glues syllables without a space", () => {
    expect(lines[1].side).toBe("right");
    expect(lines[1].text).toBe("Turn 아파트 club");
    expect(lines[1].words.map((w) => w.glue ?? false)).toEqual([false, true, true, false, false]);
  });

  it("mends a word timed 0 in the middle of the song, and reads a line without word times", () => {
    const slipped = lines[2].words[2];
    expect(slipped.timeMs).toBe(34_487 + 120_000);
    expect(slipped.endMs).toBeGreaterThan(slipped.timeMs);
    expect(lines[3]).toMatchObject({ text: "Tom & Jerry", timeMs: 160_000, endMs: 161_000 });
    expect(lines[3].words).toHaveLength(3);
  });

  it("keeps Chinese characters together, one syllable each", () => {
    const chinese = parseTtml(`<tt><head><ttm:agent type="person" xml:id="v1"/></head><body><p begin="00:36.413" end="00:38.837" ttm:agent="v1"><span begin="00:36.413" end="00:36.713">前</span><span begin="00:36.713" end="00:36.881">尘</span></p></body></tt>`);
    expect(chinese[0].text).toBe("前尘");
  });

  it("stages TTML lines with their own times, side and backing", () => {
    const entries = stageLyrics(lines);
    const first = entries.find((entry) => entry.kind === "line");
    expect(first).toMatchObject({ kind: "line", endMs: 24_706, main: "I'm trying real", backing: "Uh huh" });
    expect(first && first.kind === "line" && first.backingWords?.length).toBe(2);
    const second = entries.filter((entry) => entry.kind === "line")[1];
    expect(second && second.kind === "line" && second.side).toBe("right");
    // silences longer than 5 s between lines get their dots, from the end of the line before
    expect(entries.some((entry) => entry.kind === "gap" && entry.timeMs === 24_706)).toBe(true);
  });
});

describe("NetEase", () => {
  it("takes the credits out, and the non-breaking spaces", () => {
    const lrc = `{"t":0,"c":[{"tx":"作词: "},{"tx":"Vacra"}]}\n[00:00.000] 作词 : Vacra/La Rvfleuze\n[00:00.242] 作曲 : Puch'K\n[00:00.484]T'inquiète, j'vais faire ça bien\n[00:19.225]J'ai vu maman pleurer`;
    const result = cleanNetease(lrc)!;
    expect(result.synced).toBe("[00:00.484]T'inquiète, j'vais faire ça bien\n[00:19.225]J'ai vu maman pleurer");
    expect(result.plain).toBe("T'inquiète, j'vais faire ça bien\nJ'ai vu maman pleurer");
  });

  it("knows pure music, and lyrics that are not really synced", () => {
    expect(cleanNetease("[00:00.000] 纯音乐，请欣赏")).toEqual({ synced: null, plain: null, instrumental: true });
    expect(cleanNetease("[00:00.000]Une ligne\n[00:00.000]Une autre")?.synced).toBeNull();
    expect(cleanNetease("[00:00.000] 作词 : X")).toBeNull();
  });

  it("only takes a search result that is surely the song", () => {
    const songs = [
      { id: 1, name: "Fille à Papa (Remix)", ar: [{ name: "Vacra" }], dt: 169_586 },
      { id: 2, name: "Fille à Papa", ar: [{ name: "Autre" }], dt: 169_586 },
      { id: 3, name: "Fille a Papa", ar: [{ name: "Vacra" }, { name: "La Rvfleuze" }], dt: 170_100 },
      { id: 4, name: "Fille à Papa", ar: [{ name: "Vacra" }], dt: 200_000 },
    ];
    expect(pickNetease(songs, { track: "Fille à Papa", artist: "Vacra", durationMs: 169_600 })?.id).toBe(3);
    expect(pickNetease(songs, { track: "Tiki Taka", artist: "Vacra", durationMs: 169_600 })).toBeNull();
    // a remix is another version, unless that is what plays
    expect(pickNetease(songs.slice(0, 1), { track: "Fille à Papa", artist: "Vacra", durationMs: 169_600 })).toBeNull();
    expect(pickNetease(songs.slice(0, 1), { track: "Fille à Papa - Remix", artist: "Vacra", durationMs: 169_600 })?.id).toBe(1);
    expect(normalizeName("Fille à Papa (feat. La Rvfleuze) - Remastered 2024")).toBe("fille a papa");
  });
});

describe("the other sources", () => {
  it("cleans lyrics.ovh's text", () => {
    expect(cleanPlain("Paroles de la chanson Alors on danse par Stromae\n[Refrain]\nAlors on danse\n\n\n\nAlors on danse")).toBe("Alors on danse\n\nAlors on danse");
    expect(cleanPlain("[Intro]\n")).toBeNull();
  });

  it("ranks word by word first, then synced, instrumental, text; the sources' order breaks ties", () => {
    const synced = { synced: "[00:01.00]a", plain: "a", instrumental: false };
    const ranked = rankSources({
      lyricsovh: { synced: null, plain: "a", instrumental: false },
      netease: synced,
      lrclib: synced,
      amll: { ...synced, synced: null, lines: [{ timeMs: 0, endMs: 1, text: "a", words: [] }] },
    });
    expect(ranked).toEqual([
      { source: "amll", kind: "word" },
      { source: "lrclib", kind: "synced" },
      { source: "netease", kind: "synced" },
      { source: "lyricsovh", kind: "plain" },
    ]);
    expect(rankSources({ netease: synced, lrclib: null }, ["amll", "lrclib", "lyricsovh"])).toEqual([]);
  });
});

describe("the person's choices for a song", () => {
  it("goes to the next source, around, and none when alone", () => {
    const sources = [{ source: "amll" as const }, { source: "lrclib" as const }, { source: "netease" as const }];
    expect(nextSource(sources, "amll")).toBe("lrclib");
    expect(nextSource(sources, "netease")).toBe("amll");
    expect(nextSource([{ source: "lrclib" as const }], "lrclib")).toBeNull();
  });

  it("keeps an offset per song, forgets it at 0, and says it the French way", () => {
    setSongPrefs("spotify:track:a", { offsetMs: 250 });
    setSongPrefs("spotify:track:a", { offsetMs: 500 });
    expect(lyricsPrefs.get().songs["spotify:track:a"]).toEqual({ offsetMs: 500 });
    setSongPrefs("spotify:track:a", { offsetMs: 0 });
    expect(lyricsPrefs.get().songs["spotify:track:a"]).toBeUndefined();
    expect(offsetLabel(250)).toBe("+0,25 s");
    expect(offsetLabel(-1500)).toBe("−1,5 s");
    expect(offsetLabel(0)).toBe("");
  });

  it("moves every time by the offset, words and backing vocals too", () => {
    const [line] = shiftLines([{ timeMs: 1000, endMs: 2000, text: "a b", words: [{ text: "a", timeMs: 1000, endMs: 1500 }], backing: { text: "c", words: [{ text: "c", timeMs: 1800, endMs: 1900 }] } }], 250);
    expect(line).toMatchObject({ timeMs: 1250, endMs: 2250, words: [{ timeMs: 1250, endMs: 1750 }], backing: { words: [{ timeMs: 2050, endMs: 2150 }] } });
    expect(timedLines({ synced: "[00:01.00]Salut", plain: null, instrumental: false }, -500)[0]).toMatchObject({ timeMs: 500, text: "Salut" });
  });
});

describe("the look of the lyrics", () => {
  it("shows a word wholly dim before, wholly lit after (no white sliver)", () => {
    // the word sees 1/2.5 of the gradient: at 0 it must start past the soft edge (55%), at 1 end before it (45%)
    const seen = (amount: number) => {
      const p = Number.parseFloat(fillPosition(amount)) / 100;
      return [(1.5 * p) / 2.5, (1.5 * p + 1) / 2.5];
    };
    expect(seen(0)[0]).toBeGreaterThanOrEqual(0.55 - 1e-6);
    expect(seen(1)[1]).toBeLessThanOrEqual(0.45 + 1e-6);
  });

  it("makes long held words glow, not long words sung fast", () => {
    expect(isHeld({ text: "baby", startMs: 0, endMs: 1200 })).toBe(true);
    expect(isHeld({ text: "baby", startMs: 0, endMs: 400 })).toBe(false);
    expect(isHeld({ text: "anticonstitutionnellement", startMs: 0, endMs: 1500 })).toBe(false);
  });

  it("scrolls plain lyrics along with the song", () => {
    expect(plainScroll(0, 200_000, 1000)).toBe(0);
    expect(plainScroll(200_000, 200_000, 1000)).toBe(1000);
    expect(plainScroll(94_000, 200_000, 1000)).toBeCloseTo(477.78, 1);
  });

  it("opens the panel on a screen on its side or very wide, never too narrow", () => {
    expect(panelShown("auto", 1080, 1920)).toBe(true);
    expect(panelShown("auto", 1600, 900)).toBe(false);
    expect(panelShown("auto", 1920, 1080)).toBe(true);
    expect(panelShown("on", 1200, 800)).toBe(true);
    expect(panelShown("on", 900, 1600)).toBe(false);
    expect(panelShown("off", 1080, 1920)).toBe(false);
  });
});

describe("the microphone (Apple Music Sing)", async () => {
  const { EFFECT_SETTINGS, levelOf, MIC_EFFECTS } = await import("../src/renderer/player/microphone");

  it("has an effect setting for each choice, quieter repeats for the echo", () => {
    for (const { key } of MIC_EFFECTS) expect(EFFECT_SETTINGS[key]).toBeDefined();
    for (const settings of Object.values(EFFECT_SETTINGS)) expect(settings.feedback).toBeLessThan(0.6);
    expect(EFFECT_SETTINGS.none.reverb + EFFECT_SETTINGS.none.echo).toBe(0);
  });

  it("reads silence as 0 and a loud voice as full", () => {
    expect(levelOf(new Float32Array(256))).toBe(0);
    expect(levelOf(new Float32Array(256).fill(0.5))).toBe(1);
    expect(levelOf(new Float32Array(256).fill(0.05))).toBeCloseTo(0.2, 5);
  });
});
