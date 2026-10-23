// The words the main process shows itself (the tray's menu, the taskbar's buttons, the file dialogs, the
// notifications, the login page), in the language chosen in Vitrine: the same dictionary as the page.
import { app } from "electron";
import { toEnglish } from "../src/renderer/i18n/translate";
import { readConfig, updateConfig } from "./config";

export type LanguageSetting = "auto" | "fr" | "en";

export function language(): "fr" | "en" {
  const setting = readConfig().language ?? "auto";
  return setting === "auto" ? ((app.getLocale?.() ?? "fr").toLowerCase().startsWith("fr") ? "fr" : "en") : setting;
}

export function setLanguage(raw: unknown): LanguageSetting {
  const setting: LanguageSetting = raw === "fr" || raw === "en" ? raw : "auto";
  updateConfig({ language: setting });
  return setting;
}

/** A French text of Vitrine in the chosen language. */
export const tr = (text: string): string => (language() === "en" ? toEnglish(text) : text);
