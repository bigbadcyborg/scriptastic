import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import {
  Bookmark,
  BookmarkCheck,
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Library,
  Search,
  Settings,
  Shuffle,
  Users,
  X,
} from "lucide-react";
import { BOOKS, SECTIONS, formatCitation, isFullBookQuery, parseReference, type ParsedRef } from "@/lib/bible/catalog";
import { loadBook, loadTranslation, type Canon } from "@/lib/bible/load";
import { CHAPTER_COUNTS } from "@/lib/bible/counts";
import { usePrefs, THEMES, type SavedVerse } from "@/lib/bible/prefs";
import { highlightRegex, hitsFromParsed, hitsFromRefs, searchWords, type MatchMode, type TestamentScope, type VerseHit } from "@/lib/bible/search";
import { TOPIC_GROUPS, TOPICS, topicById } from "@/lib/bible/topics";
import { TRANSLATIONS, translationById } from "@/lib/bible/translations";
import { UserButton } from "@/lib/auth/gates";
import { cn } from "@/lib/cn";

type Pane = "discover" | "topics" | "books" | "saved" | "results";
type Mobile = "find" | "read";

type Result =
  | { type: "word"; query: string; mode: MatchMode }
  | { type: "topic"; id: string }
  | { type: "ref"; parsed: ParsedRef; label: string };

type Reading = {
  book: number;
  chapter: number;
  focus?: number;
  focusEnd?: number;
};

const MODES: { id: MatchMode; label: string }[] = [
  { id: "word", label: "Whole word" },
  { id: "phrase", label: "Phrase" },
  { id: "all", label: "All words" },
  { id: "any", label: "Any word" },
];

function Highlight({ text, regex }: { text: string; regex: RegExp | null }) {
  if (!regex) return <>{text}</>;
  const flags = regex.flags.includes("g") ? regex.flags : `${regex.flags}g`;
  const re = new RegExp(regex.source, flags);
  const nodes: ReactNode[] = [];
  let last = 0;
  for (const match of text.matchAll(re)) {
    const index = match.index ?? 0;
    const value = match[0] ?? "";
    if (!value) break;
    if (index > last) nodes.push(text.slice(last, index));
    const lead = value.match(/^[^A-Za-z']*/)?.[0] ?? "";
    const word = value.slice(lead.length);
    if (lead) nodes.push(lead);
    nodes.push(<mark key={`${index}-${word}`}>{word}</mark>);
    last = index + value.length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return <>{nodes}</>;
}

export function Scriptastic({ role }: { role: "admin" | "member" }) {
  const prefs = usePrefs();
  const [canon, setCanon] = useState<Canon | null>(null);
  const [bookText, setBookText] = useState<string[][] | null>(null);
  const [indexing, setIndexing] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [pane, setPane] = useState<Pane>("discover");
  const [mobile, setMobile] = useState<Mobile>("find");
  const [result, setResult] = useState<Result | null>(null);
  const [reading, setReading] = useState<Reading>({ book: 42, chapter: 1, focus: 1, focusEnd: 1 });
  const [matchMode, setMatchMode] = useState<MatchMode>("word");
  const [withForms, setWithForms] = useState(false);
  const [testament, setTestament] = useState<TestamentScope>("ALL");
  const [bookScope, setBookScope] = useState<number | null>(null);
  const [topicGroup, setTopicGroup] = useState<(typeof TOPIC_GROUPS)[number] | "All">("All");
  const [pickedBook, setPickedBook] = useState<number | null>(42);
  const [limit, setLimit] = useState(40);
  const [notice, setNotice] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!prefs.hydrated) return;
    let cancel = false;
    setBookText(null);
    loadBook(prefs.translation, reading.book)
      .then((chapters) => {
        if (!cancel) setBookText(chapters);
      })
      .catch(() => {
        if (!cancel) setError("This chapter could not be opened.");
      });
    return () => {
      cancel = true;
    };
  }, [prefs.hydrated, prefs.translation, reading.book]);

  useEffect(() => {
    if (!prefs.hydrated) return;
    let cancel = false;
    setIndexing(true);
    setCanon(null);
    setError(null);
    loadTranslation(prefs.translation)
      .then((next) => {
        if (cancel) return;
        setCanon(next);
        setIndexing(false);
      })
      .catch(() => {
        if (cancel) return;
        setCanon(null);
        setError("This translation could not be opened. Try another.");
        setIndexing(false);
      });
    return () => {
      cancel = true;
    };
  }, [prefs.hydrated, prefs.translation]);

  useEffect(() => {
    if (!reading.focus || reading.focus <= 1) return;
    const node = document.getElementById(`verse-${reading.book}-${reading.chapter}-${reading.focus}`);
    const scroller = document.querySelector("[data-reader]");
    if (!node || !(scroller instanceof HTMLElement)) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const top =
      node.getBoundingClientRect().top -
      scroller.getBoundingClientRect().top +
      scroller.scrollTop -
      16;
    scroller.scrollTo({ top: Math.max(0, top), behavior: reduce ? "auto" : "smooth" });
  }, [reading.book, reading.chapter, reading.focus, prefs.translation]);

  useEffect(() => {
    if (!prefs.hydrated) return;
    document.documentElement.dataset.theme = prefs.theme;
  }, [prefs.hydrated, prefs.theme]);

  useEffect(() => {
    if (!settingsOpen) return;
    settingsRef.current?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setSettingsOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [settingsOpen]);

  const outcome = useMemo(() => {
    if (!canon || !result) return null;
    if (result.type === "word") {
      return searchWords(canon, result.query, {
        mode: result.mode,
        withForms,
        testament,
        book: bookScope,
      });
    }
    if (result.type === "topic") {
      const topic = topicById(result.id);
      if (!topic) return { hits: [], total: 0, capped: false };
      const { hits } = hitsFromRefs(canon, topic.refs);
      return { hits, total: hits.length, capped: false };
    }
    const hits = hitsFromParsed(canon, result.parsed);
    return { hits, total: hits.length, capped: false };
  }, [canon, result, withForms, testament, bookScope]);

  const visible = outcome?.hits.slice(0, limit) ?? [];
  const regex =
    result?.type === "word" ? highlightRegex(result.query, result.mode, withForms) : null;
  const translation = translationById(prefs.translation);
  const live = parseReference(draft);
  const [lead, setLead] = useState<string | null>(null);

  useEffect(() => {
    if (!prefs.hydrated) return;
    let cancel = false;
    loadBook(prefs.translation, 42)
      .then((chapters) => {
        if (!cancel) setLead(chapters[0]?.[0] ?? null);
      })
      .catch(() => {
        if (!cancel) setLead(null);
      });
    return () => {
      cancel = true;
    };
  }, [prefs.hydrated, prefs.translation]);

  function rememberAnd(query: string) {
    prefs.remember(query);
  }

  function openReading(next: Reading, side: Mobile) {
    const maxChapter = CHAPTER_COUNTS[next.book] ?? next.chapter;
    const chapter = Math.min(Math.max(1, next.chapter), Math.max(1, maxChapter));
    setReading({ ...next, chapter });
    setMobile(side);
  }

  function openParsed(parsed: ParsedRef, labelFrom?: string) {
    if (!parsed.chapter) {
      setPickedBook(parsed.book);
      setPane("books");
      setMobile("find");
      return;
    }
    const maxChapter = CHAPTER_COUNTS[parsed.book] ?? parsed.chapter;
    if (parsed.chapter > maxChapter) {
      setNotice(`${BOOKS[parsed.book]?.name ?? "That book"} has ${maxChapter} chapters.`);
      return;
    }
    const label =
      labelFrom ??
      formatCitation(parsed.book, parsed.chapter, parsed.start, parsed.end ?? parsed.start);
    setNotice(null);
    setResult({ type: "ref", parsed, label });
    setPane("results");
    setLimit(120);
    openReading(
      {
        book: parsed.book,
        chapter: parsed.chapter,
        focus: parsed.start,
        focusEnd: parsed.end ?? parsed.start,
      },
      "read",
    );
  }

  function runWord(raw: string) {
    const query = raw.trim();
    const parsed = parseReference(query);
    if (parsed?.chapter) {
      openParsed(parsed);
      rememberAnd(query);
      setDraft(query);
      return;
    }
    if (query.length < 2) {
      setNotice("Enter at least two letters, or a reference such as Psalm 23.");
      return;
    }
    let mode = matchMode;
    if (mode === "word" && /\s/.test(query)) mode = "phrase";
    setMatchMode(mode);
    setNotice(null);
    setResult({ type: "word", query, mode });
    setPane("results");
    setMobile("find");
    setLimit(40);
    rememberAnd(query);
    setDraft(query);
  }

  function openTopic(id: string) {
    const topic = topicById(id);
    if (!topic || !canon) return;
    const { hits } = hitsFromRefs(canon, topic.refs);
    setResult({ type: "topic", id });
    setPane("results");
    setMobile("find");
    setLimit(80);
    setNotice(null);
    const first = hits[0];
    if (first) {
      openReading({ book: first.book, chapter: first.chapter, focus: first.verse, focusEnd: first.verse }, "find");
    }
  }

  function focusHit(hit: VerseHit) {
    openReading({ book: hit.book, chapter: hit.chapter, focus: hit.verse, focusEnd: hit.verse }, "read");
  }

  async function copyHit(hit: VerseHit) {
    const id = `${hit.book}:${hit.chapter}:${hit.verse}`;
    const line = `${formatCitation(hit.book, hit.chapter, hit.verse)} (${translation.label}) ${hit.text}`;
    try {
      await navigator.clipboard.writeText(line);
      setCopied(id);
      window.setTimeout(() => setCopied((current) => (current === id ? null : current)), 1400);
    } catch {
      setNotice("Copy isn’t available in this browser.");
    }
  }

  function saveHit(hit: VerseHit) {
    const entry: SavedVerse = {
      id: `${prefs.translation}:${hit.book}:${hit.chapter}:${hit.verse}`,
      translation: prefs.translation,
      book: hit.book,
      chapter: hit.chapter,
      verse: hit.verse,
      text: hit.text,
    };
    prefs.toggleSaved(entry);
  }

  function isSaved(hit: VerseHit) {
    return prefs.saved.some((item) => item.id === `${prefs.translation}:${hit.book}:${hit.chapter}:${hit.verse}`);
  }

  function surprise() {
    const book = Math.floor(Math.random() * 66);
    const chapterTotal = CHAPTER_COUNTS[book] ?? 1;
    const chapter = 1 + Math.floor(Math.random() * chapterTotal);
    void loadBook(prefs.translation, book).then((chapters) => {
      const verses = chapters[chapter - 1] ?? [];
      if (!verses.length) return;
      const verse = 1 + Math.floor(Math.random() * verses.length);
      const parsed: ParsedRef = {
        book,
        chapter,
        start: verse,
        end: verse,
        alias: BOOKS[book]?.name.toLowerCase() ?? "",
      };
      openParsed(parsed);
    });
  }

  const activeBook = BOOKS[reading.book];
  const chapterVerses = bookText?.[reading.chapter - 1] ?? [];
  const psalmNote =
    reading.book === 18 && prefs.translation === "dra"
      ? "Douay-Rheims numbers the Psalms from the Vulgate, so a psalm here may not be the same poem as in the King James."
      : null;

  return (
    <div className="relative z-10 min-h-screen" data-type-scale={prefs.scale}>
      <header className="relative overflow-hidden border-b border-line">
        <svg className="orbits pointer-events-none absolute inset-x-0 top-0 h-40 w-full" viewBox="0 0 768 160" preserveAspectRatio="none" aria-hidden="true">
          <ellipse cx="70" cy="78" rx="680" ry="34" fill="none" stroke="currentColor" strokeWidth="0.7" />
          <ellipse cx="70" cy="78" rx="540" ry="26" fill="none" stroke="currentColor" strokeWidth="0.7" />
          <ellipse cx="70" cy="78" rx="400" ry="18" fill="none" stroke="currentColor" strokeWidth="0.7" />
          <ellipse cx="70" cy="78" rx="270" ry="12" fill="none" stroke="currentColor" strokeWidth="0.7" />
        </svg>
        <div className="relative mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-4 sm:px-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-medium tracking-widest text-faint uppercase">Holy Bible</p>
              <h1 className="font-serif text-4xl leading-none font-medium tracking-tight text-balance">
                Scriptastic
              </h1>
              <p className="mt-2 text-sm text-muted">{translation.name}</p>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                className="inline-flex h-11 items-center gap-2 rounded-sm border border-line bg-inset px-3 text-sm text-fg transition-opacity duration-150 hover:opacity-80"
                onClick={surprise}
              >
                <Shuffle className="size-4" aria-hidden="true" />
                Open a verse
              </button>
              <button
                type="button"
                aria-pressed={pane === "saved"}
                aria-label={
                  prefs.saved.length
                    ? `Saved, ${prefs.saved.length} verse${prefs.saved.length === 1 ? "" : "s"}`
                    : "Saved"
                }
                className={cn(
                  "inline-flex h-11 items-center gap-2 rounded-sm border px-3 text-sm font-medium",
                  pane === "saved" ? "border-transparent bg-accent text-accent-fg" : "border-line bg-inset text-fg",
                )}
                onClick={() => {
                  setPane("saved");
                  setMobile("find");
                  setSettingsOpen(false);
                }}
              >
                {pane === "saved" ? (
                  <BookmarkCheck className="size-4" aria-hidden="true" />
                ) : (
                  <Bookmark className="size-4" aria-hidden="true" />
                )}
                Saved
                {prefs.saved.length ? (
                  <span className="tabular-nums">{prefs.saved.length}</span>
                ) : null}
              </button>
              <button
                type="button"
                aria-haspopup="dialog"
                aria-expanded={settingsOpen}
                className="inline-flex h-11 items-center gap-2 rounded-sm border border-line bg-inset px-3 text-sm text-fg transition-opacity duration-150 hover:opacity-80"
                onClick={() => setSettingsOpen(true)}
              >
                <Settings className="size-4" aria-hidden="true" />
                Settings
              </button>
              {role === "admin" ? (
                <Link
                  to="/accounts"
                  className="inline-flex h-11 items-center gap-2 rounded-sm border border-line bg-inset px-3 text-sm text-fg transition-opacity duration-150 hover:opacity-80"
                >
                  <Users className="size-4" aria-hidden="true" />
                  Accounts
                </Link>
              ) : null}
              <div className="identity-chip flex h-11 items-center rounded-sm border border-line bg-inset px-3">
                <UserButton />
              </div>
              <div className="flex h-11 items-center rounded-sm border border-line bg-inset">
                <button
                  type="button"
                  className="h-11 px-3 text-sm text-muted disabled:opacity-40"
                  aria-label="Smaller type"
                  disabled={prefs.scale === 1}
                  onClick={() => prefs.setScale(prefs.scale === 3 ? 2 : 1)}
                >
                  A
                </button>
                <button
                  type="button"
                  className="h-11 border-l border-line px-3 text-lg text-fg disabled:opacity-40"
                  aria-label="Larger type"
                  disabled={prefs.scale === 3}
                  onClick={() => prefs.setScale(prefs.scale === 1 ? 2 : 3)}
                >
                  A
                </button>
              </div>
            </div>
          </div>

          <form
            className="flex flex-col gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              runWord(draft);
            }}
          >
            <div className="flex flex-col gap-2 sm:flex-row">
              <label className="relative min-w-0 flex-1">
                <span className="sr-only">Search the Bible</span>
                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-faint" aria-hidden="true" />
                <input
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder="A word, a phrase, or John 3:16"
                  className="h-12 w-full rounded-md border border-line-strong bg-inset pr-3 pl-10 text-base text-fg placeholder:text-faint"
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck={false}
                />
              </label>
              <button
                type="submit"
                className="h-12 rounded-md bg-accent px-5 text-sm font-medium text-accent-fg transition-opacity duration-150 hover:opacity-90"
              >
                Search
              </button>
            </div>
            {live?.chapter ? (
              <button
                type="button"
                className="self-start text-sm text-fg underline decoration-line-strong underline-offset-4"
                onClick={() => {
                  openParsed(live);
                  rememberAnd(draft.trim());
                }}
              >
                Open {formatCitation(live.book, live.chapter, live.start, live.end ?? live.start)}
              </button>
            ) : live && isFullBookQuery(live) ? (
              <button
                type="button"
                className="self-start text-sm text-fg underline decoration-line-strong underline-offset-4"
                onClick={() => openParsed(live)}
              >
                Browse {BOOKS[live.book]?.name}
              </button>
            ) : null}
          </form>
          {notice ? <p className="text-sm text-muted">{notice}</p> : null}
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-2">
        <section className={cn("min-w-0", mobile === "find" ? "block" : "hidden lg:block")} aria-label="Find">
          <nav className="mb-3 flex gap-2 overflow-x-auto" aria-label="Ways to look">
            {(
              [
                ["discover", "Discover"],
                ["topics", "Categories"],
                ["books", "Books"],
                ["saved", `Saved${prefs.saved.length ? ` ${prefs.saved.length}` : ""}`],
                ["results", "Results"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                aria-pressed={pane === id}
                className={cn(
                  "h-11 shrink-0 rounded-full px-4 text-sm font-medium",
                  pane === id ? "bg-accent text-accent-fg" : "border border-line text-muted",
                )}
                onClick={() => {
                  setPane(id);
                  setMobile("find");
                }}
              >
                {label}
              </button>
            ))}
          </nav>

          <div className="mb-4 flex flex-col gap-2">
            <div className="flex flex-wrap gap-1">
              {MODES.map((mode) => (
                <button
                  key={mode.id}
                  type="button"
                  aria-pressed={matchMode === mode.id}
                  className={cn(
                    "h-10 rounded-full px-3 text-sm",
                    matchMode === mode.id ? "bg-raised text-fg" : "text-muted",
                  )}
                  onClick={() => {
                    setMatchMode(mode.id);
                    setResult((current) => (current?.type === "word" ? { ...current, mode: mode.id } : current));
                  }}
                >
                  {mode.label}
                </button>
              ))}
              <label className="inline-flex h-10 items-center gap-2 px-2 text-sm text-muted">
                <input
                  type="checkbox"
                  checked={withForms}
                  onChange={(event) => setWithForms(event.target.checked)}
                  className="size-4"
                />
                Word forms
              </label>
            </div>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ["ALL", "All"],
                  ["OT", "Old"],
                  ["NT", "New"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={testament === id}
                  className={cn(
                    "h-11 rounded-full border px-3 text-sm",
                    testament === id ? "border-line-strong bg-raised text-fg" : "border-line text-muted",
                  )}
                  onClick={() => setTestament(id)}
                >
                  {label}
                </button>
              ))}
              <label className="sr-only" htmlFor="book-scope">
                Limit to a book
              </label>
              <select
                id="book-scope"
                className="h-11 max-w-full rounded-sm border border-line bg-inset px-3 text-sm text-fg"
                value={bookScope ?? ""}
                onChange={(event) => setBookScope(event.target.value === "" ? null : Number(event.target.value))}
              >
                <option value="">All books</option>
                {BOOKS.map((book) => (
                  <option key={book.i} value={book.i}>
                    {book.name}
                  </option>
                ))}
              </select>
            </div>
            <p className="text-sm text-faint">
              {translation.name} · {translation.year}
            </p>
          </div>

          {pane === "discover" ? (
            <Discover
              opening={lead}
              translationLabel={translation.label}
              loading={!lead}
              recent={prefs.recent}
              onWord={runWord}
              onTopic={openTopic}
              onRef={(ref) => {
                const parsed = parseReference(ref);
                if (parsed) openParsed(parsed);
              }}
            />
          ) : null}

          {pane === "topics" ? (
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap gap-2">
                {(["All", ...TOPIC_GROUPS] as const).map((group) => (
                  <button
                    key={group}
                    type="button"
                    aria-pressed={topicGroup === group}
                    className={cn(
                      "h-10 rounded-full px-3 text-sm",
                      topicGroup === group ? "bg-raised text-fg" : "text-muted",
                    )}
                    onClick={() => setTopicGroup(group)}
                  >
                    {group}
                  </button>
                ))}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {TOPICS.filter((topic) => topicGroup === "All" || topic.group === topicGroup).map((topic) => (
                  <button
                    key={topic.id}
                    type="button"
                    onClick={() => openTopic(topic.id)}
                    className="rounded-lg border border-line bg-raised p-4 text-left transition-colors duration-150 hover:border-line-strong"
                  >
                    <p className="text-xs tracking-wide text-faint uppercase">{topic.group}</p>
                    <p className="mt-1 font-serif text-2xl leading-tight">{topic.name}</p>
                    <p className="mt-2 text-sm leading-relaxed text-muted">{topic.blurb}</p>
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {pane === "books" ? (
            <BookBrowser
              picked={pickedBook}
              onPick={setPickedBook}
              counts={CHAPTER_COUNTS}
              onChapter={(book, chapter) => {
                setNotice(null);
                setResult(null);
                openReading({ book, chapter, focus: 1, focusEnd: 1 }, "read");
              }}
            />
          ) : null}

          {pane === "saved" ? (
            <SavedList
              items={prefs.saved}
              onOpen={(item) => {
                if (item.translation !== prefs.translation) prefs.setTranslation(item.translation);
                openReading({ book: item.book, chapter: item.chapter, focus: item.verse, focusEnd: item.verse }, "read");
              }}
              onRemove={(item) => prefs.toggleSaved(item)}
            />
          ) : null}

          {pane === "results" ? (
            <Results
              result={result}
              outcome={outcome}
              visible={visible}
              regex={regex}
              loading={indexing && !canon}
              error={error}
              limit={limit}
              onMore={() => setLimit((value) => value + 40)}
              onOpen={focusHit}
              onCopy={copyHit}
              onSave={saveHit}
              isSaved={isSaved}
              copied={copied}
            />
          ) : null}
        </section>

        <section className={cn("min-w-0", mobile === "read" ? "block" : "hidden lg:block")} aria-label="Reading">
          <div className="mb-3 flex items-center justify-between lg:hidden">
            <button
              type="button"
              className="inline-flex h-11 items-center gap-1 text-sm text-muted"
              onClick={() => setMobile("find")}
            >
              <ChevronLeft className="size-4" aria-hidden="true" />
              Back to search
            </button>
          </div>
          <article
            data-reader
            className="rounded-xl border border-line bg-raised p-4 sm:p-5 lg:sticky lg:top-4 lg:max-h-[calc(100dvh-2rem)] lg:overflow-y-auto"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs tracking-wide text-faint uppercase">
                  {activeBook?.section} · {activeBook?.testament === "OT" ? "Old Testament" : "New Testament"}
                </p>
                <h2 className="font-serif text-3xl leading-tight font-medium">
                  {activeBook?.name} {reading.chapter}
                </h2>
                <p className="mt-1 text-sm text-muted">{translation.name}</p>
              </div>
              <div className="flex shrink-0 gap-2">
                <button
                  type="button"
                  className="inline-flex size-11 items-center justify-center rounded-sm border border-line text-fg disabled:opacity-40"
                  aria-label="Previous chapter"
                  disabled={reading.chapter <= 1}
                  onClick={() => openReading({ book: reading.book, chapter: reading.chapter - 1, focus: 1 }, "read")}
                >
                  <ChevronLeft className="size-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className="inline-flex size-11 items-center justify-center rounded-sm border border-line text-fg disabled:opacity-40"
                  aria-label="Next chapter"
                  disabled={reading.chapter >= (CHAPTER_COUNTS[reading.book] ?? 1)}
                  onClick={() => openReading({ book: reading.book, chapter: reading.chapter + 1, focus: 1 }, "read")}
                >
                  <ChevronRight className="size-4" aria-hidden="true" />
                </button>
              </div>
            </div>
            {psalmNote ? <p className="mt-3 text-sm leading-relaxed text-muted">{psalmNote}</p> : null}
            {!bookText ? (
              <p className="mt-6 text-sm text-muted">{error ?? "Opening this chapter…"}</p>
            ) : (
              <ol className="mt-5 flex flex-col gap-4">
                {chapterVerses.map((text, index) => {
                  const verse = index + 1;
                  const hit: VerseHit = { book: reading.book, chapter: reading.chapter, verse, text };
                  const focused =
                    reading.focus != null &&
                    verse >= reading.focus &&
                    verse <= (reading.focusEnd ?? reading.focus);
                  const saved = isSaved(hit);
                  const id = `${hit.book}:${hit.chapter}:${hit.verse}`;
                  return (
                    <li
                      key={verse}
                      id={`verse-${reading.book}-${reading.chapter}-${verse}`}
                      className={cn("rounded-md px-3 py-3", focused ? "bg-inset" : "")}
                    >
                      <div className="flex gap-3">
                        <span className="w-7 shrink-0 pt-1 text-right text-xs text-faint tabular-nums">{verse}</span>
                        <div className="min-w-0 flex-1">
                          <p className="scripture text-fg">
                            <Highlight text={text} regex={regex} />
                          </p>
                          <div className="mt-2 flex gap-2">
                            <button
                              type="button"
                              className="inline-flex h-10 items-center gap-1 rounded-sm px-2 text-xs text-muted"
                              onClick={() => copyHit(hit)}
                            >
                              {copied === id ? <Check className="size-3.5" aria-hidden="true" /> : <Copy className="size-3.5" aria-hidden="true" />}
                              {copied === id ? "Copied" : "Copy"}
                            </button>
                            <button
                              type="button"
                              className="inline-flex h-10 items-center gap-1 rounded-sm px-2 text-xs text-muted"
                              onClick={() => saveHit(hit)}
                              aria-pressed={saved}
                            >
                              {saved ? <BookmarkCheck className="size-3.5" aria-hidden="true" /> : <Bookmark className="size-3.5" aria-hidden="true" />}
                              {saved ? "Saved" : "Save"}
                            </button>
                          </div>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
            {bookText ? (
              <p className="mt-4 text-xs text-faint tabular-nums">{chapterVerses.length} verses</p>
            ) : null}
          </article>
        </section>
      </div>

      <footer className="mx-auto w-full max-w-6xl px-4 pb-10 text-sm leading-relaxed text-faint sm:px-6">
        Texts are public domain: King James, World English Bible, American Standard, Bible in Basic English,
        Young’s Literal, Darby, Geneva, and Douay-Rheims. Modern copyrighted versions such as NIV, ESV, and
        NLT are not included.
      </footer>
      {settingsOpen ? (
        <div className="fixed inset-0 z-40 flex items-end justify-center sm:items-center sm:p-6">
          <button
            type="button"
            className="absolute inset-0 bg-black/70"
            aria-label="Close settings"
            onClick={() => setSettingsOpen(false)}
          />
          <div
            ref={settingsRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-labelledby="settings-title"
            className="relative z-10 flex max-h-[min(85dvh,40rem)] w-full max-w-lg flex-col overflow-hidden rounded-t-xl border border-line bg-raised outline-none sm:rounded-xl"
          >
            <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
              <div>
                <p className="text-xs font-medium tracking-widest text-faint uppercase">Settings</p>
                <h2 id="settings-title" className="font-serif text-3xl leading-tight font-medium">
                  Settings
                </h2>
              </div>
              <button
                type="button"
                className="inline-flex size-11 items-center justify-center rounded-sm border border-line text-fg"
                aria-label="Close"
                onClick={() => setSettingsOpen(false)}
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </div>
            <div className="overflow-y-auto px-5 py-4">
              <section>
                <h3 className="text-xs font-medium tracking-widest text-faint uppercase">Theme</h3>
                <div className="mt-2 grid grid-cols-2 gap-2" role="radiogroup" aria-label="Theme">
                  {THEMES.map((item) => {
                    const active = item.id === prefs.theme;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        className={cn(
                          "rounded-lg border p-3 text-left",
                          active ? "border-line-strong bg-inset" : "border-line",
                        )}
                        onClick={() => prefs.setTheme(item.id)}
                      >
                        <span className="flex h-8 overflow-hidden rounded-sm border border-line" aria-hidden="true">
                          {item.swatch.map((color) => (
                            <span key={color} className="h-full flex-1" style={{ backgroundColor: color }} />
                          ))}
                        </span>
                        <span className="mt-2 flex items-center justify-between gap-2">
                          <span className="text-sm text-fg">{item.name}</span>
                          {active ? <Check className="size-3.5 shrink-0" aria-hidden="true" /> : null}
                        </span>
                        <span className="mt-0.5 block text-xs leading-relaxed text-muted">{item.note}</span>
                      </button>
                    );
                  })}
                </div>
              </section>
              <section className="mt-6">
                <h3 className="text-xs font-medium tracking-widest text-faint uppercase">Translation</h3>
                <ul className="mt-2 flex flex-col gap-2" role="radiogroup" aria-label="Bible translations">
                {TRANSLATIONS.map((item) => {
                  const active = item.id === prefs.translation;
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        role="radio"
                        aria-checked={active}
                        className={cn(
                          "flex w-full items-start gap-3 rounded-lg border p-4 text-left",
                          active ? "border-line-strong bg-inset" : "border-line",
                        )}
                        onClick={() => {
                          prefs.setTranslation(item.id);
                          setSettingsOpen(false);
                        }}
                      >
                        <span className="w-14 shrink-0 pt-0.5 text-sm font-medium">{item.label}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm text-fg">{item.name}</span>
                          <span className="mt-1 block text-sm leading-relaxed text-muted">
                            {item.note} · {item.year}
                          </span>
                        </span>
                        {active ? <Check className="mt-0.5 size-4 shrink-0" aria-hidden="true" /> : null}
                      </button>
                    </li>
                  );
                })}
                </ul>
              </section>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Discover({
  opening,
  translationLabel,
  loading,
  recent,
  onWord,
  onTopic,
  onRef,
}: {
  opening: string | null;
  translationLabel: string;
  loading: boolean;
  recent: string[];
  onWord: (word: string) => void;
  onTopic: (id: string) => void;
  onRef: (ref: string) => void;
}) {
  const featured = TOPICS.filter((topic) =>
    ["love", "faith", "comfort", "prayer", "jesus", "passage-shepherd", "passage-love", "passage-beatitudes"].includes(topic.id),
  );
  return (
    <div className="flex flex-col gap-6">
      <blockquote className="border-l border-line-strong pl-4 lg:hidden">
        <p className="scripture text-fg">
          {opening ?? (loading ? "Opening the canon…" : "In the beginning was the Word.")}
        </p>
        <footer className="mt-2 text-sm text-faint">John 1:1 · {translationLabel}</footer>
      </blockquote>
      {recent.length ? (
        <div>
          <p className="mb-2 text-xs tracking-wide text-faint uppercase">Recent</p>
          <div className="flex flex-wrap gap-2">
            {recent.map((item) => (
              <button
                key={item}
                type="button"
                className="h-10 rounded-full bg-inset px-3 text-sm text-muted"
                onClick={() => onWord(item)}
              >
                {item}
              </button>
            ))}
          </div>
        </div>
      ) : null}
      <div>
        <p className="mb-2 text-xs tracking-wide text-faint uppercase">Categories</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {featured.map((topic) => (
            <button
              key={topic.id}
              type="button"
              onClick={() => onTopic(topic.id)}
              className="rounded-lg border border-line p-4 text-left"
            >
              <p className="font-serif text-xl">{topic.name}</p>
              <p className="mt-1 text-sm text-muted">{topic.blurb}</p>
            </button>
          ))}
        </div>
      </div>
      <div>
        <p className="mb-2 text-xs tracking-wide text-faint uppercase">Open by reference</p>
        <div className="flex flex-col">
          {["Genesis 1", "Psalm 23", "Isaiah 53", "Matthew 5", "John 1", "1 Corinthians 13"].map((ref) => (
            <button
              key={ref}
              type="button"
              className="flex h-11 items-center justify-between border-t border-line text-left text-sm text-fg last:border-b"
              onClick={() => onRef(ref)}
            >
              {ref}
              <BookOpen className="size-4 text-faint" aria-hidden="true" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function BookBrowser({
  picked,
  onPick,
  counts,
  onChapter,
}: {
  picked: number | null;
  onPick: (book: number) => void;
  counts: number[];
  onChapter: (book: number, chapter: number) => void;
}) {
  return (
    <div className="flex flex-col gap-6">
      {(["OT", "NT"] as const).map((testament) => (
        <div key={testament}>
          <h2 className="mb-3 font-serif text-2xl">
            {testament === "OT" ? "Old Testament" : "New Testament"}
          </h2>
          {SECTIONS.filter((section) => section.testament === testament).map((section) => (
            <div key={section.name + section.from} className="mb-4">
              <p className="mb-2 text-xs tracking-wide text-faint uppercase">{section.name}</p>
              <div className="flex flex-col">
                {BOOKS.slice(section.from, section.to + 1).map((book) => {
                  const open = picked === book.i;
                  const chapters = counts[book.i] ?? 0;
                  return (
                    <div key={book.i} className="border-t border-line last:border-b">
                      <button
                        type="button"
                        className="flex h-12 w-full items-center justify-between text-left"
                        aria-expanded={open}
                        onClick={() => onPick(book.i)}
                      >
                        <span className="text-sm">{book.name}</span>
                        <span className="text-xs text-faint tabular-nums">{chapters ? `${chapters} ch` : book.short}</span>
                      </button>
                      {open && chapters > 0 ? (
                        <div className="flex flex-wrap gap-2 pb-3">
                          {Array.from({ length: chapters }, (_, index) => (
                            <button
                              key={index}
                              type="button"
                              className="inline-flex size-11 items-center justify-center rounded-sm border border-line text-sm tabular-nums"
                              onClick={() => onChapter(book.i, index + 1)}
                            >
                              {index + 1}
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function SavedList({
  items,
  onOpen,
  onRemove,
}: {
  items: SavedVerse[];
  onOpen: (item: SavedVerse) => void;
  onRemove: (item: SavedVerse) => void;
}) {
  if (!items.length) {
    return (
      <div className="rounded-lg border border-line p-5">
        <Library className="size-5 text-faint" aria-hidden="true" />
        <p className="mt-3 font-serif text-2xl">Nothing kept yet</p>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Save a verse while you read. It stays on this device.
        </p>
      </div>
    );
  }
  return (
    <ul className="flex flex-col gap-3">
      {items.map((item) => (
        <li key={item.id} className="rounded-lg border border-line p-4">
          <button
            type="button"
            className="block w-full text-left"
            aria-label={`Open ${formatCitation(item.book, item.chapter, item.verse)}`}
            onClick={() => onOpen(item)}
          >
            <p className="text-xs tracking-wide text-faint uppercase">
              {formatCitation(item.book, item.chapter, item.verse)} · {translationById(item.translation).label}
            </p>
            <p className="scripture mt-2 text-fg">
              {item.text}
            </p>
          </button>
          <button
            type="button"
            className="mt-2 h-10 text-xs text-muted"
            aria-label={`Remove ${formatCitation(item.book, item.chapter, item.verse)}`}
            onClick={() => onRemove(item)}
          >
            Remove
          </button>
        </li>
      ))}
    </ul>
  );
}

function Results({
  result,
  outcome,
  visible,
  regex,
  loading,
  error,
  limit,
  onMore,
  onOpen,
  onCopy,
  onSave,
  isSaved,
  copied,
}: {
  result: Result | null;
  outcome: { hits: VerseHit[]; total: number; capped: boolean } | null;
  visible: VerseHit[];
  regex: RegExp | null;
  loading: boolean;
  error: string | null;
  limit: number;
  onMore: () => void;
  onOpen: (hit: VerseHit) => void;
  onCopy: (hit: VerseHit) => void;
  onSave: (hit: VerseHit) => void;
  isSaved: (hit: VerseHit) => boolean;
  copied: string | null;
}) {
  if (!result) {
    return <p className="text-sm text-muted">Search a word or open a category to see verses here.</p>;
  }
  if (loading && !outcome) return <p className="text-sm text-muted">Opening the full text for search…</p>;
  if (error) return <p className="text-sm text-muted">{error}</p>;
  const topic = result.type === "topic" ? topicById(result.id) : null;
  const title =
    result.type === "word"
      ? `“${result.query}”`
      : result.type === "topic"
        ? (topic?.name ?? "Category")
        : result.label;
  const detail =
    result.type === "word"
      ? `${outcome?.total ?? 0} verse${outcome?.total === 1 ? "" : "s"}${outcome?.capped ? ", first 800 shown" : ""}`
      : result.type === "topic"
        ? (topic?.blurb ?? "")
        : "Passage";

  return (
    <div>
      <div className="mb-4">
        <h2 className="font-serif text-3xl leading-tight">{title}</h2>
        <p className="mt-1 text-sm text-muted" aria-live="polite">
          {detail}
        </p>
      </div>
      {!visible.length ? (
        <p className="text-sm leading-relaxed text-muted">
          No verses matched. Try a shorter word, switch to Phrase, or clear the testament filter.
        </p>
      ) : (
        <ol className="flex flex-col gap-3">
          {visible.map((hit) => {
            const id = `${hit.book}:${hit.chapter}:${hit.verse}`;
            const saved = isSaved(hit);
            return (
              <li key={`${hit.book}-${hit.chapter}-${hit.verse}-${id}`} className="rounded-lg border border-line p-4">
                <button type="button" className="block w-full text-left" onClick={() => onOpen(hit)}>
                  <p className="text-xs tracking-wide text-faint uppercase">
                    {formatCitation(hit.book, hit.chapter, hit.verse)}
                  </p>
                  <p className="scripture mt-2 text-fg">
                    <Highlight text={hit.text} regex={regex} />
                  </p>
                </button>
                <div className="mt-2 flex gap-2">
                  <button type="button" className="inline-flex h-10 items-center gap-1 text-xs text-muted" onClick={() => onCopy(hit)}>
                    {copied === id ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                    {copied === id ? "Copied" : "Copy"}
                  </button>
                  <button type="button" className="inline-flex h-10 items-center gap-1 text-xs text-muted" onClick={() => onSave(hit)} aria-pressed={saved}>
                    {saved ? <BookmarkCheck className="size-3.5" /> : <Bookmark className="size-3.5" />}
                    {saved ? "Saved" : "Save"}
                  </button>
                </div>
              </li>
            );
          })}
        </ol>
      )}
      {outcome && visible.length < outcome.hits.length && visible.length < limit + 40 ? (
        <button
          type="button"
          className="mt-4 h-11 rounded-sm border border-line px-4 text-sm text-fg"
          onClick={onMore}
        >
          Show more
        </button>
      ) : null}
      {outcome && outcome.total > outcome.hits.length ? (
        <p className="mt-3 text-sm text-muted">More verses match. Narrow the search to see them.</p>
      ) : null}
    </div>
  );
}
