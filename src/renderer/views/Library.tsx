import { Disc3, Plus } from "lucide-react";
import { useState } from "react";
import { ErrorNote, Spinner } from "../components/Artwork";
import { MediaCard } from "../components/MediaCard";
import { cn } from "../lib/cn";
import * as api from "../lib/spotify";
import { navigate, ui } from "../lib/ui";
import { LikedCover } from "../components/LikedCover";
import { playAllLiked } from "./Home";
import { useAsync } from "../lib/useAsync";
import { openCollection, playCollection } from "./Home";

type Tab = "playlists" | "albums";

export function Library() {
  const [tab, setTab] = useState<Tab>("playlists");
  // each tab on its own: Spotify may make one wait (Too many requests) and not the other
  const playlists = useAsync(() => api.myPlaylists(), []);
  const albums = useAsync(() => api.savedAlbums(), []);
  const current = tab === "playlists" ? playlists : albums;
  const { error, loading } = current;

  const items = current.data ?? [];
  return (
    <div className="animate-skeleton-fade">
      <div className="flex items-end justify-between gap-4 px-1">
        <div className="flex items-center gap-4">
          <h1 className="font-display text-4xl tracking-tight">Bibliothèque</h1>
          <button onClick={() => ui.set({ playlistDialog: { uris: [] } })} className="btn-ghost min-h-0 px-4 py-2 text-sm">
            <Plus className="h-4 w-4" />
            Nouvelle playlist
          </button>
          <button onClick={() => ui.set({ roulette: true })} className="btn-ghost min-h-0 px-4 py-2 text-sm" title="Pas d'idée ? Une roue choisit parmi vos playlists et albums">
            <Disc3 className="h-4 w-4" />
            Roulette
          </button>
        </div>
        <div className="flex gap-1 rounded-2xl border border-white/10 bg-white/5 p-1">
          {(["playlists", "albums"] as Tab[]).map((value) => (
            <button
              key={value}
              onClick={() => setTab(value)}
              className={cn("rounded-xl px-4 py-1.5 text-sm font-medium transition-colors", tab === value ? "accent-bg" : "text-gray-400 hover:text-white")}
            >
              {value === "playlists" ? `Playlists${playlists.data ? ` · ${playlists.data.length}` : ""}` : `Albums${albums.data ? ` · ${albums.data.length}` : ""}`}
            </button>
          ))}
        </div>
      </div>
      {loading && !current.data && <Spinner className="py-40" />}
      {error && <ErrorNote text={error} />}
      <div className="mt-8 grid grid-cols-[repeat(auto-fill,minmax(168px,1fr))] gap-2">
        {tab === "playlists" && (playlists.data || error) && (
          <MediaCard title="Titres likés" subtitle="Playlist" cover={<LikedCover />} onOpen={() => navigate({ name: "liked" })} onPlay={() => playAllLiked()} />
        )}
        {items.map((collection, index) => (
          <MediaCard
            key={collection.id}
            index={index}
            title={collection.name}
            subtitle={collection.subtitle}
            image={collection.card ?? collection.image}
            onOpen={() => openCollection(collection)}
            onPlay={() => playCollection(collection)}
          />
        ))}
      </div>
      {current.data && items.length === 0 && <p className="mt-6 text-gray-400">Rien ici pour l'instant.</p>}
    </div>
  );
}
