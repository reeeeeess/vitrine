import type { Track } from "../lib/types";
import { usePosition } from "../player/hooks";
import { useLyrics } from "../player/useLyrics";
import { RomanizeToggle, StagedLyrics } from "./StagedLyrics";

/** lines light up a little ahead, as the singer breathes in */
const LEAD_MS = 250;

export function Lyrics({ track }: { track: Track }) {
  const { state, lines } = useLyrics(track);
  const position = usePosition();

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
    <div className="relative h-full">
      <RomanizeToggle lines={lines} className="absolute right-0 top-2 z-10" />
      <StagedLyrics
        lines={lines}
        position={position + LEAD_MS}
        anchor={0.5}
        className="[mask-image:linear-gradient(to_bottom,transparent,black_18%,black_82%,transparent)]"
        lineClassName="text-[2.1rem] font-extrabold leading-tight tracking-tight"
      />
    </div>
  );
}
