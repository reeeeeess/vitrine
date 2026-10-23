// Keeps Vitrine within Spotify's request limit. Spotify counts an app's requests over a rolling 30 s and,
// past its limit, answers 429 with how long to wait, sometimes for hours, and for one part of the API
// only; asking again during that pause only extends it. So: nothing leaves for a paused part (even after
// a restart), a few requests at a time otherwise, the same reading asked twice within a minute is asked
// once, and a paused part shows its last known answer.
import { PauseBook } from "./spotifyLimit";
import { createStore } from "./store";

const SAVED_KEY = "vitrine.spotifyPauses";

function savedPauses(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(SAVED_KEY) ?? "{}") as Record<string, number>;
  } catch {
    return {};
  }
}

const book = new PauseBook(savedPauses());

/** The pauses Spotify asked for, part by part; `resumed` changes when one ends, so failed pages load again. */
export const rateLimit = createStore<{ paused: [area: string, until: number][]; resumed: number }>({ paused: book.active(), resumed: 0 });

/** When Spotify lets this request through again, or 0 when it may go now. */
export const pausedUntil = (url: string, now = Date.now()) => book.get(url, now);

export const isRateLimited = (url: string, now = Date.now()) => book.get(url, now) > 0;

const timers = new Map<number, ReturnType<typeof setTimeout>>();

function watchEnd(until: number, now: number): void {
  if (timers.has(until)) return;
  timers.set(
    until,
    setTimeout(() => {
      timers.delete(until);
      rateLimit.set({ paused: book.active(), resumed: Date.now() });
    }, until - now + 250),
  );
}

/** Starts (or lengthens) the pause of the part of the API this request belongs to. */
export function pauseUntil(url: string, until: number, now = Date.now()): void {
  if (!book.set(url, until)) return;
  rateLimit.set({ paused: book.active(now) });
  watchEnd(until, now);
  try {
    localStorage.setItem(SAVED_KEY, JSON.stringify(book.toJSON(now)));
  } catch {
    // not kept: a restart asks Spotify once more, and learns the pause again
  }
}

// pauses kept from the last run end by themselves too
for (const [, until] of book.active()) watchEnd(until, Date.now());

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

/**
 * Answers that stay good for `ttl` ms; a request already on its way is shared, a failed one is forgotten.
 * The last good answer of each reading is kept apart, for when Spotify makes that part wait.
 */
export class ShortCache {
  private readonly entries = new Map<string, { at: number; value: Promise<unknown> }>();
  private readonly good = new Map<string, unknown>();

  constructor(
    private readonly ttl: number,
    private readonly max = 120,
  ) {}

  get<T>(key: string, load: () => Promise<T>, now = Date.now()): Promise<T> {
    const hit = this.entries.get(key);
    if (hit && now - hit.at < this.ttl) return hit.value as Promise<T>;
    const value = load();
    this.entries.delete(key);
    this.entries.set(key, { at: now, value });
    value.then(
      (result) => {
        this.good.delete(key);
        this.good.set(key, result);
        if (this.good.size > this.max) this.good.delete(this.good.keys().next().value as string);
      },
      () => this.entries.get(key)?.value === value && this.entries.delete(key),
    );
    if (this.entries.size > this.max) this.entries.delete(this.entries.keys().next().value as string);
    return value;
  }

  /** The last good answer for this reading, however old, or undefined. */
  lastGood<T>(key: string): T | undefined {
    return this.good.get(key) as T | undefined;
  }

  /** After a change: readings are asked again (the last good answers stay, for a pause). */
  clear(): void {
    this.entries.clear();
  }
}
