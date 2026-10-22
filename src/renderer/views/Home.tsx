import { Hero, type HeroSlide } from "../components/Hero";
import { MediaCard } from "../components/MediaCard";
import { run } from "../components/NowPlayingBar";
import { Row } from "../components/Row";
import { ErrorNote, Spinner } from "../components/Artwork";
import { greeting } from "../lib/format";
import * as api from "../lib/spotify";
import type { Collection } from "../lib/types";
import { navigate } from "../lib/ui";
import { useAsync } from "../lib/useAsync";
import * as engine from "../player/engine";

const settled = <T,>(result: PromiseSettledResult<T>, fallback: T): T => (result.status === "fulfilled" ? result.value : fallback);

async function loadHome() {
  const [recent, playlists, albums, artists] = await Promise.allSettled([
    api.recentlyPlayed(),
    api.myPlaylists(),
    api.savedAlbums(),
    api.topArtists("short_term", 20),
  ]);
  if ([recent, playlists, albums, artists].every((result) => result.status === "rejected")) {
    throw (recent as PromiseRejectedResult).reason;
  }
  return {
    recent: settled(recent, { tracks: [], contexts: [] }),
    playlists: settled(playlists, []),
    albums: settled(albums, []),
    artists: settled(artists, []),
  };
}

export function openCollection(collection: Collection): void {
  navigate(collection.kind === "album" ? { name: "album", id: collection.id } : { name: "playlist", id: collection.id });
}

export function playCollection(collection: Collection): void {
  run(() => engine.playContext(collection.uri));
}

/** What the person was listening to lately, then their playlists, for the banner. */
function heroSlides(contexts: string[], collections: Collection[]): HeroSlide[] {
  const byUri = new Map(collections.map((collection) => [collection.uri, collection]));
  const picked = [...contexts.map((uri) => byUri.get(uri)).filter((c): c is Collection => Boolean(c)), ...collections];
  const unique = [...new Map(picked.map((collection) => [collection.uri, collection])).values()].filter((c) => c.image).slice(0, 5);
  const recent = new Set(contexts);
  return unique.map((collection) => ({
    key: collection.uri,
    kicker: recent.has(collection.uri) ? "Reprendre l'écoute" : collection.kind === "album" ? "Album" : "Playlist",
    tags: [collection.kind === "album" ? "Album" : "Playlist", ...(collection.total ? [`${collection.total} titres`] : [])],
    title: collection.name,
    subtitle: collection.description || collection.subtitle,
    image: collection.image,
    onPlay: () => playCollection(collection),
    onOpen: () => openCollection(collection),
  }));
}

export function Home({ name }: { name?: string }) {
  const { data, error, loading } = useAsync(loadHome, []);

  if (loading && !data) return <Spinner className="py-40" />;
  if (error) return <ErrorNote text={error} />;
  if (!data) return null;

  const slides = heroSlides(data.recent.contexts, [...data.playlists, ...data.albums]);
  const recentTracks = data.recent.tracks.slice(0, 20);

  return (
    <div className="animate-skeleton-fade">
      <Hero slides={slides} />
      <h1 className="mt-10 px-1 text-3xl font-bold tracking-tight">
        {greeting()}
        {name ? `, ${name.split(" ")[0]}` : ""}
      </h1>

      {recentTracks.length > 0 && (
        <Row title="Écoutés récemment">
          {recentTracks.map((track, index) => (
            <MediaCard
              key={track.id}
              index={index}
              title={track.name}
              subtitle={track.artists.join(", ")}
              image={track.image}
              onOpen={() => track.albumId && navigate({ name: "album", id: track.albumId })}
              onPlay={() => run(() => engine.playTracks(recentTracks.map((t) => t.uri), index))}
            />
          ))}
        </Row>
      )}

      {data.playlists.length > 0 && (
        <Row title="Vos playlists">
          {data.playlists.slice(0, 30).map((collection, index) => (
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
        </Row>
      )}

      {data.artists.length > 0 && (
        <Row title="Vos artistes du moment">
          {data.artists.map((artist, index) => (
            <MediaCard
              key={artist.id}
              index={index}
              round
              title={artist.name}
              subtitle="Artiste"
              image={artist.image}
              onPlay={() => run(() => engine.playContext(artist.uri))}
              onOpen={() => run(() => engine.playContext(artist.uri))}
            />
          ))}
        </Row>
      )}

      {data.albums.length > 0 && (
        <Row title="Vos albums">
          {data.albums.slice(0, 30).map((collection, index) => (
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
        </Row>
      )}
    </div>
  );
}
