// Rétro Vitrine as a vertical video (1080 × 1920, about 15 s), for TikTok, Instagram or a story: the intro,
// the minutes counting up, the artist of the period, the top five tracks coming in one by one, then the
// final card. Drawn on a canvas and recorded as it plays (the same way as the lyric clip).
import { auraOf, renderRetroCard } from "./cards";
import { clipFormat, videoFile } from "./lyricClip";
import type { Ranked } from "./listening";
import type { Rgb } from "./palette";
import { cssVar, fit, loadImage, rgb, roundedImage } from "./recap";

const WIDTH = 1080;
const HEIGHT = 1920;
const FPS = 30;

/** each scene and how long it lasts, ms */
export const SCENES = [
  { key: "intro", ms: 2600 },
  { key: "minutes", ms: 2800 },
  { key: "artist", ms: 3000 },
  { key: "tracks", ms: 3600 },
  { key: "card", ms: 3400 },
] as const;
export const VIDEO_MS = SCENES.reduce((sum, scene) => sum + scene.ms, 0);
const FADE_MS = 380;

/** Which scene plays at `t` ms, and how far into it (0 to 1). */
export function sceneAt(t: number): { index: number; progress: number; elapsed: number } {
  let start = 0;
  for (let index = 0; index < SCENES.length; index++) {
    const end = start + SCENES[index].ms;
    if (t < end || index === SCENES.length - 1) return { index, progress: Math.min(1, Math.max(0, (t - start) / SCENES[index].ms)), elapsed: t - start };
    start = end;
  }
  return { index: SCENES.length - 1, progress: 1, elapsed: 0 };
}

const ease = (t: number) => 1 - (1 - Math.min(1, Math.max(0, t))) ** 3;

export interface RetroInput {
  label: string;
  name: string;
  minutes: number;
  topArtist?: string;
  artistImage?: string;
  topTracks: Ranked[];
  colors: Rgb[];
}

/** Records the video, handing back its file and kind; `onProgress` gets 0 to 1, `signal` stops it. */
export async function recordRetro(input: RetroInput, onProgress: (share: number) => void, signal?: AbortSignal): Promise<{ blob: Blob; ext: "mp4" | "webm" }> {
  const format = clipFormat();
  const display = cssVar("--font-display") || "sans-serif";
  const body = cssVar("--font-body") || "sans-serif";
  const mono = cssVar("--font-mono") || "monospace";
  await Promise.all([`700 150px ${display}`, `700 64px ${display}`, `600 40px ${body}`, `500 28px ${mono}`].map((font) => document.fonts.load(font).catch(() => [])));
  const tracks = input.topTracks.slice(0, 5);
  const [artist, card, ...covers] = await Promise.all([
    loadImage(input.artistImage),
    renderRetroCard({ label: input.label, name: input.name, minutes: input.minutes, topArtist: input.topArtist, topTracks: input.topTracks, colors: input.colors }).then((blob) => createImageBitmap(blob)),
    ...tracks.map((track) => loadImage(track.image)),
  ]);
  const aura = auraOf(input.colors);
  const stops = aura.stops.length >= 2 ? aura.stops : ["220 38 38", "60 20 120"];

  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext("2d")!;

  const backdrop = (t: number) => {
    ctx.fillStyle = "#070707";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    // two glows of the period's colours, drifting
    const drift = Math.sin(t / 2400) * 120;
    for (const [i, color] of [stops[0], stops[stops.length - 1]].entries()) {
      const x = i ? 820 - drift : 260 + drift;
      const y = i ? 1500 : 420;
      const glow = ctx.createRadialGradient(x, y, 0, x, y, 900);
      glow.addColorStop(0, rgb(color, 0.65));
      glow.addColorStop(1, rgb(color, 0));
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
    }
  };
  const kicker = (text: string, y: number) => {
    ctx.fillStyle = "rgb(255 255 255 / 0.65)";
    ctx.font = `500 28px ${mono}`;
    ctx.textAlign = "left";
    ctx.fillText(text.toUpperCase(), 90, y);
  };
  const big = (text: string, y: number, size: number, alpha = 1) => {
    ctx.fillStyle = `rgb(255 255 255 / ${alpha})`;
    ctx.font = `700 ${size}px ${display}`;
    ctx.textAlign = "left";
    ctx.fillText(fit(ctx, text, WIDTH - 180), 90, y);
  };

  const scene = (index: number, progress: number, elapsed: number) => {
    const rise = (delay = 0) => (1 - ease((elapsed - delay) / 600)) * 60;
    switch (SCENES[index].key) {
      case "intro":
        kicker("Rétro Vitrine", 760);
        big(input.name ? `${input.name.split(" ")[0]},` : "Votre", 900 + rise(), 130);
        big(input.label, 1040 + rise(120), 130);
        ctx.fillStyle = "rgb(255 255 255 / 0.75)";
        ctx.font = `600 44px ${body}`;
        ctx.fillText("en musique. On rembobine ?", 90, 1140 + rise(240));
        break;
      case "minutes":
        kicker("Temps d'écoute", 760);
        big(Math.round(input.minutes * ease(progress * 1.4)).toLocaleString("fr-FR"), 960, 220);
        big("minutes", 1060 + rise(200), 80, 0.85);
        break;
      case "artist": {
        kicker("Votre artiste", 420);
        const size = 640 * (0.92 + 0.08 * ease(elapsed / 900));
        ctx.save();
        ctx.beginPath();
        ctx.arc(WIDTH / 2, 860, size / 2, 0, Math.PI * 2);
        ctx.clip();
        if (artist) ctx.drawImage(artist, WIDTH / 2 - size / 2, 860 - size / 2, size, size);
        ctx.restore();
        big(input.topArtist ?? "", 1360 + rise(200), 96);
        break;
      }
      case "tracks":
        kicker("Vos titres en boucle", 360);
        tracks.forEach((track, i) => {
          const shown = ease((elapsed - i * 380) / 500);
          if (shown <= 0) return;
          const y = 470 + i * 250 + (1 - shown) * 40;
          ctx.globalAlpha = shown;
          roundedImage(ctx, covers[i] ?? null, 90, y, 200, 20);
          ctx.fillStyle = "rgb(255 255 255)";
          ctx.font = `700 52px ${display}`;
          ctx.textAlign = "left";
          ctx.fillText(fit(ctx, `${i + 1}. ${track.name}`, WIDTH - 420), 330, y + 90);
          ctx.fillStyle = "rgb(255 255 255 / 0.65)";
          ctx.font = `600 34px ${body}`;
          ctx.fillText(fit(ctx, track.detail, WIDTH - 420), 330, y + 145);
          ctx.globalAlpha = 1;
        });
        break;
      case "card": {
        // the final card, slowly coming closer
        const zoom = 0.9 + 0.06 * ease(progress);
        ctx.drawImage(card, (WIDTH - WIDTH * zoom) / 2, (HEIGHT - HEIGHT * zoom) / 2, WIDTH * zoom, HEIGHT * zoom);
        break;
      }
    }
  };

  const draw = (t: number) => {
    const { index, progress, elapsed } = sceneAt(t);
    backdrop(t);
    // each scene fades in, and out before the next
    const fadeIn = Math.min(1, elapsed / FADE_MS);
    const fadeOut = index < SCENES.length - 1 ? Math.min(1, (SCENES[index].ms - elapsed) / FADE_MS) : 1;
    ctx.globalAlpha = Math.max(0, Math.min(fadeIn, fadeOut));
    scene(index, progress, elapsed);
    ctx.globalAlpha = 1;
  };

  draw(0);
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
      const t = performance.now() - began;
      draw(Math.min(t, VIDEO_MS));
      onProgress(Math.min(1, t / VIDEO_MS));
      if (t >= VIDEO_MS) resolve();
      else requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }).finally(() => {
    recorder.stop();
    for (const track of stream.getTracks()) track.stop();
  });
  await stopped;
  return { blob: await videoFile(chunks, format, VIDEO_MS), ext: format.ext };
}
