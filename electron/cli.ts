// What Vitrine can be asked from the command line or a keyboard shortcut. Only one Vitrine runs:
// started again with one of these flags, it hands the command to the one already open and quits.
export type DesktopCommand = "toggle" | "next" | "previous" | "like" | "flow";

const FLAGS: Record<string, DesktopCommand> = {
  "--play-pause": "toggle",
  "--next": "next",
  "--previous": "previous",
  "--like": "like",
  "--flow": "flow",
};

/** The command in these arguments, or null for a plain start (which just shows the window). */
export function cliCommand(argv: readonly string[]): DesktopCommand | null {
  for (const arg of argv) if (FLAGS[arg]) return FLAGS[arg];
  return null;
}

/** The keyboard shortcuts that work wherever the focus is, as Electron accelerators. */
export const GLOBAL_SHORTCUTS: { accelerator: string; command: DesktopCommand; label: string }[] = [
  { accelerator: "CommandOrControl+Alt+Space", command: "toggle", label: "Lecture / pause" },
  { accelerator: "CommandOrControl+Alt+Right", command: "next", label: "Titre suivant" },
  { accelerator: "CommandOrControl+Alt+Left", command: "previous", label: "Titre précédent" },
  { accelerator: "CommandOrControl+Alt+L", command: "like", label: "Liker le titre en cours" },
  { accelerator: "CommandOrControl+Alt+F", command: "flow", label: "Ouvrir Flow" },
];
