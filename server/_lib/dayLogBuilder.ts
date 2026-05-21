/**
 * Day Log builder — Slice 4.5
 *
 * Builds the canonical Markdown doc that gets synced to Drive once per day at
 *   Daily Operations / Day Logs / {YYYY-MM} / {date} - Day Log.md
 *
 * Source of truth:
 *   - dailyPlans            — does a plan exist for this day, was it a sick day, etc.
 *   - scheduleBlocks        — the planned agenda (what we set out to do)
 *   - actualAgendaEntries   — what we actually did (Slice 4.5 source of truth)
 *   - topicsCoveredOffPlan  — adult-flagged off-plan topics
 *
 * Pure helpers (formatDayLogMarkdown / dayLogFileName / dayLogSubpath) are
 * exported separately so they can be unit-tested without DB access. The full
 * `buildDayLogMarkdown(dateISO)` orchestrator does the DB reads + composition.
 */

import { and, eq, gte, lt } from "drizzle-orm";
import {
  getDb,
  getPlanByDate,
  listBlocksForPlan,
  listActualForDate,
  coverageForDate,
} from "../db";
import {
  topicsCoveredOffPlan,
  actualAgendaEntries,
  tutorSessions,
  dailyRecapRequests,
} from "../../drizzle/schema";

export type DayLogPlannedBlock = {
  id: number;
  title: string;
  subjectSlug: string | null;
  startsAt: string | null;
  durationMinutes: number | null;
  status: string | null;
};

export type DayLogActualEntry = {
  subjectSlug: string;
  topic: string;
  minutesSpent: number;
  source: string;
  notes: string | null;
};

export type DayLogOffPlanTopic = {
  subjectSlug: string;
  topic: string;
};

export type DayLogCompletedBlock = {
  title: string;
  subjectSlug: string | null;
  completedAtISO: string | null; // ISO string for human reading
};

export type DayLogCoverageRow = {
  subjectSlug: string;
  done: number;
  total: number;
  pct: number;
};

export type DayLogTutorNote = {
  scheduledAtISO: string | null;
  durationMin: number;
  status: string;
  focus: string | null;
  sessionNotes: string | null;
};

export type DayLogRecapReply = {
  sentTo: string;
  status: string;
  rawReplyText: string | null;
  parsedEntriesCount: number;
};

export type DayLogPayload = {
  dateISO: string;
  planExists: boolean;
  isWeekend: boolean;
  isAbsence: boolean;
  absenceReason: string | null;
  plannedBlocks: DayLogPlannedBlock[];
  actualEntries: DayLogActualEntry[];
  offPlanTopics: DayLogOffPlanTopic[];
  totalActualMinutes: number;
  plannedComplete: number;
  plannedTotal: number;
  // Push 8 PART 2 (2026-05-12)
  completedWork: DayLogCompletedBlock[];
  coverage: DayLogCoverageRow[];
  tutorNotes: DayLogTutorNote[];
  recapReplies: DayLogRecapReply[];
};

/* ============================================================
 * Pure helpers (no DB) — safe to unit test in isolation
 * ============================================================ */

export function dayLogFileName(dateISO: string): string {
  return `${dateISO} - Day Log.md`;
}

export function dayLogSubpath(dateISO: string): string {
  // YYYY-MM month folder under "Day Logs"
  return dateISO.slice(0, 7);
}

function formatTime(startsAt: string | null): string {
  if (!startsAt) return "";
  const m = /^(\d{2}):(\d{2})/.exec(startsAt);
  if (!m) return startsAt;
  let hh = parseInt(m[1], 10);
  const mm = m[2];
  const ampm = hh >= 12 ? "PM" : "AM";
  hh = hh % 12 || 12;
  return `${hh}:${mm} ${ampm}`;
}

function escapeMd(s: string): string {
  // Lightweight Markdown escape — just enough to keep table-breaking chars
  // from corrupting the file. We don't need to escape pipes here because
  // we're not using tables; bullets and headers are safe.
  return s.replace(/\r/g, "").replace(/\n/g, " ");
}

/**
 * Pure Markdown formatter — takes a hydrated payload, returns the full doc.
 * Deterministic: same payload → same string (used in idempotency checks).
 */
export function formatDayLogMarkdown(p: DayLogPayload): string {
  const lines: string[] = [];
  lines.push(`# Day Log — ${p.dateISO}`);
  lines.push("");

  if (p.isWeekend) {
    lines.push("**Weekend — no school day.**");
    lines.push("");
  }
  if (p.isAbsence) {
    lines.push(`**Absence:** ${p.absenceReason ?? "no reason given"}`);
    lines.push("");
  }
  if (!p.planExists && !p.isWeekend && !p.isAbsence) {
    lines.push("_No plan was generated for this date._");
    lines.push("");
  }

  // Planned agenda
  lines.push("## Planned");
  if (p.plannedBlocks.length === 0) {
    lines.push("_(no planned blocks)_");
  } else {
    lines.push(`_${p.plannedComplete} of ${p.plannedTotal} planned blocks marked complete._`);
    lines.push("");
    for (const b of p.plannedBlocks) {
      const t = formatTime(b.startsAt);
      const dur = b.durationMinutes ? ` · ${b.durationMinutes} min` : "";
      const subj = b.subjectSlug ? ` [${b.subjectSlug}]` : "";
      const checked = b.status === "complete" ? "[x]" : "[ ]";
      lines.push(`- ${checked} ${t}${dur}${subj} — ${escapeMd(b.title)}`);
    }
  }
  lines.push("");

  // Actual entries (what really happened)
  lines.push("## Actual");
  if (p.actualEntries.length === 0) {
    lines.push("_(nothing recorded yet)_");
  } else {
    lines.push(`_${p.totalActualMinutes} minutes total across ${p.actualEntries.length} ${p.actualEntries.length === 1 ? "entry" : "entries"}._`);
    lines.push("");
    for (const a of p.actualEntries) {
      const src = a.source ? ` _(via ${a.source})_` : "";
      const note = a.notes ? ` — ${escapeMd(a.notes)}` : "";
      lines.push(`- **${a.subjectSlug}** · ${escapeMd(a.topic)} · ${a.minutesSpent} min${src}${note}`);
    }
  }
  lines.push("");

  // Off-plan topics (adult-flagged)
  if (p.offPlanTopics.length > 0) {
    lines.push("## Off-plan topics covered");
    for (const o of p.offPlanTopics) {
      lines.push(`- **${o.subjectSlug}** · ${escapeMd(o.topic)}`);
    }
    lines.push("");
  }

  // Push 8 PART 2: Completed work (per-block completion timestamps)
  lines.push("## Completed work");
  if (p.completedWork.length === 0) {
    lines.push("_(no blocks marked complete yet)_");
  } else {
    for (const c of p.completedWork) {
      const subj = c.subjectSlug ? ` [${c.subjectSlug}]` : "";
      const at = c.completedAtISO ? ` · completed ${c.completedAtISO}` : "";
      lines.push(`- ${escapeMd(c.title)}${subj}${at}`);
    }
  }
  lines.push("");

  // Curriculum coverage summary
  lines.push("## Curriculum coverage");
  if (p.coverage.length === 0) {
    lines.push("_(no curriculum standards mapped yet)_");
  } else {
    for (const cov of p.coverage) {
      lines.push(`- **${cov.subjectSlug}**: ${cov.done}/${cov.total} (${cov.pct}%)`);
    }
  }
  lines.push("");

  // Tutor notes for the day
  lines.push("## Tutor notes");
  if (p.tutorNotes.length === 0) {
    lines.push("_(no tutor sessions recorded for this date)_");
  } else {
    for (const tn of p.tutorNotes) {
      const at = tn.scheduledAtISO ? `${tn.scheduledAtISO} · ` : "";
      const focus = tn.focus ? ` · focus: ${escapeMd(tn.focus)}` : "";
      lines.push(`- ${at}${tn.durationMin} min · ${tn.status}${focus}`);
      if (tn.sessionNotes) {
        lines.push(`  - ${escapeMd(tn.sessionNotes)}`);
      }
    }
  }
  lines.push("");

  // Recap replies (raw text from Mom/Grandma/tutor)
  lines.push("## Recap replies");
  if (p.recapReplies.length === 0) {
    lines.push("_(no recap replies for this date)_");
  } else {
    for (const r of p.recapReplies) {
      const replyHeader = `- **${r.sentTo}** (${r.status}, ${r.parsedEntriesCount} entries parsed)`;
      lines.push(replyHeader);
      if (r.rawReplyText && r.rawReplyText.trim().length > 0) {
        // Indent the body so it nests under the bullet.
        const trimmed = r.rawReplyText.trim().slice(0, 1000);
        lines.push(`  > ${escapeMd(trimmed)}`);
      }
    }
  }
  lines.push("");

  lines.push("---");
  lines.push(`_Generated by the homeschool dashboard. Source of truth: \`actualAgendaEntries\`. Re-run \`POST /api/scheduled/day-log-rebuild\` with \`dateISO=${p.dateISO}\` to regenerate._`);
  lines.push("");

  return lines.join("\n");
}

/* ============================================================
 * DB-backed orchestrator
 * ============================================================ */

/** Read all the sources needed to compose the day log markdown. */
export async function loadDayLogPayload(dateISO: string): Promise<DayLogPayload> {
  const plan = await getPlanByDate(dateISO);
  const dayOfWeek = new Date(`${dateISO}T00:00:00Z`).getUTCDay();
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  const isAbsence = Boolean((plan as any)?.isAbsent || (plan as any)?.absent);
  const absenceReason: string | null =
    ((plan as any)?.absenceReason as string | null | undefined) ?? null;

  const plannedBlocks: DayLogPlannedBlock[] = plan
    ? ((await listBlocksForPlan(plan.id)) as any[]).map((b) => ({
        id: b.id,
        title: b.title ?? "",
        subjectSlug: b.subjectSlug ?? b.subject?.slug ?? null,
        startsAt: b.startsAt ?? null,
        durationMinutes: b.durationMinutes ?? null,
        status: b.status ?? null,
      }))
    : [];

  const actualRows = await listActualForDate(dateISO);
  const actualEntries: DayLogActualEntry[] = actualRows.map((a: any) => ({
    subjectSlug: a.subjectSlug ?? "other",
    topic: a.topic ?? "",
    minutesSpent: Number(a.minutesSpent ?? 0),
    source: a.source ?? "manual",
    notes: a.notes ?? null,
  }));

  const offRows: any[] = await getDb()
    .select()
    .from(topicsCoveredOffPlan)
    .where(eq(topicsCoveredOffPlan.dateISO, dateISO));
  const offPlanTopics: DayLogOffPlanTopic[] = offRows.map((o) => ({
    subjectSlug: o.subjectSlug ?? "other",
    topic: o.topic ?? "",
  }));

  const totalActualMinutes = actualEntries.reduce((s, e) => s + e.minutesSpent, 0);
  const plannedComplete = plannedBlocks.filter((b) => b.status === "complete").length;
  const plannedTotal = plannedBlocks.length;

  // Push 8 PART 2: completed work, coverage, tutor notes, recap replies.
  // All best-effort — a failure to read any one source must NOT break the
  // day-log build (which is itself fire-and-forget downstream).
  const completedWork: DayLogCompletedBlock[] = plannedBlocks
    .filter((b) => b.status === "complete")
    .map((b) => ({
      title: b.title,
      subjectSlug: b.subjectSlug,
      completedAtISO: null, // populated below from raw row if available
    }));
  // Backfill completedAt from raw rows when possible.
  if (plan && completedWork.length > 0) {
    try {
      const rawBlocks: any[] = (await listBlocksForPlan(plan.id)) as any[];
      const completedAtById = new Map<string, string | null>();
      for (const r of rawBlocks) {
        if (r?.completedAt) {
          completedAtById.set(
            String(r.title ?? ""),
            new Date(r.completedAt).toISOString(),
          );
        }
      }
      for (const c of completedWork) {
        const at = completedAtById.get(c.title);
        if (at) c.completedAtISO = at;
      }
    } catch {
      /* best effort */
    }
  }

  let coverage: DayLogCoverageRow[] = [];
  try {
    const rows = await coverageForDate(dateISO);
    coverage = rows.map((r) => ({
      subjectSlug: r.subjectSlug,
      done: r.done,
      total: r.total,
      pct: r.pct,
    }));
  } catch {
    /* best effort */
  }

  let tutorNotes: DayLogTutorNote[] = [];
  try {
    const startMs = Date.parse(`${dateISO}T00:00:00Z`);
    const endMs = startMs + 24 * 60 * 60 * 1000;
    const tsRows: any[] = await getDb()
      .select()
      .from(tutorSessions)
      .where(
        and(
          gte(tutorSessions.scheduledAt as any, new Date(startMs) as any),
          lt(tutorSessions.scheduledAt as any, new Date(endMs) as any),
        ),
      );
    tutorNotes = tsRows.map((row) => ({
      scheduledAtISO: row?.scheduledAt
        ? new Date(row.scheduledAt).toISOString()
        : null,
      durationMin: Number(row?.durationMin ?? 0),
      status: String(row?.status ?? "unknown"),
      focus: row?.focus ?? null,
      sessionNotes: row?.sessionNotes ?? null,
    }));
  } catch {
    /* best effort */
  }

  let recapReplies: DayLogRecapReply[] = [];
  try {
    const recapRows: any[] = await getDb()
      .select()
      .from(dailyRecapRequests)
      .where(eq(dailyRecapRequests.dateISO, dateISO));
    recapReplies = recapRows.map((row) => ({
      sentTo: String(row?.sentTo ?? ""),
      status: String(row?.status ?? ""),
      rawReplyText: row?.rawReplyText ?? null,
      parsedEntriesCount: Number(row?.parsedEntriesCount ?? 0),
    }));
  } catch {
    /* best effort */
  }

  return {
    dateISO,
    planExists: Boolean(plan),
    isWeekend,
    isAbsence,
    absenceReason,
    plannedBlocks,
    actualEntries,
    offPlanTopics,
    totalActualMinutes,
    plannedComplete,
    plannedTotal,
    completedWork,
    coverage,
    tutorNotes,
    recapReplies,
  };
}

/** Convenience: load + format in one call. */
export async function buildDayLogMarkdown(dateISO: string): Promise<string> {
  const payload = await loadDayLogPayload(dateISO);
  return formatDayLogMarkdown(payload);
}

/* ============================================================
 * Auto-sync trigger — Slice 4.5 push 8 (2026-05-12)
 *
 * Inserts a pending `drivePushQueue` row for this date's day log,
 * idempotent on (targetFolder, targetSubpath, fileName, status='pending')
 * + content-hash equality. Safe to call from any write path that
 * changes a day's content (recordActualEntry, updateBlock, off-plan
 * topic add, recap parse, quick-entry submit).
 *
 * NEVER throws — fire-and-forget. The original write must succeed
 * even if the day-log enqueue fails (transient DB blip, schema
 * mismatch, etc.). Errors are console.warned only.
 * ============================================================ */

import { drivePushQueue } from "../../drizzle/schema";

export async function enqueueDayLogRebuild(
  dateISO: string,
): Promise<{ ok: boolean; alreadyQueued: boolean; bytes: number; reason?: string }> {
  try {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateISO)) {
      return { ok: false, alreadyQueued: false, bytes: 0, reason: "bad-date" };
    }
    const md = await buildDayLogMarkdown(dateISO);
    const bytes = new TextEncoder().encode(md).length;
    const fileName = dayLogFileName(dateISO);
    const subpath = dayLogSubpath(dateISO);
    const db = getDb();

    // UPSERT semantics (fixed 2026-05-21): at most ONE pending row per
    // (target=day_log, subpath, fileName) tuple at any time. If a pending
    // row already exists for this date, update its contentText in place
    // (so the next worker run pushes the latest markdown); otherwise
    // insert a new pending row. This prevents the bug where every actual
    // entry write created another duplicate pending row — we observed
    // 10 pending duplicates for the same date in production.
    let alreadyQueued = false;
    try {
      const existing: any[] = await db
        .select()
        .from(drivePushQueue)
        .where(
          and(
            eq(drivePushQueue.targetFolder as any, "day_log" as any),
            eq(drivePushQueue.targetSubpath as any, subpath as any),
            eq(drivePushQueue.fileName as any, fileName as any),
            eq(drivePushQueue.status as any, "pending" as any),
          ),
        );
      if (existing.length > 0) {
        alreadyQueued = true;
        // Find the newest existing row (highest id) and update its content.
        // Mark any older duplicate pending rows for the same tuple as 'skipped'
        // so the worker never wastes a round-trip on stale duplicates.
        const sorted = [...existing].sort((a: any, b: any) => (b?.id ?? 0) - (a?.id ?? 0));
        const keep = sorted[0];
        if (keep && keep.contentText !== md) {
          try {
            await db
              .update(drivePushQueue)
              .set({ contentText: md, mimeType: "text/markdown" } as any)
              .where(eq(drivePushQueue.id as any, keep.id));
          } catch (eu) {
            console.warn("[enqueueDayLogRebuild] in-place update failed", eu);
          }
        }
        if (sorted.length > 1) {
          for (const stale of sorted.slice(1)) {
            try {
              await db
                .update(drivePushQueue)
                .set({ status: "skipped" as any, errorMessage: "superseded-by-newer-pending" } as any)
                .where(eq(drivePushQueue.id as any, stale.id));
            } catch (es) {
              console.warn("[enqueueDayLogRebuild] mark-stale-skipped failed", es);
            }
          }
        }
      }
    } catch (e) {
      // Non-fatal: idempotency check failed, fall through and just enqueue.
      console.warn("[enqueueDayLogRebuild] idempotency check failed", e);
    }

    if (!alreadyQueued) {
      try {
        await db.insert(drivePushQueue).values({
          targetFolder: "day_log" as any,
          targetSubpath: subpath,
          fileName,
          mimeType: "text/markdown",
          contentText: md,
          status: "pending" as any,
        } as any);
      } catch (eq) {
        console.warn("[enqueueDayLogRebuild] enqueue failed", eq);
        return { ok: false, alreadyQueued: false, bytes, reason: "insert-failed" };
      }
    }

    return { ok: true, alreadyQueued, bytes };
  } catch (e: any) {
    console.warn("[enqueueDayLogRebuild] failed", e?.message ?? e);
    return { ok: false, alreadyQueued: false, bytes: 0, reason: "exception" };
  }
}
