/**
 * Assemble a `AgendaPdfInput` payload for a given school date by reading
 * the daily plan, blocks, book assignments, tutor of day, and yesterday's
 * tutor notes. Pure read; no side effects.
 */
import * as db from "../db";
import { resolveTutorOfDay } from "./tutorOfDay";
import type { AgendaPdfInput, AgendaPdfBlock } from "./agendaPdf";
import { hydrateLessonForBlock } from "./hydrateLessonForBlock";
import {
  buildReadingBlock,
  buildAdventureBlock,
  buildPracticeBlock,
  OWNED_BOOKS,
  type OwnedBookSlug,
  type AdventureTheme,
  type GeneratedBlock,
} from "./blockGenerators";
import type { PracticeSubject } from "./practiceLibrary";

/**
 * Push 74 (2026-05-13) — derive an OWNED_BOOKS slug from a book title.
 * Match is case-insensitive substring so "Tuck Everlasting" maps cleanly
 * regardless of whether the row stored "Tuck Everlasting (paperback)".
 */
function matchOwnedBookSlug(title: string | null | undefined): OwnedBookSlug | null {
  if (!title) return null;
  const t = title.toLowerCase();
  for (const slug of Object.keys(OWNED_BOOKS) as OwnedBookSlug[]) {
    const ref = OWNED_BOOKS[slug].title.toLowerCase();
    if (t.includes(ref) || ref.includes(t)) return slug;
  }
  return null;
}

/**
 * Map a scheduleBlocks subject slug or name to a PracticeSubject. Defaults
 * to "math" because that's the most common practice block — callers should
 * still narrow before relying on the result.
 */
function matchPracticeSubject(subjectName: string | null | undefined): PracticeSubject | null {
  const n = (subjectName ?? "").toLowerCase();
  if (!n) return null;
  if (n.includes("math")) return "math";
  if (n.includes("ela") || n.includes("language") || n.includes("reading")) return "ela";
  if (n.includes("science")) return "science";
  if (n.includes("social") || n.includes("history")) return "social";
  if (n.includes("spell")) return "spelling";
  return null;
}

function safeGenerate(b: any, bookRef: { bookTitle: string; fromPage: number; toPage: number } | null): GeneratedBlock | null {
  const blockType = String(b?.blockType ?? "");
  try {
    if (blockType === "read_aloud" && bookRef) {
      const slug = matchOwnedBookSlug(bookRef.bookTitle);
      if (slug) {
        const span = Math.max(1, bookRef.toPage - bookRef.fromPage + 1);
        return buildReadingBlock({ bookSlug: slug, startPage: bookRef.fromPage, pagesPerDay: span });
      }
    }
    if (blockType === "adventure") {
      // Default to nature-scavenger if no specific theme available.
      const theme: AdventureTheme = "nature-scavenger";
      return buildAdventureBlock({ theme, durationMin: b?.durationMin ?? 30 });
    }
    if (blockType === "math") {
      const subj = matchPracticeSubject(b?.subjectName) ?? "math";
      return buildPracticeBlock({ subject: subj, seed: `${b?.id}` });
    }
  } catch {
    /* fall through */
  }
  return null;
}


function previousDateStr(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

function formatDayLabel(dateStr: string): string {
  try {
    return new Date(dateStr + "T12:00:00Z").toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
  } catch {
    return dateStr;
  }
}

export async function assembleAgendaForDate(dateStr: string): Promise<AgendaPdfInput | null> {
  const plan = await db.getPlanByDate(dateStr);
  if (!plan) return null;

  const blocksRaw = (await db.listBlocksForPlan(plan.id)) as any[];

  // Resolve curriculum topic codes for blocks anchored to a topic
  const topicIds = Array.from(new Set(blocksRaw.map((b) => b.curriculumTopicId).filter(Boolean)));
  const topicCodeById = new Map<number, string>();
  // Push 30 (2026-05-13): also fetch the plain-language title so the PDF can
  // print "Math · 5.OA.1 · Order of Operations" instead of just the code.
  const topicTitleById = new Map<number, string>();
  if (topicIds.length > 0) {
    try {
      const dbi = (await import("./../db")).getDb();
      const { sql } = await import("drizzle-orm");
      const idsList = topicIds.join(",");
      if (idsList.length > 0) {
        const [rows] = (await dbi.execute(sql.raw(`SELECT id, code, title FROM curriculumTopics WHERE id IN (${idsList})`))) as any;
        for (const r of rows ?? []) {
          topicCodeById.set(Number(r.id), String(r.code));
          if (r.title) topicTitleById.set(Number(r.id), String(r.title));
        }
      }
    } catch {
      // best-effort
    }
  }

  // Hydrate book assignments per block in parallel
  const bookRefsByBlockId = new Map<number, Array<{ bookTitle: string; fromPage: number; toPage: number }>>();
  // Hydrate lesson content (lesson_plan + worksheets + answer_key + videos)
  // per block in parallel. The PDF builder renders a per-block lesson page
  // when this is non-null, so without this hydration the nightly packet has
  // no worksheets / no answer keys.
  const lessonByBlockId = new Map<number, NonNullable<AgendaPdfBlock["lesson"]>>();
  await Promise.all(
    blocksRaw.map(async (b) => {
      try {
        const refs = await db.listBookAssignmentsForBlock(b.id);
        if (refs.length > 0) bookRefsByBlockId.set(b.id, refs);
      } catch {
        // ignore
      }
      try {
        const lesson = await hydrateLessonForBlock(b.id);
        if (lesson) lessonByBlockId.set(b.id, lesson);
      } catch {
        // ignore
      }
    }),
  );

  const blocks: AgendaPdfBlock[] = blocksRaw.map((b, i) => {
    const refs = bookRefsByBlockId.get(b.id) ?? [];
    const firstRef = refs[0] ?? null;
    const generated = safeGenerate(b, firstRef);
    return {
      sortOrder: (b.sortOrder ?? i) + 1, // 1-indexed for printout
      startTime: b.startTime ?? null,
      durationMin: b.durationMin ?? 30,
      subjectName: b.subjectName ?? null,
      subjectEmoji: b.emoji ?? null,
      title: b.title,
      description: b.description ?? null,
      curriculumTopicCode: b.curriculumTopicId ? topicCodeById.get(b.curriculumTopicId) ?? null : null,
      curriculumTopicTitle: b.curriculumTopicId ? topicTitleById.get(b.curriculumTopicId) ?? null : null,
      bookPageRefs: refs,
      printablesAttached: lessonByBlockId.get(b.id)?.worksheets?.length ?? 0,
      lesson: lessonByBlockId.get(b.id) ?? null,
      generated, // Push 74 (2026-05-13)
    };
  });

  // Tutor of the day
  let tutorName: string | null = null;
  let tutorArrival: string | null = null;
  let tutorDeparture: string | null = null;
  try {
    const t: any = await resolveTutorOfDay(dateStr);
    if (t) {
      tutorName = t.name ?? t.tutorName ?? null;
      tutorArrival = t.arrivalTime ?? t.arrival ?? null;
      tutorDeparture = t.departureTime ?? t.departure ?? null;
    }
  } catch {
    // optional
  }

  // Yesterday's tutor note (latest one)
  let tutorNotesYesterday: { tutorName: string; notes: string } | null = null;
  try {
    const prev = previousDateStr(dateStr);
    const notes = (await db.listTutorDayNotes(prev)) as any[];
    if (notes.length > 0) {
      const n = notes[0];
      tutorNotesYesterday = { tutorName: n.tutorName, notes: n.notes };
    }
  } catch {
    // optional
  }

  // Student name from profile, fallback "Reagan"
  let studentName = "Reagan";
  try {
    const p: any = await db.getProfile?.();
    if (p?.studentName) studentName = p.studentName;
  } catch {
    // ignore
  }

  return {
    forDate: dateStr,
    dayLabel: formatDayLabel(dateStr),
    studentName,
    tutorName,
    tutorArrival,
    tutorDeparture,
    blocks,
    tutorNotesYesterday,
    schoolDayWindow: { start: "09:00", end: "13:00" },
  };
}
