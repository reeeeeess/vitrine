// The colour an artwork is known by, for the washes behind cards, the hero and the player.
// i.scdn.co serves its images with CORS, so they can be read from a canvas.

export type Rgb = [number, number, number];

const cache = new Map<string, Promise<Rgb>>();
export const FALLBACK: Rgb = [220, 38, 38];

/** The most saturated of the bright-enough average colours of a 3×3 grid, lifted to stay readable. */
export function dominantColor(pixels: Uint8ClampedArray, width: number, height: number): Rgb {
  const cells: Rgb[] = [];
  for (let cy = 0; cy < 3; cy++) {
    for (let cx = 0; cx < 3; cx++) {
      let r = 0, g = 0, b = 0, n = 0;
      for (let y = Math.floor((cy * height) / 3); y < Math.floor(((cy + 1) * height) / 3); y++) {
        for (let x = Math.floor((cx * width) / 3); x < Math.floor(((cx + 1) * width) / 3); x++) {
          const i = (y * width + x) * 4;
          r += pixels[i];
          g += pixels[i + 1];
          b += pixels[i + 2];
          n++;
        }
      }
      if (n) cells.push([r / n, g / n, b / n]);
    }
  }
  const saturation = ([r, g, b]: Rgb) => Math.max(r, g, b) - Math.min(r, g, b);
  const brightness = ([r, g, b]: Rgb) => (r + g + b) / 3;
  const candidates = cells.filter((cell) => brightness(cell) > 40);
  const best = (candidates.length ? candidates : cells).sort((a, b) => saturation(b) - saturation(a))[0];
  if (!best) return FALLBACK;
  // lift dark colours so a wash of them still shows on black
  const lift = Math.max(1, 140 / Math.max(1, Math.max(...best)));
  return best.map((channel) => Math.min(255, Math.round(channel * lift))) as Rgb;
}

export function artworkColor(url: string | undefined): Promise<Rgb> {
  if (!url) return Promise.resolve(FALLBACK);
  let pending = cache.get(url);
  if (!pending) {
    pending = new Promise<Rgb>((resolve) => {
      const image = new Image();
      image.crossOrigin = "anonymous";
      image.decoding = "async";
      image.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = canvas.height = 24;
          const context = canvas.getContext("2d", { willReadFrequently: true });
          if (!context) return resolve(FALLBACK);
          context.drawImage(image, 0, 0, 24, 24);
          resolve(dominantColor(context.getImageData(0, 0, 24, 24).data, 24, 24));
        } catch {
          resolve(FALLBACK);
        }
      };
      image.onerror = () => resolve(FALLBACK);
      image.src = url;
    });
    cache.set(url, pending);
  }
  return pending;
}

export const rgbVar = ([r, g, b]: Rgb) => `${r} ${g} ${b}`;
