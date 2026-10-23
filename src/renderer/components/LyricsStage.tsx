import { motion } from "framer-motion";
import { Loader2, MicOff, X } from "lucide-react";
import { useEffect, useMemo } from "react";
import { cn } from "../lib/cn";
import { useStore } from "../lib/store";
import { ui } from "../lib/ui";
import { playback } from "../player/engine";
import { usePosition } from "../player/hooks";
import { karaoke, lyricsSource, startKaraoke, stopKaraoke } from "../player/karaoke";
import { useLyrics } from "../player/useLyrics";
import { Artwork } from "./Artwork";
import { Aurora } from "./Aurora";
import { ProgressBar, run, TransportControls, VolumeControl } from "./NowPlayingBar";
import { RomanizeToggle, StagedLyrics } from "./StagedLyrics";

/** the voice comes a little before the note: lines light up that much ahead */
const LEAD_MS = 250;

/** Musix's lyrics screen: giant lines on an aurora of the artwork's colours, the current one filling as it is sung. */
/** Karaoke without the voice: the official instrumental, at the same moment, the original's lyrics. */
function KaraokeButton() {
  const current = useStore(karaoke, (s) => s.current);
  const searching = useStore(karaoke, (s) => s.searching);
  return (
    <div className="flex items-center gap-2">
      {current?.approximate && <span className="rounded-full border border-amber-300/40 px-2.5 py-1 text-[11px] text-amber-200">synchro approximative</span>}
      <button
        onClick={() => run(current ? stopKaraoke : startKaraoke)}
        disabled={searching}
        className={cn(
          "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-60",
          current ? "border-red-400/60 bg-red-500/25 text-white" : "border-white/20 text-white/70 hover:text-white",
        )}
        title={current ? "Remettre la version avec la voix, au même moment" : "Jouer la version instrumentale officielle, au même moment, et chanter sur les paroles"}
      >
        {searching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MicOff className="h-3.5 w-3.5" />}
        {current ? "Remettre la voix" : "Karaoké sans la voix"}
      </button>
    </div>
  );
}

export function LyricsStage() {
  const playing = useStore(playback, (s) => s.track);
  const current = useStore(karaoke, (s) => s.current);
  // during karaoke, the instrumental plays and the original's lyrics show, in time
  const source = lyricsSource(playing, current);
  const track = source.track;
  const { state, lines } = useLyrics(track);
  const position = source.toLyrics(usePosition());
  const art = track?.imageLarge ?? track?.image;

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
      <Aurora thumb={track?.thumb} art={art} />

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
        <KaraokeButton />
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
