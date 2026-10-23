// The listening history of the whole account, kept in userData/listening-history.jsonl and never sent
// anywhere: plays on this computer, plays on every other device (Spotify's "recently played", read
// every 15 minutes while Vitrine runs, even in the tray), and the history Spotify lets a person
// download. It can be exported as CSV, cleared, or turned off ("history" in config.json).
import { app, dialog, type BrowserWindow } from "electron";
import fs from "node:fs";
import path from "node:path";
import { iceberg, lastWeek, milestones, momentMix, quickPicks, topTracksSince, trackStats, type Milestone, type WeekRecap } from "../src/renderer/lib/insights";
import { summarize, type HistoryInfo, type ListeningSummary } from "../src/renderer/lib/listening";
import { readConfig, updateConfig } from "./config";
import { tr } from "./locale";
import { extendLine, fromRecentlyPlayed, fromStreamingHistory, newPlays, parsePlay, playLine, readPlays, toCsv, type Play, type PlaySource } from "./historyFile";
import { spotifyFetch } from "./spotifyPauses";
import { readZip } from "./zip";

const file = () => path.join(app.getPath("userData"), "listening-history.jsonl");
const SYNC_EVERY_MS = 15 * 60_000;

/** the file, read once and kept until it changes */
let cache: Play[] | null = null;

export function historyEnabled(): boolean {
  return readConfig().history?.enabled !== false;
}

export function setHistoryEnabled(enabled: boolean): boolean {
  updateConfig({ history: { ...readConfig().history, enabled } });
  return enabled;
}

/** Adds lines, on a line of their own even after a write a crash cut short. */
function append(lines: string): void {
  fs.mkdirSync(path.dirname(file()), { recursive: true });
  let cut = false;
  try {
    const handle = fs.openSync(file(), "r");
    const size = fs.fstatSync(handle).size;
    const last = Buffer.alloc(1);
    if (size > 0) fs.readSync(handle, last, 0, 1, size - 1);
    fs.closeSync(handle);
    cut = size > 0 && last.toString() !== "\n";
  } catch {
    // no file yet
  }
  fs.appendFileSync(file(), cut ? `\n${lines}` : lines);
  cache = null;
}

export function listPlays(): Play[] {
  if (cache) return cache;
  try {
    cache = readPlays(fs.readFileSync(file(), "utf8"));
  } catch {
    cache = [];
  }
  return cache;
}

/** Adds plays not known yet; returns how many were new. */
function addPlays(incoming: Play[]): number {
  const fresh = newPlays(listPlays(), incoming);
  if (fresh.length > 0) append(fresh.map(playLine).join(""));
  return fresh.length;
}

/** A play on this computer, sent by the page once it counts. */
export function addPlay(raw: unknown): void {
  const play = parsePlay(raw);
  if (!play || !historyEnabled()) return;
  addPlays([{ ...play, source: "vitrine" }]);
}

/** The milestones the play `at` crossed, not said before; remembered as said. */
export function newMilestones(at: string): Milestone[] {
  const plays = listPlays();
  const play = plays.find((item) => item.at === at);
  if (!play) return [];
  const told = new Set(readConfig().milestones ?? []);
  const found = milestones(plays, play, told);
  if (found.length) updateConfig({ milestones: [...told, ...found.map((m) => m.key)].slice(-500) });
  return found;
}

/** Last week's recap, once per week: null when already given (or nothing was played). */
export function weekToTell(): WeekRecap | null {
  const recap = lastWeek(listPlays());
  if (!recap || readConfig().weekTold === recap.week) return null;
  updateConfig({ weekTold: recap.week });
  return recap;
}

export function extendPlay(at: unknown, playedMs: unknown): void {
  if (typeof at !== "string" || typeof playedMs !== "number" || !historyEnabled()) return;
  if (!fs.existsSync(file())) return;
  append(extendLine(at, playedMs));
}

export function clearHistory(): void {
  fs.rmSync(file(), { force: true });
  cache = null;
  updateConfig({ history: { enabled: historyEnabled() } });
}

export type SourceFilter = "all" | PlaySource;

export function historySummary(raw: unknown): ListeningSummary {
  const input = (raw ?? {}) as { days?: unknown; source?: unknown; since?: unknown; until?: unknown };
  const days = typeof input.days === "number" && input.days > 0 ? input.days : 0;
  const source = (["vitrine", "spotify", "import"] as const).find((s) => s === input.source);
  const plays = source ? listPlays().filter((play) => (play.source ?? "vitrine") === source) : listPlays();
  // a calendar month or year (Rétro Vitrine), or the last `days` days
  if (typeof input.since === "number") {
    const until = typeof input.until === "number" ? input.until : Date.now();
    return summarize(plays, input.since, until);
  }
  return summarize(plays, days ? Date.now() - days * 86_400_000 : 0);
}

/** What the history says beyond the stats page, one question at a time (lib/insights.ts). */
export function historyInsight(kind: unknown): unknown {
  const plays = listPlays();
  switch (kind) {
    case "trackStats":
      return trackStats(plays);
    case "quickPicks":
      return quickPicks(plays, 30);
    case "moment":
      return momentMix(plays);
    case "iceberg":
      return iceberg(plays);
    case "week":
      return lastWeek(plays);
    case "monthTop":
      return topTracksSince(plays, Date.now() - 30 * 86_400_000, 50).filter((track) => track.plays >= 2);
    case "yearTop":
      return topTracksSince(plays, new Date(new Date().getFullYear(), 0, 1).getTime(), 100);
    default:
      return null;
  }
}

export function historyInfo(): HistoryInfo {
  const plays = listPlays();
  const bySource = { vitrine: 0, spotify: 0, import: 0 };
  for (const play of plays) bySource[play.source ?? "vitrine"] += 1;
  return { plays: plays.length, bySource, first: plays[0]?.at, lastSync: readConfig().history?.lastSync };
}

// ── every device of the account ───────────────────────────────────────────

/** Reads Spotify's "recently played" since the last time; returns how many plays were new. */
export async function syncAccount(accessToken: () => Promise<string>): Promise<number> {
  if (!historyEnabled()) return 0;
  const after = readConfig().history?.after;
  const query = after ? `limit=50&after=${after}` : "limit=50";
  const response = await spotifyFetch(`https://api.spotify.com/v1/me/player/recently-played?${query}`, {
    headers: { authorization: `Bearer ${await accessToken()}` },
  });
  if (!response.ok) throw new Error(`Spotify a répondu ${response.status}`);
  const body = (await response.json()) as { items?: unknown[]; cursors?: { after?: string } | null };
  const added = addPlays(fromRecentlyPlayed(body.items ?? []));
  const cursor = Number(body.cursors?.after);
  updateConfig({ history: { ...readConfig().history, enabled: historyEnabled(), lastSync: Date.now(), ...(cursor ? { after: cursor } : {}) } });
  return added;
}

let syncTimer: ReturnType<typeof setInterval> | null = null;

export function startAccountSync(accessToken: () => Promise<string>, loggedIn: () => Promise<boolean>): void {
  const run = () => void loggedIn().then((yes) => (yes ? syncAccount(accessToken) : 0)).catch(() => undefined);
  setTimeout(run, 8000);
  syncTimer ??= setInterval(run, SYNC_EVERY_MS);
}

// ── what Spotify lets a person download ───────────────────────────────────

const isHistoryFile = (name: string) => /Streaming_?History[^/]*\.json$/i.test(name) && !/video/i.test(name);

/** Reads the plays in the JSON files, or in Spotify's ZIP archive, the person picks. */
export async function importHistory(window: BrowserWindow | null): Promise<{ added: number; read: number; files: number } | null> {
  const options = {
    title: tr("Importer votre historique Spotify"),
    properties: ["openFile", "multiSelections"] as ("openFile" | "multiSelections")[],
    filters: [{ name: tr("Historique Spotify (ZIP ou JSON)"), extensions: ["zip", "json"] }],
  };
  const choice = window ? await dialog.showOpenDialog(window, options) : await dialog.showOpenDialog(options);
  if (choice.canceled || choice.filePaths.length === 0) return null;
  const texts: string[] = [];
  for (const picked of choice.filePaths) {
    if (picked.toLowerCase().endsWith(".zip")) {
      for (const entry of readZip(fs.readFileSync(picked), isHistoryFile)) texts.push(entry.data.toString("utf8"));
    } else {
      texts.push(fs.readFileSync(picked, "utf8"));
    }
  }
  if (texts.length === 0) throw new Error("Aucun fichier d'historique dans ce choix (attendu : Streaming_History_Audio_….json).");
  const plays = texts.flatMap((content) => {
    const parsed: unknown = JSON.parse(content);
    return Array.isArray(parsed) ? fromStreamingHistory(parsed) : [];
  });
  plays.sort((a, b) => a.at.localeCompare(b.at));
  return { added: addPlays(plays), read: plays.length, files: texts.length };
}

/** Asks where to save, then writes the CSV; false when the person cancelled. */
export async function exportHistory(window: BrowserWindow | null): Promise<boolean> {
  const options = {
    title: tr("Exporter l'historique d'écoute"),
    defaultPath: path.join(app.getPath("documents"), `vitrine-historique-${new Date().toISOString().slice(0, 10)}.csv`),
    filters: [{ name: "CSV", extensions: ["csv"] }],
  };
  const choice = window ? await dialog.showSaveDialog(window, options) : await dialog.showSaveDialog(options);
  if (choice.canceled || !choice.filePath) return false;
  fs.writeFileSync(choice.filePath, toCsv(listPlays()), "utf8");
  return true;
}
