// Error reports, on consent (v1.0): the errors of the page and of the main process are kept on this
// computer (userData/errors.json), scrubbed of anything personal; nothing leaves it until the person copies
// the report or opens a ticket with it from the Settings.
import { app, clipboard, shell } from "electron";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { addEntry, cleanEntry, issueUrl, reportText, type ErrorEntry } from "./errorReportText";
import { language } from "./locale";

const REPOSITORY = "https://github.com/reeeeeess/vitrine";
const file = () => path.join(app.getPath("userData"), "errors.json");
let entries: ErrorEntry[] | null = null;

function load(): ErrorEntry[] {
  if (entries) return entries;
  try {
    const parsed: unknown = JSON.parse(fs.readFileSync(file(), "utf8"));
    entries = Array.isArray(parsed) ? (parsed as ErrorEntry[]) : [];
  } catch {
    entries = [];
  }
  return entries;
}

function save(): void {
  try {
    fs.writeFileSync(file(), JSON.stringify(entries ?? []));
  } catch {
    // kept for this session only
  }
}

export function recordError(raw: unknown, source: ErrorEntry["source"]): void {
  const entry = cleanEntry(raw, source);
  if (!entry) return;
  entries = addEntry(load(), entry);
  save();
}

export function errorInfo(): { count: number; last?: string } {
  const list = load();
  return { count: list.length, last: list.at(-1)?.at };
}

function report(): string {
  return reportText(load(), { version: app.getVersion(), platform: process.platform, osRelease: os.release(), electron: process.versions.electron, language: language() });
}

export function copyReport(): void {
  clipboard.writeText(report());
}

/** Copies the whole report, and opens a new GitHub ticket with it (cut if very long). */
export async function openTicket(): Promise<void> {
  const text = report();
  clipboard.writeText(text);
  await shell.openExternal(issueUrl(REPOSITORY, text));
}

export function clearErrors(): void {
  entries = [];
  save();
}

/** The main process's own errors, and the page's crashes, go to the report too. */
export function watchMainErrors(): void {
  process.on("uncaughtException", (error) => {
    recordError(error, "main");
    console.error(error);
  });
  process.on("unhandledRejection", (reason) => recordError(reason instanceof Error ? reason : { message: String(reason) }, "main"));
  app.on("render-process-gone", (_event, _contents, details) => recordError({ message: `La page s'est arrêtée (${details.reason}, code ${details.exitCode}).` }, "crash"));
  app.on("child-process-gone", (_event, details) => {
    if (details.reason !== "clean-exit") recordError({ message: `Processus ${details.type} arrêté (${details.reason}).` }, "crash");
  });
}
