// What the translation of lyrics needs without Electron, for the tests: lines cut into requests small enough
// for MyMemory (500 characters at most), and the answers put back on their lines.

/** MyMemory takes 500 characters a request; a little room is kept */
export const CHUNK_CHARS = 450;

export const TARGETS = ["fr", "en", "es", "de", "it", "pt", "ar"] as const;
export type Target = (typeof TARGETS)[number];

/** The distinct lines worth translating: not empty, not only punctuation or numbers, each once. */
export function linesToTranslate(lines: string[]): string[] {
  return [...new Set(lines.map((line) => line.trim()).filter((line) => /\p{L}{2}/u.test(line)))];
}

/** Lines grouped into requests of at most `max` characters, a line never cut. */
export function chunkLines(lines: string[], max = CHUNK_CHARS): string[][] {
  const chunks: string[][] = [];
  let current: string[] = [];
  let size = 0;
  for (const line of lines) {
    const text = line.slice(0, max);
    if (current.length && size + text.length + 1 > max) {
      chunks.push(current);
      current = [];
      size = 0;
    }
    current.push(text);
    size += text.length + 1;
  }
  if (current.length) chunks.push(current);
  return chunks;
}

/** A request's answer split back into its lines; null when the count does not match (asked line by line then). */
export function splitAnswer(answer: string, expected: number): string[] | null {
  const parts = answer.split(/\r?\n/).map((part) => part.trim());
  return parts.length === expected ? parts : null;
}

/** The translation of each line in the order given, null where there is none or it says the same thing. */
export function mapTranslations(lines: string[], found: Map<string, string>): (string | null)[] {
  return lines.map((line) => {
    const translated = found.get(line.trim());
    if (!translated) return null;
    const same = translated.trim().toLowerCase() === line.trim().toLowerCase();
    return same ? null : translated.trim();
  });
}

/** A DeepL key for its free plan ends with ":fx" and is used on its own address. */
export const deeplHost = (key: string) => (key.trim().endsWith(":fx") ? "https://api-free.deepl.com" : "https://api.deepl.com");
