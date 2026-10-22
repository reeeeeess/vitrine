// Tells the main process what plays, for Discord's "Listening to". Discord accepts a handful of
// updates per twenty seconds, so this sends only when the track, the pause or the position (a seek)
// changes, at most every few seconds, and always ends on the latest state.
import { playback } from "./engine";

const MIN_GAP_MS = 4000;
const SEEK_TOLERANCE_MS = 3000;

export function connectDiscord(): () => void {
  let sentKey = "";
  let sentStart = 0;
  let lastSent = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const send = () => {
    timer = undefined;
    const state = playback.get();
    const track = state.track;
    sentKey = track ? `${track.uri}|${state.paused}` : "";
    sentStart = state.updatedAt - state.positionMs;
    lastSent = Date.now();
    void window.vitrine.discord
      ?.update(
        track
          ? {
              title: track.name,
              artist: track.artists.join(", "),
              album: track.albumName,
              imageUrl: track.image,
              durationMs: state.durationMs || track.durationMs,
              positionMs: state.paused ? state.positionMs : state.positionMs + (Date.now() - state.updatedAt),
              paused: state.paused,
            }
          : null,
      )
      .catch(() => undefined);
  };

  const onChange = () => {
    const state = playback.get();
    const key = state.track ? `${state.track.uri}|${state.paused}` : "";
    const start = state.updatedAt - state.positionMs;
    const seeked = !state.paused && Math.abs(start - sentStart) > SEEK_TOLERANCE_MS;
    if (key === sentKey && !seeked) return;
    if (timer) return; // an update is already on its way and will read the latest state
    timer = setTimeout(send, Math.max(0, MIN_GAP_MS - (Date.now() - lastSent)));
  };

  onChange();
  const stop = playback.subscribe(onChange);
  return () => {
    stop();
    clearTimeout(timer);
  };
}
