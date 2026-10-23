// The equalizer's ten bands and its presets, shared by the page (the panel) and the main process (the
// file Equalizer APO reads).

export const BANDS = [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000] as const;
export const MAX_GAIN = 12;

export const PRESETS: Record<string, number[]> = {
  Plat: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  Basses: [6, 5, 4, 2, 0, 0, 0, 0, 0, 0],
  "Basses +": [9, 8, 6, 3, 0, -1, 0, 0, 0, 0],
  Voix: [-2, -2, -1, 1, 3, 4, 3, 1, 0, -1],
  Aigus: [0, 0, 0, 0, 0, 1, 2, 4, 5, 6],
  Soirée: [6, 4, 1, 0, -1, 0, 1, 3, 4, 4],
  Casque: [3, 2, 0, -1, 0, 1, 2, 2, 1, 0],
  Nuit: [-3, -2, -1, 0, 1, 1, 0, -2, -4, -5],
};

/** "31", "1k", "16k" */
export const bandLabel = (hz: number) => (hz >= 1000 ? `${hz / 1000}k` : String(hz));

/** The preset these gains are, or "Perso". */
export function presetOf(gains: number[]): string {
  return Object.entries(PRESETS).find(([, preset]) => preset.every((gain, i) => gain === gains[i]))?.[0] ?? "Perso";
}

/** A smooth SVG path through the ten knobs (Catmull-Rom turned Bézier), for the curve under the sliders. */
export function curvePath(gains: number[], width: number, height: number): string {
  const points = gains.map((gain, i) => [(i / (gains.length - 1)) * width, height / 2 - (gain / MAX_GAIN) * (height / 2)] as const);
  return points.reduce((d, [x, y], i) => {
    if (i === 0) return `M ${x} ${y}`;
    const [x0, y0] = points[i - 2] ?? points[i - 1];
    const [x1, y1] = points[i - 1];
    const [x3, y3] = points[i + 1] ?? [x, y];
    const c1 = [x1 + (x - x0) / 6, y1 + (y - y0) / 6];
    const c2 = [x - (x3 - x1) / 6, y - (y3 - y1) / 6];
    return `${d} C ${c1[0].toFixed(1)} ${c1[1].toFixed(1)}, ${c2[0].toFixed(1)} ${c2[1].toFixed(1)}, ${x.toFixed(1)} ${y.toFixed(1)}`;
  }, "");
}
