import { motion } from "framer-motion";
import { Copy, Download, X } from "lucide-react";
import { useEffect, useMemo } from "react";
import { saveBlob } from "../lib/recap";
import { createStore, useStore } from "../lib/store";
import { notify } from "../lib/ui";

/** the picture being shown, before it is saved or copied */
export const preview = createStore<{ image: { blob: Blob; filename: string; title: string } | null }>({ image: null });

export const showImage = (blob: Blob, filename: string, title: string) => preview.set({ image: { blob, filename, title } });

const close = () => preview.set({ image: null });

/** A made picture, shown big: save it, or copy it to paste straight into a story or a chat. */
export function ImagePreview() {
  const image = useStore(preview, (s) => s.image);
  const url = useMemo(() => (image ? URL.createObjectURL(image.blob) : null), [image]);
  useEffect(() => () => void (url && URL.revokeObjectURL(url)), [url]);
  useEffect(() => {
    if (!image) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [image]);
  if (!image || !url) return null;
  return (
    <motion.div className="fixed inset-0 z-[75] flex items-center justify-center gap-8 bg-black/85 p-8" initial={{ opacity: 0 }} animate={{ opacity: 1 }} onMouseDown={(event) => event.target === event.currentTarget && close()}>
      <img src={url} alt={image.title} className="max-h-[86vh] max-w-[48vw] rounded-2xl shadow-2xl ring-1 ring-white/10" />
      <div className="flex w-72 flex-col gap-3">
        <p className="font-display text-2xl tracking-tight">{image.title}</p>
        <button onClick={() => saveBlob(image.blob, image.filename)} className="btn-primary justify-center">
          <Download className="h-5 w-5" />
          Enregistrer l'image
        </button>
        <button
          onClick={() =>
            navigator.clipboard
              .write([new ClipboardItem({ "image/png": image.blob })])
              .then(() => notify("Image copiée : collez-la dans une story ou une conversation."))
              .catch(() => notify("La copie de l'image a échoué : enregistrez-la plutôt.", "error"))
          }
          className="btn-ghost justify-center"
        >
          <Copy className="h-5 w-5" />
          Copier l'image
        </button>
        <button onClick={close} className="btn-ghost justify-center">
          <X className="h-5 w-5" />
          Fermer
        </button>
      </div>
    </motion.div>
  );
}
