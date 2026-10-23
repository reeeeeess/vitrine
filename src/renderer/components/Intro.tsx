import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { EASE } from "../lib/motion";
import { lite } from "../lib/lite";

const SHOWN_KEY = "vitrine.introShown";

function alreadyShown(): boolean {
  try {
    return sessionStorage.getItem(SHOWN_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * The intro at launch: the brackets of [Vitrine] open, the three equalizer bars rise, the name appears,
 * all in 1.3 s while the first data arrive. Once per launch; never in light mode or when Vitrine starts
 * hidden in the tray.
 */
export function Intro() {
  const [show, setShow] = useState(() => !alreadyShown() && lite.get().effects.transitions && document.visibilityState === "visible");
  useEffect(() => {
    if (!show) return;
    try {
      sessionStorage.setItem(SHOWN_KEY, "1");
    } catch {
      // shown again next time, no harm
    }
    const timer = setTimeout(() => setShow(false), 1300);
    return () => clearTimeout(timer);
  }, []);
  return (
    <AnimatePresence>
      {show && (
        <motion.div className="fixed inset-0 z-[90] flex items-center justify-center bg-black" exit={{ opacity: 0 }} transition={{ duration: 0.35 }} onClick={() => setShow(false)} aria-hidden="true">
          <div className="flex items-center font-display text-7xl tracking-tight">
            <motion.span className="text-red-600" initial={{ x: 60, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ duration: 0.5, ease: EASE }}>
              [
            </motion.span>
            <span className="mx-3 flex h-14 items-end gap-1.5">
              {[0.6, 1, 0.4].map((height, i) => (
                <motion.span
                  key={i}
                  className="w-3 rounded-sm bg-white"
                  initial={{ height: 0 }}
                  animate={{ height: `${height * 100}%` }}
                  transition={{ delay: 0.25 + i * 0.08, duration: 0.45, ease: EASE }}
                />
              ))}
            </span>
            <motion.span initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55, duration: 0.4, ease: EASE }}>
              Vitrine
            </motion.span>
            <motion.span className="text-red-600" initial={{ x: -60, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ duration: 0.5, ease: EASE }}>
              ]
            </motion.span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
