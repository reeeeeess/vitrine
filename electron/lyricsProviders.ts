// The lyrics sources and what is read from each, kept free of Electron for the tests:
// - AMLL TTML DB (github.com/amll-dev/amll-ttml-db, CC0): word by word, who sings (duets) and the backing
//   vocals apart, in Apple Music's TTML, by Spotify id or NetEase id;
// - LRCLIB (lrclib.net): synced lines, open and free;
// - NetEase Cloud Music: synced lines from its public web search, not an official API (can be turned off);
// - lyrics.ovh: the text alone, as a last resort.
import type { LyricsResult } from "./lyricsMatch";

export type LyricsSource = "amll" | "lrclib" | "netease" | "lyricsovh";
export type LyricsKind = "word" | "synced" | "instrumental" | "plain";

export const SOURCES: LyricsSource[] = ["amll", "lrclib", "netease", "lyricsovh"];

export interface TimedWord {
  text: string;
  timeMs: number;
  endMs: number;
  /** no space before the next word (a syllable, or a character in Chinese or Japanese) */
  glue?: boolean;
}

export interface TimedLine {
  timeMs: number;
  endMs: number;
  text: string;
  words: TimedWord[];
  /** a second voice of a duet, shown on the right (Apple Music) */
  side?: "right";
  /** the backing vocals, timed apart, without their parentheses */
  backing?: { text: string; words: TimedWord[] };
}

// ── ranking ──────────────────────────────────────────────────────────────

export function kindOf(result: LyricsResult | null | undefined): LyricsKind | null {
  if (!result) return null;
  if (result.lines?.length) return "word";
  if (result.synced) return "synced";
  if (result.instrumental) return "instrumental";
  if (result.plain) return "plain";
  return null;
}

const KIND_ORDER: LyricsKind[] = ["word", "synced", "instrumental", "plain"];

/** The sources that have the song, best first: word by word, then synced lines, then the text alone. */
export function rankSources(candidates: Partial<Record<LyricsSource, LyricsResult | null>>, allowed: LyricsSource[] = SOURCES): { source: LyricsSource; kind: LyricsKind }[] {
  return allowed
    .map((source) => ({ source, kind: kindOf(candidates[source]) }))
    .filter((entry): entry is { source: LyricsSource; kind: LyricsKind } => entry.kind !== null)
    .sort((a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind) || SOURCES.indexOf(a.source) - SOURCES.indexOf(b.source));
}

// ── TTML (AMLL, Apple Music) ─────────────────────────────────────────────

/** "01:02.345", "62.345", "1:01:02.3" or "62.3s" → ms; null when unreadable. */
export function ttmlTime(value: string | undefined): number | null {
  if (!value) return null;
  const parts = value.trim().replace(/s$/, "").split(":");
  let seconds = 0;
  for (const part of parts) {
    const n = Number(part);
    if (part === "" || !Number.isFinite(n)) return null;
    seconds = seconds * 60 + n;
  }
  return Math.round(seconds * 1000);
}

const attribute = (tag: string, name: string) => tag.match(new RegExp(`\\s${name}="([^"]*)"`))?.[1];

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
const decode = (text: string) =>
  text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, code: string) =>
    code[0] === "#" ? String.fromCodePoint(code[1].toLowerCase() === "x" ? parseInt(code.slice(2), 16) : Number(code.slice(1))) : (ENTITIES[code.toLowerCase()] ?? whole),
  );

/** the words as one line of text, a space where the file has one */
const joinWords = (words: TimedWord[]) => words.map((word, i) => word.text + (word.glue || i === words.length - 1 ? "" : " ")).join("");

/** words with no time, or a time of 0 in the middle of the song (a slip in the file), take the one before */
function repairTimes(words: TimedWord[], lineStart: number, lineEnd: number): TimedWord[] {
  let previousEnd = lineStart;
  return words.map((word) => {
    let { timeMs, endMs } = word;
    if (timeMs < 0 || timeMs < lineStart - 2000 || timeMs > lineEnd + 2000) timeMs = previousEnd;
    if (!(endMs > timeMs)) endMs = timeMs + Math.max(100, Math.min(300, lineEnd - timeMs));
    previousEnd = endMs;
    return { ...word, timeMs, endMs };
  });
}

/** Words spread evenly over a line given without word times. */
function evenWords(text: string, start: number, end: number): TimedWord[] {
  const parts = text.split(/\s+/).filter(Boolean);
  const step = (end - start) / Math.max(1, parts.length);
  return parts.map((part, i) => ({ text: part, timeMs: Math.round(start + i * step), endMs: Math.round(start + (i + 1) * step) }));
}

/** Without the parentheses around backing vocals: Apple Music shows them smaller instead. */
function unbracket(words: TimedWord[]): TimedWord[] {
  if (words.length === 0) return words;
  const out = words.map((word) => ({ ...word }));
  out[0].text = out[0].text.replace(/^[(（]/, "");
  out[out.length - 1].text = out[out.length - 1].text.replace(/[)）]$/, "");
  return out.filter((word) => word.text);
}

/**
 * Apple Music's TTML, as AMLL TTML DB keeps it: one <p> per line with its singer (ttm:agent), a <span> per
 * word or syllable (a space between spans separates words), the backing vocals in a span of role x-bg,
 * and translations or romanizations (skipped: Vitrine romanizes by itself).
 */
export function parseTtml(xml: string): TimedLine[] {
  const agents = [...xml.matchAll(/<ttm:agent\b[^>]*>/g)].map((match) => ({ id: attribute(match[0], "xml:id"), type: attribute(match[0], "type") }));
  const lead = agents.find((agent) => agent.type === "person")?.id ?? agents[0]?.id;
  const lines: TimedLine[] = [];

  for (const paragraph of xml.matchAll(/<p\b([^>]*)>([\s\S]*?)<\/p>/g)) {
    const attrs = paragraph[1];
    const start = ttmlTime(attribute(attrs, "begin"));
    const end = ttmlTime(attribute(attrs, "end"));
    if (start === null) continue;
    const agent = attribute(attrs, "ttm:agent");
    const agentType = agents.find((a) => a.id === agent)?.type;

    const main: TimedWord[] = [];
    const backing: TimedWord[] = [];
    let loose = "";
    // the open spans: their role, and their times when they are a word
    const stack: { role?: string; begin: number | null; end: number | null; text: string }[] = [];
    const skipping = () => stack.some((span) => span.role && span.role !== "x-bg");
    const inBacking = () => stack.some((span) => span.role === "x-bg");
    const target = () => (inBacking() ? backing : main);

    for (const token of paragraph[2].matchAll(/<span\b([^>]*)>|<\/span>|<br\s*\/?>|([^<]+)/g)) {
      if (token[0].startsWith("<span")) {
        stack.push({ role: attribute(token[1], "ttm:role"), begin: ttmlTime(attribute(token[1], "begin")), end: ttmlTime(attribute(token[1], "end")), text: "" });
      } else if (token[0] === "</span>") {
        const span = stack.pop();
        if (!span || span.role || skipping()) continue;
        const raw = decode(span.text);
        const text = raw.trim();
        if (!text) continue;
        const words = target();
        // a space before the word, inside its span, separates it from the one before
        if (/^\s/.test(raw) && words.length) words[words.length - 1].glue = false;
        words.push({ text, timeMs: span.begin ?? -1, endMs: span.end ?? -1, glue: !/\s$/.test(raw) });
      } else if (token[0].startsWith("<br")) {
        const words = target();
        if (words.length) words[words.length - 1].glue = false;
      } else if (!skipping()) {
        const text = token[2];
        const open = stack[stack.length - 1];
        if (open && !open.role) open.text += text;
        else if (/^\s+$/.test(text)) {
          const words = target();
          if (words.length) words[words.length - 1].glue = false;
        } else if (stack.length === 0) loose += decode(text);
      }
    }

    const lineEnd = end ?? Math.max(start, ...main.map((word) => word.endMs));
    const words = main.length ? repairTimes(main, start, lineEnd) : loose.trim() ? evenWords(decode(loose).trim(), start, lineEnd) : [];
    const backingWords = unbracket(repairTimes(backing, start, Math.max(lineEnd, ...backing.map((word) => word.endMs))));
    if (words.length === 0 && backingWords.length === 0) continue;
    if (words.length) words[words.length - 1].glue = false;
    lines.push({
      timeMs: start,
      endMs: Math.max(lineEnd, words[words.length - 1]?.endMs ?? 0),
      text: joinWords(words),
      words,
      ...(agent && lead && agent !== lead && agentType !== "group" ? { side: "right" as const } : {}),
      ...(backingWords.length ? { backing: { text: joinWords(backingWords), words: backingWords } } : {}),
    });
  }
  return lines.sort((a, b) => a.timeMs - b.timeMs);
}

/** The words of TTML lines as plain text, for the places that show plain lyrics. */
export const ttmlText = (lines: TimedLine[]) => lines.map((line) => [line.text, line.backing ? `(${line.backing.text})` : ""].filter(Boolean).join(" ")).join("\n");

// ── NetEase ──────────────────────────────────────────────────────────────

export interface NeteaseSong {
  id: number;
  name: string;
  ar?: { name: string }[];
  /** duration, ms */
  dt?: number;
}

/** lowercase, without accents, "(feat. …)", " - Remastered", or punctuation: names to compare */
export function normalizeName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s[-–]\s.*$/, "")
    .replace(/[([](feat|ft|with|prod)[^)\]]*[)\]]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

const sameName = (a: string, b: string) => {
  const x = normalizeName(a);
  const y = normalizeName(b);
  return Boolean(x && y) && (x === y || x.startsWith(y) || y.startsWith(x));
};

/** another version of the song: its timing differs, its lyrics may too */
const VERSION = /\b(remix|live|acoustic|acoustique|instrumental|karaoke|sped up|slowed|nightcore|remaster(ed)?|version|edit|mix|cover)\b/;
const otherVersion = (candidate: string, wanted: string) => {
  const extra = (name: string) => (name.match(VERSION) ?? [])[0];
  const found = extra(normalizeName(candidate.replace(/[()[\]]/g, " ")) + " " + candidate.toLowerCase());
  return Boolean(found) && !wanted.toLowerCase().includes(found!);
};

/**
 * The search result that is surely the song: same title, one artist in common, and the same length
 * within 3 s when both are known. Wrong lyrics are worse than none: anything less sure is left out.
 */
export function pickNetease(songs: NeteaseSong[], query: { track: string; artist: string; durationMs?: number }): NeteaseSong | null {
  const fits = songs.filter(
    (song) =>
      sameName(song.name, query.track) &&
      !otherVersion(song.name, query.track) &&
      (song.ar ?? []).some((artist) => sameName(artist.name, query.artist)) &&
      (!query.durationMs || !song.dt || Math.abs(song.dt - query.durationMs) <= 3000),
  );
  const gap = (song: NeteaseSong) => (query.durationMs && song.dt ? Math.abs(song.dt - query.durationMs) : 0);
  // the very same title first, then the closest length
  const exact = (song: NeteaseSong) => (normalizeName(song.name) === normalizeName(query.track) ? 0 : 1);
  return fits.sort((a, b) => exact(a) - exact(b) || gap(a) - gap(b))[0] ?? null;
}

const LRC_STAMP = /\[\d{1,3}:\d{1,2}(?:[.:]\d{1,3})?\]/g;
/** the credits NetEase puts at the top of its lyrics: lyricist, composer, arranger… */
const CREDIT = /^(作词|作曲|编曲|制作人|制作|混音|母带|录音|和声|监制|出品|发行|策划|统筹|吉他|贝斯|鼓|键盘|弦乐|词|曲|OP|SP|Lyricist|Lyrics by|Composer|Composed by|Arranger|Producer|Produced by|Mixing|Mastering)\s*[:：]/i;
const PURE_MUSIC = /纯音乐[，,]\s*请欣赏/;

/**
 * NetEase's LRC made clean: its credits (lines of JSON, or "作词 : …") taken out, non-breaking spaces made
 * plain. Text alone when every line has the same time (not really synced).
 */
export function cleanNetease(lrc: string): LyricsResult | null {
  const lines = lrc
    .split(/\r?\n/)
    .filter((line) => !line.trim().startsWith("{"))
    .map((line) => line.replace(/ /g, " ").trimEnd())
    .filter((line) => {
      const body = line.replace(LRC_STAMP, "").trim();
      return !CREDIT.test(body);
    });
  const sung = lines.filter((line) => line.replace(LRC_STAMP, "").trim());
  if (sung.length === 0) return null;
  if (sung.length <= 2 && sung.some((line) => PURE_MUSIC.test(line))) return { synced: null, plain: null, instrumental: true };
  const stamps = new Set(sung.map((line) => line.match(LRC_STAMP)?.[0]).filter(Boolean));
  const plain = sung.map((line) => line.replace(LRC_STAMP, "").trim()).join("\n");
  if (stamps.size <= 1) return { synced: null, plain, instrumental: false };
  return { synced: lines.join("\n").trim(), plain, instrumental: false };
}

// ── lyrics.ovh ───────────────────────────────────────────────────────────

/** The text alone, without "[Refrain]"-style headings, nor a "Paroles de la chanson … par …" first line. */
export function cleanPlain(text: string): string | null {
  const cleaned = text
    .replace(/\r/g, "")
    .replace(/^Paroles de la chanson .* par .*\n/i, "")
    .split("\n")
    .filter((line) => !/^\s*\[[^\]]*\]\s*$/.test(line))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return cleaned || null;
}

// ── who sings what (feats) ───────────────────────────────────────────────

/** A part of the song as Genius writes it out: "[Couplet 1 : SCH]", "[Refrain : JuL & Solda]", "[La Rvfleuze]". */
export interface SungSection {
  /** what is between the brackets */
  label: string;
  lines: string[];
}

/**
 * The parts of lyrics written with their headings (lyrics.ovh keeps Genius's; LRCLIB's text sometimes has
 * them). Empty when the text has fewer than two headings: then it says nothing about who sings.
 */
export function parseSections(text: string): SungSection[] {
  const sections: SungSection[] = [];
  for (const raw of text.replace(/\r/g, "").replace(/^Paroles de la chanson .* par .*\n/i, "").split("\n")) {
    const line = raw.trim();
    const heading = line.match(/^\[([^\]]+)\]$/);
    if (heading) sections.push({ label: heading[1].trim(), lines: [] });
    else if (line && sections.length) sections[sections.length - 1].lines.push(line);
  }
  return sections.length >= 2 ? sections.filter((section) => section.lines.length) : [];
}
