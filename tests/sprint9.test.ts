import { afterEach, describe, expect, it, vi } from "vitest";
import { Gate, pauseLength, pauseMessage, rateLimit, ShortCache } from "../src/renderer/lib/apiGate";
import * as api from "../src/renderer/lib/spotify";
import { pollDelay } from "../src/renderer/player/engine";

describe("Spotify's pause after too many requests", () => {
  it("waits what Spotify says, or longer and longer when it says nothing", () => {
    expect(pauseLength("7", 0)).toBe(7000);
    expect(pauseLength("0", 0)).toBe(1000);
    expect(pauseLength(null, 0)).toBe(5000);
    expect(pauseLength("", 2)).toBe(20_000);
    expect(pauseLength(null, 9)).toBe(120_000);
  });

  it("tells the person when it ends, in French", () => {
    const now = new Date(2026, 9, 23, 14, 0).getTime();
    expect(pauseMessage(now + 30_000, now)).toMatch(/quelques secondes/);
    expect(pauseMessage(now + 25 * 60_000, now)).toBe("Spotify limite les demandes de Vitrine pour l'instant : reprise automatique vers 14:25 (dans 25 min).");
  });
});

describe("Gate", () => {
  it("lets a few tasks run at once, the others in order", async () => {
    const gate = new Gate(2);
    let running = 0;
    let most = 0;
    const order: number[] = [];
    const task = (n: number) => async () => {
      running++;
      most = Math.max(most, running);
      await new Promise((resolve) => setTimeout(resolve, 5));
      order.push(n);
      running--;
      return n;
    };
    expect(await Promise.all([1, 2, 3, 4, 5].map((n) => gate.run(task(n))))).toEqual([1, 2, 3, 4, 5]);
    expect(most).toBe(2);
    expect(order.slice(2)).toEqual([3, 4, 5]);
  });

  it("frees the slot when a task fails", async () => {
    const gate = new Gate(1);
    await expect(gate.run(() => Promise.reject(new Error("non")))).rejects.toThrow("non");
    expect(await gate.run(async () => "ok")).toBe("ok");
  });
});

describe("ShortCache", () => {
  it("shares a reading for a while, then asks again", async () => {
    const cache = new ShortCache(60_000);
    const load = vi.fn(async () => "lu");
    await Promise.all([cache.get("a", load, 0), cache.get("a", load, 10)]);
    expect(load).toHaveBeenCalledTimes(1);
    await cache.get("a", load, 61_000);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("forgets failures and is emptied by a change", async () => {
    const cache = new ShortCache(60_000);
    await expect(cache.get("a", () => Promise.reject(new Error("raté")), 0)).rejects.toThrow();
    expect(await cache.get("a", async () => "bon", 1)).toBe("bon");
    cache.clear();
    expect(await cache.get("a", async () => "neuf", 2)).toBe("neuf");
  });
});

describe("asking Spotify what plays", () => {
  const base = { track: { durationMs: 200_000 } as never, paused: false, positionMs: 0, durationMs: 200_000, updatedAt: 0 };

  it("rarely while this computer's player reports its own state", () => {
    expect(pollDelay(base, true, 0)).toBe(15_000);
  });

  it("often while another device plays, and right when its track should end", () => {
    expect(pollDelay(base, false, 0)).toBe(5000);
    expect(pollDelay({ ...base, positionMs: 198_000 }, false, 0)).toBe(2400);
    expect(pollDelay({ ...base, positionMs: 200_000 }, false, 0)).toBe(1000);
  });

  it("in between when nothing plays", () => {
    expect(pollDelay({ ...base, paused: true }, false, 0)).toBe(8000);
    expect(pollDelay({ ...base, track: undefined }, false, 0)).toBe(8000);
  });
});

describe("the Web API client under Spotify's limit", () => {
  const reply = (status: number, body: unknown = {}, headers: Record<string, string> = {}) =>
    new Response(status === 204 ? null : JSON.stringify(body), { status, headers });
  const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>();
  vi.stubGlobal("window", { vitrine: { auth: { token: async () => "jeton" } } });
  vi.stubGlobal("fetch", fetchMock);

  afterEach(() => fetchMock.mockReset());

  it("asks a reading once when several pages want it at the same time", async () => {
    fetchMock.mockImplementation(async () => reply(200, { items: [] }));
    await Promise.all([api.topTracks("long_term", 7), api.topTracks("long_term", 7), api.topTracks("long_term", 7)]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("asks again after a change", async () => {
    fetchMock.mockImplementation(async () => reply(200, { items: [] }));
    await api.topTracks("long_term", 8);
    await api.saveTrack("abc").catch(() => undefined);
    await api.topTracks("long_term", 8);
    expect(fetchMock.mock.calls.filter(([url]) => url.includes("/me/top/tracks"))).toHaveLength(2);
  });

  it("waits a short pause out, then succeeds", async () => {
    fetchMock.mockResolvedValueOnce(reply(429, {}, { "retry-after": "1" })).mockResolvedValueOnce(reply(200, { items: [] }));
    const started = Date.now();
    expect(await api.topTracks("medium_term", 9)).toEqual([]);
    expect(Date.now() - started).toBeGreaterThanOrEqual(900);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not ask during a long pause, and says when it ends", async () => {
    fetchMock.mockResolvedValueOnce(reply(429, {}, { "retry-after": "3600" }));
    await expect(api.topTracks("short_term", 11)).rejects.toThrow(/reprise automatique vers/);
    expect(rateLimit.get().until).toBeGreaterThan(Date.now() + 3_500_000);
    await expect(api.topTracks("short_term", 12)).rejects.toMatchObject({ status: 429 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
