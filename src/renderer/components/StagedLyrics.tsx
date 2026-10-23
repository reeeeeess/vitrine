import { Crosshair, Languages } from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { cn } from "../lib/cn";
import { activeLineIndex, type LyricLine } from "../lib/lrc";
import { fill, lineLook, stageLyrics, type LyricEntry, type SungWord } from "../lib/lyricsView";
import { needsRomanization, romanize } from "../lib/romanize";
import { createStore, useStore } from "../lib/store";
import * as engine from "../player/engine";
import { run } from "./NowPlayingBar";

/** after scrolling by hand, the lyrics stay put this long before following the song again */
const FREE_SCROLL_MS = 3000;

const ROMAN_KEY = "vitrine.romanize";
/** whether the pronunciation line shows, for songs in another script */
export const romanizing = createStore({ on: readRoman() });

function readRoman(): boolean {
  try {
    return localStorage.getItem(ROMAN_KEY) !== "off";
  } catch {
    return true;
  }
}

export function setRomanizing(on: boolean): void {
  romanizing.set({ on });
  try {
    localStorage.setItem(ROMAN_KEY, on ? "on" : "off");
  } catch {
    // remembered for this run only
  }
}

/** The pronunciation switch, shown only for songs mostly in another script. */
export function RomanizeToggle({ lines, className }: { lines: LyricLine[]; className?: string }) {
  const on = useStore(romanizing, (s) => s.on);
  const useful = useMemo(() => needsRomanization(lines.map((line) => line.text)), [lines]);
  if (!useful) return null;
  return (
    <button
      onClick={() => setRomanizing(!on)}
      className={cn("flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors", on ? "border-white/40 bg-white/15 text-white" : "border-white/20 text-white/60 hover:text-white", className)}
      aria-pressed={on}
      title="Prononciation en lettres latines"
    >
      <Languages className="h-3.5 w-3.5" />
      Prononciation
    </button>
  );
}

/** where the soft edge sits for a word sung this far: wholly dim at 0, wholly lit at 1 (image 2.5× the word) */
export const fillPosition = (amount: number) => `${(91.67 - 83.34 * amount).toFixed(2)}% 0`;

/** a word sung this long, or longer, is held: it glows (AMLL's emphasis) */
export const HELD_MS = 1000;
export const isHeld = (word: { text: string; startMs: number; endMs: number }) => word.endMs - word.startMs >= HELD_MS && [...word.text].length <= 9;

/** How a word looks at this moment: dim before, filling while sung, lit after (styles.css, .lyric-word). */
export const wordState = (amount: number) => (amount <= 0 ? "" : amount >= 1 ? "sung" : "singing");

/**
 * The words of the line being sung, each with its times: the lyrics' clock paints them 60 times a second
 * (paintLine), without React, so the light glides along the words instead of stepping.
 */
function SungLine({ words }: { words: SungWord[] }) {
  return (
    <>
      {words.map((word, index) => (
        <span key={index}>
          <span className="lyric-word" data-start={word.startMs} data-end={word.endMs} data-held={isHeld(word) ? "" : undefined}>
            {word.text}
          </span>
          {word.glue ? "" : " "}
        </span>
      ))}
    </>
  );
}

/** Lights the words and the dots of the line being sung for this moment of the song. */
function paintLine(line: HTMLElement, positionMs: number): void {
  for (const word of line.querySelectorAll<HTMLElement>("[data-start]")) {
    const amount = fill(Number(word.dataset.start), Number(word.dataset.end), positionMs);
    const state = wordState(amount);
    if ((word.dataset.state ?? "") !== state) word.dataset.state = state;
    if (state === "singing") word.style.backgroundPosition = fillPosition(amount);
  }
  for (const dot of line.querySelectorAll<HTMLElement>("[data-dot]")) {
    const [from, to] = (dot.dataset.dot ?? "0,1").split(",").map(Number);
    dot.style.opacity = String(0.25 + 0.75 * fill(from, to, positionMs));
  }
}

/** Three dots that fill one after the other during a silence, and breathe. */
function Dots({ entry }: { entry: Extract<LyricEntry, { kind: "gap" }> }) {
  const third = (entry.endMs - entry.timeMs) / 3;
  return (
    <span className="flex origin-left animate-[breathe_2.4s_ease-in-out_infinite] items-center gap-[0.35em] py-[0.2em] pl-[0.1em]" aria-label="Instrumental">
      {[0, 1, 2].map((dot) => (
        <span key={dot} data-dot={`${entry.timeMs + dot * third},${entry.timeMs + (dot + 1) * third}`} className="h-[0.32em] w-[0.32em] rounded-full bg-white opacity-25" />
      ))}
    </span>
  );
}

/** the lines this close to the one sung glide on their own layer (the others are out of sight) */
const NEAR_BEFORE = 4;
const NEAR_AFTER = 10;

/**
 * Synced lyrics staged like Apple Music's: the sung line sharp, its words lit as they are sung; the others
 * blurrier and smaller with distance; lines gliding in a wave; backing vocals smaller under their line;
 * each artist of a feat on their side, named when the voice changes; dots during silences; the
 * pronunciation under lines in another script; and free scrolling, back to the song after 3 s.
 */
export function StagedLyrics({
  lines,
  clock,
  anchor,
  lineClassName,
  className,
  alternate = false,
}: {
  lines: LyricLine[];
  /** where the song is, in the lyrics' time (ms), read at every frame */
  clock: () => number;
  /** where the sung line sits, from the top of the box (0.33: a third of the way down) */
  anchor: number;
  lineClassName: string;
  className?: string;
  /** karaoke for two: the lines go left and right in turn, when the file does not say who sings */
  alternate?: boolean;
}) {
  const staged = useMemo(() => stageLyrics(lines), [lines]);
  const entries = useMemo(() => {
    if (!alternate || staged.some((entry) => entry.kind === "line" && entry.side)) return staged;
    let turn = 0;
    return staged.map((entry) => (entry.kind === "line" ? { ...entry, side: turn++ % 2 ? ("right" as const) : undefined } : entry));
  }, [staged, alternate]);
  const times = useMemo(() => entries.map((entry) => ({ timeMs: entry.timeMs, text: "" })), [entries]);
  const roman = useStore(romanizing, (s) => s.on) && needsRomanization(lines.map((line) => line.text));
  const clockRef = useRef(clock);
  clockRef.current = clock;
  const [active, setActive] = useState(() => activeLineIndex(times, clock()));
  const activeRef = useRef(active);
  activeRef.current = active;
  const box = useRef<HTMLDivElement>(null);
  const [freeUntil, setFreeUntil] = useState(0);
  const free = freeUntil > Date.now();

  // the lyrics' clock: every frame, the line sung (a render when it changes) and its words' light (no render)
  useEffect(() => {
    let frame = 0;
    let painted = -1;
    const tick = () => {
      const position = clockRef.current();
      const index = activeLineIndex(times, position);
      if (index !== activeRef.current) {
        activeRef.current = index;
        setActive(index);
      }
      if (position !== painted) {
        painted = position;
        const line = box.current?.querySelector<HTMLElement>(`[data-entry="${index}"]`);
        if (line) paintLine(line, position);
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [times]);

  const target = () => {
    const element = box.current?.querySelector<HTMLElement>(`[data-entry="${Math.max(active, 0)}"]`);
    return box.current && element ? element.offsetTop - box.current.clientHeight * anchor + element.clientHeight / 2 : null;
  };
  const follow = (smooth = true) => {
    const top = target();
    if (top !== null) box.current!.scrollTo({ top, behavior: smooth ? "smooth" : "auto" });
  };

  // Apple Music's wave: the view jumps to the new line at once, and the lines in sight glide back from where
  // they were, each a little after the one above it, with a spring (FLIP, on the lines' own translate)
  useLayoutEffect(() => {
    if (free || !box.current) return;
    const top = target();
    if (top === null) return;
    const container = box.current;
    const delta = top - container.scrollTop;
    const calm = document.documentElement.classList.contains("no-transitions");
    // opening, or a jump in the song: straight there
    if (calm || Math.abs(delta) < 1 || Math.abs(delta) > container.clientHeight) {
      container.scrollTo({ top, behavior: "auto" });
      return;
    }
    const near = [...container.querySelectorAll<HTMLElement>("[data-entry]")].filter((child) => {
      const distance = Number(child.dataset.entry) - active;
      return distance >= -NEAR_BEFORE - 1 && distance <= NEAR_AFTER;
    });
    container.scrollTop = top;
    for (const child of near) {
      child.style.transitionProperty = "none";
      child.style.translate = `0 ${delta}px`;
    }
    const frame = requestAnimationFrame(() => {
      for (const child of near) {
        const order = Math.max(0, Math.min(10, Number(child.dataset.entry) - active + 1));
        child.style.transitionProperty = "";
        child.style.transitionDelay = `0ms, 0ms, 0ms, ${order * 45}ms`;
        child.style.translate = "0 0";
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [active, free]);

  // back to the song once the hand has left the lyrics alone
  useEffect(() => {
    if (!free) return;
    const timer = setTimeout(() => setFreeUntil(0), freeUntil - Date.now());
    return () => clearTimeout(timer);
  }, [freeUntil]);

  const letGo = () => setFreeUntil(Date.now() + FREE_SCROLL_MS);

  return (
    <div className={cn("relative h-full", className)}>
      <div ref={box} onWheel={letGo} onTouchMove={letGo} className="scrollbar-hide h-full overflow-y-auto">
        {/* room above and below, so the first and last lines can sit at the anchor too */}
        <div style={{ height: `${anchor * 100}%` }} />
        {entries.map((entry, index) => {
          const distance = index - active;
          const look = lineLook(free ? 0 : distance);
          const current = distance === 0;
          const near = distance >= -NEAR_BEFORE && distance <= NEAR_AFTER;
          if (entry.kind === "gap") {
            // the dots show only while the silence lasts
            return (
              <div key={`gap-${entry.timeMs}`} data-entry={index} className={cn("overflow-hidden transition-all duration-500", current ? "max-h-40 opacity-100" : "max-h-0 opacity-0")}>
                <div className={lineClassName}>{current && <Dots entry={entry} />}</div>
              </div>
            );
          }
          const pronunciation = roman ? romanize(entry.main || entry.backing) : null;
          return (
            <button
              key={`${entry.timeMs}-${index}`}
              data-entry={index}
              onClick={() => {
                setFreeUntil(0);
                run(() => engine.seek(entry.timeMs));
              }}
              className={cn(
                "lyric-line block w-full py-2",
                near && "will-change-transform",
                // each artist of a feat (or the second voice of a duet) on their side, voices together in the middle
                entry.side === "right" ? "origin-right pl-[12%] text-right" : entry.side === "both" ? "origin-center px-[6%] text-center" : "origin-left pr-[6%] text-left",
                lineClassName,
              )}
              style={{ opacity: look.opacity, transform: `scale(${look.scale})`, filter: look.blur ? `blur(${look.blur}px)` : undefined }}
            >
              {entry.voice && <span className="lyric-voice">{entry.voice}</span>}
              {entry.main && <span className="block">{current ? <SungLine words={entry.words} /> : entry.main}</span>}
              {entry.backing && (
                <span className={cn("block text-[0.58em] font-medium", entry.main ? "mt-1 text-white/55" : "")}>
                  {current && entry.backingWords ? <SungLine words={entry.backingWords} /> : entry.backing}
                </span>
              )}
              {pronunciation && <span className="mt-1 block font-sans text-[0.42em] font-medium tracking-normal text-white/60">{pronunciation}</span>}
            </button>
          );
        })}
        <div style={{ height: `${(1 - anchor) * 100}%` }} />
      </div>
      {free && (
        <button
          onClick={() => {
            setFreeUntil(0);
            follow();
          }}
          className="absolute bottom-6 right-6 flex items-center gap-2 rounded-full border border-white/25 bg-black/50 px-4 py-2 text-sm text-white/85 backdrop-blur transition-colors hover:bg-black/70"
        >
          <Crosshair className="h-4 w-4" />
          Revenir à la ligne
        </button>
      )}
    </div>
  );
}

/** Where plain lyrics stand for a song this far along: the share of the text sung, kept from the very ends. */
export const plainScroll = (positionMs: number, durationMs: number, room: number) => (durationMs > 0 ? Math.max(0, Math.min(1, (positionMs - 8000) / Math.max(1, durationMs - 20_000))) * room : 0);

/**
 * Lyrics without times, scrolling with the song as if they were sung at an even pace (lyrics-plus does the
 * same); scrolled by hand, they stay put for 3 s.
 */
export function PlainLyrics({ text, position, durationMs, className }: { text: string; position: number; durationMs: number; className?: string }) {
  const box = useRef<HTMLDivElement>(null);
  const [freeUntil, setFreeUntil] = useState(0);
  useEffect(() => {
    const element = box.current;
    if (!element || freeUntil > Date.now()) return;
    element.scrollTo({ top: plainScroll(position, durationMs, element.scrollHeight - element.clientHeight), behavior: "smooth" });
  }, [Math.round(position / 1000), durationMs, freeUntil]);
  useEffect(() => {
    if (freeUntil <= Date.now()) return;
    const timer = setTimeout(() => setFreeUntil(0), freeUntil - Date.now());
    return () => clearTimeout(timer);
  }, [freeUntil]);
  const letGo = () => setFreeUntil(Date.now() + FREE_SCROLL_MS);
  return (
    <div ref={box} onWheel={letGo} onTouchMove={letGo} className={cn("scrollbar-hide h-full overflow-y-auto whitespace-pre-line", className)}>
      {text}
    </div>
  );
}
