// The first launch (v1.0): what Vitrine does, in three screens — the player, what makes it Vitrine, and
// how it looks (theme and language chosen right there). Once; "Passer" or Échap leave it at any time.
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Keyboard, Mic2, Music2, Sparkles, Tv, Languages, BarChart3 } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "../lib/cn";
import { languageSetting, setLanguage, type LanguageSetting } from "../lib/i18n";
import { EASE } from "../lib/motion";
import { useStore } from "../lib/store";
import { setTheme, theme, THEMES } from "../lib/theme";
import { Logo } from "./Header";

const DONE_KEY = "vitrine.welcomed";
/** the screen to come back to after the page reloads in another language */
const STEP_KEY = "vitrine.welcomeStep";

const read = (storage: () => Storage, key: string) => {
  try {
    return storage().getItem(key);
  } catch {
    return null;
  }
};

const LANGUAGES: { value: LanguageSetting; name: string }[] = [
  { value: "auto", name: "Auto" },
  { value: "fr", name: "Français" },
  { value: "en", name: "English" },
];

function Feature({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10 text-red-400" aria-hidden="true">
        {icon}
      </span>
      <span>
        <span className="block text-sm font-semibold">{title}</span>
        <span className="block text-sm text-gray-400">{children}</span>
      </span>
    </li>
  );
}

export function Welcome() {
  const [open, setOpen] = useState(() => read(() => localStorage, DONE_KEY) !== "1");
  const [step, setStep] = useState(() => Number(read(() => sessionStorage, STEP_KEY) ?? 0) || 0);
  const current = useStore(theme, (s) => s.current);
  const panel = useRef<HTMLDivElement>(null);
  const finish = () => {
    try {
      localStorage.setItem(DONE_KEY, "1");
      sessionStorage.removeItem(STEP_KEY);
    } catch {
      // shown again next launch, no harm
    }
    setOpen(false);
  };
  const go = (next: number) => setStep(Math.max(0, Math.min(2, next)));

  useEffect(() => {
    if (!open) return;
    panel.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      event.stopPropagation();
      if (event.key === "Escape") finish();
      else if (event.key === "ArrowRight") go(step + 1);
      else if (event.key === "ArrowLeft") go(step - 1);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, step]);

  const chooseLanguage = (value: LanguageSetting) => {
    if (value === languageSetting()) return;
    try {
      sessionStorage.setItem(STEP_KEY, "2");
    } catch {
      // back to the first screen after the reload
    }
    setLanguage(value);
  };

  const screens = [
    {
      kicker: "Bienvenue",
      title: (
        <>
          Votre musique,
          <br />
          <span className="text-accent-gradient">en vitrine.</span>
        </>
      ),
      body: (
        <ul className="mt-6 space-y-4">
          <Feature icon={<Music2 className="h-4 w-4" />} title="Un lecteur Spotify de bureau">
            Sur l'API officielle de Spotify : vos playlists, vos albums, vos titres likés. La lecture sur cet ordinateur demande Spotify Premium ; sans, Vitrine pilote vos autres appareils.
          </Feature>
          <Feature icon={<Sparkles className="h-4 w-4" />} title="Flow, la découverte en continu">
            Un fil vertical de titres choisis d'après vos goûts : un geste pour passer, un cœur pour garder.
          </Feature>
        </ul>
      ),
    },
    {
      kicker: "Ce qui change",
      title: "Les paroles comme sur scène",
      body: (
        <ul className="mt-6 space-y-4">
          <Feature icon={<Mic2 className="h-4 w-4" />} title="Karaoké mot à mot">
            Chaque mot s'allume au bon moment ; dans un feat, chaque artiste de son côté. Traduction sous chaque ligne, et la voix coupée quand une version instrumentale existe.
          </Feature>
          <Feature icon={<Tv className="h-4 w-4" />} title="Mode salon et deuxième écran">
            Plein écran lisible de loin, paroles sur le bureau par-dessus les autres applis.
          </Feature>
          <Feature icon={<BarChart3 className="h-4 w-4" />} title="Vos écoutes, gardées ici">
            Stats, Rétro Vitrine en vidéo, images à partager : tout est calculé sur cet ordinateur.
          </Feature>
        </ul>
      ),
    },
    {
      kicker: "À votre goût",
      title: "Choisissez votre vitrine",
      body: (
        <div className="mt-6 space-y-6">
          <div>
            <p className="text-sm font-semibold">Thème</p>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {THEMES.map((option) => (
                <button
                  key={option.id}
                  onClick={() => setTheme(option.id)}
                  aria-pressed={current === option.id}
                  className={cn("rounded-2xl border p-3 text-left transition-colors", current === option.id ? "border-red-500/70 bg-white/[0.08]" : "border-white/10 hover:border-white/25")}
                >
                  <span className="flex gap-1" aria-hidden="true">
                    {option.swatches.map((color) => (
                      <span key={color} className="h-4 w-4 rounded-full ring-1 ring-white/20" style={{ background: color }} />
                    ))}
                  </span>
                  <span className="mt-2 block text-sm font-semibold">{option.name}</span>
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="flex items-center gap-2 text-sm font-semibold">
              <Languages className="h-4 w-4 text-red-400" aria-hidden="true" /> Langue · Language
            </p>
            <div translate="no" className="mt-2 flex w-fit gap-1 rounded-full border border-white/10 p-1">
              {LANGUAGES.map((option) => (
                <button
                  key={option.value}
                  onClick={() => chooseLanguage(option.value)}
                  aria-pressed={languageSetting() === option.value}
                  className={cn("rounded-full px-3 py-1 text-xs font-medium transition-colors", languageSetting() === option.value ? "bg-white/15 text-white" : "text-gray-400 hover:text-white")}
                >
                  {option.name}
                </button>
              ))}
            </div>
          </div>
          <p className="flex items-center gap-2 text-sm text-gray-400">
            <Keyboard className="h-4 w-4 shrink-0" aria-hidden="true" /> « ? » liste les raccourcis clavier, et chacun se change.
          </p>
        </div>
      ),
    },
  ];
  const screen = screens[step];

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/70 p-6 backdrop-blur-md" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.25 } }}>
          <motion.div
            ref={panel}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-labelledby="welcome-title"
            className="glass relative w-[min(560px,94vw)] overflow-hidden rounded-[2rem] border border-white/15 bg-[#111]/90 p-9 shadow-2xl outline-none"
            initial={{ y: 24, scale: 0.97 }}
            animate={{ y: 0, scale: 1, transition: { duration: 0.45, ease: EASE } }}
          >
            <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-red-600/25 blur-[90px]" aria-hidden="true" />
            <div className="flex items-center justify-between">
              <Logo />
              <button onClick={finish} className="rounded-full px-3 py-1 text-xs font-medium text-white/60 hover:bg-white/10 hover:text-white">
                Passer
              </button>
            </div>
            <AnimatePresence mode="wait" initial={false}>
              <motion.div key={step} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0, transition: { duration: 0.35, ease: EASE } }} exit={{ opacity: 0, x: -24, transition: { duration: 0.15 } }}>
                <p className="kicker mt-8 text-red-400">{screen.kicker}</p>
                <h1 id="welcome-title" className="mt-2 font-display text-4xl leading-tight tracking-tight">
                  {screen.title}
                </h1>
                {screen.body}
              </motion.div>
            </AnimatePresence>
            <div className="mt-9 flex items-center justify-between">
              <div className="flex gap-1.5" role="tablist" aria-label="Écrans">
                {screens.map((_, index) => (
                  <button
                    key={index}
                    role="tab"
                    aria-selected={index === step}
                    aria-label={`Écran ${index + 1} sur 3`}
                    onClick={() => go(index)}
                    className={cn("h-2 rounded-full transition-all", index === step ? "w-7 bg-white" : "w-2 bg-white/30 hover:bg-white/60")}
                  />
                ))}
              </div>
              <div className="flex gap-2">
                {step > 0 && (
                  <button onClick={() => go(step - 1)} className="btn-ghost min-h-0 px-4 py-2 text-sm">
                    <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Précédent
                  </button>
                )}
                {step < 2 ? (
                  <button onClick={() => go(step + 1)} className="btn-primary min-h-0 px-5 py-2 text-sm">
                    Suivant <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </button>
                ) : (
                  <button onClick={finish} className="btn-primary min-h-0 px-5 py-2 text-sm">
                    C'est parti
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
