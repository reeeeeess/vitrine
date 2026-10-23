import { describe, expect, it, vi } from "vitest";

vi.mock("electron", () => ({ net: { fetch: vi.fn() }, BrowserWindow: class {}, screen: {} }));

const { LEAN_FLAGS } = await import("../electron/browserPlayer");
const { fromPlayer, fromSdkState } = await import("../electron/remote");
const { autoReason, effective } = await import("../src/renderer/lib/lite");
const { aurora } = await import("../src/renderer/components/LyricsStage");
const { fill, sungLength } = await import("../src/renderer/lib/lyricsView");
const { stopOffset } = await import("../src/renderer/components/Roulette");

describe("lighter browser player", () => {
  it("leaves the component updater alone: it installs the Widevine module", () => {
    expect(LEAN_FLAGS).not.toContain("--disable-component-update");
    expect(LEAN_FLAGS).not.toContain("--disable-background-networking");
    expect(LEAN_FLAGS).toContain("--disable-extensions");
    expect(LEAN_FLAGS.filter((flag) => flag.startsWith("--disable-features="))).toHaveLength(1);
  });
});

describe("light mode (after Movix)", () => {
  it("turns on by itself on a modest computer or when less motion is asked for", () => {
    expect(autoReason({ hardwareConcurrency: 8, deviceMemory: 8 }, true)).toBe("reducedMotion");
    expect(autoReason({ hardwareConcurrency: 2, deviceMemory: 8 }, false)).toBe("cpu");
    expect(autoReason({ hardwareConcurrency: 8, deviceMemory: 4 }, false)).toBe("memory");
    expect(autoReason({ hardwareConcurrency: 8, deviceMemory: 8 }, false)).toBeNull();
  });

  it("keeps what the person chose unless the light mode is on", () => {
    const chosen = { backdrops: true, blur: false, transitions: true, autoplay: true };
    expect(effective("off", "cpu", chosen)).toEqual(chosen);
    expect(effective("auto", null, chosen)).toEqual(chosen);
    expect(Object.values(effective("auto", "memory", chosen)).every((on) => !on)).toBe(true);
    expect(Object.values(effective("on", null, chosen)).every((on) => !on)).toBe(true);
  });
});

describe("the main process answering for a freed page", () => {
  it("reads what plays from the Web API", () => {
    const playing = fromPlayer({
      is_playing: true,
      progress_ms: 42_000,
      item: { id: "t", name: "Omens", duration_ms: 180_000, artists: [{ name: "Drake" }], album: { name: "A", images: [{ url: "https://i.scdn.co/640", width: 640 }, { url: "https://i.scdn.co/300", width: 300 }] } },
    });
    expect(playing).toMatchObject({ title: "Omens", artist: "Drake", trackId: "t", imageUrl: "https://i.scdn.co/300", positionMs: 42_000, paused: false });
    expect(fromPlayer({ is_playing: false })).toBeNull();
  });

  it("reads what plays from the browser player's own state", () => {
    const playing = fromSdkState({ paused: true, position: 1000, duration: 2000, track_window: { current_track: { id: "x", name: "BBL", artists: [{ name: "A" }, { name: "B" }], album: { name: "Al", images: [] } } } });
    expect(playing).toMatchObject({ title: "BBL", artist: "A, B", paused: true, durationMs: 2000 });
    expect(fromSdkState(null)).toBeNull();
  });
});

describe("karaoke lyrics (after Musix)", () => {
  const lines = [
    { timeMs: 10_000, text: "un deux trois quatre" },
    { timeMs: 30_000, text: "cinq" },
  ];

  it("fills a line at an even pace, over the time its words take before a long silence", () => {
    const progress = (position: number) => fill(lines[0].timeMs, lines[0].timeMs + sungLength(lines[0], lines[1]?.timeMs), position);
    expect(progress(10_000)).toBe(0);
    // four words: 1.8 s at least, here 4 × 380 ms → 1.8 s
    expect(progress(10_900)).toBeCloseTo(0.5, 1);
    expect(progress(25_000)).toBe(1);
  });

  it("draws three aurora colours from the artwork's", () => {
    const [base, light, shifted] = aurora([200, 40, 20]);
    expect(base).toBe("200 40 20");
    expect(light.split(" ").map(Number).every((c, i) => c >= [200, 40, 20][i])).toBe(true);
    expect(shifted).toBe("20 200 40");
  });
});

describe("roulette (after Movix)", () => {
  it("stops with the picked choice of the last lap under the marker", () => {
    // 10 choices, 6 laps, cards of 148 px every 160 px, a 1000 px window: the card's centre at 500 px
    const offset = stopOffset(10, 3, 1000);
    expect(offset + 1000 / 2 - 148 / 2).toBe((10 * 5 + 3) * 160);
  });
});
