// Writes what plays on this computer to the listening history (electron/history.ts), once a play
// counts: 30 seconds, or half of a shorter track. Only the time the music really plays here counts.
import type { HistoryPlay } from "../global";
import type { Track } from "../lib/types";
import { currentPosition, playback, type PlaybackState } from "./engine";

const COUNTS_AFTER_MS = 30_000;
const TICK_MS = 1000;
/** a hidden window ticks as rarely as once a minute: longer gaps are a sleeping computer */
const MAX_GAP_MS = 70_000;

export function countsAsPlay(playedMs: number, durationMs: number): boolean {
  return playedMs >= Math.min(COUNTS_AFTER_MS, durationMs > 0 ? durationMs / 2 : COUNTS_AFTER_MS);
}

interface Session {
  track: Track;
  at: string;
  playedMs: number;
  recorded: boolean;
  position: number;
}

export interface PlayTracker {
  tick(state: Pick<PlaybackState, "track" | "device" | "paused" | "positionMs" | "durationMs" | "updatedAt">, now: number): void;
  /** the play going on ends: its full length is written */
  finish(): void;
}

export function createPlayTracker(add: (play: HistoryPlay) => void, extend: (at: string, playedMs: number) => void): PlayTracker {
  let session: Session | null = null;
  let last: number | null = null;

  const finish = () => {
    if (session?.recorded) extend(session.at, Math.round(session.playedMs));
    session = null;
  };

  return {
    finish,
    tick(state, now) {
      const gap = last === null ? 0 : now - last;
      last = now;
      const track = state.track;
      // music on another device is not listening on this computer
      if (!track || !state.device?.local) {
        finish();
        return;
      }
      const position = currentPosition(state, now);
      // a new track, or the same one again from its start after it reached its end (repeat); a
      // position that jumps back on its own (Spotify's API reports 0 for a moment) is no new play
      const restarted = session !== null && session.track.uri === track.uri && position < 5000 && session.position > track.durationMs - 15_000;
      if (!session || session.track.uri !== track.uri || restarted) {
        finish();
        session = { track, at: new Date(now - Math.min(position, 60 * 60_000)).toISOString(), playedMs: 0, recorded: false, position };
      }
      session.position = position;
      if (state.paused || gap <= 0 || gap > MAX_GAP_MS) return;
      session.playedMs += gap;
      if (!session.recorded && countsAsPlay(session.playedMs, track.durationMs)) {
        session.recorded = true;
        add({
          at: session.at,
          id: track.id,
          uri: track.uri,
          name: track.name,
          artists: track.artists,
          artistIds: track.artistIds,
          album: track.albumName,
          albumId: track.albumId,
          image: track.image,
          durationMs: track.durationMs,
          playedMs: Math.round(session.playedMs),
        });
      }
    },
  };
}

export function connectHistory(): () => void {
  const bridge = window.vitrine.history;
  if (!bridge) return () => undefined;
  const tracker = createPlayTracker(
    (play) => void bridge.add(play).catch(() => undefined),
    (at, playedMs) => void bridge.extend(at, playedMs).catch(() => undefined),
  );
  const timer = setInterval(() => tracker.tick(playback.get(), Date.now()), TICK_MS);
  const onHide = () => tracker.finish();
  window.addEventListener("pagehide", onHide);
  return () => {
    clearInterval(timer);
    window.removeEventListener("pagehide", onHide);
    tracker.finish();
  };
}
