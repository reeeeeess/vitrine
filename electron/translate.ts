// Lyrics translated under each line (Apple Music's translation, B7): MyMemory (translated.net) by default,
// free and without a key, within its daily allowance; or DeepL, with the person's own key. Asked from the
// main process, and kept on disk (userData/translations): a song is translated once.
import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { app, net } from "electron";
import { readConfig, updateConfig } from "./config";
import { chunkLines, deeplHost, linesToTranslate, mapTranslations, splitAnswer, TARGETS, type Target } from "./translateText";

export interface TranslationSettings {
  service: "mymemory" | "deepl";
  /** the person's DeepL key (deepl.com, free plan: 500 000 characters a month) */
  deeplKey: string;
  target: Target;
}

const DEFAULTS: TranslationSettings = { service: "mymemory", deeplKey: "", target: "fr" };
const TIMEOUT_MS = 12_000;

export function translationSettings(): TranslationSettings {
  return { ...DEFAULTS, ...(readConfig().translation ?? {}) };
}

export function setTranslationSettings(raw: unknown): TranslationSettings {
  const input = (raw ?? {}) as Partial<TranslationSettings>;
  const next: TranslationSettings = {
    service: input.service === "deepl" ? "deepl" : "mymemory",
    deeplKey: typeof input.deeplKey === "string" ? input.deeplKey.trim().slice(0, 100) : translationSettings().deeplKey,
    target: TARGETS.includes(input.target as Target) ? (input.target as Target) : translationSettings().target,
  };
  updateConfig({ translation: next });
  return next;
}

/** the lyrics already are in the language asked */
class SameLanguage extends Error {}

async function myMemory(lines: string[], target: Target): Promise<{ found: Map<string, string>; from?: string }> {
  const found = new Map<string, string>();
  let from: string | undefined;
  const ask = async (query: string) => {
    const response = await net.fetch(`https://api.mymemory.translated.net/get?${new URLSearchParams({ q: query, langpair: `autodetect|${target}` })}`, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`MyMemory ${response.status}`);
    const body = (await response.json()) as { responseData?: { translatedText?: string; detectedLanguage?: string }; quotaFinished?: boolean; responseStatus?: number | string };
    const text = body.responseData?.translatedText ?? "";
    if (body.quotaFinished || /USED ALL AVAILABLE FREE TRANSLATIONS/i.test(text)) throw new Error("La traduction gratuite du jour est épuisée (MyMemory) : réessayez demain, ou ajoutez une clé DeepL.");
    // MyMemory answers with a message instead of a translation when the lyrics already are in the language asked
    if (/SELECT TWO DISTINCT LANGUAGES/i.test(text)) throw new SameLanguage();
    if (Number(body.responseStatus ?? 200) !== 200) throw new Error(`MyMemory : ${text.slice(0, 120)}`);
    from ??= body.responseData?.detectedLanguage;
    return text;
  };
  for (const chunk of chunkLines(lines)) {
    let answer: string;
    try {
      answer = await ask(chunk.join("\n"));
    } catch (error) {
      if (error instanceof SameLanguage) return { found: new Map(), from: target };
      throw error;
    }
    const parts = splitAnswer(answer, chunk.length);
    // the same language as asked: nothing to translate
    if (from && from.toLowerCase().startsWith(target)) return { found, from };
    if (parts) chunk.forEach((line, i) => found.set(line, parts[i]));
    else for (const line of chunk) found.set(line, await ask(line));
  }
  return { found, from };
}

async function deepl(lines: string[], target: Target, key: string): Promise<{ found: Map<string, string>; from?: string }> {
  const body = new URLSearchParams({ target_lang: target.toUpperCase() });
  for (const line of lines) body.append("text", line);
  const response = await net.fetch(`${deeplHost(key)}/v2/translate`, {
    method: "POST",
    headers: { authorization: `DeepL-Auth-Key ${key}`, "content-type": "application/x-www-form-urlencoded" },
    body: body.toString(),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (response.status === 403) throw new Error("Clé DeepL refusée : vérifiez-la dans les Réglages.");
  if (response.status === 456) throw new Error("Le quota DeepL du mois est épuisé.");
  if (!response.ok) throw new Error(`DeepL ${response.status}`);
  const answer = (await response.json()) as { translations?: { text: string; detected_source_language?: string }[] };
  const found = new Map<string, string>();
  answer.translations?.forEach((translation, i) => found.set(lines[i], translation.text));
  return { found, from: answer.translations?.[0]?.detected_source_language?.toLowerCase() };
}

const cacheDir = () => path.join(app.getPath("userData"), "translations");

/**
 * Each line's translation (null where it says the same thing), and the language the lyrics are in. `same`
 * when they are already in the language asked.
 */
export async function translateLyrics(raw: unknown): Promise<{ lines: (string | null)[]; from?: string; same: boolean; service: string }> {
  const input = (raw ?? {}) as { lines?: unknown };
  const lines = Array.isArray(input.lines) ? input.lines.filter((line): line is string => typeof line === "string").slice(0, 400) : [];
  const settings = translationSettings();
  const service = settings.service === "deepl" && settings.deeplKey ? "deepl" : "mymemory";
  const wanted = linesToTranslate(lines);
  if (wanted.length === 0) return { lines: lines.map(() => null), same: false, service };

  const key = createHash("sha1").update(`${service}|${settings.target}|${wanted.join("\n")}`).digest("hex");
  const file = path.join(cacheDir(), `${key}.json`);
  let saved = await fs
    .readFile(file, "utf8")
    .then((text) => JSON.parse(text) as { found: [string, string][]; from?: string })
    .catch(() => null);
  if (!saved) {
    const result = service === "deepl" ? await deepl(wanted, settings.target, settings.deeplKey) : await myMemory(wanted, settings.target);
    saved = { found: [...result.found], from: result.from };
    await fs.mkdir(cacheDir(), { recursive: true }).catch(() => undefined);
    await fs.writeFile(file, JSON.stringify(saved)).catch(() => undefined);
  }
  const same = Boolean(saved.from?.toLowerCase().startsWith(settings.target)) && saved.found.length === 0;
  return { lines: mapTranslations(lines, new Map(saved.found)), from: saved.from, same, service };
}
