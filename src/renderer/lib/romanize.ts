// Pronunciation in Latin letters under lyrics in other scripts (Apple Music, iOS 26): Korean by the
// rules of the Revised Romanization, Japanese kana by Hepburn, Cyrillic and Greek letter by letter.
// No dictionary, so nothing to load: Chinese characters and Japanese kanji are left as they are.

const HANGUL = /[가-힣]/;
const KANA = /[぀-ヿ]/;
const CYRILLIC = /[Ѐ-ӿ]/;
const GREEK = /[Ͱ-Ͽἀ-῿]/;

// ── Korean ────────────────────────────────────────────────────────────────

const INITIALS = ["g", "kk", "n", "d", "tt", "r", "m", "b", "pp", "s", "ss", "", "j", "jj", "ch", "k", "t", "p", "h"];
const VOWELS = ["a", "ae", "ya", "yae", "eo", "e", "yeo", "ye", "o", "wa", "wae", "oe", "yo", "u", "wo", "we", "wi", "yu", "eu", "ui", "i"];
/** a final consonant at the end of a syllable, as it sounds there */
const FINALS = ["", "k", "k", "k", "n", "n", "n", "t", "l", "k", "m", "l", "l", "l", "p", "l", "m", "p", "p", "t", "t", "ng", "t", "t", "k", "t", "p", "t"];
/** the same final carried over to a following vowel (음악 → eu-mak) */
const CARRIED = ["", "g", "kk", "ks", "n", "nj", "nh", "d", "r", "lg", "lm", "lb", "ls", "lt", "lp", "lh", "m", "b", "bs", "s", "ss", "ng", "j", "ch", "k", "t", "p", ""];
const SILENT_INITIAL = 11;

function romanizeHangul(text: string): string {
  const chars = [...text];
  let out = "";
  chars.forEach((char, index) => {
    const code = char.charCodeAt(0) - 0xac00;
    if (code < 0 || code > 11171) {
      out += char;
      return;
    }
    const initial = Math.floor(code / 588);
    const vowel = Math.floor((code % 588) / 28);
    const final = code % 28;
    const nextCode = (chars[index + 1]?.charCodeAt(0) ?? 0) - 0xac00;
    const nextStartsWithVowel = nextCode >= 0 && nextCode <= 11171 && Math.floor(nextCode / 588) === SILENT_INITIAL;
    // a final carried over to the next syllable has already been written as its initial
    const previousCode = (chars[index - 1]?.charCodeAt(0) ?? 0) - 0xac00;
    const carriedIn = initial === SILENT_INITIAL && previousCode >= 0 && previousCode <= 11171 && previousCode % 28 !== 0;
    out += (carriedIn ? "" : INITIALS[initial]) + VOWELS[vowel] + (nextStartsWithVowel ? CARRIED[final] : FINALS[final]);
  });
  return out;
}

// ── Japanese kana ─────────────────────────────────────────────────────────

const KANA_TABLE: Record<string, string> = {
  あ: "a", い: "i", う: "u", え: "e", お: "o",
  か: "ka", き: "ki", く: "ku", け: "ke", こ: "ko", が: "ga", ぎ: "gi", ぐ: "gu", げ: "ge", ご: "go",
  さ: "sa", し: "shi", す: "su", せ: "se", そ: "so", ざ: "za", じ: "ji", ず: "zu", ぜ: "ze", ぞ: "zo",
  た: "ta", ち: "chi", つ: "tsu", て: "te", と: "to", だ: "da", ぢ: "ji", づ: "zu", で: "de", ど: "do",
  な: "na", に: "ni", ぬ: "nu", ね: "ne", の: "no",
  は: "ha", ひ: "hi", ふ: "fu", へ: "he", ほ: "ho", ば: "ba", び: "bi", ぶ: "bu", べ: "be", ぼ: "bo", ぱ: "pa", ぴ: "pi", ぷ: "pu", ぺ: "pe", ぽ: "po",
  ま: "ma", み: "mi", む: "mu", め: "me", も: "mo",
  や: "ya", ゆ: "yu", よ: "yo",
  ら: "ra", り: "ri", る: "ru", れ: "re", ろ: "ro",
  わ: "wa", ゐ: "i", ゑ: "e", を: "o", ん: "n", ゔ: "vu",
  ぁ: "a", ぃ: "i", ぅ: "u", ぇ: "e", ぉ: "o",
};
const SMALL_Y: Record<string, string> = { ゃ: "ya", ゅ: "yu", ょ: "yo" };

const toHiragana = (char: string) => {
  const code = char.charCodeAt(0);
  return code >= 0x30a1 && code <= 0x30f6 ? String.fromCharCode(code - 0x60) : char;
};

function romanizeKana(text: string): string {
  const chars = [...text].map(toHiragana);
  let out = "";
  let doubleNext = false;
  for (let index = 0; index < chars.length; index++) {
    const char = chars[index];
    if (char === "っ") {
      doubleNext = true;
      continue;
    }
    if (char === "ー") {
      out += out.match(/[aeiou]$/)?.[0] ?? "";
      continue;
    }
    let syllable = KANA_TABLE[char];
    if (syllable === undefined) {
      out += char === "　" ? " " : char;
      doubleNext = false;
      continue;
    }
    const small = SMALL_Y[chars[index + 1]];
    if (small && syllable.endsWith("i") && syllable.length > 1) {
      // きゃ → kya, しゃ → sha, ちゃ → cha, じゃ → ja
      syllable = /^(sh|ch|j)i$/.test(syllable) ? syllable.slice(0, -1) + small.slice(1) : syllable.slice(0, -1) + small;
      index++;
    }
    if (doubleNext) {
      syllable = (syllable.startsWith("ch") ? "t" : syllable[0]) + syllable;
      doubleNext = false;
    }
    out += syllable;
  }
  return out;
}

// ── Cyrillic and Greek ────────────────────────────────────────────────────

const CYRILLIC_TABLE: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "yo", ж: "zh", з: "z", и: "i", й: "y", к: "k", л: "l", м: "m",
  н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "kh", ц: "ts", ч: "ch", ш: "sh", щ: "shch",
  ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya", і: "i", ї: "yi", є: "ye", ґ: "g", ў: "w", ђ: "đ", ј: "j", љ: "lj", њ: "nj", ћ: "ć", џ: "dž",
};
const GREEK_TABLE: Record<string, string> = {
  α: "a", β: "v", γ: "g", δ: "d", ε: "e", ζ: "z", η: "i", θ: "th", ι: "i", κ: "k", λ: "l", μ: "m", ν: "n", ξ: "x",
  ο: "o", π: "p", ρ: "r", σ: "s", ς: "s", τ: "t", υ: "y", φ: "f", χ: "ch", ψ: "ps", ω: "o",
};

function byLetter(text: string, table: Record<string, string>): string {
  // accents off first (ά → α), then letter by letter, keeping capitals
  return [...text.normalize("NFD").replace(/[̀-ͯ]/g, "")]
    .map((char) => {
      const lower = char.toLowerCase();
      const latin = table[lower];
      if (latin === undefined) return char;
      return char !== lower && latin ? latin[0].toUpperCase() + latin.slice(1) : latin;
    })
    .join("");
}

/** The line in Latin letters, or null when it is already (or cannot be) in Latin letters. */
export function romanize(text: string): string | null {
  let out = text;
  if (HANGUL.test(out)) out = romanizeHangul(out);
  if (KANA.test(out)) out = romanizeKana(out);
  if (CYRILLIC.test(out)) out = byLetter(out, CYRILLIC_TABLE);
  if (GREEK.test(out)) out = byLetter(out, GREEK_TABLE);
  return out === text ? null : out;
}

/** Whether a song is worth a pronunciation line: a good part of it is in another script. */
export function needsRomanization(lines: string[]): boolean {
  const sung = lines.filter((line) => line.trim());
  if (sung.length === 0) return false;
  return sung.filter((line) => HANGUL.test(line) || KANA.test(line) || CYRILLIC.test(line) || GREEK.test(line)).length / sung.length >= 0.3;
}
