// Skips what the trash bin holds, the moment it starts playing, or the moment it goes in the bin.
import { trash, trashed } from "../lib/trash";
import { notify } from "../lib/ui";
import * as engine from "./engine";
import { playback } from "./engine";

export function connectTrash(): () => void {
  let handled = "";
  const check = () => {
    const { track, paused } = playback.get();
    if (!track || paused || track.uri === handled) return;
    const reason = trashed(trash.get(), track);
    if (!reason) return;
    handled = track.uri;
    notify(`Titre sauté : ${reason}.`);
    void engine.next().catch(() => undefined);
  };
  const stopPlayback = playback.subscribe(check);
  const stopTrash = trash.subscribe(check);
  return () => {
    stopPlayback();
    stopTrash();
  };
}
