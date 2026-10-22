// Keeps the tray, the taskbar buttons and the notifications in step with playback, and carries
// their clicks back to the player.
import * as engine from "./engine";
import { playback } from "./engine";

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
    const run = command === "next" ? engine.next : command === "previous" ? engine.previous : engine.togglePlay;
    void run().catch(onError);
  });
  return () => {
    stopState();
    stopCommands();
  };
}
