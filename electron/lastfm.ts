// Scrobbling to Last.fm (P7), with the person's own API key (last.fm/api/account/create): Vitrine is
// authorised once in the browser, then tells Last.fm what plays and sends each listen that counts. A listen
// that cannot be sent (offline) waits in the config, and goes with the next one.
import { net, shell } from "electron";
import { readConfig, updateConfig } from "./config";
import { scrobbleParams, signature, type Scrobble } from "./lastfmSign";

const API = "https://ws.audioscrobbler.com/2.0/";
const TIMEOUT_MS = 10_000;
/** listens kept while Last.fm cannot be reached, at most */
const WAITING_MAX = 200;

export interface LastfmSettings {
  apiKey: string;
  secret: string;
  sessionKey?: string;
  user?: string;
  waiting?: Scrobble[];
}

/** keys built into Vitrine (secrets VITRINE_LASTFM_KEY / VITRINE_LASTFM_SECRET at build time): nobody has to make their own */
const BUILT_IN = { apiKey: process.env.VITRINE_LASTFM_KEY ?? "", secret: process.env.VITRINE_LASTFM_SECRET ?? "" };

const settings = (): LastfmSettings => {
  const saved = { apiKey: "", secret: "", ...(readConfig().lastfm ?? {}) };
  return saved.apiKey && saved.secret ? saved : { ...saved, apiKey: saved.apiKey || BUILT_IN.apiKey, secret: saved.secret || BUILT_IN.secret };
};
const save = (change: Partial<LastfmSettings>) => updateConfig({ lastfm: { ...settings(), ...change } });

/** What the Settings page shows: never the secret nor the session. */
export function lastfmStatus(): { configured: boolean; builtIn: boolean; connected: boolean; user?: string; apiKey: string; waiting: number } {
  const current = settings();
  const builtIn = Boolean(BUILT_IN.apiKey && BUILT_IN.secret && current.apiKey === BUILT_IN.apiKey);
  return { configured: Boolean(current.apiKey && current.secret), builtIn, connected: Boolean(current.sessionKey), user: current.user, apiKey: builtIn ? "" : current.apiKey, waiting: current.waiting?.length ?? 0 };
}

/** A key or a secret as pasted: its 32 hexadecimal characters, whatever is around them ("API key: …"). */
export function lastfmKey(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.match(/[0-9a-f]{32}/i)?.[0].toLowerCase() ?? "";
}

export function setLastfmKeys(raw: unknown): ReturnType<typeof lastfmStatus> {
  const input = (raw ?? {}) as { apiKey?: unknown; secret?: unknown };
  const apiKey = lastfmKey(input.apiKey);
  if (typeof input.apiKey === "string" && input.apiKey.trim() && !apiKey) throw new Error("Cette clé Last.fm n'a pas le bon format : 32 caractères (chiffres et lettres de a à f).");
  if (typeof input.secret === "string" && input.secret.trim() && !lastfmKey(input.secret)) throw new Error("Ce secret Last.fm n'a pas le bon format : 32 caractères (chiffres et lettres de a à f).");
  const secret = lastfmKey(input.secret) || settings().secret;
  // new keys: the old session belongs to the old application
  save({ apiKey, secret, sessionKey: apiKey === settings().apiKey ? settings().sessionKey : undefined, user: apiKey === settings().apiKey ? settings().user : undefined });
  return lastfmStatus();
}

async function call<T>(method: string, params: Record<string, string>, post = false): Promise<T> {
  const current = settings();
  const all: Record<string, string> = { ...params, method, api_key: current.apiKey };
  all.api_sig = signature(all, current.secret);
  all.format = "json";
  const query = new URLSearchParams(all).toString();
  const response = await net.fetch(post ? API : `${API}?${query}`, {
    method: post ? "POST" : "GET",
    ...(post ? { body: query, headers: { "content-type": "application/x-www-form-urlencoded" } } : {}),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const body = (await response.json().catch(() => ({}))) as T & { error?: number; message?: string };
  if (body.error) {
    // 9: the session is no longer valid (Vitrine was removed from the person's Last.fm applications)
    if (body.error === 9) save({ sessionKey: undefined, user: undefined });
    throw new Error(`Last.fm : ${body.message ?? body.error}`);
  }
  if (!response.ok) throw new Error(`Last.fm ${response.status}`);
  return body;
}

let connecting: Promise<ReturnType<typeof lastfmStatus>> | null = null;

/** Opens Last.fm's page to authorise Vitrine, and waits (2 minutes at most) for the person to say yes. */
export function connectLastfm(): Promise<ReturnType<typeof lastfmStatus>> {
  // kept while it runs, forgotten once done (an attempt refused at once must not stay the answer)
  connecting ??= authorise().finally(() => (connecting = null));
  return connecting;
}

async function authorise(): Promise<ReturnType<typeof lastfmStatus>> {
  if (!lastfmStatus().configured) throw new Error("Entrez d'abord la clé et le secret de votre application Last.fm.");
  let token: string;
  try {
    ({ token } = await call<{ token: string }>("auth.getToken", {}));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/Invalid API key|suspended/i.test(message)) throw new Error("Last.fm refuse la clé de l'application : vérifiez-la (last.fm/api/accounts).");
    if (/Invalid method signature/i.test(message)) throw new Error("Last.fm refuse le secret partagé : vérifiez-le (last.fm/api/accounts).");
    throw error;
  }
  await shell.openExternal(`https://www.last.fm/api/auth/?api_key=${settings().apiKey}&token=${token}`);
  for (let i = 0; i < 40; i++) {
    await new Promise((resolve) => setTimeout(resolve, 3000));
    try {
      const { session } = await call<{ session: { key: string; name: string } }>("auth.getSession", { token });
      save({ sessionKey: session.key, user: session.name });
      return lastfmStatus();
    } catch {
      // not yet authorised: asked again in 3 s
    }
  }
  throw new Error("Last.fm n'a pas reçu votre accord dans les 2 minutes : réessayez, ou connectez-vous avec votre nom d'utilisateur et votre mot de passe.");
}

/**
 * Connects with the Last.fm user name (or e-mail) and password, without going through the browser
 * (auth.getMobileSession, over HTTPS). The password is sent to Last.fm only, once, and never kept.
 */
export async function loginLastfm(raw: unknown): Promise<ReturnType<typeof lastfmStatus>> {
  const input = (raw ?? {}) as { username?: unknown; password?: unknown };
  const username = typeof input.username === "string" ? input.username.trim() : "";
  const password = typeof input.password === "string" ? input.password : "";
  if (!lastfmStatus().configured) throw new Error("Entrez d'abord la clé et le secret de votre application Last.fm.");
  if (!username || !password) throw new Error("Entrez votre nom d'utilisateur Last.fm et votre mot de passe.");
  try {
    const { session } = await call<{ session: { key: string; name: string } }>("auth.getMobileSession", { username, password }, true);
    save({ sessionKey: session.key, user: session.name });
    return lastfmStatus();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // 4: wrong user name or password; 10 and 26: the application's key; 13: its secret
    if (/Authentication Failed|Invalid username|incorrect/i.test(message)) throw new Error("Last.fm refuse ce nom d'utilisateur ou ce mot de passe.");
    if (/Invalid API key|suspended/i.test(message)) throw new Error("Last.fm refuse la clé de l'application : vérifiez-la (last.fm/api/accounts).");
    if (/Invalid method signature/i.test(message)) throw new Error("Last.fm refuse le secret partagé : vérifiez-le (last.fm/api/accounts).");
    throw error;
  }
}

export function disconnectLastfm(): ReturnType<typeof lastfmStatus> {
  save({ sessionKey: undefined, user: undefined });
  return lastfmStatus();
}

const ready = () => {
  const current = settings();
  return current.apiKey && current.secret && current.sessionKey ? current : null;
};

/** "Listening now" on the person's Last.fm profile. */
export async function nowPlaying(raw: unknown): Promise<void> {
  const current = ready();
  const track = raw as Partial<Scrobble> | null;
  if (!current || !track?.artist || !track.track) return;
  await call("track.updateNowPlaying", { artist: track.artist, track: track.track, ...(track.album ? { album: track.album } : {}), sk: current.sessionKey! }, true).catch(() => undefined);
}

/** Sends a listen that counts, with those that waited. */
export async function scrobble(raw: unknown): Promise<void> {
  const current = ready();
  const item = raw as Partial<Scrobble> | null;
  if (!current || !item?.artist || !item.track || !item.timestamp) return;
  const listen: Scrobble = { artist: item.artist, track: item.track, album: item.album, timestamp: Math.round(item.timestamp), durationMs: item.durationMs ?? 0 };
  const batch = [...(current.waiting ?? []), listen].slice(-WAITING_MAX);
  try {
    for (let i = 0; i < batch.length; i += 50) await call("track.scrobble", { ...scrobbleParams(batch.slice(i, i + 50)), sk: current.sessionKey! }, true);
    save({ waiting: [] });
  } catch {
    save({ waiting: batch });
  }
}
