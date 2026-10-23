import { describe, expect, it } from "vitest";
import EN from "../src/renderer/i18n/en.json";
import { toEnglish, translator } from "../src/renderer/i18n/translate";
import { resolveLanguage } from "../src/renderer/lib/i18n";
// @ts-expect-error: a plain script, without types
import { extract } from "../scripts/i18n-extract.mjs";

describe("v1.0 : version anglaise", () => {
  it("chaque texte de l'interface a sa traduction", () => {
    const texts = [...(extract() as Map<string, string>).keys()];
    expect(texts.length).toBeGreaterThan(500);
    expect(texts.filter((text) => !(text in EN))).toEqual([]);
  });

  it("aucune traduction vide ni restée en français", () => {
    for (const [french, english] of Object.entries(EN as Record<string, string>)) {
      expect(english.trim(), french).not.toBe("");
      expect(english, french).not.toMatch(/ (le|la|les|des|du|pour|avec) /);
    }
  });

  it("les textes fixes, en gardant les espaces autour", () => {
    expect(toEnglish("Réglages")).toBe("Settings");
    expect(toEnglish(" titres ·")).toBe(" songs ·");
    expect(toEnglish("Paroles plein écran (karaoké)")).toBe("Full-screen lyrics (karaoke)");
  });

  it("les phrases composées : noms, nombres, pluriels", () => {
    const cases: [string, string][] = [
      ["Lecture sur Téléphone de Sam", "Playing on Téléphone de Sam"],
      ["Lecture sur Vitrine (cet ordinateur)", "Playing on Vitrine (this computer)"],
      ["Lire Minuit à Paris", "Play Minuit à Paris"],
      ["Lire Néons à 1:42", "Play Néons at 1:42"],
      ["« Néons » ajouté à la file", "“Néons” added to the queue"],
      ["1 titre", "1 song"],
      ["12 titres", "12 songs"],
      ["1 écoute", "1 play"],
      ["1 234 écoutes", "1,234 plays"],
      ["2 jours d'écoute", "2 days of listening"],
      ["Arrêt dans 12 min", "Stopping in 12 min"],
      ["il y a 1 mois", "1 month ago"],
      ["100e écoute de « Néons »", "100th play of “Néons”"],
      ["1 000 minutes d'écoute avec Vitrine", "1,000 minutes of listening with Vitrine"],
      ["Récap · Ce mois-ci", "Recap · This month"],
      ["Mardi soir · Nova Lune, Aria Vent et plus", "Tuesday evening · Nova Lune, Aria Vent and more"],
      ["Spotify bloque vos titres likés pour Vitrine (trop de demandes) : reprise automatique à 14:05 (dans 3 min).", "Spotify is blocking your liked songs for Vitrine (too many requests): automatic resume at 14:05 (in 3 min)."],
      ["Titre sauté : « Néons » est à la corbeille.", "Song skipped: “Néons” is in the trash."],
      ["Activé automatiquement : processeur à 2 cœurs ou moins.", "Turned on automatically: a processor with 2 cores or fewer."],
      ["Mixage (assistant)", "Mixing (assistant)"],
      ["Production (additionnel)", "Production (additional)"],
      ["Paroles : AMLL · mot à mot", "Lyrics: AMLL · word by word"],
      ["L'AURA MUSICALE DE SAM", "SAM'S MUSICAL AURA"],
      ["L'AURA MUSICALE DE VOUS", "YOUR MUSICAL AURA"],
    ];
    for (const [french, english] of cases) expect(toEnglish(french), french).toBe(english);
  });

  it("une liste de parties connues, mais pas un nom inconnu", () => {
    expect(toEnglish("Musique, Paroles")).toBe("Music, Lyrics");
    expect(toEnglish("Guitare, Piano")).toBe("Guitar, Piano");
    // a song or an artist is left as it is
    expect(toEnglish("Minuit à Paris")).toBe("Minuit à Paris");
    expect(toEnglish("Les Ondes, Nova Lune")).toBe("Les Ondes, Nova Lune");
  });

  it("un dictionnaire et des motifs à soi", () => {
    const tr = translator({ Bonjour: "Hello" }, [[/^(\d+) pommes$/, ([n]) => `${n} apples`]]);
    expect(tr("  Bonjour ")).toBe("  Hello ");
    expect(tr("3 pommes")).toBe("3 apples");
    expect(tr("Bonsoir")).toBe("Bonsoir");
  });

  it("la langue automatique suit le système", () => {
    expect(resolveLanguage("auto", "fr-FR")).toBe("fr");
    expect(resolveLanguage("auto", "fr-CA")).toBe("fr");
    expect(resolveLanguage("auto", "en-GB")).toBe("en");
    expect(resolveLanguage("auto", "de-DE")).toBe("en");
    expect(resolveLanguage("fr", "en-US")).toBe("fr");
    expect(resolveLanguage("en", "fr-FR")).toBe("en");
  });
});
