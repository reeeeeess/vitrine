import { Heart } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "../lib/cn";
import { errorMessage } from "../lib/format";
import * as api from "../lib/spotify";
import type { Track } from "../lib/types";
import { notify } from "../lib/ui";

/** Adds the track to Liked Songs, or takes it out. */
export function LikeButton({ track, size = "h-4 w-4" }: { track: Track; size?: string }) {
  const [saved, setSaved] = useState<boolean>();
  const id = track.uri.startsWith("spotify:track:") ? track.id : undefined;

  useEffect(() => {
    setSaved(undefined);
    if (!id) return;
    let current = true;
    api.areSaved([id]).then(
      ([value]) => current && setSaved(value ?? false),
      () => current && setSaved(false),
    );
    return () => {
      current = false;
    };
  }, [id]);

  if (!id) return null;
  const toggle = async () => {
    const next = !saved;
    setSaved(next);
    try {
      await (next ? api.saveTrack(id) : api.removeTrack(id));
      notify(next ? "Ajouté aux titres likés" : "Retiré des titres likés");
    } catch (error) {
      setSaved(!next);
      notify(errorMessage(error), "error");
    }
  };
  return (
    <button
      onClick={() => void toggle()}
      disabled={saved === undefined}
      className={cn("rounded-full p-2 transition-colors disabled:opacity-40", saved ? "text-red-500 hover:text-red-400" : "text-gray-400 hover:text-white")}
      aria-label={saved ? "Retirer des titres likés" : "Ajouter aux titres likés"}
      aria-pressed={saved}
      title={saved ? "Retirer des titres likés" : "Ajouter aux titres likés"}
    >
      <Heart className={cn(size, saved && "fill-current")} />
    </button>
  );
}
