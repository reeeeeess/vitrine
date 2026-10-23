// Playlists brought from elsewhere (C8): a file — Exportify's or TuneMyMusic's CSV, a CSV from Excel (";"),
// a list copied from Apple Music (tabs), or plain "Artiste - Titre" lines — becomes the list of songs to find
// on Spotify. Pure, for the tests; the search itself is paced (playlistImport.ts).

export interface ImportedSong {
  title: string;
  artist: string;
  album?: string;
  /** a Spotify link already in the file (Exportify): nothing to search */
  uri?: string;
  isrc?: string;
}

/** The fields of one line of a CSV, with quotes ("a, b") and doubled quotes inside them. */
export function splitCsvLine(line: string, delimiter: string): string[] {
  const fields: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (quoted) {
      if (char === '"' && line[i + 1] === '"') {
        field += '"';
        i++;
      } else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"' && field === "") quoted = true;
    else if (char === delimiter) {
      fields.push(field.trim());
      field = "";
    } else field += char;
  }
  fields.push(field.trim());
  return fields;
}

/** The delimiter of a table: the one the first line has the most of (tab, semicolon or comma). */
export function delimiterOf(header: string): string | null {
  const counts = ["\t", ";", ","].map((d) => [d, splitCsvLine(header, d).length - 1] as const).sort((a, b) => b[1] - a[1]);
  return counts[0][1] > 0 ? counts[0][0] : null;
}

const norm = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** Which column holds what, from the names Exportify, TuneMyMusic, Apple Music and spreadsheets give them. */
export function columnsOf(header: string[]): { title: number; artist: number; album: number; uri: number; isrc: number } {
  const names = header.map(norm);
  // the names in the order given: an exact one first ("track name" before "track uri"), then one that starts so
  const find = (...wanted: string[]) => {
    for (const w of wanted) {
      const exact = names.indexOf(w);
      if (exact >= 0) return exact;
    }
    for (const w of wanted) {
      const loose = names.findIndex((name) => name.startsWith(`${w} `) && !/\buri\b/.test(name));
      if (loose >= 0) return loose;
    }
    return -1;
  };
  return {
    title: find("track name", "titre", "title", "name", "nom", "song", "chanson", "track"),
    artist: find("artist name s", "artist names", "artist name", "artiste", "artistes", "artist", "artists", "interprete"),
    album: find("album name", "album"),
    uri: find("track uri", "spotify uri", "uri"),
    isrc: find("isrc"),
  };
}

/** "Artiste - Titre" (or "Titre — Artiste" when told so), one per line. */
function parseLines(lines: string[]): ImportedSong[] {
  return lines
    .map((line) => line.replace(/^\s*\d+[.)]\s*/, "").trim())
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^(.+?)\s+[-–—]\s+(.+)$/);
      return match ? { artist: match[1].trim(), title: match[2].trim() } : { artist: "", title: line };
    });
}

/** The songs of a file, whatever its kind; the playlist's name when the file gives one. */
export function parseImport(text: string): { songs: ImportedSong[]; name?: string } {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/).filter((line) => line.trim());
  if (lines.length === 0) return { songs: [] };
  const delimiter = delimiterOf(lines[0]);
  const header = delimiter ? splitCsvLine(lines[0], delimiter) : [];
  const columns = delimiter ? columnsOf(header) : null;
  if (!delimiter || !columns || columns.title < 0) return { songs: parseLines(lines) };
  const playlist = norm(header.join(" ")).includes("playlist name") ? header.findIndex((cell) => norm(cell) === "playlist name") : -1;
  let name: string | undefined;
  const songs: ImportedSong[] = [];
  for (const line of lines.slice(1)) {
    const cells = splitCsvLine(line, delimiter);
    const title = cells[columns.title] ?? "";
    if (!title) continue;
    const uri = columns.uri >= 0 && /^spotify:track:[0-9A-Za-z]{22}$/.test(cells[columns.uri] ?? "") ? cells[columns.uri] : undefined;
    songs.push({
      title,
      // Exportify separates several artists with commas inside the field
      artist: (cells[columns.artist] ?? "").split(/\s*[,;&]\s*/)[0] ?? "",
      ...(columns.album >= 0 && cells[columns.album] ? { album: cells[columns.album] } : {}),
      ...(uri ? { uri } : {}),
      ...(columns.isrc >= 0 && /^[A-Z]{2}[A-Z0-9]{3}\d{7}$/i.test(cells[columns.isrc] ?? "") ? { isrc: cells[columns.isrc].toUpperCase() } : {}),
    });
    if (playlist >= 0 && !name && cells[playlist]) name = cells[playlist];
  }
  return { songs, name };
}

/** How sure a search result is the song: the title and the artist both found, give or take accents. */
export function matchScore(song: ImportedSong, candidate: { name: string; artists: string[] }): number {
  const title = norm(song.title.replace(/\s*[([].*?[)\]]/g, ""));
  const name = norm(candidate.name.replace(/\s*[([].*?[)\]]/g, "").replace(/\s+-\s+.*$/, ""));
  const titleOk = title === name ? 1 : name.startsWith(title) || title.startsWith(name) ? 0.7 : 0;
  if (!titleOk) return 0;
  if (!song.artist) return titleOk * 0.6;
  const artist = norm(song.artist);
  const artistOk = candidate.artists.some((a) => norm(a) === artist || norm(a).includes(artist) || artist.includes(norm(a)));
  return artistOk ? titleOk : 0;
}

/** The query that finds a song best: by ISRC when the file has it, by title and artist otherwise. */
export function searchQuery(song: ImportedSong): string {
  if (song.isrc) return `isrc:${song.isrc}`;
  return song.artist ? `track:${song.title} artist:${song.artist}` : song.title;
}
