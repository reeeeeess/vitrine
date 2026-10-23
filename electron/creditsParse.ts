// What MusicBrainz says of a recording and its work, put the way a credits page reads (D5): who wrote it,
// who produced it, who mixed and mastered it, who played what. Free of Electron, for the tests.

export interface Credit {
  name: string;
  /** "Paroles", "Musique", "Production", "Guitare"… */
  roles: string[];
}

export interface Credits {
  writing: Credit[];
  production: Credit[];
  sound: Credit[];
  musicians: Credit[];
}

interface Relation {
  type?: string;
  attributes?: string[];
  artist?: { name?: string };
  work?: { id?: string };
}

const WRITING: Record<string, string> = { composer: "Musique", lyricist: "Paroles", writer: "Écriture", arranger: "Arrangement", librettist: "Livret" };
const PRODUCTION: Record<string, string> = { producer: "Production", "executive producer": "Production exécutive", programming: "Programmation" };
const SOUND: Record<string, string> = { mix: "Mixage", mastering: "Mastering", recording: "Enregistrement", engineer: "Ingénieur du son", "audio engineer": "Ingénieur du son", "sound engineer": "Ingénieur du son" };

/** what an instrument is called in French, for the most common ones */
const INSTRUMENTS: Record<string, string> = {
  guitar: "Guitare",
  "electric guitar": "Guitare électrique",
  "acoustic guitar": "Guitare acoustique",
  "bass guitar": "Basse",
  bass: "Basse",
  "drums (drum set)": "Batterie",
  drums: "Batterie",
  piano: "Piano",
  keyboard: "Claviers",
  synthesizer: "Synthétiseur",
  percussion: "Percussions",
  violin: "Violon",
  cello: "Violoncelle",
  saxophone: "Saxophone",
  trumpet: "Trompette",
  strings: "Cordes",
};

const instrument = (name: string) => INSTRUMENTS[name.toLowerCase()] ?? name.charAt(0).toUpperCase() + name.slice(1);

/** a role told apart from the main one: "Mixage (assistant)" */
const withAttributes = (role: string, attributes: string[] = []) => {
  const extra = attributes.filter((attribute) => ["assistant", "additional", "co"].includes(attribute));
  return extra.length ? `${role} (${extra.map((a) => (a === "additional" ? "additionnel" : a)).join(", ")})` : role;
};

function add(list: Credit[], name: string | undefined, role: string): void {
  if (!name) return;
  const known = list.find((credit) => credit.name === name);
  if (known) {
    if (!known.roles.includes(role)) known.roles.push(role);
  } else list.push({ name, roles: [role] });
}

/** The credits of a recording's relations (and of its work's, for the writers). */
export function creditsOf(recording: Relation[], work: Relation[] = []): Credits {
  const credits: Credits = { writing: [], production: [], sound: [], musicians: [] };
  for (const rel of work) {
    const role = rel.type && WRITING[rel.type];
    if (role) add(credits.writing, rel.artist?.name, role);
  }
  for (const rel of recording) {
    const type = rel.type ?? "";
    const name = rel.artist?.name;
    if (WRITING[type]) add(credits.writing, name, WRITING[type]);
    else if (PRODUCTION[type]) add(credits.production, name, withAttributes(PRODUCTION[type], rel.attributes));
    else if (SOUND[type]) add(credits.sound, name, withAttributes(SOUND[type], rel.attributes));
    else if (type === "instrument") for (const played of rel.attributes?.length ? rel.attributes : ["instrument"]) add(credits.musicians, name, instrument(played));
    else if (type === "vocal") add(credits.musicians, name, "Voix");
  }
  return credits;
}

/** The first work a recording performs, to ask who wrote it. */
export const workOf = (recording: Relation[]) => recording.find((rel) => rel.type === "performance" && rel.work?.id)?.work?.id;

export const isEmpty = (credits: Credits) => !credits.writing.length && !credits.production.length && !credits.sound.length && !credits.musicians.length;
