import { motion } from "framer-motion";
import { X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { artworkColor, type Rgb } from "../lib/palette";
import { useStore } from "../lib/store";
import { ui } from "../lib/ui";
import { playback } from "../player/engine";
import { usePosition } from "../player/hooks";
import { useLyrics } from "../player/useLyrics";
import { Artwork } from "./Artwork";
import { ProgressBar, TransportControls, VolumeControl } from "./NowPlayingBar";
import { RomanizeToggle, StagedLyrics } from "./StagedLyrics";

/** the voice comes a little before the note: lines light up that much ahead */
const LEAD_MS = 250;

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
  const [colors, setColors] = useState<[string, string, string]>(["220 38 38", "245 140 140", "38 220 38"]);
  const art = track?.imageLarge ?? track?.image;

  useEffect(() => {
    void artworkColor(track?.thumb ?? art).then((rgb) => setColors(aurora(rgb)));
  }, [art]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && !ui.get().playlistDialog && ui.set({ lyricsStage: false });
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

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
        <div className="no-drag flex items-center gap-3">
        <RomanizeToggle lines={lines} />
        <button onClick={() => ui.set({ lyricsStage: false })} className="no-drag rounded-full border border-white/25 p-2.5 text-white/80 transition-colors hover:bg-white/10 hover:text-white" aria-label="Fermer les paroles">
          <X className="h-5 w-5" />
        </button>
        </div>
      </div>

      <div className="relative h-full px-[6vw] [mask-image:linear-gradient(to_bottom,transparent_0,transparent_9%,black_28%,black_72%,transparent_90%)]">
        {state.status === "loading" && <p className="pt-[22vh] font-display text-4xl text-white/40">Recherche des paroles…</p>}
        {state.status === "done" && state.result?.instrumental && <p className="pt-[22vh] font-display text-5xl text-white/60">♪ Instrumental ♪</p>}
        {lines.length > 0 && (
          <StagedLyrics
            lines={lines}
            position={position + LEAD_MS}
            anchor={0.33}
            lineClassName="max-w-5xl font-display text-[clamp(32px,4.4vw,64px)] leading-[1.08] tracking-tight"
          />
        )}
        {plain && <p className="scrollbar-hide h-full overflow-y-auto whitespace-pre-line pt-[22vh] max-w-4xl font-display text-3xl leading-snug text-white/80">{plain}</p>}
        {state.status === "done" && !state.result?.synced && !plain && !state.result?.instrumental && (
          <p className="pt-[22vh] font-display text-4xl text-white/40">Pas de paroles pour ce titre.</p>
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
