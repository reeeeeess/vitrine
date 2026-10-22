// Starts the official Spotify app in the background, for when this computer cannot play itself
// (DRM refused) and no other Spotify device is open: Vitrine then drives that app through Connect.
import { shell } from "electron";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

function detached(command: string, args: string[]): boolean {
  try {
    const child = spawn(command, args, { detached: true, stdio: "ignore", windowsHide: true });
    child.on("error", () => undefined);
    child.unref();
    return true;
  } catch {
    return false;
  }
}

/** Returns how Spotify was started, or null when it could not be. */
export async function launchSpotify(): Promise<"app" | "protocol" | null> {
  if (process.platform === "win32") {
    // the installer from spotify.com puts it in %APPDATA%; it starts straight into the tray
    const exe = path.join(process.env.APPDATA ?? "", "Spotify", "Spotify.exe");
    if (process.env.APPDATA && fs.existsSync(exe) && detached(exe, ["--minimized"])) return "app";
  } else if (process.platform === "darwin") {
    // -g: opens without coming to the front
    if (fs.existsSync("/Applications/Spotify.app") && detached("open", ["-g", "-a", "Spotify"])) return "app";
  } else {
    const linux = ["/usr/bin/spotify", "/snap/bin/spotify", "/var/lib/flatpak/exports/bin/com.spotify.Client"].find((file) => fs.existsSync(file));
    if (linux && detached(linux, [])) return "app";
  }
  // the Microsoft Store version, or any install that registered spotify: links
  try {
    await shell.openExternal("spotify:");
    return "protocol";
  } catch {
    return null;
  }
}
