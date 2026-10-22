import { Play } from "lucide-react";
import { useState, type CSSProperties, type ReactNode } from "react";
import { cn } from "../lib/cn";
import { artworkColor, rgbVar } from "../lib/palette";
import { Artwork } from "./Artwork";

interface MediaCardProps {
  title: string;
  subtitle?: string;
  image?: string;
  /** drawn instead of the artwork, for collections that have none (Liked Songs) */
  cover?: ReactNode;
  round?: boolean;
  index?: number;
  onOpen?: () => void;
  onPlay?: () => void;
}

/** A square artwork card that takes on the artwork's colour when hovered. */
export function MediaCard({ title, subtitle, image, cover, round, index = 0, onOpen, onPlay }: MediaCardProps) {
  const [color, setColor] = useState<string>();
  const warm = () => {
    if (!color) void artworkColor(image).then((rgb) => setColor(rgbVar(rgb)));
  };
  return (
    <div
      className="media-card group relative w-[168px] shrink-0 animate-card-enter"
      style={{ ...(color ? { "--media-color": color } : {}), animationDelay: `${Math.min(index, 12) * 35}ms` } as CSSProperties}
      onMouseEnter={warm}
      onFocus={warm}
    >
      <div className="media-surface rounded-2xl border border-transparent p-2.5 transition-colors duration-200">
        <div className="relative cursor-pointer overflow-hidden rounded-lg" onClick={onOpen}>
          {cover ?? <Artwork src={image} round={round} className="transition-transform duration-300 group-hover:scale-105" />}
          {!round && <div className="media-wash pointer-events-none absolute inset-0" />}
          {onPlay && (
            <button
              className="absolute bottom-2 right-2 z-10 flex h-11 w-11 translate-y-2 items-center justify-center rounded-full accent-bg opacity-0 shadow-lg shadow-black/40 transition-all duration-200 hover:scale-105 hover:brightness-110 group-hover:translate-y-0 group-hover:opacity-100 focus-visible:translate-y-0 focus-visible:opacity-100"
              aria-label={`Lire ${title}`}
              onClick={(event) => {
                event.stopPropagation();
                onPlay();
              }}
            >
              <Play className="ml-0.5 h-5 w-5 fill-current" />
            </button>
          )}
        </div>
        <button className={cn("mt-2.5 block w-full text-left", round && "text-center")} onClick={onOpen}>
          <span className="block truncate text-sm font-semibold text-white">{title}</span>
          {subtitle && <span className="mt-0.5 block truncate text-xs text-gray-400 group-hover:text-white/80">{subtitle}</span>}
        </button>
      </div>
    </div>
  );
}
