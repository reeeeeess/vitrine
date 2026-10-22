import { useState } from "react";
import { ErrorNote, Spinner } from "../components/Artwork";
import { MediaCard } from "../components/MediaCard";
import { cn } from "../lib/cn";
import * as api from "../lib/spotify";
import { useAsync } from "../lib/useAsync";
import { openCollection, playCollection } from "./Home";

type Tab = "playlists" | "albums";

export function Library() {
  const [tab, setTab] = useState<Tab>("playlists");
  const { data, error, loading } = useAsync(async () => {
    const [playlists, albums] = await Promise.all([api.myPlaylists(), api.savedAlbums()]);
    return { playlists, albums };
  }, []);

  const items = data ? data[tab] : [];
  return (
    <div className="animate-skeleton-fade">
      <div className="flex items-end justify-between gap-4 px-1">
        <h1 className="font-display text-4xl tracking-tight">Bibliothèque</h1>
        <div className="flex gap-1 rounded-2xl border border-white/10 bg-white/5 p-1">
          {(["playlists", "albums"] as Tab[]).map((value) => (
            <button
              key={value}
              onClick={() => setTab(value)}
              className={cn("rounded-xl px-4 py-1.5 text-sm font-medium transition-colors", tab === value ? "accent-bg" : "text-gray-400 hover:text-white")}
            >
              {value === "playlists" ? `Playlists${data ? ` · ${data.playlists.length}` : ""}` : `Albums${data ? ` · ${data.albums.length}` : ""}`}
            </button>
          ))}
        </div>
      </div>
      {loading && !data && <Spinner className="py-40" />}
      {error && <ErrorNote text={error} />}
      <div className="mt-8 grid grid-cols-[repeat(auto-fill,minmax(168px,1fr))] gap-2">
        {items.map((collection, index) => (
          <MediaCard
            key={collection.id}
            index={index}
            title={collection.name}
            subtitle={collection.subtitle}
            image={collection.image}
            onOpen={() => openCollection(collection)}
            onPlay={() => playCollection(collection)}
          />
        ))}
      </div>
      {data && items.length === 0 && <p className="mt-6 text-gray-400">Rien ici pour l'instant.</p>}
    </div>
  );
}
