import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { useBlurred } from "../lib/blurred";
import { activeLineIndex } from "../lib/lrc";
import * as api from "../lib/spotify";
import { createStore, useStore } from "../lib/store";
import type { Artist } from "../lib/types";
import * as engine from "../player/engine";
import { playback } from "../player/engine";
import { usePosition } from "../player/hooks";
import { useLyrics } from "../player/useLyrics";
import { Artwork } from "./Artwork";
import { run } from "./NowPlayingBar";
import { LOCALE } from "../lib/i18n";

export const salon = createStore({ open: false });

/** Opens the living-room mode, full screen. */
export function openSalon(): void {
  salon.set({ open: true });
  void document.documentElement.requestFullscreen?.().catch(() => undefined);
}

export function closeSalon(): void {
  salon.set({ open: false });
  if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
}

/** What the keys do in the living-room mode, as a TV remote would. */
export function salonKey(key: string): "toggle" | "next" | "previous" | "louder" | "quieter" | "close" | null {
  switch (key) {
    case " ":
    case "Enter":
    case "MediaPlayPause":
      return "toggle";
    case "ArrowRight":
    case "MediaTrackNext":
      return "next";
    case "ArrowLeft":
    case "MediaTrackPrevious":
      return "previous";
    case "ArrowUp":
      return "louder";
    case "ArrowDown":
      return "quieter";
    case "Escape":
    case "Backspace":
      return "close";
    default:
      return null;
  }
}

const clockFormat = new Intl.DateTimeFormat(LOCALE, { hour: "2-digit", minute: "2-digit" });
const dayFormat = new Intl.DateTimeFormat(LOCALE, { weekday: "long", day: "numeric", month: "long" });
/** "vendredi 23 octobre" → "Vendredi 23 octobre": only the first letter, the French way */
export const sentence = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/**
 * The living-room mode (Spicetify's Full Screen, in TV mode): read from across the room on a television or a
 * second screen — the artist's photo behind, the time, the line being sung, the title very big, what comes
 * next — and driven by the arrows, the space bar or a remote's media keys. The mouse hides after 3 s.
 */
export function Salon() {
  const open = useStore(salon, (s) => s.open);
  const track = useStore(playback, (s) => s.track);
  const next = useStore(playback, (s) => s.nextTrack);
  const duration = useStore(playback, (s) => s.durationMs);
  const position = usePosition();
  const { lines } = useLyrics(open ? track ?? undefined : undefined);
  const [artist, setArtist] = useState<Artist | null>(null);
  const [now, setNow] = useState(new Date());
  const [still, setStill] = useState(false);
  const backdrop = useBlurred(open ? (track?.thumb ?? track?.image) : undefined, { blur: 5 });

  useEffect(() => {
    if (!open) return;
    const timer = setInterval(() => setNow(new Date()), 15_000);
    const onKey = (event: KeyboardEvent) => {
      const action = salonKey(event.key);
      if (!action) return;
      event.preventDefault();
      event.stopPropagation();
      const volume = playback.get().volume;
      if (action === "toggle") run(engine.togglePlay);
      else if (action === "next") run(engine.next);
      else if (action === "previous") run(engine.previous);
      else if (action === "louder") engine.setVolume(volume + 0.05);
      else if (action === "quieter") engine.setVolume(volume - 0.05);
      else closeSalon();
    };
    // leaving the browser's full screen (F11, Échap) leaves the mode too
    const onFullscreen = () => !document.fullscreenElement && salon.get().open && salon.set({ open: false });
    window.addEventListener("keydown", onKey, true);
    document.addEventListener("fullscreenchange", onFullscreen);
    return () => {
      clearInterval(timer);
      window.removeEventListener("keydown", onKey, true);
      document.removeEventListener("fullscreenchange", onFullscreen);
    };
  }, [open]);

  // the artist's photo, asked once per artist and run (api.artistCard)
  const artistId = track?.artistIds[0];
  useEffect(() => {
    let current = true;
    setArtist(null);
    if (open && artistId) api.artistCard(artistId).then((found) => current && setArtist(found), () => undefined);
    return () => {
      current = false;
    };
  }, [open, artistId]);

  // the mouse disappears when it stays still
  useEffect(() => {
    if (!open) return;
    let timer = setTimeout(() => setStill(true), 3000);
    const moved = () => {
      setStill(false);
      clearTimeout(timer);
      timer = setTimeout(() => setStill(true), 3000);
    };
    window.addEventListener("mousemove", moved);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("mousemove", moved);
    };
  }, [open]);

  const index = activeLineIndex(lines, position + 250);
  const line = index >= 0 ? lines[index]?.text.trim() : "";
  const photo = artist?.image;

  return (
    <AnimatePresence>
      {open && track && (
        <motion.div
          className="fixed inset-0 z-[88] overflow-hidden bg-black"
          style={{ cursor: still ? "none" : "default" }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6 }}
          onDoubleClick={closeSalon}
        >
          {/* the artist's photo, slowly zooming; the artwork blurred while it comes, or when there is none */}
          <AnimatePresence>
            <motion.img
              key={photo ?? backdrop ?? "none"}
              src={photo ?? backdrop}
              alt=""
              aria-hidden="true"
              className="absolute inset-0 h-full w-full max-w-none object-cover"
              initial={{ opacity: 0, scale: 1.04 }}
              animate={{ opacity: photo ? 0.75 : 0.6, scale: 1.14 }}
              exit={{ opacity: 0 }}
              transition={{ opacity: { duration: 1.2 }, scale: { duration: 40, ease: "linear" } }}
            />
          </AnimatePresence>
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/55 to-black/20" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-transparent to-transparent" />

          {/* the time, top right */}
          <div className="absolute right-[5vw] top-[5vh] text-right">
            <p className="font-display text-[clamp(40px,6vw,96px)] leading-none tracking-tight">{clockFormat.format(now)}</p>
            <p className="mt-2 text-[clamp(14px,1.4vw,22px)] text-white/60">{sentence(dayFormat.format(now))}</p>
          </div>

          {/* the line being sung */}
          <AnimatePresence mode="wait">
            {line && (
              <motion.p
                key={`${index}-${line}`}
                translate="no"
                className="absolute left-[5vw] right-[30vw] top-[24vh] text-[clamp(28px,3.6vw,64px)] font-extrabold leading-tight tracking-tight text-white/90"
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
              >
                {line}
              </motion.p>
            )}
          </AnimatePresence>

          {/* the title, very big, bottom left */}
          <div className="absolute bottom-[7vh] left-[5vw] right-[34vw]">
            <div className="flex items-end gap-[2vw]">
              <Artwork src={track.imageLarge ?? track.image} className="h-[clamp(96px,13vw,220px)] w-[clamp(96px,13vw,220px)] shrink-0 rounded-2xl shadow-2xl ring-1 ring-white/15" />
              <div className="min-w-0 pb-1">
                <p translate="no" className="truncate font-display text-[clamp(36px,5.6vw,110px)] leading-[0.95] tracking-tight">{track.name}</p>
                <p translate="no" className="mt-3 truncate text-[clamp(18px,2vw,34px)] text-white/75">{track.artists.join(", ")}</p>
              </div>
            </div>
            <div className="mt-[4vh] h-1.5 overflow-hidden rounded-full bg-white/20">
              <div className="h-full rounded-full bg-white/90" style={{ width: `${duration ? Math.min(100, (position / duration) * 100) : 0}%` }} />
            </div>
          </div>

          {/* what comes next, bottom right */}
          {next && (
            <div className="absolute bottom-[7vh] right-[5vw] flex w-[24vw] min-w-[260px] items-center gap-4 rounded-3xl bg-white/10 p-4 backdrop-blur-xl">
              <Artwork src={next.thumb ?? next.image} className="h-16 w-16 shrink-0 rounded-xl" />
              <div className="min-w-0">
                <p className="font-mono text-xs uppercase tracking-[0.2em] text-white/55">Ensuite</p>
                <p translate="no" className="truncate text-lg font-semibold">{next.name}</p>
                <p translate="no" className="truncate text-sm text-white/60">{next.artists.join(", ")}</p>
              </div>
            </div>
          )}

          <p className={`absolute bottom-3 left-1/2 -translate-x-1/2 text-xs text-white/40 transition-opacity duration-700 ${still ? "opacity-0" : "opacity-100"}`}>
            Espace : lecture · ← → : titre · ↑ ↓ : volume · Échap : quitter
          </p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
