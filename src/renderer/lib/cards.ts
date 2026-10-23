// The pictures people share on TikTok and Instagram about their listening, made from Vitrine's data:
// the receipt (Receiptify), the festival poster (Instafest), the iceberg (Icebergify) and the musical
// aura. Drawn on a canvas, like the recap; the layout helpers are pure, and tested.
import type { IcebergLevel } from "./insights";
import type { Rgb } from "./palette";
import { cssVar, fit, rgb } from "./recap";
import { LOCALE, t } from "./i18n";

// ── layout, pure ──────────────────────────────────────────────────────────

export interface ReceiptLine {
  n: string;
  title: string;
  artist: string;
  time: string;
}

const clock = (ms: number) => `${Math.floor(ms / 60_000)}:${String(Math.floor((ms % 60_000) / 1000)).padStart(2, "0")}`;

/** The receipt's lines: "01  TITLE — ARTIST  3:24", and the total. */
export function receiptLines(tracks: { name: string; artists: string[]; durationMs: number }[]): { lines: ReceiptLine[]; totalMs: number } {
  const lines = tracks.slice(0, 10).map((track, index) => ({
    n: String(index + 1).padStart(2, "0"),
    title: track.name.toUpperCase(),
    artist: (track.artists[0] ?? "").toUpperCase(),
    time: clock(track.durationMs),
  }));
  return { lines, totalMs: tracks.slice(0, 10).reduce((sum, track) => sum + track.durationMs, 0) };
}

export interface FestivalDay {
  day: string;
  headliner: string;
  others: string[];
}

/** Three days: one headliner each, then the others shared out in turn (the higher, the earlier). */
export function festivalDays(artists: string[]): FestivalDay[] {
  const names = [...new Set(artists.filter(Boolean))];
  return ["VENDREDI", "SAMEDI", "DIMANCHE"].map((day, index) => ({
    day,
    headliner: names[index] ?? "",
    others: names.slice(3).filter((_, k) => k % 3 === index).slice(0, 9),
  }));
}

const toHsl = ([r, g, b]: Rgb): [number, number, number] => {
  const [rn, gn, bn] = [r / 255, g / 255, b / 255];
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === rn ? ((gn - bn) / d + (gn < bn ? 6 : 0)) * 60 : max === gn ? ((bn - rn) / d + 2) * 60 : ((rn - gn) / d + 4) * 60;
  return [h, s, l];
};

const NAMES: [number, string][] = [
  [15, "Passion rouge"],
  [45, "Soleil couchant"],
  [70, "Or électrique"],
  [160, "Forêt nocturne"],
  [200, "Lagon glacé"],
  [250, "Nuit électrique"],
  [290, "Rêve violet"],
  [345, "Néon rose"],
  [360, "Passion rouge"],
];

/** The aura of a set of artworks: five colours ordered by hue, and a name for the whole. */
export function auraOf(colors: Rgb[]): { stops: string[]; name: string } {
  const vivid = colors.filter(([r, g, b]) => Math.max(r, g, b) - Math.min(r, g, b) > 25);
  const pool = vivid.length >= 3 ? vivid : colors;
  if (pool.length === 0) return { stops: ["40 40 40", "90 90 90"], name: "Brume" };
  const sorted = [...pool].sort((a, b) => toHsl(a)[0] - toHsl(b)[0]);
  const step = Math.max(1, Math.floor(sorted.length / 5));
  const stops = sorted.filter((_, i) => i % step === 0).slice(0, 5).map((c) => c.join(" "));
  // the hue the colours lean to, by summing them as vectors around the colour wheel
  let x = 0;
  let y = 0;
  let saturation = 0;
  for (const color of pool) {
    const [h, s] = toHsl(color);
    x += Math.cos((h * Math.PI) / 180) * s;
    y += Math.sin((h * Math.PI) / 180) * s;
    saturation += s;
  }
  if (saturation / pool.length < 0.18) return { stops, name: "Brume nocturne" };
  const hue = ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
  return { stops, name: NAMES.find(([limit]) => hue < limit)?.[1] ?? "Passion rouge" };
}

// ── drawing ───────────────────────────────────────────────────────────────

async function canvas(width: number, height: number, fonts: string[]): Promise<[HTMLCanvasElement, CanvasRenderingContext2D]> {
  const element = document.createElement("canvas");
  element.width = width;
  element.height = height;
  const ctx = element.getContext("2d");
  if (!ctx) throw new Error("Dessin impossible");
  // a canvas does not wait for fonts: load the faces it is about to use
  await Promise.all(fonts.map((font) => document.fonts.load(font).catch(() => [])));
  return [element, ctx];
}

const toBlob = (element: HTMLCanvasElement) =>
  new Promise<Blob>((resolve, reject) => element.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Image vide"))), "image/png"));

const fonts = () => ({ display: cssVar("--font-display") || "sans-serif", body: cssVar("--font-body") || "sans-serif", mono: cssVar("--font-mono") || "monospace" });

/** T1: the receipt, 1080 × 1920 (story size). */
export async function renderReceipt(input: { name: string; period: string; tracks: { name: string; artists: string[]; durationMs: number }[] }): Promise<Blob> {
  const { mono } = fonts();
  const [element, ctx] = await canvas(1080, 1920, [`700 40px ${mono}`, `500 30px ${mono}`]);
  ctx.fillStyle = "#1b1b1b";
  ctx.fillRect(0, 0, 1080, 1920);
  // the paper, with a torn bottom edge
  const left = 140;
  const width = 800;
  const top = 160;
  const { lines, totalMs } = receiptLines(input.tracks);
  const bottom = top + 640 + lines.length * 98;
  ctx.fillStyle = "#f4f1ea";
  ctx.beginPath();
  ctx.moveTo(left, top);
  ctx.lineTo(left + width, top);
  ctx.lineTo(left + width, bottom);
  for (let x = left + width; x > left; x -= 25) ctx.lineTo(x - 12.5, bottom + (((x - left) / 25) % 2 ? 14 : 0));
  ctx.lineTo(left, bottom);
  ctx.closePath();
  ctx.shadowColor = "rgb(0 0 0 / 0.5)";
  ctx.shadowBlur = 40;
  ctx.fill();
  ctx.shadowBlur = 0;

  ctx.fillStyle = "#111";
  ctx.textAlign = "center";
  ctx.font = `700 46px ${mono}`;
  ctx.fillText("VITRINE", 540, top + 90);
  ctx.font = `500 26px ${mono}`;
  ctx.fillText(t(`REÇU N° ${String(Math.floor(Date.now() / 86_400_000) % 10_000).padStart(4, "0")}`), 540, top + 135);
  ctx.fillText(input.period.toUpperCase(), 540, top + 175);
  ctx.fillText(new Date().toLocaleDateString(LOCALE, { day: "2-digit", month: "2-digit", year: "numeric" }), 540, top + 215);
  const rule = (y: number) => {
    ctx.fillText("-".repeat(44), 540, y);
  };
  rule(top + 265);
  ctx.textAlign = "left";
  ctx.font = `500 26px ${mono}`;
  ctx.fillText(t("QTÉ  ARTICLE"), left + 50, top + 315);
  ctx.textAlign = "right";
  ctx.fillText(t("DURÉE"), left + width - 50, top + 315);
  lines.forEach((line, index) => {
    const y = top + 385 + index * 98;
    ctx.textAlign = "left";
    ctx.font = `700 30px ${mono}`;
    ctx.fillText(fit(ctx, `${line.n}   ${line.title}`, width - 230), left + 50, y);
    ctx.font = `500 24px ${mono}`;
    ctx.fillStyle = "#555";
    ctx.fillText(fit(ctx, `     ${line.artist}`, width - 230), left + 50, y + 36);
    ctx.fillStyle = "#111";
    ctx.textAlign = "right";
    ctx.font = `700 30px ${mono}`;
    ctx.fillText(line.time, left + width - 50, y);
  });
  const end = top + 385 + lines.length * 98;
  ctx.textAlign = "center";
  ctx.font = `500 26px ${mono}`;
  rule(end);
  ctx.textAlign = "left";
  ctx.font = `700 34px ${mono}`;
  ctx.fillText("TOTAL", left + 50, end + 60);
  ctx.textAlign = "right";
  ctx.fillText(clock(totalMs), left + width - 50, end + 60);
  ctx.textAlign = "center";
  ctx.font = `500 24px ${mono}`;
  ctx.fillText(t(`CLIENT : ${(input.name || t("MÉLOMANE")).toUpperCase()}`), 540, end + 120);
  ctx.fillText(t("MERCI DE VOTRE ÉCOUTE !"), 540, end + 160);
  // a barcode, for the look
  for (let i = 0, x = 330; x < 750; i++) {
    const w = [2, 4, 3, 6][(i * 7) % 4];
    ctx.fillRect(x, end + 190, w, 70);
    x += w + [3, 5, 4][(i * 5) % 3];
  }
  ctx.fillStyle = "rgb(255 255 255 / 0.4)";
  ctx.font = `500 24px ${mono}`;
  ctx.fillText(t("Fait avec Vitrine · données Spotify"), 540, 1860);
  return toBlob(element);
}

/** T2: the festival poster, 1080 × 1350, three days, headliners big. */
export async function renderFestival(input: { name: string; artists: string[]; colors: [Rgb, Rgb] }): Promise<Blob> {
  const { display, mono } = fonts();
  const [element, ctx] = await canvas(1080, 1350, [`700 110px ${display}`, `700 60px ${display}`, `500 30px ${mono}`]);
  const [a, b] = input.colors;
  const sky = ctx.createLinearGradient(0, 0, 0, 1350);
  sky.addColorStop(0, rgb(a.join(" ")));
  sky.addColorStop(0.55, rgb(b.join(" ")));
  sky.addColorStop(1, "#0b0b0b");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, 1080, 1350);
  // a sun and a stage silhouette
  ctx.fillStyle = "rgb(255 255 255 / 0.18)";
  ctx.beginPath();
  ctx.arc(540, 1250, 330, Math.PI, 0);
  ctx.fill();
  ctx.fillStyle = "#0b0b0b";
  ctx.fillRect(0, 1250, 1080, 100);

  const fest = `${(input.name.split(" ")[0] || "VITRINE").toUpperCase()} FEST ${new Date().getFullYear()}`;
  ctx.textAlign = "center";
  ctx.fillStyle = "#fff";
  ctx.font = `700 96px ${display}`;
  ctx.fillText(fit(ctx, fest, 960), 540, 150);
  ctx.font = `500 28px ${mono}`;
  ctx.fillStyle = "rgb(255 255 255 / 0.8)";
  ctx.fillText(t("3 JOURS · UNE SEULE SCÈNE · VOS ARTISTES"), 540, 200);

  festivalDays(input.artists).forEach((day, index) => {
    const y = 300 + index * 320;
    ctx.fillStyle = "rgb(255 255 255 / 0.75)";
    ctx.font = `500 30px ${mono}`;
    ctx.fillText(day.day, 540, y);
    ctx.fillStyle = "#fff";
    ctx.font = `700 84px ${display}`;
    ctx.fillText(fit(ctx, day.headliner.toUpperCase(), 980), 540, y + 95);
    ctx.font = `700 38px ${display}`;
    const others = day.others.map((name) => name.toUpperCase());
    const firstRow = others.slice(0, 4).join("  ·  ");
    const secondRow = others.slice(4, 9).join("  ·  ");
    ctx.fillStyle = "rgb(255 255 255 / 0.92)";
    ctx.fillText(fit(ctx, firstRow, 980), 540, y + 160);
    ctx.font = `700 30px ${display}`;
    ctx.fillStyle = "rgb(255 255 255 / 0.7)";
    ctx.fillText(fit(ctx, secondRow, 980), 540, y + 210);
  });
  ctx.fillStyle = "rgb(255 255 255 / 0.5)";
  ctx.font = `500 22px ${mono}`;
  ctx.fillText(t("Fait avec Vitrine · données Spotify"), 540, 1315);
  return toBlob(element);
}

/** T3: the iceberg, 1080 × 1350, from the person's own habits. */
export async function renderIceberg(levels: IcebergLevel[]): Promise<Blob> {
  const { display, body, mono } = fonts();
  const [element, ctx] = await canvas(1080, 1350, [`700 64px ${display}`, `600 30px ${body}`, `500 24px ${mono}`]);
  // sky, then water darkening down to the bottom
  ctx.fillStyle = "#cfe8ff";
  ctx.fillRect(0, 0, 1080, 300);
  const water = ctx.createLinearGradient(0, 300, 0, 1350);
  water.addColorStop(0, "#1e6fb8");
  water.addColorStop(1, "#020a1a");
  ctx.fillStyle = water;
  ctx.fillRect(0, 300, 1080, 1050);
  // the ice: a small tip above the water, a wide mass below
  ctx.fillStyle = "rgb(255 255 255 / 0.92)";
  ctx.beginPath();
  ctx.moveTo(440, 150);
  ctx.lineTo(620, 170);
  ctx.lineTo(700, 300);
  ctx.lineTo(380, 300);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "rgb(210 235 255 / 0.25)";
  ctx.beginPath();
  ctx.moveTo(380, 300);
  ctx.lineTo(700, 300);
  ctx.lineTo(900, 700);
  ctx.lineTo(820, 1150);
  ctx.lineTo(260, 1180);
  ctx.lineTo(160, 760);
  ctx.closePath();
  ctx.fill();

  ctx.textAlign = "center";
  ctx.fillStyle = "#0b2340";
  ctx.font = `700 60px ${display}`;
  ctx.fillText(t("MON ICEBERG"), 540, 90);
  levels.forEach((level, index) => {
    const y = index === 0 ? 215 : 300 + index * 210;
    ctx.fillStyle = index === 0 ? "rgb(11 35 64 / 0.7)" : "rgb(255 255 255 / 0.6)";
    ctx.font = `500 22px ${mono}`;
    ctx.fillText(level.label.toUpperCase(), 540, index === 0 ? 125 : y - 40);
    ctx.fillStyle = index === 0 ? "#0b2340" : "#fff";
    ctx.font = `600 ${index === 0 ? 30 : 28}px ${body}`;
    const half = Math.ceil(level.artists.length / 2);
    ctx.fillText(fit(ctx, level.artists.slice(0, half).join(" · "), 900), 540, y);
    ctx.fillText(fit(ctx, level.artists.slice(half).join(" · "), 900), 540, y + 44);
  });
  ctx.fillStyle = "rgb(255 255 255 / 0.45)";
  ctx.font = `500 22px ${mono}`;
  ctx.fillText(t("Vos artistes, des plus écoutés aux pépites enfouies · Vitrine"), 540, 1315);
  return toBlob(element);
}

/** T4: the musical aura, 1080 × 1350. */
export async function renderAura(input: { name: string; colors: Rgb[] }): Promise<Blob> {
  const { display, mono } = fonts();
  const [element, ctx] = await canvas(1080, 1350, [`700 96px ${display}`, `500 26px ${mono}`]);
  const aura = auraOf(input.colors);
  ctx.fillStyle = "#050505";
  ctx.fillRect(0, 0, 1080, 1350);
  // soft overlapping glows, one per colour
  ctx.filter = "blur(90px)";
  aura.stops.forEach((stop, index) => {
    const angle = (index / aura.stops.length) * Math.PI * 2;
    ctx.fillStyle = rgb(stop, 0.9);
    ctx.beginPath();
    ctx.arc(540 + Math.cos(angle) * 170, 600 + Math.sin(angle) * 170, 280, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.filter = "none";
  ctx.textAlign = "center";
  ctx.fillStyle = "rgb(255 255 255 / 0.75)";
  ctx.font = `500 26px ${mono}`;
  ctx.fillText(t(`L'AURA MUSICALE DE ${(input.name.split(" ")[0] || "VOUS").toUpperCase()}`), 540, 140);
  ctx.fillStyle = "#fff";
  ctx.font = `700 96px ${display}`;
  ctx.fillText(fit(ctx, aura.name, 980), 540, 1090);
  aura.stops.forEach((stop, index) => {
    ctx.fillStyle = rgb(stop);
    ctx.beginPath();
    ctx.arc(540 + (index - (aura.stops.length - 1) / 2) * 90, 1180, 30, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.fillStyle = "rgb(255 255 255 / 0.45)";
  ctx.font = `500 22px ${mono}`;
  ctx.fillText(t("Les couleurs des pochettes que vous écoutez le plus · Vitrine"), 540, 1300);
  return toBlob(element);
}

/** I2: Rétro Vitrine's last slide as a picture, 1080 × 1920 (story size). */
export async function renderRetroCard(input: {
  label: string;
  name: string;
  minutes: number;
  topArtist?: string;
  topTracks: { name: string; detail: string }[];
  colors: Rgb[];
}): Promise<Blob> {
  const { display, body, mono } = fonts();
  const [element, ctx] = await canvas(1080, 1920, [`700 120px ${display}`, `700 56px ${display}`, `600 36px ${body}`, `500 28px ${mono}`]);
  const aura = auraOf(input.colors);
  ctx.fillStyle = "#070707";
  ctx.fillRect(0, 0, 1080, 1920);
  ctx.filter = "blur(110px)";
  aura.stops.forEach((stop, index) => {
    ctx.fillStyle = rgb(stop, 0.75);
    ctx.beginPath();
    ctx.arc(180 + index * 190, 380 + (index % 2) * 220, 300, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.filter = "none";
  ctx.fillStyle = "rgb(0 0 0 / 0.25)";
  ctx.fillRect(0, 0, 1080, 1920);

  ctx.fillStyle = "rgb(255 255 255 / 0.8)";
  ctx.font = `500 28px ${mono}`;
  ctx.fillText(`RÉTRO VITRINE · ${input.label.toUpperCase()}`, 90, 150);
  ctx.fillStyle = "#fff";
  ctx.font = `700 120px ${display}`;
  ctx.fillText(new Intl.NumberFormat(LOCALE).format(input.minutes), 90, 330);
  ctx.font = `600 40px ${body}`;
  ctx.fillText(t("minutes d'écoute"), 90, 395);

  if (input.topArtist) {
    ctx.fillStyle = "rgb(255 255 255 / 0.7)";
    ctx.font = `500 28px ${mono}`;
    ctx.fillText(t("ARTISTE N° 1"), 90, 540);
    ctx.fillStyle = "#fff";
    ctx.font = `700 96px ${display}`;
    ctx.fillText(fit(ctx, input.topArtist, 900), 90, 640);
  }

  ctx.fillStyle = "rgb(255 255 255 / 0.7)";
  ctx.font = `500 28px ${mono}`;
  ctx.fillText(t("TOP TITRES"), 90, 790);
  input.topTracks.slice(0, 5).forEach((track, index) => {
    const y = 870 + index * 130;
    ctx.fillStyle = index === 0 ? "#fff" : "rgb(255 255 255 / 0.55)";
    ctx.font = `700 60px ${display}`;
    ctx.fillText(String(index + 1), 90, y + 20);
    ctx.fillStyle = "#fff";
    ctx.font = `600 40px ${body}`;
    ctx.fillText(fit(ctx, track.name, 800), 190, y);
    ctx.fillStyle = "rgb(255 255 255 / 0.6)";
    ctx.font = `500 30px ${body}`;
    ctx.fillText(fit(ctx, track.detail, 800), 190, y + 44);
  });

  ctx.fillStyle = "rgb(255 255 255 / 0.7)";
  ctx.font = `500 28px ${mono}`;
  ctx.fillText(t("MON AURA"), 90, 1600);
  ctx.fillStyle = "#fff";
  ctx.font = `700 64px ${display}`;
  ctx.fillText(aura.name, 90, 1680);
  ctx.fillStyle = "rgb(255 255 255 / 0.45)";
  ctx.font = `500 24px ${mono}`;
  ctx.fillText(`${input.name ? `${input.name.split(" ")[0]} · ` : ""}${t("Fait avec Vitrine")}`, 90, 1850);
  return toBlob(element);
}
