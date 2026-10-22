// LRC lyrics: "[mm:ss.xx] line", several timestamps per line allowed, with an optional
// [offset:±ms] tag that shifts every line.

export interface LyricLine {
  timeMs: number;
  text: string;
}

const TIMESTAMP = /\[(\d{1,3}):(\d{1,2})(?:[.:](\d{1,3}))?\]/g;
const OFFSET = /^\[offset:\s*([+-]?\d+)\s*\]$/i;

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
    const text = line.replace(TIMESTAMP, "").trim();
    for (const stamp of stamps) {
      const timeMs = Number(stamp[1]) * 60_000 + Number(stamp[2]) * 1000 + fractionMs(stamp[3]);
      lines.push({ timeMs, text });
    }
  }
  // a positive offset means the lyrics come earlier
  return lines
    .map((line) => ({ ...line, timeMs: Math.max(0, line.timeMs - offset) }))
    .sort((a, b) => a.timeMs - b.timeMs);
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
