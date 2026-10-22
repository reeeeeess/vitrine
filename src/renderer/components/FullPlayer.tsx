import { motion } from "framer-motion";
import { ChevronDown, ListPlus } from "lucide-react";
import { useEffect, useState } from "react";
import { artworkColor, rgbVar } from "../lib/palette";
import { useStore } from "../lib/store";
import { navigate, ui } from "../lib/ui";
import { playback } from "../player/engine";
import { Artwork } from "./Artwork";
import { Lyrics } from "./Lyrics";
import { LikeButton } from "./LikeButton";
import { StoryButton } from "./StoryButton";
import { ArtistLinks, DevicesButton, ProgressBar, TransportControls, VolumeControl } from "./NowPlayingBar";

/** The immersive player: giant artwork, a backdrop of its colours, and synced lyrics. */
export function FullPlayer() {
  const track = useStore(playback, (s) => s.track);
  const art = track?.imageLarge ?? track?.image;
  const device = useStore(playback, (s) => s.device);
  const [color, setColor] = useState("220 38 38");

  useEffect(() => {
    void artworkColor(art).then((rgb) => setColor(rgbVar(rgb)));
  }, [art]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || ui.get().playlistDialog) return;
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
      transition={{ duration: 0.35, ease: [0.23, 1, 0.32, 1] }}
    >
      {art && (
        <img src={art} alt="" aria-hidden="true" className="absolute inset-[-10%] h-[120%] w-[120%] animate-slow-pan object-cover opacity-50 blur-[90px]" />
      )}
      <div className="absolute inset-0" style={{ background: `radial-gradient(70% 90% at 25% 40%, rgb(${color} / 0.5), transparent 70%)` }} />
      <div className="absolute inset-0 bg-black/45" />

      <div className="drag absolute inset-x-0 top-0 z-10 flex h-16 items-center justify-center">
        <button
          onClick={() => ui.set({ fullPlayer: false })}
          className="flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-1.5 text-sm font-medium text-white/80 backdrop-blur transition-colors hover:bg-white/20 hover:text-white"
        >
          <ChevronDown className="h-4 w-4" />
          Réduire
        </button>
      </div>

      <div className="relative z-0 grid h-full grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] gap-14 px-16 pb-10 pt-20">
        <div className="flex min-h-0 flex-col items-center justify-center">
          {track ? (
            <>
              <motion.div key={track.uri} initial={{ scale: 0.94, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }} className="w-[min(52vh,100%)]">
                <Artwork src={art} className="rounded-3xl shadow-[0_30px_80px_rgba(0,0,0,0.6)] ring-1 ring-white/10" />
              </motion.div>
              <div className="mt-8 w-[min(52vh,100%)]">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="min-w-0 truncate font-display text-3xl tracking-tight">{track.name}</h2>
                  <div className="flex shrink-0 items-center">
                    <button
                      onClick={() => ui.set({ playlistDialog: { uris: [track.uri] } })}
                      className="rounded-full p-2 text-gray-400 transition-colors hover:text-white"
                      aria-label="Ajouter à une playlist"
                      title="Ajouter à une playlist"
                    >
                      <ListPlus className="h-6 w-6" />
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
