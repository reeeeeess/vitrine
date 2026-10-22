import { Heart } from "lucide-react";
import { cn } from "../lib/cn";

/** The cover of Liked Songs, which Spotify gives no artwork: a heart on the theme's accent. */
export function LikedCover({ className }: { className?: string }) {
  return (
    <div className={cn("accent-bg flex aspect-square w-full items-center justify-center rounded-lg transition-transform duration-300 group-hover:scale-105", className)} aria-hidden="true">
      <Heart className="h-1/3 w-1/3 fill-current drop-shadow-lg" />
    </div>
  );
}
