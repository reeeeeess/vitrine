// The auto-updater's state, mirrored from the main process for the header and the settings page.
import type { UpdateState } from "../global";
import { createStore } from "./store";

export const updates = createStore<{ state: UpdateState }>({ state: { status: "idle" } });

export function connectUpdates(): () => void {
  const bridge = window.vitrine.updates;
  if (!bridge) return () => undefined;
  void bridge.get().then((state) => updates.set({ state }), () => undefined);
  return bridge.subscribe((state) => updates.set({ state }));
}
