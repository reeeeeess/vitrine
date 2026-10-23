// Pins (Apple Music, iOS 26): up to 6 playlists, albums or artists kept at the top of the library. On
// the desktop they also go where a widget would on a phone: the jump list of Vitrine's taskbar button on
// Windows (right click), and the tray menu. A click there starts Vitrine with --play=<uri>.
import { app, type JumpListCategory } from "electron";
import { isPlayableUri } from "./cli";
import type { Pin } from "./config";
import { tr } from "./locale";

export const MAX_PINS = 6;

const KINDS = new Set<Pin["kind"]>(["playlist", "album", "artist"]);

/** What the page sent, kept only if it is a list of real pins: six at most, no duplicates. */
export function cleanPins(value: unknown): Pin[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const pins: Pin[] = [];
  for (const item of value) {
    const pin = item as Partial<Pin> | null;
    if (!pin || !isPlayableUri(pin.uri) || seen.has(pin.uri) || typeof pin.name !== "string" || !KINDS.has(pin.kind as Pin["kind"])) continue;
    seen.add(pin.uri);
    pins.push({
      uri: pin.uri,
      name: pin.name.slice(0, 200),
      kind: pin.kind as Pin["kind"],
      ...(typeof pin.image === "string" && pin.image.startsWith("https://") ? { image: pin.image } : {}),
    });
    if (pins.length === MAX_PINS) break;
  }
  return pins;
}

const KIND_LABEL: Record<Pin["kind"], string> = { playlist: "Playlist", album: "Album", artist: "Artiste" };

/** The jump list: one "Épinglés" group, each pin starting its music. */
export function jumpList(pins: Pin[], program: string): JumpListCategory[] {
  if (pins.length === 0) return [];
  return [
    {
      type: "custom",
      name: "Épinglés",
      items: pins.map((pin) => ({
        type: "task",
        title: pin.name.slice(0, 60),
        description: tr(`${KIND_LABEL[pin.kind]} — lancer la lecture`),
        program,
        args: `--play=${pin.uri}`,
        iconPath: program,
        iconIndex: 0,
      })),
    },
  ];
}

/** Puts the pins in the taskbar's jump list (Windows, installed app only). */
export function applyJumpList(pins: Pin[]): void {
  if (process.platform !== "win32" || !app.isPackaged) return;
  try {
    const categories = jumpList(pins, process.execPath);
    app.setJumpList(categories.length ? categories : null);
  } catch {
    // the jump list is a bonus: the pins still show in the app and the tray
  }
}
