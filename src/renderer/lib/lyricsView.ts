// How synced lyrics are staged, after Apple Music: dots that fill during the silences, backing vocals
// (in parentheses) smaller under their line, each word lighting up as it is sung, and lines farther from
// the sung one blurrier and smaller.
import type { LyricLine } from "./lrc";

/** a silence this long, or longer, gets its dots */
const GAP_MS = 5000;
/** before the first line, a shorter wait is enough */
const INTRO_MS = 3500;
/** without a time per word, a word is taken to last this long… */
const WORD_MS = 380;
/** …and a line at least this long, unless the next one comes sooner */
const LINE_MIN_MS = 1800;

export interface SungWord {
  text: string;
  startMs: number;
  endMs: number;
  /** no space before the next word (a syllable) */
  glue?: boolean;
}

export type LyricEntry =
  | {
      kind: "line";
      timeMs: number;
      endMs: number;
      main: string;
      backing: string;
      words: SungWord[];
      /** the backing vocals' own times, when the file has them (TTML) */
      backingWords?: SungWord[];
      /** a second voice of a duet, on the right */
      side?: "right";
    }
  | { kind: "gap"; timeMs: number; endMs: number };

const sungWords = (words: NonNullable<LyricLine["words"]>, lineEnd: number): SungWord[] =>
  words.map((word, index) => ({ text: word.text, startMs: word.timeMs, endMs: word.endMs ?? words[index + 1]?.timeMs ?? lineEnd, ...(word.glue ? { glue: true } : {}) }));

/** parentheses that are part of the title or the credits, not backing vocals */
const NOT_BACKING = /^(feat|ft|prod|remix|live|version|intro|outro|refrain|chorus|x\d)/i;

/** "I'm on my way (on my way)" → the sung line, and the backing vocals apart. */
export function splitBacking(text: string): { main: string; backing: string } {
  const backing: string[] = [];
  const main = text
    .replace(/\(([^()]+)\)/g, (whole, inner: string) => {
      if (NOT_BACKING.test(inner.trim())) return whole;
      backing.push(inner.trim());
      return " ";
    })
    .replace(/\s{2,}/g, " ")
    .trim();
  return { main, backing: backing.join(" ") };
}

/** How long a line is sung: its words at an even pace, cut short by the next line. */
export function sungLength(line: LyricLine, nextMs: number | undefined): number {
  const words = Math.max(1, line.text.split(/\s+/).filter(Boolean).length);
  const until = (nextMs ?? line.timeMs + 4000) - line.timeMs;
  return Math.max(600, Math.min(until, Math.max(LINE_MIN_MS, words * WORD_MS)));
}

/**
 * When each word is sung: the file's own times when it has them, otherwise the line's sung length shared
 * between its words by their length (a long word takes longer to sing).
 */
export function wordTimes(line: LyricLine, text: string, endMs: number): SungWord[] {
  const parts = text.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return [];
  const timed = line.words?.filter((word) => word.text.trim());
  if (timed && timed.length === parts.length) {
    return timed.map((word, index) => ({ text: word.text, startMs: word.timeMs, endMs: timed[index + 1]?.timeMs ?? endMs }));
  }
  const weights = parts.map((part) => part.length + 1);
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  let start = line.timeMs;
  return parts.map((part, index) => {
    const length = ((endMs - line.timeMs) * weights[index]) / total;
    const word = { text: part, startMs: Math.round(start), endMs: Math.round(start + length) };
    start += length;
    return word;
  });
}

/** The lines as staged: backing vocals apart, words timed, and the silences of 5 s or more as dots. */
export function stageLyrics(lines: LyricLine[]): LyricEntry[] {
  const entries: LyricEntry[] = [];
  const sung = lines.filter((line) => line.text.trim() || line.backing?.text);
  if (sung.length && sung[0].timeMs >= INTRO_MS) entries.push({ kind: "gap", timeMs: 0, endMs: sung[0].timeMs });
  sung.forEach((line, index) => {
    const nextMs = sung[index + 1]?.timeMs;
    // TTML gives each word its end, who sings and the backing vocals: taken as they are
    if (line.endMs !== undefined && line.words?.length) {
      entries.push({
        kind: "line",
        timeMs: line.timeMs,
        endMs: line.endMs,
        main: line.text,
        backing: line.backing?.text ?? "",
        words: sungWords(line.words, line.endMs),
        ...(line.backing ? { backingWords: sungWords(line.backing.words, line.endMs) } : {}),
        ...(line.side ? { side: line.side } : {}),
      });
      if (nextMs !== undefined && nextMs - line.endMs >= GAP_MS) entries.push({ kind: "gap", timeMs: line.endMs, endMs: nextMs });
      return;
    }
    const { main, backing } = splitBacking(line.text);
    const endMs = line.timeMs + sungLength(line, nextMs);
    entries.push({ kind: "line", timeMs: line.timeMs, endMs, main, backing, words: wordTimes(line, main || backing, endMs) });
    if (nextMs !== undefined && nextMs - endMs >= GAP_MS) entries.push({ kind: "gap", timeMs: endMs, endMs: nextMs });
  });
  return entries;
}

/** 0 before the word, 1 once sung, in between while it is sung. */
export const fill = (startMs: number, endMs: number, positionMs: number) => Math.min(1, Math.max(0, (positionMs - startMs) / Math.max(1, endMs - startMs)));

/** How a line looks by its distance to the sung one: sharp and full size there, blurrier and smaller away. */
export function lineLook(distance: number): { blur: number; scale: number; opacity: number } {
  const away = Math.abs(distance);
  if (away === 0) return { blur: 0, scale: 1, opacity: 1 };
  return { blur: Math.min(away, 4) * 0.6, scale: 1 - Math.min(away, 5) * 0.02, opacity: Math.max(0.22, 0.62 - away * 0.08) };
}
