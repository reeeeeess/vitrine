// Signs in to Spotify in the system browser and keeps the session. The browser comes back to a
// one-shot HTTP server on 127.0.0.1:8898; the refresh token is stored encrypted with the OS keychain
// (safeStorage) and never reaches the renderer, which only ever gets short-lived access tokens.
import { app, safeStorage, shell } from "electron";
import { createServer, type Server } from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import {
  authorizeUrl,
  createPkcePair,
  isClientId,
  parseTokenResponse,
  randomState,
  REDIRECT_PORT,
  REDIRECT_URI,
  type Tokens,
} from "./pkce";

const TOKEN_URL = "https://accounts.spotify.com/api/token";
const LOGIN_TIMEOUT_MS = 5 * 60_000;
const REFRESH_MARGIN_MS = 60_000;

export interface AuthStatus {
  loggedIn: boolean;
  clientId: string;
  /** a Client ID was built into the app, so the person is not asked for one */
  clientIdBuiltIn: boolean;
  /** false when the OS offers no keychain: the session then lasts until the app quits */
  persistent: boolean;
}

const page = (title: string, text: string) => `<!doctype html><html lang="fr"><meta charset="utf-8">
<title>Vitrine</title><body style="margin:0;height:100vh;display:grid;place-items:center;background:#000;color:#fff;
font-family:system-ui,-apple-system,'Segoe UI',sans-serif"><div style="text-align:center"><h1 style="font-size:28px">${title}</h1>
<p style="color:#9ca3af">${text}</p></div></body></html>`;

export class AuthManager {
  private tokens: Tokens | null = null;
  private refreshing: Promise<string> | null = null;
  private server: Server | null = null;
  private cancelPending: ((error: Error) => void) | null = null;
  private readonly sessionFile = path.join(app.getPath("userData"), "session.bin");
  private readonly configFile = path.join(app.getPath("userData"), "config.json");
  private readonly builtInClientId = (process.env.VITRINE_CLIENT_ID ?? "").trim();

  async load(): Promise<void> {
    if (!safeStorage.isEncryptionAvailable()) return;
    try {
      const raw = await fs.readFile(this.sessionFile);
      const saved = JSON.parse(safeStorage.decryptString(raw)) as Tokens;
      if (saved.refreshToken && saved.clientId) this.tokens = saved;
    } catch {
      // no session yet, or one this keychain can no longer read
    }
  }

  async status(): Promise<AuthStatus> {
    return {
      loggedIn: this.tokens !== null,
      clientId: this.tokens?.clientId ?? (await this.savedClientId()) ?? this.builtInClientId,
      clientIdBuiltIn: isClientId(this.builtInClientId),
      persistent: safeStorage.isEncryptionAvailable(),
    };
  }

  async login(requestedClientId: string): Promise<AuthStatus> {
    const clientId = (requestedClientId || this.builtInClientId).trim();
    if (!isClientId(clientId)) throw new Error("Ce Client ID n'a pas le bon format (32 caractères hexadécimaux).");
    this.abortPendingLogin();

    const { verifier, challenge } = createPkcePair();
    const state = randomState();
    const code = await this.waitForCode(state, () => shell.openExternal(authorizeUrl(clientId, challenge, state)));
    const body = await this.post({
      grant_type: "authorization_code",
      code,
      redirect_uri: REDIRECT_URI,
      client_id: clientId,
      code_verifier: verifier,
    });
    this.tokens = parseTokenResponse(body, clientId);
    await Promise.all([this.save(), this.saveClientId(clientId)]);
    return this.status();
  }

  async logout(): Promise<void> {
    this.abortPendingLogin();
    this.tokens = null;
    await fs.rm(this.sessionFile, { force: true });
  }

  /** A valid access token, refreshed when it is about to expire or when `force` asks. */
  async accessToken(force = false): Promise<string> {
    const tokens = this.tokens;
    if (!tokens) throw new Error("Non connecté à Spotify.");
    if (!force && tokens.expiresAt - REFRESH_MARGIN_MS > Date.now()) return tokens.accessToken;
    this.refreshing ??= this.refresh(tokens).finally(() => {
      this.refreshing = null;
    });
    return this.refreshing;
  }

  private async refresh(tokens: Tokens): Promise<string> {
    try {
      const body = await this.post({
        grant_type: "refresh_token",
        refresh_token: tokens.refreshToken,
        client_id: tokens.clientId,
      });
      this.tokens = parseTokenResponse(body, tokens.clientId, tokens.refreshToken);
      await this.save();
      return this.tokens.accessToken;
    } catch (error) {
      // a refresh token Spotify revoked will not come back: sign out so the login screen shows
      if (error instanceof RevokedError) await this.logout();
      throw error;
    }
  }

  private async post(form: Record<string, string>): Promise<unknown> {
    const response = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(form).toString(),
    });
    const body: unknown = await response.json().catch(() => ({}));
    if (response.status === 400 && (body as { error?: string }).error === "invalid_grant") {
      throw new RevokedError("La session Spotify a expiré, reconnectez-vous.");
    }
    if (!response.ok) {
      const description = (body as { error_description?: string }).error_description ?? response.statusText;
      throw new Error(`Spotify a refusé la connexion : ${description}`);
    }
    return body;
  }

  private waitForCode(state: string, openBrowser: () => Promise<void>): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const finish = (error: Error | null, code?: string) => {
        clearTimeout(timer);
        this.cancelPending = null;
        this.server?.close();
        this.server = null;
        if (error) reject(error);
        else resolve(code ?? "");
      };
      const timer = setTimeout(() => finish(new Error("Connexion abandonnée : délai dépassé.")), LOGIN_TIMEOUT_MS);
      this.cancelPending = (error) => finish(error);

      const server = createServer((request, response) => {
        const url = new URL(request.url ?? "/", REDIRECT_URI);
        if (url.pathname !== "/callback") {
          response.writeHead(404).end();
          return;
        }
        const error = url.searchParams.get("error");
        const code = url.searchParams.get("code");
        const ok = !error && code && url.searchParams.get("state") === state;
        response.writeHead(ok ? 200 : 400, { "content-type": "text/html; charset=utf-8" });
        response.end(
          ok
            ? page("Connecté à Spotify", "Vous pouvez fermer cet onglet et revenir dans Vitrine.")
            : page("Connexion refusée", "Revenez dans Vitrine pour réessayer."),
        );
        if (ok) finish(null, code);
        else finish(new Error(error === "access_denied" ? "Connexion refusée dans Spotify." : "Réponse de Spotify invalide."));
      });
      server.on("error", (error: NodeJS.ErrnoException) =>
        finish(
          error.code === "EADDRINUSE"
            ? new Error(`Le port ${REDIRECT_PORT} est déjà utilisé par une autre application.`)
            : error,
        ),
      );
      this.server = server;
      server.listen(REDIRECT_PORT, "127.0.0.1", () => {
        openBrowser().catch((error: Error) => finish(error));
      });
    });
  }

  private abortPendingLogin(): void {
    this.cancelPending?.(new Error("Connexion remplacée par une nouvelle tentative."));
  }

  private async save(): Promise<void> {
    if (!this.tokens || !safeStorage.isEncryptionAvailable()) return;
    await fs.mkdir(path.dirname(this.sessionFile), { recursive: true });
    await fs.writeFile(this.sessionFile, safeStorage.encryptString(JSON.stringify(this.tokens)), { mode: 0o600 });
  }

  private async savedClientId(): Promise<string | undefined> {
    try {
      const config = JSON.parse(await fs.readFile(this.configFile, "utf8")) as { clientId?: unknown };
      return typeof config.clientId === "string" && isClientId(config.clientId) ? config.clientId : undefined;
    } catch {
      return undefined;
    }
  }

  private async saveClientId(clientId: string): Promise<void> {
    await fs.mkdir(path.dirname(this.configFile), { recursive: true });
    await fs.writeFile(this.configFile, JSON.stringify({ clientId }, null, 2));
  }
}

class RevokedError extends Error {}
