import { motion } from "framer-motion";
import { ListMusic, X } from "lucide-react";
import { ErrorNote, Artwork, Spinner } from "./Artwork";
import * as api from "../lib/spotify";
import { useStore } from "../lib/store";
import { ui } from "../lib/ui";
import { useAsync } from "../lib/useAsync";
import { playback } from "../player/engine";
import type { Track } from "../lib/types";
import { trackMenu } from "./TrackMenu";

function Row({ track, current = false }: { track: Track; current?: boolean }) {
  return (
    <li className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-white/5" onContextMenu={(event) => trackMenu(event, track)}>
      <Artwork src={track.image} className="h-11 w-11 shrink-0 rounded-md" />
      <span className="min-w-0 flex-1">
        <span className={current ? "block truncate text-sm font-semibold text-red-400" : "block truncate text-sm font-medium"}>{track.name}</span>
        <span className="block truncate text-xs text-gray-400">{track.artists.join(", ")}</span>
      </span>
    </li>
  );
}

/** What plays now and next, from Spotify's queue. */
export function QueuePanel() {
  const uri = useStore(playback, (s) => s.track?.uri);
  const { data, error, loading } = useAsync(api.queue, [uri]);
  return (
    <motion.aside
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 40 }}
      transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
      className="fixed bottom-[112px] right-4 top-20 z-30 flex w-[360px] flex-col rounded-3xl border border-white/10 bg-panel/95 p-4 shadow-2xl shadow-black/60 backdrop-blur-xl"
      aria-label="File d'attente"
    >
      <header className="flex items-center justify-between px-2 pb-3">
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <ListMusic className="h-5 w-5 text-red-500" /> File d'attente
        </h2>
        <button onClick={() => ui.set({ queueOpen: false })} className="rounded-lg p-1.5 text-gray-400 hover:bg-white/10 hover:text-white" aria-label="Fermer">
          <X className="h-4 w-4" />
        </button>
      </header>
      <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto">
        {loading && !data && <Spinner />}
        {error && <ErrorNote text={error} />}
        {data && (
          <>
            {data.current && (
              <>
                <p className="kicker px-2 pb-1 font-semibold text-gray-500">En cours</p>
                <ul>
                  <Row track={data.current} current />
                </ul>
              </>
            )}
            <p className="kicker px-2 pb-1 pt-4 font-semibold text-gray-500">À suivre</p>
            {data.next.length === 0 ? (
              <p className="px-2 py-2 text-sm text-gray-400">Rien à suivre pour l'instant.</p>
            ) : (
              <ul>
                {data.next.map((track, index) => (
                  <Row key={`${track.id}-${index}`} track={track} />
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </motion.aside>
  );
}
