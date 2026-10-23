// The artwork blurred once, into a small picture: drawn big, it looks like a CSS blur, but a CSS blur of a
// whole screen is worked out again at every frame of an animation (the lyrics, Flow, the player), which
// made them stutter. The small picture only has to be moved.
import { useEffect, useState } from "react";

const cache = new Map<string, Promise<string | undefined>>();

/** blurred at this size, a picture keeps only its colours and their places */
const SIZE = 96;

export function blurredArtwork(url: string | undefined, { blur = 7, saturate = 1.5 }: { blur?: number; saturate?: number } = {}): Promise<string | undefined> {
  if (!url) return Promise.resolve(undefined);
  const key = `${url}|${blur}|${saturate}`;
  let pending = cache.get(key);
  if (!pending) {
    pending = new Promise((resolve) => {
      const image = new Image();
      image.crossOrigin = "anonymous";
      image.decoding = "async";
      image.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = canvas.height = SIZE;
          const ctx = canvas.getContext("2d");
          if (!ctx) return resolve(url);
          ctx.filter = `blur(${blur}px) saturate(${saturate})`;
          // drawn larger than the canvas, so the blur does not fade the edges to transparent
          const bleed = blur * 3;
          ctx.drawImage(image, -bleed, -bleed, SIZE + bleed * 2, SIZE + bleed * 2);
          resolve(canvas.toDataURL("image/jpeg", 0.92));
        } catch {
          resolve(url);
        }
      };
      image.onerror = () => resolve(undefined);
      image.src = url;
    });
    cache.set(key, pending);
    // the cache stays small: the last artworks only
    if (cache.size > 24) cache.delete(cache.keys().next().value as string);
  }
  return pending;
}

/** The blurred picture of an artwork, once it is ready (the previous one meanwhile). */
export function useBlurred(url: string | undefined, options?: { blur?: number; saturate?: number }): string | undefined {
  const [blurred, setBlurred] = useState<string>();
  useEffect(() => {
    let current = true;
    void blurredArtwork(url, options).then((value) => current && value && setBlurred(value));
    return () => {
      current = false;
    };
  }, [url, options?.blur, options?.saturate]);
  return blurred;
}
