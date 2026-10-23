import { describe, expect, it } from "vitest";
import { applyEqualizer, apoOutputs, cleanEqualizer, equalizerConfig, equalizerPaths, hasInclude } from "../electron/equalizer";
import { curvePath, presetOf, PRESETS } from "../src/renderer/lib/eqPresets";

const paths = equalizerPaths({ ProgramFiles: "C:\\Program Files", PUBLIC: "C:\\Users\\Public" });

/** A fake disk: files by path, and which writes Windows refuses. */
function disk(files: Record<string, string>, refuse: string[] = []) {
  const store = new Map(Object.entries(files));
  const deny = (file: string) => {
    if (refuse.some((prefix) => file.startsWith(prefix))) throw Object.assign(new Error("EPERM"), { code: "EPERM" });
  };
  return {
    store,
    existsSync: (file: string) => store.has(file),
    readFileSync: (file: string) => {
      if (!store.has(file)) throw new Error("ENOENT");
      return store.get(file)!;
    },
    writeFileSync: (file: string, text: string) => {
      deny(file);
      store.set(file, text);
    },
    appendFileSync: (file: string, text: string) => {
      deny(file);
      store.set(file, (store.get(file) ?? "") + text);
    },
    mkdirSync: () => undefined,
  } as never;
}

describe("the equalizer, through Equalizer APO (K1)", () => {
  it("keeps the page's settings safe: ten gains within ±12 dB, by half steps", () => {
    expect(cleanEqualizer({ enabled: true, preset: "Basses", gains: [30, -40, 1.26, "x"] })).toEqual({ enabled: true, preset: "Basses", gains: [12, -12, 1.5, 0, 0, 0, 0, 0, 0, 0] });
    expect(cleanEqualizer(null).enabled).toBe(false);
  });

  it("writes Equalizer APO's format, with a preamp against clipping", () => {
    const text = equalizerConfig({ enabled: true, preset: "Basses", gains: PRESETS.Basses });
    expect(text).toContain("Preamp: -6 dB");
    expect(text).toContain("GraphicEQ: 31 6; 62 5; 125 4; 250 2; 500 0; 1000 0; 2000 0; 4000 0; 8000 0; 16000 0");
    expect(equalizerConfig({ enabled: true, preset: "Nuit", gains: PRESETS.Nuit })).toContain("Preamp: -1 dB");
    // only cuts: no preamp needed
    expect(equalizerConfig({ enabled: true, preset: "Perso", gains: [-3, -2, 0, 0, 0, 0, 0, 0, -1, -4] })).toContain("Preamp: 0 dB");
    // off, or flat: nothing but comments, the sound passes untouched
    expect(equalizerConfig({ enabled: false, preset: "Basses", gains: PRESETS.Basses })).not.toContain("GraphicEQ");
    expect(equalizerConfig({ enabled: true, preset: "Plat", gains: PRESETS.Plat })).not.toContain("GraphicEQ");
  });

  it("puts its file where the Windows audio service can read it", () => {
    expect(paths.file).toBe("C:\\Users\\Public\\Documents\\Vitrine\\egaliseur.txt");
    expect(paths.config).toBe("C:\\Program Files\\EqualizerAPO\\config\\config.txt");
  });

  it("adds the Include line once, whatever its case", () => {
    expect(hasInclude("Preamp: 0 dB\r\ninclude: c:\\users\\public\\documents\\vitrine\\egaliseur.txt\r\n", paths.file)).toBe(true);
    expect(hasInclude("Include: other.txt", paths.file)).toBe(false);
    const files = disk({ [paths.config]: "Preamp: 0 dB\r\nInclude: example.txt" });
    expect(applyEqualizer(cleanEqualizer({ enabled: true, gains: PRESETS.Voix }), "win32", paths, files).state).toBe("ready");
    expect(applyEqualizer(cleanEqualizer({ enabled: true, gains: PRESETS.Aigus }), "win32", paths, files).state).toBe("ready");
    const config = (files as unknown as { store: Map<string, string> }).store.get(paths.config)!;
    expect(config.match(/Include: C:\\Users\\Public/g)).toHaveLength(1);
    expect((files as unknown as { store: Map<string, string> }).store.get(paths.file)).toContain("GraphicEQ: 31 0; 62 0; 125 0; 250 0; 500 0; 1000 1");
  });

  it("gives the line to copy when Windows refuses to touch Program Files", () => {
    const files = disk({ [paths.config]: "Preamp: 0 dB\r\n" }, ["C:\\Program Files"]);
    const status = applyEqualizer(cleanEqualizer({ enabled: true, gains: PRESETS.Basses }), "win32", paths, files);
    expect(status).toMatchObject({ state: "needs-include", includeLine: `Include: ${paths.file}` });
  });

  it("says when Equalizer APO is missing, or when this is not Windows", () => {
    expect(applyEqualizer(cleanEqualizer({}), "win32", paths, disk({})).state).toBe("absent");
    expect(applyEqualizer(cleanEqualizer({}), "darwin", paths, disk({})).state).toBe("unsupported");
  });

  it("names the preset of a set of gains, and draws the curve through them", () => {
    expect(presetOf(PRESETS.Soirée)).toBe("Soirée");
    expect(presetOf([1, 0, 0, 0, 0, 0, 0, 0, 0, 0])).toBe("Perso");
    const path = curvePath(PRESETS.Plat, 500, 200);
    expect(path.startsWith("M 0 100")).toBe(true);
    expect(path.endsWith("500.0 100.0")).toBe(true);
  });
});

describe("v1.0.1 : l'égaliseur dit pourquoi il n'agit pas", () => {
  const REG = [
    "HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\MMDevices\\Audio\\Render\\{0.0.0.00000000}.{aaaa-1111}",
    "    DeviceState    REG_DWORD    0x1",
    "",
    "HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\MMDevices\\Audio\\Render\\{0.0.0.00000000}.{aaaa-1111}\\FxProperties",
    "    {d04e05a6-594b-4fb6-a80d-01af5eed7d1d},1    REG_SZ    {eacd2258-fcac-4ff4-b36d-419e924a6d79}",
    "",
    "HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\MMDevices\\Audio\\Render\\{0.0.0.00000000}.{aaaa-1111}\\Properties",
    "    {a45c254e-df1c-4efd-8020-67d146a850e0},2    REG_SZ    Haut-parleurs",
    "    {b3f8fa53-0004-438e-9003-51a46e139bfc},6    REG_SZ    Realtek(R) Audio",
    "",
    "HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\MMDevices\\Audio\\Render\\{0.0.0.00000000}.{bbbb-2222}",
    "    DeviceState    REG_DWORD    0x4",
    "HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\MMDevices\\Audio\\Render\\{0.0.0.00000000}.{bbbb-2222}\\Properties",
    "    {a45c254e-df1c-4efd-8020-67d146a850e0},2    REG_SZ    Casque",
  ].join("\r\n");

  it("lit les sorties son où Equalizer APO est posé", () => {
    expect(apoOutputs(REG)).toEqual([{ name: "Haut-parleurs (Realtek(R) Audio)", active: true }]);
    expect(apoOutputs("")).toEqual([]);
  });

  it("installé et relié, mais sur aucune sortie : il le dit", () => {
    const files = { existsSync: () => true, readFileSync: () => `Include: ${paths.file}`, writeFileSync: () => undefined, appendFileSync: () => undefined, mkdirSync: () => undefined };
    expect(applyEqualizer({ enabled: true, preset: "Basses", gains: PRESETS.Basses }, "win32", paths, files as never, []).state).toBe("no-output");
    const ready = applyEqualizer({ enabled: true, preset: "Basses", gains: PRESETS.Basses }, "win32", paths, files as never, ["Haut-parleurs (Realtek(R) Audio)"]);
    expect(ready).toMatchObject({ state: "ready", outputs: ["Haut-parleurs (Realtek(R) Audio)"] });
  });

  it("le fichier d'Equalizer APO reste en ASCII", () => {
    const text = equalizerConfig({ enabled: true, preset: "Basses", gains: PRESETS.Basses }) + equalizerConfig({ enabled: false, preset: "Plat", gains: PRESETS.Plat });
    expect(/^[\x00-\x7f]*$/.test(text)).toBe(true);
  });
});
