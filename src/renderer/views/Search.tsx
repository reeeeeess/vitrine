import { Clock, Library, Search as SearchIcon, X } from "lucide-react";
import { useEffect, useState } from "react";
import { ErrorNote, Spinner } from "../components/Artwork";
import { MediaCard } from "../components/MediaCard";
import { run } from "../components/NowPlayingBar";
import { collectionMenu } from "../components/Pins";
import { Row } from "../components/Row";
import { TrackList } from "../components/TrackList";
import { cn } from "../lib/cn";
import * as api from "../lib/spotify";
import type { Collection, Track } from "../lib/types";
import { navigate } from "../lib/ui";
import { useAsync } from "../lib/useAsync";
import * as engine from "../player/engine";
import { openCollection, pinOf, playCollection } from "./Home";

const RECENT_KEY = "vitrine.recentSearches";
const RECENT_MAX = 10;

export function readRecentSearches(): string[] {
  try {
    const list: unknown = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
    return Array.isArray(list) ? list.filter((item): item is string => typeof item === "string").slice(0, RECENT_MAX) : [];
  } catch {
    return [];
  }
}

/** Remembers a search, newest first, without duplicates (a different case is the same search). */
export function rememberSearch(list: string[], query: string): string[] {
  const clean = query.trim();
  if (clean.length < 2) return list;
  return [clean, ...list.filter((item) => item.toLowerCase() !== clean.toLowerCase())].slice(0, RECENT_MAX);
}

function saveRecent(list: string[]): void {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(list));
  } catch {
    // for this run only
  }
}

const fold = (text: string) => text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Searching the person's own library, without asking Spotify: every word must be found somewhere. */
export function matchesQuery(fields: string[], query: string): boolean {
  const haystack = fold(fields.join(" "));
  return fold(query)
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => haystack.includes(word));
}

async function searchLibrary(query: string): Promise<{ tracks: Track[]; collections: Collection[] }> {
  // the readings the app already made are shared for a minute (lib/apiGate.ts): usually nothing is asked
  const [liked, playlists, albums] = await Promise.allSettled([api.likedTracks(200), api.myPlaylists(), api.savedAlbums()]);
  const tracks = (liked.status === "fulfilled" ? liked.value.tracks : []).filter((track) => matchesQuery([track.name, ...track.artists, track.albumName ?? ""], query));
  const collections = [...(playlists.status === "fulfilled" ? playlists.value : []), ...(albums.status === "fulfilled" ? albums.value : [])].filter((collection) =>
    matchesQuery([collection.name, collection.subtitle], query),
  );
  return { tracks: tracks.slice(0, 30), collections };
}

/** What was searched lately, when the search box is empty (Apple Music). */
function RecentSearches() {
  const [recent, setRecent] = useState(readRecentSearches);
  if (recent.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-40 text-center text-gray-400">
        <SearchIcon className="h-10 w-10" />
        <p className="mt-4 text-lg">Tapez dans la barre de recherche en haut.</p>
      </div>
    );
  }
  return (
    <section>
      <div className="flex items-center justify-between px-1">
        <h1 className="text-3xl font-bold tracking-tight">Recherches récentes</h1>
        <button
          className="text-sm text-gray-400 hover:text-white"
          onClick={() => {
            saveRecent([]);
            setRecent([]);
          }}
        >
          Tout effacer
        </button>
      </div>
      <div className="mt-4 divide-y divide-white/5">
        {recent.map((item) => (
          <div key={item} className="group flex items-center gap-3 rounded-xl px-2 py-2.5 hover:bg-white/5">
            <Clock className="h-4 w-4 text-gray-500" />
            <button className="min-w-0 flex-1 truncate text-left" onClick={() => navigate({ name: "search", query: item })}>
              {item}
            </button>
            <button
              className="text-gray-500 opacity-0 hover:text-white group-hover:opacity-100"
              onClick={() => {
                const next = recent.filter((entry) => entry !== item);
                saveRecent(next);
                setRecent(next);
              }}
              aria-label={`Oublier ${item}`}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}

type Scope = "spotify" | "library";

export function Search({ query }: { query?: string }) {
  const [scope, setScope] = useState<Scope>("spotify");
  const spotify = useAsync(async () => (query && scope === "spotify" ? api.search(query) : null), [query, scope]);
  const library = useAsync(async () => (query && scope === "library" ? searchLibrary(query) : null), [query, scope]);

  // a search kept once it found something, a moment after the last key
  useEffect(() => {
    if (!query) return;
    const timer = setTimeout(() => saveRecent(rememberSearch(readRecentSearches(), query)), 1500);
    return () => clearTimeout(timer);
  }, [query]);

  if (!query) return <RecentSearches />;
  const { data, error, loading } = scope === "spotify" ? spotify : library;

  return (
    <div className="animate-skeleton-fade">
      <div className="flex flex-wrap items-end justify-between gap-4 px-1">
        <h1 className="text-3xl font-bold tracking-tight">
          Résultats pour <span className="text-red-500">« {query} »</span>
        </h1>
        <div className="flex gap-1 rounded-2xl border border-white/10 bg-white/5 p-1">
          {(
            [
              ["spotify", "Tout Spotify", SearchIcon],
              ["library", "Dans ma bibliothèque", Library],
            ] as const
          ).map(([value, label, Icon]) => (
            <button
              key={value}
              onClick={() => setScope(value)}
              className={cn("flex items-center gap-2 rounded-xl px-4 py-1.5 text-sm font-medium transition-colors", scope === value ? "accent-bg" : "text-gray-400 hover:text-white")}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>
      </div>
      {loading && !data && <Spinner className="py-40" />}
      {error && <ErrorNote text={error} />}
      {scope === "spotify" && spotify.data && <SpotifyResults data={spotify.data} />}
      {scope === "library" && library.data && (
        <>
          {library.data.tracks.length === 0 && library.data.collections.length === 0 && <p className="mt-6 text-gray-400">Rien dans votre bibliothèque pour cette recherche.</p>}
          {library.data.tracks.length > 0 && (
            <TrackList tracks={library.data.tracks} onPlay={(_track, index) => run(() => engine.playTracks(library.data!.tracks.map((t) => t.uri), index))} />
          )}
          {library.data.collections.length > 0 && (
            <Row title="Vos playlists et albums">
              {library.data.collections.map((collection, index) => (
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
            </Row>
          )}
        </>
      )}
    </div>
  );
}

function SpotifyResults({ data }: { data: Awaited<ReturnType<typeof api.search>> }) {
  const empty = !data.tracks.length && !data.albums.length && !data.playlists.length && !data.artists.length;
  return (
    <>
      {empty && <p className="mt-6 text-gray-400">Aucun résultat.</p>}
      {data.tracks.length > 0 && <TrackList tracks={data.tracks} onPlay={(_track, index) => run(() => engine.playTracks(data.tracks.map((t) => t.uri), index))} />}
      {data.artists.length > 0 && (
        <Row title="Artistes">
          {data.artists.map((artist, index) => (
            <MediaCard
              key={artist.id}
              index={index}
              round
              title={artist.name}
              subtitle="Artiste"
              image={artist.card ?? artist.image}
              onOpen={() => navigate({ name: "artist", id: artist.id })}
              onPlay={() => run(() => engine.playContext(artist.uri))}
              onContextMenu={(event) => collectionMenu(event, { uri: artist.uri, name: artist.name, image: artist.card ?? artist.image, kind: "artist" })}
            />
          ))}
        </Row>
      )}
      {data.albums.length > 0 && (
        <Row title="Albums">
          {data.albums.map((album, index) => (
            <MediaCard key={album.id} index={index} title={album.name} subtitle={album.subtitle} image={album.card ?? album.image} onOpen={() => openCollection(album)} onPlay={() => playCollection(album)} onContextMenu={(event) => collectionMenu(event, pinOf(album))} />
          ))}
        </Row>
      )}
      {data.playlists.length > 0 && (
        <Row title="Playlists">
          {data.playlists.map((playlist, index) => (
            <MediaCard
              key={playlist.id}
              index={index}
              title={playlist.name}
              subtitle={playlist.subtitle}
              image={playlist.card ?? playlist.image}
              onOpen={() => openCollection(playlist)}
              onPlay={() => playCollection(playlist)}
              onContextMenu={(event) => collectionMenu(event, pinOf(playlist))}
            />
          ))}
        </Row>
      )}
    </>
  );
}
