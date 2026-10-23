import { AnimatePresence, motion } from "framer-motion";
import { ArrowUpRight, Captions, Layers, MapPin, Plus, Share2, SkipForward } from "lucide-react";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { errorMessage, formatTime } from "../lib/format";
import { lastPlayedLabel, type TrackStat } from "../lib/insights";
import { addMoment, moments } from "../lib/moments";
import { SPRING } from "../lib/motion";
import { artworkColor, FALLBACK, rgbVar, type Rgb } from "../lib/palette";
import * as api from "../lib/spotify";
import { createStore, useStore } from "../lib/store";
import type { Artist, Track } from "../lib/types";
import { navigate, notify, ui } from "../lib/ui";
import * as engine from "../player/engine";
import { playback } from "../player/engine";
import { usePosition } from "../player/hooks";
import { toggleOverlay } from "../player/overlayBridge";
import { useLyrics } from "../player/useLyrics";
import { Artwork } from "./Artwork";
import { ClipButton } from "./ClipButton";
import { LikeButton } from "./LikeButton";
import { Marquee } from "./Marquee";
import { ArtistLinks, run } from "./NowPlayingBar";
import { PlainLyrics, StagedLyrics } from "./StagedLyrics";
import { SOURCE_NAMES } from "../lib/lyricsPrefs";
import { shareStory } from "./StoryButton";
import { openVersions } from "./VersionsPanel";

// ── open or closed ────────────────────────────────────────────────────────

export type PanelSetting = "auto" | "on" | "off";

const KEY = "vitrine.nowPanel";
/** the panel's width, and what the page gives up for it */
export const PANEL_WIDTH = 340;
export const PANEL_ROOM = PANEL_WIDTH + 20;

function readSetting(): PanelSetting {
  try {
    const value = localStorage.getItem(KEY);
    return value === "on" || value === "off" ? value : "auto";
  } catch {
    return "auto";
  }
}

const size = () => (typeof window === "undefined" || !window.innerWidth ? { width: 1440, height: 900 } : { width: window.innerWidth, height: window.innerHeight });

export const nowPanel = createStore({ setting: readSetting(), ...size() });

if (typeof window !== "undefined") window.addEventListener?.("resize", () => nowPanel.set(size()));

/**
 * Whether the panel shows: as chosen, and on "auto" when the window is taller than wide (a second screen
 * on its side, where the page alone left half the screen empty) or very wide. Never when the page would
 * be left too narrow.
 */
export function panelShown(setting: PanelSetting, width: number, height: number): boolean {
  if (setting === "off" || width < 980) return false;
  return setting === "on" || height > width || width >= 1700;
}

export function setNowPanel(setting: PanelSetting): void {
  nowPanel.set({ setting });
  try {
    localStorage.setItem(KEY, setting);
  } catch {
    // for this session only
  }
}

/** The bar's button: shows the panel if hidden, hides it if shown. */
export function toggleNowPanel(): void {
  const { setting, width, height } = nowPanel.get();
  setNowPanel(panelShown(setting, width, height) ? "off" : "on");
}

export function useNowPanel(): boolean {
  const setting = useStore(nowPanel, (s) => s.setting);
  const width = useStore(nowPanel, (s) => s.width);
  const height = useStore(nowPanel, (s) => s.height);
  const hasTrack = useStore(playback, (s) => Boolean(s.track));
  const flow = useStore(ui, (s) => s.route.name === "flow");
  return hasTrack && !flow && panelShown(setting, width, height);
}

// ── the cards ─────────────────────────────────────────────────────────────

function Card({ title, action, children, className, style }: { title: string; action?: React.ReactNode; children: React.ReactNode; className?: string; style?: CSSProperties }) {
  return (
    <section className={`rounded-2xl border border-white/10 bg-white/[0.05] p-4 ${className ?? ""}`} style={style}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-sm font-bold tracking-tight">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

const iconButton = "rounded-full border border-white/15 p-1.5 text-white/75 transition-colors hover:bg-white/10 hover:text-white";

/** Spotify's lyrics card, in the artwork's colour: the lines in time, the sung one lit word by word. */
function LyricsCard({ track, tint }: { track: Track; tint: string }) {
  const { state, lines } = useLyrics(track);
  const position = usePosition();
  const plain = state.status === "done" && lines.length === 0 ? state.result?.plain : null;
  const durationMs = useStore(playback, (s) => s.durationMs);
  const source = state.status === "done" ? state.result?.source : undefined;
  return (
    <Card
      title="Paroles"
      style={{
        background: `linear-gradient(160deg, rgb(${tint} / 0.55), rgb(${tint} / 0.22))`,
      }}
      action={
        <div className="flex gap-1.5">
          <button className={iconButton} onClick={() => run(toggleOverlay)} title="Paroles sur le bureau (Ctrl+Alt+K)" aria-label="Paroles sur le bureau">
            <Captions className="h-3.5 w-3.5" />
          </button>
          <button className={iconButton} onClick={() => ui.set({ lyricsStage: true })} title="Paroles plein écran (karaoké)" aria-label="Paroles plein écran">
            <ArrowUpRight className="h-3.5 w-3.5" />
          </button>
        </div>
      }
    >
      {lines.length > 0 ? (
        <div className="h-[230px] [mask-image:linear-gradient(to_bottom,transparent,black_14%,black_80%,transparent)]">
          <StagedLyrics lines={lines} position={position + 250} anchor={0.3} lineClassName="text-[22px] font-extrabold leading-[1.15] tracking-tight" />
        </div>
      ) : plain ? (
        <div className="h-[230px]">
          <PlainLyrics text={plain} position={position} durationMs={durationMs} className="text-lg font-bold leading-snug text-white/85" />
        </div>
      ) : (
        <p className="py-6 text-center text-sm text-white/60">
          {state.status === "loading" ? "Recherche des paroles…" : state.status === "done" && state.result?.instrumental ? "♪ Instrumental ♪" : "Pas de paroles pour ce titre."}
        </p>
      )}
      {source && <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.18em] text-white/45">Paroles : {SOURCE_NAMES[source]}</p>}
    </Card>
  );
}

/** What comes next, when this computer's player knows it (no request to Spotify). */
function NextCard() {
  const next = useStore(playback, (s) => s.nextTrack);
  if (!next) return null;
  return (
    <Card
      title="Ensuite"
      action={
        <button className={iconButton} onClick={() => run(engine.next)} title="Passer au suivant" aria-label="Passer au suivant">
          <SkipForward className="h-3.5 w-3.5" />
        </button>
      }
    >
      <div className="flex items-center gap-3">
        <Artwork src={next.thumb ?? next.image} className="h-12 w-12 shrink-0 rounded-lg" />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{next.name}</p>
          <p className="truncate text-xs text-gray-400">{next.artists.join(", ")}</p>
        </div>
      </div>
    </Card>
  );
}

let statsCache: {
  at: number;
  stats: Promise<Record<string, TrackStat>>;
} | null = null;

/** the history's numbers, asked of the main process at most once a minute */
function trackStats(): Promise<Record<string, TrackStat>> {
  if (!statsCache || Date.now() - statsCache.at > 60_000) {
    statsCache = {
      at: Date.now(),
      stats: window.vitrine.history?.insight("trackStats").catch(() => ({})) ?? Promise.resolve({}),
    };
  }
  return statsCache.stats;
}

const longDate = (iso: string) =>
  new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

/** What Vitrine knows that Spotify does not show: how often, since when, for how long. */
function ListensCard({ track }: { track: Track }) {
  const [stat, setStat] = useState<TrackStat | null | undefined>(undefined);
  useEffect(() => {
    let current = true;
    setStat(undefined);
    void trackStats().then((stats) => current && setStat(stats[track.uri] ?? null));
    return () => {
      current = false;
    };
  }, [track.uri]);
  if (stat === undefined) return null;
  return (
    <Card title="Vos écoutes">
      {stat ? (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="font-display text-3xl tracking-tight">{stat.plays}</p>
            <p className="text-xs text-gray-400">écoute{stat.plays > 1 ? "s" : ""}</p>
          </div>
          <div>
            <p className="font-display text-3xl tracking-tight">{Math.max(1, Math.round((stat.ms ?? 0) / 60_000))}</p>
            <p className="text-xs text-gray-400">minute{(stat.ms ?? 0) >= 90_000 ? "s" : ""}</p>
          </div>
          <p className="col-span-2 text-xs text-gray-400">
            {stat.first ? `Depuis le ${longDate(stat.first)}` : ""}
            {stat.first ? " · " : ""}dernière fois {lastPlayedLabel(stat.last)}
          </p>
        </div>
      ) : (
        <p className="text-sm text-gray-400">Première écoute dans Vitrine. ✨</p>
      )}
    </Card>
  );
}

/** The person's moments in this song: one click goes back to each. */
function MomentsCard({ track }: { track: Track }) {
  // the store's list as it is (a filtered copy at each read would never settle), filtered once per change
  const all = useStore(moments, (s) => s.list);
  const list = useMemo(() => all.filter((mark) => mark.uri === track.uri).sort((a, b) => a.atMs - b.atMs), [all, track.uri]);
  return (
    <Card
      title="Vos moments"
      action={
        <button
          className={iconButton}
          onClick={() => run(() => addMoment(track, engine.currentPosition(playback.get())))}
          title="Marquer ce moment (Ctrl+M)"
          aria-label="Marquer ce moment"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      }
    >
      {list.length === 0 ? (
        <p className="text-xs text-gray-400">Le refrain qui vous a eu, un drop : Ctrl+M le garde, avec une note.</p>
      ) : (
        <div className="space-y-1">
          {list.slice(0, 6).map((mark) => (
            <button
              key={mark.id}
              onClick={() => run(() => engine.seek(mark.atMs))}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors hover:bg-white/10"
            >
              <MapPin className="h-3.5 w-3.5 shrink-0 text-red-400" />
              <span className="font-mono text-xs text-white/70">{formatTime(mark.atMs)}</span>
              <span className="truncate">{mark.note || "Votre moment"}</span>
            </button>
          ))}
        </div>
      )}
    </Card>
  );
}

/** The first artist: picture, genres, and the way to their page (one request per artist and run). */
function ArtistCard({ track }: { track: Track }) {
  const id = track.artistIds[0];
  const [artist, setArtist] = useState<Artist | null>(null);
  useEffect(() => {
    let current = true;
    setArtist(null);
    if (id)
      api.artistCard(id).then(
        (found) => current && setArtist(found),
        () => undefined,
      );
    return () => {
      current = false;
    };
  }, [id]);
  if (!artist) return null;
  return (
    <section className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.05]">
      <button className="relative block h-44 w-full text-left" onClick={() => navigate({ name: "artist", id: artist.id })}>
        <Artwork src={artist.image ?? artist.card} className="h-full w-full rounded-none" />
        <span className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
        <span className="absolute left-4 top-3 text-sm font-bold">À propos de l'artiste</span>
        <span className="absolute bottom-3 left-4 right-4">
          <span className="block truncate font-display text-xl tracking-tight">{artist.name}</span>
          {artist.followers ? <span className="text-xs text-white/70">{artist.followers.toLocaleString("fr-FR")} abonnés</span> : null}
        </span>
      </button>
      {artist.genres.length > 0 && (
        <div className="flex flex-wrap gap-1.5 p-4 pt-3">
          {artist.genres.slice(0, 4).map((genre) => (
            <span key={genre} className="rounded-full border border-white/15 px-2.5 py-0.5 text-xs text-white/75">
              {genre}
            </span>
          ))}
        </div>
      )}
    </section>
  );
}

/** The lyric clip for TikTok, from the line being sung (the lyrics are already known: no new request). */
function PanelClip({ track }: { track: Track }) {
  const { lines } = useLyrics(track);
  return <ClipButton track={track} lines={lines} positionMs={() => engine.currentPosition(playback.get())} className="col-span-2" />;
}

// ── the panel ─────────────────────────────────────────────────────────────

/**
 * "À l'écoute": a column on the right, as Spotify's Now Playing view looks under Spicetify's themes —
 * the artwork with the title over it, the lyrics in time in a card of the artwork's colour, what comes
 * next, and what only Vitrine knows: the person's plays and moments in this song.
 */
export function NowPanel() {
  const shown = useNowPanel();
  const track = useStore(playback, (s) => s.track);
  const [color, setColor] = useState<Rgb>(FALLBACK);
  const art = track?.imageLarge ?? track?.image;
  useEffect(() => {
    void artworkColor(track?.thumb ?? track?.image).then(setColor);
  }, [track?.thumb ?? track?.image]);
  const tint = rgbVar(color);

  return (
    <AnimatePresence>
      {shown && track && (
        <motion.aside
          className="glass scrollbar-hide fixed bottom-[112px] right-4 top-20 z-[29] overflow-y-auto rounded-3xl"
          style={{ width: PANEL_WIDTH }}
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 24 }}
          transition={SPRING}
          aria-label="À l'écoute"
        >
          {/* the artwork, the title over its foot, in the artwork's colour */}
          <div className="relative" style={{ background: `rgb(${tint} / 0.35)` }}>
            <button className="block w-full" onClick={() => ui.set({ fullPlayer: true })} aria-label="Ouvrir le lecteur">
              <motion.div key={track.uri} initial={{ opacity: 0.4, scale: 1.03 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5 }}>
                <Artwork src={art} className="aspect-square w-full rounded-none" />
              </motion.div>
            </button>
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black/85 via-black/40 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 p-4">
              <div className="min-w-0">
                <p className="kicker truncate font-mono text-[10px] font-medium text-white/60">{track.albumName?.toUpperCase()}</p>
                <h2 className="font-display text-2xl leading-tight tracking-tight">
                  <Marquee text={track.name} />
                </h2>
                <ArtistLinks track={track} className="text-sm text-white/75" />
              </div>
              <LikeButton track={track} size="h-5 w-5" />
            </div>
          </div>

          <div className="space-y-3 p-3">
            <LyricsCard track={track} tint={tint} />
            <NextCard />
            <ListensCard track={track} />
            <MomentsCard track={track} />
            <ArtistCard track={track} />
            <div className="grid grid-cols-2 gap-2 pb-1">
              <button className="btn-ghost min-h-0 justify-center px-3 py-2 text-xs" onClick={() => openVersions(track)}>
                <Layers className="h-3.5 w-3.5" />
                Autres versions
              </button>
              <button
                className="btn-ghost min-h-0 justify-center px-3 py-2 text-xs"
                onClick={() => void shareStory(track).catch((error: unknown) => notify(errorMessage(error), "error"))}
              >
                <Share2 className="h-3.5 w-3.5" />
                Story
              </button>
              <PanelClip track={track} />
            </div>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
