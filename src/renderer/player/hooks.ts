import { useEffect, useState } from "react";
import { useStore } from "../lib/store";
import { currentPosition, playback } from "./engine";

/** The playback position, re-read four times a second while playing. */
export function usePosition(): number {
  const paused = useStore(playback, (s) => s.paused);
  const positionMs = useStore(playback, (s) => s.positionMs);
  const updatedAt = useStore(playback, (s) => s.updatedAt);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (paused) return;
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, [paused, positionMs, updatedAt]);
  return currentPosition(playback.get(), paused ? updatedAt : Math.max(now, updatedAt));
}
