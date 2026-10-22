import { describe, expect, it } from "vitest";
import { errorMessage, formatTime, formatTotal } from "../src/renderer/lib/format";
import { dominantColor } from "../src/renderer/lib/palette";
import { mapAlbum, mapArtist, mapPlaylist, mapTrack, pickImage, stripHtml, uniqueById } from "../src/renderer/lib/types";
import { currentPosition, startTarget, type PlaybackState } from "../src/renderer/player/engine";

const images = [
  { url: "big", width: 640 },
  { url: "medium", width: 300 },
  { url: "small", width: 64 },
];

describe("Spotify mapping", () => {
  it("picks the smallest image wide enough", () => {
    expect(pickImage(images, 200)).toBe("medium");
    expect(pickImage(images, 1000)).toBe("big");
    expect(pickImage([], 100)).toBeUndefined();
  });

  it("maps a track", () => {
    const track = mapTrack({
      id: "t1",
      uri: "spotify:track:t1",
      name: "Song",
      duration_ms: 1234,
      explicit: true,
      artists: [{ name: "A" }, { name: "B" }],
      album: { id: "al", name: "Album", images },
    });
    expect(track).toMatchObject({ id: "t1", artists: ["A", "B"], albumName: "Album", albumId: "al", image: "medium", imageLarge: "big", explicit: true });
  });

  it("drops removed and local tracks", () => {
    expect(mapTrack(null)).toBeNull();
    expect(mapTrack({ uri: "spotify:local:x", is_local: true })).toBeNull();
  });

  it("maps playlists from either the new items or the old tracks field", () => {
    expect(mapPlaylist({ id: "p", uri: "u", name: "Mix", owner: { display_name: "Ana" }, items: { total: 12 } })).toMatchObject({ subtitle: "Par Ana", total: 12 });
    expect(mapPlaylist({ id: "p", uri: "u", name: "Mix", tracks: { total: 3 }, description: "<a href='x'>Hi</a> &amp; more" })).toMatchObject({ total: 3, description: "Hi & more" });
    expect(mapPlaylist(null)).toBeNull();
  });

  it("maps albums", () => {
    expect(mapAlbum({ id: "a", uri: "u", name: "LP", artists: [{ name: "X" }], release_date: "2024-05-01", total_tracks: 9 })).toMatchObject({ subtitle: "X · 2024", total: 9, kind: "album" });
  });

  it("dedupes by id and strips html", () => {
    expect(uniqueById([{ id: "a" }, { id: "b" }, { id: "a" }])).toEqual([{ id: "a" }, { id: "b" }]);
    expect(stripHtml("<b>Hey</b> &quot;you&quot;")).toBe('Hey "you"');
  });
});

describe("format", () => {
  it("formats durations", () => {
    expect(formatTime(0)).toBe("0:00");
    expect(formatTime(65_000)).toBe("1:05");
    expect(formatTime(3_725_000)).toBe("1:02:05");
    expect(formatTotal(42 * 60_000)).toBe("42 min");
    expect(formatTotal(125 * 60_000)).toBe("2 h 05");
  });

  it("unwraps Electron's IPC errors", () => {
    expect(errorMessage(new Error("Error invoking remote method 'auth:login': Error: Port busy"))).toBe("Port busy");
  });
});

describe("palette", () => {
  it("finds the vivid colour and lifts dark ones", () => {
    const pixels = new Uint8ClampedArray(3 * 3 * 4);
    for (let i = 0; i < 9; i++) pixels.set(i === 4 ? [200, 30, 30, 255] : [90, 90, 90, 255], i * 4);
    expect(dominantColor(pixels, 3, 3)).toEqual([200, 30, 30]);
    const dark = new Uint8ClampedArray(9 * 4).fill(10);
    expect(Math.max(...dominantColor(dark, 3, 3))).toBeGreaterThanOrEqual(139);
  });
});

describe("currentPosition", () => {
  const base: PlaybackState = { sdk: "off", paused: false, positionMs: 1000, durationMs: 5000, updatedAt: 0, shuffle: false, repeat: "off", volume: 1 };
  it("runs on while playing and stops at the end", () => {
    expect(currentPosition(base, 1500)).toBe(2500);
    expect(currentPosition(base, 60_000)).toBe(5000);
    expect(currentPosition({ ...base, paused: true }, 60_000)).toBe(1000);
  });
});

describe("startTarget", () => {
  const remote = { id: "desktop", name: "DESKTOP", type: "Computer", local: false };
  it("plays on this computer when its player is ready, even if another device is active", () => {
    expect(startTarget({ sdk: "ready", localDeviceId: "me", device: remote })).toBe("me");
  });
  it("keeps a device the person chose while it is still active", () => {
    expect(startTarget({ sdk: "ready", localDeviceId: "me", device: remote }, "desktop")).toBe("desktop");
    expect(startTarget({ sdk: "ready", localDeviceId: "me", device: { ...remote, id: "phone" } }, "desktop")).toBe("me");
  });
  it("falls back to the active device without a local player", () => {
    expect(startTarget({ sdk: "off", device: remote })).toBe("desktop");
    expect(startTarget({ sdk: "error", localDeviceId: "me" })).toBeUndefined();
  });
});

describe("artists and links", () => {
  it("keeps artist ids next to names", () => {
    const track = mapTrack({ id: "t", uri: "spotify:track:t", name: "x", artists: [{ id: "a1", name: "A" }, { name: "No id" }] });
    expect(track?.artists).toEqual(["A", "No id"]);
    expect(track?.artistIds).toEqual(["a1"]);
  });

  it("reads followers", () => {
    expect(mapArtist({ id: "a", uri: "u", name: "A", followers: { total: 1234 } })?.followers).toBe(1234);
    expect(mapArtist({ id: "a", uri: "u", name: "A" })?.followers).toBeUndefined();
  });
});
