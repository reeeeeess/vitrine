// The equalizer, applied where Spotify allows it: at the sound output of Windows, by Equalizer APO (free,
// open source). Vitrine writes its bands to a small file in Equalizer APO's format, in a folder the
// Windows audio service can read, and adds one Include line to Equalizer APO's configuration (or gives
// it to copy when Windows refuses the write: that folder is under Program Files). Equalizer APO reloads
// the file by itself on every change. The music itself is never touched by Vitrine.
import { execFile } from "node:child_process";
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
  // plain ASCII: Equalizer APO reads the file in the system's code page, not always in UTF-8
  const header = "# Vitrine: written by Vitrine's equalizer, do not edit by hand.\n";
  if (!settings.enabled || settings.gains.every((gain) => gain === 0)) return `${header}# equalizer off\n`;
  const preamp = Math.max(0, ...settings.gains);
  return `${header}Preamp: ${preamp ? `-${preamp}` : "0"} dB\nGraphicEQ: ${BANDS.map((band, i) => `${band} ${settings.gains[i]}`).join("; ")}\n`;
}

export interface EqualizerPaths {
  /** Equalizer APO's own configuration, which must include ours */
  config: string;
  /** ours */
  file: string;
  editor: string;
  /** where Equalizer APO is put on a sound output (it does nothing on the others) */
  configurator: string;
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
    configurator: path.win32.join(apo, "Configurator.exe"),
  };
}

export const includeLine = (file: string) => `Include: ${file}`;

/** Whether Equalizer APO's configuration already includes our file (once is enough, whatever the case). */
export function hasInclude(configText: string, file: string): boolean {
  const wanted = file.toLowerCase();
  return configText.split(/\r?\n/).some((line) => /^\s*include\s*:/i.test(line) && line.replace(/^\s*include\s*:\s*/i, "").trim().toLowerCase() === wanted);
}

/** Equalizer APO's audio processing object, as Windows lists it on each sound output it is put on */
const APO_CLSID = "{EACD2258-FCAC-4FF4-B36D-419E924A6D79}";
const RENDER = "HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\MMDevices\\Audio\\Render";

/**
 * The sound outputs Equalizer APO is on, by name ("Haut-parleurs (Realtek(R) Audio)"), from `reg query` of
 * Windows' audio devices: a device's FxProperties name the processing objects, its Properties its names, its
 * DeviceState 1 means plugged in and on.
 */
export function apoOutputs(regText: string): { name: string; active: boolean }[] {
  const devices = new Map<string, { active: boolean; apo: boolean; description: string; device: string }>();
  let current: { active: boolean; apo: boolean; description: string; device: string } | null = null;
  let section = "";
  for (const raw of regText.split(/\r?\n/)) {
    const line = raw.trimEnd();
    const key = line.match(/\\Render\\(\{[^\\]+\}\.\{[^\\]+\})(?:\\(.+))?$/i);
    if (line.startsWith("HKEY_") && key) {
      const id = key[1].toLowerCase();
      current = devices.get(id) ?? { active: false, apo: false, description: "", device: "" };
      devices.set(id, current);
      section = (key[2] ?? "").toLowerCase();
      continue;
    }
    if (line.startsWith("HKEY_")) {
      current = null;
      continue;
    }
    if (!current) continue;
    const value = line.match(/^\s+(\S+)\s+REG_\w+\s*(.*)$/);
    if (!value) continue;
    const [, name, data] = value;
    if (section === "" && /^DeviceState$/i.test(name)) current.active = /^0x0*1$/i.test(data.trim());
    if (section.startsWith("fxproperties") && data.toUpperCase().includes(APO_CLSID)) current.apo = true;
    if (section === "properties" && name.toLowerCase() === "{a45c254e-df1c-4efd-8020-67d146a850e0},2") current.description = data.trim();
    if (section === "properties" && name.toLowerCase() === "{b3f8fa53-0004-438e-9003-51a46e139bfc},6") current.device = data.trim();
  }
  return [...devices.values()]
    .filter((device) => device.apo)
    .map((device) => ({ name: device.device ? `${device.description || "Sortie"} (${device.device})` : device.description || "Sortie son", active: device.active }));
}

let outputsCache: { at: number; value: Promise<string[] | null> } | null = null;

/** The plugged-in outputs Equalizer APO is on; null when Windows does not say (kept 20 s). */
export function readApoOutputs(): Promise<string[] | null> {
  if (process.platform !== "win32") return Promise.resolve(null);
  if (outputsCache && Date.now() - outputsCache.at < 20_000) return outputsCache.value;
  const value = new Promise<string[] | null>((resolve) => {
    execFile("reg", ["query", RENDER, "/s"], { encoding: "latin1", maxBuffer: 16 * 1024 * 1024, windowsHide: true, timeout: 8000 }, (error, stdout) => {
      if (error && !stdout) return resolve(null);
      resolve(apoOutputs(String(stdout)).filter((output) => output.active).map((output) => output.name));
    });
  });
  outputsCache = { at: Date.now(), value };
  return value;
}

export type EqualizerState = "unsupported" | "absent" | "needs-include" | "no-output" | "ready";

export interface EqualizerStatus {
  state: EqualizerState;
  settings: EqualizerSettings;
  /** the outputs Equalizer APO is on (the sound of the others is not touched) */
  outputs?: string[];
  /** the line to add by hand to Equalizer APO's configuration, when Windows refused the write */
  includeLine?: string;
  configPath?: string;
}

/**
 * Writes our file and makes sure Equalizer APO reads it; says how things stand. `outputs`: the sound outputs
 * Equalizer APO is on (null when unknown): none, and nothing can be heard whatever the settings.
 */
export function applyEqualizer(
  settings: EqualizerSettings,
  platform = process.platform,
  paths = equalizerPaths(),
  files: Pick<typeof fs, "existsSync" | "readFileSync" | "writeFileSync" | "appendFileSync" | "mkdirSync"> = fs,
  outputs: string[] | null = null,
): EqualizerStatus {
  const status = applyFiles(settings, platform, paths, files);
  if (outputs === null || status.state === "unsupported" || status.state === "absent") return status;
  if (outputs.length === 0) return { ...status, state: status.state === "ready" ? "no-output" : status.state, outputs };
  return { ...status, outputs };
}

function applyFiles(settings: EqualizerSettings, platform: NodeJS.Platform, paths: EqualizerPaths, files: Pick<typeof fs, "existsSync" | "readFileSync" | "writeFileSync" | "appendFileSync" | "mkdirSync">): EqualizerStatus {
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
