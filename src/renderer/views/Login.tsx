import { motion } from "framer-motion";
import { ExternalLink, Loader2, ShieldCheck } from "lucide-react";
import { useState } from "react";
import type { AuthStatus, DrmStatus } from "../global";
import { Logo, ThemeToggle } from "../components/Header";
import { errorMessage } from "../lib/format";

const REDIRECT_URI = "http://127.0.0.1:8898/callback";
const DASHBOARD = "https://developer.spotify.com/dashboard";

export function Login({ status, drm, onLoggedIn }: { status: AuthStatus; drm?: DrmStatus; onLoggedIn: (status: AuthStatus) => void }) {
  const [clientId, setClientId] = useState(status.clientId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const needsClientId = !status.clientIdBuiltIn;

  const login = async () => {
    setBusy(true);
    setError(undefined);
    try {
      onLoggedIn(await window.vitrine.auth.login(clientId.trim()));
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="relative flex h-full items-center justify-center overflow-hidden">
      <div className="drag absolute inset-x-0 top-0 h-16" />
      <div className={window.vitrine.platform === "darwin" ? "absolute right-6 top-4 z-10" : "absolute right-40 top-4 z-10"}>
        <ThemeToggle />
      </div>
      <div className="pointer-events-none absolute -left-40 top-1/4 h-[480px] w-[480px] rounded-full bg-red-600/25 blur-[140px]" />
      <div className="pointer-events-none absolute -right-32 bottom-0 h-[420px] w-[420px] rounded-full bg-indigo-600/20 blur-[140px]" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
        className="glass relative w-[min(520px,92vw)] rounded-3xl p-10"
      >
        <Logo />
        <h1 className="mt-8 font-display text-4xl leading-tight tracking-tight">
          Votre musique,
          <br />
          <span className="text-accent-gradient">en vitrine.</span>
        </h1>
        <p className="mt-3 text-sm text-gray-400">Connectez votre compte Spotify. La lecture sur cet ordinateur nécessite Spotify Premium.</p>

        {needsClientId && (
          <div className="mt-8 space-y-3">
            <ol className="space-y-2 text-sm text-gray-300">
              <li>
                1. Créez une application sur le{" "}
                <button className="inline-flex items-center gap-1 text-red-400 hover:underline" onClick={() => void window.vitrine.openExternal(DASHBOARD)}>
                  tableau de bord Spotify <ExternalLink className="h-3 w-3" />
                </button>
              </li>
              <li>
                2. Ajoutez l'URI de redirection <code className="rounded bg-white/10 px-1.5 py-0.5 text-xs text-white select-all">{REDIRECT_URI}</code>
              </li>
              <li>3. Cochez « Web API » et « Web Playback SDK », puis copiez le Client ID ici.</li>
            </ol>
            <input
              value={clientId}
              onChange={(event) => setClientId(event.target.value)}
              placeholder="Client ID (32 caractères)"
              spellCheck={false}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 font-mono text-sm text-white placeholder-gray-500 transition-all focus:border-red-500/50 focus:bg-white/10 focus:outline-none focus:ring-1 focus:ring-red-500/30"
            />
          </div>
        )}

        {error && <p className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</p>}

        <button
          onClick={() => void login()}
          disabled={busy || (needsClientId && clientId.trim().length === 0)}
          className="btn-primary mt-6 w-full"
        >
          {busy && <Loader2 className="h-5 w-5 animate-spin" />}
          {busy ? "Terminez la connexion dans votre navigateur…" : "Se connecter avec Spotify"}
        </button>

        <div className="mt-6 flex items-start gap-2 text-xs text-gray-500">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Connexion officielle Spotify, sans mot de passe stocké.{" "}
            {status.persistent ? "La session est chiffrée par le trousseau du système." : "Aucun trousseau système : la session durera jusqu'à la fermeture."}{" "}
            {drm && !drm.widevine && `(${drm.detail})`}
          </span>
        </div>
      </motion.div>
    </main>
  );
}
