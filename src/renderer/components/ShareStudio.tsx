import { CalendarHeart, Image as ImageIcon, ListMusic, Loader2, Mountain, Palette, Receipt, Sparkles, Tent } from "lucide-react";
import { useState } from "react";
import { renderAura, renderFestival, renderIceberg, renderReceipt } from "../lib/cards";
import { errorMessage } from "../lib/format";
import { artworkColor, FALLBACK } from "../lib/palette";
import { renderRecap } from "../lib/recap";
import { forgottenGems, neverPlayed, RECIPES, type SmartRecipe } from "../lib/smart";
import * as api from "../lib/spotify";
import type { Artist, Track } from "../lib/types";
import { navigate, notify } from "../lib/ui";
import { showImage } from "./ImagePreview";
import { openRetro } from "./RetroVitrine";
import { t } from "../lib/i18n";

/** The tracks a smart playlist holds; [] when the history does not know enough yet. */
async function recipeUris(recipe: SmartRecipe["id"]): Promise<string[]> {
  const history = window.vitrine.history;
  if (!history) return [];
  if (recipe === "repeat") return (await history.insight("monthTop")).map((track) => track.uri);
  if (recipe === "year") {
    const year = (await history.insight("yearTop")).map((track) => track.uri);
    // without history, Spotify's own long-term favourites stand in
    return year.length >= 20 ? year : (await api.topTracks("long_term", 50)).map((track) => track.uri);
  }
  const [liked, stats] = await Promise.all([api.likedTracks(500), history.insight("trackStats")]);
  return recipe === "gems" ? forgottenGems(liked.tracks, stats) : neverPlayed(liked.tracks, stats);
}

/**
 * Making something of the stats: Rétro Vitrine, the pictures people share (recap, receipt, festival
 * poster, iceberg, aura) and smart playlists written to Spotify.
 */
export function ShareStudio({ period, tracks, artists }: { period: string; tracks: Track[]; artists: Artist[] }) {
  const [busy, setBusy] = useState<string | null>(null);

  const make = async (key: string, work: () => Promise<void>) => {
    if (busy) return;
    setBusy(key);
    try {
      await work();
    } catch (error) {
      notify(errorMessage(error), "error");
    } finally {
      setBusy(null);
    }
  };
  const name = async () => (await api.me().catch(() => undefined))?.name ?? "";
  const colorsOf = (urls: (string | undefined)[]) => Promise.all(urls.filter(Boolean).map((url) => artworkColor(url)));

  const images = [
    {
      key: "recap",
      label: "Récap",
      icon: ImageIcon,
      run: async () => showImage(await renderRecap({ period, name: await name(), tracks, artists }), "vitrine-recap.png", `Récap · ${period}`),
    },
    {
      key: "receipt",
      label: "Reçu",
      icon: Receipt,
      run: async () => showImage(await renderReceipt({ name: await name(), period, tracks }), "vitrine-recu.png", `Reçu · ${period}`),
    },
    {
      key: "festival",
      label: "Affiche de festival",
      icon: Tent,
      run: async () => {
        const [a = FALLBACK, b = FALLBACK] = await colorsOf([artists[0]?.image, tracks[0]?.image]);
        showImage(await renderFestival({ name: await name(), artists: artists.map((artist) => artist.name), colors: [a, b] }), "vitrine-festival.png", "Votre festival");
      },
    },
    {
      key: "iceberg",
      label: "Iceberg",
      icon: Mountain,
      run: async () => {
        const levels = await window.vitrine.history?.insight("iceberg");
        if (!levels) {
          notify("Il faut au moins 15 artistes dans votre historique pour dessiner l'iceberg : revenez après quelques jours d'écoute.");
          return;
        }
        showImage(await renderIceberg(levels), "vitrine-iceberg.png", "Votre iceberg");
      },
    },
    {
      key: "aura",
      label: "Aura musicale",
      icon: Palette,
      run: async () => showImage(await renderAura({ name: await name(), colors: await colorsOf(tracks.map((track) => track.thumb ?? track.image)) }), "vitrine-aura.png", "Votre aura musicale"),
    },
  ];

  const createSmart = (recipe: SmartRecipe) =>
    make(recipe.id, async () => {
      const uris = await recipeUris(recipe.id);
      if (uris.length < 5) {
        notify(`Pas assez d'écoutes connues pour « ${recipe.name} » : Vitrine compte vos écoutes depuis son installation.`);
        return;
      }
      const playlist = await api.createPlaylist(t(`${recipe.name} · Vitrine`), t(`Faite par Vitrine — ${recipe.description}`));
      await api.addToPlaylist(playlist.id, uris);
      notify(`« ${recipe.name} » créée sur Spotify : ${uris.length} titres.`);
      navigate({ name: "playlist", id: playlist.id });
    });

  return (
    <section className="mt-10 grid grid-cols-1 gap-6 xl:grid-cols-3">
      <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-red-600/25 via-fuchsia-600/10 to-transparent p-6">
        <span className="kicker flex items-center gap-1.5 font-mono font-medium text-red-400">
          <CalendarHeart className="h-3.5 w-3.5" />
          RÉTRO VITRINE
        </span>
        <h2 className="mt-2 font-display text-2xl tracking-tight">Votre musique, en diapositives</h2>
        <p className="mt-1 text-sm text-gray-400">Minutes, artiste n° 1, titres, habitudes et aura, comme un Wrapped, quand vous voulez.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button onClick={() => openRetro("month")} className="btn-primary min-h-0 px-4 py-2 text-sm">
            Ce mois-ci
          </button>
          <button onClick={() => openRetro("lastMonth")} className="btn-ghost min-h-0 px-4 py-2 text-sm">
            Le mois dernier
          </button>
          <button onClick={() => openRetro("year")} className="btn-ghost min-h-0 px-4 py-2 text-sm">
            Cette année
          </button>
        </div>
      </div>
      <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
        <span className="kicker flex items-center gap-1.5 font-mono font-medium text-red-400">
          <Sparkles className="h-3.5 w-3.5" />
          IMAGES À PARTAGER · {t(period).toUpperCase()}
        </span>
        <div className="mt-4 grid grid-cols-2 gap-2">
          {images.map(({ key, label, icon: Icon, run }) => (
            <button key={key} onClick={() => void make(key, run)} disabled={!tracks.length || Boolean(busy)} className="btn-ghost min-h-0 justify-start px-3 py-2 text-sm disabled:opacity-40">
              {busy === key ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />}
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
        <span className="kicker flex items-center gap-1.5 font-mono font-medium text-red-400">
          <ListMusic className="h-3.5 w-3.5" />
          PLAYLISTS INTELLIGENTES
        </span>
        <div className="mt-4 space-y-2">
          {RECIPES.map((recipe) => (
            <button key={recipe.id} onClick={() => void createSmart(recipe)} disabled={Boolean(busy)} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors hover:bg-white/5 disabled:opacity-40" title={recipe.description}>
              {busy === recipe.id ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" /> : <ListMusic className="h-4 w-4 shrink-0 text-gray-400" />}
              <span className="min-w-0">
                <span className="block text-sm font-semibold">{recipe.name}</span>
                <span className="block truncate text-xs text-gray-400">{recipe.description}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
