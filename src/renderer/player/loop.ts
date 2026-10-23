// A–B loop (Loopy Loop of Spicetify, and TikTok's chorus on repeat): from A to B again and again. Only
// while the music plays on this computer: there a jump back costs nothing, while on another device each
// turn would be one more request to Spotify.
import { hookPosition } from "../lib/flow";
import { createStore } from "../lib/store";
import { notify } from "../lib/ui";
import * as engine from "./engine";
import { currentPosition, playback, type PlaybackState } from "./engine";

export interface Loop {
  uri: string;
  aMs: number;
  /** unset while the person has marked A and not yet B */
  bMs?: number;
}

export const loop = createStore<{ current: Loop | null }>({ current: null });

/** the shortest loop worth playing */
const MIN_LOOP_MS = 1500;
/** "the chorus": this long from where Flow places the hook */
const CHORUS_MS = 20_000;

/** Where to jump back to, or null: past B on the looped track. */
export function loopJump(current: Loop | null, state: Pick<PlaybackState, "track" | "paused" | "positionMs" | "durationMs" | "updatedAt">, now = Date.now()): number | null {
  if (!current?.bMs || state.paused || state.track?.uri !== current.uri) return null;
  return currentPosition(state, now) >= current.bMs ? current.aMs : null;
}

/** Marks A, then B, then lets go: one button. */
export function markLoop(): void {
  const state = playback.get();
  if (!state.track) return;
  if (!engine.playsHere()) {
    notify("La boucle marche quand la musique joue sur ce PC.");
    return;
  }
  const position = currentPosition(state);
  const current = loop.get().current;
  if (!current || current.uri !== state.track.uri) {
    loop.set({ current: { uri: state.track.uri, aMs: position } });
    notify("Début de la boucle posé : appuyez encore à la fin voulue.");
  } else if (current.bMs === undefined) {
    if (position - current.aMs < MIN_LOOP_MS) return;
    loop.set({ current: { ...current, bMs: position } });
  } else {
    loop.set({ current: null });
  }
}

/** The chorus on repeat: 20 s from where Flow places the hook. */
export function loopChorus(): void {
  const state = playback.get();
  if (!state.track) return;
  if (!engine.playsHere()) {
    notify("La boucle marche quand la musique joue sur ce PC.");
    return;
  }
  const aMs = hookPosition(state.durationMs);
  loop.set({ current: { uri: state.track.uri, aMs, bMs: Math.min(state.durationMs - 500, aMs + CHORUS_MS) } });
  void engine.seek(aMs);
}

export const clearLoop = () => loop.set({ current: null });

/** Watches the position and jumps back at B; a new track ends the loop. */
export function connectLoop(): () => void {
  const timer = setInterval(() => {
    const current = loop.get().current;
    if (!current) return;
    const state = playback.get();
    if (state.track && state.track.uri !== current.uri) {
      loop.set({ current: null });
      return;
    }
    const jump = loopJump(current, state);
    if (jump !== null) void engine.seek(jump).catch(() => undefined);
  }, 200);
  return () => clearInterval(timer);
}
