import { Music } from "lucide-react";
import { useState } from "react";
import { cn } from "../lib/cn";

export function Artwork({ src, alt = "", round = false, className }: { src?: string; alt?: string; round?: boolean; className?: string }) {
  const [failed, setFailed] = useState(false);
  const shape = cn("aspect-square w-full object-cover bg-gray-800", round ? "rounded-full" : "rounded-lg", className);
  if (!src || failed) {
    return (
      <div className={cn(shape, "flex items-center justify-center text-gray-500")} aria-hidden="true">
        <Music className="h-8 w-8" />
      </div>
    );
  }
  return <img className={shape} src={src} alt={alt} loading="lazy" draggable={false} onError={() => setFailed(true)} />;
}

export function Spinner({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center justify-center py-10", className)} role="status" aria-label="Chargement">
      <span className="h-6 w-6 animate-spin rounded-full border-2 border-gray-600 border-t-red-600" />
    </div>
  );
}

export function ErrorNote({ text }: { text: string }) {
  return <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{text}</p>;
}
