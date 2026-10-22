import { AnimatePresence, motion } from "framer-motion";
import { cn } from "../lib/cn";
import { useStore } from "../lib/store";
import { ui } from "../lib/ui";

export function Toasts() {
  const toasts = useStore(ui, (s) => s.toasts);
  return (
    <div className="pointer-events-none fixed right-6 top-20 z-[60] flex w-[360px] flex-col gap-2" aria-live="polite">
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: -12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
            className={cn(
              "glass rounded-xl px-4 py-3 text-sm",
              toast.tone === "error" ? "border-red-500/40 text-red-100" : "text-white/90",
            )}
          >
            {toast.text}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
