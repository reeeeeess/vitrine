// Vitrine's keyboard shortcuts (v1.0), the person's own once changed: each action has its keys, kept on
// this computer; "?" lists them all and lets any be changed. The global ones (wherever the focus is) are
// kept by the main process (electron/cli.ts) and written here the same way: "Ctrl+Alt+Space".
import { createStore } from "./store";

export type ShortcutAction = "togglePlay" | "next" | "previous" | "volumeUp" | "volumeDown" | "search" | "reveal" | "moment" | "lyrics" | "like" | "salon" | "help";

export const SHORTCUT_ACTIONS: { id: ShortcutAction; label: string; keys: string }[] = [
  { id: "togglePlay", label: "Lecture / pause", keys: "Space" },
  { id: "next", label: "Titre suivant", keys: "Ctrl+ArrowRight" },
  { id: "previous", label: "Titre précédent", keys: "Ctrl+ArrowLeft" },
  { id: "volumeUp", label: "Monter le volume", keys: "Ctrl+ArrowUp" },
  { id: "volumeDown", label: "Baisser le volume", keys: "Ctrl+ArrowDown" },
  { id: "search", label: "Recherche", keys: "Ctrl+K" },
  { id: "reveal", label: "Aller au titre en cours", keys: "Ctrl+L" },
  { id: "moment", label: "Marquer un moment", keys: "Ctrl+M" },
  { id: "lyrics", label: "Paroles plein écran", keys: "Ctrl+Shift+L" },
  { id: "like", label: "Liker le titre en cours", keys: "Alt+Shift+B" },
  { id: "salon", label: "Mode salon", keys: "Ctrl+Shift+S" },
  { id: "help", label: "Les raccourcis (cette liste)", keys: "?" },
];

const DEFAULTS = Object.fromEntries(SHORTCUT_ACTIONS.map((action) => [action.id, action.keys])) as Record<ShortcutAction, string>;
const KEY = "vitrine.shortcuts";

function saved(): Partial<Record<ShortcutAction, string>> {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(KEY) ?? "{}");
    if (!parsed || typeof parsed !== "object") return {};
    return Object.fromEntries(Object.entries(parsed).filter(([id, keys]) => id in DEFAULTS && typeof keys === "string" && keys));
  } catch {
    return {};
  }
}

export const shortcuts = createStore({
  keys: { ...DEFAULTS, ...saved() } as Record<ShortcutAction, string>,
  /** the list ("?") is open */
  open: false,
});

const MODIFIERS = ["Control", "Shift", "Alt", "Meta", "AltGraph", "CapsLock", "Dead", "Unidentified", "Process"];

/** The keys of a key press, as written here ("Ctrl+Shift+S", "Space", "?"); null for a modifier alone. */
export function comboOf(event: Pick<KeyboardEvent, "key" | "ctrlKey" | "metaKey" | "altKey" | "shiftKey">): string | null {
  if (MODIFIERS.includes(event.key)) return null;
  const key = event.key === " " ? "Space" : event.key.length === 1 ? event.key.toUpperCase() : event.key;
  // "?" or "!" already need Shift on most keyboards: the sign is enough
  const sign = event.key.length === 1 && !/[\p{L}\p{N}]/u.test(event.key);
  const parts: string[] = [];
  if (event.ctrlKey || event.metaKey) parts.push("Ctrl");
  if (event.altKey) parts.push("Alt");
  if (event.shiftKey && !sign && key !== "Space") parts.push("Shift");
  return [...parts, key].join("+");
}

const NAMES: Record<string, string> = { Space: "Espace", ArrowRight: "→", ArrowLeft: "←", ArrowUp: "↑", ArrowDown: "↓", Escape: "Échap" };

/** Keys as shown: "Ctrl+→", "⌘+K" on a Mac. */
export function keysLabel(keys: string, mac = typeof navigator !== "undefined" && /Mac/.test(navigator.platform)): string {
  return keys
    .split("+")
    .map((part) => (part === "Ctrl" && mac ? "⌘" : (NAMES[part] ?? part)))
    .join("+");
}

/** The action these keys run, if any. */
export const actionFor = (combo: string, keys = shortcuts.get().keys): ShortcutAction | undefined =>
  (Object.keys(keys) as ShortcutAction[]).find((id) => keys[id] === combo);

/** Gives an action new keys; an action that had them takes the old ones (the two swap). */
export function assignKeys(keys: Record<ShortcutAction, string>, action: ShortcutAction, combo: string): Record<ShortcutAction, string> {
  const next = { ...keys };
  const holder = actionFor(combo, keys);
  if (holder && holder !== action) next[holder] = keys[action];
  next[action] = combo;
  return next;
}

function save(keys: Record<ShortcutAction, string>): void {
  shortcuts.set({ keys });
  try {
    const changed = Object.fromEntries(Object.entries(keys).filter(([id, value]) => DEFAULTS[id as ShortcutAction] !== value));
    localStorage.setItem(KEY, JSON.stringify(changed));
  } catch {
    // kept for this session
  }
}

export const setShortcut = (action: ShortcutAction, combo: string) => save(assignKeys(shortcuts.get().keys, action, combo));
export const resetShortcuts = () => save({ ...DEFAULTS });

/** A global shortcut from the main process ("CommandOrControl+Alt+Right") as written here, and back. */
export const fromAccelerator = (accelerator: string) =>
  accelerator
    .split("+")
    .map((part) => ({ CommandOrControl: "Ctrl", Right: "ArrowRight", Left: "ArrowLeft", Up: "ArrowUp", Down: "ArrowDown" })[part] ?? part)
    .join("+");
export const toAccelerator = (combo: string) =>
  combo
    .split("+")
    .map((part) => ({ Ctrl: "CommandOrControl", ArrowRight: "Right", ArrowLeft: "Left", ArrowUp: "Up", ArrowDown: "Down" })[part] ?? part)
    .join("+");
