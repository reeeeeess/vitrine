import { ArrowLeft, Dices, Play, Shuffle } from "lucide-react";
import { useRef, useState } from "react";
import { ErrorNote, Spinner } from "../components/Artwork";
import { LikedCover } from "../components/LikedCover";
import { run } from "../components/NowPlayingBar";
import { TrackList } from "../components/TrackList";
import { formatTotal } from "../lib/format";
import type { TrackStat } from "../lib/insights";
import { usePageTitle } from "../lib/pageTitle";
import * as api from "../lib/spotify";
import { goBack } from "../lib/ui";
import { useAsync } from "../lib/useAsync";
import * as engine from "../player/engine";
import { LOCALE } from "../lib/i18n";

const count = new Intl.NumberFormat(LOCALE);

type LikedSort = "added" | "plays" | "recent" | "never";

const LIKED_SORTS: { value: LikedSort; label: string }[] = [
  { value: "added", label: "Date d'ajout" },
  { value: "plays", label: "Les plus écoutés" },
  { value: "recent", label: "Écoutés récemment" },
  { value: "never", label: "Jamais écoutés d'abord" },
];

/** Liked Songs in the order asked, with the plays counted on this computer and the account's history. */
export function sortLiked<T extends { uri: string }>(tracks: T[], sort: LikedSort, stats: Record<string, TrackStat>): T[] {
  if (sort === "added") return tracks;
  const plays = (track: T) => stats[track.uri]?.plays ?? 0;
  const last = (track: T) => stats[track.uri]?.last ?? "";
  const sorted = [...tracks];
  if (sort === "plays") sorted.sort((a, b) => plays(b) - plays(a));
  if (sort === "recent") sorted.sort((a, b) => last(b).localeCompare(last(a)));
  if (sort === "never") sorted.sort((a, b) => Number(plays(a) > 0) - Number(plays(b) > 0));
  return sorted;
}

/** Liked Songs: the tracks the person hearted, newest first. */
export function LikedView() {
  const { data, error, loading } = useAsync(async () => {
    const [liked, profile] = await Promise.all([api.likedTracks(), api.me()]);
    return { ...liked, profile };
  }, []);
  const stats = useAsync(() => window.vitrine.history?.insight("trackStats") ?? Promise.resolve({} as Record<string, TrackStat>), []);
  const [sort, setSort] = useState<LikedSort>("added");
  const title = useRef<HTMLHeadingElement>(null);
  usePageTitle(title, "Titres likés");

  if (loading && !data) return <Spinner className="py-40" />;
  if (error) return <ErrorNote text={error} />;
  if (!data) return null;
  const { total, profile } = data;
  const tracks = stats.data ? sortLiked(data.tracks, sort, stats.data) : data.tracks;
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
            <h1 ref={title} className="mt-4 font-display text-5xl leading-[1.05] tracking-tight">
              Titres likés
            </h1>
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
        <>
          {stats.data && (
            <label className="mt-6 flex items-center gap-2 px-1 text-sm text-gray-400">
              Trier par
              <select value={sort} onChange={(event) => setSort(event.target.value as LikedSort)} className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-white">
                {LIKED_SORTS.map((option) => (
                  <option key={option.value} value={option.value} className="bg-neutral-900">
                    {option.label}
                  </option>
                ))}
              </select>
              <span className="text-xs text-gray-500">Lectures comptées par Vitrine (cet ordinateur, tout le compte depuis l'installation, et votre import)</span>
            </label>
          )}
          <TrackList tracks={tracks} stats={stats.data ?? undefined} onPlay={(_track, index) => play(index)} />
        </>
      )}
    </div>
  );
}
