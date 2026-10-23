import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { SPRING } from "../lib/motion";
import * as api from "../lib/spotify";
import { useStore } from "../lib/store";
import type { Track } from "../lib/types";
import { ui } from "../lib/ui";
import { playback } from "../player/engine";
import { usePosition } from "../player/hooks";
import { Artwork } from "./Artwork";

/** the next track is announced this long before the end */
const AHEAD_MS = 10_000;

/** Whether the announcement is due: the last 10 s of a track long enough to have an end worth announcing. */
export const announceDue = (positionMs: number, durationMs: number) => durationMs > 30_000 && durationMs - positionMs <= AHEAD_MS && durationMs - positionMs > 500;

/**
 * "Next: …" 10 s before the end of a track (Spicetify's Upcoming Song). This computer's player says what
 * comes next by itself; for another device, Spotify's queue is asked once per track.
 */
export function UpNext() {
  const position = usePosition();
  const duration = useStore(playback, (s) => s.durationMs);
  const uri = useStore(playback, (s) => s.track?.uri);
  const hidden = useStore(ui, (s) => s.fullPlayer || s.lyricsStage || s.mini);
  const [shown, setShown] = useState<{ uri: string; next: Track | null } | null>(null);
  const due = Boolean(uri) && announceDue(position, duration);

  useEffect(() => {
    if (!due || !uri || shown?.uri === uri) return;
    const local = playback.get().nextTrack;
    setShown({ uri, next: local ?? null });
    if (!local && playback.get().device && !playback.get().device?.local) {
      void api
        .queue()
        .then(({ next }) => setShown((current) => (current?.uri === uri ? { uri, next: next[0] ?? null } : current)))
        .catch(() => undefined);
    }
  }, [due, uri]);

  const next = shown && shown.uri === uri && due ? shown.next : null;
  return (
    <AnimatePresence>
      {next && !hidden && (
        <motion.div
          key={next.uri}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 16 }}
          transition={SPRING}
          className="glass fixed bottom-[108px] right-6 z-30 flex w-[300px] items-center gap-3 rounded-2xl p-3"
          role="status"
        >
          <Artwork src={next.thumb ?? next.image} className="h-11 w-11 shrink-0 rounded-lg" />
          <div className="min-w-0">
            <p className="kicker font-mono text-[10px] font-medium text-red-400">ENSUITE</p>
            <p className="truncate text-sm font-semibold">{next.name}</p>
            <p className="truncate text-xs text-gray-400">{next.artists.join(", ")}</p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
