// A story of the track playing (1080 × 1920, the size TikTok, Instagram and Snapchat stories take):
// its artwork over a blurred wash of itself, the title, the artists and the lyric line of the moment.
import { artworkColor, rgbVar } from "./palette";
import { cssVar, fit, loadImage, rgb, roundedImage } from "./recap";
import type { Track } from "./types";

const WIDTH = 1080;
const HEIGHT = 1920;

/** Breaks a text into at most `max` lines that fit `width`, the last one shortened if need be. */
export function wrap(ctx: Pick<CanvasRenderingContext2D, "measureText">, text: string, width: number, max: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const candidate = line ? `${line} ${word}` : word;
    if (ctx.measureText(candidate).width <= width || !line) line = candidate;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  if (lines.length <= max) return lines;
  const kept = lines.slice(0, max);
  let last = `${kept[max - 1]} ${lines.slice(max).join(" ")}`;
  while (last.length > 1 && ctx.measureText(`${last}…`).width > width) last = last.slice(0, -1);
  kept[max - 1] = `${last.trimEnd()}…`;
  return kept;
}

export async function renderStory({ track, lyric }: { track: Track; lyric?: string }): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Dessin impossible");

  const white = cssVar("--c-white") || "255 255 255";
  const from = cssVar("--accent-from") || "220 38 38";
  const display = cssVar("--font-display") || "sans-serif";
  const body = cssVar("--font-body") || "sans-serif";
  const mono = cssVar("--font-mono") || "monospace";
  const art = track.imageLarge ?? track.image;
  const [image, color] = await Promise.all([
    loadImage(art),
    artworkColor(art).then(rgbVar),
    ...[`700 76px ${display}`, `600 40px ${body}`, `italic 600 46px ${body}`, `500 26px ${mono}`].map((font) => document.fonts.load(font).catch(() => [])),
  ]);

  // the artwork, enlarged and blurred, then darkened so the text reads
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  if (image) {
    ctx.save();
    ctx.filter = "blur(70px) saturate(1.4)";
    const side = HEIGHT + 160;
    ctx.drawImage(image, (WIDTH - side) / 2, -80, side, side);
    ctx.restore();
  }
  const shade = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  shade.addColorStop(0, "rgb(0 0 0 / 0.35)");
  shade.addColorStop(0.55, "rgb(0 0 0 / 0.45)");
  shade.addColorStop(1, "rgb(0 0 0 / 0.85)");
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  const glow = ctx.createRadialGradient(WIDTH / 2, 760, 0, WIDTH / 2, 760, 700);
  glow.addColorStop(0, rgb(color, 0.45));
  glow.addColorStop(1, rgb(color, 0));
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  ctx.fillStyle = rgb(white, 0.75);
  ctx.font = `500 26px ${mono}`;
  ctx.textAlign = "center";
  ctx.fillText("● EN ÉCOUTE SUR VITRINE", WIDTH / 2, 190);

  // the artwork itself, with its shadow
  const size = 780;
  const x = (WIDTH - size) / 2;
  const y = 300;
  ctx.save();
  ctx.shadowColor = "rgb(0 0 0 / 0.6)";
  ctx.shadowBlur = 80;
  ctx.shadowOffsetY = 30;
  ctx.fillStyle = "#000";
  ctx.beginPath();
  ctx.roundRect(x, y, size, size, 36);
  ctx.fill();
  ctx.restore();
  roundedImage(ctx, image, x, y, size, 36);

  ctx.fillStyle = rgb(white);
  ctx.font = `700 76px ${display}`;
  const title = wrap(ctx, track.name, WIDTH - 160, 2);
  title.forEach((line, i) => ctx.fillText(line, WIDTH / 2, 1210 + i * 88));
  let bottom = 1210 + (title.length - 1) * 88;
  ctx.fillStyle = rgb(white, 0.7);
  ctx.font = `600 40px ${body}`;
  ctx.fillText(fit(ctx, track.artists.join(", "), WIDTH - 160), WIDTH / 2, bottom + 70);
  bottom += 70;

  if (lyric?.trim()) {
    ctx.font = `italic 600 46px ${body}`;
    const lines = wrap(ctx, `« ${lyric.trim()} »`, WIDTH - 220, 3);
    const top = bottom + 90;
    const height = lines.length * 62 + 60;
    ctx.fillStyle = "rgb(255 255 255 / 0.1)";
    ctx.beginPath();
    ctx.roundRect(80, top, WIDTH - 160, height, 28);
    ctx.fill();
    ctx.fillStyle = rgb(from);
    ctx.fillRect(80, top, 8, height);
    ctx.fillStyle = rgb(white, 0.92);
    lines.forEach((line, i) => ctx.fillText(line, WIDTH / 2, top + 72 + i * 62));
  }

  ctx.fillStyle = rgb(white, 0.45);
  ctx.font = `500 24px ${mono}`;
  ctx.fillText(fit(ctx, `${track.albumName ? `${track.albumName} · ` : ""}données Spotify`, WIDTH - 160), WIDTH / 2, HEIGHT - 90);

  return new Promise((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Image vide"))), "image/png"));
}

/** A file name from the title: letters, digits and dashes. */
export function storyFileName(track: Pick<Track, "name">): string {
  const slug = track.name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  return `vitrine-story-${slug || "titre"}.png`;
}
