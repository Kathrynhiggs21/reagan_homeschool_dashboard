import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import * as db from "./db";
import { invokeLLM } from "./_core/llm";
import { transcribeAudio } from "./_core/voiceTranscription";
import { notifyOwner } from "./_core/notification";
import { storagePut } from "./storage";

const Zone = z.enum(["green", "yellow", "red"]);
const Intensity = z.enum(["green", "yellow", "red"]);
const DayType = z.enum(["full", "half", "outdoor", "field_trip", "recovery", "off"]);
const PlanStatus = z.enum(["planned", "in_progress", "complete", "skipped"]);
const BlockStatus = z.enum(["not_started", "in_progress", "complete", "skipped"]);
const BlockType = z.enum(["morning_warmup","math","adventure","read_aloud","choice","catch_up","appointment","custom"]);

/* ---------- WHISPER SYSTEM PROMPT (the soul of the AI) ---------- */
function buildWhisperSystemPrompt(ctx: {
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
• Reagan, 5th grade, known as "The Animal Whisperer" 🪶
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

export const appRouter = router({
  system: systemRouter,

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
  }),

  /* =================== BOOKS =================== */
  books: router({
    list: publicProcedure.query(() => db.listBooks()),
    create: protectedProcedure.input(z.object({
      title: z.string(), author: z.string().optional(),
      type: z.enum(["workbook","novel","reference","audiobook"]).default("workbook"),
      subjectSlug: z.string().optional(), currentPage: z.number().default(1), totalPages: z.number().optional(),
      notes: z.string().optional(),
    })).mutation(({ input }) => db.insertBook(input as any)),
    advancePage: protectedProcedure.input(z.object({ id: z.number(), currentPage: z.number() }))
      .mutation(({ input }) => db.updateBookPage(input.id, input.currentPage)),
    update: protectedProcedure.input(z.object({
      id: z.number(),
      title: z.string().optional(), author: z.string().optional(),
      type: z.enum(["workbook","novel","reference","audiobook"]).optional(),
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
      const body = "Reagan's Whisper Dispatch - " + dateStr + "\n\nToday's plan:\n" + (blockLines || "(no blocks)") + "\n\nRecent struggles (7 days):\n" + struggleLines + "\n\nSent to: " + recipientList + "\n";
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

  /* =================== WEEKLY TOPICS =================== */
  weeklyTopics: router({
    forWeek: publicProcedure.input(z.object({ weekStart: z.string() })).query(({ input }) => db.getWeeklyTopics(input.weekStart)),
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
  whisper: router({
    history: publicProcedure.input(z.object({ limit: z.number().default(50) })).query(({ input }) => db.listWhisperMessages(input.limit)),
    clear: protectedProcedure.input(z.object({}).optional()).mutation(() => db.clearWhisperHistory()),
    chat: publicProcedure.input(z.object({
      userMessage: z.string(),
      adultPresent: z.boolean().default(false),
      currentBlockTitle: z.string().optional(),
    })).mutation(async ({ input }) => {
      // Save user message
      await db.insertWhisperMessage({ role: "user", content: input.userMessage } as any);

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
      const recentMessages = await db.listWhisperMessages(20);
      const knowledge = await db.listKnowledgeForWhisper(20);

      const companionName = (profile as any)?.companionName || "Whisper";
      const tonePref = (profile as any)?.companionTonePreference;

      const systemPrompt = buildWhisperSystemPrompt({
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
      await db.insertWhisperMessage({ role: "assistant", content: aiContent } as any);
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
      const sys = `You are ${(profile as any)?.companionName || "Whisper"}, an AI friend wrapping up the day for Reagan. Write 2-4 short sentences celebrating something specific from today. Use her name. Be warm, real, never saccharine. No mention of timing. End with: \"You did good today.\"`;
      try {
        const r = await invokeLLM({ messages: [{ role: "system", content: sys }, { role: "user", content: summary }] });
        const c = r.choices[0]?.message?.content;
        return { recap: typeof c === "string" ? c : "You did good today. 💛" };
      } catch {
        return { recap: `You showed up today. ${done.length} thing${done.length===1?"":"s"} done, and your animals were loved. You did good today. 💛` };
      }
    }),

    // Whisper notices a struggle pattern and alerts the parent if needed
    checkAlerts: protectedProcedure.input(z.object({}).optional()).mutation(async () => {
      const struggles = await db.listStruggles(7);
      const reds = struggles.filter(s => s.intensity === "red");
      if (reds.length >= 3) {
        await notifyOwner({
          title: "🪶 Whisper noticed a pattern",
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
    })).mutation(({ input }) => db.createJournalEntry(input)),
    delete: publicProcedure.input(z.object({ id: z.number() })).mutation(({ input }) => db.deleteJournalEntry(input.id)),
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
    })).mutation(({ input }) => db.createAcademicRecord({
      ...input,
      dueAt: input.dueAt ? new Date(input.dueAt) : undefined,
    } as any)),
    extract: publicProcedure.input(z.object({
      source: z.enum(["paste","manus_share","gmail","classroom","powerschool_ih","powerschool_madeira","ixl","drive","manual"]).default("paste"),
      text: z.string().min(3),
    })).mutation(({ input }) => db.extractAcademicFromPaste(input.source, input.text)),
    delete: publicProcedure.input(z.object({ id: z.number() })).mutation(({ input }) => db.deleteAcademicRecord(input.id)),
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
    })).mutation(({ input }) => db.createAssignmentSubmission({
      blockId: input.blockId,
      subjectSlug: input.subjectSlug,
      title: input.title,
      submissionType: input.mode === "typed" ? "text" : input.mode === "photo" ? "photo" : "file",
      contentText: input.answersText,
      fileKey: input.fileKey,
      fileUrl: input.fileUrl,
    } as any)),
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

  /* =================== PRINTABLES HUB =================== */
  printables: router({
    listSources: publicProcedure.query(() => db.listPrintableSources()),
    listFavorites: publicProcedure.query(() => db.listPrintableFavorites()),
    addFavorite: publicProcedure.input(z.object({ sourceId: z.number(), title: z.string(), url: z.string(), subjectSlug: z.string().optional(), note: z.string().optional() })).mutation(({ input }) => db.addPrintableFavorite(input)),
    removeFavorite: publicProcedure.input(z.object({ id: z.number() })).mutation(({ input }) => db.deletePrintableFavorite(input.id)),
  }),
});
export type AppRouter = typeof appRouter;
