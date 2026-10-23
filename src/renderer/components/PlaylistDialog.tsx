import { motion } from "framer-motion";
import { ListMusic, Loader2, Plus, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "../lib/cn";
import { errorMessage } from "../lib/format";
import * as api from "../lib/spotify";
import { useStore } from "../lib/store";
import type { Collection } from "../lib/types";
import { navigate, notify, ui } from "../lib/ui";
import { Artwork, ErrorNote, Spinner } from "./Artwork";

/** Adds tracks to one of the person's playlists, or creates a playlist (and adds them to it). */
export function PlaylistDialog() {
  const dialog = useStore(ui, (s) => s.playlistDialog);
  const uris = dialog?.uris ?? [];
  const adding = uris.length > 0;
  const [playlists, setPlaylists] = useState<Collection[]>();
  const [error, setError] = useState<string>();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState<string>();
  const input = useRef<HTMLInputElement>(null);

  const close = () => ui.set({ playlistDialog: null });

  useEffect(() => {
    if (!adding) {
      input.current?.focus();
      return;
    }
    api.editablePlaylists().then(setPlaylists, (caught: unknown) => setError(errorMessage(caught)));
  }, [adding]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const addTo = async (playlist: Collection) => {
    setBusy(playlist.id);
    try {
      await api.addToPlaylist(playlist.id, uris);
      notify(uris.length > 1 ? `${uris.length} titres ajoutés à « ${playlist.name} »` : `Ajouté à « ${playlist.name} »`);
      close();
    } catch (caught) {
      notify(errorMessage(caught), "error");
    } finally {
      setBusy(undefined);
    }
  };

  const create = async () => {
    if (!name.trim()) return;
    setBusy("new");
    try {
      const playlist = await api.createPlaylist(name);
      if (adding) await api.addToPlaylist(playlist.id, uris);
      notify(adding ? `Playlist « ${playlist.name} » créée avec ${uris.length > 1 ? `${uris.length} titres` : "ce titre"}` : `Playlist « ${playlist.name} » créée`);
      close();
      navigate({ name: "playlist", id: playlist.id });
    } catch (caught) {
      notify(errorMessage(caught), "error");
    } finally {
      setBusy(undefined);
    }
  };

  return (
    <motion.div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-6 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={close}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label={adding ? "Ajouter à une playlist" : "Nouvelle playlist"}
        initial={{ y: 16, scale: 0.98 }}
        animate={{ y: 0, scale: 1 }}
        exit={{ y: 16, scale: 0.98 }}
        transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
        onClick={(event) => event.stopPropagation()}
        className="flex max-h-[80vh] w-[min(460px,100%)] flex-col rounded-3xl border border-white/10 bg-panel p-5 shadow-2xl shadow-black/60"
      >
        <header className="flex items-center justify-between pb-4">
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <ListMusic className="h-5 w-5 text-red-500" />
            {adding ? "Ajouter à une playlist" : "Nouvelle playlist"}
          </h2>
          <button onClick={close} className="rounded-lg p-1.5 text-gray-400 hover:bg-white/10 hover:text-white" aria-label="Fermer">
            <X className="h-4 w-4" />
          </button>
        </header>

        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            void create();
          }}
        >
          <input
            ref={input}
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Nom de la nouvelle playlist"
            maxLength={100}
            className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:border-red-500/50 focus:bg-white/10 focus:outline-none focus:ring-1 focus:ring-red-500/30"
          />
          <button type="submit" disabled={!name.trim() || busy !== undefined} className="btn-primary min-h-0 px-4 py-2.5 text-sm">
            {busy === "new" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Créer
          </button>
        </form>

        {adding && (
          <>
            <p className="kicker mt-5 px-1 pb-2 text-gray-500">Vos playlists</p>
            <div className="scrollbar-thin -mx-1 min-h-0 flex-1 overflow-y-auto px-1">
              {error && <ErrorNote text={error} />}
              {!playlists && !error && <Spinner />}
              {playlists?.length === 0 && <p className="px-1 py-2 text-sm text-gray-400">Aucune playlist modifiable : créez-en une ci-dessus.</p>}
              <ul>
                {playlists?.map((playlist) => (
                  <li key={playlist.id}>
                    <button
                      onClick={() => void addTo(playlist)}
                      disabled={busy !== undefined}
                      className={cn("flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors hover:bg-white/5 disabled:opacity-60", busy === playlist.id && "bg-white/5")}
                    >
                      <Artwork src={playlist.image} className="h-11 w-11 shrink-0 rounded-md" />
                      <span className="min-w-0 flex-1">
                        <span translate="no" className="block truncate text-sm font-medium">{playlist.name}</span>
                        <span className="block truncate text-xs text-gray-400">{playlist.total != null ? `${playlist.total} titres` : playlist.subtitle}</span>
                      </span>
                      {busy === playlist.id && <Loader2 className="h-4 w-4 animate-spin text-gray-400" />}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}
      </motion.div>
    </motion.div>
  );
}
