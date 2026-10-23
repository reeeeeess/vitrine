import { cn } from "../lib/cn";
import { Artwork } from "./Artwork";

/**
 * The vinyl mode: the artwork as the label of a record turning at 33⅓ rpm while the music plays, slowing
 * to a stop on pause, with a tone arm that lifts away. Turning is done by CSS only (nothing redrawn).
 */
export function Vinyl({ src, paused }: { src?: string; paused: boolean }) {
  return (
    <div className="relative aspect-square w-full">
      <div
        className="vinyl absolute inset-[3%] rounded-full shadow-[0_30px_80px_rgba(0,0,0,0.7)]"
        style={{ animationPlayState: paused ? "paused" : "running" }}
        aria-hidden="true"
      >
        {/* grooves and a sheen */}
        <div className="absolute inset-0 rounded-full bg-[repeating-radial-gradient(circle_at_center,#0b0b0b_0px,#0b0b0b_2px,#161616_3px,#0b0b0b_4px)]" />
        <div className="absolute inset-0 rounded-full bg-[conic-gradient(from_30deg,transparent_0deg,rgb(255_255_255/0.10)_40deg,transparent_80deg,transparent_180deg,rgb(255_255_255/0.08)_220deg,transparent_260deg)]" />
        <div className="absolute inset-[31%] overflow-hidden rounded-full ring-4 ring-black/60">
          <Artwork src={src} round className="h-full w-full" />
        </div>
        <div className="absolute left-1/2 top-1/2 h-[3%] w-[3%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-neutral-300 ring-2 ring-black/70" />
      </div>
      {/* the tone arm: on the record while it plays, lifted on pause */}
      <svg
        viewBox="0 0 100 100"
        className={cn("absolute -right-[4%] -top-[2%] h-[62%] w-[30%] origin-[70%_10%] transition-transform duration-700 ease-out", paused ? "-rotate-[22deg]" : "rotate-0")}
        aria-hidden="true"
      >
        <circle cx="70" cy="10" r="9" fill="#d4d4d4" />
        <circle cx="70" cy="10" r="4" fill="#737373" />
        <path d="M70 10 L64 70 L46 92" stroke="#e5e5e5" strokeWidth="4" fill="none" strokeLinecap="round" />
        <rect x="36" y="86" width="16" height="10" rx="2" fill="#a3a3a3" transform="rotate(35 44 91)" />
      </svg>
    </div>
  );
}
