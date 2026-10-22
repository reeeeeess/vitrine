import { useEffect, useMemo, useRef, useState } from "react";
import type { LyricsResult } from "../global";
import { cn } from "../lib/cn";
import { errorMessage } from "../lib/format";
import { activeLineIndex, parseLrc } from "../lib/lrc";
import type { Track } from "../lib/types";
import * as engine from "../player/engine";
import { usePosition } from "../player/hooks";
import { run } from "./NowPlayingBar";

/** lines light up a little ahead, as the singer breathes in */
const LEAD_MS = 250;

type LyricsState = { status: "loading" } | { status: "done"; result: LyricsResult | null } | { status: "error"; message: string };

export function Lyrics({ track }: { track: Track }) {
  const [state, setState] = useState<LyricsState>({ status: "loading" });
  const position = usePosition();
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let current = true;
    setState({ status: "loading" });
    window.vitrine.lyrics
      .get({ track: track.name, artist: track.artists[0] ?? "", album: track.albumName, durationMs: track.durationMs })
      .then(
        (result) => current && setState({ status: "done", result }),
        (error: unknown) => current && setState({ status: "error", message: errorMessage(error) }),
      );
    return () => {
      current = false;
    };
    // the poll hands over a new Track object every few seconds: only a new song fetches again
  }, [track.uri]);

  const lines = useMemo(() => (state.status === "done" && state.result?.synced ? parseLrc(state.result.synced) : []), [state]);
  const active = activeLineIndex(lines, position + LEAD_MS);

  useEffect(() => {
    // scroll the lyrics box only: scrollIntoView would also move the overflow-hidden player around it
    const box = container.current;
    const element = box?.querySelector<HTMLElement>(`[data-line="${Math.max(active, 0)}"]`);
    if (box && element) box.scrollTo({ top: element.offsetTop - box.clientHeight / 2 + element.clientHeight / 2, behavior: "smooth" });
  }, [active]);

  if (state.status === "loading") {
    return <p className="text-2xl font-bold text-white/40">Recherche des paroles…</p>;
  }
  if (state.status === "error") {
    return <p className="text-lg text-white/50">Paroles indisponibles ({state.message}).</p>;
  }
  const result = state.result;
  if (result?.instrumental) return <p className="font-display text-3xl text-white/60">♪ Instrumental ♪</p>;
  if (!result || (!result.synced && !result.plain)) {
    return <p className="text-2xl font-bold text-white/40">Pas de paroles pour ce titre.</p>;
  }

  if (lines.length === 0) {
    return (
      <div className="scrollbar-hide h-full overflow-y-auto pb-[40vh] pt-[10vh]">
        {result.plain!.split("\n").map((line, index) => (
          <p key={index} className="py-1.5 text-2xl font-bold leading-snug text-white/80">
            {line || " "}
          </p>
        ))}
      </div>
    );
  }

  return (
    <div ref={container} className="scrollbar-hide relative h-full overflow-y-auto py-[40vh] [mask-image:linear-gradient(to_bottom,transparent,black_18%,black_82%,transparent)]">
      {lines.map((line, index) => (
        <button
          key={`${line.timeMs}-${index}`}
          data-line={index}
          onClick={() => run(() => engine.seek(line.timeMs))}
          className={cn(
            "block w-full origin-left py-2 text-left text-[2.1rem] font-extrabold leading-tight tracking-tight transition-all duration-500",
            index === active ? "scale-100 text-white" : "scale-[0.97] text-white/30 hover:text-white/60",
            index < active && "text-white/45",
          )}
        >
          {line.text || "♪"}
        </button>
      ))}
    </div>
  );
}
