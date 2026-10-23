import { AnimatePresence, motion } from "framer-motion";
import { Clapperboard, X } from "lucide-react";
import { useRef, useState } from "react";
import { cn } from "../lib/cn";
import { errorMessage } from "../lib/format";
import type { LyricLine } from "../lib/lrc";
import { CLIP_MS, clipStart, recordClip } from "../lib/lyricClip";
import { saveBlob } from "../lib/recap";
import { storyFileName } from "../lib/story";
import type { Track } from "../lib/types";
import { notify } from "../lib/ui";

/**
 * TikTok's lyric edits, made here: 15 s of the lyrics from the line being sung, as a vertical video to
 * post with the song added in TikTok. It records in real time, with a way to stop.
 */
export function ClipButton({ track, lines, positionMs, className }: { track: Track; lines: LyricLine[]; positionMs: () => number; className?: string }) {
  const [progress, setProgress] = useState<number | null>(null);
  const abort = useRef<AbortController | null>(null);
  if (lines.length === 0) return null;

  const start = async () => {
    abort.current = new AbortController();
    setProgress(0);
    try {
      const { blob, ext } = await recordClip({ track, lines, startMs: clipStart(lines, positionMs()) }, setProgress, abort.current.signal);
      saveBlob(blob, storyFileName(track).replace("vitrine-story-", "vitrine-clip-").replace(/\.png$/, `.${ext}`));
      notify("Clip prêt : sur TikTok, importez-le puis ajoutez le son du titre depuis la bibliothèque de sons.");
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) notify(errorMessage(error), "error");
    } finally {
      setProgress(null);
    }
  };

  return (
    <>
      <button onClick={() => void start()} className={cn("btn-ghost min-h-0 justify-center px-3 py-2 text-xs", className)} title="Vidéo verticale de 15 s des paroles, à poster sur TikTok (le son s'ajoute dans TikTok)">
        <Clapperboard className="h-3.5 w-3.5" />
        Clip TikTok
      </button>
      <AnimatePresence>
        {progress !== null && (
          <motion.div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="glass w-[340px] rounded-3xl p-6 text-center" role="status">
              <Clapperboard className="mx-auto h-8 w-8 text-red-400" />
              <p className="mt-3 font-display text-xl tracking-tight">Clip en cours</p>
              <p className="mt-1 text-sm text-gray-400">
                {Math.ceil(((1 - progress) * CLIP_MS) / 1000)} s · 1080 × 1920, sans le son
              </p>
              <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/15">
                <div className="accent-bg h-full rounded-full" style={{ width: `${progress * 100}%` }} />
              </div>
              <button onClick={() => abort.current?.abort()} className="btn-ghost mx-auto mt-5 min-h-0 px-4 py-2 text-sm">
                <X className="h-4 w-4" />
                Annuler
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
