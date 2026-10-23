import { motion } from "framer-motion";
import { Copy, Download, ExternalLink, SlidersHorizontal, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { EqualizerSettings, EqualizerStatus } from "../global";
import { cn } from "../lib/cn";
import { bandLabel, BANDS, curvePath, MAX_GAIN, presetOf, PRESETS } from "../lib/eqPresets";
import { SPRING } from "../lib/motion";
import { createStore, useStore } from "../lib/store";
import { notify } from "../lib/ui";

export const equalizerOpen = createStore({ open: false });
export const openEqualizer = () => equalizerOpen.set({ open: true });
const close = () => equalizerOpen.set({ open: false });

const WIDTH = 520;
const HEIGHT = 180;

/** What to do, depending on how Equalizer APO stands on this PC. */
function StatusNote({ status }: { status: EqualizerStatus }) {
  const bridge = window.vitrine.equalizer;
  if (status.state === "ready") {
    return <p className="text-xs text-emerald-300/90">Equalizer APO est relié : les réglages s'appliquent à la sortie son de Windows, tout de suite.</p>;
  }
  if (status.state === "unsupported") {
    return (
      <p className="text-sm text-gray-400">
        {window.vitrine.platform === "linux"
          ? "L'égaliseur passe par Windows (Equalizer APO). Sous Linux, EasyEffects (PipeWire) fait la même chose pour tout le son."
          : "L'égaliseur passe par Windows (Equalizer APO). Sur cet ordinateur, utilisez l'égaliseur du système ou d'une appli comme eqMac."}
      </p>
    );
  }
  if (status.state === "absent") {
    return (
      <div className="space-y-2 rounded-2xl border border-amber-300/30 bg-amber-300/10 p-4 text-sm text-amber-50">
        <p className="font-semibold">Une installation, une seule fois</p>
        <ol className="list-decimal space-y-1 pl-5 text-amber-50/90">
          <li>Installez Equalizer APO (gratuit, libre).</li>
          <li>Pendant l'installation, cochez votre sortie son (haut-parleurs ou casque).</li>
          <li>Redémarrez Windows, puis revenez ici : Vitrine s'y relie toute seule.</li>
        </ol>
        <button onClick={() => void bridge?.openEditor()} className="btn-ghost min-h-0 px-3 py-1.5 text-sm">
          <Download className="h-4 w-4" />
          Télécharger Equalizer APO
        </button>
      </div>
    );
  }
  return (
    <div className="space-y-2 rounded-2xl border border-amber-300/30 bg-amber-300/10 p-4 text-sm text-amber-50">
      <p className="font-semibold">Dernière étape : ajouter une ligne</p>
      <p className="text-amber-50/90">Windows protège la configuration d'Equalizer APO. Ouvrez son éditeur (« Configuration Editor »), ajoutez cette ligne à la fin, enregistrez :</p>
      <code className="block select-all break-all rounded-lg bg-black/40 px-3 py-2 font-mono text-xs">{status.includeLine}</code>
      <div className="flex gap-2">
        <button onClick={() => void window.vitrine.copy(status.includeLine ?? "").then(() => notify("Ligne copiée"))} className="btn-ghost min-h-0 px-3 py-1.5 text-sm">
          <Copy className="h-4 w-4" />
          Copier la ligne
        </button>
        <button onClick={() => void bridge?.openEditor()} className="btn-ghost min-h-0 px-3 py-1.5 text-sm">
          <ExternalLink className="h-4 w-4" />
          Ouvrir l'éditeur
        </button>
      </div>
    </div>
  );
}

/**
 * The equalizer: ten bands and presets, applied at Windows' sound output by Equalizer APO. Spotify's
 * sound is protected and its rules forbid altering it inside an app; the output of the PC is the
 * person's own.
 */
export function EqualizerPanel() {
  const open = useStore(equalizerOpen, (s) => s.open);
  const [status, setStatus] = useState<EqualizerStatus | null>(null);
  const [settings, setSettings] = useState<EqualizerSettings | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (!open) return;
    void window.vitrine.equalizer?.get().then((next) => {
      setStatus(next);
      setSettings(next.settings);
    });
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // a slider sends many values: the file is written for the last one
  const change = (next: EqualizerSettings) => {
    setSettings(next);
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => void window.vitrine.equalizer?.set(next).then(setStatus), 150);
  };

  if (!open || !settings || !status) return null;
  const preset = presetOf(settings.gains);
  return (
    <motion.div className="fixed inset-0 z-[72] flex items-center justify-center bg-black/60 p-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} onMouseDown={(event) => event.target === event.currentTarget && close()}>
      <motion.div className="glass w-[min(640px,96vw)] rounded-3xl p-7" initial={{ scale: 0.96, y: 10 }} animate={{ scale: 1, y: 0 }} transition={SPRING}>
        <div className="flex items-start justify-between">
          <div>
            <span className="kicker flex items-center gap-1.5 font-mono font-medium text-red-400">
              <SlidersHorizontal className="h-3.5 w-3.5" />
              ÉGALISEUR
            </span>
            <h2 className="mt-1 font-display text-3xl tracking-tight">{settings.enabled ? preset : "Désactivé"}</h2>
          </div>
          <div className="flex items-center gap-3">
            <button
              role="switch"
              aria-checked={settings.enabled}
              onClick={() => change({ ...settings, enabled: !settings.enabled })}
              disabled={status.state === "unsupported"}
              className={cn("relative h-7 w-12 rounded-full transition-colors disabled:opacity-40", settings.enabled ? "accent-bg" : "bg-white/15")}
              aria-label="Activer l'égaliseur"
            >
              <span className={cn("absolute top-1 h-5 w-5 rounded-full bg-white transition-all", settings.enabled ? "left-6" : "left-1")} />
            </button>
            <button onClick={close} className="rounded-full p-2 text-gray-400 hover:bg-white/10 hover:text-white" aria-label="Fermer">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {Object.keys(PRESETS).map((name) => (
            <button
              key={name}
              onClick={() => change({ ...settings, enabled: true, preset: name, gains: PRESETS[name] })}
              className={cn("rounded-full border px-3 py-1 text-xs font-medium transition-colors", settings.enabled && preset === name ? "border-transparent accent-bg" : "border-white/15 text-white/70 hover:text-white")}
            >
              {name}
            </button>
          ))}
        </div>

        <div className={cn("relative mt-6 transition-opacity", !settings.enabled && "opacity-40")} style={{ height: HEIGHT + 30 }}>
          {/* the curve through the ten knobs, the accent under it */}
          <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="none" className="pointer-events-none absolute inset-x-[18px] top-0" style={{ height: HEIGHT, width: `calc(100% - 36px)` }} aria-hidden="true">
            <defs>
              <linearGradient id="eq-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgb(var(--c-red-600))" stopOpacity="0.45" />
                <stop offset="100%" stopColor="rgb(var(--c-red-600))" stopOpacity="0" />
              </linearGradient>
            </defs>
            <line x1="0" x2={WIDTH} y1={HEIGHT / 2} y2={HEIGHT / 2} stroke="rgb(255 255 255 / 0.15)" strokeDasharray="4 6" />
            <path d={`${curvePath(settings.gains, WIDTH, HEIGHT)} L ${WIDTH} ${HEIGHT} L 0 ${HEIGHT} Z`} fill="url(#eq-fill)" />
            <path d={curvePath(settings.gains, WIDTH, HEIGHT)} fill="none" stroke="rgb(var(--c-red-500))" strokeWidth="3" strokeLinecap="round" />
          </svg>
          <div className="absolute inset-0 flex justify-between">
            {BANDS.map((band, i) => (
              <label key={band} className="flex w-9 flex-col items-center">
                <input
                  type="range"
                  min={-MAX_GAIN}
                  max={MAX_GAIN}
                  step={0.5}
                  value={settings.gains[i]}
                  disabled={!settings.enabled}
                  onChange={(event) => {
                    const gains = [...settings.gains];
                    gains[i] = Number(event.target.value);
                    change({ ...settings, preset: presetOf(gains), gains });
                  }}
                  className="eq-slider"
                  style={{ height: HEIGHT }}
                  aria-label={`${bandLabel(band)} Hz`}
                />
                <span className="mt-2 font-mono text-[10px] text-gray-400">{bandLabel(band)}</span>
              </label>
            ))}
          </div>
        </div>
        <div className="mt-2 flex justify-between font-mono text-[10px] text-gray-500">
          <span>+{MAX_GAIN} dB en haut · −{MAX_GAIN} dB en bas</span>
          <span>{settings.gains.map((gain) => (gain > 0 ? `+${gain}` : gain)).join(" ")}</span>
        </div>
        <div className="mt-5">
          <StatusNote status={status} />
        </div>
      </motion.div>
    </motion.div>
  );
}
