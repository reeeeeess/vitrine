import { useEffect, useMemo, useState } from "react";
import type { LyricsResult } from "../global";
import { errorMessage } from "../lib/format";
import type { LyricLine } from "../lib/lrc";
import { lyricsPrefs, lyricsQuery, timedLines } from "../lib/lyricsPrefs";
import { useStore } from "../lib/store";
import type { Track } from "../lib/types";

export type LyricsState = { status: "loading" } | { status: "done"; result: LyricsResult | null } | { status: "error"; message: string };

/**
 * The track's lyrics from the best source that has them (or the one the person chose for it), and its
 * timed lines, moved by the offset set for the song.
 */
export function useLyrics(track: Track | undefined): { state: LyricsState; lines: LyricLine[] } {
  const [state, setState] = useState<LyricsState>({ status: "loading" });
  const source = useStore(lyricsPrefs, (s) => (track ? s.songs[track.uri]?.source : undefined));
  const offsetMs = useStore(lyricsPrefs, (s) => (track ? (s.songs[track.uri]?.offsetMs ?? 0) : 0));
  const netease = useStore(lyricsPrefs, (s) => s.netease);

  useEffect(() => {
    if (!track) return;
    let current = true;
    setState({ status: "loading" });
    window.vitrine.lyrics
      .get(lyricsQuery(track))
      .then(
        (result) => current && setState({ status: "done", result }),
        (error: unknown) => current && setState({ status: "error", message: errorMessage(error) }),
      );
    return () => {
      current = false;
    };
    // the poll hands over a new Track object every few seconds: only a new song (or source) fetches again
  }, [track?.uri, source, netease]);

  const lines = useMemo(() => (state.status === "done" ? timedLines(state.result, offsetMs) : []), [state, offsetMs]);
  return { state, lines };
}
