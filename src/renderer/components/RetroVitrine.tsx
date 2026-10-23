import { AnimatePresence, motion } from "framer-motion";
import { Share2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { auraOf, renderRetroCard } from "../lib/cards";
import { errorMessage } from "../lib/format";
import { formatListening, type ListeningSummary } from "../lib/listening";
import { EASE } from "../lib/motion";
import { artworkColor, type Rgb } from "../lib/palette";
import { favouriteHour, favouriteWeekday, periodRange, recordDay, type RetroPeriod } from "../lib/retro";
import { createStore, useStore } from "../lib/store";
import { notify } from "../lib/ui";
import { Artwork } from "./Artwork";
import { showImage } from "./ImagePreview";

/** which period Rétro Vitrine tells, while it is open */
export const retro = createStore<{ period: RetroPeriod | null }>({ period: null });
export const openRetro = (period: RetroPeriod) => retro.set({ period });
const close = () => retro.set({ period: null });

/** each slide stays this long before the next, as in a story */
const SLIDE_MS = 6500;

const number = new Intl.NumberFormat("fr-FR");

/** Counts up to `to` in a second and a half (the minutes slide). */
function Counter({ to }: { to: number }) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    const start = performance.now();
    let frame = 0;
    const step = (time: number) => {
      const t = Math.min(1, (time - start) / 1500);
      setValue(Math.round(to * (1 - (1 - t) ** 3)));
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [to]);
  return <>{number.format(value)}</>;
}

function Kicker({ children }: { children: string }) {
  return <p className="font-mono text-sm font-medium uppercase tracking-[0.3em] text-white/70">{children}</p>;
}

/** Rétro Vitrine: a month or a year of listening in full-screen slides, then a picture to share. */
export function RetroVitrine({ name }: { name?: string }) {
  const period = useStore(retro, (s) => s.period);
  const range = useMemo(() => (period ? periodRange(period) : null), [period]);
  const [summary, setSummary] = useState<ListeningSummary | null>(null);
  const [colors, setColors] = useState<Rgb[]>([]);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (!range) return;
    setIndex(0);
    setSummary(null);
    void window.vitrine.history
      ?.summary({ days: 0, source: "all", since: range.since, until: range.until })
      .then(setSummary)
      .catch((error: unknown) => notify(errorMessage(error), "error"));
  }, [range]);

  useEffect(() => {
    if (!summary) return;
    void Promise.all(summary.topTracks.map((track) => artworkColor(track.image))).then(setColors);
  }, [summary]);

  const slides = useMemo(() => (summary && range ? buildSlides(summary, range, colors, name) : []), [summary, range, colors, name]);

  // forward on its own, as a story; held while the mouse is down
  useEffect(() => {
    if (!slides.length || paused || index >= slides.length - 1) return;
    const timer = setTimeout(() => setIndex((i) => Math.min(slides.length - 1, i + 1)), SLIDE_MS);
    return () => clearTimeout(timer);
  }, [index, slides.length, paused]);

  useEffect(() => {
    if (!period) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
      if (event.key === "ArrowRight") setIndex((i) => Math.min(slides.length - 1, i + 1));
      if (event.key === "ArrowLeft") setIndex((i) => Math.max(0, i - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [period, slides.length]);

  if (!period || !range) return null;
  const aura = auraOf(colors);
  const background = aura.stops.length >= 2 ? `radial-gradient(80% 70% at 20% 20%, rgb(${aura.stops[0]} / 0.7), transparent), radial-gradient(70% 70% at 85% 80%, rgb(${aura.stops[aura.stops.length - 1]} / 0.6), transparent), #070707` : "#070707";

  return (
    <motion.div className="fixed inset-0 z-[66] overflow-hidden" style={{ background }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="fx-grain pointer-events-none absolute inset-[-50%] opacity-[0.07]" aria-hidden="true" />
      {/* the story's progress bars */}
      <div className="absolute left-[max(2.5rem,var(--wc-left))] right-[calc(var(--wc-right)+1rem)] top-6 z-10 flex gap-1.5">
        {slides.map((slide, i) => (
          <div key={slide.key} className="h-1 flex-1 overflow-hidden rounded-full bg-white/25">
            {i < index && <div className="h-full w-full rounded-full bg-white" />}
            {i === index && (
              <motion.div
                key={index}
                className="h-full rounded-full bg-white"
                initial={{ width: index === slides.length - 1 ? "100%" : "0%" }}
                animate={{ width: "100%" }}
                transition={{ duration: SLIDE_MS / 1000, ease: "linear" }}
              />
            )}
          </div>
        ))}
      </div>
      <button onClick={close} className="absolute right-8 top-[calc(var(--wc-height)+0.75rem)] z-20 rounded-full border border-white/25 p-2.5 text-white/80 hover:bg-white/10 hover:text-white" aria-label="Fermer Rétro Vitrine">
        <X className="h-5 w-5" />
      </button>
      {/* tap left or right to go back or on, hold to pause */}
      <div
        className="absolute inset-0 z-0"
        onMouseDown={() => setPaused(true)}
        onMouseUp={(event) => {
          setPaused(false);
          const back = event.clientX < window.innerWidth / 3;
          setIndex((i) => (back ? Math.max(0, i - 1) : Math.min(slides.length - 1, i + 1)));
        }}
      />
      <div className="pointer-events-none relative z-10 flex h-full items-center px-[10vw]">
        {!summary && <p className="font-display text-4xl text-white/60">Rétro Vitrine se prépare…</p>}
        <AnimatePresence mode="wait">
          {slides[index] && (
            <motion.div
              key={slides[index].key}
              className="pointer-events-auto w-full"
              initial={{ opacity: 0, y: 30, filter: "blur(8px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.6, ease: EASE }}
            >
              {slides[index].content}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

interface Slide {
  key: string;
  content: React.ReactNode;
}

function buildSlides(summary: ListeningSummary, range: { since: number; until: number; label: string }, colors: Rgb[], name?: string): Slide[] {
  const first = name?.split(" ")[0];
  if (summary.plays === 0) {
    return [
      {
        key: "empty",
        content: (
          <div>
            <Kicker>{`Rétro Vitrine · ${range.label}`}</Kicker>
            <h2 className="mt-6 font-display text-6xl tracking-tight">Pas encore d'écoutes pour cette période.</h2>
            <p className="mt-4 text-xl text-white/70">Vitrine compte vos écoutes depuis son installation : revenez un peu plus tard.</p>
          </div>
        ),
      },
    ];
  }
  const minutes = Math.round(summary.totalMs / 60_000);
  const artist = summary.topArtists[0];
  const artistImage = summary.topTracks.find((track) => artist && track.detail.includes(artist.name))?.image ?? summary.topTracks[0]?.image;
  const hour = favouriteHour(summary.heatmap);
  const weekday = favouriteWeekday(summary.heatmap);
  const record = recordDay(summary.calendar, range.since, range.until);
  const aura = auraOf(colors);
  const share = () =>
    void renderRetroCard({ label: range.label, name: name ?? "", minutes, topArtist: artist?.name, topTracks: summary.topTracks, colors })
      .then((blob) => showImage(blob, `retro-vitrine-${range.label.replace(/\s+/g, "-")}.png`, `Rétro Vitrine · ${range.label}`))
      .catch((error: unknown) => notify(errorMessage(error), "error"));

  return [
    {
      key: "intro",
      content: (
        <div>
          <Kicker>Rétro Vitrine</Kicker>
          <h2 className="mt-6 font-display text-[clamp(56px,9vw,140px)] leading-[0.9] tracking-tight">
            {first ? `${first},` : "Votre"}
            <br />
            <span className="capitalize">{range.label}</span>
          </h2>
          <p className="mt-6 text-2xl text-white/75">en musique. On rembobine ?</p>
        </div>
      ),
    },
    {
      key: "minutes",
      content: (
        <div>
          <Kicker>Temps d'écoute</Kicker>
          <p className="mt-6 font-display text-[clamp(72px,12vw,180px)] leading-none tracking-tight">
            <Counter to={minutes} />
          </p>
          <p className="mt-4 text-3xl font-semibold">minutes de musique</p>
          <p className="mt-3 text-xl text-white/70">
            {number.format(summary.plays)} écoutes, {number.format(summary.distinctTracks)} titres différents, {summary.activeDays} jour{summary.activeDays > 1 ? "s" : ""} en musique · {formatListening(summary.totalMs)}
          </p>
        </div>
      ),
    },
    ...(artist
      ? [
          {
            key: "artist",
            content: (
              <div className="flex items-center gap-12">
                <motion.div initial={{ scale: 0.8, rotate: -6 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 120, damping: 14 }} className="w-[min(36vh,30vw)] shrink-0">
                  <Artwork src={artistImage} round className="shadow-2xl ring-4 ring-white/20" />
                </motion.div>
                <div className="min-w-0">
                  <Kicker>Votre artiste n° 1</Kicker>
                  <p className="mt-4 font-display text-[clamp(48px,7vw,112px)] uppercase leading-[0.92] tracking-tight">{artist.name}</p>
                  <p className="mt-4 text-2xl text-white/75">
                    {artist.plays} écoutes · {formatListening(artist.ms)}
                  </p>
                </div>
              </div>
            ),
          },
        ]
      : []),
    {
      key: "tracks",
      content: (
        <div>
          <Kicker>Vos titres préférés</Kicker>
          <ol className="mt-8 space-y-4">
            {summary.topTracks.map((track, i) => (
              <motion.li key={track.key} className="flex items-center gap-6" initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 + i * 0.12, ease: EASE }}>
                <span className="w-14 text-right font-display text-5xl text-white/80">{i + 1}</span>
                <Artwork src={track.image} className="h-20 w-20 shrink-0 rounded-xl" />
                <span className="min-w-0">
                  <span className="block truncate text-3xl font-semibold">{track.name}</span>
                  <span className="block truncate text-lg text-white/65">
                    {track.detail} · {track.plays} écoutes
                  </span>
                </span>
              </motion.li>
            ))}
          </ol>
        </div>
      ),
    },
    {
      key: "habits",
      content: (
        <div>
          <Kicker>Vos habitudes</Kicker>
          <div className="mt-8 grid grid-cols-3 gap-8">
            {[
              ["Votre heure", hour !== null ? `${hour} h` : "—", "le moment où vous écoutez le plus"],
              ["Votre jour", weekday ?? "—", "le jour de la semaine le plus musical"],
              [
                "Jour record",
                record ? new Date(record.day).toLocaleDateString("fr-FR", { day: "numeric", month: "long" }) : "—",
                record ? `${formatListening(record.ms)} d'écoute ce jour-là` : "",
              ],
            ].map(([title, value, hint]) => (
              <div key={title} className="rounded-3xl border border-white/15 bg-black/25 p-8 backdrop-blur">
                <p className="font-mono text-sm uppercase tracking-[0.25em] text-white/60">{title}</p>
                <p className="mt-4 font-display text-6xl capitalize tracking-tight">{value}</p>
                <p className="mt-3 text-white/65">{hint}</p>
              </div>
            ))}
          </div>
        </div>
      ),
    },
    {
      key: "aura",
      content: (
        <div className="flex items-center gap-14">
          <div className="relative h-[40vh] w-[40vh] shrink-0">
            {aura.stops.map((stop, i) => (
              <motion.span
                key={stop}
                className="absolute h-[60%] w-[60%] rounded-full blur-3xl"
                style={{ background: `rgb(${stop})`, left: `${20 + Math.cos((i / aura.stops.length) * Math.PI * 2) * 20}%`, top: `${20 + Math.sin((i / aura.stops.length) * Math.PI * 2) * 20}%` }}
                animate={{ scale: [1, 1.15, 1] }}
                transition={{ duration: 5 + i, repeat: Infinity }}
              />
            ))}
          </div>
          <div>
            <Kicker>Votre aura musicale</Kicker>
            <p className="mt-4 font-display text-[clamp(48px,7vw,104px)] leading-[0.95] tracking-tight">{aura.name}</p>
            <p className="mt-4 text-xl text-white/70">Les couleurs des pochettes que vous avez le plus écoutées.</p>
          </div>
        </div>
      ),
    },
    {
      key: "end",
      content: (
        <div>
          <Kicker>{`Rétro Vitrine · ${range.label}`}</Kicker>
          <h2 className="mt-6 font-display text-[clamp(48px,7vw,112px)] leading-[0.92] tracking-tight">C'était votre {range.label.includes(" ") ? "mois" : "année"}.</h2>
          <div className="mt-10 flex gap-4">
            <button onClick={share} className="btn-primary h-14 px-8 text-base">
              <Share2 className="h-5 w-5" />
              Créer l'image à partager
            </button>
            <button onClick={close} className="btn-ghost h-14 px-8 text-base">
              Fermer
            </button>
          </div>
        </div>
      ),
    },
  ];
}
