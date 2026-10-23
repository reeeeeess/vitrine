import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

// a Last.fm that checks each request as the real one does: the key, then the signature (sorted parameters,
// the secret at the end, MD5), then the method
const KEY = "0123456789abcdef0123456789abcdef";
const SECRET = "fedcba9876543210fedcba9876543210";
let authorised = false;
const seen: Record<string, string>[] = [];
const lastfm = async (url: string, init?: { method?: string; body?: string }) => {
  const params = Object.fromEntries(new URLSearchParams(init?.body ?? new URL(url).search));
  seen.push(params);
  const json = (body: unknown) => ({ ok: true, status: 200, json: async () => body });
  if (params.api_key !== KEY) return json({ error: 10, message: "Invalid API key - You must be granted a valid key by last.fm" });
  const signed = Object.keys(params).filter((key) => key !== "format" && key !== "api_sig").sort().map((key) => key + params[key]).join("");
  if (createHash("md5").update(signed + SECRET, "utf8").digest("hex") !== params.api_sig) return json({ error: 13, message: "Invalid method signature supplied" });
  switch (params.method) {
    case "auth.getMobileSession":
      if (init?.method !== "POST") return json({ error: 3, message: "Invalid Method" });
      return params.username === "sam" && params.password === "mot de passe é" ? json({ session: { name: "sam", key: "cle-de-session" } }) : json({ error: 4, message: "Authentication Failed - You do not have permissions to access the service" });
    case "auth.getToken":
      return json({ token: "jeton" });
    case "auth.getSession":
      if (!authorised) {
        authorised = true;
        return json({ error: 14, message: "This token has not been authorized" });
      }
      return json({ session: { name: "sam", key: "cle-navigateur" } });
    case "track.scrobble":
      return json({ scrobbles: { "@attr": { accepted: 1 } } });
    default:
      return json({ error: 3, message: "Invalid Method" });
  }
};
const opened: string[] = [];
vi.mock("electron", () => ({ net: { fetch: (url: string, init?: { method?: string; body?: string }) => lastfm(url, init) }, shell: { openExternal: async (url: string) => void opened.push(url) } }));
let config: Record<string, unknown> = {};
vi.mock("../electron/config", () => ({ readConfig: () => config, updateConfig: (change: Record<string, unknown>) => (config = { ...config, ...change }) }));
const { connectLastfm, lastfmKey, lastfmStatus, loginLastfm, scrobble, setLastfmKeys } = await import("../electron/lastfm");

describe("v1.0.1 : connexion à Last.fm", () => {
  beforeEach(() => {
    config = {};
    authorised = false;
    seen.length = 0;
    opened.length = 0;
  });

  it("lit une clé collée avec ce qu'il y a autour", () => {
    expect(lastfmKey(`API key: ${KEY.toUpperCase()}  `)).toBe(KEY);
    expect(lastfmKey("pas une clé")).toBe("");
    expect(() => setLastfmKeys({ apiKey: "abc", secret: SECRET })).toThrow(/32 caractères/);
  });

  it("nom d'utilisateur et mot de passe : connecté, mot de passe jamais gardé", async () => {
    setLastfmKeys({ apiKey: `API key ${KEY}`, secret: SECRET });
    const status = await loginLastfm({ username: " sam ", password: "mot de passe é" });
    expect(status).toMatchObject({ connected: true, user: "sam" });
    expect(JSON.stringify(config)).not.toContain("mot de passe");
  });

  it("dit clairement ce qui ne va pas", async () => {
    setLastfmKeys({ apiKey: KEY, secret: SECRET });
    await expect(loginLastfm({ username: "sam", password: "faux" })).rejects.toThrow("Last.fm refuse ce nom d'utilisateur ou ce mot de passe.");
    setLastfmKeys({ apiKey: KEY, secret: "0".repeat(32) });
    await expect(loginLastfm({ username: "sam", password: "mot de passe é" })).rejects.toThrow("Last.fm refuse le secret partagé");
    setLastfmKeys({ apiKey: "1".repeat(32), secret: SECRET });
    await expect(loginLastfm({ username: "sam", password: "x" })).rejects.toThrow("Last.fm refuse la clé de l'application");
  });

  it("par le navigateur : la page d'autorisation s'ouvre, puis la session arrive", async () => {
    setLastfmKeys({ apiKey: KEY, secret: SECRET });
    const status = await connectLastfm();
    expect(opened).toEqual([`https://www.last.fm/api/auth/?api_key=${KEY}&token=jeton`]);
    expect(status).toMatchObject({ connected: true, user: "sam" });
  }, 15_000);

  it("une écoute part, signée, avec la session", async () => {
    setLastfmKeys({ apiKey: KEY, secret: SECRET });
    await loginLastfm({ username: "sam", password: "mot de passe é" });
    await scrobble({ artist: "Vacra", track: "Fille à Papa", album: "Fille à Papa", timestamp: 1_760_000_000, durationMs: 180_000 });
    const sent = seen.at(-1)!;
    expect(sent).toMatchObject({ method: "track.scrobble", sk: "cle-de-session", "artist[0]": "Vacra", "track[0]": "Fille à Papa" });
    expect(lastfmStatus().waiting).toBe(0);
  });
});
