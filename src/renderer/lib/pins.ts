// Pins (Apple Music, iOS 26): up to 6 playlists, albums or artists at the top of the library and the
// home page, in the tray menu and in the taskbar's jump list. Kept by the main process (config.json).
import type { Pin } from "../global";
import { createStore } from "./store";
import { notify } from "./ui";

export const MAX_PINS = 6;

export const pins = createStore<{ list: Pin[] }>({ list: [] });

export async function loadPins(): Promise<void> {
  const list = await window.vitrine.pins?.get().catch(() => []);
  pins.set({ list: list ?? [] });
}

export const isPinned = (uri: string) => pins.get().list.some((pin) => pin.uri === uri);

/** Pins it, or unpins it if it already was; six at most, the newest first. */
export async function togglePin(pin: Pin): Promise<void> {
  const list = pins.get().list;
  if (isPinned(pin.uri)) {
    pins.set({ list: await save(list.filter((item) => item.uri !== pin.uri)) });
    notify(`« ${pin.name} » n'est plus épinglé.`);
    return;
  }
  if (list.length >= MAX_PINS) {
    notify(`${MAX_PINS} épingles au plus : retirez-en une d'abord.`, "error");
    return;
  }
  pins.set({ list: await save([pin, ...list]) });
  notify(`« ${pin.name} » épinglé en haut de la bibliothèque.`);
}

async function save(list: Pin[]): Promise<Pin[]> {
  // without the desktop bridge (a browser preview) the pins live for this run only
  return (await window.vitrine.pins?.set(list).catch(() => list)) ?? list;
}
