import { describe, expect, it } from "vitest";
import { buildActivity, encodeFrame, FrameReader, Op, socketPaths } from "../electron/discordProtocol";

describe("Discord frames", () => {
  it("encodes opcode, length and JSON", () => {
    const frame = encodeFrame(Op.Handshake, { v: 1, client_id: "42" });
    expect(frame.readUInt32LE(0)).toBe(0);
    expect(frame.readUInt32LE(4)).toBe(frame.length - 8);
    expect(JSON.parse(frame.subarray(8).toString())).toEqual({ v: 1, client_id: "42" });
  });

  it("reads frames split and joined across chunks", () => {
    const a = encodeFrame(Op.Frame, { evt: "READY" });
    const b = encodeFrame(Op.Ping, { n: 1 });
    const both = Buffer.concat([a, b]);
    const reader = new FrameReader();
    expect(reader.push(both.subarray(0, 5))).toEqual([]);
    expect(reader.push(both.subarray(5, a.length + 3))).toEqual([{ op: 1, data: { evt: "READY" } }]);
    expect(reader.push(both.subarray(a.length + 3))).toEqual([{ op: 3, data: { n: 1 } }]);
  });

  it("knows where Discord listens", () => {
    expect(socketPaths("win32", {})[0]).toBe("\\\\?\\pipe\\discord-ipc-0");
    const unix = socketPaths("linux", { XDG_RUNTIME_DIR: "/run/user/1000" });
    expect(unix).toContain("/run/user/1000/discord-ipc-0");
    expect(unix).toContain("/run/user/1000/app/com.discordapp.Discord/discord-ipc-9");
    expect(unix).toHaveLength(30);
  });
});

describe("Listening activity", () => {
  const track = { title: "BBL", artist: "Arma Jackson, Josman", album: "Été sans fin", imageUrl: "https://i.scdn.co/image/x", durationMs: 172_000, positionMs: 60_000, paused: false };

  it("shows title, artist, artwork and a progress bar", () => {
    const activity = buildActivity(track, 1_000_000);
    expect(activity).toMatchObject({ type: 2, details: "BBL", state: "Arma Jackson, Josman", assets: { large_image: "https://i.scdn.co/image/x", large_text: "Été sans fin" } });
    expect(activity.timestamps).toEqual({ start: 940_000, end: 1_112_000 });
  });

  it("drops the progress bar when paused and says so", () => {
    const activity = buildActivity({ ...track, paused: true });
    expect(activity.timestamps).toBeUndefined();
    expect(activity.state).toBe("En pause · Arma Jackson, Josman");
  });

  it("keeps texts within Discord's 2 to 128 characters and ignores non-https art", () => {
    const activity = buildActivity({ ...track, title: "X", artist: "a".repeat(300), imageUrl: "http://x" });
    expect(activity.details).toHaveLength(2);
    expect(activity.state.length).toBeLessThanOrEqual(128);
    expect(activity.assets).not.toHaveProperty("large_image");
  });
});
