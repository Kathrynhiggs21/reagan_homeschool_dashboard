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


/**
 * v3.40 (2026-06-17) — Derive the printed "School day: …" window from the
 * actual block times instead of a hardcoded 09:00-13:00. Earliest start →
 * latest (start + duration). Falls back to null when no timed blocks exist,
 * which the PDF cover already handles gracefully (the line is just omitted).
 */
function computeSchoolDayWindow(
  blocks: AgendaPdfBlock[],
): { start: string; end: string } | null {
  const timed = blocks.filter(
    (b) => typeof b.startTime === "string" && /^\d{1,2}:\d{2}$/.test(b.startTime),
  );
  if (timed.length === 0) return null;
  const toMin = (t: string): number => {
    const [h, m] = t.split(":").map((n) => parseInt(n, 10));
    return h * 60 + m;
  };
  const toHHMM = (mins: number): string => {
    const clamped = Math.max(0, Math.min(24 * 60, mins));
    const h = Math.floor(clamped / 60);
    const m = clamped % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  };
  let minStart = Infinity;
  let maxEnd = -Infinity;
  for (const b of timed) {
    const s = toMin(b.startTime as string);
    const e = s + (b.durationMin ?? 0);
    if (s < minStart) minStart = s;
    if (e > maxEnd) maxEnd = e;
  }
  return { start: toHHMM(minStart), end: toHHMM(maxEnd) };
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
 * Try to fetch worksheet resource bytes.
 * Returns { bytes, mimeType } for PNG, JPEG, or PDF resources.
 * Returns null for HTML, fetch failures, or resources < 1 KB.
 */
async function tryFetchWorksheetBytes(
  absoluteUrl: string | null,
): Promise<{ bytes: Buffer; mimeType: string } | null> {
  if (!absoluteUrl || !absoluteUrl.startsWith("http")) return null;
  try {
    const resp = await fetch(absoluteUrl, {
      signal: AbortSignal.timeout(15000),
      headers: { Accept: "image/*, application/pdf" },
    });
    if (!resp.ok) return null;
    const ct = resp.headers.get("content-type") ?? "";
    const mime = ct.split(";")[0].trim();
    const isImage = mime.startsWith("image/jpeg") || mime.startsWith("image/png");
    const isPdf = mime === "application/pdf" || absoluteUrl.toLowerCase().endsWith(".pdf");
    if (!isImage && !isPdf) return null;
    const buf = Buffer.from(await resp.arrayBuffer());
    // Sanity check: resources should be at least 1 KB
    if (buf.length < 1024) return null;
    // Use application/pdf if URL ends with .pdf but content-type was wrong
    const effectiveMime = isPdf && !isImage ? "application/pdf" : mime;
    return { bytes: buf, mimeType: effectiveMime };
  } catch {
    return null;
  }
}

// Keep old name as alias for backward compatibility
const tryFetchImageBytes = tryFetchWorksheetBytes;

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
        if (lesson) {
          lessonByBlockId.set(b.id, lesson);
        } else {
          // v3.12 (2026-05-29): AI-generated blocks with no curated lesson,
          // no daily printable, and no topic resources used to print as a
          // bare title + blank Notes lines. The user requires every block in
          // the packet to include the worksheet content inline so Reagan can
          // do the whole day offline. Synthesize a tiny worksheet via LLM
          // and cache it. Failures are silent.
          try {
            const { synthesizeLessonForBlock } = await import("./synthesizeLessonForBlock");
            // v3.31: thread the Ohio standard code (curriculum topic code)
            // so synthesized/fallback worksheets are stamped "Aligned to 5.NBT.5".
            const stdCode = b.curriculumTopicId
              ? topicCodeById.get(b.curriculumTopicId) ?? null
              : null;
            const synth = await synthesizeLessonForBlock({
              blockId: b.id,
              blockTitle: b.title,
              blockDescription: b.description ?? null,
              subjectSlug: (b.subjectSlug ?? null) as string | null,
              subjectName: b.subjectName ?? null,
              durationMin: b.durationMin ?? 30,
              dateStr,
              standardCode: stdCode,
            });
            if (synth) lessonByBlockId.set(b.id, synth);
          } catch {
            // synthesizer failure must not block the packet
          }
        }
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
  type WsResolved = { blockId: number; wsIdx: number; resolvedUrl: string | null; imageBytes: Buffer | null; mimeType: string | null; pdfBytes: Buffer | null };
  const resolvedMap = new Map<string, WsResolved>();

  const CONCURRENCY = 6;
  for (let i = 0; i < wsRefs.length; i += CONCURRENCY) {
    const chunk = wsRefs.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      chunk.map(async (ref) => {
        const resolvedUrl = await resolveWorksheetUrl(ref.rawUrl);
        const fetchResult = await tryFetchWorksheetBytes(resolvedUrl);
        const isImage = fetchResult?.mimeType?.startsWith("image/") ?? false;
        const isPdf = fetchResult?.mimeType === "application/pdf";
        return {
          blockId: ref.blockId,
          wsIdx: ref.wsIdx,
          resolvedUrl,
          imageBytes: (fetchResult && isImage) ? fetchResult.bytes : null,
          mimeType: fetchResult?.mimeType ?? null,
          pdfBytes: (fetchResult && isPdf) ? fetchResult.bytes : null,
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
          pdfBytes: resolved.pdfBytes,
        };
      });
    }
  }

  // Lazy-import QR codec only here (server-side only).
  // v3.16 (2026-05-30) — hydrate a PNG buffer for video blocks so the
  // PDF builder can stamp a scannable QR onto the lesson page.
  let qrCodec: typeof import("qrcode") | null = null;
  try {
    qrCodec = (await import("qrcode")) as any;
  } catch {
    qrCodec = null;
  }

  const blocksRawWithGenerated = await Promise.all(
    blocksRaw.map(async (b: any, i: number) => {
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
      ) as any;
      // For video kind, pre-render the QR PNG so the PDF builder doesn't
      // need to do async work mid-render.
      if (generated && generated.kind === "video" && generated.operable?.url && qrCodec) {
        try {
          generated.__qrPngBuffer = await qrCodec.toBuffer(generated.operable.url, {
            type: "png",
            errorCorrectionLevel: "M",
            margin: 1,
            width: 220,
          });
        } catch {
          generated.__qrPngBuffer = undefined;
        }
      }
      return { b, i, refs, generated };
    }),
  );

  const blocks: AgendaPdfBlock[] = blocksRawWithGenerated.map(({ b, i, refs, generated }) => {
    return {
      sortOrder: i + 1, // 1-indexed for printout, sequential by position (robust to gaps)
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

  // v3.31: audit the assembled packet. Every content-bearing block should
  // now carry real work (synth + deterministic fallback guarantee it). If a
  // gap slips through, log it and notify Katy that night so she can patch the
  // block. Best-effort: the audit never blocks the packet from shipping.
  let packetAuditResult:
    | import("./packetAudit").PacketAuditResult
    | null = null;
  try {
    const { auditPacket, formatAuditNotification } = await import("./packetAudit");
    const blockTypeBySortOrder = new Map<number, string>();
    blocksRaw.forEach((b: any, i: number) => {
      blockTypeBySortOrder.set((b.sortOrder ?? i) + 1, String(b.blockType ?? ""));
    });
    const audit = auditPacket(dateStr, blocks, blockTypeBySortOrder);
    packetAuditResult = audit;
    if (!audit.ok) {
      // De-dupe per date so re-assembling the same day doesn't re-notify.
      const marker = `packet.audit.notified.${dateStr}`;
      let already = false;
      try {
        already = (await db.getAppSetting(marker)) === "1";
      } catch {
        already = false;
      }
      if (!already) {
        try {
          const { notifyOwner } = await import("../_core/notification");
          const msg = formatAuditNotification(audit);
          const sent = await notifyOwner(msg);
          if (sent) {
            try {
              await db.setAppSetting(marker, "1");
            } catch {
              /* marker write failure is non-fatal */
            }
          }
        } catch {
          /* notification failure must not block the packet */
        }
      }
    }
  } catch {
    /* audit failure must not block the packet */
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
    schoolDayWindow: computeSchoolDayWindow(blocks),
    devotionText: (plan as any).devotionText ?? null,
    summerMode,
    packetAudit: packetAuditResult,
  };
}
