import { describe, expect, it } from "vitest";
import { chunkLines, deeplHost, linesToTranslate, mapTranslations, splitAnswer } from "../electron/translateText";

const memory = new Map<string, string>();
Object.assign(globalThis, {
  localStorage: { getItem: (k: string) => memory.get(k) ?? null, setItem: (k: string, v: string) => memory.set(k, v), removeItem: (k: string) => memory.delete(k) },
});
const { salonKey, sentence } = await import("../src/renderer/components/Salon");

describe("the translation of lyrics (B7)", () => {
  it("translates each distinct line once, not the empty ones nor the numbers", () => {
    expect(linesToTranslate(["Baby", "", "  Baby ", "123", "♪", "Oh yeah"])).toEqual(["Baby", "Oh yeah"]);
  });

  it("cuts the lines into requests of 450 characters at most, never in the middle of a line", () => {
    const lines = Array.from({ length: 30 }, (_, i) => `ligne numéro ${i} `.repeat(2));
    const chunks = chunkLines(lines);
    expect(chunks.flat()).toEqual(lines);
    for (const chunk of chunks) expect(chunk.join("\n").length).toBeLessThanOrEqual(450);
    expect(chunkLines(["x".repeat(600)])[0][0]).toHaveLength(450);
  });

  it("puts the answer back on its lines, or says it cannot", () => {
    expect(splitAnswer("Un\nDeux", 2)).toEqual(["Un", "Deux"]);
    expect(splitAnswer("Un deux", 2)).toBeNull();
  });

  it("gives each line its translation, none when it says the same thing", () => {
    const found = new Map([
      ["Baby", "Bébé"],
      ["아파트", "아파트"],
    ]);
    expect(mapTranslations([" Baby", "아파트", "Autre"], found)).toEqual(["Bébé", null, null]);
  });

  it("sends a free DeepL key to the free address", () => {
    expect(deeplHost("abc:fx")).toBe("https://api-free.deepl.com");
    expect(deeplHost("abc")).toBe("https://api.deepl.com");
  });
});

describe("the living-room mode", () => {
  it("is driven like a TV: space, arrows, the remote's keys, back", () => {
    expect(salonKey(" ")).toBe("toggle");
    expect(salonKey("MediaPlayPause")).toBe("toggle");
    expect(salonKey("ArrowRight")).toBe("next");
    expect(salonKey("MediaTrackPrevious")).toBe("previous");
    expect(salonKey("ArrowUp")).toBe("louder");
    expect(salonKey("Backspace")).toBe("close");
    expect(salonKey("a")).toBeNull();
  });

  it("writes the day the French way: only the first letter up", () => {
    expect(sentence("vendredi 23 octobre")).toBe("Vendredi 23 octobre");
  });
});

describe("the Verre theme", () => {
  it("is remembered like the others", async () => {
    memory.set("vitrine.theme", "glass");
    const { theme } = await import("../src/renderer/lib/theme");
    expect(theme.get().current).toBe("glass");
  });
});
