// Pauses playback after a while, or once the current track has ended.
import { createStore } from "../lib/store";
import { notify } from "../lib/ui";
import * as engine from "./engine";
import { playback } from "./engine";

export type SleepChoice = number | "track" | null;

export const sleepTimer = createStore<{ endsAt: number | null; endOfTrack: boolean }>({ endsAt: null, endOfTrack: false });

let timer: ReturnType<typeof setTimeout> | undefined;
let stopWatching: (() => void) | undefined;

function clear(): void {
  clearTimeout(timer);
  stopWatching?.();
  stopWatching = undefined;
  sleepTimer.set({ endsAt: null, endOfTrack: false });
}

async function fallAsleep(): Promise<void> {
  clear();
  if (!playback.get().paused) await engine.togglePlay().catch(() => undefined);
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
  notify(`La lecture s'arrêtera dans ${choice} minutes.`);
}
