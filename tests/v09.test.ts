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

describe("the new releases of your artists (I6)", async () => {
  const { freshReleases, groupReleases, pickArtists, releaseLabel, releaseTime } = await import("../src/renderer/lib/releases");
  const now = Date.UTC(2026, 9, 23);
  const album = (id: string, date: string, name = id, artistId = "a") => ({ id, uri: `spotify:album:${id}`, kind: "album" as const, name, subtitle: "Artiste · 2026", releaseDate: date, artistId });
  const artist = (id: string) => ({ id, uri: `spotify:artist:${id}`, name: id, genres: [] });

  it("takes the artists of the four weeks first, then those of the six months, each once, fifteen at most", () => {
    expect(pickArtists([artist("a"), artist("b")], [artist("b"), artist("c")]).map((a) => a.id)).toEqual(["a", "b", "c"]);
    expect(pickArtists(Array.from({ length: 20 }, (_, i) => artist(`r${i}`)), [])).toHaveLength(15);
  });

  it("reads Spotify's dates, even with only the year or the month", () => {
    expect(releaseTime("2026-10-17")).toBe(Date.UTC(2026, 9, 17));
    expect(releaseTime("2026-10")).toBe(Date.UTC(2026, 9, 1));
    expect(releaseTime("2026")).toBe(Date.UTC(2026, 0, 1));
  });

  it("keeps four months, newest first, a single and its album once, and groups them", () => {
    const list = freshReleases([album("old", "2025-01-01"), album("s", "2026-10-20", "Néons"), album("al", "2026-10-21", "Néons (Deluxe)"), album("m", "2026-10-02"), album("e", "2026-08-01")], now);
    expect(list.map((c) => c.id)).toEqual(["al", "m", "e"]);
    expect(groupReleases(list, now).map((g) => [g.label, g.items.length])).toEqual([
      ["Cette semaine", 1],
      ["Ce mois-ci", 1],
      ["Plus tôt", 1],
    ]);
    expect(releaseLabel("2026-10-21", now)).toBe("il y a 2 j");
    expect(releaseLabel("2026-10-23", now)).toBe("aujourd'hui");
  });
});

describe("importing a playlist (C8)", async () => {
  const { columnsOf, delimiterOf, matchScore, parseImport, searchQuery, splitCsvLine } = await import("../src/renderer/lib/importPlaylist");

  it("reads CSV lines with quotes and the delimiter of the file", () => {
    expect(splitCsvLine('"Bande organisée","SCH, Kofs, JuL",x', ",")).toEqual(["Bande organisée", "SCH, Kofs, JuL", "x"]);
    expect(splitCsvLine('"Il a dit ""salut""";b', ";")).toEqual(['Il a dit "salut"', "b"]);
    expect(delimiterOf("Titre;Artiste;Album")).toBe(";");
    expect(delimiterOf("Name\tArtist\tAlbum")).toBe("\t");
    expect(delimiterOf("Un titre")).toBeNull();
  });

  it("finds the columns of Exportify, TuneMyMusic and spreadsheets", () => {
    expect(columnsOf(["Track URI", "Track Name", "Artist Name(s)", "Album Name", "ISRC"])).toEqual({ title: 1, artist: 2, album: 3, uri: 0, isrc: 4 });
    expect(columnsOf(["Titre", "Artiste"])).toMatchObject({ title: 0, artist: 1 });
  });

  it("takes Spotify links as they are, the first artist, the ISRC, and the playlist's name", () => {
    const exportify = 'Track URI,Track Name,Artist Name(s),ISRC\nspotify:track:0123456789abcdefghijkl,Bande organisée,"SCH, Kofs",FRUM72000123\n';
    expect(parseImport(exportify).songs).toEqual([{ title: "Bande organisée", artist: "SCH", uri: "spotify:track:0123456789abcdefghijkl", isrc: "FRUM72000123" }]);
    const tune = "Track name;Artist name;Album;Playlist name\nNéons;Nova Lune;Album;Ma playlist Deezer\n";
    expect(parseImport(tune)).toMatchObject({ name: "Ma playlist Deezer", songs: [{ title: "Néons", artist: "Nova Lune", album: "Album" }] });
  });

  it("reads plain lists of « Artiste - Titre »", () => {
    expect(parseImport("1. Vacra - Fille à Papa\nStromae – Alors on danse\nJuste un titre\n").songs).toEqual([
      { artist: "Vacra", title: "Fille à Papa" },
      { artist: "Stromae", title: "Alors on danse" },
      { artist: "", title: "Juste un titre" },
    ]);
  });

  it("is sure of a result only when the title and an artist both match", () => {
    const song = { title: "Fille à Papa", artist: "Vacra" };
    expect(matchScore(song, { name: "Fille à Papa", artists: ["Vacra", "La Rvfleuze"] })).toBe(1);
    expect(matchScore(song, { name: "Fille a papa - Remix", artists: ["Vacra"] })).toBe(1);
    expect(matchScore(song, { name: "Fille à Papa", artists: ["Quelqu'un d'autre"] })).toBe(0);
    expect(searchQuery({ title: "T", artist: "A", isrc: "FRUM72000123" })).toBe("isrc:FRUM72000123");
    expect(searchQuery(song)).toBe("track:Fille à Papa artist:Vacra");
  });
});

describe("the credits of a track (D5)", async () => {
  const { creditsOf, isEmpty, workOf } = await import("../electron/creditsParse");
  const recording = [
    { type: "producer", artist: { name: "D'Mile" } },
    { type: "producer", artist: { name: "Bruno Mars" } },
    { type: "mix", artist: { name: "Serban Ghenea" } },
    { type: "mix", artist: { name: "Bryce Bordone" }, attributes: ["assistant"] },
    { type: "instrument", artist: { name: "Bruno Mars" }, attributes: ["guitar"] },
    { type: "instrument", artist: { name: "D'Mile" }, attributes: ["drums (drum set)", "bass"] },
    { type: "performance", work: { id: "w1" } },
  ];
  const work = [
    { type: "writer", artist: { name: "Lady Gaga" } },
    { type: "composer", artist: { name: "Bruno Mars" } },
    { type: "lyricist", artist: { name: "Bruno Mars" } },
  ];

  it("reads who wrote, produced, mixed and played, in French", () => {
    const credits = creditsOf(recording, work);
    expect(credits.writing).toEqual([
      { name: "Lady Gaga", roles: ["Écriture"] },
      { name: "Bruno Mars", roles: ["Musique", "Paroles"] },
    ]);
    expect(credits.production.map((c) => c.name)).toEqual(["D'Mile", "Bruno Mars"]);
    expect(credits.sound).toEqual([
      { name: "Serban Ghenea", roles: ["Mixage"] },
      { name: "Bryce Bordone", roles: ["Mixage (assistant)"] },
    ]);
    expect(credits.musicians).toEqual([
      { name: "Bruno Mars", roles: ["Guitare"] },
      { name: "D'Mile", roles: ["Batterie", "Basse"] },
    ]);
    expect(workOf(recording)).toBe("w1");
    expect(isEmpty(creditsOf([]))).toBe(true);
  });
});

describe("the infinite queue (E1)", async () => {
  const { ranOut } = await import("../src/renderer/player/infinite");
  const playing = { paused: false, durationMs: 200_000, repeat: "off" as const, nextTrack: undefined, uri: "spotify:track:x", position: 198_800 };

  it("plays on when the last track ends with nothing after it", () => {
    expect(ranOut(playing, { ...playing, paused: true, position: 0 })).toBe(true);
    expect(ranOut(playing, { ...playing, paused: true, position: 199_500 })).toBe(true);
  });

  it("not when paused before the end, when something follows, on repeat, or on another track", () => {
    expect(ranOut({ ...playing, position: 120_000 }, { ...playing, paused: true, position: 120_000 })).toBe(false);
    expect(ranOut({ ...playing, nextTrack: { uri: "y" } as never }, { ...playing, paused: true, position: 0 })).toBe(false);
    expect(ranOut(playing, { ...playing, paused: true, position: 0, repeat: "context" })).toBe(false);
    expect(ranOut(playing, { ...playing, paused: true, position: 0, uri: "spotify:track:y" })).toBe(false);
  });
});

describe("Last.fm (P7)", async () => {
  const { createHash } = await import("node:crypto");
  const { scrobbleParams, signature } = await import("../electron/lastfmSign");
  const { scrobbleDue } = await import("../src/renderer/player/scrobbler");

  it("signs the way Last.fm checks: names sorted, format left out, the secret at the end", () => {
    const md5 = (text: string) => createHash("md5").update(text, "utf8").digest("hex");
    expect(signature({ method: "auth.getToken", api_key: "k", format: "json" }, "s")).toBe(md5("api_keykmethodauth.getTokens"));
    expect(signature({ b: "2", a: "é" }, "x")).toBe(md5("aéb2x"));
  });

  it("sends listens in batches, numbered", () => {
    const params = scrobbleParams([{ artist: "Vacra", track: "Fille à Papa", album: "Fille à Papa", timestamp: 1_760_000_000, durationMs: 169_586 }]);
    expect(params).toEqual({ "artist[0]": "Vacra", "track[0]": "Fille à Papa", "album[0]": "Fille à Papa", "timestamp[0]": "1760000000", "duration[0]": "170" });
    const many = scrobbleParams(Array.from({ length: 60 }, (_, i) => ({ artist: "A", track: `T${i}`, timestamp: i, durationMs: 60_000 })));
    expect(Object.keys(many).filter((key) => key.startsWith("track["))).toHaveLength(50);
  });

  it("counts a listen after half the track, or 4 minutes, never under 30 s", () => {
    expect(scrobbleDue(85_000, 169_586)).toBe(true);
    expect(scrobbleDue(80_000, 169_586)).toBe(false);
    expect(scrobbleDue(240_000, 900_000)).toBe(true);
    expect(scrobbleDue(30_000, 25_000)).toBe(false);
  });
});

describe("Rétro Vitrine as a video", async () => {
  const { SCENES, VIDEO_MS, sceneAt } = await import("../src/renderer/lib/retroVideo");

  it("lasts about 15 s, scene after scene", () => {
    expect(VIDEO_MS).toBe(15_400);
    expect(sceneAt(0)).toMatchObject({ index: 0, progress: 0 });
    expect(sceneAt(SCENES[0].ms + 10).index).toBe(1);
    expect(sceneAt(VIDEO_MS - 1).index).toBe(SCENES.length - 1);
    expect(sceneAt(VIDEO_MS + 5000)).toMatchObject({ index: SCENES.length - 1, progress: 1 });
  });
});
