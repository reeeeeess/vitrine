// A shareable picture of the person's top tracks and artists (1080 × 1350, the portrait size social
// networks show whole), drawn on a canvas in the current theme's colours and fonts.
import type { Artist, Track } from "./types";

const WIDTH = 1080;
const HEIGHT = 1350;

function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

const rgb = (triplet: string, alpha = 1) => `rgb(${triplet} / ${alpha})`;

function loadImage(url: string | undefined): Promise<HTMLImageElement | null> {
  if (!url) return Promise.resolve(null);
  return new Promise((resolve) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = url;
  });
}

function roundedImage(ctx: CanvasRenderingContext2D, image: HTMLImageElement | null, x: number, y: number, size: number, radius: number): void {
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x, y, size, size, radius);
  ctx.clip();
  if (image) ctx.drawImage(image, x, y, size, size);
  else {
    ctx.fillStyle = "rgb(255 255 255 / 0.08)";
    ctx.fillRect(x, y, size, size);
  }
  ctx.restore();
}

/** Shortens a text with an ellipsis until it fits. */
function fit(ctx: CanvasRenderingContext2D, text: string, width: number): string {
  if (ctx.measureText(text).width <= width) return text;
  let cut = text;
  while (cut.length > 1 && ctx.measureText(`${cut}…`).width > width) cut = cut.slice(0, -1);
  return `${cut.trimEnd()}…`;
}

export interface RecapInput {
  period: string;
  name: string;
  tracks: Track[];
  artists: Artist[];
}

export async function renderRecap({ period, name, tracks, artists }: RecapInput): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Dessin impossible");

  const black = cssVar("--c-black") || "0 0 0";
  const white = cssVar("--c-white") || "255 255 255";
  const from = cssVar("--accent-from") || "220 38 38";
  const to = cssVar("--accent-to") || "220 38 38";
  const display = cssVar("--font-display") || "sans-serif";
  const body = cssVar("--font-body") || "sans-serif";
  const mono = cssVar("--font-mono") || "monospace";
  // a canvas does not wait for fonts: load the faces it is about to use, or it draws in a fallback
  await Promise.all([`700 92px ${display}`, `700 36px ${body}`, `500 28px ${body}`, `500 24px ${mono}`].map((font) => document.fonts.load(font).catch(() => [])));

  // background: the theme's black, an accent glow and a fine grain of dots, as on mysticsaba.com
  ctx.fillStyle = rgb(black);
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  const glow = ctx.createRadialGradient(WIDTH * 0.85, 0, 0, WIDTH * 0.85, 0, WIDTH * 1.1);
  glow.addColorStop(0, rgb(from, 0.55));
  glow.addColorStop(0.45, rgb(to, 0.18));
  glow.addColorStop(1, rgb(black, 0));
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.fillStyle = rgb(white, 0.05);
  for (let y = 12; y < HEIGHT; y += 24) for (let x = 12; x < WIDTH; x += 24) ctx.fillRect(x, y, 2, 2);

  const accent = ctx.createLinearGradient(80, 0, 700, 0);
  accent.addColorStop(0, rgb(from));
  accent.addColorStop(1, rgb(to));

  // heading
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = rgb(white, 0.6);
  ctx.font = `500 26px ${mono}`;
  ctx.fillText(`● VITRINE · ${period.toUpperCase()}`, 80, 120);
  ctx.fillStyle = rgb(white);
  ctx.font = `700 92px ${display}`;
  ctx.fillText(fit(ctx, name ? `${name.split(" ")[0]},` : "Mon écoute,", WIDTH - 160), 80, 225);
  ctx.fillStyle = accent;
  ctx.fillText("en vitrine.", 80, 325);

  // top tracks
  const [trackArt, artistArt] = await Promise.all([
    Promise.all(tracks.slice(0, 5).map((track) => loadImage(track.image))),
    Promise.all(artists.slice(0, 3).map((artist) => loadImage(artist.image))),
  ]);
  ctx.fillStyle = rgb(white, 0.55);
  ctx.font = `500 24px ${mono}`;
  ctx.fillText("TOP TITRES", 80, 420);
  tracks.slice(0, 5).forEach((track, index) => {
    const y = 450 + index * 112;
    ctx.fillStyle = index === 0 ? accent : rgb(white, 0.35);
    ctx.font = `700 44px ${display}`;
    ctx.fillText(String(index + 1), 80, y + 62);
    roundedImage(ctx, trackArt[index], 150, y, 88, 14);
    ctx.fillStyle = rgb(white);
    ctx.font = `700 36px ${body}`;
    ctx.fillText(fit(ctx, track.name, WIDTH - 340), 265, y + 40);
    ctx.fillStyle = rgb(white, 0.6);
    ctx.font = `500 28px ${body}`;
    ctx.fillText(fit(ctx, track.artists.join(", "), WIDTH - 340), 265, y + 80);
  });

  // top artists
  ctx.fillStyle = rgb(white, 0.55);
  ctx.font = `500 24px ${mono}`;
  ctx.fillText("TOP ARTISTES", 80, 1065);
  artists.slice(0, 3).forEach((artist, index) => {
    const x = 80 + index * 315;
    ctx.save();
    ctx.beginPath();
    ctx.arc(x + 55, 1150, 55, 0, Math.PI * 2);
    ctx.clip();
    if (artistArt[index]) ctx.drawImage(artistArt[index]!, x, 1095, 110, 110);
    else {
      ctx.fillStyle = rgb(white, 0.08);
      ctx.fillRect(x, 1095, 110, 110);
    }
    ctx.restore();
    ctx.fillStyle = rgb(white);
    ctx.font = `700 28px ${body}`;
    ctx.fillText(fit(ctx, artist.name, 175), x + 125, 1145);
    ctx.fillStyle = rgb(white, 0.5);
    ctx.font = `500 22px ${mono}`;
    ctx.fillText(`#${index + 1}`, x + 125, 1180);
  });

  ctx.fillStyle = rgb(white, 0.35);
  ctx.font = `500 22px ${mono}`;
  ctx.fillText("Fait avec Vitrine · données Spotify", 80, HEIGHT - 60);

  return new Promise((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Image vide"))), "image/png"));
}

/** Hands the picture to the browser's download, which Electron turns into a "Save as" dialog. */
export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
