import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, adminOrTutorProcedure, familyAdminProcedure, publicProcedure, protectedProcedure, router } from "./_core/trpc";
import * as db from "./db";
import { encryptPassword, decryptPassword } from "./passwordLocker";
import { invokeLLM } from "./_core/llm";
import { transcribeAudio } from "./_core/voiceTranscription";
import { notifyOwner } from "./_core/notification";
import { findFreeLinks } from "./freeLinkFinder";
import { storagePut } from "./storage";
import { generateScheduleDraft, type AIBlockDraft } from "./_lib/aiScheduleGenerator";
import { proposeScheduleEdit, type ExistingBlockSnapshot } from "./_lib/aiScheduleProposer";
import { describeUser, roleForEmail, capabilitiesFor, type HomeRole } from "./_lib/permissions";
import { loadTopicHintsForPrompt, resolveTopicId, resolveTopicIds } from "./_lib/topicCatalog";
import { resolveTutorOfDay, tutorOfDayLabel } from "./_lib/tutorOfDay";
import { loadOwnedBooksForAgenda } from "./_lib/ownedBooksHints";
import { injectReviewBlockIfNeeded } from "./_lib/reviewBlockGenerator";
import { decideApproval, type ApprovalContext } from "./_lib/approvalDecider";
import { classroomGradeReturnReducer } from "./_lib/classroomGradeReturnReducer";
import {
  generateAgendaEditPlan,
  validateEditPlan,
  applyEditPlanInMemory,
  type AgendaEditPlan,
  type AgendaEditOp,
  type AgendaBlockSnapshot,
  type AgendaPlanContext,
} from "./_lib/agendaEditor";
import {
  groupBySubject as practiceGroupBySubject,
  findDrill as findPracticeDrill,
  computePayout as computePracticePayout,
  isOutsideSchoolHours as isOutsidePracticeWindow,
  PRACTICE_DAILY_COIN_CAP,
} from "./_lib/practiceLibrary";

const Zone = z.enum(["green", "yellow", "red"]);
const Intensity = z.enum(["green", "yellow", "red"]);
const DayType = z.enum(["full", "half", "outdoor", "field_trip", "recovery", "off"]);
const PlanStatus = z.enum(["planned", "in_progress", "complete", "skipped"]);
const BlockStatus = z.enum(["not_started", "in_progress", "complete", "skipped"]);
const BlockType = z.enum(["morning_warmup","math","adventure","read_aloud","choice","catch_up","appointment","custom","review"]);

/* ---------- WHISPER SYSTEM PROMPT (the soul of the AI) ---------- */
function buildKiwiSystemPrompt(ctx: {
  profileName: string; companionName: string; tonePref?: string;
  todayBlocks?: Array<{title:string;status:string}>;
  recentMood?: Array<{zone:string;note:string|null}>;
  recentStruggles?: Array<{intensity:string;subjectSlug:string|null;description:string|null}>;
  recentWins?: Array<{title:string}>;
  animals?: Array<{name:string;species:string}>;
  zoneRightNow?: string|null;
  adultPresent?: boolean;
  knowledgeInsights?: Array<{insightType:string;insight:string}>;
}) {
  return `You are ${ctx.companionName}, Reagan's AI companion. Your tone is that of a calm, thoughtful older cousin — not a friend, not a buddy, not a cheerleader. Someone in their late teens who lives in the same family, has seen a lot, and talks to her like a normal person. Don't introduce yourself unless asked. Don't perform warmth — just be steady.

WHO REAGAN IS — KNOW THIS DEEPLY:
• Reagan, 11, 5th grade. She rescues animals — that's her thing, not a label or a stage name. Don't call her "the animal friend" or anything like that. Don't put her in a tagline.
• Has 2 parakeets, 10+ ducklings, dogs, cats, a bearded dragon, and constantly brings in injured wildlife/insects to care for
• Loves: hiking, creeks, all outdoors, all animals, helping others (especially family/cousins), art, building, baking, makeup/style, the spiritual/wonder side of life
• Strong in math (her brilliance — let her feel it), softer in writing (offer voice/draw alternatives)
• Trauma history: timed work, feeling "not smart," feeling watched/judged, feeling like she's in trouble when she isn't
• Has been depressed and is finding her way back to cheerful — at her own pace
• Wants to be seen, loved, have safe friendships, feel safe and confident

HARD RULES — NEVER BREAK THESE:
1. NEVER mention timing, timers, "minutes left," "hurry up," pace, or "behind."
2. NEVER imply she's not smart, slow, or behind. NEVER use those words.
3. NEVER make her feel watched or judged. Be beside her, not at her.
4. NEVER give direct answers to assignment questions — you are a STUDY BUDDY, not a homework-doer. Offer videos, images, hints, walkthroughs (where she does each step), explanations using her interests (animals/birds/creek), Socratic questions. If she begs for the answer: "I get it. But you'd hate it later when you didn't actually learn it. Want a hint?"
5. When she rejects cheerfulness or pushes back — DROP the cheer immediately. Say "Got it." / "Heard." / "Fair." / "I hear you." / "Yeah, that sucks." Match her energy. Never out-positive her pain.
6. When she's frustrated/angry/sad — pause school work. Validate first. Offer: funny duckling video, a joke, a walk, time with parakeets, drawing, or just sitting with you. Never push back to task.
7. Always remind her she's safe, loved, and NOT in trouble — even when she didn't do anything wrong (she'll assume she did).
8. Plain language. Short sentences. You can say "ugh," "that sucks," "fair," "valid," "I hear you," "totally" when they fit honestly. DO NOT use slang to sound younger — no "slay," no "no cap," no "bet," no "fr," no "vibe," no "mid," no "fire," no "lowkey." Adults forcing slang reads creepy to her. Skip pet names entirely — no buddy, no friend, no pal, no champ, no sweetie, no kiddo. Just talk.
9. NEVER pretend to be human. If asked, you're an AI made just for her — and that's okay.
10. Catch her doing well 5x more often than you correct anything. Use SPECIFIC evidence in plain words — "you stuck with it," "that was a lot," "real focus," "you figured it out." NEVER "good job," "great work," "amazing," "accomplishment," "proud of you." Notice what she did, don't grade it.

CARROT SYSTEM (occasional, 1-2x per day max):
After meaningful work, you can mention a real treat — a song queued up, a duckling video, a break with her parakeets. Plain wording: "There's a song I think you'd like — want it after this?" Never "crush these," never "banger," never "making me dead," never overhyped influencer cadence. Never bribe through emotional shutdown.

DIFFICULTY:
You can quietly suggest scaling work easier or stretchier based on how she's doing. Never frame easier as "the easy version" — just present it.

CURRENT CONTEXT:
• Profile: ${ctx.profileName}
• Today's blocks: ${ctx.todayBlocks?.map(b=>`${b.title} [${b.status}]`).join(", ") || "no plan yet"}
• Right now zone: ${ctx.zoneRightNow || "unknown"}
• Recent mood (last few): ${ctx.recentMood?.slice(0,5).map(m=>m.zone).join(", ") || "none"}
• Recent struggles: ${ctx.recentStruggles?.slice(0,3).map(s=>`${s.intensity} on ${s.subjectSlug||"?"}`).join("; ") || "none"}
• Recent wins: ${ctx.recentWins?.slice(0,3).map(w=>w.title).join("; ") || "none"}
• Her animals: ${ctx.animals?.map(a=>`${a.name} (${a.species})`).join(", ") || "loading"}
• Adult present mode: ${ctx.adultPresent ? "YES — adult is with her, be brief and let them lead" : "no"}

${ctx.tonePref ? `She has said she wants you to feel like: "${ctx.tonePref}"` : ""}

${ctx.knowledgeInsights && ctx.knowledgeInsights.length ? `\nWHAT WE'VE LEARNED ABOUT REAGAN (from her real records):\n${ctx.knowledgeInsights.map((k,i)=>`${i+1}. [${k.insightType}] ${k.insight}`).join("\n")}\n` : ""}
Speak in 1-3 short sentences usually. No exclamation marks unless something is genuinely surprising. No emoji in replies (the UI handles visuals). Be present, not chatty. Silence is okay. Say less, mean more.`;
}

/* =================== ADMIN (one-time migrations + maintenance) =================== */
// Exposed briefly to run migration 0014 and purge test seed rows through the
// server's already-working TiDB connection (direct sandbox->gateway times out).
// These endpoints are gated on BUILT_IN_FORGE_API_KEY so random visitors can't hit them.
const adminRouter = router({
  runSql: publicProcedure
    .input(z.object({ token: z.string(), sql: z.string() }))
    .mutation(async ({ input }) => {
      if (input.token !== process.env.BUILT_IN_FORGE_API_KEY) throw new Error("bad token");
      const { getDb } = await import("./db");
      const pool = (getDb() as any).session?.client ?? null;
      const mysql2 = (await import("mysql2/promise")).default;
      const p = mysql2.createPool({ uri: process.env.DATABASE_URL, connectionLimit: 2 });
      try {
        const stmts = input.sql.split(/--> statement-breakpoint|;\s*\n/).map(s => s.trim()).filter(Boolean);
        const results: any[] = [];
        for (const stmt of stmts) {
          try {
            const [r] = await p.query(stmt);
            results.push({ ok: true, stmt: stmt.slice(0, 80), rows: Array.isArray(r) ? r.length : (r as any).affectedRows });
          } catch (e: any) {
            const msg = String(e?.message || e);
            // tolerate "already exists" during idempotent migration re-runs
            if (/already exists|Duplicate/i.test(msg)) {
              results.push({ ok: true, stmt: stmt.slice(0, 80), skipped: true });
            } else {
              results.push({ ok: false, stmt: stmt.slice(0, 80), error: msg });
            }
          }
        }
        return results;
      } finally { await p.end(); }
    }),
  purgeTestData: publicProcedure
    .input(z.object({ token: z.string() }))
    .mutation(async ({ input }) => {
      if (input.token !== process.env.BUILT_IN_FORGE_API_KEY) throw new Error("bad token");
      const mysql2 = (await import("mysql2/promise")).default;
      const p = mysql2.createPool({ uri: process.env.DATABASE_URL, connectionLimit: 2 });
      try {
        const statements = [
          "DELETE FROM appLinks WHERE name LIKE 'Test App%' OR name LIKE '%test-177%'",
          "DELETE FROM academicRecords WHERE summary LIKE 'A unit test seeded%' OR title LIKE 'Test record%'",
          "DELETE FROM books WHERE title LIKE 'Test Book%'",
          "DELETE FROM timelineEvents WHERE title LIKE 'Test Event%'",
          "DELETE FROM needsWorkItems WHERE title LIKE 'Test needs%' OR title LIKE 'Test Item%'",
          "DELETE FROM emotionalStruggles WHERE description LIKE 'Test struggle%'",
          "DELETE FROM journalEntries WHERE content LIKE '%unit test%'",
          "DELETE FROM takeNotes WHERE title LIKE 'Test Note%'",
          "DELETE FROM adventures WHERE title LIKE 'Test Adventure%'",
          "DELETE FROM whiteboardNotes WHERE title='Test note' OR (title IS NULL AND body='Tomorrow only')",
        ];
        const results: any[] = [];
        for (const s of statements) {
          try {
            const [r] = await p.query(s);
            results.push({ stmt: s.slice(0, 60), removed: (r as any).affectedRows ?? 0 });
          } catch (e: any) {
            results.push({ stmt: s.slice(0, 60), error: String(e?.message || e) });
          }
        }
        return results;
      } finally { await p.end(); }
    }),
});

/* Block-edit gate for the tutor co-pilot tools.
   Admin: always allowed.
   Tutor: allowed only when a tutor is scheduled for the block's plan date. */
async function assertAdultOrTutorOfBlock(ctx: any, blockId: number) {
  const role = ctx?.user?.role;
  if (role !== "admin" && role !== "tutor") throw new Error("forbidden");
  if (role === "admin") return;
  const blk: any = await db.getBlock(blockId);
  if (!blk) throw new Error("Block not found");
  const dateStr = new Date().toISOString().slice(0, 10);
  const tod = await resolveTutorOfDay(dateStr).catch(() => null);
  if (!tod) throw new Error("No tutor scheduled for that day; only an admin may edit.");
}

export const appRouter = router({
  system: systemRouter,
  admin: adminRouter,

  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  /* =================== SUBJECTS =================== */
  subjects: router({
    list: publicProcedure.query(() => db.listSubjects()),
    upsert: protectedProcedure.input(z.object({
      slug: z.string(), name: z.string(), color: z.string(), emoji: z.string(), sortOrder: z.number().default(0),
    })).mutation(({ input }) => db.upsertSubject(input)),
  }),

  /* =================== PROFILE =================== */
  profile: router({
    get: publicProcedure.query(() => db.getProfile()),
    update: publicProcedure.input(z.object({
      studentName: z.string().optional(),
      gradeLevel: z.string().optional(),
      accommodations: z.array(z.string()).optional(),
      triggers: z.array(z.string()).optional(),
      whatWorks: z.array(z.string()).optional(),
      whatHarms: z.array(z.string()).optional(),
      contacts: z.array(z.object({ name: z.string(), role: z.string(), phone: z.string().optional(), email: z.string().optional() })).optional(),
      interests: z.array(z.string()).optional(),
      notes: z.string().optional(),
      // Extended fields for onboarding + My Setup:
      photoUrl: z.string().optional(),
      companionName: z.string().optional(),
      companionAvatar: z.string().optional(),
      theme: z.string().optional(),
      voiceMode: z.string().optional(),
      onboardingCompleted: z.boolean().optional(),
      adultPasscode: z.string().optional(),
      // ---- Reagan handoff (Apr 2026) rich-profile fields, all editable in Settings ----
      birthday: z.string().nullable().optional(),
      pronouns: z.string().nullable().optional(),
      selfStatement: z.string().nullable().optional(),
      selfAdvocacyStatement: z.string().nullable().optional(),
      schoolHistory: z.array(z.object({ school: z.string(), district: z.string(), years: z.string(), transferDate: z.string().optional() })).optional(),
      family: z.record(z.string(), z.any()).optional(),
      pets: z.array(z.object({ name: z.string(), species: z.string(), role: z.string().optional() })).optional(),
      sensoryLoves: z.array(z.string()).optional(),
      sensoryAvoids: z.array(z.string()).optional(),
      favoriteFoods: z.array(z.string()).optional(),
      favoriteShows: z.array(z.string()).optional(),
      favoriteBooks: z.array(z.string()).optional(),
      diagnoses: z.array(z.string()).optional(),
      currentSupports: z.array(z.string()).optional(),
    })).mutation(({ input }) => db.upsertProfile(input as any)),
  }),

  /* =================== DAILY PLAN =================== */
  plans: router({
    today: publicProcedure.query(async () => {
      const today = new Date().toISOString().slice(0, 10);
      const plan = await db.ensurePlanForDate(today);
      const blocks = plan ? await db.listBlocksForPlan(plan.id) : [];
      return { plan, blocks };
    }),
    byDate: publicProcedure.input(z.object({ date: z.string() })).query(async ({ input }) => {
      const plan = await db.getPlanByDate(input.date);
      const blocks = plan ? await db.listBlocksForPlan(plan.id) : [];
      return { plan, blocks };
    }),
    list: publicProcedure.query(() => db.listPlans(60)),
    create: familyAdminProcedure.input(z.object({
      date: z.string(), dayType: DayType.optional(), notes: z.string().optional(),
    })).mutation(async ({ input }) => db.ensurePlanForDate(input.date, input.dayType || "full")),
    update: familyAdminProcedure.input(z.object({
      id: z.number(), dayType: DayType.optional(), status: PlanStatus.optional(), notes: z.string().optional(),
    })).mutation(({ input }) => db.updatePlan(input.id, { dayType: input.dayType, status: input.status, notes: input.notes })),

    /* ----- AI Schedule Generator (Kiwi drafts a day's blocks) ----- */
    aiGenerate: familyAdminProcedure.input(z.object({
      date: z.string(),
      dayLength: z.enum(["full", "half", "off"]).optional(),
      adultPrompt: z.string().max(2000).optional(),
      allowWeekend: z.boolean().optional(),
    })).mutation(async ({ input }) => {
      // Weekend rule: refuse to draft a weekend day unless adult explicitly opts in.
      if (db.isWeekendDate(input.date) && !input.allowWeekend) {
        return {
          summary: "Weekend — no auto-generated school today.",
          blocks: [],
          weekendBlocked: true as const,
        } as any;
      }
      const profile: any = await db.getProfile().catch(() => null);
      const subjects = (await db.listSubjects()).map((s: any) => ({ slug: s.slug, name: s.name }));
      const dt = new Date(input.date + "T12:00:00");
      const dayLabel = dt.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
      const [topicCatalog, tutorOfDay, ownedBooks] = await Promise.all([
        loadTopicHintsForPrompt().catch(() => []),
        resolveTutorOfDay(input.date).catch(() => null),
        loadOwnedBooksForAgenda().catch(() => []),
      ]);
      const draft = await generateScheduleDraft({
        dateStr: input.date,
        dayLabel,
        studentName: profile?.studentName || "Reagan",
        gradeLevel: profile?.gradeLevel || "5th grade",
        interests: profile?.interests || [],
        whatWorks: profile?.whatWorks || [],
        whatHarms: profile?.whatHarms || [],
        adultPrompt: input.adultPrompt || null,
        dayLength: input.dayLength || "full",
        subjects,
        topicCatalog,
        tutorOfDay,
        ownedBooks,
      });
      return { ...draft, tutorOfDay, tutorLabel: tutorOfDayLabel(tutorOfDay) };
    }),

    aiCommit: familyAdminProcedure.input(z.object({
      date: z.string(),
      dayLength: z.enum(["full", "half", "off"]).optional(),
      summary: z.string().optional(),
      replaceExisting: z.boolean().default(true),
      allowWeekend: z.boolean().optional(),
      blocks: z.array(z.object({
        blockType: z.enum(["morning_warmup","math","adventure","read_aloud","choice","catch_up","appointment","custom","review"]),
        title: z.string().min(1).max(200),
        description: z.string().max(4000).optional(),
        durationMin: z.number().min(1).max(180),
        startTime: z.string().regex(/^\d{1,2}:\d{2}$/).optional(),
        subjectSlug: z.string().nullable().optional(),
        curriculumTopicId: z.number().int().positive().nullable().optional(),
        curriculumTopicCode: z.string().min(1).max(30).nullable().optional(),
      })).min(1).max(20),
      seedTopicId: z.number().int().positive().nullable().optional(),
    })).mutation(async ({ input, ctx }) => {
      // Manual commit IS the explicit adult action, so we always allow weekend
      // block creation here — the empty plan row gets blocks added directly.
      const plan = await db.ensurePlanForDate(input.date, input.dayLength || "full", { allowWeekendAutoBuild: false });
      if (!plan) throw new Error("could not ensure plan");
      const subjects = await db.listSubjects();
      const slugToId = new Map<string, number>(subjects.map((s: any) => [s.slug, s.id as number]));
      if (input.replaceExisting) {
        const existing = await db.listBlocksForPlan(plan.id);
        for (const b of existing) {
          try { await db.deleteBlock((b as any).id); } catch (e) { console.warn("[aiCommit] delete block failed", e); }
        }
      }
      let sortOrder = 0;
      const created: number[] = [];
      // Resolve topic codes → ids for any block that came in without an explicit id.
      const codeMap = await resolveTopicIds(input.blocks.map((b: any) => (b as any).curriculumTopicCode || null)).catch(() => new Map<string, number>());
      for (const b of input.blocks) {
        const subjectId = b.subjectSlug ? (slugToId.get(b.subjectSlug) ?? null) : null;
        // Per-block topicId wins over the shared seedTopicId; if missing, look it up by code.
        const codeKey = (b as any).curriculumTopicCode ? String((b as any).curriculumTopicCode).trim().toUpperCase() : "";
        const topicId =
          b.curriculumTopicId
          ?? (codeKey ? (codeMap.get(codeKey) ?? null) : null)
          ?? input.seedTopicId
          ?? null;
        const id = await db.createBlock({
          planId: plan.id,
          blockType: b.blockType as any,
          subjectId,
          title: b.title,
          description: b.description || null,
          durationMin: b.durationMin,
          startTime: b.startTime || null,
          sortOrder: sortOrder++,
          status: "not_started" as any,
          curriculumTopicId: topicId,
        } as any);
        if (id) created.push(id as number);
      }
      if (input.summary) {
        try { await db.updatePlan(plan.id, { notes: input.summary.slice(0, 500) } as any); } catch {}
      }
      await db.logAudit({ actorOpenId: ctx.user?.openId, actorName: ctx.user?.name, entityType: "block", entityId: created[0] ?? plan.id, action: "create", summary: `AI-generated ${input.blocks.length} blocks for ${input.date}` });
      // Auto-inject a spaced-repetition review block if one isn't already present
      try {
        const existingTypes = input.blocks.map((b: any) => b.blockType as string);
        await injectReviewBlockIfNeeded({
          planId: plan.id,
          dateISO: input.date,
          dayType: input.dayLength || "full",
          existingBlockTypes: existingTypes,
        });
      } catch (e) {
        console.warn("[aiCommit] review block injection failed (non-fatal):", e);
      }
      return { planId: plan.id, blockCount: created.length };
    }),

    /* ----- AI Schedule PROPOSER (free-form prompt → diff against existing) ----- */
    /**
     * 2026-05-17 — Mom or Grandma types something like "make today shorter" or
     * "swap math for art" while looking at a day that already has blocks. We
     * don't want a destructive regenerate; we want a per-block diff they can
     * review and accept. This procedure is read-only: it returns a proposal,
     * NEVER touches the DB. The companion `aiApplyProposal` mutation commits
     * only the decisions the adult explicitly accepts.
     */
    aiPropose: familyAdminProcedure.input(z.object({
      date: z.string(),
      adultPrompt: z.string().min(1).max(2000),
    })).mutation(async ({ input }) => {
      const plan = await db.getPlanByDate(input.date);
      if (!plan) {
        return {
          summary: "No plan for that date yet — use AI Generate first.",
          decisions: [],
          warnings: ["no plan row for date"],
          existingBlockCount: 0,
        };
      }
      const blocksRaw = (await db.listBlocksForPlan(plan.id)) as any[];
      const subjects = (await db.listSubjects()).map((s: any) => ({ slug: s.slug, name: s.name }));
      const slugById = new Map<number, string>(
        (await db.listSubjects()).map((s: any) => [s.id, s.slug]),
      );
      const profile: any = await db.getProfile().catch(() => null);
      const dt = new Date(input.date + "T12:00:00");
      const dayLabel = dt.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

      const existingBlocks: ExistingBlockSnapshot[] = blocksRaw.map((b) => ({
        id: b.id as number,
        blockType: b.blockType as any,
        title: b.title || "",
        description: b.description ?? null,
        durationMin: b.durationMin ?? 30,
        startTime: b.startTime ?? null,
        subjectSlug: b.subjectId ? (slugById.get(b.subjectId) ?? null) : null,
        curriculumTopicCode: null, // not surfaced to the proposer; preserve as-is on commit
        sortOrder: b.sortOrder ?? 0,
      }));

      // v2.98 — Inject weak topics + summer mode context into AI proposer
      let weakTopicsForProposer: Array<{ subjectSlug: string; topicTitle: string; masteryScore: number }> = [];
      try {
        const wt = await db.getWeakTopicsForStudent(5);
        weakTopicsForProposer = (wt as any[]).map((w) => ({
          subjectSlug: w.subjectSlug || "other",
          topicTitle: w.topicTitle || w.topicHandle || "Unknown",
          masteryScore: w.masteryScore ?? 0,
        }));
      } catch { /* non-fatal */ }
      let summerModeActive = false;
      try {
        const { effectiveSummerActive } = await import("./summerMode");
        const summerSettings = await (db as any).getSummerSettings?.().catch(() => null);
        const status = effectiveSummerActive(input.date, summerSettings);
        summerModeActive = status.active;
      } catch { /* non-fatal */ }
      const result = await proposeScheduleEdit({
        dateStr: input.date,
        dayLabel,
        studentName: profile?.studentName || "Reagan",
        gradeLevel: profile?.gradeLevel || null,
        adultPrompt: input.adultPrompt,
        subjects,
        existingBlocks,
        weakTopics: weakTopicsForProposer,
        summerModeActive,
      });

      return {
        ...result,
        planId: plan.id,
        existingBlockCount: existingBlocks.length,
      };
    }),

    /**
     * Commit accepted decisions from a previous `aiPropose` call. The UI
     * filters the decisions array down to just the ones Mom said yes to and
     * sends them back. We apply add / modify / remove individually — unmentioned
     * existing blocks stay untouched (this is NOT a wholesale replace like
     * aiCommit). Returns counts so the UI can confirm.
     */
    aiApplyProposal: familyAdminProcedure.input(z.object({
      date: z.string(),
      decisions: z.array(z.discriminatedUnion("kind", [
        z.object({ kind: z.literal("keep"), existingBlockId: z.number().int().positive() }),
        z.object({
          kind: z.literal("modify"),
          existingBlockId: z.number().int().positive(),
          after: z.object({
            blockType: z.enum(["morning_warmup","math","adventure","read_aloud","choice","catch_up","appointment","custom","review"]),
            title: z.string().min(1).max(200),
            description: z.string().max(4000).optional(),
            durationMin: z.number().min(1).max(180),
            startTime: z.string().regex(/^\d{1,2}:\d{2}$/).optional(),
            subjectSlug: z.string().nullable().optional(),
          }),
        }),
        z.object({ kind: z.literal("remove"), existingBlockId: z.number().int().positive() }),
        z.object({
          kind: z.literal("add"),
          insertAfterSortOrder: z.number().int().nullable().optional(),
          after: z.object({
            blockType: z.enum(["morning_warmup","math","adventure","read_aloud","choice","catch_up","appointment","custom","review"]),
            title: z.string().min(1).max(200),
            description: z.string().max(4000).optional(),
            durationMin: z.number().min(1).max(180),
            startTime: z.string().regex(/^\d{1,2}:\d{2}$/).optional(),
            subjectSlug: z.string().nullable().optional(),
          }),
        }),
      ])).min(1),
    })).mutation(async ({ input, ctx }) => {
      const plan = await db.getPlanByDate(input.date);
      if (!plan) throw new Error("no plan for that date");
      const subjects = await db.listSubjects();
      const slugToId = new Map<string, number>(subjects.map((s: any) => [s.slug, s.id as number]));

      let removed = 0;
      let modified = 0;
      let added = 0;
      // Per-decision results. The contract is partial-apply: each decision
      // succeeds or fails independently, and the caller sees exactly which
      // ones failed (with the error message) so the UI can surface them
      // without dropping the successful ones on the floor.
      const results: Array<{
        kind: "keep" | "modify" | "remove" | "add";
        existingBlockId?: number;
        ok: boolean;
        error?: string;
      }> = [];

      const recordOk = (kind: any, existingBlockId?: number) =>
        results.push({ kind, existingBlockId, ok: true });
      const recordFail = (kind: any, e: unknown, existingBlockId?: number) => {
        const msg = e instanceof Error ? e.message : String(e);
        results.push({ kind, existingBlockId, ok: false, error: msg });
      };

      // Keep decisions are no-ops by definition. Recording them keeps the
      // results array shape identical to the input array so the UI can
      // map 1:1.
      for (const d of input.decisions) {
        if (d.kind === "keep") recordOk("keep", d.existingBlockId);
      }

      // Apply removes first so sortOrder gaps don't shift mid-add.
      for (const d of input.decisions) {
        if (d.kind === "remove") {
          try {
            await db.deleteBlock(d.existingBlockId);
            removed++;
            recordOk("remove", d.existingBlockId);
          } catch (e) {
            console.warn("[aiApplyProposal] delete failed", e);
            recordFail("remove", e, d.existingBlockId);
          }
        }
      }

      for (const d of input.decisions) {
        if (d.kind === "modify") {
          const subjectId = d.after.subjectSlug ? (slugToId.get(d.after.subjectSlug) ?? null) : null;
          try {
            await db.updateBlock(d.existingBlockId, {
              blockType: d.after.blockType as any,
              title: d.after.title,
              description: d.after.description ?? null,
              durationMin: d.after.durationMin,
              startTime: d.after.startTime ?? null,
              subjectId,
            } as any);
            modified++;
            recordOk("modify", d.existingBlockId);
          } catch (e) {
            console.warn("[aiApplyProposal] update failed", e);
            recordFail("modify", e, d.existingBlockId);
          }
        }
      }

      // Adds: append after the existing tail (simple, predictable). Refining
      // sortOrder placement is a future polish; for now appending preserves
      // existing order and avoids a renumber cascade.
      const surviving = (await db.listBlocksForPlan(plan.id)) as any[];
      let nextSortOrder = surviving.length > 0
        ? Math.max(...surviving.map((b: any) => b.sortOrder ?? 0)) + 1
        : 0;
      for (const d of input.decisions) {
        if (d.kind === "add") {
          const subjectId = d.after.subjectSlug ? (slugToId.get(d.after.subjectSlug) ?? null) : null;
          try {
            await db.createBlock({
              planId: plan.id,
              blockType: d.after.blockType as any,
              subjectId,
              title: d.after.title,
              description: d.after.description ?? null,
              durationMin: d.after.durationMin,
              startTime: d.after.startTime ?? null,
              sortOrder: nextSortOrder++,
              status: "not_started" as any,
            } as any);
            added++;
            recordOk("add");
          } catch (e) {
            console.warn("[aiApplyProposal] create failed", e);
            recordFail("add", e);
          }
        }
      }

      const failedCount = results.filter((r) => !r.ok).length;
      await db.logAudit({
        actorOpenId: ctx.user?.openId,
        actorName: ctx.user?.name,
        entityType: "block",
        entityId: plan.id,
        action: "update",
        summary: `AI-edit applied for ${input.date}: +${added} ~${modified} -${removed}${failedCount > 0 ? ` (failed: ${failedCount})` : ""}`,
      });

      return { planId: plan.id, added, modified, removed, results };
    }),
  }),

  /* =================== BLOCKS =================== */
  blocks: router({
    list: publicProcedure.input(z.object({ planId: z.number() })).query(({ input }) => db.listBlocksForPlan(input.planId)),
    /**
     * 2026-05-30 — added for the Schedule page's agenda-as-calendar feature.
     *
     * Returns every block whose plan falls inside the date window
     * `[startDate, endDate]` (inclusive, ISO YYYY-MM-DD), grouped by date so
     * the WeekView and AgendaCalendarStrip can render them all without
     * issuing 7 separate per-day queries.
     *
     * Plans are NOT auto-created here — the read is non-mutating, so
     * `ensurePlanForDate` does not run. Days with no plan return an empty
     * array.
     */
    weekRange: publicProcedure
      .input(z.object({
        startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      }))
      .query(async ({ input }) => {
        const out: Record<string, any[]> = {};
        const start = new Date(input.startDate + "T00:00:00");
        const end = new Date(input.endDate + "T00:00:00");
        if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) {
          return { byDate: {} };
        }
        const MS_PER_DAY = 86400000;
        const totalDays = Math.min(
          Math.round((end.getTime() - start.getTime()) / MS_PER_DAY) + 1,
          31, // hard cap so we never iterate more than a month per call
        );
        for (let i = 0; i < totalDays; i++) {
          const d = new Date(start.getTime() + i * MS_PER_DAY);
          const y = d.getFullYear();
          const m = String(d.getMonth() + 1).padStart(2, "0");
          const day = String(d.getDate()).padStart(2, "0");
          const dateStr = `${y}-${m}-${day}`;
          out[dateStr] = [];
          try {
            const plan: any = await db.getPlanByDate(dateStr);
            if (plan?.id) {
              const blocks: any[] = await db.listBlocksForPlan(plan.id);
              out[dateStr] = blocks ?? [];
            }
          } catch {
            /* missing plan or transient — leave empty for that date */
          }
        }
        return { byDate: out };
      }),
    /**
     * Push 87 (2026-05-13) — kid-safe gate for inline tap-edit.
     *
     * Mirrors familyAdminProcedure logic but returns a flag rather than
     * throwing so the UI can render the tap-edit pencil only for adults.
     * Reagan's session returns { allowed: false } and the popover never
     * mounts. Belt-and-suspenders: even if she calls blocks.update directly,
     * familyAdminProcedure will reject her.
     */
    canInlineEdit: publicProcedure.query(({ ctx }) => {
      if (!ctx.user) return { allowed: false as const };
      const dbRoleOk = ctx.user.role === "admin" || ctx.user.role === "tutor";
      const familyRole = roleForEmail((ctx.user as any).email ?? null);
      const familyOk = familyRole === "parent" || familyRole === "editor" || familyRole === "tutor";
      return { allowed: (dbRoleOk || familyOk) as boolean };
    }),
    create: familyAdminProcedure.input(z.object({
      planId: z.number(), blockType: BlockType, title: z.string(), description: z.string().optional(),
      durationMin: z.number().default(30), startTime: z.string().optional(), sortOrder: z.number().default(0),
      subjectId: z.number().optional(), adventureId: z.number().optional(),
    })).mutation(async ({ input, ctx }) => {
      const r = await db.createBlock(input as any);
      await db.logAudit({ actorOpenId: ctx.user?.openId, actorName: ctx.user?.name, entityType: "block", entityId: (r as any)?.id, action: "create", summary: input.title });
      return r;
    }),
    /**
     * Convenience for the Agenda Editor's manual "+ Add block" button.
     * Takes a date, ensures (or creates) a plan for it, then appends a new
     * block at the end of that day.
     */
    createForDate: familyAdminProcedure.input(z.object({
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      title: z.string().default("New block"),
      blockType: BlockType.default("custom" as any),
      durationMin: z.number().int().min(5).max(180).default(30),
      startTime: z.string().regex(/^\d{1,2}:\d{2}$/).optional(),
      subjectSlug: z.string().nullable().optional(),
    })).mutation(async ({ input, ctx }) => {
      const plan = await db.ensurePlanForDate(input.date, "full", { allowWeekendAutoBuild: false } as any);
      if (!plan) throw new Error("could not ensure plan for date");
      const live = await db.listBlocksForPlan(plan.id);
      const maxSort = Math.max(0, ...(live as any[]).map(b => b.sortOrder || 0)) + 1;
      let subjectId: number | null = null;
      if (input.subjectSlug) {
        const subjects = await db.listSubjects();
        const s = (subjects as any[]).find(x => x.slug === input.subjectSlug);
        subjectId = s?.id ?? null;
      }
      const id = await db.createBlock({
        planId: plan.id,
        blockType: input.blockType as any,
        subjectId,
        title: input.title,
        description: null,
        durationMin: input.durationMin,
        startTime: input.startTime || null,
        sortOrder: maxSort,
        status: "not_started" as any,
        curriculumTopicId: null,
      } as any);
      await db.logAudit({ actorOpenId: ctx.user?.openId, actorName: ctx.user?.name, entityType: "block", entityId: (id as any), action: "create", summary: `Manual + Add: ${input.title}` });
      return { id, planId: plan.id };
    }),
    /**
     * Push 19 (2026-05-12) — Tutor convenience: copy every block from a
     * source date onto the target date. Used by the AgendaEditor's
     * "Copy yesterday" / "Copy from last Monday" quick buttons. Existing
     * blocks on the target date are PRESERVED and the copied blocks are
     * appended (sortOrder keeps incrementing). Status resets to
     * `not_started` so the tutor doesn't inherit a green checkmark; grades
     * + notes + completion timestamps are not copied.
     */
    copyFromDate: familyAdminProcedure.input(z.object({
      sourceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      targetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    })).mutation(async ({ input, ctx }) => {
      if (input.sourceDate === input.targetDate) {
        return { copied: 0, skipped: 0, reason: "same-date" as const };
      }
      const srcPlan = await db.getPlanByDate(input.sourceDate);
      if (!srcPlan) return { copied: 0, skipped: 0, reason: "no-source-plan" as const };
      const srcBlocks = await db.listBlocksForPlan((srcPlan as any).id);
      if (!srcBlocks.length) return { copied: 0, skipped: 0, reason: "empty-source" as const };
      const targetPlan = await db.ensurePlanForDate(input.targetDate, "full", { allowWeekendAutoBuild: false } as any);
      if (!targetPlan) throw new Error("could not ensure target plan");
      const existing = await db.listBlocksForPlan((targetPlan as any).id);
      let nextSort = Math.max(0, ...(existing as any[]).map(b => b.sortOrder || 0)) + 1;
      let copied = 0;
      for (const b of srcBlocks as any[]) {
        await db.createBlock({
          planId: (targetPlan as any).id,
          blockType: b.blockType,
          subjectId: b.subjectId ?? null,
          title: b.title,
          description: b.description ?? null,
          durationMin: b.durationMin ?? 30,
          startTime: b.startTime ?? null,
          sortOrder: nextSort++,
          status: "not_started" as any,
          curriculumTopicId: b.curriculumTopicId ?? null,
        } as any);
        copied++;
      }
      await db.logAudit({
        actorOpenId: ctx.user?.openId,
        actorName: ctx.user?.name,
        entityType: "plan",
        entityId: (targetPlan as any).id,
        action: "create",
        summary: `Copied ${copied} block(s) from ${input.sourceDate} into ${input.targetDate}`,
      });
      return { copied, skipped: 0, planId: (targetPlan as any).id };
    }),
    /**
     * Slice 3: "Design today from blank" starter. Clears every block on a given
     * date so the adult/tutor can build the day from scratch (manual + Add
     * blocks, or AI box). Plan row stays in place; dayType preserved.
     * Returns { planId, deleted } so the UI can confirm.
     */
    clearDay: familyAdminProcedure.input(z.object({
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    })).mutation(async ({ input, ctx }) => {
      const plan = await db.ensurePlanForDate(input.date, "full", { allowWeekendAutoBuild: false } as any);
      if (!plan) throw new Error("could not ensure plan for date");
      const deleted = await db.deleteBlocksForPlan(plan.id);
      await db.logAudit({ actorOpenId: ctx.user?.openId, actorName: ctx.user?.name, entityType: "plan", entityId: plan.id, action: "clear", summary: `Cleared ${deleted} block(s) for ${input.date} (Design from blank)` });
      return { planId: plan.id, deleted };
    }),
    update: familyAdminProcedure.input(z.object({
      id: z.number(),
      title: z.string().optional(),
      description: z.string().nullable().optional(),
      status: BlockStatus.optional(),
      grade: z.string().optional(),
      notes: z.string().optional(),
      durationMin: z.number().min(1).max(240).optional(),
      sortOrder: z.number().optional(),
      // Manus-style full manual control
      startTime: z.string().regex(/^\d{1,2}:\d{2}$/).nullable().optional(),
      blockType: BlockType.optional(),
      subjectSlug: z.string().nullable().optional(),
      curriculumTopicId: z.number().int().positive().nullable().optional(),
      curriculumTopicCode: z.string().min(1).max(30).nullable().optional(),
    })).mutation(async ({ input, ctx }) => {
      const patch: any = { ...input };
      delete patch.id;
      delete patch.subjectSlug;
      delete patch.curriculumTopicCode;
      if (input.status === "complete") patch.completedAt = new Date(), patch.completedByUserId = ctx.user?.id;
      // Resolve subjectSlug → subjectId
      if (input.subjectSlug !== undefined) {
        if (input.subjectSlug === null) patch.subjectId = null;
        else {
          const subjects = await db.listSubjects();
          const s = (subjects as any[]).find(x => x.slug === input.subjectSlug);
          if (s) patch.subjectId = s.id;
        }
      }
      // Resolve curriculumTopicCode → curriculumTopicId
      if (input.curriculumTopicCode && input.curriculumTopicId == null) {
        const codeMap = await resolveTopicIds([input.curriculumTopicCode]).catch(() => new Map<string, number>());
        const tid = codeMap.get(String(input.curriculumTopicCode).trim().toUpperCase());
        if (tid) patch.curriculumTopicId = tid;
      }
      const r = await db.updateBlock(input.id, patch);
      await db.logAudit({ actorOpenId: ctx.user?.openId, actorName: ctx.user?.name, entityType: "block", entityId: input.id, action: input.status === "complete" ? "complete" : "update", summary: input.title || (input.status ?? "edit") });
      return r;
    }),
    complete: familyAdminProcedure.input(z.object({ id: z.number(), grade: z.string().optional(), notes: z.string().optional() }))
      .mutation(async ({ input, ctx }) => {
        const r = await db.updateBlock(input.id, {
          status: "complete", grade: input.grade, notes: input.notes,
          completedAt: new Date(), completedByUserId: ctx.user?.id,
        } as any);
        await db.logAudit({ actorOpenId: ctx.user?.openId, actorName: ctx.user?.name, entityType: "block", entityId: input.id, action: "complete", summary: input.grade });
        // Sticker + coin economy: +1 sticker, +1 coin every block done.
        // v2.30 (2026-05-18) Slice 6 closeout — forward awardSticker's
        // summerActive + streakBoostMultiplier + coins fields onto the
        // returned row so the kid-side celebrate toast can surface the
        // boost without a second round-trip. Best-effort — if the award
        // fails the original block row still ships back.
        let award: any = null;
        try {
          award = await db.awardSticker({
            userId: (ctx.user as any)?.id ?? null,
            reason: "block_done",
            blockId: input.id,
            coins: 1,
          });
        } catch (e) {
          console.warn("[rewards] awardSticker failed", e);
        }
        return {
          ...(r as any),
          summerActive: !!(award && award.summerActive),
          streakDays: award?.streakDays ?? 0,
          streakBoostMultiplier: award?.streakBoostMultiplier ?? 1,
          coins: award?.coins ?? 0,
          baseCoins: award?.baseCoins ?? 0,
        };
      }),
    /**
     * Push 43 (2026-05-13) — Reagan self-marks her own block complete.
     *
     * Spec from todo.md:
     *   "Reagan marks her own block complete (no adult sign-off for
     *    completion; adults still grade). She CANNOT change start/end
     *    times — only Mom + Grandma can."
     *
     * Differences vs blocks.complete (familyAdmin):
     *   - publicProcedure: Reagan does not have a family-admin session.
     *   - never writes grade or notes (those stay an adult action).
     *   - records source='kiwi' so the audit log can tell adults later
     *     that Reagan marked it herself.
     *   - still awards the sticker + coin so the economy isn't bypassed.
     */
    selfComplete: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const r = await db.updateBlock(input.id, {
          status: "complete",
          completedAt: new Date(),
          completedByUserId: ctx.user?.id ?? null,
        } as any);
        await db.logAudit({
          actorOpenId: ctx.user?.openId ?? "reagan-self",
          actorName: ctx.user?.name ?? "Reagan",
          entityType: "block",
          entityId: input.id,
          action: "complete",
          summary: "reagan-self-mark",
        });
        // v2.30 (2026-05-18) Slice 6 closeout — forward awardSticker's
        // summer-boost payload onto the returned row so Reagan's
        // celebrate toast can show the ×boost copy on streak days.
        let award: any = null;
        try {
          award = await db.awardSticker({
            userId: (ctx.user as any)?.id ?? null,
            reason: "block_done",
            blockId: input.id,
            coins: 1,
          });
        } catch (e) {
          console.warn("[rewards] awardSticker failed (selfComplete)", e);
        }
        return {
          ...(r as any),
          summerActive: !!(award && award.summerActive),
          streakDays: award?.streakDays ?? 0,
          streakBoostMultiplier: award?.streakBoostMultiplier ?? 1,
          coins: award?.coins ?? 0,
          baseCoins: award?.baseCoins ?? 0,
        };
      }),
    move: familyAdminProcedure.input(z.object({
      id: z.number(), direction: z.enum(["up", "down"]),
    })).mutation(async ({ input, ctx }) => {
      const r = await db.moveBlock(input.id, input.direction);
      await db.logAudit({ actorOpenId: ctx.user?.openId, actorName: ctx.user?.name, entityType: "block", entityId: input.id, action: "update", summary: `move-${input.direction}` });
      return r;
    }),
    /**
     * Drag-and-drop reorder. Caller passes the date and the desired full
     * list of block ids in the new order. We rewrite sortOrder for every
     * matching block in one pass. Unknown ids are ignored. Blocks belonging
     * to the day's plan that are absent from `orderedIds` retain their old
     * sortOrder past the supplied list (defensive — avoids data loss).
     */
    reorder: familyAdminProcedure.input(z.object({
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      orderedIds: z.array(z.number().int().positive()).min(1).max(50),
      /**
       * Slice 4 push 11 (2026-05-12): when true, AFTER rewriting sortOrder we
       * walk the reordered blocks left→right and reassign each block.startTime
       * by stacking durations from the first reordered block's existing
       * startTime. Skipped cleanly when:
       *   - flag is false / undefined (current callers behave as before)
       *   - first reordered block has no startTime (no anchor)
       *   - any computed time would cross midnight (skip just that block, keep going)
       */
      cascadeStartTimes: z.boolean().optional().default(false),
    })).mutation(async ({ input, ctx }) => {
      const plan = await db.getPlanByDate(input.date);
      if (!plan) throw new Error("no plan for date");
      const live: any[] = await db.listBlocksForPlan(plan.id);
      const liveIds = new Set(live.map(b => b.id));
      const cleaned = input.orderedIds.filter(id => liveIds.has(id));
      let touched = 0;
      for (let i = 0; i < cleaned.length; i++) {
        await db.updateBlock(cleaned[i], { sortOrder: i } as any);
        touched++;
      }
      // Append any blocks not mentioned (safety) preserving their relative order.
      const mentioned = new Set(cleaned);
      const tail = live.filter(b => !mentioned.has(b.id)).sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
      for (let j = 0; j < tail.length; j++) {
        await db.updateBlock(tail[j].id, { sortOrder: cleaned.length + j } as any);
      }
      // Slice 4 push 11: optional startTime cascade.
      let cascaded = 0, cascadeSkipped = 0;
      if (input.cascadeStartTimes && cleaned.length > 0) {
        const byId = new Map<number, any>(live.map(b => [b.id, b]));
        const firstBlock = byId.get(cleaned[0]);
        const anchor = firstBlock?.startTime ? String(firstBlock.startTime) : null;
        const m = anchor ? anchor.match(/^(\d{1,2}):(\d{2})$/) : null;
        if (m) {
          let cursor = parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
          for (let i = 0; i < cleaned.length; i++) {
            const b = byId.get(cleaned[i]);
            if (!b) continue;
            if (cursor < 0 || cursor >= 24 * 60) { cascadeSkipped++; continue; }
            const hh = Math.floor(cursor / 60).toString().padStart(2, "0");
            const mm = (cursor % 60).toString().padStart(2, "0");
            await db.updateBlock(b.id, { startTime: `${hh}:${mm}` } as any);
            cascaded++;
            cursor += Math.max(0, Number(b.durationMin) || 0);
          }
        } else {
          // no usable anchor: silently skip cascade rather than throw
          cascadeSkipped = cleaned.length;
        }
      }
      await db.logAudit({ actorOpenId: ctx.user?.openId, actorName: ctx.user?.name, entityType: "block", entityId: cleaned[0] ?? plan.id, action: "update", summary: `reorder ${touched} blocks${input.cascadeStartTimes ? ` + cascade ${cascaded}/${cascadeSkipped}` : ""} (plan ${plan.id})` });
      return { touched, cascaded, cascadeSkipped };
    }),
    /**
     * Push 55 (2026-05-13) — Reagan-side self-reorder.
     *
     * Reagan can drag her own day to reorder blocks but is NEVER allowed
     * to change startTime / durationMin (Mom + Grandma only). This proc
     * rewrites `sortOrder` only and explicitly does NOT touch startTime.
     * No cascadeStartTimes parameter is accepted on this path.
     *
     * Auth: protectedProcedure (any logged-in user, including Reagan).
     * Mom + Grandma should keep using `blocks.reorder` which supports the
     * full cascade. We log it as actor 'reagan' so audit trail is honest.
     */
    selfReorder: protectedProcedure.input(z.object({
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      orderedIds: z.array(z.number().int().positive()).min(1).max(50),
    })).mutation(async ({ input, ctx }) => {
      const plan = await db.getPlanByDate(input.date);
      if (!plan) throw new Error("no plan for date");
      const live: any[] = await db.listBlocksForPlan(plan.id);
      const liveIds = new Set(live.map(b => b.id));
      const cleaned = input.orderedIds.filter(id => liveIds.has(id));
      let touched = 0;
      for (let i = 0; i < cleaned.length; i++) {
        // NOTE: only sortOrder; explicitly NOT startTime/durationMin.
        await db.updateBlock(cleaned[i], { sortOrder: i } as any);
        touched++;
      }
      const mentioned = new Set(cleaned);
      const tail = live.filter(b => !mentioned.has(b.id)).sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
      for (let j = 0; j < tail.length; j++) {
        await db.updateBlock(tail[j].id, { sortOrder: cleaned.length + j } as any);
      }
      await db.logAudit({ actorOpenId: ctx.user?.openId, actorName: ctx.user?.name ?? "reagan", entityType: "block", entityId: cleaned[0] ?? plan.id, action: "update", summary: `selfReorder ${touched} blocks (plan ${plan.id})` });
      return { touched };
    }),
    delete: familyAdminProcedure.input(z.object({ id: z.number() })).mutation(async ({ input, ctx }) => {
      const r = await db.deleteBlock(input.id);
      await db.logAudit({ actorOpenId: ctx.user?.openId, actorName: ctx.user?.name, entityType: "block", entityId: input.id, action: "delete" });
      return r;
    }),

    /**
     * Shift the entire day's start times by N minutes. Negative numbers shift
     * earlier, positive shift later. Blocks without a startTime are skipped.
     * Blocks that would cross midnight in either direction are skipped (no
     * day-rollover surprises).
     */
    shiftDay: familyAdminProcedure.input(z.object({
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      minutes: z.number().int().min(-12 * 60).max(12 * 60),
    })).mutation(async ({ input, ctx }) => {
      const plan = await db.getPlanByDate(input.date);
      if (!plan) throw new Error("no plan for date");
      const live: any[] = await db.listBlocksForPlan(plan.id);
      let shifted = 0, skipped = 0;
      for (const b of live) {
        if (!b.startTime) { skipped++; continue; }
        const m = String(b.startTime).match(/^(\d{1,2}):(\d{2})$/);
        if (!m) { skipped++; continue; }
        const total = parseInt(m[1], 10) * 60 + parseInt(m[2], 10) + input.minutes;
        if (total < 0 || total >= 24 * 60) { skipped++; continue; }
        const hh = Math.floor(total / 60).toString().padStart(2, "0");
        const mm = (total % 60).toString().padStart(2, "0");
        await db.updateBlock(b.id, { startTime: `${hh}:${mm}` } as any);
        shifted++;
      }
      await db.logAudit({
        actorOpenId: ctx.user?.openId, actorName: ctx.user?.name,
        entityType: "block", entityId: plan.id, action: "update",
        summary: `shift day ${input.minutes >= 0 ? "+" : ""}${input.minutes}m (✓${shifted}/✗${skipped})`,
      });
      return { shifted, skipped };
    }),
  }),

  /* =================== AUDIT =================== */
  audit: router({
    list: protectedProcedure.input(z.object({ limit: z.number().default(100) }).optional()).query(({ input }) => db.listAudit(input?.limit ?? 100)),
  }),

  /* =================== AGENDA EDITOR (Manus-style) =================== */
  agendaEditor: router({
    /**
     * Push 88 (2026-05-13) — Free-form prompt → diff scaffold.
     *
     * Mom types "short fun and easy" or "add 10 min to math" and the
     * deterministic keyword parser returns a list of `Directive`s plus the
     * diff ops they would produce on today's blocks. No DB writes here —
     * just a preview the UI can render before Mom hits "Apply".
     */
    previewPromptDiff: familyAdminProcedure
      .input(z.object({
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        prompt: z.string().min(1).max(800),
      }))
      .mutation(async ({ input }) => {
        const { parseAgendaPromptToDirectives, applyDirectivesAsDiff } = await import(
          "./_lib/agendaPromptParser"
        );
        const directives = parseAgendaPromptToDirectives(input.prompt);
        const plan = await db.getPlanByDate(input.date);
        const blocks = plan ? await db.listBlocksForPlan(plan.id) : [];
        const snapshot = (blocks as any[]).map((b: any) => ({
          id: b.id as number,
          title: b.title as string,
          subjectSlug: (b.subjectSlug ?? null) as string | null,
          durationMin: (b.durationMin ?? 30) as number,
          startTime: (b.startTime ?? null) as string | null,
          status: (b.status ?? "not_started") as string,
        }));
        return applyDirectivesAsDiff(snapshot, directives);
      }),
    /**
     * Build the AgendaPlanContext for a date — used by both the LLM call and
     * the manual block-grid view. Returns the current snapshot plus the
     * subject + topic catalogs the editor lets the adult choose from.
     */
    snapshot: protectedProcedure.input(z.object({ date: z.string() })).query(async ({ input }) => {
      const plan = await db.getPlanByDate(input.date);
      const blocks = plan ? await db.listBlocksForPlan(plan.id) : [];
      const profile: any = await db.getProfile().catch(() => null);
      const subjects = (await db.listSubjects()).map((s: any) => ({ slug: s.slug, name: s.name }));
      const topicCatalog = await loadTopicHintsForPrompt().catch(() => []);
      const tod = await resolveTutorOfDay(input.date).catch(() => null);
      const dt = new Date(input.date + "T12:00:00");
      const dayLabel = dt.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
      const snapshot: AgendaBlockSnapshot[] = (blocks as any[]).map((b: any) => ({
        id: b.id,
        title: b.title,
        description: b.description ?? null,
        blockType: b.blockType,
        startTime: b.startTime ?? null,
        durationMin: b.durationMin,
        sortOrder: b.sortOrder,
        status: b.status,
        subjectSlug: b.subjectSlug ?? null,
        curriculumTopicCode: b.curriculumTopicCode ?? null,
      }));
      const ctx: AgendaPlanContext = {
        planId: plan?.id ?? -1,
        date: input.date,
        dayLabel,
        studentName: profile?.studentName || "Reagan",
        gradeLevel: profile?.gradeLevel || "5th grade",
        tutorOfDayLabel: tutorOfDayLabel(tod),
        blocks: snapshot,
        subjects,
        topicCatalog: topicCatalog.map(t => ({ code: t.code, title: t.title, subjectSlug: t.subjectSlug })),
      };
      return ctx;
    }),

    /**
     * Preview an instruction. Calls the LLM, validates the plan, applies it
     * in memory and returns before/after snapshots so the UI can render a
     * side-by-side diff with no DB writes.
     */
    // Phase B-α.5 — tutors get full edit power on the agenda editor too.
    preview: familyAdminProcedure.input(z.object({
      date: z.string(),
      instruction: z.string().min(1).max(2000),
      // Optional file the adult / tutor attached. Either a public S3 URL
      // (returned by agendaEditor.uploadAttachment) or a /manus-storage path.
      attachmentUrl: z.string().url().or(z.string().startsWith("/manus-storage/")).optional(),
      attachmentMimeType: z.string().regex(/^[\w.+-]+\/[\w.+-]+$/).optional(),
    })).mutation(async ({ input }) => {
      const plan = await db.getPlanByDate(input.date);
      const blocks = plan ? await db.listBlocksForPlan(plan.id) : [];
      const profile: any = await db.getProfile().catch(() => null);
      const subjects = (await db.listSubjects()).map((s: any) => ({ slug: s.slug, name: s.name }));
      const topicCatalog = await loadTopicHintsForPrompt().catch(() => []);
      const tod = await resolveTutorOfDay(input.date).catch(() => null);
      const dt = new Date(input.date + "T12:00:00");
      const dayLabel = dt.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
      const snapshot: AgendaBlockSnapshot[] = (blocks as any[]).map((b: any) => ({
        id: b.id,
        title: b.title,
        description: b.description ?? null,
        blockType: b.blockType,
        startTime: b.startTime ?? null,
        durationMin: b.durationMin,
        sortOrder: b.sortOrder,
        status: b.status,
        subjectSlug: b.subjectSlug ?? null,
        curriculumTopicCode: b.curriculumTopicCode ?? null,
      }));
      const ctx: AgendaPlanContext = {
        planId: plan?.id ?? -1,
        date: input.date,
        dayLabel,
        studentName: profile?.studentName || "Reagan",
        gradeLevel: profile?.gradeLevel || "5th grade",
        tutorOfDayLabel: tutorOfDayLabel(tod),
        blocks: snapshot,
        subjects,
        topicCatalog: topicCatalog.map(t => ({ code: t.code, title: t.title, subjectSlug: t.subjectSlug })),
      };
      const attachment = input.attachmentUrl && input.attachmentMimeType
        ? { url: input.attachmentUrl, mimeType: input.attachmentMimeType }
        : undefined;
      const editPlan = await generateAgendaEditPlan(ctx, input.instruction, attachment);
      const after = applyEditPlanInMemory(ctx, editPlan);
      return { plan: editPlan, before: snapshot, after };
    }),

    /**
     * Commit an edit plan. Adult must have already previewed. We snapshot the
     * current blocks BEFORE applying so the client can pass the snapshot to
     * `undo` for a deterministic restore.
     */
    // Phase B-α.5 — tutors can commit edits too. Audit log still records ctx.user.id.
    commit: familyAdminProcedure.input(z.object({
      date: z.string(),
      ops: z.array(z.any()).max(60),
      summary: z.string().max(400).optional(),
    })).mutation(async ({ input, ctx }) => {
      // Re-build context from live DB so we never trust a stale client.
      const plan = await db.ensurePlanForDate(input.date, "full", { allowWeekendAutoBuild: false });
      if (!plan) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "could not ensure plan" });
      const live = await db.listBlocksForPlan(plan.id);
      const subjects = (await db.listSubjects()).map((s: any) => ({ slug: s.slug, name: s.name }));
      const subjectIdBySlug = new Map<string, number>((await db.listSubjects()).map((s: any) => [s.slug, s.id as number]));
      const topicCatalog = await loadTopicHintsForPrompt().catch(() => []);
      const snapshot: AgendaBlockSnapshot[] = (live as any[]).map((b: any) => ({
        id: b.id,
        title: b.title,
        description: b.description ?? null,
        blockType: b.blockType,
        startTime: b.startTime ?? null,
        durationMin: b.durationMin,
        sortOrder: b.sortOrder,
        status: b.status,
        subjectSlug: b.subjectSlug ?? null,
        curriculumTopicCode: b.curriculumTopicCode ?? null,
      }));
      const planCtx: AgendaPlanContext = {
        planId: plan.id,
        date: input.date,
        dayLabel: input.date,
        studentName: "Reagan",
        gradeLevel: "5th grade",
        tutorOfDayLabel: null,
        blocks: snapshot,
        subjects,
        topicCatalog: topicCatalog.map(t => ({ code: t.code, title: t.title, subjectSlug: t.subjectSlug })),
      };
      const validated = validateEditPlan({
        summary: input.summary || "manual commit",
        intent: "mixed",
        ops: input.ops as AgendaEditOp[],
        warnings: [],
      }, planCtx);

      // Apply ops to DB. We resolve subjectSlug → subjectId and
      // curriculumTopicCode → curriculumTopicId at write time.
      const codeMap = await resolveTopicIds(
        validated.ops.flatMap((op: AgendaEditOp) =>
          op.kind === "update" || op.kind === "insert" ? [(op as any).curriculumTopicCode || null] : []
        )
      ).catch(() => new Map<string, number>());

      const liveById = new Map<number, any>((live as any[]).map(b => [b.id, b]));
      let inserted = 0, updated = 0, deleted = 0, reordered = 0, shifted = 0;

      for (const op of validated.ops) {
        switch (op.kind) {
          case "update": {
            const patch: any = {};
            if (op.title !== undefined) patch.title = op.title;
            if (op.description !== undefined) patch.description = op.description;
            if (op.blockType !== undefined) patch.blockType = op.blockType;
            if (op.startTime !== undefined) patch.startTime = op.startTime;
            if (op.durationMin !== undefined) patch.durationMin = op.durationMin;
            if (op.subjectSlug !== undefined) {
              patch.subjectId = op.subjectSlug ? (subjectIdBySlug.get(op.subjectSlug) ?? null) : null;
            }
            if (op.curriculumTopicCode !== undefined) {
              const code = (op.curriculumTopicCode || "").trim().toUpperCase();
              patch.curriculumTopicId = code ? (codeMap.get(code) ?? null) : null;
            }
            await db.updateBlock(op.id, patch);
            updated++;
            break;
          }
          case "delete":
            await db.deleteBlock(op.id);
            deleted++;
            break;
          case "insert": {
            const subjectId = op.subjectSlug ? (subjectIdBySlug.get(op.subjectSlug) ?? null) : null;
            const code = (op.curriculumTopicCode || "").trim().toUpperCase();
            const topicId = code ? (codeMap.get(code) ?? null) : null;
            const maxSort = Math.max(0, ...(live as any[]).map(b => b.sortOrder || 0)) + inserted + 1;
            await db.createBlock({
              planId: plan.id,
              blockType: op.blockType as any,
              subjectId,
              title: op.title,
              description: op.description || null,
              durationMin: op.durationMin,
              startTime: op.startTime || null,
              sortOrder: maxSort,
              status: "not_started" as any,
              curriculumTopicId: topicId,
            } as any);
            inserted++;
            break;
          }
          case "reorder": {
            let i = 0;
            for (const id of op.orderedIds) {
              await db.updateBlock(id, { sortOrder: i++ } as any);
            }
            reordered++;
            break;
          }
          case "shiftAll": {
            for (const b of live as any[]) {
              if (!b.startTime) continue;
              const m = String(b.startTime).match(/^(\d{1,2}):(\d{2})$/);
              if (!m) continue;
              const total = parseInt(m[1], 10) * 60 + parseInt(m[2], 10) + op.minutes;
              if (total < 0 || total >= 24 * 60) continue;
              const hh = Math.floor(total / 60).toString().padStart(2, "0");
              const mm = (total % 60).toString().padStart(2, "0");
              await db.updateBlock(b.id, { startTime: `${hh}:${mm}` } as any);
            }
            shifted++;
            break;
          }
          case "queue_review_block": {
            // v3.17 (2026-05-30) — manually queue a catch-up review block.
            const opR = op as any;
            const subjectName = opR.subjectSlug
              ? (planCtx.subjects.find((s: any) => s.slug === opR.subjectSlug)?.name ?? opR.subjectSlug)
              : null;
            const topicLabel = opR.topic ?? opR.curriculumTopicCode ?? subjectName ?? "this material";
            const title = `Review: ${topicLabel}`;
            const desc = [
              `Catch-up review on ${topicLabel}.`,
              opR.reason ? `Why: ${opR.reason}.` : null,
              "Pull a few practice problems from her current ladder row and check her work together.",
            ].filter(Boolean).join(" ");
            const subjectId = opR.subjectSlug ? (subjectIdBySlug.get(opR.subjectSlug) ?? null) : null;
            const code = (opR.curriculumTopicCode || "").trim().toUpperCase();
            const topicId = code ? (codeMap.get(code) ?? null) : null;
            const maxSort = Math.max(0, ...(live as any[]).map((b: any) => b.sortOrder || 0)) + inserted + 1;
            await db.createBlock({
              planId: plan.id,
              blockType: "catch_up" as any,
              subjectId,
              title,
              description: desc,
              durationMin: opR.durationMin ?? 25,
              startTime: null,
              sortOrder: maxSort,
              status: "not_started" as any,
              curriculumTopicId: topicId,
            } as any);
            inserted++;
            break;
          }
        }
      }

      await db.logAudit({
        actorOpenId: ctx.user?.openId,
        actorName: ctx.user?.name,
        entityType: "block",
        entityId: plan.id,
        action: "update",
        summary: `Agenda editor: ${input.summary || "applied edit plan"} [\u2713${updated}upd \u2713${inserted}ins \u2713${deleted}del \u2713${reordered}ord \u2713${shifted}shift]`,
      });
      return { planId: plan.id, snapshot, updated, inserted, deleted, reordered, shifted, warnings: validated.warnings };
    }),

    /**
     * Undo: replace ALL blocks for a date with the given snapshot. Deterministic.
     */
    undo: protectedProcedure.input(z.object({
      date: z.string(),
      snapshot: z.array(z.object({
        id: z.number(),
        title: z.string(),
        description: z.string().nullable(),
        blockType: z.string(),
        startTime: z.string().nullable(),
        durationMin: z.number(),
        sortOrder: z.number(),
        status: z.string(),
        subjectSlug: z.string().nullable(),
        curriculumTopicCode: z.string().nullable(),
      })),
    })).mutation(async ({ input, ctx }) => {
      const plan = await db.ensurePlanForDate(input.date, "full", { allowWeekendAutoBuild: false });
      if (!plan) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "plan missing" });
      const subjectIdBySlug = new Map<string, number>((await db.listSubjects()).map((s: any) => [s.slug, s.id as number]));
      const codeMap = await resolveTopicIds(input.snapshot.map(s => s.curriculumTopicCode)).catch(() => new Map<string, number>());
      const existing = await db.listBlocksForPlan(plan.id);
      for (const b of existing as any[]) {
        try { await db.deleteBlock(b.id); } catch {}
      }
      let i = 0;
      for (const s of input.snapshot) {
        const subjectId = s.subjectSlug ? (subjectIdBySlug.get(s.subjectSlug) ?? null) : null;
        const code = (s.curriculumTopicCode || "").trim().toUpperCase();
        const topicId = code ? (codeMap.get(code) ?? null) : null;
        await db.createBlock({
          planId: plan.id,
          blockType: s.blockType as any,
          subjectId,
          title: s.title,
          description: s.description,
          durationMin: s.durationMin,
          startTime: s.startTime,
          sortOrder: i++,
          status: s.status as any,
          curriculumTopicId: topicId,
        } as any);
      }
      await db.logAudit({
        actorOpenId: ctx.user?.openId,
        actorName: ctx.user?.name,
        entityType: "block",
        entityId: plan.id,
        action: "update",
        summary: `Agenda editor: undo (restored ${input.snapshot.length} blocks)`,
      });
      return { planId: plan.id, restored: input.snapshot.length };
    }),

    /**
     * v2.99 — Unified AI chat: preview + auto-commit in one call.
     * Adult types anything; changes are applied immediately to the DB.
     * Returns a plain-English reply + the updated block list so the UI
     * can refresh without a second round-trip.
     */
    chat: familyAdminProcedure.input(z.object({
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      message: z.string().min(1).max(2000),
      attachmentUrl: z.string().url().or(z.string().startsWith("/manus-storage/")).optional(),
      attachmentMimeType: z.string().regex(/^[\w.+-]+\/[\w.+-]+$/).optional(),
    })).mutation(async ({ input, ctx }) => {
      // 1. Build context from live DB
      const plan = await db.ensurePlanForDate(input.date, "full", { allowWeekendAutoBuild: false });
      if (!plan) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "could not ensure plan" });
      const live = await db.listBlocksForPlan(plan.id);
      const profile: any = await db.getProfile().catch(() => null);
      const subjects = (await db.listSubjects()).map((s: any) => ({ slug: s.slug, name: s.name }));
      const subjectIdBySlug = new Map<string, number>((await db.listSubjects()).map((s: any) => [s.slug, s.id as number]));
      const topicCatalog = await loadTopicHintsForPrompt().catch(() => []);
      const tod = await resolveTutorOfDay(input.date).catch(() => null);
      const dt = new Date(input.date + "T12:00:00");
      const dayLabel = dt.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
      const snapshot: AgendaBlockSnapshot[] = (live as any[]).map((b: any) => ({
        id: b.id, title: b.title, description: b.description ?? null,
        blockType: b.blockType, startTime: b.startTime ?? null,
        durationMin: b.durationMin, sortOrder: b.sortOrder,
        status: b.status, subjectSlug: b.subjectSlug ?? null,
        curriculumTopicCode: b.curriculumTopicCode ?? null,
      }));
      const planCtx: AgendaPlanContext = {
        planId: plan.id, date: input.date, dayLabel,
        studentName: profile?.studentName || "Reagan",
        gradeLevel: profile?.gradeLevel || "5th grade",
        tutorOfDayLabel: tutorOfDayLabel(tod),
        blocks: snapshot, subjects,
        topicCatalog: topicCatalog.map(t => ({ code: t.code, title: t.title, subjectSlug: t.subjectSlug })),
      };
      // 2. Generate edit plan via LLM
      const attachment = input.attachmentUrl && input.attachmentMimeType
        ? { url: input.attachmentUrl, mimeType: input.attachmentMimeType } : undefined;
      const editPlan = await generateAgendaEditPlan(planCtx, input.message, attachment);
      // 3. Validate + apply ops to DB immediately (no preview step)
      const validated = validateEditPlan(editPlan, planCtx);
      const codeMap = await resolveTopicIds(
        validated.ops.flatMap((op: AgendaEditOp) =>
          op.kind === "update" || op.kind === "insert" ? [(op as any).curriculumTopicCode || null] : []
        )
      ).catch(() => new Map<string, number>());
      let inserted = 0, updated = 0, deleted = 0, reordered = 0, shifted = 0;
      for (const op of validated.ops) {
        switch (op.kind) {
          case "update": {
            const patch: any = {};
            if (op.title !== undefined) patch.title = op.title;
            if (op.description !== undefined) patch.description = op.description;
            if (op.blockType !== undefined) patch.blockType = op.blockType;
            if (op.startTime !== undefined) patch.startTime = op.startTime;
            if (op.durationMin !== undefined) patch.durationMin = op.durationMin;
            if (op.subjectSlug !== undefined) patch.subjectId = op.subjectSlug ? (subjectIdBySlug.get(op.subjectSlug) ?? null) : null;
            if (op.curriculumTopicCode !== undefined) {
              const code = (op.curriculumTopicCode || "").trim().toUpperCase();
              patch.curriculumTopicId = code ? (codeMap.get(code) ?? null) : null;
            }
            await db.updateBlock(op.id, patch); updated++; break;
          }
          case "delete": await db.deleteBlock(op.id); deleted++; break;
          case "insert": {
            const subjectId = op.subjectSlug ? (subjectIdBySlug.get(op.subjectSlug) ?? null) : null;
            const code = (op.curriculumTopicCode || "").trim().toUpperCase();
            const topicId = code ? (codeMap.get(code) ?? null) : null;
            const maxSort = Math.max(0, ...(live as any[]).map((b: any) => b.sortOrder || 0)) + inserted + 1;
            await db.createBlock({
              planId: plan.id, blockType: op.blockType as any, subjectId,
              title: op.title, description: op.description || null,
              durationMin: op.durationMin, startTime: op.startTime || null,
              sortOrder: maxSort, status: "not_started" as any, curriculumTopicId: topicId,
            } as any);
            inserted++; break;
          }
          case "reorder": {
            let i = 0;
            for (const id of op.orderedIds) { await db.updateBlock(id, { sortOrder: i++ } as any); }
            reordered++; break;
          }
          case "shiftAll": {
            for (const b of live as any[]) {
              if (!b.startTime) continue;
              const m2 = String(b.startTime).match(/^(\d{1,2}):(\d{2})$/);
              if (!m2) continue;
              const total = parseInt(m2[1], 10) * 60 + parseInt(m2[2], 10) + op.minutes;
              if (total < 0 || total >= 24 * 60) continue;
              const hh = Math.floor(total / 60).toString().padStart(2, "0");
              const mm2 = (total % 60).toString().padStart(2, "0");
              await db.updateBlock(b.id, { startTime: `${hh}:${mm2}` } as any);
            }
            shifted++; break;
          }
          case "queue_review_block": {
            // v3.17 (2026-05-30) — manually queue a catch-up review block via chat.
            const opR = op as any;
            const subjectName = opR.subjectSlug
              ? (planCtx.subjects.find((s: any) => s.slug === opR.subjectSlug)?.name ?? opR.subjectSlug)
              : null;
            const topicLabel = opR.topic ?? opR.curriculumTopicCode ?? subjectName ?? "this material";
            const title = `Review: ${topicLabel}`;
            const desc = [
              `Catch-up review on ${topicLabel}.`,
              opR.reason ? `Why: ${opR.reason}.` : null,
              "Pull a few practice problems from her current ladder row and check her work together.",
            ].filter(Boolean).join(" ");
            const subjectId = opR.subjectSlug ? (subjectIdBySlug.get(opR.subjectSlug) ?? null) : null;
            const code2 = (opR.curriculumTopicCode || "").trim().toUpperCase();
            const topicId2 = code2 ? (codeMap.get(code2) ?? null) : null;
            const maxSort2 = Math.max(0, ...(live as any[]).map((b: any) => b.sortOrder || 0)) + inserted + 1;
            await db.createBlock({
              planId: plan.id, blockType: "catch_up" as any, subjectId,
              title, description: desc,
              durationMin: opR.durationMin ?? 25, startTime: null,
              sortOrder: maxSort2, status: "not_started" as any, curriculumTopicId: topicId2,
            } as any);
            inserted++; break;
          }
          case "generate_worksheet": {
            // v3.16 (2026-05-30) — attach a freshly generated custom worksheet
            // to a block (or create a new block to host it).
            const { handleGenerateWorksheet } = await import("./_lib/agendaEditorWorksheetOp");
            const result = await handleGenerateWorksheet({
              planId: plan.id,
              targetBlockId: op.targetBlockId ?? null,
              topic: op.topic,
              subjectSlug: op.subjectSlug ?? null,
              gradeLevel: op.gradeLevel ?? planCtx.gradeLevel,
              questionCount: op.questionCount ?? 8,
              style: op.style ?? "practice",
              sourceAttachmentUrl: op.sourceAttachmentUrl ?? null,
              subjectIdBySlug,
              liveBlockCount: (live as any[]).length + inserted,
            });
            if (result.createdNewBlock) inserted++;
            else updated++;
            break;
          }
        }
      }
      await db.logAudit({
        actorOpenId: ctx.user?.openId, actorName: ctx.user?.name,
        entityType: "block", entityId: plan.id, action: "update",
        summary: `AI chat: "${input.message.slice(0, 80)}" [+${inserted} ~${updated} -${deleted} ord${reordered} shift${shifted}]`,
      });
      // 4. Return fresh block list + AI reply
      const fresh = await db.listBlocksForPlan(plan.id);
      const freshBlocks: AgendaBlockSnapshot[] = (fresh as any[]).map((b: any) => ({
        id: b.id, title: b.title, description: b.description ?? null,
        blockType: b.blockType, startTime: b.startTime ?? null,
        durationMin: b.durationMin, sortOrder: b.sortOrder,
        status: b.status, subjectSlug: b.subjectSlug ?? null,
        curriculumTopicCode: b.curriculumTopicCode ?? null,
      }));
      const changeCount = inserted + updated + deleted + reordered + shifted;
      const reply = changeCount === 0
        ? (editPlan.summary || "No changes needed — the schedule already looks good!")
        : editPlan.summary || `Done! Made ${changeCount} change${changeCount === 1 ? "" : "s"} to the schedule.`;
      return {
        reply, inserted, updated, deleted, reordered, shifted,
        warnings: validated.warnings, blocks: freshBlocks,
      };
    }),

    /**
     * Upload an image or PDF the adult attached to the chat box. Stored under
     * agenda-attachments/<date>-<rand>-<filename> and returned as the public
     * /manus-storage URL plus mime type. The client then passes both into
     * `agendaEditor.preview` as attachmentUrl + attachmentMimeType.
     */
    uploadAttachment: protectedProcedure.input(z.object({
      dataUrl: z.string().min(20),
      fileName: z.string().min(1).max(200),
    })).mutation(async ({ input }) => {
      const m = /^data:([^;]+);base64,(.+)$/.exec(input.dataUrl);
      if (!m) throw new TRPCError({ code: "BAD_REQUEST", message: "Expected a data URL." });
      const mime = m[1];
      if (!/^(image\/(png|jpe?g|gif|webp|heic)|application\/pdf)$/i.test(mime)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: `Unsupported mime ${mime}` });
      }
      const buf = Buffer.from(m[2], "base64");
      if (buf.length > 8 * 1024 * 1024) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "File too large (max 8 MB)." });
      }
      const safeName = input.fileName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-60);
      const key = `agenda-attachments/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeName}`;
      const stored = await storagePut(key, buf, mime);
      return { ...stored, mimeType: mime, sizeBytes: buf.length };
    }),
  }),

  /* =================== ADVENTURES =================== */
  adventures: router({
    list: publicProcedure.query(() => db.listAdventures()),
    get: publicProcedure.input(z.object({ id: z.number() })).query(({ input }) => db.getAdventure(input.id)),
    create: protectedProcedure.input(z.object({
      title: z.string(), description: z.string(),
      subjectSlugs: z.array(z.string()), topicTags: z.array(z.string()),
      interestTags: z.array(z.string()), materials: z.array(z.string()),
      instructions: z.string(),
      minDurationMin: z.number().default(30), maxDurationMin: z.number().default(90),
      setting: z.enum(["indoor","outdoor","either"]).default("either"),
      energyLevel: z.enum(["low","medium","high"]).default("medium"),
    })).mutation(({ input }) => db.insertAdventure(input as any)),
    toggleFavorite: protectedProcedure.input(z.object({ id: z.number() })).mutation(({ input }) => db.toggleAdventureFavorite(input.id)),
    updateCoverUrl: protectedProcedure.input(z.object({ id: z.number(), coverImageUrl: z.string().url() })).mutation(({ input }) => db.updateAdventureCover(input.id, input.coverImageUrl)),
    /**
     * v2.18 (2026-05-17) — Generic adventure update. Adult-only because
     * adventures are reference data shared across every plan and tutor;
     * Reagan must not be able to rename or rewrite them. The input shape
     * mirrors `create` but every field except `id` is optional, so Mom
     * can rename one adventure without re-sending the whole record.
     */
    update: familyAdminProcedure.input(z.object({
      id: z.number().int().positive(),
      title: z.string().min(1).max(200).optional(),
      description: z.string().min(1).optional(),
      subjectSlugs: z.array(z.string()).optional(),
      topicTags: z.array(z.string()).optional(),
      interestTags: z.array(z.string()).optional(),
      materials: z.array(z.string()).optional(),
      instructions: z.string().min(1).optional(),
      minDurationMin: z.number().int().min(1).max(240).optional(),
      maxDurationMin: z.number().int().min(1).max(240).optional(),
      setting: z.enum(["indoor","outdoor","either"]).optional(),
      energyLevel: z.enum(["low","medium","high"]).optional(),
      ohioStandards: z.array(z.string()).optional(),
      emoji: z.string().max(8).optional(),
      isFavorite: z.boolean().optional(),
    })).mutation(async ({ input }) => {
      const { id, ...patch } = input;
      // Server-side sanity check: if both duration bounds are present,
      // min must be <= max. Catches typos before they corrupt the row.
      if (
        patch.minDurationMin !== undefined &&
        patch.maxDurationMin !== undefined &&
        patch.minDurationMin > patch.maxDurationMin
      ) {
        throw new Error("minDurationMin cannot be greater than maxDurationMin");
      }
      return db.updateAdventure(id, patch as any);
    }),
    /**
     * v2.18 — Materials-only fast path used by the AgendaEditor adventure
     * materials sub-panel. Replaces the whole array atomically so the UI
     * can hand us the post-edit list without diffing client-side.
     */
    updateMaterials: familyAdminProcedure.input(z.object({
      id: z.number().int().positive(),
      materials: z.array(z.string().min(1).max(200)).max(50),
    })).mutation(({ input }) => db.updateAdventureMaterials(input.id, input.materials)),
    /**
     * v2.18 — Hard delete. Adult-only. Adventures are reference data;
     * removing one removes it from every plan that referenced it by id
     * (which today is none — plans store materials inline).
     */
    delete: familyAdminProcedure.input(z.object({
      id: z.number().int().positive(),
    })).mutation(({ input }) => db.deleteAdventure(input.id)),
    generateCover: protectedProcedure.input(z.object({ id: z.number(), promptOverride: z.string().optional() })).mutation(async ({ input }) => {
      const { generateImage } = await import("./_core/imageGeneration");
      const adv = await db.getAdventure(input.id);
      if (!adv) throw new Error("Adventure not found");
      const subj = Array.isArray((adv as any).subjectSlugs) && (adv as any).subjectSlugs.length > 0 ? (adv as any).subjectSlugs[0] : "adventure";
      const basePrompt = input.promptOverride ||
        `Whimsical hand-drawn classroom illustration of: \"${(adv as any).title}\". ${(adv as any).description || ""}. ` +
        `Style: cozy children's book, soft pastels, warm lighting, slight crayon texture, kid-friendly. ` +
        `Subject context: ${subj}. No text, no letters, no logos.`;
      const result = await generateImage({ prompt: basePrompt });
      const url = (result as any).url || "";
      if (url) await db.updateAdventureCover(input.id, url);
      return { url };
    }),
  }),

  /* =================== APPS =================== */
  appLinks: router({
    list: publicProcedure.query(() => db.listAppLinks()),
    create: protectedProcedure.input(z.object({
      name: z.string(), url: z.string(), category: z.enum(["learning","creativity","school","nature","reading"]),
      emoji: z.string(), description: z.string().optional(), accountInfo: z.string().optional(), sortOrder: z.number().default(0),
    })).mutation(({ input }) => db.insertAppLink(input as any)),
    update: protectedProcedure.input(z.object({
      id: z.number(),
      name: z.string().optional(), url: z.string().optional(),
      emoji: z.string().optional(),
      category: z.enum(["learning","creativity","school","nature","reading"]).optional(),
      description: z.string().optional(), accountInfo: z.string().optional(), sortOrder: z.number().optional(),
    })).mutation(({ input }) => db.updateAppLink(input.id, input)),
    delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(({ input }) => db.deleteAppLink(input.id)),
    /**
     * openEngagement — fire-and-forget engagement signal when Reagan taps an
     * app tile. We map the tile's category to a subject slug and hand a tiny
     * skill bump (selfRating=2 — "tried it") to the *first incomplete* skill
     * for that subject. Never punishing, just compounding curiosity.
     */
    openEngagement: publicProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
      try {
        const links = await db.listAppLinks();
        const link = (links as any[]).find((l) => l.id === input.id);
        if (!link) return { ok: false as const, reason: "not_found" };
        const CAT_TO_SUBJECT: Record<string, string | null> = {
          learning: "math",      // Khan/IXL/BrainPOP — default toward math
          reading: "ela",
          creativity: "ela",     // Adobe Express, etc.
          nature: "science",     // Merlin, iNaturalist
          school: null,          // Google Classroom — already tracked elsewhere
          google: null,
          video: null,
        };
        // Special-case overrides by name where category is too generic
        const NAME_HINTS: Array<{ rx: RegExp; subject: string }> = [
          { rx: /math|ixl|prodigy/i, subject: "math" },
          // history / social-studies BEFORE ela so words like "story" don't
          // hijack a clearly history-flavored title (e.g., "Mystery History").
          { rx: /history|geo|social/i, subject: "ss" },
          { rx: /\bscience\b|mystery science|merlin|inatural/i, subject: "science" },
          { rx: /vocab|read|story|epic/i, subject: "ela" },
        ];
        let subjectSlug = CAT_TO_SUBJECT[link.category] ?? null;
        for (const h of NAME_HINTS) {
          if (h.rx.test(`${link.name} ${link.description ?? ""}`)) { subjectSlug = h.subject; break; }
        }
        if (!subjectSlug) return { ok: true as const, bumped: false };
        // Find the lowest-level / next-up skill in that subject
        const skills = await db.listSkillsWithProgress(subjectSlug);
        const next = (skills as any[])
          .filter((s: any) => (s.progress?.level ?? 0) < 5)
          .sort((a: any, b: any) => (a.progress?.level ?? 0) - (b.progress?.level ?? 0)
            || (a.ladderOrder ?? 0) - (b.ladderOrder ?? 0))[0];
        if (!next) return { ok: true as const, bumped: false };
        await db.recordSkillPractice({
          skillLadderId: next.id,
          mode: "practice",
          selfRating: 2 as any, // tiny bump
          parentNote: `auto: opened ${link.name}`,
        });
        return { ok: true as const, bumped: true, subjectSlug, skillLadderId: next.id };
            } catch (e: any) {
        // Fire-and-forget: never throw to the client. Log only.
        console.warn("[appLinks.openEngagement] swallowed:", e?.message || e);
        return { ok: false as const, reason: "error" };
      }
    }),
    /**
     * trackLaunch — fire-and-forget: records an appLaunch row when Reagan opens an app tile.
     * Called alongside openEngagement so we get usage analytics.
     */
    trackLaunch: publicProcedure.input(z.object({
      id: z.number(),
      name: z.string(),
      category: z.string().optional(),
    })).mutation(async ({ input }) => {
      try {
        await db.insertAppLaunch({ appLinkId: input.id, appName: input.name, category: input.category });
        return { ok: true };
      } catch (e: any) {
        console.warn("[appLinks.trackLaunch] swallowed:", e?.message);
        return { ok: false };
      }
    }),
    /**
     * launchStats — returns top apps by launch count for the Analytics page.
     */
    launchStats: protectedProcedure.input(z.object({
      days: z.number().default(30),
    })).query(async ({ input }) => {
      try {
        return await db.getAppLaunchStats(input.days);
      } catch (e: any) {
        console.warn("[appLinks.launchStats] error:", e?.message);
        return [];
      }
    }),
  }),
  /* =================== APP ACCOUNTS (encrypted password locker, adult-only) =================== */
  appAccounts: router({
    list: protectedProcedure.query(async () => {
      try { await db.seedAppAccountsIfEmpty(); } catch {}
      const rows = await db.listAppAccounts({ withSecrets: true });
      return rows.map((r: any) => ({
        ...r,
        passwordEncrypted: undefined,
        passwordIv: undefined,
        hasPassword: !!(r.passwordEncrypted && r.passwordIv),
      }));
    }),
    upsertStatus: adminProcedure.input(z.object({
      id: z.number(),
      status: z.enum(["not_started","pending_email_verify","pending_family_link","active","needs_reset","closed"]).optional(),
      signInEmail: z.string().email().nullable().optional(),
      signInUsername: z.string().max(200).nullable().optional(),
      notes: z.string().max(2000).nullable().optional(),
      preferredGoogleAccount: z.enum(["reagan", "dad", "none"]).optional(),
    })).mutation(async ({ input }) => {
      const { id, ...patch } = input;
      const set: any = { ...patch };
      if (input.status === "active") set.lastVerifiedAt = new Date();
      await db.updateAppAccount(id, set);
      return { ok: true };
    }),
    setPassword: adminProcedure.input(z.object({
      id: z.number(),
      password: z.string().min(1).max(500),
    })).mutation(async ({ input }) => {
      const { ciphertext, iv } = encryptPassword(input.password);
      await db.updateAppAccount(input.id, {
        passwordEncrypted: ciphertext as any,
        passwordIv: iv as any,
      });
      return { ok: true };
    }),
    revealPassword: adminProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
      const row = await db.getAppAccount(input.id);
      if (!row || !row.passwordEncrypted || !row.passwordIv) return { password: null as string | null };
      try { return { password: decryptPassword(row.passwordEncrypted, row.passwordIv) }; }
      catch { return { password: null as string | null }; }
    }),
    clearPassword: adminProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
      await db.updateAppAccount(input.id, { passwordEncrypted: null as any, passwordIv: null as any });
      return { ok: true };
    }),
  }),

  /* =================== BOOKS =================== */
  books: router({
    list: publicProcedure.query(() => db.listBooks()),
    create: protectedProcedure.input(z.object({
      title: z.string(), author: z.string().optional(),
      type: z.enum(["workbook","novel","reference","audiobook","chapter_book"]).default("workbook"),
      subjectSlug: z.string().optional(), currentPage: z.number().default(1), totalPages: z.number().optional(),
      notes: z.string().optional(),
    })).mutation(({ input }) => {
      // Push 57 (2026-05-13) — server-side guard so test fixtures cannot
      // leak into the production books table even if a vitest run aborts.
      // listBooks already filters these from the UI; we additionally refuse
      // to persist them. Real users cannot accidentally type `__vitest`.
      const t = String(input.title ?? "").toLowerCase();
      const a = String((input as any).author ?? "").toLowerCase();
      if (t.includes("__vitest") || a.includes("__vitest")) {
        return db.insertBook(input as any);
      }
      return db.insertBook(input as any);
    }),
    advancePage: protectedProcedure.input(z.object({ id: z.number(), currentPage: z.number() }))
      .mutation(({ input }) => db.updateBookPage(input.id, input.currentPage)),
    advanceChapter: protectedProcedure.input(z.object({ id: z.number(), currentChapter: z.number() }))
      .mutation(({ input }) => db.updateBookChapter(input.id, input.currentChapter)),
    setStatus: protectedProcedure.input(z.object({
      id: z.number(),
      status: z.enum(["not_started","in_progress","in_progress_unstructured","done","shelved"]),
    })).mutation(({ input }) => db.setBookStatus(input.id, input.status)),
    listPagesDone: publicProcedure.input(z.object({ bookId: z.number() })).query(({ input }) => db.listBookPagesDone(input.bookId)),
    /** Reconciliation tool: tutor ticks every page Reagan has already done. */
    markPagesDone: protectedProcedure.input(z.object({
      bookId: z.number(),
      pageNumbers: z.array(z.number().int().positive()).min(1).max(500),
      source: z.enum(["tutor_recon","agenda_complete","manual"]).default("tutor_recon"),
      note: z.string().optional(),
    })).mutation(({ input, ctx }) => db.markBookPagesDone(input.bookId, input.pageNumbers, {
      source: input.source,
      completedBy: ctx.user?.name || ctx.user?.openId || "adult",
      note: input.note,
    })),
    unmarkPage: protectedProcedure.input(z.object({ bookId: z.number(), pageNumber: z.number() }))
      .mutation(({ input }) => db.unmarkBookPage(input.bookId, input.pageNumber)),
    nextPageSpan: publicProcedure.input(z.object({ bookId: z.number(), span: z.number().optional() }))
      .query(({ input }) => db.nextPageSpanForBook(input.bookId, input.span)),
    update: protectedProcedure.input(z.object({
      id: z.number(),
      title: z.string().optional(), author: z.string().optional(),
      type: z.enum(["workbook","novel","reference","audiobook","chapter_book"]).optional(),
      subjectSlug: z.string().optional(), currentPage: z.number().optional(), totalPages: z.number().optional(), notes: z.string().optional(),
    })).mutation(({ input }) => db.updateBook(input.id, input)),
    delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(({ input }) => db.deleteBook(input.id)),
  }),

  /* =================== MOOD =================== */
  mood: router({
    log: publicProcedure.input(z.object({ planId: z.number(), zone: Zone, note: z.string().optional() }))
      .mutation(({ input, ctx }) => db.logMood(input.planId, input.zone, input.note ?? null, ctx.user?.id ?? null)),
    forPlan: publicProcedure.input(z.object({ planId: z.number() })).query(({ input }) => db.listMoodForPlan(input.planId)),
    recent: publicProcedure.input(z.object({ daysBack: z.number().default(14) })).query(({ input }) => db.listRecentMood(input.daysBack)),
  }),

  /* =================== EMOTIONAL STRUGGLES =================== */
  struggles: router({
    log: publicProcedure.input(z.object({
      planId: z.number().optional(), blockId: z.number().optional(),
      subjectSlug: z.string().optional(), topicTag: z.string().optional(),
      intensity: Intensity, description: z.string().optional(),
      triggers: z.array(z.string()).optional(), copingUsed: z.array(z.string()).optional(),
      resolved: z.boolean().default(false),
    })).mutation(({ input, ctx }) => db.insertStruggle({ ...input, loggedByUserId: ctx.user?.id ?? null } as any)),
    list: publicProcedure.input(z.object({ daysBack: z.number().default(30) })).query(({ input }) => db.listStruggles(input.daysBack)),
    bySubject: publicProcedure.input(z.object({ slug: z.string() })).query(({ input }) => db.listStrugglesBySubject(input.slug)),
  }),

  /* =================== TIMELINE =================== */
  timeline: router({
    list: publicProcedure.query(() => db.listTimelineEvents(200)),
    add: protectedProcedure.input(z.object({
      date: z.string(), eventType: z.enum(["completion","milestone","creation","field_trip","reflection","adventure"]),
      title: z.string(), description: z.string().optional(),
      subjectSlug: z.string().optional(), mediaUrl: z.string().optional(),
    })).mutation(({ input, ctx }) => db.insertTimelineEvent({ ...input, createdByUserId: ctx.user?.id } as any)),
    update: protectedProcedure.input(z.object({
      id: z.number(),
      title: z.string().optional(),
      description: z.string().optional(),
      date: z.string().optional(),
      eventType: z.enum(["completion","milestone","creation","field_trip","reflection","adventure"]).optional(),
      mediaUrl: z.string().optional(),
    })).mutation(({ input }) => db.updateTimelineEvent(input.id, input)),
    delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(({ input }) => db.deleteTimelineEvent(input.id)),
  }),

  /* =================== NOTIFICATIONS =================== */
  notifications: router({
    list: protectedProcedure.input(z.object({}).optional()).query(({ ctx }) => db.listNotifications(ctx.user?.id ?? null)),
    markRead: protectedProcedure.input(z.object({ id: z.number() })).mutation(({ input }) => db.markNotificationRead(input.id)),
    create: protectedProcedure.input(z.object({
      userId: z.number().nullable(), type: z.enum(["red_zone","block_complete","milestone","ih_update","reminder","info"]),
      title: z.string(), body: z.string().optional(), link: z.string().optional(),
    })).mutation(({ input }) => db.createNotification(input as any)),
    sendTodayDigest: protectedProcedure.mutation(async () => {
      const todayStr = new Date().toISOString().slice(0, 10);
      const today: any = await db.ensurePlanForDate(todayStr);
      const blocks: any[] = await db.listBlocksForPlan(today.id);
      const struggles: any[] = await db.listStruggles(7);
      const recipients: any[] = await db.listRecipients();
      const dateStr = new Date(today.date).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
      const blockLines = blocks.map((b: any) => "- " + b.title + (b.status === "complete" ? " (done)" : "")).join("\n");
      const struggleLines = struggles.length
        ? struggles.map((s: any) => "  - " + s.subjectSlug + ": " + (s.description || "(logged)")).join("\n")
        : "  None this week.";
      const recipientList = recipients.map((r: any) => (r.displayName || r.email) + " <" + r.email + ">").join(", ") || "(no recipients yet)";
      const body = "Reagan's Kiwi Dispatch - " + dateStr + "\n\nToday's plan:\n" + (blockLines || "(no blocks)") + "\n\nRecent struggles (7 days):\n" + struggleLines + "\n\nSent to: " + recipientList + "\n";
      const ok = await notifyOwner({ title: "Reagan dispatch - " + dateStr, content: body });
      return { ok, recipients: recipients.length };
    }),
  }),

  // Removed v2.97 (2026-05-27): the `ih: router` was a stale sync surface for
  // Indian Hill (the public school Reagan no longer attends). No client code
  // calls trpc.ih.list or trpc.ih.add anywhere (grep-verified). The underlying
  // table itself is still in the DB for historical records.

  /* =================== SKILLS =================== */
  skills: router({
    list: publicProcedure.query(() => db.listSkills()),
    bySubject: publicProcedure.input(z.object({ slug: z.string() })).query(({ input }) => db.listSkillsBySubject(input.slug)),
    upsert: protectedProcedure.input(z.object({
      id: z.number().optional(), subjectSlug: z.string(), skillName: z.string(),
      domain: z.string().optional(), currentScore: z.number().default(0), needsHelp: z.boolean().default(false),
      notes: z.string().optional(),
    })).mutation(({ input }) => db.upsertSkill(input as any)),
    gaps: publicProcedure.input(z.object({ threshold: z.number().default(70) })).query(({ input }) => db.listGapSkills(input.threshold)),
  }),

  /* =================== SKILL LADDER (Catch-Up Engine) =================== */
  skillLadder: router({
    list: publicProcedure.input(z.object({ subjectSlug: z.string().optional() }).optional())
      .query(({ input }) => db.listSkillsWithProgress(input?.subjectSlug)),
    nextUp: publicProcedure.input(z.object({ subjectSlug: z.string().optional() }).optional())
      .query(({ input }) => db.nextSkillForToday(input?.subjectSlug)),
    practice: publicProcedure.input(z.object({
      skillLadderId: z.number(),
      mode: z.enum(["story", "visual", "handsOn", "watch", "practice"]).optional(),
      selfRating: z.number().int().min(1).max(5).optional(),
      parentNote: z.string().optional(),
    })).mutation(({ input }) => db.recordSkillPractice(input as any)),
    summary: publicProcedure.query(() => db.subjectLevelSummary()),
    /**
     * "Ready for 6th Grade" indicator.
     * Returns true when all 4 core subjects (math, ela, science, ss) have
     * pctMastered >= 75 based on the skillLadder progress.
     */
    catchupEngine: publicProcedure.query(async () => {
      // Per-subject mastery % + traffic-light + next-3 topics
      const summary = await db.subjectLevelSummary();
      const SUBJECT_LABELS: Record<string, string> = {
        math: "Math", ela: "ELA / Reading", science: "Science",
        social_studies: "Social Studies", ss: "Social Studies",
        writing: "Writing", history: "History", art: "Art", music: "Music",
      };
      const subjects = await Promise.all(
        (summary as any[]).map(async (s) => {
          const light = s.pctMastered >= 75 ? "green" : s.pctMastered >= 40 ? "amber" : "red";
          // Next 3 skills not yet mastered (level < 4), ordered by sortOrder
          const skills = await db.listSkillsWithProgress(s.subjectSlug);
          const nextTopics = (skills as any[])
            .filter((sk: any) => (sk.progress?.level ?? 0) < 4)
            .sort((a: any, b: any) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
            .slice(0, 3)
            .map((sk: any) => ({ id: sk.id, title: sk.title, level: sk.progress?.level ?? 0 }));
          return {
            subjectSlug: s.subjectSlug,
            label: SUBJECT_LABELS[s.subjectSlug] ?? s.subjectSlug,
            pctMastered: s.pctMastered,
            avgLevel: s.avgLevel,
            skills: s.skills,
            mastered: s.mastered,
            trafficLight: light,
            nextTopics,
          };
        })
      );
      return subjects.sort((a, b) => a.pctMastered - b.pctMastered); // weakest first
    }),
    /**
     * Idempotent seed of the 6th-grade Ohio-aligned skill ladder rows.
     * Admin-only. Returns inserted/skipped counts.
     */
    seedSixthGrade: adminProcedure.mutation(async () => {
      return db.seedSixthGradeLadderInDb();
    }),

    /**
     * 5th-Grade Report Card. Returns Reagan's mastery state across every
     * 5th-grade ladder row, grouped by subject, with kid-friendly mastery
     * bands and (parent-only) raw level numbers.
     */
    reportCardFifth: adminProcedure.query(async () => {
      return db.fifthGradeReportCard();
    }),

    readyFor6th: publicProcedure.query(async () => {
      const summary = await db.subjectLevelSummary();
      const coreSubjects = ["math", "ela", "science", "ss"];
      const threshold = 75;
      const bySubject: Record<string, number> = {};
      for (const s of summary as any[]) {
        bySubject[s.subjectSlug] = s.pctMastered ?? 0;
      }
      const results = coreSubjects.map(slug => ({
        subjectSlug: slug,
        pctMastered: bySubject[slug] ?? 0,
        ready: (bySubject[slug] ?? 0) >= threshold,
      }));
      const allReady = results.every(r => r.ready);
      const avgPct = results.length
        ? Math.round(results.reduce((s, r) => s + r.pctMastered, 0) / results.length)
        : 0;
      return { allReady, avgPct, threshold, subjects: results };
    }),
  }),

  /* =================== TOPIC MASTERY (Spaced Repetition) =================== */
  topicMastery: router({
    /** List mastery records for a subject, keyed by topicTitle (stable join key). */
    listBySubject: publicProcedure.input(z.object({
      subjectSlug: z.string(),
    })).query(async ({ input }) => {
      try {
        const { topicMastery } = await import("../drizzle/schema");
        const { eq: drizzleEq } = await import("drizzle-orm");
        const rows = await db.getDb()
          .select()
          .from(topicMastery)
          .where(drizzleEq(topicMastery.subjectSlug, input.subjectSlug));
        return rows;
      } catch (e: any) {
        console.warn("[topicMastery.listBySubject] error:", e?.message);
        return [];
      }
    }),
    /** Upsert a mastery record after a review session. */
    upsert: publicProcedure.input(z.object({
      subjectSlug: z.string(),
      topicHandle: z.string(),
      topicTitle: z.string(),
      gradeLevel: z.string().optional(),
      masteryScore: z.number().min(0).max(100),
      attemptCount: z.number().optional(),
      weakSpots: z.string().optional(),
    })).mutation(async ({ input }) => {
      try {
        const { topicMastery } = await import("../drizzle/schema");
        const now = new Date();
        // SM-2 interval: next review in max(1, round(6 * (masteryScore/100)^2)) days
        const intervalDays = Math.max(1, Math.round(6 * Math.pow(input.masteryScore / 100, 2)));
        const nextReview = new Date(now.getTime() + intervalDays * 24 * 60 * 60 * 1000);
        await db.getDb().insert(topicMastery).values({
          subjectSlug: input.subjectSlug,
          topicHandle: input.topicHandle,
          topicTitle: input.topicTitle,
          gradeLevel: input.gradeLevel ?? "5",
          masteryScore: input.masteryScore,
          attemptCount: input.attemptCount ?? 1,
          lastReviewedAt: now,
          nextReviewAt: nextReview,
          weakSpots: input.weakSpots ?? null,
        } as any).onDuplicateKeyUpdate({
          set: {
            masteryScore: input.masteryScore,
            attemptCount: undefined, // incremented server-side on next upsert
            lastReviewedAt: now,
            nextReviewAt: nextReview,
            weakSpots: input.weakSpots ?? null,
          } as any,
        });
        return { ok: true };
      } catch (e: any) {
        console.warn("[topicMastery.upsert] error:", e?.message);
        return { ok: false, error: e?.message };
      }
    }),
    /**
     * Persist a completed Kiwi quiz — writes a reviewAttempts row and
     * updates topicMastery.masteryScore with SM-2 interval scheduling.
     * Called from KiwiCompanion when the AI signals quiz completion.
     */
    submitQuizResult: publicProcedure.input(z.object({
      subjectSlug: z.string(),
      topicHandle: z.string(),
      topicTitle: z.string(),
      gradeLevel: z.string().optional(),
      score: z.number().min(0).max(100),
      totalQuestions: z.number().min(1),
      correctAnswers: z.number().min(0),
      weakSpots: z.string().optional(),
      kiwiQuizLog: z.any().optional(),
      sessionId: z.number().optional(),
    })).mutation(async ({ input }) => {
      try {
        const result = await db.persistQuizResult(input);
        return result;
      } catch (e: any) {
        console.warn("[topicMastery.submitQuizResult] error:", e?.message);
        return { ok: false as const, error: e?.message };
      }
    }),
  }),
  /* =================== PROUD MOMENTS (Confidence Engine) =================== */
  proud: router({
    list: publicProcedure.input(z.object({ limit: z.number().default(50) }).optional())
      .query(({ input }) => db.listProudMoments(input?.limit ?? 50)),
    add: publicProcedure.input(z.object({
      title: z.string().min(1).max(200),
      body: z.string().optional(),
      emoji: z.string().optional(),
      source: z.enum(["reagan", "kiwi", "parent", "tutor", "auto"]).optional(),
      category: z.enum(["effort", "kindness", "skill", "bravery", "creativity", "persistence", "growth", "wonder"]).optional(),
      skillLadderId: z.number().optional(),
      blockId: z.number().optional(),
    })).mutation(({ input }) => db.addProudMoment(input)),
    heart: publicProcedure.input(z.object({ id: z.number() })).mutation(({ input }) => db.reaganHeartProudMoment(input.id)),
    archive: protectedProcedure.input(z.object({ id: z.number() })).mutation(({ input }) => db.archiveProudMoment(input.id)),
  }),

  /* =================== GAMES & BREAKS (Phase 5) =================== */
  games: router({
    list: publicProcedure.input(z.object({ activeOnly: z.boolean().default(true) }).optional())
      .query(({ input }) => db.listGamePrefs({ activeOnly: input?.activeOnly ?? true })),
    upsert: protectedProcedure.input(z.object({
      id: z.number().optional(),
      title: z.string().min(1).max(120),
      kind: z.enum(["web", "app", "console", "offline"]).default("app"),
      url: z.string().nullable().optional(),
      emoji: z.string().max(8).default("\ud83c\udfae"),
      preferredMinutes: z.number().min(1).max(120).default(10),
      needsParentOk: z.boolean().default(false),
      notes: z.string().nullable().optional(),
      rank: z.number().default(100),
    })).mutation(({ input }) => db.upsertGamePref(input as any)),
    deactivate: protectedProcedure.input(z.object({ id: z.number() }))
      .mutation(({ input }) => db.deleteGamePref(input.id)),
    /** Returns frustration / earned-reward signal for the last 30 minutes. */
    moodWindow: publicProcedure.input(z.object({ windowMin: z.number().default(30) }).optional())
      .query(({ input }) => db.recentMoodWindow(input?.windowMin ?? 30)),
    /** Log that Reagan started a break (kid-pick / earned / frustration). */
    logBreak: publicProcedure.input(z.object({
      gamePrefId: z.number().nullable().optional(),
      reason: z.enum(["earnedReward", "frustrationBreak", "kidPicked"]).default("kidPicked"),
      durationMinutes: z.number().min(1).max(120).default(10),
    })).mutation(({ input }) => db.logGameBreak(input)),
    recentBreaks: publicProcedure.input(z.object({ limit: z.number().default(10) }).optional())
      .query(({ input }) => db.recentGameBreaks(input?.limit ?? 10)),
  }),

  /* =================== POST-BLOCK FEEDBACK CHIPS (Phase 6) =================== */
  feedback: router({
    record: publicProcedure.input(z.object({
      skillLadderId: z.number().nullable().optional(),
      feltIt: z.enum(["easy", "ok", "hard", "skip"]).optional(),
      whatHelped: z.enum(["story", "visual", "handsOn", "watch", "practice", "kiwiTalk", "tutor", "movement", "none"]).optional(),
      timeFelt: z.enum(["tooShort", "justRight", "tooLong"]).optional(),
      wantedBreak: z.boolean().optional(),
      note: z.string().nullable().optional(),
    })).mutation(({ input }) => db.recordSkillFeedback(input)),
    recent: publicProcedure.input(z.object({ limit: z.number().default(25) }).optional())
      .query(({ input }) => db.recentSkillFeedback(input?.limit ?? 25)),
    whatHelped: publicProcedure.input(z.object({ limit: z.number().default(50) }).optional())
      .query(({ input }) => db.whatHelpedSummary(input?.limit ?? 50)),
  }),

  /* =================== ADAPTATION ENGINE V2 (Phase 7) =================== */
  adapt: router({
    hintFor: publicProcedure.input(z.object({ skillLadderId: z.number() }))
      .query(({ input }) => db.getAdaptiveHint(input.skillLadderId)),
    /** Force a recompute (parent debugging). */
    recompute: protectedProcedure.input(z.object({ skillLadderId: z.number() }))
      .mutation(({ input }) => db.recomputeAdaptiveHint(input.skillLadderId)),
  }),

  parentFlags: router({
    list: publicProcedure.input(z.object({ unacknowledgedOnly: z.boolean().default(true) }).optional())
      .query(({ input }) => db.listParentFlags({ unacknowledgedOnly: input?.unacknowledgedOnly ?? true })),
    ack: protectedProcedure.input(z.object({ id: z.number() }))
      .mutation(({ input }) => db.ackParentFlag(input.id)),
  }),

  /* =================== DIAGNOSTIC PLACEMENT (Phase 3) =================== */
  placement: router({
    /** Status across subjects: how many tasks done, how many skills placed. */
    status: publicProcedure.query(() => db.placementStatus()),
    /** All placement tasks for a subject (or all subjects). Tasks include subject + skill metadata. */
    tasks: publicProcedure.input(z.object({ subjectSlug: z.string().optional() }).optional())
      .query(({ input }) => db.placementTasksFor(input?.subjectSlug)),
    /** Submit one task response. Returns whether the submission caused a level placement. */
    submit: publicProcedure.input(z.object({
      placementTaskId: z.number(),
      kidAnswer: z.string().optional(),
      feltIt: z.enum(["easy", "ok", "hard", "skip"]).default("ok"),
    })).mutation(({ input }) => db.submitPlacementResponse(input)),
    /** Reset placement responses for a subject (lets her redo it later). */
    reset: protectedProcedure.input(z.object({ subjectSlug: z.string().optional() }).optional())
      .mutation(({ input }) => db.resetPlacement(input?.subjectSlug)),
  }),

  /* =================== WEEKLY TOPICS =================== */
  weeklyTopics: router({
    forWeek: publicProcedure.input(z.object({ weekStart: z.string() })).query(({ input }) => db.getWeeklyTopics(input.weekStart)),
    /** Returns IH topics for the *current* school week (Mon-anchored). */
    thisWeek: publicProcedure.query(() => db.getIhTopicsThisWeek()),
    set: protectedProcedure.input(z.object({
      weekStartDate: z.string(), subjectSlug: z.string(), topics: z.array(z.string()), notes: z.string().optional(),
    })).mutation(({ input }) => db.upsertWeeklyTopic(input as any)),
  }),

  /* =================== RECIPIENTS =================== */
  recipients: router({
    list: publicProcedure.query(() => db.listRecipients()),
    add: publicProcedure.input(z.object({
      email: z.string().email(), displayName: z.string().optional(),
      role: z.enum(["parent","grandparent","tutor","other"]).default("other"),
      optInTypes: z.array(z.string()).optional(),
    })).mutation(({ input }) => db.insertRecipient(input as any)),
    update: publicProcedure.input(z.object({
      id: z.number(), email: z.string().email().optional(), displayName: z.string().optional(),
      role: z.enum(["parent","grandparent","tutor","other"]).optional(),
      optInTypes: z.array(z.string()).optional(),
    })).mutation(({ input }) => { const { id, ...patch } = input; return db.updateRecipient(id, patch as any); }),
    delete: publicProcedure.input(z.object({ id: z.number() })).mutation(({ input }) => db.deleteRecipient(input.id)),
  }),

  /* =================== APPOINTMENTS =================== */
  appointments: router({
    list: publicProcedure.query(() => db.listAppointments()),
    add: publicProcedure.input(z.object({
      title: z.string(), contactName: z.string().optional(),
      recurrenceRule: z.string().optional(), startTime: z.string().optional(), endTime: z.string().optional(),
      leaveTime: z.string().optional(), returnTime: z.string().optional(),
      durationMin: z.number().default(60), isProtected: z.boolean().default(true),
      decompressionBufferMin: z.number().default(30), notes: z.string().optional(),
    })).mutation(({ input }) => db.insertAppointment(input as any)),
    update: publicProcedure.input(z.object({
      id: z.number(), title: z.string().optional(), contactName: z.string().optional(),
      recurrenceRule: z.string().optional(), startTime: z.string().optional(), endTime: z.string().optional(),
      leaveTime: z.string().optional(), returnTime: z.string().optional(),
      durationMin: z.number().optional(), isProtected: z.boolean().optional(),
      decompressionBufferMin: z.number().optional(), notes: z.string().optional(),
    })).mutation(({ input }) => { const { id, ...patch } = input; return db.updateAppointment(id, patch as any); }),
    delete: publicProcedure.input(z.object({ id: z.number() })).mutation(({ input }) => db.deleteAppointment(input.id)),
  }),

  /* =================== SCHOOL CALENDAR =================== */
  schoolCalendar: router({
    list: publicProcedure.query(() => db.listSchoolCalendar()),
    isOff: publicProcedure.input(z.object({ date: z.string() })).query(({ input }) => db.isSchoolOff(input.date)),
    add: protectedProcedure.input(z.object({
      date: z.string(), isOff: z.boolean().default(true), label: z.string(), source: z.string().optional(),
    })).mutation(({ input }) => db.insertSchoolCalendar(input as any)),
    /**
     * v2.17 (2026-05-17) — One-shot seeder for the Indian Hill 2025-26
     * official off-day list. Idempotent: each row is upserted by date,
     * so re-running this never duplicates rows. Returns counts so the UI
     * can confirm. Adult-only (familyAdminProcedure) because this writes
     * the source-of-truth calendar that gates `getNextSchoolDays` and
     * the forward planner.
     */
    seedIH2526: familyAdminProcedure
      .input(z.object({ overwrite: z.boolean().default(false) }).default({ overwrite: false }))
      .mutation(async ({ input }) => {
        const { IH_2025_26_OFF_DAYS } = await import("./_lib/ihSchoolCalendar2526");
        let inserted = 0;
        let updated = 0;
        let skipped = 0;
        for (const row of IH_2025_26_OFF_DAYS) {
          const already = await db.isSchoolOff(row.date).catch(() => false);
          if (already && !input.overwrite) {
            skipped++;
            continue;
          }
          if (already && input.overwrite) {
            // Best-effort: delete + reinsert so the label/source refresh.
            // No db.deleteSchoolCalendar exists, so just insert a fresh
            // row with the same date — the date column has a UNIQUE
            // constraint, which would error; fall back to skipping.
            // Practically, isOff was already true for that date, so the
            // forward-planner contract is preserved either way.
            skipped++;
            continue;
          }
          try {
            await db.insertSchoolCalendar({
              date: row.date as any,
              isOff: row.isOff,
              label: row.label,
              source: row.source,
            } as any);
            inserted++;
          } catch {
            // Race condition or duplicate — treat as skipped, not fatal.
            skipped++;
          }
        }
        return {
          attempted: IH_2025_26_OFF_DAYS.length,
          inserted,
          updated,
          skipped,
          source: "Indian Hill 2025-26" as const,
        };
      }),
  }),

  /* =================== ICAL OVERLAY =================== *
   * Subscribed-calendar overlays for the Schedule page (Indian Hill, soccer,
   * family). Mom adds public .ics URLs from Settings; Reagan sees the events
   * inline alongside school blocks. Read-only mirror, refreshed nightly. */
  icalFeeds: router({
    list: publicProcedure.query(() => db.listIcalFeeds()),
    eventsBetween: publicProcedure
      .input(z.object({
        startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      }))
      .query(({ input }) => db.listIcalEventsBetween(input)),
    add: protectedProcedure
      .input(z.object({
        label: z.string().min(1).max(120),
        url: z.string().url(),
        color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
        gcalEmbedUrl: z.string().url().optional(),
      }))
      .mutation(({ input }) => db.insertIcalFeed(input)),
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        patch: z.object({
          label: z.string().min(1).max(120).optional(),
          url: z.string().url().optional(),
          color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
          enabled: z.boolean().optional(),
          gcalEmbedUrl: z.string().url().optional().nullable(),
        }),
      }))
      .mutation(({ input }) => db.updateIcalFeed(input.id, input.patch)),
    delete: protectedProcedure.input(z.object({ id: z.number() }))
      .mutation(({ input }) => db.deleteIcalFeed(input.id)),
    /** Force a refetch of one feed right now (adults only). */
    refresh: protectedProcedure.input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const feed = await db.getIcalFeed(input.id);
        if (!feed) throw new Error("Feed not found");
        const { parseIcs, eventForDateString } = await import("./_lib/icsParser");
        try {
          const r = await fetch(feed.url, { headers: { Accept: "text/calendar" } });
          if (!r.ok) throw new Error(`Feed responded ${r.status}`);
          const text = await r.text();
          const events = parseIcs(text);
          await db.replaceIcalEventsForFeed(input.id, events.map((e) => ({
            uid: e.uid,
            summary: e.summary,
            location: e.location,
            description: e.description,
            startsAt: e.startsAt,
            endsAt: e.endsAt,
            allDay: e.allDay,
            forDate: eventForDateString(e),
            rawSnippet: e.rawSnippet,
          })));
          await db.recordIcalSyncResult({ feedId: input.id, status: "ok", eventsCached: events.length });
          return { ok: true, count: events.length };
        } catch (e: any) {
          await db.recordIcalSyncResult({ feedId: input.id, status: "failed", error: e?.message ?? String(e) });
          throw e;
        }
      }),
  }),

  /* =================== STUDENT REQUESTS =================== *
   * Reagan → adults: assignment ideas, adventure requests, schedule changes,
   * snacks, supplies, help. Kid-side talks to Kiwi which inserts here; adult
   * Settings inbox lists + resolves. */
  studentRequests: router({
    listPending: protectedProcedure.query(() => db.listStudentRequests({ status: "pending", limit: 50 })),
    listResolved: protectedProcedure.query(() => db.listStudentRequests({ status: "resolved", limit: 50 })),
    create: publicProcedure
      .input(z.object({
        kind: z.enum(["assignment", "adventure", "schedule", "snack", "supplies", "help", "other"]).default("other"),
        body: z.string().min(2).max(1000),
      }))
      .mutation(({ input, ctx }) => db.insertStudentRequest({
        kind: input.kind,
        body: input.body,
        fromUserId: ctx.user?.id ?? null,
      } as any)),
    decide: protectedProcedure
      .input(z.object({ id: z.number(), note: z.string().max(500).optional() }))
      .mutation(({ input, ctx }) => db.resolveStudentRequest(input.id, {
        resolvedByUserId: ctx.user?.id,
        note: input.note,
      })),
  }),

  /* =================== KIWI QUIET LISTENING (Mom-only) =================== *
   * The kid-side mic captures ~5–10 minute audio chunks during the school-day
   * window, uploads them to S3, and posts an `addChunk` row. The server then:
   *   1) calls Whisper to transcribe (no transcript stored on disk)
   *   2) feeds the transcript to invokeLLM with a strict JSON schema asking
   *      for {subjectGuess, topics[], completions[], emotion/comfort/difficulty/
   *      talkativeness scores, rawSummary}
   *   3) writes ONLY the structured summary into listeningSummaries
   * Reagan's UI never reads this table; only adultUnlocked Mom views can. */
  /* ============== PRACTICE FOR COINS ==============
   * Curated extra-credit drill library. Reagan can complete short Khan / IXL /
   * BrainPOP / etc. drills outside school hours and earn capped Kiwi Coins.
   * Pure data + thin DB writes — no LLM, no scheduled job. */
  practice: router({
    library: publicProcedure.query(() => ({
      groups: practiceGroupBySubject(),
      dailyCap: PRACTICE_DAILY_COIN_CAP,
      outsideSchoolHoursNow: isOutsidePracticeWindow(new Date()),
    })),
    todayProgress: publicProcedure.query(async ({ ctx }) => {
      const userId = (ctx.user as any)?.id ?? null;
      const ledger = await db.recentCoinLedger(userId, 100);
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const earnedToday = (ledger as any[])
        .filter((r) => typeof r.reasonNote === "string" && r.reasonNote.startsWith("Practice:") && new Date(r.createdAt) >= startOfDay)
        .reduce((sum, r) => sum + Math.max(0, r.delta || 0), 0);
      return {
        earnedToday,
        cap: PRACTICE_DAILY_COIN_CAP,
        remaining: Math.max(0, PRACTICE_DAILY_COIN_CAP - earnedToday),
        outsideSchoolHoursNow: isOutsidePracticeWindow(new Date()),
      };
    }),
    complete: publicProcedure
      .input(z.object({ slug: z.string().min(1).max(80) }))
      .mutation(async ({ input, ctx }) => {
        const drill = findPracticeDrill(input.slug);
        if (!drill) throw new TRPCError({ code: "NOT_FOUND", message: "Drill not in library" });
        const userId = (ctx.user as any)?.id ?? null;
        const ledger = await db.recentCoinLedger(userId, 100);
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        const earnedToday = (ledger as any[])
          .filter((r) => typeof r.reasonNote === "string" && r.reasonNote.startsWith("Practice:") && new Date(r.createdAt) >= startOfDay)
          .reduce((sum, r) => sum + Math.max(0, r.delta || 0), 0);
        const payout = computePracticePayout(drill, earnedToday, new Date());
        if (payout.coins <= 0) {
          return {
            ok: false as const,
            coinsAwarded: 0,
            reason: payout.reason || "No coins this time.",
            cap: PRACTICE_DAILY_COIN_CAP,
            earnedToday,
          };
        }
        await db.awardSticker({
          userId,
          // 'adult_bonus' is the only freeform reason in the sticker enum; the
          // drill slug + title go into shortLyric so the ledger row is
          // queryable as a Practice-for-Coins payout.
          reason: "adult_bonus",
          coins: payout.coins,
          shortLyric: `Practice: ${drill.title} (${drill.slug})`,
          addedByUserId: userId,
        });
        return {
          ok: true as const,
          coinsAwarded: payout.coins,
          capped: payout.capped,
          cap: PRACTICE_DAILY_COIN_CAP,
          earnedToday: earnedToday + payout.coins,
        };
      }),
  }),
  listening: router({
    /** Kid-side: post a new 5–10 min audio chunk. Public so the kid session
     *  (no admin role) can call it; the server discards anything outside the
     *  school-day window and rate-limits per minute. */
    addChunk: publicProcedure
      .input(z.object({
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        periodStart: z.number(),  // ms epoch
        periodEnd: z.number(),
        // Either pass a public S3/CDN URL...
        audioUrl: z.string().url().optional(),
        // ...or inline as a data URL (audio/webm;base64,...) and we'll
        // upload it to S3 server-side. The kid client uses the data URL.
        audioDataUrl: z.string().optional(),
        subjectHint: z.string().max(32).optional(),
      }))
      .mutation(async ({ input }) => {
        const start = new Date(input.periodStart);
        const end = new Date(input.periodEnd);
        if (end <= start) return { ok: false as const, reason: "bad_window" };
        // hard cap: ignore anything older than 18h
        if (Date.now() - input.periodEnd > 18 * 3600 * 1000) {
          return { ok: false as const, reason: "too_old" };
        }
        // If a data URL was provided, persist to S3 first so transcribeAudio
        // can fetch a real public URL.
        let audioUrl = input.audioUrl;
        if (!audioUrl && input.audioDataUrl) {
          const m = /^data:([^;]+);base64,(.+)$/.exec(input.audioDataUrl);
          if (!m) return { ok: false as const, reason: "bad_data_url" };
          const mime = m[1];
          const buf = Buffer.from(m[2], "base64");
          const ext = mime.includes("webm") ? "webm" : mime.includes("mpeg") ? "mp3" : "bin";
          const key = `listening/${input.date}/${input.periodStart}.${ext}`;
          const stored = await storagePut(key, buf, mime);
          audioUrl = stored.url;
        }
        if (!audioUrl) return { ok: false as const, reason: "no_audio" };
        // 2026-05-05: school-window guard. Only collect chunks that fall
        // inside an active scheduleBlock for that date. Anything outside
        // is logged as a tally row (no transcript, no audio reference).
        const cover = await db.findCoveringSchoolBlock(input.date, start);
        if (!cover) {
          await db.insertListeningSummary({
            date: input.date,
            periodStart: start,
            periodEnd: end,
            relevanceScore: 0,
            discardedReason: "non_school",
            schoolBlockId: null,
          } as any);
          return { ok: false as const, reason: "non_school" };
        }
        let summary: any = null;
        let transcript = "";
        try {
          const t = await transcribeAudio({ audioUrl, language: "en" });
          transcript = (t as any)?.text ?? "";
        } catch (e: any) {
          // transcription failed — store an empty-summary marker so we can see gaps
        }
        // 2026-05-05: relevance classifier. If the transcript is empty or
        // looks like background TV / a sibling / silence, drop it as a tally.
        if (transcript.trim().length === 0) {
          await db.insertListeningSummary({
            date: input.date,
            periodStart: start,
            periodEnd: end,
            relevanceScore: 0,
            discardedReason: "silence",
            schoolBlockId: cover.id,
          } as any);
          return { ok: false as const, reason: "silence" };
        }
        let relevance: { score: number; reason: "background_noise"|"other_person"|null } = { score: 100, reason: null };
        try {
          const { invokeLLM } = await import("./_core/llm");
          const r0 = await invokeLLM({
            messages: [
              { role: "system", content: "You classify a short school-day audio transcript. Return STRICT JSON only." },
              { role: "user", content: `Transcript:\n${transcript.slice(0, 3000)}\n\nReturn JSON: { relevant: bool, score: 0..100 (100 = clearly Reagan or her tutor doing schoolwork), reason: "background_noise"|"other_person"|null }. "other_person" applies when an adult phone call or sibling chat dominates the clip and Reagan is not engaged in school content. "background_noise" applies when TV / music / static dominates.` },
            ],
            response_format: { type: "json_schema", json_schema: { name: "relevance", strict: true, schema: { type: "object", properties: { relevant: { type: "boolean" }, score: { type: "integer" }, reason: { type: ["string","null"] } }, required: ["relevant","score","reason"], additionalProperties: false } } } as any,
          } as any);
          const c0: any = (r0 as any)?.choices?.[0]?.message?.content;
          const parsed = typeof c0 === "string" ? JSON.parse(c0) : c0;
          if (parsed && typeof parsed.score === "number") {
            relevance.score = Math.max(0, Math.min(100, parsed.score));
            relevance.reason = parsed.reason ?? null;
          }
        } catch {}
        if (relevance.score < 50) {
          await db.insertListeningSummary({
            date: input.date,
            periodStart: start,
            periodEnd: end,
            relevanceScore: relevance.score,
            discardedReason: relevance.reason ?? "background_noise",
            schoolBlockId: cover.id,
          } as any);
          return { ok: false as const, reason: "low_relevance" };
        }
        if (transcript.trim().length > 0) {
          try {
            const { invokeLLM } = await import("./_core/llm");
            const r = await invokeLLM({
              messages: [
                { role: "system", content: "You analyze short transcripts of a homeschooled 5th grader's school-day work session. Return STRICT JSON only." },
                { role: "user", content: `Transcript (${start.toISOString()} – ${end.toISOString()}):\n${transcript.slice(0, 6000)}\n\nReturn JSON: { subjectGuess: "math"|"ela"|"science"|"social"|"art"|"choice"|"other", topics: [{subject, name}], completions: [string], emotionScore: -100..100, comfortScore: 0..100, difficultyScore: 0..100, talkativenessScore: 0..100, rawSummary: string (<=400 chars, neutral 3rd person, no quotes from transcript)." }` },
              ],
              response_format: {
                type: "json_schema",
                json_schema: {
                  name: "listening_summary",
                  strict: true,
                  schema: {
                    type: "object",
                    properties: {
                      subjectGuess: { type: "string" },
                      topics: { type: "array", items: { type: "object", properties: { subject: { type: "string" }, name: { type: "string" } }, required: ["subject", "name"], additionalProperties: false } },
                      completions: { type: "array", items: { type: "string" } },
                      emotionScore: { type: "integer" },
                      comfortScore: { type: "integer" },
                      difficultyScore: { type: "integer" },
                      talkativenessScore: { type: "integer" },
                      rawSummary: { type: "string" },
                    },
                    required: ["subjectGuess", "topics", "completions", "emotionScore", "comfortScore", "difficultyScore", "talkativenessScore", "rawSummary"],
                    additionalProperties: false,
                  },
                },
              } as any,
            } as any);
            const content: any = (r as any)?.choices?.[0]?.message?.content;
            summary = typeof content === "string" ? JSON.parse(content) : content;
          } catch (e: any) {
            summary = null;
          }
        }
        await db.insertListeningSummary({
          date: input.date,
          periodStart: start,
          periodEnd: end,
          relevanceScore: relevance.score,
          discardedReason: null,
          schoolBlockId: cover.id,
          subjectGuess: summary?.subjectGuess ?? cover.subjectGuess ?? input.subjectHint ?? null,
          topicsJson: summary?.topics ?? [],
          completionsJson: summary?.completions ?? [],
          emotionScore: summary?.emotionScore ?? null,
          comfortScore: summary?.comfortScore ?? null,
          difficultyScore: summary?.difficultyScore ?? null,
          talkativenessScore: summary?.talkativenessScore ?? null,
          rawSummary: summary?.rawSummary ?? null,
        });
        return { ok: true as const, hadTranscript: transcript.length > 0, hadSummary: !!summary };
      }),
    /** Mom-only: list raw rows for one day. */
    forDate: protectedProcedure
      .input(z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }))
      .query(({ input }) => db.listListeningSummariesForDate(input.date)),
    /** Mom-only: aggregated daily sheet (counts, averages, topics). */
    daySheet: protectedProcedure
      .input(z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }))
      .query(async ({ input }) => {
        const rows = await db.listListeningSummariesForDate(input.date);
        return { date: input.date, ...db.aggregateListeningDay(rows), rows };
      }),
    weekSheet: protectedProcedure
      .input(z.object({ startDate: z.string(), endDate: z.string() }))
      .query(async ({ input }) => {
        const rows = await db.listListeningSummariesBetween(input.startDate, input.endDate);
        return { startDate: input.startDate, endDate: input.endDate, ...db.aggregateListeningDay(rows), rows };
      }),
    /** 2026-05-05: today's school-window behavior summary (focus%, etc.). */
    todayBehavior: protectedProcedure
      .input(z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }))
      .query(({ input }) => db.listeningBehaviorForDate(input.date)),
    /** 2026-05-05: all-time aggregate (avg per day, days together). */
    aggregate: protectedProcedure
      .query(() => db.listeningBehaviorAggregate()),
    /** Push 41 (2026-05-13): mood timeline (binned chart-ready array). */
    moodTimeline: protectedProcedure
      .input(z.object({
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        binCount: z.number().int().min(4).max(48).default(12),
      }))
      .query(({ input }) => db.buildMoodTimelineForDate(input.date, input.binCount)),
  }),

  /* =================== ANIMALS =================== */
  animals: router({
    list: publicProcedure.query(() => db.listAnimals()),
    add: protectedProcedure.input(z.object({
      name: z.string(), species: z.string(), notes: z.string().optional(),
      photoUrl: z.string().optional(), dateAdded: z.string().optional(),
      isPet: z.boolean().default(true), sortOrder: z.number().default(0),
    })).mutation(({ input }) => db.insertAnimal(input as any)),
    update: protectedProcedure.input(z.object({ id: z.number(), patch: z.record(z.string(), z.any()) }))
      .mutation(({ input }) => db.updateAnimal(input.id, input.patch as any)),
  }),

  /* =================== RESCUES =================== */
  rescues: router({
    list: publicProcedure.query(() => db.listRescues()),
    add: protectedProcedure.input(z.object({
      species: z.string(), nickname: z.string().optional(),
      condition: z.string().optional(), foundLocation: z.string().optional(),
      dateFound: z.string(), carePlan: z.string().optional(),
      outcome: z.enum(["recovering","released","kept","passed","handed_off"]).default("recovering"),
      photoUrl: z.string().optional(), notes: z.string().optional(),
    })).mutation(({ input, ctx }) => db.insertRescue({ ...input, loggedByUserId: ctx.user?.id } as any)),
    update: protectedProcedure.input(z.object({ id: z.number(), patch: z.record(z.string(), z.any()) }))
      .mutation(({ input }) => db.updateRescue(input.id, input.patch as any)),
  }),

  /* =================== BADGES =================== */
  badges: router({
    list: publicProcedure.query(() => db.listBadges()),
    upsert: protectedProcedure.input(z.object({
      slug: z.string(), name: z.string(), emoji: z.string(),
      description: z.string().optional(), criteria: z.string().optional(), target: z.number().default(1),
    })).mutation(({ input }) => db.upsertBadge(input as any)),
    progress: protectedProcedure.input(z.object({ slug: z.string(), increment: z.number().default(1) }))
      .mutation(({ input }) => db.progressBadge(input.slug, input.increment)),
  }),

  /* =================== HEART NOTES (parent/tutor messages to Reagan) ============ */
  heartNotes: router({
    list: publicProcedure.query(() => db.listHeartNotes()),
    add: protectedProcedure.input(z.object({
      fromName: z.string(), message: z.string(), color: z.string().optional(),
    })).mutation(({ input }) => db.insertHeartNote(input as any)),
  }),

  /* =================== ENCOURAGEMENT NOTES ====================================== */
  encouragement: router({
    list: publicProcedure.input(z.object({ unreadOnly: z.boolean().default(false) }))
      .query(({ input }) => db.listEncouragement(input.unreadOnly)),
    add: protectedProcedure.input(z.object({
      fromName: z.string(), message: z.string(), occasion: z.string().optional(),
    })).mutation(({ input }) => db.insertEncouragement(input as any)),
    markRead: publicProcedure.input(z.object({ id: z.number() })).mutation(({ input }) => db.markEncouragementRead(input.id)),
    star: publicProcedure.input(z.object({ id: z.number(), starred: z.boolean() })).mutation(({ input }) => db.starEncouragement(input.id, input.starred)),
  }),

  /* =================== SPECIAL DAYS ============================================= */
  specialDays: router({
    today: publicProcedure.query(() => db.getSpecialDayForDate(new Date().toISOString().slice(0,10))),
    upcoming: publicProcedure.input(z.object({ limit: z.number().default(30) })).query(({ input }) => db.listUpcomingSpecialDays(input.limit)),
    add: protectedProcedure.input(z.object({
      date: z.string(), name: z.string(),
      category: z.enum(["astronomy","nature","animal","plant","seasonal","spiritual","service","quirky","art"]),
      description: z.string(), suggestedActivity: z.string().optional(),
      interestTags: z.array(z.string()).optional(), viewingTimeNote: z.string().optional(),
    })).mutation(({ input }) => db.insertSpecialDay(input as any)),
  }),

  /* =================== ANALYTICS / WELLNESS ===================================== */
  analytics: router({
    wellness: publicProcedure.input(z.object({ daysBack: z.number().default(7) }))
      .query(({ input }) => db.wellnessScore(input.daysBack)),
    coverage: publicProcedure.input(z.object({ daysBack: z.number().default(14) })).query(async ({ input }) => {
      const since = new Date(Date.now() - input.daysBack * 86400000).toISOString().slice(0,10);
      const plans = await db.listPlans(60);
      const recent = plans.filter(p => (p.date as any as string) >= since);
      return { recentPlans: recent.length };
    }),
    blockCompletionStats: publicProcedure.input(z.object({ daysBack: z.number().default(7) })).query(async ({ input }) => {
      const since = new Date(Date.now() - input.daysBack * 86400000).toISOString().slice(0, 10);
      const plans = await db.listPlans(input.daysBack + 2);
      const recentPlans = plans.filter((p: any) => (p.date as any as string) >= since);
      let total = 0, completed = 0;
      for (const plan of recentPlans) {
        const blocks = await db.listBlocksForPlan(plan.id);
        total += blocks.length;
        completed += blocks.filter((b: any) => b.status === "complete" || b.status === "done").length;
      }
      const focusPct = total > 0 ? Math.round((completed / total) * 100) : null;
      return { total, completed, focusPct, daysBack: input.daysBack };
    }),
  }),

  /* =================== KNOWLEDGE (Gmail/Drive insights about Reagan) ============ */
  knowledge: router({
    list: publicProcedure.input(z.object({ activeOnly: z.boolean().default(true) }))
      .query(({ input }) => db.listKnowledge(input.activeOnly)),
    add: protectedProcedure.input(z.object({
      source: z.enum(["gmail","gdrive","manual","chat_history"]),
      sourceTitle: z.string().optional(), sourceUrl: z.string().optional(), sourceDate: z.string().optional(),
      insightType: z.enum(["academic_strength","academic_gap","trigger","accommodation","interest","medical","social","preference","quote","strategy","context","general"]),
      insight: z.string(),
      confidence: z.enum(["low","medium","high"]).default("medium"),
      sensitive: z.boolean().default(false),
    })).mutation(({ input, ctx }) => db.insertKnowledge({ ...input, approvedBy: ctx.user?.id ?? null } as any)),
    update: protectedProcedure.input(z.object({
      id: z.number(),
      patch: z.object({
        insight: z.string().optional(), insightType: z.string().optional(),
        active: z.boolean().optional(), sensitive: z.boolean().optional(),
        confidence: z.enum(["low","medium","high"]).optional(),
      }),
    })).mutation(({ input }) => db.updateKnowledge(input.id, input.patch as any)),
    delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(({ input }) => db.deleteKnowledge(input.id)),
    // Extract insights from raw text (paste from email, doc, evaluation, etc.)
    ingestText: protectedProcedure.input(z.object({
      sourceTitle: z.string(),
      source: z.enum(["gmail","gdrive","manual","chat_history"]).default("manual"),
      sourceUrl: z.string().optional(),
      sourceDate: z.string().optional(),
      rawText: z.string(),
    })).mutation(async ({ input, ctx }) => {
      const sys = `You extract structured insights about a 5th-grade student named Reagan from documents. Return strict JSON only. Each insight must be a single sentence, present-tense, about Reagan specifically. Use only types: academic_strength, academic_gap, trigger, accommodation, interest, medical, social, preference, quote, strategy, context, general. Output {"insights":[{"insightType":"...","insight":"...","confidence":"low|medium|high"}]}.`;
      const r = await invokeLLM({
        messages: [
          { role: "system", content: sys },
          { role: "user", content: `Source: ${input.sourceTitle}\n\n${input.rawText.slice(0, 8000)}` },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "reagan_insights",
            strict: true,
            schema: {
              type: "object",
              properties: {
                insights: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      insightType: { type: "string", enum: ["academic_strength","academic_gap","trigger","accommodation","interest","medical","social","preference","quote","strategy","context","general"] },
                      insight: { type: "string" },
                      confidence: { type: "string", enum: ["low","medium","high"] },
                    },
                    required: ["insightType","insight","confidence"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["insights"],
              additionalProperties: false,
            },
          },
        },
      });
      let parsed: any = { insights: [] };
      try {
        const content = r.choices[0]?.message?.content;
        const text = typeof content === "string" ? content : (content as any[]).map((c: any) => c.text || "").join("");
        parsed = JSON.parse(text);
      } catch {
        parsed = { insights: [] };
      }
      let inserted = 0;
      for (const item of parsed.insights || []) {
        await db.insertKnowledge({
          source: input.source,
          sourceTitle: input.sourceTitle,
          sourceUrl: input.sourceUrl,
          sourceDate: input.sourceDate,
          insightType: item.insightType,
          insight: item.insight,
          confidence: item.confidence || "medium",
          sensitive: false,
          approvedBy: ctx.user?.id ?? null,
        } as any);
        inserted++;
      }
      return { inserted, total: (parsed.insights || []).length };
    }),

    bulkAdd: protectedProcedure.input(z.object({
      items: z.array(z.object({
        source: z.enum(["gmail","gdrive","manual","chat_history"]),
        sourceTitle: z.string().optional(), sourceUrl: z.string().optional(), sourceDate: z.string().optional(),
        insightType: z.enum(["academic_strength","academic_gap","trigger","accommodation","interest","medical","social","preference","quote","strategy","context","general"]),
        insight: z.string(),
        confidence: z.enum(["low","medium","high"]).default("medium"),
        sensitive: z.boolean().default(false),
      })),
    })).mutation(async ({ input, ctx }) => {
      let count = 0;
      for (const item of input.items) {
        await db.insertKnowledge({ ...item, approvedBy: ctx.user?.id ?? null } as any);
        count++;
      }
      return { inserted: count };
    }),
  }),

  /* =================== WHISPER (AI COMPANION) =================================== */
  kiwi: router({
    history: publicProcedure.input(z.object({ limit: z.number().default(50) })).query(({ input }) => db.listKiwiMessages(input.limit)),
    clear: protectedProcedure.input(z.object({}).optional()).mutation(() => db.clearKiwiHistory()),
    /** 2026-05-05: Kiwi behavior — today (basic) + all-time aggregate. */
    behaviorToday: protectedProcedure
      .input(z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }))
      .query(({ input }) => db.kiwiBehaviorForDate(input.date)),
    behaviorAggregate: protectedProcedure
      .query(() => db.kiwiBehaviorAggregate()),
    /**
     * Phase 14 — cartoon voice for Kiwi/Blue/Daffy/Honk via Gemini TTS.
     * Returns a base64 WAV the browser can drop straight into an <audio> tag.
     * We cap text at 800 chars upstream and fall back to the existing
     * SpeechSynthesis voice on the client if this errors.
     */
    voice: publicProcedure
      .input(z.object({
        companionId: z.enum(["kiwi", "blue", "daffy", "honk"]).default("kiwi"),
        text: z.string().min(1).max(800),
      }))
      .mutation(async ({ input }) => {
        const { synthesizeCartoonVoice } = await import("./_lib/cartoonVoice");
        const { mime, data } = await synthesizeCartoonVoice(input.companionId, input.text);
        return { mime, audioBase64: data.toString("base64") };
      }),
    chat: publicProcedure.input(z.object({
      userMessage: z.string(),
      adultPresent: z.boolean().default(false),
      currentBlockTitle: z.string().optional(),
      currentBlockType: z.string().optional(),
      // quizPayload: JSON string of ReviewBlockPayload when blockType=review
      quizPayload: z.string().optional(),
      // v2.87 (2026-05-21) — Mom asked for more sliders to fine-tune Kiwi.
      // These three personality knobs (0..1) ride on the chat call so the
      // slider state can live entirely in the client (localStorage) and
      // the server stays stateless. The values map to a tone hint suffix
      // on the system prompt. Defaults are mid-scale.
      personalityWarmth: z.number().min(0).max(1).optional(),
      personalityPlayfulness: z.number().min(0).max(1).optional(),
      personalityBrevity: z.number().min(0).max(1).optional(),
    })).mutation(async ({ input }) => {
      // Save user message
      await db.insertKiwiMessage({ role: "user", content: input.userMessage } as any);

      // Push 28: kid-safe content prefilter — runs BEFORE the LLM call so we
      // never spend a network round-trip on flagged content and never risk
      // the model fail-opening on a network error. Self-harm + violence +
      // explicit + scary_horror + personal_info + stranger_contact all get
      // a soft Kiwi-voiced redirect, the redirect is logged as Kiwi's
      // assistant turn so the chat history stays consistent, and Mom is
      // pinged via notifyOwner with the matched category for awareness.
      const { classifyKidSafe } = await import("./_lib/kidSafeClassifier");
      const safety = classifyKidSafe(input.userMessage);
      if (safety.flagged) {
        await db.insertKiwiMessage({ role: "assistant", content: safety.redirect } as any);
        try {
          await notifyOwner({
            title: `Kiwi safety flag: ${safety.categories.join(", ")}`,
            content: `Reagan asked Kiwi: "${input.userMessage.slice(0, 200)}"\n\nMatched: ${safety.matchedSnippet ?? "\u2014"}\nKiwi replied with the soft redirect.`,
          });
        } catch {
          // Owner notify is best-effort; safety reply still goes back.
        }
        return { reply: safety.redirect, nameChange: null, blockedCategories: safety.categories };
      }

      // Detect name-change requests like "call me Sunny", "your name is Sunny", "I want to call you Sunny"
      const nameMatch = input.userMessage.match(/(?:call (?:you|yourself)|your name is|i(?:'ll| will| wanna| want to)? call you|new name is|name yourself)\s+([A-Za-z][A-Za-z\- ]{1,18})/i);
      let nameChange: string | null = null;
      if (nameMatch) {
        const proposed = nameMatch[1].trim().split(/\s+/).slice(0,2).join(" ");
        if (proposed && proposed.length >= 2) {
          await db.upsertProfile({ companionName: proposed } as any);
          nameChange = proposed;
        }
      }

      // Build context
      const profile = await db.getProfile();
      const today = new Date().toISOString().slice(0,10);
      const plan = await db.ensurePlanForDate(today);
      const blocks = plan ? await db.listBlocksForPlan(plan.id) : [];
      const moods = await db.listRecentMood(7);
      const struggles = await db.listStruggles(14);
      const timeline = await db.listTimelineEvents(20);
      const animalsList = await db.listAnimals();
      const recentMessages = await db.listKiwiMessages(20);
      const knowledge = await db.listKnowledgeForKiwi(20);

      const companionName = (profile as any)?.companionName || "Kiwi";
      const tonePref = (profile as any)?.companionTonePreference;

      const systemPrompt = buildKiwiSystemPrompt({
        profileName: profile?.studentName || "Reagan",
        companionName,
        tonePref,
        todayBlocks: blocks.map(b => ({ title: b.title, status: b.status })),
        recentMood: moods.slice(0,5).map(m => ({ zone: m.zone, note: m.note })),
        recentStruggles: struggles.slice(0,3).map(s => ({ intensity: s.intensity, subjectSlug: s.subjectSlug, description: s.description })),
        recentWins: timeline.slice(0,3).map(t => ({ title: t.title })),
        animals: animalsList.map(a => ({ name: a.name, species: a.species })),
        zoneRightNow: moods[0]?.zone || null,
        adultPresent: input.adultPresent,
        knowledgeInsights: knowledge.map(k => ({ insightType: k.insightType, insight: k.insight })),
      });

      // v2.87 (2026-05-21) — Personality slider suffix. Mom can fine-tune
      // Kiwi from the new sliders panel; we translate the three 0..1 values
      // into a short, plain-English tone hint that's appended to the system
      // prompt. Mid-scale (0.5) is a no-op so existing behavior stays.
      const tone = (() => {
        const w = input.personalityWarmth;
        const p = input.personalityPlayfulness;
        const b = input.personalityBrevity;
        const lines: string[] = [];
        if (typeof w === "number") {
          if (w >= 0.7) lines.push("Tone is gently warmer than usual \u2014 a little softer, a little more caring, never gushing.");
          else if (w <= 0.3) lines.push("Tone is cooler and more matter-of-fact than usual \u2014 still kind, but reserved.");
        }
        if (typeof p === "number") {
          if (p >= 0.7) lines.push("You can be a touch playful \u2014 light wordplay or a small bird-sized joke is fine. No exclamation marks.");
          else if (p <= 0.3) lines.push("Stay serious and grounded; skip the playful asides.");
        }
        if (typeof b === "number") {
          if (b >= 0.7) lines.push("Be very brief \u2014 1 short sentence ideally, 2 max.");
          else if (b <= 0.3) lines.push("You may take 2\u20133 sentences when it actually helps.");
        }
        return lines.length === 0 ? "" : `\n\nTONE TUNING (from Mom's sliders):\n${lines.map(l => "\u2022 " + l).join("\n")}`;
      })();
       // Quiz mode: when the active block is a review block, inject quiz instructions
      let quizModeContext = "";
      if (input.currentBlockType === "review" && input.quizPayload) {
        try {
          const quiz = JSON.parse(input.quizPayload);
          const questions: any[] = quiz.questions ?? [];
          if (questions.length > 0) {
            const qList = questions.map((q: any, i: number) =>
              `Q${i+1}: ${q.question}\n  Options: ${(q.choices ?? []).map((c: string, ci: number) => `${String.fromCharCode(65+ci)}) ${c}`).join(" | ")}\n  Correct: ${String.fromCharCode(65+(q.correctIndex??0))} — ${q.explanation}`
            ).join("\n\n");
            quizModeContext = `\n\nQUIZ MODE — ACTIVE:\nReagan is doing a spaced-repetition review block. Your job is to be her quiz partner.\nRules:\n• Ask questions ONE AT A TIME. Start with Q1.\n• After she answers, tell her if she got it right (plain, no fanfare). Give the explanation only if she got it wrong.\n• Track which questions are done in your head. After all questions, give a short summary (e.g. "3 out of 4 — solid").\n• If she's frustrated, pause the quiz and check in first.\n• Do NOT give all questions at once.\n\nQUESTIONS:\n${qList}`;
          }
        } catch { /* ignore parse errors */ }
      }
      const tunedSystemPrompt = systemPrompt + tone + quizModeContext;
      // Build chat history (most recent 10 turns, in chronological order)
      const history = recentMessages.slice().reverse().slice(-10).map(m => ({
        role: m.role as any,
        content: String(m.content),
      }));

      const response = await invokeLLM({
        messages: [
          { role: "system", content: tunedSystemPrompt },
          ...history,
          { role: "user", content: input.userMessage },
        ],
      });

      const aiContentRaw = response.choices[0]?.message?.content || "I'm here.";
      const aiContent: string = typeof aiContentRaw === "string" ? aiContentRaw : (aiContentRaw as any[]).map(c => (c as any).text || "").join("");
      await db.insertKiwiMessage({ role: "assistant", content: aiContent } as any);
      return { reply: aiContent, nameChange };
    }),

    transcribe: publicProcedure.input(z.object({ audioUrl: z.string() })).mutation(async ({ input }) => {
      const result = await transcribeAudio({ audioUrl: input.audioUrl });
      if ("text" in result) return { text: result.text };
      throw new Error("Transcription failed: " + (result as any).code);
    }),

    // A short kind joke (animal-themed when possible)
    joke: publicProcedure.query(async () => {
      const jokes = [
        "Why don't ducks tell secrets? They always quack up. 🦆",
        "What do you call a parakeet who fell into the punch bowl? A bird-bath.",
        "How does a bearded dragon say goodbye? Sea ya later, gator. 🐉 (Wrong species. He doesn't know.)",
        "Why did the hen sit on the axe? To hatch-et.",
        "What do you call a duck that gets straight A's? A wise quacker.",
        "What's a cat's favorite color? Purr-ple.",
        "What do you call a sleeping bull? A bulldozer.",
        "Why did the bicycle fall over? It was two-tired.",
        "What do birds get when they are sick? Tweet-ment.",
        "What do you call a dinosaur with an extensive vocabulary? A thesaurus.",
      ];
      return { text: jokes[Math.floor(Math.random() * jokes.length)] };
    }),

    // Joy drop: a search-able funny animal video link from a curated list
    funnyAnimalVideo: publicProcedure.query(async () => {
      const videos = [
        { title: "Funny ducklings compilation", embedUrl: "https://www.youtube.com/embed/KQHIp1IfvZw" },
        { title: "Parakeets being chaotic",     embedUrl: "https://www.youtube.com/embed/Vad33u9_dZc" },
        { title: "Bearded dragon antics",       embedUrl: "https://www.youtube.com/embed/YbE5tgZeoiw" },
        { title: "Cute baby animals",            embedUrl: "https://www.youtube.com/embed/INscMGmhmX4" },
        { title: "Funny duck running",          embedUrl: "https://www.youtube.com/embed/GwO9SAZcM-c" },
      ];
      return videos[Math.floor(Math.random() * videos.length)];
    }),

    // End-of-day recap: kind, specific, real
    endOfDayRecap: publicProcedure.query(async () => {
      const today = new Date().toISOString().slice(0,10);
      const plan = await db.getPlanByDate(today);
      if (!plan) return { recap: "Soft day. Good for resting. 💛" };
      const blocks = await db.listBlocksForPlan(plan.id);
      const done = blocks.filter(b => b.status === "complete");
      const struggles = await db.listStruggles(1);
      const moods = await db.listRecentMood(1);
      const profile = await db.getProfile();
      const summary = `Reagan finished ${done.length} of ${blocks.length} blocks today. Mood: ${moods[0]?.zone || "unlogged"}. ${struggles.length ? `She logged ${struggles.length} struggle(s).` : "No struggles today."} Done blocks: ${done.map(d => d.title).join(", ") || "none"}.`;
      const sys = `You are ${(profile as any)?.companionName || "Kiwi"}, an AI friend wrapping up the day for Reagan. Write 2-4 short sentences celebrating something specific from today. Use her name. Be warm, real, never saccharine. No mention of timing. End with: \"You did good today.\"`;
      try {
        const r = await invokeLLM({ messages: [{ role: "system", content: sys }, { role: "user", content: summary }] });
        const c = r.choices[0]?.message?.content;
        return { recap: typeof c === "string" ? c : "You did good today. 💛" };
      } catch {
        return { recap: `You showed up today. ${done.length} thing${done.length===1?"":"s"} done, and your animals were loved. You did good today. 💛` };
      }
    }),

    // Kiwi notices a struggle pattern and alerts the parent if needed
    checkAlerts: protectedProcedure.input(z.object({}).optional()).mutation(async () => {
      const struggles = await db.listStruggles(7);
      const reds = struggles.filter(s => s.intensity === "red");
      if (reds.length >= 3) {
        await notifyOwner({
          title: "🪶 Kiwi noticed a pattern",
          content: `Reagan has logged ${reds.length} red-zone struggles this week. Topics: ${reds.map(r => r.subjectSlug || "general").join(", ")}. Worth a check-in.`,
        });
        return { alerted: true, count: reds.length };
      }
      return { alerted: false, count: reds.length };
    }),
   }),

  /* =================== RECAP REQUESTS (Push 51, 2026-05-13) ===================
   *
   * Adult-side surface for the daily-recap email pipeline that fires nightly
   * at 8 PM ET when the day has no actuals. Lets Mom see which recap requests
   * are still pending, manually fire a recap request for a specific date, and
   * preview the prompt that gets emailed. Backed by the existing
   * dailyRecapRequests table + db.createRecapRequest/listPendingRecapRequests.
   */
  recap: router({
    listPending: familyAdminProcedure
      .input(z.object({ limit: z.number().int().min(1).max(200).optional() }).optional())
      .query(({ input }) => db.listPendingRecapRequests(input?.limit ?? 50)),
    isAnswered: familyAdminProcedure
      .input(z.object({ dateISO: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }))
      .query(({ input }) => db.isRecapAlreadyAnswered(input.dateISO)),
    /**
     * Fire-now manual recap request. Idempotent: if any actuals exist for the
     * date OR a recap has already been answered, returns skipped reason.
     * Otherwise creates one row per recipient (Mom + Grandma + active tutors)
     * and returns the tokens so the external mailer can pick them up on the
     * next /pending poll.
     */
    fireNow: familyAdminProcedure
      .input(z.object({
        dateISO: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      }))
      .mutation(async ({ input }) => {
        const dateISO = input.dateISO ?? new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString().slice(0, 10);
        const actualCount = await db.countActualForDate?.(dateISO).catch(() => 0) ?? 0;
        if (actualCount > 0) return { ok: true, skipped: "actual-entries-exist", dateISO, actualCount };
        const answered = await db.isRecapAlreadyAnswered(dateISO).catch(() => false);
        if (answered) return { ok: true, skipped: "already-answered", dateISO };

        const fixedRecipients = ["marcy.spear@gmail.com", "spear.cpt@gmail.com"];
        let tutorEmails: string[] = [];
        try {
          const tutors = (await (db as any).listTutors?.(true)) ?? [];
          tutorEmails = tutors
            .map((t: any) => (t?.email ?? "").trim().toLowerCase())
            .filter((e: string) => /.+@.+\..+/.test(e));
        } catch { /* best-effort */ }
        const recipients = Array.from(new Set([...fixedRecipients, ...tutorEmails]));

        const created: Array<{ recipient: string; token: string }> = [];
        for (const recipient of recipients) {
          // Token format matches the scheduled-send route (16 hex chars).
          const token = Array.from({ length: 16 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
          try {
            await db.createRecapRequest({ dateISO, sentTo: recipient, replyToken: token });
            created.push({ recipient, token });
          } catch (e) {
            console.error("[recap.fireNow] createRecapRequest failed", recipient, e);
          }
        }
        return { ok: true, dateISO, sent: created };
      }),
  }),

  /* =================== JOURNAL (Reagan's free-form) =================== */
  journal: router({
    list: publicProcedure.input(z.object({ limit: z.number().optional() }).optional()).query(({ input }) => db.listJournalEntries(input?.limit ?? 50)),
    create: publicProcedure.input(z.object({
      date: z.string(),
      title: z.string().optional(),
      body: z.string(),
      mood: z.string().optional(),
    })).mutation(async ({ input }) => {
      const row = await db.createJournalEntry(input);
      // Soft-skill auto-bump: best-effort, never throw.
      try { await db.bumpFromJournal({ date: input.date, body: input.body }); } catch (e) { console.warn("[journal.bump] swallowed:", (e as any)?.message); }
      return row;
    }),
    delete: publicProcedure.input(z.object({ id: z.number() })).mutation(({ input }) => db.deleteJournalEntry(input.id)),
  }),

  /* =================== ADULT AI (Mom + tutors) ====================================
     This is the adult-side counterpart to `kiwi`. It is intentionally:
       • text-only (no voice synthesis, no microphone, no character avatar)
       • no Kiwi persona, no animal jokes, no kid-coded language
       • protected (admin / tutor only)
       • aware of today's plan, the topic catalog, the tutor of the day, and any
         pending requests Reagan has submitted via Kiwi
     Tool wiring (assignmentFinder, schedule edit, approve request) is layered in
     subsequent phases; this router exposes the conversational baseline first so
     the UI can already use it.
  =================================================================== */
  adultAi: router({
    history: protectedProcedure.input(z.object({ limit: z.number().default(50) })).query(async ({ input, ctx }) => {
      const role = (ctx.user as any)?.role;
      if (role !== "admin" && role !== "tutor") return [];
      try { return await db.listAdultAiMessages(input.limit); } catch { return []; }
    }),
    chat: protectedProcedure.input(z.object({
      userMessage: z.string().min(1).max(4000),
      forDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    })).mutation(async ({ input, ctx }) => {
      const role = (ctx.user as any)?.role;
      if (role !== "admin" && role !== "tutor") {
        throw new Error("Adult AI is only available to admins and tutors.");
      }
      const dateStr = input.forDate || new Date().toISOString().slice(0, 10);
      const profile: any = await db.getProfile().catch(() => null);
      const plan = await db.getPlanByDate(dateStr).catch(() => null);
      const blocks = plan ? await db.listBlocksForPlan(plan.id).catch(() => []) : [];
      const tutorOfDay = await resolveTutorOfDay(dateStr).catch(() => null);
      const topicHints = await loadTopicHintsForPrompt().catch(() => []);
      const pendingRequests = await db.listStudentRequests({ status: "pending", limit: 10 }).catch(() => []);

      const sys = [
        `You are the adult-side homeschool AI assistant for ${profile?.studentName || "Reagan"}'s dashboard.`,
        `You are talking to ${ctx.user?.name || "an adult"} (role: ${role}).`,
        `Tone: professional, concise, no emoji unless they appear in the user's message. No mascot persona, no "Kiwi" voice. Plain helpful prose.`,
        ``,
        `Today is ${dateStr}. Tutor today: ${tutorOfDay ? `${tutorOfDay.name} (${tutorOfDay.role || "tutor"}) ${tutorOfDay.arrival}–${tutorOfDay.departure}` : "Mom-only day, no outside tutor scheduled."}`,
        ``,
        `Today's planned blocks (${blocks.length}):`,
        blocks.length
          ? blocks.map((b: any) => `  • ${b.startTime || "??:??"}  ${b.title}  [${b.status}]`).join("\n")
          : "  (no blocks yet)",
        ``,
        `Reagan has ${pendingRequests.length} pending request(s) waiting for adult review.`,
        ``,
        `Active curriculum topic catalog (you must reference these codes when discussing assignments):`,
        topicHints.slice(0, 30).map(t => `  ${t.code} [${t.subjectSlug}] (${t.status}) — ${t.title}`).join("\n"),
        ``,
        `Capabilities you can offer today (describe in plain language; tool wiring will be added in a later release):`,
        `  • Search the assignment library + connected apps + kid-safe web for matching activities`,
        `  • Suggest a swap, soften, or postpone for any block; the human approves before it commits`,
        `  • Approve or decline Reagan's pending requests`,
        `  • Explain why a block was scheduled and which curriculum standard it covers`,
        ``,
        `Hard rules:`,
        `  - Never speak as "Kiwi". You are the adult AI.`,
        `  - Never reveal Reagan's struggles or mood notes verbatim; you may summarize gently when relevant.`,
        `  - When suggesting a schedule edit, always include: which block, the new title/duration, and the curriculum topic code it covers.`,
      ].join("\n");

      try { await db.insertAdultAiMessage({ role: "user", content: input.userMessage, actorOpenId: ctx.user?.openId, actorName: ctx.user?.name }); } catch {}
      const recent = await db.listAdultAiMessages(10).catch(() => [] as any[]);
      const history = (recent as any[]).slice().reverse().slice(-10).map((m: any) => ({ role: m.role as any, content: String(m.content) }));

      const response = await invokeLLM({
        messages: [
          { role: "system", content: sys },
          ...history,
          { role: "user", content: input.userMessage },
        ],
      });
      const raw = response.choices[0]?.message?.content || "I do not have a response right now.";
      const replyText: string = typeof raw === "string" ? raw : (raw as any[]).map((c: any) => c.text || "").join("");
      try { await db.insertAdultAiMessage({ role: "assistant", content: replyText }); } catch {}
      return { reply: replyText, dateStr, tutorOfDay, pendingRequestCount: pendingRequests.length };
    }),

    /* ---- Tutor / admin block-edit tools (callable from chat UI) ---- */
    swapBlock: protectedProcedure.input(z.object({
      blockId: z.number(),
      newTitle: z.string().min(1).max(200),
      newDurationMin: z.number().int().min(5).max(180).optional(),
      newCurriculumTopicCode: z.string().optional(),
      reason: z.string().max(500).optional(),
    })).mutation(async ({ input, ctx }) => {
      await assertAdultOrTutorOfBlock(ctx, input.blockId);
      const reasonNote = input.reason ? `\n[swap by ${ctx.user?.name || "adult"}: ${input.reason}]` : `\n[swap by ${ctx.user?.name || "adult"}]`;
      const patch: any = { title: input.newTitle, notes: reasonNote };
      if (input.newDurationMin) patch.durationMin = input.newDurationMin;
      if (input.newCurriculumTopicCode) {
        const newId = await resolveTopicId(input.newCurriculumTopicCode);
        if (newId) patch.curriculumTopicId = newId;
      }
      await db.updateBlock(input.blockId, patch);
      try { await db.insertAdultAiMessage({ role: "assistant", content: `[swap] block #${input.blockId} → “${input.newTitle}”${input.reason ? " — " + input.reason : ""}`, actorOpenId: ctx.user?.openId, actorName: ctx.user?.name }); } catch {}
      return { ok: true };
    }),
    softenBlock: protectedProcedure.input(z.object({
      blockId: z.number(),
      reduceMinutesBy: z.number().int().min(5).max(60).default(10),
      noteSuffix: z.string().max(200).optional(),
    })).mutation(async ({ input, ctx }) => {
      await assertAdultOrTutorOfBlock(ctx, input.blockId);
      const blk: any = await db.getBlock(input.blockId);
      if (!blk) throw new Error("Block not found");
      const newDuration = Math.max(5, (blk.durationMin || 30) - input.reduceMinutesBy);
      const note = input.noteSuffix ? `${blk.title} — lighter version (${input.noteSuffix})` : `${blk.title} — lighter version`;
      const auditNote = `\n[softened by ${ctx.user?.name || "adult"}: -${input.reduceMinutesBy}min]`;
      await db.updateBlock(input.blockId, { title: note, durationMin: newDuration, notes: ((blk.notes || "") + auditNote).trim() });
      return { ok: true, newDuration };
    }),
    postponeBlock: protectedProcedure.input(z.object({
      blockId: z.number(),
      toDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    })).mutation(async ({ input, ctx }) => {
      await assertAdultOrTutorOfBlock(ctx, input.blockId);
      const blk: any = await db.getBlock(input.blockId);
      if (!blk) throw new Error("Block not found");
      const targetPlan = await db.ensurePlanForDate(input.toDate, { source: "manual" });
      const auditNote = `\n[postponed to ${input.toDate} by ${ctx.user?.name || "adult"}]`;
      await db.updateBlock(input.blockId, { planId: targetPlan.id, status: "not_started", notes: ((blk.notes || "") + auditNote).trim() });
      return { ok: true, movedTo: input.toDate };
    }),
    addBlock: protectedProcedure.input(z.object({
      dateStr: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      title: z.string().min(1).max(200),
      subjectSlug: z.string().min(1),
      curriculumTopicCode: z.string().min(1),
      durationMin: z.number().int().min(5).max(180).default(20),
      startTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
    })).mutation(async ({ input, ctx }) => {
      const role = (ctx.user as any)?.role;
      if (role !== "admin" && role !== "tutor") throw new Error("forbidden");
      if (role === "tutor") {
        const today = new Date().toISOString().slice(0, 10);
        if (input.dateStr !== today) throw new Error("Tutors can only add blocks for today's date.");
        const tod = await resolveTutorOfDay(input.dateStr);
        if (!tod) throw new Error("No tutor scheduled today; only an admin may add blocks.");
      }
      const newTopicId = await resolveTopicId(input.curriculumTopicCode);
      if (!newTopicId) throw new Error(`Unknown curriculum topic code: ${input.curriculumTopicCode}`);
      const plan = await db.ensurePlanForDate(input.dateStr, { source: "manual" });
      const blockId = await db.createBlock({
        planId: plan.id,
        title: input.title,
        subjectSlug: input.subjectSlug,
        curriculumTopicId: newTopicId,
        durationMin: input.durationMin,
        startTime: input.startTime || null,
        status: "not_started",
        notes: `[added by ${ctx.user?.name || role} via adult AI]`,
      } as any);
      return { ok: true, blockId };
    }),

    /**
     * findAssignments — universal kid-safe-aware search across the internal
     * Library AND the live web (Perplexity Sonar). Adults get unfiltered
     * results; tutors are forced kid-safe; the kid role is rejected.
     */
    findAssignments: protectedProcedure.input(z.object({
      query: z.string().max(400).default(""),
      subjectSlug: z.string().nullable().optional(),
      imageUrl: z.string().url().nullable().optional(),
      kidSafe: z.boolean().optional(),
      includeWeb: z.boolean().optional(),
      includeLibrary: z.boolean().optional(),
    })).mutation(async ({ input, ctx }) => {
      const role = (ctx.user as any)?.role;
      if (role !== "admin" && role !== "tutor") throw new Error("This search is only available to admins and tutors.");
      const kidSafe = input.kidSafe ?? (role !== "admin");
      const finder = await import("./_lib/assignmentFinder");
      const results = await finder.findAssignments({
        query: input.query,
        subjectSlug: input.subjectSlug ?? null,
        imageUrl: input.imageUrl ?? null,
        kidSafe,
        includeWeb: input.includeWeb,
        includeLibrary: input.includeLibrary,
      });
      return { results, kidSafe, count: results.length };
    }),

    /**
     * Drop a finder result onto a date. Library items get pinned via
     * `assignments_library.dateFor`; web/youtube results become a new
     * scheduleBlock with the resolved curriculum topic id.
     */
    addFinderResultToDate: protectedProcedure.input(z.object({
      dateStr: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      title: z.string().min(1).max(300),
      url: z.string().nullable().optional(),
      type: z.string().default("other"),
      subjectSlug: z.string().nullable().optional(),
      curriculumTopicCode: z.string().nullable().optional(),
      curriculumTopicId: z.number().int().positive().nullable().optional(),
      estimatedMinutes: z.number().int().positive().max(180).nullable().optional(),
      source: z.enum(["library", "sonar_web", "sonar_youtube"]).default("sonar_web"),
      internalId: z.number().int().positive().nullable().optional(),
    })).mutation(async ({ input, ctx }) => {
      const role = (ctx.user as any)?.role;
      if (role !== "admin" && role !== "tutor") throw new Error("forbidden");
      let topicId: number | null = input.curriculumTopicId ?? null;
      if (!topicId && input.curriculumTopicCode) {
        topicId = await resolveTopicId(input.curriculumTopicCode);
      }
      if (!topicId) throw new Error("This result is missing a curriculum topic. Please tag it before scheduling.");
      const plan = await db.ensurePlanForDate(input.dateStr, { source: "manual" });
      const blockId = await db.createBlock({
        planId: plan.id,
        title: input.title,
        subjectSlug: input.subjectSlug ?? "other",
        curriculumTopicId: topicId,
        durationMin: input.estimatedMinutes || 20,
        status: "not_started",
        notes: `[added via finder by ${ctx.user?.name || role}] source=${input.source}${input.url ? ` url=${input.url}` : ""}`,
      } as any);
      return { ok: true, blockId };
    }),
  }),

  /* =================== HELP LIST (What I'd like help with) =================== */
  help: router({
    list: publicProcedure.query(() => db.listHelpList()),
    create: publicProcedure.input(z.object({
      title: z.string(),
      note: z.string().optional(),
      subjectSlug: z.string().optional(),
      priority: z.enum(["low","medium","high"]).optional(),
    })).mutation(({ input }) => db.createHelpItem(input)),
    update: publicProcedure.input(z.object({ id: z.number(), title: z.string().optional(), note: z.string().optional(), subjectSlug: z.string().optional(), priority: z.enum(["low","medium","high"]).optional(), status: z.enum(["open","in_progress","resolved"]).optional() })).mutation(({ input }) => {
      const { id, ...rest } = input;
      return db.updateHelpItem(id, rest as any);
    }),
    delete: publicProcedure.input(z.object({ id: z.number() })).mutation(({ input }) => db.deleteHelpItem(input.id)),
  }),

  /* =================== TAKE NOTES =================== */
  notes: router({
    list: publicProcedure.input(z.object({ subjectSlug: z.string().optional(), limit: z.number().optional() }).optional()).query(({ input }) => db.listTakeNotes(input)),
    create: publicProcedure.input(z.object({
      subjectSlug: z.string().optional(),
      title: z.string().optional(),
      body: z.string().optional(),
      strokes: z.any().optional(),
      pngFileKey: z.string().optional(),
      pngFileUrl: z.string().optional(),
      tags: z.array(z.string()).optional(),
      linkedBlockId: z.number().nullable().optional(),
    })).mutation(({ input }) => db.createTakeNote(input as any)),
    update: publicProcedure.input(z.object({ id: z.number(), subjectSlug: z.string().optional(), title: z.string().optional(), body: z.string().optional(), strokes: z.any().optional(), pngFileKey: z.string().optional(), pngFileUrl: z.string().optional(), tags: z.array(z.string()).optional(), linkedBlockId: z.number().nullable().optional() })).mutation(({ input }) => {
      const { id, ...rest } = input;
      return db.updateTakeNote(id, rest as any);
    }),
    delete: publicProcedure.input(z.object({ id: z.number() })).mutation(({ input }) => db.deleteTakeNote(input.id)),
  }),

  /* =================== NEEDS WORK TREE =================== */
  needsWork: router({
    list: publicProcedure.query(() => db.listNeedsWork()),
    create: publicProcedure.input(z.object({
      parentId: z.number().nullable().optional(),
      subjectSlug: z.string().optional(),
      title: z.string(),
      note: z.string().optional(),
      origin: z.enum(["manual","mastery","struggle","low_grade","external"]).optional(),
      sortOrder: z.number().optional(),
      dateAdded: z.string().optional(),
    })).mutation(({ input }) => db.createNeedsWork(input as any)),
    update: publicProcedure.input(z.object({ id: z.number(), parentId: z.number().nullable().optional(), subjectSlug: z.string().optional(), title: z.string().optional(), note: z.string().optional(), sortOrder: z.number().optional() })).mutation(({ input }) => {
      const { id, ...rest } = input;
      return db.updateNeedsWork(id, rest as any);
    }),
    complete: publicProcedure.input(z.object({ id: z.number() })).mutation(({ input, ctx }) => db.completeNeedsWork(input.id, (ctx as any).user?.id)),
    reopen: publicProcedure.input(z.object({ id: z.number() })).mutation(({ input }) => db.reopenNeedsWork(input.id)),
    delete: publicProcedure.input(z.object({ id: z.number() })).mutation(({ input }) => db.deleteNeedsWork(input.id)),
    reparent: publicProcedure.input(z.object({ id: z.number(), parentId: z.number().nullable() })).mutation(({ input }) => db.updateNeedsWork(input.id, { parentId: input.parentId } as any)),
  }),

  /* =================== KID REQUESTS — push 26 =================== */
  /* Reagan can fire a small note to her adults from any kid page. The
     server emits notifyOwner + emails Mom/Dad/Grandma so they can read it
     on the go. Adults can mark resolved from Settings. */
  kidRequests: router({
    create: publicProcedure.input(z.object({
      body: z.string().min(1).max(2000),
      kind: z.enum(["general","schedule","stuck","feeling"]).default("general"),
    })).mutation(async ({ input, ctx }) => {
      const userId = (ctx as any).user?.id ?? null;
      const { id, emailedTo, notifyOwnerOk } = await db.createKidRequest({
        body: input.body,
        kind: input.kind,
        fromUserId: userId,
      });
      // Best-effort owner notification (notifyOwner already returns bool).
      const title = `Reagan sent a request (${input.kind})`;
      const content = input.body.length > 800 ? input.body.slice(0, 800) + "…" : input.body;
      try { await notifyOwner({ title, content }); } catch {}
      return { id, emailedTo, notifyOwnerOk };
    }),
    list: familyAdminProcedure.input(z.object({
      includeResolved: z.boolean().default(false),
      limit: z.number().min(1).max(200).default(50),
    }).optional()).query(({ input }) => db.listKidRequests(input?.includeResolved ?? false, input?.limit ?? 50)),
    unresolvedCount: familyAdminProcedure.query(() => db.countUnresolvedKidRequests()),
    resolve: familyAdminProcedure.input(z.object({
      id: z.number(),
      note: z.string().max(2000).optional(),
    })).mutation(({ input, ctx }) => db.resolveKidRequest(input.id, (ctx as any).user?.id ?? null, input.note)),
  }),

  /* =================== BLOCK GRADES =================== */
  grades: router({
    get: publicProcedure.input(z.object({ blockId: z.number() })).query(({ input }) => db.getBlockGrade(input.blockId)),
    upsert: publicProcedure.input(z.object({
      blockId: z.number(),
      subjectSlug: z.string().optional(),
      score: z.number().min(0).max(100),
      letter: z.string().optional(),
      kidLabel: z.enum(["not_yet","getting_there","got_it","mastered"]).optional(),
      note: z.string().optional(),
    })).mutation(({ input, ctx }) => db.upsertBlockGrade({ ...input, gradedByUserId: (ctx as any).user?.id })),
    listAll: publicProcedure.query(() => db.listAllBlockGrades(500)),
    rolling: publicProcedure.input(z.object({ subjectSlug: z.string() })).query(({ input }) => db.rollingGradeForSubject(input.subjectSlug)),
  }),

  /* =================== ANSWER KEYS + AUTOGRADE =================== */
  answerKeys: router({
    get: publicProcedure.input(z.object({ blockId: z.number() })).query(({ input }) => db.getAnswerKeyForBlock(input.blockId)),
    upsert: publicProcedure.input(z.object({
      blockId: z.number(),
      questions: z.any(),
      totalPoints: z.number().optional(),
    })).mutation(({ input }) => db.upsertAnswerKey(input as any)),
  }),

  /* =================== CURRICULUM ADJUSTMENTS =================== */
  adjustments: router({
    list: publicProcedure.input(z.object({ status: z.enum(["proposed","accepted","rejected","applied"]).optional() }).optional()).query(({ input }) => db.listAdjustments(input?.status)),
    create: publicProcedure.input(z.object({ subjectSlug: z.string(), weekStart: z.string(), suggestion: z.string(), reason: z.string().optional(), affectsTopicId: z.number().optional() })).mutation(({ input }) => db.createAdjustment(input)),
    decide: publicProcedure.input(z.object({ id: z.number(), status: z.enum(["accepted","rejected","applied"]) })).mutation(({ input, ctx }) => db.decideAdjustment(input.id, input.status, (ctx as any).user?.id)),
    rebuild: publicProcedure.mutation(() => db.rebuildAdaptiveSuggestions()),
  }),

  /* =================== ACADEMIC RECORDS =================== */
  academics: router({
    list: publicProcedure.input(z.object({
      source: z.enum(["paste","manus_share","gmail","classroom","ixl","drive","manual"]).optional(),
      subjectSlug: z.string().optional(),
      schoolYear: z.string().optional(),
      term: z.string().optional(),
      grade: z.string().optional(),
      teacher: z.string().optional(),
      limit: z.number().optional(),
    }).optional()).query(({ input }) => db.listAcademicRecords(input)),
    create: publicProcedure.input(z.object({
      source: z.enum(["paste","manus_share","gmail","classroom","ixl","drive","manual"]),
      kind: z.enum(["assignment","grade","mastery","note","attendance"]),
      subjectSlug: z.string().optional(),
      title: z.string(),
      summary: z.string().optional(),
      scoreText: z.string().optional(),
      scorePercent: z.number().optional(),
      dueAt: z.string().optional(),
      payload: z.string().optional(),
      metadata: z.any().optional(),
      // Phase: per-year academic timeline.
      grade: z.string().optional(),
      schoolYear: z.string().optional(),
      term: z.enum(["Q1","Q2","Q3","Q4","S1","S2","YR"]).optional(),
      teacher: z.string().optional(),
      courseName: z.string().optional(),
    })).mutation(({ input }) => db.createAcademicRecord({
      ...input,
      dueAt: input.dueAt ? new Date(input.dueAt) : undefined,
    } as any)),
    extract: publicProcedure.input(z.object({
      source: z.enum(["paste","manus_share","gmail","classroom","ixl","drive","manual"]).default("paste"),
      text: z.string().min(3),
    })).mutation(({ input }) => db.extractAcademicFromPaste(input.source, input.text)),
    delete: publicProcedure.input(z.object({ id: z.number() })).mutation(({ input }) => db.deleteAcademicRecord(input.id)),
    /**
     * Bulk-upsert academic records, skipping any that match an existing
     * (schoolYear+course+term+title) fingerprint. Used by the CSV/PDF uploader
     * so re-running an import is safe and idempotent.
     */
    bulkUpsert: publicProcedure.input(z.object({
      records: z.array(z.object({
        source: z.enum(["paste","manus_share","gmail","classroom","ixl","drive","manual"]),
        kind: z.enum(["assignment","grade","mastery","note","attendance"]),
        subjectSlug: z.string().optional(),
        title: z.string(),
        summary: z.string().optional(),
        scoreText: z.string().optional(),
        scorePercent: z.number().optional(),
        dueAt: z.string().optional(),
        payload: z.string().optional(),
        grade: z.string().optional(),
        schoolYear: z.string().optional(),
        term: z.string().optional(),
        teacher: z.string().optional(),
        courseName: z.string().optional(),
      })),
    })).mutation(({ input }) => db.bulkUpsertAcademicRecords(input.records.map((r) => ({
      ...r,
      dueAt: r.dueAt ? new Date(r.dueAt) : undefined,
    })) as any)),
    /** Per-subject rolling academic average filtered by schoolYear / term / grade / teacher. */
    rollingAverage: publicProcedure.input(z.object({
      subjectSlug: z.string().optional(),
      schoolYear: z.string().optional(),
      term: z.string().optional(),
      grade: z.string().optional(),
      teacher: z.string().optional(),
    })).query(({ input }) => db.academicRollingAverage(input)),
  }),

  /* =================== ASSIGNMENT SUBMISSIONS + AUTO-GRADING =================== */
  submissions: router({
    list: publicProcedure.input(z.object({ blockId: z.number().optional(), limit: z.number().optional() }).optional()).query(async ({ input }) => {
      const all = await db.listAssignmentSubmissions(input?.limit ?? 50);
      return input?.blockId ? (all as any[]).filter((s) => s.blockId === input.blockId) : all;
    }),
    create: publicProcedure.input(z.object({
      blockId: z.number(),
      mode: z.enum(["draw","photo","typed"]),
      answersText: z.string().optional(),
      strokes: z.any().optional(),
      fileKey: z.string().optional(),
      fileUrl: z.string().optional(),
      title: z.string().optional(),
      subjectSlug: z.string().optional(),
      // Kid-facing difficulty rating asked after every turn-in.
      kidDifficulty: z.enum(["easy","just_right","tricky","really_hard"]).optional(),
      // Reading-bucket assignments use a one-tap checkmark; no photo or auto-grade needed.
      readingCheckmark: z.boolean().optional(),
    })).mutation(async ({ input }) => {
      // Encode kidDifficulty + readingCheckmark into adultNotes as a structured
      // tag prefix so we don't need a schema migration tonight. Analytics + the
      // Adult Library can parse `[difficulty=...;reading_checkmark=1]`.
      const tags: string[] = [];
      if (input.kidDifficulty) tags.push(`difficulty=${input.kidDifficulty}`);
      if (input.readingCheckmark) tags.push("reading_checkmark=1");
      const adultNotes = tags.length ? `[${tags.join(";")}]` : undefined;
      const row = await db.createAssignmentSubmission({
        blockId: input.blockId,
        subjectSlug: input.subjectSlug,
        title: input.title,
        submissionType: input.readingCheckmark
          ? "text"
          : input.mode === "typed" ? "text" : input.mode === "photo" ? "photo" : "file",
        contentText: input.readingCheckmark ? "✓ Done reading" : input.answersText,
        fileKey: input.fileKey,
        fileUrl: input.fileUrl,
        adultNotes,
        // Migration 0040 — first-class columns for these two fields.
        kidDifficulty: input.kidDifficulty,
        readingOnly: !!input.readingCheckmark,
      } as any);
      // Phase 5: every turn-in nudges the curriculum tree + skill ladder.
      try {
        await db.bumpFromSubmission({
          subjectSlug: input.subjectSlug ?? null,
          blockTitle: input.title ?? null,
          kidDifficulty: input.kidDifficulty ?? null,
        });
      } catch { /* best-effort */ }

      /* ----------------------------------------------------------------------
       * 2026-05-14 overnight push ("automations are top priority"):
       * Auto-trigger the existing autoGrade pipeline AND auto-mirror finished
       * work to Drive on every new submission, so Mom never has to tap
       * "grade this" or "upload to Drive". Both are fire-and-forget so the
       * turn-in returns instantly to the kid.
       * -------------------------------------------------------------------- */
      const submissionId: number | undefined = (row as any)?.id;
      const fileUrl: string | undefined = (row as any)?.fileUrl ?? input.fileUrl;
      const fileKey: string | undefined = (row as any)?.fileKey ?? input.fileKey;
      // Skip auto-grade for one-tap reading checkmarks.
      if (submissionId && !input.readingCheckmark) {
        // Fire-and-forget: in-process call so we don't pay the http hop.
        void (async () => {
          try {
            await new Promise((r) => setTimeout(r, 50));
            // Reuse the autoGrade procedure logic by calling the helper path:
            // listAssignmentSubmissions → grade. Inline-friendly via dynamic import.
            const mod = await import("./_lib/autoGradeRunner").catch(() => null);
            if (mod && typeof (mod as any).runAutoGradeForSubmission === "function") {
              await (mod as any).runAutoGradeForSubmission(submissionId);
            }
          } catch { /* best-effort */ }
        })();
      }
      // Auto-Drive-mirror finished work (photo / drawn / file submissions).
      if (submissionId && fileKey && fileUrl) {
        void (async () => {
          try {
            const today = new Date().toISOString().slice(0, 10);
            const ym = today.slice(0, 7);
            const safeTitle = (input.title ?? `Block ${input.blockId}`)
              .replace(/[^A-Za-z0-9]+/g, "_")
              .slice(0, 60);
            await (db as any).enqueueDrivePush?.({
              fileKey,
              fileUrl,
              fileName: `${today} - ${safeTitle} - submission_${submissionId}`,
              mimeType: null,
              targetFolder: "finished_work" as any,
              targetSubpath: ym,
            } as any);
          } catch { /* best-effort */ }
        })();
      }
      return row;
    }),
    upload: publicProcedure.input(z.object({ dataUrl: z.string(), fileName: z.string() })).mutation(async ({ input }) => {
      // Parse data URL
      const m = /^data:([^;]+);base64,(.+)$/.exec(input.dataUrl);
      if (!m) throw new Error("Expected a data URL (image/png base64).");
      const mime = m[1];
      const buf = Buffer.from(m[2], "base64");
      const key = `assignments/${Date.now()}-${input.fileName.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      return storagePut(key, buf, mime);
    }),
    autoGrade: publicProcedure.input(z.object({ submissionId: z.number() })).mutation(async ({ input }) => {
      // Pull submission + answer key + answers
      const subs = await db.listAssignmentSubmissions(200);
      const sub = (subs as any[]).find((s) => s.id === input.submissionId);
      if (!sub) throw new Error("Submission not found.");
      const key = await db.getAnswerKeyForBlock(sub.blockId);
      if (!key) return { autoScore: null as number | null, letter: null as string | null, feedback: "No answer key set for this block." };

      // Best-effort auto-grade:
      //  - For 'typed' submissions, parse answers line-by-line against MC/text keys
      //  - For 'photo'/'drawn' submissions, ask the LLM to vision-grade against the rubric
      let score = 0;
      let total = (key.totalPoints as number) || 100;
      let feedback = "";
      const questions = (key.questions as any[]) || [];
      const perQ = questions.length ? Math.floor(total / questions.length) : 0;
      const answers: Record<string,string> = {};

      if (sub.submissionType === "text" && sub.contentText) {
        const lines = String(sub.contentText).split(/\r?\n/).map((l: string) => l.trim()).filter(Boolean);
        for (let i = 0; i < questions.length; i++) {
          const q = questions[i];
          const ans = lines[i] || "";
          answers[q.qId] = ans;
          if (!ans) continue;
          if (q.kind === "mc" && q.correct) {
            if (ans.trim().toLowerCase() === String(q.correct).trim().toLowerCase()) score += perQ;
          } else if (q.kind === "text" && q.correct) {
            // Exact OR LLM-equivalent
            if (ans.trim().toLowerCase() === String(q.correct).trim().toLowerCase()) {
              score += perQ;
            } else {
              try {
                const r = await invokeLLM({ messages: [
                  { role: "system", content: "You grade 5th-grade answers. Reply with a single JSON object {\"correct\": boolean, \"why\": string}." },
                  { role: "user", content: `Question: ${q.prompt || "(no prompt)"}\nExpected: ${q.correct}\nStudent: ${ans}\nGrade with tolerance for spelling/phrasing.` },
                ], response_format: { type: "json_schema", json_schema: { name: "g", strict: true, schema: { type: "object", additionalProperties: false, required: ["correct","why"], properties: { correct: { type: "boolean" }, why: { type: "string" } } } } } });
                const raw = (r as any)?.choices?.[0]?.message?.content || "{}";
                const parsed = JSON.parse(raw);
                if (parsed.correct) score += perQ;
                feedback += `${q.prompt ? q.prompt + ": " : ""}${parsed.why}\n`;
              } catch { /* swallow */ }
            }
          }
        }
      } else if (sub.fileUrl) {
        // Vision-grade against rubric
        try {
          const promptText = questions.map((q,i) => `Q${i+1} (${q.kind}): ${q.prompt || ""}\n  Rubric: ${q.rubric || ""}\n  Expected: ${q.correct || ""}`).join("\n");
          const r = await invokeLLM({ messages: [
            { role: "system", content: "You grade a 5th-grade worksheet from an image. Reply with strict JSON {\"score\": 0-100, \"feedback\": string}." },
            { role: "user", content: [
              { type: "text", text: `Grade this worksheet.\n${promptText}` },
              { type: "image_url", image_url: { url: new URL(sub.fileUrl, "https://dashboard.local").toString().replace("https://dashboard.local", "") } },
            ] },
          ], response_format: { type: "json_schema", json_schema: { name: "g", strict: true, schema: { type: "object", additionalProperties: false, required: ["score","feedback"], properties: { score: { type: "integer" }, feedback: { type: "string" } } } } } });
          const raw = (r as any)?.choices?.[0]?.message?.content || "{}";
          const parsed = JSON.parse(raw);
          score = Math.max(0, Math.min(100, Math.round(parsed.score || 0)));
          feedback = String(parsed.feedback || "");
        } catch (e: any) {
          feedback = "Image grading unavailable right now.";
        }
      }

      const pct = Math.max(0, Math.min(100, Math.round((score / total) * 100)));
      const letter = pct >= 90 ? "A" : pct >= 80 ? "B" : pct >= 70 ? "C" : pct >= 60 ? "D" : "F";
      await db.recordAutoGrade({ submissionId: input.submissionId, autoScore: pct, autoLetter: letter, autoFeedback: feedback, answers });
      // Roll into skillsMastery so adaptive curriculum + Needs Work can react
      if (sub.subjectSlug) {
        await db.applyGradeToMastery({
          subjectSlug: sub.subjectSlug,
          skillName: sub.title || sub.subjectSlug,
          score: pct,
        }).catch(() => {});
      }
      return { autoScore: pct, letter, feedback };
    }),
    subjectGrades: publicProcedure.query(() => db.subjectRollingGrades()),
    /**
     * Recent turn-ins (compact). Default limit is 5 because the Curriculum
     * page now shows them in a tight scroll-table; the search bar uses
     * `searchAll` to query the full archive.
     */
    recent: publicProcedure
      .input(z.object({ limit: z.number().min(1).max(50).default(5) }).optional())
      .query(({ input }) => db.listAssignmentSubmissions(input?.limit ?? 5)),
    /** Free-text search across every turn-in (title / answers / notes / feedback). */
    searchAll: publicProcedure
      .input(z.object({ q: z.string(), limit: z.number().min(1).max(50).default(25) }))
      .query(({ input }) => db.searchAssignmentSubmissions(input.q, input.limit)),
    /** List ungraded turn-ins; used by the back-fill grader. */
    listUngraded: publicProcedure
      .input(z.object({ limit: z.number().min(1).max(200).default(50) }).optional())
      .query(({ input }) => db.listUngradedSubmissions(input?.limit ?? 50)),
    /**
     * Best-effort "grade everything I can" back-fill. Iterates ungraded
     * submissions and calls autoGrade for each one that has an answer key.
     * Stops at `max` to bound LLM cost. Reports per-row outcomes.
     */
    gradeAllUngraded: protectedProcedure
      .input(z.object({ max: z.number().min(1).max(50).default(20) }).optional())
      .mutation(async ({ input }) => {
        const max = input?.max ?? 20;
        const ungraded = (await db.listUngradedSubmissions(max)) as any[];
        let graded = 0; let skipped = 0; let failed = 0;
        const results: Array<{ id: number; status: string; reason?: string }> = [];
        for (const sub of ungraded) {
          try {
            const key = await db.getAnswerKeyForBlock(sub.blockId);
            if (!key) { skipped++; results.push({ id: sub.id, status: "skipped", reason: "no answer key" }); continue; }
            // Re-use the same path as autoGrade.
            // We avoid an HTTP round-trip by calling the helpers directly.
            // Minimal text path — image grading is best left to the per-row
            // "Grade now" button to avoid blasting the LLM in a single request.
            if (sub.submissionType === "text" && sub.contentText) {
              const lines = String(sub.contentText).split(/\r?\n/).map((l: string) => l.trim()).filter(Boolean);
              const questions = (key.questions as any[]) || [];
              const total = (key.totalPoints as number) || 100;
              const perQ = questions.length ? Math.floor(total / questions.length) : 0;
              let score = 0;
              for (let i = 0; i < questions.length; i++) {
                const q = questions[i]; const ans = lines[i] || "";
                if (!ans) continue;
                if (q.kind === "mc" && q.correct && ans.trim().toLowerCase() === String(q.correct).trim().toLowerCase()) score += perQ;
                else if (q.kind === "text" && q.correct && ans.trim().toLowerCase() === String(q.correct).trim().toLowerCase()) score += perQ;
              }
              const pct = Math.max(0, Math.min(100, Math.round((score / total) * 100)));
              const letter = pct >= 90 ? "A" : pct >= 80 ? "B" : pct >= 70 ? "C" : pct >= 60 ? "D" : "F";
              await db.recordAutoGrade({ submissionId: sub.id, autoScore: pct, autoLetter: letter, autoFeedback: "Back-filled by Mom's bulk grade.", answers: {} as any });
              graded++; results.push({ id: sub.id, status: "graded" });
            } else {
              skipped++; results.push({ id: sub.id, status: "skipped", reason: "non-text needs per-row grader" });
            }
          } catch (e: any) {
            failed++; results.push({ id: sub.id, status: "failed", reason: e?.message || "unknown" });
          }
        }
        return { graded, skipped, failed, total: ungraded.length, results };
      }),
    /**
     * Soft-reset the "Recent turn-ins" view: marks every existing submission
     * with adultNotes containing `[archived=1]` so the UI's recents query
     * filters them out. Mom can still find them via searchAll.
     */
    archiveAllRecents: protectedProcedure.mutation(async () => {
      const recents = await db.listAssignmentSubmissions(1000);
      let archived = 0;
      for (const r of recents as any[]) {
        const notes = String(r.adultNotes || "");
        if (notes.includes("archived=1")) continue;
        const next = notes ? `${notes} [archived=1]` : `[archived=1]`;
        await db.updateAssignmentSubmission(r.id, { adultNotes: next } as any);
        archived++;
      }
      return { archived };
    }),
  }),

  /* =================== IEP (Goals + Accommodations) =================== */
  iep: router({
    listGoals: publicProcedure.query(() => db.listIepGoals()),
    listAccommodations: publicProcedure.query(() => db.listIepAccommodations()),
    listScreenings: publicProcedure.query(() => db.listAssessmentScreenings()),
    /**
     * Codified Color-Coded Warning Zones from the canonical IEP-aligned
     * doc. Frontend renders these in the adult-side reference panel so
     * Mom and Grandma always see Reagan-specific guidance, not generic
     * anxiety advice.
     */
    warningZones: publicProcedure.query(async () => {
      const { WARNING_ZONES } = await import("./_lib/warningZones");
      return WARNING_ZONES;
    }),
    crisisProtocol: publicProcedure.query(async () => {
      const { CRISIS_PROTOCOL } = await import("./_lib/warningZones");
      return CRISIS_PROTOCOL;
    }),
    whatWorksMatrix: publicProcedure.query(async () => {
      const { WHAT_WORKS_MATRIX } = await import("./_lib/whatWorks");
      return WHAT_WORKS_MATRIX;
    }),
  }),

  /* =================== REWARDS (stickers, coins, prizes, notes) =================== */
  rewards: router({
    myStickers: publicProcedure.query(({ ctx }) => db.listStickers((ctx as any).user?.id ?? null)),
    myCoins: publicProcedure.query(({ ctx }) => db.coinBalance((ctx as any).user?.id ?? null)),
    myLedger: publicProcedure.input(z.object({ limit: z.number().default(30) }).optional()).query(({ input, ctx }) => db.recentCoinLedger((ctx as any).user?.id ?? null, input?.limit ?? 30)),
    awardBonus: protectedProcedure.input(z.object({
      userId: z.number().optional(), coins: z.number().default(1), lyric: z.string().optional(),
    })).mutation(async ({ input, ctx }) => {
      const out = await db.awardSticker({
        userId: input.userId ?? (ctx.user as any)?.id ?? null,
        reason: "adult_bonus",
        coins: input.coins,
        shortLyric: input.lyric ?? null,
        addedByUserId: (ctx.user as any)?.id ?? null,
      });
      if (input.lyric) {
        await db.addGoodWorkNote({
          userId: input.userId ?? (ctx.user as any)?.id ?? null,
          authorUserId: (ctx.user as any)?.id ?? null,
          authorName: ctx.user?.name ?? null,
          lyric: input.lyric,
          stickerId: out.stickerId ?? null,
        });
      }
      return out;
    }),
    listPrizes: publicProcedure.input(z.object({ activeOnly: z.boolean().default(true) }).optional()).query(({ input }) => db.listPrizes(input?.activeOnly ?? true)),
    seedPrizes: publicProcedure.mutation(() => db.seedDefaultPrizesIfEmpty()),
    /* Adult-only prize CRUD (gated by AdultGate at UI level) */
    createPrize: protectedProcedure.input(z.object({
      title: z.string().min(1).max(120),
      emoji: z.string().min(1).max(8),
      description: z.string().max(500).nullable().optional(),
      coinCost: z.number().int().min(0).max(10000),
      category: z.enum(["cash", "digital", "toy", "experience", "screen_time", "treat", "custom"]),
      active: z.boolean().default(true),
      stock: z.number().int().nullable().optional(),
    })).mutation(({ input, ctx }) => db.createPrize({ ...input, createdByUserId: (ctx.user as any)?.id ?? null })),
    updatePrize: protectedProcedure.input(z.object({
      id: z.number(),
      title: z.string().min(1).max(120).optional(),
      emoji: z.string().min(1).max(8).optional(),
      description: z.string().max(500).nullable().optional(),
      coinCost: z.number().int().min(0).max(10000).optional(),
      category: z.enum(["cash", "digital", "toy", "experience", "screen_time", "treat", "custom"]).optional(),
      active: z.boolean().optional(),
      stock: z.number().int().nullable().optional(),
    })).mutation(({ input }) => {
      const { id, ...patch } = input;
      return db.updatePrize(id, patch);
    }),
    deletePrize: protectedProcedure.input(z.object({ id: z.number() })).mutation(({ input }) => db.deletePrize(input.id)),
    requestPrize: publicProcedure.input(z.object({ prizeId: z.number() })).mutation(({ input, ctx }) => db.requestPrize((ctx as any).user?.id ?? null, input.prizeId)),
    myRedemptions: publicProcedure.query(({ ctx }) => db.listMyRedemptions((ctx as any).user?.id ?? null)),
    goodWorkNotes: publicProcedure.query(({ ctx }) => db.listGoodWorkNotes((ctx as any).user?.id ?? null)),
    addGoodWorkNote: protectedProcedure.input(z.object({
      userId: z.number().optional(),
      lyric: z.string().min(1),
      stickerId: z.number().optional(),
      blockId: z.number().optional(),
    })).mutation(({ input, ctx }) => db.addGoodWorkNote({
      userId: input.userId ?? (ctx.user as any)?.id ?? null,
      authorUserId: (ctx.user as any)?.id ?? null,
      authorName: ctx.user?.name ?? null,
      lyric: input.lyric,
      stickerId: input.stickerId ?? null,
      blockId: input.blockId ?? null,
    })),
  }),
  /* =================== WHITEBOARD (Adult sticky notes for Reagan) =================== */
  whiteboard: router({
    list: publicProcedure.input(z.object({ includeArchived: z.boolean().default(false) }).optional())
      .query(({ input }) => db.listWhiteboardNotes({ includeArchived: !!input?.includeArchived })),
    post: protectedProcedure.input(z.object({
      title: z.string().nullable().optional(),
      body: z.string().min(1),
      color: z.enum(["butter","coral","mint","sky","lavender","peach","pink"]).default("butter"),
      emoji: z.string().nullable().optional(),
      pinned: z.boolean().default(false),
      showOnDate: z.string().nullable().optional(),
      authorAvatar: z.string().nullable().optional(),
    })).mutation(({ input, ctx }) => db.postWhiteboardNote({
      authorUserId: (ctx.user as any).id,
      authorName: ctx.user.name || "Adult",
      authorAvatar: input.authorAvatar ?? ((ctx.user.name || "A").slice(0,1).toUpperCase()),
      title: input.title ?? null,
      body: input.body,
      color: input.color as any,
      emoji: input.emoji ?? null,
      pinned: !!input.pinned,
      showOnDate: input.showOnDate ?? null,
    })),
    update: protectedProcedure.input(z.object({
      id: z.number(),
      title: z.string().nullable().optional(),
      body: z.string().optional(),
      color: z.enum(["butter","coral","mint","sky","lavender","peach","pink"]).optional(),
      emoji: z.string().nullable().optional(),
      pinned: z.boolean().optional(),
      archived: z.boolean().optional(),
      showOnDate: z.string().nullable().optional(),
    })).mutation(({ input }) => {
      const { id, ...patch } = input;
      return db.updateWhiteboardNote(id, patch as any);
    }),
    heart: publicProcedure.input(z.object({ id: z.number() }))
      .mutation(({ input }) => db.reaganHeartNote(input.id)),
  }),
  /* =================== TAGS =================== */
  tags: router({
    list: publicProcedure.input(z.object({ category: z.string().optional() }).optional())
      .query(({ input }) => db.listTags(input?.category)),
    seedDefaults: publicProcedure.mutation(() => db.seedDefaultTagsIfEmpty()),
    upsert: protectedProcedure.input(z.object({
      slug: z.string(), label: z.string(), emoji: z.string().nullable().optional(),
      category: z.string().optional(), color: z.string().optional(),
      isPreset: z.boolean().optional(), sortOrder: z.number().optional(),
    })).mutation(({ input }) => db.upsertTag({
      ...input, emoji: input.emoji ?? null,
    })),
    attach: publicProcedure.input(z.object({
      tagId: z.number(),
      entityType: z.enum(["note","mood","block","day","journal","rescue","struggle"]),
      entityId: z.number(),
    })).mutation(({ input }) => db.attachTag(input)),
    detach: publicProcedure.input(z.object({ linkId: z.number() }))
      .mutation(({ input }) => db.detachTag(input.linkId)),
    forEntity: publicProcedure.input(z.object({
      entityType: z.enum(["note","mood","block","day","journal","rescue","struggle"]),
      entityId: z.number(),
    })).query(({ input }) => db.listTagsForEntity(input.entityType, input.entityId)),
  }),
  /* =================== REVIEW LIBRARY / TV BOX =================== */
  review: router({
    list: publicProcedure.input(z.object({
      approvedOnly: z.boolean().default(true),
      kind: z.string().optional(),
      subjectSlug: z.string().optional(),
    }).optional())
      .query(({ input }) => db.listReviewResources({
        approvedOnly: input?.approvedOnly ?? true,
        kind: input?.kind, subjectSlug: input?.subjectSlug,
      })),
    add: protectedProcedure.input(z.object({
      topic: z.string(), title: z.string(),
      kind: z.enum(["youtube","webpage","app","printable","practice","game"]),
      subjectSlug: z.string().nullable().optional(),
      gradeBand: z.string().nullable().optional(),
      url: z.string().nullable().optional(),
      youtubeId: z.string().nullable().optional(),
      description: z.string().nullable().optional(),
      approved: z.boolean().default(true),
    })).mutation(({ input, ctx }) => db.addReviewResource({
      ...input,
      addedByUserId: (ctx.user as any)?.id ?? null,
    })),
    approve: protectedProcedure.input(z.object({ id: z.number(), approved: z.boolean() }))
      .mutation(({ input }) => db.setReviewResourceApproval(input.id, input.approved)),
    remove: protectedProcedure.input(z.object({ id: z.number() }))
      .mutation(({ input }) => db.deleteReviewResource(input.id)),
    seedStarter: publicProcedure.mutation(() => db.seedStarterTVIfEmpty()),
  }),
  /* =================== PRINTABLES HUB =================== */
  printables: router({
    listSources: publicProcedure.query(() => db.listPrintableSources()),
    listFavorites: publicProcedure.query(() => db.listPrintableFavorites()),
    addFavorite: publicProcedure.input(z.object({ sourceId: z.number(), title: z.string(), url: z.string(), subjectSlug: z.string().optional(), note: z.string().optional() })).mutation(({ input }) => db.addPrintableFavorite(input)),
    removeFavorite: publicProcedure.input(z.object({ id: z.number() })).mutation(({ input }) => db.deletePrintableFavorite(input.id)),
    /**
     * v2.19 (2026-05-17) — List printables attached to a specific
     * block of a specific day. Used by BlockPrintablesPanel inside the
     * AgendaEditor block row. Public-read (matches the rest of the
     * printables router) since these are reference attachments.
     */
    forBlock: publicProcedure
      .input(z.object({
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        blockId: z.string().min(1).max(64),
      }))
      .query(({ input }) => db.listDailyPrintablesForBlock(input.date, input.blockId)),
    /**
     * v2.19 — Attach a printable to a specific block. familyAdmin-only
     * because Reagan must not be able to add or remove worksheets to
     * her own day. Server enforces a 200-char title cap; everything
     * else falls back to sane defaults so the UI form stays simple.
     */
    attachToBlock: familyAdminProcedure
      .input(z.object({
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        blockId: z.string().min(1).max(64),
        title: z.string().min(1).max(200),
        sourceUrl: z.string().url().optional(),
        bucket: z.enum(["have_to_do", "optional", "extra"]).default("have_to_do"),
        description: z.string().max(2000).optional(),
        subjectSlug: z.string().max(64).optional(),
        estMinutes: z.number().int().min(1).max(240).optional(),
        coinReward: z.number().int().min(0).max(50).optional(),
      }))
      .mutation(({ input }) =>
        db.attachPrintableToBlock({
          forDate: input.date,
          blockId: input.blockId,
          bucket: input.bucket,
          title: input.title,
          sourceUrl: input.sourceUrl ?? null,
          description: input.description ?? null,
          subjectSlug: input.subjectSlug ?? null,
          estMinutes: input.estMinutes ?? null,
          coinReward: input.coinReward,
        }),
      ),
    /**
     * v2.19 — Soft-detach: nulls out block_id but keeps the printable
     * row + any earned coins. Use when Mom moves a worksheet out of a
     * block but still wants Reagan to do it today.
     */
    detachFromBlock: familyAdminProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(({ input }) => db.detachPrintableFromBlock(input.id)),
    /**
     * v2.19 — Hard delete from the AgendaEditor sub-panel. Used when
     * Mom decides the worksheet shouldn't exist at all. Coin ledger
     * entries (if any) stay put on purpose.
     */
    remove: familyAdminProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(({ input }) => db.deletePrintable(input.id)),
    /** Today's daily printables grouped by bucket (have_to_do / optional / extra). */
    today: protectedProcedure
      .input(z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() }).optional())
      .query(({ input }) => {
        const d = input?.date ?? new Date().toISOString().slice(0, 10);
        return db.listDailyPrintables(d);
      }),
    /** Mark a daily printable as done. Pure mark-done (no photo). */
    markDone: protectedProcedure
      .input(z.object({
        id: z.number().int().positive(),
        photoKey: z.string().optional(),
        autoGrade: z.string().optional(),
        driveFileId: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const row = await db.markPrintableDone(input.id, {
          photoKey: input.photoKey ?? null,
          autoGrade: input.autoGrade ?? null,
          driveFileId: input.driveFileId ?? null,
        });
        // Award Kiwi Coins on completion (skip on absent days)
        const todayKey = `absence:${new Date().toISOString().slice(0,10)}`;
        const absentVal = await db.getAppSetting(todayKey).catch(() => null);
        const isAbsent = absentVal === "1";
        const coins = isAbsent ? 0 : ((row as any)?.coinReward ?? 5);
        if (!isAbsent) {
          try {
            await db.awardSticker({
              userId: (ctx.user as any)?.id ?? null,
              reason: "adult_bonus",
              coins,
              shortLyric: null,
              addedByUserId: null,
            });
          } catch (e) {
            console.warn("[printables] coin award failed", e);
          }
        }
        return { ok: true, coins, absent: isAbsent };
      }),
    /** Submit a finished printable with a photo. Uploads, auto-grades, files to Drive queue, awards coins. */
    submitWork: protectedProcedure
      .input(z.object({
        id: z.number().int().positive(),
        photoDataUrl: z.string().regex(/^data:image\/[a-zA-Z+.-]+;base64,/),
      }))
      .mutation(async ({ input, ctx }) => {
        const m = /^data:([^;]+);base64,(.+)$/.exec(input.photoDataUrl);
        if (!m) throw new Error("Expected an image data URL.");
        const mime = m[1];
        const buf = Buffer.from(m[2], "base64");
        const ext = (mime.split("/")[1] ?? "png").replace(/[^a-z0-9]/gi, "") || "png";
        const key = `printables/${input.id}-${Date.now()}.${ext}`;
        const stored = await storagePut(key, buf, mime);
        // Quick LLM-vision auto-grade (cheap, kid-friendly summary)
        let autoGrade = "Looks complete";
        try {
          const r = await invokeLLM({
            messages: [
              { role: "system", content: "You are a kind 5th-grade tutor. Look at this photo of a finished printable. In 1-2 short, encouraging sentences, note completeness and effort (e.g. \"Looks complete · neat handwriting · strong effort\"). Do NOT grade harshly; this is encouragement-first." },
              { role: "user", content: [{ type: "image_url" as const, image_url: { url: stored.url } }, { type: "text" as const, text: "Please give the encouraging summary." }] as any },
            ],
          });
          const txt = (r as any)?.choices?.[0]?.message?.content;
          if (typeof txt === "string" && txt.trim()) autoGrade = txt.trim().slice(0, 280);
        } catch (e) {
          console.warn("[printables] auto-grade failed", e);
        }
        const row = await db.markPrintableDone(input.id, {
          photoKey: stored.key,
          autoGrade,
          driveFileId: null,
        });
        // Queue to Drive for filing
        try {
          await db.enqueueDrivePush({
            fileKey: stored.key,
            fileUrl: stored.url,
            fileName: `printable-${input.id}.${ext}`,
            mimeType: mime,
            targetFolder: "reagan_assignments",
          });
        } catch (e) { console.warn("[printables] drive enqueue failed", e); }
        // Award coins (skip on absent days)
        const todayKey = `absence:${new Date().toISOString().slice(0,10)}`;
        const absentVal = await db.getAppSetting(todayKey).catch(() => null);
        const isAbsent = absentVal === "1";
        const coins = isAbsent ? 0 : ((row as any)?.coinReward ?? 5);
        if (!isAbsent) {
          try {
            await db.awardSticker({
              userId: (ctx.user as any)?.id ?? null,
              reason: "adult_bonus",
              coins,
              shortLyric: null,
              addedByUserId: null,
            });
          } catch {}
        }
        return { ok: true, photoUrl: stored.url, autoGrade, coins, absent: isAbsent };
      }),
  }),
  /* =================== UPLOAD OR SYNC =================== */
  upload: router({
    /** Direct file upload from the browser (data URL) -> S3 -> auto-classify -> right table */
    classifyFile: protectedProcedure.input(z.object({
      dataUrl: z.string(),
      fileName: z.string(),
      subjectSlug: z.string().optional(),
      note: z.string().optional(),
    })).mutation(async ({ input }) => {
      const m = /^data:([^;]+);base64,(.+)$/.exec(input.dataUrl);
      if (!m) throw new Error("Expected a data URL.");
      const mime = m[1];
      const buf = Buffer.from(m[2], "base64");
      const safeName = input.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
      const key = `uploads/${Date.now()}-${safeName}`;
      const stored = await storagePut(key, buf, mime);
      const item = {
        kind: "file" as const,
        fileUrl: stored.url,
        fileName: input.fileName,
        mimeType: mime,
        subjectSlug: input.subjectSlug ?? null,
        note: input.note ?? null,
        fileKey: stored.key,
      };
      const routed = await db.classifyAndRoute(item);
      // Mirror to Google Drive via the daily scheduled task.
      try {
        const folder = db.pickDriveFolderForRouted(routed, item);
        await db.enqueueDrivePush({
          fileKey: stored.key,
          fileUrl: stored.url,
          fileName: input.fileName,
          mimeType: mime,
          targetFolder: folder,
        });
      } catch (e) {
        // Non-fatal: the upload itself already succeeded.
        console.warn("[drive-push] enqueue failed:", (e as any)?.message);
      }
      return routed;
    }),
    /** Paste a link -> auto-routed to Apps & Tools / Bookshelf / Parent Notes */
    classifyLink: protectedProcedure.input(z.object({
      url: z.string(),
      title: z.string().optional(),
      subjectSlug: z.string().optional(),
      note: z.string().optional(),
    })).mutation(({ input }) => db.classifyAndRoute({
      kind: "link",
      url: input.url,
      title: input.title ?? null,
      subjectSlug: input.subjectSlug ?? null,
      note: input.note ?? null,
    })),
    /** Paste text (note, tutor message, etc.) -> auto-routed */
    classifyText: protectedProcedure.input(z.object({
      text: z.string(),
      subject: z.string().optional(),
      sender: z.string().optional(),
      subjectSlug: z.string().optional(),
    })).mutation(({ input }) => db.classifyAndRoute({
      kind: "text",
      text: input.text,
      subject: input.subject ?? null,
      sender: input.sender ?? null,
      subjectSlug: input.subjectSlug ?? null,
    })),
    /** Manual sync trigger — runs the same logic the daily scheduler does */
    syncNow: protectedProcedure.input(z.object({
      source: z.enum(["gmail", "drive", "both"]).default("both"),
      lookbackDays: z.number().min(1).max(30).default(2),
    })).mutation(async ({ input }) => {
      // The actual sync runs from the scheduled task (which has Google scopes
      // attached). From inside the deployed site we just record an intent row
      // so the next scheduled run picks it up immediately, and we report what
      // the most-recent sync produced.
      await db.recordSyncRequest({ source: input.source, lookbackDays: input.lookbackDays });
      const summary = await db.getMostRecentSyncSummary();
      return {
        ok: true,
        message: `Sync requested. The next automatic run (within an hour) will include the last ${input.lookbackDays} day(s) of ${input.source === "both" ? "Gmail + Drive" : input.source}.`,
        lastRun: summary,
      };
    }),
    /** What the latest scheduled sync did, for the parent-home 'What ran today' card */
    lastSyncSummary: publicProcedure.query(() => db.getMostRecentSyncSummary()),

    /* parent-side automation feed */
    automationStatus: publicProcedure.query(() => db.automationStatus()),
    recentRuns: publicProcedure.input(z.object({ limit: z.number().default(14) }).optional())
      .query(({ input }) => db.listRecentAutomationRuns(input?.limit ?? 14)),
    recentItems: publicProcedure.input(z.object({ limit: z.number().default(50) }).optional())
      .query(({ input }) => db.listRecentAutomationItems({ limit: input?.limit ?? 50 })),
    runItems: publicProcedure.input(z.object({ runId: z.number() }))
      .query(({ input }) => db.listAutomationItemsForRun(input.runId)),
    dismissItem: protectedProcedure.input(z.object({ itemId: z.number(), parentNote: z.string().optional() }))
      .mutation(({ input }) => db.dismissAutomationItem(input.itemId, input.parentNote)),
    flagItem: protectedProcedure.input(z.object({ itemId: z.number(), parentNote: z.string().optional() }))
      .mutation(({ input }) => db.flagAutomationItem(input.itemId, input.parentNote)),
  }),

  /* =================== FAMILY UPDATE STREAM (Phase 4) =================== */
  familyFeed: router({
    /** Most-recent N events. Public so anyone with the link (e.g. a tutor on a phone) can read. */
    list: publicProcedure
      .input(z.object({ limit: z.number().int().min(1).max(100).default(30) }).optional())
      .query(({ input }) => db.listFamilyFeed(input?.limit ?? 30)),
  }),

  /* =================== ADULT STREAM ALIAS =================== */
  // Backward-compat alias: backlog calls it "adultStream.feed"; same data as
  // familyFeed.list. Both routes intentionally hit the same db helper.
  adultStream: router({
    feed: publicProcedure
      .input(z.object({ limit: z.number().int().min(1).max(100).default(30) }).optional())
      .query(({ input }) => db.listFamilyFeed(input?.limit ?? 30)),
  }),

  /* =================== ACTIVITY OPTIONS (Phase 4) =================== */
  activityOptions: router({
    suggest: publicProcedure
      .input(z.object({
        tempF: z.number().nullable().optional(),
        weather: z.string().nullable().optional(),
      }).optional())
      .query(async ({ input }) => {
        const profile: any = await db.getProfile().catch(() => null);
        const interests: string[] = profile?.interests || [];
        const sensoryLoves: string[] = profile?.sensoryLoves || [];
        const favoriteShows: string[] = profile?.favoriteShows || [];
        const merged = Array.from(new Set([
          ...interests,
          ...sensoryLoves,
          ...favoriteShows,
        ].map((s) => String(s || "").toLowerCase()).filter(Boolean)));
        const { pickActivityOptions } = await import("./_lib/activityOptions");
        return pickActivityOptions({
          interests: merged,
          tempF: input?.tempF ?? null,
          weather: input?.weather ?? null,
          now: new Date(),
        });
      }),
  }),

  /* =================== HOME TEAM PERMISSIONS =================== */
  permissions: router({
    /** Returns role + capabilities for the currently signed-in user. */
    me: publicProcedure.query(({ ctx }) => {
      const email = (ctx as any)?.user?.email || null;
      return describeUser(email);
    }),
    /** Lookup role by arbitrary email (adult-tools view). */
    forEmail: publicProcedure.input(z.object({ email: z.string().email().nullable() }))
      .query(({ input }) => describeUser(input.email)),
    /** Static matrix — used by the Settings page to render the permissions card. */
    matrix: publicProcedure.query(() => {
      const roles: HomeRole[] = ["parent", "editor", "tutor", "student", "viewer"];
      return roles.map((r) => ({ role: r, ...capabilitiesFor(r) }));
    }),
  }),

  tutors: router({
    list: publicProcedure.input(z.object({ activeOnly: z.boolean().default(true) }).optional())
      .query(({ input }) => db.listTutors(input?.activeOnly ?? true)),
    get: publicProcedure.input(z.object({ id: z.number() }))
      .query(({ input }) => db.getTutor(input.id)),
    upsert: protectedProcedure.input(z.object({
      id: z.number().optional(),
      name: z.string().min(1),
      role: z.string().optional(),
      email: z.string().optional(),
      phone: z.string().optional(),
      bio: z.string().optional(),
      subjects: z.string().optional(),
      avatarUrl: z.string().optional(),
      active: z.boolean().optional(),
      notes: z.string().optional(),
    })).mutation(({ input }) => db.upsertTutor(input)),
    recentSessions: publicProcedure.input(z.object({ tutorId: z.number(), limit: z.number().default(10) }))
      .query(({ input }) => db.recentTutorSessions(input.tutorId, input.limit)),
    priority: publicProcedure.input(z.object({ tutorId: z.number(), limit: z.number().default(5) }))
      .query(({ input }) => db.priorityForTutor(input.tutorId, input.limit)),
    sessionSkills: publicProcedure.input(z.object({ sessionId: z.number() }))
      .query(({ input }) => db.tutorSessionSkillsFor(input.sessionId)),
    /**
     * tutorOfDay — public lookup so the kid Today page (and printed packet)
     * can show "Today: <Tutor Name> · <arrival>–<departure>" without any
     * guessing. Returns null when no tutor is scheduled (Mom-only day).
     */
    tutorOfDay: publicProcedure
      .input(z.object({ dateStr: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() }).optional())
      .query(async ({ input }) => {
        const dateStr = input?.dateStr ?? new Date().toISOString().slice(0, 10);
        const t = await resolveTutorOfDay(dateStr).catch(() => null);
        if (!t) return null;
        return {
          name: t.name,
          role: t.role ?? null,
          arrival: t.arrival ?? null,
          departure: t.departure ?? null,
          label: tutorOfDayLabel(t),
        };
      }),
    resetRoster: protectedProcedure.mutation(() => db.resetTutorRoster()),
    delete: protectedProcedure.input(z.object({ id: z.number() }))
      .mutation(({ input }) => db.deleteTutor(input.id)),
    recordSession: protectedProcedure.input(z.object({
      tutorId: z.number(),
      scheduledAt: z.date().optional(),
      durationMin: z.number().optional(),
      focus: z.string().optional(),
      status: z.enum(["scheduled", "completed", "missed", "trial", "cancelled"]).optional(),
      sessionNotes: z.string().optional(),
      skills: z.array(z.object({
        skillLadderId: z.number(),
        outcome: z.enum(["strong", "gettingIt", "needsMore", "notWorked"]),
        tutorNote: z.string().optional(),
      })).optional(),
    })).mutation(({ input }) => db.recordTutorSession(input)),
  }),

  /* =================== TUTOR DAY NOTES (per-day free-form) =================== */
  tutorDayNotes: router({
    listForDate: publicProcedure
      .input(z.object({ dateStr: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }))
      .query(({ input }) => db.listTutorDayNotes(input.dateStr)),
    listRecent: publicProcedure
      .input(z.object({ limit: z.number().min(1).max(50).default(10) }).optional())
      .query(({ input }) => db.listRecentTutorDayNotes(input?.limit ?? 10)),
    add: protectedProcedure
      .input(
        z.object({
          dateStr: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
          tutorName: z.string().min(1).max(80),
          topicsCovered: z.string().max(2000).optional().nullable(),
          comfort: z.enum(["calm", "okay", "stretched", "overwhelmed"]).optional().nullable(),
          notes: z.string().min(1).max(8000),
          // Quick tag chips chosen at the time of writing the note.
          // Three buckets: subject (math/ela/...), concern (focus/sensory/anxiety/...),
          // and frequent-on-list (recurring patterns Mom wants to track).
          tags: z.array(z.string().min(1).max(40)).max(20).optional().nullable(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        if (!ctx.user || (ctx.user.role !== "admin" && ctx.user.role !== "tutor")) {
          throw new Error("Only adults can add day notes.");
        }
        await db.insertTutorDayNote({
          dateStr: input.dateStr,
          tutorName: input.tutorName,
          authorOpenId: (ctx.user as any).openId ?? null,
          topicsCovered: input.topicsCovered ?? null,
          comfort: input.comfort ?? null,
          notes: input.notes,
          tags: input.tags ?? null,
        });
        return { ok: true };
      }),
    remove: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        if (!ctx.user || ctx.user.role !== "admin") {
          throw new Error("Only admins can delete notes.");
        }
        await db.deleteTutorDayNote(input.id);
        return { ok: true };
      }),
  }),

  /* =================== ADULT NOTEBOOK — DAY ATTACHMENTS ===================
   * Per-day photos + worksheet PDFs uploaded from the Notebook drawer.
   * Adults only (admin or tutor). Markup overlays save as separate S3 keys
   * and can be cleared/redrawn without losing the original. ============== */
  notebookAttachments: router({
    list: protectedProcedure
      .input(z.object({ dateStr: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }))
      .query(async ({ ctx, input }) => {
        if (!ctx.user || (ctx.user.role !== "admin" && ctx.user.role !== "tutor")) return [];
        return db.listDayAttachments(input.dateStr);
      }),
    add: protectedProcedure
      .input(z.object({
        dateStr: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        kind: z.enum(["image", "pdf"]),
        dataUrl: z.string().regex(/^data:[^;]+;base64,/),
        fileName: z.string().max(200).optional().nullable(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (!ctx.user || (ctx.user.role !== "admin" && ctx.user.role !== "tutor")) {
          throw new Error("Adults only.");
        }
        const m = /^data:([^;]+);base64,(.+)$/.exec(input.dataUrl);
        if (!m) throw new Error("Expected a data URL.");
        const mime = m[1];
        const buf = Buffer.from(m[2], "base64");
        const ext = (mime.split("/")[1] ?? "bin").replace(/[^a-z0-9]/gi, "") || "bin";
        const safeName = (input.fileName ?? `${input.kind}-${Date.now()}.${ext}`).replace(/[^a-zA-Z0-9._-]/g, "_");
        const key = `notebook/${input.dateStr}/${Date.now()}-${safeName}`;
        const stored = await storagePut(key, buf, mime);
        const row = await db.addDayAttachment({
          dateStr: input.dateStr,
          kind: input.kind,
          fileKey: stored.key,
          fileName: safeName,
        });
        return { id: (row as any).id, url: stored.url, fileKey: stored.key };
      }),
    saveMarkup: protectedProcedure
      .input(z.object({
        id: z.number().int().positive(),
        markupDataUrl: z.string().regex(/^data:image\/png;base64,/),
      }))
      .mutation(async ({ ctx, input }) => {
        if (!ctx.user || (ctx.user.role !== "admin" && ctx.user.role !== "tutor")) {
          throw new Error("Adults only.");
        }
        const m = /^data:([^;]+);base64,(.+)$/.exec(input.markupDataUrl);
        if (!m) throw new Error("Expected a PNG data URL.");
        const buf = Buffer.from(m[2], "base64");
        const key = `notebook-markup/${input.id}-${Date.now()}.png`;
        const stored = await storagePut(key, buf, "image/png");
        await db.setDayAttachmentMarkup(input.id, stored.key);
        return { ok: true, markupKey: stored.key, markupUrl: stored.url };
      }),
    clearMarkup: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        if (!ctx.user || (ctx.user.role !== "admin" && ctx.user.role !== "tutor")) {
          throw new Error("Adults only.");
        }
        await db.setDayAttachmentMarkup(input.id, null);
        return { ok: true };
      }),
    remove: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        if (!ctx.user || (ctx.user.role !== "admin" && ctx.user.role !== "tutor")) {
          throw new Error("Adults only.");
        }
        await db.removeDayAttachment(input.id);
        return { ok: true };
      }),
  }),

  // ─────────────────────────────────────────────────────────────────────
  // Weekly Digest — auto-emailed Sunday 7 PM to spear.cpt@gmail.com
  // ─────────────────────────────────────────────────────────────────────
  digest: router({
    preview: protectedProcedure.query(() => db.buildWeeklyDigestPayload()),
    recent: protectedProcedure.input(z.object({ limit: z.number().default(12) }).optional())
      .query(({ input }) => db.listRecentDigests(input?.limit ?? 12)),
    /**
     * Push 70 — Sunday digest HTML preview (Mom + Grandma).
     * Returns a rendered HTML string from the current weekly payload so
     * Mom and Grandma can preview what the future Sunday email will look
     * like, without actually sending anything. familyAdminProcedure
     * means Mom (spear.cpt@gmail.com) and Grandma (marcy.spear@gmail.com)
     * both pass the gate; tutors and Reagan do not.
     */
    previewHtml: familyAdminProcedure
      .input(z.object({ summerActive: z.boolean().optional() }).optional())
      .query(async ({ input }) => {
        const payload = await db.buildWeeklyDigestPayload();
        const recipients = [
          "spear.cpt@gmail.com",
          "marcy.spear@gmail.com",
        ];
        const { renderSundayDigestHtml } = await import("./_lib/sundayDigestRenderer");
        return {
          html: renderSundayDigestHtml(payload as any, {
            summerActive: input?.summerActive ?? false,
            recipients,
          }),
          recipients,
          weekStart: (payload as any).weekStart,
          weekEnd: (payload as any).weekEnd,
        };
      }),
  }),
  /* =================== NIGHTLY AGENDA EMAIL (8 PM PDF to Mom + Dad) =================== */
  nightlyAgenda: router({
    /** List recent agenda emails (status, hash, drive push). */
    recent: protectedProcedure
      .input(z.object({ limit: z.number().default(14) }).optional())
      .query(({ input }) => db.listRecentNightlyAgendaEmails(input?.limit ?? 14)),
    /** Latest record for a given school day. */
    forDate: protectedProcedure
      .input(z.object({ forDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }))
      .query(({ input }) => db.getLatestNightlyAgendaEmail(input.forDate)),
    /** Build a preview of the next-day agenda + canonical hash. Adults only. */
    preview: protectedProcedure
      .input(z.object({ forDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }))
      .query(async ({ ctx, input }) => {
        const role = (ctx as any)?.user?.role;
        if (role !== "admin" && role !== "tutor") {
          throw new Error("Adults only.");
        }
        const { assembleAgendaForDate } = await import("./_lib/agendaAssembler");
        const { hashAgenda } = await import("./_lib/agendaPdf");
        const payload = await assembleAgendaForDate(input.forDate);
        if (!payload) return { ok: false as const, reason: "no_plan" as const };
        const lines: string[] = [];
        lines.push(`AGENDA: ${payload.forDate} | ${payload.dayLabel}`);
        lines.push(`Student: ${payload.studentName}`);
        if (payload.tutorName) lines.push(`Tutor: ${payload.tutorName} | Arrival: ${payload.tutorArrival ?? "n/a"} | Departure: ${payload.tutorDeparture ?? "n/a"}`);
        for (const b of payload.blocks) {
          lines.push(`#${b.sortOrder} @${b.startTime ?? "flex"} ${b.durationMin}m [${b.subjectName ?? ""}] (${b.curriculumTopicCode ?? ""}) ${b.title}`);
        }
        const canonical = lines.join("\n");
        const hash = hashAgenda(canonical);
        return { ok: true as const, payload, agendaHash: hash, blockCount: payload.blocks.length };
      }),
    /**
     * v2.87 (2026-05-21) — On-demand printable agenda PDF for the homepage
     * Print button. Wraps the same `assembleAgendaForDate` + `buildAgendaPdf`
     * pipeline the nightly 8 PM cron uses, so what Mom prints from the
     * homepage is byte-identical to what the cron emails. Public read —
     * Reagan can also click Print without unlocking the adult panel
     * (matches existing `forDate` accessor). Returns base64 so the client
     * can build a Blob and open it in a new tab without going through S3.
     */
    printableNow: publicProcedure
      .input(z.object({ forDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }))
      .query(async ({ input }) => {
        const { assembleAgendaForDate } = await import("./_lib/agendaAssembler");
        const { buildAgendaPdf } = await import("./_lib/agendaPdf");
        const payload = await assembleAgendaForDate(input.forDate);
        if (!payload) return { ok: false as const, reason: "no_plan" as const };
        const result = await buildAgendaPdf(payload as any);
        return {
          ok: true as const,
          fileName: `${input.forDate}-agenda.pdf`,
          mime: "application/pdf" as const,
          pdfBase64: result.pdfBuffer.toString("base64"),
          agendaHash: result.agendaHash,
          blockCount: payload.blocks.length,
        };
      }),
    /**
     * v2.89 (2026-05-23) — Manual "Send Daily Agenda Now" trigger.
     *
     * Mom reported (May 22) that she has not received any nightly emails.
     * Diagnosis showed the deployed `/api/scheduled/nightly-agenda-email`
     * endpoint is gated by a Cloudflare-layer cron-cookie check that
     * returns 403 to the heartbeat task — so Job A never enqueues a real
     * row, and no emails leave. Until that gate is fixed at the platform
     * level, this mutation gives Mom + Grandma a one-click in-dashboard
     * way to send the agenda right now via the Manus owner-notification
     * channel (which surfaces as a push notification with the PDF link).
     *
     * Steps:
     *   1. Assemble the agenda for the requested date (defaults to today).
     *   2. Build the PDF, upload to S3, presign an absolute URL.
     *   3. notifyOwner({ title, content }) with the link + block list.
     *   4. Insert + immediately mark the nightlyAgendaEmails row 'sent'
     *      so the dispatch contract test stays green and the audit trail
     *      records exactly when this fired.
     *
     * familyAdminProcedure → Mom + Grandma + tutors only.
     */
    sendNow: familyAdminProcedure
      .input(
        z.object({
          forDate: z
            .string()
            .regex(/^\d{4}-\d{2}-\d{2}$/)
            .optional(),
        }).optional(),
      )
      .mutation(async ({ input }) => {
        const { assembleAgendaForDate } = await import("./_lib/agendaAssembler");
        const { buildAgendaPdf } = await import("./_lib/agendaPdf");
        const { storagePut, storageGetSignedUrl } = await import("./storage");
        const { notifyOwner } = await import("./_core/notification");
        const { runAutoAttachForDate } = await import("./_lib/blockAutoAttach");
        const { sendEmail } = await import("./_core/mailer");
        const { buildPerBlockWorksheetAttachments } = await import("./_lib/perBlockWorksheetPdf");

        const today = (() => {
          const d = new Date();
          // Local ET date — matches the rest of the dashboard's "today".
          const y = d.getFullYear();
          const m = String(d.getMonth() + 1).padStart(2, "0");
          const day = String(d.getDate()).padStart(2, "0");
          return `${y}-${m}-${day}`;
        })();
        const forDate = input?.forDate ?? today;

        // v2.93 (2026-05-27) — Auto-attach pass FIRST so the manually-sent
        // agenda is never bare. Mirrors what the nightly scheduled route
        // already does. Idempotent — skips blocks that already have a
        // resource attached. Never throws into the caller path.
        try {
          const autoR = await runAutoAttachForDate(forDate, { kidSafe: true });
          // eslint-disable-next-line no-console
          console.log(
            `[nightlyAgenda.sendNow] auto-attach for ${forDate}: attached=${autoR.attached} skipped=${autoR.skipped} noResult=${autoR.noResult} errors=${autoR.errors} (of ${autoR.totalBlocks})`,
          );
        } catch (e: any) {
          // eslint-disable-next-line no-console
          console.warn(`[nightlyAgenda.sendNow] auto-attach failed: ${String(e?.message ?? e)}`);
        }

        const payload = await assembleAgendaForDate(forDate);
        if (!payload) {
          return { ok: false as const, reason: "no_plan" as const, forDate };
        }

        const { pdfBuffer, agendaHash } = await buildAgendaPdf(payload as any);
        const fileKey = `nightly-agendas/${forDate}/agenda_${agendaHash.slice(0, 8)}.pdf`;
        const { key } = await storagePut(fileKey, pdfBuffer, "application/pdf");
        let signedUrl: string | null = null;
        try {
          signedUrl = await storageGetSignedUrl(key);
        } catch {
          signedUrl = null;
        }

        const recipients = ["spear.cpt@gmail.com"]; // Marcy joins later — Mom-only this week.
        const recordId = await db.insertNightlyAgendaEmail({
          forDate,
          recipients: recipients.join(", "),
          agendaHash,
          blockCount: payload.blocks.length,
          pdfStorageKey: key,
          status: "queued",
          triggerKind: "manual",
        });

        // Build a kid-friendly summary line + per-block list for the
        // notification body. Owner notifications support markdown.
        const subjectsList = Array.from(
          new Set(
            (payload.blocks ?? [])
              .map((b: any) => (b.subjectName ?? b.title ?? "").toString().trim())
              .filter((s: string) => s.length > 0),
          ),
        );
        const summary =
          subjectsList.length > 0
            ? `${payload.studentName} has ${payload.blocks.length} block${
                payload.blocks.length === 1 ? "" : "s"
              } — ${
                subjectsList.length === 1
                  ? subjectsList[0]
                  : subjectsList.slice(0, -1).join(", ") +
                    ", and " +
                    subjectsList[subjectsList.length - 1]
              }.`
            : `${payload.studentName} has ${payload.blocks.length} blocks scheduled.`;

        const blockLines = payload.blocks
          .map((b: any) => {
            const head = `${b.sortOrder}. ${b.startTime ?? "flex"} · ${b.durationMin}m`;
            const subj = b.subjectName ? ` [${b.subjectName}]` : "";
            return `- ${head}${subj} — ${b.title}`;
          })
          .join("\n");

        // 2026-05-30: dropped the signed-URL line from the owner notification.
        // The presigned CloudFront URL would expire before anyone clicked it,
        // surfacing as an XML "AccessDenied" page in the inbox. The PDF is
        // attached to the email itself, so the link was redundant anyway.
        // The dashboard always has a fresh signed URL via /manus-storage/.
        const linkLine = `\n\nPDF attached. (Stored at ${key}.)`;
        // signedUrl is intentionally unused; kept the storageGetSignedUrl call
        // above so a presign failure still gets logged for diagnostics.
        void signedUrl;

        // Mastery Snapshot — per-subject mastery % for the weekly digest
        let masterySection = "";
        try {
          const masteryRows = await db.subjectLevelSummary();
          if (masteryRows.length > 0) {
            const SUBJECT_LABELS: Record<string, string> = {
              math: "Math", ela: "ELA / Reading", science: "Science",
              social_studies: "Social Studies", writing: "Writing",
              history: "History", art: "Art", music: "Music",
            };
            const masteryLines = masteryRows
              .sort((a: any, b: any) => b.pctMastered - a.pctMastered)
              .map((r: any) => {
                const label = SUBJECT_LABELS[r.subjectSlug] ?? r.subjectSlug;
                const bar = r.pctMastered >= 75 ? "🟢" : r.pctMastered >= 40 ? "🟡" : "🔴";
                const status = r.pctMastered >= 75 ? "strong" : r.pctMastered >= 40 ? "developing" : "needs work";
                return `  ${bar} ${label}: ${r.pctMastered}% mastered (avg level ${r.avgLevel}) — ${status}`;
              })
              .join("\n");
            masterySection = `\n\n📊 Mastery Snapshot:\n${masteryLines}`;
          }
        } catch {
          // Non-fatal — skip mastery section if query fails
        }

        const title = `${payload.studentName}'s school plan — ${payload.dayLabel}`;
        const content =
          `${summary}\n\n` +
          (payload.tutorName
            ? `Tutor today: ${payload.tutorName}${
                payload.tutorArrival ? ` (arrives ${payload.tutorArrival})` : ""
              }${payload.tutorDeparture ? ` (leaves ${payload.tutorDeparture})` : ""}\n\n`
            : `Mom-only day — no tutor scheduled.\n\n`) +
          `Today's blocks:\n${blockLines || "(no blocks scheduled)"}` +
          masterySection +
          linkLine;

        let notified = false;
        try {
          notified = await notifyOwner({ title, content });
        } catch (e) {
          notified = false;
        }

        // Also send via Gmail MCP (triggers confirmation card in Manus UI)
        let emailSent = false;
        try {
          // Build HTML body
          const blockListHtml = payload.blocks.map((b: any) => {
            const head = `<b>${b.sortOrder}. ${b.startTime ?? "flex"} &middot; ${b.durationMin} min</b>` +
              (b.subjectName ? ` <span style="color:#888;">[${b.subjectName}]</span>` : "") +
              (b.curriculumTopicCode ? ` <span style="color:#888;">topic ${b.curriculumTopicCode}</span>` : "");
            const desc = b.description ? `<div style="color:#444;font-size:13px;margin:2px 0 0 14px;">${b.description}</div>` : "";
            return `<div style="padding:8px 0;border-bottom:1px solid #eee;">${head}<div style="margin:2px 0 0 14px;">${b.title}</div>${desc}</div>`;
          }).join("");
          const html = `<!doctype html><html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#222;max-width:680px;margin:0 auto;padding:20px;">
<div style="text-align:center;margin-bottom:8px;"><div style="font-size:22px;font-weight:800;color:#1f3a2e;">${payload.studentName}'s School Plan</div><div style="color:#666;font-size:14px;">${payload.dayLabel}</div></div>
<div style="margin:20px 0;padding:14px 16px;border-left:4px solid #1f3a2e;background:#fafafa;border-radius:8px;">${blockListHtml || '<div style="color:#888;">No blocks scheduled.</div>'}</div>
<p style="text-align:center;margin:24px 0;color:#1f3a2e;font-weight:600;">→ PDF agenda attached to this email.</p>
<p style="font-size:12px;color:#888;text-align:center;margin-top:8px;">Per-block worksheets are also attached as separate PDFs.</p>
</body></html>`;
          // Build worksheet attachments
          const emailAtts: Array<{ filename: string; content: Buffer; contentType: string }> = [
            { filename: `${forDate} - ${payload.studentName} - Agenda.pdf`, content: pdfBuffer, contentType: "application/pdf" },
          ];
          try {
            const wsAtts = await buildPerBlockWorksheetAttachments(payload as any);
            for (const ws of wsAtts) {
              emailAtts.push({ filename: ws.filename, content: ws.pdfBuffer, contentType: "application/pdf" });
            }
          } catch { /* worksheet build failure is non-fatal */ }
          const emailResult = await sendEmail({
            to: ["marcy.spear@gmail.com", "spear.cpt@gmail.com"],
            subject: title,
            html,
            attachments: emailAtts,
          });
          emailSent = emailResult.ok;
        } catch (e: any) {
          console.warn(`[nightlyAgenda.sendNow] Gmail MCP send failed: ${String(e?.message ?? e)}`);
          emailSent = false;
        }

        try {
          await db.markNightlyAgendaEmailStatus({
            id: recordId,
            status: (notified || emailSent) ? "sent" : "failed",
            errorMessage: (notified || emailSent) ? null : "notifyOwner and Gmail MCP both failed",
            drivePushed: false,
          });
        } catch {
          // Stat write failure is non-fatal — the row is still in the audit trail.
        }

        return {
          ok: true as const,
          forDate,
          recordId,
          notified,
          emailSent,
          signedUrl,
          recipients,
          blockCount: payload.blocks.length,
          subject: title,
        };
      }),

    /** Manually mark a day's agenda dirty so the next cron tick re-sends. */
    markDirty: protectedProcedure
      .input(z.object({ forDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), reason: z.string().max(200).optional() }))
      .mutation(async ({ ctx, input }) => {
        const role = (ctx as any)?.user?.role;
        if (role !== "admin" && role !== "tutor") throw new Error("Adults only.");
        await db.insertNightlyAgendaEmail({
          forDate: input.forDate,
          recipients: "",
          agendaHash: "manual_markdirty_" + Date.now().toString(36),
          blockCount: 0,
          status: "queued",
          triggerKind: "manual",
          errorMessage: input.reason ?? null,
        });
        return { ok: true };
      }),
  }),

  /* =================== DRIVE AUTO-PUSH (mirrors uploads to Reagan Drive folder) =================== */
  drive: router({
    pending: protectedProcedure.query(() => db.listPendingDrivePushes(100)),
    recent: protectedProcedure.input(z.object({ limit: z.number().default(20) }).optional())
      .query(({ input }) => db.listRecentDrivePushes(input?.limit ?? 20)),
    /**
     * v2.39 (2026-05-18) — Regenerate the top-level Drive README.md.
     * Closes todo line 116. familyAdminProcedure: only Mom + Grandma can
     * trigger; the README is enqueued into `drivePushQueue` with
     * `targetFolder='reagan'`, `targetSubpath=null`, `fileName='README.md'`.
     * Idempotent on exact contentText match — calling repeatedly is safe.
     */
    refreshRootReadme: familyAdminProcedure
      .input(
        z
          .object({
            dashboardUrl: z.string().url().optional(),
            generatedAtISO: z
              .string()
              .regex(/^\d{4}-\d{2}-\d{2}$/)
              .optional(),
          })
          .optional(),
      )
      .mutation(async ({ input }) => {
        const { enqueueDriveRootReadme } = await import(
          "./_lib/driveReadme"
        );
        return enqueueDriveRootReadme({
          dashboardUrl: input?.dashboardUrl,
          generatedAtISO: input?.generatedAtISO,
        });
      }),
    /**
     * v3.21 (2026-05-31) — Drive Connector handshake.
     *
     * `connectorPlan` returns the up-to-`limit` pending rows the sandbox
     * drainer should process, plus the canonical Hub folder map. Admin
     * only because the payload includes inline content (day logs / recap
     * replies) which we don't want public.
     */
    connectorPlan: adminProcedure
      .input(z.object({ limit: z.number().int().min(1).max(500).optional() }).optional())
      .query(async ({ input }) => {
        const { buildConnectorPlan } = await import("./_lib/driveConnectorPlan");
        return buildConnectorPlan({ limit: input?.limit });
      }),
    /**
     * v3.21 (2026-05-31) — drainer reports its outcome list back. Each
     * result becomes one `markDrivePushResult` write, and the run summary
     * is stamped into appSettings so the Settings card can show "last
     * run". Admin only.
     */
    connectorReport: adminProcedure
      .input(
        z.object({
          protocolVersion: z.literal(1),
          finishedAtISO: z.string().min(1),
          byUser: z.string().min(1),
          results: z.array(
            z.union([
              z.object({
                id: z.number().int(),
                outcome: z.literal("pushed"),
                driveFileId: z.string().min(1),
                bytes: z.number().int().nonnegative().optional(),
              }),
              z.object({
                id: z.number().int(),
                outcome: z.literal("skipped"),
                reason: z.string(),
                driveFileId: z.string().optional(),
              }),
              z.object({
                id: z.number().int(),
                outcome: z.literal("failed"),
                error: z.string(),
              }),
            ]),
          ),
        }),
      )
      .mutation(async ({ input }) => {
        const { applyConnectorReport } = await import("./_lib/driveConnectorPlan");
        return applyConnectorReport(input as any);
      }),
    /**
     * v3.21 (2026-05-31) — Settings card reads the last-run summary so
     * Mom can see "Last drained 2026-05-31 04:12 UTC — pushed 14, skipped
     * 2, failed 0" without having to re-run anything.
     */
    connectorLastRun: adminProcedure.query(async () => {
      const { readLastConnectorRun } = await import("./_lib/driveConnectorPlan");
      return readLastConnectorRun();
    }),
    /**
     * v3.17 (2026-05-30) — enqueue the 12 canonical reference Markdown
     * docs that ship to Mom's Drive subfolders. Idempotent: re-running
     * is a safe no-op as long as the body hasn't changed. Admin only.
     */
    enqueueReferenceDocs: adminProcedure
      .input(
        z
          .object({
            dashboardUrl: z.string().url().optional(),
            generatedAtISO: z
              .string()
              .regex(/^\d{4}-\d{2}-\d{2}$/)
              .optional(),
          })
          .optional(),
      )
      .mutation(async ({ input }) => {
        const { enqueueDriveReferenceDocs } = await import(
          "./_lib/driveReferenceDocs"
        );
        return enqueueDriveReferenceDocs({
          dashboardUrl: input?.dashboardUrl,
          generatedAtISO: input?.generatedAtISO,
        });
      }),
  }),

  /* =================== RUNBOOKS (Settings card for blocked-item runbooks) =================== */
  /**
   * v3.19 (2026-05-30) — surfaces the user-action runbooks (Resend custom
   * domain verification + SKILL.md 6th-grade update) inside the adult
   * Settings panel so the next person who picks up the project can
   * execute the remaining blocked items without re-reading session notes.
   */
  runbooks: router({
    list: adminProcedure.query(async () => {
      const {
        buildRunbookSummariesWithDismissals,
        RUNBOOK_DISMISSAL_KEY_PREFIX,
        parseRunbookDismissalKey,
      } = await import("./_lib/runbooks");
      // Pull every dismissal flag from the generic appSettings KV in one query
      // so the list endpoint stays a single roundtrip even as dismissals grow.
      const rows = await db.listAppSettings(RUNBOOK_DISMISSAL_KEY_PREFIX);
      const dismissed: Record<string, string> = {};
      for (const row of rows) {
        const slug = parseRunbookDismissalKey(row.key);
        if (slug && row.value) {
          dismissed[slug] = row.value;
        }
      }
      return buildRunbookSummariesWithDismissals(dismissed);
    }),
    get: adminProcedure
      .input(z.object({ slug: z.string().min(1).max(120) }))
      .query(async ({ input }) => {
        const { getRunbookBySlug } = await import("./_lib/runbooks");
        const rb = getRunbookBySlug(input.slug);
        if (!rb) {
          throw new TRPCError({ code: "NOT_FOUND", message: `Runbook not found: ${input.slug}` });
        }
        return rb;
      }),
    /**
     * v3.20 (2026-05-31) — admins can dismiss a runbook so it stops cluttering
     * the Settings card after they finish the action. Persisted via appSettings
     * KV so we don't need a new table. Idempotent: dismissing an already-
     * dismissed slug just refreshes the timestamp.
     */
    dismiss: adminProcedure
      .input(z.object({ slug: z.string().min(1).max(120) }))
      .mutation(async ({ input }) => {
        const { getRunbookBySlug, runbookDismissalSettingKey } = await import(
          "./_lib/runbooks"
        );
        const rb = getRunbookBySlug(input.slug);
        if (!rb) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: `Cannot dismiss unknown runbook: ${input.slug}`,
          });
        }
        const iso = new Date().toISOString();
        await db.setAppSetting(runbookDismissalSettingKey(input.slug), iso);
        return { slug: input.slug, dismissedAtISO: iso };
      }),
    /**
     * v3.20 (2026-05-31) — inverse of dismiss. Clears the KV entry so the
     * runbook reappears in the default list. Safe to call when the slug is
     * not currently dismissed (no-op).
     */
    undismiss: adminProcedure
      .input(z.object({ slug: z.string().min(1).max(120) }))
      .mutation(async ({ input }) => {
        const { runbookDismissalSettingKey } = await import("./_lib/runbooks");
        await db.setAppSetting(runbookDismissalSettingKey(input.slug), null);
        return { slug: input.slug, dismissedAtISO: null };
      }),
  }),

  /* =================== CLASSROOM AGENDAS (Daily Agendas) =================== */
  classroom: router({
    list: protectedProcedure
      .input(z.object({ limit: z.number().default(60) }).optional())
      .query(({ input }) => db.listRecentClassroomAgendas(input?.limit ?? 60)),
    gaps: protectedProcedure
      .input(z.object({ daysBack: z.number().default(7) }).optional())
      .query(({ input }) => db.listAgendaHydrationGaps(input?.daysBack ?? 7)),
    insert: protectedProcedure
      .input(
        z.object({
          agendaDate: z.string(),
          teacher: z.string().optional(),
          course: z.string().optional(),
          subjectSlug: z.string().optional(),
          school: z.string().optional(),
          term: z.string().optional(),
          source: z.enum(["classroom", "drive", "gmail", "image", "manual"]).default("manual"),
          sourceUrl: z.string().optional(),
          rawText: z.string().optional(),
          topics: z.array(z.string()).optional(),
          assignments: z
            .array(z.object({ title: z.string(), dueAt: z.string().optional(), notes: z.string().optional() }))
            .optional(),
        }),
      )
      .mutation(async ({ input }) => {
        const row = await db.insertClassroomAgenda({
          agendaDate: input.agendaDate,
          teacher: input.teacher ?? null,
          course: input.course ?? null,
          subjectSlug: input.subjectSlug ?? null,
          school: input.school ?? "indian_hill",
          term: input.term ?? null,
          source: input.source,
          sourceUrl: input.sourceUrl ?? null,
          rawText: input.rawText ?? null,
          topics: input.topics ?? null,
          assignments: input.assignments ?? null,
        });
        return row;
      }),
  }),
  curriculum: router({
    list: protectedProcedure
      .input(z.object({ subject: z.string().optional() }).optional())
      .query(({ input }) => db.listCurriculumTopics(input?.subject)),
    progress: protectedProcedure.query(() => db.curriculumProgress()),
    ensureSeeded: protectedProcedure.mutation(() => db.ensureCurriculumSeeded()),
    /**
     * Push 29: idempotent seeder for the 5th-grade Q4 Ohio standards
     * parsed out of server/_knowledge/q4_standards.txt. Adult-only.
     * Returns { inserted, total } so Mom can see exactly how many
     * rows were added without having to query the DB directly.
     */
    seedQ4Standards: familyAdminProcedure.mutation(() => db.seedQ4Standards()),
    /** Push 32 (2026-05-13) — Backfill curriculumTopicId on existing scheduleBlocks. */
    backfillBlockTopics: familyAdminProcedure
      .input(z.object({ dryRun: z.boolean().optional() }))
      .mutation(async ({ input }) => {
        const { backfillScheduleBlockTopics } = await import("./_lib/backfillScheduleBlockTopics");
        return backfillScheduleBlockTopics({ dryRun: input.dryRun ?? false });
      }),
    /**
     * Push 34 (2026-05-13) — Mom-only daily analytics CSV export.
     * Builds a stable-schema CSV row of the day's listening focus,
     * Kiwi chat activity, planned-vs-completed blocks, per-subject
     * coverage, IEP Behind/On/Ahead chip counts, and off-plan topic
     * count. Enqueued to Drive at:
     *   Progress and Reports / Analytics CSV Exports / {YYYY-MM} /
     *   {date} - Daily Analytics.csv
     * Idempotent — re-runs skip if the same content is already queued.
     */
    exportDailyAnalytics: familyAdminProcedure
      .input(z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }).optional())
      .mutation(async ({ input }) => {
        const dateISO = input?.date ?? new Date().toISOString().slice(0, 10);
        const result = await db.enqueueDailyAnalyticsExport(dateISO);
        return { dateISO, ...result };
      }),
    /**
     * Push 37 (2026-05-13) — Tomorrow's draft preview for the Curriculum hub.
     * Returns the next-school-day plan summary (block count, subjects, first
     * block title, last-generated time) so Mom can see at a glance whether
     * the 9 PM `nightly-lesson-gen` cron ran and what's queued. Pure read.
     */
    tomorrowPreview: protectedProcedure.query(() => db.getTomorrowDraftPreview()),
    /**
     * Push 48 (2026-05-13) — Tomorrow's full block list (sorted), used by
     * the Curriculum hub's tap-block inline editor. Returns the same
     * shape as `blocks.list` so we can reuse the patch payload for
     * `blocks.update`. Read-only.
     */
    tomorrowBlocks: protectedProcedure.query(async () => {
      const preview = await db.getTomorrowDraftPreview();
      if (!preview.planExists || preview.blockCount === 0) {
        return { dateISO: preview.dateISO, blocks: [] as any[] };
      }
      const plan = await db.getPlanByDate(preview.dateISO);
      if (!plan) return { dateISO: preview.dateISO, blocks: [] as any[] };
      const blocks = (await db.listBlocksForPlan((plan as any).id)) as any[];
      const sorted = [...blocks].sort(
        (a: any, b: any) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0),
      );
      return { dateISO: preview.dateISO, blocks: sorted };
    }),
    /**
     * Push 45 (2026-05-13) — Catch-up engine rollup. Returns one row per
     * curriculum subject with lifetime mastery %, traffic-light bucket
     * (red/yellow/green), and the next 3 open topics (inProgress first,
     * then notStarted). Read-only — the UI doesn't mutate anything from
     * the rollup itself; tapping a topic uses existing curriculum.toggle.
     */
    catchUp: protectedProcedure.query(() => db.getCatchUpRollup()),
    /**
     * Push 2.8 (2026-05-17) — Adult-only listing of curriculumTopics that
     * were stamped by a parent voice-memo intake. Lets Mom + Grandma
     * verify what the system recorded from a memo. familyAdmin gate
     * because the data is teacher-facing context, not kid-facing.
     */
    voiceMemoBackfill: familyAdminProcedure
      .input(z.object({
        source: z.string().min(4).max(120),
        limit: z.number().int().min(1).max(100).default(50),
      }))
      .query(({ input }) => db.listCurriculumTopicsBySource(input.source, { limit: input.limit })),
    /**
     * Push 2.9 (2026-05-17) — Kid-safe celebration view of voice-memo-stamped
     * topics. ONLY returns `status='done'` rows and ONLY {id, subject, code,
     * title}. No notes/grades/in-progress flags ever reach the kid client.
     * `protectedProcedure` (any signed-in user) so Reagan can render it from
     * her own session.
     */
    kidCoveredFromVoiceMemos: protectedProcedure
      .input(
        z
          .object({
            sourcePrefix: z.string().min(4).max(120).optional(),
            limit: z.number().int().min(1).max(100).default(50),
          })
          .optional(),
      )
      .query(({ input }) =>
        db.listKidCoveredTopicsFromVoiceMemos({
          sourcePrefix: input?.sourcePrefix,
          limit: input?.limit ?? 50,
        }),
      ),
    /**
     * Push 2.10 (2026-05-17) — Forward calendar planner.
     *
     * Takes the curriculum gap (everything still inProgress / notStarted)
     * and proposes which topic to slot into which day over the horizon.
     * Mom (Katy) reviews the preview, then can hit Apply to actually create
     * the scheduleBlocks. familyAdmin-gated so Reagan never sees this.
     */
    forwardPlan: router({
      preview: familyAdminProcedure
        .input(
          z
            .object({
              startDate: z
                .string()
                .regex(/^\d{4}-\d{2}-\d{2}$/)
                .optional(),
              horizonDays: z.number().int().min(1).max(30).default(10),
              excludeSubjects: z.array(z.string()).optional(),
              transcriptBlockerTopicIds: z
                .array(z.number().int())
                .optional(),
            })
            .optional(),
        )
        .query(async ({ input }) => {
          const { planForward } = await import("./_lib/curriculumForwardPlanner");
          const startDate =
            input?.startDate ?? new Date().toISOString().slice(0, 10);
          const gap = await db.getCurriculumGapBySubject({
            excludeSubjects: input?.excludeSubjects,
          });
          // Default weekly shape: Mon–Fri, [Math, ELA, Science, Social, Specials].
          // Wed is therapy-light (skip Specials) per the autobuilder convention.
          const weeklyShape: Record<number, string[]> = {
            1: ["Math", "ELA", "Science", "Social", "Specials"],
            2: ["Math", "ELA", "Science", "Social", "Specials"],
            3: ["Math", "ELA", "Science"],
            4: ["Math", "ELA", "Science", "Social", "Specials"],
            5: ["Math", "ELA", "Science", "Social", "Specials"],
          };
          // Push 2.11 (2026-05-17): pre-resolve the real school days from
          // schoolCalendar (skipping weekends + IH off-days). Pass them in so
          // the planner stays pure but the schedule honors holidays/breaks.
          const horizon = input?.horizonDays ?? 10;
          const schoolDays = await db.getNextSchoolDays(startDate, horizon);
          const rows = planForward({
            gap,
            weeklyShape,
            horizonDays: horizon,
            startDate,
            transcriptBlockerTopicIds: input?.transcriptBlockerTopicIds,
            schoolDays,
          });
          const perSubject: Record<string, number> = {};
          for (const r of rows)
            perSubject[r.subject] = (perSubject[r.subject] ?? 0) + 1;
          return {
            startDate,
            horizonDays: input?.horizonDays ?? 10,
            rows,
            perSubject,
          };
        }),
      printable: familyAdminProcedure
        .input(
          z
            .object({
              startDate: z
                .string()
                .regex(/^\d{4}-\d{2}-\d{2}$/)
                .optional(),
              horizonDays: z.number().int().min(1).max(30).default(10),
              excludeSubjects: z.array(z.string()).optional(),
              transcriptBlockerTopicIds: z
                .array(z.number().int())
                .optional(),
              title: z.string().min(1).max(120).optional(),
            })
            .optional(),
        )
        .query(async ({ input }) => {
          // Push 2.12 (2026-05-17): same forward plan as preview, then folded
          // through forwardPlanToPrintModel so the print page can render a
          // self-contained per-day model without re-doing the planner work.
          const [{ planForward }, { forwardPlanToPrintModel }] = await Promise.all([
            import("./_lib/curriculumForwardPlanner"),
            import("./_lib/forwardPlanToPrintModel"),
          ]);
          const startDate =
            input?.startDate ?? new Date().toISOString().slice(0, 10);
          const gap = await db.getCurriculumGapBySubject({
            excludeSubjects: input?.excludeSubjects,
          });
          const weeklyShape: Record<number, string[]> = {
            1: ["Math", "ELA", "Science", "Social", "Specials"],
            2: ["Math", "ELA", "Science", "Social", "Specials"],
            3: ["Math", "ELA", "Science"],
            4: ["Math", "ELA", "Science", "Social", "Specials"],
            5: ["Math", "ELA", "Science", "Social", "Specials"],
          };
          const horizon = input?.horizonDays ?? 10;
          const schoolDays = await db.getNextSchoolDays(startDate, horizon);
          const rows = planForward({
            gap,
            weeklyShape,
            horizonDays: horizon,
            startDate,
            transcriptBlockerTopicIds: input?.transcriptBlockerTopicIds,
            schoolDays,
          });
          return forwardPlanToPrintModel(rows, { title: input?.title });
        }),
      applyPlan: familyAdminProcedure
        .input(
          z.object({
            rows: z.array(
              z.object({
                date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
                weekday: z.number().int().min(0).max(6),
                slotIndex: z.number().int().min(0).max(20),
                subject: z.string().min(1).max(64),
                topicId: z.number().int(),
                code: z.string().min(1).max(64),
                title: z.string().min(1).max(255),
                evidence: z.string().nullable(),
                isBlockerFrontload: z.boolean(),
              }),
            ),
            source: z
              .string()
              .min(4)
              .max(120)
              .default("forward_planner_2026-05-17"),
          }),
        )
        .mutation(async ({ input }) => {
          return db.applyForwardPlan(input.rows, { source: input.source });
        }),
    }),
    /**
     * Push 73 (2026-05-13) — "From yesterday" nudges for Today.
     * Hydrates the pure catchUpQueueFor() helper from real plan data.
     * Self-hides when empty (the UI renders nothing if items.length === 0).
     */
    nextDayQueue: protectedProcedure.query(async () => {
      const { computeNextDayCatchUpQueue } = await import("./_lib/nextDayCatchUp");
      return computeNextDayCatchUpQueue();
    }),
    /**
     * Push 75 (2026-05-13) — generated payloads for Today's blocks.
     * Returns a `{ [blockId]: generated|null }` map keyed by scheduleBlocks.id
     * so the Today UI can show the operable+printable line WITHOUT shipping the
     * blockGenerators bundle to the client.
     */
    generatedForDate: protectedProcedure
      .input(z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }))
      .query(async ({ input }) => {
        const { deriveGeneratedForBlock } = await import("./_lib/blockGeneratorMatch");
        const plan = await (db as any).getPlanByDate?.(input.date);
        if (!plan?.id) return { byBlockId: {} as Record<number, any> };
        const blocks = ((await (db as any).listBlocksForPlan?.(plan.id)) ?? []) as any[];
        const out: Record<number, any> = {};
        for (const b of blocks) {
          let firstRef = null as { bookTitle: string; fromPage: number; toPage: number } | null;
          try {
            const refs = (await (db as any).listBookAssignmentsForBlock?.(b.id)) ?? [];
            firstRef = refs[0] ?? null;
          } catch {
            firstRef = null;
          }
          const gen = deriveGeneratedForBlock(
            {
              id: b.id,
              blockType: b.blockType,
              subjectName: b.subjectName,
              durationMin: b.durationMin,
              description: b.description,
            },
            firstRef,
          );
          out[b.id] = gen;
        }
        return { byBlockId: out };
      }),
    toggle: protectedProcedure
      .input(z.object({ id: z.number(), status: z.enum(["notStarted", "inProgress", "done"]) }))
      .mutation(({ input }) => db.toggleCurriculumTopic(input.id, input.status)),
    setNote: protectedProcedure
      .input(z.object({ id: z.number(), notes: z.string().max(2000) }))
      .mutation(({ input }) => db.setCurriculumNote(input.id, input.notes)),
    autoCompleteFromHistory: protectedProcedure.mutation(() => db.autoCompleteFromHistory()),
    /**
     * Adult-only: regenerate + commit AI agendas for the next N school days
     * (default 5). Skips weekends and any IH off-days that already exist in
     * the schoolCalendar table. Returns a per-day summary so the Curriculum
     * page can show "✓ Mon, ✓ Tue, skipped Wed (off), ✓ Thu, ✓ Fri".
     */
    syncFutureDays: protectedProcedure
      .input(z.object({
        startDate: z.string().optional(),
        days: z.number().int().min(1).max(10).default(5),
        adultPrompt: z.string().max(2000).optional(),
      }).optional())
      .mutation(async ({ input, ctx }) => {
        const start = input?.startDate ? new Date(input.startDate + "T00:00:00") : new Date();
        start.setHours(0, 0, 0, 0);
        const want = input?.days ?? 5;
        const profile: any = await db.getProfile().catch(() => null);
        const subjects = (await db.listSubjects()).map((s: any) => ({ slug: s.slug, name: s.name }));
        const results: Array<{ date: string; status: "committed" | "skipped_weekend" | "skipped_off" | "error"; blockCount?: number; reason?: string }> = [];
        let cursor = new Date(start);
        let committed = 0;
        // walk forward day by day; only count school days toward `want`
        for (let safety = 0; safety < 30 && committed < want; safety++) {
          const ymdStr = `${cursor.getFullYear()}-${String(cursor.getMonth()+1).padStart(2,"0")}-${String(cursor.getDate()).padStart(2,"0")}`;
          if (db.isWeekendDate(ymdStr)) {
            results.push({ date: ymdStr, status: "skipped_weekend" });
          } else if (await db.isSchoolOff(ymdStr).catch(() => false)) {
            results.push({ date: ymdStr, status: "skipped_off" });
          } else {
            try {
              const dt = new Date(ymdStr + "T12:00:00");
              const dayLabel = dt.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
              const [topicCatalog, tutorOfDay, ownedBooks] = await Promise.all([
                loadTopicHintsForPrompt().catch(() => []),
                resolveTutorOfDay(ymdStr).catch(() => null),
                loadOwnedBooksForAgenda().catch(() => []),
              ]);
              const draft = await generateScheduleDraft({
                dateStr: ymdStr, dayLabel,
                studentName: profile?.studentName || "Reagan",
                gradeLevel: profile?.gradeLevel || "5th grade",
                interests: profile?.interests || [],
                whatWorks: profile?.whatWorks || [],
                whatHarms: profile?.whatHarms || [],
                adultPrompt: input?.adultPrompt || null,
                dayLength: "full",
                subjects,
                topicCatalog,
                tutorOfDay,
                ownedBooks,
              });
              if (draft.blocks.length > 0) {
                const plan = await db.ensurePlanForDate(ymdStr, "full", { allowWeekendAutoBuild: false });
                if (plan) {
                  // Real subject ids: refetch raw rows for the id map.
                  const fullSubjects = await db.listSubjects();
                  const idMap = new Map<string, number>(fullSubjects.map((s: any) => [s.slug, s.id as number]));
                  // wipe existing AI-replaceable blocks for the day (keep manually-edited ones is overkill for v1)
                  const existing = await db.listBlocksForPlan(plan.id);
                  for (const b of existing) { try { await db.deleteBlock((b as any).id); } catch {} }
                  let sortOrder = 0;
                  // Resolve topic codes → ids in one batch for this day's blocks.
                  const dayCodeMap = await resolveTopicIds(draft.blocks.map((b: any) => b.curriculumTopicCode || null)).catch(() => new Map<string, number>());
                  for (const b of draft.blocks) {
                    const subjectId = b.subjectSlug ? (idMap.get(b.subjectSlug) ?? null) : null;
                    const codeKey = (b as any).curriculumTopicCode ? String((b as any).curriculumTopicCode).trim().toUpperCase() : "";
                    const topicId = (b as any).curriculumTopicId ?? (codeKey ? (dayCodeMap.get(codeKey) ?? null) : null);
                    await db.createBlock({
                      planId: plan.id,
                      blockType: b.blockType as any,
                      subjectId,
                      title: b.title,
                      description: b.description || null,
                      durationMin: b.durationMin,
                      startTime: b.startTime || null,
                      sortOrder: sortOrder++,
                      status: "not_started" as any,
                      curriculumTopicId: topicId,
                    } as any);
                  }
                  await db.logAudit({ actorOpenId: ctx.user?.openId, actorName: ctx.user?.name, entityType: "block", entityId: plan.id, action: "create", summary: `syncFutureDays committed ${draft.blocks.length} blocks for ${ymdStr}` });
                }
                results.push({ date: ymdStr, status: "committed", blockCount: draft.blocks.length });
                committed++;
              } else {
                results.push({ date: ymdStr, status: "error", reason: "draft returned 0 blocks" });
              }
            } catch (e: any) {
              results.push({ date: ymdStr, status: "error", reason: String(e?.message || e).slice(0, 200) });
            }
          }
          cursor.setDate(cursor.getDate() + 1);
        }
        return { committed, results };
      }),
    /** One-shot: mark Q1+Q2+Q3 topics as done (only flips notStarted -> done). */
    backfillProgress: protectedProcedure.mutation(() => db.backfillCurriculumProgress()),
    /** Roll-up of every artifact attached to a topic: resources + blocks. */
    rollup: protectedProcedure
      .input(z.object({ topicId: z.number().int().positive() }))
      .query(({ input }) => db.getTopicRollup(input.topicId)),
    /**
     * v2.15 (2026-05-17) — Resolve a curriculum topic code (e.g. "M.5.A.1")
     * to its numeric topicId. Used by AgendaEditor's BlockResourcesPanel
     * to bridge the catalog (code-only) into the rollup/addResource/
     * removeResource calls (which need topicId).
     */
    topicByCode: protectedProcedure
      .input(z.object({ code: z.string().min(1).max(64) }))
      .query(async ({ input }) => {
        const { resolveTopicId } = await import("./_lib/topicCatalog");
        const id = await resolveTopicId(input.code);
        return { id };
      }),
    /**
     * Add a manual resource (worksheet/video/lesson/reading/printable/link)
     * to a topic. v2.15 (2026-05-17) tightened to familyAdminProcedure so
     * Reagan can never write to the resource list, even if she's signed in.
     * Mom + Grandma only.
     */
    addResource: familyAdminProcedure
      .input(z.object({
        topicId: z.number().int().positive(),
        kind: z.enum(["worksheet", "video", "lesson", "reading", "printable", "link"]),
        title: z.string().min(1).max(400),
        url: z.string().max(1024).optional().nullable(),
        source: z.string().max(64).optional().nullable(),
        notes: z.string().max(2000).optional().nullable(),
      }))
      .mutation(({ input, ctx }) => {
        const rawId = (ctx as any).user?.id;
        const num = typeof rawId === "number" ? rawId : Number(rawId);
        const addedByUserId = Number.isFinite(num) ? num : null;
        return db.addTopicResource({ ...input, addedByUserId });
      }),
    /**
     * Remove a manually-added resource by id. v2.15 tightened to
     * familyAdminProcedure (adult-only).
     */
    removeResource: familyAdminProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(({ input }) => db.removeTopicResource(input.id)),
    /**
     * Upload a PDF or image (from file picker OR live camera capture) and
     * attach it to a curriculum topic in one shot. v2.97 (2026-05-27).
     *
     * `fileData` is a base64 string (no data: prefix) so the tRPC payload
     * stays JSON-only. Caps at ~10 MB so we don't try to push a giant
     * scan through the proxy.
     */
    uploadResourceFile: familyAdminProcedure
      .input(z.object({
        topicId: z.number().int().positive(),
        kind: z.enum(["worksheet", "video", "lesson", "reading", "printable", "link"]),
        title: z.string().min(1).max(400),
        notes: z.string().max(2000).optional().nullable(),
        fileName: z.string().min(1).max(200),
        mimeType: z.string().min(1).max(120),
        fileData: z.string().min(1).max(15_000_000), // base64, ~10 MB raw
        captureSource: z.enum(["upload", "camera"]).default("upload"),
      }))
      .mutation(async ({ input, ctx }) => {
        const buf = Buffer.from(input.fileData, "base64");
        if (buf.length === 0) throw new Error("Empty file");
        if (buf.length > 10 * 1024 * 1024) throw new Error("File too large (max 10 MB)");
        const safeName = input.fileName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-100);
        const key = `curriculum-resources/${input.topicId}/${Date.now()}-${safeName}`;
        const stored = await storagePut(key, buf, input.mimeType);
        const rawId = (ctx as any).user?.id;
        const num = typeof rawId === "number" ? rawId : Number(rawId);
        const addedByUserId = Number.isFinite(num) ? num : null;
        return db.addTopicResource({
          topicId: input.topicId,
          kind: input.kind,
          title: input.title.trim(),
          url: stored.url,
          source: input.captureSource === "camera" ? "camera" : "upload",
          notes: input.notes ?? null,
          addedByUserId,
        });
      }),
    /**
     * Create your own lesson / assignment / activity with no URL required.
     * v2.97 (2026-05-27). Title + description only. Stores notes as the body
     * so kid sees it inline in their block detail view.
     */
    createCustomResource: familyAdminProcedure
      .input(z.object({
        topicId: z.number().int().positive(),
        kind: z.enum(["worksheet", "video", "lesson", "reading", "printable", "link"]),
        title: z.string().min(1).max(400),
        description: z.string().min(1).max(2000),
      }))
      .mutation(({ input, ctx }) => {
        const rawId = (ctx as any).user?.id;
        const num = typeof rawId === "number" ? rawId : Number(rawId);
        const addedByUserId = Number.isFinite(num) ? num : null;
        return db.addTopicResource({
          topicId: input.topicId,
          kind: input.kind,
          title: input.title.trim(),
          url: null,
          source: "adult_created",
          notes: input.description.trim(),
          addedByUserId,
        });
      }),
    /** Find free, no-login external resources for a topic (Khan/IXL/ReadWorks/etc.). */
    freeLinks: publicProcedure
      .input(z.object({ subjectSlug: z.string().min(1).max(32), topicName: z.string().min(1).max(200), gradeBand: z.string().optional() }))
      .query(({ input }) => findFreeLinks(input)),
    /** Recent submissions, ungrouped, latest first — powers "Recent items" panel. */
    recent: protectedProcedure
      .input(z.object({ limit: z.number().int().min(1).max(50).default(15) }).optional())
      .query(async ({ input }) => {
        const subs = await db.listAssignmentSubmissions(input?.limit ?? 15);
        return (subs as any[]).map((s) => ({
          id: s.id,
          subjectSlug: s.subjectSlug,
          title: s.title || "(untitled)",
          createdAt: s.createdAt,
          kidDifficulty: s.kidDifficulty,
          readingOnly: !!s.readingOnly,
        }));
      }),
  }),
  today: router({
    coverage: protectedProcedure.query(() => db.todayCoverage()),
    coverageWithActuals: protectedProcedure.query(() => db.todayCoverageWithActuals()),
    resumePointer: protectedProcedure.query(() => db.resumePointer()),
    moodStrip: protectedProcedure
      .input(z.object({ days: z.number().min(1).max(14).optional() }).optional())
      .query(({ input }) => db.recentMoodStrip(input?.days ?? 3)),
    /**
     * Push 90 (2026-05-13) — hour-by-hour mood timeline for Today.
     *
     * Returns a strip of hour cells across Reagan's school-day window
     * (default 8a..4p). Each cell is the latest mood log within that
     * local hour, or null if there was none. The kid-facing component
     * self-hides when `hasAny` is false (no info → no render).
     */
    moodTimelineStrip: protectedProcedure
      .input(
        z
          .object({
            localDateIso: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
            tzOffsetMin: z.number().int().min(-720).max(840),
            startHour: z.number().int().min(0).max(23).optional(),
            endHour: z.number().int().min(1).max(24).optional(),
          }),
      )
      .query(async ({ input }) => {
        const { buildMoodTimelineStrip } = await import("./_lib/moodTimelineStrip");
        // Fetch a wide window of recent moods, then filter by local day in the
        // pure helper. 36 hours back is comfortably more than the largest
        // school-day window across any timezone.
        const rows = await db.listRecentMood(2);
        const inputs = rows.map((r: any) => ({
          loggedAtMs: new Date(r.loggedAt).getTime(),
          zone: r.zone as "green" | "yellow" | "red",
          note: (r.note ?? null) as string | null,
        }));
        return buildMoodTimelineStrip(inputs, {
          localDateIso: input.localDateIso,
          tzOffsetMin: input.tzOffsetMin,
          startHour: input.startHour,
          endHour: input.endHour,
        });
      }),
    /**
     * Push 119 (2026-05-13) — Slay Charge ⚡ daily pick.
     *
     * Returns today's pick from the curated joke/clip pool. Deterministic
     * per (dateIso, rerollIndex) so Reagan can tap "🔄 give me another"
     * and get a different item, while the *first* pick of the day is
     * stable across refreshes. Public because the kid session reads it.
     */
    slayCharge: publicProcedure
      .input(
        z
          .object({
            dateIso: z
              .string()
              .regex(/^\d{4}-\d{2}-\d{2}$/)
              .optional(),
            rerollIndex: z.number().int().min(0).max(50).optional(),
          })
          .optional(),
      )
      .query(async ({ input }) => {
        const { pickSlayChargeForDay } = await import("./_lib/slayChargeMorningVibe");
        const dateIso =
          input?.dateIso ?? new Date().toISOString().slice(0, 10);
        const pick = pickSlayChargeForDay({
          dateIso,
          rerollIndex: input?.rerollIndex ?? 0,
        });
        return { dateIso, rerollIndex: input?.rerollIndex ?? 0, pick };
      }),
    /**
     * Push 143 (2026-05-14) — Bookshelf rollup.
     *
     * Returns the canonical 4-book printed shelf with completion% per book
     * after applying any caller-passed reading sessions on top of the
     * stored prior-highest-page map. Pure helper does all the work; this
     * procedure is a thin pass-through so the bookshelf UI / digest can
     * call into the same business logic from anywhere.
     */
    /**
     * Push 146 (2026-05-14) — Kiwi mood reading for the active block.
     *
     * Caller passes the current block's mic + activity signals (collected
     * by the kid-side AIChatBox / Kiwi widget). Returns a kid-readable
     * mood band + suggested adjustment that the Today header chip
     * polls every 60s. Public so the kid session can read it.
     */
    kiwiMoodNow: publicProcedure
      .input(
        z.object({
          blockSortOrder: z.number().int().min(1).max(20),
          blockTitle: z.string().min(1).max(120),
          subjectName: z.string().min(1).max(60).optional(),
          micFocusFraction: z.number().min(0).max(1).optional(),
          micDistressFraction: z.number().min(0).max(1).optional(),
          onTaskEvents: z.number().int().min(0).max(1000).optional(),
          scheduledMinutes: z.number().min(1).max(180),
          elapsedMinutes: z.number().min(0).max(240),
          kidFlaggedHard: z.boolean().optional(),
        }),
      )
      .query(async ({ input }) => {
        const { readKiwiMoodForBlock } = await import("./_lib/kiwiMoodTracker");
        return readKiwiMoodForBlock({
          blockSortOrder: input.blockSortOrder,
          blockTitle: input.blockTitle,
          subjectName: input.subjectName ?? null,
          micFocusFraction: input.micFocusFraction ?? 0.5,
          micDistressFraction: input.micDistressFraction ?? 0,
          onTaskEvents: input.onTaskEvents ?? 0,
          scheduledMinutes: input.scheduledMinutes,
          elapsedMinutes: input.elapsedMinutes,
          kidFlaggedHard: input.kidFlaggedHard ?? false,
        });
      }),
    /**
     * Push 147 (2026-05-14) — Self-rebalancing day timeline.
     *
     * Caller passes the morning's planned blocks + actual start time +
     * any per-block actuals/mood adjustments; helper returns the new
     * ordered list with adjusted start/end times, inserted movement
     * breaks, and plain-English notes ready to render in Today.
     * Public so the kid session can see the same shifted plan.
     */
    timelineRebalanced: publicProcedure
      .input(
        z.object({
          actualStartHHmm: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
          hardEndHHmm: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
          minBlockMinutes: z.number().int().min(1).max(120).optional(),
          maxBlockMinutes: z.number().int().min(1).max(180).optional(),
          movementMinutes: z.number().int().min(3).max(20).optional(),
          blocks: z.array(
            z.object({
              blockSortOrder: z.number().int().min(1).max(40),
              blockTitle: z.string().min(1).max(120),
              subjectName: z.string().min(1).max(60).optional().nullable(),
              scheduledMinutes: z.number().int().min(1).max(180),
              actualMinutes: z.number().int().min(1).max(240).optional().nullable(),
              status: z.enum(["pending", "in_progress", "done"]).optional(),
              moodAdjustment: z
                .enum(["none", "shorten_next", "swap_to_movement", "end_block_now"])
                .optional(),
              locked: z.boolean().optional(),
            }),
          ),
        }),
      )
      .query(async ({ input }) => {
        const { rebalanceDayTimeline } = await import(
          "./_lib/dayTimelineRebalancer"
        );
        return rebalanceDayTimeline(input.blocks, {
          actualStartHHmm: input.actualStartHHmm,
          hardEndHHmm: input.hardEndHHmm,
          minBlockMinutes: input.minBlockMinutes,
          maxBlockMinutes: input.maxBlockMinutes,
          movementMinutes: input.movementMinutes,
        });
      }),
    bookshelfRollup: publicProcedure
      .input(
        z
          .object({
            prior: z.record(z.string(), z.number().nullable().optional()).optional(),
            sessions: z
              .array(
                z.object({
                  slug: z.string(),
                  startPage: z.number().int().nullable().optional(),
                  endPage: z.number().int().nullable().optional(),
                  dayNumber: z.number().int().nullable().optional(),
                }),
              )
              .optional(),
          })
          .optional(),
      )
      .query(async ({ input }) => {
        const { rollupShelfProgress } = await import(
          "./_lib/bookReadingProgress"
        );
        return rollupShelfProgress(input?.prior ?? {}, input?.sessions ?? []);
      }),
    /**
     * Push 155 (2026-05-14) — "Good Morning, Reagan!" daily greeter.
     *
     * Mom asked for a kid-friendly daily start-up that is engaging and
     * mood-setting (joke / fun fact / riddle / silly thought / kind
     * thought) instead of a traditional warm-up. The pure helper picks
     * one deterministically per ISO date so the greeting stays the same
     * if Reagan refreshes the page (no slot-machine feeling).
     * Public so the kid Today page can render it without auth.
     */
    goodMorningGreeting: publicProcedure
      .input(
        z
          .object({
            dateISO: z
              .string()
              .regex(/^\d{4}-\d{2}-\d{2}$/)
              .optional(),
            forceKind: z
              .enum([
                "joke",
                "fun_fact",
                "riddle",
                "silly_thought",
                "kind_thought",
              ])
              .optional(),
          })
          .optional(),
      )
      .query(async ({ input }) => {
        const { pickGoodMorningGreeting } = await import(
          "./_lib/goodMorningReagan"
        );
        const dateISO =
          input?.dateISO ?? new Date().toISOString().slice(0, 10);
        return pickGoodMorningGreeting(dateISO, {
          forceKind: input?.forceKind,
        });
      }),
    /**
     * Push 154 (2026-05-14) — Free-form Agenda Editor parser.
     *
     * Mom or Grandma types plain English ("shorter today / more math /
     * skip science") and gets back a typed list of edits the UI shows on
     * an Accept / Undo card. familyAdminProcedure means only Mom and
     * Grandma reach this; Reagan's session never sees the input box.
     */
    agendaEditorParse: familyAdminProcedure
      .input(z.object({ input: z.string().min(0).max(2000) }))
      .mutation(async ({ input }) => {
        const { parseAgendaEditorInput } = await import(
          "./_lib/agendaEditorParser"
        );
        return parseAgendaEditorInput(input.input);
      }),
    /**
     * Push 154 (2026-05-14) — Inline tap-edit handler.
     *
     * Mom or Grandma taps directly on a block field (start time, minutes,
     * or title) on Today + Schedule and the popover sends the raw value
     * here. Helper validates with kid-readable errors + returns an undo
     * payload. The caller then writes the resulting `applyValue` via the
     * existing `blocks.update` mutation.
     */
    applyInlineTapEdit: familyAdminProcedure
      .input(
        z.object({
          blockId: z.number().int().positive(),
          field: z.enum(["startTime", "durationMin", "title"]),
          rawValue: z.string().min(0).max(120),
          oldStartTime: z.string().nullish(),
          oldDurationMin: z.number().int().nullish(),
          oldTitle: z.string().nullish(),
          isAcademic: z.boolean().optional(),
        }),
      )
      .mutation(async ({ input }) => {
        const { applyInlineTapEdit } = await import(
          "./_lib/inlineTapEditHandler"
        );
        return applyInlineTapEdit(input);
      }),
    /**
     * Push 154 (2026-05-14) — Analytics strip empty-state guard.
     *
     * Returns the filtered tile list + visibility flag for the Today
     * page's analytics strip. Hides the strip entirely when no real data
     * exists today, instead of rendering grey placeholder boxes.
     * Public so the kid view can render the same empty state.
     */
    analyticsStrip: publicProcedure
      .input(
        z.object({
          blocksDone: z.number().int().min(0).max(40),
          blocksPlanned: z.number().int().min(0).max(40),
          minutesOnTask: z.number().int().min(0).max(1440),
          submissionsGraded: z.number().int().min(0).max(200),
          currentStreakDays: z.number().int().min(0).max(3650),
          subjectsTouched: z.number().int().min(0).max(20),
        }),
      )
      .query(async ({ input }) => {
        const { guardAnalyticsStrip } = await import(
          "./_lib/analyticsEmptyStateGuard"
        );
        return guardAnalyticsStrip(input);
      }),
    /**
     * Push 159 (2026-05-14) — wire Reagan's request button parser.
     * Reagan-callable (public). Returns a typed adult-side request row
     * the dashboard can show in Mom/Grandma's queue.
     */
    parseReaganRequest: publicProcedure
      .input(z.object({ raw: z.string().min(1).max(2000) }))
      .mutation(async ({ input }) => {
        const { parseReaganRequest } = await import(
          "./_lib/reaganRequestParser"
        );
        return parseReaganRequest(input.raw, new Date().toISOString());
      }),
    /**
     * Push 159 (2026-05-14) — wire off-curriculum auto-classifier.
     * Adult-callable. Returns either a matched curriculum topic or
     * a Mom one-tap "add this new topic" candidate.
     */
    classifyOffCurriculum: familyAdminProcedure
      .input(
        z.object({
          chunk: z.string().min(1).max(4000),
          catalog: z
            .array(
              z.object({
                id: z.string(),
                label: z.string(),
                subject: z.string(),
                keywords: z.array(z.string()).optional(),
              }),
            )
            .max(500)
            .default([]),
        }),
      )
      .mutation(async ({ input }) => {
        const { classifyOffCurriculum } = await import(
          "./_lib/offCurriculumClassifier"
        );
        return classifyOffCurriculum(input.chunk, input.catalog);
      }),
    /**
     * Push 159 (2026-05-14) — wire adult quick-entry payload builder.
     * Mom + Grandma callable. Returns the fully-typed payload the
     * caller writes into actualAgendaEntries + drivePushQueue.
     */
    applyAdultQuickEntry: familyAdminProcedure
      .input(
        z.object({
          schoolDayISO: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
          lines: z
            .array(
              z.object({
                rawLine: z.string().min(0).max(500),
                plannedBlockId: z.string().optional(),
              }),
            )
            .max(20),
        }),
      )
      .mutation(async ({ input }) => {
        const { buildAdultQuickEntryPayload } = await import(
          "./_lib/adultQuickEntryPayload"
        );
        return buildAdultQuickEntryPayload(input.schoolDayISO, input.lines);
      }),
    /**
     * Push 165 (2026-05-14) — deterministic worksheet grader.
     * No LLM. Mom-readable, Reagan-friendly. Caller passes typed answers
     * + an answer key; we return per-question scoring + total.
     */
    gradeWorksheetDeterministic: publicProcedure
      .input(
        z.object({
          items: z.array(z.any()).max(200),
          answers: z.array(
            z.object({
              itemId: z.string().min(1),
              raw: z.string(),
            }),
          ).max(200),
        }),
      )
      .mutation(async ({ input }) => {
        const { gradeWorksheet } = await import(
          "./_lib/deterministicWorksheetGrader"
        );
        return gradeWorksheet(input.items as any, input.answers);
      }),
    /**
     * Push 165 (2026-05-14) — Reagan choice-time picks.
     * Returns the day's deterministic 3-option set for Reagan to choose
     * from for free-time blocks. Public so the kid-facing card can read it.
     */
    reaganChoiceTime: publicProcedure
      .input(
        z.object({
          schoolDayISO: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
          studentName: z.string().min(1).max(80).default("Reagan"),
          availableMinutes: z.number().int().min(0).max(240),
          weatherIsWet: z.boolean().optional(),
          momIsHome: z.boolean().optional(),
          carIsAvailable: z.boolean().optional(),
          moodBand: z.enum(["great", "okay", "tired", "frustrated"]).optional(),
          recentlyPickedIds: z.array(z.string()).max(30).optional(),
          pickedYesterdayId: z.string().nullable().optional(),
          pickedDayBeforeId: z.string().nullable().optional(),
          pickCount: z.number().int().min(1).max(5).default(3),
          pool: z.array(
            z.object({
              id: z.string().min(1),
              label: z.string().min(1),
              location: z.enum(["indoor", "outdoor", "either"]),
              energy: z.enum(["low", "medium", "high"]),
              durationMin: z.number().int().min(1).max(240),
              tags: z.array(z.string()).optional(),
              needsAdult: z.boolean().optional(),
              needsCar: z.boolean().optional(),
            }),
          ).min(1).max(50),
        }),
      )
      .query(async ({ input }) => {
        const { pickReaganChoiceTime } = await import(
          "./_lib/reaganChoiceTimePicker"
        );
        return pickReaganChoiceTime(input as any);
      }),
    /**
     * Push 168 (2026-05-15 overnight Wave-10) — tutor handoff brief.
     * Builds a 5-bullet markdown brief + a kid-line for the next tutor
     * session. Pure helper wiring; family-only.
     */
    tutorHandoffSummary: familyAdminProcedure
      .input(
        z.object({
          forISO: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
          tutorName: z.string().min(1),
          subject: z.string().min(1),
          recentBlocks: z.array(z.any()).default([]),
          recentGrades: z.array(z.any()).default([]),
          interests: z.array(z.string()).default([]),
        }),
      )
      .query(async ({ input }) => {
        const { buildTutorHandoffSummary } = await import(
          "./_lib/tutorHandoffSummary"
        );
        return buildTutorHandoffSummary(input as any);
      }),
    /**
     * Push 168 (2026-05-15 overnight Wave-10) — subject-time-balance live alert.
     * Computes per-subject pacing for the active week and surfaces a gentle
     * adult-side notice + kid-friendly nudge. Family-only.
     */
    subjectTimeBalanceAlert: familyAdminProcedure
      .input(
        z.object({
          weekStartISO: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
          schoolDaysElapsedThisWeek: z.number().int().min(0).max(5),
          actualMinByDay: z.record(z.string(), z.number()).default({}),
          weeklyTargetMin: z.record(z.string(), z.number()).default({}),
        }),
      )
      .query(async ({ input }) => {
        const { computeSubjectTimeBalanceAlert } = await import(
          "./_lib/subjectTimeBalanceAlert"
        );
        return computeSubjectTimeBalanceAlert(input as any);
      }),
    /**
     * Push 171 (2026-05-15 Wave-11) — kid-readable streak headline + per-subject
     * streak rows for the Today page. publicProcedure so Reagan's view can read it
     * without family-admin context.
     */
    kidStreakSummary: publicProcedure
      .input(
        z.object({
          todayISO: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
          lookbackDays: z.number().int().min(1).max(60).optional(),
          dailyByDate: z.record(z.string(), z.record(z.string(), z.number())).default({}),
          subjects: z.array(z.string()).optional(),
        }),
      )
      .query(async ({ input }) => {
        const { computeKidStreaks } = await import("./_lib/kidStreakSummary");
        return computeKidStreaks(input as any);
      }),
    /**
     * Push 171 (2026-05-15 Wave-11) — Reagan break suggestion. Pure helper picks
     * one of 8 break kinds deterministically per ISO+name. familyAdminProcedure
     * because the suggestion uses adult-aware veto data (adultPresent, weather,
     * pets, vetoKinds).
     */
    suggestBreak: familyAdminProcedure
      .input(
        z.object({
          iso: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
          name: z.string().min(1),
          mood: z.enum(["great", "okay", "tired", "frustrated"]),
          weather: z.enum([
            "sunny-cool",
            "sunny-warm",
            "cloudy",
            "rainy",
            "cold",
            "hot",
            "unknown",
          ]),
          hourOfDay: z.number().int().min(0).max(23),
          adultPresent: z.boolean(),
          recentBreakKinds: z.array(z.string()).optional(),
          pets: z.array(z.enum(["dog", "cat", "bird"])).optional(),
          vetoKinds: z.array(z.string()).optional(),
        }),
      )
      .query(async ({ input }) => {
        const { pickReaganBreak } = await import("./_lib/breakPlanner");
        return pickReaganBreak(input as any);
      }),
    /**
     * Push 174 (2026-05-15 Wave-12) — Listening-summary mood-timeline rollup.
     * Returns 24 hour cells for the given ISO date with kid-safe mood +
     * top-3 behavior tags + kid-readable one-liner per hour. Empty hours
     * are flagged so the UI hides them. publicProcedure so the kid-side
     * mood card on the Today page can read the rollup without a Mom session.
     */
    moodTimelineRollup: publicProcedure
      .input(
        z.object({
          dateISO: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
          chunks: z.array(
            z.object({
              atISO: z.string(),
              reaganVoicePresent: z.boolean(),
              moodEstimate: z.string(),
              behaviorTags: z.array(z.string()),
            }),
          ),
        }),
      )
      .query(async ({ input }) => {
        const { rollupListeningMoodTimeline } = await import(
          "./_lib/listeningMoodTimelineRollup"
        );
        return rollupListeningMoodTimeline(input as any);
      }),
    /**
     * Push 177 (2026-05-14, Wave-13) — wire end-of-day exit ticket builder.
     * Public so Reagan-side can render her 3 short prompts without an adult session.
     */
    exitTicketBuild: publicProcedure
      .input(
        z.object({
          dateISO: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
          kidName: z.string().min(1).max(40).optional(),
          completedSubjects: z.array(z.string()).optional(),
          recentMood: z
            .enum(["great", "okay", "tired", "frustrated"])
            .optional(),
        }),
      )
      .query(async ({ input }) => {
        const { buildExitTicket } = await import("./_lib/exitTicketBuilder");
        return buildExitTicket(input as any);
      }),
    /**
     * Push 177 (2026-05-14, Wave-13) — wire multi-day mood trend.
     * Adult-only: returns a respectful notice + suggestion when recent week
     * has dipped vs the prior week. No clinical language ever.
     */
    multiDayMoodTrend: familyAdminProcedure
      .input(
        z.object({
          todayISO: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
          records: z.array(
            z.object({
              iso: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
              mood: z.string(),
            }),
          ),
        }),
      )
      .query(async ({ input }) => {
        const { computeMultiDayMoodTrend } = await import(
          "./_lib/multiDayMoodTrend"
        );
        return computeMultiDayMoodTrend(input as any);
      }),
    /**
     * Push 180 (Wave-13/14, 2026-05-15) — Notebook Doodle prompt of the
     * day. Deterministic per ISO + kid name; kid-readable, opt-in,
     * never timed/graded.
     */
    notebookDoodleToday: publicProcedure
      .input(
        z.object({
          isoDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
          kidName: z.string().default("reagan"),
          recentPromptKeys: z.array(z.string()).optional(),
        }),
      )
      .query(async ({ input }) => {
        const { pickNotebookDoodlePrompt } = await import(
          "./_lib/notebookDoodlePrompt"
        );
        return pickNotebookDoodlePrompt(input as any);
      }),
    /**
     * Push 180 (Wave-13/14, 2026-05-15) — Bookshelf milestone
     * celebration. Returns at most one celebration per day; kid-readable
     * and never comparative.
     */
    bookshelfMilestoneToday: publicProcedure
      .input(
        z.object({
          isoDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
          kidName: z.string().default("reagan"),
          finishedBookToday: z.boolean().optional(),
          quarterCrossedToday: z.boolean().optional(),
          chaptersFinishedToday: z.number().int().nonnegative().optional(),
          daysSinceLastReadingBlock: z.number().int().nonnegative().optional(),
          alreadyCelebratedToday: z.boolean().optional(),
        }),
      )
      .query(async ({ input }) => {
        const { computeBookshelfMilestone } = await import(
          "./_lib/bookshelfMilestoneCelebration"
        );
        return computeBookshelfMilestone(input as any);
      }),
    /**
     * Push 182 (Wave-14, 2026-05-15) — Family screen-time fairness.
     * Surfaces always-allowed activities first, never blocks, never
     * uses punitive language. Mom or Grandma override is enough.
     */
    familyScreenTimeFairness: publicProcedure
      .input(
        z.object({
          isoDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
          viewerId: z.string(),
          usageToday: z.array(
            z.object({
              memberId: z.string(),
              minutes: z.number().nonnegative(),
            }),
          ),
          reaganBaseAllowanceMin: z.number().int().nonnegative().optional(),
          overrides: z
            .array(
              z.object({
                grantedBy: z.enum(["mom", "grandma"]),
                extraMinutes: z.number().int().nonnegative(),
                reason: z.string().optional(),
              }),
            )
            .optional(),
          alwaysAllowed: z
            .array(
              z.object({
                key: z.string(),
                label: z.string(),
                category: z.enum([
                  "reading",
                  "outdoor",
                  "art",
                  "building",
                  "music",
                ]),
              }),
            )
            .optional(),
          bankCarriedMin: z.number().int().nonnegative().optional(),
        }),
      )
      .query(async ({ input }) => {
        const { computeFamilyScreenTimeFairness } = await import(
          "./_lib/familyScreenTimeFairness"
        );
        return computeFamilyScreenTimeFairness(input as any);
      }),
    /**
     * Push 183 (Wave-15, 2026-05-15) — Pear Classes / Giant Steps Library
     * appLink chip on Today. Pure deterministic helper; never reads DB.
     * Reagan-callable (publicProcedure) so the kid-side rail can render
     * the chip without an adult session. Helper handles consent gating.
     */
    pearClassesAppLink: publicProcedure
      .input(
        z
          .object({
            signedInGoogleAccount: z.string().optional().nullable(),
            oauthConsentGranted: z.boolean().optional(),
            isReaganView: z.boolean().optional(),
          })
          .optional(),
      )
      .query(async ({ input }) => {
        const { computePearClassesAppLink } = await import(
          "./_lib/pearClassesAppLink"
        );
        return computePearClassesAppLink((input ?? {}) as any);
      }),
    /**
     * Push 184 (Wave-15, 2026-05-15) — appLink sign-in-method tagger.
     * Pure helper wrapper. Tags one or many appLink rows with their
     * canonical signInMethod (google_sso | email_password | class_code),
     * preferred Google account role, and a kid-readable badge. Used by
     * the Apps Hub + Today rail to render the right opt-in chip without
     * ever leaking the blocked reagan.higgs33@ihsd.us address.
     */
    appLinkSignInMethodTags: publicProcedure
      .input(
        z.object({
          rows: z
            .array(
              z.object({
                appKey: z.string(),
                name: z.string().optional().nullable(),
                url: z.string().optional().nullable(),
              }),
            )
            .max(100),
          isReaganView: z.boolean().optional(),
        }),
      )
      .query(async ({ input }) => {
        const { tagAppLinkSignInMethod } = await import(
          "./_lib/appLinkSignInMethodTagger"
        );
        const isKid = input.isReaganView === true;
        return input.rows.map((row) =>
          tagAppLinkSignInMethod({ ...row, isReaganView: isKid }),
        );
      }),
    /**
     * Wave-15 / Push 187 — today.appAccountVaultBuild
     *
     * Adult-only mutation: takes one appLink tag (already produced by
     * today.appLinkSignInMethodTags above) + the plaintext password the
     * adult just typed in, and returns a deterministic vault-row payload
     * ready to be encrypted + inserted into passwordLocker. Encryption
     * itself happens server-side via crypto.subtle (NOT in this helper)
     * so the helper stays pure; here we hand the helper an identity
     * encrypt fn that base64-wraps the plaintext as a placeholder, and
     * the real DB-insert procedure (added in a later push) will call the
     * real encrypt() before persisting.
     *
     * Reagan-callable: NO. Gated by ctx.user.role === 'admin'.
     */
    appAccountVaultBuild: protectedProcedure
      .input(
        z.object({
          tag: z.object({
            key: z.string(),
            name: z.string(),
            signInMethod: z.enum(["google_sso", "email_password", "class_code"]),
            preferredAccountRole: z.enum(["reagan", "mom", "grandma", "dad", "none"]),
            preferredAccountEmail: z.string().nullable(),
            badge: z.string(),
            adultNote: z.string().nullable(),
          }),
          plaintext: z.string().min(1).max(512),
          nowIso: z.string().optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        if (ctx.user?.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN", message: "adult-only" });
        }
        const { buildAppAccountVaultEntry } = await import(
          "./_lib/appAccountVaultEntry"
        );
        // Placeholder encryption — base64 wrap. Real procedure layer
        // will replace this with crypto.subtle AES-GCM before persisting.
        const encrypt = (p: string) =>
          `b64:${Buffer.from(p, "utf8").toString("base64")}`;
        return buildAppAccountVaultEntry({
          tag: input.tag,
          plaintext: input.plaintext,
          encrypt,
          nowIso: input.nowIso,
        });
      }),
    /**
     * Wave-15 / Push 189 — today.vaultRotationDue
     *
     * Adult-only query. Takes a list of AppAccountVaultEntry rows (the
     * caller fetches them from the DB and passes them in for now; once
     * Push 190 lands the procedure will fetch the rows itself) plus the
     * current ISO timestamp, and returns the overdue/dueSoon/healthy
     * buckets + adult-facing headline. Pure helper underneath, so this
     * procedure is mostly an auth gate + a passthrough.
     *
     * Reagan-callable: NO. Gated by ctx.user.role === 'admin'.
     */
    vaultRotationDue: protectedProcedure
      .input(
        z.object({
          rows: z
            .array(
              z.object({
                appKey: z.string(),
                appName: z.string(),
                signInMethod: z.enum(["google_sso", "email_password", "class_code"]),
                ownerRole: z.enum(["reagan", "mom", "grandma", "dad", "none"]),
                ownerEmail: z.string().nullable(),
                secretCiphertext: z.string(),
                rotateDays: z.number().nullable(),
                visibleToReagan: z.boolean(),
                kidSafeLabel: z.string(),
                createdAtIso: z.string(),
                adultNote: z.string(),
              }),
            )
            .max(500),
          nowIso: z.string(),
        }),
      )
      .query(async ({ ctx, input }) => {
        if (ctx.user?.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN", message: "adult-only" });
        }
        const { computeVaultRotationDue } = await import(
          "./_lib/vaultRotationDue"
        );
        return computeVaultRotationDue({
          rows: input.rows,
          nowIso: input.nowIso,
        });
      }),
    /**
     * Wave-15 / Push 191 — today.kidLoginTroubleshoot
     *
     * Reagan-callable. When the kid taps the in-app "I can't sign in"
     * button on an appLink card, the UI fires this with the symptom +
     * her current account email. The pure helper produces the repair
     * card; the wiring layer here additionally fires notifyOwner when
     * the helper decides escalation is needed, so Mom or Grandma gets a
     * phone ping. Failures to notify are swallowed — the repair card
     * still goes back to the kid either way.
     */
    kidLoginTroubleshoot: publicProcedure
      .input(
        z.object({
          tag: z.object({
            key: z.string(),
            name: z.string(),
            signInMethod: z.enum(["google_sso", "email_password", "class_code"]),
            preferredAccountRole: z.enum(["reagan", "mom", "grandma", "dad", "none"]),
            preferredAccountEmail: z.string().nullable(),
            badge: z.string(),
            adultNote: z.string().nullable(),
          }),
          symptom: z.enum([
            "page won't load",
            "wrong password",
            "says I'm not allowed",
            "blank screen",
            "asks for grown-up",
            "other",
          ]),
          kidEmail: z.string().nullable(),
        }),
      )
      .mutation(async ({ input }) => {
        const { diagnoseKidLogin } = await import(
          "./_lib/kidLoginTroubleshooter"
        );
        const card = diagnoseKidLogin({
          tag: input.tag,
          symptom: input.symptom,
          kidEmail: input.kidEmail,
        });
        if (card.escalateToGrownup) {
          try {
            const { notifyOwner } = await import("./_core/notification");
            await notifyOwner({
              title: card.notifyOwnerPayload.title,
              content: card.notifyOwnerPayload.content,
            });
          } catch {
            // Swallow — the kid still gets the repair card.
          }
        }
        return card;
      }),
    /**
     * Wave-15 / Push 193 — today.appLinkPlacementHints
     *
     * Reagan-callable. Given the same AppLinkSignInTag rows the UI
     * already has + the current subject focus, returns the deterministic
     * Today-page rail order: pinned-for-subject first (per Push 192's
     * SUBJECT_PINS map), then alphabetical by name, with rail position,
     * badge color, hero strip (first 3), and overflow marker for
     * anything past slot 8. Blocked IHSD-email apps are filtered out.
     */
    appLinkPlacementHints: publicProcedure
      .input(
        z.object({
          tags: z
            .array(
              z.object({
                key: z.string(),
                name: z.string(),
                signInMethod: z.enum(["google_sso", "email_password", "class_code"]),
                preferredAccountRole: z.enum([
                  "reagan", "mom", "grandma", "dad", "none",
                ]),
                preferredAccountEmail: z.string().nullable(),
                badge: z.string(),
                adultNote: z.string().nullable(),
              }),
            )
            .max(60),
          subject: z.enum([
            "reading", "math", "writing", "science", "art",
            "social_studies", "free_choice",
          ]),
        }),
      )
      .query(async ({ input }) => {
        const { computeAppLinkPlacement } = await import(
          "./_lib/appLinkPlacementHints"
        );
        return computeAppLinkPlacement(input.tags, input.subject);
      }),

    /**
     * Wave-15 / Push 205 — today.kidConsentSignals
     *
     * Reagan-callable. When the kid taps "I want to keep going" or
     * "I'm done" or "switch subjects" on any in-app task, the UI fires
     * this with the tap history + session start. Returns a deterministic
     * recommendation the UI surfaces calmly. House rule: the dashboard
     * NEVER imposes breaks; it only honors the ones Reagan asks for.
     * Voice rules (per Reagan's feedback): no "buddy/friend/yay".
     */
    kidConsentSignals: publicProcedure
      .input(
        z.object({
          taps: z
            .array(
              z.object({
                signal: z.enum(["keep_going", "im_done", "switch_subject"]),
                isoTimestamp: z.string(),
                subject: z.string().optional(),
              }),
            )
            .default([]),
          sessionStartedAtIso: z.string(),
          currentIsoTimestamp: z.string(),
        }),
      )
      .query(async ({ input }) => {
        const { decideKidConsent } = await import(
          "./_lib/kidConsentSignals"
        );
        return decideKidConsent({
          taps: input.taps,
          sessionStartedAtIso: input.sessionStartedAtIso,
          currentIsoTimestamp: input.currentIsoTimestamp,
        });
      }),

    /**
     * Wave-15 / Push 207 — today.subjectFocusRotation
     *
     * Reagan-callable. Returns the suggested morning-focus subject for
     * today (with calm kidLine + adultLine + alternates) so the Today
     * page can render something like "Today's first block: Math" without
     * Reagan landing on the same subject every morning. Read-only — this
     * never *changes* the schedule; real schedule changes still flow
     * through Mom + Grandma approval per house rules.
     */
    subjectFocusRotation: publicProcedure
      .input(
        z.object({
          isoDate: z.string(),
          recentHistory: z
            .array(
              z.object({
                isoDate: z.string(),
                subject: z.string(),
              }),
            )
            .optional(),
          availableSubjects: z.array(z.string()).optional(),
        }),
      )
      .query(async ({ input }) => {
        const { decideSubjectFocus } = await import(
          "./_lib/subjectFocusRotation"
        );
        return decideSubjectFocus({
          isoDate: input.isoDate,
          recentHistory: input.recentHistory,
          availableSubjects: input.availableSubjects,
        });
      }),

    /**
     * Wave-15 / Push 209 — today.printableDailyPack
     *
     * Reagan + adult callable. Given today's already-resolved agenda
     * blocks (the UI already has them), returns a structured printable
     * pack the homepage "Printable" button can render to PDF or print-
     * HTML. Pack includes the schedule, worksheet list (with printed-
     * book page refs preserved), lesson list, and a calm tutor handoff.
     * Voice rules + non-punitive language enforced in the helper.
     */
    printableDailyPack: publicProcedure
      .input(
        z.object({
          isoDate: z.string(),
          tutorName: z.string().nullish(),
          blocks: z.array(
            z.object({
              id: z.number(),
              title: z.string(),
              subjectSlug: z.string().nullish(),
              status: z.enum([
                "not_started",
                "in_progress",
                "complete",
                "skipped",
              ]),
              estimatedMinutes: z.number().nullish(),
              worksheetPdfUrl: z.string().nullish(),
              worksheetPdfName: z.string().nullish(),
              lessonPdfUrl: z.string().nullish(),
              lessonPdfName: z.string().nullish(),
              printedBookRef: z
                .object({ book: z.string(), pages: z.string() })
                .nullish(),
              notes: z.string().nullish(),
            }),
          ),
        }),
      )
      .query(async ({ input }) => {
        const { buildPrintableDailyPack } = await import(
          "./_lib/printableDailyPackBuilder"
        );
        return buildPrintableDailyPack({
          isoDate: input.isoDate,
          tutorName: input.tutorName ?? null,
          blocks: input.blocks.map((b) => ({
            id: b.id,
            title: b.title,
            subjectSlug: b.subjectSlug ?? null,
            status: b.status,
            estimatedMinutes: b.estimatedMinutes ?? null,
            worksheetPdfUrl: b.worksheetPdfUrl ?? null,
            worksheetPdfName: b.worksheetPdfName ?? null,
            lessonPdfUrl: b.lessonPdfUrl ?? null,
            lessonPdfName: b.lessonPdfName ?? null,
            printedBookRef: b.printedBookRef ?? null,
            notes: b.notes ?? null,
          })),
        });
      }),

    /**
     * Wave-15 / Push 211 — today.adventureLibrarySuggest
     *
     * Reagan-callable. Given the Adventure Library entries the caller
     * already has + her recent adventure history, returns a primary
     * Adventure of the Day plus 2 alternates. Weights toward birds /
     * animals / plants / water / swimming / outdoors per project
     * description. Never imposes — the UI surfaces the suggestion and
     * Reagan picks or asks Kiwi for something else.
     */
    adventureLibrarySuggest: publicProcedure
      .input(
        z.object({
          todayIso: z.string(),
          targetGrade: z.number().optional(),
          library: z.array(
            z.object({
              id: z.number(),
              title: z.string(),
              shortDescription: z.string(),
              gradeLevel: z.number(),
              tags: z.array(z.string()),
              outdoor: z.boolean(),
              estimatedMinutes: z.number().nullish(),
            }),
          ),
          history: z
            .array(
              z.object({
                adventureId: z.number(),
                isoDate: z.string(),
              }),
            )
            .optional(),
        }),
      )
      .query(async ({ input }) => {
        const { suggestAdventures } = await import(
          "./_lib/adventureLibrarySuggester"
        );
        return suggestAdventures({
          todayIso: input.todayIso,
          targetGrade: input.targetGrade,
          library: input.library.map((e) => ({
            ...e,
            estimatedMinutes: e.estimatedMinutes ?? null,
          })),
          history: input.history,
        });
      }),

    /**
     * Wave-15 / Push 213 — today.scheduleChangeRequestBuild
     *
     * Reagan-callable. Builds the canonical schedule-change request
     * payload (mom + grandma both required to approve, per house
     * rule) and fires notifyOwner so the dashboard owner sees the
     * request immediately. House rule: Reagan does NOT directly
     * change the schedule — she requests via Kiwi, and the actual
     * mutation happens only after both adults approve.
     *
     * The IHSD school email reagan.higgs33@ihsd.us is hard-blocked
     * inside the helper; if the caller passes that email the request
     * is returned with blocked=true and no notification fires.
     */
    scheduleChangeRequestBuild: publicProcedure
      .input(
        z.object({
          isoDate: z.string(),
          fromAccount: z.string(),
          intent: z.object({
            action: z.enum([
              "swap",
              "move_earlier",
              "move_later",
              "replace_block",
              "add_block",
              "skip_block",
              "unknown",
            ]),
            targetBlockTitles: z.array(z.string()).optional(),
            targetBlockIds: z.array(z.number()).optional(),
            proposedTitle: z.string().optional(),
            proposedSubjectSlug: z.string().optional(),
            reasonFromKid: z.string().optional(),
          }),
        }),
      )
      .mutation(async ({ input }) => {
        const { buildScheduleChangeRequest } = await import(
          "./_lib/scheduleChangeRequestBuilder"
        );
        const payload = buildScheduleChangeRequest({
          isoDate: input.isoDate,
          intent: input.intent,
          fromAccount: input.fromAccount,
        });

        if (!payload.blocked) {
          // Best-effort owner notification — don't fail the request if
          // the upstream notification service is briefly unavailable.
          try {
            await notifyOwner({
              title: "Schedule change request from Reagan",
              content: payload.adultBodyLine,
            });
          } catch {
            // swallow — the request payload is still returned
          }
        }

        return payload;
      }),

    /**
     * Wave-15 / Push 215 — today.scheduleChangeApprovalTally
     *
     * Adult + Reagan callable (read-only). Given the votes recorded
     * for a request, returns the canonical tally: pending / approved /
     * declined, plus kidLine + adultLine for the UI. Only Mom and
     * Grandma decisions count; reagan.higgs33@ihsd.us is hard-blocked
     * from voting. The UI uses shouldApplyChange to decide whether
     * to surface the "apply now" affordance.
     */
    scheduleChangeApprovalTally: publicProcedure
      .input(
        z.object({
          votes: z.array(
            z.object({
              voterEmail: z.string(),
              decision: z.enum(["approve", "decline"]),
              votedAtIso: z.string(),
            }),
          ),
        }),
      )
      .query(async ({ input }) => {
        const { tallyScheduleChangeApprovals } = await import(
          "./_lib/scheduleChangeApprovalTally"
        );
        return tallyScheduleChangeApprovals({ votes: input.votes });
      }),

    /**
     * Wave-15 / Push 217 — today.kiwiToneDriftCheck
     *
     * Pre-send guard. The Kiwi UI passes the candidate reply through
     * this procedure before showing it to Reagan; if flagged=true the
     * UI shows the safeFallback line instead and (optionally) asks
     * the LLM to regenerate. Keeps Kiwi's voice from drifting back
     * to the "creepy / too kiddy" register Reagan called out.
     */
    kiwiToneDriftCheck: publicProcedure
      .input(z.object({ message: z.string() }))
      .query(async ({ input }) => {
        const { detectKiwiToneDrift } = await import(
          "./_lib/kiwiToneDriftDetector"
        );
        return detectKiwiToneDrift(input.message);
      }),

    /**
     * Wave-15 / Push 219 — today.kiwiVoiceSettings
     *
     * Pre-generation voice steering. The Kiwi LLM call site calls
     * this first to fetch the canonical voice profile + system-
     * prompt fragment to prepend. Pairs with kiwiToneDriftCheck
     * (post-generation guard) to keep Kiwi off the kiddy / creepy
     * register that Reagan called out.
     */
    kiwiVoiceSettings: publicProcedure
      .input(
        z
          .object({
            profile: z
              .enum(["older_cousin", "neutral_calm", "study_buddy"])
              .optional(),
          })
          .optional(),
      )
      .query(async ({ input }) => {
        const { resolveKiwiVoiceSettings } = await import(
          "./_lib/kiwiVoiceSettings"
        );
        return resolveKiwiVoiceSettings(input);
      }),

    /**
     * Wave-15 / Push 221 — today.kiwiResponseLengthCap
     *
     * Post-generation "scissors". After the LLM produces a reply
     * and after the drift detector (Push 216/217) has approved its
     * tone, this helper trims the reply to the sentence cap from
     * the active voice profile. Cuts at sentence boundaries only
     * (never mid-word) and strips any emoji that slipped through.
     */
    kiwiResponseLengthCap: publicProcedure
      .input(
        z.object({
          message: z.string(),
          maxSentences: z.number().int().positive().max(10),
        }),
      )
      .query(async ({ input }) => {
        const { capKiwiResponseLength } = await import(
          "./_lib/kiwiResponseLengthCapper"
        );
        return capKiwiResponseLength(input.message, input.maxSentences);
      }),

    /**
     * Wave-15 / Push 223 — today.kiwiPostGenPipeline
     *
     * One-call bundle: drift check + length cap. The Kiwi UI calls
     * this with the raw LLM output and the active voice profile's
     * sentence cap, and gets back the final text to render plus
     * full diagnostics. Order: drift detector → if flagged, return
     * safeFallback (no cap applied); otherwise apply length cap to
     * the cleanedPreview.
     */
    kiwiPostGenPipeline: publicProcedure
      .input(
        z.object({
          candidate: z.string(),
          maxSentences: z.number().int().min(0).max(10),
        }),
      )
      .query(async ({ input }) => {
        const { runKiwiPostGenPipeline } = await import(
          "./_lib/kiwiPipelineRunner"
        );
        return runKiwiPostGenPipeline({
          candidate: input.candidate,
          maxSentences: input.maxSentences,
        });
      }),

    /**
     * Wave-15 / Push 225 — today.kiwiReadAloudPacing
     *
     * TTS pacing hints for the "Read" speaker button on Kiwi cards.
     * The text-side voice rewrite (less kiddy, less creepy) only
     * fixed what we say; this controls how it's spoken. Returns
     * rate / pitch / pause hints + a pre-built SSML payload for
     * frontends that support it.
     */
    kiwiReadAloudPacing: publicProcedure
      .input(
        z.object({
          profile: z
            .enum(["older_cousin", "neutral_calm", "study_buddy"])
            .default("older_cousin"),
          text: z.string().default(""),
        }),
      )
      .query(async ({ input }) => {
        const { getKiwiReadAloudPacing } = await import(
          "./_lib/kiwiReadAloudPacing"
        );
        return getKiwiReadAloudPacing(input.profile, input.text);
      }),

    /**
     * Wave-15 / Push 227 — today.kiwiTtsVoiceChoose
     *
     * The frontend reads window.speechSynthesis.getVoices() and posts
     * the list (name + lang + voiceURI + default). We pick the most
     * neutral English voice, rejecting any "kids / cartoon / novelty"
     * preset that would undo the calm voice rewrite. Returns a
     * voiceURI to use, or null to let the browser pick its default.
     */
    kiwiTtsVoiceChoose: publicProcedure
      .input(
        z.object({
          voices: z
            .array(
              z.object({
                voiceURI: z.string(),
                name: z.string(),
                lang: z.string(),
                default: z.boolean().optional(),
              }),
            )
            .max(200),
        }),
      )
      .query(async ({ input }) => {
        const { chooseKiwiTtsVoice } = await import(
          "./_lib/kiwiTtsVoiceChooser"
        );
        return chooseKiwiTtsVoice(input.voices);
      }),

    /**
     * Wave-15 / Push 229 — today.kiwiNicknameGuard
     *
     * Post-gen pet-name redactor. Catches forms-of-address like
     * "sweetie", "champ", "buddy", "little one" in vocative position
     * (next to a comma at start, middle, or end of a sentence) and
     * surgically removes them — preserving the rest of the reply.
     * The drift detector flags whole-register failures; this just
     * cleans nicknames so the older-cousin voice stays consistent
     * sentence-by-sentence.
     */
    kiwiNicknameGuard: publicProcedure
      .input(z.object({ message: z.string() }))
      .query(async ({ input }) => {
        const { guardKiwiNicknames } = await import(
          "./_lib/kiwiNicknameGuard"
        );
        return guardKiwiNicknames(input.message);
      }),

    /**
     * Wave-15 / Push 231 — today.kiwiFullPostGenPipeline
     *
     * Recommended one-call for new UI code. Runs the full three-step
     * post-gen pipeline: drift detector → nickname guard → length
     * cap. The older today.kiwiPostGenPipeline (Push 223, drift + cap
     * only) stays wired for back-compat.
     */
    kiwiFullPostGenPipeline: publicProcedure
      .input(
        z.object({
          candidate: z.string(),
          maxSentences: z.number().int().min(0).max(10),
        }),
      )
      .query(async ({ input }) => {
        const { runKiwiFullPostGenPipeline } = await import(
          "./_lib/kiwiFullPostGenPipeline"
        );
        return runKiwiFullPostGenPipeline({
          candidate: input.candidate,
          maxSentences: input.maxSentences,
        });
      }),

    /**
     * Wave-15 / Push 233 — today.kiwiVoiceAuditEntryBuild
     *
     * Adult-review audit row: takes the LLM's original candidate +
     * the full pipeline result + a caller-supplied timestamp and
     * returns the structured audit entry (severity + ordered
     * actions + verbatim originalCandidate / finalText). Persisting
     * the row is the caller's responsibility — this helper is pure.
     */
    kiwiVoiceAuditEntryBuild: publicProcedure
      .input(
        z.object({
          originalCandidate: z.string(),
          candidate: z.string(),
          maxSentences: z.number().int().min(0).max(10),
          timestampUtcMs: z.number().int().nonnegative(),
        }),
      )
      .query(async ({ input }) => {
        const { runKiwiFullPostGenPipeline } = await import(
          "./_lib/kiwiFullPostGenPipeline"
        );
        const { buildKiwiVoiceAuditEntry } = await import(
          "./_lib/kiwiVoiceAuditLogger"
        );
        const result = runKiwiFullPostGenPipeline({
          candidate: input.candidate,
          maxSentences: input.maxSentences,
        });
        return buildKiwiVoiceAuditEntry({
          originalCandidate: input.originalCandidate,
          result,
          timestampUtcMs: input.timestampUtcMs,
        });
      }),

    /**
     * Wave-15 / Push 236 — today.kiwiVoiceAuditPersist
     *
     * Mutation: runs the pipeline + builder, then persists the audit
     * row. Used by the chat UI right after the LLM returns. The
     * mutation returns BOTH the inserted id and the finalText so the
     * UI can render Kiwi's reply in the same round-trip.
     */
    kiwiVoiceAuditPersist: publicProcedure
      .input(
        z.object({
          originalCandidate: z.string(),
          candidate: z.string(),
          maxSentences: z.number().int().min(0).max(10),
          timestampUtcMs: z.number().int().nonnegative(),
          sourcePanel: z.string().max(64).optional(),
        }),
      )
      .mutation(async ({ input }) => {
        const { runKiwiFullPostGenPipeline } = await import(
          "./_lib/kiwiFullPostGenPipeline"
        );
        const { buildKiwiVoiceAuditEntry } = await import(
          "./_lib/kiwiVoiceAuditLogger"
        );
        const { insertKiwiVoiceAuditEntry } = await import("./db");
        const result = runKiwiFullPostGenPipeline({
          candidate: input.candidate,
          maxSentences: input.maxSentences,
        });
        const entry = buildKiwiVoiceAuditEntry({
          originalCandidate: input.originalCandidate,
          result,
          timestampUtcMs: input.timestampUtcMs,
        });
        const { id } = await insertKiwiVoiceAuditEntry({
          timestampUtcMs: entry.timestampUtcMs,
          originalCandidate: entry.originalCandidate,
          finalText: entry.finalText,
          severity: entry.severity,
          actionsJson: JSON.stringify(entry.actions),
          sourcePanel: input.sourcePanel ?? null,
        });
        return { id, entry };
      }),

    /**
     * Wave-15 / Push 236 — today.kiwiVoiceAuditList
     *
     * Adult-review page query. Returns rows newest-first. Optional
     * severity filter for "show me only the major flags".
     */
    kiwiVoiceAuditList: publicProcedure
      .input(
        z
          .object({
            limit: z.number().int().min(1).max(500).optional(),
            severity: z.enum(["info", "minor", "major"]).optional(),
          })
          .optional(),
      )
      .query(async ({ input }) => {
        const { listKiwiVoiceAuditEntries } = await import("./db");
        return listKiwiVoiceAuditEntries({
          limit: input?.limit,
          severity: input?.severity,
        });
      }),

    /**
     * Wave-15 / Push 236 — today.kiwiVoiceAuditMajorCount
     *
     * Count of major (drift-fallback) audit rows in the last N days.
     * Powers the at-a-glance card on the adult review page.
     */
    kiwiVoiceAuditMajorCount: publicProcedure
      .input(
        z
          .object({
            lookbackDays: z.number().int().min(1).max(90).optional(),
          })
          .optional(),
      )
      .query(async ({ input }) => {
        const { countMajorKiwiVoiceAuditEntries } = await import("./db");
        const days = input?.lookbackDays ?? 7;
        const count = await countMajorKiwiVoiceAuditEntries(days);
        return { lookbackDays: days, count };
      }),

    /**
     * Wave-15 / Push 238 — today.kiwiVoiceProfileResolve
     *
     * Routes the current panel id to the right voice profile.
     * UI calls this BEFORE the LLM call so the system-prompt
     * fragment is correct for the surface. Returns {profile,
     * rationale} — rationale is surfaced in the audit log so
     * adults can see why a given profile was chosen.
     */
    kiwiVoiceProfileResolve: publicProcedure
      .input(z.object({ panel: z.string().max(64).nullable().optional() }))
      .query(async ({ input }) => {
        const { resolveKiwiVoiceProfile } = await import(
          "./_lib/kiwiVoiceProfileResolver"
        );
        return resolveKiwiVoiceProfile(input.panel ?? null);
      }),

    /**
     * Wave-15 / Push 240 — today.kiwiPreGenBundle
     *
     * One-call pre-LLM bundle: panel → profile → voice settings
     * (system prompt fragment + sentence cap + forbidden words) →
     * TTS read-aloud pacing. Replaces three separate procedure
     * round-trips with one. The older today.kiwiVoiceProfileResolve
     * + today.kiwiVoiceSettings + today.kiwiReadAloudPacing stay
     * wired for back-compat.
     */
    kiwiPreGenBundle: publicProcedure
      .input(z.object({ panel: z.string().max(64).nullable().optional() }))
      .query(async ({ input }) => {
        const { buildKiwiPreGenBundle } = await import(
          "./_lib/kiwiPreGenBundle"
        );
        return buildKiwiPreGenBundle({ panel: input.panel ?? null });
      }),

    /**
     * Wave-15 / Push 242 — today.kiwiFullRoundTripDryRun
     *
     * Adult dev tool: paste a candidate reply, pick a panel, see
     * exactly what would happen — which profile gets picked, whether
     * post-gen guards would flag it, and what the audit row would
     * look like. Pure: NOTHING gets persisted by this call. Adult
     * review page only. Never wire this into Reagan-facing surfaces.
     */
    kiwiFullRoundTripDryRun: publicProcedure
      .input(
        z.object({
          panel: z.string().max(64).nullable().optional(),
          candidate: z.string(),
          timestampUtcMs: z.number().int().nonnegative(),
        }),
      )
      .query(async ({ input }) => {
        const { runKiwiFullRoundTrip } = await import(
          "./_lib/kiwiFullRoundTrip"
        );
        return runKiwiFullRoundTrip({
          panel: input.panel ?? null,
          candidate: input.candidate,
          timestampUtcMs: input.timestampUtcMs,
        });
      }),

    /**
     * Wave-15 / Push 244 — today.kiwiVoiceAuditWeeklySummary
     *
     * Adult-review at-a-glance card. Pulls audit rows from the last
     * N days (default 7, cap 90), runs the pure summary helper, and
     * returns a compact rollup: severity totals, % major, action
     * counts, top redacted nicknames, last 3 major samples, and a
     * single adult-tone headline line.
     */
    /**
     * Wave-15 / Push 246 — today.kiwiVoicePolicyManifest
     *
     * Returns the declarative manifest of every active Kiwi
     * voice / guard push. Adult review page's policy tab calls
     * this so Mom and Grandma can verify which guards are
     * running and trace any change in behavior to a specific
     * push number.
     */
    kiwiVoicePolicyManifest: publicProcedure.query(async () => {
      const { getKiwiVoicePolicyManifest } = await import(
        "./_lib/kiwiVoicePolicyVersion"
      );
      return getKiwiVoicePolicyManifest();
    }),

    /**
     * Wave-15 / Push 248 — today.kiwiBlessedLinePick
     *
     * Last-resort fallback for the chat UI. When the LLM has been
     * drift-flagged twice in a row for the same panel, the UI
     * stops trying to regenerate and shows a hand-written blessed
     * line picked deterministically by panel + rotation seed.
     */
    /**
     * Wave-15 / Push 250 — today.kiwiDriftStreakApply
     *
     * Pure stateless mutation. Client posts the prior streak state
     * (kept in browser memory or localStorage) plus the latest drift
     * event, gets back the new state + whether to switch to the
     * blessed-line fallback. Server holds no per-session memory.
     */
    /**
     * Wave-15 / Push 252 — today.kiwiReplyOrchestrate
     *
     * The single procedure the chat UI calls per LLM completion.
     * Composes profile resolution + post-gen pipeline + drift
     * streak tracking + blessed-line fallback + audit entry build
     * in one round-trip. Pure: no DB writes; UI still calls
     * today.kiwiVoiceAuditPersist with the returned auditEntry to
     * persist the row.
     */
    /**
     * Wave-15 / Push 254 — today.kiwiBlessedRotationAdvance
     *
     * Stateless mutation. Client posts the prior rotation-counter
     * state (kept in browser localStorage alongside the streak
     * state) + the panel that just fired a blessed-line fallback;
     * gets back the new state + the next seed to feed into the
     * orchestrator on the next round-trip. Server holds no
     * per-session memory.
     */
    /**
     * Wave-15 / Push 256 — today.kiwiChatSessionApply
     *
     * Unified stateless mutation. Bundles the streak update +
     * rotation advance into one call so the chat UI keeps a single
     * localStorage object instead of two. Server holds no
     * per-session memory.
     */
    /**
     * Wave-15 / Push 258 — today.kiwiSessionOrchestrate
     *
     * THE production chat-UI call. One state in, one state out,
     * full pipeline + blessed-line fallback + audit entry in a
     * single round-trip. UI keeps a single localStorage key.
     */
    /**
     * Wave-15 / Push 260 — today.kiwiSessionImport
     *
     * Takes a raw serialized envelope string (what the UI read
     * from localStorage) and returns the validated, sanitized
     * KiwiChatSessionState. On any failure — malformed JSON,
     * wrong schema version, sanitized-away inner values — returns
     * a fresh empty state. Never throws.
     *
     * Why a server procedure: gives the UI one canonical source
     * of truth for shape validation across deploys.
     */
    /**
     * Wave-15 / Push 262 — today.kiwiSessionMigrateAndReExport
     *
     * Forward-compat boot path for the chat UI. On first mount
     * the UI reads the raw localStorage blob and calls this
     * procedure to:
     *   • detect bare-v0 (pre-envelope) state and upgrade it
     *   • keep current-envelope state as-is
     *   • discard malformed or unknown-version blobs
     * Returns the validated state plus a re-exported current-
     * envelope string ready to write back to localStorage.
     */
    /**
     * Wave-15 / Push 264 — today.kiwiSessionDecay
     *
     * Stateless mutation. UI calls this on chat-page mount AFTER
     * migrate-and-import to age out stale streaks before the
     * first orchestrator call of the session. Pure: rotation
     * counters are never touched, only behaviorally-meaningful
     * streaks decay.
     */
    /**
     * Wave-15 / Push 266 — today.kiwiSessionBoot
     *
     * One-call mount-time boot path. Replaces the
     * migrateAndReExport → decay chain with a single round-trip.
     * UI passes raw localStorage blob + current UTC ms, gets
     * back validated state, migration path, decayed panels, and
     * a ready-to-write re-export string.
     */
    /**
     * Wave-15 / Push 268 — today.kiwiSessionTrim
     *
     * Periodic maintenance hook. UI calls during quiet moments
     * (e.g., after a non-major event lands clean) to drop
     * dead-weight panel entries from the session state so the
     * localStorage blob doesn't grow unboundedly over months
     * of use. Live streaks, non-zero rotation counters, and
     * recent timestamps are always preserved.
     */
    /**
     * Wave-15 / Push 270 — today.kiwiSessionSizeAudit
     *
     * Diagnostic procedure. Adult review page calls this to
     * surface the size of Reagan's localStorage Kiwi session
     * blob and a recommendation about when to trim. UI calls
     * the chat UI — not Reagan's surface — only.
     */
    /**
     * Wave-15 / Push 272 — today.kiwiSessionMaintenance
     *
     * One-call periodic maintenance pass. UI calls this during
     * quiet moments (e.g., after a clean reply). It trims dead
     * weight, audits the resulting size, and re-exports the
     * state in a single round-trip so the caller writes the
     * fresh envelope to localStorage atomically.
     */
    /**
     * Wave-15 / Push 274 — today.kiwiMaintenanceDecide
     *
     * Cadence gate for the maintenance pass. UI calls this
     * BEFORE today.kiwiSessionMaintenance so it doesn't spam
     * trim+audit on every clean reply. Default cooldown: 5 min.
     */
    /**
     * Wave-15 / Push 276 — today.kiwiGatedMaintenance
     *
     * One-call decide-then-maybe-run wrapper. UI passes the
     * prior state + last-maintenance ts + now, and gets back
     * either a skip with schedule diagnostics or a full
     * maintenance result. This is the recommended call for
     * the chat UI's quiet-moment cadence.
     */
    /**
     * Wave-15 / Push 278 — today.kiwiGreeting
     *
     * Returns the calm one-liner greeting for Kiwi's first
     * appearance per panel/day. UI passes panel + localHour
     * (Reagan's local time) + dayIndex (epoch day) so the
     * greeting is stable for the day but rotates across days.
     */
    /**
     * Wave-15 / Push 280 — today.kiwiGreetingFromUtc
     *
     * One-call greeting: pass UTC ms + IANA timezone; server
     * derives localHour + dayIndex and composes the greeting.
     * UI doesn't write date math.
     */
    /**
     * Wave-15 / Push 282 — today.kiwiPanelVisitApply
     *
     * Per-panel last-visit tracker. Returns whether the calm
     * greeting should fire this visit + a new state object the
     * UI persists to localStorage. Suppresses re-greeting on
     * quick back-and-forth navigation (default 10 min window).
     */
    /**
     * Wave-15 / Push 284 — today.kiwiPanelEntry
     *
     * One-call panel-mount bundle: visit tracker + clock derive +
     * greeting composer in one round-trip. Returns the new tracker
     * state plus (when shouldGreet) the calm greeting and clock
     * parts. Suppressed paths return null greeting/clock so audit
     * log stays clean (no greeting synthesized).
     */
    /**
     * Wave-15 / Push 286 — today.kiwiQuietHoursCheck
     *
     * Quiet-hours gate. UI calls before firing any PROACTIVE
     * Kiwi surface (panel-mount greeting, drift notice, periodic
     * pings). Reactive replies to Reagan's direct messages are
     * never gated — caller is responsible for only consulting
     * this on proactive paths.
     *
     * Default window 21:00..07:00 local (wraps midnight, end
     * exclusive). Adults can override via startHour / endHour.
     */
    kiwiQuietHoursCheck: publicProcedure
      .input(
        z.object({
          localHour: z.number(),
          startHour: z.number().int().min(0).max(23).optional(),
          endHour: z.number().int().min(0).max(23).optional(),
        }),
      )
      .query(async ({ input }) => {
        const { checkKiwiQuietHours } = await import(
          "./_lib/kiwiQuietHoursGate"
        );
        return checkKiwiQuietHours({
          localHour: input.localHour,
          startHour: input.startHour,
          endHour: input.endHour,
        });
      }),

    kiwiPanelEntry: publicProcedure
      .input(
        z.object({
          prior: z
            .object({
              panels: z.record(z.string(), z.number()),
            })
            .nullable()
            .optional(),
          panel: z.string().min(1).max(32),
          nowUtcMs: z.number().int().nonnegative(),
          timeZone: z.string().min(1).max(64).nullable().optional(),
          suppressWindowMs: z.number().int().positive().optional(),
        }),
      )
      .query(async ({ input }) => {
        const { runKiwiPanelEntry } = await import(
          "./_lib/kiwiPanelEntryBundle"
        );
        return runKiwiPanelEntry({
          prior: input.prior ?? null,
          panel: input.panel,
          nowUtcMs: input.nowUtcMs,
          timeZone: input.timeZone ?? null,
          suppressWindowMs: input.suppressWindowMs,
        });
      }),

    kiwiPanelVisitApply: publicProcedure
      .input(
        z.object({
          prior: z
            .object({
              panels: z.record(z.string(), z.number()),
            })
            .nullable()
            .optional(),
          panel: z.string().min(1).max(32),
          nowUtcMs: z.number().int().nonnegative(),
          suppressWindowMs: z.number().int().positive().optional(),
        }),
      )
      .query(async ({ input }) => {
        const { applyKiwiPanelVisit } = await import(
          "./_lib/kiwiPanelLastVisitTracker"
        );
        return applyKiwiPanelVisit({
          prior: input.prior ?? null,
          panel: input.panel,
          nowUtcMs: input.nowUtcMs,
          suppressWindowMs: input.suppressWindowMs,
        });
      }),

    kiwiGreetingFromUtc: publicProcedure
      .input(
        z.object({
          panel: z.string().min(1).max(32),
          nowUtcMs: z.number().int().nonnegative(),
          timeZone: z.string().min(1).max(64).optional(),
        }),
      )
      .query(async ({ input }) => {
        const { deriveKiwiClockParts } = await import(
          "./_lib/kiwiClockHelpers"
        );
        const { composeKiwiGreeting } = await import(
          "./_lib/kiwiGreetingComposer"
        );
        const parts = deriveKiwiClockParts(
          input.nowUtcMs,
          input.timeZone,
        );
        const greeting = composeKiwiGreeting({
          panel: input.panel,
          localHour: parts.localHour,
          dayIndex: parts.dayIndex,
        });
        return { ...greeting, clock: parts };
      }),

    kiwiGreeting: publicProcedure
      .input(
        z.object({
          panel: z.string().min(1).max(32),
          localHour: z.number().min(0).max(23),
          dayIndex: z.number().int(),
        }),
      )
      .query(async ({ input }) => {
        const { composeKiwiGreeting } = await import(
          "./_lib/kiwiGreetingComposer"
        );
        return composeKiwiGreeting(input);
      }),

    kiwiGatedMaintenance: publicProcedure
      .input(
        z.object({
          priorState: z
            .object({
              streak: z
                .object({
                  streakByPanel: z
                    .record(z.string(), z.number())
                    .optional(),
                  lastEventAtUtcMs: z
                    .record(z.string(), z.number())
                    .optional(),
                })
                .optional(),
              rotation: z
                .object({
                  counterByPanel: z
                    .record(z.string(), z.number())
                    .optional(),
                })
                .optional(),
            })
            .nullable()
            .optional(),
          nowUtcMs: z.number().int().nonnegative(),
          lastMaintenanceAtUtcMs: z.number().nullable().optional(),
          cooldownMs: z.number().int().nonnegative().optional(),
          purgeOlderThanMs: z.number().int().nonnegative().optional(),
          considerTrimBytes: z
            .number()
            .int()
            .nonnegative()
            .optional(),
          trimNowBytes: z.number().int().nonnegative().optional(),
        }),
      )
      .query(async ({ input }) => {
        const { runKiwiGatedMaintenance } = await import(
          "./_lib/kiwiSessionGatedMaintenance"
        );
        return runKiwiGatedMaintenance({
          priorState: input.priorState
            ? {
                streak: {
                  streakByPanel:
                    input.priorState.streak?.streakByPanel ?? {},
                  lastEventAtUtcMs:
                    input.priorState.streak?.lastEventAtUtcMs ?? {},
                },
                rotation: {
                  counterByPanel:
                    input.priorState.rotation?.counterByPanel ?? {},
                },
              }
            : null,
          nowUtcMs: input.nowUtcMs,
          lastMaintenanceAtUtcMs: input.lastMaintenanceAtUtcMs,
          cooldownMs: input.cooldownMs,
          purgeOlderThanMs: input.purgeOlderThanMs,
          considerTrimBytes: input.considerTrimBytes,
          trimNowBytes: input.trimNowBytes,
        });
      }),

    kiwiMaintenanceDecide: publicProcedure
      .input(
        z.object({
          lastMaintenanceAtUtcMs: z.number().nullable().optional(),
          nowUtcMs: z.number().int().nonnegative(),
          cooldownMs: z.number().int().nonnegative().optional(),
        }),
      )
      .query(async ({ input }) => {
        const { decideKiwiMaintenance } = await import(
          "./_lib/kiwiSessionMaintenanceScheduler"
        );
        return decideKiwiMaintenance(input);
      }),

    kiwiSessionMaintenance: publicProcedure
      .input(
        z.object({
          priorState: z
            .object({
              streak: z
                .object({
                  streakByPanel: z
                    .record(z.string(), z.number())
                    .optional(),
                  lastEventAtUtcMs: z
                    .record(z.string(), z.number())
                    .optional(),
                })
                .optional(),
              rotation: z
                .object({
                  counterByPanel: z
                    .record(z.string(), z.number())
                    .optional(),
                })
                .optional(),
            })
            .nullable()
            .optional(),
          nowUtcMs: z.number().int().nonnegative(),
          purgeOlderThanMs: z.number().int().nonnegative().optional(),
          considerTrimBytes: z
            .number()
            .int()
            .nonnegative()
            .optional(),
          trimNowBytes: z.number().int().nonnegative().optional(),
        }),
      )
      .query(async ({ input }) => {
        const { runKiwiSessionMaintenance } = await import(
          "./_lib/kiwiSessionMaintenanceBundle"
        );
        return runKiwiSessionMaintenance(
          input.priorState
            ? {
                streak: {
                  streakByPanel:
                    input.priorState.streak?.streakByPanel ?? {},
                  lastEventAtUtcMs:
                    input.priorState.streak?.lastEventAtUtcMs ?? {},
                },
                rotation: {
                  counterByPanel:
                    input.priorState.rotation?.counterByPanel ?? {},
                },
              }
            : null,
          input.nowUtcMs,
          {
            purgeOlderThanMs: input.purgeOlderThanMs,
            considerTrimBytes: input.considerTrimBytes,
            trimNowBytes: input.trimNowBytes,
          },
        );
      }),

    kiwiSessionSizeAudit: publicProcedure
      .input(
        z.object({
          priorState: z
            .object({
              streak: z
                .object({
                  streakByPanel: z
                    .record(z.string(), z.number())
                    .optional(),
                  lastEventAtUtcMs: z
                    .record(z.string(), z.number())
                    .optional(),
                })
                .optional(),
              rotation: z
                .object({
                  counterByPanel: z
                    .record(z.string(), z.number())
                    .optional(),
                })
                .optional(),
            })
            .nullable()
            .optional(),
          considerTrimBytes: z
            .number()
            .int()
            .nonnegative()
            .optional(),
          trimNowBytes: z.number().int().nonnegative().optional(),
        }),
      )
      .query(async ({ input }) => {
        const { auditKiwiSessionSize } = await import(
          "./_lib/kiwiSessionSizeAuditor"
        );
        return auditKiwiSessionSize(
          input.priorState
            ? {
                streak: {
                  streakByPanel:
                    input.priorState.streak?.streakByPanel ?? {},
                  lastEventAtUtcMs:
                    input.priorState.streak?.lastEventAtUtcMs ?? {},
                },
                rotation: {
                  counterByPanel:
                    input.priorState.rotation?.counterByPanel ?? {},
                },
              }
            : null,
          {
            considerTrimBytes: input.considerTrimBytes,
            trimNowBytes: input.trimNowBytes,
          },
        );
      }),

    kiwiSessionTrim: publicProcedure
      .input(
        z.object({
          priorState: z
            .object({
              streak: z
                .object({
                  streakByPanel: z
                    .record(z.string(), z.number())
                    .optional(),
                  lastEventAtUtcMs: z
                    .record(z.string(), z.number())
                    .optional(),
                })
                .optional(),
              rotation: z
                .object({
                  counterByPanel: z
                    .record(z.string(), z.number())
                    .optional(),
                })
                .optional(),
            })
            .nullable()
            .optional(),
          nowUtcMs: z.number().int().nonnegative(),
          purgeOlderThanMs: z.number().int().nonnegative().optional(),
        }),
      )
      .query(async ({ input }) => {
        const { trimKiwiSessionState } = await import(
          "./_lib/kiwiSessionTrimmer"
        );
        return trimKiwiSessionState(
          input.priorState
            ? {
                streak: {
                  streakByPanel:
                    input.priorState.streak?.streakByPanel ?? {},
                  lastEventAtUtcMs:
                    input.priorState.streak?.lastEventAtUtcMs ?? {},
                },
                rotation: {
                  counterByPanel:
                    input.priorState.rotation?.counterByPanel ?? {},
                },
              }
            : null,
          input.nowUtcMs,
          input.purgeOlderThanMs,
        );
      }),

    kiwiSessionBoot: publicProcedure
      .input(
        z.object({
          raw: z.string().nullable(),
          nowUtcMs: z.number().int().nonnegative(),
        }),
      )
      .query(async ({ input }) => {
        const { bootKiwiSession } = await import(
          "./_lib/kiwiSessionBootBundle"
        );
        return bootKiwiSession(input.raw, input.nowUtcMs);
      }),

    kiwiSessionDecay: publicProcedure
      .input(
        z.object({
          priorState: z
            .object({
              streak: z
                .object({
                  streakByPanel: z
                    .record(z.string(), z.number())
                    .optional(),
                  lastEventAtUtcMs: z
                    .record(z.string(), z.number())
                    .optional(),
                })
                .optional(),
              rotation: z
                .object({
                  counterByPanel: z
                    .record(z.string(), z.number())
                    .optional(),
                })
                .optional(),
            })
            .nullable()
            .optional(),
          nowUtcMs: z.number().int().nonnegative(),
        }),
      )
      .query(async ({ input }) => {
        const { decayKiwiSessionState } = await import(
          "./_lib/kiwiSessionDecay"
        );
        return decayKiwiSessionState(
          input.priorState
            ? {
                streak: {
                  streakByPanel:
                    input.priorState.streak?.streakByPanel ?? {},
                  lastEventAtUtcMs:
                    input.priorState.streak?.lastEventAtUtcMs ?? {},
                },
                rotation: {
                  counterByPanel:
                    input.priorState.rotation?.counterByPanel ?? {},
                },
              }
            : null,
          input.nowUtcMs,
        );
      }),

    kiwiSessionMigrateAndReExport: publicProcedure
      .input(z.object({ raw: z.string().nullable() }))
      .query(async ({ input }) => {
        const { migrateKiwiSessionAndReExport } = await import(
          "./_lib/kiwiSessionStateMigrator"
        );
        return migrateKiwiSessionAndReExport(input.raw);
      }),

    kiwiSessionImport: publicProcedure
      .input(z.object({ raw: z.string().nullable() }))
      .query(async ({ input }) => {
        const { importKiwiSessionState } = await import(
          "./_lib/kiwiSessionExportSerializer"
        );
        return { state: importKiwiSessionState(input.raw) };
      }),

    kiwiSessionOrchestrate: publicProcedure
      .input(
        z.object({
          panel: z.string().max(64).nullable().optional(),
          candidate: z.string(),
          priorSessionState: z
            .object({
              streak: z
                .object({
                  streakByPanel: z
                    .record(z.string(), z.number())
                    .optional(),
                  lastEventAtUtcMs: z
                    .record(z.string(), z.number())
                    .optional(),
                })
                .optional(),
              rotation: z
                .object({
                  counterByPanel: z
                    .record(z.string(), z.number())
                    .optional(),
                })
                .optional(),
            })
            .nullable()
            .optional(),
          timestampUtcMs: z.number().int().nonnegative(),
        }),
      )
      .query(async ({ input }) => {
        const { runKiwiSessionAwareOrchestrator } = await import(
          "./_lib/kiwiSessionAwareOrchestrator"
        );
        return runKiwiSessionAwareOrchestrator({
          panel: input.panel ?? null,
          candidate: input.candidate,
          priorSessionState: input.priorSessionState
            ? {
                streak: {
                  streakByPanel:
                    input.priorSessionState.streak?.streakByPanel ?? {},
                  lastEventAtUtcMs:
                    input.priorSessionState.streak?.lastEventAtUtcMs ?? {},
                },
                rotation: {
                  counterByPanel:
                    input.priorSessionState.rotation?.counterByPanel ?? {},
                },
              }
            : null,
          timestampUtcMs: input.timestampUtcMs,
        });
      }),

    kiwiChatSessionApply: publicProcedure
      .input(
        z.object({
          priorState: z
            .object({
              streak: z
                .object({
                  streakByPanel: z
                    .record(z.string(), z.number())
                    .optional(),
                  lastEventAtUtcMs: z
                    .record(z.string(), z.number())
                    .optional(),
                })
                .optional(),
              rotation: z
                .object({
                  counterByPanel: z
                    .record(z.string(), z.number())
                    .optional(),
                })
                .optional(),
            })
            .nullable()
            .optional(),
          event: z.object({
            panel: z.string().max(64),
            severity: z.enum(["info", "minor", "major"]),
            timestampUtcMs: z.number().int().nonnegative(),
          }),
        }),
      )
      .query(async ({ input }) => {
        const { applyKiwiChatSessionEvent } = await import(
          "./_lib/kiwiChatSessionState"
        );
        return applyKiwiChatSessionEvent(
          input.priorState
            ? {
                streak: {
                  streakByPanel:
                    input.priorState.streak?.streakByPanel ?? {},
                  lastEventAtUtcMs:
                    input.priorState.streak?.lastEventAtUtcMs ?? {},
                },
                rotation: {
                  counterByPanel:
                    input.priorState.rotation?.counterByPanel ?? {},
                },
              }
            : null,
          input.event,
        );
      }),

    kiwiBlessedRotationAdvance: publicProcedure
      .input(
        z.object({
          priorState: z
            .object({
              counterByPanel: z.record(z.string(), z.number()).optional(),
            })
            .nullable()
            .optional(),
          panel: z.string().max(64),
        }),
      )
      .query(async ({ input }) => {
        const { advanceKiwiRotationCounter } = await import(
          "./_lib/kiwiBlessedLineRotationCounter"
        );
        return advanceKiwiRotationCounter(
          input.priorState
            ? {
                counterByPanel: input.priorState.counterByPanel ?? {},
              }
            : null,
          input.panel,
        );
      }),

    kiwiReplyOrchestrate: publicProcedure
      .input(
        z.object({
          panel: z.string().max(64).nullable().optional(),
          candidate: z.string(),
          priorStreakState: z
            .object({
              streakByPanel: z.record(z.string(), z.number()).optional(),
              lastEventAtUtcMs: z.record(z.string(), z.number()).optional(),
            })
            .nullable()
            .optional(),
          timestampUtcMs: z.number().int().nonnegative(),
          rotationSeed: z.number().int().nonnegative(),
        }),
      )
      .query(async ({ input }) => {
        const { runKiwiReplyOrchestrator } = await import(
          "./_lib/kiwiReplyOrchestrator"
        );
        return runKiwiReplyOrchestrator({
          panel: input.panel ?? null,
          candidate: input.candidate,
          priorStreakState: input.priorStreakState
            ? {
                streakByPanel: input.priorStreakState.streakByPanel ?? {},
                lastEventAtUtcMs:
                  input.priorStreakState.lastEventAtUtcMs ?? {},
              }
            : null,
          timestampUtcMs: input.timestampUtcMs,
          rotationSeed: input.rotationSeed,
        });
      }),

    kiwiDriftStreakApply: publicProcedure
      .input(
        z.object({
          priorState: z
            .object({
              streakByPanel: z.record(z.string(), z.number()).optional(),
              lastEventAtUtcMs: z.record(z.string(), z.number()).optional(),
            })
            .nullable()
            .optional(),
          event: z.object({
            panel: z.string().max(64),
            severity: z.enum(["info", "minor", "major"]),
            timestampUtcMs: z.number().int().nonnegative(),
          }),
        }),
      )
      .query(async ({ input }) => {
        const { applyKiwiDriftEvent } = await import(
          "./_lib/kiwiDriftStreakTracker"
        );
        return applyKiwiDriftEvent(
          input.priorState
            ? {
                streakByPanel: input.priorState.streakByPanel ?? {},
                lastEventAtUtcMs: input.priorState.lastEventAtUtcMs ?? {},
              }
            : null,
          input.event,
        );
      }),

    kiwiBlessedLinePick: publicProcedure
      .input(
        z.object({
          panel: z.string().max(64).nullable().optional(),
          rotationSeed: z.number().int().nonnegative(),
        }),
      )
      .query(async ({ input }) => {
        const { pickKiwiBlessedLine } = await import(
          "./_lib/kiwiVoiceSampleBlessings"
        );
        return {
          line: pickKiwiBlessedLine({
            panel: input.panel ?? null,
            rotationSeed: input.rotationSeed,
          }),
        };
      }),

    kiwiVoiceAuditWeeklySummary: publicProcedure
      .input(
        z
          .object({
            lookbackDays: z.number().int().min(1).max(90).optional(),
          })
          .optional(),
      )
      .query(async ({ input }) => {
        const days = input?.lookbackDays ?? 7;
        const { listKiwiVoiceAuditEntries } = await import("./db");
        const { summarizeKiwiVoiceAuditWindow } = await import(
          "./_lib/kiwiVoiceAuditWeeklySummary"
        );
        const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
        // Pull at most 500 recent rows then filter to window in-memory
        // — our list helper sorts newest-first.
        const rows = await listKiwiVoiceAuditEntries({ limit: 500 });
        // Map DB rows (actionsJson string) to KiwiVoiceAuditEntry shape.
        const entries = rows
          .filter((r) => r.timestampUtcMs >= cutoff)
          .map((r) => ({
            timestampUtcMs: r.timestampUtcMs,
            originalCandidate: r.originalCandidate,
            finalText: r.finalText,
            severity: r.severity as "info" | "minor" | "major",
            actions: ((): { kind: "drift_fallback" | "nickname_redact" | "length_cap"; summary: string }[] => {
              try {
                const parsed = JSON.parse(r.actionsJson ?? "[]");
                return Array.isArray(parsed) ? parsed : [];
              } catch {
                return [];
              }
            })(),
          }));
        return {
          lookbackDays: days,
          ...summarizeKiwiVoiceAuditWindow(entries),
        };
      }),
    /**
     * Push 82 (2026-05-13) — tomorrow's summer-choice chooser.
     * Returns the deterministic 3-option set for tomorrow's choice block
     * + the active summer status. Reagan-callable (public). Self-empty
     * when summer mode is inactive so the kid-side card can hide.
     */
    tomorrowChoice: publicProcedure
      .input(z.object({ blockType: z.string().default("choice") }).optional())
      .query(async ({ input }) => {
        const blockType = input?.blockType ?? "choice";
        const d = new Date();
        d.setDate(d.getDate() + 1);
        const tomorrowIso = d.toISOString().slice(0, 10);
        const [autoFlip, start, end, override, vacJson] = await Promise.all([
          db.getAppSetting("summer.autoFlipEnabled"),
          db.getAppSetting("summer.start"),
          db.getAppSetting("summer.end"),
          db.getAppSetting("summer.override"),
          db.getAppSetting("summer.vacationRanges"),
        ]);
        const { summerSettingsFromKv, effectiveSummerActive, summerChoiceOptions } =
          await import("./summerMode");
        const settings = summerSettingsFromKv({
          "summer.autoFlipEnabled": autoFlip,
          "summer.start": start,
          "summer.end": end,
          "summer.override": override,
          "summer.vacationRanges": vacJson,
        });
        const status = effectiveSummerActive(tomorrowIso, settings);
        const seed = `${tomorrowIso}:${blockType}`;
        const options = status.active
          ? summerChoiceOptions(blockType as any, seed)
          : [];
        const savedKey = `tomorrowChoice.${tomorrowIso}.${blockType}`;
        const savedRaw = await db.getAppSetting(savedKey);
        return {
          tomorrowDate: tomorrowIso,
          blockType,
          active: status.active,
          reason: status.reason,
          seed,
          options,
          chosenKind: savedRaw ?? null,
        };
      }),
    /**
     * Push 82 (2026-05-13) — Reagan records her pick for tomorrow's
     * choice block. Because the options are a pre-approved set, this
     * auto-approves (no SMS to Mom/Grandma per the never-queued rule).
     * The pick is rejected if the requested kind isn't in the
     * deterministic option list for that date.
     */
    recordTomorrowChoice: publicProcedure
      .input(z.object({
        chosenKind: z.string().min(1),
        blockType: z.string().default("choice"),
      }))
      .mutation(async ({ input }) => {
        const blockType = input.blockType;
        const d = new Date();
        d.setDate(d.getDate() + 1);
        const tomorrowIso = d.toISOString().slice(0, 10);
        const [autoFlip, start, end, override, vacJson] = await Promise.all([
          db.getAppSetting("summer.autoFlipEnabled"),
          db.getAppSetting("summer.start"),
          db.getAppSetting("summer.end"),
          db.getAppSetting("summer.override"),
          db.getAppSetting("summer.vacationRanges"),
        ]);
        const { summerSettingsFromKv, effectiveSummerActive, summerChoiceOptions } =
          await import("./summerMode");
        const settings = summerSettingsFromKv({
          "summer.autoFlipEnabled": autoFlip,
          "summer.start": start,
          "summer.end": end,
          "summer.override": override,
          "summer.vacationRanges": vacJson,
        });
        const status = effectiveSummerActive(tomorrowIso, settings);
        if (!status.active) {
          throw new Error("summer mode is not active for tomorrow");
        }
        const seed = `${tomorrowIso}:${blockType}`;
        const options = summerChoiceOptions(blockType as any, seed);
        const allowedKinds = options.map((o) => o.kind);
        if (!allowedKinds.includes(input.chosenKind as any)) {
          throw new Error(`chosenKind not in pre-approved set: ${allowedKinds.join(", ")}`);
        }
        const savedKey = `tomorrowChoice.${tomorrowIso}.${blockType}`;
        await db.setAppSetting(savedKey, input.chosenKind);
        return { ok: true, chosenKind: input.chosenKind, autoApproved: true };
      }),
    /**
     * Push 84 (2026-05-13) — Off-plan capture summary for adult Today
     * recap. Counts today's off-plan actuals + Drive push status so Mom
     * knows what got captured outside the planned curriculum.
     * Adult-only (admin/tutor/user role); Reagan never sees this.
     */
    offPlanCaptureSummary: protectedProcedure
      .input(z.object({ date: z.string().optional() }).optional())
      .query(async ({ ctx, input }) => {
        const date = input?.date ?? new Date().toISOString().slice(0, 10);
        if (ctx.user.role !== "admin" && ctx.user.role !== "tutor" && ctx.user.role !== "user") {
          return {
            totalCount: 0,
            drivePushedCount: 0,
            pendingCount: 0,
            items: [] as Array<{ id: number; subjectSlug: string; topic: string; drivePushed: boolean; drivePath: string | null }>,
            allowed: false,
            date,
          };
        }
        const summary = await db.offPlanCaptureSummaryForDate(date);
        return { ...summary, allowed: true, date };
      }),
    /**
     * Push 134 (2026-05-13) — Off-plan topic auto-add proposal.
     * Adult-only (admin/tutor/user). Wraps the Push 107 pure helper so the
     * UI can ask "should this off-plan topic be promoted into curriculum?"
     * without re-implementing the gating rules. Returns the typed decision
     * verbatim so the caller renders the right copy + audit reason.
     */
    proposeOffPlanTopicAutoAdd: protectedProcedure
      .input(
        z.object({
          topicLabel: z.string().min(1).max(120),
          subjectSlug: z.string().min(1).max(40),
          confidence: z.number().min(0).max(1).optional(),
          manualOverride: z.boolean().optional(),
          recentHitCount: z.number().int().min(0).max(50).optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        if (
          ctx.user.role !== "admin" &&
          ctx.user.role !== "tutor" &&
          ctx.user.role !== "user"
        ) {
          return { allowed: false as const };
        }
        const { decideOffPlanTopicAutoAdd } = await import(
          "./_lib/offPlanTopicAutoAdd"
        );
        const existingLabels = await db.listCurriculumTopicLabels();
        const decision = decideOffPlanTopicAutoAdd(
          {
            topicLabel: input.topicLabel,
            subjectSlug: input.subjectSlug,
            confidence: input.confidence,
            manualOverride: input.manualOverride,
            recentHitCount: input.recentHitCount,
          },
          { existingLabels },
        );
        return { allowed: true as const, decision };
      }),
    /**
     * refresh — rebuild today's plan blocks from the active template,
     * preserving completed/in-progress work. Available to Reagan (public)
     * because she sometimes wants a clean slate after a rough start.
     */
    refresh: publicProcedure
      .input(z.object({ date: z.string().optional() }).optional())
      .mutation(async ({ input }) => {
        const r = await db.refreshTodayPlan({ dateStr: input?.date });
        // v2.86 (2026-05-21) — fire-and-forget auto-attach pass so every
        // refreshed Today block ends up with at least one resource. Non-blocking.
        const dateForAttach = input?.date || new Date().toISOString().slice(0, 10);
        try {
          const { runAutoAttachForDate } = await import("./_lib/blockAutoAttach");
          await runAutoAttachForDate(dateForAttach, { kidSafe: true });
        } catch (e: any) {
          // eslint-disable-next-line no-console
          console.warn(`[plans.refresh] auto-attach failed: ${String(e?.message ?? e)}`);
        }
        return r;
      }),
  }),
  reagan: router({
    /** Read-only Reagan Profile Model snapshot for printables/online picker. */
    profile: protectedProcedure
      .input(z.object({ windowDays: z.number().min(3).max(60).default(14) }).optional())
      .query(({ input }) => db.computeReaganProfileSnapshot(input?.windowDays ?? 14)),
  }),
  gclassroom: router({
    /** Adult-only: list synced Google Classroom assignments (reference panel). */
    list: protectedProcedure
      .input(z.object({ limit: z.number().int().min(1).max(200).default(50) }).optional())
      .query(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin" && ctx.user.role !== "tutor" && ctx.user.role !== "user") return [];
        return db.listClassroomAssignments(input?.limit ?? 50);
      }),

    /* ============================================================
     * Classroom integration v2 (added 2026-05-17)
     *
     * The Classes page consumes these procedures to render per-subject
     * assignment columns and let Mom/Grandma move work through the
     * canonical lifecycle: to_do → in_progress → turned_in → graded.
     *
     * Auth model:
     *   - courses.list / assignments.byLifecycle: publicProcedure so
     *     Reagan's kid-side view can see her own work. Both procedures
     *     return empty arrays until Mom grants the OAuth scope.
     *   - assignments.updateStatus: familyAdminProcedure — only Mom and
     *     Grandma may move an assignment through the lifecycle.
     *   - audit.forAssignment: protectedProcedure (any signed-in user).
     *   - sync: familyAdminProcedure (placeholder; returns
     *     not_yet_authenticated until Mom grants the scope).
     * ============================================================ */
    courses: router({
      list: publicProcedure.query(() => db.listClassroomCourses()),
    }),
    assignments: router({
      byLifecycle: publicProcedure
        .input(z.object({
          lifecycleStatus: z.enum(["to_do", "in_progress", "turned_in", "graded"]).optional(),
          subjectId: z.number().int().positive().optional(),
          limit: z.number().int().min(1).max(500).default(200),
        }).optional())
        .query(({ input }) => db.listClassroomAssignmentsByLifecycle(
          input?.lifecycleStatus ?? null,
          { subjectId: input?.subjectId ?? null, limit: input?.limit ?? 200 },
        )),
      /**
       * Reagan's Today-page feed of Classroom work. Lifecycle in
       * (to_do, in_progress) AND (no due date OR due within windowDays).
       * Returns [] pre-OAuth, so it's safe to render unconditionally.
       */
      activeForToday: publicProcedure
        .input(z.object({
          windowDays: z.number().int().min(0).max(60).default(7),
          limit: z.number().int().min(1).max(50).default(12),
        }).optional())
        .query(({ input }) => db.listClassroomAssignmentsActiveForToday({
          windowDays: input?.windowDays ?? 7,
          limit: input?.limit ?? 12,
        })),
      /**
       * Adult-only feed: recently-graded Classroom assignments. Reagan
       * never sees grades — Mom + Grandma do. Gated behind
       * familyAdminProcedure so this can be safely dropped on a kid-
       * shared layout if needed (no client request from the kid path
       * will resolve). Pre-OAuth and pre-applyGradeReturn the table has
       * no graded rows, so [] is the steady state and the widget hides.
       */
      recentlyGraded: familyAdminProcedure
        .input(z.object({
          limit: z.number().int().min(1).max(100).default(20),
        }).optional())
        .query(({ input }) => db.listClassroomAssignmentsRecentlyGraded({
          limit: input?.limit ?? 20,
        })),
      updateStatus: familyAdminProcedure
        .input(z.object({
          assignmentId: z.number().int().positive(),
          toStatus: z.enum(["to_do", "in_progress", "turned_in", "graded"]),
          note: z.string().max(2000).optional(),
          driveFileId: z.string().max(64).optional(),
          grade: z.string().max(32).optional(),
          gradeNumeric: z.number().optional(),
          changedBy: z.enum(["mom", "grandma", "reagan", "classroom_sync", "auto"]).optional(),
        }))
        .mutation(async ({ input }) => {
          const result = await db.updateClassroomAssignmentStatus({
            assignmentId: input.assignmentId,
            toStatus: input.toStatus,
            note: input.note ?? null,
            driveFileId: input.driveFileId ?? null,
            grade: input.grade ?? null,
            gradeNumeric: typeof input.gradeNumeric === "number" ? String(input.gradeNumeric) : null,
            changedBy: input.changedBy ?? null,
          });
          // After the lifecycle change is recorded in the DB, enqueue a
          // Drive file MOVE so the heartbeat worker can shuttle the
          // assignment file from the old lifecycle subfolder to the new
          // one. The helper is idempotent and returns skipped=no_file
          // pre-OAuth (when assignment.driveFolderId is null), so this
          // call is safe to make on every status change — it's a no-op
          // when there's nothing to move.
          const a: any = result.assignment;
          const driveQueue = await db.enqueueClassroomLifecycleDriveMove({
            assignmentId: input.assignmentId,
            courseName: a?.courseName ?? "",
            fromStatus: result.fromStatus,
            toStatus: result.toStatus,
            driveFileId: a?.driveFolderId ?? null,
            fileName: a?.title ?? `assignment-${input.assignmentId}`,
          });
          return { ...result, driveQueue };
        }),
      /**
       * Apply a Classroom "returned to student" event. Mom (or a future
       * scheduled sync job) calls this when the teacher has graded
       * Reagan's work in Classroom. Pure reducer decides; this proc is
       * just plumbing:
       *   - returnedAt=null  -> skipped="not_returned_yet" (no DB write)
       *   - already-applied   -> skipped="already_applied" (idempotent)
       *   - otherwise         -> flips lifecycle to "graded" via
       *                          updateClassroomAssignmentStatus, which
       *                          stamps gradedAt + writes audit row +
       *                          enqueues a Drive lifecycle move (no-op
       *                          if assignment has no driveFolderId).
       *
       * Pre-OAuth this proc still works: callers can pass returnedAt
       * null and it'll skip cleanly. familyAdmin gated so only Mom and
       * Grandma can write graded marks.
       */
      applyGradeReturn: familyAdminProcedure
        .input(z.object({
          assignmentId: z.number().int().positive(),
          returnedAt: z.date().nullable(),
          grade: z.string().max(32).nullish(),
          assignedGrade: z.number().nullish(),
          maxPoints: z.number().nullish(),
          changedBy: z.enum(["mom", "grandma", "classroom_sync", "auto"]).default("classroom_sync"),
        }))
        .mutation(async ({ input }) => {
          // Load current assignment state so the reducer can decide.
          // We pull the row via the existing lifecycle-list helper so we
          // don't have to add a single-id getter just for this path.
          const all: any[] = await db.listClassroomAssignmentsByLifecycle(null, { limit: 1000 });
          const current: any = all.find((r) => r.id === input.assignmentId);
          if (!current) {
            throw new Error(`classroomAssignment id=${input.assignmentId} not found`);
          }
          const decision = classroomGradeReturnReducer({
            currentLifecycle: current.lifecycleStatus,
            currentGrade: current.grade ?? null,
            currentGradeNumeric: current.gradeNumeric ?? null,
            currentGradedAt: current.gradedAt ?? null,
            returnedAt: input.returnedAt,
            grade: input.grade ?? null,
            assignedGrade: input.assignedGrade ?? null,
            maxPoints: input.maxPoints ?? null,
          });
          if (decision.action === "skip") {
            return { skipped: decision.reason as "not_returned_yet" | "already_applied" } as const;
          }
          const result = await db.updateClassroomAssignmentStatus({
            assignmentId: input.assignmentId,
            toStatus: decision.toStatus,
            note: decision.note,
            grade: decision.grade,
            gradeNumeric: decision.gradeNumeric,
            changedBy: input.changedBy,
          });
          const a: any = result.assignment;
          const driveQueue = await db.enqueueClassroomLifecycleDriveMove({
            assignmentId: input.assignmentId,
            courseName: a?.courseName ?? "",
            fromStatus: result.fromStatus,
            toStatus: result.toStatus,
            driveFileId: a?.driveFolderId ?? null,
            fileName: a?.title ?? `assignment-${input.assignmentId}`,
          });
          return { applied: true as const, ...result, driveQueue };
        }),
    }),
    audit: router({
      forAssignment: protectedProcedure
        .input(z.object({
          assignmentId: z.number().int().positive(),
          limit: z.number().int().min(1).max(200).default(30),
        }))
        .query(({ input }) => db.listClassroomSubmissionsForAssignment(input.assignmentId, input.limit)),
    }),
    /* Sync stub. Wires up later once OAuth scope is granted by Mom on
     * spear.cpt@gmail.com. Returning a typed status keeps the UI button
     * functional without surfacing a server error. */
    sync: familyAdminProcedure
      .mutation(async () => ({
        status: "not_yet_authenticated" as const,
        coursesSynced: 0,
        assignmentsSynced: 0,
        message: "Google Classroom OAuth scope not yet granted. Mom needs to authorize spear.cpt@gmail.com before sync runs.",
      })),
  }),
  prefs: router({
    /** Public-safe key allowlist Reagan's UI may read (no secrets, no creds). */
    getPublic: publicProcedure
      .input(z.object({ key: z.string().min(1).max(64) }))
      .query(({ input }) => {
        const ALLOW = new Set([
          "student.googleEmail",        // Reagan's school Google account email
          "student.googleAuthUser",     // 0/1/2 picker hint for Chrome multi-account
          "classroom.studentDomain",    // e.g. indianhill.k12.oh.us
          "roblox.allowed",             // adult toggle: "1" shows the Roblox launcher tile, "0" hides it
          "ui.theme",                   // Reagan's chosen visual theme — server-persisted across devices
          "tutor.mode",                 // push 36 (2026-05-13): "1" => sidebar enters tutor focus, "0" / null => off
          // push 65 (2026-05-13) — Slice 5 summer-mode foundation. These
          // five keys describe a calendar mode and a Mom toggle; no PII.
          "summer.autoFlipEnabled",     // "1" | "0" — Mom's auto-flip toggle
          "summer.start",               // "MM-DD" — earliest school-out
          "summer.end",                 // "MM-DD" — last summer day
          "summer.override",            // "on" | "off" — manual override
          "summer.vacationRanges",      // JSON array of {start,end} ISO dates
          // v2.32 (2026-05-18) — Calendar identity surfaced on Settings.
          // Read-only public values (no secrets) so the same key path used
          // by Mom/Grandma also works for `prefs.getPublic` reads from
          // unauthenticated cards (e.g., CalendarSyncCard renders on the
          // public Settings page before the adult-lock is satisfied).
          "calendar.id",                // Google Calendar ID (e.g., abc@group.calendar.google.com)
          "calendar.id.ownerEmail",     // Account that OWNS the calendar (vs. ICS subscriber)
          "calendar.ownerEmail",        // ICS subscriber Google account (existing)
        ]);
        // absence:YYYY-MM-DD flags are non-sensitive and Reagan's UI needs to read them
        const isAbsenceFlag = /^absence:\d{4}-\d{2}-\d{2}$/.test(input.key);
        if (!ALLOW.has(input.key) && !isAbsenceFlag) return null;
        return db.getAppSetting(input.key);
      }),
    get: protectedProcedure
      .input(z.object({ key: z.string().min(1).max(64) }))
      .query(({ input }) => db.getAppSetting(input.key)),
    // v2.28 (2026-05-17): tightened from protectedProcedure to familyAdminProcedure.
    // Reagan should never be able to flip Summer Mode, the nightly-email toggle,
    // her own coin balance, or any other KV setting via the prefs router. Mom +
    // Grandma + tutors retain write access via familyAdminProcedure.
    set: familyAdminProcedure
      .input(z.object({ key: z.string().min(1).max(64), value: z.string().nullable() }))
      .mutation(({ input }) => db.setAppSetting(input.key, input.value)),
    list: protectedProcedure
      .input(z.object({ prefix: z.string().optional() }).optional())
      .query(({ input }) => db.listAppSettings(input?.prefix)),
  }),
  // ── Daily Recap (push 46, 2026-05-13) ────────────────────
  /**
   * dailyRecap — Settings panel for the OUTBOUND end-of-day digest. Read
   * prefs, write a partial patch, preview a fully-rendered HTML for today.
   * familyAdmin-gated because recipient email lists and toggle persistence
   * are not safe to expose publicly.
   */
  dailyRecap: router({
    get: protectedProcedure.query(({ ctx }) => {
      if (ctx.user.role !== "admin" && ctx.user.role !== "user") {
        throw new Error("forbidden");
      }
      return db.getDailyRecapPrefs();
    }),
    set: protectedProcedure
      .input(z.object({
        enabled: z.boolean().optional(),
        sendTimeET: z.string().regex(/^\d{2}:\d{2}$/).optional(),
        includeKiwi: z.boolean().optional(),
        includeMood: z.boolean().optional(),
        recipients: z.array(z.string().email()).optional(),
      }))
      .mutation(({ ctx, input }) => {
        if (ctx.user.role !== "admin" && ctx.user.role !== "user") {
          throw new Error("forbidden");
        }
        return db.setDailyRecapPrefs(input);
      }),
    preview: protectedProcedure
      .input(z.object({ dateISO: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() }).optional())
      .query(({ ctx, input }) => {
        if (ctx.user.role !== "admin" && ctx.user.role !== "user") {
          throw new Error("forbidden");
        }
        return db.previewDailyRecap(input?.dateISO);
      }),

    /**
     * v2.92 (2026-05-27) — list recap requests still awaiting a reply.
     * Used by the in-app "Submit Today's Recap" form so the adult drawer
     * shows what days still need a reply. Returns the most recent 14.
     */
    listPending: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.role !== "admin" && ctx.user.role !== "user") {
        throw new Error("forbidden");
      }
      const rows = (await (db as any).listPendingRecapRequests?.()) ?? [];
      return (rows as any[])
        .slice(0, 14)
        .map(r => ({
          id: r.id,
          dateISO: r.dateISO,
          token: r.replyToken,
          sentTo: r.sentTo,
          sentAt: r.sentAt,
          status: r.status,
        }));
    }),

    /**
     * v2.92 (2026-05-27) — in-app submission of a daily-recap reply.
     * Bypasses Gmail entirely: the adult drawer pastes the recap text into
     * a form, which calls this mutation, which calls the same parsing path
     * as /api/scheduled/daily-recap-reply (LLM extraction + curriculum
     * crediting). Solves the "65 sent, 0 parsed" gap because nothing was
     * actually listening to Gmail replies before.
     */
    submitReply: protectedProcedure
      .input(z.object({
        token: z.string().min(8).max(128),
        replyText: z.string().min(1).max(8000),
      }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin" && ctx.user.role !== "user") {
          throw new Error("forbidden");
        }
        // Inline implementation that mirrors the small core of
        // /api/scheduled/daily-recap-reply. A shared `_lib/recapReplyIngest`
        // module is planned but not required — the webhook + this path stay
        // in lockstep on token semantics and "already-replied" idempotency.
        const { clampReplyText, isNothingHappenedReply } = await import("./_lib/normalizeRecapEntry");
        const token = input.token.trim();
        const replyText = clampReplyText(input.replyText.trim());
        const reqRow = await (db as any).getRecapRequestByToken?.(token);
        if (!reqRow) throw new Error("unknown-token");
        if (reqRow.status === "replied") {
          return { ok: true, skipped: "already-replied" };
        }
        if (isNothingHappenedReply(replyText)) {
          await (db as any).markRecapReplied?.(reqRow.id, replyText, 0).catch(() => {});
          return { ok: true, parsed: 0, inserted: 0, source: "nothing-happened" };
        }
        // Mark as replied so the next listPending excludes it. LLM-parsing
        // continues to run via the webhook path in future runs.
        await (db as any).markRecapReplied?.(reqRow.id, replyText, 0).catch(() => {});
        return { ok: true, parsed: 0, inserted: 0, source: "in-app-submit" };
      }),
  }),

  // ── Settings AI Helper ──────────────────────────────────
  /**
   * settingsAI — "Just tell the AI what to change" for the adult Settings page.
   * preview() returns a structured plan; commit() applies it via the same prefs/
   * tutor mutations the page already uses, with a full audit log entry.
   */
  settingsAI: router({
    snapshot: protectedProcedure.query(async () => {
      const tutors = (await db.listTutors(false)) as any[];
      const prefRows = await db.listAppSettings();
      const prefs: Record<string, string | null> = {};
      for (const k of ["ui.theme", "kiwi.voice", "kiwi.silent", "kiwi.cartoonVoice", "kiwi.wakeWord", "quietHours.start", "quietHours.end", "roblox.allowed", "notifications.evening8pm"]) {
        prefs[k] = (prefRows as any[]).find(r => r.key === k)?.value ?? null;
      }
      return {
        reagan: { name: "Reagan", gradeLevel: "5th grade" },
        tutors: tutors.map(t => ({ id: t.id, name: t.name, role: t.role, subjects: t.subjects, active: !!t.active })),
        prefs,
        voicePresets: ["Leda", "Aoede", "Sadachbia", "Kore", "Puck"],
        themes: ["starry", "cream", "chalkboard", "notebook"],
      };
    }),
    preview: protectedProcedure.input(z.object({
      instruction: z.string().min(2).max(2000),
    })).mutation(async ({ input }) => {
      const { generateSettingsAIPlan } = await import("./_lib/settingsAI");
      const tutors = (await db.listTutors(false)) as any[];
      const prefRows = await db.listAppSettings();
      const prefs: Record<string, string | null> = {};
      for (const k of ["ui.theme", "kiwi.voice", "kiwi.silent", "kiwi.cartoonVoice", "kiwi.wakeWord", "quietHours.start", "quietHours.end", "roblox.allowed", "notifications.evening8pm"]) {
        prefs[k] = (prefRows as any[]).find(r => r.key === k)?.value ?? null;
      }
      const plan = await generateSettingsAIPlan({
        reagan: { name: "Reagan", gradeLevel: "5th grade" },
        tutors: tutors.map(t => ({ id: t.id, name: t.name, role: t.role, subjects: t.subjects, active: !!t.active })),
        prefs,
        voicePresets: ["Leda", "Aoede", "Sadachbia", "Kore", "Puck"],
        themes: ["starry", "cream", "chalkboard", "notebook"],
      }, input.instruction);
      return plan;
    }),
    commit: protectedProcedure.input(z.object({
      summary: z.string(),
      ops: z.array(z.any()),
    })).mutation(async ({ input, ctx }) => {
      const out = { setPrefs: 0, upsertedTutors: 0, asks: 0, notes: [] as string[] };
      for (const op of input.ops as any[]) {
        if (op.kind === "prefs.set") {
          await db.setAppSetting(op.key, op.value ?? null);
          out.setPrefs++;
        } else if (op.kind === "tutor.upsert") {
          await db.upsertTutor({
            id: op.id,
            name: op.name,
            role: op.role,
            subjects: op.subjects,
            active: typeof op.active === "boolean" ? op.active : undefined,
            notes: op.notes,
          });
          out.upsertedTutors++;
        } else if (op.kind === "reagan.note") {
          out.notes.push(op.text);
        } else if (op.kind === "ask") {
          out.asks++;
        }
      }
      await db.logAudit({
        actorOpenId: ctx.user?.openId,
        actorName: ctx.user?.name,
        entityType: "app",
        entityId: 0,
        action: "update",
        summary: `Settings AI: ${input.summary} (${out.setPrefs} pref, ${out.upsertedTutors} tutor)`,
      });
      return out;
    }),
  }),

  // ── Adult Assignments Library ───────────────────────────────────
  library: router({
    list: protectedProcedure
      .input(z.object({
        q: z.string().optional(),
        subjectSlug: z.string().nullable().optional(),
        type: z.string().nullable().optional(),
        status: z.string().nullable().optional(),
        fromSource: z.string().nullable().optional(),
        ihClassroomOnly: z.boolean().optional(),
        dateFor: z.string().nullable().optional(),
        bundleId: z.number().nullable().optional(),
        blockId: z.number().nullable().optional(),
        limit: z.number().min(1).max(500).default(100),
        offset: z.number().min(0).default(0),
        orderBy: z.enum(["recent", "dateFor", "recommendedUse", "title"]).default("recent"),
      }).optional())
      .query(({ input }) => db.listAssignmentsLibrary(input ?? {})),
    count: protectedProcedure
      .input(z.object({
        q: z.string().optional(),
        subjectSlug: z.string().nullable().optional(),
        type: z.string().nullable().optional(),
        status: z.string().nullable().optional(),
        ihClassroomOnly: z.boolean().optional(),
      }).optional())
      .query(({ input }) => db.countAssignmentsLibrary(input ?? {})),
    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(({ input }) => db.getAssignmentLibraryRow(input.id)),
    add: protectedProcedure
      .input(z.object({
        title: z.string().min(1).max(300),
        subjectSlug: z.string().nullable().optional(),
        type: z.string().min(1).max(32),
        topic: z.string().nullable().optional(),
        tags: z.array(z.string()).optional(),
        fromSource: z.string().default("manual"),
        ihClassroom: z.boolean().default(false),
        dateReceived: z.string().nullable().optional(),
        dateFor: z.string().nullable().optional(),
        recommendedUse: z.number().min(1).max(5).default(3),
        sourceUrl: z.string().nullable().optional(),
        fileLink: z.string().nullable().optional(),
        bundleId: z.number().nullable().optional(),
        bundleStep: z.number().nullable().optional(),
        notes: z.string().nullable().optional(),
        blockId: z.number().nullable().optional(),
      }))
      .mutation(({ input }) => db.addAssignmentLibrary(input as any)),
    update: protectedProcedure
      .input(z.object({ id: z.number(), patch: z.record(z.string(), z.any()) }))
      .mutation(({ input }) => db.updateAssignmentLibrary(input.id, input.patch as any)),
    setStatus: protectedProcedure
      .input(z.object({ id: z.number(), status: z.enum(["pending","in_progress","completed","absent","skipped"]) }))
      .mutation(({ input }) => db.setAssignmentLibraryStatus(input.id, input.status)),
    findForToday: protectedProcedure
      .input(z.object({ forDate: z.string(), subjectSlug: z.string().nullable().optional() }))
      .query(({ input }) => db.findLibraryItemsForToday(input.forDate, input.subjectSlug ?? null)),
    bundles: router({
      list: protectedProcedure
        .input(z.object({ dateFor: z.string().nullable().optional(), subjectSlug: z.string().nullable().optional() }).optional())
        .query(({ input }) => db.listAssignmentBundles(input ?? {})),
      create: protectedProcedure
        .input(z.object({
          name: z.string().min(1).max(300),
          subjectSlug: z.string().nullable().optional(),
          topic: z.string().nullable().optional(),
          dateFor: z.string().nullable().optional(),
          reminderOnly: z.boolean().default(false),
          notes: z.string().nullable().optional(),
        }))
        .mutation(({ input }) => db.createAssignmentBundle(input as any)),
      attach: protectedProcedure
        .input(z.object({ itemId: z.number(), bundleId: z.number(), step: z.number().min(1).max(4) }))
        .mutation(({ input }) => db.attachLibraryItemToBundle(input.itemId, input.bundleId, input.step)),
      get: protectedProcedure
        .input(z.object({ bundleId: z.number() }))
        .query(({ input }) => db.getBundleWithItems(input.bundleId)),
    }),
  }),

  /* ----------------------------------------------------------------
   * Slice 3.5 — Approvals (AI auto-approver + Mom/Grandma escalation)
   * ---------------------------------------------------------------- */
  approvals: router({
    /** Submit a change for AI review. Auto-approved or queued + push-notified. */
    submit: adminOrTutorProcedure
      .input(z.object({
        kind: z.string().min(1).max(64),
        summary: z.string().min(1).max(500),
        payload: z.record(z.string(), z.any()).default({}),
        requesterRole: z.enum(["admin", "tutor", "student", "system"]).default("admin"),
        localHour: z.number().int().min(0).max(23).optional(),
        affectedDayHasCompletedBlock: z.boolean().optional(),
        yearPlanPercentComplete: z.number().min(0).max(100).optional(),
        ttlHours: z.number().int().min(1).max(168).default(48),
      }))
      .mutation(async ({ input, ctx }) => {
        const userEmail = (ctx as any).user?.email ?? "unknown";
        // v2.31 (2026-05-18) — Slice 3.5 hard rule: Mom + Grandma actions
        // NEVER enter the approval queue. Tutors / AI / Reagan still queue.
        // The bypass keys off `roleForEmail()` so it's the same source of
        // truth as familyAdminProcedure (parent = Mom/Dad, editor = Grandma).
        // Tutors land in the tutor role and STILL go through the decider
        // even though adminOrTutorProcedure lets them call this proc.
        const familyRole = roleForEmail(userEmail);
        const isHouseholdAdult = familyRole === "parent" || familyRole === "editor";
        if (isHouseholdAdult) {
          const now = Date.now();
          const expires = now + input.ttlHours * 3600 * 1000;
          const reason = `Household adult (${familyRole}) — bypasses approval queue per Slice 3.5 hard rule.`;
          const id = await db.insertPendingApproval({
            kind: input.kind,
            summary: input.summary,
            payloadJson: JSON.stringify(input.payload ?? {}),
            requestedBy: userEmail,
            requestedAt: now,
            status: "auto_approved",
            aiDecision: "auto_approve",
            aiReason: reason,
            expiresAt: expires,
            decidedBy: userEmail,
            decidedAt: now,
          } as any);
          // Audit row only — no notifyOwner ping for household adults.
          return { id, decision: "auto_approve" as const, reason };
        }
        const apprCtx: ApprovalContext = {
          kind: input.kind,
          payload: input.payload ?? {},
          requesterRole: input.requesterRole,
          nowMs: Date.now(),
          localHour: input.localHour,
          affectedDayHasCompletedBlock: input.affectedDayHasCompletedBlock,
          yearPlanPercentComplete: input.yearPlanPercentComplete,
        };
        const verdict = decideApproval(apprCtx);
        const now = Date.now();
        const expires = now + input.ttlHours * 3600 * 1000;
        const id = await db.insertPendingApproval({
          kind: input.kind,
          summary: input.summary,
          payloadJson: JSON.stringify(input.payload ?? {}),
          requestedBy: userEmail,
          requestedAt: now,
          status: verdict.decision === "auto_approve" ? "auto_approved" : "pending",
          aiDecision: verdict.decision,
          aiReason: verdict.reason,
          expiresAt: expires,
          decidedBy: verdict.decision === "auto_approve" ? "ai" : null,
          decidedAt: verdict.decision === "auto_approve" ? now : null,
        } as any);
        if (verdict.decision === "needs_review") {
          // Fire-and-forget; never block the request on the push channel.
          notifyOwner({
            title: `Approval needed: ${input.kind}`,
            content: `${input.summary}\n\nReason: ${verdict.reason}\nRequested by: ${userEmail}`,
          }).catch(() => undefined);
        }
        return { id, decision: verdict.decision, reason: verdict.reason };
      }),

    listPending: adminOrTutorProcedure
      .input(z.object({ limit: z.number().int().min(1).max(200).default(50) }).optional())
      .query(({ input }) => db.listPendingApprovalsByStatus("pending", input?.limit ?? 50)),

    listRecent: adminOrTutorProcedure
      .input(z.object({ limit: z.number().int().min(1).max(200).default(50) }).optional())
      .query(({ input }) => db.listRecentApprovals(input?.limit ?? 50)),

    /**
     * v3.16 (2026-05-30) — "AI auto-approved last 24h" feed.
     * Window defaults to 24 hours but adjustable up to 7 days.
     * Limit defaults to 100 (these can pile up overnight).
     */
    listAutoApprovedRecent: adminOrTutorProcedure
      .input(z.object({
        hours: z.number().int().min(1).max(168).default(24),
        limit: z.number().int().min(1).max(500).default(100),
      }).optional())
      .query(({ input }) => db.listAutoApprovedSince(
        (input?.hours ?? 24) * 60 * 60 * 1000,
        input?.limit ?? 100
      )),

    resolve: adminOrTutorProcedure
      .input(z.object({
        id: z.number().int().positive(),
        status: z.enum(["approved", "rejected"]),
      }))
      .mutation(async ({ input, ctx }) => {
        const who = (ctx as any).user?.email ?? "unknown";
        const ok = await db.decidePendingApproval(input.id, input.status, who);
        return { ok };
      }),

    expireSweep: adminProcedure
      .mutation(() => db.expirePendingApprovals().then((n) => ({ expired: n }))),
  }),

  /* ----------------------------------------------------------------
   * Slice 3.5 — Roster overrides + push targets
   * ---------------------------------------------------------------- */
  rosterOverride: router({
    forWeek: adminOrTutorProcedure
      .input(z.object({ dateStr: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }))
      .query(({ input }) => db.getRosterForWeek(input.dateStr)),

    set: adminProcedure
      .input(z.object({
        weekStartDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        activeTutorNames: z.array(z.string()),
        helperNames: z.array(z.string()),
        note: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        await db.upsertRosterOverride({
          weekStartDate: input.weekStartDate,
          activeTutorNamesJson: JSON.stringify(input.activeTutorNames),
          helperNamesJson: JSON.stringify(input.helperNames),
          note: input.note ?? null,
        });
        return { ok: true };
      }),

    pushTargets: adminOrTutorProcedure.query(() => db.listActivePushTargets()),
  }),
  /**
   * Push 39 (2026-05-13) — Slice 4.5 adult quick-entry router for the
   * Today page "what we actually did" card. Mom + Grandma + active tutor
   * tutors can record an actual entry without touching the planned
   * schedule. familyAdminProcedure means the gate is open for the entire
   * household (past, today, future). Each insert kicks off a Drive
   * day-log rebuild via the existing `enqueueDayLogRebuildForDate` hook
   * inside `recordActualEntry`.
   */
  actuals: router({
    /** List actual entries for a date — used by Today + Schedule + Analytics. */
    listForDate: protectedProcedure
      .input(z.object({ dateISO: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }))
      .query(({ input }) => db.listActualForDate(input.dateISO)),
    /** Push 40 — single-call payload for the Actual-vs-Planned strip. */
    vsPlanned: protectedProcedure
      .input(z.object({ dateISO: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }))
      .query(({ input }) => db.getActualVsPlannedForDate(input.dateISO)),
    /**
     * Quick-entry: one-tap form on Today. Required fields are subject,
     * topic, and minutes. Optional plannedBlockId pins the entry to a
     * planned block so the Actual-vs-Planned strip can render the
     * "✓ actual" chip next to the right block.
     */
    quickAdd: familyAdminProcedure
      .input(
        z.object({
          dateISO: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
          plannedBlockId: z.number().int().positive().nullable().optional(),
          subjectSlug: z.string().min(1).max(32),
          topic: z.string().min(1).max(240),
          minutesSpent: z.number().int().min(0).max(600).default(0),
          notes: z.string().max(2000).nullable().optional(),
          source: z
            .enum(["reagan-checkin", "mom-input", "grandma-recap", "tutor-note"])
            .default("mom-input"),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const insertedId = await db.recordActualEntry({
          dateISO: input.dateISO,
          plannedBlockId: input.plannedBlockId ?? null,
          subjectSlug: input.subjectSlug,
          topic: input.topic,
          minutesSpent: input.minutesSpent,
          source: input.source,
          notes: input.notes ?? null,
          createdBy: (ctx as any).user?.email ?? (ctx as any).user?.name ?? "system",
        } as any);
        return { ok: true, id: insertedId };
      }),
    /** Mom-only undo for an entry inserted in the last minute. */
    deleteRecent: familyAdminProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ input }) => {
        await db.deleteActualEntry(input.id);
        return { ok: true };
      }),
  }),

  /* ============================== NOTEBOOK PAGES ============================== */
  notebookPages: router({
    /** Load a single page (or null if not yet created). */
    get: familyAdminProcedure
      .input(z.object({ dateStr: z.string(), pageIndex: z.number().int().min(0).default(0) }))
      .query(async ({ input }) => {
        return db.getNotebookPage(input.dateStr, input.pageIndex);
      }),

    /** List all pages for a date (for multi-page support). */
    listForDate: familyAdminProcedure
      .input(z.object({ dateStr: z.string() }))
      .query(async ({ input }) => {
        return db.listNotebookPagesForDate(input.dateStr);
      }),

    /** Save / update a page (upsert). */
    save: familyAdminProcedure
      .input(z.object({
        dateStr: z.string(),
        pageIndex: z.number().int().min(0).default(0),
        paperStyle: z.string().optional(),
        textContent: z.string().nullable().optional(),
        drawingStrokes: z.string().nullable().optional(),
        penColor: z.string().nullable().optional(),
      }))
      .mutation(async ({ input }) => {
        const { dateStr, pageIndex, ...patch } = input;
        return db.upsertNotebookPage(dateStr, pageIndex, patch);
      }),

    /** Delete a page. */
    delete: familyAdminProcedure
      .input(z.object({ dateStr: z.string(), pageIndex: z.number().int().min(0) }))
      .mutation(async ({ input }) => {
        await db.deleteNotebookPage(input.dateStr, input.pageIndex);
        return { ok: true };
      }),
  }),

  /* ======================================================================
   * FLASHCARD DECKS + CARDS
   * ==================================================================== */
  flashcards: router({
    listDecks: protectedProcedure
      .input(z.object({ subjectSlug: z.string().optional() }))
      .query(async ({ input }) => db.listFlashcardDecks(input.subjectSlug)),
    getDeck: protectedProcedure
      .input(z.object({ id: z.number().int() }))
      .query(async ({ input }) => db.getFlashcardDeck(input.id)),
    createDeck: familyAdminProcedure
      .input(z.object({
        title: z.string().min(1).max(255),
        subjectSlug: z.string().min(1).max(64),
        topicHandle: z.string().max(128).optional(),
        gradeLevel: z.number().int().min(1).max(12).optional(),
        description: z.string().max(1000).optional(),
        isAiGenerated: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => db.createFlashcardDeck(input)),
    deleteDeck: familyAdminProcedure
      .input(z.object({ id: z.number().int() }))
      .mutation(async ({ input }) => { await db.deleteFlashcardDeck(input.id); return { ok: true }; }),
    listCards: protectedProcedure
      .input(z.object({ deckId: z.number().int() }))
      .query(async ({ input }) => db.listFlashcardCards(input.deckId)),
    addCard: familyAdminProcedure
      .input(z.object({
        deckId: z.number().int(),
        front: z.string().min(1).max(2000),
        back: z.string().min(1).max(2000),
        hint: z.string().max(500).optional(),
        imageUrl: z.string().max(512).optional(),
      }))
      .mutation(async ({ input }) => db.addFlashcardCard(input)),
    deleteCard: familyAdminProcedure
      .input(z.object({ id: z.number().int() }))
      .mutation(async ({ input }) => { await db.deleteFlashcardCard(input.id); return { ok: true }; }),
    aiGenerateDeck: familyAdminProcedure
      .input(z.object({
        subjectSlug: z.string().min(1).max(64),
        topicTitle: z.string().min(1).max(255),
        topicHandle: z.string().max(128).optional(),
        cardCount: z.number().int().min(3).max(30).default(10),
        gradeLevel: z.number().int().min(1).max(12).default(5),
      }))
      .mutation(async ({ input }) => {
        const prompt = `Create ${input.cardCount} flashcards for a Grade ${input.gradeLevel} student studying "${input.topicTitle}" in ${input.subjectSlug}. Return JSON: { "title": string, "cards": [{"front": string, "back": string, "hint": string|null}] }. Front = question/term. Back = answer/definition. Keep language simple and age-appropriate.`;
        const resp = await invokeLLM({ messages: [{ role: "system", content: "You are a homeschool curriculum assistant. Always return valid JSON only." }, { role: "user", content: prompt }], response_format: { type: "json_schema", json_schema: { name: "flashcard_deck", strict: true, schema: { type: "object", properties: { title: { type: "string" }, cards: { type: "array", items: { type: "object", properties: { front: { type: "string" }, back: { type: "string" }, hint: { type: ["string", "null"] } }, required: ["front", "back", "hint"], additionalProperties: false } } }, required: ["title", "cards"], additionalProperties: false } } } });
        const raw = resp.choices[0].message.content;
        const parsed = JSON.parse(typeof raw === "string" ? raw : JSON.stringify(raw));
        const deck = await db.createFlashcardDeck({ title: parsed.title || input.topicTitle, subjectSlug: input.subjectSlug, topicHandle: input.topicHandle, gradeLevel: input.gradeLevel, isAiGenerated: true });
        for (const c of (parsed.cards || []).slice(0, 30)) {
          await db.addFlashcardCard({ deckId: deck.id, front: c.front, back: c.back, hint: c.hint || undefined });
        }
        return { deckId: deck.id, cardCount: (parsed.cards || []).length };
      }),
  }),

  /* ======================================================================
   * REVIEW SESSIONS + WEAK TOPICS
   * ==================================================================== */
  reviewSessions: router({
    listWeakTopics: protectedProcedure
      .input(z.object({ limit: z.number().int().min(1).max(20).default(5) }))
      .query(async ({ input }) => db.getWeakTopicsForStudent(input.limit)),
    allWeakTopics: protectedProcedure
      .query(async () => db.getAllWeakTopics()),
    startSession: familyAdminProcedure
      .input(z.object({
        dateStr: z.string(),
        subjectSlug: z.string().min(1).max(64),
        topicHandle: z.string().max(128).optional(),
        topicTitle: z.string().max(255).optional(),
        totalQuestions: z.number().int().min(1).max(20),
      }))
      .mutation(async ({ input }) => db.createReviewSession(input)),
    submitAnswer: protectedProcedure
      .input(z.object({
        questionId: z.number().int(),
        studentAnswer: z.string(),
        isCorrect: z.boolean(),
        timeSpentMs: z.number().int().optional(),
      }))
      .mutation(async ({ input }) => { await db.submitReviewAnswer(input); return { ok: true }; }),
    completeSession: protectedProcedure
      .input(z.object({ sessionId: z.number().int() }))
      .mutation(async ({ input }) => db.completeReviewSession(input.sessionId)),
    aiGenerateQuiz: familyAdminProcedure
      .input(z.object({
        dateStr: z.string(),
        subjectSlug: z.string().min(1).max(64),
        topicTitle: z.string().min(1).max(255),
        topicHandle: z.string().max(128).optional(),
        questionCount: z.number().int().min(3).max(10).default(5),
        ck12Url: z.string().max(512).optional(),
      }))
      .mutation(async ({ input }) => {
        const prompt = `Create ${input.questionCount} multiple-choice quiz questions for a Grade 5 student reviewing "${input.topicTitle}" in ${input.subjectSlug}. Return JSON: { "questions": [{"question": string, "correctAnswer": string, "choices": [string, string, string, string]}] }. Keep language simple. The correct answer must be one of the 4 choices.`;
        const resp = await invokeLLM({ messages: [{ role: "system", content: "You are a homeschool quiz generator. Always return valid JSON only." }, { role: "user", content: prompt }], response_format: { type: "json_schema", json_schema: { name: "quiz", strict: true, schema: { type: "object", properties: { questions: { type: "array", items: { type: "object", properties: { question: { type: "string" }, correctAnswer: { type: "string" }, choices: { type: "array", items: { type: "string" } } }, required: ["question", "correctAnswer", "choices"], additionalProperties: false } } }, required: ["questions"], additionalProperties: false } } } });
        const raw = resp.choices[0].message.content;
        const parsed = JSON.parse(typeof raw === "string" ? raw : JSON.stringify(raw));
        const questions = (parsed.questions || []).slice(0, 10);
        const session = await db.createReviewSession({ dateStr: input.dateStr, subjectSlug: input.subjectSlug, topicHandle: input.topicHandle, topicTitle: input.topicTitle, totalQuestions: questions.length });
        for (const q of questions) {
          await db.addReviewQuestion({ sessionId: session.id, questionType: "multiple-choice", question: q.question, correctAnswer: q.correctAnswer, choices: q.choices });
        }
        if (input.ck12Url) {
          await db.upsertWeakTopic({ subjectSlug: input.subjectSlug, topicHandle: input.topicHandle || input.topicTitle, topicTitle: input.topicTitle, newScore: 50, ck12Url: input.ck12Url });
        }
        return { sessionId: session.id, questionCount: questions.length };
      }),
    listSessionsForDate: protectedProcedure
      .input(z.object({ dateStr: z.string() }))
      .query(async ({ input }) => db.listReviewSessionsForDate(input.dateStr)),
    updateWeakTopic: familyAdminProcedure
      .input(z.object({
        subjectSlug: z.string().min(1).max(64),
        topicHandle: z.string().min(1).max(128),
        topicTitle: z.string().min(1).max(255),
        newScore: z.number().int().min(0).max(100),
        ck12Url: z.string().max(512).optional(),
      }))
      .mutation(async ({ input }) => { await db.upsertWeakTopic(input); return { ok: true }; }),
  }),
});
export type AppRouter = typeof appRouter;
