// Turns a French text of the interface into English: the dictionary first (en.json), then the composed
// sentences (patterns.ts), then a known sentence with its detail in brackets, then a list of known parts
// ("Musique, Paroles", "AMLL · mot à mot"). Free of the page, for the main process and the tests.
import EN from "./en.json";
import { PATTERNS, type Pattern } from "./patterns";

/** what is only numbers, times or punctuation needs no translation */
const NEUTRAL = /^[\d\s  .,:;!?%+−–—·/()#-]*$/;

/** a French number ("1 000", its spaces plain by now) the English way ("1,000"); any other part trimmed */
const englishNumber = (part = "") => {
  const value = part.trim();
  return /^\d{1,3}( \d{3})+$/.test(value) ? value.replace(/ /g, ",") : value;
};

export function translator(dictionary: Record<string, string> = EN, patterns: Pattern[] = PATTERNS) {
  /** the English of a known text, or undefined */
  const known = (text: string): string | undefined => {
    const core = text.replace(/\s+/g, " ").trim();
    if (!core) return undefined;
    const found = dictionary[core];
    if (found !== undefined) return found;
    for (const [pattern, write] of patterns) {
      const match = core.match(pattern);
      if (match) return write(match.slice(1).map(englishNumber), (part) => known(part) ?? part);
    }
    // a known sentence and its detail in brackets: "Mixage (assistant)", a message and its error
    const detailed = core.match(/^(.+) \(([^()]+)\)$/);
    const head = detailed && known(detailed[1]);
    if (detailed && head !== undefined) return `${head} (${known(detailed[2]) ?? detailed[2]})`;
    for (const separator of [" · ", ", "]) {
      if (!core.includes(separator)) continue;
      const parts = core.split(separator).map((part) => (NEUTRAL.test(part) ? part : known(part)));
      if (parts.every((part) => part !== undefined)) return parts.join(separator);
    }
    return undefined;
  };
  /** the text in English, its spaces around kept (a text node often sits between two others) */
  return (text: string): string => {
    const english = known(text);
    if (english === undefined) return text;
    const [, before, , after] = text.match(/^(\s*)([\s\S]*?)(\s*)$/)!;
    return before + english + after;
  };
}

export const toEnglish = translator();
