import { Bookmark, Disc3, LayoutGrid, List, Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Artwork, ErrorNote, Spinner } from "../components/Artwork";
import { LikedCover } from "../components/LikedCover";
import { MediaCard } from "../components/MediaCard";
import { collectionMenu, PinnedRow } from "../components/Pins";
import { Row } from "../components/Row";
import { cn } from "../lib/cn";
import * as api from "../lib/spotify";
import type { Collection } from "../lib/types";
import { navigate, ui } from "../lib/ui";
import { useAsync } from "../lib/useAsync";
import { usePageTitle } from "../lib/pageTitle";
import { openCollection, pinOf, playAllLiked, playCollection } from "./Home";

type Tab = "playlists" | "albums";
export type Sort = "spotify" | "name" | "creator" | "added";

const SORTS: { value: Sort; label: string; albumsOnly?: boolean }[] = [
  { value: "spotify", label: "Récents (Spotify)" },
  { value: "name", label: "Nom" },
  { value: "creator", label: "Créateur ou artiste" },
  { value: "added", label: "Date d'ajout", albumsOnly: true },
];

const collator = new Intl.Collator("fr", { sensitivity: "base", numeric: true });

/** The library in the order asked: Spotify's own (recently played or added first), by name, by creator, by date added. */
export function sortCollections(items: Collection[], sort: Sort): Collection[] {
  if (sort === "spotify") return items;
  const sorted = [...items];
  if (sort === "name") sorted.sort((a, b) => collator.compare(a.name, b.name));
  if (sort === "creator") sorted.sort((a, b) => collator.compare(a.subtitle, b.subtitle) || collator.compare(a.name, b.name));
  if (sort === "added") sorted.sort((a, b) => (b.addedAt ?? "").localeCompare(a.addedAt ?? ""));
  return sorted;
}

function readPref<T extends string>(key: string, fallback: T, allowed: readonly T[]): T {
  try {
    const value = localStorage.getItem(key) as T | null;
    return value && allowed.includes(value) ? value : fallback;
  } catch {
    return fallback;
  }
}

function writePref(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // for this run only
  }
}

export function Library() {
  const [tab, setTab] = useState<Tab>("playlists");
  const [sort, setSort] = useState<Sort>(() => readPref("vitrine.librarySort", "spotify", ["spotify", "name", "creator", "added"]));
  const [view, setView] = useState<"grid" | "list">(() => readPref("vitrine.libraryView", "grid", ["grid", "list"]));
  const title = useRef<HTMLHeadingElement>(null);
  usePageTitle(title, "Bibliothèque");
  // each tab on its own: Spotify may make one wait (Too many requests) and not the other
  const playlists = useAsync(() => api.myPlaylists(), []);
  const albums = useAsync(() => api.savedAlbums(), []);
  const current = tab === "playlists" ? playlists : albums;
  const { error, loading } = current;
  const usable = SORTS.filter((option) => !option.albumsOnly || tab === "albums");
  const activeSort = usable.some((option) => option.value === sort) ? sort : "spotify";
  const items = sortCollections(current.data ?? [], activeSort);
  // the albums added lately (Apple Music): Spotify dates the saved albums, not the playlists
  const recent = sortCollections(albums.data ?? [], "added").slice(0, 10);

  useEffect(() => writePref("vitrine.librarySort", sort), [sort]);
  useEffect(() => writePref("vitrine.libraryView", view), [view]);

  return (
    <div className="animate-skeleton-fade">
      <div className="flex items-end justify-between gap-4 px-1">
        <div className="flex items-center gap-4">
          <h1 ref={title} className="font-display text-4xl tracking-tight">
            Bibliothèque
          </h1>
          <button onClick={() => ui.set({ playlistDialog: { uris: [] } })} className="btn-ghost min-h-0 px-4 py-2 text-sm">
            <Plus className="h-4 w-4" />
            Nouvelle playlist
          </button>
          <button onClick={() => ui.set({ roulette: true })} className="btn-ghost min-h-0 px-4 py-2 text-sm" title="Pas d'idée ? Une roue choisit parmi vos playlists et albums">
            <Disc3 className="h-4 w-4" />
            Roulette
          </button>
          <button onClick={() => navigate({ name: "moments" })} className="btn-ghost min-h-0 px-4 py-2 text-sm" title="Vos instants de titres, avec une note">
            <Bookmark className="h-4 w-4" />
            Moments
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

      <div className="mt-8">
        <PinnedRow />
      </div>

      {recent.length > 0 && tab === "albums" && (
        <Row title="Ajoutés récemment" kicker="NOUVEAU">
          {recent.map((collection, index) => (
            <MediaCard
              key={collection.id}
              index={index}
              title={collection.name}
              subtitle={collection.addedAt ? `Ajouté le ${new Date(collection.addedAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}` : collection.subtitle}
              image={collection.card ?? collection.image}
              onOpen={() => openCollection(collection)}
              onPlay={() => playCollection(collection)}
              onContextMenu={(event) => collectionMenu(event, pinOf(collection))}
            />
          ))}
        </Row>
      )}

      <div className="mt-6 flex items-center justify-between gap-3 px-1">
        <label className="flex items-center gap-2 text-sm text-gray-400">
          Trier par
          <select value={activeSort} onChange={(event) => setSort(event.target.value as Sort)} className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-white">
            {usable.map((option) => (
              <option key={option.value} value={option.value} className="bg-neutral-900">
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <div className="flex gap-1 rounded-xl border border-white/10 bg-white/5 p-1">
          <button onClick={() => setView("grid")} className={cn("rounded-lg p-1.5", view === "grid" ? "bg-white/15 text-white" : "text-gray-400 hover:text-white")} aria-label="Grille" aria-pressed={view === "grid"}>
            <LayoutGrid className="h-4 w-4" />
          </button>
          <button onClick={() => setView("list")} className={cn("rounded-lg p-1.5", view === "list" ? "bg-white/15 text-white" : "text-gray-400 hover:text-white")} aria-label="Liste" aria-pressed={view === "list"}>
            <List className="h-4 w-4" />
          </button>
        </div>
      </div>

      {loading && !current.data && <Spinner className="py-40" />}
      {error && <ErrorNote text={error} />}
      {view === "grid" ? (
        <div className="mt-4 grid grid-cols-[repeat(auto-fill,minmax(168px,1fr))] gap-2">
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
              onContextMenu={(event) => collectionMenu(event, pinOf(collection))}
            />
          ))}
        </div>
      ) : (
        <div className="mt-4 divide-y divide-white/5">
          {items.map((collection) => (
            <button
              key={collection.id}
              onClick={() => openCollection(collection)}
              onContextMenu={(event) => collectionMenu(event, pinOf(collection))}
              className="flex w-full items-center gap-4 rounded-xl px-2 py-2 text-left transition-colors hover:bg-white/5"
            >
              <Artwork src={collection.thumb ?? collection.image} className="h-12 w-12 shrink-0 rounded-md" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{collection.name}</span>
                <span className="block truncate text-xs text-gray-400">{collection.subtitle}</span>
              </span>
              {collection.total !== undefined && <span className="shrink-0 text-xs text-gray-500">{collection.total} titres</span>}
            </button>
          ))}
        </div>
      )}
      {current.data && items.length === 0 && <p className="mt-6 text-gray-400">Rien ici pour l'instant.</p>}
    </div>
  );
}
