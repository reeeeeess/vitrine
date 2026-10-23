// The error report's rules, free of Electron for the tests: what an error keeps (never a token, a key or
// the person's name in a path), and the report as the person copies it or sends it as a ticket.

export interface ErrorEntry {
  at: string;
  /** where it happened: the page, the main process, a crash */
  source: "page" | "main" | "crash";
  message: string;
  stack?: string;
}

/** errors kept, the most recent ones */
export const ERRORS_MAX = 50;
const MESSAGE_MAX = 600;
const STACK_MAX = 2000;

/** Takes out what must not leave the computer: tokens, keys, the user's folder name. */
export function scrub(text: string): string {
  return text
    .replace(/Bearer\s+[\w.~+/=-]+/gi, "Bearer …")
    .replace(/\b(access_token|refresh_token|code|api_key|sk|token|secret|auth_key)=[^&\s"']+/gi, "$1=…")
    .replace(/\b[0-9a-f]{32,}\b/gi, "…")
    .replace(/([A-Za-z]:\\Users\\|\/Users\/|\/home\/)[^\\/\s"']+/g, "$1…");
}

/** An error as kept: scrubbed and cut to size; null when there is nothing to keep. */
export function cleanEntry(raw: unknown, source: ErrorEntry["source"], now = new Date()): ErrorEntry | null {
  const input = (raw ?? {}) as { message?: unknown; stack?: unknown };
  const message = typeof input.message === "string" ? scrub(input.message).trim().slice(0, MESSAGE_MAX) : "";
  if (!message) return null;
  const stack = typeof input.stack === "string" ? scrub(input.stack).slice(0, STACK_MAX) : undefined;
  return { at: now.toISOString(), source, message, ...(stack ? { stack } : {}) };
}

/** Adds an error to the list: the same message again only moves to the top, the oldest go past the limit. */
export function addEntry(list: ErrorEntry[], entry: ErrorEntry): ErrorEntry[] {
  return [...list.filter((known) => known.message !== entry.message), entry].slice(-ERRORS_MAX);
}

export interface ReportContext {
  version: string;
  platform: string;
  osRelease: string;
  electron: string;
  language: string;
}

/** The report, in Markdown (it reads as is in a GitHub ticket): the context, then the errors, newest first. */
export function reportText(entries: ErrorEntry[], context: ReportContext): string {
  const lines = [
    `**Vitrine ${context.version}** · ${context.platform} ${context.osRelease} · Electron ${context.electron} · ${context.language}`,
    "",
    entries.length ? `${entries.length} erreur(s), la plus récente d'abord :` : "Aucune erreur gardée.",
  ];
  for (const entry of [...entries].reverse()) {
    lines.push("", `- \`${entry.at}\` (${entry.source}) ${entry.message}`);
    if (entry.stack) lines.push("", "```", entry.stack, "```");
  }
  return lines.join("\n");
}

/** A new GitHub ticket with the report, cut so the address stays under what browsers accept. */
export function issueUrl(repository: string, report: string, max = 6000): string {
  const body = report.length > max ? `${report.slice(0, max)}\n\n… (rapport coupé : le reste est copié dans le presse-papiers)` : report;
  const params = new URLSearchParams({ title: "Rapport d'erreur Vitrine", body });
  return `${repository}/issues/new?${params.toString()}`;
}
