// App-wide UI state: where the person is, toasts, and whether the full-screen player is open.
import { createStore } from "./store";

export type Route =
  | { name: "home" }
  | { name: "search"; query?: string }
  | { name: "library" }
  | { name: "stats" }
  | { name: "playlist"; id: string }
  | { name: "album"; id: string };

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
  devicesOpen: false,
});

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
  const id = nextToast++;
  ui.set((state) => ({ toasts: [...state.toasts, { id, text, tone }].slice(-3) }));
  setTimeout(() => ui.set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) })), 4500);
}
