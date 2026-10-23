import { Play, Sparkles } from "lucide-react";
import type { Moment, QuickPick } from "../lib/insights";
import { navigate } from "../lib/ui";
import { useAsync } from "../lib/useAsync";
import * as engine from "../player/engine";
import { Artwork } from "./Artwork";
import { run } from "./NowPlayingBar";
import { collectionMenu } from "./Pins";

const uriOf = (pick: QuickPick) => `spotify:${pick.kind}:${pick.id}`;

/**
 * Quick access (YouTube Music's speed dial): the albums and artists played most this month, from the
 * history on this computer; one click plays. Nothing asked of Spotify.
 */
export function QuickAccess() {
  const { data } = useAsync(() => window.vitrine.history?.insight("quickPicks") ?? Promise.resolve([] as QuickPick[]), []);
  if (!data || data.length < 4) return null;
  return (
    <section className="mt-6">
      <span className="kicker font-mono font-medium text-red-500">ACCÈS RAPIDE · LE PLUS ÉCOUTÉ CE MOIS-CI</span>
      <div className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-4">
        {data.map((pick) => (
          <div
            key={`${pick.kind}-${pick.id}`}
            className="group flex cursor-pointer items-center gap-3 overflow-hidden rounded-xl bg-white/[0.05] pr-3 transition-colors hover:bg-white/[0.1]"
            onClick={() => navigate(pick.kind === "album" ? { name: "album", id: pick.id } : { name: "artist", id: pick.id })}
            onContextMenu={(event) => collectionMenu(event, { uri: uriOf(pick), name: pick.name, image: pick.image, kind: pick.kind })}
          >
            <Artwork src={pick.image} round={pick.kind === "artist"} className="h-14 w-14 shrink-0 rounded-none" />
            <div className="min-w-0 flex-1">
              <p translate="no" className="truncate text-sm font-semibold">{pick.name}</p>
              <p className="truncate text-xs text-gray-400">{pick.detail}</p>
            </div>
            <button
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full accent-bg opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
              onClick={(event) => {
                event.stopPropagation();
                run(() => engine.playContext(uriOf(pick)));
              }}
              aria-label={`Lire ${pick.name}`}
            >
              <Play className="ml-0.5 h-4 w-4 fill-current" />
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}

/** "Ce moment" (Spotify's daylist, made here): what this person plays on this day around this hour. */
export function MomentCard() {
  const { data } = useAsync(() => window.vitrine.history?.insight("moment") ?? Promise.resolve(null as Moment | null), []);
  if (!data) return null;
  const covers = [...new Set(data.tracks.map((track) => track.image).filter(Boolean))].slice(0, 4) as string[];
  return (
    <section className="mt-6 flex items-center gap-5 overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-r from-red-600/25 via-fuchsia-600/10 to-transparent p-4">
      <div className="grid h-24 w-24 shrink-0 grid-cols-2 overflow-hidden rounded-2xl">
        {covers.map((cover) => (
          <img key={cover} src={cover} alt="" className="h-12 w-12 object-cover" />
        ))}
      </div>
      <div className="min-w-0 flex-1">
        <span className="kicker flex items-center gap-1.5 font-mono font-medium text-red-400">
          <Sparkles className="h-3.5 w-3.5" />
          CE MOMENT
        </span>
        <p className="mt-1 truncate font-display text-2xl tracking-tight">{data.title}</p>
        <p className="mt-0.5 text-sm text-gray-400">{data.tracks.length} titres que vous écoutez à cette heure-ci, d'après votre historique</p>
      </div>
      <button onClick={() => run(() => engine.playTracks(data.tracks.map((track) => track.uri)))} className="btn-primary shrink-0">
        <Play className="h-5 w-5 fill-current" />
        Lancer
      </button>
    </section>
  );
}
