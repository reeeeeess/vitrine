import { useEffect, useMemo, useState } from "react";
import type { LyricsResult } from "../global";
import { errorMessage } from "../lib/format";
import { parseLrc, type LyricLine } from "../lib/lrc";
import type { Track } from "../lib/types";

export type LyricsState = { status: "loading" } | { status: "done"; result: LyricsResult | null } | { status: "error"; message: string };

/** The track's lyrics from LRCLIB, and its timed lines when they are synced. */
export function useLyrics(track: Track | undefined): { state: LyricsState; lines: LyricLine[] } {
  const [state, setState] = useState<LyricsState>({ status: "loading" });

  useEffect(() => {
    if (!track) return;
    let current = true;
    setState({ status: "loading" });
    window.vitrine.lyrics
      .get({ track: track.name, artist: track.artists[0] ?? "", album: track.albumName, durationMs: track.durationMs })
      .then(
        (result) => current && setState({ status: "done", result }),
        (error: unknown) => current && setState({ status: "error", message: errorMessage(error) }),
      );
    return () => {
      current = false;
    };
    // the poll hands over a new Track object every few seconds: only a new song fetches again
  }, [track?.uri]);

  const lines = useMemo(() => (state.status === "done" && state.result?.synced ? parseLrc(state.result.synced) : []), [state]);
  return { state, lines };
}
