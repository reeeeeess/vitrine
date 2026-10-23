import { AnimatePresence, motion } from "framer-motion";
import { Ban, ChevronDown, ChevronUp, Compass, Gem, Heart, ListEnd, ListPlus, Loader2, Mic2, Play, RefreshCw, Share2, Sparkles } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Artwork, ErrorNote } from "../components/Artwork";
import { ArtistLinks, run } from "../components/NowPlayingBar";
import { shareStory } from "../components/StoryButton";
import { trackMenu } from "../components/TrackMenu";
import { cn } from "../lib/cn";
import { collect, collecting, hide, hookPosition, loadFlow, markSeen, setCollecting, songKey, type FlowItem, type FlowSource } from "../lib/flow";
import { teach } from "../lib/flowTaste";
import { errorMessage } from "../lib/format";
import { activeLineIndex } from "../lib/lrc";
import * as api from "../lib/spotify";
import { useStore } from "../lib/store";
import type { Track } from "../lib/types";
import { navigate, notify, ui } from "../lib/ui";
import * as engine from "../player/engine";
import { playback } from "../player/engine";
import { usePosition } from "../player/hooks";
import { useLyrics } from "../player/useLyrics";

/** how long a card has to stay in view before it plays: scrolling through does not start each one */
const SETTLE_MS = 450;
/** a card left this soon after it started playing says "not for me", one heard this long says the opposite */
const SKIPPED_BEFORE_MS = 8000;
const LISTENED_AFTER_MS = 30_000;
/** a wheel or trackpad gesture moves one card, then waits before the next */
const WHEEL_COOLDOWN_MS = 650;
const HOOK_KEY = "vitrine.flow.hook";

const SOURCE_ICON: Record<FlowSource, typeof Sparkles> = { new: Sparkles, around: Compass, forgotten: Gem };

function readHook(): boolean {
  try {
    return localStorage.getItem(HOOK_KEY) !== "off";
  } catch {
    return true;
  }
}

/** The TikTok of your music: one track per screen, playing from its chorus, the next one a scroll away. */
export function Flow({ seed }: { seed?: Track }) {
  const [items, setItems] = useState<FlowItem[]>([]);
  const [state, setState] = useState<{ status: "loading" | "ready" } | { status: "error"; message: string }>({ status: "loading" });
  const [active, setActive] = useState(0);
  const [hook, setHook] = useState(readHook);
  const [burst, setBurst] = useState(0);
  const [gather, setGather] = useState(collecting);
  /** the card playing, since when: what the person does next teaches Flow */
  const dwell = useRef<{ item: FlowItem; since: number } | null>(null);
  const round = useRef(0);
  const loadingMore = useRef(false);
  const lastWheel = useRef(0);
  const area = useRef<HTMLDivElement>(null);
  const playingUri = useStore(playback, (s) => s.track?.uri);
  const paused = useStore(playback, (s) => s.paused);
  const current = items[active];
  const isPlaying = Boolean(current && playingUri === current.track.uri);

  const load = useCallback(async () => {
    setState({ status: "loading" });
    try {
      round.current = 0;
      const first = await loadFlow(0, new Set(), Date.now(), seed);
      setItems(first);
      setActive(0);
      setState({ status: "ready" });
    } catch (error) {
      setState({ status: "error", message: errorMessage(error) });
    }
  }, [seed]);

  useEffect(() => {
    void load();
  }, [load]);

  // more cards before the end comes in sight
  useEffect(() => {
    if (state.status !== "ready" || loadingMore.current || items.length === 0 || active < items.length - 4) return;
    loadingMore.current = true;
    round.current += 1;
    const skip = new Set(items.flatMap((item) => [item.track.id, songKey(item.track)]));
    loadFlow(round.current, skip, Date.now(), seed)
      .then((more) => setItems((list) => [...list, ...more]))
      .catch(() => undefined)
      .finally(() => {
        loadingMore.current = false;
      });
  }, [active, items, state.status]);

  // the card in view plays, from its chorus, once the scrolling stops on it
  useEffect(() => {
    const item = items[active];
    if (!item || playback.get().track?.uri === item.track.uri) return;
    const timer = setTimeout(() => {
      markSeen(item.track);
      run(() => engine.playTracks(items.map((i) => i.track.uri), active, hook ? hookPosition(item.track.durationMs) : 0));
    }, SETTLE_MS);
    return () => clearTimeout(timer);
    // only a new card in view plays: cards added at the end leave the one playing alone
  }, [active, items[active]?.track.uri]);

  // the next track started on its own, or from the player bar: the feed follows
  useEffect(() => {
    if (!playingUri) return;
    const index = items.findIndex((item) => item.track.uri === playingUri);
    if (index >= 0 && index !== active) setActive(index);
  }, [playingUri]);

  // how long each card was heard: a quick skip and a full listen both teach Flow
  useEffect(() => {
    const item = items[active];
    const previous = dwell.current;
    if (previous && previous.item.track.uri !== item?.track.uri) {
      const heard = Date.now() - previous.since;
      if (heard < SKIPPED_BEFORE_MS) teach(previous.item.track, "skipped");
      else if (heard >= LISTENED_AFTER_MS) teach(previous.item.track, "listened");
      dwell.current = null;
    }
    if (item && playingUri === item.track.uri && dwell.current?.item.track.uri !== item.track.uri) dwell.current = { item, since: Date.now() };
  }, [active, playingUri, items]);

  const go = useCallback((delta: number) => setActive((index) => Math.max(0, Math.min(items.length - 1, index + delta))), [items.length]);

  const toggleLike = useCallback(
    async (index: number, onlyLike = false) => {
      const item = items[index];
      if (!item) return;
      if (onlyLike) setBurst((n) => n + 1);
      if (item.saved && onlyLike) return;
      const saved = !item.saved;
      const mark = (value: boolean) => setItems((list) => list.map((other, i) => (i === index ? { ...other, saved: value } : other)));
      mark(saved);
      teach(item.track, saved ? "like" : "unlike");
      try {
        await (saved ? api.saveTrack(item.track.id) : api.removeTrack(item.track.id));
        if (saved && gather) await collect(item.track);
        if (!onlyLike) notify(saved ? (gather ? "Ajouté aux titres likés et à « Trouvé dans Flow »" : "Ajouté aux titres likés") : "Retiré des titres likés");
      } catch (error) {
        mark(!saved);
        notify(errorMessage(error), "error");
      }
    },
    [items, gather],
  );

  const notForMe = useCallback(
    (index: number) => {
      const item = items[index];
      if (!item) return;
      hide(item.track);
      teach(item.track, "notForMe");
      if (dwell.current?.item === item) dwell.current = null;
      setItems((list) => list.filter((_, i) => i !== index));
      // the next card takes its place, and plays; the last one leaves the previous in view
      if (index === items.length - 1) setActive(Math.max(0, index - 1));
      notify("Ce titre ne reviendra plus dans Flow.");
    },
    [items],
  );

  // keys: arrows or J/K move, L likes
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const typing = event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement;
      if (typing || ui.get().playlistDialog || ui.get().fullPlayer) return;
      if (["ArrowDown", "PageDown", "j", "J"].includes(event.key)) go(1);
      else if (["ArrowUp", "PageUp", "k", "K"].includes(event.key)) go(-1);
      else if (event.key === "l" || event.key === "L") void toggleLike(active);
      else return;
      event.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, toggleLike, active]);

  // the wheel and the trackpad: one card per gesture
  useEffect(() => {
    const element = area.current;
    if (!element) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      if (Math.abs(event.deltaY) < 12 || Date.now() - lastWheel.current < WHEEL_COOLDOWN_MS) return;
      lastWheel.current = Date.now();
      go(event.deltaY > 0 ? 1 : -1);
    };
    element.addEventListener("wheel", onWheel, { passive: false });
    return () => element.removeEventListener("wheel", onWheel);
  }, [go, state.status]);

  // a drag on a touch screen
  const dragFrom = useRef<number | null>(null);

  const toggleHook = () => {
    const next = !hook;
    setHook(next);
    try {
      localStorage.setItem(HOOK_KEY, next ? "on" : "off");
    } catch {
      // for this session only
    }
  };

  if (state.status === "loading") {
    return (
      <div className="fixed inset-x-0 bottom-[112px] top-16 flex flex-col items-center justify-center gap-4 text-white/60">
        <Loader2 className="h-8 w-8 animate-spin text-red-500" />
        <p className="text-sm">Flow prépare votre fil : nouveautés de vos artistes, découvertes, pépites oubliées…</p>
      </div>
    );
  }
  if (state.status === "error") {
    return (
      <div className="fixed inset-x-0 bottom-[112px] top-16 flex flex-col items-center justify-center gap-4 px-8">
        <ErrorNote text={state.message} />
        <button onClick={() => void load()} className="btn-ghost min-h-0 px-4 py-2 text-sm">
          <RefreshCw className="h-4 w-4" />
          Réessayer
        </button>
      </div>
    );
  }
  if (items.length === 0) {
    return (
      <div className="fixed inset-x-0 bottom-[112px] top-16 flex flex-col items-center justify-center gap-3 px-8 text-center">
        <Sparkles className="h-8 w-8 text-red-500" />
        <p className="font-display text-2xl">Flow n'a encore rien à vous proposer</p>
        <p className="max-w-md text-sm text-gray-400">Écoutez quelques titres : Flow part de vos artistes préférés selon Spotify et de vos titres likés.</p>
      </div>
    );
  }

  return (
    <div
      ref={area}
      className="fixed inset-x-0 bottom-[112px] top-16 overflow-hidden"
      onPointerDown={(event) => event.pointerType === "touch" && (dragFrom.current = event.clientY)}
      onPointerUp={(event) => {
        if (dragFrom.current === null) return;
        const distance = dragFrom.current - event.clientY;
        dragFrom.current = null;
        if (Math.abs(distance) > 60) go(distance > 0 ? 1 : -1);
      }}
    >
      {/* the active card's artwork, blurred, as the backdrop of the whole page */}
      <AnimatePresence>
        {current && (
          <motion.img
            key={current.track.uri}
            src={current.track.thumb ?? current.track.image}
            alt=""
            aria-hidden="true"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.45 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8 }}
            className="fx-blur pointer-events-none absolute inset-[-10%] h-[120%] w-[120%] animate-slow-pan object-cover blur-[80px]"
          />
        )}
      </AnimatePresence>
      <div className="pointer-events-none absolute inset-0 bg-black/40" />

      <div className="absolute left-8 top-4 z-10 flex items-center gap-3">
        <span className="kicker font-semibold text-red-500">Flow</span>
        <button onClick={toggleHook} className={cn("rounded-full border px-3 py-1 text-xs transition-colors", hook ? "border-red-500/60 bg-red-500/15 text-white" : "border-white/15 text-gray-400 hover:text-white")} aria-pressed={hook}>
          Démarrer au refrain
        </button>
        <button
          onClick={() => {
            setCollecting(!gather);
            setGather(!gather);
          }}
          className={cn("rounded-full border px-3 py-1 text-xs transition-colors", gather ? "border-red-500/60 bg-red-500/15 text-white" : "border-white/15 text-gray-400 hover:text-white")}
          aria-pressed={gather}
          title="Chaque titre aimé dans Flow va aussi dans votre playlist « Trouvé dans Flow »"
        >
          Mes ♥ dans « Trouvé dans Flow »
        </button>
        {seed && <span className="text-xs text-white/60">à partir de « {seed.name} »</span>}
      </div>

      {items.map((item, index) =>
        Math.abs(index - active) > 2 ? null : (
          <div
            key={item.track.uri}
            className="absolute inset-0 flex items-center justify-center gap-6 py-6 transition-transform duration-500 ease-[cubic-bezier(0.23,1,0.32,1)]"
            style={{ transform: `translateY(${(index - active) * 100}%)` }}
            aria-hidden={index !== active}
          >
            <Card
              item={item}
              active={index === active}
              playing={index === active && isPlaying && !paused}
              burst={index === active ? burst : 0}
              onToggle={() => run(index === active && isPlaying ? engine.togglePlay : () => engine.playTracks(items.map((i) => i.track.uri), index, hook ? hookPosition(item.track.durationMs) : 0))}
              onLike={() => void toggleLike(index, true)}
            />
            <Actions
              item={item}
              onLike={() => void toggleLike(index)}
              onNotForMe={() => notForMe(index)}
            />
          </div>
        ),
      )}

      <div className="absolute right-8 top-1/2 z-10 flex -translate-y-1/2 flex-col gap-3">
        <button onClick={() => go(-1)} disabled={active === 0} className="rounded-full bg-white/10 p-3 backdrop-blur transition-colors hover:bg-white/20 disabled:opacity-30" aria-label="Titre précédent du fil">
          <ChevronUp className="h-5 w-5" />
        </button>
        <button onClick={() => go(1)} disabled={active >= items.length - 1} className="rounded-full bg-white/10 p-3 backdrop-blur transition-colors hover:bg-white/20 disabled:opacity-30" aria-label="Titre suivant du fil">
          <ChevronDown className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}

function Card({ item, active, playing, burst, onToggle, onLike }: { item: FlowItem; active: boolean; playing: boolean; burst: number; onToggle: () => void; onLike: () => void }) {
  const { track } = item;
  const art = track.imageLarge ?? track.image;
  const SourceIcon = SOURCE_ICON[item.source];
  const clickTimer = useRef<ReturnType<typeof setTimeout>>();
  const [heart, setHeart] = useState(0);

  // the heart of a double click shows for a moment
  useEffect(() => {
    if (!burst) return;
    setHeart(burst);
    const timer = setTimeout(() => setHeart(0), 750);
    return () => clearTimeout(timer);
  }, [burst]);

  return (
    <div className="relative aspect-[3/4] h-full max-w-[calc(100vw-260px)] overflow-hidden rounded-[2rem] bg-black shadow-[0_30px_80px_rgba(0,0,0,0.55)] ring-1 ring-white/10">
      {art && <img src={track.thumb ?? art} alt="" aria-hidden="true" className={cn("fx-blur absolute inset-[-15%] h-[130%] w-[130%] object-cover opacity-60 blur-[40px]", active && "animate-slow-pan")} />}
      <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/30 to-black/90" />

      <button
        className="absolute inset-0 z-0 cursor-pointer"
        aria-label={playing ? "Pause" : "Lecture"}
        onClick={() => {
          // a double click likes: wait to see whether a second click follows
          clearTimeout(clickTimer.current);
          clickTimer.current = setTimeout(onToggle, 230);
        }}
        onContextMenu={(event) => trackMenu(event, track)}
        onDoubleClick={() => {
          clearTimeout(clickTimer.current);
          onLike();
        }}
      />

      <div className="pointer-events-none relative flex h-full flex-col items-center px-[9%] pt-[8%]">
        <div className="relative w-[78%]">
          <Artwork src={art} className="rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.6)] ring-1 ring-white/10" />
          {active && !playing && (
            <span className="absolute inset-0 flex items-center justify-center">
              <span className="rounded-full bg-black/50 p-5 backdrop-blur">
                <Play className="h-10 w-10 fill-white text-white" />
              </span>
            </span>
          )}
          <AnimatePresence>
            {heart > 0 && (
              <motion.span
                key={heart}
                className="absolute inset-0 flex items-center justify-center"
                initial={{ scale: 0.3, opacity: 0 }}
                animate={{ scale: [0.3, 1.25, 1], opacity: [0, 1, 1] }}
                exit={{ scale: 1.6, opacity: 0 }}
                transition={{ duration: 0.45 }}
              >
                <Heart className="h-28 w-28 fill-red-500 text-red-500 drop-shadow-[0_8px_30px_rgba(220,38,38,0.7)]" />
              </motion.span>
            )}
          </AnimatePresence>
        </div>
        {active && <Caption item={item} />}
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 px-6 pb-6">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white/85 backdrop-blur">
          <SourceIcon className="h-3.5 w-3.5 text-red-400" />
          {item.reason}
        </span>
        <h2 className="mt-3 truncate font-display text-3xl tracking-tight">{track.name}</h2>
        <div className="pointer-events-auto">
          <ArtistLinks track={track} className="text-base text-white/75" />
        </div>
        {track.albumId && (
          <button className="pointer-events-auto mt-0.5 block max-w-full truncate text-xs text-white/45 hover:text-white hover:underline" onClick={() => navigate({ name: "album", id: track.albumId! })}>
            {track.albumName}
          </button>
        )}
        {active && <Progress durationMs={track.durationMs} />}
      </div>
    </div>
  );
}

/** The lyric line of the moment under the artwork, as captions on a video. */
function Caption({ item }: { item: FlowItem }) {
  const { lines } = useLyrics(item.track);
  const position = usePosition();
  const playingThis = useStore(playback, (s) => s.track?.uri === item.track.uri);
  const index = playingThis ? activeLineIndex(lines, position + 250) : -1;
  const text = index >= 0 ? lines[index]?.text : "";
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center pb-28">
      <AnimatePresence mode="wait">
        {text && (
          <motion.p
            key={`${index}-${text}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
            className="line-clamp-2 text-center text-xl font-bold leading-snug text-white [text-shadow:0_2px_12px_rgba(0,0,0,0.8)]"
          >
            {text}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}

function Progress({ durationMs }: { durationMs: number }) {
  const position = usePosition();
  const playingDuration = useStore(playback, (s) => s.durationMs);
  const total = playingDuration || durationMs;
  const percent = total ? Math.min(100, (position / total) * 100) : 0;
  return (
    <div className="mt-4 h-1 overflow-hidden rounded-full bg-white/15">
      <div className="h-full accent-bg transition-[width] duration-300 ease-linear" style={{ width: `${percent}%` }} />
    </div>
  );
}

function Action({ label, onClick, children, pressed }: { label: string; onClick: () => void; children: ReactNode; pressed?: boolean }) {
  return (
    <button onClick={onClick} className="group flex flex-col items-center gap-1" aria-label={label} aria-pressed={pressed} title={label}>
      <span className="rounded-full bg-white/10 p-3.5 backdrop-blur transition-colors group-hover:bg-white/20">{children}</span>
      <span className="text-[11px] font-medium text-white/70">{label}</span>
    </button>
  );
}

function Actions({ item, onLike, onNotForMe }: { item: FlowItem; onLike: () => void; onNotForMe: () => void }) {
  const { track } = item;
  const [sharing, setSharing] = useState(false);

  const share = () => {
    setSharing(true);
    void shareStory(track).finally(() => setSharing(false));
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <Action label={item.saved ? "Liké" : "J'aime"} onClick={onLike} pressed={item.saved}>
        <Heart className={cn("h-6 w-6", item.saved && "fill-red-500 text-red-500")} />
      </Action>
      <Action label="Playlist" onClick={() => ui.set({ playlistDialog: { uris: [track.uri] } })}>
        <ListPlus className="h-6 w-6" />
      </Action>
      <Action
        label="À suivre"
        onClick={() =>
          run(async () => {
            await engine.addToQueue(track.uri);
            notify(`« ${track.name} » ajouté à la file d'attente`);
          })
        }
      >
        <ListEnd className="h-6 w-6" />
      </Action>
      {track.artistIds[0] && (
        <Action label="Artiste" onClick={() => navigate({ name: "artist", id: track.artistIds[0] })}>
          <Mic2 className="h-6 w-6" />
        </Action>
      )}
      <Action label="Story" onClick={share}>
        {sharing ? <Loader2 className="h-6 w-6 animate-spin" /> : <Share2 className="h-6 w-6" />}
      </Action>
      <Action label="Pas pour moi" onClick={onNotForMe}>
        <Ban className="h-6 w-6" />
      </Action>
    </div>
  );
}
