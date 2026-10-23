// What Vitrine can be asked from the command line or a keyboard shortcut. Only one Vitrine runs:
// started again with one of these flags, it hands the command to the one already open and quits.
export type DesktopCommand = "toggle" | "next" | "previous" | "like" | "flow" | "lyrics" | "stats" | `play:${string}`;

/** what `--play=` may start: a playlist, an album or an artist, never anything else */
const PLAYABLE = /^spotify:(playlist|album|artist):[A-Za-z0-9]{1,64}$/;
export const isPlayableUri = (uri: unknown): uri is string => typeof uri === "string" && PLAYABLE.test(uri);

const FLAGS: Record<string, DesktopCommand> = {
  "--play-pause": "toggle",
  "--next": "next",
  "--previous": "previous",
  "--like": "like",
  "--flow": "flow",
  "--lyrics": "lyrics",
};

/** The command in these arguments, or null for a plain start (which just shows the window). */
export function cliCommand(argv: readonly string[]): DesktopCommand | null {
  for (const arg of argv) {
    if (FLAGS[arg]) return FLAGS[arg];
    // a pinned playlist from Windows' jump list: --play=spotify:playlist:…
    if (arg.startsWith("--play=") && isPlayableUri(arg.slice(7))) return `play:${arg.slice(7)}`;
  }
  return null;
}

/** The keyboard shortcuts that work wherever the focus is, as Electron accelerators. */
export const GLOBAL_SHORTCUTS: { accelerator: string; command: DesktopCommand; label: string }[] = [
  { accelerator: "CommandOrControl+Alt+Space", command: "toggle", label: "Lecture / pause" },
  { accelerator: "CommandOrControl+Alt+Right", command: "next", label: "Titre suivant" },
  { accelerator: "CommandOrControl+Alt+Left", command: "previous", label: "Titre précédent" },
  { accelerator: "CommandOrControl+Alt+L", command: "like", label: "Liker le titre en cours" },
  { accelerator: "CommandOrControl+Alt+F", command: "flow", label: "Ouvrir Flow" },
  { accelerator: "CommandOrControl+Alt+K", command: "lyrics", label: "Paroles sur le bureau" },
];

/**
 * A global shortcut chosen by the person, made safe: at least Ctrl or Alt (a plain key would be taken from
 * every other app), then one letter, digit, arrow, Space or F-key. Null when it is not one.
 */
export function cleanAccelerator(raw: unknown): string | null {
  if (typeof raw !== "string" || raw.length > 60) return null;
  const parts = raw.split("+");
  const key = parts.pop() ?? "";
  const modifiers = new Set(parts);
  if (![...modifiers].every((part) => ["CommandOrControl", "Alt", "Shift"].includes(part)) || modifiers.size !== parts.length) return null;
  if (!modifiers.has("CommandOrControl") && !modifiers.has("Alt")) return null;
  if (!/^([A-Z0-9]|Space|Right|Left|Up|Down|F([1-9]|1[0-9]|2[0-4]))$/.test(key)) return null;
  return ["CommandOrControl", "Alt", "Shift"].filter((part) => modifiers.has(part)).concat(key).join("+");
}

/** The global shortcuts with the person's own keys where they changed them. */
export function globalShortcuts(own: Partial<Record<DesktopCommand, string>> = {}): typeof GLOBAL_SHORTCUTS {
  return GLOBAL_SHORTCUTS.map((shortcut) => ({ ...shortcut, accelerator: cleanAccelerator(own[shortcut.command]) ?? shortcut.accelerator }));
}
