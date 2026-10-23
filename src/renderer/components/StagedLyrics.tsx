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

/** the word's light, from a dim colour to white across a soft edge (as Apple Music's) */
const WORD_FILL = "linear-gradient(90deg, #fff 45%, rgb(255 255 255 / 0.38) 55%)";

/** where the soft edge sits for a word sung this far: wholly dim at 0, wholly lit at 1 (image 2.5× the word) */
export const fillPosition = (amount: number) => `${(91.67 - 83.34 * amount).toFixed(2)}% 0`;

/**
 * One word, filling from left to right while it is sung, and rising a little once reached. Before and after,
 * it is a plain colour: a gradient at rest left a thin white line on the word's edge (seen on Windows).
 */
function Word({ text, amount, held = false }: { text: string; amount: number; held?: boolean }) {
  const singing = amount > 0 && amount < 1;
  // a word held long grows a little and glows while it is sung (Apple Music, AMLL)
  const glowing = held && singing;
  return (
    <span
      className={cn(
        "inline-block transition-[background-position,transform,color,filter] duration-300 ease-linear will-change-transform",
        singing ? "bg-clip-text text-transparent" : amount >= 1 ? "text-white" : "text-white/[0.38]",
      )}
      style={{
        backgroundImage: singing ? WORD_FILL : undefined,
        backgroundSize: "250% 100%",
        backgroundPosition: fillPosition(amount),
        transform: glowing ? "translateY(-0.07em) scale(1.07)" : amount > 0 ? "translateY(-0.04em)" : undefined,
        filter: glowing ? "drop-shadow(0 0 0.22em rgb(255 255 255 / 0.55))" : undefined,
      }}
    >
      {text}
    </span>
  );
}

/** a word sung this long, or longer, is held: it glows (AMLL's emphasis) */
export const HELD_MS = 1000;
export const isHeld = (word: { text: string; startMs: number; endMs: number }) => word.endMs - word.startMs >= HELD_MS && [...word.text].length <= 9;

/** The words of a line, each filling as it is sung, a space between them unless they are syllables of one word. */
function SungLine({ words, position }: { words: SungWord[]; position: number }) {
  return (
    <>
      {words.map((word, index) => (
        <span key={index}>
          <Word text={word.text} amount={fill(word.startMs, word.endMs, position)} held={isHeld(word)} />
          {word.glue ? "" : " "}
        </span>
      ))}
    </>
  );
}

/** Three dots that fill one after the other during a silence, and breathe. */
function Dots({ entry, position }: { entry: Extract<LyricEntry, { kind: "gap" }>; position: number }) {
  const amount = fill(entry.timeMs, entry.endMs, position);
  return (
    <span className="flex origin-left animate-[breathe_2.4s_ease-in-out_infinite] items-center gap-[0.35em] py-[0.2em] pl-[0.1em]" aria-label="Instrumental">
      {[0, 1, 2].map((dot) => (
        <span key={dot} className="h-[0.32em] w-[0.32em] rounded-full bg-white transition-opacity duration-300" style={{ opacity: 0.25 + 0.75 * fill(dot / 3, (dot + 1) / 3, amount) }} />
      ))}
    </span>
  );
}

/**
 * Synced lyrics staged like Apple Music's: the sung line sharp, word by word; the others blurrier and
 * smaller with distance; backing vocals smaller under their line; dots during silences; the
 * pronunciation under lines in another script; and free scrolling, back to the song after 3 s.
 */
export function StagedLyrics({
  lines,
  position,
  anchor,
  lineClassName,
  className,
  alternate = false,
}: {
  lines: LyricLine[];
  position: number;
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
  const roman = useStore(romanizing, (s) => s.on) && needsRomanization(lines.map((line) => line.text));
  const active = activeLineIndex(entries.map((entry) => ({ timeMs: entry.timeMs, text: "" })), position);
  const box = useRef<HTMLDivElement>(null);
  const [freeUntil, setFreeUntil] = useState(0);
  const free = freeUntil > Date.now();

  const target = () => {
    const element = box.current?.querySelector<HTMLElement>(`[data-entry="${Math.max(active, 0)}"]`);
    return box.current && element ? element.offsetTop - box.current.clientHeight * anchor + element.clientHeight / 2 : null;
  };
  const follow = (smooth = true) => {
    const top = target();
    if (top !== null) box.current!.scrollTo({ top, behavior: smooth ? "smooth" : "auto" });
  };

  // Apple Music's wave: the view jumps to the new line at once, and each line glides back from where it
  // was, the ones further down a little later, like a spring (FLIP, on the lines' own translate)
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
    const children = [...container.querySelectorAll<HTMLElement>("[data-entry]")];
    container.scrollTop = top;
    for (const child of children) {
      child.style.transitionProperty = "none";
      child.style.translate = `0 ${delta}px`;
    }
    const frame = requestAnimationFrame(() => {
      for (const child of children) {
        const order = Math.max(0, Math.min(10, Number(child.dataset.entry) - active + 1));
        child.style.transitionProperty = "";
        child.style.transitionDelay = `0ms, 0ms, 0ms, ${order * 55}ms`;
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
          if (entry.kind === "gap") {
            // the dots show only while the silence lasts
            return (
              <div key={`gap-${entry.timeMs}`} data-entry={index} className={cn("overflow-hidden transition-all duration-500", current ? "max-h-40 opacity-100" : "max-h-0 opacity-0")}>
                <div className={lineClassName}>{current && <Dots entry={entry} position={position} />}</div>
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
                "lyric-line block w-full py-2 transition-[opacity,transform,filter,translate] duration-500 ease-[cubic-bezier(0.22,1.18,0.36,1)]",
                // the second voice of a duet sings from the right (Apple Music)
                entry.side === "right" ? "origin-right pl-[12%] text-right" : "origin-left pr-[6%] text-left",
                lineClassName,
              )}
              style={{ opacity: look.opacity, transform: `scale(${look.scale})`, filter: look.blur ? `blur(${look.blur}px)` : undefined }}
            >
              {entry.main && <span className="block">{current ? <SungLine words={entry.words} position={position} /> : entry.main}</span>}
              {entry.backing && (
                <span className={cn("block text-[0.58em] font-medium", entry.main ? "mt-1 text-white/55" : "")}>
                  {current && entry.backingWords ? <SungLine words={entry.backingWords} position={position} /> : entry.backing}
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
