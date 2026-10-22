import { motion } from "framer-motion";
import { Download, Laptop } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { HistoryPlay } from "../global";
import { cn } from "../lib/cn";
import { errorMessage } from "../lib/format";
import { formatListening, summarize, type Ranked } from "../lib/listening";
import { navigate, notify } from "../lib/ui";
import * as engine from "../player/engine";
import { Artwork } from "./Artwork";
import { run } from "./NowPlayingBar";

type Period = "week" | "month" | "all";
const PERIODS: { value: Period; label: string; days: number }[] = [
  { value: "week", label: "7 jours", days: 7 },
  { value: "month", label: "30 jours", days: 30 },
  { value: "all", label: "Tout", days: 0 },
];
const WEEKDAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const time = new Intl.DateTimeFormat("fr-FR", { weekday: "short", hour: "2-digit", minute: "2-digit" });

function Figure({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-4">
      <p className="font-display text-3xl tracking-tight">{value}</p>
      <p className="mt-1 text-xs text-gray-400">{label}</p>
    </div>
  );
}

function RankedList({ title, items, onOpen }: { title: string; items: Ranked[]; onOpen: (item: Ranked, index: number) => void }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-white/80">{title}</h3>
      <ol className="mt-3 space-y-1">
        {items.map((item, index) => (
          <li key={item.key}>
            <button onClick={() => onOpen(item, index)} className="flex w-full items-center gap-3 rounded-xl px-2 py-1.5 text-left hover:bg-white/5">
              <span className={cn("w-5 text-right font-display tabular-nums", index === 0 ? "text-red-500" : "text-white/40")}>{index + 1}</span>
              {item.image && <Artwork src={item.image} className="h-9 w-9 shrink-0 rounded-md" />}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{item.name}</span>
                <span className="block truncate text-xs text-gray-400">{item.detail}</span>
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
              <span
                key={hour}
                className="h-4 rounded-[3px] accent-bg"
                style={{ opacity: ms > 0 ? 0.15 + 0.85 * (ms / max) : 0.05 }}
                title={`${WEEKDAYS[day]} ${hour} h : ${formatListening(ms)}`}
              />
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

/** The listening history Vitrine keeps on this computer, summed up (inspired by Swiftify). */
export function LocalListening() {
  const [plays, setPlays] = useState<HistoryPlay[]>();
  const [period, setPeriod] = useState<Period>("month");

  useEffect(() => {
    void window.vitrine.history?.list().then(setPlays, () => setPlays([]));
  }, []);

  const summary = useMemo(() => {
    if (!plays) return null;
    const days = PERIODS.find((option) => option.value === period)?.days ?? 0;
    return summarize(plays, days ? Date.now() - days * 86_400_000 : 0);
  }, [plays, period]);

  const exportCsv = async () => {
    try {
      if (await window.vitrine.history.export()) notify("Historique exporté.");
    } catch (error) {
      notify(errorMessage(error), "error");
    }
  };

  if (!summary) return null;
  return (
    <section className="mt-8 rounded-3xl border border-white/10 bg-white/[0.03] p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Laptop className="h-5 w-5 text-red-500" />
          <div>
            <h2 className="text-xl font-bold">Sur cet ordinateur</h2>
            <p className="text-xs text-gray-400">Chaque titre écouté 30 secondes dans Vitrine, gardé sur ce PC uniquement.</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => void exportCsv()} disabled={plays?.length === 0} className="btn-ghost min-h-0 px-4 py-2 text-sm disabled:opacity-40">
            <Download className="h-4 w-4" />
            Exporter (CSV)
          </button>
          <div className="flex gap-1 rounded-2xl border border-white/10 bg-white/5 p-1">
            {PERIODS.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setPeriod(value)}
                className={cn("rounded-xl px-4 py-1.5 text-sm font-medium transition-colors", period === value ? "accent-bg" : "text-gray-400 hover:text-white")}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {summary.plays === 0 ? (
        <p className="mt-6 text-sm text-gray-400">
          Rien encore sur cette période. Vitrine note désormais vos écoutes sur ce PC : revenez après quelques titres.
        </p>
      ) : (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-6 space-y-8">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Figure value={formatListening(summary.totalMs)} label="d'écoute" />
            <Figure value={String(summary.plays)} label={`écoute${summary.plays > 1 ? "s" : ""} · ${summary.distinctTracks} titres différents`} />
            <Figure value={String(summary.activeDays)} label={`jour${summary.activeDays > 1 ? "s" : ""} d'écoute`} />
            <Figure value={`${summary.streak} j`} label="série en cours" />
          </div>
          <Heatmap grid={summary.heatmap} />
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
            <RankedList
              title="Vos titres"
              items={summary.topTracks}
              onOpen={(_item, index) => run(() => engine.playTracks(summary.topTracks.map((track) => track.uri ?? ""), index))}
            />
            <RankedList title="Vos artistes" items={summary.topArtists} onOpen={(item) => item.id && navigate({ name: "artist", id: item.id })} />
            <div>
              <h3 className="text-sm font-semibold text-white/80">Dernières écoutes</h3>
              <ul className="mt-3 space-y-1">
                {summary.recent.map((play) => (
                  <li key={play.at} className="flex items-center gap-3 rounded-xl px-2 py-1.5">
                    {play.image && <Artwork src={play.image} className="h-9 w-9 shrink-0 rounded-md" />}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{play.name}</span>
                      <span className="block truncate text-xs text-gray-400">{play.artists.join(", ")}</span>
                    </span>
                    <span className="shrink-0 text-xs text-gray-500">{time.format(new Date(play.at))}</span>
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
