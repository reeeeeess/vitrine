import { Play } from "lucide-react";
import { cn } from "../lib/cn";
import type { Track } from "../lib/types";
import * as engine from "../player/engine";
import { Artwork } from "./Artwork";
import { run } from "./NowPlayingBar";
import { Row } from "./Row";
import { trackMenu } from "./TrackMenu";

/** Movix's "Today's Trends": the person's 10 tracks of the last 4 weeks, each behind a giant outlined number. */
export function Top10({ tracks, number }: { tracks: Track[]; number?: number }) {
  if (tracks.length === 0) return null;
  const uris = tracks.map((track) => track.uri);
  return (
    <Row title="Votre Top 10 du mois" number={number} kicker="TOP 10">
      {tracks.slice(0, 10).map((track, index) => (
        <div
          key={track.id}
          className={cn("group relative shrink-0 snap-start pr-3", index === 9 ? "pl-[150px]" : "pl-[86px]")}
          onContextMenu={(event) => trackMenu(event, track)}
        >
          <button className="relative w-36 text-left" onClick={() => run(() => engine.playTracks(uris, index))} aria-label={`Lire ${track.name}, numéro ${index + 1}`}>
            <span className="relative block transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:-translate-y-1">
              {/* the number stands left of the artwork and bites into it, its foot on the artwork's */}
              <span
                aria-hidden="true"
                className="pointer-events-none absolute bottom-[-6px] right-[calc(100%-24px)] z-10 select-none font-display text-[150px] leading-[0.75] text-transparent [-webkit-text-stroke:3px_rgb(var(--c-red-600))]"
                style={{ textShadow: "0 8px 30px rgba(0,0,0,0.6)" }}
              >
                {index + 1}
              </span>
              <span className="relative block overflow-hidden rounded-xl ring-1 ring-white/10">
                <Artwork src={track.image} className="rounded-xl" />
                <span className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                  <span className="rounded-full accent-bg p-3">
                    <Play className="h-5 w-5 fill-current" />
                  </span>
                </span>
              </span>
            </span>
            <span className="mt-2 block truncate text-sm font-semibold">{track.name}</span>
            <span className="block truncate text-xs text-gray-400">{track.artists.join(", ")}</span>
          </button>
        </div>
      ))}
    </Row>
  );
}
