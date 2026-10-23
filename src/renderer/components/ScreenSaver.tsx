import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { activeLineIndex } from "../lib/lrc";
import { lite } from "../lib/lite";
import { useStore } from "../lib/store";
import { ui } from "../lib/ui";
import { playback } from "../player/engine";
import { usePosition } from "../player/hooks";
import { useLyrics } from "../player/useLyrics";
import { LOCALE } from "../lib/i18n";

const IDLE_MS = 2 * 60_000;
const clock = new Intl.DateTimeFormat(LOCALE, { hour: "2-digit", minute: "2-digit" });

/**
 * Movix's screen saver: after two minutes without the mouse or the keyboard, with the player or the
 * lyrics open and the music playing, the artwork fills the screen and drifts, with the line being
 * sung and the time. The first movement wakes it.
 */
export function ScreenSaver() {
  const open = useStore(ui, (s) => s.fullPlayer || s.lyricsStage);
  const playing = useStore(playback, (s) => Boolean(s.track) && !s.paused);
  const allowed = useStore(lite, (s) => s.effects.backdrops);
  const [idle, setIdle] = useState(false);

  useEffect(() => {
    if (!open || !playing || !allowed) {
      setIdle(false);
      return;
    }
    let timer = setTimeout(() => setIdle(true), IDLE_MS);
    const wake = () => {
      setIdle(false);
      clearTimeout(timer);
      timer = setTimeout(() => setIdle(true), IDLE_MS);
    };
    const events = ["mousemove", "mousedown", "keydown", "wheel"] as const;
    events.forEach((name) => window.addEventListener(name, wake, { passive: true }));
    return () => {
      clearTimeout(timer);
      events.forEach((name) => window.removeEventListener(name, wake));
    };
  }, [open, playing, allowed]);

  return <AnimatePresence>{idle && <Saver />}</AnimatePresence>;
}

function Saver() {
  const track = useStore(playback, (s) => s.track);
  const { lines } = useLyrics(track);
  const position = usePosition();
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 15_000);
    return () => clearInterval(timer);
  }, []);
  if (!track) return null;
  const line = lines[activeLineIndex(lines, position + 250)]?.text;
  return (
    <motion.div className="fixed inset-0 z-[90] cursor-none overflow-hidden bg-black" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 1.2 }}>
      <motion.img
        key={track.uri}
        src={track.imageLarge ?? track.image}
        alt=""
        aria-hidden="true"
        className="absolute inset-0 h-full w-full object-cover opacity-55"
        initial={{ scale: 1.05, x: "-2%", y: "-1%" }}
        animate={{ scale: 1.2, x: "2%", y: "2%" }}
        transition={{ duration: 60, ease: "linear", repeat: Infinity, repeatType: "reverse" }}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-black/10" />
      <div className="absolute bottom-16 left-16 right-16">
        <p className="font-mono text-sm uppercase tracking-[0.3em] text-white/60">{clock.format(now)}</p>
        <p translate="no" className="mt-3 font-display text-6xl leading-none tracking-tight">{track.name}</p>
        <p translate="no" className="mt-3 text-2xl text-white/70">{track.artists.join(", ")}</p>
        {line && <p translate="no" className="mt-8 max-w-4xl font-display text-3xl text-white/90">{line}</p>}
      </div>
    </motion.div>
  );
}
