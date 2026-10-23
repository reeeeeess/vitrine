// Linux, for the AppImage: what Windows and macOS do with setLoginItemSettings is a file in
// ~/.config/autostart (the freedesktop.org way, followed by GNOME, KDE, Xfce…). Free of Electron for the tests.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export const autostartFile = (config = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), ".config")) => path.join(config, "autostart", "vitrine.desktop");

/** The autostart entry: the AppImage itself, started hidden in the tray. */
export function autostartEntry(appImage: string, hiddenArg: string): string {
  // the Exec key's quoting rules: the path in double quotes, with ", `, $ and \ escaped
  const quoted = `"${appImage.replace(/(["`$\\])/g, "\\$1")}"`;
  return ["[Desktop Entry]", "Type=Application", "Name=Vitrine", "Comment=Lecteur Spotify de bureau", `Exec=${quoted} ${hiddenArg}`, "Icon=vitrine", "Terminal=false", "X-GNOME-Autostart-enabled=true", ""].join("\n");
}

/** Writes or removes the entry; nothing without an AppImage (a development run or a distribution package). */
export function applyAutostart(on: boolean, appImage: string | undefined, hiddenArg: string, file = autostartFile()): void {
  if (!appImage) return;
  try {
    if (on) {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, autostartEntry(appImage, hiddenArg));
    } else fs.rmSync(file, { force: true });
  } catch {
    // a read-only home: Vitrine simply does not start with the session
  }
}
