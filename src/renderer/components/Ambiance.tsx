import { AnimatePresence, motion } from "framer-motion";
import { useStore } from "../lib/store";
import { theme } from "../lib/theme";
import { playback } from "../player/engine";

/**
 * The artwork playing, blurred, behind the whole app, as Spicetify's Hazy and Glowify themes do: the
 * panels sit on it like frosted glass. A small image blurred costs little; light mode leaves it out (fx-blur).
 */
export function Ambiance() {
  const on = useStore(theme, (s) => s.ambiance);
  const image = useStore(playback, (s) => s.track?.thumb ?? s.track?.image);
  if (!on || !image) return null;
  return (
    <div className="fx-blur pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden="true">
      <AnimatePresence initial={false}>
        <motion.img
          key={image}
          src={image}
          alt=""
          className="absolute inset-[-15%] h-[130%] w-[130%] object-cover blur-[90px] saturate-[1.6]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.6 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.4, ease: "easeInOut" }}
        />
      </AnimatePresence>
      <div className="absolute inset-0 bg-gradient-to-b from-black/45 via-black/60 to-black/80" />
    </div>
  );
}
