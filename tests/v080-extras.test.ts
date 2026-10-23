import { describe, expect, it } from "vitest";
import { cleanMoments } from "../electron/moments";
import { angleDelta, angleOf, clampIndex, wheelSteps, zoneOf } from "../src/renderer/lib/classic";

const memory = new Map<string, string>();
Object.assign(globalThis, {
  localStorage: { getItem: (k: string) => memory.get(k) ?? null, setItem: (k: string, v: string) => memory.set(k, v), removeItem: (k: string) => memory.delete(k) },
  window: { vitrine: { auth: { token: async () => "t" } } },
});
const { reachedMoment } = await import("../src/renderer/lib/moments");

describe("Vitrine Classic's click wheel (T9)", () => {
  it("measures angles around the centre, clockwise on screen", () => {
    expect(angleOf(110, 100, 100, 100)).toBe(0);
    expect(angleOf(100, 110, 100, 100)).toBe(90);
    expect(angleOf(90, 100, 100, 100)).toBe(180);
    expect(angleOf(100, 90, 100, 100)).toBe(270);
    expect(angleDelta(350, 10)).toBe(20);
    expect(angleDelta(10, 350)).toBe(-20);
  });

  it("moves one notch every 24°, keeping the rest for the next move", () => {
    expect(wheelSteps(0, 30)).toEqual({ steps: 1, rest: 6 });
    expect(wheelSteps(6, 20)).toEqual({ steps: 1, rest: 2 });
    expect(wheelSteps(0, -50)).toEqual({ steps: -2, rest: -2 });
    expect(clampIndex(-1, 5)).toBe(0);
    expect(clampIndex(9, 5)).toBe(4);
  });

  it("knows its four buttons: MENU on top, next on the right, play below, previous on the left", () => {
    expect(zoneOf(270)).toBe("menu");
    expect(zoneOf(0)).toBe("next");
    expect(zoneOf(350)).toBe("next");
    expect(zoneOf(90)).toBe("play");
    expect(zoneOf(180)).toBe("previous");
  });
});

describe("Moments (P3)", () => {
  const mark = { id: "m1", uri: "spotify:track:abc", name: "Titre", artists: ["A"], atMs: 102_000, note: "le drop", createdAt: "2026-10-23T00:00:00Z" };

  it("keeps only real moments of Spotify tracks", () => {
    expect(cleanMoments([mark, { ...mark }, { ...mark, id: "x", uri: "file:///etc" }, { ...mark, id: "y", atMs: -5 }, { ...mark, id: "z", note: "n".repeat(400), image: "http://insecure" }])).toEqual([
      mark,
      { ...mark, id: "z", note: "n".repeat(280) },
    ]);
    expect(cleanMoments("nope")).toEqual([]);
  });

  it("says when the song reaches a moment again, not when jumping far", () => {
    expect(reachedMoment([mark], mark.uri, 101_600, 102_100)).toBe(mark);
    expect(reachedMoment([mark], mark.uri, 102_100, 102_600)).toBeNull();
    expect(reachedMoment([mark], "spotify:track:other", 101_600, 102_100)).toBeNull();
    expect(reachedMoment([mark], mark.uri, 50_000, 102_100)).toBeNull();
    // the moment just made is not announced at once
    expect(reachedMoment([{ ...mark, createdAt: new Date().toISOString() }], mark.uri, 101_600, 102_100)).toBeNull();
  });
});
