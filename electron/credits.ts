// The credits of a track (D5), from MusicBrainz by its ISRC: who wrote it, produced it, mixed it, played on
// it. MusicBrainz asks to be named and to be asked once a second at most; the answers are kept on disk
// (userData/credits), so each track is asked once.
import { promises as fs } from "node:fs";
import path from "node:path";
import { app, net } from "electron";
import { creditsOf, isEmpty, workOf, type Credits } from "./creditsParse";

const API = "https://musicbrainz.org/ws/2";
const SPACING_MS = 1100;
const TIMEOUT_MS = 10_000;

let last = 0;
let queue: Promise<unknown> = Promise.resolve();

/** One request at a time, a second apart (MusicBrainz's rule). */
function ask<T>(url: string): Promise<T | null> {
  const run = queue.then(async () => {
    const wait = last + SPACING_MS - Date.now();
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    last = Date.now();
    const response = await net.fetch(url, {
      headers: { "user-agent": `Vitrine/${app.getVersion()} ( https://github.com/reeeeeess/vitrine )`, accept: "application/json" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`MusicBrainz ${response.status}`);
    return (await response.json()) as T;
  });
  queue = run.catch(() => undefined);
  return run;
}

const cacheDir = () => path.join(app.getPath("userData"), "credits");

/** The credits of the recording with this ISRC; null when MusicBrainz does not know it. */
export async function fetchCredits(raw: unknown): Promise<Credits | null> {
  const isrc = typeof raw === "string" && /^[A-Z]{2}[A-Z0-9]{3}\d{7}$/i.test(raw) ? raw.toUpperCase() : null;
  if (!isrc) return null;
  const file = path.join(cacheDir(), `${isrc}.json`);
  const saved = await fs
    .readFile(file, "utf8")
    .then((text) => JSON.parse(text) as { credits: Credits | null })
    .catch(() => undefined);
  if (saved) return saved.credits;

  const found = await ask<{ recordings?: { relations?: unknown[] }[] }>(`${API}/isrc/${isrc}?inc=artist-rels+work-rels&fmt=json`);
  const relations = (found?.recordings?.[0]?.relations ?? []) as Parameters<typeof creditsOf>[0];
  const workId = workOf(relations);
  const work = workId ? await ask<{ relations?: unknown[] }>(`${API}/work/${workId}?inc=artist-rels&fmt=json`).catch(() => null) : null;
  const credits = found?.recordings?.length ? creditsOf(relations, (work?.relations ?? []) as Parameters<typeof creditsOf>[1]) : null;
  const result = credits && !isEmpty(credits) ? credits : null;
  await fs.mkdir(cacheDir(), { recursive: true }).catch(() => undefined);
  await fs.writeFile(file, JSON.stringify({ credits: result })).catch(() => undefined);
  return result;
}
