import { AnimatePresence, motion } from "framer-motion";
import { Headphones, Loader2, Mic, MicOff } from "lucide-react";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { cn } from "../lib/cn";
import { useStore } from "../lib/store";
import { karaoke, startKaraoke, stopKaraoke } from "../player/karaoke";
import { mic, MIC_EFFECTS, setMicEffect, setMicVolume, startMic, stopMic } from "../player/microphone";
import { run } from "./NowPlayingBar";

/**
 * Apple Music Sing's voice slider, as far as Spotify allows: Spotify's sound cannot be remixed, so the
 * voice is either there (the original) or gone (the official instrumental, at the same moment). Two
 * notches, said plainly.
 */
export function VoiceSlider() {
  const current = useStore(karaoke, (s) => s.current);
  const searching = useStore(karaoke, (s) => s.searching);
  const voice = current ? 0 : 1;
  const change = (next: number) => {
    if (searching || next === voice) return;
    run(next === 0 ? startKaraoke : stopKaraoke);
  };
  return (
    <div className="flex items-center gap-2">
      {current?.approximate && <span className="rounded-full border border-amber-300/40 px-2.5 py-1 text-[11px] text-amber-200">synchro approximative</span>}
      <label
        className="flex items-center gap-2 rounded-full border border-white/20 px-3 py-1.5 text-xs font-medium text-white/80"
        title="Voix : la version originale. Sans : la version instrumentale officielle, au même moment (Spotify ne permet pas de baisser la voix d'un titre)."
      >
        {searching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : voice ? <Mic className="h-3.5 w-3.5" /> : <MicOff className="h-3.5 w-3.5 text-red-300" />}
        Voix
        <input
          type="range"
          min={0}
          max={1}
          step={1}
          value={voice}
          disabled={searching}
          onChange={(event) => change(Number(event.target.value))}
          className="range w-14"
          style={{ "--value": `${voice * 100}%` } as CSSProperties}
          aria-label="Voix du chanteur"
          aria-valuetext={voice ? "Avec la voix" : "Sans la voix (instrumental)"}
        />
        <span className="w-9 text-white/60">{voice ? "100 %" : "0 %"}</span>
      </label>
    </div>
  );
}

/** The level of the voice, as five bars. */
function Meter({ level }: { level: number }) {
  return (
    <span className="flex h-3.5 items-end gap-[2px]" aria-hidden="true">
      {[0.08, 0.2, 0.35, 0.55, 0.75].map((step) => (
        <span key={step} className={cn("w-[3px] rounded-full transition-colors duration-75", level >= step ? (step >= 0.75 ? "bg-red-400" : "bg-emerald-300") : "bg-white/20")} style={{ height: `${30 + step * 90}%` }} />
      ))}
    </span>
  );
}

/** The computer's microphone for singing along: on or off, an effect, a volume, and the level. */
export function MicButton() {
  const { on, starting, effect, volume, level, error } = useStore(mic, (s) => s);
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const away = (event: MouseEvent) => !box.current?.contains(event.target as Node) && setOpen(false);
    window.addEventListener("mousedown", away);
    return () => window.removeEventListener("mousedown", away);
  }, [open]);

  return (
    <div ref={box} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
          on ? "border-red-400/60 bg-red-500/25 text-white" : "border-white/20 text-white/70 hover:text-white",
        )}
        aria-expanded={open}
        title="Chanter dans le micro de l'ordinateur"
      >
        {starting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mic className="h-3.5 w-3.5" />}
        Micro
        {on && <Meter level={level} />}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
            className="glass absolute right-0 top-full z-30 mt-2 w-[300px] space-y-3 rounded-2xl p-4 text-sm"
          >
            <div className="flex items-center justify-between">
              <span className="font-semibold">Votre voix</span>
              <button onClick={() => (on ? stopMic() : void startMic())} className={cn("rounded-full px-3 py-1 text-xs font-semibold", on ? "bg-white/15 text-white" : "accent-bg")} disabled={starting}>
                {on ? "Couper" : "Activer le micro"}
              </button>
            </div>
            {error && <p className="text-xs text-amber-200">{error}</p>}
            <div className="flex flex-wrap gap-1.5">
              {MIC_EFFECTS.map((option) => (
                <button
                  key={option.key}
                  onClick={() => setMicEffect(option.key)}
                  aria-pressed={effect === option.key}
                  className={cn("rounded-full border px-2.5 py-1 text-xs transition-colors", effect === option.key ? "border-white/50 bg-white/15 text-white" : "border-white/15 text-white/65 hover:text-white")}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <label className="flex items-center gap-3 text-xs text-white/70">
              Volume
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(volume * 100)}
                onChange={(event) => setMicVolume(Number(event.target.value) / 100)}
                className="range flex-1"
                style={{ "--value": `${volume * 100}%` } as CSSProperties}
                aria-label="Volume de la voix"
              />
            </label>
            <p className="flex gap-2 text-[11px] leading-snug text-white/50">
              <Headphones className="h-4 w-4 shrink-0" />
              Avec un casque, c'est mieux : sinon le son des enceintes revient dans le micro (larsen).
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
