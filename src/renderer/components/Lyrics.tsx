import type { Track } from "../lib/types";
import { useStore } from "../lib/store";
import { usePosition } from "../player/hooks";
import { karaoke, lyricsSource } from "../player/karaoke";
import { useLyrics } from "../player/useLyrics";
import { PlainLyrics, RomanizeToggle, StagedLyrics } from "./StagedLyrics";
import { currentPosition, playback } from "../player/engine";

/** lines light up a little ahead, as the singer breathes in */
const LEAD_MS = 250;

export function Lyrics({ track: playing }: { track: Track }) {
  // during karaoke, the original's lyrics, in time with the instrumental
  const source = lyricsSource(playing, useStore(karaoke, (s) => s.current));
  const { state, lines } = useLyrics(source.track);
  const position = source.toLyrics(usePosition());
  const durationMs = useStore(playback, (s) => s.durationMs);

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
    return <PlainLyrics text={result.plain ?? ""} position={position} durationMs={durationMs} className="py-[10vh] text-2xl font-bold leading-[1.6] text-white/80" />;
  }

  return (
    <div className="relative h-full">
      <RomanizeToggle lines={lines} className="absolute right-0 top-2 z-10" />
      <StagedLyrics
        lines={lines}
        clock={() => source.toLyrics(currentPosition(playback.get())) + LEAD_MS}
        anchor={0.5}
        className="[mask-image:linear-gradient(to_bottom,transparent,black_18%,black_82%,transparent)]"
        lineClassName="text-[2.1rem] font-extrabold leading-tight tracking-tight"
      />
    </div>
  );
}
