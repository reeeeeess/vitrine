// The three looks, kept per viewer in localStorage. Mystic's display fonts come from Fontshare's own
// servers, so the app does not redistribute them; until they load, Archivo Black and Inter stand in.
import { createStore } from "./store";

export type Theme = "movix" | "mystic" | "glass";

const KEY = "vitrine.theme";
const FONTSHARE = "https://api.fontshare.com/v2/css?f[]=clash-display@500,600,700&f[]=satoshi@400,500,700&display=swap";

function saved(): Theme {
  try {
    const value = localStorage.getItem(KEY);
    return value === "mystic" || value === "glass" ? value : "movix";
  } catch {
    return "movix";
  }
}

const DYNAMIC_KEY = "vitrine.dynamicAccent";

function savedDynamic(): boolean {
  try {
    return localStorage.getItem(DYNAMIC_KEY) === "1";
  } catch {
    return false;
  }
}

const AMBIANCE_KEY = "vitrine.ambiance";

/** the artwork playing, blurred, behind the whole app (Spicetify's Hazy and Glowify): on unless turned off */
function savedAmbiance(): boolean {
  try {
    return localStorage.getItem(AMBIANCE_KEY) !== "0";
  } catch {
    return true;
  }
}

export const theme = createStore({ current: saved(), dynamic: savedDynamic(), ambiance: savedAmbiance() });

export function setAmbiance(on: boolean): void {
  theme.set({ ambiance: on });
  try {
    localStorage.setItem(AMBIANCE_KEY, on ? "1" : "0");
  } catch {
    // for this session only
  }
}

let fontsRequested = false;
async function loadMysticFonts(): Promise<void> {
  if (fontsRequested) return;
  fontsRequested = true;
  try {
    // Fontshare's stylesheet points at "//cdn.fontshare.com", which would resolve against app://;
    // it is fetched and given back its https scheme
    const css = (await (await fetch(FONTSHARE)).text()).replace(/url\('\/\//g, "url('https://");
    const style = document.createElement("style");
    style.dataset.fonts = "fontshare";
    style.textContent = css;
    document.head.append(style);
  } catch {
    fontsRequested = false; // offline: the fallback fonts stay, and the next switch tries again
  }
}

export function applyTheme(next: Theme = theme.get().current): void {
  document.documentElement.dataset.theme = next;
  if (next === "mystic") void loadMysticFonts();
}

export function setTheme(next: Theme): void {
  theme.set({ current: next });
  try {
    localStorage.setItem(KEY, next);
  } catch {
    // private storage: the choice lasts for this session
  }
  applyTheme(next);
}

// ── accent from the artwork ───────────────────────────────────────────────

type Rgb = [number, number, number];
const ACCENT_VARS = ["--accent-from", "--accent-to", "--c-red-400", "--c-red-500", "--c-red-600", "--c-accent-fg", "--play-bg", "--play-fg"];

const mix = (color: Rgb, toward: number, amount: number): Rgb => color.map((c) => Math.round(c + (toward - c) * amount)) as Rgb;
const css = ([r, g, b]: Rgb) => `${r} ${g} ${b}`;

/** The accent variables for an artwork colour: lighter for text, the colour itself for actions. */
export function accentFromColor(color: Rgb): Record<string, string> {
  const [r, g, b] = color;
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  const ink = luminance > 0.6 ? "10 9 8" : "255 255 255";
  return {
    "--accent-from": css(mix(color, 255, 0.15)),
    "--accent-to": css(mix(color, 0, 0.1)),
    "--c-red-400": css(mix(color, 255, 0.35)),
    "--c-red-500": css(mix(color, 255, 0.15)),
    "--c-red-600": css(color),
    "--c-accent-fg": ink,
    "--play-bg": css(color),
    "--play-fg": ink,
  };
}

/** Sets the accent from an artwork colour, or (null) goes back to the theme's own. */
export function applyAccent(color: Rgb | null): void {
  const style = document.documentElement.style;
  if (!color) {
    for (const name of ACCENT_VARS) style.removeProperty(name);
    return;
  }
  for (const [name, value] of Object.entries(accentFromColor(color))) style.setProperty(name, value);
}

export function setDynamicAccent(on: boolean): void {
  theme.set({ dynamic: on });
  try {
    localStorage.setItem(DYNAMIC_KEY, on ? "1" : "0");
  } catch {
    // for this session only
  }
  if (!on) applyAccent(null);
}
