// The light mode, after Movix's: on a modest computer (or when the system asks for less motion),
// the effects that cost memory and GPU are left out. Each one can also be turned off by hand.
import { createStore } from "./store";

export type LiteSetting = "auto" | "on" | "off";
export type Effect = "backdrops" | "blur" | "transitions" | "autoplay";
export type LiteReason = "reducedMotion" | "cpu" | "memory" | null;

const KEY = "vitrine.lite";
const ALL_ON: Record<Effect, boolean> = { backdrops: true, blur: true, transitions: true, autoplay: true };

export const EFFECTS: { key: Effect; label: string; hint: string }[] = [
  { key: "backdrops", label: "Fonds animés", hint: "Pochettes en mouvement derrière le lecteur, Flow et le bandeau, grain du thème Mystic." },
  { key: "blur", label: "Effets de flou", hint: "Panneaux en verre dépoli et fonds flous : le plus coûteux pour la carte graphique." },
  { key: "transitions", label: "Transitions", hint: "Les pages et les panneaux glissent et s'estompent." },
  { key: "autoplay", label: "Défilement du bandeau", hint: "Le bandeau de l'accueil passe seul à la diapositive suivante." },
];

/** Why the light mode would turn on by itself on this computer, if it would. */
export function autoReason(device: { hardwareConcurrency?: number; deviceMemory?: number }, reducedMotion: boolean): LiteReason {
  if (reducedMotion) return "reducedMotion";
  if (device.hardwareConcurrency && device.hardwareConcurrency <= 2) return "cpu";
  if (device.deviceMemory && device.deviceMemory <= 4) return "memory";
  return null;
}

export const REASONS: Record<Exclude<LiteReason, null>, string> = {
  reducedMotion: "Windows demande moins d'animations",
  cpu: "processeur à 2 cœurs ou moins",
  memory: "4 Go de mémoire ou moins",
};

/** What stays on: nothing in light mode, otherwise what the person left on. */
export function effective(setting: LiteSetting, reason: LiteReason, chosen: Record<Effect, boolean>): Record<Effect, boolean> {
  const light = setting === "on" || (setting === "auto" && reason !== null);
  return light ? { backdrops: false, blur: false, transitions: false, autoplay: false } : chosen;
}

interface Saved {
  setting: LiteSetting;
  chosen: Record<Effect, boolean>;
}

function read(): Saved {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? "null") as Partial<Saved> | null;
    const setting = parsed?.setting === "on" || parsed?.setting === "off" ? parsed.setting : "auto";
    return { setting, chosen: { ...ALL_ON, ...(parsed?.chosen ?? {}) } };
  } catch {
    return { setting: "auto", chosen: ALL_ON };
  }
}

const motionQuery = typeof window !== "undefined" ? window.matchMedia?.("(prefers-reduced-motion: reduce)") : undefined;
const device = () => (typeof navigator === "undefined" ? {} : (navigator as Navigator & { deviceMemory?: number }));

function compute(saved: Saved) {
  const reason = autoReason(device(), motionQuery?.matches ?? false);
  return { ...saved, reason, effects: effective(saved.setting, reason, saved.chosen) };
}

export const lite = createStore(compute(read()));

/** Puts the effects in force on the page: classes styles.css reads. */
export function applyLite(): void {
  const { effects } = lite.get();
  const root = document.documentElement.classList;
  root.toggle("no-backdrops", !effects.backdrops);
  root.toggle("no-blur", !effects.blur);
  root.toggle("no-transitions", !effects.transitions);
}

function save(next: Saved): void {
  lite.set(compute(next));
  applyLite();
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // for this session only
  }
}

export const setLiteSetting = (setting: LiteSetting) => save({ setting, chosen: lite.get().chosen });
export const setEffect = (key: Effect, on: boolean) => save({ setting: lite.get().setting, chosen: { ...lite.get().chosen, [key]: on } });

motionQuery?.addEventListener?.("change", () => {
  lite.set(compute({ setting: lite.get().setting, chosen: lite.get().chosen }));
  applyLite();
});
