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
  await db.insert(dailyPlans).values({ date: dateStr as any, dayType });
  return getPlanByDate(dateStr);
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
