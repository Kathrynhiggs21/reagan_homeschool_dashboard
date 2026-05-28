/**
 * Assemble a `AgendaPdfInput` payload for a given school date by reading
 * the daily plan, blocks, book assignments, tutor of day, and yesterday's
 * tutor notes. Pure read; no side effects.
 *
 * v3.10 additions:
 *   - Detect summer mode via summerMode.ts and pass it to the PDF builder
 *   - Resolve /manus-storage/ relative URLs to absolute signed URLs
 *   - Fetch image worksheet bytes for inline embedding in the PDF
 */
import * as db from "../db";
import { resolveTutorOfDay } from "./tutorOfDay";
import type { AgendaPdfInput, AgendaPdfBlock } from "./agendaPdf";
import { hydrateLessonForBlock } from "./hydrateLessonForBlock";
import { deriveGeneratedForBlock } from "./blockGeneratorMatch";


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

/**
 * Resolve a printableUrl to an absolute URL.
 * - Already-absolute URLs (http/https) are returned as-is.
 * - /manus-storage/KEY paths are resolved to signed S3 URLs.
 * - Anything else is returned as-is (best-effort).
 */
async function resolveWorksheetUrl(url: string | null | undefined): Promise<string | null> {
  if (!url) return null;
  const trimmed = url.trim();
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }
  if (trimmed.startsWith("/manus-storage/")) {
    try {
      const { storageGetSignedUrl } = await import("../storage");
      const key = trimmed.replace(/^\/manus-storage\//, "");
      return await storageGetSignedUrl(key);
    } catch {
      // If signing fails, return the relative path — better than nothing
      return trimmed;
    }
  }
  return trimmed;
}

/**
 * Try to fetch image bytes for a worksheet URL.
 * Returns { bytes, mimeType } if the resource is a PNG or JPEG image,
 * null otherwise (PDF, HTML, or fetch failure).
 */
async function tryFetchImageBytes(
  absoluteUrl: string | null,
): Promise<{ bytes: Buffer; mimeType: string } | null> {
  if (!absoluteUrl || !absoluteUrl.startsWith("http")) return null;
  try {
    const resp = await fetch(absoluteUrl, {
      signal: AbortSignal.timeout(8000),
      headers: { Accept: "image/*" },
    });
    if (!resp.ok) return null;
    const ct = resp.headers.get("content-type") ?? "";
    if (!ct.startsWith("image/jpeg") && !ct.startsWith("image/png")) return null;
    const buf = Buffer.from(await resp.arrayBuffer());
    // Sanity check: images should be at least 1 KB
    if (buf.length < 1024) return null;
    return { bytes: buf, mimeType: ct.split(";")[0].trim() };
  } catch {
    return null;
  }
}

export async function assembleAgendaForDate(dateStr: string): Promise<AgendaPdfInput | null> {
  const plan = await db.getPlanByDate(dateStr);
  if (!plan) return null;

  // Summer-mode skip rule (added 2026-05-17):
  // Treat plans Mom/Grandma have explicitly skipped, OR plans with no blocks
  // attached, as "no school day" — return null so the nightly cron emits
  // status='no_plan' and stays silent (no empty email, no spammy alert).
  if ((plan as any).status === "skipped") return null;

  const blocksRaw = (await db.listBlocksForPlan(plan.id)) as any[];
  if (blocksRaw.length === 0) return null;

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
        // v2.21: pass dateStr so per-block printables for this date are merged.
        // v2.98: pass curriculumTopicId so uploaded PDFs, camera photos, and
        // custom lessons from BlockResourcesPanel also flow into the packet.
        const lesson = await hydrateLessonForBlock(b.id, dateStr, b.curriculumTopicId ?? null);
        if (lesson) lessonByBlockId.set(b.id, lesson);
      } catch {
        // ignore
      }
    }),
  );

  // v3.10: Resolve worksheet URLs and try to fetch image bytes in parallel
  // Build a flat list of all (blockId, worksheetIndex, url) tuples
  type WsRef = { blockId: number; wsIdx: number; rawUrl: string | null };
  const wsRefs: WsRef[] = [];
  for (const b of blocksRaw) {
    const lesson = lessonByBlockId.get(b.id);
    if (lesson?.worksheets) {
      lesson.worksheets.forEach((w, idx) => {
        wsRefs.push({ blockId: b.id, wsIdx: idx, rawUrl: w.printableUrl ?? null });
      });
    }
  }

  // Resolve + fetch in parallel (cap concurrency at 6)
  type WsResolved = { blockId: number; wsIdx: number; resolvedUrl: string | null; imageBytes: Buffer | null; mimeType: string | null };
  const resolvedMap = new Map<string, WsResolved>();

  const CONCURRENCY = 6;
  for (let i = 0; i < wsRefs.length; i += CONCURRENCY) {
    const chunk = wsRefs.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      chunk.map(async (ref) => {
        const resolvedUrl = await resolveWorksheetUrl(ref.rawUrl);
        const imgResult = await tryFetchImageBytes(resolvedUrl);
        return {
          blockId: ref.blockId,
          wsIdx: ref.wsIdx,
          resolvedUrl,
          imageBytes: imgResult?.bytes ?? null,
          mimeType: imgResult?.mimeType ?? null,
        };
      }),
    );
    for (const r of results) {
      resolvedMap.set(`${r.blockId}:${r.wsIdx}`, r);
    }
  }

  // Merge resolved data back into lessons
  for (const b of blocksRaw) {
    const lesson = lessonByBlockId.get(b.id);
    if (lesson?.worksheets) {
      lesson.worksheets = lesson.worksheets.map((w, idx) => {
        const key = `${b.id}:${idx}`;
        const resolved = resolvedMap.get(key);
        if (!resolved) return w;
        return {
          ...w,
          resolvedUrl: resolved.resolvedUrl,
          imageBytes: resolved.imageBytes,
          mimeType: resolved.mimeType,
        };
      });
    }
  }

  const blocks: AgendaPdfBlock[] = blocksRaw.map((b, i) => {
    const refs = bookRefsByBlockId.get(b.id) ?? [];
    const firstRef = refs[0] ?? null;
    const generated = deriveGeneratedForBlock(
      {
        id: b.id,
        blockType: b.blockType,
        subjectName: b.subjectName,
        durationMin: b.durationMin,
        description: b.description,
      },
      firstRef,
    );
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

  // v3.10: Detect summer mode for the cover page banner
  let summerMode = false;
  try {
    const { summerSettingsFromKv, effectiveSummerActive } = await import("../summerMode");
    const [autoFlip, start, end, override, vacJson] = await Promise.all([
      db.getAppSetting("summer.autoFlipEnabled"),
      db.getAppSetting("summer.start"),
      db.getAppSetting("summer.end"),
      db.getAppSetting("summer.override"),
      db.getAppSetting("summer.vacationRanges"),
    ]);
    const settings = summerSettingsFromKv({
      "summer.autoFlipEnabled": autoFlip,
      "summer.start": start,
      "summer.end": end,
      "summer.override": override,
      "summer.vacationRanges": vacJson,
    });
    const status = effectiveSummerActive(dateStr, settings);
    summerMode = status.active;
  } catch {
    // optional — summer mode banner is cosmetic
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
    devotionText: (plan as any).devotionText ?? null,
    summerMode,
  };
}
