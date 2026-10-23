// Karaoke without the voice, within Spotify's rules: the official instrumental version of the song (or
// a karaoke label's) plays from the same moment, while the lyrics stay the original's, in time.
import * as api from "../lib/spotify";
import { createStore } from "../lib/store";
import type { Track } from "../lib/types";
import { notify } from "../lib/ui";
import { bestInstrumental, groupVersions, mapPosition, versionQueries, type Version, type VersionKind } from "../lib/versions";
import * as engine from "./engine";
import { currentPosition, playback } from "./engine";

const found = new Map<string, Promise<Map<VersionKind, Version[]>>>();

/** The versions of a track (two or three searches, once per track and run). */
export function findVersions(track: Track): Promise<Map<VersionKind, Version[]>> {
  let versions = found.get(track.uri);
  if (!versions) {
    versions = Promise.allSettled(versionQueries(track).map(({ query, offset }) => api.searchTracks(query, offset))).then((pages) =>
      groupVersions(
        track,
        pages.flatMap((page) => (page.status === "fulfilled" ? page.value : [])),
      ),
    );
    found.set(track.uri, versions);
    versions.catch(() => found.delete(track.uri));
  }
  return versions;
}

export interface Karaoke {
  original: Track;
  instrumental: Track;
  /** lengths differ (a karaoke label's cover): the lyrics' times are stretched, and that is said */
  approximate: boolean;
}

export const karaoke = createStore<{ current: Karaoke | null; searching: boolean }>({ current: null, searching: false });

/** The track whose lyrics show, and how to turn the playing position into a position in it. */
export function lyricsSource(track: Track | undefined, current: Karaoke | null): { track: Track | undefined; toLyrics: (positionMs: number) => number } {
  if (!track || !current || track.uri !== current.instrumental.uri) return { track, toLyrics: (position) => position };
  return { track: current.original, toLyrics: (position) => mapPosition(position, current.instrumental.durationMs, current.original.durationMs) };
}

/** Swaps the song for its instrumental, at the same moment. */
export async function startKaraoke(): Promise<void> {
  const state = playback.get();
  const original = state.track;
  if (!original || karaoke.get().searching) return;
  karaoke.set({ searching: true });
  try {
    const versions = await findVersions(original);
    const best = bestInstrumental(original, [...versions.values()].flat().map((version) => version.track));
    if (!best) {
      notify("Pas de version instrumentale de ce titre sur Spotify : le karaoké sans la voix n'est pas possible pour celui-ci.");
      return;
    }
    const position = mapPosition(currentPosition(playback.get()), original.durationMs, best.track.durationMs);
    await engine.playTracks([best.track.uri], 0, position);
    karaoke.set({ current: { original, instrumental: best.track, approximate: Math.abs(best.deltaMs) > 2000 } });
    notify(best.sameArtist ? "Karaoké : la version instrumentale officielle joue, à vous de chanter." : "Karaoké : version d'un label de karaoké (synchro des paroles approximative).");
  } finally {
    karaoke.set({ searching: false });
  }
}

/** Back to the original song, with its voice, at the same moment. */
export async function stopKaraoke(): Promise<void> {
  const current = karaoke.get().current;
  if (!current) return;
  karaoke.set({ current: null });
  const state = playback.get();
  if (state.track?.uri !== current.instrumental.uri) return;
  await engine.playTracks([current.original.uri], 0, mapPosition(currentPosition(state), current.instrumental.durationMs, current.original.durationMs));
}

/** Another track starting ends the karaoke. */
export function connectKaraoke(): () => void {
  return playback.subscribe(() => {
    const current = karaoke.get().current;
    const uri = playback.get().track?.uri;
    if (current && uri && uri !== current.instrumental.uri && uri !== current.original.uri) karaoke.set({ current: null });
  });
}
