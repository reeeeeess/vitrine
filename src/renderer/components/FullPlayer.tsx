import { motion } from "framer-motion";
import { Bookmark, ChevronDown, Tv, Disc3, Layers, ListPlus, Mic2, Repeat, Sparkles } from "lucide-react";
import { useEffect, useRef } from "react";
import { cn } from "../lib/cn";
import { formatTime } from "../lib/format";
import { EASE, SPRING } from "../lib/motion";
import { createStore, useStore } from "../lib/store";
import { navigate, ui } from "../lib/ui";
import { currentPosition, playback } from "../player/engine";
import { addMoment } from "../lib/moments";
import { clearLoop, loop, loopChorus, markLoop } from "../player/loop";
import { Artwork } from "./Artwork";
import { Aurora } from "./Aurora";
import { Marquee } from "./Marquee";
import { Vinyl } from "./Vinyl";
import { openSalon } from "./Salon";
import { openVersions, versionsOf } from "./VersionsPanel";
import { Lyrics } from "./Lyrics";
import { LikeButton } from "./LikeButton";
import { StoryButton } from "./StoryButton";
import { trackMenu } from "./TrackMenu";
import { ArtistLinks, DevicesButton, ProgressBar, TransportControls, VolumeControl } from "./NowPlayingBar";

const VINYL_KEY = "vitrine.vinyl";
const vinylMode = createStore({ on: readFlag(VINYL_KEY) });

function readFlag(key: string): boolean {
  try {
    return localStorage.getItem(key) === "on";
  } catch {
    return false;
  }
}

function setVinyl(on: boolean): void {
  vinylMode.set({ on });
  try {
    localStorage.setItem(VINYL_KEY, on ? "on" : "off");
  } catch {
    // for this run only
  }
}

/** A–B loop and the chorus on repeat (Loopy Loop, TikTok). */
function LoopButtons() {
  const uri = useStore(playback, (s) => s.track?.uri);
  const current = useStore(loop, (s) => (s.current?.uri === uri ? s.current : null));
  const chip = "flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors";
  return (
    <div className="mt-3 flex items-center gap-2">
      <button
        onClick={markLoop}
        className={cn(chip, current ? "border-red-500/60 bg-red-500/15 text-red-200" : "border-white/15 text-white/60 hover:text-white")}
        title="Boucle A–B : un clic pose le début, un deuxième la fin, un troisième l'enlève"
      >
        <Repeat className="h-3.5 w-3.5" />
        {!current ? "Boucle A–B" : current.bMs === undefined ? "A posé… cliquez à la fin" : `Boucle ${formatTime(current.aMs)}–${formatTime(current.bMs)}`}
      </button>
      {!current && (
        <button onClick={loopChorus} className={cn(chip, "border-white/15 text-white/60 hover:text-white")} title="20 secondes du refrain, en boucle">
          <Sparkles className="h-3.5 w-3.5" />
          Refrain en boucle
        </button>
      )}
      {current && (
        <button onClick={clearLoop} className={cn(chip, "border-white/15 text-white/60 hover:text-white")}>
          Arrêter la boucle
        </button>
      )}
    </div>
  );
}

/** The immersive player: giant artwork, a backdrop of its colours, and synced lyrics. */
export function FullPlayer() {
  const track = useStore(playback, (s) => s.track);
  const art = track?.imageLarge ?? track?.image;
  // under a 90 px blur, 64 px of image are as good as 640 and weigh a hundredth
  const backdrop = track?.thumb ?? track?.image;
  const device = useStore(playback, (s) => s.device);
  const paused = useStore(playback, (s) => s.paused);
  const vinyl = useStore(vinylMode, (s) => s.on);
  // false for the first render: the artwork then arrives from the bar instead of fading in
  const opened = useRef(false);
  useEffect(() => {
    opened.current = true;
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      // a panel opened over the player (versions, playlists) closes first
      if (event.key !== "Escape" || ui.get().playlistDialog || versionsOf.get().track) return;
      // the devices menu closes first, then the player
      ui.set(ui.get().devicesOpen ? { devicesOpen: false } : { fullPlayer: false });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <motion.div
      className="fixed inset-0 z-50 overflow-hidden bg-black"
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 40 }}
      transition={SPRING}
    >
      {/* a living backdrop of the artwork's colours (Apple Music) */}
      <Aurora thumb={backdrop} art={art} dim={0.45} />

      <div className="drag absolute inset-x-0 top-0 z-10 flex h-16 items-center justify-center">
        <button
          onClick={() => ui.set({ fullPlayer: false })}
          className="flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-1.5 text-sm font-medium text-white/80 backdrop-blur transition-colors hover:bg-white/20 hover:text-white"
        >
          <ChevronDown className="h-4 w-4" />
          Réduire
        </button>
        <button
          onClick={() => {
            ui.set({ fullPlayer: false });
            openSalon();
          }}
          className="ml-2 flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-1.5 text-sm font-medium text-white/80 backdrop-blur transition-colors hover:bg-white/20 hover:text-white"
          title="Mode salon : plein écran lisible de loin, pour une télé ou un deuxième écran (Ctrl+Maj+S)"
        >
          <Tv className="h-4 w-4" />
          Mode salon
        </button>
      </div>

      <div className="relative z-0 grid h-full grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] gap-14 px-16 pb-10 pt-20">
        <div className="flex min-h-0 flex-col items-center justify-center">
          {track ? (
            <>
              <motion.div
                key={track.uri}
                // on opening, the artwork comes from the bar (layoutId): no fade then, only for a new track
                initial={opened.current ? { opacity: 0, y: 12 } : false}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: EASE }}
                className="w-[min(52vh,100%)]"
              >
                {vinyl ? (
                  <Vinyl src={art} paused={paused} />
                ) : (
                  // the artwork steps back on pause and comes forward again with a little bounce (Apple Music)
                  // the same artwork as the bar's (layoutId): it grows from there to here, and back on closing
                  <motion.div
                    layoutId="now-cover"
                    animate={{ scale: paused ? 0.84 : 1 }}
                    transition={SPRING}
                    style={{ borderRadius: 24 }}
                    className={cn("overflow-hidden rounded-3xl ring-1 ring-white/10 transition-shadow duration-500", paused ? "shadow-[0_12px_30px_rgba(0,0,0,0.45)]" : "shadow-[0_30px_80px_rgba(0,0,0,0.6)]")}
                  >
                    <div className="kenburns">
                      <Artwork src={art} className="rounded-none" />
                    </div>
                  </motion.div>
                )}
              </motion.div>
              <div className="mt-8 w-[min(52vh,100%)]">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="min-w-0 font-display text-3xl tracking-tight" onContextMenu={(event) => trackMenu(event, track)}>
                    <Marquee text={track.name} />
                  </h2>
                  <div className="flex shrink-0 items-center">
                    <button
                      onClick={() => ui.set({ playlistDialog: { uris: [track.uri] } })}
                      className="rounded-full p-2 text-gray-400 transition-colors hover:text-white"
                      aria-label="Ajouter à une playlist"
                      title="Ajouter à une playlist"
                    >
                      <ListPlus className="h-6 w-6" />
                    </button>
                    <button
                      onClick={() => ui.set({ lyricsStage: true, fullPlayer: false })}
                      className="rounded-full p-2 text-gray-400 transition-colors hover:text-white"
                      aria-label="Paroles plein écran"
                      title="Paroles plein écran (karaoké)"
                    >
                      <Mic2 className="h-6 w-6" />
                    </button>
                    <button
                      onClick={() => setVinyl(!vinyl)}
                      className={cn("rounded-full p-2 transition-colors", vinyl ? "text-red-500 hover:text-red-400" : "text-gray-400 hover:text-white")}
                      aria-label="Mode vinyle"
                      aria-pressed={vinyl}
                      title="Mode vinyle"
                    >
                      <Disc3 className="h-6 w-6" />
                    </button>
                    <button
                      onClick={() => openVersions(track)}
                      className="rounded-full p-2 text-gray-400 transition-colors hover:text-white"
                      aria-label="Autres versions"
                      title="Autres versions : accélérée, ralentie, acoustique, instrumentale, live, remix"
                    >
                      <Layers className="h-6 w-6" />
                    </button>
                    <button
                      onClick={() => void addMoment(track, currentPosition(playback.get()))}
                      className="rounded-full p-2 text-gray-400 transition-colors hover:text-white"
                      aria-label="Marquer ce moment"
                      title="Marquer ce moment, avec une note (Ctrl+M)"
                    >
                      <Bookmark className="h-6 w-6" />
                    </button>
                    <StoryButton track={track} />
                    <LikeButton track={track} size="h-6 w-6" />
                  </div>
                </div>
                <ArtistLinks track={track} className="mt-1 text-lg text-white/70" />
                {track.albumId && (
                  <button className="mt-0.5 truncate text-sm text-white/50 hover:text-white hover:underline" onClick={() => navigate({ name: "album", id: track.albumId! })}>
                    {track.albumName}
                  </button>
                )}
                <ProgressBar className="mt-6" />
                <LoopButtons />
                <div className="mt-4">
                  <TransportControls large />
                </div>
                <div className="mt-5 flex items-center justify-between">
                  <span className="text-xs text-white/50">{device ? `Lecture sur ${device.name}` : ""}</span>
                  <div className="flex items-center gap-1">
                    <DevicesButton />
                    <VolumeControl />
                  </div>
                </div>
              </div>
            </>
          ) : (
            <p className="text-white/50">Rien en cours de lecture.</p>
          )}
        </div>
        <div className="min-h-0">{track && <Lyrics track={track} />}</div>
      </div>
    </motion.div>
  );
}
