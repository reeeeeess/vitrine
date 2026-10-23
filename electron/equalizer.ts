// The equalizer, applied where Spotify allows it: at the sound output of Windows, by Equalizer APO (free,
// open source). Vitrine writes its bands to a small file in Equalizer APO's format, in a folder the
// Windows audio service can read, and adds one Include line to Equalizer APO's configuration (or gives
// it to copy when Windows refuses the write: that folder is under Program Files). Equalizer APO reloads
// the file by itself on every change. The music itself is never touched by Vitrine.
import fs from "node:fs";
import path from "node:path";

import { BANDS, MAX_GAIN, PRESETS } from "../src/renderer/lib/eqPresets";

export { BANDS, MAX_GAIN, PRESETS };

export interface EqualizerSettings {
  enabled: boolean;
  preset: string;
  gains: number[];
}

export const DEFAULT_EQUALIZER: EqualizerSettings = { enabled: false, preset: "Plat", gains: PRESETS.Plat };

/** What the page sent, as safe settings: ten gains within ±12 dB. */
export function cleanEqualizer(value: unknown): EqualizerSettings {
  const input = (value ?? {}) as Partial<EqualizerSettings>;
  const gains = BANDS.map((_, i) => {
    const gain = Number(Array.isArray(input.gains) ? input.gains[i] : 0);
    return Number.isFinite(gain) ? Math.max(-MAX_GAIN, Math.min(MAX_GAIN, Math.round(gain * 2) / 2)) : 0;
  });
  return { enabled: input.enabled === true, preset: typeof input.preset === "string" ? input.preset.slice(0, 40) : "Perso", gains };
}

/**
 * The file Equalizer APO reads: a negative preamp as big as the highest boost (so nothing clips), then
 * the ten bands. Off, or flat, it holds nothing but a comment: the sound passes untouched.
 */
export function equalizerConfig(settings: EqualizerSettings): string {
  const header = "# Vitrine : ce fichier est écrit par l'égaliseur de Vitrine. Ne pas modifier à la main.\n";
  if (!settings.enabled || settings.gains.every((gain) => gain === 0)) return `${header}# égaliseur désactivé\n`;
  const preamp = Math.max(0, ...settings.gains);
  return `${header}Preamp: ${preamp ? `-${preamp}` : "0"} dB\nGraphicEQ: ${BANDS.map((band, i) => `${band} ${settings.gains[i]}`).join("; ")}\n`;
}

export interface EqualizerPaths {
  /** Equalizer APO's own configuration, which must include ours */
  config: string;
  /** ours */
  file: string;
  editor: string;
}

/** Where things are on this Windows: Equalizer APO under Program Files, our file in Public Documents. */
export function equalizerPaths(env: NodeJS.ProcessEnv = process.env): EqualizerPaths {
  const programFiles = env.ProgramW6432 || env.ProgramFiles || "C:\\Program Files";
  const apo = path.win32.join(programFiles, "EqualizerAPO");
  const publicDir = env.PUBLIC || "C:\\Users\\Public";
  return {
    config: path.win32.join(apo, "config", "config.txt"),
    // the audio service (LOCAL SERVICE) cannot read a user's AppData; the public folder it can
    file: path.win32.join(publicDir, "Documents", "Vitrine", "egaliseur.txt"),
    editor: path.win32.join(apo, "Editor.exe"),
  };
}

export const includeLine = (file: string) => `Include: ${file}`;

/** Whether Equalizer APO's configuration already includes our file (once is enough, whatever the case). */
export function hasInclude(configText: string, file: string): boolean {
  const wanted = file.toLowerCase();
  return configText.split(/\r?\n/).some((line) => /^\s*include\s*:/i.test(line) && line.replace(/^\s*include\s*:\s*/i, "").trim().toLowerCase() === wanted);
}

export type EqualizerState = "unsupported" | "absent" | "needs-include" | "ready";

export interface EqualizerStatus {
  state: EqualizerState;
  settings: EqualizerSettings;
  /** the line to add by hand to Equalizer APO's configuration, when Windows refused the write */
  includeLine?: string;
  configPath?: string;
}

/** Writes our file and makes sure Equalizer APO reads it; says how things stand. */
export function applyEqualizer(settings: EqualizerSettings, platform = process.platform, paths = equalizerPaths(), files: Pick<typeof fs, "existsSync" | "readFileSync" | "writeFileSync" | "appendFileSync" | "mkdirSync"> = fs): EqualizerStatus {
  if (platform !== "win32") return { state: "unsupported", settings };
  if (!files.existsSync(paths.config)) return { state: "absent", settings };
  try {
    files.mkdirSync(path.win32.dirname(paths.file), { recursive: true });
    files.writeFileSync(paths.file, equalizerConfig(settings), "utf8");
  } catch {
    return { state: "needs-include", settings, includeLine: includeLine(paths.file), configPath: paths.config };
  }
  let config = "";
  try {
    config = String(files.readFileSync(paths.config, "utf8"));
  } catch {
    // unreadable: try to add the line all the same
  }
  if (hasInclude(config, paths.file)) return { state: "ready", settings };
  try {
    files.appendFileSync(paths.config, `${config.endsWith("\n") || !config ? "" : "\r\n"}${includeLine(paths.file)}\r\n`, "utf8");
    return { state: "ready", settings };
  } catch {
    // Program Files wants an administrator: the person adds the line once, in Equalizer APO's editor
    return { state: "needs-include", settings, includeLine: includeLine(paths.file), configPath: paths.config };
  }
}
