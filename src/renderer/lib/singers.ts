// Who sings which line of a feat, so each artist has a side, as Apple Music shows duets: the parts as Genius
// writes them ("[Couplet 1 : SCH]", "[Refrain : JuL & Solda]", "[La Rvfleuze]") are matched, line by line,
// with the synced lyrics. Pure, for the tests.
import type { LyricLine } from "./lrc";

export interface SungSection {
  label: string;
  lines: string[];
}

/** lowercase, without accents nor punctuation: texts to compare */
export const plainText = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

/** what the parts are called, when the heading names nobody */
const PART = /^(couplet|verse|refrain|chorus|pre[ -]?refrain|pre[ -]?chorus|pont|bridge|intro|outro|hook|interlude|post[ -]?refrain|break)\b/;

/**
 * The artists a heading names, as the track spells them: "Couplet 2 : Kofs" → ["Kofs"], "JuL & Solda" →
 * ["JuL", "Solda"]. Null when it names none of the track's artists ("[Refrain]").
 */
export function singersOf(label: string, artists: string[]): string[] | null {
  const named = label.includes(":") ? label.slice(label.indexOf(":") + 1) : label;
  const parts = named.split(/\s*(?:&|,|\+|\/|\bet\b|\bx\b|\bfeat\.?|\bft\.?|\bwith\b|\bavec\b)\s*/i).map(plainText).filter(Boolean);
  const known = artists.map((artist) => ({ artist, plain: plainText(artist) }));
  const found: string[] = [];
  for (const part of parts) {
    const match = known.find(({ plain }) => plain && (plain === part || part.includes(plain) || plain.includes(part)) && part.length >= 2);
    if (match && !found.includes(match.artist)) found.push(match.artist);
  }
  return found.length ? found : null;
}

/** How alike two lines are, 0 to 1 (pairs of letters in common, Dice). */
export function likeness(a: string, b: string): number {
  const pairs = (text: string) => {
    const squeezed = plainText(text).replace(/ /g, "");
    const list: string[] = [];
    for (let i = 0; i < squeezed.length - 1; i++) list.push(squeezed.slice(i, i + 2));
    return list;
  };
  const x = pairs(a);
  const y = pairs(b);
  if (x.length === 0 || y.length === 0) return plainText(a) === plainText(b) ? 1 : 0;
  const counts = new Map<string, number>();
  for (const pair of x) counts.set(pair, (counts.get(pair) ?? 0) + 1);
  let common = 0;
  for (const pair of y) {
    const left = counts.get(pair) ?? 0;
    if (left > 0) {
      common++;
      counts.set(pair, left - 1);
    }
  }
  return (2 * common) / (x.length + y.length);
}

/** "[Couplet 1 : SCH]" alone on a line: a heading some synced lyrics keep in the text */
export const HEADING = /^\s*\[([^\]]+)\]\s*$/;

/**
 * The side of each part: with two voices, the track's artist on the left and the guest on the right, all
 * song long; with more, each new voice takes the other side from the last one (a posse cut reads left,
 * right, left…). Voices together sit in the middle.
 */
export function sidesFor(parts: string[][], main: string): LyricLine["side"][] {
  const solo = [...new Set(parts.filter((singers) => singers.length === 1).map((singers) => singers[0]))];
  const left = solo.includes(main) ? main : solo[0];
  let side: "left" | "right" = "right";
  let lastSinger = "";
  return parts.map((singers) => {
    if (singers.length >= 2) return "both";
    if (solo.length <= 2) return singers[0] === left ? undefined : "right";
    if (singers[0] !== lastSinger) {
      side = side === "right" ? "left" : "right";
      lastSinger = singers[0];
    }
    return side === "left" ? undefined : "right";
  });
}

/** a line of the synced lyrics looks for its match this far ahead in the written parts */
const LOOK_AHEAD = 14;
const ALIKE = 0.55;

/**
 * Each line with who sings it and their side, and the name shown when the voice changes. Left as it is
 * when the song is not a feat, when the lines already say who sings (TTML), or when the headings name
 * fewer than two voices.
 */
export function assignSingers(lines: LyricLine[], sections: SungSection[] | undefined, artists: string[]): LyricLine[] {
  if (!sections?.length || artists.length < 2 || lines.some((line) => line.side)) return lines;
  // the written lines, each with its singers; "[Refrain]" takes the singers of the last refrain, or the main artist
  const written: { text: string; singers: string[] }[] = [];
  const byPart = new Map<string, string[]>();
  for (const section of sections) {
    const part = plainText(section.label.split(":")[0]).match(PART)?.[1] ?? "";
    const singers = singersOf(section.label, artists) ?? (part ? byPart.get(part) : undefined) ?? [artists[0]];
    if (part) byPart.set(part, singers);
    for (const text of section.lines) written.push({ text, singers });
  }
  if (new Set(written.map((line) => line.singers.join("&"))).size < 2) return lines;

  // who sings each line: its match in the written parts (looked for a little ahead), or the line before's
  let cursor = 0;
  let previous: string[] = written[0].singers;
  const sung = lines.flatMap((line) => {
    const heading = line.text.match(HEADING);
    if (heading) {
      previous = singersOf(heading[1], artists) ?? previous;
      return [];
    }
    if (!line.text.trim()) return [{ line, singers: previous }];
    let best = -1;
    let score = ALIKE;
    for (let k = cursor; k < Math.min(written.length, cursor + LOOK_AHEAD); k++) {
      const alike = likeness(line.text, written[k].text);
      if (alike > score) {
        score = alike;
        best = k;
      }
    }
    if (best >= 0) {
      previous = written[best].singers;
      cursor = best + 1;
    }
    return [{ line, singers: previous }];
  });

  // the parts as sung (a part: lines in a row by the same voices), each with its side
  const partOf: number[] = [];
  const parts: string[][] = [];
  sung.forEach(({ line, singers }, index) => {
    const before = index > 0 ? parts[parts.length - 1] : null;
    if (line.text.trim() && (!before || before.join("&") !== singers.join("&"))) parts.push(singers);
    partOf.push(Math.max(0, parts.length - 1));
  });
  const sides = sidesFor(parts, artists[0]);
  let voice = "";
  return sung.map(({ line, singers }, index) => {
    if (!line.text.trim()) return line;
    const name = singers.join(" & ");
    const label = name !== voice ? name : undefined;
    voice = name;
    const side = sides[partOf[index]];
    return { ...line, singers, ...(side ? { side } : {}), ...(label ? { voice: label } : {}) };
  });
}
