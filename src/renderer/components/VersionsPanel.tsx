import { motion } from "framer-motion";
import { Layers, Loader2, Play, X } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "../lib/cn";
import { errorMessage, formatTime } from "../lib/format";
import { SPRING } from "../lib/motion";
import { createStore, useStore } from "../lib/store";
import type { Track } from "../lib/types";
import { notify } from "../lib/ui";
import { VERSION_KINDS, type Version, type VersionKind } from "../lib/versions";
import * as engine from "../player/engine";
import { findVersions } from "../player/karaoke";
import { Artwork } from "./Artwork";
import { run } from "./NowPlayingBar";

/** the track whose versions are shown */
export const versionsOf = createStore<{ track: Track | null }>({ track: null });
export const openVersions = (track: Track) => versionsOf.set({ track });
const close = () => versionsOf.set({ track: null });

const ICON: Record<VersionKind, string> = { spedup: "⚡", slowed: "🌙", acoustic: "🎸", instrumental: "🎤", live: "🏟️", remix: "🎛️" };

const delta = (ms: number) => (Math.abs(ms) < 1000 ? "même durée" : `${ms < 0 ? "−" : "+"}${Math.round(Math.abs(ms) / 1000)} s`);

/** The other versions of a track (TikTok's sped up and slowed, acoustic, instrumental, live, remix). */
export function VersionsPanel() {
  const track = useStore(versionsOf, (s) => s.track);
  const [versions, setVersions] = useState<Map<VersionKind, Version[]> | null>(null);

  useEffect(() => {
    if (!track) return;
    setVersions(null);
    findVersions(track).then(setVersions, (error: unknown) => {
      notify(errorMessage(error), "error");
      close();
    });
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [track]);

  if (!track) return null;
  return (
    <motion.div className="fixed inset-0 z-[72] flex justify-end bg-black/50" initial={{ opacity: 0 }} animate={{ opacity: 1 }} onMouseDown={(event) => event.target === event.currentTarget && close()}>
      <motion.aside className="glass flex h-full w-[440px] flex-col rounded-l-3xl p-6" initial={{ x: 60 }} animate={{ x: 0 }} transition={SPRING}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <span className="kicker flex items-center gap-1.5 font-mono font-medium text-red-400">
              <Layers className="h-3.5 w-3.5" />
              AUTRES VERSIONS
            </span>
            <p className="mt-1 truncate font-display text-2xl tracking-tight">{track.name}</p>
            <p className="truncate text-sm text-gray-400">{track.artists.join(", ")}</p>
          </div>
          <button onClick={close} className="rounded-full p-2 text-gray-400 hover:bg-white/10 hover:text-white" aria-label="Fermer">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="scrollbar-hide mt-5 flex-1 space-y-5 overflow-y-auto">
          {!versions && (
            <p className="flex items-center gap-2 text-gray-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              Recherche des versions officielles…
            </p>
          )}
          {versions && versions.size === 0 && <p className="text-gray-400">Spotify ne connaît pas d'autre version de ce titre (accélérée, acoustique, instrumentale…).</p>}
          {versions &&
            VERSION_KINDS.filter(({ kind }) => versions.has(kind)).map(({ kind, label }) => (
              <section key={kind}>
                <p className="text-sm font-semibold text-white/80">
                  {ICON[kind]} {label}
                </p>
                <div className="mt-2 space-y-1">
                  {versions.get(kind)!.slice(0, 4).map((version) => (
                    <button
                      key={version.track.uri}
                      onClick={() => run(() => engine.playTracks([version.track.uri]))}
                      className="group flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors hover:bg-white/5"
                    >
                      <span className="relative h-11 w-11 shrink-0">
                        <Artwork src={version.track.thumb ?? version.track.image} className="rounded-md" />
                        <span className="absolute inset-0 hidden items-center justify-center rounded-md bg-black/50 group-hover:flex">
                          <Play className="h-4 w-4 fill-current" />
                        </span>
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{version.track.name}</span>
                        <span className="block truncate text-xs text-gray-400">
                          {version.track.artists.join(", ")}
                          {version.sameArtist ? " · officielle" : ""}
                        </span>
                      </span>
                      <span className={cn("shrink-0 text-right text-xs tabular-nums", version.deltaMs < -1000 ? "text-amber-300" : "text-gray-400")}>
                        {formatTime(version.track.durationMs)}
                        <span className="block text-[10px] text-gray-500">{delta(version.deltaMs)}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </section>
            ))}
        </div>
      </motion.aside>
    </motion.div>
  );
}
