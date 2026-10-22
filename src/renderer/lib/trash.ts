// The trash bin, after Spicetify's Trashbin extension: a track or an artist put in it is skipped as
// soon as it starts, wherever the playback comes from, and never offered by Flow. Kept on this computer.
import { createStore } from "./store";
import type { Track } from "./types";

export interface Trash {
  tracks: Record<string, string>;
  artists: Record<string, string>;
}

const KEY = "vitrine.trash";

function read(): Trash {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? "null") as Trash | null;
    return parsed && typeof parsed.tracks === "object" && typeof parsed.artists === "object" ? parsed : { tracks: {}, artists: {} };
  } catch {
    return { tracks: {}, artists: {} };
  }
}

export const trash = createStore<Trash>(read());

function save(next: Trash): void {
  trash.set(next);
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // for this session only
  }
}

/** Why the track is in the trash: itself, or one of its artists; null when it is not. */
export function trashed(bin: Trash, track: Pick<Track, "uri" | "artistIds">): string | null {
  if (bin.tracks[track.uri]) return `« ${bin.tracks[track.uri]} » est à la corbeille`;
  const artist = track.artistIds.find((id) => bin.artists[id]);
  return artist ? `${bin.artists[artist]} est à la corbeille` : null;
}

export function trashTrack(track: Track): void {
  const bin = trash.get();
  save({ ...bin, tracks: { ...bin.tracks, [track.uri]: track.name } });
}

export function trashArtist(id: string, name: string): void {
  const bin = trash.get();
  save({ ...bin, artists: { ...bin.artists, [id]: name } });
}

export function restore(kind: "tracks" | "artists", key: string): void {
  const bin = trash.get();
  const rest = { ...bin[kind] };
  delete rest[key];
  save({ ...bin, [kind]: rest });
}
