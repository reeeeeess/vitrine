// Feeds the lyrics overlay (electron/overlay.ts) while it is open: the line being sung and the next
// one, worked out here from LRCLIB's synced lyrics and the playback position.
import { activeLineIndex, parseLrc, type LyricLine } from "../lib/lrc";
import { createStore } from "../lib/store";
import { currentPosition, playback } from "./engine";

const TICK_MS = 200;
const LEAD_MS = 250;

export const overlay = createStore({ open: false });

export function connectOverlay(): () => void {
  const bridge = window.vitrine.overlay;
  if (!bridge) return () => undefined;
  let timer: ReturnType<typeof setInterval> | undefined;
  let lyrics: { uri: string; lines: LyricLine[] } | null = null;
  let loading = "";
  let sent = "";

  const tick = () => {
    const state = playback.get();
    const track = state.track;
    if (!track) return;
    if (lyrics?.uri !== track.uri && loading !== track.uri) {
      loading = track.uri;
      void window.vitrine.lyrics
        .get({ track: track.name, artist: track.artists[0] ?? "", album: track.albumName, durationMs: track.durationMs })
        .then(
          (result) => (lyrics = { uri: track.uri, lines: result?.synced ? parseLrc(result.synced) : [] }),
          () => (lyrics = { uri: track.uri, lines: [] }),
        )
        .finally(() => (loading = ""));
    }
    const lines = lyrics?.uri === track.uri ? lyrics.lines : [];
    const index = activeLineIndex(lines, currentPosition(state) + LEAD_MS);
    const title = `${track.name} — ${track.artists.join(", ")}`;
    // no synced lyrics: the overlay shows what plays instead
    const line = lines.length === 0 ? title : index >= 0 ? lines[index].text : "♪";
    const next = lines.length === 0 ? "" : (lines[index + 1]?.text ?? "");
    const key = `${line}|${next}|${title}`;
    if (key === sent) return;
    sent = key;
    void bridge.send({ line, next, title }).catch(() => undefined);
  };

  const apply = (open: boolean) => {
    overlay.set({ open });
    clearInterval(timer);
    sent = "";
    if (open) timer = setInterval(tick, TICK_MS);
  };
  void bridge.status().then(apply, () => undefined);
  const stop = bridge.onStatus(apply);
  return () => {
    stop();
    clearInterval(timer);
  };
}

export const toggleOverlay = () => window.vitrine.overlay.toggle();
