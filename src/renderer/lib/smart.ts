// Smart playlists in one click (the Music app on the Mac): built from the liked songs and the history,
// then written to Spotify as a real playlist, marked as made by Vitrine.
import type { TrackStat } from "./insights";

const DAY_MS = 86_400_000;

/** Liked, played several times, then not for six months (three when that leaves too few). */
export function forgottenGems(liked: { uri: string }[], stats: Record<string, TrackStat>, now = Date.now()): string[] {
  const pick = (days: number) =>
    liked
      .filter((track) => (stats[track.uri]?.plays ?? 0) >= 2 && now - Date.parse(stats[track.uri]!.last) > days * DAY_MS)
      .sort((a, b) => stats[b.uri]!.plays - stats[a.uri]!.plays)
      .map((track) => track.uri);
  const gems = pick(180);
  return (gems.length >= 10 ? gems : pick(90)).slice(0, 50);
}

/** Liked, and never heard since Vitrine keeps count. */
export function neverPlayed(liked: { uri: string }[], stats: Record<string, TrackStat>): string[] {
  return liked.filter((track) => !stats[track.uri]).map((track) => track.uri).slice(0, 100);
}

export interface SmartRecipe {
  id: "gems" | "repeat" | "never" | "year";
  name: string;
  description: string;
}

export const RECIPES: SmartRecipe[] = [
  { id: "gems", name: "Pépites oubliées", description: "Des titres likés que vous écoutiez souvent, plus depuis des mois." },
  { id: "repeat", name: "En boucle ce mois-ci", description: "Vos titres les plus écoutés des 30 derniers jours." },
  { id: "never", name: "Jamais écoutés", description: "Des titres likés que Vitrine ne vous a jamais vu écouter." },
  { id: "year", name: `Mon année ${new Date().getFullYear()}`, description: "Vos 100 titres de l'année, d'après votre historique." },
];
