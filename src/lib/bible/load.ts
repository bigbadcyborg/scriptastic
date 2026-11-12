import { previewPathPrefix } from "@/lib/preview-path-prefix";

export type BibleBook = {
  abbrev: string;
  chapters: string[][];
};

export type Canon = BibleBook[];

const bookCache = new Map<string, Promise<string[][]>>();
const canonCache = new Map<string, Promise<Canon>>();

function assetUrl(path: string): string {
  if (typeof window === "undefined") return path;
  const prefix = previewPathPrefix(window.location.hostname, window.location.pathname);
  return prefix ? `${prefix}${path}` : path;
}

export function loadBook(translation: string, index: number): Promise<string[][]> {
  const key = `${translation}:${index}`;
  const existing = bookCache.get(key);
  if (existing) return existing;
  const pending = fetch(assetUrl(`/bibles/${translation}/${index}.json`))
    .then(async (response) => {
      if (!response.ok) throw new Error(`Could not open ${translation} book ${index}`);
      return (await response.json()) as string[][];
    })
    .catch((error: unknown) => {
      bookCache.delete(key);
      throw error;
    });
  bookCache.set(key, pending);
  return pending;
}

export function loadTranslation(id: string): Promise<Canon> {
  const existing = canonCache.get(id);
  if (existing) return existing;
  const pending = Promise.all(Array.from({ length: 66 }, (_, index) => loadBook(id, index)))
    .then((books) => books.map((chapters) => ({ abbrev: String(chapters.length), chapters })))
    .catch((error: unknown) => {
      canonCache.delete(id);
      throw error;
    });
  canonCache.set(id, pending);
  return pending;
}

export function verseText(
  canon: Canon,
  book: number,
  chapter: number,
  verse: number,
): string | null {
  const line = canon[book]?.chapters[chapter - 1]?.[verse - 1];
  return line ?? null;
}
