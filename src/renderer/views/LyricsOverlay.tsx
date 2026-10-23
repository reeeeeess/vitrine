import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import type { OverlayLine } from "../global";

/** The page of the lyrics overlay window: the line being sung, big, over whatever is on screen. */
export function LyricsOverlay() {
  const [line, setLine] = useState<OverlayLine>({ line: "", next: "", title: "" });

  useEffect(() => {
    // the window is transparent: only the text shows (styles.css)
    document.documentElement.classList.add("overlay");
    return window.vitrine.overlay.onLine(setLine);
  }, []);

  return (
    <div translate="no" className="flex h-screen select-none flex-col items-center justify-center gap-1 overflow-hidden px-6 text-center">
      <AnimatePresence mode="wait">
        {line.line && (
          <motion.p
            key={line.line}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.2 }}
            className="line-clamp-2 px-8 py-3 font-display text-[38px] leading-tight text-white [-webkit-text-stroke:1px_rgba(0,0,0,0.35)] [text-shadow:0_2px_4px_rgba(0,0,0,0.9),0_0_24px_rgba(0,0,0,0.75)]"
          >
            {line.line}
          </motion.p>
        )}
      </AnimatePresence>
      {line.next && <p className="-mt-3 line-clamp-1 px-8 pb-2 text-xl font-semibold text-white/60 [text-shadow:0_2px_6px_rgba(0,0,0,0.9)]">{line.next}</p>}
    </div>
  );
}
