import { ArrowLeft, Play, Shuffle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Artwork, ErrorNote, Spinner } from "../components/Artwork";
import { MediaCard } from "../components/MediaCard";
import { run } from "../components/NowPlayingBar";
import { collectionMenu, PinButton } from "../components/Pins";
import { Row } from "../components/Row";
import { TrackList } from "../components/TrackList";
import { usePageTitle } from "../lib/pageTitle";
import { artworkColor, rgbVar } from "../lib/palette";
import * as api from "../lib/spotify";
import type { Collection } from "../lib/types";
import { goBack } from "../lib/ui";
import { useAsync } from "../lib/useAsync";
import * as engine from "../player/engine";
import { releaseLabel } from "./Collection";
import { openCollection, pinOf, playCollection } from "./Home";

const followers = new Intl.NumberFormat("fr-FR");

/** The newest of the artist's albums and singles (iOS 27's "latest release" banner). */
export function latestRelease(releases: Collection[]): Collection | undefined {
  return [...releases].filter((release) => release.group !== "appears_on").sort((a, b) => (b.releaseDate ?? "").localeCompare(a.releaseDate ?? ""))[0];
}

function ReleaseRow({ title, kicker, releases }: { title: string; kicker: string; releases: Collection[] }) {
  if (releases.length === 0) return null;
  return (
    <Row title={title} kicker={kicker}>
      {releases.map((release, index) => (
        <MediaCard
          key={release.id}
          index={index}
          title={release.name}
          subtitle={release.releaseDate?.slice(0, 4) ?? release.subtitle}
          image={release.card ?? release.image}
          onOpen={() => openCollection(release)}
          onPlay={() => playCollection(release)}
          onContextMenu={(event) => collectionMenu(event, pinOf(release))}
        />
      ))}
    </Row>
  );
}

export function ArtistView({ id }: { id: string }) {
  const { data, error, loading } = useAsync(() => api.artist(id), [id]);
  const [color, setColor] = useState("220 38 38");
  const [showAppears, setShowAppears] = useState(false);
  // where the artist appears (featurings, compilations): one more request, only when asked
  const appears = useAsync(() => (showAppears ? api.artistReleases(id, "appears_on") : Promise.resolve([])), [id, showAppears]);
  const title = useRef<HTMLHeadingElement>(null);
  usePageTitle(title, data?.artist.name);

  useEffect(() => {
    if (data?.artist.image) void artworkColor(data.artist.image).then((rgb) => setColor(rgbVar(rgb)));
  }, [data?.artist.image]);
  useEffect(() => setShowAppears(false), [id]);

  if (loading && !data) return <Spinner className="py-40" />;
  if (error) return <ErrorNote text={error} />;
  if (!data) return null;
  const { artist, topTracks, releases } = data;
  const latest = latestRelease(releases);
  const albums = releases.filter((release) => release.group === "album" || (!release.group && release.total !== undefined && release.total > 4));
  const singles = releases.filter((release) => release.group === "single" || (!release.group && !albums.includes(release)));

  return (
    <div className="animate-skeleton-fade">
      <section
        className="relative -mx-8 -mt-24 overflow-hidden px-8 pb-8 pt-28"
        style={{ background: `linear-gradient(to bottom, rgb(${color} / 0.6), rgb(${color} / 0.12) 70%, transparent)` }}
      >
        <button onClick={goBack} className="mb-6 flex items-center gap-2 text-sm text-white/70 hover:text-white">
          <ArrowLeft className="h-4 w-4" />
          Retour
        </button>
        <div className="flex items-end gap-8">
          <Artwork src={artist.image} round className="h-56 w-56 shrink-0 shadow-2xl shadow-black/50 ring-1 ring-white/10" />
          <div className="min-w-0 pb-2">
            <span className="kicker inline-flex rounded-full border border-white/20 bg-white/15 px-3 py-1 font-medium text-white/90">Artiste</span>
            {/* the name staged big, as on iOS 27's artist pages */}
            <h1 ref={title} className="mt-3 line-clamp-2 font-display text-[clamp(48px,7vw,104px)] uppercase leading-[0.92] tracking-tight">
              {artist.name}
            </h1>
            {(artist.followers != null || artist.genres.length > 0) && (
              <p className="mt-3 text-sm text-white/70">
                {[artist.followers != null ? `${followers.format(artist.followers)} abonnés` : "", artist.genres.slice(0, 3).join(", ")].filter(Boolean).join(" · ")}
              </p>
            )}
          </div>
        </div>
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <button
            onClick={() => run(() => (topTracks.length ? engine.playShuffled(topTracks.map((track) => track.uri)) : engine.playContext(artist.uri)))}
            className="btn-primary h-14 px-8 text-base"
          >
            <Shuffle className="h-5 w-5" />
            Lecture aléatoire
          </button>
          <button onClick={() => run(() => engine.playContext(artist.uri))} className="btn-ghost">
            <Play className="h-5 w-5 fill-current" />
            Lecture
          </button>
          <PinButton pin={{ uri: artist.uri, name: artist.name, image: artist.card ?? artist.image, kind: "artist" }} />
        </div>
      </section>

      {latest && (
        <section
          className="mt-2 flex cursor-pointer items-center gap-5 rounded-3xl border border-white/10 bg-white/[0.04] p-4 transition-colors hover:bg-white/[0.08]"
          onClick={() => openCollection(latest)}
          onContextMenu={(event) => collectionMenu(event, pinOf(latest))}
        >
          <Artwork src={latest.card ?? latest.image} className="h-28 w-28 shrink-0 rounded-2xl" />
          <div className="min-w-0 flex-1">
            <span className="kicker font-mono font-medium text-red-400">DERNIÈRE SORTIE</span>
            <p className="mt-1 truncate font-display text-3xl tracking-tight">{latest.name}</p>
            <p className="mt-1 text-sm text-gray-400">
              {[releaseLabel(latest.releaseDate), latest.group === "single" ? (latest.total && latest.total > 1 ? "EP" : "Single") : "Album", latest.total ? `${latest.total} titre${latest.total > 1 ? "s" : ""}` : ""]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
          <button
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full accent-bg"
            onClick={(event) => {
              event.stopPropagation();
              playCollection(latest);
            }}
            aria-label={`Lire ${latest.name}`}
          >
            <Play className="ml-0.5 h-5 w-5 fill-current" />
          </button>
        </section>
      )}

      {topTracks.length > 0 && (
        <section className="mt-6">
          <h2 className="px-1 text-2xl font-bold tracking-tight">Populaires</h2>
          <TrackList tracks={topTracks} onPlay={(_track, index) => run(() => engine.playTracks(topTracks.map((t) => t.uri), index))} />
        </section>
      )}

      <ReleaseRow title="Albums" kicker="DISCOGRAPHIE" releases={albums} />
      <ReleaseRow title="Singles et EP" kicker="SORTIES" releases={singles} />
      {showAppears ? (
        <ReleaseRow title="Apparitions" kicker="FEATURINGS ET COMPILATIONS" releases={appears.data ?? []} />
      ) : (
        <button onClick={() => setShowAppears(true)} className="btn-ghost mt-6">
          Afficher les apparitions (featurings, compilations)
        </button>
      )}
    </div>
  );
}
