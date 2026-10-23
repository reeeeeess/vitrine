// What a screen reader says by itself: the song that starts (a polite message, after what it is reading).
// The toasts have their own live region (Toasts.tsx).
import { useEffect, useState } from "react";
import { playback } from "../player/engine";

export function Announcer() {
  const [message, setMessage] = useState("");
  useEffect(() => {
    let last = playback.get().track?.uri ?? "";
    return playback.subscribe(() => {
      const track = playback.get().track;
      if (!track || track.uri === last) return;
      last = track.uri;
      setMessage(`En lecture : ${track.name} — ${track.artists.join(", ")}`);
    });
  }, []);
  return (
    <p className="sr-only" aria-live="polite" aria-atomic="true">
      {message}
    </p>
  );
}
