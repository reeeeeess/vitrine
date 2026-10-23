import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown, Minus, Plus, RotateCcw, SkipForward } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "../lib/cn";
import { KIND_NAMES, lyricsPrefs, nextSource, OFFSET_STEP_MS, offsetLabel, setSongPrefs, SOURCE_NAMES } from "../lib/lyricsPrefs";
import { useStore } from "../lib/store";
import type { Track } from "../lib/types";
import { notify } from "../lib/ui";
import type { LyricsState } from "../player/useLyrics";

/**
 * Where the lyrics come from, and what to do when they are wrong (lyrics-plus, Lyricify): another source,
 * or the same lines a little earlier or later. Both are kept for the song.
 */
export function LyricsMenu({ track, state, className }: { track: Track; state: LyricsState; className?: string }) {
  const [open, setOpen] = useState(false);
  const offsetMs = useStore(lyricsPrefs, (s) => s.songs[track.uri]?.offsetMs ?? 0);
  const box = useRef<HTMLDivElement>(null);
  const result = state.status === "done" ? state.result : null;
  const sources = result?.sources ?? [];

  useEffect(() => {
    if (!open) return;
    const away = (event: MouseEvent) => !box.current?.contains(event.target as Node) && setOpen(false);
    window.addEventListener("mousedown", away);
    return () => window.removeEventListener("mousedown", away);
  }, [open]);

  if (!result?.source) return null;
  const kind = sources.find((entry) => entry.source === result.source)?.kind;
  const shift = (by: number) => setSongPrefs(track.uri, { offsetMs: offsetMs + by });
  const wrong = () => {
    const other = nextSource(sources, result.source);
    if (!other) return notify("Aucune autre source n'a les paroles de ce titre.");
    setSongPrefs(track.uri, { source: other });
    notify(`Paroles de ${SOURCE_NAMES[other]} pour ce titre.`);
  };

  return (
    <div ref={box} className={cn("relative", className)}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 rounded-full border border-white/20 px-3 py-1.5 text-xs font-medium text-white/75 transition-colors hover:text-white"
        aria-expanded={open}
        title="Source des paroles et synchro"
      >
        Paroles : {SOURCE_NAMES[result.source]}
        {offsetMs ? <span className="font-mono text-[11px] text-amber-200">{offsetLabel(offsetMs)}</span> : null}
        <ChevronDown className="h-3.5 w-3.5" />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
            className="glass absolute right-0 top-full z-30 mt-2 w-[300px] rounded-2xl p-3 text-sm"
          >
            <p className="kicker px-2 pb-1 font-mono text-[10px] text-white/50">SOURCE</p>
            {sources.map((entry) => (
              <button
                key={entry.source}
                onClick={() => setSongPrefs(track.uri, { source: entry.source })}
                className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-white/10"
              >
                <span>
                  {SOURCE_NAMES[entry.source]} <span className="text-xs text-white/50">· {KIND_NAMES[entry.kind]}</span>
                </span>
                {entry.source === result.source && <Check className="h-4 w-4 text-red-400" />}
              </button>
            ))}
            <button onClick={wrong} className="mt-1 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-white/80 transition-colors hover:bg-white/10">
              <SkipForward className="h-4 w-4" />
              Ce ne sont pas les bonnes paroles
            </button>

            {kind !== "plain" && kind !== "instrumental" && (
              <>
                <p className="kicker mt-3 px-2 pb-1 font-mono text-[10px] text-white/50">SYNCHRO</p>
                <div className="flex items-center gap-2 px-2">
                  <button onClick={() => shift(-OFFSET_STEP_MS)} className="rounded-full border border-white/20 p-1.5 hover:bg-white/10" aria-label="Paroles plus tôt" title="Paroles plus tôt (−0,25 s)">
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <span className="min-w-[4.5rem] text-center font-mono text-xs">{offsetLabel(offsetMs) || "0 s"}</span>
                  <button onClick={() => shift(OFFSET_STEP_MS)} className="rounded-full border border-white/20 p-1.5 hover:bg-white/10" aria-label="Paroles plus tard" title="Paroles plus tard (+0,25 s)">
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                  {offsetMs !== 0 && (
                    <button onClick={() => setSongPrefs(track.uri, { offsetMs: 0 })} className="ml-auto rounded-full p-1.5 text-white/60 hover:text-white" aria-label="Remettre la synchro" title="Remettre la synchro">
                      <RotateCcw className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                <p className="mt-1 px-2 text-[11px] text-white/45">En avance : « + ». En retard : « − ». Gardé pour ce titre.</p>
              </>
            )}
            {result.source === "netease" && <p className="mt-3 px-2 text-[11px] text-white/45">NetEase n'est pas une source officielle : désactivable dans les Réglages.</p>}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
