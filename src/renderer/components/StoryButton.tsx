import { Loader2, Share2 } from "lucide-react";
import { useState } from "react";
import { cn } from "../lib/cn";
import { errorMessage } from "../lib/format";
import { activeLineIndex } from "../lib/lrc";
import { lyricsQuery, prefsOf, timedLines } from "../lib/lyricsPrefs";
import { saveBlob } from "../lib/recap";
import { renderStory, storyFileName } from "../lib/story";
import type { Track } from "../lib/types";
import { notify } from "../lib/ui";
import { currentPosition, playback } from "../player/engine";

/** The lyric line being sung, when this track is the one playing and its lyrics are synced. */
async function lyricNow(track: Track): Promise<string | undefined> {
  const state = playback.get();
  if (state.track?.uri !== track.uri) return undefined;
  const result = await window.vitrine.lyrics.get(lyricsQuery(track)).catch(() => null);
  const lines = timedLines(result, prefsOf(track.uri).offsetMs);
  return lines[activeLineIndex(lines, currentPosition(state) + 250)]?.text;
}

/** Draws the track's story and hands it to "Save as". */
export async function shareStory(track: Track): Promise<void> {
  try {
    saveBlob(await renderStory({ track, lyric: await lyricNow(track) }), storyFileName(track));
    notify("Story prête : choisissez où l'enregistrer, puis publiez-la sur TikTok ou Instagram.");
  } catch (error) {
    notify(errorMessage(error), "error");
  }
}

export function StoryButton({ track, className, size = "h-6 w-6" }: { track: Track; className?: string; size?: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      onClick={() => {
        setBusy(true);
        void shareStory(track).finally(() => setBusy(false));
      }}
      disabled={busy}
      className={cn("rounded-full p-2 text-gray-400 transition-colors hover:text-white", className)}
      aria-label="Partager en story"
      title="Partager en story (TikTok, Instagram)"
    >
      {busy ? <Loader2 className={cn(size, "animate-spin")} /> : <Share2 className={size} />}
    </button>
  );
}
