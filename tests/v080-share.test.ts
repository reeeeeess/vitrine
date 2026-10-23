import { describe, expect, it } from "vitest";
import { auraOf, festivalDays, receiptLines } from "../src/renderer/lib/cards";
import { favouriteHour, favouriteWeekday, periodRange, recordDay } from "../src/renderer/lib/retro";
import { forgottenGems, neverPlayed } from "../src/renderer/lib/smart";
import { topTracksSince } from "../src/renderer/lib/insights";

describe("the receipt (T1)", () => {
  it("lists ten tracks at most, numbered, with their durations and the total", () => {
    const tracks = Array.from({ length: 12 }, (_, i) => ({ name: `titre ${i}`, artists: ["Artiste"], durationMs: 200_000 + i * 1000 }));
    const { lines, totalMs } = receiptLines(tracks);
    expect(lines).toHaveLength(10);
    expect(lines[0]).toEqual({ n: "01", title: "TITRE 0", artist: "ARTISTE", time: "3:20" });
    expect(totalMs).toBe(2_045_000);
  });
});

describe("the festival poster (T2)", () => {
  it("gives each day a headliner, then shares the others out in turn", () => {
    const days = festivalDays(["A", "B", "C", "D", "E", "F", "G", "A"]);
    expect(days.map((day) => day.headliner)).toEqual(["A", "B", "C"]);
    expect(days.map((day) => day.others)).toEqual([["D", "G"], ["E"], ["F"]]);
    expect(days[0].day).toBe("VENDREDI");
  });
});

describe("the musical aura (T4)", () => {
  it("names the hue the artworks lean to", () => {
    expect(auraOf([[220, 30, 40], [200, 20, 30], [240, 60, 50]]).name).toBe("Passion rouge");
    expect(auraOf([[20, 40, 220], [40, 60, 200], [30, 30, 180]]).name).toBe("Nuit électrique");
    expect(auraOf([[120, 120, 120], [130, 130, 130], [90, 90, 90]]).name).toBe("Brume nocturne");
    expect(auraOf([]).name).toBe("Brume");
  });

  it("keeps five colours at most, ordered by hue", () => {
    const colors = Array.from({ length: 20 }, (_, i) => [((i * 53) % 255) as number, 40, 200 - i * 5] as [number, number, number]);
    expect(auraOf(colors).stops.length).toBeLessThanOrEqual(5);
  });
});

describe("Rétro Vitrine (I2)", () => {
  const now = new Date(2026, 9, 23, 15).getTime();

  it("knows this month, last month and the year", () => {
    expect(periodRange("month", now)).toMatchObject({ since: new Date(2026, 9, 1).getTime(), until: now, label: "octobre 2026" });
    const last = periodRange("lastMonth", now);
    expect(last.label).toBe("septembre 2026");
    expect(last.until).toBe(new Date(2026, 9, 1).getTime() - 1);
    expect(periodRange("year", now)).toMatchObject({ since: new Date(2026, 0, 1).getTime(), label: "2026" });
  });

  it("finds the favourite hour and weekday, and the record day within the period", () => {
    const heatmap = Array.from({ length: 7 }, () => Array<number>(24).fill(0));
    heatmap[4][22] = 5000; // Friday 22 h
    heatmap[1][8] = 3000;
    expect(favouriteHour(heatmap)).toBe(22);
    expect(favouriteWeekday(heatmap)).toBe("vendredi");
    expect(favouriteHour(Array.from({ length: 7 }, () => Array<number>(24).fill(0)))).toBeNull();
    const calendar = [
      { day: "2026-09-30", ms: 9_000_000 },
      { day: "2026-10-05", ms: 3_000_000 },
      { day: "2026-10-12", ms: 7_000_000 },
    ];
    expect(recordDay(calendar, new Date(2026, 9, 1).getTime(), now)).toEqual({ day: "2026-10-12", ms: 7_000_000 });
  });
});

describe("smart playlists (I4, I5)", () => {
  const now = new Date(2026, 9, 23).getTime();
  const daysAgo = (days: number) => new Date(now - days * 86_400_000).toISOString();
  const liked = ["a", "b", "c", "d"].map((uri) => ({ uri }));

  it("finds forgotten gems: played several times, not for months", () => {
    const stats = { a: { plays: 9, last: daysAgo(200) }, b: { plays: 1, last: daysAgo(300) }, c: { plays: 4, last: daysAgo(5) }, d: { plays: 3, last: daysAgo(120) } };
    // fewer than ten at six months: three months is enough
    expect(forgottenGems(liked, stats, now)).toEqual(["a", "d"]);
  });

  it("finds the liked songs never heard", () => {
    expect(neverPlayed(liked, { a: { plays: 1, last: daysAgo(1) } })).toEqual(["b", "c", "d"]);
  });

  it("ranks the tracks of a period by plays", () => {
    const play = (uri: string, days: number) => ({ at: daysAgo(days), id: uri, uri, name: uri, artists: [], artistIds: [], album: "", durationMs: 1, playedMs: 60_000 });
    const top = topTracksSince([play("x", 1), play("x", 2), play("y", 3), play("z", 60)], now - 30 * 86_400_000, 10);
    expect(top).toEqual([
      { uri: "x", name: "x", plays: 2 },
      { uri: "y", name: "y", plays: 1 },
    ]);
  });
});
