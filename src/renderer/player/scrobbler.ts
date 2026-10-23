// Sends to Last.fm what plays on this computer (P7): "listening now" at each new track, and the listen once
// it counts (half the track, or 4 minutes). The main process signs and sends (electron/lastfm.ts).
import type { Track } from "../lib/types";
import { currentPosition, playback } from "./engine";

/** A listen counts for Last.fm once the track (over 30 s) has played for half its length, or 4 minutes. */
export function scrobbleDue(playedMs: number, durationMs: number): boolean {
  return durationMs > 30_000 && playedMs >= Math.min(durationMs / 2, 240_000);
}

export function connectScrobbler(): () => void {
  let connected = false;
  let session: { track: Track; startedAt: number; playedMs: number; sent: boolean } | null = null;
  let last = Date.now();
  const check = () => void window.vitrine.lastfm?.status().then((status) => (connected = status.connected), () => undefined);
  check();
  const statusTimer = setInterval(check, 60_000);
  const timer = setInterval(() => {
    const now = Date.now();
    const gap = Math.min(now - last, 5000);
    last = now;
    const state = playback.get();
    const track = state.track;
    if (!connected || !track || !state.device?.local) return;
    if (!session || session.track.uri !== track.uri) {
      session = { track, startedAt: now - currentPosition(state), playedMs: 0, sent: false };
      void window.vitrine.lastfm.now({ artist: track.artists[0] ?? "", track: track.name, album: track.albumName }).catch(() => undefined);
    }
    if (!state.paused) session.playedMs += gap;
    if (!session.sent && scrobbleDue(session.playedMs, track.durationMs)) {
      session.sent = true;
      void window.vitrine.lastfm
        .scrobble({ artist: track.artists[0] ?? "", track: track.name, album: track.albumName, timestamp: Math.round(session.startedAt / 1000), durationMs: track.durationMs })
        .catch(() => undefined);
    }
  }, 1000);
  return () => {
    clearInterval(timer);
    clearInterval(statusTimer);
  };
}
