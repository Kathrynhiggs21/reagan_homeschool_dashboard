import { ENV } from "./_core/env";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { eq, desc, and, gte, lte, lt, sql, isNotNull, isNull, asc, inArray } from "drizzle-orm";
import {
  users, type InsertUser,
  subjects, dailyPlans, scheduleBlocks, bookAssignments, adventures,
  appLinks, books, moodLogs, timelineEvents, notifications, ihAssignments,
  learnerProfile, skillsMastery, weeklyTopics, notificationRecipients,
  appointments, schoolCalendar, animals, rescues, badges, whisperSessions,
  heartNotes, encouragementNotes, emotionalStruggles, specialDays,
  reaganKnowledge,
  journalEntries, helpList, assignmentSubmissions,
  assignmentAnswerKeys, assignmentSubmissionsAutoGrade,
  takeNotes, curriculumAdjustments, blockGrades, needsWorkItems,
  printableSources, printableFavorites, academicRecords, auditLog, iepGoals, iepAccommodations, assessmentScreenings,
  stickers, goodWorkNotes, coinLedger, prizes, prizeRedemptions, certificates,
  appAccounts,
  proudMoments,
  studentRequests, adultAiMessages,
  bookPagesDone,
  listeningSummaries,
  actualAgendaEntries, type ActualAgendaEntry, type InsertActualAgendaEntry,
  topicsCoveredOffPlan, type InsertTopicCoveredOffPlan,
  dailyRecapRequests, type DailyRecapRequest, type InsertDailyRecapRequest,
  kidRequests, type KidRequest,
  kiwiVoiceAuditEntries,
  type KiwiVoiceAuditEntry as KiwiVoiceAuditEntryRow,
  type InsertKiwiVoiceAuditEntry,
} from "../drizzle/schema";

let _db: ReturnType<typeof drizzle> | null = null;

/**
 * Lazy-import wrapper around `enqueueDayLogRebuild` from
 * `_lib/dayLogBuilder.ts`. The dynamic import breaks the otherwise
 * circular dep (dayLogBuilder imports getDb/listActualForDate from
 * THIS file). Always fire-and-forget: callers must not await this and
 * any failure is swallowed so the original write succeeds.
 */
export function enqueueDayLogRebuildForDate(dateISO: string): void {
  if (!dateISO || !/^\d{4}-\d{2}-\d{2}$/.test(dateISO)) return;
  void import("./_lib/dayLogBuilder")
    .then((m) => m.enqueueDayLogRebuild(dateISO).catch(() => {}))
    .catch(() => {});
}

export function getDb() {
  if (_db) return _db;
  const pool = mysql.createPool({
    uri: process.env.DATABASE_URL,
    connectionLimit: 10,
    waitForConnections: true,
  });
  _db = drizzle(pool as any, { mode: "default" });
  return _db;
}

/* ============================== AUTH ====================================== */
export async function upsertUser(user: InsertUser) {
  const db = getDb();
  const isOwner = user.openId === ENV.ownerOpenId;
  const role = isOwner ? "admin" as const : (user.role || "user" as const);
  await db.insert(users).values({ ...user, role }).onDuplicateKeyUpdate({
    set: { name: user.name, email: user.email, loginMethod: user.loginMethod, lastSignedIn: new Date(), role },
  });
  return getUserByOpenId(user.openId);
}

export async function getUserByOpenId(openId: string) {
  const db = getDb();
  const rows = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return rows[0] || null;
}

/* ============================== SUBJECTS ================================== */
export async function listSubjects() {
  return getDb().select().from(subjects).orderBy(subjects.sortOrder);
}

/**
 * Push 2.8 (2026-05-17) — Adult-only adapter: list curriculumTopics that were
 * stamped by a parent voice-memo intake (the `last_covered_source` column).
 * Used by the Today adult widget so Mom + Grandma can verify what the system
 * recorded from a voice memo.
 */
export async function listCurriculumTopicsBySource(
  source: string,
  opts?: { limit?: number },
) {
  const limit = Math.max(1, Math.min(opts?.limit ?? 50, 100));
  const [rows] = (await getDb().execute(sql`
    SELECT id, subject, code, title, status, notes, last_covered_source, last_covered_at, completed_at
    FROM curriculumTopics
    WHERE last_covered_source = ${source}
    ORDER BY subject ASC, ord ASC, id ASC
    LIMIT ${limit}
  `)) as any;
  return (rows || []) as Array<{
    id: number;
    subject: string;
    code: string;
    title: string;
    status: string;
    notes: string | null;
    last_covered_source: string;
    last_covered_at: number | null;
    completed_at: Date | null;
  }>;
}

/**
 * Push 2.9 (2026-05-17) — Kid-safe celebration view of voice-memo-stamped
 * topics. ONLY returns rows that are `status='done'` and DROPS the
 * teacher-facing `notes` evidence string + the source name + the source
 * timestamp. The kid sees only what she actually completed; she does not
 * see Mom's transcript timecodes or in-progress nags.
 *
 * Source-prefix is configurable so future memos with a different tag
 * (e.g. `mom_katy_voice_memo_2026-09-12`) light up the same widget
 * automatically. Default prefix matches our family voice-memo naming.
 */
/**
 * Push 2.10 (2026-05-17) — Forward-planner gap snapshot.
 *
 * Returns a map of subject -> { inProgress, notStarted } where each list
 * is ordered by `ord ASC, id ASC`. We deliberately keep `notes` in the
 * payload because the planner front-loads transcript-quoted blockers
 * (e.g. "Spectrum Math final test — ungraded") using that text.
 *
 * Excluded by default:
 *   - status = 'done' / 'covered' (already finished)
 *   - subjects with zero unfinished rows (caller can iterate keys safely)
 *
 * Caller can pass `excludeSubjects` to drop e.g. Specials when the parent
 * doesn't want them auto-scheduled.
 */
export async function getCurriculumGapBySubject(opts?: {
  excludeSubjects?: string[];
  limitPerBucket?: number;
}) {
  const exclude = (opts?.excludeSubjects ?? []).map((s) => String(s));
  const cap = Math.max(1, Math.min(opts?.limitPerBucket ?? 25, 100));
  const [rows] = (await getDb().execute(sql`
    SELECT id, subject, code, title, status, notes, ord,
           last_covered_source, last_covered_at
    FROM curriculumTopics
    WHERE status IN ('inProgress', 'notStarted')
    ORDER BY subject ASC, ord ASC, id ASC
  `)) as any;

  type GapRow = {
    id: number;
    subject: string;
    code: string;
    title: string;
    status: "inProgress" | "notStarted";
    notes: string | null;
    ord: number | null;
    last_covered_source: string | null;
    last_covered_at: number | null;
  };

  const out: Record<string, { inProgress: GapRow[]; notStarted: GapRow[] }> = {};
  for (const r of (rows || []) as GapRow[]) {
    if (exclude.includes(r.subject)) continue;
    const bucket = (out[r.subject] ||= { inProgress: [], notStarted: [] });
    if (r.status === "inProgress" && bucket.inProgress.length < cap) {
      bucket.inProgress.push(r);
    } else if (r.status === "notStarted" && bucket.notStarted.length < cap) {
      bucket.notStarted.push(r);
    }
  }
  // Drop subjects with no unfinished rows after exclusions.
  for (const subj of Object.keys(out)) {
    const b = out[subj];
    if (b.inProgress.length === 0 && b.notStarted.length === 0) delete out[subj];
  }
  return out;
}

/**
 * Push 2.11 (2026-05-17) — School-day generator.
 *
 * Returns the next `count` school days starting at `start` (inclusive),
 * skipping weekends and any date present in `schoolCalendar` with
 * `isOff = true`. If schoolCalendar is empty, falls back to weekday-only
 * — graceful default so the planner works before Mom seeds the IH calendar.
 *
 *   getNextSchoolDays("2026-05-18", 10) // -> 10 ISO date strings
 *
 * Dates are returned ISO 'YYYY-MM-DD'.
 */
export async function getNextSchoolDays(
  start: string,
  count: number,
): Promise<string[]> {
  if (count <= 0) return [];
  const db = getDb();
  // Pull all schoolCalendar off-days within the next ~120 days from start so
  // we don't over-fetch.  120 days covers a 60-school-day horizon worst-case.
  const startD = new Date(start + "T00:00:00");
  const horizon = new Date(startD.getTime());
  horizon.setUTCDate(horizon.getUTCDate() + 120);
  const horizonIso = horizon.toISOString().slice(0, 10);
  const offRows = (await db.execute(sql`
    SELECT date FROM schoolCalendar
     WHERE isOff = TRUE AND date >= ${start} AND date <= ${horizonIso}
  `)) as any;
  const offSet = new Set<string>();
  for (const r of (offRows[0] || [])) {
    const d = r.date;
    // Drizzle returns either a Date or a string here — normalize.
    const iso =
      d instanceof Date ? d.toISOString().slice(0, 10) : String(d).slice(0, 10);
    offSet.add(iso);
  }
  const out: string[] = [];
  const cursor = new Date(startD.getTime());
  // Hard cap: 200 candidate days even if we somehow can't fill `count`.
  for (let i = 0; i < 200 && out.length < count; i++) {
    const dow = cursor.getUTCDay(); // 0 = Sun, 6 = Sat
    const iso = cursor.toISOString().slice(0, 10);
    const isWeekend = dow === 0 || dow === 6;
    const isOff = offSet.has(iso);
    if (!isWeekend && !isOff) out.push(iso);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return out;
}

/**
 * Push 2.10 (2026-05-17) — Forward-planner write path.
 *
 * Idempotent. Given a list of plan rows from `planForward(...)`, ensure a
 * dailyPlans row exists for each date and create one scheduleBlocks row
 * per (date, topicId) that doesn't already have one. Never modifies
 * existing blocks. Never duplicates a topic on the same day.
 *
 * Each created block:
 *   - blockType = mapped from subject (Math -> math, ELA -> read_aloud,
 *     Science/Social/Specials -> adventure or custom).
 *   - title = `<emoji> <code>` so kid view shows the workbook code.
 *   - description = transcript-quoted evidence + `Forward planner: <source>`.
 *   - notes = source tag for full audit trail.
 *   - curriculumTopicId = topic.id (binds the block to the topic).
 */
export async function applyForwardPlan(
  rows: Array<{
    date: string;
    weekday: number;
    slotIndex: number;
    subject: string;
    topicId: number;
    code: string;
    title: string;
    evidence: string | null;
    isBlockerFrontload: boolean;
  }>,
  opts: { source: string },
): Promise<{ created: number; skipped: number; perDate: Record<string, number> }> {
  const source = opts.source || "forward_planner";
  let created = 0;
  let skipped = 0;
  const perDate: Record<string, number> = {};

  // Map the curriculumTopics.subject (TitleCase) to a scheduleBlocks blockType.
  const blockTypeFor = (subject: string): string => {
    const s = subject.toLowerCase();
    if (s === "math") return "math";
    if (s === "ela") return "read_aloud";
    if (s === "science") return "adventure";
    if (s === "social" || s === "social studies") return "custom";
    if (s === "specials") return "choice";
    return "custom";
  };
  // Same for subject slug lookup.
  const slugFor = (subject: string): string | null => {
    const s = subject.toLowerCase();
    if (s === "math") return "math";
    if (s === "ela") return "ela";
    if (s === "science") return "science";
    if (s === "social" || s === "social studies") return "social-studies";
    return null;
  };

  for (const r of rows) {
    // Step 1: ensure dailyPlans exists (no auto-build to avoid clobbering).
    const plan = await ensurePlanForDate(r.date);
    if (!plan) {
      skipped++;
      continue;
    }
    // Step 2: idempotency — skip if a block already binds this topic to this plan.
    const existing = await getDb()
      .select({ id: scheduleBlocks.id })
      .from(scheduleBlocks)
      .where(
        and(
          eq(scheduleBlocks.planId, plan.id),
          eq(scheduleBlocks.curriculumTopicId, r.topicId),
        ),
      )
      .limit(1);
    if ((existing as any[]).length > 0) {
      skipped++;
      continue;
    }
    // Step 3: pick subject id if a known slug.
    const slug = slugFor(r.subject);
    let subjectId: number | null = null;
    if (slug) {
      const sRow = await getDb()
        .select({ id: subjects.id })
        .from(subjects)
        .where(eq(subjects.slug, slug))
        .limit(1);
      subjectId = (sRow as any[])[0]?.id ?? null;
    }
    // Step 4: append to the day in the next sortOrder slot.
    const allBlocks = await getDb()
      .select({ sortOrder: scheduleBlocks.sortOrder })
      .from(scheduleBlocks)
      .where(eq(scheduleBlocks.planId, plan.id));
    const maxOrd = (allBlocks as any[]).reduce(
      (m, b) => Math.max(m, b.sortOrder ?? 0),
      -1,
    );
    const titlePrefix = r.isBlockerFrontload ? "✨ " : "✏️ ";
    const evidence = r.evidence ? `${r.evidence}` : "";
    const desc = [
      r.title,
      evidence,
      `Forward planner (${source})`,
    ]
      .filter(Boolean)
      .join(" — ");
    await getDb()
      .insert(scheduleBlocks)
      .values({
        planId: plan.id,
        blockType: blockTypeFor(r.subject) as any,
        subjectId: subjectId ?? undefined,
        title: `${titlePrefix}${r.code} — ${r.title}`.slice(0, 200),
        description: desc,
        durationMin: r.subject === "Math" ? 30 : 25,
        sortOrder: maxOrd + 1,
        curriculumTopicId: r.topicId,
        notes: `forward_planner_source=${source}; isBlocker=${r.isBlockerFrontload ? 1 : 0}`,
      });
    created++;
    perDate[r.date] = (perDate[r.date] ?? 0) + 1;
  }
  return { created, skipped, perDate };
}

export async function listKidCoveredTopicsFromVoiceMemos(opts?: {
  sourcePrefix?: string;
  limit?: number;
}) {
  const prefix = (opts?.sourcePrefix ?? "mom_katy_voice_memo_").replace(/%/g, "");
  const limit = Math.max(1, Math.min(opts?.limit ?? 50, 100));
  const like = `${prefix}%`;
  const [rows] = (await getDb().execute(sql`
    SELECT id, subject, code, title
    FROM curriculumTopics
    WHERE status = 'done'
      AND last_covered_source LIKE ${like}
    ORDER BY subject ASC, ord ASC, id ASC
    LIMIT ${limit}
  `)) as any;
  return (rows || []) as Array<{
    id: number;
    subject: string;
    code: string;
    title: string;
  }>;
}

export async function upsertSubject(s: typeof subjects.$inferInsert) {
  const db = getDb();
  await db.insert(subjects).values(s).onDuplicateKeyUpdate({
    set: { name: s.name, color: s.color, emoji: s.emoji, sortOrder: s.sortOrder },
  });
}

/* ============================== DAILY PLANS =============================== */
export async function getPlanByDate(dateStr: string) {
  const db = getDb();
  const rows = await db.select().from(dailyPlans).where(eq(dailyPlans.date, dateStr as any)).limit(1);
  return rows[0] || null;
}

/**
 * ensurePlanForDate
 *
 * Weekend rule (per user, May 2026): Saturday and Sunday have NO auto-generated
 * school blocks or assignments. The plan row exists (so the UI can render "no
 * school today, free day"), but its block list stays empty unless a parent /
 * editor / tutor explicitly adds something — manually, via the schedule UI, or
 * via the AI generator with `allowWeekend: true`.
 *
 * Wednesday = therapy day (lighter auto-build).
 * Weekday non-Wednesday = full template.
 */
export async function ensurePlanForDate(
  dateStr: string,
  dayType: any = "full",
  opts: { allowWeekendAutoBuild?: boolean; allowOffDayAutoBuild?: boolean } = {},
) {
  const existing = await getPlanByDate(dateStr);
  if (existing) return existing;
  const db = getDb();
  const dow = new Date(dateStr + "T00:00:00").getDay();
  const isWeekend = dow === 0 || dow === 6;

  // v2.22 (2026-05-17): Consult schoolCalendar for explicit off-days
  // (federal holidays, district breaks, Indian Hill 25-26 staff days).
  // If the date is flagged isOff=true, treat it like a weekend: create
  // the plan row with dayType="off" so the UI can render "no school
  // today" and the nightly packet skips, but DO NOT auto-build any
  // blocks unless the caller explicitly opts in. Adults can still add
  // blocks manually for special enrichment days.
  let isCalendarOff = false;
  try {
    isCalendarOff = await isSchoolOff(dateStr);
  } catch {
    isCalendarOff = false; // graceful degrade if calendar query fails
  }

  // v2.27 (2026-05-17) — Summer Mode auto-flip. Calendar off-days and
  // weekends still take precedence (Memorial Day stays "off" even in
  // summer; Saturday stays "off"). For an ordinary weekday inside the
  // summer window, switch the auto-build template to a soft summer one.
  let isSummerActive = false;
  try {
    const [autoFlip, sStart, sEnd, sOverride, sVacJson] = await Promise.all([
      getAppSetting("summer.autoFlipEnabled"),
      getAppSetting("summer.start"),
      getAppSetting("summer.end"),
      getAppSetting("summer.override"),
      getAppSetting("summer.vacationRanges"),
    ]);
    const { summerSettingsFromKv, effectiveSummerActive } = await import("./summerMode");
    const settings = summerSettingsFromKv({
      "summer.autoFlipEnabled": autoFlip,
      "summer.start": sStart,
      "summer.end": sEnd,
      "summer.override": sOverride,
      "summer.vacationRanges": sVacJson,
    });
    isSummerActive = effectiveSummerActive(dateStr, settings).active;
  } catch {
    isSummerActive = false; // graceful degrade if settings query fails
  }

  const isOff = isWeekend || isCalendarOff;
  // Weekend OR calendar-off = "off" by default. Adults can still manually add blocks afterward.
  // dailyPlans.dayType enum is [full, half, outdoor, field_trip, recovery, off].
  // Summer mode reuses "outdoor" semantically (no schema change needed); the
  // build template still keys off the explicit `summer` build kind below.
  const finalDayType = isOff ? "off" : dow === 3 ? "half" : isSummerActive ? "outdoor" : dayType;
  await db.insert(dailyPlans).values({ date: dateStr as any, dayType: finalDayType });
  const plan = await getPlanByDate(dateStr);
  if (!plan) return plan;
  // Skip auto-build for weekends unless caller explicitly opted in.
  if (isWeekend && !opts.allowWeekendAutoBuild) return plan;
  // Skip auto-build for explicit calendar off-days unless caller explicitly opted in.
  if (isCalendarOff && !opts.allowOffDayAutoBuild) return plan;
  // Summer beats therapy/full on a regular weekday inside the window.
  const buildKind = isWeekend
    ? "weekend"
    : isSummerActive
      ? "summer"
      : dow === 3
        ? "therapy"
        : dayType;
  await autoBuildBlocksForPlan(plan.id, buildKind, dow);
  return plan;
}

/** Pure helper — true when YYYY-MM-DD falls on Sat/Sun. Exported for tests. */
export function isWeekendDate(dateStr: string): boolean {
  const dow = new Date(dateStr + "T00:00:00").getDay();
  return dow === 0 || dow === 6;
}

async function autoBuildBlocksForPlan(planId: number, dayType: string, dow: number) {
  const db = getDb();
  const subjs = await db.select().from(subjects);
  const findSlug = (slug: string) => subjs.find(s => s.slug === slug);
  const isTherapy = dayType === "therapy";
  // v2.27 (2026-05-17) — summer build kind. Soft, choice-heavy, outdoor-leaning,
  // with no academic-pressure language. Reagan can still pick into structured
  // work via the choice block (the 3-of-4 chooser uses summerChoiceOptions),
  // but the spine is summer-friendly variants. Calendar off-days and weekends
  // are filtered out before this function is called — summer never overrides
  // them.
  const isSummer = dayType === "summer";

  const isWeekend = dayType === "weekend";
  const summerTemplate: Array<{ title: string; description: string; slug?: string; type: string; minutes: number }> = [
    { title: "Summer charge ☀\ufe0f", description: "Tiny daily mood-setter — pick the silliest joke or the prettiest cloud. Not schoolwork.", slug: "animal-care", type: "morning_warmup", minutes: 5 },
    { title: "Summer adventure", description: "Outdoor / library / hands-on / game variants — see the chooser. No ‘school’ pressure.", slug: "science", type: "adventure", minutes: 60 },
    { title: "Summer choice 🌞", description: "Pick 1 of 3 surprises today. Refresh = same 3, no rerolling away the option you don’t want.", slug: "choice", type: "choice", minutes: 45 },
    { title: "Cozy reading", description: "Hammock, library beanbag, blanket fort — 30 min of free-choice reading.", slug: "ela", type: "read_aloud", minutes: 30 },
    { title: "Tiny practice", description: "5–10 minutes of light math or spelling, gamified. Streak boost is on — stack those summer coins.", slug: "math", type: "math", minutes: 10 },
    { title: "One little win", description: "Pick ONE tiny thing to log: a bird seen, a meal helped with, a kindness done.", slug: undefined, type: "catch_up", minutes: 10 },
  ];
  const template: Array<{ title: string; description: string; slug?: string; type: string; minutes: number }> = isSummer ? summerTemplate : isWeekend ? [
    // Weekend = soft, optional, no "school" pressure. Just connection + curiosity.
    { title: "Slay Charge ⚡", description: "Tiny daily mood-setter — a joke or a short funny clip. Not schoolwork.", slug: "animal-care", type: "morning_warmup", minutes: 5 },
    { title: "Pick-your-path adventure", description: "Creek, garden, art, baking, Lego \u2014 your call. Outdoors counts double.", slug: "science", type: "adventure", minutes: 60 },
    { title: "Family read-aloud", description: "Cuddle up for one chapter together. Optional.", slug: "ela", type: "read_aloud", minutes: 25 },
    { title: "Choice play", description: "Roblox, drawing, makeup, music \u2014 reset and recharge.", slug: "choice", type: "choice", minutes: 45 },
    { title: "One little win", description: "Pick ONE tiny thing to log: a bird seen, a meal helped with, a kindness done.", slug: undefined, type: "catch_up", minutes: 10 },
  ] : isTherapy ? [
    { title: "Slay Charge ⚡", description: "Tiny daily mood-setter — a joke or a short funny clip. Not schoolwork.", slug: "animal-care", type: "morning_warmup", minutes: 5 },
    { title: "Easy math warm-up", description: "A few duckling-themed practice problems. No pressure.", slug: "math", type: "math", minutes: 25 },
    { title: "Choice block", description: "What you want today. Art, makeup, drawing, anything.", slug: "choice", type: "choice", minutes: 30 },
    { title: "Therapy with Ali", description: "Wednesday session with Ali Hill. Mom will let you know.", slug: undefined, type: "appointment", minutes: 90 },
    { title: "Lunch + reset", description: "Cozy lunch back home.", slug: undefined, type: "custom", minutes: 30 },
    { title: "Read-aloud", description: "Tuck Everlasting, snug-in time.", slug: "ela", type: "read_aloud", minutes: 25 },
    { title: "Adventure of the day", description: "Pick something gentle from the Adventure library.", slug: "science", type: "adventure", minutes: 35 },
  ] : [
    { title: "Slay Charge ⚡", description: "Tiny daily mood-setter — a joke or a short funny clip. Not schoolwork.", slug: "animal-care", type: "morning_warmup", minutes: 5 },
    { title: "Math warm-up", description: "A few problems to wake up your math brain. You've got this.", slug: "math", type: "math", minutes: 30 },
    { title: "Choice block", description: "What you want today. Art, makeup, drawing, anything.", slug: "choice", type: "choice", minutes: 30 },
    { title: "Brain break", description: "Move, stretch, snack, sit-spot. Your call.", slug: undefined, type: "custom", minutes: 15 },
    { title: "Reading + writing", description: "Read a chapter, journal one thing. Voice-to-text totally fine.", slug: "ela", type: "read_aloud", minutes: 30 },
    { title: "Lunch", description: "Eat something good.", slug: undefined, type: "custom", minutes: 30 },
    { title: "Science adventure", description: "Animals, creek, weather, plants — pick your path.", slug: "science", type: "adventure", minutes: 35 },
    { title: "Cozy wrap-up", description: "What did today teach you? Anything to log? Or just done.", slug: undefined, type: "catch_up", minutes: 15 },
  ];

  let order = 0;
  for (const t of template) {
    const sub = t.slug ? findSlug(t.slug) : null;
    await db.insert(scheduleBlocks).values({
      planId,
      sortOrder: order++,
      blockType: t.type as any,
      title: t.title,
      description: t.description,
      subjectId: sub?.id || null,
      durationMin: t.minutes,
      status: "not_started" as any,
    });
  }
}

/**
 * refreshTodayPlan — rebuild today's plan blocks from the active template,
 * but ONLY remove blocks still in "not_started" so completed/in-progress
 * work isn't lost. Test/quiz/screener kinds are filtered out per the school
 * exit (Reagan no longer at Indian Hill since Apr 2026).
 */
export async function refreshTodayPlan(opts: { dateStr?: string; allowWeekend?: boolean } = {}) {
  const db = getDb();
  const dateStr = opts.dateStr || new Date().toISOString().slice(0, 10);
  const plan = await ensurePlanForDate(dateStr);
  if (!plan) return { ok: false as const, reason: "no_plan" };
  const dow = new Date(dateStr + "T00:00:00").getDay();
  const isWeekend = dow === 0 || dow === 6;
  // Weekend rule: never auto-rebuild Sat/Sun unless caller explicitly opts in.
  // Adults can still add blocks manually; we leave any existing blocks alone.
  if (isWeekend && !opts.allowWeekend) {
    const kept = await db.select().from(scheduleBlocks).where(eq(scheduleBlocks.planId, plan.id));
    return { ok: true as const, planId: plan.id, dayKind: "weekend" as const, added: 0, kept: (kept as any[]).length, skipped: "weekend" as const };
  }
  // Delete only not_started blocks — preserve completed/in_progress/needs_help work.
  await db.delete(scheduleBlocks).where(
    and(
      eq(scheduleBlocks.planId, plan.id),
      eq(scheduleBlocks.status as any, "not_started" as any),
    ) as any,
  );
  // Rebuild fresh blocks from the template; the template already excludes
  // test/quiz/screener kinds (we never seed them).
  const buildKind = isWeekend ? "weekend" : dow === 3 ? "therapy" : "full";
  // Only insert blocks whose title isn't already present (preserve any kept ones).
  const existing = await db.select().from(scheduleBlocks).where(eq(scheduleBlocks.planId, plan.id));
  const existingTitles = new Set((existing as any[]).map((b) => (b.title || "").toLowerCase()));
  // Re-run autoBuild but filter against existing.
  const subjs = await db.select().from(subjects);
  const findSlug = (slug: string) => (subjs as any[]).find((s) => s.slug === slug);
  const template = isWeekend ? [
    { title: "Slay Charge ⚡", description: "Tiny daily mood-setter — a joke or a short funny clip. Not schoolwork.", slug: "animal-care", type: "morning_warmup", minutes: 5 },
    { title: "Pick-your-path adventure", description: "Creek, garden, art, baking, Lego \u2014 your call. Outdoors counts double.", slug: "science", type: "adventure", minutes: 60 },
    { title: "Family read-aloud", description: "Cuddle up for one chapter together. Optional.", slug: "ela", type: "read_aloud", minutes: 25 },
    { title: "Choice play", description: "Roblox, drawing, makeup, music \u2014 reset and recharge.", slug: "choice", type: "choice", minutes: 45 },
    { title: "One little win", description: "Pick ONE tiny thing to log: a bird seen, a meal helped with, a kindness done.", slug: undefined as any, type: "catch_up", minutes: 10 },
  ] : dow === 3 ? [
    { title: "Slay Charge ⚡", description: "Tiny daily mood-setter — a joke or a short funny clip. Not schoolwork.", slug: "animal-care", type: "morning_warmup", minutes: 5 },
    { title: "Easy math warm-up", description: "A few duckling-themed practice problems. No pressure.", slug: "math", type: "math", minutes: 25 },
    { title: "Choice block", description: "What you want today. Art, makeup, drawing, anything.", slug: "choice", type: "choice", minutes: 30 },
    { title: "Therapy with Ali", description: "Wednesday session with Ali Hill. Mom will let you know.", slug: undefined as any, type: "appointment", minutes: 90 },
    { title: "Lunch + reset", description: "Cozy lunch back home.", slug: undefined as any, type: "custom", minutes: 30 },
    { title: "Read-aloud", description: "Tuck Everlasting, snug-in time.", slug: "ela", type: "read_aloud", minutes: 25 },
    { title: "Adventure of the day", description: "Pick something gentle from the Adventure library.", slug: "science", type: "adventure", minutes: 35 },
  ] : [
    { title: "Slay Charge ⚡", description: "Tiny daily mood-setter — a joke or a short funny clip. Not schoolwork.", slug: "animal-care", type: "morning_warmup", minutes: 5 },
    { title: "Math warm-up", description: "A few problems to wake up your math brain. You've got this.", slug: "math", type: "math", minutes: 30 },
    { title: "Choice block", description: "What you want today. Art, makeup, drawing, anything.", slug: "choice", type: "choice", minutes: 30 },
    { title: "Brain break", description: "Move, stretch, snack, sit-spot. Your call.", slug: undefined as any, type: "custom", minutes: 15 },
    { title: "Reading + writing", description: "Read a chapter, journal one thing. Voice-to-text totally fine.", slug: "ela", type: "read_aloud", minutes: 30 },
    { title: "Lunch", description: "Eat something good.", slug: undefined as any, type: "custom", minutes: 30 },
    { title: "Science adventure", description: "Animals, creek, weather, plants \u2014 pick your path.", slug: "science", type: "adventure", minutes: 35 },
    { title: "Cozy wrap-up", description: "What did today teach you? Anything to log? Or just done.", slug: undefined as any, type: "catch_up", minutes: 15 },
  ];
  // Reorder existing kept blocks to top, then append fresh ones.
  let added = 0;
  let order = (existing as any[]).length;
  for (const t of template) {
    if (existingTitles.has(t.title.toLowerCase())) continue;
    const sub = t.slug ? findSlug(t.slug) : null;
    await db.insert(scheduleBlocks).values({
      planId: plan.id,
      sortOrder: order++,
      blockType: t.type as any,
      title: t.title,
      description: t.description,
      subjectId: sub?.id || null,
      durationMin: t.minutes,
      status: "not_started" as any,
    });
    added += 1;
  }
  return { ok: true as const, planId: plan.id, dayKind: buildKind, added, kept: (existing as any[]).length };
}

export async function updatePlan(planId: number, patch: Partial<typeof dailyPlans.$inferInsert>) {
  const db = getDb();
  await db.update(dailyPlans).set(patch).where(eq(dailyPlans.id, planId));
}

export async function listPlans(limit = 30) {
  return getDb().select().from(dailyPlans).orderBy(desc(dailyPlans.date)).limit(limit);
}

/* ============================== SCHEDULE BLOCKS =========================== */
export async function listBlocksForPlan(planId: number) {
  const db = getDb();
  const rows = await db.select().from(scheduleBlocks)
    .where(eq(scheduleBlocks.planId, planId))
    .orderBy(scheduleBlocks.sortOrder);
  const subs = await db.select().from(subjects);
  const byId = Object.fromEntries(subs.map(s => [s.id, s]));

  // Join book assignments → page refs per block. We do one query for the whole
  // plan rather than N queries (one per block) so this stays O(1) network calls
  // even on the rare jam-packed days. The kid Today view + printable packet
  // both read `block.pageRefs` to render a one-liner like
  //   "📖 Tuck Everlasting · pg 24–28".
  const blockIds = rows.map((r) => r.id);
  type PageRef = { bookId: number; bookTitle: string | null; fromPage: number; toPage: number; notes: string | null };
  const pageRefsByBlock = new Map<number, PageRef[]>();
  if (blockIds.length > 0) {
    try {
      const ba = await db.select().from(bookAssignments).where(inArray(bookAssignments.blockId, blockIds));
      const bookIds = Array.from(new Set(ba.map((a) => a.bookId)));
      const bookRows = bookIds.length > 0
        ? await db.select().from(books).where(inArray(books.id, bookIds))
        : [];
      const titleById = new Map<number, string>();
      for (const b of bookRows) titleById.set(b.id, b.title);
      for (const a of ba) {
        const arr = pageRefsByBlock.get(a.blockId) ?? [];
        arr.push({
          bookId: a.bookId,
          bookTitle: titleById.get(a.bookId) ?? null,
          fromPage: a.fromPage,
          toPage: a.toPage,
          notes: a.notes ?? null,
        });
        pageRefsByBlock.set(a.blockId, arr);
      }
    } catch {
      // Non-fatal: if the join fails we still return blocks (just no page refs).
    }
  }

  return rows.map((r) => {
    const sub = r.subjectId ? byId[r.subjectId] : null;
    return {
      ...r,
      subjectSlug: sub?.slug || null,
      subjectName: sub?.name || null,
      emoji: sub?.emoji || null,
      estimatedMinutes: r.durationMin,
      pageRefs: pageRefsByBlock.get(r.id) ?? [],
    };
  });
}

export async function createBlock(b: typeof scheduleBlocks.$inferInsert) {
  const db = getDb();
  const result = await db.insert(scheduleBlocks).values(b);
  return (result as any)[0]?.insertId;
}

export async function updateBlock(id: number, patch: Partial<typeof scheduleBlocks.$inferInsert>) {
  const db = getDb();
  await db.update(scheduleBlocks).set(patch).where(eq(scheduleBlocks.id, id));
  // Slice 4.5 push 8: block status / title / time changes touch the day log.
  // Best-effort lookup of the block's plan date — fire-and-forget.
  void (async () => {
    try {
      const rows = await db
        .select({ planId: scheduleBlocks.planId })
        .from(scheduleBlocks)
        .where(eq(scheduleBlocks.id, id))
        .limit(1);
      const planId = rows[0]?.planId;
      if (planId) {
        const planRows = await db.execute(
          sql`SELECT DATE_FORMAT(date, '%Y-%m-%d') AS date_iso FROM dailyPlans WHERE id = ${planId} LIMIT 1`,
        );
        const dateISO =
          (planRows as any)?.[0]?.[0]?.date_iso ??
          (planRows as any)?.[0]?.date_iso ??
          (Array.isArray(planRows) && (planRows[0] as any)?.date_iso) ??
          null;
        if (dateISO) {
          enqueueDayLogRebuildForDate(String(dateISO));
          // Push 35 (2026-05-13): if any field a recipient sees changed,
          // flag the day so the next nightly tick triggers a resend.
          if (
            patch.title !== undefined ||
            patch.subjectId !== undefined ||
            patch.startTime !== undefined ||
            patch.durationMin !== undefined ||
            patch.status !== undefined ||
            patch.sortOrder !== undefined ||
            patch.description !== undefined ||
            patch.curriculumTopicId !== undefined
          ) {
            void markAgendaDirtyForDate(String(dateISO), "updateBlock").catch(() => {});
          }
        }
      }
    } catch {
      // best-effort
    }
  })();
  // Cascade completion -> linked curriculum topic.
  // When a block is marked complete *and* anchored to a curriculumTopicId,
  // flip that topic's status to 'done' (only if it was notStarted/inProgress).
  if (patch.status === "complete") {
    try {
      const rows = await db.select().from(scheduleBlocks).where(eq(scheduleBlocks.id, id)).limit(1);
      const blk: any = rows[0];
      const topicId = blk?.curriculumTopicId;
      if (topicId) {
        await db.execute(sql`
          UPDATE curriculumTopics
             SET status = 'done', completed_at = ${new Date()}
           WHERE id = ${topicId} AND status <> 'done'
        `);
      }
    } catch {
      // Non-fatal: cascade is best-effort, original block update already succeeded.
    }
  }
  // When a block is set to in_progress, mark the topic as inProgress (if still
  // notStarted) so the curriculum view shows live activity.
  if (patch.status === "in_progress") {
    try {
      const rows = await db.select().from(scheduleBlocks).where(eq(scheduleBlocks.id, id)).limit(1);
      const blk: any = rows[0];
      const topicId = blk?.curriculumTopicId;
      if (topicId) {
        await db.execute(sql`
          UPDATE curriculumTopics
             SET status = 'inProgress'
           WHERE id = ${topicId} AND status = 'notStarted'
        `);
      }
    } catch {
      // Non-fatal.
    }
  }
}

export async function deleteBlock(id: number) {
  await getDb().delete(scheduleBlocks).where(eq(scheduleBlocks.id, id));
}

/**
 * Slice 3: Wipe every scheduleBlock for a given plan id (used by
 * "Design today from blank" starter). Leaves the dailyPlan row intact
 * so the day still exists, just empty. Returns count of rows deleted.
 */
export async function deleteBlocksForPlan(planId: number): Promise<number> {
  const live = await getDb().select({ id: scheduleBlocks.id }).from(scheduleBlocks).where(eq(scheduleBlocks.planId, planId));
  if ((live as any[]).length === 0) return 0;
  await getDb().delete(scheduleBlocks).where(eq(scheduleBlocks.planId, planId));
  return (live as any[]).length;
}

export async function getBlock(id: number) {
  const rows = await getDb().select().from(scheduleBlocks).where(eq(scheduleBlocks.id, id)).limit(1);
  return rows[0] || null;
}

export async function moveBlock(id: number, direction: "up" | "down") {
  const db = getDb();
  const self = await getBlock(id);
  if (!self) return { ok: false, reason: "block not found" };
  const planBlocks = await db.select().from(scheduleBlocks)
    .where(eq(scheduleBlocks.planId, (self as any).planId))
    .orderBy(scheduleBlocks.sortOrder);
  const idx = planBlocks.findIndex((b: any) => b.id === id);
  const neighborIdx = direction === "up" ? idx - 1 : idx + 1;
  if (idx < 0 || neighborIdx < 0 || neighborIdx >= planBlocks.length) {
    return { ok: false, reason: "at edge" };
  }
  const me: any = planBlocks[idx];
  const neighbor: any = planBlocks[neighborIdx];
  await db.update(scheduleBlocks).set({ sortOrder: neighbor.sortOrder }).where(eq(scheduleBlocks.id, me.id));
  await db.update(scheduleBlocks).set({ sortOrder: me.sortOrder }).where(eq(scheduleBlocks.id, neighbor.id));
  return { ok: true };
}

/* ============================== ADVENTURES ================================ */
export async function listAdventures() {
  return getDb().select().from(adventures).orderBy(desc(adventures.isFavorite), adventures.title);
}

export async function getAdventure(id: number) {
  const rows = await getDb().select().from(adventures).where(eq(adventures.id, id)).limit(1);
  return rows[0] || null;
}

export async function insertAdventure(a: typeof adventures.$inferInsert) {
  await getDb().insert(adventures).values(a);
}

export async function toggleAdventureFavorite(id: number) {
  const a = await getAdventure(id);
  if (!a) return;
  await getDb().update(adventures).set({ isFavorite: !a.isFavorite }).where(eq(adventures.id, id));
}

export async function updateAdventureCover(id: number, coverImageUrl: string) {
  await getDb().update(adventures).set({ coverImageUrl }).where(eq(adventures.id, id));
  return getAdventure(id);
}

/**
 * v2.18 (2026-05-17) — Generic adventure update helper.
 *
 * Lets Mom rename / re-describe / change theme of any existing
 * adventure without raw SQL. Every column except `id` and `createdAt`
 * is patchable; the caller passes only the fields they're changing.
 * Returns the fresh row so the UI can confirm the update.
 */
export async function updateAdventure(
  id: number,
  patch: Partial<typeof adventures.$inferInsert>,
) {
  // Strip undefined keys so Drizzle doesn't try to overwrite columns
  // the caller didn't intend to touch (Drizzle's `.set()` treats
  // explicit `undefined` as "set to NULL" for some column types).
  const cleaned: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(patch)) {
    if (v !== undefined) cleaned[k] = v;
  }
  if (Object.keys(cleaned).length === 0) {
    return getAdventure(id);
  }
  await getDb().update(adventures).set(cleaned as any).where(eq(adventures.id, id));
  return getAdventure(id);
}

/**
 * v2.18 — Targeted helper for the AgendaEditor adventure-materials
 * sub-panel. Replaces the entire `materials` array atomically so the
 * UI can hand us the post-edit list directly without diffing.
 */
export async function updateAdventureMaterials(id: number, materials: string[]) {
  await getDb().update(adventures).set({ materials }).where(eq(adventures.id, id));
  return getAdventure(id);
}

/**
 * v2.18 — Soft-coupled delete. We keep this gated to familyAdmin in
 * routers.ts; here we just remove the row. Adventures are reference
 * data, not journal data, so a hard delete is appropriate.
 */
export async function deleteAdventure(id: number) {
  await getDb().delete(adventures).where(eq(adventures.id, id));
}

/* ============================== APPS ====================================== */
export async function listAppLinks() {
  return getDb().select().from(appLinks).orderBy(appLinks.sortOrder);
}
export async function insertAppLink(a: typeof appLinks.$inferInsert) {
  await getDb().insert(appLinks).values(a);
}

/* ============================== APP ACCOUNTS ============================== */
/**
 * Return all app account rows ordered by sort, but never expose the encrypted
 * password / iv to non-admin callers. The router decides who's allowed.
 */
export async function listAppAccounts(opts: { withSecrets?: boolean } = {}) {
  const rows = await getDb().select().from(appAccounts).orderBy(appAccounts.sortOrder, appAccounts.appName);
  if (opts.withSecrets) return rows;
  return rows.map((r) => ({
    ...r,
    passwordEncrypted: null,
    passwordIv: null,
  }));
}

export async function getAppAccount(id: number) {
  const rows = await getDb().select().from(appAccounts).where(eq(appAccounts.id, id)).limit(1);
  return rows[0] || null;
}

export async function getAppAccountByKey(key: string) {
  const rows = await getDb().select().from(appAccounts).where(eq(appAccounts.appKey, key)).limit(1);
  return rows[0] || null;
}

export async function insertAppAccount(a: typeof appAccounts.$inferInsert) {
  await getDb().insert(appAccounts).values(a);
}

export async function updateAppAccount(id: number, patch: Partial<typeof appAccounts.$inferInsert>) {
  await getDb().update(appAccounts).set(patch).where(eq(appAccounts.id, id));
}

export async function deleteAppAccount(id: number) {
  await getDb().delete(appAccounts).where(eq(appAccounts.id, id));
}

/**
 * Idempotently insert the seed apps if no rows exist yet. Safe to call on
 * every list. Uses the canonical app keys we'll reference in the UI.
 */
export async function seedAppAccountsIfEmpty() {
  const existing = await getDb().select().from(appAccounts).limit(1);
  if (existing.length > 0) return;
  const seed: Array<typeof appAccounts.$inferInsert> = [
    { appKey: "ixl", appName: "IXL Learning", appUrl: "https://www.ixl.com", signupUrl: "https://www.ixl.com/membership/family/select", emoji: "📊", category: "learning", isPaid: true, hasFamilyTier: true, sortOrder: 1, notes: "Math + ELA. Family plan ~ $19/mo. Excellent diagnostic + skill plans." },
    { appKey: "khan", appName: "Khan Academy", appUrl: "https://www.khanacademy.org", signupUrl: "https://www.khanacademy.org/signup", emoji: "🎓", category: "learning", isPaid: false, hasFamilyTier: true, sortOrder: 2, notes: "Free. Use Khan Kids for younger; main site for 5th grade." },
    { appKey: "khan_kids", appName: "Khan Academy Kids", appUrl: "https://learn.khanacademy.org/khan-academy-kids/", signupUrl: "https://learn.khanacademy.org/khan-academy-kids/", emoji: "🌳", category: "learning", isPaid: false, hasFamilyTier: true, sortOrder: 3 },
    { appKey: "brainpop", appName: "BrainPOP", appUrl: "https://www.brainpop.com", signupUrl: "https://www.brainpop.com/account/family/?ref=for-home", emoji: "🧠", category: "learning", isPaid: true, hasFamilyTier: true, sortOrder: 4, notes: "Family subscription supports homeschool. ~$15/mo." },
    { appKey: "edpuzzle", appName: "Edpuzzle", appUrl: "https://edpuzzle.com", signupUrl: "https://edpuzzle.com/join", emoji: "🎬", category: "learning", isPaid: false, hasFamilyTier: false, sortOrder: 5, notes: "Pair videos with quick checks. Free tier OK." },
    { appKey: "vocabulary", appName: "Vocabulary.com", appUrl: "https://www.vocabulary.com", signupUrl: "https://www.vocabulary.com/account/register/", emoji: "📖", category: "learning", isPaid: false, hasFamilyTier: false, sortOrder: 6 },
    { appKey: "prodigy", appName: "Prodigy Math", appUrl: "https://www.prodigygame.com", signupUrl: "https://www.prodigygame.com/main-en/parent-account/", emoji: "🐉", category: "learning", isPaid: false, hasFamilyTier: true, sortOrder: 7 },
    { appKey: "mystery_science", appName: "Mystery Science", appUrl: "https://mysteryscience.com", signupUrl: "https://mysteryscience.com/registrations/new", emoji: "🔬", category: "learning", isPaid: false, hasFamilyTier: false, sortOrder: 8 },
    { appKey: "storyline_online", appName: "Storyline Online", appUrl: "https://storylineonline.net", signupUrl: null, emoji: "📚", category: "reading", isPaid: false, hasFamilyTier: false, sortOrder: 9, notes: "No login needed." },
    { appKey: "outschool", appName: "Outschool", appUrl: "https://outschool.com", signupUrl: "https://outschool.com/users/sign_up", emoji: "🏫", category: "learning", isPaid: true, hasFamilyTier: true, sortOrder: 10, notes: "Per-class pricing. Great for special-interest deep dives." },
    { appKey: "adobe_express", appName: "Adobe Express for Education", appUrl: "https://express.adobe.com", signupUrl: "https://express.adobe.com/students", emoji: "🎨", category: "creativity", isPaid: false, hasFamilyTier: false, sortOrder: 11 },
    { appKey: "code_org", appName: "Code.org", appUrl: "https://code.org", signupUrl: "https://studio.code.org/users/sign_up", emoji: "💻", category: "learning", isPaid: false, hasFamilyTier: false, sortOrder: 12 },
    { appKey: "inaturalist", appName: "iNaturalist", appUrl: "https://www.inaturalist.org", signupUrl: "https://www.inaturalist.org/signup", emoji: "🦋", category: "nature", isPaid: false, hasFamilyTier: false, sortOrder: 13 },
    { appKey: "merlin", appName: "Merlin Bird ID", appUrl: "https://merlin.allaboutbirds.org", signupUrl: null, emoji: "🐦", category: "nature", isPaid: false, hasFamilyTier: false, sortOrder: 14, notes: "Mobile app, no signup needed." },
  ];
  for (const row of seed) {
    try { await getDb().insert(appAccounts).values(row); } catch { /* ignore dup */ }
  }
}


/* ============================== BOOKS ===================================== */
export async function listBooks() {
  // Lazy one-time starter-shelf seed so Reagan's bookshelf is never blank.
  try { await seedStarterBooksIfEmpty(); } catch {}
  const rows = await getDb().select().from(books).orderBy(books.title);
  // Guard: vitest-seeded test rows (title or author containing "vitest") must
  // never surface to the UI even if the DB still has them between runs.
  return (rows as any[]).filter(
    (r) => {
      const t = String(r.title ?? "").toLowerCase();
      const a = String((r as any).author ?? "").toLowerCase();
      return !t.includes("vitest") && !a.includes("vitest");
    },
  );
}
export async function getBook(id: number) {
  const rows = await getDb().select().from(books).where(eq(books.id, id)).limit(1);
  return rows[0] || null;
}
/**
 * v2.26 (2026-05-17) — raw, unfiltered list of book rows.
 *
 * `listBooks()` intentionally hides vitest-tainted rows from the UI. That
 * shield is correct for production read paths, but it makes test cleanup
 * impossible because the suite-level `afterAll` hook in
 * `listBooksFilter.test.ts` cannot see the rows it needs to delete. This
 * helper exposes the un-filtered view ONLY for cleanup. Treat it as test
 * infrastructure: do not use in product code.
 */
export async function listBooksRaw() {
  return getDb().select().from(books).orderBy(books.title);
}
export async function insertBook(b: typeof books.$inferInsert) {
  await getDb().insert(books).values(b);
}

/**
 * Seed a starter shelf of real, legal, kid-appropriate books if the table is
 * empty. Runs once the first time the app boots (or is hit via the admin
 * `books.seedStarter` procedure). Idempotent by title+author.
 */
export async function seedStarterBooksIfEmpty() {
  const db = getDb();
  const existing: any = await db.select().from(books).limit(1);
  if (existing.length > 0) return { seeded: false };
  const defaults: Array<typeof books.$inferInsert> = [
    { title: "Tuck Everlasting",                author: "Natalie Babbitt",         type: "novel",     subjectSlug: "ela",     currentPage: 1, totalPages: 144, notes: "Current tutor read-aloud. 5th grade Ohio ELA anchor text." },
    { title: "Charlotte's Web",                 author: "E. B. White",             type: "novel",     subjectSlug: "ela",     currentPage: 1, totalPages: 184, notes: "Comfort read. Great for characterization + theme work." },
    { title: "Because of Winn-Dixie",           author: "Kate DiCamillo",          type: "novel",     subjectSlug: "ela",     currentPage: 1, totalPages: 192, notes: "Gentle, animals + found family." },
    { title: "The One and Only Ivan",           author: "Katherine Applegate",     type: "novel",     subjectSlug: "ela",     currentPage: 1, totalPages: 305, notes: "Newbery winner. Short chapters help regulation." },
    { title: "Wonder",                          author: "R. J. Palacio",           type: "novel",     subjectSlug: "ela",     currentPage: 1, totalPages: 320, notes: "Social-emotional rich; multiple narrators." },
    { title: "Fractions, Decimals, and Percents", author: "David A. Adler",         type: "reference", subjectSlug: "math",    currentPage: 1, totalPages:  32, notes: "Visual picture book \u2014 ties to current math standards." },
    { title: "National Geographic Kids Almanac 2026", author: "National Geographic Kids", type: "reference", subjectSlug: "science", currentPage: 1, totalPages: 352, notes: "Flip-through science + social studies reference." },
    { title: "Who Was Jane Goodall?",           author: "Roberta Edwards",         type: "reference", subjectSlug: "ss",      currentPage: 1, totalPages: 112, notes: "Biography \u2014 connects to Reagan's animal-rescuer identity." },
    { title: "The Milli Adventures",            author: "Marcy Nyerges",           type: "novel",     subjectSlug: "ela",     currentPage: 1, totalPages:  48, notes: "Grandma's book \u2014 Scribbleverse anchor." },
  ];
  for (const b of defaults) {
    await db.insert(books).values(b);
  }
  return { seeded: true, count: defaults.length };
}
export async function updateBookPage(id: number, currentPage: number) {
  await getDb().update(books).set({ currentPage }).where(eq(books.id, id));
}
export async function updateBookChapter(id: number, currentChapter: number) {
  await getDb().update(books).set({ currentChapter } as any).where(eq(books.id, id));
}
export async function setBookStatus(id: number, status: "not_started" | "in_progress" | "in_progress_unstructured" | "done" | "shelved") {
  await getDb().update(books).set({ status } as any).where(eq(books.id, id));
}

/* ============================== BOOK PAGES DONE =========================== *
 * Sparse storage of pages already completed (for scattered/unstructured
 * progress reconciliation — used by the AI scheduler to avoid re-assigning
 * pages a tutor already marked off).
 * ========================================================================== */
export async function listBookPagesDone(bookId: number) {
  return getDb().select().from(bookPagesDone).where(eq(bookPagesDone.bookId, bookId)).orderBy(asc(bookPagesDone.pageNumber));
}
export async function markBookPagesDone(bookId: number, pageNumbers: number[], opts: { source?: "tutor_recon" | "agenda_complete" | "manual"; completedBy?: string; note?: string } = {}) {
  if (!pageNumbers.length) return { added: 0 };
  const rows = pageNumbers.map((p) => ({
    bookId,
    pageNumber: p,
    status: "done" as const,
    source: (opts.source || "manual") as any,
    completedBy: opts.completedBy ?? null,
    note: opts.note ?? null,
  }));
  // INSERT IGNORE semantics via ON DUPLICATE KEY UPDATE that no-ops
  await getDb().insert(bookPagesDone).values(rows).onDuplicateKeyUpdate({ set: { status: sql`status` } });
  return { added: rows.length };
}
export async function unmarkBookPage(bookId: number, pageNumber: number) {
  await getDb().delete(bookPagesDone).where(and(eq(bookPagesDone.bookId, bookId), eq(bookPagesDone.pageNumber, pageNumber)));
}

/**
 * Compute the next page span the AI scheduler should assign for a workbook,
 * skipping any pages already in `bookPagesDone`. Returns null when the book
 * is finished. Used by the agenda generator + the adult AI bar.
 */
export async function nextPageSpanForBook(bookId: number, span?: number): Promise<{ from: number; to: number } | null> {
  const book: any = await getBook(bookId);
  if (!book) return null;
  const total = book.totalPages || null;
  const want = Math.max(1, span || book.defaultDailyPageSpan || 2);
  const done = (await listBookPagesDone(bookId)).map((r: any) => Number(r.pageNumber));
  const doneSet = new Set(done);
  let cur = Math.max(1, Number(book.currentPage || 1));
  // Walk forward to the first not-done page
  while (doneSet.has(cur)) cur++;
  if (total && cur > total) return null;
  let from = cur;
  let to = cur;
  let added = 1;
  while (added < want) {
    const next = to + 1;
    if (total && next > total) break;
    if (doneSet.has(next)) {
      // skip the done one but don't extend the span across the gap
      break;
    }
    to = next;
    added++;
  }
  return { from, to };
}

/* ============================== MOOD ====================================== */
export async function logMood(planId: number, zone: any, note: string | null, userId: number | null) {
  await getDb().insert(moodLogs).values({ planId, zone, note, loggedByUserId: userId });
}
export async function listMoodForPlan(planId: number) {
  return getDb().select().from(moodLogs).where(eq(moodLogs.planId, planId)).orderBy(desc(moodLogs.loggedAt));
}
export async function listRecentMood(daysBack = 14) {
  const since = new Date(Date.now() - daysBack * 86400000);
  return getDb().select().from(moodLogs).where(gte(moodLogs.loggedAt, since)).orderBy(desc(moodLogs.loggedAt));
}

/* ============================== TIMELINE ================================== */
export async function listTimelineEvents(limit = 100) {
  return getDb().select().from(timelineEvents).orderBy(desc(timelineEvents.date), desc(timelineEvents.createdAt)).limit(limit);
}
export async function insertTimelineEvent(e: typeof timelineEvents.$inferInsert) {
  await getDb().insert(timelineEvents).values(e);
}

/* ============================== NOTIFICATIONS ============================= */
export async function listNotifications(userId: number | null) {
  const db = getDb();
  if (userId) {
    return db.select().from(notifications).where(eq(notifications.userId, userId)).orderBy(desc(notifications.createdAt)).limit(50);
  }
  return db.select().from(notifications).orderBy(desc(notifications.createdAt)).limit(50);
}
export async function createNotification(n: typeof notifications.$inferInsert) {
  await getDb().insert(notifications).values(n);
}
export async function markNotificationRead(id: number) {
  await getDb().update(notifications).set({ read: true }).where(eq(notifications.id, id));
}

/* ============================== IH ASSIGNMENTS ============================ */
/**
 * @deprecated v2.94 (2026-05-27) — Indian Hill (the public school Reagan left)
 * is no longer the source of truth for assignments. The `ihAssignments` table
 * + the `bookAssignments.ihAssignmentId` FK column are scheduled for removal
 * in the next session after the user confirms. Helpers below are unreferenced
 * by any router/client (verified via grep). Keeping the table around so the
 * `autoCompleteFromHistory` heuristic at line ~5133 doesn't have to change
 * shape until the DROP migration ships. Do not call from new code.
 */
export async function listIHAssignments(daysBack = 14) {
  const since = new Date(Date.now() - daysBack * 86400000);
  return getDb().select().from(ihAssignments).where(gte(ihAssignments.syncedAt, since)).orderBy(desc(ihAssignments.postedAt));
}
/** @deprecated see listIHAssignments above. */
export async function insertIHAssignment(a: typeof ihAssignments.$inferInsert) {
  await getDb().insert(ihAssignments).values(a);
}

/* ============================== PROFILE =================================== */
export async function getProfile() {
  const rows = await getDb().select().from(learnerProfile).limit(1);
  return rows[0] || null;
}
export async function upsertProfile(patch: Partial<typeof learnerProfile.$inferInsert>) {
  const db = getDb();
  const existing = await getProfile();
  if (existing) {
    await db.update(learnerProfile).set(patch).where(eq(learnerProfile.id, existing.id));
  } else {
    await db.insert(learnerProfile).values({ studentName: "Reagan", gradeLevel: "5th Grade", ...patch } as any);
  }
  return getProfile();
}

/* ============================== SKILLS MASTERY ============================ */
export async function listSkills() {
  return getDb().select().from(skillsMastery).orderBy(skillsMastery.subjectSlug, skillsMastery.skillName);
}
export async function listSkillsBySubject(slug: string) {
  return getDb().select().from(skillsMastery).where(eq(skillsMastery.subjectSlug, slug));
}
export async function upsertSkill(s: typeof skillsMastery.$inferInsert & { id?: number }) {
  const db = getDb();
  if (s.id) {
    await db.update(skillsMastery).set(s).where(eq(skillsMastery.id, s.id));
  } else {
    await db.insert(skillsMastery).values(s);
  }
}
export async function listGapSkills(threshold = 70) {
  return getDb().select().from(skillsMastery).where(lte(skillsMastery.currentScore, threshold)).orderBy(skillsMastery.currentScore);
}

/* ============================== WEEKLY TOPICS ============================= */
export async function getWeeklyTopics(weekStart: string) {
  return getDb().select().from(weeklyTopics).where(eq(weeklyTopics.weekStartDate, weekStart as any));
}
export async function upsertWeeklyTopic(w: typeof weeklyTopics.$inferInsert) {
  await getDb().insert(weeklyTopics).values(w);
}

/**
 * IH "this week" lookup. Computes the active Monday in EDT (handles weekends
 * by snapping to the most recent Monday) and returns all weeklyTopics rows for
 * that Monday, joined with a hint about which IH week tag applies.
 */
export async function getIhTopicsThisWeek() {
  const today = new Date();
  // Snap to Monday (ISO weekday 1). If today is Sat/Sun, this still rolls back
  // to the same week's Monday, matching how IH publishes weekly updates.
  const day = today.getDay(); // 0 Sun .. 6 Sat
  const offsetToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(today.getFullYear(), today.getMonth(), today.getDate() + offsetToMonday);
  const ymd = `${monday.getFullYear()}-${String(monday.getMonth()+1).padStart(2,"0")}-${String(monday.getDate()).padStart(2,"0")}`;
  const rows = await getDb().select().from(weeklyTopics).where(eq(weeklyTopics.weekStartDate, ymd as any));
  // Derive ihWeekTag from the notes field (we wrote "... Q4-Wxx ...")
  let ihWeekTag: string | null = null;
  for (const r of rows) {
    const m = (r.notes || "").match(/Q\d-W\d+/);
    if (m) { ihWeekTag = m[0]; break; }
  }
  return { weekStart: ymd, ihWeekTag, topics: rows };
}

/* ============================== RECIPIENTS ================================ */
export async function listRecipients() {
  return getDb().select().from(notificationRecipients).where(eq(notificationRecipients.active, true));
}
export async function insertRecipient(r: typeof notificationRecipients.$inferInsert) {
  await getDb().insert(notificationRecipients).values(r);
}

/* ============================== APPOINTMENTS ============================== */
export async function listAppointments() {
  return getDb().select().from(appointments).where(eq(appointments.active, true));
}
export async function insertAppointment(a: typeof appointments.$inferInsert) {
  await getDb().insert(appointments).values(a);
}

/* ============================== SCHOOL CALENDAR =========================== */
export async function isSchoolOff(dateStr: string) {
  const rows = await getDb().select().from(schoolCalendar).where(eq(schoolCalendar.date, dateStr as any)).limit(1);
  return rows[0]?.isOff || false;
}
export async function listSchoolCalendar() {
  return getDb().select().from(schoolCalendar).orderBy(schoolCalendar.date);
}
export async function insertSchoolCalendar(c: typeof schoolCalendar.$inferInsert) {
  await getDb().insert(schoolCalendar).values(c);
}

/* ============================== ANIMALS =================================== */
export async function listAnimals() {
  return getDb().select().from(animals).where(eq(animals.isActive, true)).orderBy(animals.sortOrder, animals.name);
}
export async function insertAnimal(a: typeof animals.$inferInsert) {
  await getDb().insert(animals).values(a);
}
export async function updateAnimal(id: number, patch: Partial<typeof animals.$inferInsert>) {
  await getDb().update(animals).set(patch).where(eq(animals.id, id));
}

/* ============================== RESCUES =================================== */
export async function listRescues(limit = 100) {
  return getDb().select().from(rescues).orderBy(desc(rescues.dateFound)).limit(limit);
}
export async function insertRescue(r: typeof rescues.$inferInsert) {
  await getDb().insert(rescues).values(r);
}
export async function updateRescue(id: number, patch: Partial<typeof rescues.$inferInsert>) {
  await getDb().update(rescues).set(patch).where(eq(rescues.id, id));
}

/* ============================== BADGES ==================================== */
export async function listBadges() {
  return getDb().select().from(badges).orderBy(desc(badges.earned), badges.name);
}
export async function upsertBadge(b: typeof badges.$inferInsert) {
  const db = getDb();
  await db.insert(badges).values(b).onDuplicateKeyUpdate({
    set: { name: b.name, emoji: b.emoji, description: b.description, criteria: b.criteria, target: b.target },
  });
}
export async function progressBadge(slug: string, increment = 1) {
  const db = getDb();
  const rows = await db.select().from(badges).where(eq(badges.slug, slug)).limit(1);
  const b = rows[0];
  if (!b) return false;
  const target = b.target ?? 1;
  const progress = b.progress ?? 0;
  const earned = b.earned ?? false;
  const newProgress = Math.min(progress + increment, target);
  const justEarned = !earned && newProgress >= target;
  await db.update(badges).set({
    progress: newProgress,
    earned: newProgress >= target,
    earnedAt: justEarned ? new Date() : b.earnedAt,
  }).where(eq(badges.slug, slug));
  return justEarned;
}

/* ============================== WHISPER SESSIONS ========================== */
export async function listKiwiMessages(limit = 50) {
  return getDb().select().from(whisperSessions).orderBy(desc(whisperSessions.createdAt)).limit(limit);
}
export async function insertKiwiMessage(m: typeof whisperSessions.$inferInsert) {
  await getDb().insert(whisperSessions).values(m);
}
export async function clearKiwiHistory() {
  await getDb().delete(whisperSessions);
}

/**
 * 2026-05-05 + push 16 (2026-05-12): kiwi behavior — derived from
 * whisperSessions (Reagan ↔ Kiwi chat) and `actualAgendaEntries.source='kiwi-listened'`
 * (passive Kiwi listening events). Returns null when there's NO data
 * for the day so the frontend can honor the "don't show if no info" rule.
 */
export async function kiwiBehaviorForDate(dateStr: string) {
  const start = new Date(dateStr + "T00:00:00");
  const end = new Date(dateStr + "T23:59:59");
  const rows = await getDb().select().from(whisperSessions)
    .where(and(gte(whisperSessions.createdAt, start), lte(whisperSessions.createdAt, end)));
  // Kiwi-initiated check-ins are recorded as actualAgendaEntries with
  // source='kiwi-listened'. We pull them in the same window so the card
  // can show "X interactions + Y check-ins."
  let kiwiInitiatedCount = 0;
  try {
    const checkins = await getDb().select().from(actualAgendaEntries)
      .where(and(
        eq(actualAgendaEntries.dateISO as any, dateStr),
        eq(actualAgendaEntries.source as any, "kiwi-listened" as any),
      ));
    kiwiInitiatedCount = checkins.length;
  } catch { /* table may not exist in older fixtures */ }
  if (rows.length === 0 && kiwiInitiatedCount === 0) return null;
  const userMsgs = rows.filter((r: any) => r.role === "user");
  const aiMsgs = rows.filter((r: any) => r.role !== "user");
  // "Top topic" is the most-used non-stopword across user messages today.
  // We don't run an LLM for this — too expensive for a card. Cheap word-bag
  // heuristic that surfaces the noun Reagan asked about most.
  const STOP = new Set([
    "the","a","an","is","i","you","to","of","and","it","in","on","for","do",
    "can","with","my","me","we","are","was","this","that","have","has",
    "what","how","why","where","when","who","be","so","if","like","just",
    "about","but","or","not","no","yes","its","it's","i'm","i'll",
    "please","kiwi","hi","hey","hello",
  ]);
  const counts = new Map<string, number>();
  for (const m of userMsgs) {
    const text = String((m as any).content || "").toLowerCase();
    for (const word of text.match(/[a-z][a-z']{2,}/g) || []) {
      if (STOP.has(word)) continue;
      counts.set(word, (counts.get(word) || 0) + 1);
    }
  }
  let topTopic: string | null = null;
  let topTopicCount = 0;
  counts.forEach((n, w) => {
    if (n > topTopicCount) { topTopicCount = n; topTopic = w; }
  });
  return {
    interactions: rows.length,
    userMessages: userMsgs.length,
    aiMessages: aiMsgs.length,
    kiwiInitiatedCount,
    topTopic,
    topTopicCount,
    firstAt: rows[0]?.createdAt ?? null,
    lastAt: rows[rows.length - 1]?.createdAt ?? null,
  };
}

export async function kiwiBehaviorAggregate() {
  const rows = await getDb().select().from(whisperSessions);
  if (rows.length === 0) return null;
  const dayKey = (d: Date) => d.toISOString().slice(0, 10);
  const days = new Set(rows.map((r: any) => dayKey(new Date(r.createdAt))));
  // Longest streak of consecutive day-keys with any interaction.
  const sortedDays = Array.from(days).sort();
  let longestStreak = 0;
  let current = 0;
  let prev: string | null = null;
  for (const d of sortedDays) {
    if (prev === null) {
      current = 1;
    } else {
      const prevDate = new Date(prev + "T00:00:00Z");
      const cur = new Date(d + "T00:00:00Z");
      const diffDays = Math.round((cur.getTime() - prevDate.getTime()) / 86_400_000);
      current = diffDays === 1 ? current + 1 : 1;
    }
    if (current > longestStreak) longestStreak = current;
    prev = d;
  }
  return {
    totalInteractions: rows.length,
    daysTogether: days.size,
    avgInteractionsPerDay: days.size === 0 ? 0 : Math.round(rows.length / days.size),
    longestStreak,
    firstAt: rows.reduce((acc: Date, r: any) => {
      const d = new Date(r.createdAt);
      return acc && acc < d ? acc : d;
    }, null as any),
  };
}

/* ============================== HEART NOTES =============================== */
export async function listHeartNotes(limit = 50) {
  return getDb().select().from(heartNotes).orderBy(desc(heartNotes.createdAt)).limit(limit);
}
export async function insertHeartNote(h: typeof heartNotes.$inferInsert) {
  await getDb().insert(heartNotes).values(h);
}

/* ============================== ENCOURAGEMENT ============================= */
export async function listEncouragement(unreadOnly = false) {
  const db = getDb();
  if (unreadOnly) {
    return db.select().from(encouragementNotes).where(eq(encouragementNotes.read, false)).orderBy(desc(encouragementNotes.createdAt));
  }
  return db.select().from(encouragementNotes).orderBy(desc(encouragementNotes.createdAt)).limit(50);
}
export async function insertEncouragement(n: typeof encouragementNotes.$inferInsert) {
  await getDb().insert(encouragementNotes).values(n);
}
export async function markEncouragementRead(id: number) {
  await getDb().update(encouragementNotes).set({ read: true }).where(eq(encouragementNotes.id, id));
}
export async function starEncouragement(id: number, starred: boolean) {
  await getDb().update(encouragementNotes).set({ starred }).where(eq(encouragementNotes.id, id));
}

/* ============================== EMOTIONAL STRUGGLES ======================= */
export async function listStruggles(daysBack = 30) {
  const since = new Date(Date.now() - daysBack * 86400000);
  return getDb().select().from(emotionalStruggles).where(gte(emotionalStruggles.loggedAt, since)).orderBy(desc(emotionalStruggles.loggedAt));
}
export async function insertStruggle(s: typeof emotionalStruggles.$inferInsert) {
  await getDb().insert(emotionalStruggles).values(s);
}
export async function listStrugglesBySubject(slug: string) {
  return getDb().select().from(emotionalStruggles).where(eq(emotionalStruggles.subjectSlug, slug));
}

/* ============================== SPECIAL DAYS ============================== */
export async function getSpecialDayForDate(dateStr: string) {
  return getDb().select().from(specialDays).where(eq(specialDays.date, dateStr as any));
}
export async function listUpcomingSpecialDays(limit = 30) {
  const today = new Date().toISOString().slice(0, 10);
  return getDb().select().from(specialDays).where(gte(specialDays.date, today as any)).orderBy(specialDays.date).limit(limit);
}
export async function insertSpecialDay(d: typeof specialDays.$inferInsert) {
  await getDb().insert(specialDays).values(d);
}

/* ============================== ANALYTICS HELPERS ========================= */
import { anxietyContributionFromZones, type WarningZone } from "./_lib/warningZones";
export async function wellnessScore(daysBack = 7) {
  const moods = await listRecentMood(daysBack);
  const struggles = await listStruggles(daysBack);
  const yellows = moods.filter(m => m.zone === "yellow").length;
  const reds = moods.filter(m => m.zone === "red").length;
  const greens = moods.filter(m => m.zone === "green").length;
  const totalMoods = moods.length || 1;
  // 2026-05-12: replaced legacy hard-coded `reds*30 + yellows*15` with the
  // canonical Color-Coded Warning Zones weights (server/_lib/warningZones.ts).
  // Black-zone moods (if any are logged) now contribute 60 each per the doc;
  // red struggles still add a small +10 each (intensity-based, separate signal).
  const observedZones: WarningZone[] = moods
    .map(m => m.zone as string)
    .filter((z): z is WarningZone => z === "green" || z === "yellow" || z === "red" || z === "black");
  const zoneContribution = anxietyContributionFromZones(observedZones);
  const struggleContribution = struggles.filter(s => s.intensity === "red").length * 10;
  const anxietyScore = Math.min(100, zoneContribution + struggleContribution);
  const cheerful = greens / totalMoods;
  const depressionScore = Math.round((1 - cheerful) * 60 + (reds * 5));
  return {
    anxietyScore,
    depressionScore: Math.min(100, depressionScore),
    greens, yellows, reds,
    struggleCount: struggles.length,
    cheerfulRatio: cheerful,
  };
}


/* ============================== KNOWLEDGE ================================== */
export async function listKnowledge(activeOnly = true) {
  const db = getDb();
  if (activeOnly) {
    return await db.select().from(reaganKnowledge).where(eq(reaganKnowledge.active, true)).orderBy(desc(reaganKnowledge.createdAt));
  }
  return await db.select().from(reaganKnowledge).orderBy(desc(reaganKnowledge.createdAt));
}

export async function listKnowledgeForKiwi(limit = 30) {
  const db = getDb();
  return await db.select().from(reaganKnowledge)
    .where(and(eq(reaganKnowledge.active, true), eq(reaganKnowledge.sensitive, false)))
    .orderBy(desc(reaganKnowledge.createdAt)).limit(limit);
}

export async function insertKnowledge(data: {
  source: "gmail"|"gdrive"|"manual"|"chat_history",
  sourceTitle?: string|null, sourceUrl?: string|null, sourceDate?: string|null,
  insightType: "academic_strength"|"academic_gap"|"trigger"|"accommodation"|"interest"|"medical"|"social"|"preference"|"quote"|"strategy"|"context"|"general",
  insight: string,
  confidence?: "low"|"medium"|"high",
  sensitive?: boolean,
  approvedBy?: number|null,
}) {
  const db = getDb();
  const [r] = await db.insert(reaganKnowledge).values(data as any);
  return { id: (r as any).insertId };
}

export async function updateKnowledge(id: number, patch: Partial<typeof reaganKnowledge.$inferInsert>) {
  const db = getDb();
  await db.update(reaganKnowledge).set(patch as any).where(eq(reaganKnowledge.id, id));
}

export async function deleteKnowledge(id: number) {
  const db = getDb();
  await db.delete(reaganKnowledge).where(eq(reaganKnowledge.id, id));
}


/* ============================== JOURNAL =================================== */
export async function listJournalEntries(limit = 50) {
  const db = getDb();
  return db.select().from(journalEntries).orderBy(desc(journalEntries.date), desc(journalEntries.id)).limit(limit);
}
export async function createJournalEntry(patch: { date: string; title?: string; body: string; mood?: string }) {
  const db = getDb();
  await db.insert(journalEntries).values(patch as any);
  const rows = await db.select().from(journalEntries).orderBy(desc(journalEntries.id)).limit(1);
  return rows[0];
}
export async function deleteJournalEntry(id: number) {
  const db = getDb();
  await db.delete(journalEntries).where(eq(journalEntries.id, id));
}

/**
 * bumpFromJournal — scan a journal body for soft-skill mentions and auto-create
 * matching ProudMoments. Idempotent-ish: we won't double-bump for the same
 * journal entry within a single call. Plus 3-day-streak bonus: if Reagan
 * journals on 3 consecutive days that include a category keyword, we add a
 * "3-day streak" growth ProudMoment too.
 */
export async function bumpFromJournal(opts: { date: string; body: string }) {
  const db = getDb();
  const body = (opts.body || "").toLowerCase();
  const HITS: Array<{ category: "effort" | "kindness" | "bravery" | "persistence" | "creativity" | "wonder"; rx: RegExp; emoji: string; titleVerb: string }> = [
    { category: "effort",      rx: /\b(tried|tried hard|kept going|focused|stuck with it|worked on)\b/i, emoji: "\ud83d\udcaa", titleVerb: "effort" },
    { category: "kindness",    rx: /\b(helped|kind|shared|comforted|hugged|nice to)\b/i,                  emoji: "\ud83d\udc9b", titleVerb: "kindness" },
    { category: "bravery",     rx: /\b(brave|scared but|tried anyway|new thing|first time)\b/i,           emoji: "\ud83e\udd81", titleVerb: "bravery" },
    { category: "persistence", rx: /\b(again|kept trying|didn'?t give up|practiced|finished it)\b/i,      emoji: "\ud83d\udd01", titleVerb: "persistence" },
    { category: "creativity",  rx: /\b(made|drew|wrote|built|created|invented|imagined)\b/i,              emoji: "\ud83c\udfa8", titleVerb: "creativity" },
    { category: "wonder",      rx: /\b(wondered|noticed|discovered|saw a|why does|how come)\b/i,          emoji: "\u2728",       titleVerb: "wonder" },
  ];
  const matched = HITS.filter(h => h.rx.test(body));
  const created: Array<{ category: string; title: string }> = [];
  for (const m of matched) {
    const title = `Caught a moment of ${m.titleVerb} \u2014 ${opts.date}`;
    await db.insert(proudMoments).values({
      source: "auto" as any,
      category: m.category as any,
      title,
      body: opts.body.slice(0, 240),
      emoji: m.emoji,
      skillLadderId: null,
      blockId: null,
    } as any);
    created.push({ category: m.category, title });
  }

  // 3-day-streak bonus: only if at least one category hit today, AND the prior
  // two consecutive calendar days also contain a journal entry with a hit.
  let streakBonus: { category: string; title: string } | null = null;
  if (matched.length > 0) {
    try {
      const today = new Date(opts.date + "T00:00:00Z");
      const yest = new Date(today.getTime() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const dayBefore = new Date(today.getTime() - 48 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const recent = await db.select().from(journalEntries).where(inArray(journalEntries.date as any, [yest, dayBefore] as any));
      // MySQL date columns come back as Date instances, normalize to YYYY-MM-DD
      const norm = (d: any): string => {
        if (!d) return "";
        if (typeof d === "string") return d.slice(0, 10);
        try { return new Date(d).toISOString().slice(0, 10); } catch { return String(d).slice(0, 10); }
      };
      const RX = /\b(tried|kind|brave|kept|made|wonder|helped|shared|drew|focused)\b/i;
      const haveYest = (recent as any[]).some((r) => norm(r.date) === yest && RX.test(r.body || ""));
      const haveDayBefore = (recent as any[]).some((r) => norm(r.date) === dayBefore && RX.test(r.body || ""));
      if (haveYest && haveDayBefore) {
        const title = `3-day streak of soft-skill wins \ud83c\udf08`;
        await db.insert(proudMoments).values({
          source: "auto" as any,
          category: "growth" as any,
          title,
          body: "You showed up three days in a row \u2014 Kiwi noticed.",
          emoji: "\ud83c\udf08",
          skillLadderId: null,
          blockId: null,
        } as any);
        streakBonus = { category: "growth", title };
      }
    } catch { /* best-effort */ }
  }
  return { created, streakBonus };
}

/* ============================== HELP LIST ================================= */
export async function listHelpList() {
  const db = getDb();
  return db.select().from(helpList).orderBy(desc(helpList.id));
}
export async function createHelpItem(patch: { title: string; note?: string; subjectSlug?: string; priority?: "low"|"medium"|"high" }) {
  const db = getDb();
  await db.insert(helpList).values(patch as any);
}
export async function updateHelpItem(id: number, patch: Partial<typeof helpList.$inferInsert>) {
  const db = getDb();
  await db.update(helpList).set(patch).where(eq(helpList.id, id));
}
export async function deleteHelpItem(id: number) {
  const db = getDb();
  await db.delete(helpList).where(eq(helpList.id, id));
}

/* ============================== TAKE NOTES ================================ */
export async function listTakeNotes(params?: { subjectSlug?: string; limit?: number }) {
  const db = getDb();
  const rows = await db.select().from(takeNotes).orderBy(desc(takeNotes.updatedAt)).limit(params?.limit ?? 100);
  if (params?.subjectSlug) return rows.filter((r) => r.subjectSlug === params.subjectSlug);
  return rows;
}
export async function createTakeNote(patch: { subjectSlug?: string; title?: string; body?: string; strokes?: any; pngFileKey?: string; pngFileUrl?: string; tags?: string[]; linkedBlockId?: number | null }) {
  const db = getDb();
  await db.insert(takeNotes).values(patch as any);
  const rows = await db.select().from(takeNotes).orderBy(desc(takeNotes.id)).limit(1);
  return rows[0];
}
export async function updateTakeNote(id: number, patch: Partial<typeof takeNotes.$inferInsert>) {
  const db = getDb();
  await db.update(takeNotes).set(patch).where(eq(takeNotes.id, id));
}
export async function deleteTakeNote(id: number) {
  const db = getDb();
  await db.delete(takeNotes).where(eq(takeNotes.id, id));
}

/* ============================== ASSIGNMENT ANSWER KEYS ==================== */
export async function getAnswerKeyForBlock(blockId: number) {
  const db = getDb();
  const rows = await db.select().from(assignmentAnswerKeys).where(eq(assignmentAnswerKeys.blockId, blockId)).limit(1);
  return rows[0] || null;
}
export async function upsertAnswerKey(patch: { blockId: number; questions: any; totalPoints?: number }) {
  const db = getDb();
  const existing = await getAnswerKeyForBlock(patch.blockId);
  if (existing) {
    await db.update(assignmentAnswerKeys).set({ questions: patch.questions, totalPoints: patch.totalPoints ?? 100 } as any).where(eq(assignmentAnswerKeys.id, existing.id));
  } else {
    await db.insert(assignmentAnswerKeys).values(patch as any);
  }
  return getAnswerKeyForBlock(patch.blockId);
}

/* ============================== AUTO-GRADE ================================ */
export async function recordAutoGrade(patch: { submissionId: number; autoScore?: number; autoLetter?: string; autoFeedback?: string; answers?: Record<string,string> }) {
  const db = getDb();
  const rows = await db.select().from(assignmentSubmissionsAutoGrade).where(eq(assignmentSubmissionsAutoGrade.submissionId, patch.submissionId)).limit(1);
  if (rows[0]) {
    await db.update(assignmentSubmissionsAutoGrade).set(patch as any).where(eq(assignmentSubmissionsAutoGrade.id, rows[0].id));
  } else {
    await db.insert(assignmentSubmissionsAutoGrade).values(patch as any);
  }
}
export async function getAutoGrade(submissionId: number) {
  const db = getDb();
  const rows = await db.select().from(assignmentSubmissionsAutoGrade).where(eq(assignmentSubmissionsAutoGrade.submissionId, submissionId)).limit(1);
  return rows[0] || null;
}

/* ============================== BLOCK GRADES ============================= */
export async function getBlockGrade(blockId: number) {
  const db = getDb();
  const rows = await db.select().from(blockGrades).where(eq(blockGrades.blockId, blockId)).limit(1);
  return rows[0] || null;
}
export async function upsertBlockGrade(patch: { blockId: number; subjectSlug?: string; score: number; letter?: string; kidLabel?: "not_yet"|"getting_there"|"got_it"|"mastered"; note?: string; gradedByUserId?: number }) {
  const db = getDb();
  const existing = await getBlockGrade(patch.blockId);
  // auto derive letter if not set
  const letter = patch.letter || scoreToLetter(patch.score);
  const kidLabel = patch.kidLabel || scoreToKidLabel(patch.score);
  if (existing) {
    await db.update(blockGrades).set({ ...patch, letter, kidLabel } as any).where(eq(blockGrades.id, existing.id));
  } else {
    await db.insert(blockGrades).values({ ...patch, letter, kidLabel } as any);
  }
  return getBlockGrade(patch.blockId);
}
export async function listBlockGradesBySubject(subjectSlug: string, limit = 100) {
  const db = getDb();
  return db.select().from(blockGrades).where(eq(blockGrades.subjectSlug, subjectSlug)).orderBy(desc(blockGrades.gradedAt)).limit(limit);
}
export async function listAllBlockGrades(limit = 500) {
  const db = getDb();
  return db.select().from(blockGrades).orderBy(desc(blockGrades.gradedAt)).limit(limit);
}

export function scoreToLetter(s: number): string {
  if (s >= 90) return "A";
  if (s >= 80) return "B";
  if (s >= 70) return "C";
  if (s >= 60) return "D";
  return "F";
}
export function scoreToKidLabel(s: number): "not_yet"|"getting_there"|"got_it"|"mastered" {
  if (s >= 90) return "mastered";
  if (s >= 75) return "got_it";
  if (s >= 50) return "getting_there";
  return "not_yet";
}

/** Rolling grade per subject = avg of blockGrades.score for that subject (last 30) */
export async function rollingGradeForSubject(subjectSlug: string): Promise<{ score: number | null; letter: string | null; count: number }> {
  const rows = await listBlockGradesBySubject(subjectSlug, 30);
  if (rows.length === 0) return { score: null, letter: null, count: 0 };
  const avg = Math.round(rows.reduce((a, r) => a + (r.score || 0), 0) / rows.length);
  return { score: avg, letter: scoreToLetter(avg), count: rows.length };
}

/**
 * Per-subject rolling average computed from academicRecords (PowerSchool /
 * Classroom / report-card imports). Honors the schoolYear / term filter so
 * the Academics page can show "Math 2024-25 Q1" or "5th grade YR" rolls.
 * Only kind === 'grade' rows with a numeric scorePercent are included.
 */
export async function academicRollingAverage(filter: {
  subjectSlug?: string; schoolYear?: string; term?: string; grade?: string; teacher?: string;
}): Promise<{ score: number | null; letter: string | null; count: number }> {
  const rows = (await listAcademicRecords({ ...filter, limit: 500 })) as any[];
  const numeric = rows.filter(r => r.kind === "grade" && typeof r.scorePercent === "number" && Number.isFinite(r.scorePercent));
  if (numeric.length === 0) return { score: null, letter: null, count: 0 };
  const avg = Math.round(numeric.reduce((a, r) => a + Number(r.scorePercent), 0) / numeric.length);
  return { score: avg, letter: scoreToLetter(avg), count: numeric.length };
}

/* ============================== NEEDS WORK ================================ */
export async function listNeedsWork() {
  const db = getDb();
  return db.select().from(needsWorkItems).orderBy(needsWorkItems.sortOrder, needsWorkItems.id);
}
export async function createNeedsWork(patch: { parentId?: number | null; subjectSlug?: string; title: string; note?: string; origin?: "manual"|"mastery"|"struggle"|"low_grade"|"external"; sortOrder?: number; dateAdded?: string }) {
  const db = getDb();
  const today = new Date().toISOString().slice(0, 10);
  const result: any = await db.insert(needsWorkItems).values({
    parentId: patch.parentId ?? null,
    subjectSlug: patch.subjectSlug,
    title: patch.title,
    note: patch.note,
    origin: patch.origin || "manual",
    sortOrder: patch.sortOrder ?? 0,
    dateAdded: patch.dateAdded || today,
  } as any);
  const insertId = (result as any)?.[0]?.insertId ?? (result as any)?.insertId;
  if (insertId) {
    const [row] = await db.select().from(needsWorkItems).where(eq(needsWorkItems.id, Number(insertId))).limit(1);
    return row;
  }
  const rows = await db.select().from(needsWorkItems).orderBy(desc(needsWorkItems.id)).limit(1);
  return rows[0];
}
export async function updateNeedsWork(id: number, patch: Partial<typeof needsWorkItems.$inferInsert>) {
  const db = getDb();
  await db.update(needsWorkItems).set(patch).where(eq(needsWorkItems.id, id));
}
export async function completeNeedsWork(id: number, completedByUserId?: number) {
  const db = getDb();
  const today = new Date().toISOString().slice(0, 10);
  await db.update(needsWorkItems).set({ dateCompleted: today, completedByUserId } as any).where(eq(needsWorkItems.id, id));
  // Roll up: parent auto-completes when all of its children are complete.
  // Walk up the tree as far as the chain of all-complete parents goes.
  const all = await listNeedsWork();
  const byId = new Map(all.map((r) => [r.id, r] as const));
  const childrenOf = new Map<number, typeof all>();
  for (const r of all) {
    if (r.parentId) {
      const list = childrenOf.get(r.parentId) || [];
      list.push(r);
      childrenOf.set(r.parentId, list);
    }
  }
  let cursor = byId.get(id)?.parentId ?? null;
  while (cursor) {
    const kids = childrenOf.get(cursor) || [];
    if (kids.length === 0) break;
    // Treat the just-completed kid as completed even if local map is stale
    const allDone = kids.every((k) => k.dateCompleted || k.id === id);
    const parent = byId.get(cursor);
    if (!parent || parent.dateCompleted) break;
    if (!allDone) break;
    await db.update(needsWorkItems).set({ dateCompleted: today, completedByUserId } as any).where(eq(needsWorkItems.id, cursor));
    cursor = parent.parentId ?? null;
  }
}
export async function reopenNeedsWork(id: number) {
  const db = getDb();
  await db.update(needsWorkItems).set({ dateCompleted: null, completedByUserId: null } as any).where(eq(needsWorkItems.id, id));
}
export async function deleteNeedsWork(id: number) {
  const db = getDb();
  // cascade: delete descendants first (simple one-level loop; deep trees still work via recursion)
  const all = await listNeedsWork();
  const toDelete = new Set<number>([id]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const r of all) {
      if (r.parentId && toDelete.has(r.parentId) && !toDelete.has(r.id)) {
        toDelete.add(r.id); grew = true;
      }
    }
  }
  const ids = Array.from(toDelete.values());
  for (const targetId of ids) {
    await db.delete(needsWorkItems).where(eq(needsWorkItems.id, targetId));
  }
}

/* ============================== CURRICULUM ADJUSTMENTS ==================== */
export async function listAdjustments(status?: "proposed"|"accepted"|"rejected"|"applied") {
  const db = getDb();
  const rows = await db.select().from(curriculumAdjustments).orderBy(desc(curriculumAdjustments.proposedAt)).limit(200);
  if (status) return rows.filter((r) => r.status === status);
  return rows;
}
export async function createAdjustment(patch: { subjectSlug: string; weekStart: string; suggestion: string; reason?: string; affectsTopicId?: number }) {
  const db = getDb();
  await db.insert(curriculumAdjustments).values(patch as any);
}
export async function decideAdjustment(id: number, status: "accepted"|"rejected"|"applied", decidedByUserId?: number) {
  const db = getDb();
  await db.update(curriculumAdjustments).set({ status, decidedAt: new Date(), decidedByUserId } as any).where(eq(curriculumAdjustments.id, id));
}

/* ============================== PRINTABLES ================================ */
export async function listPrintableSources() {
  const db = getDb();
  return db.select().from(printableSources).where(eq(printableSources.isActive, true)).orderBy(printableSources.sortOrder, printableSources.id);
}
export async function listPrintableFavorites() {
  const db = getDb();
  return db.select().from(printableFavorites).orderBy(desc(printableFavorites.savedAt));
}
export async function addPrintableFavorite(patch: { sourceId: number; title: string; url: string; subjectSlug?: string; note?: string }) {
  const db = getDb();
  await db.insert(printableFavorites).values(patch as any);
}
export async function deletePrintableFavorite(id: number) {
  const db = getDb();
  await db.delete(printableFavorites).where(eq(printableFavorites.id, id));
}

/* ============================== ASSIGNMENT SUBMISSIONS LIST ============== */
export async function listAssignmentSubmissions(limit = 50) {
  const db = getDb();
  const rows = await db.select().from(assignmentSubmissions).orderBy(desc(assignmentSubmissions.submittedAt)).limit(limit);
  return enrichSubmissionsWithBlockTitles(rows as any[]);
}

/**
 * 2026-05-04 — Curriculum recents was showing every row as "(untitled)"
 * because most kid turn-ins don't pass a title; the title actually lives on
 * the linked schedule block. This helper looks up each submission's block
 * once and back-fills `title` (and `subjectName` when missing) so the UI
 * can render meaningful labels without changing every caller.
 */
async function enrichSubmissionsWithBlockTitles(rows: any[]) {
  if (!rows.length) return rows;
  const db = getDb();
  const blockIds = Array.from(new Set(rows.map((r) => r.blockId).filter((x) => Number.isFinite(x))));
  if (!blockIds.length) return rows;
  const blocks = await db.select({
    id: scheduleBlocks.id,
    title: scheduleBlocks.title,
    subjectId: scheduleBlocks.subjectId,
  }).from(scheduleBlocks).where(inArray(scheduleBlocks.id, blockIds as number[]));
  const byId = new Map<number, { id: number; title: string | null; subjectId: number | null }>();
  for (const b of blocks as any[]) byId.set(b.id, b);
  return rows.map((r) => {
    const blk = byId.get(r.blockId);
    if (!blk) return r;
    return {
      ...r,
      title: r.title || blk.title || r.subjectSlug || "Turn-in",
      blockTitle: blk.title ?? null,
    };
  });
}
export async function createAssignmentSubmission(patch: Partial<typeof assignmentSubmissions.$inferInsert>) {
  const db = getDb();
  const rows = await db.insert(assignmentSubmissions).values(patch as any);
  // mysql driver returns insertId on $metadata - need to fetch last row
  const latest = await db.select().from(assignmentSubmissions).orderBy(desc(assignmentSubmissions.id)).limit(1);
  return latest[0];
}
export async function updateAssignmentSubmission(id: number, patch: Partial<typeof assignmentSubmissions.$inferInsert>) {
  const db = getDb();
  await db.update(assignmentSubmissions).set(patch).where(eq(assignmentSubmissions.id, id));
}

/**
 * Search every turn-in by free text across title, contentText, subjectSlug,
 * adultNotes. Mom asked May 2026: the curriculum page recents-table is
 * deliberately tiny (5 rows), but the search box above it must hit the
 * full archive — not just the loaded page. Case-insensitive substring.
 */
export async function searchAssignmentSubmissions(q: string, limit = 25) {
  const db = getDb();
  const needle = q.trim().toLowerCase();
  if (!needle) return [];
  const rows = await db.select().from(assignmentSubmissions).orderBy(desc(assignmentSubmissions.submittedAt)).limit(500);
  const enriched = await enrichSubmissionsWithBlockTitles(rows as any[]);
  const matches = enriched.filter((r) => {
    const hay = [r.title, r.blockTitle, r.contentText, r.subjectSlug, r.adultNotes, r.autoFeedback]
      .map((v) => (v ? String(v).toLowerCase() : ""))
      .join(" \u0001 ");
    return hay.includes(needle);
  });
  return matches.slice(0, limit);
}

/**
 * List ungraded turn-ins (no autoScore yet). Used by the "Grade everything
 * I can" back-fill button so we don't repeatedly hit the LLM for already-
 * graded rows.
 */
export async function listUngradedSubmissions(limit = 100) {
  const db = getDb();
  const rows = await db.select().from(assignmentSubmissions).orderBy(desc(assignmentSubmissions.submittedAt)).limit(500);
  return (rows as any[]).filter((r) => r.autoScore == null && !r.readingOnly).slice(0, limit);
}


/* ========================================================================== */
/*  Phase 5: grade -> skillsMastery + per-subject rolling grade               */
/* ========================================================================== */

/**
 * When an assignment submission has been auto-graded, roll the percentage
 * into skillsMastery for that block's subject. We treat the block title as
 * the skill name if the block has one; otherwise fall back to subjectSlug.
 * If a mastery row already exists we exponentially smooth toward the new
 * score (alpha=0.4) so a single score doesn't swing mastery too hard.
 */
export async function applyGradeToMastery(opts: {
  subjectSlug: string;
  skillName: string;
  score: number; // 0-100
}) {
  const db = getDb();
  const rows = await db
    .select()
    .from(skillsMastery)
    .where(eq(skillsMastery.subjectSlug, opts.subjectSlug));
  const existing = (rows as any[]).find(
    (r) => (r.skillName || "").toLowerCase() === opts.skillName.toLowerCase(),
  );
  const alpha = 0.4;
  if (existing) {
    const newScore = Math.round(existing.currentScore * (1 - alpha) + opts.score * alpha);
    await db
      .update(skillsMastery)
      .set({ currentScore: newScore, lastPracticedAt: new Date(), needsHelp: newScore < 60 })
      .where(eq(skillsMastery.id, existing.id));
    return { id: existing.id, currentScore: newScore };
  }
  await db.insert(skillsMastery).values({
    subjectSlug: opts.subjectSlug,
    skillName: opts.skillName,
    currentScore: opts.score,
    lastPracticedAt: new Date(),
    needsHelp: opts.score < 60,
  } as any);
  return { id: 0, currentScore: opts.score };
}

/**
 * Returns per-subject rolling grade: weighted average of recent
 * auto-graded submissions (70%) + block completion grades (30%),
 * over the last 30 days. Also returns kid-friendly label and
 * adult-facing letter grade.
 */
export async function subjectRollingGrades() {
  const db = getDb();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const subs: any[] = await db
    .select()
    .from(assignmentSubmissions)
    .where(gte(assignmentSubmissions.submittedAt, thirtyDaysAgo));
  const autos: any[] = await db.select().from(assignmentSubmissionsAutoGrade);
  const autoById = new Map(autos.map((a) => [a.submissionId, a]));
  const grades: any[] = await db.select().from(blockGrades);

  const bySubject: Record<string, { scores: number[]; blockScores: number[] }> = {};
  for (const s of subs) {
    const slug = s.subjectSlug || "general";
    if (!bySubject[slug]) bySubject[slug] = { scores: [], blockScores: [] };
    const adult = typeof s.rubricScore === "number" ? s.rubricScore : null;
    const auto = autoById.get(s.id)?.autoScore ?? null;
    const score = adult ?? auto;
    if (score !== null) bySubject[slug].scores.push(score);
  }
  for (const g of grades) {
    const slug = g.subjectSlug || "general";
    if (!bySubject[slug]) bySubject[slug] = { scores: [], blockScores: [] };
    if (typeof g.score === "number") bySubject[slug].blockScores.push(g.score);
  }

  const out: Array<{ subjectSlug: string; average: number; letter: string; kidLabel: string; n: number }> = [];
  for (const [slug, v] of Object.entries(bySubject)) {
    const a = v.scores.length ? v.scores.reduce((x, y) => x + y, 0) / v.scores.length : null;
    const b = v.blockScores.length ? v.blockScores.reduce((x, y) => x + y, 0) / v.blockScores.length : null;
    let avg: number | null = null;
    if (a !== null && b !== null) avg = a * 0.7 + b * 0.3;
    else if (a !== null) avg = a;
    else if (b !== null) avg = b;
    if (avg === null) continue;
    const pct = Math.round(avg);
    const letter = pct >= 90 ? "A" : pct >= 80 ? "B" : pct >= 70 ? "C" : pct >= 60 ? "D" : "F";
    const kidLabel =
      pct >= 90 ? "Mastered" :
      pct >= 80 ? "Got it" :
      pct >= 70 ? "Getting there" :
      "Not yet";
    out.push({ subjectSlug: slug, average: pct, letter, kidLabel, n: v.scores.length + v.blockScores.length });
  }
  out.sort((x, y) => x.subjectSlug.localeCompare(y.subjectSlug));
  return out;
}


/**
 * Runs the "adaptive engine":
 *   - Looks at skillsMastery where currentScore < 60 (needs help)
 *   - Looks at recent subject rolling grades (F/D in last 30 days)
 *   - For each hot spot, creates:
 *       • a curriculumAdjustment row with status="proposed"
 *       • a needsWorkItems row if none exists for that (subject, skillName)
 * Safe to run repeatedly — dedupes on (subjectSlug, title) for needsWork and
 * on (subjectSlug, suggestion, weekStart) for adjustments.
 */
export async function rebuildAdaptiveSuggestions() {
  const db = getDb();
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1); // Monday
  const weekStartStr = weekStart.toISOString().slice(0, 10);

  const lowMastery: any[] = await db
    .select()
    .from(skillsMastery)
    .where(lte(skillsMastery.currentScore, 60));

  const rolling = await subjectRollingGrades();
  const lowSubjects = rolling.filter((r) => r.average < 70);

  const existingAdj: any[] = await db.select().from(curriculumAdjustments);
  const adjKey = new Set(
    existingAdj.map((a) => `${a.subjectSlug}|${a.suggestion}|${a.weekStart instanceof Date ? a.weekStart.toISOString().slice(0, 10) : String(a.weekStart)}`),
  );

  const existingNW: any[] = await db.select().from(needsWorkItems);
  const nwKey = new Set(existingNW.map((n) => `${n.subjectSlug || ""}|${(n.title || "").toLowerCase()}`));

  let adjCount = 0;
  let nwCount = 0;

  for (const s of lowMastery) {
    const sugg = `Reinforce ${s.skillName}`;
    const key = `${s.subjectSlug}|${sugg}|${weekStartStr}`;
    if (!adjKey.has(key)) {
      await db.insert(curriculumAdjustments).values({
        subjectSlug: s.subjectSlug,
        weekStart: weekStart,
        suggestion: sugg,
        reason: `Mastery currently at ${s.currentScore}%`,
      } as any);
      adjCount++;
    }
    const nwk = `${s.subjectSlug}|${s.skillName.toLowerCase()}`;
    if (!nwKey.has(nwk)) {
      await db.insert(needsWorkItems).values({
        subjectSlug: s.subjectSlug,
        title: s.skillName,
        note: `Auto-added: mastery at ${s.currentScore}%`,
        origin: "mastery",
        dateAdded: new Date().toISOString().slice(0, 10),
      } as any);
      nwCount++;
      nwKey.add(nwk);
    }
  }

  for (const r of lowSubjects) {
    const sugg = `Spend extra time on ${r.subjectSlug} (recent avg ${r.average}%)`;
    const key = `${r.subjectSlug}|${sugg}|${weekStartStr}`;
    if (!adjKey.has(key)) {
      await db.insert(curriculumAdjustments).values({
        subjectSlug: r.subjectSlug,
        weekStart: weekStart,
        suggestion: sugg,
        reason: `30-day rolling grade is ${r.letter} (${r.average}%)`,
      } as any);
      adjCount++;
    }
  }

  return { adjustmentsAdded: adjCount, needsWorkAdded: nwCount };
}


/* =================== ACADEMIC RECORDS =================== */
export type AcademicSource =
  "paste" | "manus_share" | "gmail" | "classroom" | "powerschool_ih" | "powerschool_madeira" | "ixl" | "drive" | "manual";
export type AcademicKind = "assignment" | "grade" | "mastery" | "note" | "attendance";

export async function listAcademicRecords(filter?: {
  source?: AcademicSource; subjectSlug?: string;
  schoolYear?: string; term?: string; grade?: string; teacher?: string;
  limit?: number;
}) {
  const db = getDb();
  const limit = filter?.limit ?? 200;
  let rows = await db.select().from(academicRecords).orderBy(desc(academicRecords.createdAt)).limit(limit);
  if (filter?.source) rows = rows.filter((r) => r.source === filter.source);
  if (filter?.subjectSlug) rows = rows.filter((r) => r.subjectSlug === filter.subjectSlug);
  if (filter?.schoolYear) rows = rows.filter((r: any) => r.schoolYear === filter.schoolYear);
  if (filter?.term) rows = rows.filter((r: any) => r.term === filter.term);
  if (filter?.grade) rows = rows.filter((r: any) => r.grade === filter.grade);
  if (filter?.teacher) rows = rows.filter((r: any) => r.teacher === filter.teacher);
  return rows;
}

export async function createAcademicRecord(input: {
  source: AcademicSource; kind: AcademicKind; subjectSlug?: string; title: string;
  summary?: string; scoreText?: string; scorePercent?: number;
  assignedAt?: Date; dueAt?: Date; completedAt?: Date;
  payload?: string; metadata?: Record<string, any>;
  // Phase: per-year academic timeline.
  grade?: string; schoolYear?: string; term?: string; teacher?: string; courseName?: string;
}) {
  const db = getDb();
  const result: any = await db.insert(academicRecords).values(input as any);
  const insertId = (result as any)?.[0]?.insertId ?? (result as any)?.insertId;
  if (insertId) {
    const [row] = await db.select().from(academicRecords).where(eq(academicRecords.id, Number(insertId))).limit(1);
    return row;
  }
  const rows = await db.select().from(academicRecords).orderBy(desc(academicRecords.id)).limit(1);
  return rows[0];
}

export async function deleteAcademicRecord(id: number) {
  const db = getDb();
  await db.delete(academicRecords).where(eq(academicRecords.id, id));
}

/**
 * Builds the dedupe key for an academic record. Two rows that share this key
 * are considered the same logical record (same year, course, term, and title).
 * Year+Course+Term+Title is a strong-enough fingerprint for grade imports.
 */
export function academicRecordKey(r: {
  schoolYear?: string | null; courseName?: string | null;
  term?: string | null; title: string; subjectSlug?: string | null;
}): string {
  return [
    (r.schoolYear || "").trim().toLowerCase(),
    (r.courseName || r.subjectSlug || "").trim().toLowerCase(),
    (r.term || "").trim().toLowerCase(),
    (r.title || "").trim().toLowerCase(),
  ].join("|");
}

/**
 * Bulk-insert academic records, skipping any whose dedupe key already exists.
 * Used by the CSV/PDF uploader so re-running an import is safe.
 */
export async function bulkUpsertAcademicRecords(
  rows: Array<Parameters<typeof createAcademicRecord>[0]>,
): Promise<{ inserted: number; skipped: number; insertedIds: number[] }> {
  if (rows.length === 0) return { inserted: 0, skipped: 0, insertedIds: [] };
  const db = getDb();
  // Pull existing rows in the candidate years (cheap filter), then build a key set.
  const years = Array.from(new Set(rows.map((r) => r.schoolYear).filter(Boolean) as string[]));
  const existing = years.length
    ? await db.select().from(academicRecords).where(inArray(academicRecords.schoolYear, years))
    : await db.select().from(academicRecords);
  const seen = new Set<string>(existing.map((r: any) => academicRecordKey(r)));
  let inserted = 0;
  let skipped = 0;
  const insertedIds: number[] = [];
  for (const r of rows) {
    const key = academicRecordKey(r);
    if (seen.has(key)) { skipped++; continue; }
    const row = await createAcademicRecord(r);
    if ((row as any)?.id) insertedIds.push((row as any).id);
    seen.add(key);
    inserted++;
  }
  return { inserted, skipped, insertedIds };
}

/**
 * Uses the LLM to pull an assignment/grade/mastery summary out of free-form
 * pasted content (a Classroom invite, a PowerSchool screenshot caption, a
 * Gmail forward, an IXL skill URL, a Drive link paragraph, etc).
 * Returns a draft AcademicRecord payload; caller decides to store it.
 */
export async function extractAcademicFromPaste(source: AcademicSource, raw: string) {
  const { invokeLLM } = await import("./_core/llm");
  const sys = `You extract a single homework/assignment/grade record from free-form text a parent pastes.
Return JSON matching the schema exactly. Score fields may be null. Subjects: math, ela, reading, writing, science, ss, art, music, pe, life_skills, other.`;
  const resp: any = await invokeLLM({
    messages: [
      { role: "system", content: sys },
      { role: "user", content: raw.slice(0, 8000) },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "academic_record",
        strict: true,
        schema: {
          type: "object",
          properties: {
            kind: { type: "string", enum: ["assignment", "grade", "mastery", "note", "attendance"] },
            title: { type: "string" },
            subjectSlug: { type: "string" },
            summary: { type: "string" },
            scoreText: { type: ["string", "null"] },
            scorePercent: { type: ["integer", "null"] },
            dueDateIso: { type: ["string", "null"] },
          },
          required: ["kind", "title", "subjectSlug", "summary", "scoreText", "scorePercent", "dueDateIso"],
          additionalProperties: false,
        },
      },
    },
  });
  const content = resp?.choices?.[0]?.message?.content ?? "{}";
  let parsed: any = {};
  try { parsed = typeof content === "string" ? JSON.parse(content) : content; } catch { parsed = {}; }
  const draft = {
    source,
    kind: parsed.kind || "note",
    title: parsed.title || raw.slice(0, 80),
    subjectSlug: parsed.subjectSlug,
    summary: parsed.summary,
    scoreText: parsed.scoreText ?? undefined,
    scorePercent: typeof parsed.scorePercent === "number" ? parsed.scorePercent : undefined,
    dueAt: parsed.dueDateIso ? new Date(parsed.dueDateIso) : undefined,
    payload: raw,
  };
  return draft;
}


export async function updateTimelineEvent(
  id: number,
  patch: Partial<{ title: string; description: string; date: string; eventType: any; mediaUrl: string }>
) {
  const set: any = {};
  if (patch.title !== undefined) set.title = patch.title;
  if (patch.description !== undefined) set.description = patch.description;
  if (patch.date !== undefined) set.date = new Date(patch.date);
  if (patch.eventType !== undefined) set.eventType = patch.eventType;
  if (patch.mediaUrl !== undefined) set.mediaUrl = patch.mediaUrl;
  if (Object.keys(set).length === 0) return { updated: false };
  await getDb().update(timelineEvents).set(set).where(eq(timelineEvents.id, id));
  return { updated: true };
}

export async function deleteTimelineEvent(id: number) {
  await getDb().delete(timelineEvents).where(eq(timelineEvents.id, id));
  return { deleted: true };
}


export async function updateAppLink(
  id: number,
  patch: Partial<{ name: string; url: string; emoji: string; category: any; description: string; accountInfo: string; sortOrder: number }>
) {
  const set: any = {};
  for (const k of ["name","url","emoji","category","description","accountInfo","sortOrder"] as const) {
    if (patch[k] !== undefined) (set as any)[k] = (patch as any)[k];
  }
  if (Object.keys(set).length === 0) return { updated: false };
  await getDb().update(appLinks).set(set).where(eq(appLinks.id, id));
  return { updated: true };
}

export async function deleteAppLink(id: number) {
  await getDb().delete(appLinks).where(eq(appLinks.id, id));
  return { deleted: true };
}

export async function updateBook(
  id: number,
  patch: Partial<{ title: string; author: string; type: any; subjectSlug: string; currentPage: number; totalPages: number; notes: string }>
) {
  const set: any = {};
  for (const k of ["title","author","type","subjectSlug","currentPage","totalPages","notes"] as const) {
    if (patch[k] !== undefined) (set as any)[k] = (patch as any)[k];
  }
  if (Object.keys(set).length === 0) return { updated: false };
  await getDb().update(books).set(set).where(eq(books.id, id));
  return { updated: true };
}

export async function deleteBook(id: number) {
  await getDb().delete(books).where(eq(books.id, id));
  return { deleted: true };
}


/* ============================================================
 * Recipients + Appointments — update / delete (Round 4a-vi)
 * ============================================================ */
export async function updateRecipient(id: number, patch: Partial<typeof notificationRecipients.$inferInsert>) {
  await getDb().update(notificationRecipients).set(patch).where(eq(notificationRecipients.id, id));
}
export async function deleteRecipient(id: number) {
  // Soft-delete to preserve history; switch active flag off.
  await getDb().update(notificationRecipients).set({ active: false } as any).where(eq(notificationRecipients.id, id));
}
export async function updateAppointment(id: number, patch: Partial<typeof appointments.$inferInsert>) {
  await getDb().update(appointments).set(patch).where(eq(appointments.id, id));
}
export async function deleteAppointment(id: number) {
  await getDb().update(appointments).set({ active: false } as any).where(eq(appointments.id, id));
}


/* ============================== AUDIT LOG ================================= */
export type AuditEntityType = "block" | "book" | "app" | "timeline" | "adventure" | "needsWork" | "recipient" | "appointment" | "note" | "submission" | "answerKey" | "academic" | "blockGrade" | "plan";
export type AuditAction = "create" | "update" | "delete" | "complete" | "reopen" | "grade" | "submit" | "clear";

export async function logAudit(input: {
  actorOpenId?: string | null;
  actorName?: string | null;
  entityType: AuditEntityType;
  entityId?: number | null;
  action: AuditAction;
  summary?: string;
  metadata?: Record<string, any>;
}) {
  try {
    await getDb().insert(auditLog).values({
      actorOpenId: input.actorOpenId ?? null,
      actorName: input.actorName ?? null,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      action: input.action,
      summary: input.summary ?? null,
      metadata: input.metadata ?? null,
    } as any);
  } catch (e) {
    // never let audit failures break business mutations
    console.warn("[audit] write failed:", (e as any)?.message);
  }
}

export async function listAudit(limit = 100) {
  return getDb().select().from(auditLog).orderBy(desc(auditLog.createdAt)).limit(limit);
}


// ===== IEP Goals & Accommodations =====
export async function listIepGoals() {
  const db = getDb();
  return await db.select().from(iepGoals).orderBy(desc(iepGoals.createdAt));
}

export async function listIepAccommodations() {
  const db = getDb();
  return await db.select().from(iepAccommodations).where(eq(iepAccommodations.active, true)).orderBy(desc(iepAccommodations.createdAt));
}

/**
 * List historical assessment screenings (Acadience, MAZE, MAP, decoding, writing).
 * Source: Reagan handoff bundle 04_assessment_history.json (Apr 2026).
 */
export async function listAssessmentScreenings() {
  const db = getDb();
  return await db.select().from(assessmentScreenings).orderBy(assessmentScreenings.testFamily, assessmentScreenings.metric, assessmentScreenings.id);
}


// ===== Sticker & Coin Economy =====
const STICKER_ART = [
  "star-gold", "rainbow-burst", "parakeet-wink", "heart-sparkle", "cupcake-pink",
  "pencil-hero", "lightbulb", "trophy-mini", "book-magic", "apple-smile",
  "crown-tiny", "balloon-bunch", "butterfly", "ladybug", "taco", "sun-happy",
  "moon-wink", "cloud-rainbow", "cat-sticker", "dog-sticker",
];

export async function awardSticker(params: {
  userId?: number | null;
  reason: "block_done" | "streak_bonus" | "gold_star_day" | "submission_approved" | "placement_complete" | "adult_bonus";
  blockId?: number | null;
  submissionId?: number | null;
  coins?: number;
  shortLyric?: string | null;
  addedByUserId?: number | null;
  art?: string;
  palette?: string;
}) {
  const db = getDb();
  const art = params.art || STICKER_ART[Math.floor(Math.random() * STICKER_ART.length)];
  const palette = params.palette || ["coral", "peach", "butter", "mint", "sky", "lavender", "pink"][Math.floor(Math.random() * 7)];
  const baseCoins = params.coins ?? 1;
  // Push 83 (2026-05-13) — Summer streak boost. Pure helpers only; we
  // fail soft when prefs/streak math hits any error so the core award
  // path stays robust.
  let streakBoostMultiplier = 1;
  let streakDays = 0;
  let summerActive = false;
  try {
    const [autoFlip, start, end, override, vacJson] = await Promise.all([
      getAppSetting("summer.autoFlipEnabled"),
      getAppSetting("summer.start"),
      getAppSetting("summer.end"),
      getAppSetting("summer.override"),
      getAppSetting("summer.vacationRanges"),
    ]);
    const { summerSettingsFromKv, effectiveSummerActive, streakBoostMultiplier: mult } =
      await import("./summerMode");
    const settings = summerSettingsFromKv({
      "summer.autoFlipEnabled": autoFlip,
      "summer.start": start,
      "summer.end": end,
      "summer.override": override,
      "summer.vacationRanges": vacJson,
    });
    const today = new Date().toISOString().slice(0, 10);
    summerActive = effectiveSummerActive(today, settings).active;
    if (summerActive) {
      // Pull recent earn days from coinLedger (kind="earn_sticker") and
      // pipe through pure streak helper.
      const since = new Date();
      since.setDate(since.getDate() - 30);
      const rows: any[] = await db.select().from(coinLedger);
      const dayKey = (d: Date) => d.toISOString().slice(0, 10);
      const dayList = rows
        .filter((r: any) => r.kind === "earn_sticker" && r.createdAt)
        .map((r: any) => dayKey(new Date(r.createdAt)));
      // We're about to insert today's earn, so include today.
      dayList.push(today);
      const { dailyBlockCompletionStreak } = await import("./_lib/completionStreak");
      streakDays = dailyBlockCompletionStreak(dayList, today);
      streakBoostMultiplier = mult(streakDays, summerActive);
    }
  } catch { /* boost is best-effort */ }
  const coins = Math.round(baseCoins * streakBoostMultiplier);
  const [res]: any = await db.insert(stickers).values({
    userId: params.userId ?? null,
    reason: params.reason,
    blockId: params.blockId ?? null,
    submissionId: params.submissionId ?? null,
    art,
    palette,
    coinsAwarded: coins,
    shortLyric: params.shortLyric ?? null,
    addedByUserId: params.addedByUserId ?? null,
  } as any);
  const stickerId = (res as any)?.insertId as number | undefined;
  // Mirror into coin ledger (+coins)
  if (coins > 0) {
    await db.insert(coinLedger).values({
      userId: params.userId ?? null,
      delta: coins,
      kind: "earn_sticker",
      reasonNote: params.reason,
      stickerId: stickerId ?? null,
    } as any);
  }
  return {
    stickerId,
    art,
    palette,
    coins,
    baseCoins,
    streakBoostMultiplier,
    streakDays,
    summerActive,
  };
}

export async function listStickers(userId?: number | null) {
  const db = getDb();
  const q = db.select().from(stickers).orderBy(desc(stickers.awardedAt));
  const rows = await q;
  if (userId == null) return rows;
  return rows.filter((r: any) => r.userId === userId);
}

export async function coinBalance(userId?: number | null) {
  const db = getDb();
  const rows: any = await db.select().from(coinLedger);
  let earned = 0, spent = 0;
  for (const r of rows) {
    if (userId != null && r.userId !== userId) continue;
    if (r.delta > 0) earned += r.delta;
    else spent += Math.abs(r.delta);
  }
  return { balance: earned - spent, earned, spent };
}

export async function recentCoinLedger(userId?: number | null, limit = 30) {
  const db = getDb();
  const rows: any = await db.select().from(coinLedger).orderBy(desc(coinLedger.createdAt)).limit(limit);
  return userId == null ? rows : rows.filter((r: any) => r.userId === userId);
}

export async function listPrizes(activeOnly = true) {
  const db = getDb();
  const rows: any = await db.select().from(prizes).orderBy(desc(prizes.createdAt));
  return activeOnly ? rows.filter((p: any) => p.active) : rows;
}

export async function seedDefaultPrizesIfEmpty() {
  const db = getDb();
  const existing: any = await db.select().from(prizes).limit(1);
  if (existing.length > 0) return { seeded: false };
  const defaults = [
    { slug: "roblox-5",      title: "$5 Roblox card",          emoji: "🎮", coinCost: 50,  category: "digital" as const, description: "Save up for digital fun!" },
    { slug: "ice-cream",     title: "Ice cream outing",        emoji: "🍦", coinCost: 30,  category: "treat" as const,   description: "Mom-approved sweet treat." },
    { slug: "amazon-10",     title: "$10 Amazon choice",       emoji: "📦", coinCost: 100, category: "cash" as const,    description: "Pick anything under $10." },
    { slug: "movie-night",   title: "Family movie night",      emoji: "🎬", coinCost: 40,  category: "experience" as const, description: "You pick the movie!" },
    { slug: "extra-screen",  title: "+30 min screen time",     emoji: "📱", coinCost: 15,  category: "screen_time" as const, description: "Bonus iPad time." },
    { slug: "bird-toy",      title: "New toy for the birds",   emoji: "🦜", coinCost: 60,  category: "toy" as const,     description: "For Kiwi and the flock." },
    { slug: "starbucks",     title: "Starbucks cake pop",      emoji: "☕", coinCost: 25,  category: "treat" as const,   description: "Pink frosting, sprinkles." },
    { slug: "stuffie",       title: "New stuffed animal",      emoji: "🧸", coinCost: 80,  category: "toy" as const,     description: "Add one to your collection." },
  ];
  for (const p of defaults) {
    await db.insert(prizes).values({ ...p, active: true } as any);
  }
  return { seeded: true, count: defaults.length };
}

export async function requestPrize(userId: number | null, prizeId: number) {
  const db = getDb();
  const p: any = (await db.select().from(prizes).where(eq(prizes.id, prizeId)).limit(1))[0];
  if (!p) throw new Error("Prize not found");
  const bal = await coinBalance(userId);
  if (bal.balance < p.coinCost) throw new Error("Not enough coins yet");
  const [res]: any = await db.insert(prizeRedemptions).values({
    userId: userId ?? null,
    prizeId,
    coinCost: p.coinCost,
    status: "pending",
  } as any);
  const redemptionId = (res as any)?.insertId as number | undefined;
  // Deduct coins
  await db.insert(coinLedger).values({
    userId: userId ?? null,
    delta: -p.coinCost,
    kind: "spend_prize",
    reasonNote: `Requested: ${p.title}`,
    prizeRedemptionId: redemptionId ?? null,
  } as any);
  return { redemptionId, status: "pending", title: p.title };
}

export async function listMyRedemptions(userId?: number | null) {
  const db = getDb();
  const rows: any = await db.select().from(prizeRedemptions).orderBy(desc(prizeRedemptions.requestedAt));
  return userId == null ? rows : rows.filter((r: any) => r.userId === userId);
}

// ===== Good Work Notes =====
export async function addGoodWorkNote(params: {
  userId?: number | null;
  authorUserId?: number | null;
  authorName?: string | null;
  lyric: string;
  stickerId?: number | null;
  submissionId?: number | null;
  blockId?: number | null;
}) {
  const db = getDb();
  const [res]: any = await db.insert(goodWorkNotes).values({
    userId: params.userId ?? null,
    authorUserId: params.authorUserId ?? null,
    authorName: params.authorName ?? null,
    lyric: params.lyric,
    attachedToStickerId: params.stickerId ?? null,
    attachedToSubmissionId: params.submissionId ?? null,
    attachedToBlockId: params.blockId ?? null,
  } as any);
  return { id: (res as any)?.insertId };
}

export async function listGoodWorkNotes(userId?: number | null, limit = 50) {
  const db = getDb();
  const rows: any = await db.select().from(goodWorkNotes).orderBy(desc(goodWorkNotes.createdAt)).limit(limit);
  return userId == null ? rows : rows.filter((r: any) => r.userId === userId);
}


/* ==================== WHITEBOARD NOTES & TAGS ==================== */
import { whiteboardNotes, tags, tagLinks } from "../drizzle/schema";

// ---- Whiteboard ----

const DEFAULT_NOTE_COLORS = ["butter", "coral", "mint", "sky", "lavender", "peach", "pink"] as const;
type NoteColor = typeof DEFAULT_NOTE_COLORS[number];

export async function listWhiteboardNotes(opts: { includeArchived?: boolean; forDate?: string } = {}) {
  const _db = getDb();
  const where: any[] = [];
  if (!opts.includeArchived) where.push(eq(whiteboardNotes.archived, false));
  // Select explicitly — drizzle's select() returns undefined for some DATE columns
  const rows: any[] = await _db
    .select({
      id: whiteboardNotes.id,
      authorUserId: whiteboardNotes.authorUserId,
      authorName: whiteboardNotes.authorName,
      authorAvatar: whiteboardNotes.authorAvatar,
      title: whiteboardNotes.title,
      body: whiteboardNotes.body,
      color: whiteboardNotes.color,
      emoji: whiteboardNotes.emoji,
      pinned: whiteboardNotes.pinned,
      showOnDate: whiteboardNotes.showOnDate,
      heartCount: whiteboardNotes.heartCount,
      reaganHearted: whiteboardNotes.reaganHearted,
      archived: whiteboardNotes.archived,
      createdAt: whiteboardNotes.createdAt,
      updatedAt: whiteboardNotes.updatedAt,
    })
    .from(whiteboardNotes)
    .where(where.length ? and(...where) : undefined)
    .orderBy(desc(whiteboardNotes.pinned), desc(whiteboardNotes.createdAt))
    .limit(200);
  // filter by showOnDate client-side — if set, only show on that day
  const today = opts.forDate || new Date().toISOString().slice(0, 10);
  return rows.filter((r: any) => {
    if (r.showOnDate == null) return true;
    const d = r.showOnDate instanceof Date
      ? r.showOnDate.toISOString().slice(0, 10)
      : String(r.showOnDate).slice(0, 10);
    return d === today;
  });
}

export async function postWhiteboardNote(input: {
  authorUserId: number;
  authorName: string;
  authorAvatar?: string | null;
  title?: string | null;
  body: string;
  color?: NoteColor;
  emoji?: string | null;
  pinned?: boolean;
  showOnDate?: string | null;
}) {
  const _db = getDb();
  const res: any = await _db.insert(whiteboardNotes).values({
    authorUserId: input.authorUserId,
    authorName: input.authorName,
    authorAvatar: input.authorAvatar ?? null,
    title: input.title ?? null,
    body: input.body,
    color: (input.color ?? "butter") as any,
    emoji: input.emoji ?? null,
    pinned: !!input.pinned,
    showOnDate: input.showOnDate ?? null,
  } as any);
  const id = (res?.[0]?.insertId ?? res?.insertId ?? 0) as number;
  return { id };
}

export async function updateWhiteboardNote(id: number, patch: Partial<{
  title: string | null; body: string; color: NoteColor; emoji: string | null;
  pinned: boolean; archived: boolean; showOnDate: string | null;
}>) {
  const _db = getDb();
  await _db.update(whiteboardNotes).set(patch as any).where(eq(whiteboardNotes.id, id));
  return { id };
}

export async function reaganHeartNote(id: number) {
  const _db = getDb();
  const [cur]: any = await _db.select().from(whiteboardNotes).where(eq(whiteboardNotes.id, id)).limit(1);
  if (!cur) return { id, reaganHearted: false, heartCount: 0 };
  const newVal = !cur.reaganHearted;
  const newCount = Math.max(0, (cur.heartCount || 0) + (newVal ? 1 : -1));
  await _db
    .update(whiteboardNotes)
    .set({ reaganHearted: newVal, heartCount: newCount })
    .where(eq(whiteboardNotes.id, id));
  return { id, reaganHearted: newVal, heartCount: newCount };
}

// ---- Tags ----

export async function listTags(category?: string) {
  const _db = getDb();
  const rows = category
    ? await _db.select().from(tags).where(eq(tags.category, category as any)).orderBy(tags.sortOrder)
    : await _db.select().from(tags).orderBy(tags.sortOrder);
  return rows;
}

export async function upsertTag(input: {
  slug: string; label: string; emoji?: string | null;
  category?: string; color?: string; isPreset?: boolean; sortOrder?: number;
}) {
  const _db = getDb();
  const [exists]: any = await _db.select().from(tags).where(eq(tags.slug, input.slug)).limit(1);
  if (exists) {
    await _db.update(tags).set({
      label: input.label, emoji: input.emoji ?? null,
      category: (input.category ?? "custom") as any,
      color: (input.color ?? "butter") as any,
      isPreset: !!input.isPreset,
      sortOrder: input.sortOrder ?? 100,
    } as any).where(eq(tags.id, exists.id));
    return { id: exists.id as number };
  }
  const res: any = await _db.insert(tags).values({
    slug: input.slug, label: input.label, emoji: input.emoji ?? null,
    category: (input.category ?? "custom") as any,
    color: (input.color ?? "butter") as any,
    isPreset: !!input.isPreset,
    sortOrder: input.sortOrder ?? 100,
  } as any);
  return { id: (res?.[0]?.insertId ?? res?.insertId ?? 0) as number };
}

export async function seedDefaultTagsIfEmpty() {
  const existing = await listTags();
  if (existing.length > 0) return { seeded: false };
  const presets = [
    // Mood
    { slug: "good-day",    label: "Good day",    emoji: "🌈", category: "mood",   color: "mint",     sortOrder: 10 },
    { slug: "hard-day",    label: "Hard day",    emoji: "💛", category: "mood",   color: "peach",    sortOrder: 11 },
    { slug: "proud",       label: "Proud",       emoji: "⭐", category: "mood",   color: "butter",   sortOrder: 12 },
    { slug: "overwhelmed", label: "Overwhelmed", emoji: "🌊", category: "mood",   color: "sky",      sortOrder: 13 },
    { slug: "frustrated",  label: "Frustrated",  emoji: "🌶️", category: "mood",   color: "coral",    sortOrder: 14 },
    { slug: "quiet",       label: "Quiet",       emoji: "🌙", category: "mood",   color: "lavender", sortOrder: 15 },
    // Energy
    { slug: "wiggly",      label: "Wiggly",      emoji: "⚡", category: "energy", color: "coral",    sortOrder: 20 },
    { slug: "tired",       label: "Tired",       emoji: "🌧️", category: "energy", color: "sky",      sortOrder: 21 },
    { slug: "focused",     label: "Focused",     emoji: "🎯", category: "energy", color: "mint",     sortOrder: 22 },
    // Body
    { slug: "hungry",      label: "Hungry",      emoji: "🍎", category: "body",   color: "coral",    sortOrder: 30 },
    { slug: "thirsty",     label: "Thirsty",     emoji: "💧", category: "body",   color: "sky",      sortOrder: 31 },
    { slug: "headache",    label: "Headache",    emoji: "🤕", category: "body",   color: "lavender", sortOrder: 32 },
    { slug: "tummy",       label: "Tummy ache",  emoji: "🫖", category: "body",   color: "peach",    sortOrder: 33 },
    // Family / social
    { slug: "missed-mom",  label: "Missed Mom",  emoji: "💖", category: "family", color: "pink",     sortOrder: 40 },
    { slug: "with-grandma",label: "With Grandma",emoji: "🧡", category: "family", color: "butter",   sortOrder: 41 },
    { slug: "cousins-day", label: "Cousins day", emoji: "🎈", category: "family", color: "mint",     sortOrder: 42 },
    // Subjects
    { slug: "loved-birds", label: "Loved birds today", emoji: "🦜", category: "subject", color: "mint",   sortOrder: 50 },
    { slug: "creek-time",  label: "Creek time",        emoji: "🌿", category: "subject", color: "sky",    sortOrder: 51 },
    { slug: "art-flow",    label: "Art flow",          emoji: "🎨", category: "subject", color: "lavender",sortOrder: 52 },
  ];
  for (const p of presets) {
    await upsertTag({ ...p, isPreset: true });
  }
  return { seeded: true, count: presets.length };
}

export async function attachTag(input: { tagId: number; entityType: string; entityId: number }) {
  const _db = getDb();
  const res: any = await _db.insert(tagLinks).values({
    tagId: input.tagId,
    entityType: input.entityType as any,
    entityId: input.entityId,
  } as any);
  return { id: (res?.[0]?.insertId ?? res?.insertId ?? 0) as number };
}

export async function detachTag(linkId: number) {
  const _db = getDb();
  await _db.delete(tagLinks).where(eq(tagLinks.id, linkId));
  return { ok: true };
}

export async function listTagsForEntity(entityType: string, entityId: number) {
  const _db = getDb();
  const rows: any = await _db
    .select({
      linkId: tagLinks.id,
      tagId: tags.id,
      slug: tags.slug,
      label: tags.label,
      emoji: tags.emoji,
      color: tags.color,
      category: tags.category,
    })
    .from(tagLinks)
    .innerJoin(tags, eq(tagLinks.tagId, tags.id))
    .where(and(eq(tagLinks.entityType, entityType as any), eq(tagLinks.entityId, entityId)));
  return rows;
}


/* ==================== REVIEW LIBRARY / TV BOX ==================== */
import { reviewResources } from "../drizzle/schema";

export async function listReviewResources(opts: { approvedOnly?: boolean; kind?: string; subjectSlug?: string } = {}) {
  const _db = getDb();
  const conds: any[] = [];
  if (opts.approvedOnly !== false) conds.push(eq(reviewResources.approved, true));
  if (opts.kind) conds.push(eq(reviewResources.kind, opts.kind as any));
  if (opts.subjectSlug) conds.push(eq(reviewResources.subjectSlug, opts.subjectSlug));
  const rows = await _db
    .select()
    .from(reviewResources)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(reviewResources.createdAt))
    .limit(200);
  return rows;
}

export async function addReviewResource(input: {
  topic: string; title: string; kind: string;
  subjectSlug?: string | null; gradeBand?: string | null;
  url?: string | null; youtubeId?: string | null;
  description?: string | null; approved?: boolean;
  addedByUserId?: number | null;
}) {
  const _db = getDb();
  const res: any = await _db.insert(reviewResources).values({
    topic: input.topic,
    title: input.title,
    kind: input.kind as any,
    subjectSlug: input.subjectSlug ?? null,
    gradeBand: input.gradeBand ?? null,
    url: input.url ?? null,
    youtubeId: input.youtubeId ?? null,
    description: input.description ?? null,
    approved: input.approved ?? true,
    addedByUserId: input.addedByUserId ?? null,
  } as any);
  return { id: (res?.[0]?.insertId ?? res?.insertId ?? 0) as number };
}

export async function setReviewResourceApproval(id: number, approved: boolean) {
  const _db = getDb();
  await _db.update(reviewResources).set({ approved }).where(eq(reviewResources.id, id));
  return { id, approved };
}

export async function deleteReviewResource(id: number) {
  const _db = getDb();
  await _db.delete(reviewResources).where(eq(reviewResources.id, id));
  return { ok: true };
}

export async function seedStarterTVIfEmpty() {
  const _db = getDb();
  const existing = await _db.select().from(reviewResources).limit(1);
  if (existing.length > 0) return { seeded: false };
  const starters = [
    // Brain-break dances / movement (adult-vetted favorites for kids)
    { topic: "movement", title: "Cosmic Kids Yoga — Squish the Fish", kind: "youtube", youtubeId: "YIT5Zvp43Gc", subjectSlug: "brain-break", description: "3-min gentle movement", approved: true },
    { topic: "movement", title: "GoNoodle — Banana Banana Meatball", kind: "youtube", youtubeId: "A87nC7qQoUI", subjectSlug: "brain-break", description: "Silly dance break", approved: true },
    { topic: "movement", title: "Jack Hartmann — Workout & Count", kind: "youtube", youtubeId: "5_1SPJQ_View", subjectSlug: "brain-break", description: "Count + wiggle", approved: true },
    // Birds
    { topic: "birds", title: "Parakeet Care 101", kind: "youtube", youtubeId: "N0vi4j1s5LE", subjectSlug: "science", description: "Bird care basics", approved: true },
    { topic: "birds", title: "How birds fly", kind: "youtube", youtubeId: "_Mj78nmgy_8", subjectSlug: "science", description: "Flight physics for kids", approved: true },
    // Nature
    { topic: "nature", title: "Bluey — Creek episode", kind: "youtube", youtubeId: "yhCrLBS31iI", subjectSlug: "social-studies", description: "Creek / nature connection", approved: true },
    // Math
    { topic: "math", title: "Multiplication rap (times 3)", kind: "youtube", youtubeId: "dmWFyQdRcXo", subjectSlug: "math", description: "Times tables rap", approved: true },
    // Reading
    { topic: "reading", title: "Storyline Online — Rainbow Fish", kind: "youtube", youtubeId: "u8TgZEbBaO4", subjectSlug: "reading", description: "Celebrity storytime", approved: true },
  ];
  for (const s of starters) {
    await addReviewResource(s as any);
  }
  return { seeded: true, count: starters.length };
}


/* ==================== REAGAN'S BOOKSHELF SEED ==================== */
export async function seedReaganBooksIfEmpty() {
  const _db = getDb();
  const existing = await _db.select().from(books).limit(1);
  if (existing.length > 0) return { seeded: false };
  const starters = [
    // Spectrum series
    { title: "Spectrum Math Grade 4", author: "Carson Dellosa", type: "workbook" as const, subjectSlug: "math", currentPage: 1, totalPages: 176, notes: "Daily 2 pages, alternating topics." },
    { title: "Spectrum Reading Grade 4", author: "Carson Dellosa", type: "workbook" as const, subjectSlug: "reading", currentPage: 1, totalPages: 176, notes: "Follow fiction → nonfiction rotation." },
    { title: "Spectrum Language Arts Grade 4", author: "Carson Dellosa", type: "workbook" as const, subjectSlug: "writing", currentPage: 1, totalPages: 176 },
    { title: "Spectrum Science Grade 4", author: "Carson Dellosa", type: "workbook" as const, subjectSlug: "science", currentPage: 1, totalPages: 176 },
    // 180 Days series
    { title: "180 Days of Math Grade 4", author: "Shell Education", type: "workbook" as const, subjectSlug: "math", currentPage: 1, totalPages: 208, notes: "1 page/day Mon–Fri." },
    { title: "180 Days of Reading Grade 4", author: "Shell Education", type: "workbook" as const, subjectSlug: "reading", currentPage: 1, totalPages: 208 },
    { title: "180 Days of Writing Grade 4", author: "Shell Education", type: "workbook" as const, subjectSlug: "writing", currentPage: 1, totalPages: 208 },
    // Novels / read-alouds
    { title: "Tuck Everlasting", author: "Natalie Babbitt", type: "novel" as const, subjectSlug: "reading", currentPage: 1, totalPages: 139, notes: "Read-aloud with Mom, ~2 chapters/day." },
    { title: "Michael's World (placeholder)", author: "Scribbles by Marcy", type: "novel" as const, subjectSlug: "reading", currentPage: 1, totalPages: null as any, notes: "Character journal — book in progress." },
    // Reference
    { title: "Student Dictionary", author: "Merriam-Webster", type: "reference" as const, subjectSlug: null as any, currentPage: 1, totalPages: null as any },
  ];
  for (const s of starters) {
    await _db.insert(books).values(s as any);
  }
  return { seeded: true, count: starters.length };
}


/* ========================================================================== */
/*  SKILL LADDER (Catch-Up Engine) + PROUD MOMENTS (Confidence Engine)        */
/*  Imported lazily here to avoid editing the long schema-import block above. */
/* ========================================================================== */
import { skillLadder, skillProgress } from "../drizzle/schema";

export async function listSkillLadder(opts: { subjectSlug?: string; activeOnly?: boolean } = {}) {
  const db = getDb();
  const conds: any[] = [];
  if (opts.subjectSlug) conds.push(eq(skillLadder.subjectSlug, opts.subjectSlug));
  if (opts.activeOnly !== false) conds.push(eq(skillLadder.active, true));
  const where = conds.length === 1 ? conds[0] : conds.length ? and(...conds) : undefined;
  const rows = await db.select().from(skillLadder).where(where as any).orderBy(skillLadder.subjectSlug, skillLadder.ladderOrder);
  return rows;
}

export async function listSkillProgress() {
  const db = getDb();
  return db.select().from(skillProgress);
}

/** Joined view: skill + Reagan's progress on it */
export async function listSkillsWithProgress(subjectSlug?: string) {
  const ladder = await listSkillLadder({ subjectSlug, activeOnly: true });
  const progress = await listSkillProgress();
  const byLadderId = new Map(progress.map((p: any) => [p.skillLadderId, p]));
  return ladder.map((s: any) => ({
    ...s,
    progress: byLadderId.get(s.id) || { level: 0, confidence: 0, evidenceCount: 0, lastModeUsed: "practice", lastPracticedAt: null },
  }));
}

/** The next-up skill: lowest-level skill in the requested subject (or any) */
export async function nextSkillForToday(subjectSlug?: string) {
  const all: any[] = await listSkillsWithProgress(subjectSlug);
  const ih = await getIhTopicsThisWeek();
  const ihTag = ih.ihWeekTag;
  const notMastered = all.filter((s: any) => (s.progress?.level ?? 0) < 4);
  // 1) If we have an active IH week tag, prefer skills tagged for that week
  if (ihTag) {
    const ihMatches = notMastered.filter((s: any) => s.ihWeekTag === ihTag);
    if (ihMatches.length) return { ...ihMatches[0], _matchedIhWeek: ihTag };
  }
  // 2) Otherwise return the first not-mastered in ladder order
  return notMastered[0] || all[0] || null;
}

/** Record practice on a skill. Bumps level slowly so Reagan stays at her edge. */
export async function recordSkillPractice(opts: {
  skillLadderId: number;
  mode?: "story" | "visual" | "handsOn" | "watch" | "practice";
  selfRating?: 1 | 2 | 3 | 4 | 5; // 1=hard, 5=easy
  parentNote?: string;
}) {
  const db = getDb();
  const [existing] = await db.select().from(skillProgress).where(eq(skillProgress.skillLadderId, opts.skillLadderId));
  const prev = existing || { level: 0, confidence: 0, evidenceCount: 0 };
  // Mastery curve: tuned so 3 strong "Got it" practice rounds level her up,
  // 3 "Getting it" rounds level her up too (just slower). Hard rounds barely
  // move confidence so we never punish struggle.
  //   selfRating 1 (Hard)        -> +5
  //   selfRating 2 (Tried it)    -> +12
  //   selfRating 3 (Getting it)  -> +20
  //   selfRating 4               -> +25
  //   selfRating 5 (Got it!)     -> +30
  const boostMap: Record<number, number> = { 1: 5, 2: 12, 3: 20, 4: 25, 5: 30 };
  const selfBoost = opts.selfRating ? (boostMap[opts.selfRating] ?? 12) : 12;
  let newConf = Math.min(100, (prev.confidence ?? 0) + selfBoost);
  let newLevel = prev.level ?? 0;
  let newEvidence = (prev.evidenceCount ?? 0) + 1;
  // Adaptation v2: if softerNext is set, do NOT level up this round
  let blockLevelUp = false;
  try {
    const [hint] = await db.select().from(adaptiveHints).where(eq(adaptiveHints.skillLadderId, opts.skillLadderId));
    if (hint?.softerNext) blockLevelUp = true;
  } catch { /* best-effort */ }
  if (!blockLevelUp && newConf >= 75 && newEvidence >= 3 && newLevel < 5) {
    newLevel += 1;
    newConf = 50; // reset confidence at new level
    newEvidence = 0;
  }
  if (existing) {
    await db.update(skillProgress).set({
      level: newLevel,
      confidence: newConf,
      evidenceCount: newEvidence,
      lastModeUsed: (opts.mode || "practice") as any,
      lastPracticedAt: new Date(),
      parentNote: opts.parentNote ?? existing.parentNote,
    }).where(eq(skillProgress.id, existing.id));
  } else {
    await db.insert(skillProgress).values({
      skillLadderId: opts.skillLadderId,
      level: newLevel,
      confidence: newConf,
      evidenceCount: newEvidence,
      lastModeUsed: (opts.mode || "practice") as any,
      lastPracticedAt: new Date(),
      parentNote: opts.parentNote ?? null,
    } as any);
  }
  // Auto-celebrate level-ups via proudMoments
  if (newLevel > (prev.level ?? 0)) {
    const [skill] = await db.select().from(skillLadder).where(eq(skillLadder.id, opts.skillLadderId));
    await db.insert(proudMoments).values({
      source: "auto",
      category: "growth",
      emoji: "📈",
      title: `Leveled up: ${skill?.title || "a skill"}!`,
      body: `Reagan moved up to level ${newLevel} on this skill — that used to be hard.`,
      skillLadderId: opts.skillLadderId,
    } as any);
  }
  // Log mood signal for frustration detection
  try {
    const [skillRow] = await db.select().from(skillLadder).where(eq(skillLadder.id, opts.skillLadderId));
    const felt = opts.selfRating === 1 ? "hard" : opts.selfRating === 5 ? "easy" : "ok";
    await db.insert(moodSignals).values({
      source: "skillPractice",
      subjectSlug: skillRow?.subjectSlug ?? null,
      skillLadderId: opts.skillLadderId,
      selfRating: opts.selfRating ?? null,
      feltIt: felt as any,
    } as any);
  } catch { /* mood logging is best-effort */ }
  return { newLevel, newConf, newEvidence, leveledUp: newLevel > (prev.level ?? 0) };
}

/** Subject-level summary for the parent trajectory dashboard */
export async function subjectLevelSummary() {
  const all = await listSkillsWithProgress();
  const bySubject: Record<string, { skills: number; sumLevel: number; mastered: number; gradeLevel: string }> = {};
  for (const s of all as any[]) {
    const subj = s.subjectSlug;
    if (!bySubject[subj]) bySubject[subj] = { skills: 0, sumLevel: 0, mastered: 0, gradeLevel: s.gradeLevel || "5" };
    bySubject[subj].skills += 1;
    bySubject[subj].sumLevel += s.progress?.level ?? 0;
    if ((s.progress?.level ?? 0) >= 4) bySubject[subj].mastered += 1;
  }
  return Object.entries(bySubject).map(([subjectSlug, v]) => ({
    subjectSlug,
    skills: v.skills,
    avgLevel: v.skills ? +(v.sumLevel / v.skills).toFixed(2) : 0,
    mastered: v.mastered,
    pctMastered: v.skills ? Math.round((v.mastered / v.skills) * 100) : 0,
    gradeLevel: v.gradeLevel,
  }));
}

/* ============================== PROUD MOMENTS ============================ */
export async function listProudMoments(limit = 50) {
  const db = getDb();
  return db.select().from(proudMoments).where(eq(proudMoments.archived, false)).orderBy(desc(proudMoments.createdAt)).limit(limit);
}

export async function addProudMoment(input: {
  source?: "reagan" | "kiwi" | "parent" | "tutor" | "auto";
  category?: "effort" | "kindness" | "skill" | "bravery" | "creativity" | "persistence" | "growth" | "wonder";
  title: string;
  body?: string;
  emoji?: string;
  skillLadderId?: number;
  blockId?: number;
}) {
  const db = getDb();
  await db.insert(proudMoments).values({
    source: (input.source || "kiwi") as any,
    category: (input.category || "effort") as any,
    title: input.title,
    body: input.body || null,
    emoji: input.emoji || "⭐",
    skillLadderId: input.skillLadderId || null,
    blockId: input.blockId || null,
  } as any);
  return listProudMoments(10);
}

export async function reaganHeartProudMoment(id: number) {
  const db = getDb();
  await db.update(proudMoments).set({ reaganHearted: true }).where(eq(proudMoments.id, id));
  return true;
}

export async function archiveProudMoment(id: number) {
  const db = getDb();
  await db.update(proudMoments).set({ archived: true }).where(eq(proudMoments.id, id));
  return true;
}


/* ========================================================================== */
/*  DIAGNOSTIC PLACEMENT (Phase 3)                                            */
/* ========================================================================== */
import { placementTasks, placementResponses } from "../drizzle/schema";

/**
 * Returns all placement tasks (optionally for one subject) joined with their
 * skill metadata. Sorted by subject -> skill ladderOrder -> task order so the
 * UI walks her through one skill's three tasks at a time before moving on.
 */
export async function placementTasksFor(subjectSlug?: string) {
  const db = getDb();
  const rows: any[] = await db
    .select({
      taskId: placementTasks.id,
      taskOrder: placementTasks.taskOrder,
      gradeLevel: placementTasks.gradeLevel,
      taskType: placementTasks.taskType,
      kidPrompt: placementTasks.kidPrompt,
      choices: placementTasks.choices,
      hint: placementTasks.hint,
      skillId: skillLadder.id,
      skillCode: (skillLadder as any).skillCode,
      skillTitle: skillLadder.title,
      strand: skillLadder.strand,
      subjectSlug: skillLadder.subjectSlug,
      ladderOrder: (skillLadder as any).ladderOrder,
    })
    .from(placementTasks)
    .innerJoin(skillLadder, eq(placementTasks.skillLadderId, skillLadder.id))
    .where(
      subjectSlug
        ? and(eq(placementTasks.active, true), eq(skillLadder.subjectSlug, subjectSlug))
        : eq(placementTasks.active, true) as any
    );

  // Mark which ones already have responses (so frontend can skip).
  const responses: any[] = await db.select({
    placementTaskId: placementResponses.placementTaskId,
    isCorrect: placementResponses.isCorrect,
    feltIt: placementResponses.feltIt,
  }).from(placementResponses);
  const respMap = new Map(responses.map((r) => [r.placementTaskId, r]));

  rows.sort((a, b) => {
    if (a.subjectSlug !== b.subjectSlug) return a.subjectSlug.localeCompare(b.subjectSlug);
    if ((a.ladderOrder ?? 0) !== (b.ladderOrder ?? 0)) return (a.ladderOrder ?? 0) - (b.ladderOrder ?? 0);
    return a.taskOrder - b.taskOrder;
  });

  return rows.map((r) => ({ ...r, response: respMap.get(r.taskId) || null }));
}

/**
 * Submit one placement response. Auto-grades if it's pickOne / trueFalse /
 * shortAnswer (string-equal, case-insensitive, trimmed). When all 3 tasks
 * for a skill have responses, computes a placement level and writes it to
 * skillProgress (level 0..2) without firing the celebratory "leveled-up!"
 * proud-moment so she doesn't think she just "won" the placement.
 */
export async function submitPlacementResponse(input: {
  placementTaskId: number;
  kidAnswer?: string;
  feltIt?: "easy" | "ok" | "hard" | "skip";
}) {
  const db = getDb();
  const [task] = await db.select().from(placementTasks).where(eq(placementTasks.id, input.placementTaskId));
  if (!task) throw new Error("placement task not found");

  // Auto-grade
  let isCorrect: boolean | null = null;
  if (task.taskType !== "showMeHow" && task.correctAnswer != null && input.kidAnswer != null) {
    const norm = (s: string) => s.trim().toLowerCase().replace(/[\s,.\-_]+/g, " ");
    const expected = norm(String(task.correctAnswer));
    const got = norm(String(input.kidAnswer));
    isCorrect = expected === got || expected.includes(got) || got.includes(expected);
  } else if (input.feltIt === "skip") {
    isCorrect = false;
  }

  // Upsert response
  const [existing] = await db.select().from(placementResponses).where(eq(placementResponses.placementTaskId, input.placementTaskId));
  if (existing) {
    await db.update(placementResponses).set({
      kidAnswer: input.kidAnswer ?? null,
      isCorrect,
      feltIt: input.feltIt ?? "ok",
      completedAt: new Date(),
    }).where(eq(placementResponses.id, existing.id));
  } else {
    await db.insert(placementResponses).values({
      placementTaskId: input.placementTaskId,
      skillLadderId: task.skillLadderId,
      kidAnswer: input.kidAnswer ?? null,
      isCorrect,
      feltIt: input.feltIt ?? "ok",
    } as any);
  }

  // Did we complete all 3 (or however many) tasks for this skill?
  const allTasks = await db.select().from(placementTasks).where(eq(placementTasks.skillLadderId, task.skillLadderId));
  const allResp: any[] = await db.select().from(placementResponses).where(eq(placementResponses.skillLadderId, task.skillLadderId));
  const responded = new Set(allResp.map((r) => r.placementTaskId));
  const allDone = allTasks.every((t) => responded.has(t.id));
  let placedAt: number | null = null;

  if (allDone) {
    // Score: 1 point per correct + 0.5 per "easy" felt; subtract 0.5 per "hard" felt
    let score = 0;
    for (const t of allTasks) {
      const r = allResp.find((x) => x.placementTaskId === t.id);
      if (!r) continue;
      if (r.isCorrect) score += 1;
      if (r.feltIt === "easy") score += 0.5;
      if (r.feltIt === "hard") score -= 0.5;
    }
    // Map to ladder level 0..2 (placement bucket; she can grow further via practice)
    let placementLevel = 0;
    if (score >= 2.5) placementLevel = 2;
    else if (score >= 1.5) placementLevel = 1;
    else placementLevel = 0;

    // Confidence reflects how it felt overall
    const easyCount = allResp.filter((r) => r.feltIt === "easy").length;
    const hardCount = allResp.filter((r) => r.feltIt === "hard").length;
    let confidence = 50 + (easyCount - hardCount) * 12;
    confidence = Math.max(20, Math.min(75, confidence));

    // Write to skillProgress (placement-style: no proud-moment, no celebration)
    const [existingProgress] = await db.select().from(skillProgress).where(eq(skillProgress.skillLadderId, task.skillLadderId));
    if (existingProgress) {
      await db.update(skillProgress).set({
        level: placementLevel,
        confidence,
        evidenceCount: 0,
        updatedAt: new Date() as any,
        notes: `Placed via diagnostic on ${new Date().toLocaleDateString()}`,
      } as any).where(eq(skillProgress.id, existingProgress.id));
    } else {
      await db.insert(skillProgress).values({
        skillLadderId: task.skillLadderId,
        level: placementLevel,
        confidence,
        evidenceCount: 0,
        notes: `Placed via diagnostic on ${new Date().toLocaleDateString()}`,
      } as any);
    }
    placedAt = placementLevel;
  }

  return { isCorrect, allDone, placedAt };
}

/**
 * Across-the-app placement status: per-subject totals + overall progress %.
 */
export async function placementStatus() {
  const db = getDb();
  const skills: any[] = await db.select({
    skillId: skillLadder.id,
    subjectSlug: skillLadder.subjectSlug,
  }).from(skillLadder).where(eq((skillLadder as any).active, true));
  const tasks: any[] = await db.select({
    id: placementTasks.id,
    skillLadderId: placementTasks.skillLadderId,
  }).from(placementTasks).where(eq(placementTasks.active, true));
  const resp: any[] = await db.select({
    placementTaskId: placementResponses.placementTaskId,
    skillLadderId: placementResponses.skillLadderId,
  }).from(placementResponses);

  const tasksBySubject: Record<string, number> = {};
  const doneBySubject: Record<string, number> = {};
  const skillsBySubject: Record<string, Set<number>> = {};
  const placedSkillsBySubject: Record<string, Set<number>> = {};

  const skillSubject = new Map<number, string>(skills.map((s) => [s.skillId, s.subjectSlug]));
  for (const s of skills) {
    skillsBySubject[s.subjectSlug] = skillsBySubject[s.subjectSlug] || new Set();
    skillsBySubject[s.subjectSlug].add(s.skillId);
    placedSkillsBySubject[s.subjectSlug] = placedSkillsBySubject[s.subjectSlug] || new Set();
  }
  for (const t of tasks) {
    const sub = skillSubject.get(t.skillLadderId);
    if (!sub) continue;
    tasksBySubject[sub] = (tasksBySubject[sub] || 0) + 1;
  }
  // a skill is "placed" once all of its tasks have responses
  const respBySkill = new Map<number, Set<number>>();
  for (const r of resp) {
    if (!respBySkill.has(r.skillLadderId)) respBySkill.set(r.skillLadderId, new Set());
    respBySkill.get(r.skillLadderId)!.add(r.placementTaskId);
    const sub = skillSubject.get(r.skillLadderId);
    if (sub) doneBySubject[sub] = (doneBySubject[sub] || 0) + 1;
  }
  for (const s of skills) {
    const taskCount = tasks.filter((t) => t.skillLadderId === s.skillId).length;
    const responded = respBySkill.get(s.skillId)?.size || 0;
    if (taskCount > 0 && responded >= taskCount) placedSkillsBySubject[s.subjectSlug].add(s.skillId);
  }

  const subjects = Object.keys(skillsBySubject).sort();
  const summary = subjects.map((sub) => ({
    subjectSlug: sub,
    skillsTotal: skillsBySubject[sub].size,
    skillsPlaced: placedSkillsBySubject[sub].size,
    tasksTotal: tasksBySubject[sub] || 0,
    tasksDone: doneBySubject[sub] || 0,
    percentDone: tasksBySubject[sub] ? Math.round(((doneBySubject[sub] || 0) / tasksBySubject[sub]) * 100) : 0,
  }));
  const totalTasks = summary.reduce((a, s) => a + s.tasksTotal, 0);
  const totalDone = summary.reduce((a, s) => a + s.tasksDone, 0);
  return { subjects: summary, percentOverall: totalTasks ? Math.round((totalDone / totalTasks) * 100) : 0, totalDone, totalTasks };
}

/** Wipe placement responses (optionally for one subject) so she can redo it. */
export async function resetPlacement(subjectSlug?: string) {
  const db = getDb();
  if (subjectSlug) {
    const skills: any[] = await db.select({ id: skillLadder.id }).from(skillLadder).where(eq(skillLadder.subjectSlug, subjectSlug));
    const ids = skills.map((s) => s.id);
    if (ids.length === 0) return true;
    await db.delete(placementResponses).where(inArray(placementResponses.skillLadderId, ids as any));
  } else {
    await db.delete(placementResponses);
  }
  return true;
}


/* ============================== GAME-AS-REWARD (Phase 5) ============================== */
import { gamePrefs, moodSignals, gameBreakLog } from "../drizzle/schema";

export async function listGamePrefs(opts: { activeOnly?: boolean } = {}) {
  const db = getDb();
  if (opts.activeOnly === false) {
    return db.select().from(gamePrefs).orderBy(gamePrefs.rank);
  }
  return db.select().from(gamePrefs).where(eq(gamePrefs.active, true)).orderBy(gamePrefs.rank);
}
export async function upsertGamePref(g: typeof gamePrefs.$inferInsert & { id?: number }) {
  const db = getDb();
  if (g.id) {
    await db.update(gamePrefs).set(g as any).where(eq(gamePrefs.id, g.id));
    return g.id;
  }
  const result: any = await db.insert(gamePrefs).values(g as any);
  return result?.[0]?.insertId ?? null;
}
export async function deleteGamePref(id: number) {
  await getDb().update(gamePrefs).set({ active: false } as any).where(eq(gamePrefs.id, id));
}

/**
 * Detects frustration in the last `windowMin` minutes (default 30).
 * Returns counts so the UI can decide whether to offer a break.
 */
export async function recentMoodWindow(windowMin: number = 30) {
  const db = getDb();
  const since = new Date(Date.now() - windowMin * 60_000);
  const rows = await db.select().from(moodSignals);
  const recent = rows.filter((r: any) => new Date(r.createdAt) >= since);
  const hard = recent.filter((r: any) => r.feltIt === "hard").length;
  const ok = recent.filter((r: any) => r.feltIt === "ok").length;
  const easy = recent.filter((r: any) => r.feltIt === "easy").length;
  return {
    windowMin,
    hard, ok, easy,
    total: recent.length,
    suggestBreak: hard >= 2,            // 2+ "Hard" in 30 min -> Kiwi offers a break
    suggestReward: easy >= 2 && hard === 0, // 2+ "Got it" with no "Hard" -> earned reward
    recent,
  };
}

export async function logGameBreak(opts: {
  gamePrefId?: number | null;
  reason?: "earnedReward" | "frustrationBreak" | "kidPicked";
  durationMinutes?: number;
}) {
  const db = getDb();
  await db.insert(gameBreakLog).values({
    gamePrefId: opts.gamePrefId ?? null,
    reason: opts.reason ?? "kidPicked",
    durationMinutes: opts.durationMinutes ?? 10,
  } as any);
}

export async function recentGameBreaks(limit: number = 10) {
  return getDb().select().from(gameBreakLog).orderBy(desc(gameBreakLog.startedAt)).limit(limit);
}


/* ============================== POST-BLOCK FEEDBACK (Phase 6) ============================== */
import { skillFeedback } from "../drizzle/schema";

export async function recordSkillFeedback(opts: {
  skillLadderId?: number | null;
  feltIt?: "easy" | "ok" | "hard" | "skip";
  whatHelped?: "story" | "visual" | "handsOn" | "watch" | "practice" | "kiwiTalk" | "tutor" | "movement" | "none";
  timeFelt?: "tooShort" | "justRight" | "tooLong";
  wantedBreak?: boolean;
  note?: string | null;
}) {
  const db = getDb();
  let subjectSlug: string | null = null;
  if (opts.skillLadderId) {
    const [s] = await db.select().from(skillLadder).where(eq(skillLadder.id, opts.skillLadderId));
    subjectSlug = s?.subjectSlug ?? null;
  }
  await db.insert(skillFeedback).values({
    skillLadderId: opts.skillLadderId ?? null,
    subjectSlug,
    feltIt: (opts.feltIt ?? null) as any,
    whatHelped: (opts.whatHelped ?? null) as any,
    timeFelt: (opts.timeFelt ?? null) as any,
    wantedBreak: opts.wantedBreak ?? false,
    note: opts.note ?? null,
  } as any);

  // Mirror into moodSignals so the GameBreakCard / adaptation engine sees it too
  if (opts.feltIt) {
    try {
      await db.insert(moodSignals).values({
        source: "manual",
        subjectSlug,
        skillLadderId: opts.skillLadderId ?? null,
        feltIt: opts.feltIt as any,
        note: opts.note ?? null,
      } as any);
    } catch { /* best-effort */ }
  }
  // Refresh adaptation hint for this skill
  if (opts.skillLadderId) {
    try { await recomputeAdaptiveHint(opts.skillLadderId); } catch { /* best-effort */ }
  }
  return { ok: true };
}

/** Recent feedback rows (parent dashboard / adaptation engine input). */
export async function recentSkillFeedback(limit: number = 25) {
  return getDb().select().from(skillFeedback).orderBy(desc(skillFeedback.createdAt)).limit(limit);
}

/** Aggregate of "what helped most" across the last N rows — input for adaptation engine. */
export async function whatHelpedSummary(limit: number = 50) {
  const rows = await recentSkillFeedback(limit);
  const counts: Record<string, number> = {};
  for (const r of rows as any[]) {
    if (!r.whatHelped) continue;
    counts[r.whatHelped] = (counts[r.whatHelped] || 0) + 1;
  }
  const ranked = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  return { ranked, total: rows.length, top: ranked[0]?.[0] || null };
}


/* ============================== ADAPTATION ENGINE V2 (Phase 7) ============================== */
import { adaptiveHints, parentFlags } from "../drizzle/schema";

const MODE_ROTATION = ["story", "visual", "handsOn", "watch", "practice"] as const;

/**
 * Recompute the adaptiveHint for a given skill based on its last 5 feedback rows.
 * - If 2+ Hard or wantedBreak in last 5 → suggest a *different* mode (rotated) and softerNext=true.
 * - Else if a clear whatHelped winner exists → default to that mode, softerNext=false.
 * - Else fall back to "practice".
 *
 * Also raises a parentFlag if 3+ consecutive Hard signals stack on the same skill.
 */
export async function recomputeAdaptiveHint(skillLadderId: number) {
  const db = getDb();
  const recent = await db.select().from(skillFeedback)
    .where(eq(skillFeedback.skillLadderId, skillLadderId))
    .orderBy(desc(skillFeedback.createdAt))
    .limit(5);

  const hardCount = recent.filter((r: any) => r.feltIt === "hard").length;
  const okCount = recent.filter((r: any) => r.feltIt === "ok").length;
  const easyCount = recent.filter((r: any) => r.feltIt === "easy").length;
  const breakCount = recent.filter((r: any) => r.wantedBreak).length;
  const helpedCounts: Record<string, number> = {};
  for (const r of recent as any[]) {
    if (r.whatHelped && r.whatHelped !== "none") helpedCounts[r.whatHelped] = (helpedCounts[r.whatHelped] || 0) + 1;
  }
  const helpedTop = Object.entries(helpedCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
  const lastModeUsed = (recent[0] as any)?.whatHelped as string | undefined;

  let suggestedMode: typeof MODE_ROTATION[number] = "practice";
  let softerNext = false;
  let reason = "";

  if (hardCount >= 2 || breakCount >= 2) {
    // Struggle pattern → rotate to something different + soften
    const idx = MODE_ROTATION.indexOf((lastModeUsed as any) || "practice");
    suggestedMode = MODE_ROTATION[(Math.max(0, idx) + 1) % MODE_ROTATION.length];
    softerNext = true;
    reason = `Recent struggle (hard×${hardCount}${breakCount ? `, break×${breakCount}` : ""}); switching to ${suggestedMode} and pausing level-up.`;
  } else if (helpedTop && (MODE_ROTATION as readonly string[]).includes(helpedTop)) {
    suggestedMode = helpedTop as any;
    reason = `"${helpedTop}" worked best in recent rounds.`;
  } else {
    suggestedMode = "practice";
    reason = "Not enough signal yet — defaulting to practice.";
  }

  // Upsert
  const [existing] = await db.select().from(adaptiveHints).where(eq(adaptiveHints.skillLadderId, skillLadderId));
  if (existing) {
    await db.update(adaptiveHints).set({
      suggestedMode: suggestedMode as any, softerNext, hardCount, okCount, easyCount, reason,
    } as any).where(eq(adaptiveHints.id, existing.id));
  } else {
    await db.insert(adaptiveHints).values({
      skillLadderId, suggestedMode: suggestedMode as any, softerNext, hardCount, okCount, easyCount, reason,
    } as any);
  }

  // Stacked struggle → parentFlag (do not duplicate within last 7 days for same skill)
  if (recent.length >= 3 && recent.slice(0, 3).every((r: any) => r.feltIt === "hard")) {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60_000);
    const existingFlags = await db.select().from(parentFlags)
      .where(eq(parentFlags.skillLadderId, skillLadderId));
    const recentFlag = (existingFlags as any[]).find((f) => new Date(f.createdAt) >= sevenDaysAgo && !f.acknowledged);
    if (!recentFlag) {
      const [skill] = await db.select().from(skillLadder).where(eq(skillLadder.id, skillLadderId));
      await db.insert(parentFlags).values({
        skillLadderId,
        subjectSlug: skill?.subjectSlug ?? null,
        severity: "watch",
        title: `3 hard rounds in a row on "${skill?.title || "a skill"}"`,
        body: "Reagan signaled 'Hard' on this skill three times this week. Worth a side-by-side reteach or a tutor session.",
      } as any);
    }
  }

  return { suggestedMode, softerNext, hardCount, okCount, easyCount, reason };
}

export async function getAdaptiveHint(skillLadderId: number) {
  const db = getDb();
  const [row] = await db.select().from(adaptiveHints).where(eq(adaptiveHints.skillLadderId, skillLadderId));
  return row || null;
}

export async function listParentFlags(opts: { unacknowledgedOnly?: boolean } = {}) {
  const db = getDb();
  if (opts.unacknowledgedOnly) {
    return db.select().from(parentFlags).where(eq(parentFlags.acknowledged, false)).orderBy(desc(parentFlags.createdAt));
  }
  return db.select().from(parentFlags).orderBy(desc(parentFlags.createdAt)).limit(20);
}

export async function ackParentFlag(id: number) {
  await getDb().update(parentFlags).set({ acknowledged: true, acknowledgedAt: new Date() } as any).where(eq(parentFlags.id, id));
}


/* ============================== TUTORS (Phase 8) ============================== */
import { tutors, tutorSessions, tutorSessionSkills } from "../drizzle/schema";

export async function listTutors(activeOnly: boolean = true) {
  const db = getDb();
  if (activeOnly) return db.select().from(tutors).where(eq(tutors.active, true)).orderBy(asc(tutors.name));
  return db.select().from(tutors).orderBy(asc(tutors.name));
}

export async function getTutor(id: number) {
  const [row] = await getDb().select().from(tutors).where(eq(tutors.id, id));
  return row || null;
}

export async function upsertTutor(opts: { id?: number; name: string; role?: string; email?: string; phone?: string; bio?: string; subjects?: string; avatarUrl?: string; active?: boolean; notes?: string; }) {
  const db = getDb();
  if (opts.id) {
    await db.update(tutors).set({
      name: opts.name, role: opts.role, email: opts.email, phone: opts.phone,
      bio: opts.bio, subjects: opts.subjects, avatarUrl: opts.avatarUrl,
      active: opts.active ?? true, notes: opts.notes,
    } as any).where(eq(tutors.id, opts.id));
    return { id: opts.id };
  }
  const [r] = await db.insert(tutors).values({
    name: opts.name, role: opts.role, email: opts.email, phone: opts.phone,
    bio: opts.bio, subjects: opts.subjects, avatarUrl: opts.avatarUrl,
    active: opts.active ?? true, notes: opts.notes,
  } as any) as any;
  return { id: r?.insertId ?? null };
}

/**
 * Hard-delete a tutor row when no sessions reference it. If sessions exist,
 * we mark the tutor inactive instead so historical analytics keep working.
 * Returns { deleted: true } or { deleted: false, deactivated: true }.
 */
export async function deleteTutor(id: number) {
  const db = getDb();
  const [hadSessions] = await db.select({ id: tutorSessions.id })
    .from(tutorSessions).where(eq(tutorSessions.tutorId, id)).limit(1);
  if (hadSessions) {
    await db.update(tutors).set({ active: false } as any).where(eq(tutors.id, id));
    return { deleted: false as const, deactivated: true as const };
  }
  await db.delete(tutors).where(eq(tutors.id, id));
  return { deleted: true as const, deactivated: false as const };
}

export async function recentTutorSessions(tutorId: number, limit: number = 10) {
  return getDb().select().from(tutorSessions)
    .where(eq(tutorSessions.tutorId, tutorId))
    .orderBy(desc(tutorSessions.scheduledAt))
    .limit(limit);
}

export async function recordTutorSession(opts: {
  tutorId: number;
  scheduledAt?: Date;
  durationMin?: number;
  focus?: string;
  status?: "scheduled" | "completed" | "missed" | "trial" | "cancelled";
  sessionNotes?: string;
  skills?: Array<{ skillLadderId: number; outcome: "strong" | "gettingIt" | "needsMore" | "notWorked"; tutorNote?: string }>;
}) {
  const db = getDb();
  const [r] = await db.insert(tutorSessions).values({
    tutorId: opts.tutorId,
    scheduledAt: opts.scheduledAt ?? new Date(),
    durationMin: opts.durationMin ?? 60,
    focus: opts.focus,
    status: opts.status ?? "completed",
    sessionNotes: opts.sessionNotes,
  } as any) as any;
  const sessionId = r?.insertId;

  // Link skills + feed adaptation engine
  for (const s of opts.skills || []) {
    await db.insert(tutorSessionSkills).values({
      sessionId, skillLadderId: s.skillLadderId, outcome: s.outcome, tutorNote: s.tutorNote ?? null,
    } as any);

    // Adaptation feed
    if (s.outcome === "strong" || s.outcome === "gettingIt") {
      // Bump confidence as if a strong practice round happened
      try {
        await recordSkillPractice({ skillLadderId: s.skillLadderId, mode: "practice", selfRating: s.outcome === "strong" ? 5 : 4, parentNote: s.tutorNote ? `Tutor: ${s.tutorNote}` : `Tutor: ${s.outcome}` });
      } catch { /* best-effort */ }
    } else if (s.outcome === "needsMore") {
      try {
        // Mirror as a moodSignal "hard" so the adaptation engine sees the struggle
        await db.insert(moodSignals).values({
          source: "manual", subjectSlug: null, skillLadderId: s.skillLadderId, feltIt: "hard", note: `Tutor flagged: ${s.tutorNote || "needs more work"}`,
        } as any);
        await recomputeAdaptiveHint(s.skillLadderId);
      } catch { /* best-effort */ }
    }
  }
  return { sessionId };
}

export async function tutorSessionSkillsFor(sessionId: number) {
  return getDb().select().from(tutorSessionSkills).where(eq(tutorSessionSkills.sessionId, sessionId));
}

/** Top N priority skills for a tutor's subjects (handoff briefing). */
export async function priorityForTutor(tutorId: number, limit: number = 5) {
  const t = await getTutor(tutorId);
  if (!t) return [];
  const wantedSubjects = (t.subjects || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  const all = await listSkillsWithProgress();
  const filtered = wantedSubjects.length
    ? all.filter((s: any) => wantedSubjects.includes(String(s.subjectSlug || "").toLowerCase()))
    : all;
  // Lowest mastery first; ties broken by ladderOrder
  return [...filtered].sort((a: any, b: any) => {
    const aL = a.level ?? 0, bL = b.level ?? 0;
    if (aL !== bL) return aL - bL;
    const aC = a.confidence ?? 0, bC = b.confidence ?? 0;
    if (aC !== bC) return aC - bC;
    return (a.ladderOrder ?? 0) - (b.ladderOrder ?? 0);
  }).slice(0, limit);
}


/* ============================== UPLOAD OR SYNC ============================
 * Unified classifier — given any kind of incoming item (uploaded file URL,
 * pasted link, pasted text, or pulled email), routes it into the right table
 * automatically and returns a typed result the UI can show as confirmation.
 * ========================================================================== */

export type ClassifiedItem =
  | { kind: "file"; fileUrl: string; fileName: string; mimeType: string; subjectSlug?: string | null; note?: string | null; fileKey?: string | null }
  | { kind: "link"; url: string; title?: string | null; subjectSlug?: string | null; note?: string | null }
  | { kind: "text"; text: string; subjectSlug?: string | null; sender?: string | null; subject?: string | null }
  | { kind: "email"; subject: string; bodyText: string; senderEmail: string; senderName?: string | null; receivedAt?: Date | null; subjectSlug?: string | null };

export type RoutedResult = {
  kind: ClassifiedItem["kind"];
  routedTo: "submission" | "timelineEvent" | "appLink" | "bookAssignment" | "tutorSession" | "weeklyTopicQueue";
  recordId: number;
  routedToLabel: string;
  routedToHref: string;
  message: string;
};

const TUTOR_EMAIL_HINTS = [
  /@congertutoring/i,
  /tutor/i,
  /marisa/i,
  /mama bear/i,
];
const IH_EMAIL_HINTS = [
  // (legacy IH school @ihsd.us allowlist removed 2026-05-02 — account deactivated)
  /froehlich/i,
  /wells/i,
  /5th grade/i,
  /indian hill/i,
];
const CURRICULUM_HINTS = /(curriculum|syllabus|inquiry|standards|scope|sequence|pacing)/i;
const HOMEWORK_HINTS = /(homework|worksheet|practice|assignment|hw|hw_)/i;

function inferSubjectSlugFromText(text: string): string | null {
  const t = text.toLowerCase();
  if (/(math|fraction|decimal|algebra|geometry|multiply|divide|add|subtract|number)/.test(t)) return "math";
  if (/(read|write|spell|grammar|essay|paragraph|story|book|literature)/.test(t)) return "ela";
  if (/(science|experiment|inquiry|hypothesis|variable|observation)/.test(t)) return "science";
  if (/(history|geography|civic|government|social\s*studies)/.test(t)) return "social-studies";
  return null;
}

export async function classifyAndRoute(item: ClassifiedItem): Promise<RoutedResult> {
  const db = getDb();

  // ----- 1. EMAIL → tutor session (if from a known tutor) OR timeline event (if from IH/teacher) -----
  if (item.kind === "email") {
    const isTutor = TUTOR_EMAIL_HINTS.some((re) => re.test(item.senderEmail) || re.test(item.senderName || "") || re.test(item.subject));
    const isIH = IH_EMAIL_HINTS.some((re) => re.test(item.senderEmail) || re.test(item.senderName || "") || re.test(item.subject));

    if (isTutor) {
      // Insert a lightweight tutor session note.
      const subjectSlug = item.subjectSlug ?? inferSubjectSlugFromText(item.subject + " " + item.bodyText);
      const inserted = await db.insert(tutorSessions).values({
        tutorId: await ensurePlaceholderTutorId(item.senderName || item.senderEmail || "Tutor"),
        scheduledAt: item.receivedAt ?? new Date(),
        durationMin: 60,
        focus: subjectSlug ? `Subject: ${subjectSlug}` : null,
        status: "completed",
        sessionNotes: `From email "${item.subject}" — ${item.senderEmail}\n\n${item.bodyText.slice(0, 4000)}`,
      } as any);
      const id = (inserted as any).insertId ?? 0;
      return {
        kind: "email",
        routedTo: "tutorSession",
        recordId: Number(id),
        routedToLabel: "Tutor Handoff",
        routedToHref: "/tutor",
        message: `Saved as a tutor session (from ${item.senderEmail}).`,
      };
    }

    // IH/teacher (or anything else) → timeline event so it shows in This Week + parent dashboard
    const subjectSlug = item.subjectSlug ?? inferSubjectSlugFromText(item.subject + " " + item.bodyText);
    const occurredAt = item.receivedAt ?? new Date();
    await db.insert(timelineEvents).values({
      eventType: "reflection",
      date: toDateString(occurredAt),
      title: item.subject || `Email from ${item.senderName || item.senderEmail}`,
      description: item.bodyText.slice(0, 4000),
      subjectSlug: subjectSlug || null,
      mediaUrl: null,
      createdByUserId: null,
    } as any);
    const [latest] = await db.select().from(timelineEvents).orderBy(desc(timelineEvents.id)).limit(1);
    return {
      kind: "email",
      routedTo: "timelineEvent",
      recordId: latest?.id ?? 0,
      routedToLabel: isIH ? "This Week (IH update)" : "Parent Notes",
      routedToHref: isIH ? "/week" : "/whiteboard",
      message: isIH ? `Saved as an Indian Hill update.` : `Saved as a parent note.`,
    };
  }

  // ----- 2. FILE upload -----
  if (item.kind === "file") {
    const isImage = item.mimeType.startsWith("image/");
    const isPdf = item.mimeType === "application/pdf";
    const isCurriculum = CURRICULUM_HINTS.test(item.fileName);
    const isHomework = HOMEWORK_HINTS.test(item.fileName);

    if (isCurriculum && isPdf) {
      // Curriculum doc → timeline event tagged "reflection" (closest enum) ;
      // parent later parses it manually (we don't auto-parse here — keeps Adult
      // Analytics free of inferred fake topics)
      await db.insert(timelineEvents).values({
        eventType: "reflection",
        date: toDateString(new Date()),
        title: `Curriculum doc: ${item.fileName}`,
        description: item.note || "Uploaded curriculum document — open it from the link below.",
        subjectSlug: item.subjectSlug || null,
        mediaUrl: item.fileUrl,
        createdByUserId: null,
      } as any);
      const [latest] = await db.select().from(timelineEvents).orderBy(desc(timelineEvents.id)).limit(1);
      return {
        kind: "file",
        routedTo: "timelineEvent",
        recordId: latest?.id ?? 0,
        routedToLabel: "Curriculum library",
        routedToHref: "/whiteboard",
        message: `Saved "${item.fileName}" to the curriculum library.`,
      };
    }

    if (isImage || isHomework || isPdf) {
      // Photo of finished work / printed worksheet → assignment submission
      const subRow = await createAssignmentSubmission({
        blockId: null,
        mode: isImage ? "photo" : "file",
        photoUrl: isImage ? item.fileUrl : null,
        fileUrl: !isImage ? item.fileUrl : null,
        fileName: item.fileName,
        fileMime: item.mimeType,
        answersText: null,
        kidNotes: item.note || null,
        autoScore: null,
        manualScore: null,
        letter: null,
        graded: false,
      } as any);
      return {
        kind: "file",
        routedTo: "submission",
        recordId: (subRow as any)?.id ?? 0,
        routedToLabel: "Today (turn-in)",
        routedToHref: "/today",
        message: `Saved "${item.fileName}" as a turn-in. Auto-grading runs when an answer key is attached.`,
      };
    }

    // Anything else → generic timeline note with attachment link
    await db.insert(timelineEvents).values({
      eventType: "reflection",
      date: toDateString(new Date()),
      title: item.fileName,
      description: item.note || "Uploaded file.",
      subjectSlug: item.subjectSlug || null,
      mediaUrl: item.fileUrl,
      createdByUserId: null,
    } as any);
    const [latest] = await db.select().from(timelineEvents).orderBy(desc(timelineEvents.id)).limit(1);
    return {
      kind: "file",
      routedTo: "timelineEvent",
      recordId: latest?.id ?? 0,
      routedToLabel: "Parent Notes",
      routedToHref: "/whiteboard",
      message: `Saved "${item.fileName}" to Parent Notes.`,
    };
  }

  // ----- 3. LINK -----
  if (item.kind === "link") {
    const url = item.url;
    const looksLikeBook = /(amazon|bookshop|libby|epic|goodreads|book)/i.test(url);
    const looksLikeKidApp = /(khan|ixl|prodigy|abcmouse|toca|roblox|duolingo|youtube|brainpop)/i.test(url);

    if (looksLikeKidApp) {
      await db.insert(appLinks).values({
        name: item.title || new URL(url).hostname,
        url,
        emoji: pickEmojiForLink(url),
        category: pickCategoryForLink(url),
        description: item.note || null,
      } as any);
      const [latestApp] = await db.select().from(appLinks).orderBy(desc(appLinks.id)).limit(1);
      const recordId = latestApp?.id ?? 0;
      return {
        kind: "link",
        routedTo: "appLink",
        recordId,
        routedToLabel: "Apps & Tools",
        routedToHref: "/apps",
        message: `Saved "${item.title || url}" to Apps & Tools.`,
      };
    }

    if (looksLikeBook) {
      // Insert as a book assignment shell
      await db.insert(books).values({
        title: item.title || url,
        author: null,
        type: "novel",
        subjectSlug: item.subjectSlug || "ela",
        currentPage: 1,
        totalPages: null,
        notes: `Link: ${url}\n${item.note || ""}`,
      } as any);
      const [b] = await db.select().from(books).orderBy(desc(books.id)).limit(1);
      return {
        kind: "link",
        routedTo: "bookAssignment",
        recordId: b?.id ?? 0,
        routedToLabel: "Bookshelf",
        routedToHref: "/bookshelf",
        message: `Saved "${item.title || url}" to the Bookshelf.`,
      };
    }

    // Generic link → timeline note
    await db.insert(timelineEvents).values({
      eventType: "reflection",
      date: toDateString(new Date()),
      title: item.title || url,
      description: `Link saved: ${url}\n${item.note || ""}`.trim(),
      subjectSlug: item.subjectSlug || null,
      mediaUrl: url,
      createdByUserId: null,
    } as any);
    const [latest] = await db.select().from(timelineEvents).orderBy(desc(timelineEvents.id)).limit(1);
    return {
      kind: "link",
      routedTo: "timelineEvent",
      recordId: latest?.id ?? 0,
      routedToLabel: "Parent Notes",
      routedToHref: "/whiteboard",
      message: `Saved link to Parent Notes.`,
    };
  }

  // ----- 4. TEXT -----
  // Tutor-flavored text → tutor session; otherwise → timeline note
  const text = (item as { text: string }).text;
  const isTutor = TUTOR_EMAIL_HINTS.some((re) => re.test(text)) || TUTOR_EMAIL_HINTS.some((re) => re.test(item.sender || ""));
  const subjectSlug = item.subjectSlug ?? inferSubjectSlugFromText(text);

  if (isTutor) {
    const inserted = await db.insert(tutorSessions).values({
      tutorId: await ensurePlaceholderTutorId(item.sender || "Tutor"),
      scheduledAt: new Date(),
      durationMin: 60,
      focus: subjectSlug ? `Subject: ${subjectSlug}` : null,
      status: "completed",
      sessionNotes: text.slice(0, 4000),
    } as any);
    const id = (inserted as any).insertId ?? 0;
    return {
      kind: "text",
      routedTo: "tutorSession",
      recordId: Number(id),
      routedToLabel: "Tutor Handoff",
      routedToHref: "/tutor",
      message: `Saved as a tutor session note.`,
    };
  }

  await db.insert(timelineEvents).values({
    eventType: "reflection",
    date: toDateString(new Date()),
    title: item.subject || (text.slice(0, 60) + (text.length > 60 ? "…" : "")),
    description: text.slice(0, 4000),
    subjectSlug: subjectSlug || null,
    mediaUrl: null,
    createdByUserId: null,
  } as any);
  const [latest] = await db.select().from(timelineEvents).orderBy(desc(timelineEvents.id)).limit(1);
  return {
    kind: "text",
    routedTo: "timelineEvent",
    recordId: latest?.id ?? 0,
    routedToLabel: "Parent Notes",
    routedToHref: "/whiteboard",
    message: `Saved as a parent note.`,
  };
}


/* ============================== SYNC RUNS ================================== */
import { syncRequests, syncRuns, syncRunItems } from "../drizzle/schema";

export async function recordSyncRequest(input: { source: "gmail" | "drive" | "both"; lookbackDays: number }) {
  await getDb().insert(syncRequests).values({
    source: input.source,
    lookbackDays: input.lookbackDays,
  } as any);
}

export async function popPendingSyncRequests() {
  const db = getDb();
  const pending = await db.select().from(syncRequests).where(isNull(syncRequests.consumedAt)).orderBy(syncRequests.requestedAt);
  if (pending.length > 0) {
    const ids = pending.map((p) => p.id);
    await db.update(syncRequests).set({ consumedAt: new Date() }).where(inArray(syncRequests.id, ids));
  }
  return pending;
}

export async function startSyncRun(input: { source: "gmail" | "drive" | "both"; triggeredBy?: "schedule" | "parent" | "manual" }) {
  const db = getDb();
  await db.insert(syncRuns).values({
    source: input.source,
    triggeredBy: input.triggeredBy ?? "schedule",
  } as any);
  const [latest] = await db.select().from(syncRuns).orderBy(desc(syncRuns.id)).limit(1);
  return latest;
}

export async function appendSyncRunItem(input: {
  runId: number;
  source: "gmail" | "drive";
  externalId: string;
  routedTo: string;
  recordId: number;
  title?: string | null;
  message?: string | null;
}) {
  await getDb().insert(syncRunItems).values({
    runId: input.runId,
    source: input.source,
    externalId: input.externalId,
    routedTo: input.routedTo,
    recordId: input.recordId,
    title: input.title ?? null,
    message: input.message ?? null,
  } as any);
}

export async function finishSyncRun(input: {
  runId: number;
  itemsScanned: number;
  itemsRouted: number;
  itemsSkipped: number;
  errors?: string | null;
}) {
  await getDb().update(syncRuns).set({
    finishedAt: new Date(),
    itemsScanned: input.itemsScanned,
    itemsRouted: input.itemsRouted,
    itemsSkipped: input.itemsSkipped,
    errors: input.errors ?? null,
  } as any).where(eq(syncRuns.id, input.runId));
}

export async function getMostRecentSyncSummary() {
  const db = getDb();
  const rows = await db.select().from(syncRuns).orderBy(desc(syncRuns.startedAt)).limit(1);
  if (!rows.length) return null;
  const run = rows[0];
  const items = await db.select().from(syncRunItems).where(eq(syncRunItems.runId, run.id)).orderBy(desc(syncRunItems.createdAt)).limit(20);
  return { ...run, items };
}

export async function listRecentSyncRuns(limit = 10) {
  return getDb().select().from(syncRuns).orderBy(desc(syncRuns.startedAt)).limit(limit);
}


/* ============== Classifier helpers (toDateString / pickEmoji / etc) ====== */
import { tutors as _tutors_for_classifier } from "../drizzle/schema";

function toDateString(d: Date): string {
  // YYYY-MM-DD for the timelineEvents.date column
  return d.toISOString().slice(0, 10);
}

function pickEmojiForLink(url: string): string {
  const u = url.toLowerCase();
  if (u.includes("khan")) return "🧮";
  if (u.includes("ixl")) return "📐";
  if (u.includes("prodigy")) return "🐉";
  if (u.includes("youtube")) return "📺";
  if (u.includes("brainpop")) return "🧠";
  if (u.includes("duolingo")) return "🦉";
  if (u.includes("toca")) return "🌸";
  if (u.includes("roblox")) return "🎮";
  return "🔗";
}

function pickCategoryForLink(url: string): "learning" | "creativity" | "school" | "nature" | "reading" | "google" | "video" {
  const u = url.toLowerCase();
  if (u.includes("youtube")) return "video";
  if (u.includes("toca") || u.includes("roblox")) return "creativity";
  if (u.includes("google")) return "google";
  if (u.includes("epic") || u.includes("libby") || u.includes("book")) return "reading";
  return "learning";
}

async function ensurePlaceholderTutorId(name: string): Promise<number> {
  const dbi = getDb();
  const trimmed = (name || "Tutor").trim().slice(0, 120);
  const existing = await dbi.select().from(_tutors_for_classifier).where(eq(_tutors_for_classifier.name, trimmed)).limit(1);
  if (existing.length) return existing[0].id;
  const inserted = await dbi.insert(_tutors_for_classifier).values({
    name: trimmed,
    role: "tutor",
    active: true,
  } as any);
  const id = Number((inserted as any).insertId ?? 0);
  if (id > 0) return id;
  const [latest] = await dbi.select().from(_tutors_for_classifier).orderBy(desc(_tutors_for_classifier.id)).limit(1);
  return latest?.id ?? 0;
}


/* ============== Scheduled-sync dedupe helper ============================ */
import { syncRunItems as _sri_for_dedupe } from "../drizzle/schema";

export async function findSyncItemByExternalId(externalId: string) {
  if (!externalId) return null;
  const dbi = getDb();
  const [row] = await dbi
    .select()
    .from(_sri_for_dedupe)
    .where(eq(_sri_for_dedupe.externalId, externalId))
    .limit(1);
  return row ?? null;
}


/* ============== Automation feed helpers (parent dashboard) =============== */
import { syncRuns as _automation_runs, syncRunItems as _automation_items } from "../drizzle/schema";

export async function listRecentAutomationRuns(limit = 14) {
  const dbi = getDb();
  return await dbi
    .select()
    .from(_automation_runs)
    .orderBy(desc(_automation_runs.startedAt))
    .limit(limit);
}

export async function listAutomationItemsForRun(runId: number) {
  const dbi = getDb();
  return await dbi
    .select()
    .from(_automation_items)
    .where(eq(_automation_items.runId, runId))
    .orderBy(desc(_automation_items.createdAt));
}

export async function listRecentAutomationItems(opts: { sinceMs?: number; limit?: number } = {}) {
  const dbi = getDb();
  const since = opts.sinceMs ?? Date.now() - 7 * 24 * 60 * 60 * 1000;
  const rows = await dbi
    .select()
    .from(_automation_items)
    .orderBy(desc(_automation_items.createdAt))
    .limit(opts.limit ?? 50);
  return rows.filter((r) => new Date(r.createdAt as any).getTime() >= since);
}

export async function dismissAutomationItem(itemId: number, parentNote?: string) {
  const dbi = getDb();
  await dbi
    .update(_automation_items)
    .set({ dismissed: true, parentNote: parentNote ?? null })
    .where(eq(_automation_items.id, itemId));
  return { ok: true };
}

export async function flagAutomationItem(itemId: number, parentNote?: string) {
  const dbi = getDb();
  await dbi
    .update(_automation_items)
    .set({ flagged: true, parentNote: parentNote ?? null })
    .where(eq(_automation_items.id, itemId));
  return { ok: true };
}

export async function automationStatus() {
  const dbi = getDb();
  const [latestRun] = await dbi
    .select()
    .from(_automation_runs)
    .orderBy(desc(_automation_runs.startedAt))
    .limit(1);
  const last7Items = await listRecentAutomationItems({ limit: 200 });
  const flagged = last7Items.filter((r) => r.flagged && !r.dismissed).length;
  let latestRunStatus: "running" | "ok" | "errors" | null = null;
  if (latestRun) {
    if (!latestRun.finishedAt) latestRunStatus = "running";
    else if (latestRun.errors) latestRunStatus = "errors";
    else latestRunStatus = "ok";
  }
  return {
    latestRunAt: latestRun?.startedAt ?? null,
    latestRunStatus,
    last7DaysItems: last7Items.length,
    pendingFlags: flagged,
  };
}


// ──────────────────────────────────────────────────────────────────────────
// Weekly Digest — auto-emailed Sunday 7 PM to spear.cpt@gmail.com
// All numbers come from REAL parent/Reagan/tutor entries only.
// ──────────────────────────────────────────────────────────────────────────
import { weeklyDigests } from "../drizzle/schema";

export async function buildWeeklyDigestPayload(opts?: { weekStart?: Date; weekEnd?: Date }) {
  const db = getDb();
  const now = new Date();
  const weekEnd = opts?.weekEnd ?? now;
  const weekStart = opts?.weekStart ?? new Date(weekEnd.getTime() - 7 * 24 * 60 * 60 * 1000);

  // 1. Confidence wins (level-ups in proudMoments since weekStart, source=auto)
  const allProud = await db.select().from(proudMoments);
  const levelUps = allProud.filter((p: any) => {
    const created = p.createdAt ? new Date(p.createdAt) : null;
    return created && created >= weekStart && created <= weekEnd && (p.source === "auto" || p.category === "levelUp");
  });

  // 2. Tutor sessions completed this week
  const allTutorSessions = await db.select().from(tutorSessions);
  const recentTutorSessions = allTutorSessions.filter((t: any) => {
    const at = t.scheduledAt ? new Date(t.scheduledAt) : null;
    return at && at >= weekStart && at <= weekEnd && t.status === "completed";
  });

  // 3. Parent flags raised this week
  const allParentFlags = await db.select().from(parentFlags);
  const flagsThisWeek = allParentFlags.filter((f: any) => {
    const at = f.createdAt ? new Date(f.createdAt) : null;
    return at && at >= weekStart && at <= weekEnd;
  });

  // 4. Mood arc — moodSignals across the week (best-effort; empty if none)
  let moodArc: any = { hard: 0, ok: 0, easy: 0, total: 0 };
  try {
    const sigs = await db.select().from(moodSignals);
    const recent = sigs.filter((s: any) => {
      const at = s.createdAt ? new Date(s.createdAt) : null;
      return at && at >= weekStart && at <= weekEnd;
    });
    moodArc = {
      hard: recent.filter((r: any) => r.feltIt === "hard").length,
      ok: recent.filter((r: any) => r.feltIt === "ok").length,
      easy: recent.filter((r: any) => r.feltIt === "easy").length,
      total: recent.length,
    };
  } catch { /* moodSignals not always present */ }

  // 5. What helped (top helpers from skillFeedback this week)
  let whatHelped: Array<{ helper: string; count: number }> = [];
  try {
    const fb = await db.select().from(skillFeedback);
    const recent = fb.filter((f: any) => {
      const at = f.createdAt ? new Date(f.createdAt) : null;
      return at && at >= weekStart && at <= weekEnd && f.whatHelped;
    });
    const counts: Record<string, number> = {};
    for (const r of recent as any[]) {
      const h = String(r.whatHelped || "").trim();
      if (!h) continue;
      counts[h] = (counts[h] || 0) + 1;
    }
    whatHelped = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([helper, count]) => ({ helper, count }));
  } catch { /* skillFeedback not always present */ }

  // 6. Subject confidence delta — average confidence per subject from current skillProgress
  const progress = await db.select().from(skillProgress);
  const ladder = await db.select().from(skillLadder);
  const ladderById = new Map(ladder.map((l: any) => [l.id, l]));
  const subjectAggs: Record<string, { sum: number; count: number; levelSum: number }> = {};
  for (const p of progress as any[]) {
    const skill = ladderById.get(p.skillLadderId);
    if (!skill) continue;
    const slug = (skill as any).subjectSlug || "other";
    if (!subjectAggs[slug]) subjectAggs[slug] = { sum: 0, count: 0, levelSum: 0 };
    subjectAggs[slug].sum += p.confidence ?? 0;
    subjectAggs[slug].count += 1;
    subjectAggs[slug].levelSum += p.level ?? 0;
  }
  const subjectSummary = Object.entries(subjectAggs).map(([slug, agg]) => ({
    subject: slug,
    avgConfidence: agg.count ? Math.round(agg.sum / agg.count) : 0,
    avgLevel: agg.count ? Math.round((agg.levelSum / agg.count) * 10) / 10 : 0,
    skillsTracked: agg.count,
  }));

  // 7. IH alignment for the week
  let ihAlignment: any[] = [];
  try {
    const wt = await db.select().from(weeklyTopics);
    ihAlignment = (wt as any[]).filter((w: any) => {
      const ws = w.weekStart ? new Date(w.weekStart) : null;
      return ws && ws >= new Date(weekStart.getTime() - 24 * 60 * 60 * 1000) && ws <= weekEnd;
    }).map((w: any) => ({ subject: w.subjectSlug, topic: w.topic, weekStart: w.weekStart }));
  } catch { /* weeklyTopics not always present */ }

  return {
    weekStart: weekStart.toISOString(),
    weekEnd: weekEnd.toISOString(),
    levelUps: levelUps.map((p: any) => ({ title: p.title, category: p.category, when: p.createdAt })),
    tutorSessionsCount: recentTutorSessions.length,
    tutorSessions: recentTutorSessions.map((t: any) => ({ tutorId: t.tutorId, focus: t.focus, when: t.scheduledAt })),
    flagsCount: flagsThisWeek.length,
    flags: flagsThisWeek.map((f: any) => ({ kind: f.kind, summary: f.summary, skillLadderId: f.skillLadderId })),
    moodArc,
    whatHelped,
    subjectSummary,
    ihAlignment,
    generatedAt: new Date().toISOString(),
  };
}

export async function saveWeeklyDigest(payload: any, opts?: { weekStart?: Date; weekEnd?: Date }) {
  const db = getDb();
  const weekStart = opts?.weekStart ?? new Date(payload.weekStart);
  const weekEnd = opts?.weekEnd ?? new Date(payload.weekEnd);
  const r = await db.insert(weeklyDigests).values({
    weekStart, weekEnd, payload, emailStatus: "pending",
  } as any).$returningId();
  return r[0]?.id;
}

export async function listRecentDigests(limit = 12) {
  const db = getDb();
  const rows = await db.select().from(weeklyDigests);
  return (rows as any[])
    .sort((a, b) => new Date(b.weekStart).getTime() - new Date(a.weekStart).getTime())
    .slice(0, limit);
}

export async function markDigestEmailed(id: number, status: "sent" | "failed" = "sent") {
  const db = getDb();
  await db.update(weeklyDigests).set({
    emailedAt: new Date(),
    emailStatus: status,
  } as any).where(eq(weeklyDigests.id, id));
}


/* ============================================================================
 * DRIVE PUSH QUEUE
 *   Every file the parent or Reagan uploads is mirrored into the right
 *   Reagan/IHES Google Drive subfolder by the daily scheduled task.
 *   This module just runs the queue.
 * ========================================================================== */
import { drivePushQueue, type DrivePushQueueRow } from "../drizzle/schema";

/**
 * Mom asked May 4 2026 — every Hub subfolder should auto-mirror as the site updates.
 * The 11 canonical buckets in Drive: Reagan School Hub (Dashboard) /
 *   Assignments | Finished Work | Daily Schedule | Worksheets (Daily Packets)
 *   Printables | Tutor Handoffs | Report Cards | Journal
 *   Analytics (Mom-only) | Adult Notes (Mom-only) | Kiwi Coins
 *
 * The legacy 5-target enum is preserved so older callers keep working; the cron
 * worker maps each value to the matching subfolder name when it pushes the file.
 */
export type DrivePushTarget =
  | "reagan"               // catch-all (top-level Hub root)
  | "reagan_ihes"          // Printables / curriculum library (legacy alias)
  | "reagan_tutor"         // Tutor Handoffs
  | "reagan_artwork"       // Finished Work artwork
  | "reagan_assignments"   // Assignments + worksheets to do
  | "finished_work"        // Submissions, photos of completed work
  | "daily_schedule"       // Generated agendas + plan PDFs
  | "worksheets"           // Printable Daily Packets
  | "printables"           // Master worksheet library
  | "report_cards"         // Weekly + term summaries
  | "journal"              // Reagan's notebook entries
  | "analytics"            // Mom-only analytics CSV/JSON
  | "adult_notes"          // Mom + tutor private notes
  | "kiwi_coins"           // Coin ledger snapshot
  | "tutor"                // Active tutor sessions, schedules, summaries
  | "apps_tools"           // Snapshots / exports of apps & tools usage
  | "bookshelf"            // Bookshelf reading log + uploads
  | "adventures"           // Adventures library entries + photos
  | "practice"             // Practice for Coins history
  | "notebook"             // Reagan notebook attachments
  | "curriculum_checklist" // Auto-rebuilt weekly curriculum checklist
  | "day_log"             // Slice 4.5 — Daily Operations / Day Logs / {YYYY-MM} / {date} - Day Log.md
  | "recap_reply"         // Slice 4.5 — Daily Operations / Recap Replies / {YYYY-MM} / {date} - {sender} - Recap.md
  | "topics_covered"      // Slice 4.5 — Curriculum and Standards / Topics Covered / {YYYY-MM} / {date} - {subject} - {topic}.md
  | "agenda_pdf"          // Slice 4.5 — Daily Operations / Daily Agenda PDFs / {YYYY-MM} / {date} - Agenda.pdf
  | "future_worksheets";   // v2.88 — Curriculum and Resources / Future Worksheets / {Subject} / *.{md|pdf} — the planning bench Mom can pull from

/** Decide which Drive folder a file belongs in based on the classifier's RoutedResult. */
export function pickDriveFolderForRouted(routed: RoutedResult, item: ClassifiedItem): DrivePushTarget {
  if (item.kind !== "file") return "reagan"; // links/text/email don't push
  const label = (routed.routedToLabel || "").toLowerCase();
  // Specific labels first (we want strong routing for the new 11-folder world)
  if (label.includes("finished")) return "finished_work";
  if (label.includes("report card") || label.includes("summary")) return "report_cards";
  if (label.includes("journal") || label.includes("notebook")) return "journal";
  if (label.includes("adult note") || label.includes("parent note")) return "adult_notes";
  if (label.includes("daily packet") || label.includes("worksheet")) return "worksheets";
  if (label.includes("printable")) return "printables";
  if (label.includes("agenda") || label.includes("schedule")) return "daily_schedule";
  if (label.includes("analytic")) return "analytics";
  // Practice for Coins must win over the broader "coin" check below.
  if (label.includes("practice")) return "practice";
  if (label.includes("coin")) return "kiwi_coins";
  if (label.includes("tutor")) return "tutor";
  if (label.includes("app") && label.includes("tool")) return "apps_tools";
  if (label.includes("bookshelf")) return "bookshelf";
  if (label.includes("adventure")) return "adventures";
  if (label.includes("checklist")) return "curriculum_checklist";
  // Curriculum docs live in the printables (was IHES) bucket
  if (label === "curriculum library") return "printables";
  // Submitted homework photos / worksheets → finished work
  if (routed.routedTo === "submission") return "finished_work";
  // Tutor-provided files
  if (routed.routedTo === "tutorSession") return "reagan_tutor";
  // Anything else parent uploaded → top-level Hub
  return "reagan";
}

/**
 * Map each DrivePushTarget to the Hub subfolder name the cron worker should
 * write into. Keep these strings in sync with the actual Drive folders or
 * the worker will silently create new top-level folders.
 */
export const DRIVE_FOLDER_NAMES: Record<DrivePushTarget, string> = {
  reagan: "",
  reagan_ihes: "Printables",
  reagan_tutor: "Tutor Handoffs",
  reagan_artwork: "Finished Work",
  reagan_assignments: "Assignments",
  finished_work: "Finished Work",
  daily_schedule: "Daily Schedule",
  worksheets: "Worksheets (Daily Packets)",
  printables: "Printables",
  report_cards: "Report Cards",
  journal: "Journal",
  analytics: "Analytics",
  adult_notes: "Adult Notes",
  kiwi_coins: "Kiwi Coins",
  tutor: "Tutor",
  apps_tools: "Apps & Tools",
  bookshelf: "Bookshelf",
  adventures: "Adventures",
  practice: "Practice for Coins",
  notebook: "Notebook",
  curriculum_checklist: "Curriculum Checklist (Weekly)",
  day_log: "Day Logs",
  recap_reply: "Recap Replies",
  topics_covered: "Topics Covered",
  agenda_pdf: "Daily Agenda PDFs",
  future_worksheets: "Future Worksheets",
};

/**
 * Canonical-parent mapping (added 2026-05-12) — every routable target above
 * resolves to one of the 9 canonical top-level Drive folders established at
 * the hub root (see APP_SETTING_DEFAULTS['drive.folder.*']). The external
 * Drive worker reads this map so it never silently creates a duplicate
 * top-level folder — every legacy `DRIVE_FOLDER_NAMES` subfolder is nested
 * under the right canonical parent.
 */
export type CanonicalParentSlug =
  | "adminAndHomeschoolRecords"
  | "adventuresAndEnrichment"
  | "assignmentsAndWork"
  | "curriculumAndStandards"
  | "dailyOperations"
  | "inboxUnsorted"
  | "printablesAndResources"
  | "progressAndReports"
  | "todo";

export const DRIVE_TARGET_TO_CANONICAL_PARENT: Record<DrivePushTarget, CanonicalParentSlug> = {
  reagan: "inboxUnsorted",                  // catch-all → Inbox (Unsorted)
  reagan_ihes: "printablesAndResources",    // legacy "Printables"
  reagan_tutor: "adminAndHomeschoolRecords",// tutor handoffs are admin records
  reagan_artwork: "assignmentsAndWork",     // finished work
  reagan_assignments: "assignmentsAndWork",
  finished_work: "assignmentsAndWork",
  daily_schedule: "dailyOperations",
  worksheets: "assignmentsAndWork",         // Worksheets to Do live under Assignments
  printables: "printablesAndResources",
  report_cards: "progressAndReports",
  journal: "adventuresAndEnrichment",       // Reagan's reading/feelings journal
  analytics: "progressAndReports",          // CSV exports
  adult_notes: "adminAndHomeschoolRecords", // Mom + Grandma + tutor notes
  kiwi_coins: "progressAndReports",         // coin redemption history
  tutor: "adminAndHomeschoolRecords",       // tutor session logs
  apps_tools: "progressAndReports",         // apps + tools usage snapshots
  bookshelf: "adventuresAndEnrichment",     // reading log
  adventures: "adventuresAndEnrichment",
  practice: "assignmentsAndWork",           // practice-for-coins worksheets
  notebook: "adminAndHomeschoolRecords",    // adult notebook entries
  curriculum_checklist: "curriculumAndStandards",
  day_log: "dailyOperations",
  recap_reply: "dailyOperations",
  topics_covered: "curriculumAndStandards",
  agenda_pdf: "dailyOperations",
  future_worksheets: "printablesAndResources",
};

/**
 * Resolve the canonical top-level Drive folder ID a routed target belongs to.
 * Reads the persisted folder id from app_settings; returns null if the worker
 * has not yet been told the id (which should never happen post-2026-05-12 since
 * APP_SETTING_DEFAULTS seeds them).
 */
export async function getCanonicalParentForRoutable(target: DrivePushTarget): Promise<{ slug: CanonicalParentSlug; folderId: string | null }> {
  const slug = DRIVE_TARGET_TO_CANONICAL_PARENT[target];
  const folderId = await getAppSetting(`drive.folder.${slug}`);
  return { slug, folderId };
}

/**
 * Resolve a CANONICAL SUBFOLDER's Drive ID once the worker has reported it
 * back via POST /api/scheduled/drive-folder-map/result. Inputs are the
 * human-readable parent name (e.g. "Daily Operations") and subfolder name
 * (e.g. "Day Logs"). Both are slugified to alphanumerics + underscores to
 * match how the worker's /result endpoint stored them.
 *
 * Returns null if the worker has not yet visited the folder map this cycle
 * (caller must fall back to enqueueing under the parent's root and let the
 * worker self-heal next tick).
 */
export async function getCanonicalSubfolderId(parentName: string, subfolderName: string): Promise<string | null> {
  const slugify = (s: string) => s.replace(/[^A-Za-z0-9]+/g, "_");
  return await getAppSetting(`drive.folderMap.${slugify(parentName)}.${slugify(subfolderName)}`);
}

export async function enqueueDrivePush(args: {
  fileKey: string;
  fileUrl: string;
  fileName: string;
  mimeType?: string | null;
  targetFolder: DrivePushTarget;
}) {
  const db = getDb();
  const r = await db.insert(drivePushQueue).values({
    fileKey: args.fileKey,
    fileUrl: args.fileUrl,
    fileName: args.fileName,
    mimeType: args.mimeType ?? null,
    targetFolder: args.targetFolder,
    status: "pending",
  } as any);
  let id = Number((r as any)?.[0]?.insertId ?? (r as any)?.insertId ?? 0);
  if (!id) {
    // mysql2 / TiDB sometimes doesn't surface insertId; look up by unique fileKey
    const [row] = (await db
      .select()
      .from(drivePushQueue)
      .where(eq(drivePushQueue.fileKey, args.fileKey))
      .orderBy(desc(drivePushQueue.id))
      .limit(1)) as any[];
    id = row?.id ?? 0;
  }
  return { id };
}

export async function listPendingDrivePushes(limit = 100): Promise<DrivePushQueueRow[]> {
  const db = getDb();
  return db
    .select()
    .from(drivePushQueue)
    .where(eq(drivePushQueue.status, "pending"))
    .orderBy(asc(drivePushQueue.createdAt))
    .limit(limit) as any;
}

export async function listRecentDrivePushes(limit = 20): Promise<DrivePushQueueRow[]> {
  const db = getDb();
  return db
    .select()
    .from(drivePushQueue)
    .orderBy(desc(drivePushQueue.createdAt))
    .limit(limit) as any;
}

export async function markDrivePushResult(args: {
  id: number;
  status: "pushed" | "skipped" | "failed";
  driveFileId?: string | null;
  errorMessage?: string | null;
}) {
  const db = getDb();
  await db
    .update(drivePushQueue)
    .set({
      status: args.status,
      driveFileId: args.driveFileId ?? null,
      errorMessage: args.errorMessage ?? null,
      pushedAt: new Date(),
    } as any)
    .where(eq(drivePushQueue.id, args.id));
}


/* =====================================================================
   PRIZE CRUD — adult-editable from Settings ▸ Rewards Manager
   ===================================================================== */
export async function createPrize(input: {
  title: string;
  emoji: string;
  description?: string | null;
  coinCost: number;
  category: "cash" | "digital" | "toy" | "experience" | "screen_time" | "treat" | "custom";
  active?: boolean;
  stock?: number | null;
  createdByUserId?: number | null;
}) {
  const db = getDb();
  const slug = `${input.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 56)}-${Date.now().toString(36).slice(-6)}`;
  await db.insert(prizes).values({
    slug,
    title: input.title.slice(0, 120),
    emoji: input.emoji.slice(0, 8) || "⭐",
    description: input.description ?? null,
    coinCost: Math.max(0, Math.floor(input.coinCost)),
    category: input.category,
    active: input.active ?? true,
    stock: input.stock ?? null,
    createdByUserId: input.createdByUserId ?? null,
  } as any);
  const [created]: any = await db.select().from(prizes).where(eq(prizes.slug, slug)).limit(1);
  return created;
}

export async function updatePrize(id: number, patch: Partial<{
  title: string;
  emoji: string;
  description: string | null;
  coinCost: number;
  category: "cash" | "digital" | "toy" | "experience" | "screen_time" | "treat" | "custom";
  active: boolean;
  stock: number | null;
}>) {
  const db = getDb();
  const updates: any = {};
  if (patch.title !== undefined) updates.title = patch.title.slice(0, 120);
  if (patch.emoji !== undefined) updates.emoji = patch.emoji.slice(0, 8) || "⭐";
  if (patch.description !== undefined) updates.description = patch.description;
  if (patch.coinCost !== undefined) updates.coinCost = Math.max(0, Math.floor(patch.coinCost));
  if (patch.category !== undefined) updates.category = patch.category;
  if (patch.active !== undefined) updates.active = patch.active;
  if (patch.stock !== undefined) updates.stock = patch.stock;
  if (Object.keys(updates).length === 0) return { ok: true, noop: true };
  await db.update(prizes).set(updates).where(eq(prizes.id, id));
  return { ok: true };
}

export async function deletePrize(id: number) {
  const db = getDb();
  await db.delete(prizes).where(eq(prizes.id, id));
  return { ok: true };
}


// -------- PowerSchool helpers --------
import {
  powerschoolImports,
  powerschoolGrades,
  powerschoolAssignments,
} from "../drizzle/schema";

export async function recordPowerschoolImport(args: {
  source: "paste" | "csv" | "scraper" | "email";
  rawBody: string;
  rawMime?: string;
  parsedCount: number;
  errorCount: number;
  notes?: string;
  importedBy?: string;
}) {
  const db = getDb();
  await db.insert(powerschoolImports).values({
    source: args.source,
    rawBody: args.rawBody.slice(0, 60000),
    rawMime: args.rawMime ?? "text/plain",
    parsedCount: args.parsedCount,
    errorCount: args.errorCount,
    notes: args.notes,
    importedBy: args.importedBy,
  });
  const rows = await db
    .select()
    .from(powerschoolImports)
    .orderBy(desc(powerschoolImports.id))
    .limit(1);
  return rows[0];
}

export async function bulkInsertPowerschoolGrades(
  importId: number,
  rows: Array<{
    term: string;
    course: string;
    teacher?: string;
    letter?: string;
    percent?: string;
    comments?: string;
    snapshotDate?: string;
  }>,
) {
  if (rows.length === 0) return 0;
  const db = getDb();
  await db
    .insert(powerschoolGrades)
    .values(rows.map((r) => ({ ...r, importId })));
  return rows.length;
}

export async function bulkInsertPowerschoolAssignments(
  importId: number,
  rows: Array<{
    course: string;
    category?: string;
    title: string;
    dueDate?: string;
    assignedDate?: string;
    score?: string;
    pointsPossible?: string;
    status?: string;
    teacherComment?: string;
  }>,
) {
  if (rows.length === 0) return 0;
  const db = getDb();
  await db
    .insert(powerschoolAssignments)
    .values(rows.map((r) => ({ ...r, importId })));
  return rows.length;
}

export async function listPowerschoolGrades(limit = 200) {
  const db = getDb();
  return db
    .select()
    .from(powerschoolGrades)
    .orderBy(desc(powerschoolGrades.id))
    .limit(limit);
}

export async function listPowerschoolAssignments(limit = 200) {
  const db = getDb();
  return db
    .select()
    .from(powerschoolAssignments)
    .orderBy(desc(powerschoolAssignments.id))
    .limit(limit);
}

export async function listPowerschoolImports(limit = 20) {
  const db = getDb();
  return db
    .select()
    .from(powerschoolImports)
    .orderBy(desc(powerschoolImports.id))
    .limit(limit);
}


// -------- Classroom-agendas helpers (for daily Classroom/teacher-Gmail sync) --------
import { classroomAgendas } from "../drizzle/schema";

export async function listRecentClassroomAgendas(limit = 30) {
  return getDb()
    .select()
    .from(classroomAgendas)
    .orderBy(desc(classroomAgendas.agendaDate), desc(classroomAgendas.id))
    .limit(limit);
}

export async function insertClassroomAgenda(row: {
  agendaDate: string;
  teacher?: string | null;
  course?: string | null;
  subjectSlug?: string | null;
  school?: string | null;
  term?: string | null;
  source: "classroom" | "drive" | "gmail" | "image" | "manual";
  sourceUrl?: string | null;
  imageKey?: string | null;
  rawText?: string | null;
  topics?: string[] | null;
  assignments?: Array<{ title: string; dueAt?: string; notes?: string }> | null;
  standalonePdfKey?: string | null;
}) {
  const db = getDb();
  const [res]: any = await db.insert(classroomAgendas).values(row as any);
  return { id: (res?.insertId as number) ?? 0 };
}

export async function findClassroomAgenda(
  agendaDate: string,
  teacher: string | null,
  course: string | null,
) {
  const db = getDb();
  const where = and(
    eq(classroomAgendas.agendaDate, agendaDate),
    teacher ? eq(classroomAgendas.teacher, teacher) : isNull(classroomAgendas.teacher),
    course ? eq(classroomAgendas.course, course) : isNull(classroomAgendas.course),
  );
  const rows = await db.select().from(classroomAgendas).where(where).limit(1);
  return rows[0] ?? null;
}

/**
 * Returns which agendas we still need to hydrate (for the daily scheduled task).
 * Currently: the last 7 dates where we have fewer than 2 agendas per day.
 */
export async function listAgendaHydrationGaps(daysBack = 7) {
  const today = new Date();
  const cutoff = new Date(today.getTime() - daysBack * 86400000);
  const iso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const db = getDb();
  const rows: any = await db
    .select()
    .from(classroomAgendas)
    .where(gte(classroomAgendas.agendaDate, iso(cutoff)));
  const byDate: Record<string, number> = {};
  for (const r of rows) byDate[r.agendaDate] = (byDate[r.agendaDate] ?? 0) + 1;
  const gaps: Array<{ date: string; have: number }> = [];
  for (let i = 0; i <= daysBack; i++) {
    const d = new Date(today.getTime() - i * 86400000);
    const dateStr = iso(d);
    const have = byDate[dateStr] ?? 0;
    if (have < 2) gaps.push({ date: dateStr, have });
  }
  return gaps;
}


// -------- IEP refresh helpers --------
export async function recordIepRefresh(args: {
  source: "drive" | "manual" | "vision";
  rawText?: string | null;
  extractedGoals?: Array<{
    area: string;
    goalText: string;
    presentLevel?: string;
    currentPercent?: number;
    subjectSlug?: string;
  }>;
  notes?: string;
}) {
  // Insert each extracted goal that doesn't already exist (by area + first 80 chars of goalText).
  if (!args.extractedGoals || args.extractedGoals.length === 0) {
    return { inserted: 0, updated: 0 };
  }
  const db = getDb();
  const existing: any = await db.select().from(iepGoals);
  let inserted = 0, updated = 0;
  for (const g of args.extractedGoals) {
    const key = (g.goalText || "").trim().slice(0, 80).toLowerCase();
    const match = existing.find(
      (e: any) => e.area === g.area && (e.goalText || "").trim().slice(0, 80).toLowerCase() === key,
    );
    if (match) {
      if (typeof g.currentPercent === "number" && g.currentPercent !== match.currentPercent) {
        await db
          .update(iepGoals)
          .set({ currentPercent: g.currentPercent, presentLevel: g.presentLevel ?? match.presentLevel })
          .where(eq(iepGoals.id, match.id));
        updated++;
      }
    } else {
      await db.insert(iepGoals).values({
        area: g.area,
        goalText: g.goalText,
        presentLevel: g.presentLevel ?? null,
        currentPercent: g.currentPercent ?? null,
        subjectSlug: g.subjectSlug ?? null,
        status: "in_progress",
      } as any);
      inserted++;
    }
  }
  return { inserted, updated };
}


/**
 * resetTutorRoster — replace the active tutor list with the canonical three:
 *   Madison, Sophie, Keith. (Push 79, 2026-05-13)
 *
 * Deactivates (active=false) every other tutor so past session history stays
 * referenced but they stop showing up in Tutor Handoff / pickers. Inserts new
 * rows only for names that don't already exist (or reactivates matching ones).
 * Email is seeded to the placeholder *@tbd.local addresses recognized by
 * permissions.roleForEmail, so the auth chain treats them as Editor-tier
 * the moment a real Google sign-in arrives with the matching identity.
 */
export async function resetTutorRoster() {
  const dbi = getDb();
  await dbi.update(tutors).set({ active: false });
  const want = [
    { name: "Madison", role: "tutor", email: "madison@tbd.local" },
    { name: "Sophie",  role: "tutor", email: "sophie@tbd.local"  },
    { name: "Keith",   role: "tutor", email: "keith@tbd.local"   },
  ];
  for (const w of want) {
    const existing = await dbi.select().from(tutors).where(eq(tutors.name, w.name)).limit(1);
    if (existing.length > 0) {
      await dbi.update(tutors)
        .set({ active: true, role: w.role, email: w.email })
        .where(eq(tutors.id, existing[0].id));
    } else {
      await dbi.insert(tutors).values({
        name: w.name,
        role: w.role,
        email: w.email,
        active: true,
      } as any);
    }
  }
  const final = await dbi.select().from(tutors).where(eq(tutors.active, true));
  return { count: final.length, roster: final.map((t) => t.name) };
}


/* ============================== CURRICULUM ================================ */
/* Raw-SQL helpers (curriculumTopics isn't in the drizzle `schema` import    */
/* yet — declaring via getDb().execute keeps the footprint tiny).            */

import { CURRICULUM_SEED } from "./curriculumSeed";

/** Seed the curriculumTopics table if it's empty. Idempotent. */
export async function ensureCurriculumSeeded() {
  const db = getDb();
  const [countRow]: any = await db.execute(sql`SELECT COUNT(*) AS c FROM curriculumTopics`);
  const c = Number((countRow?.[0] ?? countRow)?.c ?? 0);
  if (c > 0) return { seeded: false, count: c };

  // Pass 1: insert every row without parent so we can look up IDs by code.
  for (let i = 0; i < CURRICULUM_SEED.length; i++) {
    const r = CURRICULUM_SEED[i];
    await db.execute(sql`
      INSERT INTO curriculumTopics (subject, code, title, standard_ref, ord, quarter)
      VALUES (${r.subject}, ${r.code}, ${r.title}, ${r.standardRef ?? null}, ${i}, ${r.quarter ?? null})
    `);
  }
  // Pass 2: resolve parentCode → parent_id.
  for (const r of CURRICULUM_SEED) {
    if (!r.parentCode) continue;
    await db.execute(sql`
      UPDATE curriculumTopics c
      JOIN curriculumTopics p ON p.code = ${r.parentCode}
      SET c.parent_id = p.id
      WHERE c.code = ${r.code}
    `);
  }
  const [after]: any = await db.execute(sql`SELECT COUNT(*) AS c FROM curriculumTopics`);
  return { seeded: true, count: Number((after?.[0] ?? after)?.c ?? 0) };
}

export async function listCurriculumTopics(subject?: string) {
  const db = getDb();
  if (subject) {
    return (await db.execute(sql`
      SELECT id, subject, code, title, standard_ref AS standardRef, parent_id AS parentId,
             ord, status, completed_at AS completedAt, quarter, notes,
             khan_url AS khanUrl, ixl_url AS ixlUrl
      FROM curriculumTopics
      WHERE subject = ${subject}
      ORDER BY ord ASC
    `) as any)[0] ?? [];
  }
  return (await db.execute(sql`
    SELECT id, subject, code, title, standard_ref AS standardRef, parent_id AS parentId,
           ord, status, completed_at AS completedAt, quarter, notes,
           khan_url AS khanUrl, ixl_url AS ixlUrl
    FROM curriculumTopics
    ORDER BY subject ASC, ord ASC
  `) as any)[0] ?? [];
}

/**
 * Push 134 (2026-05-13) — Lower-cased title labels of every curriculum topic.
 * Used by the off-plan auto-add proposer so the gating helper can reject
 * already-known topics without each caller re-implementing the lookup.
 */
export async function listCurriculumTopicLabels(): Promise<string[]> {
  const db = getDb();
  const rows: any = (await db.execute(sql`SELECT title FROM curriculumTopics`) as any)[0] ?? [];
  return rows
    .map((r: any) => String(r.title ?? "").trim().toLowerCase())
    .filter((s: string) => s.length > 0);
}

export async function toggleCurriculumTopic(id: number, nextStatus: "notStarted" | "inProgress" | "done") {
  const db = getDb();
  const completedAt = nextStatus === "done" ? new Date() : null;
  await db.execute(sql`
    UPDATE curriculumTopics SET status = ${nextStatus}, completed_at = ${completedAt}
    WHERE id = ${id}
  `);
  return { id, status: nextStatus };
}

export async function setCurriculumNote(id: number, notes: string) {
  const db = getDb();
  await db.execute(sql`UPDATE curriculumTopics SET notes = ${notes} WHERE id = ${id}`);
  return { id, notes };
}

export async function curriculumProgress() {
  const db = getDb();
  const rows: any = (await db.execute(sql`
    SELECT subject,
           SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) AS done,
           COUNT(*) AS total
    FROM curriculumTopics
    GROUP BY subject
  `))[0];
  return (rows as any[]).map((r) => ({
    subject: String(r.subject),
    done: Number(r.done ?? 0),
    total: Number(r.total ?? 0),
    pct: r.total ? Math.round((Number(r.done) / Number(r.total)) * 100) : 0,
  }));
}

/* -------------------------------------------------------------------------- *
 * bumpFromSubmission                                                          *
 *                                                                            *
 * Called from submissions.create. Given the submitted block's subjectSlug    *
 * and title, we:                                                              *
 *   (a) flip the best-matching curriculumTopics row from notStarted ->        *
 *       inProgress (or leave 'done' rows alone). Best match = first row in   *
 *       the slug's subject whose code/title appears in the block title.       *
 *   (b) record one practice round on the lowest-level active skill in that  *
 *       subject, with selfRating derived from kid difficulty:                *
 *         really_hard -> 1, tricky -> 2, just_right -> 4, easy -> 5.         *
 *                                                                            *
 * Failures are swallowed: this should never break a turn-in.                *
 * -------------------------------------------------------------------------- */
export async function bumpFromSubmission(opts: {
  subjectSlug?: string | null;
  blockTitle?: string | null;
  kidDifficulty?: "easy" | "just_right" | "tricky" | "really_hard" | null;
}): Promise<{ topicId: number | null; skillLadderId: number | null; leveledUp: boolean }> {
  const slug = (opts.subjectSlug || "").toLowerCase();
  const title = (opts.blockTitle || "").toLowerCase();

  // Map kid-friendly subject slug -> the curriculumTopics.subject TitleCase.
  const SUBJ_MAP: Record<string, string> = {
    math: "Math", ela: "ELA", reading: "ELA", writing: "ELA",
    science: "Science", ss: "Social", social_studies: "Social",
    art: "Specials", music: "Specials", pe: "Specials",
  };
  const subjectName = SUBJ_MAP[slug];

  let topicId: number | null = null;
  if (subjectName && title) {
    try {
      const db = getDb();
      const [rowsRaw]: any = await db.execute(sql`
        SELECT id, code, title, status FROM curriculumTopics
        WHERE subject = ${subjectName} AND status != 'done'
        ORDER BY ord ASC
      `);
      const rows: any[] = rowsRaw as any[];
      const hit = rows.find((r) => {
        const c = String(r.code || "").toLowerCase();
        const t = String(r.title || "").toLowerCase();
        if (c && title.includes(c)) return true;
        if (t && t.length > 6 && title.includes(t.slice(0, Math.min(t.length, 24)))) return true;
        return false;
      });
      if (hit) {
        await db.execute(sql`
          UPDATE curriculumTopics SET status = 'inProgress' WHERE id = ${hit.id} AND status = 'notStarted'
        `);
        topicId = hit.id;
      }
    } catch { /* best-effort */ }
  }

  // (b) practice on the active skill ladder for this subject
  let skillLadderId: number | null = null;
  let leveledUp = false;
  if (slug) {
    try {
      const all: any[] = await listSkillsWithProgress(slug);
      // pick lowest-level active skill, mirroring nextSkillForToday
      const notMastered = all.filter((s) => (s?.progress?.level ?? 0) < 4);
      const target = notMastered[0] || all[0];
      if (target) {
        skillLadderId = target.id;
        const ratingMap: Record<string, 1 | 2 | 3 | 4 | 5> = {
          really_hard: 1, tricky: 2, just_right: 4, easy: 5,
        };
        const selfRating = opts.kidDifficulty ? ratingMap[opts.kidDifficulty] ?? 3 : 3;
        const r = await recordSkillPractice({
          skillLadderId: target.id,
          mode: "practice",
          selfRating,
          parentNote: "From turn-in",
        });
        leveledUp = !!r.leveledUp;
      }
    } catch { /* best-effort */ }
  }

  return { topicId, skillLadderId, leveledUp };
}

/**
 * Auto-tick topics whose titles or codes substring-match assignment titles
 * already in PowerSchool or IH assignments. Uses an extremely permissive
 * heuristic — easy for Mom to un-tick manually — but hits the common "Topic 7
 * quiz → Math 7 family" kinds of matches that make the tree feel lived-in.
 * Also marks anything flagged Q1 as done (since Q1 is complete on IH calendar).
 */
export async function autoCompleteFromHistory(): Promise<{ checked: number; byQuarter: number }> {
  const db = getDb();

  // 1. Quarter-wide auto-complete: Q1 is done by definition (we're past it),
  //    and any Q2 topic whose text matches an in-DB assignment gets ticked too.
  const [q1]: any = await db.execute(sql`
    UPDATE curriculumTopics
    SET status = 'done', completed_at = ${new Date()}
    WHERE quarter = 'Q1' AND status != 'done'
  `);
  const q1Count = Number((q1 as any)?.affectedRows ?? 0);

  // 2. Title-match auto-complete — pull titles from whichever assignment tables
  //    actually exist in this DB.
  let titles: string[] = [];
  try {
    const [psRows]: any = await db.execute(sql`
      SELECT DISTINCT title FROM powerschool_assignments WHERE status IN ('collected','scored')
    `);
    titles.push(...(psRows as any[]).map((r) => String(r.title || "")));
  } catch { /* table may not exist */ }
  try {
    const [ihRows]: any = await db.execute(sql`
      SELECT DISTINCT title FROM ihAssignments WHERE status = 'done' OR status = 'completed'
    `);
    titles.push(...(ihRows as any[]).map((r) => String(r.title || "")));
  } catch { /* table may not exist */ }

  if (titles.length === 0) {
    return { checked: q1Count, byQuarter: q1Count };
  }

  const [topicRows]: any = await db.execute(sql`
    SELECT id, code, title FROM curriculumTopics WHERE status != 'done'
  `);
  let hits = 0;
  for (const t of (topicRows as any[])) {
    const tc = String(t.code || "").toLowerCase();
    const tt = String(t.title || "").toLowerCase();
    const matched = titles.some((a) => {
      const al = String(a || "").toLowerCase();
      return al.includes(tc) || (tt.length > 8 && al.includes(tt.slice(0, Math.min(tt.length, 30))));
    });
    if (matched) {
      await db.execute(sql`
        UPDATE curriculumTopics SET status = 'done', completed_at = ${new Date()} WHERE id = ${t.id}
      `);
      hits++;
    }
  }
  return { checked: q1Count + hits, byQuarter: q1Count };
}

/**
 * One-shot backfill: marks Q1+Q2+Q3 topics as done since Reagan finished
 * everything up to the final quarter at Indian Hill before the home
 * transition. Q4 is left for adults to mark off this spring.
 *
 * Idempotent. Only flips notStarted -> done; preserves any existing
 * inProgress / done values so manual edits aren't clobbered.
 */
export async function backfillCurriculumProgress(): Promise<{ q1: number; q2: number; q3: number; total: number }> {
  const db = getDb();
  const QUARTER_DATES: Record<"Q1" | "Q2" | "Q3", Date> = {
    Q1: new Date("2025-10-15T00:00:00Z"),
    Q2: new Date("2025-12-15T00:00:00Z"),
    Q3: new Date("2026-03-15T00:00:00Z"),
  };
  const counts: Record<"Q1" | "Q2" | "Q3", number> = { Q1: 0, Q2: 0, Q3: 0 };
  for (const q of ["Q1", "Q2", "Q3"] as const) {
    const date = QUARTER_DATES[q];
    const r: any = await db.execute(sql`
      UPDATE curriculumTopics
         SET status = 'done', completed_at = ${date}
       WHERE quarter = ${q} AND status = 'notStarted'
    `);
    counts[q] = r?.affectedRows ?? r?.[0]?.affectedRows ?? 0;
  }
  const total = counts.Q1 + counts.Q2 + counts.Q3;
  return { q1: counts.Q1, q2: counts.Q2, q3: counts.Q3, total };
}


// ------------------------------------------------------------------
// Today coverage + resume pointer (Apr 29 late build)
// ------------------------------------------------------------------

/**
 * Returns per-subject % complete for today's plan.
 */
export async function todayCoverage(): Promise<Array<{ subjectSlug: string; total: number; done: number; pct: number }>> {
  const db = getDb();
  const today = new Date().toISOString().slice(0, 10);
  const plans = await db.select({ id: dailyPlans.id })
    .from(dailyPlans)
    .where(sql`DATE(${dailyPlans.date}) = ${today}`)
    .orderBy(desc(dailyPlans.id))
    .limit(1);
  const planId = plans[0]?.id;
  if (!planId) return [];
  const subjectList = await db.select({ id: subjects.id, slug: subjects.slug }).from(subjects);
  const subjectBySlugId = new Map<number, string>();
  for (const s of subjectList) subjectBySlugId.set(s.id as number, s.slug as string);
  const rows = await db.select({ subjectId: scheduleBlocks.subjectId, status: scheduleBlocks.status })
    .from(scheduleBlocks)
    .where(eq(scheduleBlocks.planId, planId));
  const map = new Map<string, { total: number; done: number }>();
  for (const r of rows) {
    const key = subjectBySlugId.get(r.subjectId as number) || "other";
    const cur = map.get(key) || { total: 0, done: 0 };
    cur.total += 1;
    if (r.status === "complete") cur.done += 1;
    map.set(key, cur);
  }
  return Array.from(map.entries()).map(([subjectSlug, v]) => ({
    subjectSlug,
    total: v.total,
    done: v.done,
    pct: v.total > 0 ? Math.round((v.done / v.total) * 100) : 0,
  }));
}

/**
 * Per-subject planned coverage for an arbitrary date (extracted for testability).
 */
export async function coverageForDate(dateISO: string): Promise<Array<{ subjectSlug: string; total: number; done: number; pct: number }>> {
  const db = getDb();
  const plans = await db.select({ id: dailyPlans.id })
    .from(dailyPlans)
    .where(sql`DATE(${dailyPlans.date}) = ${dateISO}`)
    .orderBy(desc(dailyPlans.id))
    .limit(1);
  const planId = plans[0]?.id;
  if (!planId) return [];
  const subjectList = await db.select({ id: subjects.id, slug: subjects.slug }).from(subjects);
  const subjectBySlugId = new Map<number, string>();
  for (const s of subjectList) subjectBySlugId.set(s.id as number, s.slug as string);
  const rows = await db.select({ subjectId: scheduleBlocks.subjectId, status: scheduleBlocks.status })
    .from(scheduleBlocks)
    .where(eq(scheduleBlocks.planId, planId));
  const map = new Map<string, { total: number; done: number }>();
  for (const r of rows) {
    const key = subjectBySlugId.get(r.subjectId as number) || "other";
    const cur = map.get(key) || { total: 0, done: 0 };
    cur.total += 1;
    if (r.status === "complete") cur.done += 1;
    map.set(key, cur);
  }
  return Array.from(map.entries()).map(([subjectSlug, v]) => ({
    subjectSlug,
    total: v.total,
    done: v.done,
    pct: v.total > 0 ? Math.round((v.done / v.total) * 100) : 0,
  }));
}

/**
 * Slice 4.5 — per-subject coverage that ALSO accounts for `actualAgendaEntries`.
 * Effective % = max(plannedDone/plannedTotal, distinctActualSubjectCount/plannedTotal).
 * If plannedTotal is 0 but actuals exist, returns those as off-plan rows with planned=0.
 * What was actually done is what counts.
 */
export async function todayCoverageWithActuals(dateISO?: string): Promise<
  Array<{
    subjectSlug: string;
    plannedTotal: number;
    plannedDone: number;
    plannedPct: number;
    actualEntries: number;
    actualMinutes: number;
    effectivePct: number;
    offPlan: boolean;
  }>
> {
  const today = dateISO ?? new Date().toISOString().slice(0, 10);
  const planned = dateISO ? await coverageForDate(dateISO) : await todayCoverage();
  const actuals = await listActualForDate(today);
  const actualBySubject = new Map<string, { entries: number; minutes: number }>();
  for (const a of actuals) {
    const slug = a.subjectSlug || "other";
    const cur = actualBySubject.get(slug) || { entries: 0, minutes: 0 };
    cur.entries += 1;
    cur.minutes += a.minutesSpent || 0;
    actualBySubject.set(slug, cur);
  }
  const plannedSlugs = new Set(planned.map((p) => p.subjectSlug));
  const merged = planned.map((p) => {
    const a = actualBySubject.get(p.subjectSlug) || { entries: 0, minutes: 0 };
    // Effective coverage: planned-done OR actual entries can substitute (1 actual per planned slot).
    // Cap effectivePct at 100.
    const effectiveCovered = Math.min(p.total, p.done + a.entries);
    const effectivePct = p.total > 0 ? Math.round((effectiveCovered / p.total) * 100) : 0;
    return {
      subjectSlug: p.subjectSlug,
      plannedTotal: p.total,
      plannedDone: p.done,
      plannedPct: p.pct,
      actualEntries: a.entries,
      actualMinutes: a.minutes,
      effectivePct,
      offPlan: false,
    };
  });
  // Off-plan subjects (have actuals, no planned blocks).
  for (const [slug, a] of Array.from(actualBySubject.entries())) {
    if (plannedSlugs.has(slug)) continue;
    merged.push({
      subjectSlug: slug,
      plannedTotal: 0,
      plannedDone: 0,
      plannedPct: 0,
      actualEntries: a.entries,
      actualMinutes: a.minutes,
      effectivePct: a.entries > 0 ? 100 : 0, // off-plan but covered
      offPlan: true,
    });
  }
  return merged;
}

/**
 * Next incomplete schedule block for today (or null).
 */
export async function resumePointer(): Promise<{ id: number; title: string; subjectSlug: string; description: string | null } | null> {
  const db = getDb();
  const today = new Date().toISOString().slice(0, 10);
  const plans = await db.select({ id: dailyPlans.id })
    .from(dailyPlans)
    .where(sql`DATE(${dailyPlans.date}) = ${today}`)
    .orderBy(desc(dailyPlans.id))
    .limit(1);
  const planId = plans[0]?.id;
  if (!planId) return null;
  const rows = await db.select({
    id: scheduleBlocks.id,
    title: scheduleBlocks.title,
    subjectId: scheduleBlocks.subjectId,
    description: scheduleBlocks.description,
  })
    .from(scheduleBlocks)
    .where(and(eq(scheduleBlocks.planId, planId), sql`(${scheduleBlocks.status} IS NULL OR ${scheduleBlocks.status} NOT IN ('complete','skipped'))`))
    .orderBy(asc(scheduleBlocks.sortOrder))
    .limit(1);
  const r = rows[0];
  if (!r) return null;
  let slug = "other";
  if (r.subjectId != null) {
    const s = await db.select({ slug: subjects.slug }).from(subjects).where(eq(subjects.id, r.subjectId as number)).limit(1);
    if (s[0]) slug = s[0].slug as string;
  }
  return { id: r.id, title: r.title ?? "", subjectSlug: slug, description: r.description ?? null };
}

/**
 * Last N days of mood logs, most recent first.
 */
export async function recentMoodStrip(days: number = 3): Promise<Array<{ date: string; zone: string | null }>> {
  const db = getDb();
  const out: Array<{ date: string; zone: string | null }> = [];
  for (let i = 0; i < days; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const day = d.toISOString().slice(0, 10);
    const plans = await db.select({ id: dailyPlans.id })
      .from(dailyPlans)
      .where(sql`DATE(${dailyPlans.date}) = ${day}`)
      .orderBy(desc(dailyPlans.id))
      .limit(1);
    const planId = plans[0]?.id;
    if (!planId) { out.push({ date: day, zone: null }); continue; }
    const moods = await db.select({ zone: moodLogs.zone })
      .from(moodLogs)
      .where(eq(moodLogs.planId, planId))
      .orderBy(desc(moodLogs.loggedAt))
      .limit(1);
    out.push({ date: day, zone: moods[0]?.zone ?? null });
  }
  return out;
}


// ----- Generic appSettings key/value helpers (Mom-editable flags) -----
import { appSettings } from "../drizzle/schema";

/** Default values that should exist in app_settings on first read. */
const APP_SETTING_DEFAULTS: Record<string, string> = {
  // Reagan's Indian Hill student Google account — used to prefill
  // /u/<email>/ on Google-domain links so Chrome doesn't re-prompt
  // for an account every time.
  "student.googleEmail": "reaganhiggs910@gmail.com",
  "parent.googleEmail": "spear.cpt@gmail.com",
  "grandma.googleEmail": "marcy.spear@gmail.com",
  // Push 66 (2026-05-13) — Calendar foundation: the Google account the
  // ICS feed is published under. Default mirrors student.googleEmail.
  "calendar.ownerEmail": "reaganhiggs910@gmail.com",
  // v2.32 (2026-05-18) — Calendar identity: the canonical Google Calendar
  // ID for "Reagan's Homeschool" (owned by spear.cpt@gmail.com). Mom asked
  // for this to surface in Settings so she can confirm the same calendar
  // is the one the dashboard reads/writes events into. Switching this is
  // a Mom-only operation — changing it rewires the entire schedule sync.
  "calendar.id": "o81tqeb4425ej2k9il7lhmooh4@group.calendar.google.com",
  // The Google account that OWNS the calendar (vs. just subscribing to
  // its ICS feed). Mom (spear.cpt@gmail.com) created the calendar; the
  // student account (reaganhiggs910@gmail.com) is a viewer. The two-row
  // identity below makes that distinction visible.
  "calendar.id.ownerEmail": "spear.cpt@gmail.com",
  "classroom.studentDomain": "gmail.com",
  // Drive hub root (under spear.cpt@gmail.com) — established 2026-05-12.
  // The 9 canonical top-level folders below already exist as children of
  // this root and must NEVER be recreated. Worker code reads these ids at
  // runtime so we never silently create duplicate top-level folders.
  "drive.rootFolderId": "1r3bJacPLJN7VHI8y72rcx1-GRxspqo1r",
  "drive.rootFolderOwner": "spear.cpt@gmail.com",
  // v2.54 (2026-05-18) Drive Hub unification re-pointed several of these to
  // their populated counterparts. The live DB row is the source of truth
  // (appSettings overrides these defaults); these defaults are updated to
  // match the post-v2.54 canonical IDs so a fresh seed creates the correct
  // mappings instead of duplicating empty folders.
  "drive.folder.adminAndHomeschoolRecords": "1aLViM1-T0_ob0CFNxJN9hnzMauROySjF",
  "drive.folder.adventuresAndEnrichment": "137Knn9KbGKPcTsmOhHhM930HTxEGpjWB",
  "drive.folder.assignmentsAndWork": "1--Z75dZRcTTrEVlRGtIVfP5b1OMi8hCT",
  "drive.folder.curriculumAndStandards": "1ighaciRpTk8oloh55dEhgx0YZmomsZWJ",
  "drive.folder.dailyOperations": "1wyFk4rTPT-bZsadEVwODmqnABhevn6yb",
  "drive.folder.inboxUnsorted": "1PQPK34gnnlZrNojxFLJddCnDSpUQ5kR1",
  "drive.folder.printablesAndResources": "1UxqumEtHKucybapWNaNttaDGNg_0QQCH",
  "drive.folder.progressAndReports": "1YYRTEko_yYCg0V3S-tx-wyT6wQ2F2mpj",
  "drive.folder.todo": "15XPBzEZZD78Veq3mvk90yFFKP_vGMXHJ",
};

async function _seedAppSettingDefaultIfMissing(key: string): Promise<string | null> {
  const fallback = APP_SETTING_DEFAULTS[key];
  if (fallback === undefined) return null;
  try {
    const d = getDb();
    await d.insert(appSettings).values({ key, value: fallback } as any);
    return fallback;
  } catch {
    return fallback;
  }
}

export async function getAppSetting(key: string): Promise<string | null> {
  const d = getDb();
  const rows: any[] = await d.select().from(appSettings).where(eq(appSettings.key as any, key));
  if (rows[0]) return rows[0].value ?? null;
  // Lazy-seed known defaults so first-time reads return the canonical value.
  return _seedAppSettingDefaultIfMissing(key);
}

export async function setAppSetting(key: string, value: string | null): Promise<void> {
  const d = getDb();
  const existing: any[] = await d.select().from(appSettings).where(eq(appSettings.key as any, key));
  if (existing.length === 0) {
    await d.insert(appSettings).values({ key, value: value ?? null } as any);
  } else {
    await d.update(appSettings).set({ value: value ?? null } as any).where(eq(appSettings.key as any, key));
  }
}

export async function listAppSettings(prefix?: string): Promise<Array<{ key: string; value: string | null }>> {
  const d = getDb();
  const rows: any[] = await d.select({ key: appSettings.key, value: appSettings.value }).from(appSettings);
  if (!prefix) return rows as any;
  return (rows as any[]).filter((r) => r.key.startsWith(prefix));
}


// ----- GOOGLE CLASSROOM (REFERENCE-ONLY + LIFECYCLE) -----
import { classroomAssignments, classroomCourses, classroomSubmissions } from "../drizzle/schema";

export type ClassroomSyncInput = {
  externalId: string;
  courseId: string;
  courseName?: string | null;
  title: string;
  description?: string | null;
  workType?: string | null;
  state?: string | null;
  link?: string | null;
  /** ISO date or epoch ms; null/undefined = no due date */
  dueAt?: string | number | null;
};

/** Idempotent upsert by externalId. Returns count of rows touched. */
export async function upsertClassroomAssignments(items: ClassroomSyncInput[]): Promise<number> {
  if (!Array.isArray(items) || items.length === 0) return 0;
  const d = getDb();
  let touched = 0;
  for (const it of items) {
    if (!it?.externalId || !it?.courseId || !it?.title) continue;
    const dueAt =
      it.dueAt == null
        ? null
        : typeof it.dueAt === "number"
          ? new Date(it.dueAt)
          : new Date(it.dueAt);
    const row = {
      externalId: it.externalId,
      courseId: it.courseId,
      courseName: it.courseName ?? null,
      title: String(it.title).slice(0, 512),
      description: it.description ?? null,
      workType: it.workType ?? null,
      state: it.state ?? null,
      link: it.link ?? null,
      dueAt,
      syncedAt: new Date(),
    } as any;
    const existing: any[] = await d
      .select()
      .from(classroomAssignments)
      .where(eq(classroomAssignments.externalId as any, it.externalId));
    if (existing.length === 0) {
      await d.insert(classroomAssignments).values(row);
    } else {
      await d
        .update(classroomAssignments)
        .set(row)
        .where(eq(classroomAssignments.externalId as any, it.externalId));
    }
    touched++;
  }
  return touched;
}

/** Reference-only listing for the adult dashboard panel. Newest first. */
export async function listClassroomAssignments(limit = 50) {
  const d = getDb();
  const rows = await d
    .select()
    .from(classroomAssignments)
    .orderBy(desc(classroomAssignments.dueAt as any))
    .limit(limit);
  return rows;
}

/* ----- Classroom courses -----------------------------------------------
 * Mirror of Google Classroom courses. Empty until OAuth scope is granted
 * and a sync runs. listClassroomCourses() powers the /classes page.
 */
export async function listClassroomCourses() {
  const d = getDb();
  return await d
    .select()
    .from(classroomCourses)
    .orderBy(asc(classroomCourses.name as any));
}

/* ----- Classroom assignments by lifecycle -----------------------------
 * Filtered list. lifecycleStatus is one of to_do | in_progress | turned_in | graded.
 * Pass null/undefined to get every assignment (pending sync).
 */
export async function listClassroomAssignmentsByLifecycle(
  lifecycleStatus: "to_do" | "in_progress" | "turned_in" | "graded" | null | undefined,
  opts: { subjectId?: number | null; limit?: number } = {}
) {
  const d = getDb();
  const limit = opts.limit ?? 200;
  const where: any[] = [];
  if (lifecycleStatus) where.push(eq(classroomAssignments.lifecycleStatus as any, lifecycleStatus));
  if (typeof opts.subjectId === "number") where.push(eq(classroomAssignments.subjectId as any, opts.subjectId));
  let q: any = d.select().from(classroomAssignments);
  if (where.length === 1) q = q.where(where[0]);
  else if (where.length > 1) q = q.where(and(...where));
  return await q
    .orderBy(asc(classroomAssignments.dueAt as any))
    .limit(limit);
}

/**
 * "What does Reagan need to act on right now?" feed for the Today page.
 *
 * Rules:
 *  - Only lifecycle in (to_do, in_progress) — turned_in/graded already moved on.
 *  - Either no due date (open-ended), or due within `windowDays` (default 7) of `now`.
 *  - Sorted by due ascending, then most-recently-updated first as tiebreak.
 *  - Capped at `limit` (default 12) so the Today card never blows up.
 *
 * Pre-OAuth this returns []. That's the whole point of being safe to drop
 * onto the kid-facing Today page today.
 */
/* ----- Adult-only: recently-graded Classroom assignments -----------
 * The kid never sees grades; Mom + Grandma do. Returns the most
 * recently-graded items (lifecycle='graded') ordered by gradedAt desc,
 * then id desc as a stable tiebreaker. Pre-OAuth and pre-applyGradeReturn
 * the table has no graded rows, so the result is [] and the adult
 * widget can hide cleanly.
 */
export async function listClassroomAssignmentsRecentlyGraded(
  opts: { limit?: number } = {}
) {
  const d = getDb();
  const limit = Math.max(1, Math.min(100, opts.limit ?? 20));
  const rows: any[] = await d
    .select()
    .from(classroomAssignments)
    .where(sql`${classroomAssignments.lifecycleStatus} = 'graded'`)
    .orderBy(
      sql`COALESCE(${classroomAssignments.gradedAt}, ${classroomAssignments.updatedAt}) DESC`,
      sql`${classroomAssignments.id} DESC`,
    )
    .limit(limit);
  return rows;
}

export async function listClassroomAssignmentsActiveForToday(
  opts: { now?: Date; windowDays?: number; limit?: number } = {}
) {
  const d = getDb();
  const now = opts.now ?? new Date();
  const windowDays = Math.max(0, opts.windowDays ?? 7);
  const horizon = new Date(now.getTime() + windowDays * 24 * 60 * 60 * 1000);
  const limit = opts.limit ?? 12;
  // due IS NULL OR (due >= now AND due <= horizon)
  const rows: any[] = await d
    .select()
    .from(classroomAssignments)
    .where(
      and(
        sql`${classroomAssignments.lifecycleStatus} IN ('to_do','in_progress')`,
        sql`(${classroomAssignments.dueAt} IS NULL OR (${classroomAssignments.dueAt} >= ${now} AND ${classroomAssignments.dueAt} <= ${horizon}))`,
      ) as any,
    )
    .orderBy(asc(classroomAssignments.dueAt as any))
    .limit(limit);
  return rows;
}

/* ----- Update lifecycle status with audit log ------------------------
 * Atomic-ish: we set the new status (and timestamp) on classroomAssignments,
 * then write an audit row to classroomSubmissions.
 *
 * Returns the updated assignment + the new audit row.
 */
export async function updateClassroomAssignmentStatus(input: {
  assignmentId: number;
  toStatus: "to_do" | "in_progress" | "turned_in" | "graded";
  changedBy?: string | null;
  note?: string | null;
  driveFileId?: string | null;
  grade?: string | null;
  gradeNumeric?: string | null; // decimal as string per drizzle/mysql convention
}) {
  const d = getDb();
  const existing: any[] = await d
    .select()
    .from(classroomAssignments)
    .where(eq(classroomAssignments.id as any, input.assignmentId));
  if (existing.length === 0) {
    throw new Error(`classroomAssignment id=${input.assignmentId} not found`);
  }
  const prev = existing[0];
  const fromStatus: "to_do" | "in_progress" | "turned_in" | "graded" = prev.lifecycleStatus;

  // Build the patch — set lifecycle stamps when transitioning into a state.
  const now = new Date();
  const patch: any = { lifecycleStatus: input.toStatus };
  if (input.toStatus === "in_progress" && !prev.startedAt) patch.startedAt = now;
  if (input.toStatus === "turned_in" && !prev.turnedInAt) patch.turnedInAt = now;
  if (input.toStatus === "graded") {
    if (!prev.gradedAt) patch.gradedAt = now;
    if (typeof input.grade === "string") patch.grade = input.grade;
    if (input.gradeNumeric != null) patch.gradeNumeric = input.gradeNumeric;
  }

  await d
    .update(classroomAssignments)
    .set(patch)
    .where(eq(classroomAssignments.id as any, input.assignmentId));

  await d.insert(classroomSubmissions).values({
    assignmentId: input.assignmentId,
    fromStatus: fromStatus,
    toStatus: input.toStatus,
    changedBy: input.changedBy ?? null,
    note: input.note ?? null,
    driveFileId: input.driveFileId ?? null,
  } as any);

  const updated: any[] = await d
    .select()
    .from(classroomAssignments)
    .where(eq(classroomAssignments.id as any, input.assignmentId));
  return {
    assignment: updated[0],
    fromStatus,
    toStatus: input.toStatus,
  };
}

/* ----- Audit log read access -----------------------------------------
 * Most-recent transitions for one assignment. Used by the Classes page to
 * render "who moved this when".
 */
export async function listClassroomSubmissionsForAssignment(assignmentId: number, limit = 30) {
  const d = getDb();
  return await d
    .select()
    .from(classroomSubmissions)
    .where(eq(classroomSubmissions.assignmentId as any, assignmentId))
    .orderBy(desc(classroomSubmissions.createdAt as any))
    .limit(limit);
}

/* ----- Classroom drive-push enqueue ----------------------------------
 * Queue a drive_push_queue row that the heartbeat worker will consume to
 * MOVE the existing Drive file from the old lifecycle subfolder to the
 * new one when an assignment transitions states. Pure DB write — no
 * Drive API calls happen here. Returns the queue row id.
 *
 * Idempotent: if a pending row already exists for the same
 * (assignmentId, fromStatus, toStatus, driveFileId) tuple, we reuse it
 * instead of stacking duplicates. Same-state transitions are a no-op
 * and return { id: 0, skipped: "noop" }.
 */
export async function enqueueClassroomLifecycleDriveMove(args: {
  assignmentId: number;
  courseName: string;
  fromStatus: "to_do" | "in_progress" | "turned_in" | "graded";
  toStatus: "to_do" | "in_progress" | "turned_in" | "graded";
  driveFileId: string | null;
  fileName: string;
}): Promise<{ id: number; skipped?: "noop" | "no_file" | "empty_course" | "already_pending" }> {
  // Lazy import keeps these helpers tree-shakeable from the worker side.
  const {
    sanitizeClassFolderName,
    LIFECYCLE_FOLDER_NAME,
  } = await import("./_lib/classroomDrivePathPlanner");

  // No file to move → the worker would have nothing to do. Skip cleanly.
  if (!args.driveFileId) return { id: 0, skipped: "no_file" };
  if (args.fromStatus === args.toStatus) return { id: 0, skipped: "noop" };

  const safeClass = sanitizeClassFolderName(args.courseName);
  if (!safeClass) return { id: 0, skipped: "empty_course" };
  const subFolder = LIFECYCLE_FOLDER_NAME[args.toStatus];
  const targetSubpath = `${safeClass}/${subFolder}`;
  const fileName = args.fileName.length > 0 ? args.fileName : `assignment-${args.assignmentId}.bin`;

  const d = getDb();
  // Idempotency check: same assignment + driveFile + destination already pending?
  const existing: any[] = await d
    .select()
    .from(drivePushQueue)
    .where(
      and(
        eq(drivePushQueue.targetFolder as any, "classes" as any),
        eq(drivePushQueue.targetSubpath as any, targetSubpath as any),
        eq(drivePushQueue.driveFileId as any, args.driveFileId as any),
        eq(drivePushQueue.status as any, "pending" as any),
      ),
    );
  if (existing.length > 0) {
    return { id: existing[0].id ?? 0, skipped: "already_pending" };
  }

  const r: any = await d.insert(drivePushQueue).values({
    targetFolder: "classes" as any,
    targetSubpath,
    fileName,
    mimeType: null,
    // Carry the existing Drive file id forward so the worker knows this
    // is a MOVE (not a fresh upload) and can patch parents in-place.
    driveFileId: args.driveFileId,
    status: "pending" as any,
  } as any);

  let id = Number(r?.[0]?.insertId ?? r?.insertId ?? 0);
  if (!id) {
    const [row] = (await d
      .select()
      .from(drivePushQueue)
      .where(
        and(
          eq(drivePushQueue.targetFolder as any, "classes" as any),
          eq(drivePushQueue.targetSubpath as any, targetSubpath as any),
          eq(drivePushQueue.driveFileId as any, args.driveFileId as any),
        ),
      )
      .orderBy(desc(drivePushQueue.id))
      .limit(1)) as any[];
    id = row?.id ?? 0;
  }
  return { id };
}


/* ===================== REAGAN PROFILE MODEL =====================
 *
 * Lightweight, derived snapshot summarizing recent signals about how
 * Reagan is learning. Updated on read (debounced via app_settings cache).
 * Drives the Daily Printables picker + online-app suggestions.
 */
export type ReaganSignals = {
  generatedAt: number;
  windowDays: number;
  feedback: {
    /** counts of each Hard/Getting it/Got it tag in the window */
    hard: number;
    getting: number;
    got: number;
    /** strongest subjects (most "got" + "getting") */
    strongSubjects: string[];
    /** subjects with most "hard" */
    strugglingSubjects: string[];
  };
  pacing: {
    /** average minutes between block-done events on Today */
    avgBlockMinutes: number | null;
    /** typical hours she's most active (24h) */
    peakHours: number[];
  };
  formats: {
    /** preferred work format inferred from feedback notes / app launches */
    preferred: string[]; // e.g. ["hands-on", "drawing", "outdoor"]
  };
  mood: {
    recent: Array<{ date: string; zone: string | null }>;
  };
};

export async function computeReaganProfileSnapshot(windowDays = 14): Promise<ReaganSignals> {
  const d = getDb();
  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);
  let hard = 0, getting = 0, got = 0;
  const subjectScore: Record<string, { good: number; bad: number }> = {};
  try {
    const fb = await d.select().from(skillFeedback);
    for (const r of fb as any[]) {
      const ts = r.createdAt ? new Date(r.createdAt) : null;
      if (!ts || ts < since) continue;
      const tag = String(r.feeling || r.tag || "").toLowerCase();
      const subj = String(r.subjectSlug || r.subject || "").toLowerCase();
      if (subj) subjectScore[subj] ||= { good: 0, bad: 0 };
      if (tag.includes("hard")) { hard++; if (subj) subjectScore[subj].bad++; }
      else if (tag.includes("get")) { getting++; if (subj) subjectScore[subj].good++; }
      else if (tag.includes("got")) { got++; if (subj) subjectScore[subj].good += 2; }
    }
  } catch { /* feedback table optional */ }
  const subjects = Object.entries(subjectScore);
  const strongSubjects = subjects
    .filter(([, v]) => v.good > v.bad)
    .sort((a, b) => b[1].good - a[1].good)
    .slice(0, 3)
    .map(([s]) => s);
  const strugglingSubjects = subjects
    .filter(([, v]) => v.bad >= v.good)
    .sort((a, b) => b[1].bad - a[1].bad)
    .slice(0, 3)
    .map(([s]) => s);
  const moodRecent = await recentMoodStrip(7).catch(() => []);
  return {
    generatedAt: Date.now(),
    windowDays,
    feedback: { hard, getting, got, strongSubjects, strugglingSubjects },
    pacing: { avgBlockMinutes: null, peakHours: [9, 10, 13] },
    formats: { preferred: ["hands-on", "drawing", "outdoor", "story"] },
    mood: { recent: moodRecent as any[] },
  };
}


// ----- DAILY PRINTABLES -----
import { dailyPrintables } from "../drizzle/schema";

export type PrintableSyncInput = {
  forDate: string; // YYYY-MM-DD
  bucket: "have_to_do" | "optional" | "extra";
  title: string;
  description?: string | null;
  subjectSlug?: string | null;
  skillLadderId?: number | null;
  source: string;
  sourceUrl?: string | null;
  pdfKey?: string | null;
  thumbKey?: string | null;
  estMinutes?: number | null;
  coinReward?: number;
};

/** Replace today's printables with a fresh batch. Idempotent per forDate. */
export async function replaceDailyPrintables(forDate: string, items: PrintableSyncInput[]): Promise<number> {
  const d = getDb();
  // Wipe existing pending rows for the date (preserve already-done ones)
  await d
    .delete(dailyPrintables)
    .where(and(eq(dailyPrintables.forDate, forDate), eq(dailyPrintables.status, "pending")));
  let n = 0;
  for (const it of items) {
    if (!it?.title || !it?.bucket || !it?.forDate || !it?.source) continue;
    await d.insert(dailyPrintables).values({
      forDate: it.forDate,
      bucket: it.bucket,
      title: String(it.title).slice(0, 255),
      description: it.description ?? null,
      subjectSlug: it.subjectSlug ?? null,
      skillLadderId: it.skillLadderId ?? null,
      source: it.source,
      sourceUrl: it.sourceUrl ?? null,
      pdfKey: it.pdfKey ?? null,
      thumbKey: it.thumbKey ?? null,
      estMinutes: it.estMinutes ?? null,
      coinReward: it.coinReward ?? 5,
    } as any);
    n++;
  }
  return n;
}

/** Reagan's view: today's printables grouped by bucket. */
export async function listDailyPrintables(forDate: string) {
  const d = getDb();
  const rows = await d
    .select()
    .from(dailyPrintables)
    .where(eq(dailyPrintables.forDate, forDate))
    .orderBy(asc(dailyPrintables.bucket as any), asc(dailyPrintables.id));
  const byBucket: Record<string, typeof rows> = { have_to_do: [], optional: [], extra: [] };
  for (const r of rows) {
    const k = (r as any).bucket as string;
    (byBucket[k] ||= []).push(r);
  }
  return { date: forDate, ...byBucket };
}

/**
 * v2.19 (2026-05-17) — Per-block printables (AgendaEditor sub-panel).
 *
 * `dailyPrintables` rows are scoped by date. After v2.19 they can also
 * carry an optional `block_id` so a worksheet is "for this block of
 * this day" rather than "for this day." Block-anchored rows still show
 * up in `listDailyPrintables(forDate)` (full-day view); the helpers
 * below are the targeted lookups + writes used by the new
 * BlockPrintablesPanel.
 */
export async function listDailyPrintablesForBlock(forDate: string, blockId: string) {
  const d = getDb();
  return d
    .select()
    .from(dailyPrintables)
    .where(
      and(
        eq(dailyPrintables.forDate, forDate),
        eq(dailyPrintables.blockId as any, blockId),
      ),
    )
    .orderBy(asc(dailyPrintables.bucket as any), asc(dailyPrintables.id));
}

export async function attachPrintableToBlock(input: {
  forDate: string;
  blockId: string;
  bucket?: "have_to_do" | "optional" | "extra";
  title: string;
  source?: string;
  sourceUrl?: string | null;
  description?: string | null;
  subjectSlug?: string | null;
  estMinutes?: number | null;
  coinReward?: number;
}) {
  const d = getDb();
  // Title is the only truly required field beyond the keys; everything
  // else falls back to sane defaults so the AgendaEditor can post a
  // single-input "add link" form without cargo-culting the full schema.
  const row = {
    forDate: input.forDate,
    blockId: input.blockId,
    bucket: input.bucket ?? "have_to_do",
    title: String(input.title).slice(0, 255),
    description: input.description ?? null,
    subjectSlug: input.subjectSlug ?? null,
    source: input.source ?? "manual",
    sourceUrl: input.sourceUrl ?? null,
    estMinutes: input.estMinutes ?? null,
    coinReward: input.coinReward ?? 5,
  } as any;
  await d.insert(dailyPrintables).values(row);
  // Return the freshly-inserted row by re-reading the latest match;
  // simpler than wiring `lastInsertId` for the typical happy path.
  const rows = await d
    .select()
    .from(dailyPrintables)
    .where(
      and(
        eq(dailyPrintables.forDate, input.forDate),
        eq(dailyPrintables.blockId as any, input.blockId),
      ),
    )
    .orderBy(desc(dailyPrintables.id))
    .limit(1);
  return rows[0] ?? null;
}

export async function detachPrintableFromBlock(id: number) {
  // Soft-detach: keep the printable row (it might already be marked
  // done with a coin reward issued), just null out the block link so
  // it falls back to the full-day view.
  const d = getDb();
  await d
    .update(dailyPrintables)
    .set({ blockId: null } as any)
    .where(eq(dailyPrintables.id, id));
}

export async function deletePrintable(id: number) {
  // Hard delete — used when Mom decides the worksheet shouldn't exist
  // at all. We do NOT claw back any coin reward: if Reagan already
  // earned the coins, that's hers; the ledger entry stays put.
  const d = getDb();
  await d.delete(dailyPrintables).where(eq(dailyPrintables.id, id));
}

export async function markPrintableDone(id: number, opts: { photoKey?: string | null; autoGrade?: string | null; driveFileId?: string | null }) {
  const d = getDb();
  await d
    .update(dailyPrintables)
    .set({
      status: "done",
      completedAt: new Date(),
      photoKey: opts.photoKey ?? null,
      autoGrade: opts.autoGrade ?? null,
      driveFileId: opts.driveFileId ?? null,
    } as any)
    .where(eq(dailyPrintables.id, id));
  let row: any = null;
  try {
    const rows: any[] = await d.select().from(dailyPrintables).where(eq(dailyPrintables.id, id));
    row = rows[0] ?? null;
    if (row?.coinReward && row.coinReward > 0) {
      await d.insert(coinLedger).values({
        ledgerType: "earn",
        delta: row.coinReward,
        reason: `Printable: ${row.title}`,
      } as any);
    }
  } catch { /* coins are best-effort */ }
  // Push 31 (2026-05-13) — Topic-coverage rollup extension.
  // When a printable is finished, look up scheduleBlocks for the same
  // (forDate, subjectSlug). If any of those blocks is anchored to a
  // curriculumTopicId, mark that topic 'done' (only if not already).
  // This mirrors the updateBlock cascade so the rollup credits printables
  // and library worksheets the same way it credits in-block completions.
  if (row?.forDate && row?.subjectSlug) {
    try {
      await d.execute(sql`
        UPDATE curriculumTopics ct
        JOIN scheduleBlocks sb ON sb.curriculumTopicId = ct.id
        JOIN dailyPlans dp ON dp.id = sb.planId
        JOIN subjects s ON s.id = sb.subjectId
           SET ct.status = 'done', ct.completed_at = ${new Date()}
         WHERE DATE_FORMAT(dp.date, '%Y-%m-%d') = ${row.forDate}
           AND s.slug = ${row.subjectSlug}
           AND ct.status <> 'done'
      `);
    } catch {
      // Non-fatal: rollup is best-effort, the printable is already marked done.
    }
  }
  return row;
}


// ─── Adult Assignments Library (Apr 30 batch) ─────────────────────────────
import {
  assignmentsLibrary,
  assignmentBundles,
} from "../drizzle/schema";

export type AssignmentLibraryRow = typeof assignmentsLibrary.$inferSelect;
export type AssignmentBundleRow = typeof assignmentBundles.$inferSelect;

export type AssignmentLibraryFilters = {
  q?: string;                          // free-text search across title/topic/tags/notes
  subjectSlug?: string | null;
  type?: string | null;                // worksheet | video | slideshow | lesson_plan | quiz | answer_key | project | app_activity | reading | other
  status?: string | null;              // pending | in_progress | completed | absent | skipped
  fromSource?: string | null;
  ihClassroomOnly?: boolean;
  dateFor?: string | null;             // YYYY-MM-DD
  bundleId?: number | null;
  blockId?: number | null;            // pinned to a specific schedule block
  limit?: number;
  offset?: number;
  orderBy?: "recent" | "dateFor" | "recommendedUse" | "title";
};

export async function listAssignmentsLibrary(filters: AssignmentLibraryFilters = {}) {
  const d = getDb();
  const where: any[] = [];
  if (filters.subjectSlug) where.push(eq(assignmentsLibrary.subjectSlug, filters.subjectSlug));
  if (filters.type) where.push(eq(assignmentsLibrary.type, filters.type));
  if (filters.status) where.push(eq(assignmentsLibrary.status, filters.status));
  if (filters.fromSource) where.push(eq(assignmentsLibrary.fromSource, filters.fromSource));
  if (filters.ihClassroomOnly) where.push(eq(assignmentsLibrary.ihClassroom, true));
  if (filters.dateFor) where.push(eq(assignmentsLibrary.dateFor, filters.dateFor));
  if (filters.bundleId != null) where.push(eq(assignmentsLibrary.bundleId, filters.bundleId));
  if (filters.blockId != null) where.push(eq(assignmentsLibrary.blockId, filters.blockId));
  if (filters.q) {
    const like = `%${filters.q.replace(/%/g, "")}%`;
    where.push(sql`(${assignmentsLibrary.title} LIKE ${like} OR ${assignmentsLibrary.topic} LIKE ${like} OR ${assignmentsLibrary.notes} LIKE ${like})`);
  }

  const orderClause = (() => {
    switch (filters.orderBy) {
      case "dateFor":
        return [desc(assignmentsLibrary.dateFor), desc(assignmentsLibrary.id)];
      case "recommendedUse":
        return [desc(assignmentsLibrary.recommendedUse), desc(assignmentsLibrary.id)];
      case "title":
        return [asc(assignmentsLibrary.title)];
      default:
        return [desc(assignmentsLibrary.createdAt), desc(assignmentsLibrary.id)];
    }
  })();

  let q: any = d.select().from(assignmentsLibrary);
  if (where.length) q = q.where(and(...where));
  q = q.orderBy(...orderClause);
  if (filters.limit) q = q.limit(filters.limit);
  if (filters.offset) q = q.offset(filters.offset);
  const rows = await q;
  return rows as AssignmentLibraryRow[];
}

export async function countAssignmentsLibrary(filters: AssignmentLibraryFilters = {}) {
  const d = getDb();
  const where: any[] = [];
  if (filters.subjectSlug) where.push(eq(assignmentsLibrary.subjectSlug, filters.subjectSlug));
  if (filters.type) where.push(eq(assignmentsLibrary.type, filters.type));
  if (filters.status) where.push(eq(assignmentsLibrary.status, filters.status));
  if (filters.fromSource) where.push(eq(assignmentsLibrary.fromSource, filters.fromSource));
  if (filters.ihClassroomOnly) where.push(eq(assignmentsLibrary.ihClassroom, true));
  if (filters.dateFor) where.push(eq(assignmentsLibrary.dateFor, filters.dateFor));
  if (filters.q) {
    const like = `%${filters.q.replace(/%/g, "")}%`;
    where.push(sql`(${assignmentsLibrary.title} LIKE ${like} OR ${assignmentsLibrary.topic} LIKE ${like} OR ${assignmentsLibrary.notes} LIKE ${like})`);
  }
  let q: any = d.select({ n: sql<number>`COUNT(*)` }).from(assignmentsLibrary);
  if (where.length) q = q.where(and(...where));
  const r: any = await q;
  return Number(r?.[0]?.n ?? 0);
}

export async function getAssignmentLibraryRow(id: number) {
  const d = getDb();
  const rows = await d.select().from(assignmentsLibrary).where(eq(assignmentsLibrary.id, id));
  return (rows[0] ?? null) as AssignmentLibraryRow | null;
}

export type AssignmentLibraryInput = Partial<AssignmentLibraryRow> & {
  title: string;
  type: string;
};

export async function addAssignmentLibrary(input: AssignmentLibraryInput) {
  const d = getDb();
  const res: any = await d.insert(assignmentsLibrary).values({
    title: input.title,
    subjectSlug: input.subjectSlug ?? null,
    type: input.type,
    topic: input.topic ?? null,
    tags: (input.tags as any) ?? null,
    fromSource: input.fromSource ?? "manual",
    ihClassroom: input.ihClassroom ?? false,
    dateReceived: input.dateReceived ?? null,
    dateFor: input.dateFor ?? null,
    status: input.status ?? "pending",
    recommendedUse: input.recommendedUse ?? 3,
    sourceUrl: input.sourceUrl ?? null,
    fileLink: input.fileLink ?? null,
    bundleId: input.bundleId ?? null,
    bundleStep: input.bundleStep ?? null,
    linkedItemIds: (input.linkedItemIds as any) ?? null,
    notes: input.notes ?? null,
    blockId: input.blockId ?? null,
  } as any);
  const id = (res as any)?.[0]?.insertId ?? (res as any)?.insertId ?? null;
  return id ? await getAssignmentLibraryRow(Number(id)) : null;
}

export async function updateAssignmentLibrary(id: number, patch: Partial<AssignmentLibraryRow>) {
  const d = getDb();
  await d.update(assignmentsLibrary).set({ ...patch, updatedAt: new Date() } as any).where(eq(assignmentsLibrary.id, id));
  return getAssignmentLibraryRow(id);
}

export async function setAssignmentLibraryStatus(id: number, status: string) {
  const d = getDb();
  const completedAt = status === "completed" ? new Date() : null;
  await d.update(assignmentsLibrary)
    .set({ status, completedAt: completedAt as any, updatedAt: new Date() } as any)
    .where(eq(assignmentsLibrary.id, id));
  return getAssignmentLibraryRow(id);
}

export async function findLibraryItemsForToday(forDate: string, subjectSlug: string | null) {
  const d = getDb();
  const where: any[] = [eq(assignmentsLibrary.dateFor, forDate)];
  if (subjectSlug) where.push(eq(assignmentsLibrary.subjectSlug, subjectSlug));
  // not yet completed/skipped
  where.push(sql`${assignmentsLibrary.status} IN ('pending','in_progress')`);
  const rows = await d.select().from(assignmentsLibrary).where(and(...where)).orderBy(asc(assignmentsLibrary.bundleStep), desc(assignmentsLibrary.recommendedUse));
  return rows as AssignmentLibraryRow[];
}

// ─── Bundles ────────────────────────────────────────────────────────────────

export async function listAssignmentBundles(filters: { dateFor?: string | null; subjectSlug?: string | null } = {}) {
  const d = getDb();
  const where: any[] = [];
  if (filters.dateFor) where.push(eq(assignmentBundles.dateFor, filters.dateFor));
  if (filters.subjectSlug) where.push(eq(assignmentBundles.subjectSlug, filters.subjectSlug));
  let q: any = d.select().from(assignmentBundles);
  if (where.length) q = q.where(and(...where));
  q = q.orderBy(desc(assignmentBundles.createdAt));
  return await q as AssignmentBundleRow[];
}

export async function createAssignmentBundle(input: Partial<AssignmentBundleRow> & { name: string }) {
  const d = getDb();
  const res: any = await d.insert(assignmentBundles).values({
    name: input.name,
    subjectSlug: input.subjectSlug ?? null,
    topic: input.topic ?? null,
    dateFor: input.dateFor ?? null,
    reminderOnly: input.reminderOnly ?? false,
    notes: input.notes ?? null,
  } as any);
  const id = (res as any)?.[0]?.insertId ?? (res as any)?.insertId ?? null;
  if (!id) return null;
  const rows = await d.select().from(assignmentBundles).where(eq(assignmentBundles.id, Number(id)));
  return (rows[0] ?? null) as AssignmentBundleRow | null;
}

export async function attachLibraryItemToBundle(itemId: number, bundleId: number, step: number) {
  const d = getDb();
  await d.update(assignmentsLibrary)
    .set({ bundleId, bundleStep: step, updatedAt: new Date() } as any)
    .where(eq(assignmentsLibrary.id, itemId));
  return getAssignmentLibraryRow(itemId);
}

export async function getBundleWithItems(bundleId: number) {
  const d = getDb();
  const bRows = await d.select().from(assignmentBundles).where(eq(assignmentBundles.id, bundleId));
  if (!bRows[0]) return null;
  const items = await d.select().from(assignmentsLibrary).where(eq(assignmentsLibrary.bundleId, bundleId)).orderBy(asc(assignmentsLibrary.bundleStep));
  return { bundle: bRows[0] as AssignmentBundleRow, items: items as AssignmentLibraryRow[] };
}

// Idempotency helper for the daily auto-sync: returns the first row with the
// same (title, fromSource, dateReceived) so re-runs don't duplicate the
// Library. dateReceived may be null in which case we match on title+source only.
export async function findExistingLibraryRow(args: {
  title: string;
  fromSource: string;
  dateReceived: string | null;
}) {
  const d = getDb();
  const where: any[] = [
    eq(assignmentsLibrary.title, args.title),
    eq(assignmentsLibrary.fromSource, args.fromSource),
  ];
  if (args.dateReceived) where.push(eq(assignmentsLibrary.dateReceived, args.dateReceived));
  const rows = await d.select().from(assignmentsLibrary).where(and(...where)).limit(1);
  return (rows[0] ?? null) as AssignmentLibraryRow | null;
}


/* ============================================================================
 * FAMILY UPDATE STREAM (Phase 4)
 * --------------------------------------------------------------------------
 * Unified, read-only feed combining the four event types every adult in the
 * home team cares about:
 *   - block_complete  : Reagan finished a schedule block
 *   - submission      : she turned in work (photo / text / file / audio)
 *   - good_work_note  : an adult left an encouragement / lyric
 *   - coin_earn       : she earned coins (sticker, bonus, gold star)
 *
 * Returns the most-recent N events sorted desc by createdAt. Cheap, no joins
 * across schemas \u2014 each subquery hits one table and we merge in JS.
 * ============================================================================
 */
export type FamilyFeedItem = {
  id: string;
  kind: "block_complete" | "submission" | "good_work_note" | "coin_earn";
  at: Date;
  title: string;
  detail?: string | null;
  authorName?: string | null;
  refId: number;
};

export async function listFamilyFeed(limit: number = 30): Promise<FamilyFeedItem[]> {
  const dbi = getDb();
  const cap = Math.min(Math.max(1, limit), 100);

  const blocks: any[] = await dbi.select({
    id: scheduleBlocks.id, title: scheduleBlocks.title, at: scheduleBlocks.completedAt,
  }).from(scheduleBlocks).where(eq(scheduleBlocks.status, "complete")).orderBy(desc(scheduleBlocks.completedAt)).limit(cap);

  const subs: any[] = await dbi.select({
    id: assignmentSubmissions.id, title: assignmentSubmissions.title,
    subj: assignmentSubmissions.subjectSlug, at: assignmentSubmissions.submittedAt,
    diff: assignmentSubmissions.kidDifficulty,
  }).from(assignmentSubmissions).orderBy(desc(assignmentSubmissions.submittedAt)).limit(cap);

  const notes: any[] = await dbi.select({
    id: goodWorkNotes.id, lyric: goodWorkNotes.lyric, author: goodWorkNotes.authorName,
    at: goodWorkNotes.createdAt,
  }).from(goodWorkNotes).orderBy(desc(goodWorkNotes.createdAt)).limit(cap);

  const coins: any[] = await dbi.select({
    id: coinLedger.id, delta: coinLedger.delta, kind: coinLedger.kind,
    reason: coinLedger.reasonNote, at: coinLedger.createdAt,
  }).from(coinLedger).orderBy(desc(coinLedger.createdAt)).limit(cap);

  const out: FamilyFeedItem[] = [];
  for (const b of blocks) if (b.at) out.push({
    id: `block-${b.id}`, kind: "block_complete", at: b.at,
    title: `Reagan finished: ${b.title}`, refId: b.id,
  });
  for (const s of subs) if (s.at) out.push({
    id: `sub-${s.id}`, kind: "submission", at: s.at,
    title: `Turned in: ${s.title || "(untitled)"}`,
    detail: [s.subj, s.diff && `felt ${String(s.diff).replace(/_/g, " ")}`].filter(Boolean).join(" \u00b7 "),
    refId: s.id,
  });
  for (const n of notes) if (n.at) out.push({
    id: `note-${n.id}`, kind: "good_work_note", at: n.at,
    title: n.lyric.length > 120 ? n.lyric.slice(0, 117) + "\u2026" : n.lyric,
    authorName: n.author || null, refId: n.id,
  });
  for (const c of coins) if (c.at && c.delta > 0) out.push({
    id: `coin-${c.id}`, kind: "coin_earn", at: c.at,
    title: `+${c.delta} coin${c.delta === 1 ? "" : "s"}`,
    detail: c.reason || String(c.kind).replace(/_/g, " "),
    refId: c.id,
  });

  out.sort((a, b) => b.at.getTime() - a.at.getTime());
  return out.slice(0, cap);
}


// ------------------------------------------------------------------
// Curriculum resource roll-up (May 3 2026)
// ------------------------------------------------------------------
import { curriculumResources } from "../drizzle/schema";

/**
 * List all manually-added resources for a topic (worksheets, videos, lessons,
 * readings, printables, generic links). Newest first.
 */
export async function listTopicResources(topicId: number) {
  const db = getDb();
  return db
    .select()
    .from(curriculumResources)
    .where(eq(curriculumResources.topicId, topicId))
    .orderBy(desc(curriculumResources.createdAt));
}

/**
 * List all schedule blocks anchored to a topic (any status). Surfaces every
 * "daily assignment" the topic has been used in.
 */
export async function listTopicBlocks(topicId: number) {
  const db = getDb();
  return db
    .select({
      id: scheduleBlocks.id,
      planId: scheduleBlocks.planId,
      title: scheduleBlocks.title,
      blockType: scheduleBlocks.blockType,
      durationMin: scheduleBlocks.durationMin,
      status: scheduleBlocks.status,
      completedAt: scheduleBlocks.completedAt,
    })
    .from(scheduleBlocks)
    .where(eq(scheduleBlocks.curriculumTopicId, topicId))
    .orderBy(desc(scheduleBlocks.id))
    .limit(50);
}

/** Add a resource attached to a topic. Idempotent on (topicId, kind, url). */
export async function addTopicResource(input: {
  topicId: number;
  kind: "worksheet" | "video" | "lesson" | "reading" | "printable" | "link";
  title: string;
  url?: string | null;
  source?: string | null;
  notes?: string | null;
  addedByUserId?: number | null;
}) {
  const db = getDb();
  // De-dupe: if same (topicId, kind, url) already exists, return existing.
  if (input.url) {
    const existing = await db
      .select()
      .from(curriculumResources)
      .where(
        and(
          eq(curriculumResources.topicId, input.topicId),
          eq(curriculumResources.kind, input.kind),
          eq(curriculumResources.url, input.url),
        ),
      )
      .limit(1);
    if (existing.length) return (existing[0] as any).id;
  }
  const result: any = await db.insert(curriculumResources).values({
    topicId: input.topicId,
    kind: input.kind,
    title: input.title.slice(0, 400),
    url: input.url ?? null,
    source: input.source ?? null,
    notes: input.notes ?? null,
    addedByUserId: input.addedByUserId ?? null,
  } as any);
  return (result as any)[0]?.insertId;
}

/** Delete a resource by id. */
export async function removeTopicResource(id: number) {
  await getDb().delete(curriculumResources).where(eq(curriculumResources.id, id));
}

/**
 * Combined roll-up: returns { resources, blocks } for a topic. Used by the
 * Adult Curriculum drawer to show every artifact tied to that topic.
 */
export async function getTopicRollup(topicId: number) {
  const [resources, blocks] = await Promise.all([
    listTopicResources(topicId),
    listTopicBlocks(topicId),
  ]);
  return { resources, blocks };
}


/* ============================== STUDENT REQUESTS =========================== *
 * Reagan -> adults messages (assignment / adventure / schedule / snack ideas).
 * Kid-side talks to Kiwi which inserts here; adult AI bar lists + resolves.
 * ========================================================================== */
export async function listStudentRequests(opts: { status?: "pending" | "resolved"; limit?: number } = {}) {
  const limit = Math.max(1, Math.min(opts.limit ?? 50, 200));
  const q = getDb().select().from(studentRequests).orderBy(desc(studentRequests.createdAt)).limit(limit);
  if (opts.status === "pending") return (q as any).where(isNull(studentRequests.resolvedAt));
  if (opts.status === "resolved") return (q as any).where(isNotNull(studentRequests.resolvedAt));
  return q;
}
export async function insertStudentRequest(r: typeof studentRequests.$inferInsert) {
  await getDb().insert(studentRequests).values(r);
}
export async function resolveStudentRequest(id: number, opts: { resolvedByUserId?: number; note?: string }) {
  await getDb().update(studentRequests).set({
    resolvedAt: new Date(),
    resolvedNote: opts.note ?? null,
    resolvedByUserId: opts.resolvedByUserId ?? null,
  } as any).where(eq(studentRequests.id, id));
}

/* ============================== ADULT AI MESSAGES ========================== *
 * Mom + tutor chat history with the plain text-only adult AI assistant.
 * Kept fully separate from `whisperSessions` (Reagan's Kiwi) for privacy.
 * ========================================================================== */
export async function listAdultAiMessages(limit = 50) {
  return getDb().select().from(adultAiMessages).orderBy(desc(adultAiMessages.createdAt)).limit(Math.max(1, Math.min(limit, 200)));
}
export async function insertAdultAiMessage(m: typeof adultAiMessages.$inferInsert) {
  await getDb().insert(adultAiMessages).values(m);
}
export async function clearAdultAiHistory() {
  await getDb().delete(adultAiMessages);
}


/* ============================== TUTOR DAY NOTES =========================== *
 * Free-form per-day note a tutor writes after their day with Reagan; flows
 * back into the AI agenda generator's recent-context window so the next plan
 * adapts (e.g. "softened long-division on Wed because she was overwhelmed").
 * ========================================================================== */
import { tutorDayNotes } from "../drizzle/schema";

export async function listTutorDayNotes(dateStr: string) {
  return getDb()
    .select()
    .from(tutorDayNotes)
    .where(eq(tutorDayNotes.dateStr, dateStr))
    .orderBy(desc(tutorDayNotes.createdAt));
}

export async function listRecentTutorDayNotes(limit = 10) {
  return getDb()
    .select()
    .from(tutorDayNotes)
    .orderBy(desc(tutorDayNotes.createdAt))
    .limit(Math.max(1, Math.min(limit, 50)));
}

export async function insertTutorDayNote(data: {
  dateStr: string;
  tutorName: string;
  authorOpenId?: string | null;
  topicsCovered?: string | null;
  comfort?: "calm" | "okay" | "stretched" | "overwhelmed" | null;
  notes: string;
  tags?: string[] | null;
}) {
  await getDb().insert(tutorDayNotes).values(data as any);
}

export async function deleteTutorDayNote(id: number) {
  await getDb().delete(tutorDayNotes).where(eq(tutorDayNotes.id, id));
}

/* ============================== NIGHTLY AGENDA EMAILS ===================== */
import { nightlyAgendaEmails } from "../drizzle/schema";

export async function getLatestNightlyAgendaEmail(forDate: string) {
  const rows = await getDb()
    .select()
    .from(nightlyAgendaEmails)
    .where(eq(nightlyAgendaEmails.forDate, forDate))
    .orderBy(desc(nightlyAgendaEmails.sentAt))
    .limit(1);
  return rows[0] ?? null;
}

export async function listRecentNightlyAgendaEmails(limit = 14) {
  return getDb()
    .select()
    .from(nightlyAgendaEmails)
    .orderBy(desc(nightlyAgendaEmails.sentAt))
    .limit(Math.max(1, Math.min(limit, 90)));
}

export async function insertNightlyAgendaEmail(row: {
  forDate: string;
  recipients: string;
  agendaHash: string;
  blockCount: number;
  pdfStorageKey?: string | null;
  drivePushed?: boolean;
  driveFolderPath?: string | null;
  status?: "queued" | "sent" | "failed" | "resent";
  errorMessage?: string | null;
  triggerKind?: "nightly" | "change_resend" | "manual";
}) {
  const r = await getDb()
    .insert(nightlyAgendaEmails)
    .values({
      forDate: row.forDate,
      recipients: row.recipients,
      agendaHash: row.agendaHash,
      blockCount: row.blockCount,
      pdfStorageKey: row.pdfStorageKey ?? null,
      drivePushed: row.drivePushed ?? false,
      driveFolderPath: row.driveFolderPath ?? null,
      status: row.status ?? "queued",
      errorMessage: row.errorMessage ?? null,
      triggerKind: row.triggerKind ?? "nightly",
    } as any);
  return Number((r as any)?.[0]?.insertId ?? (r as any)?.insertId ?? 0);
}

export async function markNightlyAgendaEmailStatus(args: {
  id: number;
  status: "sent" | "failed" | "resent";
  errorMessage?: string | null;
  drivePushed?: boolean;
}) {
  await getDb()
    .update(nightlyAgendaEmails)
    .set({
      status: args.status,
      errorMessage: args.errorMessage ?? null,
      ...(args.drivePushed !== undefined ? { drivePushed: args.drivePushed } : {}),
    } as any)
    .where(eq(nightlyAgendaEmails.id, args.id));
}

/* ---------- block book references (used by agenda PDF) ---------- */
export async function listBookAssignmentsForBlock(blockId: number) {
  const rows = await getDb()
    .select()
    .from(bookAssignments)
    .where(eq(bookAssignments.blockId, blockId));
  if (rows.length === 0) return [];
  const bookIds = Array.from(new Set(rows.map((r: any) => r.bookId)));
  const bks = await getDb()
    .select()
    .from(books)
    .where(inArray(books.id, bookIds));
  const titleById = new Map(bks.map((b: any) => [b.id, b.title]));
  return rows.map((r: any) => ({
    bookId: r.bookId,
    bookTitle: titleById.get(r.bookId) ?? `Book #${r.bookId}`,
    fromPage: r.fromPage,
    toPage: r.toPage,
  }));
}


/* ============================== ICAL FEEDS + EVENTS ======================== *
 * Subscribed-calendar overlay for the Schedule page (Indian Hill calendar,
 * sports, soccer, family). Pulled nightly + on-demand. Read-only mirror.
 * ========================================================================== */
import { icalFeeds, icalEvents } from "../drizzle/schema";

export async function listIcalFeeds() {
  return getDb().select().from(icalFeeds).orderBy(asc(icalFeeds.id));
}

export async function getIcalFeed(id: number) {
  const rows = await getDb().select().from(icalFeeds).where(eq(icalFeeds.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function insertIcalFeed(row: { label: string; url: string; color?: string; enabled?: boolean }) {
  const r = await getDb().insert(icalFeeds).values({
    label: row.label,
    url: row.url,
    color: row.color ?? "#0a66c2",
    enabled: row.enabled ?? true,
  } as any);
  return Number((r as any)?.[0]?.insertId ?? (r as any)?.insertId ?? 0);
}

export async function updateIcalFeed(id: number, patch: { label?: string; url?: string; color?: string; enabled?: boolean }) {
  await getDb().update(icalFeeds).set(patch as any).where(eq(icalFeeds.id, id));
}

export async function deleteIcalFeed(id: number) {
  await getDb().delete(icalFeeds).where(eq(icalFeeds.id, id));
  await getDb().delete(icalEvents).where(eq(icalEvents.feedId, id));
}

export async function recordIcalSyncResult(args: {
  feedId: number;
  status: "ok" | "failed";
  error?: string | null;
  eventsCached?: number;
}) {
  await getDb().update(icalFeeds).set({
    lastSyncedAt: new Date(),
    lastSyncStatus: args.status,
    lastSyncError: args.error ?? null,
    ...(typeof args.eventsCached === "number" ? { eventsCached: args.eventsCached } : {}),
  } as any).where(eq(icalFeeds.id, args.feedId));
}

/** Replace ALL cached events for a feed with the freshly parsed list. */
export async function replaceIcalEventsForFeed(
  feedId: number,
  events: Array<{
    uid: string;
    summary: string;
    location: string | null;
    description: string | null;
    startsAt: Date;
    endsAt: Date | null;
    allDay: boolean;
    forDate: string;
    rawSnippet: string | null;
  }>,
) {
  const dbi = getDb();
  await dbi.delete(icalEvents).where(eq(icalEvents.feedId, feedId));
  if (events.length === 0) return;
  // Chunk inserts to avoid hitting MySQL packet size limits.
  const CHUNK = 200;
  for (let i = 0; i < events.length; i += CHUNK) {
    const slice = events.slice(i, i + CHUNK).map((e) => ({
      feedId,
      uid: e.uid.slice(0, 200),
      summary: e.summary.slice(0, 240),
      location: e.location?.slice(0, 200) ?? null,
      description: e.description ?? null,
      startsAt: e.startsAt,
      endsAt: e.endsAt,
      allDay: e.allDay,
      forDate: e.forDate,
      rawSnippet: e.rawSnippet ?? null,
    }));
    await dbi.insert(icalEvents).values(slice as any);
  }
}

export async function listIcalEventsBetween(opts: { startDate: string; endDate: string }) {
  const rows = await getDb()
    .select()
    .from(icalEvents)
    .where(
      and(
        gte(icalEvents.forDate as any, opts.startDate as any),
        lte(icalEvents.forDate as any, opts.endDate as any),
      ) as any,
    )
    .orderBy(asc(icalEvents.startsAt));
  return rows;
}


/* ============================================================
 * Kiwi quiet-listening summaries — Phase 13
 * Mom-only analytics; never shown to Reagan.
 * ============================================================ */
export async function insertListeningSummary(s: {
  date: string;
  periodStart: Date;
  periodEnd: Date;
  relevanceScore?: number | null;
  discardedReason?: "background_noise"|"other_person"|"silence"|"non_school"|"too_short"|null;
  schoolBlockId?: number | null;
  subjectGuess?: string | null;
  topicsJson?: any;
  completionsJson?: any;
  emotionScore?: number | null;
  comfortScore?: number | null;
  difficultyScore?: number | null;
  talkativenessScore?: number | null;
  rawSummary?: string | null;
}) {
  const db = getDb();
  await (db as any).insert(listeningSummaries).values(s);
}

export async function listListeningSummariesForDate(date: string) {
  const db = getDb();
  const rows = await (db as any)
    .select()
    .from(listeningSummaries)
    .where(eq(listeningSummaries.date, date))
    .orderBy(asc(listeningSummaries.periodStart));
  return rows;
}

export async function listListeningSummariesBetween(startDate: string, endDate: string) {
  const db = getDb();
  const rows = await (db as any)
    .select()
    .from(listeningSummaries)
    .where(and(
      gte(listeningSummaries.date, startDate),
      lte(listeningSummaries.date, endDate),
    ))
    .orderBy(asc(listeningSummaries.date), asc(listeningSummaries.periodStart));
  return rows;
}

/* ============================================================
 * 2026-05-05: school-window detection + behavior derivations.
 * A chunk is "in school window" if there's a scheduleBlock for the
 * date whose [startTime, endTime) covers the chunk's periodStart.
 * Returns the matching scheduleBlocks row id, or null if none.
 * ========================================================== */
export async function findCoveringSchoolBlock(dateStr: string, ts: Date): Promise<{ id: number; subjectGuess: string | null } | null> {
  const plan = await getPlanByDate(dateStr);
  if (!plan) return null;
  const blocks = await listBlocksForPlan((plan as any).id);
  // Build a wall-clock minute-of-day for ts, in local server tz.
  const minOfDay = ts.getHours() * 60 + ts.getMinutes();
  for (const b of blocks as any[]) {
    const startStr: string | null = (b as any).startTime;
    if (!startStr) continue;
    const [hh, mm] = startStr.split(":").map((x: string) => parseInt(x, 10));
    if (!Number.isFinite(hh) || !Number.isFinite(mm)) continue;
    const startMin = hh * 60 + mm;
    const endMin = startMin + (b.durationMin ?? 30);
    if (minOfDay >= startMin && minOfDay < endMin) {
      const subjectSlug = (b as any).subject?.slug ?? null;
      return { id: b.id as number, subjectGuess: subjectSlug };
    }
  }
  return null;
}

/** Behavior summary for one day, gated to relevant in-school chunks.
 *  Returns null when no rows at all (caller hides UI per "no info" rule). */
export async function listeningBehaviorForDate(dateStr: string) {
  const all = await listListeningSummariesForDate(dateStr);
  if (all.length === 0) return null;
  const relevant = all.filter((r: any) => (r.relevanceScore ?? 100) >= 50);
  const dropped = all.length - relevant.length;
  const offTask = all.filter((r: any) => r.discardedReason === "non_school").length;
  const distractions = all.filter((r: any) => r.discardedReason === "other_person" || r.discardedReason === "background_noise").length;
  const focusPct = all.length === 0 ? 0 : Math.round((relevant.length / all.length) * 100);
  // Top topic across relevant rows.
  const topicCount = new Map<string, number>();
  for (const r of relevant as any[]) {
    const list: any[] = Array.isArray(r.topicsJson) ? r.topicsJson : [];
    for (const t of list) {
      const name = (t.name || t.topic || "").toString();
      if (!name) continue;
      topicCount.set(name, (topicCount.get(name) || 0) + 1);
    }
  }
  const topTopic = Array.from(topicCount.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  return {
    relevantCount: relevant.length,
    droppedCount: dropped,
    distractions,
    offTask,
    focusPct,
    topTopic,
  };
}

/** All-time behavior averages (focus%, dropped chunks, etc.). */
export async function listeningBehaviorAggregate() {
  const db = getDb();
  const rows = await (db as any).select().from(listeningSummaries);
  if (rows.length === 0) return null;
  const relevant = rows.filter((r: any) => (r.relevanceScore ?? 100) >= 50);
  const dropped = rows.length - relevant.length;
  const focusPct = Math.round((relevant.length / rows.length) * 100);
  // Days with at least one row ("days together").
  const daySet = new Set(rows.map((r: any) => r.date));
  return {
    totalRows: rows.length,
    relevantCount: relevant.length,
    droppedCount: dropped,
    focusPct,
    daysTogether: daySet.size,
    avgRelevantPerDay: daySet.size === 0 ? 0 : Math.round(relevant.length / daySet.size),
  };
}

/** Aggregate the day's listening rows into a Mom-only daily sheet shape. */
export function aggregateListeningDay(rows: any[]) {
  const total = rows.length;
  const avg = (key: string) => {
    const vals = rows.map((r) => r[key]).filter((v) => typeof v === "number");
    if (vals.length === 0) return null;
    return Math.round(vals.reduce((a: number, b: number) => a + b, 0) / vals.length);
  };
  const minutesOnTask = rows.reduce((acc: number, r: any) => {
    const a = new Date(r.periodStart).getTime();
    const b = new Date(r.periodEnd).getTime();
    if (Number.isFinite(a) && Number.isFinite(b) && b > a) acc += (b - a) / 60000;
    return acc;
  }, 0);
  const subjectCounts: Record<string, number> = {};
  for (const r of rows) {
    const s = (r.subjectGuess || "unknown").toLowerCase();
    subjectCounts[s] = (subjectCounts[s] || 0) + 1;
  }
  const topicMap = new Map<string, { subject: string; topic: string; count: number }>();
  for (const r of rows) {
    const list: any[] = Array.isArray(r.topicsJson) ? r.topicsJson : [];
    for (const t of list) {
      const subj = (t.subject || r.subjectGuess || "unknown").toString().toLowerCase();
      const name = (t.name || t.topic || "").toString();
      if (!name) continue;
      const key = `${subj}::${name}`;
      const cur = topicMap.get(key) ?? { subject: subj, topic: name, count: 0 };
      cur.count += 1;
      topicMap.set(key, cur);
    }
  }
  const topics = Array.from(topicMap.values()).sort((a, b) => b.count - a.count);
  return {
    samples: total,
    minutesOnTask: Math.round(minutesOnTask),
    avgEmotion: avg("emotionScore"),
    avgComfort: avg("comfortScore"),
    avgDifficulty: avg("difficultyScore"),
    avgTalkativeness: avg("talkativenessScore"),
    subjectCounts,
    topics,
  };
}


/* =========================== ADULT NOTEBOOK DAY ATTACHMENTS =================
 * Per-day photos + worksheet PDFs + markup overlays for the global Notebook
 * drawer. All file bytes live in S3; only metadata + S3 keys live in DB.
 * Markup is a single transparent PNG overlay per attachment; saving a new
 * markup just overwrites the previous markupKey reference (we let the
 * unreferenced old object become orphaned per the storage layer's policy).
 * =========================================================================== */
import { dayAttachments } from "../drizzle/schema";

export async function addDayAttachment(input: {
  dateStr: string;
  kind: "image" | "pdf";
  fileKey: string;
  fileName: string | null;
  pageIndex?: number;
}) {
  const db = getDb();
  const [r] = await db
    .insert(dayAttachments)
    .values({
      dateStr: input.dateStr,
      kind: input.kind,
      fileKey: input.fileKey,
      fileName: input.fileName,
      pageIndex: input.pageIndex ?? 0,
    })
    .$returningId();
  const id = (r as any)?.id as number;
  const [row] = await db.select().from(dayAttachments).where(eq(dayAttachments.id, id));
  return row;
}

export async function listDayAttachments(dateStr: string) {
  return getDb()
    .select()
    .from(dayAttachments)
    .where(eq(dayAttachments.dateStr, dateStr))
    .orderBy(asc(dayAttachments.createdAt));
}

export async function setDayAttachmentMarkup(id: number, markupKey: string | null) {
  await getDb()
    .update(dayAttachments)
    .set({ markupKey, updatedAt: new Date() })
    .where(eq(dayAttachments.id, id));
}

export async function removeDayAttachment(id: number) {
  await getDb().delete(dayAttachments).where(eq(dayAttachments.id, id));
}


/* ========================================================================== */
/*  Slice 3.5 — AI auto-approver + Manus push escalation + tutor roster       */
/* ========================================================================== */

import {
  pendingApprovals,
  tutorRosterOverride,
  recipientPushTargets,
  type PendingApproval,
  type TutorRosterOverride,
  type RecipientPushTarget,
  type InsertPendingApproval,
  type InsertTutorRosterOverride,
  type InsertRecipientPushTarget,
} from "../drizzle/schema";

/** Insert a new approval row. Returns the inserted id. */
export async function insertPendingApproval(
  row: Omit<InsertPendingApproval, "id">
): Promise<number> {
  const [res] = (await getDb().insert(pendingApprovals).values(row)) as any;
  return Number(res?.insertId ?? 0);
}

/** Read one approval by id. */
export async function getPendingApproval(
  id: number
): Promise<PendingApproval | null> {
  const rows = await getDb()
    .select()
    .from(pendingApprovals)
    .where(eq(pendingApprovals.id, id))
    .limit(1);
  return (rows[0] as PendingApproval) ?? null;
}

/** List approvals by status, newest first. Limit defaults to 50. */
export async function listPendingApprovalsByStatus(
  status: string,
  limit: number = 50
): Promise<PendingApproval[]> {
  return (await getDb()
    .select()
    .from(pendingApprovals)
    .where(eq(pendingApprovals.status, status))
    .orderBy(desc(pendingApprovals.requestedAt))
    .limit(limit)) as PendingApproval[];
}

/** List recent approvals across all statuses (for the Pending tab). */
export async function listRecentApprovals(
  limit: number = 50
): Promise<PendingApproval[]> {
  return (await getDb()
    .select()
    .from(pendingApprovals)
    .orderBy(desc(pendingApprovals.requestedAt))
    .limit(limit)) as PendingApproval[];
}

/** Mark an approval decided (approved or rejected). Returns true on success. */
export async function decidePendingApproval(
  id: number,
  status: "approved" | "rejected",
  decidedBy: string
): Promise<boolean> {
  const res = (await getDb()
    .update(pendingApprovals)
    .set({
      status,
      decidedBy,
      decidedAt: Date.now(),
    })
    .where(eq(pendingApprovals.id, id))) as any;
  return Number(res?.affectedRows ?? 0) > 0;
}

/** Sweep expired approvals from 'pending' → 'expired'. Returns affected count. */
export async function expirePendingApprovals(now: number = Date.now()): Promise<number> {
  const res = (await getDb()
    .update(pendingApprovals)
    .set({ status: "expired", decidedAt: now })
    .where(
      and(
        eq(pendingApprovals.status, "pending"),
        lt(pendingApprovals.expiresAt, now)
      )
    )) as any;
  return Number(res?.affectedRows ?? 0);
}

/** Read the active tutor-roster override for the week containing dateStr (YYYY-MM-DD). */
export async function getRosterForWeek(
  dateStr: string
): Promise<TutorRosterOverride | null> {
  // Compute the Monday of dateStr's week.
  const d = new Date(`${dateStr}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  const day = d.getUTCDay(); // 0=Sun..6=Sat
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  const monday = d.toISOString().slice(0, 10);
  const rows = await getDb()
    .select()
    .from(tutorRosterOverride)
    .where(eq(tutorRosterOverride.weekStartDate, monday))
    .limit(1);
  return (rows[0] as TutorRosterOverride) ?? null;
}

/** Upsert a roster override row for a given Monday. */
export async function upsertRosterOverride(
  row: Omit<InsertTutorRosterOverride, "id" | "createdAt">
): Promise<void> {
  const existing = await getDb()
    .select({ id: tutorRosterOverride.id })
    .from(tutorRosterOverride)
    .where(eq(tutorRosterOverride.weekStartDate, row.weekStartDate))
    .limit(1);
  if (existing[0]) {
    await getDb()
      .update(tutorRosterOverride)
      .set({
        activeTutorNamesJson: row.activeTutorNamesJson,
        helperNamesJson: row.helperNamesJson,
        note: row.note ?? null,
      })
      .where(eq(tutorRosterOverride.id, existing[0].id));
  } else {
    await getDb()
      .insert(tutorRosterOverride)
      .values({ ...row, createdAt: Date.now() });
  }
}

/** List all active push targets (Mom + Grandma by default). */
export async function listActivePushTargets(): Promise<RecipientPushTarget[]> {
  return (await getDb()
    .select()
    .from(recipientPushTargets)
    .where(eq(recipientPushTargets.isActive, true))
    .orderBy(asc(recipientPushTargets.id))) as RecipientPushTarget[];
}

/**
 * v2.31 (2026-05-18) — Slice 3.5 phoneRecipients seed.
 *
 * Mom = 513-926-5808, Grandma Marcy = 513-646-9281.
 * Idempotent on `displayName` (which is unique). Only INSERTs if the row
 * doesn't already exist; never overwrites a manually-edited number.
 * Phones stored in E.164 (`+1...`) so downstream SMS providers receive
 * the canonical form. `role` mirrors the `permissions.HomeRole` vocabulary
 * so `parent` and `editor` both bypass the approval queue.
 */
export const SLICE_3_5_DEFAULT_PUSH_TARGETS = [
  // Existing live rows already use these short displayNames; the seeder is
  // idempotent on `displayName` so this matches the live DB exactly.
  { displayName: "Mom", role: "parent", phoneE164: "+15139265808" },
  { displayName: "Grandma", role: "grandparent", phoneE164: "+15136469281" },
] as const;

export async function ensureDefaultPushTargets(): Promise<{ inserted: number; existing: number }> {
  const existing = (await getDb()
    .select()
    .from(recipientPushTargets)) as RecipientPushTarget[];
  const existingNames = new Set(existing.map(r => r.displayName.trim().toLowerCase()));
  let inserted = 0;
  const now = Date.now();
  for (const seed of SLICE_3_5_DEFAULT_PUSH_TARGETS) {
    if (existingNames.has(seed.displayName.trim().toLowerCase())) continue;
    await getDb().insert(recipientPushTargets).values({
      displayName: seed.displayName,
      role: seed.role,
      phoneE164: seed.phoneE164,
      isActive: true,
      createdAt: now,
    });
    inserted++;
  }
  return { inserted, existing: existing.length };
}


/* ============================================================
 * Slice 4.5 — Actual-vs-Planned agenda helpers
 *
 * Source of truth: actualAgendaEntries. Curriculum coverage and
 * day-log Drive sync read from here. Planned scheduleBlocks are
 * still the original plan, displayed alongside but not authoritative
 * for "what was learned today".
 * ========================================================== */

/** Insert a single actual-agenda entry. Returns the inserted row id. */
export async function recordActualEntry(
  e: Omit<InsertActualAgendaEntry, "createdAt"> & { createdAt?: number },
): Promise<number> {
  const db = getDb();
  const now = e.createdAt ?? Date.now();
  const result: any = await db.insert(actualAgendaEntries).values({
    ...e,
    createdAt: now,
  });
  // Slice 4.5 push 8: every actual-entry write triggers a day-log
  // rebuild for that date, fire-and-forget. Failure here MUST NOT
  // block the original insert.
  void enqueueDayLogRebuildForDate(e.dateISO);
  // mysql2 returns { insertId } via drizzle's result wrapper
  return Number(result?.[0]?.insertId ?? result?.insertId ?? 0);
}

/** All actual entries for a date, oldest first. */
export async function listActualForDate(dateISO: string): Promise<ActualAgendaEntry[]> {
  return (await getDb()
    .select()
    .from(actualAgendaEntries)
    .where(eq(actualAgendaEntries.dateISO, dateISO))
    .orderBy(asc(actualAgendaEntries.createdAt))) as ActualAgendaEntry[];
}

/** Count actual entries for a date — used by 8 PM cron to decide whether
 *  to send the recap email. Voice-gating ensures Kiwi-only days come
 *  through here ONLY if they passed both voice + content classifiers. */
export async function countActualForDate(dateISO: string): Promise<number> {
  const rows = await getDb()
    .select({ id: actualAgendaEntries.id })
    .from(actualAgendaEntries)
    .where(eq(actualAgendaEntries.dateISO, dateISO));
  return rows.length;
}

/**
 * Push 39 (2026-05-13) — Mom-only undo for the Today quick-entry card.
 * We don't fully delete — we delete the row and trigger a day-log
 * rebuild so the Drive day-log stays consistent.
 */
export async function deleteActualEntry(id: number): Promise<void> {
  const rows = await getDb()
    .select({ dateISO: actualAgendaEntries.dateISO })
    .from(actualAgendaEntries)
    .where(eq(actualAgendaEntries.id, id));
  const dateISO = rows[0]?.dateISO ?? null;
  await getDb()
    .delete(actualAgendaEntries)
    .where(eq(actualAgendaEntries.id, id));
  if (dateISO) void enqueueDayLogRebuildForDate(dateISO);
}

/* ==========================================================
 * Slice 4.5 — Coverage delta + off-plan topic capture
 * ========================================================== */

export interface CoverageDeltaPlannedBlock {
  blockId: number;
  subjectSlug: string | null;
  title: string | null;
  status: string | null;
  curriculumTopicId: number | null;
}

export interface CoverageDeltaActualEntry {
  entryId: number;
  subjectSlug: string;
  topic: string;
  minutesSpent: number;
  source: string;
  plannedBlockId: number | null;
}

export interface CoverageDelta {
  plannedBlocks: CoverageDeltaPlannedBlock[];
  actualEntries: CoverageDeltaActualEntry[];
  /** Planned blocks for which an actual entry exists with matching plannedBlockId or subjectSlug+topic match. */
  matched: { blockId: number; entryIds: number[] }[];
  /** Planned blocks with NO matching actual entry (gaps in coverage). */
  unmatchedPlanned: CoverageDeltaPlannedBlock[];
  /** Actual entries with no matching planned block (off-plan topics). */
  unmatchedActual: CoverageDeltaActualEntry[];
  totalPlannedBlocks: number;
  totalActualEntries: number;
  coveragePercent: number; // matched / totalPlanned * 100, rounded
}

/**
 * Compute the planned-vs-actual coverage delta for a single date.
 * Pure function over plannedBlocks + actualEntries; no DB writes.
 * Matching rule: an actual entry matches a planned block if
 *   (a) actualEntry.plannedBlockId === plannedBlock.blockId, OR
 *   (b) plannedBlock.subjectSlug === actualEntry.subjectSlug AND
 *       case-insensitive substring overlap between block title and entry topic.
 */
export function getCoverageDelta(
  plannedBlocks: CoverageDeltaPlannedBlock[],
  actualEntries: CoverageDeltaActualEntry[],
): CoverageDelta {
  const matched: { blockId: number; entryIds: number[] }[] = [];
  const matchedActualIds = new Set<number>();
  const unmatchedPlanned: CoverageDeltaPlannedBlock[] = [];

  for (const pb of plannedBlocks) {
    const hits = actualEntries.filter((ae) => {
      if (ae.plannedBlockId === pb.blockId) return true;
      if (
        pb.subjectSlug &&
        ae.subjectSlug &&
        pb.subjectSlug === ae.subjectSlug
      ) {
        const t1 = (pb.title || "").toLowerCase();
        const t2 = ae.topic.toLowerCase();
        if (t1 && t2 && (t1.includes(t2) || t2.includes(t1))) return true;
      }
      return false;
    });
    if (hits.length > 0) {
      matched.push({ blockId: pb.blockId, entryIds: hits.map((h) => h.entryId) });
      for (const h of hits) matchedActualIds.add(h.entryId);
    } else {
      unmatchedPlanned.push(pb);
    }
  }

  const unmatchedActual = actualEntries.filter((ae) => !matchedActualIds.has(ae.entryId));
  const totalPlannedBlocks = plannedBlocks.length;
  const totalActualEntries = actualEntries.length;
  const coveragePercent =
    totalPlannedBlocks === 0 ? 0 : Math.round((matched.length / totalPlannedBlocks) * 100);

  return {
    plannedBlocks,
    actualEntries,
    matched,
    unmatchedPlanned,
    unmatchedActual,
    totalPlannedBlocks,
    totalActualEntries,
    coveragePercent,
  };
}

/**
 * Mark a curriculum topic as covered. Sets status to 'done' (not 'in_progress')
 * and stamps the source so analytics know whether it came from planned blocks,
 * actual entries, or grandma-recap. Returns true if a row was updated.
 */
export async function markTopicAsCovered(
  standardId: string,
  source: "planned-block" | "actual-entry" | "grandma-recap" | "tutor-note" | "kiwi-listened" | "manual",
): Promise<boolean> {
  const numId = Number(standardId);
  if (!Number.isFinite(numId) || numId <= 0) return false;
  const db = getDb();
  // curriculumTopics is accessed via raw SQL across the codebase (not in drizzle schema import).
  // bump to 'done' + stamp source provenance for analytics.
  const now = Date.now();
  const result: any = await db.execute(
    sql`UPDATE curriculumTopics
        SET status = 'done',
            completed_at = ${new Date(now)},
            last_covered_source = ${source},
            last_covered_at = ${now}
        WHERE id = ${numId}`,
  );
  return Number(result?.[0]?.affectedRows ?? result?.affectedRows ?? 0) > 0;
}

/**
 * Queue an off-plan topic for Drive sync. Inserts a row into topicsCoveredOffPlan
 * AND enqueues a drivePushQueue task targeting Curriculum and Standards/Topics Covered.
 * Idempotent: if an off-plan row already exists for (dateISO, subjectSlug, topic), reuse it.
 */
export async function queueOffPlanTopicForDriveSync(
  dateISO: string,
  subjectSlug: string,
  topic: string,
  sourceEntryId: number | null,
  contentMarkdown: string,
): Promise<{ topicId: number; queued: boolean }> {
  const db = getDb();
  const existing: any[] = await db
    .select()
    .from(topicsCoveredOffPlan)
    .where(
      and(
        eq(topicsCoveredOffPlan.dateISO, dateISO),
        eq(topicsCoveredOffPlan.subjectSlug, subjectSlug),
        eq(topicsCoveredOffPlan.topic, topic),
      ),
    )
    .limit(1);
  let topicId: number;
  if (existing.length > 0) {
    topicId = Number(existing[0].id);
  } else {
    const result: any = await db.insert(topicsCoveredOffPlan).values({
      dateISO,
      subjectSlug,
      topic,
      sourceEntryId: sourceEntryId ?? null,
      drivePushed: false,
      createdAt: Date.now(),
    } as any);
    topicId = Number(result?.[0]?.insertId ?? result?.insertId ?? 0);
  }
  // Enqueue Drive push targeting topics_covered routable target.
  const ym = dateISO.slice(0, 7); // YYYY-MM
  const safeName = topic.replace(/[^A-Za-z0-9]+/g, "_").slice(0, 80);
  const fileName = `${dateISO} - ${subjectSlug} - ${safeName}.md`;
  await db.insert(drivePushQueue).values({
    targetFolder: "topics_covered" as any,
    targetSubpath: ym,
    fileName,
    mimeType: "text/markdown",
    contentText: contentMarkdown,
    status: "pending" as any,
  } as any);
  // Slice 4.5 push 8: off-plan topic add also touches the day log.
  void enqueueDayLogRebuildForDate(dateISO);
  return { topicId, queued: true };
}

/** Coverage delta: which planned-block topics are NOT yet covered by any
 *  actual entry, AND which actual entries are off-plan (no matching block).
 *
 *  The match is a loose case-insensitive contains on title↔topic. This
 *  intentionally keeps the rule simple — adults review the off-plan list
 *  and approve/map them via the Topics Covered Drive doc.
 */
export function computeCoverageDelta(
  plannedBlocks: Array<{ id: number; title: string; subjectSlug?: string | null }>,
  actualEntries: Array<{ plannedBlockId: number | null; subjectSlug: string; topic: string }>,
): {
  coveredBlockIds: number[];
  uncoveredBlocks: Array<{ id: number; title: string }>;
  offPlanEntries: Array<{ subjectSlug: string; topic: string }>;
} {
  const coveredSet = new Set<number>();
  const offPlan: Array<{ subjectSlug: string; topic: string }> = [];
  for (const ae of actualEntries) {
    if (ae.plannedBlockId !== null) {
      coveredSet.add(ae.plannedBlockId);
      continue;
    }
    const norm = ae.topic.toLowerCase().trim();
    let matched: number | null = null;
    for (const b of plannedBlocks) {
      const t = b.title.toLowerCase();
      if (t.includes(norm) || norm.includes(t)) {
        matched = b.id;
        break;
      }
    }
    if (matched !== null) {
      coveredSet.add(matched);
    } else {
      offPlan.push({ subjectSlug: ae.subjectSlug, topic: ae.topic });
    }
  }
  const uncovered = plannedBlocks
    .filter((b) => !coveredSet.has(b.id))
    .map((b) => ({ id: b.id, title: b.title }));
  return {
    coveredBlockIds: Array.from(coveredSet),
    uncoveredBlocks: uncovered,
    offPlanEntries: offPlan,
  };
}

/** Insert an off-plan topic row (created by either the recap parser, the
 *  Kiwi-listened pipeline after passing voice+content gates, or an adult
 *  quick-entry where the topic doesn't match any planned block).
 *  The Drive push is performed separately by the driveSync module. */
export async function recordOffPlanTopic(
  e: Omit<InsertTopicCoveredOffPlan, "createdAt"> & { createdAt?: number },
): Promise<number> {
  const db = getDb();
  const result: any = await db.insert(topicsCoveredOffPlan).values({
    ...e,
    createdAt: e.createdAt ?? Date.now(),
  });
  return Number(result?.[0]?.insertId ?? result?.insertId ?? 0);
}

/** Mark an off-plan row as having been pushed to Drive. */
export async function markOffPlanDrivePushed(id: number, drivePath: string): Promise<void> {
  await getDb()
    .update(topicsCoveredOffPlan)
    .set({ drivePushed: true, drivePath })
    .where(eq(topicsCoveredOffPlan.id, id));
}

/**
 * Push 84 (2026-05-13) — Adult Today recap: "Off-plan capture summary".
 * Reads the topicsCoveredOffPlan rows for one date and rolls them up
 * into a single payload so the adult Today card can render counts +
 * per-row Drive push status. Pure read; no side effects.
 */
export async function offPlanCaptureSummaryForDate(dateISO: string): Promise<{
  totalCount: number;
  drivePushedCount: number;
  pendingCount: number;
  items: Array<{
    id: number;
    subjectSlug: string;
    topic: string;
    drivePushed: boolean;
    drivePath: string | null;
  }>;
}> {
  const rows: any[] = await getDb()
    .select({
      id: topicsCoveredOffPlan.id,
      subjectSlug: topicsCoveredOffPlan.subjectSlug,
      topic: topicsCoveredOffPlan.topic,
      drivePushed: topicsCoveredOffPlan.drivePushed,
      drivePath: topicsCoveredOffPlan.drivePath,
    })
    .from(topicsCoveredOffPlan)
    .where(eq(topicsCoveredOffPlan.dateISO, dateISO));
  const items = rows.map((r: any) => ({
    id: Number(r.id),
    subjectSlug: String(r.subjectSlug),
    topic: String(r.topic),
    drivePushed: Boolean(r.drivePushed),
    drivePath: r.drivePath ?? null,
  }));
  const drivePushedCount = items.filter((i) => i.drivePushed).length;
  return {
    totalCount: items.length,
    drivePushedCount,
    pendingCount: items.length - drivePushedCount,
    items,
  };
}

/** Create a recap-request row at 8 PM when a date has no actual entries.
 *  Returns the reply token the email should embed in its magic link. */
export async function createRecapRequest(opts: {
  dateISO: string;
  sentTo: string;
  replyToken: string;
}): Promise<number> {
  const db = getDb();
  const result: any = await db.insert(dailyRecapRequests).values({
    dateISO: opts.dateISO,
    sentTo: opts.sentTo,
    sentAt: Date.now(),
    replyToken: opts.replyToken,
    status: "sent",
    parsedEntriesCount: 0,
  });
  return Number(result?.[0]?.insertId ?? result?.insertId ?? 0);
}

/** Look up a pending recap request by token; null if expired/replied/missing. */
export async function getRecapRequestByToken(
  token: string,
): Promise<DailyRecapRequest | null> {
  const rows = (await getDb()
    .select()
    .from(dailyRecapRequests)
    .where(eq(dailyRecapRequests.replyToken, token))
    .limit(1)) as DailyRecapRequest[];
  return rows[0] ?? null;
}

/** Mark a recap request as replied; record raw text + parsed count. */
export async function markRecapReplied(
  id: number,
  rawReplyText: string,
  parsedEntriesCount: number,
): Promise<void> {
  await getDb()
    .update(dailyRecapRequests)
    .set({
      status: "replied",
      repliedAt: Date.now(),
      rawReplyText,
      parsedEntriesCount,
    })
    .where(eq(dailyRecapRequests.id, id));
}

/** Has ANY recap request for this date already been replied?
 *  Used to enforce "first reply wins" across Mom + Grandma + tutors. */
export async function isRecapAlreadyAnswered(dateISO: string): Promise<boolean> {
  const rows = await getDb()
    .select({ id: dailyRecapRequests.id })
    .from(dailyRecapRequests)
    .where(and(
      eq(dailyRecapRequests.dateISO, dateISO),
      eq(dailyRecapRequests.status, "replied"),
    ));
  return rows.length > 0;
}


/** Recap requests still awaiting a reply, oldest first. Used by the external
 *  mailer agent to know which (recipient, token) pairs need an outbound email. */
export async function listPendingRecapRequests(limit = 50): Promise<DailyRecapRequest[]> {
  return (await getDb()
    .select()
    .from(dailyRecapRequests)
    .where(eq(dailyRecapRequests.status, "sent"))
    .orderBy(asc(dailyRecapRequests.sentAt))
    .limit(limit)) as DailyRecapRequest[];
}


/* -------------------------------------------------------------------------- */
/*  KID REQUESTS — push 26 (2026-05-12)                                       */
/* -------------------------------------------------------------------------- */
/**
 * Recipient list for any "Reagan made a request" email. Wired here as
 * a single source of truth so future SMTP integration is one line.
 * Mom, Dad, Grandma Marcy.
 */
export const KID_REQUEST_RECIPIENTS = [
  "spear.cpt@gmail.com",     // Mom
  "blakehiggs@hotmail.com",  // Dad
  "marcy.spear@gmail.com",   // Grandma Marcy
] as const;

export async function createKidRequest(input: {
  body: string;
  kind: "general" | "schedule" | "stuck" | "feeling";
  fromUserId: number | null;
}): Promise<{ id: number; emailedTo: string; notifyOwnerOk: boolean }> {
  const db = getDb();
  const emailedTo = KID_REQUEST_RECIPIENTS.join(",");
  const [res]: any = await db.insert(kidRequests).values({
    fromUserId: input.fromUserId,
    body: input.body,
    kind: input.kind,
    createdAt: Date.now(),
    emailedTo,
    notifyOwnerOk: false, // server flips this after notifyOwner returns true
  } as any);
  const id = (res as any)?.insertId as number;
  return { id, emailedTo, notifyOwnerOk: false };
}

export async function listKidRequests(includeResolved = false, limit = 50): Promise<KidRequest[]> {
  const db = getDb();
  const rows: any = includeResolved
    ? await db.select().from(kidRequests).orderBy(desc(kidRequests.createdAt)).limit(limit)
    : await db.select().from(kidRequests).where(isNull(kidRequests.resolvedAt)).orderBy(desc(kidRequests.createdAt)).limit(limit);
  return rows as KidRequest[];
}

export async function countUnresolvedKidRequests(): Promise<number> {
  const db = getDb();
  const rows: any = await db.select().from(kidRequests).where(isNull(kidRequests.resolvedAt));
  return (rows as any[]).length;
}

export async function resolveKidRequest(
  id: number,
  resolvedByUserId: number | null,
  note?: string
): Promise<{ resolved: boolean }> {
  const db = getDb();
  await db.update(kidRequests).set({
    resolvedAt: Date.now(),
    resolvedByUserId,
    resolvedNote: note ?? null,
  } as any).where(eq(kidRequests.id, id));
  return { resolved: true };
}

export async function markKidRequestNotified(id: number, ok: boolean): Promise<void> {
  const db = getDb();
  await db.update(kidRequests).set({ notifyOwnerOk: ok } as any).where(eq(kidRequests.id, id));
}


/* ----------------------------------------------------------------- */
/*  Push 29 (2026-05-13) — Q4 Standards seeder bridge                  */
/*  Idempotent insert from server/_knowledge/q4_standards.txt into     */
/*  curriculumTopics. Never modifies existing rows.                    */
/* ----------------------------------------------------------------- */

export async function seedQ4Standards(): Promise<{ inserted: number; total: number }> {
  const { seedQ4StandardsIfMissing } = await import("./_lib/q4StandardsSeeder");
  const db = getDb();
  return seedQ4StandardsIfMissing({
    listExisting: async () => {
      const rows: any = await db.execute(sql`SELECT subject, code FROM curriculumTopics`);
      return ((rows?.[0] ?? rows) as Array<{ subject: string; code: string }>) ?? [];
    },
    insert: async (toInsert) => {
      // Find current max ord per subject so we append cleanly.
      const ordRows: any = await db.execute(sql`
        SELECT subject, COALESCE(MAX(ord), -1) AS maxOrd
        FROM curriculumTopics
        GROUP BY subject
      `);
      const ordBySubject = new Map<string, number>();
      for (const r of (ordRows?.[0] ?? ordRows) as Array<{ subject: string; maxOrd: number }>) {
        ordBySubject.set(r.subject, Number(r.maxOrd ?? -1));
      }
      for (const r of toInsert) {
        const baseOrd = ordBySubject.get(r.subject) ?? -1;
        const nextOrd = baseOrd + 1;
        ordBySubject.set(r.subject, nextOrd);
        await db.execute(sql`
          INSERT INTO curriculumTopics (subject, code, title, standard_ref, ord, quarter)
          VALUES (${r.subject}, ${r.code}, ${r.title}, ${r.standardRef}, ${nextOrd}, ${r.quarter})
        `);
      }
    },
  });
}

/* ============================================================================
 * PUSH 34 (2026-05-13) — Mom-only daily analytics CSV builder + Drive enqueue
 * ----------------------------------------------------------------------------
 * Pulls together the day's listening behavior, kiwi-chat behavior, planned-vs-
 * completed block counts, IEP goal Behind/On/Ahead bucket counts, and off-plan
 * topic count into one canonical CSV row. Persisted to Drive at:
 *   Progress and Reports / Analytics CSV Exports / {YYYY-MM} / {date} - Daily
 *   Analytics.csv
 *
 * Idempotent: re-running for the same date is safe — the underlying queries
 * are read-only, and the Drive enqueue uses contentText-equality skip.
 *
 * Adult-only — exposed via the `curriculum.exportDailyAnalytics` familyAdmin
 * tRPC mutation.
 * ========================================================================== */

export async function buildDailyAnalyticsCsvForDate(dateISO: string): Promise<{
  csv: string;
  fileName: string;
  subpath: string;
  bytes: number;
}> {
  const {
    buildDailyAnalyticsCsv,
    dailyAnalyticsFileName,
    dailyAnalyticsSubpath,
    bucketIepGoal,
  } = await import("./_lib/dailyAnalyticsCsv");

  // ---- Listening behavior + aggregate (today only) -----------------------
  const listeningRows = await listListeningSummariesForDate(dateISO);
  const behavior = await listeningBehaviorForDate(dateISO);
  const dayAgg = aggregateListeningDay(listeningRows as any[]);

  const listening = behavior
    ? {
        relevantCount: behavior.relevantCount,
        droppedCount: behavior.droppedCount,
        focusPct: behavior.focusPct,
        offTask: behavior.offTask,
        distractions: behavior.distractions,
        topTopic: behavior.topTopic,
        avgEmotion: dayAgg.avgEmotion,
        avgComfort: dayAgg.avgComfort,
        avgDifficulty: dayAgg.avgDifficulty,
        avgTalkativeness: dayAgg.avgTalkativeness,
        minutesOnTask: dayAgg.minutesOnTask,
      }
    : null;

  // ---- Kiwi-chat behavior -----------------------------------------------
  const kiwi = await kiwiBehaviorForDate(dateISO);
  const kiwiBlock = kiwi
    ? {
        interactions: kiwi.interactions,
        userMessages: kiwi.userMessages,
        aiMessages: kiwi.aiMessages,
        kiwiInitiatedCount: kiwi.kiwiInitiatedCount,
        topTopic: kiwi.topTopic,
        topTopicCount: kiwi.topTopicCount,
      }
    : null;

  // ---- Block totals -----------------------------------------------------
  const plan = await getPlanByDate(dateISO);
  let plannedTotal = 0;
  let completedTotal = 0;
  let skippedTotal = 0;
  if (plan) {
    const blocks: any[] = await listBlocksForPlan((plan as any).id);
    plannedTotal = blocks.length;
    completedTotal = blocks.filter((b) => b.status === "complete").length;
    skippedTotal = blocks.filter((b) => b.status === "skipped").length;
  }

  // ---- Coverage per subject (planned-vs-completed) ----------------------
  const coverage = await coverageForDate(dateISO);

  // ---- IEP buckets ------------------------------------------------------
  const iepGoals = await listIepGoals();
  const iepBuckets = { behind: 0, onTrack: 0, ahead: 0 };
  for (const g of iepGoals as any[]) {
    const b = bucketIepGoal({
      status: g.status,
      currentPercent: g.currentPercent,
      targetPercent: g.targetPercent,
    });
    if (b === "behind") iepBuckets.behind += 1;
    else if (b === "ahead") iepBuckets.ahead += 1;
    else iepBuckets.onTrack += 1;
  }

  // ---- Off-plan topics for this date -----------------------------------
  const offPlanRows: any[] = await getDb()
    .select({ id: topicsCoveredOffPlan.id })
    .from(topicsCoveredOffPlan)
    .where(eq(topicsCoveredOffPlan.dateISO, dateISO));

  const csv = buildDailyAnalyticsCsv({
    dateISO,
    listening,
    kiwi: kiwiBlock,
    coverage: coverage as any,
    blocks: { plannedTotal, completedTotal, skippedTotal },
    iep: iepBuckets,
    offPlanTopicsCount: offPlanRows.length,
  });
  const fileName = dailyAnalyticsFileName(dateISO);
  const subpath = dailyAnalyticsSubpath(dateISO);
  const bytes = new TextEncoder().encode(csv).length;
  return { csv, fileName, subpath, bytes };
}

/**
 * Enqueue the day's analytics CSV to Drive. Idempotent: skips if a
 * pending row with the same contentText already exists.
 */
export async function enqueueDailyAnalyticsExport(
  dateISO: string,
): Promise<{
  ok: boolean;
  alreadyQueued: boolean;
  bytes: number;
  fileName: string;
  reason?: string;
}> {
  try {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateISO)) {
      return { ok: false, alreadyQueued: false, bytes: 0, fileName: "", reason: "bad-date" };
    }
    const { csv, fileName, subpath, bytes } = await buildDailyAnalyticsCsvForDate(dateISO);
    const db = getDb();
    let alreadyQueued = false;
    try {
      const existing: any[] = await db
        .select()
        .from(drivePushQueue)
        .where(
          and(
            eq(drivePushQueue.targetFolder as any, "analytics" as any),
            eq(drivePushQueue.targetSubpath as any, subpath as any),
            eq(drivePushQueue.fileName as any, fileName as any),
            eq(drivePushQueue.status as any, "pending" as any),
          ),
        );
      if (existing.some((row: any) => row?.contentText === csv)) {
        alreadyQueued = true;
      }
    } catch {
      /* non-fatal */
    }
    if (!alreadyQueued) {
      await db.insert(drivePushQueue).values({
        targetFolder: "analytics" as any,
        targetSubpath: subpath,
        fileName,
        mimeType: "text/csv",
        contentText: csv,
        status: "pending" as any,
      } as any);
    }
    return { ok: true, alreadyQueued, bytes, fileName };
  } catch (e: any) {
    return {
      ok: false,
      alreadyQueued: false,
      bytes: 0,
      fileName: "",
      reason: e?.message ?? "exception",
    };
  }
}

/* ============================================================================
 * PUSH 35 (2026-05-13) — Agenda change-detection enqueue
 * ----------------------------------------------------------------------------
 * Inserts a `nightlyAgendaEmails` placeholder row tagged `triggerKind:
 * 'change_resend'` so the nightly handler (or a 7 AM "morning resend"
 * tick) will pick it up and re-send the agenda IF its current content
 * hash differs from the last sent row's hash. The handler's existing
 * idempotency branch (same hash + status='sent' + !force) means we can
 * mark dirty defensively — duplicate resends never go out.
 *
 * Called from `updateBlock` whenever a block edit on a date >= today
 * actually changes a field that the email body shows: title,
 * subjectId, startTime, durationMin, status, sortOrder, description,
 * curriculumTopicId. Pure flag-flip + idempotent insert — never throws.
 *
 * Spec items closed:
 *   - "8 PM nightly packet must re-send if Mom edits the schedule
 *      before school start"
 *   - "Add agenda-change resend pipeline"
 * ========================================================================== */
export async function markAgendaDirtyForDate(
  dateISO: string,
  reason: string = "block_edit",
): Promise<{ enqueued: boolean }> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateISO)) {
    return { enqueued: false };
  }
  // Skip past dates — no point resending yesterday's email.
  const today = new Date().toISOString().slice(0, 10);
  if (dateISO < today) {
    return { enqueued: false };
  }
  try {
    // Idempotency: if a queued change_resend row already exists for this
    // date, don't add another one.
    const existing = await getDb()
      .select({ id: nightlyAgendaEmails.id })
      .from(nightlyAgendaEmails)
      .where(
        and(
          eq(nightlyAgendaEmails.forDate, dateISO),
          eq(nightlyAgendaEmails.status, "queued"),
          eq(nightlyAgendaEmails.triggerKind, "change_resend"),
        ),
      )
      .limit(1);
    if (existing.length > 0) {
      return { enqueued: false };
    }
    await insertNightlyAgendaEmail({
      forDate: dateISO,
      recipients: "",
      agendaHash: "dirty_" + Date.now().toString(36),
      blockCount: 0,
      status: "queued",
      triggerKind: "change_resend",
      errorMessage: reason,
    });
    return { enqueued: true };
  } catch {
    return { enqueued: false };
  }
}

/* ============================================================================
 * PUSH 37 (2026-05-13) — Tomorrow's draft preview for Curriculum hub
 * ----------------------------------------------------------------------------
 * Pure read helper used by the Curriculum page's pinned "Tomorrow's draft"
 * strip. The 9 PM `nightly-lesson-gen` cron already commits a fresh plan
 * for the next school day; this helper just reports what got committed so
 * Mom can see — at a glance, the first thing she opens in the morning —
 * whether the nightly draft actually ran AND what's queued.
 *
 * Returns:
 *   - `dateISO` / `dayLabel` for the next school day (skips Sat/Sun)
 *   - `planExists`: did `ensurePlanForDate` ever create a row?
 *   - `blockCount`: how many blocks committed
 *   - `subjects[]`: distinct subject names covered, in plan order
 *   - `firstBlockTitle`: helpful glance at the first activity
 *   - `lastGeneratedAt`: max `createdAt` across the tomorrow blocks (or
 *     null when planExists but blocks=0; signals "draft is empty")
 *
 * No mutation, no Drive enqueue, no auth — safe for the Curriculum hub's
 * familyAdmin context.
 * ========================================================================== */
export async function getTomorrowDraftPreview(): Promise<{
  dateISO: string;
  dayLabel: string;
  planExists: boolean;
  blockCount: number;
  subjects: string[];
  firstBlockTitle: string | null;
  lastGeneratedAt: number | null;
}> {
  // Compute next school day, skipping Sat (6) + Sun (0).
  const now = new Date();
  let target = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  while (target.getDay() === 0 || target.getDay() === 6) {
    target = new Date(target.getTime() + 24 * 60 * 60 * 1000);
  }
  const dateISO = target.toISOString().slice(0, 10);
  const dayLabel = target.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  const plan = await getPlanByDate(dateISO);
  if (!plan) {
    return {
      dateISO,
      dayLabel,
      planExists: false,
      blockCount: 0,
      subjects: [],
      firstBlockTitle: null,
      lastGeneratedAt: null,
    };
  }
  const blocks = (await listBlocksForPlan(plan.id)) as any[];
  if (blocks.length === 0) {
    return {
      dateISO,
      dayLabel,
      planExists: true,
      blockCount: 0,
      subjects: [],
      firstBlockTitle: null,
      lastGeneratedAt: null,
    };
  }
  // Resolve subject names.
  const subjList = (await listSubjects()) as any[];
  const idToName = new Map<number, string>(subjList.map((s) => [s.id as number, s.name as string]));
  const seen = new Set<string>();
  const subjectsOrdered: string[] = [];
  for (const b of blocks) {
    const name = b.subjectId ? idToName.get(b.subjectId) : null;
    if (name && !seen.has(name)) {
      seen.add(name);
      subjectsOrdered.push(name);
    }
  }
  const sorted = [...blocks].sort(
    (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0),
  );
  const firstBlockTitle = sorted[0]?.title ?? null;
  // Estimate generation time from max createdAt of the blocks.
  let maxCreated = 0;
  for (const b of blocks) {
    const t = b.createdAt instanceof Date ? b.createdAt.getTime() : (typeof b.createdAt === "number" ? b.createdAt : 0);
    if (t > maxCreated) maxCreated = t;
  }
  return {
    dateISO,
    dayLabel,
    planExists: true,
    blockCount: blocks.length,
    subjects: subjectsOrdered,
    firstBlockTitle,
    lastGeneratedAt: maxCreated || null,
  };
}


/**
 * Push 40 (2026-05-13) — Actual-vs-Planned per-block strip.
 *
 * Single-call helper that returns, for the given dateISO:
 *   - the planned schedule blocks for the day, and
 *   - the list of actual entries pinned to each block (one row maps to
 *     0..N actuals), plus loose-matched actuals via computeCoverageDelta,
 *   - the list of off-plan actual entries that didn't map anywhere.
 *
 * Used by Today.tsx + Schedule.tsx to render a small chip strip under
 * every planned block:
 *
 *     [Planned: Long division] [✓ actual: 22 min — Mom] [+ off-plan]
 *
 * One database call from the client, no waterfalls.
 */
export interface ActualVsPlannedBlock {
  id: number;
  title: string;
  subjectSlug: string | null;
  status: string | null;
  startTime: number;
  durationMin: number;
  actuals: Array<{
    id: number;
    topic: string;
    minutesSpent: number;
    source: string;
    notes: string | null;
    pinned: boolean; // true if plannedBlockId === id, false if loose-matched by title
  }>;
}

export interface ActualVsPlannedForDate {
  dateISO: string;
  blocks: ActualVsPlannedBlock[];
  offPlanActuals: Array<{
    id: number;
    subjectSlug: string;
    topic: string;
    minutesSpent: number;
    source: string;
    notes: string | null;
  }>;
  totals: {
    plannedBlocks: number;
    plannedDone: number;
    actualEntries: number;
    actualMinutes: number;
  };
}

export async function getActualVsPlannedForDate(dateISO: string): Promise<ActualVsPlannedForDate> {
  // Resolve the daily plan for the date. If there's no plan we still
  // return a useful object so the strip can show "no plan, here's what
  // they did anyway".
  const plan = await getDb()
    .select()
    .from(dailyPlans)
    .where(sql`DATE(${dailyPlans.date}) = ${dateISO}`)
    .limit(1);
  const planRow = plan[0] ?? null;
  const blocks: Array<any> = planRow
    ? await getDb()
        .select()
        .from(scheduleBlocks)
        .where(eq(scheduleBlocks.planId, planRow.id))
        .orderBy(asc(scheduleBlocks.startTime))
    : [];
  const actuals = await listActualForDate(dateISO);

  // Pinned-by-id first.
  const byId = new Map<number, ActualVsPlannedBlock>();
  for (const b of blocks) {
    byId.set(b.id, {
      id: b.id,
      title: b.title,
      subjectSlug: b.subjectSlug ?? null,
      status: b.status ?? null,
      startTime: b.startTime,
      durationMin: b.durationMin,
      actuals: [],
    });
  }
  const offPlan: ActualVsPlannedForDate["offPlanActuals"] = [];

  for (const ae of actuals) {
    if (ae.plannedBlockId && byId.has(ae.plannedBlockId)) {
      byId.get(ae.plannedBlockId)!.actuals.push({
        id: ae.id,
        topic: ae.topic,
        minutesSpent: ae.minutesSpent,
        source: ae.source,
        notes: ae.notes ?? null,
        pinned: true,
      });
      continue;
    }
    // Loose match by title contains topic (same rule as computeCoverageDelta).
    const norm = ae.topic.toLowerCase().trim();
    let matchedId: number | null = null;
    for (const b of blocks) {
      const t = (b.title ?? "").toLowerCase();
      if (t && (t.includes(norm) || norm.includes(t))) {
        matchedId = b.id;
        break;
      }
    }
    if (matchedId !== null) {
      byId.get(matchedId)!.actuals.push({
        id: ae.id,
        topic: ae.topic,
        minutesSpent: ae.minutesSpent,
        source: ae.source,
        notes: ae.notes ?? null,
        pinned: false,
      });
    } else {
      offPlan.push({
        id: ae.id,
        subjectSlug: ae.subjectSlug,
        topic: ae.topic,
        minutesSpent: ae.minutesSpent,
        source: ae.source,
        notes: ae.notes ?? null,
      });
    }
  }

  const blocksOut = Array.from(byId.values());
  const plannedDone = blocksOut.filter((b) => b.status === "done" || b.actuals.length > 0).length;
  const actualMinutes = actuals.reduce((s, a) => s + (a.minutesSpent || 0), 0);

  return {
    dateISO,
    blocks: blocksOut,
    offPlanActuals: offPlan,
    totals: {
      plannedBlocks: blocksOut.length,
      plannedDone,
      actualEntries: actuals.length,
      actualMinutes,
    },
  };
}


/**
 * Push 41 (2026-05-13) — Mood timeline strip on Today.
 *
 * Returns a thin, plot-ready slice of listeningSummaries for the date,
 * down-sampled into ~12 visual bins across the school day window.
 *
 * Why this lives in db.ts:
 *   - aggregateListeningDay returns whole-day averages, not a timeline.
 *   - the recap email + Analytics may want the same shape later, so we
 *     keep one source of truth.
 *
 * The bins are evenly spaced from periodStart-of-day to periodEnd-of-day.
 * Each bin reports avg emotion (-100..100) and avg comfort (0..100) of
 * the chunks whose periodStart falls inside it, plus an inferred mood
 * label using the same thresholds the day-log uses. Chunks with
 * relevanceScore < 50 are excluded so background noise + sibling chatter
 * don't drag the strip down.
 */
export interface MoodTimelinePoint {
  binIndex: number;
  bucketStart: number; // unix ms
  bucketEnd: number;
  count: number;
  avgEmotion: number | null;
  avgComfort: number | null;
  mood: "green" | "yellow" | "red" | null;
}

export interface MoodTimelineForDate {
  dateISO: string;
  bins: MoodTimelinePoint[];
  totals: { chunks: number; relevantChunks: number };
}

function classifyMoodFromScores(emotion: number | null, comfort: number | null): MoodTimelinePoint["mood"] {
  if (emotion === null && comfort === null) return null;
  const e = emotion ?? 0;
  const c = comfort ?? 50;
  if (e <= -30 || c <= 30) return "red";
  if (e <= 10 || c <= 60) return "yellow";
  return "green";
}

export async function buildMoodTimelineForDate(
  dateISO: string,
  binCount: number = 12,
): Promise<MoodTimelineForDate> {
  const rows: any[] = await listListeningSummariesForDate(dateISO);
  const relevant = rows.filter((r: any) => (r.relevanceScore ?? 100) >= 50);
  if (relevant.length === 0) {
    return {
      dateISO,
      bins: [],
      totals: { chunks: rows.length, relevantChunks: 0 },
    };
  }
  const starts = relevant.map((r: any) => new Date(r.periodStart).getTime());
  const ends = relevant.map((r: any) => new Date(r.periodEnd).getTime());
  const minT = Math.min(...starts);
  const maxT = Math.max(...ends);
  // Avoid zero-width when there's a single chunk: spread it over 1 hour.
  const span = Math.max(maxT - minT, 60 * 60 * 1000);
  const step = Math.max(1, Math.floor(span / binCount));

  const bins: MoodTimelinePoint[] = [];
  for (let i = 0; i < binCount; i++) {
    const bucketStart = minT + i * step;
    const bucketEnd = i === binCount - 1 ? maxT : bucketStart + step;
    const inBin = relevant.filter((r: any) => {
      const t = new Date(r.periodStart).getTime();
      return t >= bucketStart && t < bucketEnd + (i === binCount - 1 ? 1 : 0);
    });
    if (inBin.length === 0) {
      bins.push({ binIndex: i, bucketStart, bucketEnd, count: 0, avgEmotion: null, avgComfort: null, mood: null });
      continue;
    }
    const e = inBin
      .map((r: any) => r.emotionScore)
      .filter((v: any) => typeof v === "number") as number[];
    const c = inBin
      .map((r: any) => r.comfortScore)
      .filter((v: any) => typeof v === "number") as number[];
    const avgE = e.length ? e.reduce((s, v) => s + v, 0) / e.length : null;
    const avgC = c.length ? c.reduce((s, v) => s + v, 0) / c.length : null;
    bins.push({
      binIndex: i,
      bucketStart,
      bucketEnd,
      count: inBin.length,
      avgEmotion: avgE === null ? null : Math.round(avgE),
      avgComfort: avgC === null ? null : Math.round(avgC),
      mood: classifyMoodFromScores(avgE, avgC),
    });
  }
  return {
    dateISO,
    bins,
    totals: { chunks: rows.length, relevantChunks: relevant.length },
  };
}


/* -------------------------------------------------------------------------- *
 * Push 45 (2026-05-13) — Catch-up engine                                       *
 *                                                                             *
 * Spec: "Per-subject mastery % + traffic light + next-3 topics".               *
 *                                                                             *
 * Design notes:                                                                *
 *   - "Mastery %" is the same metric Reagan + Mom already see on the           *
 *     Curriculum hub: done / total curriculum topics in that subject. It is    *
 *     the most legible single number and lines up with the topic list adults   *
 *     already act on. Coverage-for-date / actuals do not roll into mastery     *
 *     because they describe *today*, not lifetime progress.                    *
 *   - Traffic light thresholds are explicit (not magic numbers): green ≥ 67%,  *
 *     yellow 34–66%, red ≤ 33%. They mirror Reagan-on-track expectations for   *
 *     Q4 / EOY grade level.                                                    *
 *   - "Next 3" pulls the lowest-ord open topics for each subject. We bias      *
 *     toward `inProgress` first so a half-started topic finishes before a      *
 *     brand-new one — that's how a real catch-up plan should work.             *
 *   - Subject slug mapping reuses the same conventions the rest of db.ts uses  *
 *     (math/ela/science/social-studies). Anything else is preserved as-is so   *
 *     the engine never silently drops curriculum subjects we added later.     *
 * -------------------------------------------------------------------------- */

export type CatchUpTrafficLight = "green" | "yellow" | "red";

export interface CatchUpNextTopic {
  id: number;
  code: string;
  title: string;
  status: "notStarted" | "inProgress";
  khanUrl: string | null;
  ixlUrl: string | null;
}

export interface CatchUpSubject {
  subjectName: string;
  subjectSlug: string;
  done: number;
  total: number;
  masteryPct: number;
  trafficLight: CatchUpTrafficLight;
  nextThree: CatchUpNextTopic[];
}

/**
 * Translate the lifetime done/total ratio into a clear traffic-light bucket.
 * Edge case: if total is 0 (a subject with no curriculum rows yet) we return
 * "yellow" so the UI doesn't false-alarm in red. Mom can still see the 0/0
 * and ignore.
 */
export function catchUpTrafficLightForPct(masteryPct: number, total: number): CatchUpTrafficLight {
  if (total === 0) return "yellow";
  if (masteryPct >= 67) return "green";
  if (masteryPct >= 34) return "yellow";
  return "red";
}

/** Map the legacy curriculumTopics.subject TitleCase strings to our slug. */
function catchUpSubjectSlugFor(subject: string): string {
  const s = subject.trim().toLowerCase();
  if (s === "math") return "math";
  if (s === "english language arts" || s === "ela") return "ela";
  if (s === "science") return "science";
  if (s === "social studies" || s === "social-studies") return "social-studies";
  if (s === "life skills" || s === "life-skills") return "life-skills";
  return s.replace(/\s+/g, "-");
}

export async function getCatchUpRollup(): Promise<CatchUpSubject[]> {
  const db = getDb();
  // (a) lifetime totals per subject — same numerator/denominator as the hub.
  const totals: any = (await db.execute(sql`
    SELECT subject,
           SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) AS done,
           COUNT(*) AS total
      FROM curriculumTopics
     GROUP BY subject
     ORDER BY subject ASC
  `))[0];
  const out: CatchUpSubject[] = [];
  for (const t of totals as any[]) {
    const subjectName = String(t.subject);
    const done = Number(t.done ?? 0);
    const total = Number(t.total ?? 0);
    const masteryPct = total > 0 ? Math.round((done / total) * 100) : 0;
    const trafficLight = catchUpTrafficLightForPct(masteryPct, total);

    // (b) next 3 open topics — inProgress first, then notStarted, ord ASC.
    const next: any = (await db.execute(sql`
      SELECT id, code, title, status,
             khan_url AS khanUrl, ixl_url AS ixlUrl
        FROM curriculumTopics
       WHERE subject = ${subjectName}
         AND status <> 'done'
       ORDER BY CASE WHEN status = 'inProgress' THEN 0 ELSE 1 END ASC,
                ord ASC
       LIMIT 3
    `))[0];
    const nextThree: CatchUpNextTopic[] = (next as any[]).map((r) => ({
      id: Number(r.id),
      code: String(r.code),
      title: String(r.title),
      status: (r.status === "inProgress" ? "inProgress" : "notStarted") as
        | "notStarted"
        | "inProgress",
      khanUrl: r.khanUrl ? String(r.khanUrl) : null,
      ixlUrl: r.ixlUrl ? String(r.ixlUrl) : null,
    }));

    out.push({
      subjectName,
      subjectSlug: catchUpSubjectSlugFor(subjectName),
      done,
      total,
      masteryPct,
      trafficLight,
      nextThree,
    });
  }
  return out;
}


/* -------------------------------------------------------------------------- *
 * Push 46 (2026-05-13) — Settings → Daily Recap panel                          *
 *                                                                             *
 * "Daily Recap" is the OUTBOUND end-of-day digest that goes to Mom +           *
 * Grandma + any opted-in tutors after Reagan's school day. Distinct from       *
 * the existing daily-recap-send endpoint, which is the INBOUND ask-for-a-      *
 * recap workflow when no actual entries exist.                                 *
 *                                                                             *
 * Persisted prefs (in appSettings, single source of truth):                    *
 *   - recap.enabled           "1" | "0"   default off                          *
 *   - recap.sendTimeET        "HH:MM" 24h  default "18:00"                     *
 *   - recap.includeKiwi       "1" | "0"   default "1"                          *
 *   - recap.includeMood       "1" | "0"   default "1"                          *
 *   - recap.recipients        JSON: email[]; falls back to listRecipients()    *
 *                                                                             *
 * The actual send is wired by a future Heartbeat cron; this push owns the      *
 * data model + the live HTML preview Mom can see right inside Settings so      *
 * she can decide whether to turn it on. Pure functions are exported so the     *
 * preview composes deterministically against `loadDayLogPayload` output.       *
 * -------------------------------------------------------------------------- */

export interface DailyRecapPrefs {
  enabled: boolean;
  sendTimeET: string;     // "HH:MM" 24-hour, ET
  includeKiwi: boolean;   // include "Kiwi heard" listening focus block
  includeMood: boolean;   // include mood-timeline bar
  recipients: string[];   // explicit override; empty array means "use listRecipients()"
}

const RECAP_PREF_KEYS = {
  enabled: "recap.enabled",
  sendTimeET: "recap.sendTimeET",
  includeKiwi: "recap.includeKiwi",
  includeMood: "recap.includeMood",
  recipients: "recap.recipients",
} as const;

/** Read all recap prefs in one shot. Falls back to safe defaults. */
export async function getDailyRecapPrefs(): Promise<DailyRecapPrefs> {
  const [enabled, sendTimeET, includeKiwi, includeMood, recipientsRaw] = await Promise.all([
    getAppSetting(RECAP_PREF_KEYS.enabled),
    getAppSetting(RECAP_PREF_KEYS.sendTimeET),
    getAppSetting(RECAP_PREF_KEYS.includeKiwi),
    getAppSetting(RECAP_PREF_KEYS.includeMood),
    getAppSetting(RECAP_PREF_KEYS.recipients),
  ]);
  let recipients: string[] = [];
  if (recipientsRaw) {
    try {
      const parsed = JSON.parse(recipientsRaw);
      if (Array.isArray(parsed)) recipients = parsed.filter((s) => typeof s === "string");
    } catch {
      // tolerate bad JSON — treat as no override
    }
  }
  return {
    enabled: enabled === "1",
    sendTimeET: /^\d{2}:\d{2}$/.test(sendTimeET || "") ? (sendTimeET as string) : "18:00",
    includeKiwi: includeKiwi !== "0",
    includeMood: includeMood !== "0",
    recipients,
  };
}

/** Persist a partial patch — only writes the keys actually present. */
export async function setDailyRecapPrefs(patch: Partial<DailyRecapPrefs>): Promise<DailyRecapPrefs> {
  if (patch.enabled !== undefined) {
    await setAppSetting(RECAP_PREF_KEYS.enabled, patch.enabled ? "1" : "0");
  }
  if (patch.sendTimeET !== undefined) {
    if (!/^\d{2}:\d{2}$/.test(patch.sendTimeET)) {
      throw new Error("sendTimeET must be HH:MM (24h)");
    }
    await setAppSetting(RECAP_PREF_KEYS.sendTimeET, patch.sendTimeET);
  }
  if (patch.includeKiwi !== undefined) {
    await setAppSetting(RECAP_PREF_KEYS.includeKiwi, patch.includeKiwi ? "1" : "0");
  }
  if (patch.includeMood !== undefined) {
    await setAppSetting(RECAP_PREF_KEYS.includeMood, patch.includeMood ? "1" : "0");
  }
  if (patch.recipients !== undefined) {
    await setAppSetting(RECAP_PREF_KEYS.recipients, JSON.stringify(patch.recipients));
  }
  return getDailyRecapPrefs();
}

/**
 * Pure: compose the recap email HTML for a given DayLog-style payload.
 * Importing the DayLogPayload type directly would cause a circular import,
 * so we accept a structurally-typed minimal shape. Kept side-effect-free so
 * unit tests can run without a DB.
 */
export interface DailyRecapPreviewInput {
  dateISO: string;
  studentName: string;
  plannedTotal: number;
  plannedComplete: number;
  totalActualMinutes: number;
  actualEntries: Array<{
    subjectSlug: string;
    topic: string;
    minutesSpent: number;
    source?: string | null;
    notes?: string | null;
  }>;
  offPlanTopics: Array<{ subjectSlug: string; topic: string }>;
  /** Optional Kiwi-listening focus rollup so prefs.includeKiwi can drive layout. */
  kiwiFocus?: Array<{ subjectSlug: string; minutes: number }>;
  /** Optional 24-bucket mood histogram (0..1) so prefs.includeMood can render. */
  moodHistogram?: number[];
  prefs: Pick<DailyRecapPrefs, "includeKiwi" | "includeMood">;
}

export function formatDailyRecapHtml(input: DailyRecapPreviewInput): string {
  const lines: string[] = [];
  lines.push(`<!doctype html><html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#222;max-width:680px;margin:0 auto;padding:20px;">`);
  lines.push(
    `<div style="text-align:center;margin-bottom:8px;">` +
      `<div style="font-size:22px;font-weight:800;color:#1f3a2e;">${escapeHtml(input.studentName)}'s Day Recap</div>` +
      `<div style="color:#666;font-size:14px;">${escapeHtml(input.dateISO)}</div>` +
    `</div>`,
  );

  // Headline numbers — what an adult should glance at first.
  const completionPct = input.plannedTotal > 0
    ? Math.round((input.plannedComplete / input.plannedTotal) * 100)
    : 0;
  lines.push(
    `<div style="display:flex;flex-wrap:wrap;gap:12px;margin:18px 0;padding:14px 16px;background:#fafafa;border-left:4px solid #1f3a2e;border-radius:8px;">` +
      `<div><b>${input.plannedComplete}/${input.plannedTotal}</b> blocks completed <span style="color:#888;">(${completionPct}%)</span></div>` +
      `<div><b>${input.totalActualMinutes} min</b> of learning logged</div>` +
      `<div><b>${input.actualEntries.length}</b> entries</div>` +
    `</div>`,
  );

  // What we actually did.
  lines.push(`<h3 style="margin:18px 0 6px 0;color:#1f3a2e;">What we actually did</h3>`);
  if (input.actualEntries.length === 0) {
    lines.push(`<p style="color:#888;">No entries logged today.</p>`);
  } else {
    lines.push(`<ul style="padding-left:20px;margin:6px 0;">`);
    for (const e of input.actualEntries) {
      const src = e.source ? ` <span style="color:#888;">(${escapeHtml(e.source)})</span>` : "";
      const note = e.notes ? ` — ${escapeHtml(e.notes)}` : "";
      lines.push(
        `<li><b>${escapeHtml(e.subjectSlug)}</b> · ${escapeHtml(e.topic)} · ${e.minutesSpent} min${src}${note}</li>`,
      );
    }
    lines.push(`</ul>`);
  }

  if (input.offPlanTopics.length > 0) {
    lines.push(`<h3 style="margin:18px 0 6px 0;color:#1f3a2e;">Off-plan topics covered</h3>`);
    lines.push(`<ul style="padding-left:20px;margin:6px 0;">`);
    for (const o of input.offPlanTopics) {
      lines.push(`<li><b>${escapeHtml(o.subjectSlug)}</b> · ${escapeHtml(o.topic)}</li>`);
    }
    lines.push(`</ul>`);
  }

  if (input.prefs.includeKiwi && input.kiwiFocus && input.kiwiFocus.length > 0) {
    lines.push(`<h3 style="margin:18px 0 6px 0;color:#1f3a2e;">Kiwi listening focus</h3>`);
    lines.push(`<ul style="padding-left:20px;margin:6px 0;">`);
    for (const k of input.kiwiFocus) {
      lines.push(`<li><b>${escapeHtml(k.subjectSlug)}</b> · ${k.minutes} min</li>`);
    }
    lines.push(`</ul>`);
  }

  if (input.prefs.includeMood && input.moodHistogram && input.moodHistogram.length > 0) {
    const max = Math.max(...input.moodHistogram, 0.0001);
    const bars = input.moodHistogram
      .map((v) => {
        const h = Math.max(2, Math.round((v / max) * 36));
        return `<span style="display:inline-block;width:8px;height:${h}px;background:#1f3a2e;margin-right:1px;vertical-align:bottom;"></span>`;
      })
      .join("");
    lines.push(`<h3 style="margin:18px 0 6px 0;color:#1f3a2e;">Mood through the day</h3>`);
    lines.push(`<div style="padding:8px;background:#fafafa;border-radius:6px;height:48px;">${bars}</div>`);
  }

  lines.push(`<p style="font-size:12px;color:#888;text-align:center;margin-top:24px;">Auto-sent from Reagan's Homeschool Dashboard.</p>`);
  lines.push(`</body></html>`);
  return lines.join("\n");
}

/** Tiny HTML escape — recap content only ever holds short topic strings. */
function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Live preview composer — pulls today's DayLogPayload and renders the recap
 * HTML using the saved prefs. Used by Settings → Daily Recap "Sample preview".
 */
export async function previewDailyRecap(dateISO?: string): Promise<{
  dateISO: string;
  html: string;
  prefs: DailyRecapPrefs;
  effectiveRecipients: string[];
}> {
  const date = dateISO ?? new Date().toISOString().slice(0, 10);
  const prefs = await getDailyRecapPrefs();
  // Dynamic import to avoid the circular-type dance with dayLogBuilder.
  const { loadDayLogPayload } = await import("./_lib/dayLogBuilder");
  const payload = await loadDayLogPayload(date);
  const kiwiFocus = await (async () => {
    if (!prefs.includeKiwi) return undefined;
    try {
      const summaries = await listListeningSummariesForDate(date);
      const byTopic: Record<string, number> = {};
      for (const s of summaries as any[]) {
        const k = String(s.subjectGuess ?? s.subject ?? "other");
        byTopic[k] = (byTopic[k] ?? 0) + Number(s.minutes ?? 0);
      }
      return Object.entries(byTopic)
        .map(([subjectSlug, minutes]) => ({ subjectSlug, minutes }))
        .sort((a, b) => b.minutes - a.minutes)
        .slice(0, 5);
    } catch {
      return undefined;
    }
  })();
  const moodHistogram = await (async () => {
    if (!prefs.includeMood) return undefined;
    try {
      const tl = await buildMoodTimelineForDate(date);
      // Use raw chunk count per bin so the preview sparkline reflects activity intensity even when emotion scores are missing.
      return tl?.bins?.map((b: any) => Number(b.count ?? 0)) ?? undefined;
    } catch {
      return undefined;
    }
  })();
  const effectiveRecipients = prefs.recipients.length > 0
    ? prefs.recipients
    : (await listRecipients() as any[])
        .map((r) => String(r.email ?? "").trim())
        .filter((s) => /.+@.+\..+/.test(s));
  const html = formatDailyRecapHtml({
    dateISO: date,
    studentName: "Reagan",
    plannedTotal: (payload as any).plannedTotal ?? 0,
    plannedComplete: (payload as any).plannedComplete ?? 0,
    totalActualMinutes: (payload as any).totalActualMinutes ?? 0,
    actualEntries: ((payload as any).actualEntries ?? []).map((a: any) => ({
      subjectSlug: a.subjectSlug,
      topic: a.topic,
      minutesSpent: a.minutesSpent,
      source: a.source ?? null,
      notes: a.notes ?? null,
    })),
    offPlanTopics: ((payload as any).offPlanTopics ?? []).map((o: any) => ({
      subjectSlug: o.subjectSlug,
      topic: o.topic,
    })),
    kiwiFocus,
    moodHistogram,
    prefs,
  });
  return { dateISO: date, html, prefs, effectiveRecipients };
}


/* ============================================================================
 * PUSH 52 (2026-05-13) — Auto-add new topics from recap reply into curriculum
 * ----------------------------------------------------------------------------
 * When Mom or Grandma replies to a daily-recap email and the LLM extracts an
 * off-plan topic (e.g. "kitchen fractions during cookie baking"), the existing
 * pipeline already inserts a topicsCoveredOffPlan row + enqueues a Drive push.
 *
 * This push closes the LAST gap: it also seeds a real `curriculumTopics` row
 * (status='covered', source='recap-reply') so the catch-up engine + coverage
 * analytics surface the topic next time. Idempotent — if a topic with the same
 * slug+normalized-title already exists for the subject, we just mark covered.
 * ========================================================================= */
const RECAP_SUBJ_MAP_TO_TITLE: Record<string, string> = {
  math: "Math",
  ela: "ELA",
  reading: "ELA",
  writing: "ELA",
  science: "Science",
  "social-studies": "Social",
  ss: "Social",
  social_studies: "Social",
  art: "Specials",
  music: "Specials",
  pe: "Specials",
  "life-skills": "Specials",
  "social-emotional": "Specials",
  other: "Specials",
};

function normalizeTopicTitleForMatch(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .slice(0, 80);
}

/**
 * Insert a curriculumTopics row for an off-plan recap topic — or, if a row
 * with the same subject+normalized-title already exists, just mark it covered.
 *
 * Returns the resolved topicId + a `created` flag (true when a brand-new row
 * was inserted, false when an existing row was matched + marked-covered).
 */
export async function autoAddRecapTopicToCurriculum(opts: {
  subjectSlug: string;
  topic: string;
  dateISO: string;
  sourceLabel?: string; // "recap-reply" | "mom-input" | "grandma-recap"
}): Promise<{ topicId: number | null; created: boolean; subjectTitle: string | null }> {
  const slug = (opts.subjectSlug || "").toLowerCase();
  const subjectTitle = RECAP_SUBJ_MAP_TO_TITLE[slug] ?? null;
  if (!subjectTitle || !opts.topic.trim()) {
    return { topicId: null, created: false, subjectTitle };
  }
  const normalized = normalizeTopicTitleForMatch(opts.topic);
  if (!normalized) return { topicId: null, created: false, subjectTitle };

  const db = getDb();
  // 1. Try to find an existing row by normalized title prefix.
  const [rowsRaw]: any = await db.execute(sql`
    SELECT id, title FROM curriculumTopics WHERE subject = ${subjectTitle}
  `);
  const existing: any[] = rowsRaw as any[];
  const hit = existing.find((r) => {
    const t = normalizeTopicTitleForMatch(String(r.title ?? ""));
    return t === normalized || (t.length >= 6 && (t.includes(normalized) || normalized.includes(t)));
  });

  const sourceLabel = opts.sourceLabel ?? "recap-reply";

  if (hit) {
    // Mark covered via the existing helper so provenance is consistent.
    try {
      await db.execute(sql`
        UPDATE curriculumTopics
        SET status = 'covered',
            last_covered_at = ${Date.now()},
            last_covered_source = ${sourceLabel}
        WHERE id = ${hit.id}
      `);
    } catch { /* best-effort */ }
    return { topicId: Number(hit.id), created: false, subjectTitle };
  }

  // 2. No match → insert new. Use a recap-prefixed code so it sorts to the
  // bottom and is visually distinct from seeded standards.
  const code = `RECAP-${opts.dateISO}-${normalized.replace(/\s+/g, "-").slice(0, 40)}`;
  const [ordRows]: any = await db.execute(sql`
    SELECT COALESCE(MAX(ord), -1) AS maxOrd FROM curriculumTopics WHERE subject = ${subjectTitle}
  `);
  const nextOrd = Number((ordRows?.[0] ?? ordRows)?.maxOrd ?? -1) + 1;
  try {
    const result: any = await db.execute(sql`
      INSERT INTO curriculumTopics (subject, code, title, standard_ref, ord, status, quarter, last_covered_at, last_covered_source)
      VALUES (${subjectTitle}, ${code}, ${opts.topic.trim().slice(0, 240)}, ${"recap"}, ${nextOrd}, ${"covered"}, ${"Q4"}, ${Date.now()}, ${sourceLabel})
    `);
    const insertId = Number(result?.[0]?.insertId ?? result?.insertId ?? 0);
    return { topicId: insertId || null, created: true, subjectTitle };
  } catch (e) {
    console.error("[autoAddRecapTopicToCurriculum] insert failed", e);
    return { topicId: null, created: false, subjectTitle };
  }
}


/* -------------------------------------------------------------------------- */
/*  Wave-15 / Push 235 — KIWI VOICE AUDIT ENTRIES                              */
/* -------------------------------------------------------------------------- */
/**
 * Persist an adult-review audit row for the Kiwi voice pipeline.
 * Returns the inserted id. Caller is responsible for building the
 * structured entry via buildKiwiVoiceAuditEntry (Push 232).
 */
export async function insertKiwiVoiceAuditEntry(input: {
  timestampUtcMs: number;
  originalCandidate: string;
  finalText: string;
  severity: "info" | "minor" | "major";
  actionsJson: string;
  sourcePanel?: string | null;
}): Promise<{ id: number }> {
  const db = getDb();
  const row: InsertKiwiVoiceAuditEntry = {
    timestampUtcMs: input.timestampUtcMs,
    originalCandidate: input.originalCandidate,
    finalText: input.finalText,
    severity: input.severity,
    actionsJson: input.actionsJson,
    sourcePanel: input.sourcePanel ?? null,
  };
  const [res]: any = await db.insert(kiwiVoiceAuditEntries).values(row as any);
  const id = (res as any)?.insertId as number;
  return { id: Number(id ?? 0) };
}

/**
 * List recent Kiwi voice audit entries, newest first. Used by the
 * adult review page. Default page size 50; cap at 500.
 */
export async function listKiwiVoiceAuditEntries(opts?: {
  limit?: number;
  severity?: "info" | "minor" | "major";
}): Promise<KiwiVoiceAuditEntryRow[]> {
  const db = getDb();
  const limit = Math.max(1, Math.min(500, Math.floor(opts?.limit ?? 50)));
  let q: any = db.select().from(kiwiVoiceAuditEntries);
  if (opts?.severity) {
    q = q.where(eq(kiwiVoiceAuditEntries.severity, opts.severity));
  }
  const rows: any = await q
    .orderBy(desc(kiwiVoiceAuditEntries.timestampUtcMs))
    .limit(limit);
  return rows as KiwiVoiceAuditEntryRow[];
}

/**
 * Count of major (drift-fallback) entries in the last N days.
 * Used by the adult review page's at-a-glance summary card.
 */
export async function countMajorKiwiVoiceAuditEntries(
  lookbackDays: number = 7,
): Promise<number> {
  const db = getDb();
  const cutoff = Date.now() - Math.max(1, Math.floor(lookbackDays)) * 86_400_000;
  const rows: any = await db
    .select({ id: kiwiVoiceAuditEntries.id })
    .from(kiwiVoiceAuditEntries)
    .where(
      and(
        eq(kiwiVoiceAuditEntries.severity, "major"),
        gte(kiwiVoiceAuditEntries.timestampUtcMs, cutoff),
      ),
    );
  return (rows as any[]).length;
}
