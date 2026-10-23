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
import { SPRING } from "../lib/motion";
import { nowPanel } from "./NowPanel";
import { Aurora } from "./Aurora";
import { ProgressBar, run, TransportControls, VolumeControl } from "./NowPlayingBar";
import { RomanizeToggle, StagedLyrics } from "./StagedLyrics";

/** the voice comes a little before the note: lines light up that much ahead */
const LEAD_MS = 250;

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

/**
 * The lyrics screen, after Apple Music and Spicy Lyrics: the artwork, the title and the bar on the left,
 * the lines on the right, on a backdrop of the artwork's colours; on a screen on its side, the artwork on
 * top and the lines under it.
 */
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

  const portrait = useStore(nowPanel, (s) => s.height > s.width * 1.05 || s.width < 1000);
  const paused = useStore(playback, (s) => s.paused);

  const lyrics = (lineClassName: string, anchor: number) => (
    <>
      {state.status === "loading" && <p className="pt-[18vh] text-4xl font-extrabold text-white/40">Recherche des paroles…</p>}
      {state.status === "done" && state.result?.instrumental && <p className="pt-[18vh] text-5xl font-extrabold text-white/60">♪ Instrumental ♪</p>}
      {lines.length > 0 && <StagedLyrics lines={lines} position={position + LEAD_MS} anchor={anchor} lineClassName={lineClassName} />}
      {plain && <p className="scrollbar-hide h-full overflow-y-auto whitespace-pre-line pt-[18vh] text-3xl font-bold leading-snug text-white/80">{plain}</p>}
      {state.status === "done" && !state.result?.synced && !plain && !state.result?.instrumental && <p className="pt-[18vh] text-4xl font-extrabold text-white/40">Pas de paroles pour ce titre.</p>}
    </>
  );

  // the artwork steps back on pause (Apple Music)
  const cover = (className: string) =>
    track && (
      <motion.div key={track.uri} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0, scale: paused ? 0.92 : 1 }} transition={SPRING} className={className}>
        <Artwork src={art} className="rounded-2xl shadow-[0_30px_80px_rgba(0,0,0,0.55)] ring-1 ring-white/10" />
      </motion.div>
    );

  return (
    <motion.div
      className="fixed inset-0 z-[55] overflow-hidden bg-black"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
    >
      <Aurora thumb={track?.thumb} art={art} />

      {/* the buttons, left of the window's own */}
      <div className="drag absolute inset-x-0 top-0 z-10 flex h-16 items-center justify-end gap-3 pl-[max(2.5rem,var(--wc-left))] pr-[calc(var(--wc-right)+1rem)]">
        <div className="no-drag flex items-center gap-3">
          <KaraokeButton />
          <RomanizeToggle lines={lines} />
          <button onClick={() => ui.set({ lyricsStage: false })} className="no-drag rounded-full border border-white/25 p-2.5 text-white/80 transition-colors hover:bg-white/10 hover:text-white" aria-label="Fermer les paroles">
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {portrait ? (
        // a screen on its side (Beautiful Lyrics): the artwork and the title on top, the lyrics under them
        <div className="relative z-0 flex h-full flex-col px-[7vw] pb-36 pt-20">
          {track && (
            <div className="flex shrink-0 items-end gap-5">
              {cover("w-[min(30vw,260px)] shrink-0")}
              <div className="min-w-0 pb-1">
                <p className="truncate text-[clamp(22px,3.4vw,34px)] font-extrabold leading-tight tracking-tight">{track.name}</p>
                <p className="truncate text-[clamp(14px,2vw,19px)] text-white/65">{track.artists.join(", ")}</p>
              </div>
            </div>
          )}
          <div className="relative mt-6 min-h-0 flex-1 [mask-image:linear-gradient(to_bottom,transparent_0,black_10%,black_80%,transparent_100%)]">
            {lyrics("text-[clamp(28px,5.4vw,54px)] font-extrabold leading-[1.12] tracking-tight", 0.3)}
          </div>
        </div>
      ) : (
        // Apple Music and Spicy Lyrics: the artwork, the bar and the title on the left, the lyrics on the right
        <div className="relative z-0 grid h-full grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] gap-[4vw] pl-[max(5vw,var(--wc-left))] pr-[4vw]">
          <div className="flex min-h-0 flex-col items-center justify-center pb-6 pt-16">
            {cover("w-[min(32vw,52vh)]")}
            {track && (
              <div className="mt-7 w-[min(32vw,52vh)]">
                <p className="truncate text-center text-[clamp(20px,1.9vw,30px)] font-extrabold leading-tight tracking-tight">{track.name}</p>
                <p className="truncate text-center text-[clamp(14px,1.2vw,18px)] text-white/65">{track.artists.join(", ")}</p>
                <ProgressBar className="mt-4" />
                <div className="mt-2 flex items-center justify-center gap-4">
                  <TransportControls />
                </div>
                <div className="mt-1 flex justify-center">
                  <VolumeControl />
                </div>
              </div>
            )}
          </div>
          <div className="relative min-h-0 [mask-image:linear-gradient(to_bottom,transparent_0,transparent_7%,black_22%,black_80%,transparent_100%)]">
            {lyrics("text-[clamp(28px,3.1vw,54px)] font-extrabold leading-[1.12] tracking-tight", 0.42)}
          </div>
        </div>
      )}

      {portrait && (
        <div className="absolute inset-x-0 bottom-0 z-10 flex justify-center pb-6">
          <div className="w-[min(640px,90vw)]">
            <ProgressBar />
            <div className="mt-2 flex items-center justify-center gap-6">
              <TransportControls />
              <VolumeControl />
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}
