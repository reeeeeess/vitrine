// App-wide UI state: where the person is, toasts, and whether the full-screen player is open.
import { createStore } from "./store";
import type { Track } from "./types";

export type Route =
  | { name: "home" }
  | { name: "flow"; seed?: Track }
  | { name: "search"; query?: string }
  | { name: "library" }
  | { name: "stats" }
  | { name: "playlist"; id: string }
  | { name: "album"; id: string }
  | { name: "artist"; id: string }
  | { name: "settings" }
  | { name: "moments" }
  | { name: "liked" };

export interface Toast {
  id: number;
  text: string;
  tone: "info" | "error";
}

export const ui = createStore({
  route: { name: "home" } as Route,
  history: [] as Route[],
  toasts: [] as Toast[],
  fullPlayer: false,
  /** Musix's full-screen lyrics */
  lyricsStage: false,
  /** Movix's roulette over the page */
  roulette: false,
  devicesOpen: false,
  queueOpen: false,
  mini: false,
  /** a track to scroll to once its list shows (Ctrl+L: the track playing) */
  reveal: null as string | null,
  /** the playlist dialog: add these tracks to a playlist, or (empty) just create one */
  playlistDialog: null as { uris: string[] } | null,
});

export async function setMini(on: boolean): Promise<void> {
  // without the desktop bridge (a browser preview) the layout still switches
  await window.vitrine.window?.setMini(on).catch(() => undefined);
  ui.set({ mini: on, fullPlayer: false, devicesOpen: false, queueOpen: false });
}

export function navigate(route: Route): void {
  ui.set((state) => ({ route, history: [...state.history.slice(-30), state.route], fullPlayer: false, devicesOpen: false }));
  document.querySelector(".main")?.scrollTo({ top: 0 });
}

export function goBack(): void {
  ui.set((state) => {
    const previous = state.history.at(-1);
    return previous ? { route: previous, history: state.history.slice(0, -1) } : {};
  });
}

let nextToast = 1;
export function notify(text: string, tone: Toast["tone"] = "info"): void {
  // the same message twice in a row would only stack up
  if (ui.get().toasts.some((toast) => toast.text === text)) return;
  const id = nextToast++;
  ui.set((state) => ({ toasts: [...state.toasts, { id, text, tone }].slice(-3) }));
  setTimeout(() => ui.set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) })), 4500);
}
