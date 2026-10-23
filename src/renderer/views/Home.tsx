import { Disc3 } from "lucide-react";
import { Hero, type HeroSlide } from "../components/Hero";
import { MediaCard } from "../components/MediaCard";
import { run } from "../components/NowPlayingBar";
import { Row } from "../components/Row";
import { Top10 } from "../components/Top10";
import { LikedCover } from "../components/LikedCover";
import { ErrorNote, Spinner } from "../components/Artwork";
import { greeting } from "../lib/format";
import * as api from "../lib/spotify";
import type { Collection } from "../lib/types";
import { navigate, ui } from "../lib/ui";
import { useAsync } from "../lib/useAsync";
import * as engine from "../player/engine";

const settled = <T,>(result: PromiseSettledResult<T>, fallback: T): T => (result.status === "fulfilled" ? result.value : fallback);

async function loadHome() {
  const [recent, playlists, albums, artists, top] = await Promise.allSettled([
    api.recentlyPlayed(),
    api.myPlaylists(),
    api.savedAlbums(),
    api.topArtists("short_term", 20),
    api.topTracks("short_term", 10),
  ]);
  if ([recent, playlists, albums, artists].every((result) => result.status === "rejected")) {
    throw (recent as PromiseRejectedResult).reason;
  }
  return {
    recent: settled(recent, { tracks: [], contexts: [] }),
    playlists: settled(playlists, []),
    albums: settled(albums, []),
    artists: settled(artists, []),
    top: settled(top, []),
  };
}

export function openCollection(collection: Collection): void {
  navigate(collection.kind === "album" ? { name: "album", id: collection.id } : { name: "playlist", id: collection.id });
}

export function playCollection(collection: Collection): void {
  run(() => engine.playContext(collection.uri));
}

/** Plays Liked Songs from the start, without opening them. */
export function playAllLiked(): void {
  run(async () => {
    const [{ tracks }, profile] = await Promise.all([api.likedTracks(100), api.me()]);
    await engine.playLiked(profile.id, tracks.map((track) => track.uri));
  });
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
    thumb: collection.thumb,
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
      <div className="mt-10 flex flex-wrap items-center justify-between gap-4 px-1">
        <h1 className="text-3xl font-bold tracking-tight">
          {greeting()}
          {name ? `, ${name.split(" ")[0]}` : ""}
        </h1>
        <button onClick={() => ui.set({ roulette: true })} className="btn-ghost min-h-0 px-4 py-2 text-sm" title="Pas d'idée ? Une roue choisit parmi vos playlists et albums">
          <Disc3 className="h-4 w-4" />
          Roulette
        </button>
      </div>

      {recentTracks.length > 0 && (
        <Row title="Écoutés récemment" number={1} kicker="ÉCOUTE">
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

      <Top10 tracks={data.top} number={2} />

      {data.playlists.length > 0 && (
        <Row title="Vos playlists" number={3} kicker="BIBLIOTHÈQUE">
          <MediaCard title="Titres likés" subtitle="Playlist" cover={<LikedCover />} onOpen={() => navigate({ name: "liked" })} onPlay={() => playAllLiked()} />
          {data.playlists.slice(0, 30).map((collection, index) => (
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
        </Row>
      )}

      {data.artists.length > 0 && (
        <Row title="Vos artistes du moment" number={4} kicker="ARTISTES">
          {data.artists.map((artist, index) => (
            <MediaCard
              key={artist.id}
              index={index}
              round
              title={artist.name}
              subtitle="Artiste"
              image={artist.card ?? artist.image}
              onPlay={() => run(() => engine.playContext(artist.uri))}
              onOpen={() => navigate({ name: "artist", id: artist.id })}
            />
          ))}
        </Row>
      )}

      {data.albums.length > 0 && (
        <Row title="Vos albums" number={5} kicker="ALBUMS">
          {data.albums.slice(0, 30).map((collection, index) => (
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
        </Row>
      )}
    </div>
  );
}
