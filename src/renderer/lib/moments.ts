// Moments: an instant of a track, with a note (Spicetify's Bookmark, SoundCloud's timed comments). Kept on
// this computer; played back from that instant; the note shows when the song reaches it again.
import type { MomentMark } from "../global";
import { formatTime } from "./format";
import { createStore } from "./store";
import type { Track } from "./types";
import { notify } from "./ui";

export const moments = createStore<{ list: MomentMark[] }>({ list: [] });

export async function loadMoments(): Promise<void> {
  const list = await window.vitrine.moments?.get().catch(() => []);
  moments.set({ list: list ?? [] });
}

async function save(list: MomentMark[]): Promise<void> {
  moments.set({ list });
  const saved = await window.vitrine.moments?.set(list).catch(() => list);
  if (saved) moments.set({ list: saved });
}

/** Marks this instant of the track; the newest first. */
export async function addMoment(track: Track, atMs: number, note = ""): Promise<void> {
  const mark: MomentMark = {
    id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    uri: track.uri,
    name: track.name,
    artists: track.artists,
    image: track.thumb ?? track.image,
    atMs: Math.max(0, Math.round(atMs)),
    note,
    createdAt: new Date().toISOString(),
  };
  await save([mark, ...moments.get().list]);
  notify(`Moment enregistré à ${formatTime(mark.atMs)} : ajoutez une note dans Bibliothèque › Moments.`);
}

export const updateMoment = (id: string, note: string) => save(moments.get().list.map((mark) => (mark.id === id ? { ...mark, note: note.slice(0, 280) } : mark)));

export const removeMoment = (id: string) => save(moments.get().list.filter((mark) => mark.id !== id));

/** The moment the song has just reached (between the last check and now), if any; not one just made. */
export function reachedMoment(list: MomentMark[], uri: string | undefined, fromMs: number, toMs: number, now = Date.now()): MomentMark | null {
  if (!uri || toMs < fromMs || toMs - fromMs > 3000) return null;
  return list.find((mark) => mark.uri === uri && mark.atMs > fromMs && mark.atMs <= toMs && now - Date.parse(mark.createdAt) > 5000) ?? null;
}
