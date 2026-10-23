import { ArrowUpRight } from "lucide-react";
import { activeLineIndex } from "../lib/lrc";
import type { Track } from "../lib/types";
import { usePosition } from "../player/hooks";
import { useLyrics } from "../player/useLyrics";

/** Musix's lyrics card: the line before, the one sung (bold), the one after, and a way to the full screen. */
export function LyricCard({ track, onOpen }: { track: Track; onOpen: () => void }) {
  const { lines } = useLyrics(track);
  const position = usePosition();
  if (lines.length === 0) return null;
  const index = activeLineIndex(lines, position + 250);
  const line = (i: number) => (i >= 0 ? lines[i]?.text : "") || "";
  return (
    <div className="no-drag rounded-2xl border border-white/10 bg-white/[0.06] px-3.5 py-2.5 text-left">
      <p translate="no" className="truncate text-xs text-white/45">{line(index - 1) || " "}</p>
      <p translate="no" className="truncate text-sm font-semibold text-white">{index >= 0 ? line(index) || "♪" : "…"}</p>
      <p translate="no" className="truncate text-xs text-white/45">{line(index + 1) || " "}</p>
      <div className="mt-1.5 flex items-center justify-between">
        <span className="rounded border border-red-500/60 px-1 font-mono text-[10px] font-semibold text-red-400">CC</span>
        <button onClick={onOpen} className="flex items-center gap-1 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-red-400 hover:text-red-300">
          Paroles <ArrowUpRight className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}
