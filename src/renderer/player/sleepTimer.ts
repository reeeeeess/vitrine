// Pauses playback after a while, or once the current track has ended; while the music plays on this
// computer, it fades out first (30 s, or the last 10 s of the track), without asking Spotify anything.
import { createStore } from "../lib/store";
import { notify } from "../lib/ui";
import * as engine from "./engine";
import { playback } from "./engine";

export type SleepChoice = number | "track" | null;

export const sleepTimer = createStore<{ endsAt: number | null; endOfTrack: boolean }>({ endsAt: null, endOfTrack: false });

/** the fade before a timed pause */
export const FADE_MS = 30_000;
/** the fade at the end of the last track */
const TRACK_FADE_MS = 10_000;

let timer: ReturnType<typeof setTimeout> | undefined;
let fadeTimer: ReturnType<typeof setTimeout> | undefined;
let trackWatch: ReturnType<typeof setInterval> | undefined;
let stopWatching: (() => void) | undefined;
let fading = false;

function clear(): void {
  clearTimeout(timer);
  clearTimeout(fadeTimer);
  clearInterval(trackWatch);
  stopWatching?.();
  stopWatching = undefined;
  // a timer cancelled in the middle of its fade gives the volume back
  if (fading) engine.restoreLocalVolume();
  fading = false;
  sleepTimer.set({ endsAt: null, endOfTrack: false });
}

function fadeOut(ms: number): void {
  if (fading) return;
  fading = true;
  void engine.fadeLocalVolume(0, ms);
}

async function fallAsleep(): Promise<void> {
  const faded = fading;
  fading = false;
  clear();
  if (!playback.get().paused) await engine.togglePlay().catch(() => undefined);
  // paused: the player gets its volume back for the next time
  if (faded) setTimeout(() => engine.restoreLocalVolume(), 600);
  notify("Minuteur : lecture mise en pause. Bonne nuit.");
}

/** Minutes from now, "track" for the end of the current track, or null to cancel. */
export function setSleepTimer(choice: SleepChoice): void {
  clear();
  if (choice === null) return;
  if (choice === "track") {
    const uri = playback.get().track?.uri;
    if (!uri) return;
    sleepTimer.set({ endOfTrack: true });
    trackWatch = setInterval(() => {
      const state = playback.get();
      const left = state.durationMs - engine.currentPosition(state);
      if (state.track?.uri === uri && !state.paused && left <= TRACK_FADE_MS) fadeOut(Math.max(1000, left - 300));
    }, 500);
    // the next track starting means this one ended: pause right away
    stopWatching = playback.subscribe(() => {
      const current = playback.get().track?.uri;
      if (current && current !== uri) void fallAsleep();
    });
    notify("La lecture s'arrêtera à la fin de ce titre.");
    return;
  }
  const endsAt = Date.now() + choice * 60_000;
  sleepTimer.set({ endsAt });
  timer = setTimeout(() => void fallAsleep(), choice * 60_000);
  fadeTimer = setTimeout(() => fadeOut(FADE_MS), Math.max(0, choice * 60_000 - FADE_MS));
  notify(`La lecture s'arrêtera dans ${choice} minutes.`);
}
