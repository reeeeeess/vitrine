import { describe, expect, it, vi } from "vitest";
import { cleanAccelerator, globalShortcuts } from "../electron/cli";
import { addEntry, cleanEntry, ERRORS_MAX, issueUrl, reportText, scrub, type ErrorEntry } from "../electron/errorReportText";
import { assignKeys, comboOf, fromAccelerator, keysLabel, SHORTCUT_ACTIONS, toAccelerator, type ShortcutAction } from "../src/renderer/lib/shortcuts";

vi.mock("electron", () => ({ app: {} }));

const press = (key: string, mods: Partial<Record<"ctrlKey" | "metaKey" | "altKey" | "shiftKey", boolean>> = {}) => ({ key, ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, ...mods });

describe("v1.0 : raccourcis personnalisables", () => {
  it("écrit une touche pressée comme le reste de Vitrine", () => {
    expect(comboOf(press(" "))).toBe("Space");
    expect(comboOf(press("k", { ctrlKey: true }))).toBe("Ctrl+K");
    expect(comboOf(press("k", { metaKey: true }))).toBe("Ctrl+K");
    expect(comboOf(press("S", { ctrlKey: true, shiftKey: true }))).toBe("Ctrl+Shift+S");
    expect(comboOf(press("ArrowRight", { ctrlKey: true }))).toBe("Ctrl+ArrowRight");
    // "?" needs Shift on most keyboards: the sign alone
    expect(comboOf(press("?", { shiftKey: true }))).toBe("?");
    expect(comboOf(press("Control", { ctrlKey: true }))).toBeNull();
  });

  it("montre les touches lisiblement, ⌘ sur Mac", () => {
    expect(keysLabel("Ctrl+ArrowRight", false)).toBe("Ctrl+→");
    expect(keysLabel("Space", false)).toBe("Espace");
    expect(keysLabel("Ctrl+K", true)).toBe("⌘+K");
  });

  it("deux actions ne partagent jamais les mêmes touches : elles échangent", () => {
    const keys = Object.fromEntries(SHORTCUT_ACTIONS.map((action) => [action.id, action.keys])) as Record<ShortcutAction, string>;
    const next = assignKeys(keys, "search", "Ctrl+M");
    expect(next.search).toBe("Ctrl+M");
    expect(next.moment).toBe("Ctrl+K");
    expect(new Set(Object.values(next)).size).toBe(SHORTCUT_ACTIONS.length);
  });

  it("chaque action a ses touches, toutes différentes", () => {
    expect(new Set(SHORTCUT_ACTIONS.map((action) => action.keys)).size).toBe(SHORTCUT_ACTIONS.length);
  });

  it("raccourcis globaux : Ctrl ou Alt obligatoire, le reste refusé", () => {
    expect(cleanAccelerator("CommandOrControl+Alt+P")).toBe("CommandOrControl+Alt+P");
    expect(cleanAccelerator("Shift+Alt+Right")).toBe("Alt+Shift+Right");
    expect(cleanAccelerator("Shift+P")).toBeNull();
    expect(cleanAccelerator("P")).toBeNull();
    expect(cleanAccelerator("CommandOrControl+Alt+Super")).toBeNull();
    expect(cleanAccelerator("Meta+P")).toBeNull();
    expect(cleanAccelerator(42)).toBeNull();
    expect(toAccelerator("Ctrl+Alt+ArrowRight")).toBe("CommandOrControl+Alt+Right");
    expect(fromAccelerator("CommandOrControl+Alt+Right")).toBe("Ctrl+Alt+ArrowRight");
  });

  it("les touches choisies remplacent celles d'origine, une par une", () => {
    const list = globalShortcuts({ toggle: "CommandOrControl+Shift+Space", next: "nimporte quoi" });
    expect(list.find((shortcut) => shortcut.command === "toggle")?.accelerator).toBe("CommandOrControl+Shift+Space");
    expect(list.find((shortcut) => shortcut.command === "next")?.accelerator).toBe("CommandOrControl+Alt+Right");
  });
});

describe("v1.0 : rapport d'erreur sur consentement", () => {
  it("rien de personnel ne reste : jetons, clés, nom d'utilisateur", () => {
    expect(scrub("fetch failed: Authorization Bearer BQD3x.y-z_")).toBe("fetch failed: Authorization Bearer …");
    expect(scrub("https://x.test/?access_token=abc123&ok=1")).toBe("https://x.test/?access_token=…&ok=1");
    expect(scrub("client 0123456789abcdef0123456789abcdef refusé")).toBe("client … refusé");
    expect(scrub("at C:\\Users\\Amine\\AppData\\Local\\Vitrine")).toBe("at C:\\Users\\…\\AppData\\Local\\Vitrine");
    expect(scrub("at /home/amine/vitrine/main.js")).toBe("at /home/…/vitrine/main.js");
  });

  it("une erreur gardée : nettoyée, coupée, datée", () => {
    const entry = cleanEntry({ message: "boom", stack: "Error: boom\n at /Users/sam/app.js:1" }, "page", new Date("2026-10-23T10:00:00Z"));
    expect(entry).toEqual({ at: "2026-10-23T10:00:00.000Z", source: "page", message: "boom", stack: "Error: boom\n at /Users/…/app.js:1" });
    expect(cleanEntry({ message: "" }, "page")).toBeNull();
    expect(cleanEntry("pas un objet", "main")).toBeNull();
    expect(cleanEntry({ message: "x".repeat(5000) }, "main")!.message.length).toBe(600);
  });

  it("la même erreur ne s'empile pas, et la liste a une limite", () => {
    const at = (i: number): ErrorEntry => ({ at: `t${i}`, source: "page", message: `e${i}` });
    let list: ErrorEntry[] = [];
    for (let i = 0; i < ERRORS_MAX + 10; i++) list = addEntry(list, at(i));
    expect(list).toHaveLength(ERRORS_MAX);
    expect(list[0].message).toBe("e10");
    list = addEntry(list, { at: "again", source: "page", message: "e20" });
    expect(list.filter((entry) => entry.message === "e20")).toHaveLength(1);
    expect(list.at(-1)?.at).toBe("again");
  });

  it("le rapport se lit tel quel dans un ticket GitHub", () => {
    const text = reportText([{ at: "2026-10-23T10:00:00Z", source: "main", message: "boom", stack: "Error: boom" }], { version: "1.0.0", platform: "win32", osRelease: "10.0.26100", electron: "43.7.7", language: "fr" });
    expect(text).toContain("**Vitrine 1.0.0** · win32 10.0.26100 · Electron 43.7.7 · fr");
    expect(text).toContain("- `2026-10-23T10:00:00Z` (main) boom");
    expect(text).toContain("```\nError: boom\n```");
    expect(reportText([], { version: "1.0.0", platform: "linux", osRelease: "6", electron: "43", language: "en" })).toContain("Aucune erreur gardée.");
  });

  it("le ticket est coupé pour rester une adresse valide", () => {
    const url = issueUrl("https://github.com/x/y", "a".repeat(20_000));
    expect(url.startsWith("https://github.com/x/y/issues/new?")).toBe(true);
    expect(url.length).toBeLessThan(8000);
    expect(new URL(url).searchParams.get("body")).toContain("rapport coupé");
  });
});
