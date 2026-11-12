export type Testament = "OT" | "NT";

export type BookMeta = {
  i: number;
  name: string;
  short: string;
  testament: Testament;
  section: string;
  aliases: string[];
};

function b(
  i: number,
  name: string,
  short: string,
  testament: Testament,
  section: string,
  aliases: string[],
): BookMeta {
  return { i, name, short, testament, section, aliases };
}

export const BOOKS: BookMeta[] = [
  b(0, "Genesis", "Gen", "OT", "Law", ["genesis", "gen", "ge", "gn"]),
  b(1, "Exodus", "Exod", "OT", "Law", ["exodus", "exod", "exo", "ex"]),
  b(2, "Leviticus", "Lev", "OT", "Law", ["leviticus", "lev", "lv"]),
  b(3, "Numbers", "Num", "OT", "Law", ["numbers", "num", "nm", "nb"]),
  b(4, "Deuteronomy", "Deut", "OT", "Law", ["deuteronomy", "deut", "deu", "dt"]),
  b(5, "Joshua", "Josh", "OT", "History", ["joshua", "josh", "jos"]),
  b(6, "Judges", "Judg", "OT", "History", ["judges", "judg", "jdg", "jg"]),
  b(7, "Ruth", "Ruth", "OT", "History", ["ruth", "rut"]),
  b(8, "1 Samuel", "1 Sam", "OT", "History", ["1 samuel", "1samuel", "1 sam", "1sam", "1 sa", "i samuel"]),
  b(9, "2 Samuel", "2 Sam", "OT", "History", ["2 samuel", "2samuel", "2 sam", "2sam", "2 sa", "ii samuel"]),
  b(10, "1 Kings", "1 Kgs", "OT", "History", ["1 kings", "1kings", "1 kgs", "1kgs", "1 ki", "i kings"]),
  b(11, "2 Kings", "2 Kgs", "OT", "History", ["2 kings", "2kings", "2 kgs", "2kgs", "2 ki", "ii kings"]),
  b(12, "1 Chronicles", "1 Chr", "OT", "History", ["1 chronicles", "1chronicles", "1 chr", "1chr", "1 ch", "i chronicles"]),
  b(13, "2 Chronicles", "2 Chr", "OT", "History", ["2 chronicles", "2chronicles", "2 chr", "2chr", "2 ch", "ii chronicles"]),
  b(14, "Ezra", "Ezra", "OT", "History", ["ezra", "ezr"]),
  b(15, "Nehemiah", "Neh", "OT", "History", ["nehemiah", "neh", "ne"]),
  b(16, "Esther", "Esth", "OT", "History", ["esther", "esth", "est", "et"]),
  b(17, "Job", "Job", "OT", "Wisdom", ["job", "jb"]),
  b(18, "Psalms", "Ps", "OT", "Wisdom", ["psalms", "psalm", "psa", "ps", "pss"]),
  b(19, "Proverbs", "Prov", "OT", "Wisdom", ["proverbs", "prov", "prv", "pr"]),
  b(20, "Ecclesiastes", "Eccl", "OT", "Wisdom", ["ecclesiastes", "eccles", "eccl", "ecc", "ec"]),
  b(21, "Song of Solomon", "Song", "OT", "Wisdom", [
    "song of solomon",
    "song of songs",
    "canticles",
    "canticle",
    "sos",
  ]),
  b(22, "Isaiah", "Isa", "OT", "Major Prophets", ["isaiah", "isa", "is"]),
  b(23, "Jeremiah", "Jer", "OT", "Major Prophets", ["jeremiah", "jer", "jr"]),
  b(24, "Lamentations", "Lam", "OT", "Major Prophets", ["lamentations", "lam", "la"]),
  b(25, "Ezekiel", "Ezek", "OT", "Major Prophets", ["ezekiel", "ezek", "eze", "ez"]),
  b(26, "Daniel", "Dan", "OT", "Major Prophets", ["daniel", "dan", "da", "dn"]),
  b(27, "Hosea", "Hos", "OT", "Minor Prophets", ["hosea", "hos", "ho"]),
  b(28, "Joel", "Joel", "OT", "Minor Prophets", ["joel", "joe", "jl"]),
  b(29, "Amos", "Amos", "OT", "Minor Prophets", ["amos", "amo", "am"]),
  b(30, "Obadiah", "Obad", "OT", "Minor Prophets", ["obadiah", "obad", "oba", "ob"]),
  b(31, "Jonah", "Jonah", "OT", "Minor Prophets", ["jonah", "jon"]),
  b(32, "Micah", "Mic", "OT", "Minor Prophets", ["micah", "mic", "mi"]),
  b(33, "Nahum", "Nah", "OT", "Minor Prophets", ["nahum", "nah", "na"]),
  b(34, "Habakkuk", "Hab", "OT", "Minor Prophets", ["habakkuk", "habakuk", "hab", "hk"]),
  b(35, "Zephaniah", "Zeph", "OT", "Minor Prophets", ["zephaniah", "zeph", "zep"]),
  b(36, "Haggai", "Hag", "OT", "Minor Prophets", ["haggai", "hag", "hg"]),
  b(37, "Zechariah", "Zech", "OT", "Minor Prophets", ["zechariah", "zech", "zec", "zc"]),
  b(38, "Malachi", "Mal", "OT", "Minor Prophets", ["malachi", "mal", "ml"]),
  b(39, "Matthew", "Matt", "NT", "Gospels", ["matthew", "matt", "mat", "mt"]),
  b(40, "Mark", "Mark", "NT", "Gospels", ["mark", "mrk", "mk"]),
  b(41, "Luke", "Luke", "NT", "Gospels", ["luke", "luk", "lk"]),
  b(42, "John", "John", "NT", "Gospels", ["john", "joh", "jn"]),
  b(43, "Acts", "Acts", "NT", "History", ["acts", "act", "ac"]),
  b(44, "Romans", "Rom", "NT", "Letters", ["romans", "rom", "ro", "rm"]),
  b(45, "1 Corinthians", "1 Cor", "NT", "Letters", ["1 corinthians", "1corinthians", "1 cor", "1cor", "1 co", "i corinthians"]),
  b(46, "2 Corinthians", "2 Cor", "NT", "Letters", ["2 corinthians", "2corinthians", "2 cor", "2cor", "2 co", "ii corinthians"]),
  b(47, "Galatians", "Gal", "NT", "Letters", ["galatians", "gal", "ga"]),
  b(48, "Ephesians", "Eph", "NT", "Letters", ["ephesians", "eph", "ep"]),
  b(49, "Philippians", "Phil", "NT", "Letters", ["philippians", "phil", "php", "pp"]),
  b(50, "Colossians", "Col", "NT", "Letters", ["colossians", "col", "co"]),
  b(51, "1 Thessalonians", "1 Thess", "NT", "Letters", [
    "1 thessalonians",
    "1thessalonians",
    "1 thess",
    "1thess",
    "1 th",
    "i thessalonians",
  ]),
  b(52, "2 Thessalonians", "2 Thess", "NT", "Letters", [
    "2 thessalonians",
    "2thessalonians",
    "2 thess",
    "2thess",
    "2 th",
    "ii thessalonians",
  ]),
  b(53, "1 Timothy", "1 Tim", "NT", "Letters", ["1 timothy", "1timothy", "1 tim", "1tim", "1 ti", "i timothy"]),
  b(54, "2 Timothy", "2 Tim", "NT", "Letters", ["2 timothy", "2timothy", "2 tim", "2tim", "2 ti", "ii timothy"]),
  b(55, "Titus", "Titus", "NT", "Letters", ["titus", "tit", "ti"]),
  b(56, "Philemon", "Phlm", "NT", "Letters", ["philemon", "phlm", "phm", "pm"]),
  b(57, "Hebrews", "Heb", "NT", "Letters", ["hebrews", "heb", "he"]),
  b(58, "James", "Jas", "NT", "General Letters", ["james", "jas", "jm"]),
  b(59, "1 Peter", "1 Pet", "NT", "General Letters", ["1 peter", "1peter", "1 pet", "1pet", "1 pe", "i peter"]),
  b(60, "2 Peter", "2 Pet", "NT", "General Letters", ["2 peter", "2peter", "2 pet", "2pet", "2 pe", "ii peter"]),
  b(61, "1 John", "1 John", "NT", "General Letters", ["1 john", "1john", "1 jn", "1jn", "i john"]),
  b(62, "2 John", "2 John", "NT", "General Letters", ["2 john", "2john", "2 jn", "2jn", "ii john"]),
  b(63, "3 John", "3 John", "NT", "General Letters", ["3 john", "3john", "3 jn", "3jn", "iii john"]),
  b(64, "Jude", "Jude", "NT", "General Letters", ["jude", "jud", "jd"]),
  b(65, "Revelation", "Rev", "NT", "Apocalypse", ["revelation", "revelations", "rev", "apocalypse", "apoc"]),
];

export const SECTIONS: { testament: Testament; name: string; from: number; to: number }[] = [
  { testament: "OT", name: "Law", from: 0, to: 4 },
  { testament: "OT", name: "History", from: 5, to: 16 },
  { testament: "OT", name: "Wisdom", from: 17, to: 21 },
  { testament: "OT", name: "Major Prophets", from: 22, to: 26 },
  { testament: "OT", name: "Minor Prophets", from: 27, to: 38 },
  { testament: "NT", name: "Gospels", from: 39, to: 42 },
  { testament: "NT", name: "History", from: 43, to: 43 },
  { testament: "NT", name: "Letters", from: 44, to: 57 },
  { testament: "NT", name: "General Letters", from: 58, to: 64 },
  { testament: "NT", name: "Apocalypse", from: 65, to: 65 },
];

const ALIAS_INDEX: { alias: string; book: number }[] = BOOKS.flatMap((book) =>
  book.aliases.map((alias) => ({ alias, book: book.i })),
).sort((a, b) => b.alias.length - a.alias.length);

export type ParsedRef = {
  book: number;
  chapter?: number;
  start?: number;
  end?: number;
  /** Alias that matched, used to tell a full book name from a short code. */
  alias: string;
};

function normalizeQuery(input: string): string {
  let s = input
    .toLowerCase()
    .replace(/[.’']/g, "")
    .replace(/\./g, "")
    .replace(/\s+/g, " ")
    .trim();
  s = s.replace(/^(the|book of)\s+/, "");
  s = s.replace(/\b(first|1st)\b/g, "1");
  s = s.replace(/\b(second|2nd)\b/g, "2");
  s = s.replace(/\b(third|3rd)\b/g, "3");
  s = s.replace(/^(iii|ii|i)\s+/, (m) => {
    const map: Record<string, string> = { i: "1 ", ii: "2 ", iii: "3 " };
    return map[m.trim()] ?? m;
  });
  return s;
}

export function parseReference(input: string): ParsedRef | null {
  const s = normalizeQuery(input);
  if (!s) return null;
  let match: { alias: string; book: number } | null = null;
  for (const entry of ALIAS_INDEX) {
    if (s === entry.alias || s.startsWith(`${entry.alias} `)) {
      match = entry;
      break;
    }
  }
  if (!match) return null;
  const rest = s.slice(match.alias.length).trim();
  if (!rest) return { book: match.book, alias: match.alias };
  const numbered =
    rest.match(/^(\d+)\s*[:]\s*(\d+)\s*[-–—]\s*(\d+)$/) ??
    rest.match(/^(\d+)\s+(\d+)\s*[-–—]\s*(\d+)$/) ??
    rest.match(/^(\d+)\s*[:]\s*(\d+)$/) ??
    rest.match(/^(\d+)\s+(\d+)$/) ??
    rest.match(/^(\d+)$/);
  if (!numbered) return null;
  const chapter = Number(numbered[1]);
  const start = numbered[2] ? Number(numbered[2]) : undefined;
  const end = numbered[3] ? Number(numbered[3]) : undefined;
  if (!chapter || chapter < 1) return null;
  return { book: match.book, chapter, start, end, alias: match.alias };
}

export function isFullBookQuery(parsed: ParsedRef): boolean {
  const book = BOOKS[parsed.book];
  if (!book) return false;
  return parsed.alias === book.name.toLowerCase() || parsed.alias.length >= 5;
}

export function formatCitation(
  book: number,
  chapter: number,
  verse?: number,
  end?: number,
): string {
  const name = BOOKS[book]?.name ?? "Unknown";
  if (!verse) return `${name} ${chapter}`;
  if (end && end > verse) return `${name} ${chapter}:${verse}–${end}`;
  return `${name} ${chapter}:${verse}`;
}
