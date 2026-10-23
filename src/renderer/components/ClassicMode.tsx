import { motion } from "framer-motion";
import { ChevronRight, Pause, Play } from "lucide-react";
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { angleDelta, angleOf, clampIndex, wheelSteps, zoneOf } from "../lib/classic";
import { cn } from "../lib/cn";
import { errorMessage, formatTime } from "../lib/format";
import * as api from "../lib/spotify";
import { createStore, useStore } from "../lib/store";
import { notify } from "../lib/ui";
import * as engine from "../player/engine";
import { playback } from "../player/engine";
import { usePosition } from "../player/hooks";
import { Artwork } from "./Artwork";

export const classic = createStore({ open: false });
export const openClassic = () => classic.set({ open: true });
const close = () => classic.set({ open: false });

interface Item {
  label: string;
  /** opens a submenu */
  open?: () => Promise<Screen>;
  run?: () => void | Promise<void>;
}

type Screen = { kind: "menu"; title: string; items: Item[]; index: number } | { kind: "now" };

const nowPlaying: Screen = { kind: "now" };

function rootMenu(): Screen {
  return {
    kind: "menu",
    title: "Vitrine",
    index: 0,
    items: [
      { label: "À l'écoute", open: async () => nowPlaying },
      {
        label: "Playlists",
        open: async () => ({
          kind: "menu",
          title: "Playlists",
          index: 0,
          items: (await api.myPlaylists()).map((playlist) => ({ label: playlist.name, run: () => engine.playContext(playlist.uri) })),
        }),
      },
      {
        label: "Titres likés",
        open: async () => {
          const { tracks } = await api.likedPage(0, 50);
          return {
            kind: "menu",
            title: "Titres likés",
            index: 0,
            items: tracks.map((track, i) => ({ label: `${track.name} — ${track.artists[0] ?? ""}`, run: () => engine.playTracks(tracks.map((t) => t.uri), i) })),
          };
        },
      },
      {
        label: "Lecture aléatoire",
        run: async () => engine.playShuffled((await api.likedPage(0, 50)).tracks.map((track) => track.uri)),
      },
      { label: "Quitter Vitrine Classic", run: close },
    ],
  };
}

/** The screen: a menu with its blue selection, or "Now Playing". */
function ScreenView({ screen }: { screen: Screen }) {
  const track = useStore(playback, (s) => s.track);
  const paused = useStore(playback, (s) => s.paused);
  const duration = useStore(playback, (s) => s.durationMs);
  const position = usePosition();
  const list = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (screen.kind === "menu") list.current?.children[screen.index]?.scrollIntoView({ block: "nearest" });
  }, [screen]);
  const title = screen.kind === "menu" ? screen.title : "À l'écoute";
  return (
    <div className="flex h-full flex-col bg-gradient-to-b from-white to-[#dfe6ee] font-sans text-[13px] text-black">
      <div className="flex h-6 items-center justify-between border-b border-black/20 bg-gradient-to-b from-[#f7f9fb] to-[#c9d3dd] px-2 text-[11px] font-semibold">
        {paused ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3 fill-current" />}
        <span className="truncate px-2">{title}</span>
        <span className="flex h-2.5 w-5 items-center rounded-[2px] border border-black/60 p-[1px]">
          <span className="h-full w-3/4 bg-emerald-500" />
        </span>
      </div>
      {screen.kind === "menu" ? (
        <div ref={list} className="scrollbar-hide flex-1 overflow-y-auto">
          {screen.items.map((item, i) => (
            <div key={`${item.label}-${i}`} className={cn("flex h-[26px] items-center justify-between px-2", i === screen.index && "bg-gradient-to-b from-[#5aa0f0] to-[#1d62c6] text-white")}>
              <span className="truncate font-semibold">{item.label}</span>
              {item.open && <ChevronRight className="h-3.5 w-3.5 shrink-0" />}
            </div>
          ))}
        </div>
      ) : track ? (
        <div className="flex flex-1 flex-col justify-between p-3">
          <div className="flex gap-3">
            <Artwork src={track.image} className="h-[104px] w-[104px] shrink-0 rounded-sm shadow-md" />
            <div className="min-w-0 pt-1">
              <p className="truncate text-sm font-bold">{track.name}</p>
              <p className="truncate text-xs">{track.artists.join(", ")}</p>
              <p className="truncate text-xs text-black/60">{track.albumName}</p>
            </div>
          </div>
          <div>
            <div className="relative h-2 rounded-full border border-black/40 bg-gradient-to-b from-white to-[#cfd8e2]">
              <div className="h-full rounded-full bg-gradient-to-b from-[#7fb5f5] to-[#1d62c6]" style={{ width: `${duration ? (position / duration) * 100 : 0}%` }} />
              <span className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rotate-45 border border-black/50 bg-white" style={{ left: `${duration ? (position / duration) * 100 : 0}%` }} />
            </div>
            <div className="mt-1 flex justify-between text-[11px] font-semibold tabular-nums">
              <span>{formatTime(position)}</span>
              <span>-{formatTime(Math.max(0, duration - position))}</span>
            </div>
          </div>
        </div>
      ) : (
        <p className="p-3 text-xs">Rien en cours de lecture.</p>
      )}
    </div>
  );
}

/**
 * Vitrine Classic: the 2000s music player look, viral on TikTok (RetroPod, Rewound), with a click
 * wheel: turn to scroll, MENU to go back, the centre to choose, ⏮ ⏯ ⏭ on the ring. Turning on
 * "À l'écoute" sets the volume. (No brand of anyone else's: a look, not a copy.)
 */
export function ClassicMode() {
  const open = useStore(classic, (s) => s.open);
  const [stack, setStack] = useState<Screen[]>([rootMenu()]);
  const [busy, setBusy] = useState(false);
  const wheel = useRef<HTMLDivElement>(null);
  const turn = useRef<{ angle: number; rest: number; moved: number } | null>(null);
  const screen = stack[stack.length - 1];

  useEffect(() => {
    if (open) setStack([rootMenu()]);
  }, [open]);

  const move = (steps: number) => {
    if (!steps) return;
    if (screen.kind === "now") {
      engine.setVolume(playback.get().volume + steps * 0.02);
      return;
    }
    setStack((all) => [...all.slice(0, -1), { ...screen, index: clampIndex(screen.index + steps, screen.items.length) }]);
  };
  const back = () => (stack.length > 1 ? setStack((all) => all.slice(0, -1)) : close());
  const select = async () => {
    if (screen.kind !== "menu" || busy) return;
    const item = screen.items[screen.index];
    if (!item) return;
    try {
      setBusy(true);
      if (item.open) {
        const next = await item.open();
        setStack((all) => [...all, next]);
      } else if (item.run) {
        await item.run();
        if (classic.get().open) setStack((all) => [...all, nowPlaying]);
      }
    } catch (error) {
      notify(errorMessage(error), "error");
    } finally {
      setBusy(false);
    }
  };
  const press = (zone: ReturnType<typeof zoneOf>) => {
    if (zone === "menu") back();
    else if (zone === "next") void engine.next().catch(() => undefined);
    else if (zone === "previous") void engine.previous().catch(() => undefined);
    else void engine.togglePlay().catch(() => undefined);
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowDown") move(1);
      else if (event.key === "ArrowUp") move(-1);
      else if (event.key === "Enter") void select();
      else if (event.key === "Escape" || event.key === "Backspace") back();
      else return;
      event.preventDefault();
      event.stopPropagation();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  });

  if (!open) return null;

  const centre = () => {
    const box = wheel.current!.getBoundingClientRect();
    return [box.left + box.width / 2, box.top + box.height / 2] as const;
  };
  const onDown = (event: ReactPointerEvent) => {
    const [cx, cy] = centre();
    turn.current = { angle: angleOf(event.clientX, event.clientY, cx, cy), rest: 0, moved: 0 };
    (event.target as Element).setPointerCapture(event.pointerId);
  };
  const onMove = (event: ReactPointerEvent) => {
    if (!turn.current) return;
    const [cx, cy] = centre();
    const angle = angleOf(event.clientX, event.clientY, cx, cy);
    const delta = angleDelta(turn.current.angle, angle);
    const { steps, rest } = wheelSteps(turn.current.rest, delta);
    turn.current = { angle, rest, moved: turn.current.moved + Math.abs(delta) };
    move(steps);
  };
  const onUp = (event: ReactPointerEvent) => {
    const state = turn.current;
    turn.current = null;
    // barely turned: it was a press on one of the four buttons
    if (state && state.moved < 8) {
      const [cx, cy] = centre();
      press(zoneOf(angleOf(event.clientX, event.clientY, cx, cy)));
    }
  };

  return (
    <motion.div className="fixed inset-0 z-[67] flex items-center justify-center bg-black/80 backdrop-blur-md" initial={{ opacity: 0 }} animate={{ opacity: 1 }} onMouseDown={(event) => event.target === event.currentTarget && close()}>
      <motion.div
        className="relative flex h-[600px] w-[360px] flex-col items-center rounded-[44px] bg-gradient-to-b from-[#f4f4f4] to-[#d6d6d6] p-6 shadow-[0_40px_120px_rgba(0,0,0,0.8),inset_0_2px_0_rgba(255,255,255,0.9)]"
        initial={{ y: 40, rotate: -2 }}
        animate={{ y: 0, rotate: 0 }}
        transition={{ type: "spring", stiffness: 160, damping: 18 }}
        onWheel={(event) => move(Math.sign(event.deltaY))}
      >
        <div className="h-[234px] w-[312px] overflow-hidden rounded-lg border-[3px] border-[#3a3a3a] bg-black shadow-inner">
          <ScreenView screen={screen} />
        </div>
        {/* the click wheel */}
        <div
          ref={wheel}
          className="relative mt-10 h-[236px] w-[236px] cursor-grab touch-none select-none rounded-full bg-gradient-to-b from-white to-[#e9e9e9] shadow-[inset_0_2px_6px_rgba(0,0,0,0.15),0_2px_0_rgba(255,255,255,0.8)] active:cursor-grabbing"
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          role="slider"
          aria-label="Molette : tourner pour défiler"
          aria-valuenow={screen.kind === "menu" ? screen.index : 0}
        >
          <span className="pointer-events-none absolute left-1/2 top-4 -translate-x-1/2 text-[13px] font-bold tracking-widest text-[#9a9a9a]">MENU</span>
          <span className="pointer-events-none absolute right-5 top-1/2 -translate-y-1/2 text-[13px] font-bold text-[#9a9a9a]">▶▶|</span>
          <span className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-[13px] font-bold text-[#9a9a9a]">|◀◀</span>
          <span className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 text-[13px] font-bold text-[#9a9a9a]">▶❚❚</span>
          <button
            className="absolute left-1/2 top-1/2 h-[92px] w-[92px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-b from-[#fafafa] to-[#dcdcdc] shadow-[0_1px_3px_rgba(0,0,0,0.3),inset_0_1px_0_white] active:from-[#e6e6e6]"
            onPointerDown={(event) => event.stopPropagation()}
            onPointerUp={(event) => event.stopPropagation()}
            onClick={() => void select()}
            aria-label="Choisir"
          />
        </div>
        <p className="absolute -bottom-10 whitespace-nowrap text-xs text-white/50">Tournez la molette (ou la molette de la souris) · Échap pour revenir</p>
      </motion.div>
    </motion.div>
  );
}
