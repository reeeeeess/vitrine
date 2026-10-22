import { Maximize2 } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "../lib/cn";
import { artworkColor, rgbVar } from "../lib/palette";
import { useStore } from "../lib/store";
import { setMini } from "../lib/ui";
import { playback } from "../player/engine";
import { Artwork } from "./Artwork";
import { LikeButton } from "./LikeButton";
import { ProgressBar, TransportControls } from "./NowPlayingBar";

/** The window shrunk to a small player that stays above the others. */
export function MiniPlayer() {
  const mac = window.vitrine.platform === "darwin";
  const track = useStore(playback, (s) => s.track);
  const [color, setColor] = useState("220 38 38");
  useEffect(() => {
    void artworkColor(track?.image).then((rgb) => setColor(rgbVar(rgb)));
  }, [track?.image]);

  return (
    <div className="drag relative flex h-full flex-col overflow-hidden bg-black">
      {track?.image && <img src={track.image} alt="" aria-hidden="true" className="absolute inset-[-20%] h-[140%] w-[140%] object-cover opacity-40 blur-3xl" />}
      <div className="absolute inset-0" style={{ background: `radial-gradient(90% 70% at 50% 25%, rgb(${color} / 0.45), transparent 70%)` }} />
      <div className="absolute inset-0 bg-black/40" />

      {/* Windows draws its window buttons over the top right, macOS its traffic lights over the top left */}
      <div className={cn("relative flex min-h-0 flex-1 flex-col px-5 pb-4", mac ? "pt-11" : "pt-16")}>
        <button
          onClick={() => void setMini(false)}
          className={cn("absolute top-3", mac ? "right-3" : "left-3", "rounded-full border border-white/15 bg-white/10 p-2 text-white/80 backdrop-blur transition-colors hover:bg-white/20 hover:text-white")}
          aria-label="Agrandir"
          title="Revenir à la fenêtre complète"
        >
          <Maximize2 className="h-4 w-4" />
        </button>
        <div className="mx-auto aspect-square w-full max-w-[220px] min-h-0">
          <Artwork src={track?.image} className="rounded-2xl shadow-2xl shadow-black/60 ring-1 ring-white/10" />
        </div>
        <div className="mt-4 flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate font-display text-lg leading-tight">{track?.name ?? "Rien en cours"}</p>
            <p className="truncate text-sm text-white/60">{track?.artists.join(", ") ?? ""}</p>
          </div>
          {track && <LikeButton track={track} />}
        </div>
        <ProgressBar className="mt-2" />
        <div className="mt-2">
          <TransportControls />
        </div>
      </div>
    </div>
  );
}
