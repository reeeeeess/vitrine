// Rétro Vitrine (Wrapped, Replay): a month or a year of listening, told in slides. The numbers come from
// the history on this computer (lib/listening.ts); here, the periods and the facts worth a slide.
import { LOCALE } from "./i18n";

export type RetroPeriod = "month" | "lastMonth" | "year";

/** The period's bounds (epoch ms) and its name: "octobre 2026", "2026". */
export function periodRange(period: RetroPeriod, now = Date.now()): { since: number; until: number; label: string } {
  const date = new Date(now);
  if (period === "year") return { since: new Date(date.getFullYear(), 0, 1).getTime(), until: now, label: String(date.getFullYear()) };
  const month = period === "month" ? date.getMonth() : date.getMonth() - 1;
  const start = new Date(date.getFullYear(), month, 1);
  const end = period === "month" ? now : new Date(date.getFullYear(), month + 1, 1).getTime() - 1;
  return { since: start.getTime(), until: end, label: start.toLocaleDateString(LOCALE, { month: "long", year: "numeric" }) };
}

const WEEKDAYS = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"];

/** The hour of the day most listened to, from the weekday × hour grid (Monday first). */
export function favouriteHour(heatmap: number[][]): number | null {
  const byHour = Array.from({ length: 24 }, (_, hour) => heatmap.reduce((sum, day) => sum + (day[hour] ?? 0), 0));
  const best = Math.max(...byHour);
  return best > 0 ? byHour.indexOf(best) : null;
}

/** The day of the week most listened to: "vendredi". */
export function favouriteWeekday(heatmap: number[][]): string | null {
  const byDay = heatmap.map((day) => day.reduce((sum, ms) => sum + ms, 0));
  const best = Math.max(...byDay);
  return best > 0 ? WEEKDAYS[byDay.indexOf(best)] : null;
}

/** The day with the most listening within the period: { day: "2026-10-12", ms }. */
export function recordDay(calendar: { day: string; ms: number }[], since: number, until: number): { day: string; ms: number } | null {
  const key = (time: number) => {
    const d = new Date(time);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };
  const [from, to] = [key(since), key(until)];
  const days = calendar.filter((entry) => entry.day >= from && entry.day <= to && entry.ms > 0);
  return days.length ? days.reduce((best, entry) => (entry.ms > best.ms ? entry : best)) : null;
}
