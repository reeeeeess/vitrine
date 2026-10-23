import { BarChart3, Download, Home, Hourglass, Library, LogOut, Palette, Search, Settings, Sparkles, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { rateLimit } from "../lib/apiGate";
import { cn } from "../lib/cn";
import { pageTitle } from "../lib/pageTitle";
import type { Profile } from "../lib/spotify";
import { formatWait, pauseMessage } from "../lib/spotifyLimit";
import { useStore } from "../lib/store";
import { setTheme, theme } from "../lib/theme";
import { updates } from "../lib/updates";
import { navigate, notify, ui, type Route } from "../lib/ui";

const LINKS: { label: string; route: Route; icon: typeof Home }[] = [
  { label: "Accueil", route: { name: "home" }, icon: Home },
  { label: "Flow", route: { name: "flow" }, icon: Sparkles },
  { label: "Bibliothèque", route: { name: "library" }, icon: Library },
  { label: "Stats", route: { name: "stats" }, icon: BarChart3 },
];

/** [Vitrine]: the brackets of the [ix] family (Movix, Loadix), in the theme's accent. */
export function Logo() {
  return (
    <span className="flex items-center font-display text-xl tracking-tight" aria-label="Vitrine">
      <span className="-mr-px text-red-600" aria-hidden="true">
        [
      </span>
      Vitrine
      <span className="-ml-px text-red-600" aria-hidden="true">
        ]
      </span>
    </span>
  );
}

/** Switches between the Movix look and the mysticsaba.com one. */
export function ThemeToggle() {
  const current = useStore(theme, (s) => s.current);
  const next = current === "movix" ? "mystic" : "movix";
  return (
    <button
      onClick={() => setTheme(next)}
      className="kicker flex items-center gap-2 rounded-btn border border-white/10 px-3 py-2 text-gray-400 transition-colors hover:border-red-500/60 hover:text-white"
      title={`Passer au thème ${next === "mystic" ? "Mystic" : "Movix"}`}
    >
      <Palette className="h-4 w-4" />
      {current === "mystic" ? "Mystic" : "Movix"}
    </button>
  );
}

/** The page's title, small, once its big title has scrolled under the header. */
function CollapsedTitle() {
  const text = useStore(pageTitle, (s) => s.text);
  return (
    <AnimatePresence>
      {text && (
        <motion.span
          key={text}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.2 }}
          className="max-w-[12rem] shrink-0 truncate font-display text-lg tracking-tight"
        >
          {text}
        </motion.span>
      )}
    </AnimatePresence>
  );
}

/** short pauses are waited out quietly; longer ones are said here, for as long as they last */
const LONG_PAUSE_MS = 20_000;

/**
 * Spotify's long pauses (Too many requests), which can last hours: a pill that counts down, the details
 * on click, and a toast the first time a part is paused.
 */
function PausePill() {
  const paused = useStore(rateLimit, (s) => s.paused);
  const [now, setNow] = useState(Date.now());
  const [open, setOpen] = useState(false);
  const told = useRef(new Set<string>());
  useEffect(() => {
    setNow(Date.now());
    if (paused.length === 0) return;
    const timer = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(timer);
  }, [paused]);
  const long = paused.filter(([, until]) => until - now >= LONG_PAUSE_MS);
  useEffect(() => {
    for (const [area, until] of long) {
      if (told.current.has(`${area}${until}`)) continue;
      told.current.add(`${area}${until}`);
      notify(pauseMessage(until, area));
    }
  }, [long.map(([area, until]) => `${area}${until}`).join()]);
  if (long.length === 0) return null;
  const longest = long[0][1];
  return (
    <div className="relative shrink-0">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 whitespace-nowrap rounded-btn border border-amber-400/40 bg-amber-400/10 px-2.5 py-2 font-mono text-xs text-amber-200 transition-colors hover:bg-amber-400/20"
        title="Spotify fait patienter Vitrine (trop de demandes) : cliquez pour le détail"
        aria-label={`Pause Spotify : ${formatWait(longest - now)}`}
        aria-expanded={open}
      >
        <Hourglass className="h-4 w-4" />
        {formatWait(longest - now)}
      </button>
      {open && (
        <div className="glass absolute right-0 top-full z-50 mt-2 w-[380px] space-y-2 rounded-xl border-amber-400/30 p-4 text-sm text-amber-50" role="status">
          {long.map(([area, until]) => (
            <p key={area}>{pauseMessage(until, area, now)}</p>
          ))}
          <p className="text-xs text-white/60">
            Vitrine n'envoie plus rien à ces parties de Spotify d'ici là (insister prolongerait l'attente) et affiche la dernière version connue. Le reste de
            Vitrine et l'appli Spotify officielle fonctionnent normalement.
          </p>
        </div>
      )}
    </div>
  );
}

/** Shown once a new version has downloaded: one click restarts into it. */
function UpdatePill() {
  const state = useStore(updates, (s) => s.state);
  if (state.status !== "ready") return null;
  return (
    <button onClick={() => void window.vitrine.updates.install()} className="accent-bg kicker flex shrink-0 items-center gap-2 whitespace-nowrap rounded-btn px-3 py-2 font-semibold" title={`Redémarrer Vitrine pour installer la version ${state.version ?? ""}`}>
      <Download className="h-4 w-4" />
      Installer {state.version}
    </button>
  );
}

export function Header({ profile, scrolled, onLogout }: { profile?: Profile; scrolled: boolean; onLogout: () => void }) {
  const route = useStore(ui, (s) => s.route);
  const [query, setQuery] = useState(route.name === "search" ? (route.query ?? "") : "");
  const input = useRef<HTMLInputElement>(null);
  const platform = window.vitrine.platform;

  // typing searches as you go, a moment after the last key
  useEffect(() => {
    // an emptied box on the results shows the recent searches again (Apple Music)
    if (!query.trim()) {
      if (ui.get().route.name === "search" && (ui.get().route as { query?: string }).query) navigate({ name: "search" });
      return;
    }
    const timer = setTimeout(() => navigate({ name: "search", query: query.trim() }), 350);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      // Ctrl+K, and Ctrl+F as in the Music app
      if ((event.metaKey || event.ctrlKey) && ["k", "f"].includes(event.key.toLowerCase())) {
        event.preventDefault();
        input.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <header
      className={cn(
        "drag fixed inset-x-0 top-0 z-40 flex h-16 items-center gap-6 transition-all duration-300",
        platform === "darwin" ? "pl-24" : "pl-6",
        platform === "darwin" ? "pr-6" : "pr-40",
        scrolled ? "border-b border-white/5 bg-black/80 backdrop-blur-xl" : "bg-gradient-to-b from-black/90 to-transparent",
      )}
    >
      <button className="shrink-0 transition-transform duration-300 hover:scale-105" onClick={() => navigate({ name: "home" })}>
        <Logo />
      </button>

      <nav className="flex items-center gap-1">
        {LINKS.map(({ label, route: target, icon: Icon }) => {
          const active = route.name === target.name;
          return (
            <button
              key={label}
              onClick={() => navigate(target)}
              className={cn(
                "flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
                active ? "bg-white/10 text-white" : "text-gray-400 hover:bg-white/5 hover:text-white",
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          );
        })}
      </nav>

      <CollapsedTitle />

      <div className="relative ml-auto w-[20rem] min-w-0">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
        <input
          ref={input}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onFocus={() => navigate(query.trim() ? { name: "search", query: query.trim() } : { name: "search" })}
          placeholder="Titres, artistes, albums…  (Ctrl K)"
          className="w-full rounded-xl border border-white/10 bg-white/5 py-2 pl-9 pr-9 text-sm text-white placeholder-gray-500 transition-all focus:border-red-500/50 focus:bg-white/10 focus:outline-none focus:ring-1 focus:ring-red-500/30"
        />
        {query && (
          <button
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
            onClick={() => {
              setQuery("");
              input.current?.focus();
            }}
            aria-label="Effacer"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <PausePill />
      <UpdatePill />
      <ThemeToggle />
      <button
        onClick={() => navigate({ name: "settings" })}
        className={cn("rounded-lg p-2 transition-colors", route.name === "settings" ? "bg-white/10 text-white" : "text-gray-400 hover:bg-white/5 hover:text-white")}
        aria-label="Réglages"
        title="Réglages"
      >
        <Settings className="h-4 w-4" />
      </button>

      {profile && (
        <div className="flex shrink-0 items-center gap-2">
          {profile.image ? (
            <img src={profile.image} alt="" className="h-9 w-9 rounded-full object-cover ring-1 ring-white/15" />
          ) : (
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.07] text-sm font-semibold">
              {profile.name.slice(0, 1).toUpperCase()}
            </span>
          )}
          <button
            onClick={onLogout}
            className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-white/5 hover:text-white"
            title="Se déconnecter"
            aria-label="Se déconnecter"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      )}
    </header>
  );
}
