import { ArrowLeft, Play } from "lucide-react";
import { useEffect, useState } from "react";
import { Artwork, ErrorNote, Spinner } from "../components/Artwork";
import { MediaCard } from "../components/MediaCard";
import { run } from "../components/NowPlayingBar";
import { Row } from "../components/Row";
import { TrackList } from "../components/TrackList";
import { artworkColor, rgbVar } from "../lib/palette";
import * as api from "../lib/spotify";
import { goBack } from "../lib/ui";
import { useAsync } from "../lib/useAsync";
import * as engine from "../player/engine";
import { openCollection, playCollection } from "./Home";

const followers = new Intl.NumberFormat("fr-FR");

export function ArtistView({ id }: { id: string }) {
  const { data, error, loading } = useAsync(() => api.artist(id), [id]);
  const [color, setColor] = useState("220 38 38");

  useEffect(() => {
    if (data?.artist.image) void artworkColor(data.artist.image).then((rgb) => setColor(rgbVar(rgb)));
  }, [data?.artist.image]);

  if (loading && !data) return <Spinner className="py-40" />;
  if (error) return <ErrorNote text={error} />;
  if (!data) return null;
  const { artist, topTracks, releases } = data;

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
          <Artwork src={artist.image} round className="h-56 w-56 shrink-0 shadow-2xl shadow-black/50 ring-1 ring-white/10" />
          <div className="min-w-0 pb-2">
            <span className="inline-flex rounded-full border border-white/20 bg-white/15 px-3 py-1 text-xs font-medium uppercase tracking-wider text-white/90">Artiste</span>
            <h1 className="mt-4 line-clamp-2 font-display text-6xl leading-[1.05] tracking-tight">{artist.name}</h1>
            <p className="mt-3 text-sm text-white/70">
              {[artist.followers != null ? `${followers.format(artist.followers)} abonnés` : "", artist.genres.slice(0, 3).join(", ")].filter(Boolean).join(" · ")}
            </p>
          </div>
        </div>
        <button
          onClick={() => run(() => engine.playContext(artist.uri))}
          className="mt-8 inline-flex min-h-[48px] items-center gap-2 rounded-2xl bg-red-600 px-7 py-3 font-semibold shadow-lg shadow-red-900/40 transition-colors hover:bg-red-500"
        >
          <Play className="h-5 w-5 fill-current" />
          Lecture
        </button>
      </section>

      {topTracks.length > 0 && (
        <section className="mt-4">
          <h2 className="px-1 text-2xl font-bold tracking-tight">Populaires</h2>
          <TrackList tracks={topTracks} onPlay={(_track, index) => run(() => engine.playTracks(topTracks.map((t) => t.uri), index))} />
        </section>
      )}

      {releases.length > 0 && (
        <Row title="Albums et singles">
          {releases.map((release, index) => (
            <MediaCard
              key={release.id}
              index={index}
              title={release.name}
              subtitle={release.subtitle}
              image={release.image}
              onOpen={() => openCollection(release)}
              onPlay={() => playCollection(release)}
            />
          ))}
        </Row>
      )}
    </div>
  );
}
