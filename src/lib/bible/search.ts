import { BOOKS, parseReference, type ParsedRef } from "@/lib/bible/catalog";
import type { Canon } from "@/lib/bible/load";

export type MatchMode = "word" | "phrase" | "all" | "any";
export type TestamentScope = "ALL" | "OT" | "NT";

export type VerseHit = {
  book: number;
  chapter: number;
  verse: number;
  text: string;
};

export type SearchOutcome = {
  hits: VerseHit[];
  total: number;
  capped: boolean;
};

const CAP = 800;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function wordForms(word: string): string[] {
  const w = word.toLowerCase();
  const set = new Set<string>([w]);
  if (w.length < 4) return [...set];
  if (w.endsWith("e")) {
    set.add(`${w}s`);
    set.add(`${w}d`);
    set.add(`${w.slice(0, -1)}ing`);
  } else if (w.endsWith("y") && w.length > 4) {
    const stem = w.slice(0, -1);
    set.add(`${stem}ies`);
    set.add(`${stem}ied`);
    set.add(`${w}ing`);
  } else {
    set.add(`${w}s`);
    set.add(`${w}es`);
    set.add(`${w}ed`);
    set.add(`${w}ing`);
  }
  return [...set];
}

function boundary(inner: string): string {
  return `(?:^|[^A-Za-z'])(?:${inner})(?![A-Za-z])`;
}

function piecesFor(query: string, mode: MatchMode, withForms: boolean): string[] {
  const phrase = query.trim();
  if (mode === "phrase") return [escapeRegExp(phrase)];
  const words = phrase.toLowerCase().split(/\s+/).filter(Boolean);
  return words.map((word) => {
    const alts = withForms ? wordForms(word) : [word];
    return alts.map(escapeRegExp).join("|");
  });
}

export function highlightRegex(query: string, mode: MatchMode, withForms: boolean): RegExp | null {
  const parts = piecesFor(query, mode, withForms);
  if (!parts.length || parts.some((part) => part.length === 0)) return null;
  const inner = mode === "phrase" ? parts[0]! : parts.join("|");
  return new RegExp(boundary(inner), "gi");
}

export function searchWords(
  canon: Canon,
  query: string,
  options: {
    mode: MatchMode;
    withForms: boolean;
    testament: TestamentScope;
    book: number | null;
  },
): SearchOutcome {
  const parts = piecesFor(query, options.mode, options.withForms);
  if (!parts.length || !query.trim()) return { hits: [], total: 0, capped: false };

  const testers =
    options.mode === "all"
      ? parts.map((part) => new RegExp(boundary(part), "i"))
      : [new RegExp(boundary(options.mode === "phrase" ? parts[0]! : parts.join("|")), "i")];

  const hits: VerseHit[] = [];
  let total = 0;
  let capped = false;

  for (let bi = 0; bi < canon.length; bi += 1) {
    const meta = BOOKS[bi];
    if (!meta) continue;
    if (options.book != null && bi !== options.book) continue;
    if (options.testament === "OT" && meta.testament !== "OT") continue;
    if (options.testament === "NT" && meta.testament !== "NT") continue;
    const chapters = canon[bi]?.chapters ?? [];
    for (let ci = 0; ci < chapters.length; ci += 1) {
      const verses = chapters[ci] ?? [];
      for (let vi = 0; vi < verses.length; vi += 1) {
        const text = verses[vi] ?? "";
        if (!text) continue;
        const ok = testers.every((tester) => {
          tester.lastIndex = 0;
          return tester.test(text);
        });
        if (!ok) continue;
        total += 1;
        if (hits.length < CAP) {
          hits.push({ book: bi, chapter: ci + 1, verse: vi + 1, text });
        } else {
          capped = true;
        }
      }
    }
  }

  return { hits, total, capped };
}

export function hitsFromRefs(canon: Canon, refs: string[]): { hits: VerseHit[]; missing: string[] } {
  const hits: VerseHit[] = [];
  const missing: string[] = [];
  for (const ref of refs) {
    const parsed = parseReference(ref);
    if (!parsed?.chapter) {
      missing.push(ref);
      continue;
    }
    const collected = hitsFromParsed(canon, parsed);
    if (!collected.length) missing.push(ref);
    else hits.push(...collected);
  }
  return { hits, missing };
}

export function hitsFromParsed(canon: Canon, parsed: ParsedRef): VerseHit[] {
  if (!parsed.chapter) return [];
  const verses = canon[parsed.book]?.chapters[parsed.chapter - 1];
  if (!verses?.length) return [];
  const start = parsed.start ?? 1;
  const end = parsed.end ?? parsed.start ?? verses.length;
  const from = Math.max(1, Math.min(start, end));
  const to = Math.min(verses.length, Math.max(start, end));
  const hits: VerseHit[] = [];
  for (let verse = from; verse <= to; verse += 1) {
    const text = verses[verse - 1];
    if (text) hits.push({ book: parsed.book, chapter: parsed.chapter, verse, text });
  }
  return hits;
}
