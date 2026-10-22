import { motion } from "framer-motion";
import { Download, ExternalLink, Globe2, Loader2, RefreshCw, Upload } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { cn } from "../lib/cn";
import { errorMessage } from "../lib/format";
import { formatListening, type HistoryInfo, type ListeningSummary, type Ranked } from "../lib/listening";
import { navigate, notify } from "../lib/ui";
import * as engine from "../player/engine";
import { Artwork } from "./Artwork";
import { run } from "./NowPlayingBar";
import { trackMenu } from "./TrackMenu";

type Period = 7 | 30 | 365 | 0;
const PERIODS: { value: Period; label: string }[] = [
  { value: 7, label: "7 jours" },
  { value: 30, label: "30 jours" },
  { value: 365, label: "1 an" },
  { value: 0, label: "Tout" },
];
type Source = "all" | "vitrine";
const SOURCES: { value: Source; label: string }[] = [
  { value: "all", label: "Tous mes appareils" },
  { value: "vitrine", label: "Cet ordinateur" },
];
const WEEKDAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const MONTHS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
const PRIVACY_PAGE = "https://www.spotify.com/account/privacy/";
const when = new Intl.DateTimeFormat("fr-FR", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const date = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" });
const time = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" });
const number = new Intl.NumberFormat("fr-FR");

function Toggle<T extends string | number>({ options, value, onChange }: { options: { value: T; label: string }[]; value: T; onChange: (value: T) => void }) {
  return (
    <div className="flex gap-1 rounded-2xl border border-white/10 bg-white/5 p-1">
      {options.map((option) => (
        <button
          key={option.value}
          onClick={() => onChange(option.value)}
          className={cn("rounded-xl px-3 py-1.5 text-sm font-medium transition-colors", value === option.value ? "accent-bg" : "text-gray-400 hover:text-white")}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function Figure({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-4">
      <p className="font-display text-3xl tracking-tight">{value}</p>
      <p className="mt-1 text-xs text-gray-400">{label}</p>
    </div>
  );
}

function RankedList({ title, items, onOpen, tracks }: { title: string; items: Ranked[]; onOpen: (item: Ranked, index: number) => void; tracks?: boolean }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-white/80">{title}</h3>
      <ol className="mt-3 space-y-1">
        {items.map((item, index) => (
          <li key={item.key}>
            <button
              onClick={() => onOpen(item, index)}
              onContextMenu={(event) => tracks && item.uri?.startsWith("spotify:track:") && trackMenu(event, { id: item.id ?? "", uri: item.uri, name: item.name, artists: item.detail.split(", "), artistIds: [], albumName: "", image: item.image, durationMs: 0, explicit: false })}
              className="flex w-full items-center gap-3 rounded-xl px-2 py-1.5 text-left hover:bg-white/5"
            >
              <span className={cn("w-5 text-right font-display tabular-nums", index === 0 ? "text-red-500" : "text-white/40")}>{index + 1}</span>
              {tracks && <Artwork src={item.image} className="h-9 w-9 shrink-0 rounded-md" />}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{item.name}</span>
                <span className="block truncate text-xs text-gray-400">{tracks ? `${item.detail} · ${item.plays} écoute${item.plays > 1 ? "s" : ""}` : item.detail}</span>
              </span>
              <span className="shrink-0 text-xs tabular-nums text-gray-400">{formatListening(item.ms)}</span>
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** When in the week the person listens: one cell per weekday and hour, brighter for more time. */
function Heatmap({ grid }: { grid: number[][] }) {
  const max = Math.max(1, ...grid.flat());
  return (
    <div>
      <h3 className="text-sm font-semibold text-white/80">Quand vous écoutez</h3>
      <div className="mt-3 grid max-w-4xl grid-cols-[2.5rem_repeat(24,minmax(0,1fr))] gap-[3px] text-[10px] text-gray-500">
        {grid.map((hours, day) => (
          <div key={day} className="contents">
            <span className="self-center">{WEEKDAYS[day]}</span>
            {hours.map((ms, hour) => (
              <span key={hour} className="h-4 rounded-[3px] accent-bg" style={{ opacity: ms > 0 ? 0.15 + 0.85 * (ms / max) : 0.05 }} title={`${WEEKDAYS[day]} ${hour} h : ${formatListening(ms)}`} />
            ))}
          </div>
        ))}
        <span />
        {Array.from({ length: 24 }, (_, hour) => (
          <span key={hour} className="text-center">
            {hour % 6 === 0 ? `${hour}h` : ""}
          </span>
        ))}
      </div>
    </div>
  );
}

/** The year, one square a day, as on a GitHub profile (and Swiftify's stats). */
function Calendar({ days }: { days: ListeningSummary["calendar"] }) {
  const weeks: ListeningSummary["calendar"][] = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));
  const max = Math.max(1, ...days.map((day) => day.ms));
  const active = days.filter((day) => day.ms > 0).length;
  return (
    <div>
      <h3 className="text-sm font-semibold text-white/80">
        Votre année <span className="font-normal text-gray-500">· {active} jour{active > 1 ? "s" : ""} d'écoute sur les 12 derniers mois</span>
      </h3>
      <div className="mt-3 overflow-x-auto">
        <div className="flex gap-[3px] text-[10px] text-gray-500">
          {weeks.map((week, index) => {
            const first = week.find((day) => day.day.endsWith("-01"));
            return (
              <div key={week[0].day} className="flex flex-col gap-[3px]">
                <span className="h-3 whitespace-nowrap">{first || index === 0 ? MONTHS[Number((first ?? week[0]).day.slice(5, 7)) - 1] : ""}</span>
                {week.map((day) => (
                  <span
                    key={day.day}
                    className="h-[11px] w-[11px] rounded-[3px] accent-bg"
                    style={{ opacity: day.ms > 0 ? 0.2 + 0.8 * Math.sqrt(day.ms / max) : 0.06 }}
                    title={`${date.format(new Date(`${day.day}T12:00:00`))} : ${day.ms > 0 ? formatListening(day.ms) : "rien"}`}
                  />
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/** Everything the account listened to, from every device, summed up (inspired by Swiftify and stats.fm). */
export function Listening() {
  const [period, setPeriod] = useState<Period>(30);
  const [source, setSource] = useState<Source>("all");
  const [summary, setSummary] = useState<ListeningSummary>();
  const [info, setInfo] = useState<HistoryInfo>();
  const [busy, setBusy] = useState<"sync" | "import" | null>(null);
  const [showImport, setShowImport] = useState(false);

  const refresh = useCallback(async () => {
    const bridge = window.vitrine.history;
    if (!bridge) return;
    const [next, details] = await Promise.all([bridge.summary({ days: period, source }), bridge.info()]);
    setSummary(next);
    setInfo(details);
  }, [period, source]);

  useEffect(() => {
    void refresh().catch(() => undefined);
  }, [refresh]);

  const act = async (kind: "sync" | "import" | "export") => {
    if (kind !== "export") setBusy(kind);
    try {
      if (kind === "sync") {
        const added = await window.vitrine.history.sync();
        notify(added > 0 ? `${added} nouvelle${added > 1 ? "s" : ""} écoute${added > 1 ? "s" : ""} de vos appareils.` : "Déjà à jour avec vos appareils.");
      } else if (kind === "import") {
        const result = await window.vitrine.history.import();
        if (result) notify(`${number.format(result.added)} écoutes ajoutées (${number.format(result.read)} lues dans ${result.files} fichier${result.files > 1 ? "s" : ""}).`);
      } else if (await window.vitrine.history.export()) {
        notify("Historique exporté.");
      }
      await refresh();
    } catch (error) {
      notify(errorMessage(error), "error");
    } finally {
      setBusy(null);
    }
  };

  if (!summary || !info) return null;
  const imported = info.bySource.import;
  return (
    <section className="mt-8 rounded-3xl border border-white/10 bg-white/[0.03] p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Globe2 className="mt-1 h-5 w-5 text-red-500" />
          <div>
            <h2 className="text-xl font-bold">Toute votre écoute</h2>
            <p className="mt-0.5 max-w-xl text-xs text-gray-400">
              Téléphone, enceintes, ordinateurs : Vitrine relit vos écoutes Spotify toutes les 15 minutes et les garde sur ce PC.
              {info.lastSync ? ` Dernière synchronisation à ${time.format(new Date(info.lastSync))}.` : ""}
              {info.first ? ` ${number.format(info.plays)} écoutes depuis le ${date.format(new Date(info.first))}` : ""}
              {imported ? `, dont ${number.format(imported)} importées.` : info.first ? "." : ""}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => void act("sync")} disabled={busy !== null} className="btn-ghost min-h-0 px-3 py-2 text-sm disabled:opacity-40">
            <RefreshCw className={cn("h-4 w-4", busy === "sync" && "animate-spin")} />
            Synchroniser
          </button>
          <button onClick={() => setShowImport((open) => !open)} className="btn-ghost min-h-0 px-3 py-2 text-sm" aria-expanded={showImport}>
            <Upload className="h-4 w-4" />
            Importer tout l'historique
          </button>
          <button onClick={() => void act("export")} disabled={info.plays === 0} className="btn-ghost min-h-0 px-3 py-2 text-sm disabled:opacity-40">
            <Download className="h-4 w-4" />
            CSV
          </button>
        </div>
      </div>

      {showImport && (
        <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="mt-4 rounded-2xl border border-white/10 bg-black/30 p-4 text-sm text-gray-300">
          <p className="font-semibold text-white">Vos écoutes depuis la création de votre compte</p>
          <p className="mt-1 text-xs leading-relaxed text-gray-400">
            Spotify ne donne aux applis que vos 50 dernières écoutes, mais garde tout. Sur la page Confidentialité de votre compte, demandez
            l'« historique de streaming étendu » : Spotify l'envoie par e-mail sous quelques jours, en un fichier ZIP. Importez-le ici tel quel :
            Vitrine ne garde que la musique écoutée au moins 30 secondes, sans doublon avec ce qu'elle connaît déjà.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button onClick={() => void window.vitrine.openExternal(PRIVACY_PAGE)} className="btn-ghost min-h-0 px-3 py-2 text-xs">
              <ExternalLink className="h-3.5 w-3.5" />
              Demander mes données à Spotify
            </button>
            <button onClick={() => void act("import")} disabled={busy !== null} className="btn-primary min-h-0 px-3 py-2 text-xs disabled:opacity-40">
              {busy === "import" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
              Choisir le ZIP ou les fichiers JSON
            </button>
          </div>
        </motion.div>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Toggle options={PERIODS} value={period} onChange={setPeriod} />
        <Toggle options={SOURCES} value={source} onChange={setSource} />
      </div>

      {summary.plays === 0 ? (
        <p className="mt-6 text-sm text-gray-400">
          {source === "vitrine"
            ? "Rien d'écouté dans Vitrine sur cette période."
            : "Rien encore sur cette période : la première synchronisation arrive quelques secondes après le lancement de Vitrine. Pour remonter plus loin, importez votre historique Spotify."}
        </p>
      ) : (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-6 space-y-8">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Figure value={formatListening(summary.totalMs)} label="d'écoute" />
            <Figure value={number.format(summary.plays)} label={`écoute${summary.plays > 1 ? "s" : ""} · ${number.format(summary.distinctTracks)} titres différents`} />
            <Figure value={number.format(summary.activeDays)} label={`jour${summary.activeDays > 1 ? "s" : ""} d'écoute`} />
            <Figure value={`${summary.streak} j`} label="série en cours" />
          </div>
          <Calendar days={summary.calendar} />
          <Heatmap grid={summary.heatmap} />
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
            <RankedList
              title="Vos titres"
              items={summary.topTracks}
              tracks
              onOpen={(item) => {
                // imported songs of the yearly file have no Spotify link: they cannot be played
                const playable = summary.topTracks.filter((track) => track.uri?.startsWith("spotify:track:"));
                const index = playable.indexOf(item);
                if (index >= 0) run(() => engine.playTracks(playable.map((track) => track.uri!), index));
              }}
            />
            <RankedList title="Vos artistes" items={summary.topArtists} onOpen={(item) => item.id && navigate({ name: "artist", id: item.id })} />
            <div>
              <h3 className="text-sm font-semibold text-white/80">Dernières écoutes</h3>
              <ul className="mt-3 space-y-1">
                {summary.recent.map((play) => (
                  <li key={`${play.at}-${play.uri}`} className="flex items-center gap-3 rounded-xl px-2 py-1.5">
                    <Artwork src={play.image} className="h-9 w-9 shrink-0 rounded-md" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{play.name}</span>
                      <span className="block truncate text-xs text-gray-400">
                        {play.artists.join(", ")}
                        {play.source === "spotify" ? " · via Spotify" : play.source === "import" ? " · importé" : " · Vitrine"}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs text-gray-500">{when.format(new Date(play.at))}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </motion.div>
      )}
    </section>
  );
}
