import { afterEach, describe, expect, it, vi } from "vitest";

const reply = (status: number, body: unknown = {}, headers: Record<string, string> = {}) => new Response(status === 204 ? null : JSON.stringify(body), { status, headers });
const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>();
vi.stubGlobal("window", { vitrine: { auth: { token: async () => "jeton" } } });
vi.stubGlobal("fetch", fetchMock);
const api = await import("../src/renderer/lib/spotify");

const calls = () => fetchMock.mock.calls.map(([url, init]) => `${init?.method ?? "GET"} ${url.replace("https://api.spotify.com/v1", "")}`);

describe("v1.0 : les règles Spotify de 2026 pour les applis en mode développement", () => {
  afterEach(() => fetchMock.mockReset());

  it("like et unlike par la bibliothèque générique (URI Spotify)", async () => {
    fetchMock.mockImplementation(async () => reply(200));
    await api.saveTrack("abc");
    await api.removeTrack("abc");
    expect(calls()).toEqual(["PUT /me/library?uris=spotify%3Atrack%3Aabc", "DELETE /me/library?uris=spotify%3Atrack%3Aabc"]);
  });

  it("une appli plus ancienne sans la bibliothèque générique : les anciens points d'accès", async () => {
    fetchMock.mockResolvedValueOnce(reply(403, { error: { status: 403, message: "Forbidden" } })).mockResolvedValueOnce(reply(200));
    await api.saveTrack("def");
    expect(calls()).toEqual(["PUT /me/library?uris=spotify%3Atrack%3Adef", "PUT /me/tracks?ids=def"]);
  });

  it("« est-ce liké ? » 40 titres au plus par question, dans l'ordre", async () => {
    fetchMock.mockImplementation(async (url) => reply(200, new URL(url).searchParams.get("uris")!.split(",").map((uri) => uri.endsWith("1"))));
    const ids = Array.from({ length: 45 }, (_, i) => `t${i}`);
    const answer = await api.areSaved(ids);
    expect(answer).toHaveLength(40);
    expect(answer[1]).toBe(true);
    expect(answer[2]).toBe(false);
    expect(calls()[0]).toMatch(/^GET \/me\/library\/contains\?uris=spotify%3Atrack%3At0,/);
  });

  it("un quota épuisé ne se redemande pas, et le dit", async () => {
    fetchMock.mockResolvedValue(reply(429, { error: { status: 429, message: "Too many requests", reason: "QUOTA_EXCEEDED" } }));
    await expect(api.recentlyPlayed(17)).rejects.toThrow(api.QUOTA_MESSAGE);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("une limite de débit ordinaire se distingue d'un quota", async () => {
    expect(await api.quotaExceeded(reply(429, { error: { status: 429, message: "API rate limit exceeded" } }))).toBe(false);
    expect(await api.quotaExceeded(reply(429, { error: { reason: "QUOTA_EXCEEDED" } }))).toBe(true);
    expect(await api.quotaExceeded(new Response("pas du JSON", { status: 429 }))).toBe(false);
  });

  it("la playlist d'un autre : son en-tête, sans ses titres que Spotify garde", async () => {
    fetchMock.mockImplementation(async (url) =>
      url.endsWith("/playlists/autre")
        ? reply(200, { id: "autre", uri: "spotify:playlist:autre", name: "Top Hits", owner: { id: "spotify", display_name: "Spotify" }, items: { total: 50 }, images: [] })
        : reply(403, { error: { status: 403, message: "Forbidden" } }),
    );
    const result = await api.playlist("autre");
    expect(result.collection.name).toBe("Top Hits");
    expect(result.collection.total).toBe(50);
    expect(result.tracks).toEqual([]);
    expect(result.closed).toBe(true);
  });
});
