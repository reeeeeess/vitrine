// The click wheel of "Vitrine Classic" (the iPod Classic look, viral on TikTok with RetroPod): turning
// the ring moves through the menu one notch every 24°, and its four sides are buttons.

/** The angle of a point around the wheel's centre, in degrees: 0 on the right, 90 at the bottom (screen). */
export function angleOf(x: number, y: number, cx: number, cy: number): number {
  return ((Math.atan2(y - cy, x - cx) * 180) / Math.PI + 360) % 360;
}

/** The shortest turn from one angle to another, −180 to 180 (clockwise positive). */
export function angleDelta(from: number, to: number): number {
  return ((to - from + 540) % 360) - 180;
}

/** Notches passed by a turn: whole steps of `step` degrees, and the rest kept for the next move. */
export function wheelSteps(accumulated: number, delta: number, step = 24): { steps: number; rest: number } {
  const total = accumulated + delta;
  const steps = Math.trunc(total / step);
  return { steps, rest: total - steps * step };
}

export type WheelZone = "menu" | "next" | "play" | "previous";

/** Which of the four buttons on the ring was pressed: MENU on top, ⏭ right, ⏯ bottom, ⏮ left. */
export function zoneOf(angle: number): WheelZone {
  if (angle >= 225 && angle < 315) return "menu";
  if (angle >= 45 && angle < 135) return "play";
  if (angle >= 135 && angle < 225) return "previous";
  return "next";
}

/** Keeps a selection within a list of `count` items (no wrapping, as on the real thing). */
export const clampIndex = (index: number, count: number) => Math.max(0, Math.min(count - 1, index));
