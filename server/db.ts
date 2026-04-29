import { ENV } from "./_core/env";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { eq, desc, and, gte, lte, sql, isNotNull, asc } from "drizzle-orm";
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
  printableSources, printableFavorites, academicRecords, auditLog, iepGoals, iepAccommodations,
  stickers, goodWorkNotes, coinLedger, prizes, prizeRedemptions, certificates,
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


/* ============================== AUDIT LOG ================================= */
export type AuditEntityType = "block" | "book" | "app" | "timeline" | "adventure" | "needsWork" | "recipient" | "appointment" | "note" | "submission" | "answerKey" | "academic" | "blockGrade";
export type AuditAction = "create" | "update" | "delete" | "complete" | "reopen" | "grade" | "submit";

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
  const coins = params.coins ?? 1;
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
  return { stickerId, art, palette, coins };
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
import { skillLadder, skillProgress, proudMoments } from "../drizzle/schema";

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
import { inArray } from "drizzle-orm";

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
        await recordSkillPractice({ skillLadderId: s.skillLadderId, mode: "tutor" as any, selfRating: s.outcome === "strong" ? 5 : 4 });
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
