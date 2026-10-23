import { mkdtempSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { applyAutostart, autostartEntry } from "../electron/linuxDesktop";

describe("v1.0 : version Linux (AppImage)", () => {
  it("l'entrée de démarrage lance l'AppImage cachée dans la zone de notification", () => {
    const entry = autostartEntry("/home/sam/Apps/Vitrine-1.0.0-x86_64.AppImage", "--hidden");
    expect(entry).toContain('Exec="/home/sam/Apps/Vitrine-1.0.0-x86_64.AppImage" --hidden');
    expect(entry.startsWith("[Desktop Entry]\nType=Application\n")).toBe(true);
  });

  it("un chemin avec des caractères spéciaux reste un seul argument", () => {
    expect(autostartEntry('/home/a "b"/$x/Vitrine.AppImage', "--hidden")).toContain('Exec="/home/a \\"b\\"/\\$x/Vitrine.AppImage" --hidden');
  });

  it("cochée : le fichier est écrit ; décochée : il disparaît ; sans AppImage : rien", () => {
    const file = path.join(mkdtempSync(path.join(tmpdir(), "vitrine-autostart-")), "autostart", "vitrine.desktop");
    applyAutostart(true, undefined, "--hidden", file);
    expect(existsSync(file)).toBe(false);
    applyAutostart(true, "/opt/Vitrine.AppImage", "--hidden", file);
    expect(readFileSync(file, "utf8")).toContain('Exec="/opt/Vitrine.AppImage" --hidden');
    applyAutostart(false, "/opt/Vitrine.AppImage", "--hidden", file);
    expect(existsSync(file)).toBe(false);
  });
});
