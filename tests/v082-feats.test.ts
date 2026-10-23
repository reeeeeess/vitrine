import { describe, expect, it } from "vitest";
import { parseSections } from "../electron/lyricsProviders";
import { stageLyrics } from "../src/renderer/lib/lyricsView";
import { assignSingers, likeness, sidesFor, singersOf } from "../src/renderer/lib/singers";

const line = (timeMs: number, text: string) => ({ timeMs, text });

describe("who sings which part of a feat (Genius's headings)", () => {
  it("reads the parts and their headings, and nothing from a text without headings", () => {
    const text = "Paroles de la chanson X par Y\n[Couplet 1 : SCH]\nOui ma gâtée\nRS4 gris\n\n[Refrain : JuL & Solda]\nEn bande organisée\n";
    expect(parseSections(text)).toEqual([
      { label: "Couplet 1 : SCH", lines: ["Oui ma gâtée", "RS4 gris"] },
      { label: "Refrain : JuL & Solda", lines: ["En bande organisée"] },
    ]);
    expect(parseSections("Une ligne\nUne autre")).toEqual([]);
  });

  it("finds the track's artists a heading names, however it spells them", () => {
    const artists = ["SCH", "Kofs", "JuL", "Solda", "La Rvfleuze", "Vacra"];
    expect(singersOf("Couplet 2 : Kofs", artists)).toEqual(["Kofs"]);
    expect(singersOf("Refrain : Jul & Solda", artists)).toEqual(["JuL", "Solda"]);
    expect(singersOf("Vacra & La Rvfleuze", artists)).toEqual(["Vacra", "La Rvfleuze"]);
    expect(singersOf("Refrain", artists)).toBeNull();
    expect(singersOf("Intro : Charles Aznavour", artists)).toBeNull();
  });

  it("knows two lines are the same despite punctuation, case and a missing word", () => {
    expect(likeness("C'est mon gosse, c'est moi j'l'ai allaité", "c'est mon gosse c'est moi j'l'ai allaiter")).toBeGreaterThan(0.85);
    expect(likeness("En bande organisée", "J'ai passé la bague à Tchikita")).toBeLessThan(0.3);
  });

  it("puts the guest on the right all song long when there are two voices, and both in the middle", () => {
    expect(sidesFor([["Vacra"], ["La Rvfleuze"], ["Vacra", "La Rvfleuze"], ["Vacra"]], "Vacra")).toEqual([undefined, "right", "both", undefined]);
    // a posse cut: each new voice on the other side
    expect(sidesFor([["SCH"], ["Kofs"], ["JuL"], ["JuL", "Solda"], ["Naps"]], "SCH")).toEqual([undefined, "right", undefined, "both", "right"]);
  });

  it("matches the synced lines with the parts, names each new voice, and takes the headings left in the text", () => {
    const sections = [
      { label: "Couplet 1 : SCH", lines: ["Oui ma gâtée, RS4 gris nardo", "Bien sûr qu'ils m'ont vu"] },
      { label: "Refrain : JuL & Solda", lines: ["En bande organisée, personne peut nous canaliser"] },
      { label: "Couplet 2 : Kofs", lines: ["J'ai passé la bague à Tchikita"] },
    ];
    const lines = [
      line(1000, "Oui, ma gâtée, RS4 gris nardo"),
      line(3000, "Bien sûr qu'ils m'ont vu (vu)"),
      line(5000, "En bande organisée, personne peut nous canaliser"),
      line(7000, "[Couplet 2 : Kofs]"),
      line(8000, "Une ligne que Genius n'a pas"),
      line(9000, "J'ai passé la bague à Tchikita"),
    ];
    const sung = assignSingers(lines, sections, ["SCH", "Kofs", "JuL", "Solda"]);
    expect(sung.map((l) => [l.text.slice(0, 12), l.singers?.join("&"), l.side ?? "left", l.voice ?? ""])).toEqual([
      ["Oui, ma gâté", "SCH", "left", "SCH"],
      ["Bien sûr qu'", "SCH", "left", ""],
      ["En bande org", "JuL&Solda", "both", "JuL & Solda"],
      ["Une ligne qu", "Kofs", "right", "Kofs"],
      ["J'ai passé l", "Kofs", "right", ""],
    ]);
    const staged = stageLyrics(sung).filter((entry) => entry.kind === "line");
    expect(staged.map((entry) => (entry.kind === "line" ? (entry.voice ?? "") : ""))).toEqual(["SCH", "", "JuL & Solda", "Kofs", ""]);
  });

  it("leaves a song alone when it is not a feat, or when its file already says who sings", () => {
    const sections = [
      { label: "A", lines: ["x"] },
      { label: "B", lines: ["y"] },
    ];
    const lines = [line(0, "x")];
    expect(assignSingers(lines, sections, ["Solo"])).toBe(lines);
    const duet = [{ ...line(0, "x"), side: "right" as const }];
    expect(assignSingers(duet, sections, ["A", "B"])).toBe(duet);
    expect(assignSingers(lines, undefined, ["A", "B"])).toBe(lines);
  });

  it("never shows a heading as a sung line", () => {
    expect(stageLyrics([line(0, "[Refrain]"), line(1000, "La la")]).filter((entry) => entry.kind === "line")).toHaveLength(1);
  });
});
