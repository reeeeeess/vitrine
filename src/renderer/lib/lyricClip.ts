// A lyric clip, as TikTok's "lyric edits" are made (1080 × 1920, 15 s): the line of the moment, big, each
// word lighting up as it is sung, over the artwork blurred and slowly zooming. Without sound: Spotify's
// audio cannot be recorded or shared, and TikTok adds the song itself (its sounds library).
import type { LyricLine } from "./lrc";
import { fill, stageLyrics, type LyricEntry, type SungWord } from "./lyricsView";
import { artworkColor, rgbVar } from "./palette";
import { cssVar, fit, loadImage, rgb, roundedImage } from "./recap";
import type { Track } from "./types";

const WIDTH = 1080;
const HEIGHT = 1920;
export const CLIP_MS = 15_000;
const FPS = 30;

type SungLine = Extract<LyricEntry, { kind: "line" }>;

/** The lines sung in the clip's stretch, from the one being sung at `startMs`. */
export function clipLines(lines: LyricLine[], startMs: number, lengthMs = CLIP_MS): SungLine[] {
  const staged = stageLyrics(lines).filter((entry): entry is SungLine => entry.kind === "line");
  return staged.filter((entry, index) => {
    const next = staged[index + 1];
    return entry.timeMs < startMs + lengthMs && (next ? next.timeMs : entry.endMs) > startMs;
  });
}

/** Where the clip starts: at the start of the line being sung, so it opens on a whole line. */
export function clipStart(lines: LyricLine[], positionMs: number): number {
  const sung = lines.filter((line) => line.text.trim() && line.timeMs <= positionMs);
  return sung.length ? sung[sung.length - 1].timeMs : Math.max(0, positionMs);
}

/**
 * The format to record in: MP4 in H.264 when the computer can (what every app takes), otherwise WebM
 * (TikTok takes it); an MP4 holding VP9 comes last, as some apps refuse it.
 */
export function clipFormat(supported: (type: string) => boolean = (type) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(type)): { mime: string; ext: "mp4" | "webm" } {
  const formats: { mime: string; ext: "mp4" | "webm" }[] = [
    { mime: "video/mp4;codecs=avc1.640028", ext: "mp4" },
    { mime: "video/mp4;codecs=avc1", ext: "mp4" },
    { mime: "video/webm;codecs=vp9", ext: "webm" },
    { mime: "video/webm", ext: "webm" },
    { mime: "video/mp4", ext: "mp4" },
  ];
  const format = formats.find(({ mime }) => supported(mime));
  if (!format) throw new Error("Enregistrement vidéo impossible sur cet ordinateur.");
  return format;
}

/** Lines of words that fit `width`, each word keeping its times. */
export function wrapWords(ctx: Pick<CanvasRenderingContext2D, "measureText">, words: SungWord[], width: number): SungWord[][] {
  const rows: SungWord[][] = [];
  let row: SungWord[] = [];
  const text = (list: SungWord[]) => list.map((word, i) => word.text + (word.glue || i === list.length - 1 ? "" : " ")).join("");
  for (const word of words) {
    if (row.length && ctx.measureText(text([...row, word])).width > width) {
      rows.push(row);
      row = [];
    }
    row.push(word);
  }
  if (row.length) rows.push(row);
  return rows;
}

const ease = (t: number) => 1 - (1 - Math.min(1, Math.max(0, t))) ** 3;

interface Assets {
  background: HTMLCanvasElement;
  image: HTMLImageElement | null;
  color: string;
  white: string;
  display: string;
  body: string;
  mono: string;
}

/** The artwork, enlarged, blurred and darkened, drawn once: blurring every frame would be too slow. */
function backdrop(image: HTMLImageElement | null, color: string): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  if (image) {
    ctx.filter = "blur(80px) saturate(1.5)";
    const side = HEIGHT + 300;
    ctx.drawImage(image, (WIDTH - side) / 2, -150, side, side);
    ctx.filter = "none";
  }
  const shade = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  shade.addColorStop(0, "rgb(0 0 0 / 0.35)");
  shade.addColorStop(0.5, "rgb(0 0 0 / 0.5)");
  shade.addColorStop(1, "rgb(0 0 0 / 0.8)");
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  const glow = ctx.createRadialGradient(WIDTH / 2, HEIGHT / 2, 0, WIDTH / 2, HEIGHT / 2, 800);
  glow.addColorStop(0, rgb(color, 0.35));
  glow.addColorStop(1, rgb(color, 0));
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  return canvas;
}

/** One line, centred, its words dim until sung, lit as they are (filling from the left), popping a little. */
function drawLine(ctx: CanvasRenderingContext2D, assets: Assets, line: SungLine, timeMs: number, centreY: number, size: number, alpha: number): void {
  ctx.font = `800 ${size}px ${assets.body}`;
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  const rows = wrapWords(ctx, line.words, WIDTH - 160);
  const lineHeight = size * 1.18;
  const top = centreY - ((rows.length - 1) * lineHeight) / 2;
  rows.forEach((row, r) => {
    const widths = row.map((word, i) => ctx.measureText(word.text + (word.glue || i === row.length - 1 ? "" : " ")).width);
    let x = (WIDTH - widths.reduce((sum, w) => sum + w, 0)) / 2;
    const y = top + r * lineHeight;
    row.forEach((word, i) => {
      const amount = fill(word.startMs, word.endMs, timeMs);
      const pop = amount > 0 ? 1 + 0.06 * (1 - ease((timeMs - word.startMs) / 250)) : 1;
      const wordWidth = ctx.measureText(word.text).width;
      ctx.save();
      ctx.translate(x + wordWidth / 2, y);
      ctx.scale(pop, pop);
      ctx.translate(-wordWidth / 2, 0);
      ctx.fillStyle = rgb(assets.white, 0.38 * alpha);
      ctx.fillText(word.text, 0, 0);
      if (amount > 0) {
        ctx.beginPath();
        ctx.rect(-4, -size, (wordWidth + 8) * amount, size * 2);
        ctx.clip();
        ctx.shadowColor = rgb(assets.white, 0.55 * alpha);
        ctx.shadowBlur = amount < 1 ? 24 : 0;
        ctx.fillStyle = rgb(assets.white, alpha);
        ctx.fillText(word.text, 0, 0);
      }
      ctx.restore();
      x += widths[i];
    });
  });
}

/** Draws the clip as it is at `elapsedMs` from its start. */
export function drawFrame(ctx: CanvasRenderingContext2D, assets: Assets, track: Track, lines: SungLine[], startMs: number, elapsedMs: number): void {
  const timeMs = startMs + elapsedMs;
  // the backdrop zooms in slowly (Ken Burns)
  const zoom = 1 + 0.08 * (elapsedMs / CLIP_MS);
  ctx.drawImage(assets.background, (WIDTH - WIDTH * zoom) / 2, (HEIGHT - HEIGHT * zoom) / 2, WIDTH * zoom, HEIGHT * zoom);

  // the artwork, the title and the artists at the top
  roundedImage(ctx, assets.image, 80, 150, 150, 22);
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = rgb(assets.white);
  ctx.font = `700 46px ${assets.display}`;
  ctx.fillText(fit(ctx, track.name, WIDTH - 340), 260, 215);
  ctx.fillStyle = rgb(assets.white, 0.7);
  ctx.font = `600 32px ${assets.body}`;
  ctx.fillText(fit(ctx, track.artists.join(", "), WIDTH - 340), 260, 265);

  // the line being sung, coming up from below as it starts; the next one, dim, under it
  let index = -1;
  lines.forEach((line, i) => line.timeMs <= timeMs && (index = i));
  const current = lines[index];
  if (current) {
    const enter = ease((timeMs - current.timeMs) / 350);
    drawLine(ctx, assets, current, timeMs, HEIGHT / 2 - 40 + (1 - enter) * 60, 88, 0.4 + 0.6 * enter);
  }
  const next = lines[index + 1];
  if (next) drawLine(ctx, assets, next, timeMs, HEIGHT / 2 + 330, 52, 0.55);
  if (!current && next) {
    // before the first line: the three dots of a silence
    ctx.fillStyle = rgb(assets.white, 0.85);
    for (let dot = 0; dot < 3; dot++) {
      ctx.beginPath();
      ctx.arc(WIDTH / 2 - 60 + dot * 60, HEIGHT / 2 - 40, 14 + 4 * Math.sin(elapsedMs / 300 + dot), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // the clip's progress, and where it was made
  ctx.fillStyle = rgb(assets.white, 0.2);
  ctx.fillRect(80, HEIGHT - 150, WIDTH - 160, 6);
  ctx.fillStyle = rgb(assets.color);
  ctx.fillRect(80, HEIGHT - 150, (WIDTH - 160) * Math.min(1, elapsedMs / CLIP_MS), 6);
  ctx.fillStyle = rgb(assets.white, 0.5);
  ctx.font = `500 24px ${assets.mono}`;
  ctx.textAlign = "center";
  ctx.fillText("♪ PAROLES · VITRINE", WIDTH / 2, HEIGHT - 90);
}

/**
 * Records the clip in real time (15 s) from the lines and the moment given, and hands back the video.
 * `onProgress` gets 0 to 1; `signal` stops it.
 */
export async function recordClip(
  { track, lines, startMs }: { track: Track; lines: LyricLine[]; startMs: number },
  onProgress: (share: number) => void,
  signal?: AbortSignal,
): Promise<{ blob: Blob; ext: "mp4" | "webm" }> {
  const sung = clipLines(lines, startMs);
  if (sung.length === 0) throw new Error("Pas de paroles synchronisées à cet endroit du titre.");
  const format = clipFormat();
  const art = track.imageLarge ?? track.image;
  const [image, color] = await Promise.all([loadImage(art), artworkColor(art).then(rgbVar)]);
  const assets: Assets = {
    background: backdrop(image, color),
    image,
    color,
    white: cssVar("--c-white") || "255 255 255",
    display: cssVar("--font-display") || "sans-serif",
    body: cssVar("--font-body") || "sans-serif",
    mono: cssVar("--font-mono") || "monospace",
  };
  await Promise.all([`800 88px ${assets.body}`, `700 46px ${assets.display}`, `500 24px ${assets.mono}`].map((font) => document.fonts.load(font).catch(() => [])));

  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext("2d")!;
  drawFrame(ctx, assets, track, sung, startMs, 0);
  const stream = canvas.captureStream(FPS);
  const recorder = new MediaRecorder(stream, { mimeType: format.mime, videoBitsPerSecond: 10_000_000 });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (event) => event.data.size && chunks.push(event.data);
  const stopped = new Promise<void>((resolve) => (recorder.onstop = () => resolve()));
  recorder.start(1000);

  const began = performance.now();
  await new Promise<void>((resolve, reject) => {
    const frame = () => {
      if (signal?.aborted) return reject(new DOMException("Annulé", "AbortError"));
      const elapsed = performance.now() - began;
      drawFrame(ctx, assets, track, sung, startMs, Math.min(elapsed, CLIP_MS));
      onProgress(Math.min(1, elapsed / CLIP_MS));
      if (elapsed >= CLIP_MS) resolve();
      else requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }).finally(() => {
    recorder.stop();
    for (const track of stream.getTracks()) track.stop();
  });
  await stopped;
  return { blob: new Blob(chunks, { type: format.mime.split(";")[0] }), ext: format.ext };
}
