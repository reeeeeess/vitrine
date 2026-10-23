// LRC lyrics: "[mm:ss.xx] line", several timestamps per line allowed, with an optional
// [offset:±ms] tag that shifts every line. "Enhanced" LRC also times each word: "<mm:ss.xx> word".

export interface LyricWord {
  timeMs: number;
  text: string;
  /** when the word ends (TTML) */
  endMs?: number;
  /** no space before the next word: a syllable, or a character in Chinese or Japanese (TTML) */
  glue?: boolean;
}

export interface LyricLine {
  timeMs: number;
  text: string;
  /** when the file times each word (enhanced LRC, TTML) */
  words?: LyricWord[];
  /** when the line ends (TTML) */
  endMs?: number;
  /** a second voice of a duet, on the right (TTML) */
  side?: "right";
  /** backing vocals timed apart (TTML) */
  backing?: { text: string; words: LyricWord[] };
}

/** Every time moved by `offsetMs` (positive: the lyrics come later), as the person set it for the song. */
export function shiftLines(lines: LyricLine[], offsetMs: number): LyricLine[] {
  if (!offsetMs) return lines;
  const move = (ms: number) => Math.max(0, ms + offsetMs);
  const words = (list: LyricWord[]) => list.map((word) => ({ ...word, timeMs: move(word.timeMs), ...(word.endMs !== undefined ? { endMs: move(word.endMs) } : {}) }));
  return lines.map((line) => ({
    ...line,
    timeMs: move(line.timeMs),
    ...(line.endMs !== undefined ? { endMs: move(line.endMs) } : {}),
    ...(line.words ? { words: words(line.words) } : {}),
    ...(line.backing ? { backing: { ...line.backing, words: words(line.backing.words) } } : {}),
  }));
}

const TIMESTAMP = /\[(\d{1,3}):(\d{1,2})(?:[.:](\d{1,3}))?\]/g;
const OFFSET = /^\[offset:\s*([+-]?\d+)\s*\]$/i;
const WORD_STAMP = /<(\d{1,3}):(\d{1,2})(?:[.:](\d{1,3}))?>/g;

function fractionMs(fraction: string | undefined): number {
  if (!fraction) return 0;
  // ".5" is half a second, ".05" five hundredths, ".005" five thousandths
  return Math.round(Number(fraction) * 10 ** (3 - fraction.length));
}

export function parseLrc(source: string): LyricLine[] {
  let offset = 0;
  const lines: LyricLine[] = [];
  for (const raw of source.split(/\r?\n/)) {
    const line = raw.trim();
    const offsetMatch = line.match(OFFSET);
    if (offsetMatch) {
      offset = Number(offsetMatch[1]);
      continue;
    }
    const stamps = [...line.matchAll(TIMESTAMP)];
    if (stamps.length === 0) continue;
    const body = line.replace(TIMESTAMP, "").trim();
    const words = timedWords(body);
    const text = words ? words.map((word) => word.text).join(" ") : body;
    for (const stamp of stamps) {
      const timeMs = Number(stamp[1]) * 60_000 + Number(stamp[2]) * 1000 + fractionMs(stamp[3]);
      lines.push(words ? { timeMs, text, words } : { timeMs, text });
    }
  }
  // a positive offset means the lyrics come earlier
  const shift = (timeMs: number) => Math.max(0, timeMs - offset);
  return lines
    .map((line) => ({ ...line, timeMs: shift(line.timeMs), ...(line.words ? { words: line.words.map((word) => ({ ...word, timeMs: shift(word.timeMs) })) } : {}) }))
    .sort((a, b) => a.timeMs - b.timeMs);
}

/** "<00:12.30> some <00:12.80> words" → each word and when it is sung; undefined without word stamps. */
function timedWords(body: string): LyricWord[] | undefined {
  const stamps = [...body.matchAll(WORD_STAMP)];
  if (stamps.length === 0) return undefined;
  const words: LyricWord[] = [];
  stamps.forEach((stamp, index) => {
    const end = index + 1 < stamps.length ? stamps[index + 1].index : body.length;
    const timeMs = Number(stamp[1]) * 60_000 + Number(stamp[2]) * 1000 + fractionMs(stamp[3]);
    for (const text of body.slice(stamp.index! + stamp[0].length, end).trim().split(/\s+/).filter(Boolean)) words.push({ timeMs, text });
  });
  return words.length ? words : undefined;
}

/** The index of the line being sung at `positionMs`, or -1 before the first. */
export function activeLineIndex(lines: LyricLine[], positionMs: number): number {
  let low = 0;
  let high = lines.length - 1;
  let found = -1;
  while (low <= high) {
    const middle = (low + high) >> 1;
    if (lines[middle].timeMs <= positionMs) {
      found = middle;
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }
  return found;
}
