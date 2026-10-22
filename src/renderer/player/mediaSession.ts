// The operating system's media controls: keyboard media keys, the Windows media flyout and taskbar,
// macOS's Control Centre and Now Playing. Chromium routes them all through the Media Session API.
import * as engine from "./engine";
import { currentPosition, playback } from "./engine";

export function connectMediaSession(onError: (error: unknown) => void): () => void {
  const session = navigator.mediaSession;
  if (!session) return () => undefined;
  const run = (command: () => Promise<unknown>) => () => void command().catch(onError);

  session.setActionHandler("play", run(async () => playback.get().paused && engine.togglePlay()));
  session.setActionHandler("pause", run(async () => !playback.get().paused && engine.togglePlay()));
  session.setActionHandler("nexttrack", run(engine.next));
  session.setActionHandler("previoustrack", run(engine.previous));
  session.setActionHandler("seekto", (details) => {
    if (details.seekTime != null) void engine.seek(details.seekTime * 1000).catch(onError);
  });

  let lastUri: string | undefined;
  const update = () => {
    const state = playback.get();
    const track = state.track;
    if (track?.uri !== lastUri) {
      lastUri = track?.uri;
      session.metadata = track
        ? new MediaMetadata({
            title: track.name,
            artist: track.artists.join(", "),
            album: track.albumName,
            artwork: track.image ? [{ src: track.image, sizes: "640x640" }] : [],
          })
        : null;
    }
    session.playbackState = track ? (state.paused ? "paused" : "playing") : "none";
    if (track && state.durationMs > 0) {
      try {
        session.setPositionState({
          duration: state.durationMs / 1000,
          position: Math.min(state.durationMs, currentPosition(state)) / 1000,
          playbackRate: 1,
        });
      } catch {
        // a position Chromium finds out of range is skipped until the next update
      }
    }
  };
  update();
  return playback.subscribe(update);
}
