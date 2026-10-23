import { motion } from "framer-motion";
import { CheckCircle2, FileUp, Loader2, X } from "lucide-react";
import { useRef, useState } from "react";
import { errorMessage } from "../lib/format";
import { matchScore, parseImport, searchQuery, type ImportedSong } from "../lib/importPlaylist";
import * as api from "../lib/spotify";
import { createStore, useStore } from "../lib/store";
import { navigate } from "../lib/ui";

export const importDialog = createStore({ open: false });

/** the songs looked for in one import at most, and the time between two searches (Spotify counts them) */
export const IMPORT_MAX = 300;
const PACE_MS = 600;

type Step =
  | { kind: "pick" }
  | { kind: "ready"; songs: ImportedSong[]; file: string }
  | { kind: "running"; done: number; total: number; found: number }
  | { kind: "done"; playlistId: string; found: number; missing: ImportedSong[] }
  | { kind: "error"; message: string };

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** The Spotify track for a song of the file: its link when it has one, otherwise the surest search result. */
async function findSong(song: ImportedSong): Promise<string | null> {
  if (song.uri) return song.uri;
  const results = await api.searchTracks(searchQuery(song));
  const best = results.map((track) => ({ track, score: matchScore(song, track) })).sort((a, b) => b.score - a.score)[0];
  if (best && best.score >= 0.6) return best.track.uri;
  // an ISRC Spotify does not know: the title and the artist, then
  if (song.isrc) return findSong({ ...song, isrc: undefined });
  return null;
}

/**
 * Import a playlist (C8): a file from Exportify, TuneMyMusic, a spreadsheet or a plain list becomes a Spotify
 * playlist. The songs are looked for one by one, a little apart, 300 at most; those not found are listed.
 */
export function ImportDialog() {
  const open = useStore(importDialog, (s) => s.open);
  const [step, setStep] = useState<Step>({ kind: "pick" });
  const [name, setName] = useState("");
  const stop = useRef(false);
  if (!open) return null;

  const close = () => {
    stop.current = true;
    setStep({ kind: "pick" });
    importDialog.set({ open: false });
  };

  const read = async (file: File) => {
    const { songs, name: given } = parseImport(await file.text());
    if (songs.length === 0) return setStep({ kind: "error", message: "Aucun titre trouvé dans ce fichier." });
    setName(given ?? file.name.replace(/\.[^.]+$/, ""));
    setStep({ kind: "ready", songs, file: file.name });
  };

  const run = async (songs: ImportedSong[], file: string) => {
    stop.current = false;
    const list = songs.slice(0, IMPORT_MAX);
    const found: string[] = [];
    const missing: ImportedSong[] = [];
    try {
      for (let i = 0; i < list.length; i++) {
        if (stop.current) return;
        setStep({ kind: "running", done: i, total: list.length, found: found.length });
        const uri = await findSong(list[i]).catch(() => null);
        if (uri) found.push(uri);
        else missing.push(list[i]);
        if (!list[i].uri) await wait(PACE_MS);
      }
      const unique = [...new Set(found)];
      const playlist = await api.createPlaylist(name.trim() || file, `Importée dans Vitrine depuis ${file}`);
      if (unique.length) await api.addToPlaylist(playlist.id, unique);
      setStep({ kind: "done", playlistId: playlist.id, found: unique.length, missing: [...missing, ...songs.slice(IMPORT_MAX)] });
    } catch (error) {
      setStep({ kind: "error", message: errorMessage(error) });
    }
  };

  return (
    <motion.div className="fixed inset-0 z-[72] flex items-center justify-center bg-black/60 p-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} onMouseDown={(event) => event.target === event.currentTarget && step.kind !== "running" && close()}>
      <div className="glass w-[520px] max-w-full rounded-3xl p-6" role="dialog" aria-label="Importer une playlist">
        <div className="flex items-start justify-between">
          <div>
            <p className="kicker font-mono text-red-400">IMPORT</p>
            <h2 className="mt-1 font-display text-2xl tracking-tight">Importer une playlist</h2>
          </div>
          <button onClick={close} className="rounded-full p-2 text-gray-400 hover:bg-white/10 hover:text-white" aria-label="Fermer">
            <X className="h-5 w-5" />
          </button>
        </div>

        {step.kind === "pick" && (
          <>
            <p className="mt-3 text-sm text-gray-400">
              Un fichier CSV d'Exportify ou de TuneMyMusic (Deezer, Apple Music, YouTube Music…), un tableau Excel, ou une liste « Artiste - Titre », une ligne par titre.
            </p>
            <label className="mt-5 flex cursor-pointer flex-col items-center gap-2 rounded-2xl border border-dashed border-white/20 p-8 text-center hover:border-white/40">
              <FileUp className="h-8 w-8 text-red-400" />
              <span className="font-semibold">Choisir un fichier</span>
              <span className="text-xs text-gray-400">.csv ou .txt</span>
              <input type="file" accept=".csv,.txt,.tsv,text/csv,text/plain" className="hidden" onChange={(event) => event.target.files?.[0] && void read(event.target.files[0])} />
            </label>
          </>
        )}

        {step.kind === "ready" && (
          <>
            <p className="mt-3 text-sm text-gray-300">
              {step.songs.length} titre{step.songs.length > 1 ? "s" : ""} dans « {step.file} »{step.songs.length > IMPORT_MAX ? ` : les ${IMPORT_MAX} premiers seront cherchés` : ""}.
            </p>
            <label className="mt-4 block text-xs text-gray-400">
              Nom de la playlist
              <input value={name} onChange={(event) => setName(event.target.value)} className="mt-1 w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white" />
            </label>
            <p className="mt-3 text-xs text-gray-500">
              Environ {Math.ceil((Math.min(step.songs.length, IMPORT_MAX) * PACE_MS) / 60_000)} min : les titres sont cherchés un par un, au rythme que Spotify permet.
            </p>
            <button onClick={() => void run(step.songs, step.file)} className="btn-primary mt-5 w-full">
              Importer
            </button>
          </>
        )}

        {step.kind === "running" && (
          <div className="mt-5">
            <p className="flex items-center gap-2 text-sm">
              <Loader2 className="h-4 w-4 animate-spin" />
              {step.done} / {step.total} cherchés · {step.found} trouvés
            </p>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
              <div className="accent-bg h-full rounded-full transition-[width]" style={{ width: `${(step.done / step.total) * 100}%` }} />
            </div>
            <button onClick={close} className="btn-ghost mt-5 min-h-0 w-full py-2 text-sm">
              Arrêter
            </button>
          </div>
        )}

        {step.kind === "done" && (
          <div className="mt-5">
            <p className="flex items-center gap-2 font-semibold">
              <CheckCircle2 className="h-5 w-5 text-emerald-400" />
              {step.found} titre{step.found > 1 ? "s" : ""} dans « {name} »
            </p>
            {step.missing.length > 0 && (
              <>
                <p className="mt-3 text-sm text-gray-400">Pas trouvés sur Spotify ({step.missing.length}) :</p>
                <ul className="scrollbar-thin mt-2 max-h-40 overflow-y-auto rounded-xl bg-black/30 p-3 text-xs text-gray-300">
                  {step.missing.map((song, i) => (
                    <li key={i}>
                      {song.artist ? `${song.artist} - ` : ""}
                      {song.title}
                    </li>
                  ))}
                </ul>
              </>
            )}
            <button
              onClick={() => {
                const id = step.playlistId;
                close();
                navigate({ name: "playlist", id });
              }}
              className="btn-primary mt-5 w-full"
            >
              Ouvrir la playlist
            </button>
          </div>
        )}

        {step.kind === "error" && (
          <>
            <p className="mt-4 text-amber-200">{step.message}</p>
            <button onClick={() => setStep({ kind: "pick" })} className="btn-ghost mt-5 min-h-0 w-full py-2 text-sm">
              Recommencer
            </button>
          </>
        )}
      </div>
    </motion.div>
  );
}
