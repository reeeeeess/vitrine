import { AnimatePresence, motion } from "framer-motion";
import { Moon } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "../lib/cn";
import { useStore } from "../lib/store";
import { playback } from "../player/engine";
import { setSleepTimer, sleepTimer, type SleepChoice } from "../player/sleepTimer";

const CHOICES: { label: string; value: SleepChoice }[] = [
  { label: "15 minutes", value: 15 },
  { label: "30 minutes", value: 30 },
  { label: "45 minutes", value: 45 },
  { label: "1 heure", value: 60 },
  { label: "Fin du titre", value: "track" },
];

/** The moon in the player bar: pick when playback should stop. */
export function SleepTimerButton() {
  const endsAt = useStore(sleepTimer, (s) => s.endsAt);
  const endOfTrack = useStore(sleepTimer, (s) => s.endOfTrack);
  const hasTrack = useStore(playback, (s) => Boolean(s.track));
  const [open, setOpen] = useState(false);
  const [now, setNow] = useState(Date.now());
  const active = endsAt !== null || endOfTrack;

  useEffect(() => {
    if (!endsAt) return;
    const tick = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(tick);
  }, [endsAt]);

  const left = endsAt ? Math.max(1, Math.ceil((endsAt - now) / 60_000)) : 0;
  const choose = (value: SleepChoice) => {
    setSleepTimer(value);
    setNow(Date.now());
    setOpen(false);
  };

  return (
    <div className="relative">
      <button
        className={cn("flex items-center gap-1 rounded-full p-2 transition-colors disabled:opacity-40", active ? "text-red-500" : "text-gray-400 hover:text-white")}
        onClick={() => setOpen(!open)}
        disabled={!hasTrack && !active}
        aria-label="Minuteur de sommeil"
        title={endOfTrack ? "Arrêt à la fin du titre" : endsAt ? `Arrêt dans ${left} min` : "Minuteur de sommeil"}
      >
        <Moon className="h-4 w-4" />
        {endsAt && <span className="text-[11px] font-semibold tabular-nums">{left}</span>}
      </button>
      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden="true" />
            <motion.ul
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.18 }}
              className="absolute bottom-[calc(100%+12px)] right-0 z-50 w-52 rounded-2xl border border-white/10 bg-panel/95 p-2 shadow-2xl shadow-black/60 backdrop-blur-xl"
            >
              <li className="kicker px-3 pb-1 pt-1.5 text-gray-500">Arrêter la lecture dans</li>
              {CHOICES.map((choice) => (
                <li key={choice.label}>
                  <button onClick={() => choose(choice.value)} className="w-full rounded-xl px-3 py-2 text-left text-sm hover:bg-white/10">
                    {choice.label}
                  </button>
                </li>
              ))}
              {active && (
                <li>
                  <button onClick={() => choose(null)} className="w-full rounded-xl px-3 py-2 text-left text-sm text-red-400 hover:bg-white/10">
                    Annuler le minuteur
                  </button>
                </li>
              )}
            </motion.ul>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
