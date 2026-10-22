import { Search as SearchIcon } from "lucide-react";
import { ErrorNote, Spinner } from "../components/Artwork";
import { MediaCard } from "../components/MediaCard";
import { run } from "../components/NowPlayingBar";
import { Row } from "../components/Row";
import { TrackList } from "../components/TrackList";
import * as api from "../lib/spotify";
import { useAsync } from "../lib/useAsync";
import * as engine from "../player/engine";
import { openCollection, playCollection } from "./Home";

export function Search({ query }: { query?: string }) {
  const { data, error, loading } = useAsync(async () => (query ? api.search(query) : null), [query]);

  if (!query) {
    return (
      <div className="flex flex-col items-center justify-center py-40 text-center text-gray-400">
        <SearchIcon className="h-10 w-10" />
        <p className="mt-4 text-lg">Tapez dans la barre de recherche en haut.</p>
      </div>
    );
  }
  if (loading && !data) return <Spinner className="py-40" />;
  if (error) return <ErrorNote text={error} />;
  if (!data) return null;
  const empty = !data.tracks.length && !data.albums.length && !data.playlists.length && !data.artists.length;

  return (
    <div className="animate-skeleton-fade">
      <h1 className="px-1 text-3xl font-bold tracking-tight">
        Résultats pour <span className="text-red-500">« {query} »</span>
      </h1>
      {empty && <p className="mt-6 text-gray-400">Aucun résultat.</p>}
      {data.tracks.length > 0 && (
        <TrackList tracks={data.tracks} onPlay={(_track, index) => run(() => engine.playTracks(data.tracks.map((t) => t.uri), index))} />
      )}
      {data.artists.length > 0 && (
        <Row title="Artistes">
          {data.artists.map((artist, index) => (
            <MediaCard key={artist.id} index={index} round title={artist.name} subtitle="Artiste" image={artist.image} onOpen={() => run(() => engine.playContext(artist.uri))} onPlay={() => run(() => engine.playContext(artist.uri))} />
          ))}
        </Row>
      )}
      {data.albums.length > 0 && (
        <Row title="Albums">
          {data.albums.map((album, index) => (
            <MediaCard key={album.id} index={index} title={album.name} subtitle={album.subtitle} image={album.image} onOpen={() => openCollection(album)} onPlay={() => playCollection(album)} />
          ))}
        </Row>
      )}
      {data.playlists.length > 0 && (
        <Row title="Playlists">
          {data.playlists.map((playlist, index) => (
            <MediaCard key={playlist.id} index={index} title={playlist.name} subtitle={playlist.subtitle} image={playlist.image} onOpen={() => openCollection(playlist)} onPlay={() => playCollection(playlist)} />
          ))}
        </Row>
      )}
    </div>
  );
}
