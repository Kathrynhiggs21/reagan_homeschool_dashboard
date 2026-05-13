/**
 * Assemble a `AgendaPdfInput` payload for a given school date by reading
 * the daily plan, blocks, book assignments, tutor of day, and yesterday's
 * tutor notes. Pure read; no side effects.
 */
import * as db from "../db";
import { resolveTutorOfDay } from "./tutorOfDay";
import type { AgendaPdfInput, AgendaPdfBlock } from "./agendaPdf";
import { hydrateLessonForBlock } from "./hydrateLessonForBlock";

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

  const blocks: AgendaPdfBlock[] = blocksRaw.map((b, i) => ({
    sortOrder: (b.sortOrder ?? i) + 1, // 1-indexed for printout
    startTime: b.startTime ?? null,
    durationMin: b.durationMin ?? 30,
    subjectName: b.subjectName ?? null,
    subjectEmoji: b.emoji ?? null,
    title: b.title,
    description: b.description ?? null,
    curriculumTopicCode: b.curriculumTopicId ? topicCodeById.get(b.curriculumTopicId) ?? null : null,
    curriculumTopicTitle: b.curriculumTopicId ? topicTitleById.get(b.curriculumTopicId) ?? null : null,
    bookPageRefs: bookRefsByBlockId.get(b.id) ?? [],
    printablesAttached: lessonByBlockId.get(b.id)?.worksheets?.length ?? 0,
    lesson: lessonByBlockId.get(b.id) ?? null,
  }));

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
