// The infinite queue (E1): when a playlist or an album comes to its end and nothing follows, the music goes on
// in the same spirit, from Flow's sources around the last track (Spotify's autoplay, which its app does but
// apps may not ask for). On by default; Settings turn it off.
import { loadFlow } from "../lib/flow";
import { createStore } from "../lib/store";
import { notify } from "../lib/ui";
import * as engine from "./engine";
import { currentPosition, playback, type PlaybackState } from "./engine";

const KEY = "vitrine.infinite";

function read(): boolean {
  try {
    return localStorage.getItem(KEY) !== "off";
  } catch {
    return true;
  }
}

export const infinite = createStore({ on: read() });

export function setInfinite(on: boolean): void {
  infinite.set({ on });
  try {
    localStorage.setItem(KEY, on ? "on" : "off");
  } catch {
    // for this run only
  }
}

type Moment = Pick<PlaybackState, "paused" | "durationMs" | "repeat" | "nextTrack"> & { uri?: string; position: number };

/**
 * Whether the list just ran out: the last track was playing to its very end with nothing after it, and now
 * the player stopped on it (at its end, or back at its start), repeat off.
 */
export function ranOut(before: Moment, now: Moment): boolean {
  if (before.paused || !now.paused || !before.uri || before.uri !== now.uri) return false;
  if (before.nextTrack || now.nextTrack || now.repeat !== "off") return false;
  const nearEnd = before.durationMs > 0 && before.durationMs - before.position <= 3000;
  const stopped = now.position <= 1000 || now.durationMs - now.position <= 1500;
  return nearEnd && stopped;
}

const moment = (state: PlaybackState): Moment => ({ paused: state.paused, durationMs: state.durationMs, repeat: state.repeat, nextTrack: state.nextTrack, uri: state.track?.uri, position: currentPosition(state) });

/** Watches the end of lists, and plays on around the last track. */
export function connectInfinite(): () => void {
  let before = moment(playback.get());
  let busy = false;
  const timer = setInterval(() => {
    const state = playback.get();
    const now = moment(state);
    const last = state.track;
    if (infinite.get().on && !busy && last && ranOut(before, now)) {
      busy = true;
      void loadFlow(0, new Set([last.id]), Date.now(), last)
        .then(async (items) => {
          const uris = items.filter((item) => item.track.uri !== last.uri).slice(0, 25).map((item) => item.track.uri);
          if (uris.length === 0) return;
          await engine.playTracks(uris, 0);
          notify(`File infinie : la musique continue autour de « ${last.name} ».`);
        })
        .catch(() => undefined)
        .finally(() => (busy = false));
    }
    before = now;
  }, 1000);
  return () => clearInterval(timer);
}
