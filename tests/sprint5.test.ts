import { afterEach, describe, expect, it, vi } from "vitest";
import { accentFromColor } from "../src/renderer/lib/theme";
import { playback } from "../src/renderer/player/engine";
import { setSleepTimer, sleepTimer } from "../src/renderer/player/sleepTimer";
import type { Track } from "../src/renderer/lib/types";

const track = (uri: string): Track => ({ id: uri, uri, name: uri, artists: ["A"], artistIds: [], albumName: "", durationMs: 1000, explicit: false });

describe("accent from the artwork", () => {
  it("keeps text readable: dark ink on light colours, white on dark ones", () => {
    expect(accentFromColor([250, 220, 120])["--c-accent-fg"]).toBe("10 9 8");
    expect(accentFromColor([140, 20, 30])["--c-accent-fg"]).toBe("255 255 255");
  });
  it("uses the colour for actions and a lighter one for text", () => {
    const accent = accentFromColor([200, 40, 40]);
    expect(accent["--c-red-600"]).toBe("200 40 40");
    expect(accent["--c-red-400"]).toBe("219 115 115");
  });
});

describe("sleep timer", () => {
  afterEach(() => {
    setSleepTimer(null);
    vi.useRealTimers();
  });

  it("counts down minutes, then clears itself", async () => {
    vi.useFakeTimers();
    playback.set({ paused: true, track: track("spotify:track:a") });
    setSleepTimer(15);
    expect(sleepTimer.get().endsAt).toBeGreaterThan(Date.now());
    await vi.advanceTimersByTimeAsync(15 * 60_000);
    expect(sleepTimer.get().endsAt).toBeNull();
  });

  it("at the end of the track, stops when the next one starts", async () => {
    playback.set({ paused: true, track: track("spotify:track:a") });
    setSleepTimer("track");
    expect(sleepTimer.get().endOfTrack).toBe(true);
    playback.set({ track: track("spotify:track:a") }); // same track: still waiting
    expect(sleepTimer.get().endOfTrack).toBe(true);
    playback.set({ track: track("spotify:track:b") });
    await Promise.resolve();
    expect(sleepTimer.get().endOfTrack).toBe(false);
  });

  it("can be cancelled", () => {
    playback.set({ track: track("spotify:track:a") });
    setSleepTimer(30);
    setSleepTimer(null);
    expect(sleepTimer.get()).toEqual({ endsAt: null, endOfTrack: false });
  });
});
