import { AnimatePresence, motion } from "framer-motion";
import { Hourglass } from "lucide-react";
import { useEffect, useState } from "react";
import { pauseMessage, rateLimit } from "../lib/apiGate";
import { cn } from "../lib/cn";
import { useStore } from "../lib/store";
import { ui } from "../lib/ui";

/** Spotify's long pause (Too many requests), said once for the whole app, with when it ends. */
function RateLimitNotice() {
  const until = useStore(rateLimit, (s) => s.until);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    setNow(Date.now());
    if (until <= Date.now()) return;
    const timer = setInterval(() => setNow(Date.now()), 15_000);
    const end = setTimeout(() => setNow(Date.now()), until - Date.now() + 100);
    return () => {
      clearInterval(timer);
      clearTimeout(end);
    };
  }, [until]);
  // short pauses are waited out quietly
  if (until - now < 20_000) return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      className="glass flex items-start gap-3 rounded-xl border-amber-400/40 px-4 py-3 text-sm text-amber-100"
      role="status"
    >
      <Hourglass className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
      {pauseMessage(until, now)}
    </motion.div>
  );
}

export function Toasts() {
  const toasts = useStore(ui, (s) => s.toasts);
  return (
    <div className="pointer-events-none fixed right-6 top-20 z-[60] flex w-[360px] flex-col gap-2" aria-live="polite">
      <AnimatePresence>
        <RateLimitNotice key="rate-limit" />
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
