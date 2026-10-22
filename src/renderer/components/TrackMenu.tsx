import { AnimatePresence, motion } from "framer-motion";
import { Ban, Copy, Disc3, ExternalLink, Heart, HeartOff, Link2, ListEnd, ListPlus, Mic2, Play, Share2, SkipForward, Sparkles, Trash2, UserX, type LucideIcon } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import { cn } from "../lib/cn";
import { errorMessage } from "../lib/format";
import { hide } from "../lib/flow";
import { teach } from "../lib/flowTaste";
import * as api from "../lib/spotify";
import { createStore, useStore } from "../lib/store";
import { trashArtist, trashTrack } from "../lib/trash";
import type { Track } from "../lib/types";
import { navigate, notify, ui } from "../lib/ui";
import * as engine from "../player/engine";
import { shareStory } from "./StoryButton";

/** Where the track was right-clicked, for the actions that depend on it. */
export interface MenuContext {
  /** a playlist the person may edit: "Retirer de cette playlist" */
  playlist?: { id: string; ownerId?: string; collaborative?: boolean };
  onRemoved?: (uri: string) => void;
}

interface MenuState {
  x: number;
  y: number;
  track: Track;
  context: MenuContext;
}

const menu = createStore<{ open: MenuState | null }>({ open: null });

/** Opens the menu of a track where the mouse is (or under the element, from the keyboard). */
export function trackMenu(event: ReactMouseEvent | MouseEvent, track: Track, context: MenuContext = {}): void {
  if (!track.uri.startsWith("spotify:track:")) return;
  event.preventDefault();
  event.stopPropagation();
  let { clientX: x, clientY: y } = event;
  if (x === 0 && y === 0 && event.currentTarget instanceof Element) {
    const box = event.currentTarget.getBoundingClientRect();
    x = box.left + 24;
    y = box.bottom;
  }
  menu.set({ open: { x, y, track, context } });
}

const close = () => menu.set({ open: null });

const trackId = (track: Track) => track.uri.split(":")[2] ?? track.id;
export const trackLink = (track: Track) => `https://open.spotify.com/track/${trackId(track)}`;

interface Item {
  label: string;
  icon: LucideIcon;
  run: () => unknown;
  danger?: boolean;
}

function useItems(state: MenuState): Item[][] {
  const { track, context } = state;
  const [saved, setSaved] = useState<boolean>();
  const [canRemove, setCanRemove] = useState(false);

  useEffect(() => {
    let current = true;
    void api.areSaved([trackId(track)]).then(([value]) => current && setSaved(value ?? false), () => undefined);
    const playlist = context.playlist;
    if (playlist) {
      void api.me().then((me) => current && setCanRemove(playlist.collaborative === true || playlist.ownerId === me.id), () => undefined);
    }
    return () => {
      current = false;
    };
  }, [track.uri, context.playlist]);

  const attempt = (action: () => Promise<unknown>, done?: string) => () =>
    action().then(
      () => done && notify(done),
      (error: unknown) => notify(errorMessage(error), "error"),
    );

  const copy = (text: string, done: string) => attempt(() => window.vitrine.copy(text), done);

  return [
    [
      { label: "Lire", icon: Play, run: attempt(() => engine.playTracks([track.uri])) },
      { label: "Ajouter à la file d'attente", icon: ListEnd, run: attempt(() => engine.addToQueue(track.uri), `« ${track.name} » ajouté à la file`) },
      { label: "Lancer un Flow à partir de ce titre", icon: Sparkles, run: () => navigate({ name: "flow", seed: track }) },
    ],
    [
      { label: "Ajouter à une playlist…", icon: ListPlus, run: () => ui.set({ playlistDialog: { uris: [track.uri] } }) },
      saved
        ? { label: "Retirer des titres likés", icon: HeartOff, run: attempt(() => api.removeTrack(trackId(track)), "Retiré des titres likés") }
        : { label: "Ajouter aux titres likés", icon: Heart, run: attempt(() => api.saveTrack(trackId(track)), "Ajouté aux titres likés") },
      ...(canRemove && context.playlist
        ? [
            {
              label: "Retirer de cette playlist",
              icon: Trash2,
              danger: true,
              run: attempt(async () => {
                await api.removeFromPlaylist(context.playlist!.id, [track.uri]);
                context.onRemoved?.(track.uri);
              }, "Retiré de la playlist"),
            },
          ]
        : []),
    ],
    [
      ...track.artists.slice(0, 3).flatMap((name, index) =>
        track.artistIds[index] ? [{ label: track.artists.length > 1 ? `Artiste : ${name}` : "Aller à l'artiste", icon: Mic2, run: () => navigate({ name: "artist", id: track.artistIds[index] }) }] : [],
      ),
      ...(track.albumId ? [{ label: "Aller à l'album", icon: Disc3, run: () => navigate({ name: "album", id: track.albumId! }) }] : []),
    ],
    [
      { label: "Copier le lien du titre", icon: Link2, run: copy(trackLink(track), "Lien copié") },
      { label: "Copier « titre — artiste »", icon: Copy, run: copy(`${track.name} — ${track.artists.join(", ")}`, "Copié") },
      { label: "Créer une story", icon: Share2, run: () => void shareStory(track) },
      { label: "Ouvrir dans l'appli Spotify", icon: ExternalLink, run: attempt(() => window.vitrine.openExternal(track.uri)) },
    ],
    [
      {
        label: "Ne plus me le proposer dans Flow",
        icon: Ban,
        run: () => {
          hide(track);
          teach(track, "notForMe");
          notify("Ce titre ne reviendra plus dans Flow.");
        },
      },
      {
        label: "Corbeille : sauter ce titre partout",
        icon: SkipForward,
        run: () => {
          trashTrack(track);
          notify(`« ${track.name} » sera sauté à chaque fois (Réglages → Corbeille pour le restaurer).`);
        },
      },
      ...(track.artistIds[0]
        ? [
            {
              label: `Corbeille : sauter ${track.artists[0]} partout`,
              icon: UserX,
              danger: true,
              run: () => {
                trashArtist(track.artistIds[0], track.artists[0] ?? "");
                notify(`${track.artists[0]} sera sauté à chaque fois (Réglages → Corbeille pour le restaurer).`);
              },
            },
          ]
        : []),
    ],
  ].filter((group) => group.length > 0);
}

function MenuPanel({ state }: { state: MenuState }) {
  const groups = useItems(state);
  const panel = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ left: state.x, top: state.y });

  // kept inside the window: opened near an edge, it opens the other way
  useLayoutEffect(() => {
    const box = panel.current?.getBoundingClientRect();
    if (!box) return;
    const left = state.x + box.width > window.innerWidth - 8 ? Math.max(8, state.x - box.width) : state.x;
    const top = state.y + box.height > window.innerHeight - 8 ? Math.max(8, window.innerHeight - box.height - 8) : state.y;
    setPosition({ left, top });
    panel.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus();
  }, [state, groups.length]);

  const onKey = (event: React.KeyboardEvent) => {
    const items = [...(panel.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? [])];
    const index = items.indexOf(document.activeElement as HTMLButtonElement);
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const next = (index + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
      items[next]?.focus();
    } else if (event.key === "Escape" || event.key === "Tab") {
      event.preventDefault();
      close();
    }
  };

  return (
    <motion.div
      ref={panel}
      role="menu"
      aria-label={`Actions pour ${state.track.name}`}
      onKeyDown={onKey}
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.12 }}
      style={position}
      className="glass fixed z-[70] w-80 origin-top-left rounded-2xl p-1.5 text-sm shadow-[0_20px_60px_rgba(0,0,0,0.6)]"
    >
      <div className="truncate px-3 pb-1.5 pt-1 text-xs text-gray-400">
        {state.track.name} · {state.track.artists.join(", ")}
      </div>
      {groups.map((group, g) => (
        <div key={g} className={cn(g > 0 && "mt-1 border-t border-white/10 pt-1")}>
          {group.map((item) => (
            <button
              key={item.label}
              role="menuitem"
              onClick={() => {
                close();
                void item.run();
              }}
              className={cn(
                "flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left outline-none transition-colors hover:bg-white/10 focus-visible:bg-white/10",
                item.danger ? "text-red-400" : "text-white/90",
              )}
            >
              <item.icon className="h-4 w-4 shrink-0 opacity-80" />
              <span className="truncate">{item.label}</span>
            </button>
          ))}
        </div>
      ))}
    </motion.div>
  );
}

/** Mounted once, at the root: shows the menu a right click opened. */
export function TrackMenuHost() {
  const open = useStore(menu, (s) => s.open);
  useEffect(() => {
    if (!open) return;
    const onScroll = () => close();
    window.addEventListener("resize", close);
    window.addEventListener("blur", close);
    document.addEventListener("scroll", onScroll, true);
    return () => {
      window.removeEventListener("resize", close);
      window.removeEventListener("blur", close);
      document.removeEventListener("scroll", onScroll, true);
    };
  }, [open]);
  return (
    <AnimatePresence>
      {open && (
        <div
          className="fixed inset-0 z-[69]"
          onMouseDown={(event) => event.target === event.currentTarget && close()}
          onContextMenu={(event) => {
            event.preventDefault();
            close();
          }}
        >
          <MenuPanel key={`${open.track.uri}-${open.x}-${open.y}`} state={open} />
        </div>
      )}
    </AnimatePresence>
  );
}
