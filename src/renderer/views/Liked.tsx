import { ArrowLeft, Dices, Play, Shuffle } from "lucide-react";
import { ErrorNote, Spinner } from "../components/Artwork";
import { LikedCover } from "../components/LikedCover";
import { run } from "../components/NowPlayingBar";
import { TrackList } from "../components/TrackList";
import { formatTotal } from "../lib/format";
import * as api from "../lib/spotify";
import { goBack } from "../lib/ui";
import { useAsync } from "../lib/useAsync";
import * as engine from "../player/engine";

const count = new Intl.NumberFormat("fr-FR");

/** Liked Songs: the tracks the person hearted, newest first. */
export function LikedView() {
  const { data, error, loading } = useAsync(async () => {
    const [liked, profile] = await Promise.all([api.likedTracks(), api.me()]);
    return { ...liked, profile };
  }, []);

  if (loading && !data) return <Spinner className="py-40" />;
  if (error) return <ErrorNote text={error} />;
  if (!data) return null;
  const { tracks, total, profile } = data;
  const uris = tracks.map((track) => track.uri);
  const duration = tracks.reduce((sum, track) => sum + track.durationMs, 0);
  const play = (index = 0) => run(() => engine.playLiked(profile.id, uris, index));

  return (
    <div className="animate-skeleton-fade">
      <section className="relative -mx-8 -mt-24 overflow-hidden px-8 pb-8 pt-28" style={{ background: "linear-gradient(to bottom, rgb(var(--accent-from) / 0.45), rgb(var(--accent-to) / 0.1) 70%, transparent)" }}>
        <button onClick={goBack} className="mb-6 flex items-center gap-2 text-sm text-white/70 hover:text-white">
          <ArrowLeft className="h-4 w-4" />
          Retour
        </button>
        <div className="flex items-end gap-8">
          <LikedCover className="h-56 w-56 shrink-0 rounded-2xl shadow-2xl shadow-black/50 ring-1 ring-white/10" />
          <div className="min-w-0 pb-1">
            <span className="kicker inline-flex rounded-full border border-white/20 bg-white/15 px-3 py-1 font-medium text-white/90">Playlist</span>
            <h1 className="mt-4 font-display text-5xl leading-[1.05] tracking-tight">Titres likés</h1>
            <p className="mt-3 text-sm text-white/70">
              {profile.name} · {count.format(total)} titres
              {tracks.length < total ? ` · les ${count.format(tracks.length)} plus récents affichés` : ` · ${formatTotal(duration)}`}
            </p>
          </div>
        </div>
        <div className="mt-8 flex items-center gap-3">
          <button onClick={() => play()} disabled={!tracks.length} className="btn-primary">
            <Play className="h-5 w-5 fill-current" />
            Lecture
          </button>
          <button
            onClick={() =>
              run(async () => {
                await engine.playLiked(profile.id, uris, Math.floor(Math.random() * uris.length));
                if (!engine.playback.get().shuffle) await engine.toggleShuffle();
              })
            }
            disabled={!tracks.length}
            className="btn-ghost"
          >
            <Shuffle className="h-5 w-5" />
            Aléatoire
          </button>
          <button
            onClick={() => run(() => engine.playShuffled(uris))}
            disabled={!tracks.length}
            className="btn-ghost"
            title="Un vrai tirage au sort sur tous vos titres likés chargés, à la place de l'aléatoire de Spotify"
          >
            <Dices className="h-5 w-5" />
            Mélange parfait
          </button>
        </div>
      </section>
      {tracks.length === 0 ? (
        <p className="mt-8 text-gray-400">Aucun titre liké pour l'instant : cliquez sur le cœur à côté d'un titre en cours de lecture.</p>
      ) : (
        <TrackList tracks={tracks} onPlay={(_track, index) => play(index)} />
      )}
    </div>
  );
}
