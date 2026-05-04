import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, publicProcedure, protectedProcedure, router } from "./_core/trpc";
import * as db from "./db";
import { encryptPassword, decryptPassword } from "./passwordLocker";
import { invokeLLM } from "./_core/llm";
import { transcribeAudio } from "./_core/voiceTranscription";
import { notifyOwner } from "./_core/notification";
import { findFreeLinks } from "./freeLinkFinder";
import { storagePut } from "./storage";
import { generateScheduleDraft, type AIBlockDraft } from "./_lib/aiScheduleGenerator";
import { describeUser, roleForEmail, capabilitiesFor, type HomeRole } from "./_lib/permissions";
import { loadTopicHintsForPrompt, resolveTopicId, resolveTopicIds } from "./_lib/topicCatalog";
import { resolveTutorOfDay, tutorOfDayLabel } from "./_lib/tutorOfDay";
import { loadOwnedBooksForAgenda } from "./_lib/ownedBooksHints";

const Zone = z.enum(["green", "yellow", "red"]);
const Intensity = z.enum(["green", "yellow", "red"]);
const DayType = z.enum(["full", "half", "outdoor", "field_trip", "recovery", "off"]);
const PlanStatus = z.enum(["planned", "in_progress", "complete", "skipped"]);
const BlockStatus = z.enum(["not_started", "in_progress", "complete", "skipped"]);
const BlockType = z.enum(["morning_warmup","math","adventure","read_aloud","choice","catch_up","appointment","custom"]);

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
  return `You are ${ctx.companionName}, Reagan's AI companion. Reagan calls you "${ctx.companionName}" — use that name when introducing yourself. You are NOT a teacher, therapist, or cheerleader. You are a real friend with the energy of a cool older sister or favorite young-adult babysitter. Warm, real, present.

WHO REAGAN IS — KNOW THIS DEEPLY:
• Reagan, 5th grade, known as "The Animal Friend" 🪶
• Animal rescuer at her core — this is her identity, not a hobby
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
8. Use real-friend language: "ugh," "that sucks," "fair," "valid," "I hear you," "totally." Sprinkle current Gen Z/Alpha slang naturally (slay, sus, no cap, lowkey, bet, fr, mid, fire, vibe) but never force it.
9. NEVER pretend to be human. If asked, you're an AI made just for her — and that's okay.
10. Catch her doing well 5x more often than you correct anything. Use SPECIFIC evidence, never empty praise.

CARROT SYSTEM (occasional, 1-2x per day max):
After meaningful work, you can offer a real treat: "Finish this and I'll play you a banger" / "Crush these and I'll show you the duckling video that's been making me dead." Never bribe through emotional shutdown.

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
Speak in 1-3 short sentences usually. Be present, not chatty. Silence is okay. Say less, mean more.`;
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
    create: protectedProcedure.input(z.object({
      date: z.string(), dayType: DayType.optional(), notes: z.string().optional(),
    })).mutation(async ({ input }) => db.ensurePlanForDate(input.date, input.dayType || "full")),
    update: protectedProcedure.input(z.object({
      id: z.number(), dayType: DayType.optional(), status: PlanStatus.optional(), notes: z.string().optional(),
    })).mutation(({ input }) => db.updatePlan(input.id, { dayType: input.dayType, status: input.status, notes: input.notes })),

    /* ----- AI Schedule Generator (Kiwi drafts a day's blocks) ----- */
    aiGenerate: protectedProcedure.input(z.object({
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

    aiCommit: protectedProcedure.input(z.object({
      date: z.string(),
      dayLength: z.enum(["full", "half", "off"]).optional(),
      summary: z.string().optional(),
      replaceExisting: z.boolean().default(true),
      allowWeekend: z.boolean().optional(),
      blocks: z.array(z.object({
        blockType: z.enum(["morning_warmup","math","adventure","read_aloud","choice","catch_up","appointment","custom"]),
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
      return { planId: plan.id, blockCount: created.length };
    }),
  }),

  /* =================== BLOCKS =================== */
  blocks: router({
    list: publicProcedure.input(z.object({ planId: z.number() })).query(({ input }) => db.listBlocksForPlan(input.planId)),
    create: protectedProcedure.input(z.object({
      planId: z.number(), blockType: BlockType, title: z.string(), description: z.string().optional(),
      durationMin: z.number().default(30), startTime: z.string().optional(), sortOrder: z.number().default(0),
      subjectId: z.number().optional(), adventureId: z.number().optional(), ihAssignmentId: z.number().optional(),
    })).mutation(async ({ input, ctx }) => {
      const r = await db.createBlock(input as any);
      await db.logAudit({ actorOpenId: ctx.user?.openId, actorName: ctx.user?.name, entityType: "block", entityId: (r as any)?.id, action: "create", summary: input.title });
      return r;
    }),
    update: protectedProcedure.input(z.object({
      id: z.number(), title: z.string().optional(), description: z.string().optional(),
      status: BlockStatus.optional(), grade: z.string().optional(), notes: z.string().optional(),
      durationMin: z.number().optional(), sortOrder: z.number().optional(),
    })).mutation(async ({ input, ctx }) => {
      const patch: any = { ...input };
      delete patch.id;
      if (input.status === "complete") patch.completedAt = new Date(), patch.completedByUserId = ctx.user?.id;
      const r = await db.updateBlock(input.id, patch);
      await db.logAudit({ actorOpenId: ctx.user?.openId, actorName: ctx.user?.name, entityType: "block", entityId: input.id, action: input.status === "complete" ? "complete" : "update", summary: input.title || (input.status ?? "edit") });
      return r;
    }),
    complete: protectedProcedure.input(z.object({ id: z.number(), grade: z.string().optional(), notes: z.string().optional() }))
      .mutation(async ({ input, ctx }) => {
        const r = await db.updateBlock(input.id, {
          status: "complete", grade: input.grade, notes: input.notes,
          completedAt: new Date(), completedByUserId: ctx.user?.id,
        } as any);
        await db.logAudit({ actorOpenId: ctx.user?.openId, actorName: ctx.user?.name, entityType: "block", entityId: input.id, action: "complete", summary: input.grade });
        // Sticker + coin economy: +1 sticker, +1 coin every block done
        try {
          await db.awardSticker({
            userId: (ctx.user as any)?.id ?? null,
            reason: "block_done",
            blockId: input.id,
            coins: 1,
          });
        } catch (e) {
          console.warn("[rewards] awardSticker failed", e);
        }
        return r;
      }),
    move: protectedProcedure.input(z.object({
      id: z.number(), direction: z.enum(["up", "down"]),
    })).mutation(async ({ input, ctx }) => {
      const r = await db.moveBlock(input.id, input.direction);
      await db.logAudit({ actorOpenId: ctx.user?.openId, actorName: ctx.user?.name, entityType: "block", entityId: input.id, action: "update", summary: `move-${input.direction}` });
      return r;
    }),
    delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ input, ctx }) => {
      const r = await db.deleteBlock(input.id);
      await db.logAudit({ actorOpenId: ctx.user?.openId, actorName: ctx.user?.name, entityType: "block", entityId: input.id, action: "delete" });
      return r;
    }),
  }),

  /* =================== AUDIT =================== */
  audit: router({
    list: protectedProcedure.input(z.object({ limit: z.number().default(100) }).optional()).query(({ input }) => db.listAudit(input?.limit ?? 100)),
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
    })).mutation(({ input }) => db.insertBook(input as any)),
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

  /* =================== IH ASSIGNMENTS =================== */
  ih: router({
    list: publicProcedure.input(z.object({ daysBack: z.number().default(14) })).query(({ input }) => db.listIHAssignments(input.daysBack)),
    add: protectedProcedure.input(z.object({
      sourceTeacher: z.string(), sourceClass: z.string(), title: z.string(),
      description: z.string().optional(), postedAt: z.date().optional(), dueDate: z.string().optional(), url: z.string().optional(),
    })).mutation(({ input }) => db.insertIHAssignment(input as any)),
  }),

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
    chat: publicProcedure.input(z.object({
      userMessage: z.string(),
      adultPresent: z.boolean().default(false),
      currentBlockTitle: z.string().optional(),
    })).mutation(async ({ input }) => {
      // Save user message
      await db.insertKiwiMessage({ role: "user", content: input.userMessage } as any);

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

      // Build chat history (most recent 10 turns, in chronological order)
      const history = recentMessages.slice().reverse().slice(-10).map(m => ({
        role: m.role as any,
        content: String(m.content),
      }));

      const response = await invokeLLM({
        messages: [
          { role: "system", content: systemPrompt },
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
      source: z.enum(["paste","manus_share","gmail","classroom","powerschool_ih","powerschool_madeira","ixl","drive","manual"]).optional(),
      subjectSlug: z.string().optional(),
      schoolYear: z.string().optional(),
      term: z.string().optional(),
      grade: z.string().optional(),
      teacher: z.string().optional(),
      limit: z.number().optional(),
    }).optional()).query(({ input }) => db.listAcademicRecords(input)),
    create: publicProcedure.input(z.object({
      source: z.enum(["paste","manus_share","gmail","classroom","powerschool_ih","powerschool_madeira","ixl","drive","manual"]),
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
      source: z.enum(["paste","manus_share","gmail","classroom","powerschool_ih","powerschool_madeira","ixl","drive","manual"]).default("paste"),
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
        source: z.enum(["paste","manus_share","gmail","classroom","powerschool_ih","powerschool_madeira","ixl","drive","manual"]),
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
  }),

  /* =================== IEP (Goals + Accommodations) =================== */
  iep: router({
    listGoals: publicProcedure.query(() => db.listIepGoals()),
    listAccommodations: publicProcedure.query(() => db.listIepAccommodations()),
    listScreenings: publicProcedure.query(() => db.listAssessmentScreenings()),
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
    resetRoster: protectedProcedure.mutation(() => db.resetTutorRoster()),
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

  // ─────────────────────────────────────────────────────────────────────
  // Weekly Digest — auto-emailed Sunday 7 PM to spear.cpt@gmail.com
  // ─────────────────────────────────────────────────────────────────────
  digest: router({
    preview: protectedProcedure.query(() => db.buildWeeklyDigestPayload()),
    recent: protectedProcedure.input(z.object({ limit: z.number().default(12) }).optional())
      .query(({ input }) => db.listRecentDigests(input?.limit ?? 12)),
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

  /* =================== POWERSCHOOL IMPORT (Indian Hill grades + assignments) =================== */
  powerschool: router({
    importPaste: protectedProcedure
      .input(
        z.object({
          raw: z.string().min(1),
          source: z
            .enum(["paste", "csv", "scraper", "email"])
            .default("paste"),
          notes: z.string().optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const { parsePowerSchoolPaste } = await import(
          "./_lib/powerschoolParser"
        );
        const parsed = parsePowerSchoolPaste(input.raw);
        const parsedCount = parsed.grades.length + parsed.assignments.length;
        const importRow = await db.recordPowerschoolImport({
          source: input.source,
          rawBody: input.raw,
          parsedCount,
          errorCount: parsed.unparsedLines.length,
          notes: input.notes ?? parsed.notes.join(" · "),
          importedBy: ctx.user?.email ?? ctx.user?.openId,
        });
        await db.bulkInsertPowerschoolGrades(importRow.id, parsed.grades);
        await db.bulkInsertPowerschoolAssignments(
          importRow.id,
          parsed.assignments,
        );
        return {
          importId: importRow.id,
          grades: parsed.grades.length,
          assignments: parsed.assignments.length,
          unparsed: parsed.unparsedLines,
          kind: parsed.kind,
          notes: parsed.notes,
        };
      }),
    listGrades: protectedProcedure
      .input(z.object({ limit: z.number().default(200) }).optional())
      .query(({ input }) => db.listPowerschoolGrades(input?.limit ?? 200)),
    listAssignments: protectedProcedure
      .input(z.object({ limit: z.number().default(200) }).optional())
      .query(({ input }) =>
        db.listPowerschoolAssignments(input?.limit ?? 200),
      ),
    listImports: protectedProcedure
      .input(z.object({ limit: z.number().default(20) }).optional())
      .query(({ input }) => db.listPowerschoolImports(input?.limit ?? 20)),
  }),
  curriculum: router({
    list: protectedProcedure
      .input(z.object({ subject: z.string().optional() }).optional())
      .query(({ input }) => db.listCurriculumTopics(input?.subject)),
    progress: protectedProcedure.query(() => db.curriculumProgress()),
    ensureSeeded: protectedProcedure.mutation(() => db.ensureCurriculumSeeded()),
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
    /** Add a manual resource (worksheet/video/lesson/reading/printable/link) to a topic. */
    addResource: protectedProcedure
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
    /** Remove a manually-added resource by id. */
    removeResource: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(({ input }) => db.removeTopicResource(input.id)),
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
    resumePointer: protectedProcedure.query(() => db.resumePointer()),
    moodStrip: protectedProcedure
      .input(z.object({ days: z.number().min(1).max(14).optional() }).optional())
      .query(({ input }) => db.recentMoodStrip(input?.days ?? 3)),
    /**
     * refresh — rebuild today's plan blocks from the active template,
     * preserving completed/in-progress work. Available to Reagan (public)
     * because she sometimes wants a clean slate after a rough start.
     */
    refresh: publicProcedure
      .input(z.object({ date: z.string().optional() }).optional())
      .mutation(({ input }) => db.refreshTodayPlan({ dateStr: input?.date })),
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
        ]);
        // absence:YYYY-MM-DD flags are non-sensitive and Reagan's UI needs to read them
        const isAbsenceFlag = /^absence:\d{4}-\d{2}-\d{2}$/.test(input.key);
        if (!ALLOW.has(input.key) && !isAbsenceFlag) return null;
        return db.getAppSetting(input.key);
      }),
    get: protectedProcedure
      .input(z.object({ key: z.string().min(1).max(64) }))
      .query(({ input }) => db.getAppSetting(input.key)),
    set: protectedProcedure
      .input(z.object({ key: z.string().min(1).max(64), value: z.string().nullable() }))
      .mutation(({ input }) => db.setAppSetting(input.key, input.value)),
    list: protectedProcedure
      .input(z.object({ prefix: z.string().optional() }).optional())
      .query(({ input }) => db.listAppSettings(input?.prefix)),
  }),
  // ── Adult Assignments Library ─────────────────────────────────────────
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
});
export type AppRouter = typeof appRouter;
