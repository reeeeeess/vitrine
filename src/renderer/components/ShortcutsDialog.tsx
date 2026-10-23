// "?": every keyboard shortcut, in Vitrine and everywhere (global), each one changeable — click
// "Modifier", press the new keys. Two actions never share keys: the one that had them takes the old ones.
import { AnimatePresence, motion } from "framer-motion";
import { Keyboard, RotateCcw, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { GlobalKeys } from "../global";
import { cn } from "../lib/cn";
import { comboOf, fromAccelerator, keysLabel, resetShortcuts, setShortcut, SHORTCUT_ACTIONS, shortcuts, toAccelerator, type ShortcutAction } from "../lib/shortcuts";
import { useStore } from "../lib/store";

type Recording = { kind: "app"; id: ShortcutAction } | { kind: "global"; id: string } | null;

function Keys({ keys, waiting }: { keys: string; waiting?: boolean }) {
  if (waiting) return <span className="rounded-lg border border-dashed border-white/40 px-2.5 py-1 text-xs text-white/80">Appuyez sur les touches…</span>;
  return (
    <span className="flex gap-1">
      {keysLabel(keys)
        .split("+")
        .map((part, i) => (
          <kbd key={i} className="min-w-[1.9rem] rounded-lg border border-white/20 bg-white/10 px-2 py-1 text-center font-mono text-xs text-white shadow-[inset_0_-2px_0_rgba(255,255,255,0.08)]">
            {part}
          </kbd>
        ))}
    </span>
  );
}

function Row({ label, keys, waiting, onEdit }: { label: string; keys: string; waiting: boolean; onEdit: () => void }) {
  return (
    <li className="flex items-center justify-between gap-4 py-2">
      <span className="text-sm text-white/85">{label}</span>
      <span className="flex items-center gap-3">
        <Keys keys={keys} waiting={waiting} />
        <button onClick={onEdit} className="rounded-full px-2.5 py-1 text-xs font-medium text-white/60 hover:bg-white/10 hover:text-white">
          {waiting ? "Annuler" : "Modifier"}
        </button>
      </span>
    </li>
  );
}

export function ShortcutsDialog() {
  const open = useStore(shortcuts, (s) => s.open);
  const keys = useStore(shortcuts, (s) => s.keys);
  const [recording, setRecording] = useState<Recording>(null);
  const [global, setGlobal] = useState<GlobalKeys | null>(null);
  const [hint, setHint] = useState("");
  const panel = useRef<HTMLDivElement>(null);
  const close = () => shortcuts.set({ open: false });

  useEffect(() => {
    if (!open) return;
    setRecording(null);
    setHint("");
    void window.vitrine.desktop?.keys?.().then((value) => setGlobal(Array.isArray(value?.shortcuts) ? value : null), () => setGlobal(null));
    // the focus goes into the list, and back where it was once closed
    const before = document.activeElement as HTMLElement | null;
    requestAnimationFrame(() => panel.current?.querySelector<HTMLElement>("button")?.focus());
    return () => before?.focus?.();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      // the list takes every key while it is open: nothing plays or moves behind it
      event.stopPropagation();
      if (!recording) {
        if (event.key === "Escape") close();
        return;
      }
      event.preventDefault();
      if (event.key === "Escape") return setRecording(null);
      const combo = comboOf(event);
      if (!combo) return;
      if (recording.kind === "app") {
        setShortcut(recording.id, combo);
        setRecording(null);
      } else {
        if (!/^(Ctrl|Alt)\+/.test(combo)) return setHint("Un raccourci global commence par Ctrl ou Alt.");
        void window.vitrine.desktop.setKeys({ command: recording.id, accelerator: toAccelerator(combo) }).then(setGlobal);
        setRecording(null);
        setHint("");
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, recording]);

  const toggle = (next: Recording) => setRecording((current) => (current && next && current.kind === next.kind && current.id === next.id ? null : next));
  const resetAll = () => {
    resetShortcuts();
    for (const shortcut of global?.shortcuts ?? []) void window.vitrine.desktop.setKeys({ command: shortcut.command, accelerator: null }).then(setGlobal);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-6 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={close}
        >
          <motion.div
            ref={panel}
            role="dialog"
            aria-modal="true"
            aria-labelledby="shortcuts-title"
            className="glass scrollbar-thin max-h-[86vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-white/15 bg-[#121212]/90 p-7 shadow-2xl"
            initial={{ y: 18, scale: 0.98 }}
            animate={{ y: 0, scale: 1, transition: { duration: 0.32, ease: [0.22, 1, 0.36, 1] } }}
            exit={{ y: 10, opacity: 0, transition: { duration: 0.15 } }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="kicker flex items-center gap-2 text-red-400">
                  <Keyboard className="h-4 w-4" aria-hidden="true" /> Clavier
                </p>
                <h2 id="shortcuts-title" className="mt-1 font-display text-3xl tracking-tight">
                  Raccourcis
                </h2>
                <p className="mt-1 text-sm text-gray-400">Cliquez sur « Modifier » puis appuyez sur les nouvelles touches (Échap pour annuler).</p>
              </div>
              <button onClick={close} aria-label="Fermer" className="rounded-full p-2 text-white/70 hover:bg-white/10 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <h3 className="kicker mt-6 text-white/60">Dans Vitrine</h3>
            <ul className="mt-1 divide-y divide-white/5">
              {SHORTCUT_ACTIONS.map((action) => (
                <Row key={action.id} label={action.label} keys={keys[action.id]} waiting={recording?.kind === "app" && recording.id === action.id} onEdit={() => toggle({ kind: "app", id: action.id })} />
              ))}
            </ul>

            {global && (
              <>
                <h3 className="kicker mt-6 text-white/60">Partout, même Vitrine cachée</h3>
                <ul className="mt-1 divide-y divide-white/5">
                  {global.shortcuts.map((shortcut) => (
                    <Row
                      key={shortcut.command}
                      label={shortcut.label}
                      keys={fromAccelerator(shortcut.accelerator)}
                      waiting={recording?.kind === "global" && recording.id === shortcut.command}
                      onEdit={() => toggle({ kind: "global", id: shortcut.command })}
                    />
                  ))}
                </ul>
                {global.taken.length > 0 && <p className="mt-2 text-xs text-amber-300">Déjà pris par une autre appli : {global.taken.map((taken) => keysLabel(fromAccelerator(taken))).join(", ")}.</p>}
              </>
            )}
            <p className={cn("mt-2 text-xs text-amber-300", !hint && "hidden")} role="status">
              {hint}
            </p>

            <div className="mt-6 flex justify-end">
              <button onClick={resetAll} className="btn-ghost flex items-center gap-2 text-sm">
                <RotateCcw className="h-4 w-4" aria-hidden="true" /> Touches d'origine
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
