import { ExternalLink, Link2, Pin as PinIcon, PinOff, Play } from "lucide-react";
import type { MouseEvent as ReactMouseEvent } from "react";
import type { Pin } from "../global";
import { cn } from "../lib/cn";
import { isPinned, pins, togglePin } from "../lib/pins";
import { useStore } from "../lib/store";
import { navigate, notify } from "../lib/ui";
import * as engine from "../player/engine";
import { Artwork } from "./Artwork";
import { run } from "./NowPlayingBar";
import { openMenu } from "./TrackMenu";

const open = (pin: Pin) => {
  const id = pin.uri.split(":")[2];
  navigate(pin.kind === "artist" ? { name: "artist", id } : pin.kind === "album" ? { name: "album", id } : { name: "playlist", id });
};

/** "Épingler" on a page's header. */
export function PinButton({ pin }: { pin: Pin }) {
  const pinned = useStore(pins, (s) => s.list.some((item) => item.uri === pin.uri));
  return (
    <button
      onClick={() => void togglePin(pin)}
      className={cn("btn-ghost", pinned && "border-red-500/50 text-red-300")}
      aria-pressed={pinned}
      title={pinned ? "Retirer des épingles" : "Épingler en haut de la bibliothèque, dans la zone de notification et la barre des tâches"}
    >
      {pinned ? <PinOff className="h-5 w-5" /> : <PinIcon className="h-5 w-5" />}
      {pinned ? "Épinglé" : "Épingler"}
    </button>
  );
}

/** The right-click menu of a playlist, an album or an artist. */
export function collectionMenu(event: ReactMouseEvent, pin: Pin): void {
  const link = `https://open.spotify.com/${pin.kind}/${pin.uri.split(":")[2]}`;
  openMenu(event, pin.name, [
    [
      { label: "Lire", icon: Play, run: () => run(() => engine.playContext(pin.uri)) },
      { label: "Ouvrir", icon: ExternalLink, run: () => open(pin) },
    ],
    [{ label: isPinned(pin.uri) ? "Retirer des épingles" : "Épingler", icon: isPinned(pin.uri) ? PinOff : PinIcon, run: () => togglePin(pin) }],
    [
      {
        label: "Copier le lien",
        icon: Link2,
        run: () =>
          window.vitrine
            .copy(link)
            .then(() => notify("Lien copié"))
            .catch(() => undefined),
      },
      { label: "Ouvrir dans l'appli Spotify", icon: ExternalLink, run: () => window.vitrine.openExternal(pin.uri) },
    ],
  ]);
}

/** The pinned ones, in big tiles at the top of the library and the home page. */
export function PinnedRow() {
  const list = useStore(pins, (s) => s.list);
  if (list.length === 0) return null;
  return (
    <section className="mb-8">
      <span className="kicker font-mono font-medium text-red-500">ÉPINGLÉS</span>
      <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-3">
        {list.map((pin) => (
          <div
            key={pin.uri}
            className="group relative flex cursor-pointer items-center gap-3 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] p-2 pr-3 transition-colors hover:bg-white/[0.09]"
            onClick={() => open(pin)}
            onContextMenu={(event) => collectionMenu(event, pin)}
          >
            <Artwork src={pin.image} round={pin.kind === "artist"} className="h-14 w-14 shrink-0 rounded-xl" />
            <span translate="no" className="min-w-0 flex-1 truncate text-sm font-semibold">{pin.name}</span>
            <button
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full accent-bg opacity-0 shadow-lg transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
              onClick={(event) => {
                event.stopPropagation();
                run(() => engine.playContext(pin.uri));
              }}
              aria-label={`Lire ${pin.name}`}
            >
              <Play className="ml-0.5 h-4 w-4 fill-current" />
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
