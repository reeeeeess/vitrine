// Settings kept in userData/config.json. Every change is merged into what is there, so one part of
// the app saving its settings never wipes another's.
import { app } from "electron";
import fs from "node:fs";
import path from "node:path";

export interface DiscordSettings {
  enabled: boolean;
  appId: string;
}

export interface Config {
  clientId?: string;
  discord?: DiscordSettings;
}

const file = () => path.join(app.getPath("userData"), "config.json");
let cache: Config | null = null;

export function readConfig(): Config {
  if (cache) return cache;
  try {
    const parsed: unknown = JSON.parse(fs.readFileSync(file(), "utf8"));
    cache = parsed && typeof parsed === "object" ? (parsed as Config) : {};
  } catch {
    cache = {};
  }
  return cache;
}

export function updateConfig(patch: Partial<Config>): Config {
  cache = { ...readConfig(), ...patch };
  fs.mkdirSync(path.dirname(file()), { recursive: true });
  fs.writeFileSync(file(), JSON.stringify(cache, null, 2));
  return cache;
}
