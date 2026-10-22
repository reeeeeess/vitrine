// The listening history's file, without Electron: one JSON object per line. A play is written once
// it counts (30 seconds, or half a shorter track); how long it went on is added later as a line of
// its own, so the file is only ever appended to.

export interface Play {
  /** when the play started, ISO 8601: also the play's identity */
  at: string;
  id: string;
  uri: string;
  name: string;
  artists: string[];
  artistIds: string[];
  album: string;
  albumId?: string;
  image?: string;
  durationMs: number;
  playedMs: number;
}

const text = (value: unknown, max = 300) => (typeof value === "string" ? value.slice(0, max) : "");
const texts = (value: unknown) => (Array.isArray(value) ? value.map((item) => text(item, 200)).filter(Boolean).slice(0, 20) : []);
const count = (value: unknown) => (typeof value === "number" && Number.isFinite(value) && value >= 0 ? Math.round(value) : 0);

/** A play as the page sent it, field by field, or null when it is not one. */
export function parsePlay(raw: unknown): Play | null {
  if (!raw || typeof raw !== "object") return null;
  const input = raw as Record<string, unknown>;
  const at = text(input.at, 40);
  if (!at || Number.isNaN(Date.parse(at)) || !text(input.uri) || !text(input.name)) return null;
  return {
    at,
    id: text(input.id, 100),
    uri: text(input.uri),
    name: text(input.name),
    artists: texts(input.artists),
    artistIds: texts(input.artistIds),
    album: text(input.album),
    albumId: text(input.albumId, 100) || undefined,
    image: text(input.image).startsWith("https://") ? text(input.image) : undefined,
    durationMs: count(input.durationMs),
    playedMs: count(input.playedMs),
  };
}

/** The plays in the file, oldest first, each with the longest duration recorded for it. */
export function readPlays(content: string): Play[] {
  const plays = new Map<string, Play>();
  for (const line of content.split("\n")) {
    if (!line.trim()) continue;
    let raw: unknown;
    try {
      raw = JSON.parse(line);
    } catch {
      continue; // a line cut short by a crash
    }
    const extension = raw as { extend?: unknown; at?: unknown; playedMs?: unknown };
    if (extension?.extend === true) {
      const play = plays.get(text(extension.at, 40));
      if (play) play.playedMs = Math.max(play.playedMs, count(extension.playedMs));
      continue;
    }
    const play = parsePlay(raw);
    if (play) plays.set(play.at, play);
  }
  return [...plays.values()].sort((a, b) => a.at.localeCompare(b.at));
}

export const playLine = (play: Play) => `${JSON.stringify(play)}\n`;
export const extendLine = (at: string, playedMs: number) => `${JSON.stringify({ extend: true, at, playedMs: count(playedMs) })}\n`;

/** For a spreadsheet: one play per row, ";"-separated as French Excel expects, with a BOM for the accents. */
export function toCsv(plays: Play[]): string {
  const cell = (value: string | number) => {
    const raw = String(value);
    // a cell starting with = + - @ would run as a formula in a spreadsheet
    const safe = /^[=+\-@]/.test(raw) ? `'${raw}` : raw;
    return /[";\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };
  const rows = [
    ["date", "titre", "artistes", "album", "duree_s", "ecoute_s", "uri"],
    ...plays.map((play) => [play.at, play.name, play.artists.join(", "), play.album, Math.round(play.durationMs / 1000), Math.round(play.playedMs / 1000), play.uri]),
  ];
  return `﻿${rows.map((row) => row.map(cell).join(";")).join("\r\n")}\r\n`;
}
