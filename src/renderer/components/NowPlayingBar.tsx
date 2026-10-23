import { AnimatePresence, motion } from "framer-motion";
import { Captions, ListMusic, SlidersHorizontal, Maximize2, Mic2, MonitorSpeaker, Pause, PictureInPicture2, Play, Repeat, Repeat1, Shuffle, SkipBack, SkipForward, Volume1, Volume2, VolumeX } from "lucide-react";
import { useEffect, useState, type CSSProperties } from "react";
import { cn } from "../lib/cn";
import { SPRING } from "../lib/motion";
import { errorMessage, formatTime } from "../lib/format";
import { createStore, useStore } from "../lib/store";
import type { Track } from "../lib/types";
import { navigate, notify, setMini, ui } from "../lib/ui";
import * as engine from "../player/engine";
import { playback } from "../player/engine";
import { usePosition } from "../player/hooks";
import { loop } from "../player/loop";
import { useSwipe, type SwipeDirection } from "../player/useSwipe";
import { Artwork } from "./Artwork";
import { DevicesMenu } from "./DevicesMenu";
import { openEqualizer } from "./EqualizerPanel";
import { LikeButton } from "./LikeButton";
import { Marquee } from "./Marquee";
import { SleepTimerButton } from "./SleepTimerButton";
import { trackMenu } from "./TrackMenu";
import { overlay, toggleOverlay } from "../player/overlayBridge";

/** Runs a playback command and shows what went wrong, if anything did. */
export function run(command: () => Promise<unknown>): void {
  command().catch((error: unknown) => notify(errorMessage(error), "error"));
}

const REMAINING_KEY = "vitrine.remainingTime";

function readRemaining(): boolean {
  try {
    return localStorage.getItem(REMAINING_KEY) === "on";
  } catch {
    return false;
  }
}

/** the time on the right: the duration, or what is left ("-1:23"), as the person chose (Apple Music) */
const timeDisplay = createStore({ remaining: readRemaining() });

function toggleRemaining(): void {
  const remaining = !timeDisplay.get().remaining;
  timeDisplay.set({ remaining });
  try {
    localStorage.setItem(REMAINING_KEY, remaining ? "on" : "off");
  } catch {
    // for this run only
  }
}

export function ProgressBar({ className }: { className?: string }) {
  const position = usePosition();
  const duration = useStore(playback, (s) => s.durationMs);
  const uri = useStore(playback, (s) => s.track?.uri);
  const remaining = useStore(timeDisplay, (s) => s.remaining);
  const looped = useStore(loop, (s) => (s.current?.uri === uri ? s.current : null));
  const [dragging, setDragging] = useState<number | null>(null);
  const shown = dragging ?? position;
  const percent = duration ? (shown / duration) * 100 : 0;
  const at = (ms: number) => `${duration ? (ms / duration) * 100 : 0}%`;
  // one seek, when the bar is let go: not one per pixel (Spotify counts requests)
  const release = () => {
    if (dragging !== null) run(() => engine.seek(dragging));
    setDragging(null);
  };
  return (
    <div className={cn("flex items-center gap-3 text-xs tabular-nums text-gray-400", className)}>
      <span className="w-10 text-right">{formatTime(shown)}</span>
      <div className="relative flex flex-1 items-center">
        {looped && (
          <span
            className="pointer-events-none absolute -inset-y-1 rounded-full bg-red-500/30 ring-1 ring-red-500/60"
            style={{ left: at(looped.aMs), width: looped.bMs !== undefined ? `calc(${at(looped.bMs - looped.aMs)})` : "3px" }}
            aria-hidden="true"
          />
        )}
        <input
          type="range"
          className={cn("range w-full", dragging !== null && "range-held")}
          min={0}
          max={duration || 1}
          step={1000}
          value={shown}
          style={{ "--value": `${percent}%` } as CSSProperties}
          onChange={(event) => setDragging(Number(event.target.value))}
          onPointerUp={release}
          onKeyUp={release}
          aria-label="Position"
          disabled={!duration}
        />
      </div>
      <button className="w-10 text-left hover:text-white" onClick={toggleRemaining} title={remaining ? "Afficher la durée" : "Afficher le temps restant"}>
        {remaining && duration ? `-${formatTime(Math.max(0, duration - shown))}` : formatTime(duration)}
      </button>
    </div>
  );
}

export function TransportControls({ large = false }: { large?: boolean }) {
  const paused = useStore(playback, (s) => s.paused);
  const shuffle = useStore(playback, (s) => s.shuffle);
  const repeat = useStore(playback, (s) => s.repeat);
  const hasTrack = useStore(playback, (s) => Boolean(s.track));
  const side = cn("rounded-full p-2 transition-colors disabled:opacity-40", large ? "text-white/80 hover:text-white" : "text-gray-400 hover:text-white");
  const RepeatIcon = repeat === "track" ? Repeat1 : Repeat;
  return (
    <div className={cn("flex items-center justify-center", large ? "gap-6" : "gap-3")}>
      <button className={cn(side, shuffle && "text-red-500 hover:text-red-400")} onClick={() => run(engine.toggleShuffle)} disabled={!hasTrack} aria-label="Lecture aléatoire" aria-pressed={shuffle}>
        <Shuffle className={large ? "h-5 w-5" : "h-4 w-4"} />
      </button>
      <button className={side} onClick={() => run(engine.previous)} disabled={!hasTrack} aria-label="Précédent">
        <SkipBack className={cn("fill-current", large ? "h-7 w-7" : "h-5 w-5")} />
      </button>
      <button
        onClick={() => run(engine.togglePlay)}
        disabled={!hasTrack}
        className={cn(
          "btn-play flex items-center justify-center rounded-full transition-transform hover:scale-105 disabled:opacity-40",
          large ? "h-16 w-16" : "h-10 w-10",
        )}
        aria-label={paused ? "Lecture" : "Pause"}
      >
        {paused ? <Play className={cn("ml-0.5 fill-current", large ? "h-7 w-7" : "h-5 w-5")} /> : <Pause className={cn("fill-current", large ? "h-7 w-7" : "h-5 w-5")} />}
      </button>
      <button className={side} onClick={() => run(engine.next)} disabled={!hasTrack} aria-label="Suivant">
        <SkipForward className={cn("fill-current", large ? "h-7 w-7" : "h-5 w-5")} />
      </button>
      <button
        className={cn(side, repeat !== "off" && "text-red-500 hover:text-red-400")}
        onClick={() => run(engine.cycleRepeat)}
        disabled={!hasTrack}
        aria-label={repeat === "track" ? "Répéter le titre" : repeat === "context" ? "Répéter tout" : "Répétition désactivée"}
      >
        <RepeatIcon className={large ? "h-5 w-5" : "h-4 w-4"} />
      </button>
    </div>
  );
}

export function VolumeControl() {
  const volume = useStore(playback, (s) => s.volume);
  const [before, setBefore] = useState(0.7);
  const Icon = volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;
  return (
    <div className="flex items-center gap-2">
      <button
        className="rounded-full p-2 text-gray-400 hover:text-white"
        onClick={() => {
          if (volume > 0) setBefore(volume);
          engine.setVolume(volume > 0 ? 0 : before || 0.5);
        }}
        aria-label={volume === 0 ? "Rétablir le son" : "Couper le son"}
      >
        <Icon className="h-4 w-4" />
      </button>
      <input
        type="range"
        className="range w-24"
        min={0}
        max={100}
        value={Math.round(volume * 100)}
        style={{ "--value": `${volume * 100}%` } as CSSProperties}
        onChange={(event) => engine.setVolume(Number(event.target.value) / 100)}
        aria-label="Volume"
      />
    </div>
  );
}

export function DevicesButton() {
  const open = useStore(ui, (s) => s.devicesOpen);
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && !ui.get().fullPlayer && ui.set({ devicesOpen: false });
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);
  const device = useStore(playback, (s) => s.device);
  return (
    <div className="relative">
      <button
        className={cn("rounded-full p-2 transition-colors", open ? "text-white" : device && !device.local ? "text-red-500" : "text-gray-400 hover:text-white")}
        onClick={() => ui.set({ devicesOpen: !open })}
        aria-label="Appareils"
        title={device ? `Lecture sur ${device.name}` : "Appareils"}
      >
        <MonitorSpeaker className="h-4 w-4" />
      </button>
      <AnimatePresence>{open && <DevicesMenu />}</AnimatePresence>
    </div>
  );
}

export function ArtistLinks({ track, className }: { track: Track; className?: string }) {
  return (
    <p className={cn("truncate", className)}>
      {track.artists.map((name, index) => {
        const id = track.artistIds[index];
        return (
          <span key={`${name}-${index}`}>
            {index > 0 && ", "}
            {id ? (
              <button className="hover:text-white hover:underline" onClick={() => navigate({ name: "artist", id })}>
                {name}
              </button>
            ) : (
              name
            )}
          </span>
        );
      })}
    </p>
  );
}

/** Lyrics over the desktop, above every app (Ctrl+Alt+K). */
function OverlayButton() {
  const open = useStore(overlay, (s) => s.open);
  return (
    <button
      className={cn("rounded-full p-2 transition-colors", open ? "text-red-500 hover:text-red-400" : "text-gray-400 hover:text-white")}
      onClick={() => run(toggleOverlay)}
      aria-label="Paroles sur le bureau"
      aria-pressed={open}
      title="Paroles sur le bureau, par-dessus toutes les applis (Ctrl+Alt+K)"
    >
      <Captions className="h-4 w-4" />
    </button>
  );
}

function QueueButton() {
  const open = useStore(ui, (s) => s.queueOpen);
  const hasTrack = useStore(playback, (s) => Boolean(s.track));
  return (
    <button
      className={cn("rounded-full p-2 transition-colors disabled:opacity-40", open ? "text-red-500" : "text-gray-400 hover:text-white")}
      onClick={() => ui.set({ queueOpen: !open })}
      disabled={!hasTrack}
      aria-label="File d'attente"
      aria-pressed={open}
      title="File d'attente"
    >
      <ListMusic className="h-4 w-4" />
    </button>
  );
}

let lastSwipe: SwipeDirection = "next";

export function NowPlayingBar() {
  const track = useStore(playback, (s) => s.track);
  const device = useStore(playback, (s) => s.device);
  const swipe = useSwipe((direction) => {
    lastSwipe = direction;
    run(direction === "next" ? engine.next : engine.previous);
  });
  return (
    <footer className="glass fixed inset-x-4 bottom-4 z-30 grid h-[84px] grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_minmax(0,1fr)] items-center gap-6 rounded-3xl px-4">
      <div className="flex min-w-0 items-center gap-3 overflow-hidden" {...swipe} title="Balayez pour changer de titre">
        {track ? (
          <motion.div
            key={track.uri}
            className="flex min-w-0 flex-1 items-center gap-3"
            initial={{ x: lastSwipe === "next" ? 40 : -40, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={SPRING}
          >
            <button className="group relative h-14 w-14 shrink-0" onClick={() => ui.set({ fullPlayer: true, devicesOpen: false })} aria-label="Ouvrir le lecteur">
              <Artwork src={track.image} className="h-14 w-14 rounded-xl shadow-lg" />
              <span className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                <Maximize2 className="h-4 w-4" />
              </span>
            </button>
            <div className="min-w-0" onContextMenu={(event) => trackMenu(event, track)}>
              <button className="block max-w-full text-left text-sm font-semibold hover:underline" onClick={() => track.albumId && navigate({ name: "album", id: track.albumId })}>
                <Marquee text={track.name} />
              </button>
              <ArtistLinks track={track} className="text-xs text-gray-400" />
              {device && !device.local && <p className="truncate text-[11px] font-medium text-red-400">Lecture sur {device.name}</p>}
            </div>
            <LikeButton track={track} />
          </motion.div>
        ) : (
          <p className="text-sm text-gray-400">Choisissez un titre pour commencer.</p>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <TransportControls />
        <ProgressBar />
      </div>

      <div className="flex items-center justify-end gap-1">
        <button
          className="rounded-full p-2 text-gray-400 transition-colors hover:text-white disabled:opacity-40"
          onClick={() => ui.set({ lyricsStage: true, fullPlayer: false, devicesOpen: false })}
          disabled={!track}
          aria-label="Paroles"
          title="Paroles plein écran (karaoké)"
        >
          <Mic2 className="h-4 w-4" />
        </button>
        <OverlayButton />
        <QueueButton />
        <SleepTimerButton />
        <button className="rounded-full p-2 text-gray-400 transition-colors hover:text-white" onClick={openEqualizer} aria-label="Égaliseur" title="Égaliseur (sortie son de Windows)">
          <SlidersHorizontal className="h-4 w-4" />
        </button>
        <button
          className="rounded-full p-2 text-gray-400 transition-colors hover:text-white"
          onClick={() => void setMini(true)}
          aria-label="Mini-lecteur"
          title="Mini-lecteur (toujours au premier plan)"
        >
          <PictureInPicture2 className="h-4 w-4" />
        </button>
        <DevicesButton />
        <VolumeControl />
      </div>
    </footer>
  );
}
