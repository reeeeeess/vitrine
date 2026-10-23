// Keeps Vitrine within Spotify's request limit. Spotify counts an app's requests over a rolling 30 s and,
// past its limit, answers 429 with how long to wait; asking again during that pause only extends it.
// So: nothing leaves while the pause lasts, a few requests at a time otherwise, and the same reading
// asked twice within a minute (the library by the home, the roulette and the library page) is asked once.
import { createStore } from "./store";

/** Spotify's pause: no request leaves before `until`; `resumed` changes when a long pause ends. */
export const rateLimit = createStore<{ until: number; resumed: number }>({ until: 0, resumed: 0 });

export const isRateLimited = (now = Date.now()) => rateLimit.get().until > now;

/** How long Spotify asks to wait, in ms: its Retry-After, or a growing guess when it says nothing. */
export function pauseLength(retryAfter: string | null, strikes: number): number {
  const seconds = retryAfter === null || retryAfter.trim() === "" ? NaN : Number(retryAfter);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.max(1, seconds) * 1000;
  return Math.min(5_000 * 2 ** strikes, 120_000);
}

/** What the person reads while Spotify makes Vitrine wait. */
export function pauseMessage(until: number, now = Date.now()): string {
  const left = until - now;
  if (left < 60_000) return "Spotify demande à Vitrine de ralentir : reprise automatique dans quelques secondes.";
  const at = new Date(until).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  return `Spotify limite les demandes de Vitrine pour l'instant : reprise automatique vers ${at} (dans ${Math.ceil(left / 60_000)} min).`;
}

let resumeTimer: ReturnType<typeof setTimeout> | undefined;

/** Starts (or lengthens) Spotify's pause, and says when it is over so that failed pages load again. */
export function pauseUntil(until: number, now = Date.now()): void {
  if (until <= rateLimit.get().until) return;
  rateLimit.set({ until });
  clearTimeout(resumeTimer);
  resumeTimer = setTimeout(() => rateLimit.set({ resumed: Date.now() }), until - now + 250);
}

/** At most `limit` tasks at once; the others wait their turn, in order. */
export class Gate {
  private active = 0;
  private readonly waiting: (() => void)[] = [];

  constructor(private readonly limit: number) {}

  async run<T>(task: () => Promise<T>): Promise<T> {
    if (this.active < this.limit) this.active++;
    else await new Promise<void>((resolve) => this.waiting.push(resolve));
    try {
      return await task();
    } finally {
      // the slot goes straight to the next in line, so no newcomer slips in between
      const next = this.waiting.shift();
      if (next) next();
      else this.active--;
    }
  }
}

/** Answers that stay good for `ttl` ms; a request already on its way is shared, a failed one is forgotten. */
export class ShortCache {
  private readonly entries = new Map<string, { at: number; value: Promise<unknown> }>();

  constructor(
    private readonly ttl: number,
    private readonly max = 200,
  ) {}

  get<T>(key: string, load: () => Promise<T>, now = Date.now()): Promise<T> {
    const hit = this.entries.get(key);
    if (hit && now - hit.at < this.ttl) return hit.value as Promise<T>;
    const value = load();
    this.entries.delete(key);
    this.entries.set(key, { at: now, value });
    value.catch(() => this.entries.get(key)?.value === value && this.entries.delete(key));
    if (this.entries.size > this.max) this.entries.delete(this.entries.keys().next().value as string);
    return value;
  }

  clear(): void {
    this.entries.clear();
  }
}
