import { CheckCircle2, Download, ExternalLink, Loader2, LogOut, RefreshCw, SlidersHorizontal, Trash2 } from "lucide-react";
import { openEqualizer } from "../components/EqualizerPanel";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { usePageTitle } from "../lib/pageTitle";
import type { AppInfo, DesktopSettings, DiscordInfo } from "../global";
import { cn } from "../lib/cn";
import { errorMessage } from "../lib/format";
import type { Profile } from "../lib/spotify";
import { useStore } from "../lib/store";
import { setAmbiance, setDynamicAccent, setTheme, theme, type Theme } from "../lib/theme";
import { nowPanel, setNowPanel } from "../components/NowPanel";
import { lyricsPrefs, setNetease } from "../lib/lyricsPrefs";
import type { TranslationSettings } from "../global";
import { notify } from "../lib/ui";
import { updates } from "../lib/updates";
import { playback, retryLocalPlayback } from "../player/engine";
import { restore, trash } from "../lib/trash";
import { EFFECTS, lite, REASONS, setEffect, setLiteSetting, type LiteSetting } from "../lib/lite";

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
  { id: "glass", name: "Verre", hint: "Liquid Glass d'iOS 26 : tout en verre dépoli sur la pochette floutée, bleu iOS", swatches: ["#1e1e24", "#0a84ff", "#5e5ce6", "#ffffff"] },
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

const SHORTCUTS = [
  ["Ctrl+Alt+Espace", "lecture / pause"],
  ["Ctrl+Alt+→ / ←", "titre suivant / précédent"],
  ["Ctrl+Alt+L", "liker le titre"],
  ["Ctrl+Alt+F", "ouvrir Flow"],
  ["Ctrl+Alt+K", "paroles sur le bureau"],
];

function DesktopSettingsLines() {
  const [settings, setSettings] = useState<DesktopSettings & { takenShortcuts?: string[] }>();
  useEffect(() => {
    void window.vitrine.desktop?.get().then(setSettings, () => undefined);
  }, []);
  if (!settings) return <Loader2 className="h-4 w-4 animate-spin text-gray-400" />;
  const change = async (patch: Partial<DesktopSettings>) => {
    try {
      const { takenShortcuts: _taken, ...current } = settings;
      setSettings(await window.vitrine.desktop.set({ ...current, ...patch }));
    } catch (error) {
      notify(errorMessage(error), "error");
    }
  };
  return (
    <>
      <Line label="Fermer dans la zone de notification" hint="La croix cache la fenêtre : la musique continue, Vitrine reste à côté de l'horloge (clic droit pour les commandes).">
        <Switch on={settings.closeToTray} onChange={(on) => void change({ closeToTray: on })} label="Fermer dans la zone de notification" />
      </Line>
      <Line label="Notification à chaque nouveau titre" hint="Seulement quand Vitrine est en arrière-plan.">
        <Switch on={settings.notifications} onChange={(on) => void change({ notifications: on })} label="Notifications" />
      </Line>
      <Line label="Lancer Vitrine au démarrage" hint="Vitrine s'ouvre directement dans la zone de notification (version installée).">
        <Switch on={settings.openAtLogin} onChange={(on) => void change({ openAtLogin: on })} label="Lancer au démarrage" />
      </Line>
      <Line
        label="Libérer la mémoire quand Vitrine est cachée"
        hint="Après une minute dans la zone de notification, la page se ferme (environ 300 Mo rendus) ; la musique, les commandes et le titre en cours continuent, et tout revient au clic. Pas quand la musique joue dans Vitrine même."
      >
        <Switch on={settings.freeWhenHidden} onChange={(on) => void change({ freeWhenHidden: on })} label="Libérer la mémoire quand Vitrine est cachée" />
      </Line>
      <Line
        label="Bilan de la semaine et étapes"
        hint="Le lundi, votre semaine en une notification (temps d'écoute, artiste et titre n° 1) ; et quand vous franchissez une étape (100e écoute d'un titre, 1 000 minutes…). Une par jour au plus, calculée sur ce PC."
      >
        <Switch on={settings.recaps} onChange={(on) => void change({ recaps: on })} label="Bilan de la semaine et étapes" />
      </Line>
      <Line
        label="Raccourcis clavier globaux"
        hint={
          <>
            Depuis n'importe quelle appli : {SHORTCUTS.map(([keys, what]) => `${keys} ${what}`).join(" · ")} (⌘ au lieu de Ctrl sur Mac).
            {settings.globalShortcuts && settings.takenShortcuts?.length ? ` Déjà pris par une autre appli : ${settings.takenShortcuts.join(", ")}.` : ""}
          </>
        }
      >
        <Switch on={settings.globalShortcuts} onChange={(on) => void change({ globalShortcuts: on })} label="Raccourcis clavier globaux" />
      </Line>
      <Line
        label="Raccourcis dans Vitrine"
        hint="Espace lecture / pause · Ctrl+K ou Ctrl+F recherche · Ctrl+L aller au titre en cours · Ctrl+↑ / ↓ volume · Ctrl+M marquer un moment (⌘ sur Mac)."
      />
    </>
  );
}

const LITE_OPTIONS: { value: LiteSetting; label: string }[] = [
  { value: "auto", label: "Auto" },
  { value: "on", label: "Activé" },
  { value: "off", label: "Désactivé" },
];

/** Movix's light mode: the effects that cost memory and GPU, left out on a modest PC or by choice. */
function LiteSettings() {
  const state = useStore(lite, (s) => s);
  const active = !state.effects.backdrops && !state.effects.blur && !state.effects.transitions && !state.effects.autoplay && (state.setting === "on" || (state.setting === "auto" && state.reason !== null));
  const hint =
    state.setting === "auto"
      ? state.reason
        ? `Activé automatiquement : ${REASONS[state.reason]}.`
        : "S'active seul sur un PC modeste (2 cœurs, 4 Go) ou si Windows demande moins d'animations."
      : state.setting === "on"
        ? "Activé : pas de fonds animés, de flous, de transitions ni de défilement automatique."
        : "Désactivé : vous choisissez chaque effet ci-dessous.";
  return (
    <>
      <Line label="Mode léger" hint={hint}>
        <div className="flex shrink-0 gap-1 rounded-2xl border border-white/10 bg-white/5 p-1">
          {LITE_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => setLiteSetting(option.value)}
              aria-pressed={state.setting === option.value}
              className={cn("rounded-xl px-3 py-1.5 text-sm font-medium transition-colors", state.setting === option.value ? "accent-bg" : "text-gray-400 hover:text-white")}
            >
              {option.label}
            </button>
          ))}
        </div>
      </Line>
      {EFFECTS.map((effect) => (
        <Line key={effect.key} label={effect.label} hint={effect.hint}>
          <Switch
            on={active ? false : state.chosen[effect.key]}
            onChange={(on) => !active && setEffect(effect.key, on)}
            label={effect.label}
          />
        </Line>
      ))}
    </>
  );
}

/** What the trash bin holds, after Spicetify's Trashbin: each can be given back. */
function TrashSettings() {
  const bin = useStore(trash, (s) => s);
  const entries = [
    ...Object.entries(bin.artists).map(([key, name]) => ({ kind: "artists" as const, key, label: name, detail: "Artiste" })),
    ...Object.entries(bin.tracks).map(([key, name]) => ({ kind: "tracks" as const, key, label: name, detail: "Titre" })),
  ];
  if (entries.length === 0) {
    return <p className="text-sm text-gray-400">Vide. Clic droit sur un titre → « Corbeille » : ce titre, ou son artiste, est sauté à chaque fois qu'il passe.</p>;
  }
  return (
    <ul className="space-y-1">
      {entries.map((entry) => (
        <li key={`${entry.kind}-${entry.key}`} className="flex items-center justify-between gap-4 rounded-xl px-2 py-1.5 hover:bg-white/5">
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium">{entry.label}</span>
            <span className="text-xs text-gray-400">{entry.detail} sauté partout</span>
          </span>
          <button onClick={() => restore(entry.kind, entry.key)} className="btn-ghost min-h-0 shrink-0 px-3 py-1.5 text-xs">
            Restaurer
          </button>
        </li>
      ))}
    </ul>
  );
}

function HistorySettings() {
  const [enabled, setEnabled] = useState<boolean>();
  useEffect(() => {
    void window.vitrine.history?.enabled().then(setEnabled, () => undefined);
  }, []);
  if (enabled === undefined) return <Loader2 className="h-4 w-4 animate-spin text-gray-400" />;
  const act = async (action: () => Promise<unknown>, done?: string) => {
    try {
      await action();
      if (done) notify(done);
    } catch (error) {
      notify(errorMessage(error), "error");
    }
  };
  return (
    <>
      <Line
        label="Garder l'historique de toutes mes écoutes"
        hint="Les écoutes de tous vos appareils (Vitrine relit Spotify toutes les 15 minutes) et celles de Vitrine, pour la section « Toute votre écoute » des Stats. Gardé sur ce PC uniquement."
      >
        <Switch on={enabled} onChange={(on) => void act(async () => setEnabled(await window.vitrine.history.setEnabled(on)))} label="Historique d'écoute" />
      </Line>
      <Line label="Mon historique" hint="Un fichier CSV s'ouvre dans Excel ou Google Sheets. Pour remonter avant Vitrine : Stats → Importer tout l'historique.">
        <div className="flex shrink-0 gap-2">
          <button onClick={() => void act(async () => (await window.vitrine.history.export()) && notify("Historique exporté."))} className="btn-ghost min-h-0 px-4 py-2 text-sm">
            <Download className="h-4 w-4" />
            Exporter
          </button>
          <button
            onClick={() => window.confirm("Effacer tout l'historique d'écoute de ce PC ?") && void act(() => window.vitrine.history.clear(), "Historique effacé.")}
            className="btn-ghost min-h-0 px-4 py-2 text-sm"
          >
            <Trash2 className="h-4 w-4" />
            Effacer
          </button>
        </div>
      </Line>
    </>
  );
}

const LANGUAGES: { id: TranslationSettings["target"]; name: string }[] = [
  { id: "fr", name: "Français" },
  { id: "en", name: "Anglais" },
  { id: "es", name: "Espagnol" },
  { id: "de", name: "Allemand" },
  { id: "it", name: "Italien" },
  { id: "pt", name: "Portugais" },
  { id: "ar", name: "Arabe" },
];

/** The translation of lyrics: into which language, by MyMemory (no key) or DeepL (the person's key). */
function TranslationLines() {
  const [settings, setSettings] = useState<TranslationSettings>();
  const [key, setKey] = useState("");
  useEffect(() => {
    void window.vitrine.translation?.get().then((value) => {
      setSettings(value);
      setKey(value.deeplKey);
    }, () => undefined);
  }, []);
  if (!settings) return null;
  const save = (change: Partial<TranslationSettings>) => void window.vitrine.translation.set({ ...settings, ...change }).then(setSettings, () => undefined);
  return (
    <>
      <Line label="Traduction des paroles" hint="Le bouton « Traduire » de l'écran des paroles met la traduction sous chaque ligne. Gardée sur l'ordinateur.">
        <select
          value={settings.target}
          onChange={(event) => save({ target: event.target.value as TranslationSettings["target"] })}
          className="rounded-lg border border-white/15 bg-black/40 px-3 py-1.5 text-sm"
          aria-label="Langue de la traduction"
        >
          {LANGUAGES.map((language) => (
            <option key={language.id} value={language.id}>
              {language.name}
            </option>
          ))}
        </select>
      </Line>
      <Line
        label="Service de traduction"
        hint={
          settings.service === "deepl"
            ? "DeepL, avec votre clé (gratuite sur deepl.com : 500 000 caractères par mois)."
            : "MyMemory : gratuit et sans clé, dans la limite de son quota du jour."
        }
      >
        <div className="flex gap-1 rounded-full border border-white/10 p-1">
          {(["mymemory", "deepl"] as const).map((service) => (
            <button
              key={service}
              onClick={() => save({ service })}
              aria-pressed={settings.service === service}
              className={cn("rounded-full px-3 py-1 text-xs font-medium transition-colors", settings.service === service ? "bg-white/15 text-white" : "text-gray-400 hover:text-white")}
            >
              {service === "deepl" ? "DeepL" : "MyMemory"}
            </button>
          ))}
        </div>
      </Line>
      {settings.service === "deepl" && (
        <Line label="Clé DeepL" hint="Gardée sur cet ordinateur, envoyée seulement à DeepL.">
          <input
            value={key}
            onChange={(event) => setKey(event.target.value)}
            onBlur={() => key !== settings.deeplKey && save({ deeplKey: key })}
            placeholder="xxxxxxxx-xxxx-…:fx"
            type="password"
            className="w-64 rounded-lg border border-white/15 bg-black/40 px-3 py-1.5 font-mono text-xs"
            aria-label="Clé DeepL"
          />
        </Line>
      )}
    </>
  );
}

/**
 * Where the lyrics come from: AMLL TTML DB (word by word), LRCLIB, NetEase (not an official API, so the
 * person may leave it out) and lyrics.ovh; and the copy kept on this computer.
 */
function LyricsSettingsLines() {
  const netease = useStore(lyricsPrefs, (s) => s.netease);
  const [cleared, setCleared] = useState(false);
  return (
    <>
      <p className="text-xs text-gray-400">
        Vitrine cherche les paroles chez AMLL TTML DB (mot à mot, duos), LRCLIB, NetEase et lyrics.ovh, et garde la meilleure. Dans l'écran des paroles, « Paroles : … » change de source ou décale
        la synchro pour un titre.
      </p>
      <Line label="NetEase" hint="Beaucoup de paroles synchronisées, rap français compris, mais ce n'est pas une API officielle : son moteur de recherche public est interrogé avec le titre et l'artiste.">
        <Switch on={netease} onChange={setNetease} label="NetEase" />
      </Line>
      <TranslationLines />
      <Line label="Paroles gardées sur cet ordinateur" hint="Chaque titre n'est cherché qu'une fois, et ses paroles restent disponibles hors ligne.">
        <button
          className="btn-ghost min-h-0 px-3 py-1.5 text-xs"
          disabled={cleared}
          onClick={() => void window.vitrine.lyrics.clear().then(() => setCleared(true), () => undefined)}
        >
          {cleared ? "Vidé" : "Vider"}
        </button>
      </Line>
    </>
  );
}

export function Settings({ profile, onLogout }: { profile?: Profile; onLogout: () => void }) {
  const title = useRef<HTMLHeadingElement>(null);
  usePageTitle(title, "Réglages");
  const current = useStore(theme, (s) => s.current);
  const dynamic = useStore(theme, (s) => s.dynamic);
  const ambiance = useStore(theme, (s) => s.ambiance);
  const panel = useStore(nowPanel, (s) => s.setting);
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
      <h1 ref={title} className="px-1 font-display text-4xl tracking-tight">
        Réglages
      </h1>

      <Section title="Apparence">
        <div className="grid grid-cols-3 gap-3">
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
        <Line label="Couleurs de la pochette" hint="L'accent du thème prend la couleur de la pochette du titre en cours.">
          <Switch on={dynamic} onChange={setDynamicAccent} label="Couleurs de la pochette" />
        </Line>
        <Line label="Ambiance de la pochette" hint="La pochette en cours, floutée, en fond de toute l'appli (comme les thèmes Hazy et Glowify de Spicetify). Masquée en mode léger.">
          <Switch on={ambiance} onChange={setAmbiance} label="Ambiance de la pochette" />
        </Line>
        <Line label="Panneau « À l'écoute »" hint="À droite : la pochette, les paroles en direct, la suite, vos écoutes, vos moments, l'artiste. « Auto » l'ouvre sur un écran vertical ou très large.">
          <div className="flex gap-1 rounded-full border border-white/10 p-1">
            {(["auto", "on", "off"] as const).map((value) => (
              <button
                key={value}
                onClick={() => setNowPanel(value)}
                aria-pressed={panel === value}
                className={cn("rounded-full px-3 py-1 text-xs font-medium transition-colors", panel === value ? "bg-white/15 text-white" : "text-gray-400 hover:text-white")}
              >
                {value === "auto" ? "Auto" : value === "on" ? "Toujours" : "Jamais"}
              </button>
            ))}
          </div>
        </Line>
      </Section>

      <Section title="Paroles">
        <LyricsSettingsLines />
      </Section>

      <Section title="Performance">
        <LiteSettings />
      </Section>

      <Section title="Bureau">
        <DesktopSettingsLines />
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
        <Line
          label="Égaliseur"
          hint="Dix bandes et des préréglages, appliqués à la sortie son de Windows par Equalizer APO (gratuit). Spotify ne laisse pas les applis modifier le son lui-même."
        >
          <button onClick={openEqualizer} className="btn-ghost min-h-0 shrink-0 px-4 py-2 text-sm">
            <SlidersHorizontal className="h-4 w-4" />
            Ouvrir
          </button>
        </Line>
      </Section>

      <Section title="Corbeille">
        <TrashSettings />
      </Section>

      <Section title="Historique d'écoute">
        <HistorySettings />
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
