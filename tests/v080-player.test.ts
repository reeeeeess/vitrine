import { describe, expect, it } from "vitest";
import { swipeFrom } from "../src/renderer/player/useSwipe";

// the modules below reach the page's storage and the Electron bridge when loaded
const memory = new Map<string, string>();
Object.assign(globalThis, {
  localStorage: { getItem: (k: string) => memory.get(k) ?? null, setItem: (k: string, v: string) => memory.set(k, v), removeItem: (k: string) => memory.delete(k) },
  window: { vitrine: { auth: { token: async () => "t" } } },
});
const { loopJump } = await import("../src/renderer/player/loop");
const { announceDue } = await import("../src/renderer/components/UpNext");

const track = { uri: "spotify:track:a" } as never;

describe("A–B loop and the chorus on repeat (T6)", () => {
  const playing = { track, paused: false, positionMs: 10_000, durationMs: 200_000, updatedAt: 0 };

  it("jumps back to A once past B, on the looped track only", () => {
    const loop = { uri: "spotify:track:a", aMs: 20_000, bMs: 40_000 };
    expect(loopJump(loop, playing, 25_000)).toBeNull(); // 10 s + 25 s → 35 s: before B
    expect(loopJump(loop, playing, 29_000)).toBeNull();
    expect(loopJump(loop, playing, 31_000)).toBe(20_000);
    expect(loopJump({ ...loop, uri: "spotify:track:b" }, playing, 31_000)).toBeNull();
  });

  it("does nothing while only A is set, or on pause", () => {
    expect(loopJump({ uri: "spotify:track:a", aMs: 20_000 }, playing, 99_000)).toBeNull();
    expect(loopJump({ uri: "spotify:track:a", aMs: 0, bMs: 5000 }, { ...playing, paused: true }, 99_000)).toBeNull();
  });
});

describe("swiping the bar to change track (A6)", () => {
  it("counts a horizontal trackpad gesture once it has gone far enough", () => {
    let step = swipeFrom(0, 30, 2);
    expect(step).toEqual({ total: 30 });
    step = swipeFrom(step.total, 45, 1);
    expect(step).toEqual({ total: 0, direction: "next" });
    expect(swipeFrom(0, -80, 0).direction).toBe("previous");
  });

  it("ignores vertical scrolling", () => {
    expect(swipeFrom(50, 10, 40)).toEqual({ total: 0 });
  });
});

describe("« Ensuite » 10 s before the end (P4)", () => {
  it("is due in the last 10 s of a track, not for short sounds", () => {
    expect(announceDue(185_000, 200_000)).toBe(false);
    expect(announceDue(191_000, 200_000)).toBe(true);
    expect(announceDue(199_800, 200_000)).toBe(false);
    expect(announceDue(15_000, 20_000)).toBe(false);
  });
});
