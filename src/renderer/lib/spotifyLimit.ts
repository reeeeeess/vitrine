// Spotify's "Too many requests", for the page and the main process alike: which part of the API a pause
// covers, how long it lasts, and how to say it. Spotify may block one part for hours (the library, an
// artist's albums…) while the rest still answers, so a pause is kept per part, not for the whole app.

export const API_BASE = "https://api.spotify.com/v1";

/** The part of the API a request belongs to: its path, identifiers and query left out. */
export function areaOf(url: string): string {
  const path = url.startsWith("https://") ? new URL(url).pathname.replace(/^\/v1(?=\/|$)/, "") : url.split("?")[0];
  // Spotify's own words are lowercase (me, playlists, recently-played); identifiers are not
  return path
    .split("/")
    .map((segment) => (segment === "" || /^[a-z][a-z-]*$/.test(segment) ? segment : "{id}"))
    .join("/");
}

const AREA_NAMES: [RegExp, string][] = [
  [/^\/me\/playlists/, "vos playlists"],
  [/^\/me\/albums/, "vos albums"],
  [/^\/me\/tracks/, "vos titres likés"],
  [/^\/me\/top/, "vos tops"],
  [/^\/me\/following/, "vos artistes suivis"],
  [/^\/me\/player\/recently-played/, "l'historique"],
  [/^\/me\/player\/queue/, "la file d'attente"],
  [/^\/me\/player/, "le lecteur"],
  [/^\/me$/, "votre profil"],
  [/^\/search/, "la recherche"],
  [/^\/artists/, "les pages d'artiste"],
  [/^\/albums/, "les albums"],
  [/^\/(playlists|users)/, "les playlists"],
  [/^\/tracks/, "les titres"],
];

/** What a part of the API is, in the person's words. */
export const areaName = (area: string) => AREA_NAMES.find(([pattern]) => pattern.test(area))?.[1] ?? "une partie de Spotify";

/** How long Spotify asks to wait, in ms: its Retry-After, or a growing guess when it says nothing. */
export function pauseLength(retryAfter: string | null, strikes: number): number {
  const seconds = retryAfter === null || retryAfter.trim() === "" ? NaN : Number(retryAfter);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.max(1, seconds) * 1000;
  return Math.min(5_000 * 2 ** strikes, 120_000);
}

/** "12 min", "18 h 20" */
export function formatWait(ms: number): string {
  const minutes = Math.max(1, Math.ceil(ms / 60_000));
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, "0")}`;
}

/** What the person reads while Spotify makes one part of Vitrine wait. */
export function pauseMessage(until: number, area: string, now = Date.now()): string {
  const left = until - now;
  if (left < 60_000) return `Spotify demande à Vitrine de ralentir (${areaName(area)}) : reprise automatique dans quelques secondes.`;
  const at = new Date(until).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  return `Spotify bloque ${areaName(area)} pour Vitrine (trop de demandes) : reprise automatique à ${at} (dans ${formatWait(left)}).`;
}

/** The pauses Spotify asked for, part by part. */
export class PauseBook {
  private readonly until = new Map<string, number>();

  constructor(saved: Record<string, number> = {}, now = Date.now()) {
    for (const [area, until] of Object.entries(saved)) if (Number(until) > now) this.until.set(area, Number(until));
  }

  /** When the pause covering this request ends, or 0 when there is none. */
  get(url: string, now = Date.now()): number {
    const until = this.until.get(areaOf(url)) ?? 0;
    return until > now ? until : 0;
  }

  /** Records a pause; false when a longer one was already known. */
  set(url: string, until: number): boolean {
    const area = areaOf(url);
    if ((this.until.get(area) ?? 0) >= until) return false;
    this.until.set(area, until);
    return true;
  }

  /** The pauses still running, the longest first. */
  active(now = Date.now()): [area: string, until: number][] {
    return [...this.until].filter(([, until]) => until > now).sort((a, b) => b[1] - a[1]);
  }

  toJSON(now = Date.now()): Record<string, number> {
    return Object.fromEntries(this.active(now));
  }
}
