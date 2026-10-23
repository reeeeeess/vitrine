// Last.fm's rules, free of Electron for the tests: how a call is signed, and how listens are sent.
import { createHash } from "node:crypto";

/**
 * Last.fm's signature: every parameter but `format` and `callback`, sorted by name, written name then value
 * one after the other, the shared secret at the end, all in MD5.
 */
export function signature(params: Record<string, string>, secret: string): string {
  const text = Object.keys(params)
    .filter((key) => key !== "format" && key !== "callback")
    .sort()
    .map((key) => `${key}${params[key]}`)
    .join("");
  return createHash("md5").update(text + secret, "utf8").digest("hex");
}

export interface Scrobble {
  artist: string;
  track: string;
  album?: string;
  /** when it started, in seconds since 1970 (Last.fm's way) */
  timestamp: number;
  durationMs: number;
}

/** The fields of a batch of scrobbles: artist[0], track[0]… up to 50 at once. */
export function scrobbleParams(list: Scrobble[]): Record<string, string> {
  const params: Record<string, string> = {};
  list.slice(0, 50).forEach((item, i) => {
    params[`artist[${i}]`] = item.artist;
    params[`track[${i}]`] = item.track;
    params[`timestamp[${i}]`] = String(item.timestamp);
    params[`duration[${i}]`] = String(Math.round(item.durationMs / 1000));
    if (item.album) params[`album[${i}]`] = item.album;
  });
  return params;
}
