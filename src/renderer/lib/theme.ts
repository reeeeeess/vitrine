// The two looks, kept per viewer in localStorage. Mystic's display fonts come from Fontshare's own
// servers, so the app does not redistribute them; until they load, Archivo Black and Inter stand in.
import { createStore } from "./store";

export type Theme = "movix" | "mystic";

const KEY = "vitrine.theme";
const FONTSHARE = "https://api.fontshare.com/v2/css?f[]=clash-display@500,600,700&f[]=satoshi@400,500,700&display=swap";

function saved(): Theme {
  try {
    return localStorage.getItem(KEY) === "mystic" ? "mystic" : "movix";
  } catch {
    return "movix";
  }
}

export const theme = createStore({ current: saved() });

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
