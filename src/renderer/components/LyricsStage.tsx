import { motion } from "framer-motion";
import { X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "../lib/cn";
import { activeLineIndex, type LyricLine } from "../lib/lrc";
import { artworkColor, type Rgb } from "../lib/palette";
import { useStore } from "../lib/store";
import { ui } from "../lib/ui";
import * as engine from "../player/engine";
import { playback } from "../player/engine";
import { usePosition } from "../player/hooks";
import { useLyrics } from "../player/useLyrics";
import { Artwork } from "./Artwork";
import { ProgressBar, run, TransportControls, VolumeControl } from "./NowPlayingBar";

/** the voice comes a little before the note: lines light up that much ahead */
const LEAD_MS = 250;

/**
 * How far into its line the singer is, 0 to 1. Without a time per word, a line is taken to be sung at
 * an even pace over its time, or over the time its words take when a long silence follows it.
 */
export function lineProgress(lines: LyricLine[], index: number, positionMs: number): number {
  const line = lines[index];
  if (!line) return 0;
  const words = Math.max(1, line.text.split(/\s+/).filter(Boolean).length);
  const until = lines[index + 1]?.timeMs ?? line.timeMs + 4000;
  const length = Math.max(600, Math.min(until - line.timeMs, Math.max(1800, words * 380)));
  return Math.min(1, Math.max(0, (positionMs - line.timeMs) / length));
}

/** Three colours from the artwork's: itself, a lighter one and a shifted one, for the aurora. */
export function aurora([r, g, b]: Rgb): [string, string, string] {
  const light = [r, g, b].map((c) => Math.round(c + (255 - c) * 0.45));
  return [`${r} ${g} ${b}`, light.join(" "), `${b} ${r} ${g}`];
}

/** Musix's lyrics screen: giant lines on an aurora of the artwork's colours, the current one filling as it is sung. */
export function LyricsStage() {
  const track = useStore(playback, (s) => s.track);
  const { state, lines } = useLyrics(track);
  const position = usePosition();
  const box = useRef<HTMLDivElement>(null);
  const [colors, setColors] = useState<[string, string, string]>(["220 38 38", "245 140 140", "38 220 38"]);
  const active = activeLineIndex(lines, position + LEAD_MS);
  const progress = lineProgress(lines, active, position + LEAD_MS);
  const art = track?.imageLarge ?? track?.image;

  useEffect(() => {
    void artworkColor(track?.thumb ?? art).then((rgb) => setColors(aurora(rgb)));
  }, [art]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && !ui.get().playlistDialog && ui.set({ lyricsStage: false });
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // the line being sung stays a third of the way down
  useEffect(() => {
    const element = box.current?.querySelector<HTMLElement>(`[data-line="${Math.max(active, 0)}"]`);
    if (box.current && element) box.current.scrollTo({ top: element.offsetTop - box.current.clientHeight * 0.33, behavior: "smooth" });
  }, [active]);

  const plain = useMemo(() => (state.status === "done" && !state.result?.synced ? state.result?.plain ?? null : null), [state]);

  return (
    <motion.div
      className="fixed inset-0 z-[55] overflow-hidden bg-black"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
    >
      {/* the aurora: the artwork blurred, and three slow blobs of its colours */}
      {track?.thumb && <img src={track.thumb} alt="" aria-hidden="true" className="fx-blur absolute inset-[-10%] h-[120%] w-[120%] object-cover opacity-60 blur-[90px]" />}
      <div className="fx-blur absolute inset-0" aria-hidden="true">
        <div className="absolute -left-[10%] top-[5%] h-[70vh] w-[70vh] animate-[drift_24s_ease-in-out_infinite_alternate] rounded-full blur-[120px]" style={{ background: `rgb(${colors[0]} / 0.55)` }} />
        <div className="absolute right-[-5%] top-[-10%] h-[60vh] w-[60vh] animate-[drift_30s_ease-in-out_infinite_alternate-reverse] rounded-full blur-[120px]" style={{ background: `rgb(${colors[1]} / 0.45)` }} />
        <div className="absolute bottom-[-20%] left-[30%] h-[65vh] w-[65vh] animate-[drift_36s_ease-in-out_infinite_alternate] rounded-full blur-[130px]" style={{ background: `rgb(${colors[2]} / 0.35)` }} />
      </div>
      <div className="absolute inset-0 bg-black/35" />

      <div className="drag absolute inset-x-0 top-0 z-10 flex items-center justify-between px-10 pt-5">
        {track && (
          <div className="flex items-center gap-3">
            <Artwork src={track.thumb ?? track.image} className="h-11 w-11 rounded-lg ring-1 ring-white/20" />
            <div className="min-w-0">
              <p className="truncate font-display text-base leading-tight">{track.name}</p>
              <p className="truncate font-mono text-[11px] uppercase tracking-[0.18em] text-white/60">{track.artists.join(", ")}</p>
            </div>
          </div>
        )}
        <button onClick={() => ui.set({ lyricsStage: false })} className="no-drag rounded-full border border-white/25 p-2.5 text-white/80 transition-colors hover:bg-white/10 hover:text-white" aria-label="Fermer les paroles">
          <X className="h-5 w-5" />
        </button>
      </div>

      <div
        ref={box}
        className="scrollbar-hide relative h-full overflow-y-auto px-[6vw] pb-[45vh] pt-[22vh] [mask-image:linear-gradient(to_bottom,transparent_0,transparent_9%,black_28%,black_72%,transparent_90%)]"
      >
        {state.status === "loading" && <p className="font-display text-4xl text-white/40">Recherche des paroles…</p>}
        {state.status === "done" && state.result?.instrumental && <p className="font-display text-5xl text-white/60">♪ Instrumental ♪</p>}
        {lines.length > 0 &&
          lines.map((line, index) => {
            const past = index < active;
            const current = index === active;
            return (
              <button
                key={`${line.timeMs}-${index}`}
                data-line={index}
                onClick={() => run(() => engine.seek(line.timeMs))}
                className={cn(
                  "block max-w-5xl py-2 text-left font-display text-[clamp(32px,4.4vw,64px)] leading-[1.08] tracking-tight transition-[opacity,filter] duration-500",
                  past && "opacity-35",
                  past && active - index <= 2 && "blur-[1.5px]",
                  !past && !current && "opacity-45",
                )}
                style={
                  current
                    ? {
                        // the line fills from left to right as it is sung
                        backgroundImage: `linear-gradient(90deg, #fff ${progress * 100}%, rgb(255 255 255 / 0.4) ${progress * 100}%)`,
                        WebkitBackgroundClip: "text",
                        backgroundClip: "text",
                        color: "transparent",
                      }
                    : undefined
                }
              >
                {line.text || "♪"}
              </button>
            );
          })}
        {plain && <p className="max-w-4xl whitespace-pre-line font-display text-3xl leading-snug text-white/80">{plain}</p>}
        {state.status === "done" && !state.result?.synced && !plain && !state.result?.instrumental && (
          <p className="font-display text-4xl text-white/40">Pas de paroles pour ce titre.</p>
        )}
      </div>

      <div className="absolute inset-x-0 bottom-0 z-10 flex justify-center pb-6">
        <div className="w-[min(640px,90vw)]">
          <ProgressBar />
          <div className="mt-2 flex items-center justify-center gap-6">
            <TransportControls />
            <VolumeControl />
          </div>
        </div>
      </div>
    </motion.div>
  );
}
