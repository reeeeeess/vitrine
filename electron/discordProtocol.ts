// The parts of Discord's local RPC protocol that do not touch a socket, kept apart for the tests.
// A frame is: opcode (uint32 LE), payload length (uint32 LE), then that many bytes of JSON.
import path from "node:path";

export enum Op {
  Handshake = 0,
  Frame = 1,
  Close = 2,
  Ping = 3,
  Pong = 4,
}

export function encodeFrame(op: Op, payload: unknown): Buffer {
  const json = Buffer.from(JSON.stringify(payload), "utf8");
  const header = Buffer.alloc(8);
  header.writeUInt32LE(op, 0);
  header.writeUInt32LE(json.length, 4);
  return Buffer.concat([header, json]);
}

/** Collects socket chunks and hands back whole frames, however the bytes were split. */
export class FrameReader {
  private buffer = Buffer.alloc(0);

  push(chunk: Buffer): { op: number; data: unknown }[] {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    const frames: { op: number; data: unknown }[] = [];
    while (this.buffer.length >= 8) {
      const length = this.buffer.readUInt32LE(4);
      if (this.buffer.length < 8 + length) break;
      const op = this.buffer.readUInt32LE(0);
      const body = this.buffer.subarray(8, 8 + length).toString("utf8");
      this.buffer = this.buffer.subarray(8 + length);
      let data: unknown = null;
      try {
        data = JSON.parse(body);
      } catch {
        // a frame that is not JSON is skipped
      }
      frames.push({ op, data });
    }
    return frames;
  }
}

/** Where Discord listens: a named pipe on Windows, a Unix socket elsewhere (native, Flatpak, Snap). */
export function socketPaths(platform: NodeJS.Platform, env: NodeJS.ProcessEnv): string[] {
  const slots = Array.from({ length: 10 }, (_, i) => `discord-ipc-${i}`);
  if (platform === "win32") return slots.map((slot) => `\\\\?\\pipe\\${slot}`);
  const base = env.XDG_RUNTIME_DIR || env.TMPDIR || env.TMP || env.TEMP || "/tmp";
  const dirs = [base, path.join(base, "app", "com.discordapp.Discord"), path.join(base, "snap.discord")];
  return dirs.flatMap((dir) => slots.map((slot) => path.join(dir, slot)));
}

export interface NowPlaying {
  title: string;
  artist: string;
  album?: string;
  imageUrl?: string;
  durationMs: number;
  positionMs: number;
  paused: boolean;
}

/** Discord rejects texts shorter than 2 or longer than 128 characters. */
function fit(text: string | undefined, fallback: string): string {
  const value = (text ?? "").trim() || fallback;
  const padded = value.length < 2 ? `${value} ` : value;
  return padded.length > 128 ? `${padded.slice(0, 127)}…` : padded;
}

/** The "Listening to" activity for a track, with the progress bar Discord draws from the timestamps. */
export function buildActivity(track: NowPlaying, now = Date.now()) {
  const start = now - Math.max(0, track.positionMs);
  return {
    type: 2, // listening
    details: fit(track.title, "Titre inconnu"),
    state: fit(track.paused ? `En pause · ${track.artist}` : track.artist, "Artiste inconnu"),
    ...(track.paused || track.durationMs <= 0 ? {} : { timestamps: { start, end: start + track.durationMs } }),
    assets: {
      ...(track.imageUrl?.startsWith("https://") ? { large_image: track.imageUrl } : {}),
      large_text: fit(track.album, "Vitrine"),
    },
    instance: false,
  };
}
