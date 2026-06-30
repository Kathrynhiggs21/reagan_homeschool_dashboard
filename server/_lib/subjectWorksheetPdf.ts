/**
 * 2026-06-30 — Self-hosted subject worksheet PDF service.
 *
 * The kid-facing subject "Open" button used to bounce Reagan to an external
 * site (Khan / ReadWorks / IXL) that 404s, demands a login, or lands on a
 * generic homepage — and anything that looks like a timed test spikes her
 * anxiety. This service replaces that with a colorful, grade-5,
 * answer-it-on-paper printable PDF that we generate + host ourselves:
 *
 *   subject slug  ->  friendly seed  ->  generateWorksheet (LLM-first,
 *   deterministic fallback, never empty)  ->  renderAndStoreWorksheetPdf
 *   (the approved bright "Summer Adventure" style)  ->  S3  ->  cache row.
 *
 * Cache-first: repeated taps on the same subject the same "version" reuse the
 * stored PDF instead of re-billing the LLM. Bump WORKSHEET_PDF_CONTENT_VERSION
 * to invalidate every cached sheet at once (e.g. after a renderer change).
 *
 * Trauma-safe framing lives in the seed: titles read like an invitation
 * ("Math Time — Let's Explore!"), never "Test" / "Quiz" / "Assessment", and
 * the renderer already keeps scores/timers/answer-keys off the kid pages.
 *
 * The pure helpers (seedForSubject, normalizeSubjectSlug, topicKeyFor) are
 * exported separately so vitest can lock them without touching DB/LLM/S3.
 */
import {
  generateWorksheet,
  type WorksheetSeed,
} from "./worksheetGenerator";
import {
  renderAndStoreWorksheetPdf,
} from "./worksheetPdf";
import { countAnswerable, type WorksheetContent } from "@shared/worksheetTypes";
import {
  getWorksheetPdfCache,
  upsertWorksheetPdfCache,
} from "../db";

/**
 * Bump this whenever the renderer, prompt, or seed mapping changes in a way
 * that should invalidate every previously cached PDF. Acts as the third key
 * column so old rows simply stop matching.
 */
export const WORKSHEET_PDF_CONTENT_VERSION = 1;

/** Canonical kid-facing subject slugs we know how to seed. */
export type SubjectSlug =
  | "math"
  | "ela"
  | "reading"
  | "writing"
  | "science"
  | "social";

/** Collapse the many subject spellings we see into a canonical slug. */
export function normalizeSubjectSlug(raw?: string | null): SubjectSlug | "generic" {
  const s = (raw ?? "").toLowerCase().trim();
  if (!s) return "generic";
  if (/\bmath|measure|convert|conversion|volume|fraction|decimal|geometry|number/.test(s)) return "math";
  if (/\bwrit|essay|compose|narrative|haiku|poem|poetry/.test(s)) return "writing";
  if (/\bscience|spectrum|earth|matter|energy|ecosystem|cells?|weather/.test(s)) return "science";
  if (/\bsocial|history|geography|civics|\bmap\b/.test(s)) return "social";
  if (/\bread|novel|chapter|\bstory\b|comprehension/.test(s)) return "reading";
  if (/\bela|language|grammar|vocab|spelling|sentence/.test(s)) return "ela";
  return "generic";
}

/**
 * Slugify a free-text topic into a stable cache key. Empty/whitespace topics
 * collapse to "default" so the subject's generic sheet caches once.
 */
export function topicKeyFor(topic?: string | null): string {
  const t = (topic ?? "").toLowerCase().trim();
  if (!t) return "default";
  return (
    t
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 110) || "default"
  );
}

type FriendlyMeta = { title: string; subjectSlug: string; emoji: string };

/** Per-subject friendly, NON-test-sounding titles + the renderer's subjectSlug. */
const SUBJECT_META: Record<SubjectSlug | "generic", FriendlyMeta> = {
  math: { title: "Math Time — Let's Explore!", subjectSlug: "math", emoji: "✏️" },
  ela: { title: "Word Play — Language Fun", subjectSlug: "ela", emoji: "📚" },
  reading: { title: "Reading Adventure", subjectSlug: "reading", emoji: "📖" },
  writing: { title: "Writing Workshop", subjectSlug: "writing", emoji: "🖊️" },
  science: { title: "Science Discovery", subjectSlug: "science", emoji: "🔬" },
  social: { title: "Our World — Social Studies", subjectSlug: "social", emoji: "🗺️" },
  generic: { title: "Learning Time", subjectSlug: "generic", emoji: "🌟" },
};

/**
 * Build the worksheet seed for a subject (+ optional topic). Pure — no I/O.
 * Honors the trauma-safe rule: titles never say test/quiz/assessment.
 */
export function seedForSubject(input: {
  subject?: string | null;
  topic?: string | null;
  bookRef?: string | null;
}): WorksheetSeed & { _displayTitle: string } {
  const slug = normalizeSubjectSlug(input.subject);
  const meta = SUBJECT_META[slug];
  const topic = (input.topic ?? "").trim();
  // The block title drives the deterministic builder's keyword routing, so we
  // seed it with the friendly subject label + topic hint (no "test" words).
  const displayTitle = topic
    ? `${meta.title.split(" — ")[0]} — ${topic}`
    : meta.title;
  return {
    blockTitle: displayTitle,
    subjectSlug: meta.subjectSlug,
    topicHint: topic || null,
    bookRef: input.bookRef ?? null,
    _displayTitle: displayTitle,
  };
}

export interface SubjectWorksheetResult {
  url: string;
  storageKey: string;
  title: string;
  source: "llm" | "fallback";
  questionCount: number;
  cached: boolean;
}

/**
 * Dependency seams so tests can inject fakes for the generator / renderer /
 * cache without hitting the LLM, S3, or the database.
 */
export interface SubjectWorksheetDeps {
  getCache: typeof getWorksheetPdfCache;
  upsertCache: typeof upsertWorksheetPdfCache;
  generate: typeof generateWorksheet;
  renderAndStore: typeof renderAndStoreWorksheetPdf;
  contentVersion?: number;
}

const DEFAULT_DEPS: SubjectWorksheetDeps = {
  getCache: getWorksheetPdfCache,
  upsertCache: upsertWorksheetPdfCache,
  generate: generateWorksheet,
  renderAndStore: renderAndStoreWorksheetPdf,
  contentVersion: WORKSHEET_PDF_CONTENT_VERSION,
};

/**
 * Generate (or reuse the cached) self-hosted worksheet PDF for a subject.
 *
 * Flow:
 *   1. Normalize subject + topic into cache keys.
 *   2. Cache hit on (subject, topic, version) -> return immediately.
 *   3. Miss -> generateWorksheet (never empty) -> renderAndStoreWorksheetPdf
 *      -> upsert cache row -> return.
 *
 * Never throws on content (the generator always returns a usable worksheet);
 * propagates only genuine infrastructure errors (S3/DB) to the caller.
 */
export async function getOrCreateSubjectWorksheetPdf(
  input: {
    subject?: string | null;
    topic?: string | null;
    bookRef?: string | null;
    forDate?: string | null;
    generatedByUserId?: number | null;
    /** force a fresh render even on a cache hit */
    forceRefresh?: boolean;
  },
  deps: Partial<SubjectWorksheetDeps> = {},
): Promise<SubjectWorksheetResult> {
  const d: SubjectWorksheetDeps = { ...DEFAULT_DEPS, ...deps };
  const contentVersion = d.contentVersion ?? WORKSHEET_PDF_CONTENT_VERSION;

  const normalizedSubject = normalizeSubjectSlug(input.subject);
  const subjectSlug = SUBJECT_META[normalizedSubject].subjectSlug;
  const topicKey = topicKeyFor(input.topic);

  if (!input.forceRefresh) {
    const hit = await d.getCache({ subjectSlug, topicKey, contentVersion });
    if (hit) {
      return {
        url: hit.url,
        storageKey: hit.storageKey,
        title: hit.title,
        source: hit.source,
        questionCount: hit.questionCount ?? 0,
        cached: true,
      };
    }
  }

  const seed = seedForSubject(input);
  const { content, source } = await d.generate(seed);
  const finalContent: WorksheetContent = {
    ...content,
    // keep the friendly, non-test title even if the LLM renamed it
    title: seed._displayTitle,
    subjectSlug,
  };
  const questionCount = countAnswerable(finalContent);

  // printableId 0 keeps the storage path namespaced under the subject sheet;
  // we don't tie subject sheets to a dailyPrintables row.
  const stored = await d.renderAndStore(finalContent, {
    forDate: input.forDate || "today",
    printableId: 0,
    withAnswerKey: true,
    footerNote: "You've got this — answer right on the page!",
  });

  await d.upsertCache({
    subjectSlug,
    topicKey,
    contentVersion,
    title: finalContent.title,
    storageKey: stored.key,
    url: stored.url,
    source,
    questionCount,
    byteSize: 0,
    generatedByUserId: input.generatedByUserId ?? null,
  });

  return {
    url: stored.url,
    storageKey: stored.key,
    title: finalContent.title,
    source,
    questionCount,
    cached: false,
  };
}
