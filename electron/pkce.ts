// The pieces of Spotify's Authorization Code with PKCE flow that do not touch Electron, kept apart
// so they can be tested. No client secret is involved: a desktop app cannot keep one.
import { createHash, randomBytes } from "node:crypto";

export const REDIRECT_PORT = 8898;
export const REDIRECT_URI = `http://127.0.0.1:${REDIRECT_PORT}/callback`;

export const SCOPES = [
  // the Web Playback SDK
  "streaming",
  "user-read-email",
  "user-read-private",
  // playback control, on this computer or another Connect device
  "user-read-playback-state",
  "user-modify-playback-state",
  "user-read-currently-playing",
  // home, library and stats
  "user-read-recently-played",
  "user-top-read",
  "playlist-read-private",
  "playlist-read-collaborative",
  // creating playlists and adding tracks to them
  "playlist-modify-public",
  "playlist-modify-private",
  "user-library-read",
  "user-library-modify",
];

export interface Tokens {
  clientId: string;
  accessToken: string;
  refreshToken: string;
  /** epoch milliseconds */
  expiresAt: number;
}

export function base64url(buffer: Buffer): string {
  return buffer.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function challengeFor(verifier: string): string {
  return base64url(createHash("sha256").update(verifier).digest());
}

export function createPkcePair(): { verifier: string; challenge: string } {
  const verifier = base64url(randomBytes(64));
  return { verifier, challenge: challengeFor(verifier) };
}

export function randomState(): string {
  return base64url(randomBytes(16));
}

export function isClientId(value: string): boolean {
  return /^[0-9a-f]{32}$/i.test(value);
}

export function authorizeUrl(clientId: string, challenge: string, state: string): string {
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: REDIRECT_URI,
    code_challenge_method: "S256",
    code_challenge: challenge,
    state,
    scope: SCOPES.join(" "),
  });
  return `https://accounts.spotify.com/authorize?${params.toString()}`;
}

/** Spotify may or may not rotate the refresh token; keep the previous one when it does not. */
export function parseTokenResponse(body: unknown, clientId: string, previousRefreshToken = "", now = Date.now()): Tokens {
  const data = (body ?? {}) as Record<string, unknown>;
  const accessToken = typeof data.access_token === "string" ? data.access_token : "";
  const refreshToken = typeof data.refresh_token === "string" ? data.refresh_token : previousRefreshToken;
  const expiresIn = typeof data.expires_in === "number" ? data.expires_in : 3600;
  if (!accessToken || !refreshToken) {
    const reason = typeof data.error_description === "string" ? data.error_description : "réponse incomplète";
    throw new Error(`Spotify a refusé la connexion : ${reason}`);
  }
  return { clientId, accessToken, refreshToken, expiresAt: now + expiresIn * 1000 };
}
