import { motion } from "framer-motion";
import { ExternalLink, Loader2, Play, RotateCcw, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { shuffle } from "../lib/flow";
import { lite } from "../lib/lite";
import * as api from "../lib/spotify";
import { useStore } from "../lib/store";
import type { Collection } from "../lib/types";
import { ui } from "../lib/ui";
import { openCollection, playCollection } from "../views/Home";
import { Artwork } from "./Artwork";

const CARD = 148;
const GAP = 12;
const SPIN_MS = 2200;
/** the reel is the shuffled choices this many times over: enough road for the spin */
const LAPS = 6;

/** Where the reel stops so that choice `index` of the last lap sits under the marker. */
export function stopOffset(count: number, index: number, viewport: number): number {
  const slot = CARD + GAP;
  return (count * (LAPS - 1) + index) * slot - (viewport / 2 - CARD / 2);
}

const COLORS = ["#dc2626", "#f2a33c", "#ff3d2e", "#ffffff", "#facc15"];

/** A burst of confetti, drawn by hand: no library to load for a few seconds of fun. */
function Confetti() {
  const pieces = useMemo(
    () =>
      Array.from({ length: 46 }, (_, i) => ({
        x: (Math.random() - 0.5) * 900,
        y: -150 - Math.random() * 260,
        rotate: Math.random() * 720 - 360,
        color: COLORS[i % COLORS.length],
        delay: Math.random() * 0.15,
        w: 6 + Math.random() * 6,
      })),
    [],
  );
  return (
    <div className="pointer-events-none absolute left-1/2 top-1/2" aria-hidden="true">
      {pieces.map((piece, i) => (
        <motion.span
          key={i}
          className="absolute block rounded-[2px]"
          style={{ width: piece.w, height: piece.w * 0.45, background: piece.color }}
          initial={{ x: 0, y: 0, opacity: 1, rotate: 0 }}
          animate={{ x: piece.x, y: [0, piece.y, piece.y + 520], opacity: [1, 1, 0], rotate: piece.rotate }}
          transition={{ duration: 1.6, delay: piece.delay, ease: "easeOut" }}
        />
      ))}
    </div>
  );
}

/** Movix's roulette: "I don't know what to listen to" — a reel of your playlists and albums spins and picks one. */
export function Roulette() {
  const motionOn = useStore(lite, (s) => s.effects.transitions);
  const [choices, setChoices] = useState<Collection[]>();
  const [round, setRound] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [settled, setSettled] = useState(false);
  const viewport = Math.min(window.innerWidth - 80, 1000);

  useEffect(() => {
    void Promise.allSettled([api.myPlaylists(), api.savedAlbums()]).then(([playlists, albums]) => {
      const all = [...(playlists.status === "fulfilled" ? playlists.value : []), ...(albums.status === "fulfilled" ? albums.value : [])].filter((c) => c.total !== 0);
      setChoices(shuffle(all).slice(0, 40));
    });
  }, []);

  const spin = useCallback(() => {
    if (!choices?.length) return;
    setSettled(false);
    setPicked(Math.floor(Math.random() * choices.length));
    setRound((n) => n + 1);
  }, [choices]);

  useEffect(() => {
    if (choices?.length && picked === null) spin();
  }, [choices, picked, spin]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && ui.set({ roulette: false });
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const reel = useMemo(() => (choices ? Array.from({ length: LAPS }, () => choices).flat() : []), [choices]);
  const choice = picked !== null ? choices?.[picked] : undefined;
  const close = () => ui.set({ roulette: false });

  return (
    <motion.div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(event) => event.target === event.currentTarget && close()}>
      <div className="relative w-[min(1080px,95vw)] rounded-3xl border border-white/10 bg-panel p-8 shadow-2xl">
        <button onClick={close} className="absolute right-5 top-5 rounded-full p-2 text-gray-400 hover:bg-white/10 hover:text-white" aria-label="Fermer">
          <X className="h-5 w-5" />
        </button>
        <span className="kicker font-mono font-medium text-red-500">ROULETTE</span>
        <h2 className="mt-1 font-display text-3xl tracking-tight">Pas d'idée ? Laissez tourner.</h2>

        {!choices ? (
          <div className="flex h-56 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-red-500" />
          </div>
        ) : choices.length === 0 ? (
          <p className="mt-6 text-gray-400">Ajoutez des playlists ou des albums à votre bibliothèque pour jouer à la roulette.</p>
        ) : (
          <>
            <div className="relative mx-auto mt-8 overflow-hidden" style={{ width: viewport, height: CARD + 50 }}>
              <motion.div
                key={round}
                className="flex"
                style={{ gap: GAP }}
                initial={{ x: 0 }}
                animate={{ x: -stopOffset(choices.length, picked ?? 0, viewport) }}
                transition={motionOn ? { duration: SPIN_MS / 1000, ease: [0.12, 0.8, 0.2, 1] } : { duration: 0 }}
                onAnimationComplete={() => setSettled(true)}
              >
                {reel.map((collection, index) => (
                  <div key={`${collection.id}-${index}`} className="shrink-0" style={{ width: CARD }}>
                    <Artwork src={collection.card ?? collection.image} className="rounded-xl ring-1 ring-white/10" />
                  </div>
                ))}
              </motion.div>
              {/* the marker, and the edges fading out */}
              <div className="pointer-events-none absolute inset-y-0 left-1/2 w-[3px] -translate-x-1/2 accent-bg shadow-[0_0_18px_rgb(var(--c-red-600))]" />
              <div className="pointer-events-none absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-panel to-transparent" />
              <div className="pointer-events-none absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-panel to-transparent" />
            </div>

            <div className="relative mt-4 flex min-h-[88px] flex-col items-center justify-center text-center">
              {settled && motionOn && <Confetti key={round} />}
              {settled && choice ? (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}>
                  <p className="font-display text-2xl">{choice.name}</p>
                  <p className="mt-0.5 text-sm text-gray-400">{choice.subtitle}</p>
                  <div className="mt-4 flex flex-wrap justify-center gap-3">
                    <button
                      onClick={() => {
                        playCollection(choice);
                        close();
                      }}
                      className="btn-primary"
                    >
                      <Play className="h-5 w-5 fill-current" />
                      Lancer la lecture
                    </button>
                    <button onClick={spin} className="btn-ghost">
                      <RotateCcw className="h-5 w-5" />
                      Relancer
                    </button>
                    <button
                      onClick={() => {
                        openCollection(choice);
                        close();
                      }}
                      className="btn-ghost"
                    >
                      <ExternalLink className="h-5 w-5" />
                      Voir
                    </button>
                  </div>
                </motion.div>
              ) : (
                <p className="font-mono text-xs uppercase tracking-[0.2em] text-white/50">Ça tourne…</p>
              )}
            </div>
          </>
        )}
      </div>
    </motion.div>
  );
}

export const openRoulette = () => ui.set({ roulette: true, fullPlayer: false });
