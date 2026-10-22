// Keeps the tray, the taskbar buttons and the notifications in step with playback, and carries
// their clicks back to the player.
import * as api from "../lib/spotify";
import { navigate, notify } from "../lib/ui";
import * as engine from "./engine";
import { playback } from "./engine";

/** Adds the track playing to Liked Songs (a shortcut does not take it out: pressed twice, it stays). */
async function likeCurrent(): Promise<void> {
  const track = playback.get().track;
  if (!track?.uri.startsWith("spotify:track:")) return;
  await api.saveTrack(track.id);
  notify(`« ${track.name} » ajouté aux titres likés`);
}

export function connectDesktop(onError: (error: unknown) => void): () => void {
  const bridge = window.vitrine.desktop;
  if (!bridge) return () => undefined;
  let sent = "";
  const send = () => {
    const { track, paused } = playback.get();
    const key = track ? `${track.uri}|${paused}` : "";
    if (key === sent) return;
    sent = key;
    void bridge
      .update(track ? { title: track.name, artist: track.artists.join(", "), imageUrl: track.image, paused } : null)
      .catch(() => undefined);
  };
  send();
  const stopState = playback.subscribe(send);
  const stopCommands = bridge.onCommand((command) => {
    if (command === "flow") return navigate({ name: "flow" });
    if (command === "lyrics") return void window.vitrine.overlay.toggle().catch(onError);
    const run = command === "next" ? engine.next : command === "previous" ? engine.previous : command === "like" ? likeCurrent : engine.togglePlay;
    void run().catch(onError);
  });
  return () => {
    stopState();
    stopCommands();
  };
}
