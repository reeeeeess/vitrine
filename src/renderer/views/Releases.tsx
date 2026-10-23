import { CalendarDays, Loader2, RefreshCw } from "lucide-react";
import { useEffect, useRef } from "react";
import { MediaCard } from "../components/MediaCard";
import { usePageTitle } from "../lib/pageTitle";
import { groupReleases, loadReleases, releaseLabel, releases } from "../lib/releases";
import { useStore } from "../lib/store";
import { openCollection, playCollection } from "./Home";

/** The new releases of the person's artists of the moment, newest first, by week and month (I6). */
export function ReleasesView() {
  const { data, loading, error } = useStore(releases, (s) => s);
  const title = useRef<HTMLHeadingElement>(null);
  usePageTitle(title, "Sorties");
  useEffect(() => void loadReleases(), []);
  const groups = data ? groupReleases(data.list) : [];
  // asked again at most once an hour by hand: the list costs a request per artist
  const recent = Boolean(data && Date.now() - data.at < 3_600_000);
  return (
    <div className="animate-skeleton-fade">
      <span className="kicker flex items-center gap-1.5 px-1 font-mono font-medium text-red-500">
        <CalendarDays className="h-3.5 w-3.5" />
        NOUVEAUTÉS
      </span>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 ref={title} className="mt-1 px-1 font-display text-4xl tracking-tight">
          Sorties de vos artistes
        </h1>
        <button onClick={() => void loadReleases(true)} disabled={loading || recent} className="btn-ghost min-h-0 px-4 py-2 text-sm disabled:opacity-50" title={recent ? "Déjà à jour (moins d'une heure)" : "Regarder à nouveau"}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Actualiser
        </button>
      </div>
      <p className="mt-2 px-1 text-sm text-gray-400">
        Les albums et singles des quatre derniers mois de vos artistes du moment. Regardé deux fois par jour au plus.
      </p>
      {error && <p className="mt-6 px-1 text-amber-200">{error}</p>}
      {loading && !data && <p className="mt-10 flex items-center gap-2 px-1 text-gray-400"><Loader2 className="h-4 w-4 animate-spin" /> Recherche des sorties…</p>}
      {data && data.list.length === 0 && <p className="mt-10 px-1 text-gray-400">Rien de nouveau chez vos artistes ces quatre derniers mois.</p>}
      {groups.map((group) => (
        <section key={group.label} className="mt-8">
          <h2 className="px-1 text-xl font-bold tracking-tight">{group.label}</h2>
          <div className="mt-3 flex flex-wrap gap-1">
            {group.items.map((collection, index) => (
              <MediaCard
                key={collection.id}
                index={index}
                title={collection.name}
                subtitle={`${collection.subtitle.split(" · ")[0]} · ${releaseLabel(collection.releaseDate)}`}
                image={collection.card ?? collection.image}
                onOpen={() => openCollection(collection)}
                onPlay={() => playCollection(collection)}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
