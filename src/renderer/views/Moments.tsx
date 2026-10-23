import { Bookmark, Play, Trash2 } from "lucide-react";
import { useRef } from "react";
import { Artwork } from "../components/Artwork";
import { run } from "../components/NowPlayingBar";
import { formatTime } from "../lib/format";
import { moments, removeMoment, updateMoment } from "../lib/moments";
import { usePageTitle } from "../lib/pageTitle";
import { useStore } from "../lib/store";
import * as engine from "../player/engine";

/** The Moments: instants of tracks with a note, played back from there. */
export function MomentsView() {
  const list = useStore(moments, (s) => s.list);
  const title = useRef<HTMLHeadingElement>(null);
  usePageTitle(title, "Moments");
  return (
    <div className="animate-skeleton-fade">
      <span className="kicker flex items-center gap-1.5 px-1 font-mono font-medium text-red-500">
        <Bookmark className="h-3.5 w-3.5" />
        VOS MOMENTS
      </span>
      <h1 ref={title} className="mt-1 px-1 font-display text-4xl tracking-tight">
        Moments
      </h1>
      <p className="mt-2 px-1 text-sm text-gray-400">Un instant d'un titre et une note (« le drop à 1:42 »). Ctrl+M ou le marque-page du lecteur en ajoute un ; la note revient à l'écran quand le titre repasse par là.</p>
      {list.length === 0 && <p className="mt-10 px-1 text-gray-400">Aucun moment pour l'instant.</p>}
      <div className="mt-6 divide-y divide-white/5">
        {list.map((mark) => (
          <div key={mark.id} className="group flex items-center gap-4 rounded-xl px-2 py-3 hover:bg-white/[0.03]">
            <button onClick={() => run(() => engine.playTracks([mark.uri], 0, mark.atMs))} className="relative h-14 w-14 shrink-0" aria-label={`Lire ${mark.name} à ${formatTime(mark.atMs)}`}>
              <Artwork src={mark.image} className="rounded-lg" />
              <span className="absolute inset-0 hidden items-center justify-center rounded-lg bg-black/50 group-hover:flex">
                <Play className="h-5 w-5 fill-current" />
              </span>
            </button>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">
                {mark.name} <span className="font-normal text-gray-400">· {mark.artists.join(", ")}</span>
              </p>
              <input
                defaultValue={mark.note}
                onBlur={(event) => event.target.value !== mark.note && void updateMoment(mark.id, event.target.value)}
                onKeyDown={(event) => event.key === "Enter" && event.currentTarget.blur()}
                placeholder="Ajouter une note…"
                className="mt-1 w-full rounded-lg border border-transparent bg-transparent px-2 py-1 text-sm text-white/85 placeholder-gray-500 focus:border-white/15 focus:bg-white/5 focus:outline-none"
              />
            </div>
            <span className="rounded-full bg-red-500/15 px-3 py-1 font-mono text-xs text-red-300">{formatTime(mark.atMs)}</span>
            <button onClick={() => void removeMoment(mark.id)} className="rounded-full p-2 text-gray-500 opacity-0 hover:text-red-400 group-hover:opacity-100" aria-label="Supprimer ce moment">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
