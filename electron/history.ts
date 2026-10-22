// The listening history of this computer, kept in userData/listening-history.jsonl and never sent
// anywhere. It can be exported as CSV, cleared, or turned off ("history" in config.json).
import { app, dialog, type BrowserWindow } from "electron";
import fs from "node:fs";
import path from "node:path";
import { readConfig, updateConfig } from "./config";
import { extendLine, parsePlay, playLine, readPlays, toCsv, type Play } from "./historyFile";

const file = () => path.join(app.getPath("userData"), "listening-history.jsonl");

export function historyEnabled(): boolean {
  return readConfig().history?.enabled !== false;
}

export function setHistoryEnabled(enabled: boolean): boolean {
  updateConfig({ history: { enabled } });
  return enabled;
}

/** Adds a line, on a line of its own even after a write a crash cut short. */
function append(line: string): void {
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
  fs.appendFileSync(file(), cut ? `\n${line}` : line);
}

export function addPlay(raw: unknown): void {
  const play = parsePlay(raw);
  if (!play || !historyEnabled()) return;
  append(playLine(play));
}

export function extendPlay(at: unknown, playedMs: unknown): void {
  if (typeof at !== "string" || typeof playedMs !== "number" || !historyEnabled()) return;
  if (!fs.existsSync(file())) return;
  append(extendLine(at, playedMs));
}

export function listPlays(): Play[] {
  try {
    return readPlays(fs.readFileSync(file(), "utf8"));
  } catch {
    return [];
  }
}

export function clearHistory(): void {
  fs.rmSync(file(), { force: true });
}

/** Asks where to save, then writes the CSV; false when the person cancelled. */
export async function exportHistory(window: BrowserWindow | null): Promise<boolean> {
  const options = {
    title: "Exporter l'historique d'écoute",
    defaultPath: path.join(app.getPath("documents"), `vitrine-historique-${new Date().toISOString().slice(0, 10)}.csv`),
    filters: [{ name: "CSV", extensions: ["csv"] }],
  };
  const choice = window ? await dialog.showSaveDialog(window, options) : await dialog.showSaveDialog(options);
  if (choice.canceled || !choice.filePath) return false;
  fs.writeFileSync(choice.filePath, toCsv(listPlays()), "utf8");
  return true;
}
