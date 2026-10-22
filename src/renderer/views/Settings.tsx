import { CheckCircle2, Download, ExternalLink, Loader2, LogOut, RefreshCw } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import type { AppInfo, DiscordInfo } from "../global";
import { cn } from "../lib/cn";
import { errorMessage } from "../lib/format";
import type { Profile } from "../lib/spotify";
import { useStore } from "../lib/store";
import { setTheme, theme, type Theme } from "../lib/theme";
import { notify } from "../lib/ui";
import { updates } from "../lib/updates";
import { playback, retryLocalPlayback } from "../player/engine";

const REPO = "https://github.com/reeeeeess/vitrine";
const DISCORD_PORTAL = "https://discord.com/developers/applications";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
      <h2 className="kicker pb-4 font-semibold text-red-500">{title}</h2>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function Line({ label, hint, children }: { label: string; hint?: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-6">
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        {hint && <p className="mt-0.5 text-xs text-gray-400">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

function Switch({ on, onChange, label }: { on: boolean; onChange: (on: boolean) => void; label: string }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className={cn("relative h-7 w-12 shrink-0 rounded-full transition-colors", on ? "accent-bg" : "bg-white/15")}
    >
      <span className={cn("absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all", on ? "left-6" : "left-1")} />
    </button>
  );
}

const THEMES: { id: Theme; name: string; hint: string; swatches: string[] }[] = [
  { id: "movix", name: "Movix", hint: "Noir et rouge, Inter et Archivo Black", swatches: ["#000000", "#dc2626", "#ffffff"] },
  { id: "mystic", name: "Mystic", hint: "mysticsaba.com : noir chaud, ambre → rouge, Clash Display", swatches: ["#0a0908", "#f2a33c", "#ff3d2e", "#ede8dd"] },
];

const DISCORD_STATE: Record<DiscordInfo["state"], string> = {
  off: "Désactivé",
  connecting: "Connexion à Discord…",
  connected: "Connecté : votre écoute s'affiche sur Discord",
  unavailable: "En attente de Discord",
  error: "Erreur",
};

function DiscordSettings() {
  const [info, setInfo] = useState<DiscordInfo>();
  const [appId, setAppId] = useState("");

  useEffect(() => {
    let alive = true;
    const load = () =>
      window.vitrine.discord?.get().then((next) => {
        if (!alive) return;
        setInfo(next);
        setAppId((current) => current || next.appId);
      }, () => undefined);
    void load();
    const timer = setInterval(load, 3000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);

  const save = async (enabled: boolean) => {
    try {
      setInfo(await window.vitrine.discord.set({ enabled, appId }));
    } catch (error) {
      notify(errorMessage(error), "error");
    }
  };

  if (!info) return <Loader2 className="h-4 w-4 animate-spin text-gray-400" />;
  return (
    <>
      <Line label="Afficher « Écoute Vitrine » sur Discord" hint={info.enabled ? `${DISCORD_STATE[info.state]}${info.detail ? ` — ${info.detail}` : ""}` : "Le titre, l'artiste, la pochette et la progression, sur votre profil Discord."}>
        <Switch on={info.enabled} onChange={(on) => void save(on)} label="Discord Rich Presence" />
      </Line>
      <div>
        <label className="text-xs text-gray-400" htmlFor="discord-app-id">
          ID de l'application Discord (créez-en une, nommée « Vitrine », sur le{" "}
          <button className="inline-flex items-center gap-1 text-red-400 hover:underline" onClick={() => void window.vitrine.openExternal(DISCORD_PORTAL)}>
            portail développeur Discord <ExternalLink className="h-3 w-3" />
          </button>
          , puis copiez son « Application ID »)
        </label>
        <div className="mt-2 flex gap-2">
          <input
            id="discord-app-id"
            value={appId}
            onChange={(event) => setAppId(event.target.value.replace(/\D/g, ""))}
            placeholder="123456789012345678"
            inputMode="numeric"
            className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 font-mono text-sm text-white placeholder-gray-500 focus:border-red-500/50 focus:outline-none focus:ring-1 focus:ring-red-500/30"
          />
          <button onClick={() => void save(info.enabled || appId.length > 0)} disabled={appId === info.appId} className="btn-ghost min-h-0 px-4 py-2 text-sm disabled:opacity-40">
            Enregistrer
          </button>
        </div>
      </div>
    </>
  );
}

function UpdateSettings({ version }: { version?: string }) {
  const state = useStore(updates, (s) => s.state);
  const describe = () => {
    switch (state.status) {
      case "unsupported":
        return "Les mises à jour automatiques fonctionnent sur la version Windows installée.";
      case "checking":
        return "Recherche d'une nouvelle version…";
      case "downloading":
        return `Téléchargement de la version ${state.version ?? ""} : ${state.percent ?? 0} %`;
      case "ready":
        return `La version ${state.version ?? ""} est prête : elle s'installera à la fermeture, ou tout de suite.`;
      case "latest":
        return "Vous avez la dernière version.";
      case "error":
        return `Recherche impossible : ${state.message ?? "erreur inconnue"}`;
      default:
        return "Vitrine cherche les nouvelles versions au démarrage puis quelques fois par jour.";
    }
  };
  return (
    <Line label={`Version ${version ?? "…"}`} hint={describe()}>
      {state.status === "ready" ? (
        <button onClick={() => void window.vitrine.updates.install()} className="btn-primary min-h-0 px-4 py-2 text-sm">
          <Download className="h-4 w-4" />
          Redémarrer et installer
        </button>
      ) : (
        <button
          onClick={() => void window.vitrine.updates.check().then((next) => updates.set({ state: next }))}
          disabled={state.status === "unsupported" || state.status === "checking" || state.status === "downloading"}
          className="btn-ghost min-h-0 px-4 py-2 text-sm disabled:opacity-40"
        >
          {state.status === "checking" ? <Loader2 className="h-4 w-4 animate-spin" /> : state.status === "latest" ? <CheckCircle2 className="h-4 w-4" /> : <RefreshCw className="h-4 w-4" />}
          Rechercher
        </button>
      )}
    </Line>
  );
}

export function Settings({ profile, onLogout }: { profile?: Profile; onLogout: () => void }) {
  const current = useStore(theme, (s) => s.current);
  const sdk = useStore(playback, (s) => s.sdk);
  const sdkMessage = useStore(playback, (s) => s.sdkMessage);
  const [info, setInfo] = useState<AppInfo>();

  useEffect(() => {
    void window.vitrine.info?.().then(setInfo, () => undefined);
  }, []);

  const player =
    sdk === "ready" ? "Prêt : « Vitrine (cet ordinateur) » est disponible dans Spotify Connect." : sdk === "loading" ? "Démarrage du lecteur…" : (sdkMessage ?? "Lecteur intégré indisponible : Vitrine pilote vos autres appareils.");

  return (
    <div className="mx-auto max-w-3xl animate-skeleton-fade space-y-6">
      <h1 className="px-1 font-display text-4xl tracking-tight">Réglages</h1>

      <Section title="Apparence">
        <div className="grid grid-cols-2 gap-3">
          {THEMES.map((option) => (
            <button
              key={option.id}
              onClick={() => setTheme(option.id)}
              aria-pressed={current === option.id}
              className={cn("rounded-2xl border p-4 text-left transition-colors", current === option.id ? "border-red-500/70 bg-white/[0.06]" : "border-white/10 hover:border-white/25")}
            >
              <span className="flex gap-1.5">
                {option.swatches.map((color) => (
                  <span key={color} className="h-6 w-6 rounded-full ring-1 ring-white/20" style={{ background: color }} />
                ))}
              </span>
              <span className="mt-3 block font-semibold">{option.name}</span>
              <span className="mt-0.5 block text-xs text-gray-400">{option.hint}</span>
            </button>
          ))}
        </div>
      </Section>

      <Section title="Lecture">
        <Line label="Lecteur intégré" hint={player}>
          {sdk !== "ready" && sdk !== "loading" && (
            <button onClick={retryLocalPlayback} className="btn-ghost min-h-0 shrink-0 px-4 py-2 text-sm">
              <RefreshCw className="h-4 w-4" />
              Réessayer
            </button>
          )}
        </Line>
      </Section>

      <Section title="Discord">
        <DiscordSettings />
      </Section>

      <Section title="Mises à jour">
        <UpdateSettings version={info?.version} />
      </Section>

      <Section title="Compte Spotify">
        <Line label={profile?.name ?? "…"} hint={profile?.product === "premium" ? "Spotify Premium" : profile?.product ? `Spotify ${profile.product}` : undefined}>
          <button onClick={onLogout} className="btn-ghost min-h-0 px-4 py-2 text-sm">
            <LogOut className="h-4 w-4" />
            Se déconnecter
          </button>
        </Line>
      </Section>

      <Section title="À propos">
        <Line label="Vitrine PC" hint="Lecteur Spotify de bureau sur l'API officielle de Spotify. Paroles : LRCLIB.">
          <button onClick={() => void window.vitrine.openExternal(REPO)} className="btn-ghost min-h-0 px-4 py-2 text-sm">
            <ExternalLink className="h-4 w-4" />
            GitHub
          </button>
        </Line>
      </Section>
    </div>
  );
}
