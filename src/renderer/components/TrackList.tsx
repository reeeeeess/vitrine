import { Clock3, ListPlus, Play, Plus } from "lucide-react";
import { useEffect, useRef } from "react";
import { cn } from "../lib/cn";
import { formatTime } from "../lib/format";
import { lastPlayedLabel, type TrackStat } from "../lib/insights";
import { useStore } from "../lib/store";
import type { Track } from "../lib/types";
import { errorMessage } from "../lib/format";
import { navigate, notify, ui } from "../lib/ui";
import { addToQueue, playback } from "../player/engine";
import { Artwork } from "./Artwork";
import { ArtistLinks } from "./NowPlayingBar";
import { trackMenu, type MenuContext } from "./TrackMenu";

interface TrackListProps {
  tracks: Track[];
  onPlay: (track: Track, index: number) => void;
  showAlbum?: boolean;
  showArt?: boolean;
  /** what a right click on a track may also do here (take it out of this playlist) */
  menuContext?: MenuContext;
  /** plays and last play of each track (local history): two more columns, as in iTunes */
  stats?: Record<string, TrackStat>;
}

function Equalizer() {
  return (
    <span className="flex h-4 items-end gap-[2px]" aria-label="En cours de lecture">
      {[0, 1, 2].map((bar) => (
        <span
          key={bar}
          className="w-[3px] animate-pulse rounded-sm bg-red-500"
          style={{ height: `${[60, 100, 40][bar]}%`, animationDelay: `${bar * 150}ms`, animationDuration: "800ms" }}
        />
      ))}
    </span>
  );
}

export function TrackList({ tracks, onPlay, showAlbum = true, showArt = true, menuContext, stats }: TrackListProps) {
  const currentUri = useStore(playback, (s) => s.track?.uri);
  const paused = useStore(playback, (s) => s.paused);
  const reveal = useStore(ui, (s) => s.reveal);
  const list = useRef<HTMLDivElement>(null);

  // Ctrl+L: the track playing, brought into view once its list shows
  useEffect(() => {
    if (!reveal) return;
    const row = list.current?.querySelector<HTMLElement>(`[data-uri="${CSS.escape(reveal)}"]`);
    if (!row) return;
    row.scrollIntoView({ block: "center", behavior: "smooth" });
    row.focus({ preventScroll: true });
    ui.set({ reveal: null });
  }, [reveal, tracks]);
  const columns = stats
    ? showAlbum
      ? "grid-cols-[2.5rem_minmax(0,4fr)_minmax(0,3fr)_5rem_7rem_7rem]"
      : "grid-cols-[2.5rem_minmax(0,1fr)_5rem_7rem_7rem]"
    : showAlbum
      ? "grid-cols-[2.5rem_minmax(0,4fr)_minmax(0,3fr)_7rem]"
      : "grid-cols-[2.5rem_minmax(0,1fr)_7rem]";

  return (
    <div ref={list} className="mt-6" role="list" aria-label="Titres">
      {/* the columns' names, for the eye: each row reads in full on its own */}
      <div className={cn("kicker grid items-center gap-4 border-b border-white/10 px-4 pb-2 text-gray-500", columns)} aria-hidden="true">
        <span className="text-right">#</span>
        <span>Titre</span>
        {showAlbum && <span>Album</span>}
        {stats && <span className="text-right">Lectures</span>}
        {stats && <span>Dernière écoute</span>}
        <Clock3 className="ml-auto h-4 w-4" aria-label="Durée" />
      </div>
      <div className="mt-2">
        {tracks.map((track, index) => {
          const current = track.uri === currentUri;
          return (
            <div
              key={`${track.id}-${index}`}
              data-uri={track.uri}
              role="listitem"
              tabIndex={0}
              onDoubleClick={() => onPlay(track, index)}
              onContextMenu={(event) => trackMenu(event, track, menuContext)}
              onKeyDown={(event) => event.key === "Enter" && onPlay(track, index)}
              className={cn(
                "group grid items-center gap-4 rounded-xl px-4 py-2 outline-none transition-colors hover:bg-white/5 focus-visible:bg-white/10",
                columns,
                current && "bg-white/[0.06]",
              )}
            >
              <span className="flex justify-end text-sm tabular-nums text-gray-400">
                <span className="group-hover:hidden">{current && !paused ? <Equalizer /> : index + 1}</span>
                <button className="hidden text-white group-hover:block" onClick={() => onPlay(track, index)} aria-label={`Lire ${track.name}`}>
                  <Play className="h-4 w-4 fill-current" />
                </button>
              </span>
              <span className="flex min-w-0 items-center gap-3">
                {showArt && <Artwork src={track.thumb ?? track.image} className="h-10 w-10 shrink-0 rounded-md" />}
                <span className="min-w-0">
                  <span translate="no" className={cn("block truncate text-sm font-medium", current ? "text-red-400" : "text-white")}>{track.name}</span>
                  <span className="flex min-w-0 items-center gap-1.5 text-xs text-gray-400">
                    {track.explicit && <span className="rounded-sm bg-white/20 px-1 text-[10px] font-bold leading-4 text-white/80">E</span>}
                    <ArtistLinks track={track} className="min-w-0" />
                  </span>
                </span>
              </span>
              {showAlbum && (
                <button
                  className="truncate text-left text-sm text-gray-400 hover:text-white hover:underline disabled:hover:no-underline"
                  disabled={!track.albumId}
                  onClick={() => track.albumId && navigate({ name: "album", id: track.albumId })}
                >
                  {track.albumName}
                </button>
              )}
              {stats && <span className="text-right text-sm tabular-nums text-gray-400">{stats[track.uri]?.plays ?? 0}</span>}
              {stats && <span className="truncate text-sm text-gray-400">{lastPlayedLabel(stats[track.uri]?.last)}</span>}
              <span className="flex items-center justify-end gap-2 text-sm tabular-nums text-gray-400">
                <button
                  className="hidden text-gray-400 hover:text-white group-hover:block"
                  onClick={() => ui.set({ playlistDialog: { uris: [track.uri] } })}
                  aria-label={`Ajouter ${track.name} à une playlist`}
                  title="Ajouter à une playlist"
                >
                  <Plus className="h-4 w-4" />
                </button>
                <button
                  className="hidden text-gray-400 hover:text-white group-hover:block"
                  onClick={() =>
                    addToQueue(track.uri).then(
                      () => notify(`« ${track.name} » ajouté à la file`),
                      (error: unknown) => notify(errorMessage(error), "error"),
                    )
                  }
                  aria-label={`Ajouter ${track.name} à la file`}
                  title="Ajouter à la file d'attente"
                >
                  <ListPlus className="h-4 w-4" />
                </button>
                {formatTime(track.durationMs)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
