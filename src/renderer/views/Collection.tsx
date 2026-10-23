import { ArrowLeft, Dices, Play, Shuffle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Artwork, ErrorNote, Spinner } from "../components/Artwork";
import { MediaCard } from "../components/MediaCard";
import { run } from "../components/NowPlayingBar";
import { collectionMenu, PinButton } from "../components/Pins";
import { Row } from "../components/Row";
import { TrackList } from "../components/TrackList";
import { formatTotal } from "../lib/format";
import { artworkColor, rgbVar } from "../lib/palette";
import * as api from "../lib/spotify";
import { goBack } from "../lib/ui";
import { usePageTitle } from "../lib/pageTitle";
import { useAsync } from "../lib/useAsync";
import * as engine from "../player/engine";
import { openCollection, pinOf, playCollection } from "./Home";

/** "12 mars 2024", or just the year or the month when Spotify knows no more. */
export function releaseLabel(date: string | undefined): string {
  if (!date) return "";
  const [year, month, day] = date.split("-").map(Number);
  if (day) return new Date(year, month - 1, day).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
  if (month) return new Date(year, month - 1, 1).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  return String(year);
}

export function CollectionView({ kind, id }: { kind: "playlist" | "album"; id: string }) {
  const { data, error, loading } = useAsync(() => (kind === "album" ? api.album(id) : api.playlist(id)), [kind, id]);
  const [color, setColor] = useState("220 38 38");
  const [removed, setRemoved] = useState<string[]>([]);
  const title = useRef<HTMLHeadingElement>(null);
  usePageTitle(title, data?.collection.name);
  const artistId = kind === "album" ? data?.collection.artistId : undefined;
  // "more by this artist" (Apple Music): one request, only for albums
  const more = useAsync(() => (artistId ? api.artistReleases(artistId) : Promise.resolve([])), [artistId]);

  useEffect(() => {
    if (data?.collection.image) void artworkColor(data.collection.image).then((rgb) => setColor(rgbVar(rgb)));
  }, [data?.collection.image]);

  if (loading && !data) return <Spinner className="py-40" />;
  if (error) return <ErrorNote text={error} />;
  if (!data) return null;
  const { collection } = data;
  const tracks = removed.length ? data.tracks.filter((track) => !removed.includes(track.uri)) : data.tracks;
  const total = tracks.reduce((sum, track) => sum + track.durationMs, 0);

  return (
    <div className="animate-skeleton-fade">
      <section
        className="relative -mx-8 -mt-24 overflow-hidden px-8 pb-8 pt-28"
        style={{ background: `linear-gradient(to bottom, rgb(${color} / 0.55), rgb(${color} / 0.12) 70%, transparent)` }}
      >
        <button onClick={goBack} className="mb-6 flex items-center gap-2 text-sm text-white/70 hover:text-white">
          <ArrowLeft className="h-4 w-4" />
          Retour
        </button>
        <div className="flex items-end gap-8">
          <Artwork src={collection.image} className="h-56 w-56 shrink-0 rounded-2xl shadow-2xl shadow-black/50 ring-1 ring-white/10" />
          <div className="min-w-0 pb-1">
            <span className="kicker inline-flex rounded-full border border-white/20 bg-white/15 px-3 py-1 font-medium text-white/90">
              {kind === "album" ? "Album" : "Playlist"}
            </span>
            <h1 ref={title} className="mt-4 line-clamp-2 font-display text-5xl leading-[1.05] tracking-tight">
              {collection.name}
            </h1>
            {collection.description && <p className="mt-3 line-clamp-2 max-w-3xl text-sm text-white/70">{collection.description}</p>}
            <p className="mt-3 text-sm text-white/70">
              {collection.subtitle} · {tracks.length} titres · {formatTotal(total)}
            </p>
          </div>
        </div>
        <div className="mt-8 flex items-center gap-3">
          <button
            onClick={() => run(() => engine.playContext(collection.uri))}
            className="btn-primary"
          >
            <Play className="h-5 w-5 fill-current" />
            Lecture
          </button>
          <button
            onClick={() =>
              run(async () => {
                await engine.playContext(collection.uri);
                if (!engine.playback.get().shuffle) await engine.toggleShuffle();
              })
            }
            className="btn-ghost"
          >
            <Shuffle className="h-5 w-5" />
            Aléatoire
          </button>
          <button
            onClick={() => run(() => engine.playShuffled(tracks.map((track) => track.uri)))}
            className="btn-ghost"
            title="Un vrai tirage au sort sur toute la liste, à la place de l'aléatoire de Spotify qui revient souvent aux mêmes titres"
          >
            <Dices className="h-5 w-5" />
            Mélange parfait
          </button>
          <PinButton pin={pinOf(collection)} />
        </div>
      </section>
      <TrackList
        tracks={tracks}
        showAlbum={kind === "playlist"}
        showArt={kind === "playlist"}
        onPlay={(track) => run(() => engine.playContext(collection.uri, track.uri))}
        menuContext={
          kind === "playlist"
            ? { playlist: { id: collection.id, ownerId: collection.ownerId, collaborative: collection.collaborative }, onRemoved: (uri) => setRemoved((list) => [...list, uri]) }
            : undefined
        }
      />
      {kind === "album" && (
        // the album's credits at the foot of the page, as on Apple Music
        <footer className="mt-6 space-y-1 px-1 text-sm text-gray-400">
          {collection.releaseDate && <p className="text-white/80">Sortie le {releaseLabel(collection.releaseDate)}</p>}
          <p>
            {tracks.length} titre{tracks.length > 1 ? "s" : ""}, {formatTotal(total)}
          </p>
          {collection.copyrights?.map((line) => (
            <p key={line} className="text-xs text-gray-500">
              {line}
            </p>
          ))}
          {collection.label && !collection.copyrights?.some((line) => line.includes(collection.label!)) && <p className="text-xs text-gray-500">{collection.label}</p>}
        </footer>
      )}
      {(more.data ?? []).filter((release) => release.id !== collection.id).length > 0 && (
        <Row title={`Plus de ${collection.subtitle.split(" · ")[0]}`} kicker="DISCOGRAPHIE">
          {(more.data ?? [])
            .filter((release) => release.id !== collection.id)
            .map((release, index) => (
              <MediaCard
                key={release.id}
                index={index}
                title={release.name}
                subtitle={release.releaseDate?.slice(0, 4)}
                image={release.card ?? release.image}
                onOpen={() => openCollection(release)}
                onPlay={() => playCollection(release)}
                onContextMenu={(event) => collectionMenu(event, pinOf(release))}
              />
            ))}
        </Row>
      )}
    </div>
  );
}
