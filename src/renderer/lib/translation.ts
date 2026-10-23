// Lyrics translated under each line (B7): on or off for every song, kept in localStorage; the work is done
// by the main process (electron/translate.ts), which keeps each song's translation on disk.
import { useEffect, useState } from "react";
import { errorMessage } from "./format";
import type { LyricLine } from "./lrc";
import { createStore } from "./store";

const KEY = "vitrine.translateLyrics";

function read(): boolean {
  try {
    return localStorage.getItem(KEY) === "on";
  } catch {
    return false;
  }
}

export const translating = createStore({ on: read() });

export function setTranslating(on: boolean): void {
  translating.set({ on });
  try {
    localStorage.setItem(KEY, on ? "on" : "off");
  } catch {
    // for this run only
  }
}

export type TranslationState = { status: "off" } | { status: "loading" } | { status: "done"; byLine: Map<string, string>; same: boolean } | { status: "error"; message: string };

/** The translation of each line's text, asked once per song while the switch is on. */
export function useTranslation(lines: LyricLine[], on: boolean): TranslationState {
  const [state, setState] = useState<TranslationState>({ status: "off" });
  const texts = lines.map((line) => line.text);
  const key = texts.join("\n");
  useEffect(() => {
    if (!on || texts.length === 0) {
      setState({ status: "off" });
      return;
    }
    let current = true;
    setState({ status: "loading" });
    window.vitrine.lyrics.translate(texts).then(
      (result) => {
        if (!current) return;
        const byLine = new Map<string, string>();
        texts.forEach((text, i) => result.lines[i] && byLine.set(text, result.lines[i]!));
        setState({ status: "done", byLine, same: result.same });
      },
      (error: unknown) => current && setState({ status: "error", message: errorMessage(error) }),
    );
    return () => {
      current = false;
    };
  }, [on, key]);
  return state;
}
