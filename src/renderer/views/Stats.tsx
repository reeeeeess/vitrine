import { motion } from "framer-motion";
import { Loader2, Share2 } from "lucide-react";
import { useState } from "react";
import { Artwork, ErrorNote, Spinner } from "../components/Artwork";
import { run } from "../components/NowPlayingBar";
import { cn } from "../lib/cn";
import * as api from "../lib/spotify";
import { errorMessage } from "../lib/format";
import { renderRecap, saveBlob } from "../lib/recap";
import { navigate, notify } from "../lib/ui";
import { useAsync } from "../lib/useAsync";
import * as engine from "../player/engine";

type Range = "short_term" | "medium_term" | "long_term";
const RANGES: { value: Range; label: string }[] = [
  { value: "short_term", label: "4 semaines" },
  { value: "medium_term", label: "6 mois" },
  { value: "long_term", label: "Depuis toujours" },
];

export function Stats() {
  const [range, setRange] = useState<Range>("short_term");
  const { data, error, loading } = useAsync(async () => {
    const [tracks, artists] = await Promise.all([api.topTracks(range, 20), api.topArtists(range, 12)]);
    return { tracks, artists };
  }, [range]);
  const [sharing, setSharing] = useState(false);

  const share = async () => {
    if (!data) return;
    setSharing(true);
    try {
      const profile = await api.me().catch(() => undefined);
      const period = RANGES.find((option) => option.value === range)?.label ?? "";
      const blob = await renderRecap({ period, name: profile?.name ?? "", tracks: data.tracks, artists: data.artists });
      saveBlob(blob, `vitrine-recap-${range.replace("_term", "")}.png`);
      notify("Récap prêt : choisissez où l'enregistrer.");
    } catch (error) {
      notify(errorMessage(error), "error");
    } finally {
      setSharing(false);
    }
  };

  return (
    <div className="animate-skeleton-fade">
      <div className="flex items-end justify-between gap-4 px-1">
        <div>
          <span className="kicker font-semibold text-red-500">Vos statistiques</span>
          <h1 className="mt-1 font-display text-4xl tracking-tight">Ce que vous écoutez</h1>
        </div>
        <div className="flex items-center gap-3">
        <button onClick={() => void share()} disabled={!data || sharing} className="btn-ghost min-h-0 px-4 py-2 text-sm disabled:opacity-40">
          {sharing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />}
          Partager mon récap
        </button>
        <div className="flex gap-1 rounded-2xl border border-white/10 bg-white/5 p-1">
          {RANGES.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setRange(value)}
              className={cn("rounded-xl px-4 py-1.5 text-sm font-medium transition-colors", range === value ? "accent-bg" : "text-gray-400 hover:text-white")}
            >
              {label}
            </button>
          ))}
        </div>
        </div>
      </div>

      {loading && !data && <Spinner className="py-40" />}
      {error && <ErrorNote text={error} />}
      {data && (
        <div className="mt-8 grid grid-cols-1 gap-8 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
          <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
            <h2 className="text-xl font-bold">Top titres</h2>
            <ol className="mt-4 space-y-1">
              {data.tracks.map((track, index) => (
                <motion.li
                  key={track.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.03 }}
                  className="group flex items-center gap-4 rounded-xl px-2 py-2 hover:bg-white/5"
                >
                  <span className={cn("w-8 text-right font-display text-xl tabular-nums", index < 3 ? "text-red-500" : "text-white/40")}>{index + 1}</span>
                  <button className="h-11 w-11 shrink-0" onClick={() => run(() => engine.playTracks(data.tracks.map((t) => t.uri), index))} aria-label={`Lire ${track.name}`}>
                    <Artwork src={track.image} className="rounded-md" />
                  </button>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{track.name}</span>
                    <span className="block truncate text-xs text-gray-400">{track.artists.join(", ")}</span>
                  </span>
                  {track.albumId && (
                    <button className="truncate text-xs text-gray-500 opacity-0 hover:text-white group-hover:opacity-100" onClick={() => navigate({ name: "album", id: track.albumId! })}>
                      {track.albumName}
                    </button>
                  )}
                </motion.li>
              ))}
            </ol>
          </section>
          <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
            <h2 className="text-xl font-bold">Top artistes</h2>
            <div className="mt-4 grid grid-cols-3 gap-4">
              {data.artists.map((artist, index) => (
                <motion.button
                  key={artist.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.04 }}
                  onClick={() => navigate({ name: "artist", id: artist.id })}
                  className="group text-center"
                >
                  <div className="relative">
                    <Artwork src={artist.image} round className="ring-1 ring-white/10 transition-transform duration-300 group-hover:scale-105" />
                    <span className="absolute left-0 top-0 flex h-7 w-7 items-center justify-center rounded-full accent-bg text-xs font-bold">{index + 1}</span>
                  </div>
                  <span className="mt-2 block truncate text-sm font-semibold">{artist.name}</span>
                  <span className="block truncate text-xs text-gray-400">{artist.genres.slice(0, 2).join(", ") || "Artiste"}</span>
                </motion.button>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
