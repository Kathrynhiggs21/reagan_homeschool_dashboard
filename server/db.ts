import { ENV } from "./_core/env";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { eq, desc, and, gte, lte, sql, isNotNull } from "drizzle-orm";
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
  printableSources, printableFavorites, academicRecords,
} from "../drizzle/schema";

let _db: ReturnType<typeof drizzle> | null = null;

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

export async function ensurePlanForDate(dateStr: string, dayType: any = "full") {
  const existing = await getPlanByDate(dateStr);
  if (existing) return existing;
  const db = getDb();
  // Wednesday = therapy day (lighter)
  const dow = new Date(dateStr + "T00:00:00").getDay();
  const finalDayType = dow === 3 ? "half" : dayType;
  await db.insert(dailyPlans).values({ date: dateStr as any, dayType: finalDayType });
  const plan = await getPlanByDate(dateStr);
  if (plan) await autoBuildBlocksForPlan(plan.id, dow === 3 ? "therapy" : dayType, dow);
  return plan;
}

async function autoBuildBlocksForPlan(planId: number, dayType: string, dow: number) {
  const db = getDb();
  const subjs = await db.select().from(subjects);
  const findSlug = (slug: string) => subjs.find(s => s.slug === slug);
  const isTherapy = dayType === "therapy";

  const template: Array<{ title: string; description: string; slug?: string; type: string; minutes: number }> = isTherapy ? [
    { title: "Soft start", description: "Time with the parakeets and ducklings. Just be.", slug: "animal-care", type: "morning_warmup", minutes: 30 },
    { title: "Easy math warm-up", description: "A few duckling-themed practice problems. No pressure.", slug: "math", type: "math", minutes: 25 },
    { title: "Choice block", description: "What you want today. Art, makeup, drawing, anything.", slug: "choice", type: "choice", minutes: 30 },
    { title: "Therapy with Ali", description: "Wednesday session with Ali Hill. Mom will let you know.", slug: undefined, type: "appointment", minutes: 90 },
    { title: "Lunch + reset", description: "Cozy lunch back home.", slug: undefined, type: "custom", minutes: 30 },
    { title: "Read-aloud", description: "Tuck Everlasting, snug-in time.", slug: "ela", type: "read_aloud", minutes: 25 },
    { title: "Adventure of the day", description: "Pick something gentle from the Adventure library.", slug: "science", type: "adventure", minutes: 35 },
  ] : [
    { title: "Soft start", description: "Time with the parakeets and ducklings. Just be.", slug: "animal-care", type: "morning_warmup", minutes: 25 },
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
  return rows.map(r => {
    const sub = r.subjectId ? byId[r.subjectId] : null;
    return { ...r, subjectSlug: sub?.slug || null, subjectName: sub?.name || null, emoji: sub?.emoji || null, estimatedMinutes: r.durationMin };
  });
}

export async function createBlock(b: typeof scheduleBlocks.$inferInsert) {
  const db = getDb();
  const result = await db.insert(scheduleBlocks).values(b);
  return (result as any)[0]?.insertId;
}

export async function updateBlock(id: number, patch: Partial<typeof scheduleBlocks.$inferInsert>) {
  await getDb().update(scheduleBlocks).set(patch).where(eq(scheduleBlocks.id, id));
}

export async function deleteBlock(id: number) {
  await getDb().delete(scheduleBlocks).where(eq(scheduleBlocks.id, id));
}

export async function getBlock(id: number) {
  const rows = await getDb().select().from(scheduleBlocks).where(eq(scheduleBlocks.id, id)).limit(1);
  return rows[0] || null;
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

/* ============================== APPS ====================================== */
export async function listAppLinks() {
  return getDb().select().from(appLinks).orderBy(appLinks.sortOrder);
}
export async function insertAppLink(a: typeof appLinks.$inferInsert) {
  await getDb().insert(appLinks).values(a);
}

/* ============================== BOOKS ===================================== */
export async function listBooks() {
  return getDb().select().from(books).orderBy(books.title);
}
export async function getBook(id: number) {
  const rows = await getDb().select().from(books).where(eq(books.id, id)).limit(1);
  return rows[0] || null;
}
export async function insertBook(b: typeof books.$inferInsert) {
  await getDb().insert(books).values(b);
}
export async function updateBookPage(id: number, currentPage: number) {
  await getDb().update(books).set({ currentPage }).where(eq(books.id, id));
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
export async function listIHAssignments(daysBack = 14) {
  const since = new Date(Date.now() - daysBack * 86400000);
  return getDb().select().from(ihAssignments).where(gte(ihAssignments.syncedAt, since)).orderBy(desc(ihAssignments.postedAt));
}
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
export async function listWhisperMessages(limit = 50) {
  return getDb().select().from(whisperSessions).orderBy(desc(whisperSessions.createdAt)).limit(limit);
}
export async function insertWhisperMessage(m: typeof whisperSessions.$inferInsert) {
  await getDb().insert(whisperSessions).values(m);
}
export async function clearWhisperHistory() {
  await getDb().delete(whisperSessions);
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
export async function wellnessScore(daysBack = 7) {
  const moods = await listRecentMood(daysBack);
  const struggles = await listStruggles(daysBack);
  const yellows = moods.filter(m => m.zone === "yellow").length;
  const reds = moods.filter(m => m.zone === "red").length;
  const greens = moods.filter(m => m.zone === "green").length;
  const totalMoods = moods.length || 1;
  const anxietyScore = Math.min(100, Math.round((reds * 30 + yellows * 15) + (struggles.filter(s => s.intensity === "red").length * 10)));
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

export async function listKnowledgeForWhisper(limit = 30) {
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
export async function createTakeNote(patch: { subjectSlug?: string; title?: string; body?: string; strokes?: any; pngFileKey?: string; pngFileUrl?: string; tags?: string[] }) {
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
  return db.select().from(assignmentSubmissions).orderBy(desc(assignmentSubmissions.submittedAt)).limit(limit);
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

export async function listAcademicRecords(filter?: { source?: AcademicSource; subjectSlug?: string; limit?: number }) {
  const db = getDb();
  const limit = filter?.limit ?? 200;
  let rows = await db.select().from(academicRecords).orderBy(desc(academicRecords.createdAt)).limit(limit);
  if (filter?.source) rows = rows.filter((r) => r.source === filter.source);
  if (filter?.subjectSlug) rows = rows.filter((r) => r.subjectSlug === filter.subjectSlug);
  return rows;
}

export async function createAcademicRecord(input: {
  source: AcademicSource; kind: AcademicKind; subjectSlug?: string; title: string;
  summary?: string; scoreText?: string; scorePercent?: number;
  assignedAt?: Date; dueAt?: Date; completedAt?: Date;
  payload?: string; metadata?: Record<string, any>;
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
