import {
  boolean,
  date,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Roles: admin = parents (Mom Katy, the user / Ali-side helper),
 *        tutor = Grandma Marcy + any tutors / helpers
 *        user (default) = no edit privileges; not used in our home team
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "tutor", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});
export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/* -------------------------------------------------------------------------- */
/*  SUBJECTS                                                                  */
/* -------------------------------------------------------------------------- */
export const subjects = mysqlTable("subjects", {
  id: int("id").autoincrement().primaryKey(),
  slug: varchar("slug", { length: 32 }).notNull().unique(), // math, ela, science, ss, adventure, choice, catch_up, reading
  name: varchar("name", { length: 64 }).notNull(),
  color: varchar("color", { length: 16 }).notNull(), // hex
  emoji: varchar("emoji", { length: 8 }).notNull(),
  sortOrder: int("sortOrder").default(0).notNull(),
});

/* -------------------------------------------------------------------------- */
/*  DAILY PLANS                                                               */
/* -------------------------------------------------------------------------- */
export const dailyPlans = mysqlTable("dailyPlans", {
  id: int("id").autoincrement().primaryKey(),
  date: date("date").notNull().unique(),
  dayType: mysqlEnum("dayType", [
    "full",
    "half",
    "outdoor",
    "field_trip",
    "recovery",
    "off",
  ]).default("full").notNull(),
  status: mysqlEnum("status", ["planned", "in_progress", "complete", "skipped"]).default("planned").notNull(),
  notes: text("notes"),
  isTemplate: boolean("isTemplate").default(false).notNull(),
  templateName: varchar("templateName", { length: 128 }),
  parentPlanId: int("parentPlanId"), // for copies/duplicates
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

/* -------------------------------------------------------------------------- */
/*  SCHEDULE BLOCKS (5 default + optional catch-up + appointments)            */
/* -------------------------------------------------------------------------- */
export const scheduleBlocks = mysqlTable("scheduleBlocks", {
  id: int("id").autoincrement().primaryKey(),
  planId: int("planId").notNull(),
  blockType: mysqlEnum("blockType", [
    "morning_warmup",
    "math",
    "adventure",
    "read_aloud",
    "choice",
    "catch_up",
    "appointment",
    "custom",
  ]).notNull(),
  subjectId: int("subjectId"),
  title: varchar("title", { length: 200 }).notNull(),
  description: text("description"),
  durationMin: int("durationMin").default(30).notNull(),
  startTime: varchar("startTime", { length: 8 }), // "09:00", optional flexible
  sortOrder: int("sortOrder").default(0).notNull(),
  status: mysqlEnum("status", ["not_started", "in_progress", "complete", "skipped"]).default("not_started").notNull(),
  completedAt: timestamp("completedAt"),
  completedByUserId: int("completedByUserId"),
  grade: varchar("grade", { length: 16 }), // e.g. "A", "85%", "Mastered"
  notes: text("notes"),
  ihAssignmentId: int("ihAssignmentId"),
  adventureId: int("adventureId"),
  appointmentId: int("appointmentId"),
  /** Curriculum topic this block is anchored to (Math 7-4, ELA M3-L1, etc.). */
  curriculumTopicId: int("curriculumTopicId"),
});

/* -------------------------------------------------------------------------- */
/*  BOOK ASSIGNMENTS — physical workbook page references inside a block       */
/* -------------------------------------------------------------------------- */
export const bookAssignments = mysqlTable("bookAssignments", {
  id: int("id").autoincrement().primaryKey(),
  blockId: int("blockId").notNull(),
  bookId: int("bookId").notNull(),
  fromPage: int("fromPage").notNull(),
  toPage: int("toPage").notNull(),
  notes: text("notes"),
  status: mysqlEnum("status", ["assigned", "complete"]).default("assigned").notNull(),
});

/* -------------------------------------------------------------------------- */
/*  ADVENTURES LIBRARY (100+ hands-on / outdoor / interest-led activities)    */
/* -------------------------------------------------------------------------- */
export const adventures = mysqlTable("adventures", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 200 }).notNull(),
  description: text("description").notNull(),
  subjectSlugs: json("subjectSlugs").$type<string[]>().notNull(), // ["science","math"]
  topicTags: json("topicTags").$type<string[]>().notNull(), // ["birds","plants","decimals"]
  interestTags: json("interestTags").$type<string[]>().notNull(), // ["birds","water","outdoor"]
  minDurationMin: int("minDurationMin").default(30).notNull(),
  maxDurationMin: int("maxDurationMin").default(90).notNull(),
  setting: mysqlEnum("setting", ["indoor", "outdoor", "either"]).default("either").notNull(),
  energyLevel: mysqlEnum("energyLevel", ["low", "medium", "high"]).default("medium").notNull(),
  materials: json("materials").$type<string[]>().notNull(),
  instructions: text("instructions").notNull(),
  ohioStandards: json("ohioStandards").$type<string[]>(),
  isFavorite: boolean("isFavorite").default(false).notNull(),
  coverImageUrl: varchar("coverImageUrl", { length: 500 }),
  emoji: varchar("emoji", { length: 8 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

/* -------------------------------------------------------------------------- */
/*  APP LINKS HUB                                                             */
/* -------------------------------------------------------------------------- */
export const appLinks = mysqlTable("appLinks", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  url: varchar("url", { length: 500 }).notNull(),
  category: mysqlEnum("category", ["learning", "creativity", "school", "nature", "reading", "google", "video"]).default("learning").notNull(),
  emoji: varchar("emoji", { length: 8 }).notNull(),
  description: text("description"),
  accountInfo: text("accountInfo"), // username hint, NEVER passwords
  sortOrder: int("sortOrder").default(0).notNull(),
});

/* -------------------------------------------------------------------------- */
/*  BOOKS — physical books on Reagan's bookshelf                              */
/* -------------------------------------------------------------------------- */
export const books = mysqlTable("books", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 200 }).notNull(),
  author: varchar("author", { length: 200 }),
  type: mysqlEnum("type", ["workbook", "novel", "reference", "audiobook", "chapter_book"]).default("workbook").notNull(),
  subjectSlug: varchar("subjectSlug", { length: 32 }),
  currentPage: int("currentPage").default(1).notNull(),
  currentChapter: int("currentChapter"),
  totalPages: int("totalPages"),
  totalChapters: int("totalChapters"),
  defaultDailyPageSpan: int("defaultDailyPageSpan").default(2).notNull(),
  status: mysqlEnum("status", ["not_started", "in_progress", "in_progress_unstructured", "done", "shelved"]).default("not_started").notNull(),
  topicCodes: json("topicCodes"),
  notes: text("notes"),
  coverUrl: varchar("coverUrl", { length: 500 }),
});

/* -------------------------------------------------------------------------- */
/*  BOOK PAGES DONE (sparse: only stores known-completed pages so the AI      */
/*  scheduler can skip them when generating book reading assignments)          */
/* -------------------------------------------------------------------------- */
export const bookPagesDone = mysqlTable("bookPagesDone", {
  id: int("id").autoincrement().primaryKey(),
  bookId: int("bookId").notNull(),
  pageNumber: int("pageNumber").notNull(),
  status: mysqlEnum("status", ["done", "skipped"]).default("done").notNull(),
  source: mysqlEnum("source", ["tutor_recon", "agenda_complete", "manual"]).default("manual").notNull(),
  completedAt: timestamp("completedAt").defaultNow().notNull(),
  completedBy: varchar("completedBy", { length: 100 }),
  note: varchar("note", { length: 200 }),
}, (t) => ({
  bookPageUnique: uniqueIndex("bookPagesDone_book_page_unique").on(t.bookId, t.pageNumber),
}));

/* -------------------------------------------------------------------------- */
/*  MOOD LOGS (Green / Yellow / Red zone)                                     */
/* -------------------------------------------------------------------------- */
export const moodLogs = mysqlTable("moodLogs", {
  id: int("id").autoincrement().primaryKey(),
  planId: int("planId").notNull(),
  zone: mysqlEnum("zone", ["green", "yellow", "red"]).notNull(),
  note: text("note"),
  loggedByUserId: int("loggedByUserId"),
  loggedAt: timestamp("loggedAt").defaultNow().notNull(),
});

/* -------------------------------------------------------------------------- */
/*  TIMELINE / PORTFOLIO EVENTS                                               */
/* -------------------------------------------------------------------------- */
export const timelineEvents = mysqlTable("timelineEvents", {
  id: int("id").autoincrement().primaryKey(),
  date: date("date").notNull(),
  eventType: mysqlEnum("eventType", [
    "completion",
    "milestone",
    "creation",
    "field_trip",
    "reflection",
    "adventure",
  ]).notNull(),
  title: varchar("title", { length: 200 }).notNull(),
  description: text("description"),
  subjectSlug: varchar("subjectSlug", { length: 32 }),
  mediaUrl: varchar("mediaUrl", { length: 1000 }),
  createdByUserId: int("createdByUserId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

/* -------------------------------------------------------------------------- */
/*  NOTIFICATIONS (in-app)                                                    */
/* -------------------------------------------------------------------------- */
export const notifications = mysqlTable("notifications", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId"), // null = broadcast to all admins
  type: mysqlEnum("type", ["red_zone", "block_complete", "milestone", "ih_update", "reminder", "info"]).notNull(),
  title: varchar("title", { length: 200 }).notNull(),
  body: text("body"),
  link: varchar("link", { length: 500 }),
  read: boolean("read").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

/* -------------------------------------------------------------------------- */
/*  IH ASSIGNMENTS — read-only mirror of Indian Hill class assignments        */
/* -------------------------------------------------------------------------- */
export const ihAssignments = mysqlTable("ihAssignments", {
  id: int("id").autoincrement().primaryKey(),
  sourceTeacher: varchar("sourceTeacher", { length: 100 }).notNull(),
  sourceClass: varchar("sourceClass", { length: 100 }).notNull(),
  title: varchar("title", { length: 300 }).notNull(),
  description: text("description"),
  postedAt: timestamp("postedAt"),
  dueDate: date("dueDate"),
  url: varchar("url", { length: 1000 }),
  raw: json("raw"),
  syncedAt: timestamp("syncedAt").defaultNow().notNull(),
});

/* -------------------------------------------------------------------------- */
/*  LEARNER PROFILE — single-row settings (id=1) for Reagan                   */
/* -------------------------------------------------------------------------- */
export const learnerProfile = mysqlTable("learnerProfile", {
  id: int("id").autoincrement().primaryKey(),
  studentName: varchar("studentName", { length: 100 }).default("Reagan").notNull(),
  gradeLevel: varchar("gradeLevel", { length: 32 }).default("5th Grade").notNull(),
  accommodations: json("accommodations").$type<string[]>(),
  triggers: json("triggers").$type<string[]>(),
  whatWorks: json("whatWorks").$type<string[]>(),
  whatHarms: json("whatHarms").$type<string[]>(),
  contacts: json("contacts").$type<{ name: string; role: string; phone?: string; email?: string }[]>(),
  interests: json("interests").$type<string[]>(),
  notes: text("notes"),
  companionName: varchar("companionName", { length: 64 }).default("Whisper"),
  companionAvatar: varchar("companionAvatar", { length: 16 }).default("⭐"),
  companionTonePreference: varchar("companionTonePreference", { length: 64 }),
  photoUrl: varchar("photoUrl", { length: 500 }),
  theme: varchar("theme", { length: 32 }).default("chalkboard").notNull(),
  voiceMode: varchar("voiceMode", { length: 16 }).default("text").notNull(), // voice | text | silent
  onboardingCompleted: boolean("onboardingCompleted").default(false).notNull(),
  adultPasscode: varchar("adultPasscode", { length: 8 }).default("3918").notNull(),
  // ---- Reagan handoff bundle (Apr 2026) — rich About-Me fields, all editable in Settings ----
  birthday: varchar("birthday", { length: 10 }), // ISO date YYYY-MM-DD
  pronouns: varchar("pronouns", { length: 32 }),
  selfStatement: text("selfStatement"), // "I am an animal rescuer. I always have been."
  selfAdvocacyStatement: text("selfAdvocacyStatement"),
  schoolHistory: json("schoolHistory").$type<Array<{ school: string; district: string; years: string; transferDate?: string }>>(),
  family: json("family").$type<Record<string, any>>(),
  pets: json("pets").$type<Array<{ name: string; species: string; role?: string }>>(),
  sensoryLoves: json("sensoryLoves").$type<string[]>(),
  sensoryAvoids: json("sensoryAvoids").$type<string[]>(),
  favoriteFoods: json("favoriteFoods").$type<string[]>(),
  favoriteShows: json("favoriteShows").$type<string[]>(),
  favoriteBooks: json("favoriteBooks").$type<string[]>(),
  diagnoses: json("diagnoses").$type<string[]>(),
  currentSupports: json("currentSupports").$type<string[]>(),
  weeklyScheduleTemplate: json("weeklyScheduleTemplate").$type<Record<string, any>>(),
});

/* -------------------------------------------------------------------------- */
/*  JOURNAL ENTRIES — Reagan's free-form daily journal                        */
/* -------------------------------------------------------------------------- */
export const journalEntries = mysqlTable("journalEntries", {
  id: int("id").autoincrement().primaryKey(),
  date: date("date").notNull(),
  title: varchar("title", { length: 200 }),
  body: text("body").notNull(),
  mood: varchar("mood", { length: 16 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

/* -------------------------------------------------------------------------- */
/*  HELP LIST — "What I need help with" running list                          */
/* -------------------------------------------------------------------------- */
export const helpList = mysqlTable("helpList", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 200 }).notNull(),
  note: text("note"),
  subjectSlug: varchar("subjectSlug", { length: 32 }),
  status: mysqlEnum("status", ["open", "in_progress", "resolved"]).default("open").notNull(),
  priority: mysqlEnum("priority", ["low", "medium", "high"]).default("medium").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  resolvedAt: timestamp("resolvedAt"),
});

/* -------------------------------------------------------------------------- */
/*  SKILLS MASTERY — IEP-style 1-100% rating per skill                        */
/* -------------------------------------------------------------------------- */
export const skillsMastery = mysqlTable("skillsMastery", {
  id: int("id").autoincrement().primaryKey(),
  subjectSlug: varchar("subjectSlug", { length: 32 }).notNull(),
  skillName: varchar("skillName", { length: 200 }).notNull(),
  domain: varchar("domain", { length: 100 }), // e.g. "Numbers & Operations"
  currentScore: int("currentScore").default(0).notNull(),
  lastPracticedAt: timestamp("lastPracticedAt"),
  needsHelp: boolean("needsHelp").default(false).notNull(),
  sourceData: json("sourceData"),
  notes: text("notes"),
  // Reagan handoff (Apr 2026): canonical practice links + IEP flag
  khanUrl: varchar("khanUrl", { length: 500 }),
  ixlCode: varchar("ixlCode", { length: 200 }),
  iepGoal: boolean("iepGoal").default(false).notNull(),
});

/* -------------------------------------------------------------------------- */
/*  WEEKLY TOPICS — what subjects/topics to emphasize each week               */
/* -------------------------------------------------------------------------- */
export const weeklyTopics = mysqlTable("weeklyTopics", {
  id: int("id").autoincrement().primaryKey(),
  weekStartDate: date("weekStartDate").notNull(),
  subjectSlug: varchar("subjectSlug", { length: 32 }).notNull(),
  topics: json("topics").$type<string[]>().notNull(),
  notes: text("notes"),
});

/* -------------------------------------------------------------------------- */
/*  NOTIFICATION RECIPIENTS — emails to send updates to                       */
/* -------------------------------------------------------------------------- */
export const notificationRecipients = mysqlTable("notificationRecipients", {
  id: int("id").autoincrement().primaryKey(),
  email: varchar("email", { length: 320 }).notNull(),
  displayName: varchar("displayName", { length: 100 }),
  role: mysqlEnum("role", ["parent", "grandparent", "tutor", "other"]).default("other").notNull(),
  optInTypes: json("optInTypes").$type<string[]>(), // ["weekly_packet","red_zone","block_complete","milestone"]
  active: boolean("active").default(true).notNull(),
});

/* -------------------------------------------------------------------------- */
/*  RECURRING APPOINTMENTS                                                    */
/* -------------------------------------------------------------------------- */
export const appointments = mysqlTable("appointments", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 200 }).notNull(),
  contactName: varchar("contactName", { length: 100 }),
  recurrenceRule: varchar("recurrenceRule", { length: 100 }), // e.g. "weekly:wednesday"
  startTime: varchar("startTime", { length: 8 }), // "11:00"
  endTime: varchar("endTime", { length: 8 }), // "12:00"
  leaveTime: varchar("leaveTime", { length: 8 }), // "10:40"
  returnTime: varchar("returnTime", { length: 8 }), // "12:30"
  durationMin: int("durationMin").default(60).notNull(),
  isProtected: boolean("isProtected").default(true).notNull(),
  decompressionBufferMin: int("decompressionBufferMin").default(30).notNull(),
  notes: text("notes"),
  active: boolean("active").default(true).notNull(),
});

/* -------------------------------------------------------------------------- */
/*  IH SCHOOL CALENDAR — days IH is off                                       */
/* -------------------------------------------------------------------------- */
export const schoolCalendar = mysqlTable("schoolCalendar", {
  id: int("id").autoincrement().primaryKey(),
  date: date("date").notNull().unique(),
  isOff: boolean("isOff").default(true).notNull(),
  label: varchar("label", { length: 200 }).notNull(),
  source: varchar("source", { length: 100 }).default("Indian Hill 2025-26"),
});


/* -------------------------------------------------------------------------- */
/*  ANIMALS — Reagan's real-life menagerie                                    */
/* -------------------------------------------------------------------------- */
export const animals = mysqlTable("animals", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  species: varchar("species", { length: 100 }).notNull(),
  notes: text("notes"),
  photoUrl: varchar("photoUrl", { length: 1000 }),
  dateAdded: date("dateAdded"),
  isActive: boolean("isActive").default(true).notNull(),
  sortOrder: int("sortOrder").default(0).notNull(),
});

/* -------------------------------------------------------------------------- */
/*  RESCUES — Animal Whisperer's first-class rescue journal                   */
/* -------------------------------------------------------------------------- */
export const rescues = mysqlTable("rescues", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 100 }),
  species: varchar("species", { length: 100 }).notNull(),
  dateFound: date("dateFound").notNull(),
  location: varchar("location", { length: 200 }),
  condition: text("condition"),
  carePlan: text("carePlan"),
  outcome: mysqlEnum("outcome", ["in_care", "released", "transferred", "passed", "adopted"]).default("in_care").notNull(),
  releaseDate: date("releaseDate"),
  photoUrl: varchar("photoUrl", { length: 1000 }),
  notes: text("notes"),
  loggedByUserId: int("loggedByUserId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

/* -------------------------------------------------------------------------- */
/*  BADGES — Whisperer accomplishments                                       */
/* -------------------------------------------------------------------------- */
export const badges = mysqlTable("badges", {
  id: int("id").autoincrement().primaryKey(),
  slug: varchar("slug", { length: 64 }).notNull().unique(),
  name: varchar("name", { length: 100 }).notNull(),
  emoji: varchar("emoji", { length: 8 }).notNull(),
  description: text("description").notNull(),
  criteria: text("criteria").notNull(),
  earned: boolean("earned").default(false).notNull(),
  earnedAt: timestamp("earnedAt"),
  progress: int("progress").default(0).notNull(),
  target: int("target").default(1).notNull(),
});

/* -------------------------------------------------------------------------- */
/*  WHISPER SESSIONS — chat history with the AI companion                    */
/* -------------------------------------------------------------------------- */
export const whisperSessions = mysqlTable("whisperSessions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId"),
  role: mysqlEnum("role", ["user", "assistant", "system"]).notNull(),
  content: text("content").notNull(),
  blockId: int("blockId"),
  mode: mysqlEnum("mode", ["text", "voice"]).default("text").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

/* -------------------------------------------------------------------------- */
/*  HEART NOTES — Reagan's private journaling space                          */
/* -------------------------------------------------------------------------- */
export const heartNotes = mysqlTable("heartNotes", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId"),
  content: text("content").notNull(),
  whisperResponse: text("whisperResponse"),
  sharedWithMom: boolean("sharedWithMom").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

/* -------------------------------------------------------------------------- */
/*  ENCOURAGEMENT NOTES — from family adults to Reagan                       */
/* -------------------------------------------------------------------------- */
export const encouragementNotes = mysqlTable("encouragementNotes", {
  id: int("id").autoincrement().primaryKey(),
  fromName: varchar("fromName", { length: 100 }).notNull(),
  fromUserId: int("fromUserId"),
  content: text("content").notNull(),
  starred: boolean("starred").default(false).notNull(),
  read: boolean("read").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

/* -------------------------------------------------------------------------- */
/*  EMOTIONAL STRUGGLES — logged only when she struggles                      */
/* -------------------------------------------------------------------------- */
export const emotionalStruggles = mysqlTable("emotionalStruggles", {
  id: int("id").autoincrement().primaryKey(),
  planId: int("planId"),
  blockId: int("blockId"),
  subjectSlug: varchar("subjectSlug", { length: 32 }),
  topicTag: varchar("topicTag", { length: 100 }),
  intensity: mysqlEnum("intensity", ["green", "yellow", "red"]).notNull(),
  description: text("description"),
  triggers: json("triggers").$type<string[]>(),
  copingUsed: json("copingUsed").$type<string[]>(),
  resolved: boolean("resolved").default(false).notNull(),
  loggedByUserId: int("loggedByUserId"),
  loggedAt: timestamp("loggedAt").defaultNow().notNull(),
});

/* -------------------------------------------------------------------------- */
/*  REAGAN KNOWLEDGE — auto-ingested insights from Gmail/Drive about Reagan   */
/* -------------------------------------------------------------------------- */
export const reaganKnowledge = mysqlTable("reaganKnowledge", {
  id: int("id").autoincrement().primaryKey(),
  source: mysqlEnum("source", ["gmail", "gdrive", "manual", "chat_history"]).notNull(),
  sourceTitle: varchar("sourceTitle", { length: 500 }),
  sourceUrl: varchar("sourceUrl", { length: 1000 }),
  sourceDate: date("sourceDate"),
  insightType: mysqlEnum("insightType", [
    "academic_strength","academic_gap","trigger","accommodation","interest",
    "medical","social","preference","quote","strategy","context","general"
  ]).notNull(),
  insight: text("insight").notNull(),
  confidence: mysqlEnum("confidence", ["low", "medium", "high"]).default("medium").notNull(),
  active: boolean("active").default(true).notNull(),
  sensitive: boolean("sensitive").default(false).notNull(),
  approvedBy: int("approvedBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

/* -------------------------------------------------------------------------- */
/*  SPECIAL DAYS — meteor showers, eclipses, bird days, full moons, etc.      */
/* -------------------------------------------------------------------------- */
export const specialDays = mysqlTable("specialDays", {
  id: int("id").autoincrement().primaryKey(),
  date: date("date").notNull(),
  name: varchar("name", { length: 200 }).notNull(),
  category: mysqlEnum("category", [
    "astronomy",
    "nature",
    "animal",
    "plant",
    "seasonal",
    "spiritual",
    "service",
    "quirky",
    "art",
  ]).notNull(),
  description: text("description").notNull(),
  suggestedActivity: text("suggestedActivity"),
  interestTags: json("interestTags").$type<string[]>(),
  viewingTimeNote: varchar("viewingTimeNote", { length: 200 }),
  isOptional: boolean("isOptional").default(true).notNull(),
});


/* -------------------------------------------------------------------------- */
/*  ASSIGNMENT SUBMISSIONS — Reagan turns work in HERE, never to school       */
/* -------------------------------------------------------------------------- */
export const assignmentSubmissions = mysqlTable("assignmentSubmissions", {
  id: int("id").autoincrement().primaryKey(),
  blockId: int("blockId"),
  subjectSlug: varchar("subjectSlug", { length: 32 }),
  title: varchar("title", { length: 200 }),
  submissionType: mysqlEnum("submissionType", ["text", "photo", "file", "audio"]).notNull(),
  contentText: text("contentText"),
  fileKey: varchar("fileKey", { length: 500 }),
  fileUrl: varchar("fileUrl", { length: 1000 }),
  fileMimeType: varchar("fileMimeType", { length: 100 }),
  driveFileId: varchar("driveFileId", { length: 200 }),
  driveFileUrl: varchar("driveFileUrl", { length: 1000 }),
  // Adult review fields
  reviewStatus: mysqlEnum("reviewStatus", ["pending", "reviewed", "retry", "flagged"]).default("pending").notNull(),
  rubricPick: mysqlEnum("rubricPick", ["not_yet", "getting_there", "got_it", "mastered"]),
  rubricScore: int("rubricScore"), // full 0-100 precision, only shown when slider is expanded
  adultNotes: text("adultNotes"),
  /**
   * How hard Reagan said it felt. Self-rating captured in TurnInDialog.
   * easy | just_right | tricky | really_hard
   */
  kidDifficulty: mysqlEnum("kidDifficulty", ["easy", "just_right", "tricky", "really_hard"]),
  /** True when the assignment was a reading bucket marked done with one tap (no photo). */
  readingOnly: boolean("readingOnly").default(false).notNull(),
  reviewedAt: timestamp("reviewedAt"),
  reviewedByUserId: int("reviewedByUserId"),
  submittedAt: timestamp("submittedAt").defaultNow().notNull(),
});

/* -------------------------------------------------------------------------- */
/*  ASSIGNMENT ANSWER KEYS — one row per block that expects gradable answers */
/* -------------------------------------------------------------------------- */
export const assignmentAnswerKeys = mysqlTable("assignmentAnswerKeys", {
  id: int("id").autoincrement().primaryKey(),
  blockId: int("blockId").notNull(), // scheduleBlocks.id
  /**
   * Structured key:
   *   [{ qId, kind: 'mc'|'text'|'drawn', correct?: string, rubric?: string, points?: number }]
   * - mc: correct holds the canonical choice id/letter
   * - text: correct holds the target answer; rubric holds LLM grading guidance
   * - drawn: rubric tells the LLM-vision grader what to look for in the ink
   */
  questions: json("questions").$type<
    Array<{
      qId: string;
      kind: "mc" | "text" | "drawn";
      prompt?: string;
      correct?: string;
      rubric?: string;
      points?: number;
    }>
  >().notNull(),
  totalPoints: int("totalPoints").default(100).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

/* -------------------------------------------------------------------------- */
/*  TAKE NOTES — Reagan's notebook (typed + drawn)                            */
/* -------------------------------------------------------------------------- */
export const takeNotes = mysqlTable("takeNotes", {
  id: int("id").autoincrement().primaryKey(),
  subjectSlug: varchar("subjectSlug", { length: 32 }),
  title: varchar("title", { length: 200 }),
  /** typed portion (markdown) */
  body: text("body"),
  /**
   * Drawn portion — array of stroke objects in the shape used by perfect-freehand:
   *   { color: string; size: number; points: [x, y, pressure][] }
   */
  strokes: json("strokes").$type<
    Array<{ color: string; size: number; points: Array<[number, number, number]> }>
  >(),
  /** Optional rendered PNG of the drawn portion for quick preview */
  pngFileKey: varchar("pngFileKey", { length: 500 }),
  pngFileUrl: varchar("pngFileUrl", { length: 1000 }),
  tags: json("tags").$type<string[]>(),
  /** Optional reference to a schedule block this note belongs to. */
  linkedBlockId: int("linkedBlockId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

/* -------------------------------------------------------------------------- */
/*  CURRICULUM ADJUSTMENTS — adaptive suggestions queue                      */
/* -------------------------------------------------------------------------- */
export const curriculumAdjustments = mysqlTable("curriculumAdjustments", {
  id: int("id").autoincrement().primaryKey(),
  subjectSlug: varchar("subjectSlug", { length: 32 }).notNull(),
  weekStart: date("weekStart").notNull(),
  /** Suggestion the engine wants to apply */
  suggestion: text("suggestion").notNull(),
  /** Why it was suggested (mastery drop, recent low grade, trigger, etc.) */
  reason: text("reason"),
  /** The topic it replaces / augments in weeklyTopics, if any */
  affectsTopicId: int("affectsTopicId"),
  status: mysqlEnum("status", ["proposed", "accepted", "rejected", "applied"])
    .default("proposed").notNull(),
  proposedAt: timestamp("proposedAt").defaultNow().notNull(),
  decidedAt: timestamp("decidedAt"),
  decidedByUserId: int("decidedByUserId"),
});

/* -------------------------------------------------------------------------- */
/*  BLOCK GRADES — adult completion grade per scheduleBlock                  */
/* -------------------------------------------------------------------------- */
export const blockGrades = mysqlTable("blockGrades", {
  id: int("id").autoincrement().primaryKey(),
  blockId: int("blockId").notNull().unique(),
  subjectSlug: varchar("subjectSlug", { length: 32 }),
  /** 0-100 */
  score: int("score").notNull(),
  /** Derived letter grade (A/B/C/D/F) saved for display */
  letter: varchar("letter", { length: 2 }),
  /** Kid-facing label, never a number */
  kidLabel: mysqlEnum("kidLabel", ["not_yet", "getting_there", "got_it", "mastered"])
    .default("got_it").notNull(),
  note: text("note"),
  gradedAt: timestamp("gradedAt").defaultNow().notNull(),
  gradedByUserId: int("gradedByUserId"),
});

/* -------------------------------------------------------------------------- */
/*  NEEDS WORK ITEMS — adult-only hierarchical to-do tree                    */
/* -------------------------------------------------------------------------- */
export const needsWorkItems = mysqlTable("needsWorkItems", {
  id: int("id").autoincrement().primaryKey(),
  /** Self-referencing parent for arbitrary nesting */
  parentId: int("parentId"),
  subjectSlug: varchar("subjectSlug", { length: 32 }),
  title: varchar("title", { length: 300 }).notNull(),
  note: text("note"),
  /** Where it came from: auto from mastery drop / struggle / low grade, or 'manual' */
  origin: mysqlEnum("origin", ["manual", "mastery", "struggle", "low_grade", "external"])
    .default("manual").notNull(),
  sortOrder: int("sortOrder").default(0).notNull(),
  dateAdded: date("dateAdded").notNull(),
  /** When set, the UI strikes the row and all descendants */
  dateCompleted: date("dateCompleted"),
  completedByUserId: int("completedByUserId"),
});

/* -------------------------------------------------------------------------- */
/*  PRINTABLE SOURCES — adult-only worksheet hub                              */
/* -------------------------------------------------------------------------- */
export const printableSources = mysqlTable("printableSources", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 120 }).notNull(),
  url: varchar("url", { length: 500 }).notNull(),
  /** Deep-link search pattern with {q} placeholder, e.g. https://…/search?q={q} */
  searchUrl: varchar("searchUrl", { length: 500 }),
  description: text("description"),
  /** Subject tags as a json array */
  subjects: json("subjects").$type<string[]>(),
  /** Grade tags (e.g. ["4","5","6"]) */
  grades: json("grades").$type<string[]>(),
  /** "Ohio", "National", "Grade-5", etc. free tag list for filters */
  tags: json("tags").$type<string[]>(),
  /** Priority for sorting in UI */
  sortOrder: int("sortOrder").default(0).notNull(),
  isActive: boolean("isActive").default(true).notNull(),
});

/* -------------------------------------------------------------------------- */
/*  PRINTABLE FAVORITES — mom's shortlist, optionally linked to a day block  */
/* -------------------------------------------------------------------------- */
export const printableFavorites = mysqlTable("printableFavorites", {
  id: int("id").autoincrement().primaryKey(),
  sourceId: int("sourceId").notNull(),
  title: varchar("title", { length: 300 }).notNull(),
  url: varchar("url", { length: 1000 }).notNull(),
  subjectSlug: varchar("subjectSlug", { length: 32 }),
  note: text("note"),
  savedAt: timestamp("savedAt").defaultNow().notNull(),
});

/* Extend assignmentSubmissions with auto-grading fields                      */
/*   (kept here near the new tables for readability; drizzle will merge).     */
export const assignmentSubmissionsAutoGrade = mysqlTable("assignmentSubmissionsAutoGrade", {
  id: int("id").autoincrement().primaryKey(),
  submissionId: int("submissionId").notNull().unique(),
  autoScore: int("autoScore"),           // 0-100
  autoLetter: varchar("autoLetter", { length: 2 }),
  autoFeedback: text("autoFeedback"),
  /** answers Reagan submitted, shape matches questions[] by qId */
  answers: json("answers").$type<Record<string, string>>(),
  gradedAt: timestamp("gradedAt").defaultNow().notNull(),
});


/**
 * academicRecords — a chronological log of assignments/grades/skills
 * ingested from outside sources. Sources are tagged so the UI can filter.
 * - source: where the row came from (paste/manus_share/gmail/classroom/powerschool_ih/powerschool_madeira/ixl/drive/manual)
 * - kind: assignment | grade | mastery | note | attendance
 * - payload: original raw text/URL blob (optional)
 * - metadata: JSON blob for source-specific fields (URL, classroom id, screenshot key...)
 */
export const academicRecords = mysqlTable("academicRecords", {
  id: int("id").autoincrement().primaryKey(),
  source: mysqlEnum("source", [
    "paste", "manus_share", "gmail", "classroom", "powerschool_ih", "powerschool_madeira",
    "ixl", "drive", "manual",
  ]).notNull(),
  kind: mysqlEnum("kind", ["assignment", "grade", "mastery", "note", "attendance"]).notNull(),
  subjectSlug: varchar("subjectSlug", { length: 32 }),
  title: varchar("title", { length: 300 }).notNull(),
  summary: text("summary"),
  scoreText: varchar("scoreText", { length: 48 }),
  scorePercent: int("scorePercent"),
  assignedAt: timestamp("assignedAt"),
  dueAt: timestamp("dueAt"),
  completedAt: timestamp("completedAt"),
  payload: text("payload"),
  metadata: json("metadata").$type<Record<string, any>>(),
  // Phase: per-year academic timeline.
  // grade        — "K", "1", "2", "3", "4", "5", ...
  // schoolYear   — "2023-24" / "2024-25" / "2025-26"
  // term         — "Q1" | "Q2" | "Q3" | "Q4" | "S1" | "S2" | "YR"
  // teacher      — display name ("Mr. Froehlich")
  // courseName   — course/section label as it appeared in source ("Math 5", "ELA 5 Period 3")
  grade: varchar("grade", { length: 4 }),
  schoolYear: varchar("schoolYear", { length: 9 }),
  term: varchar("term", { length: 4 }),
  teacher: varchar("teacher", { length: 80 }),
  courseName: varchar("courseName", { length: 120 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type AcademicRecord = typeof academicRecords.$inferSelect;

/**
 * auditLog — chronological log of adult edits.
 * Records who changed what, when. Used for the adult-only audit trail panel.
 */
export const auditLog = mysqlTable("auditLog", {
  id: int("id").autoincrement().primaryKey(),
  actorOpenId: varchar("actorOpenId", { length: 64 }),
  actorName: varchar("actorName", { length: 100 }),
  entityType: varchar("entityType", { length: 32 }).notNull(), // block | book | app | timeline | adventure | needsWork | recipient | appointment | note | submission
  entityId: int("entityId"),
  action: mysqlEnum("action", ["create", "update", "delete", "complete", "reopen", "grade", "submit"]).notNull(),
  summary: varchar("summary", { length: 300 }),
  metadata: json("metadata").$type<Record<string, any>>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type AuditLogRow = typeof auditLog.$inferSelect;


/**
 * classroomAgendas — Daily class agendas imported from Google Classroom /
 * teacher Drive folders / emailed agenda images (Mr. Froehlich, Ms. Smith, etc.).
 * One row per teacher-day. Source could be "classroom" | "drive" | "gmail" | "image".
 */
export const classroomAgendas = mysqlTable("classroomAgendas", {
  id: int("id").autoincrement().primaryKey(),
  agendaDate: varchar("agendaDate", { length: 10 }).notNull(), // YYYY-MM-DD
  teacher: varchar("teacher", { length: 100 }),
  course: varchar("course", { length: 120 }),
  subjectSlug: varchar("subjectSlug", { length: 32 }),
  school: varchar("school", { length: 60 }),     // "indian_hill" | "madeira"
  term: varchar("term", { length: 8 }),          // "Q1" | "Q2" | "Q3" | "Q4" | "Y"
  source: varchar("source", { length: 40 }).notNull(), // classroom | drive | gmail | image | manual
  sourceUrl: varchar("sourceUrl", { length: 600 }),
  imageKey: varchar("imageKey", { length: 200 }),
  rawText: text("rawText"),
  topics: json("topics").$type<string[]>(),        // bullet list of what was covered
  assignments: json("assignments").$type<Array<{ title: string; dueAt?: string; notes?: string }>>(),
  standalonePdfKey: varchar("standalonePdfKey", { length: 200 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type ClassroomAgenda = typeof classroomAgendas.$inferSelect;

/**
 * iepGoals — Extracted goals from the most recent IEP. Includes present-levels,
 * measurable goals, criteria, quarterly progress reports. Each row is one goal.
 */
export const iepGoals = mysqlTable("iepGoals", {
  id: int("id").autoincrement().primaryKey(),
  iepDate: varchar("iepDate", { length: 10 }),   // start date of the IEP
  reviewDate: varchar("reviewDate", { length: 10 }),
  area: varchar("area", { length: 40 }).notNull(),  // reading | writing | math | behavior | social | speech | ot | pt | adaptive | other
  subjectSlug: varchar("subjectSlug", { length: 32 }),
  goalText: text("goalText").notNull(),
  presentLevel: text("presentLevel"),
  measuredBy: varchar("measuredBy", { length: 200 }),
  targetCriterion: varchar("targetCriterion", { length: 200 }),
  startPercent: int("startPercent"),
  targetPercent: int("targetPercent"),
  currentPercent: int("currentPercent"),
  status: varchar("status", { length: 24 }).default("in_progress"),  // in_progress | met | not_met | discontinued
  quarterlyProgress: json("quarterlyProgress").$type<Array<{ quarter: string; percent?: number; narrative: string; date: string }>>(),
  sourceFileKey: varchar("sourceFileKey", { length: 200 }),
  sourceFileName: varchar("sourceFileName", { length: 200 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});
export type IepGoal = typeof iepGoals.$inferSelect;

/**
 * iepAccommodations — Specific accommodations/modifications from the IEP.
 * Separate table so we can display them on Tutor Handoff + Analytics.
 */
export const iepAccommodations = mysqlTable("iepAccommodations", {
  id: int("id").autoincrement().primaryKey(),
  iepDate: varchar("iepDate", { length: 10 }),
  category: varchar("category", { length: 40 }).notNull(), // presentation | response | setting | timing | behavior | assistive_tech
  accommodationText: text("accommodationText").notNull(),
  subjectSlug: varchar("subjectSlug", { length: 32 }),
  frequency: varchar("frequency", { length: 60 }),
  notes: text("notes"),
  active: boolean("active").default(true).notNull(),
  sourceFileKey: varchar("sourceFileKey", { length: 200 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type IepAccommodation = typeof iepAccommodations.$inferSelect;

/**
 * academicSourceRuns — log of every ingestion run (Drive / Gmail / Classroom /
 * PowerSchool / FinalForms / Manus-share). Used for dedupe + status UI.
 */
export const academicSourceRuns = mysqlTable("academicSourceRuns", {
  id: int("id").autoincrement().primaryKey(),
  source: varchar("source", { length: 40 }).notNull(),  // drive | gmail | classroom | powerschool_ih | powerschool_madeira | finalforms_ih | finalforms_madeira | manus_share
  status: varchar("status", { length: 24 }).notNull(),  // running | success | partial | error
  summary: varchar("summary", { length: 400 }),
  itemsFound: int("itemsFound").default(0),
  itemsInserted: int("itemsInserted").default(0),
  errorText: text("errorText"),
  startedAt: timestamp("startedAt").defaultNow().notNull(),
  finishedAt: timestamp("finishedAt"),
});
export type AcademicSourceRun = typeof academicSourceRuns.$inferSelect;


// ============================================================================
// Migration 0015 — Rewards economy, work submissions, tutors, review library,
// assistant rename, and good-work note stream.
// ============================================================================

export const stickers = mysqlTable("stickers", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId"),
  awardedAt: timestamp("awardedAt").defaultNow().notNull(),
  // what triggered it
  reason: mysqlEnum("reason", [
    "block_done",
    "streak_bonus",
    "gold_star_day",
    "submission_approved",
    "placement_complete",
    "adult_bonus",
  ]).notNull(),
  blockId: int("blockId"),
  submissionId: int("submissionId"),
  // visual
  art: varchar("art", { length: 64 }).notNull(), // slug of sticker art
  palette: varchar("palette", { length: 32 }),   // color family
  // reward
  coinsAwarded: int("coinsAwarded").default(1).notNull(),
  // optional good-work lyric/note (see goodWorkNotes below for longer notes)
  shortLyric: varchar("shortLyric", { length: 200 }),
  addedByUserId: int("addedByUserId"), // adult who awarded (or null = auto)
});

export const goodWorkNotes = mysqlTable("goodWorkNotes", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId"), // the kid receiving the note
  authorUserId: int("authorUserId"), // adult who wrote it
  authorName: varchar("authorName", { length: 100 }),
  lyric: text("lyric").notNull(),
  attachedToStickerId: int("attachedToStickerId"),
  attachedToSubmissionId: int("attachedToSubmissionId"),
  attachedToBlockId: int("attachedToBlockId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const coinLedger = mysqlTable("coinLedger", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId"),
  delta: int("delta").notNull(), // +earn / -spend
  kind: mysqlEnum("kind", ["earn_sticker", "earn_bonus", "earn_gold_star", "spend_prize", "adjust"]).notNull(),
  reasonNote: varchar("reasonNote", { length: 200 }),
  stickerId: int("stickerId"),
  prizeRedemptionId: int("prizeRedemptionId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const prizes = mysqlTable("prizes", {
  id: int("id").autoincrement().primaryKey(),
  slug: varchar("slug", { length: 64 }).notNull().unique(),
  title: varchar("title", { length: 120 }).notNull(),
  emoji: varchar("emoji", { length: 8 }).notNull(),
  description: text("description"),
  coinCost: int("coinCost").notNull(),
  category: mysqlEnum("category", ["cash", "digital", "toy", "experience", "screen_time", "treat", "custom"]).notNull(),
  active: boolean("active").default(true).notNull(),
  stock: int("stock"), // null = unlimited
  createdByUserId: int("createdByUserId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const prizeRedemptions = mysqlTable("prizeRedemptions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId"),
  prizeId: int("prizeId").notNull(),
  coinCost: int("coinCost").notNull(),
  status: mysqlEnum("status", ["pending", "approved", "delivered", "denied"]).default("pending").notNull(),
  requestedAt: timestamp("requestedAt").defaultNow().notNull(),
  approvedByUserId: int("approvedByUserId"),
  approvedAt: timestamp("approvedAt"),
  deliveredAt: timestamp("deliveredAt"),
  notes: text("notes"),
});

export const certificates = mysqlTable("certificates", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId"),
  slug: varchar("slug", { length: 64 }).notNull(),
  title: varchar("title", { length: 120 }).notNull(),
  emoji: varchar("emoji", { length: 8 }),
  description: text("description"),
  issuedOn: date("issuedOn").notNull(),
  issuedByUserId: int("issuedByUserId"),
  imageUrl: varchar("imageUrl", { length: 500 }),
  custom: boolean("custom").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const tutors = mysqlTable("tutors", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 120 }).notNull(),
  role: varchar("role", { length: 60 }), // tutor | therapist | parent | teacher
  email: varchar("email", { length: 200 }),
  phone: varchar("phone", { length: 40 }),
  bio: text("bio"),
  subjects: varchar("subjects", { length: 300 }), // comma list
  avatarUrl: varchar("avatarUrl", { length: 500 }),
  active: boolean("active").default(true).notNull(),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const tutorSessions = mysqlTable("tutorSessions", {
  id: int("id").autoincrement().primaryKey(),
  tutorId: int("tutorId").notNull(),
  scheduledAt: timestamp("scheduledAt").notNull(),
  durationMin: int("durationMin").default(60).notNull(),
  location: varchar("location", { length: 200 }),
  focus: text("focus"),
  status: mysqlEnum("status", ["scheduled", "completed", "missed", "trial", "cancelled"]).default("scheduled").notNull(),
  sessionNotes: text("sessionNotes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const reviewResources = mysqlTable("reviewResources", {
  id: int("id").autoincrement().primaryKey(),
  topic: varchar("topic", { length: 120 }).notNull(), // e.g., "multi-digit subtraction"
  subjectSlug: varchar("subjectSlug", { length: 32 }),
  gradeBand: varchar("gradeBand", { length: 16 }), // e.g., "3-5"
  kind: mysqlEnum("kind", ["youtube", "webpage", "app", "printable", "practice", "game"]).notNull(),
  title: varchar("title", { length: 200 }).notNull(),
  url: varchar("url", { length: 500 }),
  youtubeId: varchar("youtubeId", { length: 32 }), // for youtube embeds
  description: text("description"),
  approved: boolean("approved").default(true).notNull(), // adult pre-vetted
  addedByUserId: int("addedByUserId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const appSettings = mysqlTable("appSettings", {
  id: int("id").autoincrement().primaryKey(),
  key: varchar("key", { length: 64 }).notNull().unique(),
  value: text("value"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const placementResults = mysqlTable("placementResults", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId"),
  subjectSlug: varchar("subjectSlug", { length: 32 }).notNull(),
  gradeEquivalent: varchar("gradeEquivalent", { length: 16 }), // e.g., "3.8"
  strengthsNote: text("strengthsNote"),
  gapsNote: text("gapsNote"),
  assessedAt: timestamp("assessedAt").defaultNow().notNull(),
  assessedByUserId: int("assessedByUserId"),
  sourceKind: mysqlEnum("sourceKind", ["self_check", "tutor", "parent", "map", "acadience", "review_library"]).default("self_check").notNull(),
});


/**
 * Adult Whiteboard — sticky notes that parents / tutor can post for Reagan.
 * Shows on the Today page as pastel index cards. Reagan can "heart" them.
 * Authors: any user with role = admin | tutor. Reagan (user) can read but not post.
 */
export const whiteboardNotes = mysqlTable("whiteboardNotes", {
  id: int("id").autoincrement().primaryKey(),
  authorUserId: int("authorUserId").notNull(),
  authorName: varchar("authorName", { length: 80 }).notNull(),   // denormalized for quick render
  authorAvatar: varchar("authorAvatar", { length: 40 }),         // emoji or 1-2 letter initials
  title: varchar("title", { length: 120 }),
  body: text("body").notNull(),
  color: mysqlEnum("color", ["butter", "coral", "mint", "sky", "lavender", "peach", "pink"]).default("butter").notNull(),
  emoji: varchar("emoji", { length: 12 }),                       // small flourish emoji
  pinned: boolean("pinned").default(false).notNull(),
  showOnDate: date("showOnDate"),                                // optional: only appear on this date
  heartCount: int("heartCount").default(0).notNull(),
  reaganHearted: boolean("reaganHearted").default(false).notNull(),
  archived: boolean("archived").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

/**
 * Tag system — a preset vocabulary of tags (good-day, hard-day, mood marker,
 * subject tag, etc). Tags can be attached to anything via entityType + entityId.
 */
export const tags = mysqlTable("tags", {
  id: int("id").autoincrement().primaryKey(),
  slug: varchar("slug", { length: 48 }).notNull().unique(),
  label: varchar("label", { length: 80 }).notNull(),
  emoji: varchar("emoji", { length: 12 }),
  category: mysqlEnum("category", ["mood", "subject", "energy", "body", "social", "family", "custom"]).default("custom").notNull(),
  color: mysqlEnum("color", ["butter", "coral", "mint", "sky", "lavender", "peach", "pink", "rose", "sage"]).default("butter").notNull(),
  isPreset: boolean("isPreset").default(false).notNull(),
  sortOrder: int("sortOrder").default(100).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const tagLinks = mysqlTable("tagLinks", {
  id: int("id").autoincrement().primaryKey(),
  tagId: int("tagId").notNull(),
  entityType: mysqlEnum("entityType", ["note", "mood", "block", "day", "journal", "rescue", "struggle"]).notNull(),
  entityId: int("entityId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});


/* -------------------------------------------------------------------------- */
/*  SKILL LADDER (Catch-Up Engine)                                            */
/*  - skillLadder: ordered Ohio-aligned skills per subject                    */
/*  - skillProgress: Reagan's mastery per skill (0=not yet, 5=mastered)       */
/* -------------------------------------------------------------------------- */
export const skillLadder = mysqlTable("skillLadder", {
  id: int("id").autoincrement().primaryKey(),
  subjectSlug: varchar("subjectSlug", { length: 32 }).notNull(), // math, ela, science, ss
  strand: varchar("strand", { length: 64 }).notNull(),           // e.g. "Operations & Algebraic Thinking"
  skillCode: varchar("skillCode", { length: 32 }).notNull(),     // e.g. OH.5.OA.1, OH.5.RL.2
  title: varchar("title", { length: 240 }).notNull(),
  kidFriendly: text("kidFriendly"),                              // plain-language description Reagan sees
  gradeLevel: varchar("gradeLevel", { length: 8 }).default("5").notNull(), // 3,4,5,6 — for catch-up below 5th
  ladderOrder: int("ladderOrder").notNull(),                     // global ordering across the ladder
  prereqSkillCodes: json("prereqSkillCodes").$type<string[]>(),  // skill codes that must be reached first
  estMinutes: int("estMinutes").default(15).notNull(),
  khanUrl: varchar("khanUrl", { length: 600 }),
  ixlUrl: varchar("ixlUrl", { length: 600 }),
  watchUrl: varchar("watchUrl", { length: 600 }),                // YouTube/Edpuzzle "Watch" path
  storyHook: text("storyHook"),                                  // multi-modal: story-style intro
  visualHook: text("visualHook"),                                // visual/picture-style intro
  handsOnHook: text("handsOnHook"),                              // build-it / hands-on prompt
  ihAligned: boolean("ihAligned").default(true).notNull(),       // matches Indian Hill 5th-grade scope
  ihWeekTag: varchar("ihWeekTag", { length: 32 }),                // e.g. "Q4-W22" — surfaces in SkillBuilder when matching the active IH week
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const skillProgress = mysqlTable("skillProgress", {
  id: int("id").autoincrement().primaryKey(),
  skillLadderId: int("skillLadderId").notNull(),
  // mastery level: 0 not started, 1 introduced, 2 trying, 3 with help, 4 on own, 5 mastered
  level: int("level").default(0).notNull(),
  // confidence 0-100 (from her own self-rating + adaptation engine)
  confidence: int("confidence").default(0).notNull(),
  evidenceCount: int("evidenceCount").default(0).notNull(),      // how many practice rounds counted toward mastery
  lastPracticedAt: timestamp("lastPracticedAt"),
  lastModeUsed: mysqlEnum("lastModeUsed", ["story", "visual", "handsOn", "watch", "practice"]).default("practice").notNull(),
  // parent-private flag — we never show the absolute "grade-level gap" to Reagan
  parentNote: text("parentNote"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

/* -------------------------------------------------------------------------- */
/*  PROUD MOMENTS  (Confidence Engine)                                        */
/*  - what Reagan accomplished, who noticed, how it felt                       */
/* -------------------------------------------------------------------------- */
export const proudMoments = mysqlTable("proudMoments", {
  id: int("id").autoincrement().primaryKey(),
  source: mysqlEnum("source", ["reagan", "kiwi", "parent", "tutor", "auto"]).default("kiwi").notNull(),
  category: mysqlEnum("category", ["effort", "kindness", "skill", "bravery", "creativity", "persistence", "growth", "wonder"]).default("effort").notNull(),
  title: varchar("title", { length: 200 }).notNull(),
  body: text("body"),                                            // optional longer story
  emoji: varchar("emoji", { length: 12 }).default("⭐").notNull(),
  skillLadderId: int("skillLadderId"),                           // optional link to a skill she leveled up on
  blockId: int("blockId"),                                       // optional link to the block where it happened
  reaganHearted: boolean("reaganHearted").default(false).notNull(), // she tapped a heart on it
  archived: boolean("archived").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});


/* ========================================================================== */
/*  DIAGNOSTIC PLACEMENT (Phase 3)                                            */
/*  Low-pressure 3-5 tasks per skill so Reagan's true starting ladder level   */
/*  is grounded in real evidence — not the IEP guess. She sees only           */
/*  encouragement; correctness data lives only on the parent dashboard.      */
/* ========================================================================== */
export const placementTasks = mysqlTable("placementTasks", {
  id: int("id").autoincrement().primaryKey(),
  skillLadderId: int("skillLadderId").notNull(),                       // which ladder skill this assesses
  taskOrder: int("taskOrder").notNull().default(0),                    // 0..N within the skill
  gradeLevel: varchar("gradeLevel", { length: 8 }).notNull().default("5"), // "4" = below-grade probe, "5" = on-grade, "6" = stretch
  taskType: mysqlEnum("taskType", ["pickOne", "trueFalse", "shortAnswer", "showMeHow"]).notNull().default("pickOne"),
  kidPrompt: text("kidPrompt").notNull(),                              // Reagan-friendly question text
  choices: json("choices"),                                            // for pickOne: ["a","b","c","d"]
  correctAnswer: text("correctAnswer"),                                // canonical answer (string for pickOne/text, null for showMeHow)
  hint: text("hint"),                                                  // optional gentle hint Kiwi can give
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const placementResponses = mysqlTable("placementResponses", {
  id: int("id").autoincrement().primaryKey(),
  placementTaskId: int("placementTaskId").notNull(),
  skillLadderId: int("skillLadderId").notNull(),                       // denormalized for quick rollups
  kidAnswer: text("kidAnswer"),                                        // what she chose / typed (null for showMeHow)
  isCorrect: boolean("isCorrect"),                                     // null for showMeHow / hand-graded
  feltIt: mysqlEnum("feltIt", ["easy", "ok", "hard", "skip"]).notNull().default("ok"),
  completedAt: timestamp("completedAt").defaultNow().notNull(),
});


/* ==========================================================================
 * GAME-AS-REWARD + MOOD BREAK (Phase 5)
 * Reagan's safe, parent-approved game catalog + frustration-aware break offers
 * ========================================================================== */

export const gamePrefs = mysqlTable("gamePrefs", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 120 }).notNull(),                  // e.g. "Roblox", "Adopt Me!", "Minecraft"
  kind: mysqlEnum("kind", ["web", "app", "console", "offline"]).default("app").notNull(),
  url: varchar("url", { length: 600 }),                                // optional launch URL (web games)
  emoji: varchar("emoji", { length: 8 }).default("🎮").notNull(),
  preferredMinutes: int("preferredMinutes").default(10).notNull(),     // how long a typical break is
  needsParentOk: boolean("needsParentOk").default(false).notNull(),    // requires parent unlock
  notes: text("notes"),                                                // anything Reagan should know (e.g. "stop at 4:30 for tutor")
  active: boolean("active").default(true).notNull(),
  rank: int("rank").default(100).notNull(),                            // ordering, lower = more favorite
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const moodSignals = mysqlTable("moodSignals", {
  id: int("id").autoincrement().primaryKey(),
  source: mysqlEnum("source", ["skillPractice", "placement", "manual"]).default("skillPractice").notNull(),
  subjectSlug: varchar("subjectSlug", { length: 32 }),
  skillLadderId: int("skillLadderId"),                                 // null if not skill-linked
  selfRating: int("selfRating"),                                       // 1=Hard … 5=Got it!
  feltIt: mysqlEnum("feltIt", ["easy", "ok", "hard", "skip"]),         // mirrors placement vocabulary
  note: text("note"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const gameBreakLog = mysqlTable("gameBreakLog", {
  id: int("id").autoincrement().primaryKey(),
  gamePrefId: int("gamePrefId"),                                       // null if she picked "something else"
  reason: mysqlEnum("reason", ["earnedReward", "frustrationBreak", "kidPicked"]).default("kidPicked").notNull(),
  durationMinutes: int("durationMinutes").default(10).notNull(),
  startedAt: timestamp("startedAt").defaultNow().notNull(),
  endedAt: timestamp("endedAt"),
});


/* ==========================================================================
 * POST-BLOCK FEEDBACK (Phase 6)
 * Chips Reagan taps after a Skill Builder block — feeds adaptation engine.
 * ========================================================================== */

export const skillFeedback = mysqlTable("skillFeedback", {
  id: int("id").autoincrement().primaryKey(),
  skillLadderId: int("skillLadderId"),                // null for free-form / non-skill blocks
  subjectSlug: varchar("subjectSlug", { length: 32 }),
  // How it felt overall
  feltIt: mysqlEnum("feltIt", ["easy", "ok", "hard", "skip"]),
  // Which mode helped most (mirrors recordSkillPractice modes)
  whatHelped: mysqlEnum("whatHelped", ["story", "visual", "handsOn", "watch", "practice", "kiwiTalk", "tutor", "movement", "none"]),
  // Time pacing self-report
  timeFelt: mysqlEnum("timeFelt", ["tooShort", "justRight", "tooLong"]),
  // Did she want a break?
  wantedBreak: boolean("wantedBreak").default(false).notNull(),
  // Free-form note Reagan can dictate to Kiwi (optional)
  note: text("note"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});


/* ==========================================================================
 * ADAPTATION ENGINE V2 (Phase 7)
 * Per-skill smart hints + private parent flags.
 * ========================================================================== */

export const adaptiveHints = mysqlTable("adaptiveHints", {
  id: int("id").autoincrement().primaryKey(),
  skillLadderId: int("skillLadderId").notNull(),
  // Suggested next mode for the kid-facing UI
  suggestedMode: mysqlEnum("suggestedMode", ["story", "visual", "handsOn", "watch", "practice", "kiwiTalk", "tutor", "movement"]).default("practice").notNull(),
  // If true, never auto-bump level after this round — just rebuild confidence
  softerNext: boolean("softerNext").default(false).notNull(),
  // Counts driving the recommendation (last 5 feedback rows)
  hardCount: int("hardCount").default(0).notNull(),
  okCount: int("okCount").default(0).notNull(),
  easyCount: int("easyCount").default(0).notNull(),
  /** Reason text for parents / debugging */
  reason: text("reason"),
  updatedAt: timestamp("updatedAt").defaultNow().notNull().onUpdateNow(),
});

export const parentFlags = mysqlTable("parentFlags", {
  id: int("id").autoincrement().primaryKey(),
  skillLadderId: int("skillLadderId"),
  subjectSlug: varchar("subjectSlug", { length: 32 }),
  severity: mysqlEnum("severity", ["info", "watch", "alert"]).default("watch").notNull(),
  title: varchar("title", { length: 200 }).notNull(),
  body: text("body"),
  acknowledged: boolean("acknowledged").default(false).notNull(),
  acknowledgedAt: timestamp("acknowledgedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});


/* ==========================================================================
 * TUTOR SESSION ↔ SKILL LINKS (Phase 8)
 * Link a tutor session to specific skill ladder rows + outcomes.
 * Tutor outcomes feed the adaptation engine.
 * ========================================================================== */
export const tutorSessionSkills = mysqlTable("tutorSessionSkills", {
  id: int("id").autoincrement().primaryKey(),
  sessionId: int("sessionId").notNull(),
  skillLadderId: int("skillLadderId").notNull(),
  outcome: mysqlEnum("outcome", ["strong", "gettingIt", "needsMore", "notWorked"]).default("gettingIt").notNull(),
  tutorNote: text("tutorNote"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});


/* ============================== UPLOAD OR SYNC ============================
 * Tracks parent-triggered "Sync now" requests + the actual scheduled runs
 * so the parent home can show "What ran today / this week".
 * ========================================================================== */

export const syncRequests = mysqlTable("sync_requests", {
  id: int("id").primaryKey().autoincrement(),
  source: varchar("source", { length: 16 }).notNull(), // 'gmail' | 'drive' | 'both'
  lookbackDays: int("lookback_days").notNull().default(2),
  requestedAt: timestamp("requested_at").defaultNow().notNull(),
  consumedAt: timestamp("consumed_at"), // when the next scheduled run picked it up
});

export const syncRuns = mysqlTable("sync_runs", {
  id: int("id").primaryKey().autoincrement(),
  source: varchar("source", { length: 16 }).notNull(),
  startedAt: timestamp("started_at").defaultNow().notNull(),
  finishedAt: timestamp("finished_at"),
  itemsScanned: int("items_scanned").notNull().default(0),
  itemsRouted: int("items_routed").notNull().default(0),
  itemsSkipped: int("items_skipped").notNull().default(0),
  errors: text("errors"), // newline-separated short reasons
  triggeredBy: varchar("triggered_by", { length: 16 }).notNull().default("schedule"), // 'schedule' | 'parent' | 'manual'
});

export const syncRunItems = mysqlTable("sync_run_items", {
  id: int("id").primaryKey().autoincrement(),
  runId: int("run_id").notNull(),
  source: varchar("source", { length: 16 }).notNull(),
  externalId: varchar("external_id", { length: 255 }).notNull(), // e.g. gmail message id
  routedTo: varchar("routed_to", { length: 32 }).notNull(),
  recordId: int("record_id").notNull(),
  title: varchar("title", { length: 255 }),
  message: varchar("message", { length: 500 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  dismissed: boolean("dismissed").default(false).notNull(),
  flagged: boolean("flagged").default(false).notNull(),
  parentNote: varchar("parent_note", { length: 500 }),
});

export type SyncRequest = typeof syncRequests.$inferSelect;
export type SyncRun = typeof syncRuns.$inferSelect;
export type SyncRunItem = typeof syncRunItems.$inferSelect;


// ──────────────────────────────────────────────────────────────────────────
// Weekly Digest — auto-emailed Sunday 7 PM to spear.cpt@gmail.com
// Stores history so we can show the parent the past 12 weeks at a glance.
// All numbers in `payload` are computed from REAL parent/Reagan/tutor entries
// only — never from seeded or demo data.
// ──────────────────────────────────────────────────────────────────────────
export const weeklyDigests = mysqlTable("weekly_digests", {
  id: int("id").autoincrement().primaryKey(),
  weekStart: timestamp("week_start").notNull(),
  weekEnd: timestamp("week_end").notNull(),
  payload: json("payload").notNull(),  // structured: {levelUps, tutorSessions, flags, moodArc, whatHelped, ihAlignment, subjectConfidenceDelta}
  emailedAt: timestamp("emailed_at"),  // when sent to spear.cpt@gmail.com
  emailStatus: mysqlEnum("email_status", ["pending", "sent", "failed"]).default("pending"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type WeeklyDigest = typeof weeklyDigests.$inferSelect;

/* -------------------------------------------------------------------------- */
/*  DRIVE PUSH QUEUE — auto-mirrors uploads into the Reagan/IHES Drive folder */
/* -------------------------------------------------------------------------- */
export const drivePushQueue = mysqlTable("drive_push_queue", {
  id: int("id").autoincrement().primaryKey(),
  fileKey: varchar("file_key", { length: 500 }).notNull(),
  fileUrl: varchar("file_url", { length: 500 }).notNull(),
  fileName: varchar("file_name", { length: 300 }).notNull(),
  mimeType: varchar("mime_type", { length: 100 }),
  // Which Drive folder the scheduled task should mirror this file into.
  // The agent prompt knows the folder mapping (root of "Reagan" Drive folder + subfolders).
  targetFolder: mysqlEnum("target_folder", ["reagan", "reagan_ihes", "reagan_tutor", "reagan_artwork", "reagan_assignments"]).default("reagan").notNull(),
  status: mysqlEnum("status", ["pending", "pushed", "skipped", "failed"]).default("pending").notNull(),
  driveFileId: varchar("drive_file_id", { length: 200 }),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  pushedAt: timestamp("pushed_at"),
});
export type DrivePushQueueRow = typeof drivePushQueue.$inferSelect;


/* ============================================================================
   ASSESSMENT SCREENINGS — historical Acadience/MAZE/MAP/decoding data
   from 2024-25 IEP & Reevaluation. One row per screening event.
   Source: Reagan handoff bundle 04_assessment_history.json (Apr 2026).
   ============================================================================ */
export const assessmentScreenings = mysqlTable("assessmentScreenings", {
  id: int("id").autoincrement().primaryKey(),
  testFamily: varchar("testFamily", { length: 40 }).notNull(), // acadience_orf | maze | nwea_map_math | decoding | writing | basc3
  metric: varchar("metric", { length: 60 }).notNull(),         // wcpm | percentile | accuracy_pct | rit | raw | scale_score
  windowLabel: varchar("windowLabel", { length: 40 }),         // Fall 2024 / Winter 2024 / Spring 2025 / 1/28/2025
  value: varchar("value", { length: 60 }).notNull(),           // can be a single value or "82-110"
  targetValue: varchar("targetValue", { length: 60 }),         // expected/typical range or floor
  notes: text("notes"),
  sourceDoc: varchar("sourceDoc", { length: 100 }),            // "RHiggs 2025-26 IEP" / "2025 Reevaluation"
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type AssessmentScreening = typeof assessmentScreenings.$inferSelect;


/* ============================================================================
   ASSIGNMENT BACKLOG — Mom-curated assignment library that the daily-plan
   composer can pull from when building Reagan's day. Source: handoff bundle
   06_assignment_backlog.csv (Apr 2026).
   ============================================================================ */
export const assignmentBacklog = mysqlTable("assignmentBacklog", {
  id: int("id").autoincrement().primaryKey(),
  code: varchar("code", { length: 20 }).notNull().unique(), // e.g. "RW-001", "M-005"
  title: varchar("title", { length: 200 }).notNull(),
  subjectSlug: varchar("subjectSlug", { length: 32 }).notNull(),
  blockType: varchar("blockType", { length: 40 }),    // matches scheduleBlocks.blockType where possible
  estMinutes: int("estMinutes").default(25).notNull(),
  weekTheme: varchar("weekTheme", { length: 80 }),    // e.g. "Wonder Wednesday"
  dayHint: varchar("dayHint", { length: 16 }),        // monday | tuesday | wednesday | thursday | friday | any
  notes: text("notes"),
  iepGoal: boolean("iepGoal").default(false).notNull(),
  active: boolean("active").default(true).notNull(),
  sourceDoc: varchar("sourceDoc", { length: 100 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type AssignmentBacklogRow = typeof assignmentBacklog.$inferSelect;


// -------- PowerSchool (Indian Hill) imports --------
// A single "import event" (paste or upload or scraped snapshot).
// We keep the raw HTML/CSV/text body so we can re-parse later if the parser improves.
export const powerschoolImports = mysqlTable("powerschool_imports", {
  id: int("id").autoincrement().primaryKey(),
  source: varchar("source", { length: 32 }).notNull().default("paste"), // paste | csv | scraper | email
  rawBody: text("raw_body").notNull(),
  rawMime: varchar("raw_mime", { length: 128 }).default("text/plain"),
  parsedCount: int("parsed_count").notNull().default(0),
  errorCount: int("error_count").notNull().default(0),
  notes: text("notes"),
  importedBy: varchar("imported_by", { length: 256 }),
  importedAt: timestamp("imported_at").defaultNow().notNull(),
});

// One row per (class, term) grade snapshot from PowerSchool.
export const powerschoolGrades = mysqlTable("powerschool_grades", {
  id: int("id").autoincrement().primaryKey(),
  importId: int("import_id"),
  term: varchar("term", { length: 32 }).notNull(), // "Q1", "Q2", "Q3", "Q4", "S1", "Y1"
  course: varchar("course", { length: 256 }).notNull(),
  teacher: varchar("teacher", { length: 256 }),
  letter: varchar("letter", { length: 8 }),
  percent: varchar("percent", { length: 16 }),
  comments: text("comments"),
  snapshotDate: varchar("snapshot_date", { length: 32 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// One row per assignment from PowerSchool.
export const powerschoolAssignments = mysqlTable("powerschool_assignments", {
  id: int("id").autoincrement().primaryKey(),
  importId: int("import_id"),
  course: varchar("course", { length: 256 }).notNull(),
  category: varchar("category", { length: 128 }),
  title: varchar("title", { length: 512 }).notNull(),
  dueDate: varchar("due_date", { length: 32 }),
  assignedDate: varchar("assigned_date", { length: 32 }),
  score: varchar("score", { length: 64 }),
  pointsPossible: varchar("points_possible", { length: 64 }),
  status: varchar("status", { length: 32 }), // late | missing | collected | scored | exempt
  teacherComment: text("teacher_comment"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─────────────────────────────────────────────────────────────────────
// Curriculum Topics — 5th grade Ohio / Indian Hill scope+sequence.
// Hierarchical: parent=null is a top-level Topic (Math Topic 3),
// parent set on a child row makes it a lesson/sub-topic.
// `code` is the short IH-textbook-style chip (e.g. "Math 7-4").
// `standardRef` is the full Ohio Learning Standard code (e.g. "5.NBT.A.1").
// `ord` drives the display order within a subject so tree mirrors the
// school's actual pacing.
// ─────────────────────────────────────────────────────────────────────
export const curriculumTopics = mysqlTable("curriculumTopics", {
  id: int("id").autoincrement().primaryKey(),
  subject: varchar("subject", { length: 64 }).notNull(),     // "Math" | "ELA" | "Science" | "Social" | "Specials"
  code: varchar("code", { length: 48 }).notNull(),           // e.g. "Math 7-4", "ELA M2-L5"
  title: varchar("title", { length: 512 }).notNull(),
  standardRef: varchar("standard_ref", { length: 128 }),     // Ohio code, nullable for Specials
  parentId: int("parent_id"),                                // null = top-level topic
  ord: int("ord").notNull().default(0),                      // display order within subject
  status: varchar("status", { length: 16 }).notNull().default("notStarted"), // notStarted | inProgress | done
  completedAt: timestamp("completed_at"),
  quarter: varchar("quarter", { length: 8 }),                // "Q1" | "Q2" | "Q3" | "Q4" — for IH pacing
  notes: text("notes"),
  // Apr 30 — surface go-deeper practice links per topic
  khanUrl: varchar("khan_url", { length: 600 }),
  ixlUrl: varchar("ixl_url", { length: 600 }),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/* -------------------------------------------------------------------------- */
/*  CURRICULUM RESOURCES — worksheet / video / lesson / reading / printable    */
/*  attached to a single curriculum topic. Adults can browse these in the      */
/*  topic drawer on the Adult Curriculum page.                                  */
/* -------------------------------------------------------------------------- */
export const curriculumResources = mysqlTable("curriculumResources", {
  id: int("id").autoincrement().primaryKey(),
  topicId: int("topic_id").notNull(),
  kind: varchar("kind", { length: 32 }).notNull(), // worksheet | video | lesson | reading | printable | link
  title: varchar("title", { length: 400 }).notNull(),
  url: varchar("url", { length: 1024 }),           // null for in-app printables / file uploads
  source: varchar("source", { length: 64 }),       // "khan" | "ixl" | "readworks" | "k5" | "upload" | ...
  notes: text("notes"),
  addedByUserId: int("added_by_user_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type CurriculumResource = typeof curriculumResources.$inferSelect;
export type InsertCurriculumResource = typeof curriculumResources.$inferInsert;

/* -------------------------------------------------------------------------- */
/*  GOOGLE CLASSROOM (REFERENCE-ONLY)                                         */
/*                                                                            */
/*  Synced from spear.cpt@gmail.com's Google Classroom (where Reagan is       */
/*  enrolled). NOT used to drive Reagan's daily plan — adults view this       */
/*  in a collapsed reference panel only.                                       */
/* -------------------------------------------------------------------------- */
export const classroomAssignments = mysqlTable("classroomAssignments", {
  id: int("id").autoincrement().primaryKey(),
  // Stable id from Google (`courseId/courseWorkId` joined) so re-syncs idempotent.
  externalId: varchar("externalId", { length: 128 }).notNull().unique(),
  courseId: varchar("courseId", { length: 64 }).notNull(),
  courseName: varchar("courseName", { length: 256 }),
  title: varchar("title", { length: 512 }).notNull(),
  description: text("description"),
  workType: varchar("workType", { length: 32 }), // ASSIGNMENT | SHORT_ANSWER_QUESTION | MULTIPLE_CHOICE_QUESTION | …
  state: varchar("state", { length: 32 }),       // PUBLISHED | DRAFT | DELETED
  link: text("link"),                             // alternateLink to the Classroom item
  dueAt: timestamp("dueAt"),                      // null if no due date
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  syncedAt: timestamp("syncedAt").defaultNow().notNull(),
});
export type ClassroomAssignment = typeof classroomAssignments.$inferSelect;
export type InsertClassroomAssignment = typeof classroomAssignments.$inferInsert;


/**
 * Daily Printables — auto-built each morning for Reagan's school day.
 * Three buckets per day: have_to_do, optional, extra.
 * Each row holds a printable that's been picked from a ranked free source
 * (Khan Academy, K5 Learning, Education.com free, ReadWorks, IXL skill page,
 *  Math-Drills, NASA Edu, Smithsonian, etc.) or generated by Kiwi as fallback.
 */
export const dailyPrintables = mysqlTable("daily_printables", {
  id: int("id").autoincrement().primaryKey(),
  /** ISO date YYYY-MM-DD for the school day this belongs to */
  forDate: varchar("for_date", { length: 10 }).notNull(),
  bucket: varchar("bucket", { length: 16 }).notNull(), // have_to_do | optional | extra
  title: varchar("title", { length: 256 }).notNull(),
  description: text("description"),
  subjectSlug: varchar("subject_slug", { length: 64 }),
  skillLadderId: int("skill_ladder_id"),
  source: varchar("source", { length: 64 }).notNull(), // khan, k5, education.com, ixl, kiwi-built, ...
  sourceUrl: text("source_url"),
  /** Storage key for the PDF (uploaded by scheduled task or generated locally) */
  pdfKey: varchar("pdf_key", { length: 256 }),
  /** Storage key for the cover image / thumbnail */
  thumbKey: varchar("thumb_key", { length: 256 }),
  /** Estimated minutes to complete */
  estMinutes: int("est_minutes"),
  /** Kiwi Coins awarded on completion */
  coinReward: int("coin_reward").notNull().default(5),
  status: varchar("status", { length: 16 }).notNull().default("pending"), // pending | done | skipped
  completedAt: timestamp("completed_at"),
  /** Storage key for Reagan's photo of the finished page */
  photoKey: varchar("photo_key", { length: 256 }),
  /** Quick auto-grade summary (e.g. "looks complete · neat handwriting · 8/10") */
  autoGrade: text("auto_grade"),
  /** Drive file id once filed */
  driveFileId: varchar("drive_file_id", { length: 128 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
});
export type DailyPrintable = typeof dailyPrintables.$inferSelect;
export type NewDailyPrintable = typeof dailyPrintables.$inferInsert;


/**
 * Adult Assignments Library (Apr 30 batch)
 *
 * One row per assignment-thing Reagan does or could do, regardless of where it
 * came from (IH printout, IXL, Khan, Email, Drive, Manual, etc). Bundles tie
 * lesson plan ↔ slides ↔ worksheet ↔ answer key together so the daily Open
 * button on a schedule block can run them in the correct order:
 *   step 1 = lesson plan / video
 *   step 2 = slides / instructions / vocabulary
 *   step 3 = worksheet / quiz / activity (the doing part)
 *   step 4 = answer key / exit ticket (adult-only)
 */
export const assignmentsLibrary = mysqlTable("assignments_library", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 300 }).notNull(),
  subjectSlug: varchar("subject_slug", { length: 32 }),                    // math | ela | reading | writing | science | ss | art | music | other
  type: varchar("type", { length: 32 }).notNull(),                          // worksheet | video | slideshow | lesson_plan | quiz | answer_key | project | app_activity | reading | other
  topic: varchar("topic", { length: 200 }),
  tags: json("tags").$type<string[]>(),
  fromSource: varchar("from_source", { length: 80 }).notNull().default("manual"), // "IH (printout)" | "IXL" | "Khan Academy" | "ReadWorks" | "Schoology" | "Education.com" | "NASA" | "Google Drive" | "Email" | "Manual" | etc.
  ihClassroom: boolean("ih_classroom").default(false).notNull(),            // sortable Yes/No: was this assigned by Indian Hill?
  dateReceived: varchar("date_received", { length: 10 }),                   // YYYY-MM-DD when it came in
  dateFor: varchar("date_for", { length: 10 }),                             // YYYY-MM-DD when it should be done
  status: varchar("status", { length: 16 }).notNull().default("pending"),   // pending | in_progress | completed | absent | skipped
  recommendedUse: int("recommended_use").default(3).notNull(),              // 1 (skip) … 5 (highly recommended)
  sourceUrl: varchar("source_url", { length: 1000 }),                       // the page/app/source
  fileLink: varchar("file_link", { length: 1000 }),                         // direct file URL (Drive editable copy / attachment)
  bundleId: int("bundle_id"),                                               // FK to assignmentBundles
  bundleStep: int("bundle_step"),                                           // 1=lesson, 2=slides, 3=worksheet, 4=answer_key
  linkedItemIds: json("linked_item_ids").$type<number[]>(),                 // related rows (legacy free-form linking)
  notes: text("notes"),
  reaganClicked: boolean("reagan_clicked").default(false).notNull(),        // used? (auto)
  completedAt: timestamp("completed_at"),
  blockId: int("block_id"),                                                 // optional: pinned to a specific schedule block
  autoGradeScore: int("auto_grade_score"),                                  // 0-100 if auto-graded
  autoGradeFeedback: text("auto_grade_feedback"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

/**
 * Assignment bundle: groups items that should run together in step order.
 */
export const assignmentBundles = mysqlTable("assignment_bundles", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 300 }).notNull(),
  subjectSlug: varchar("subject_slug", { length: 32 }),
  topic: varchar("topic", { length: 200 }),
  dateFor: varchar("date_for", { length: 10 }),                             // intended day, optional
  reminderOnly: boolean("reminder_only").default(false).notNull(),          // skip lesson; jump straight to worksheet
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});


/* -------------------------------------------------------------------------- */
/*  APP ACCOUNTS — track Reagan's signups across learning apps               */
/*  Encrypted password locker for adult-area only.                            */
/* -------------------------------------------------------------------------- */
export const appAccounts = mysqlTable("app_accounts", {
  id: int("id").autoincrement().primaryKey(),
  appKey: varchar("app_key", { length: 64 }).notNull().unique(),     // e.g. ixl, khan, brainpop
  appName: varchar("app_name", { length: 120 }).notNull(),
  appUrl: varchar("app_url", { length: 500 }).notNull(),
  signupUrl: varchar("signup_url", { length: 500 }),
  emoji: varchar("emoji", { length: 8 }).default("🌐").notNull(),
  category: varchar("category", { length: 32 }).default("learning").notNull(),
  status: mysqlEnum("status", [
    "not_started",
    "pending_email_verify",
    "pending_family_link",
    "active",
    "needs_reset",
    "closed",
  ]).default("not_started").notNull(),
  signInEmail: varchar("sign_in_email", { length: 320 }),             // typically reaganhiggs910@gmail.com
  signInUsername: varchar("sign_in_username", { length: 200 }),       // some apps use a custom username
  passwordEncrypted: text("password_encrypted"),                      // AES-encrypted password (server-only)
  passwordIv: varchar("password_iv", { length: 64 }),                 // IV for AES encryption
  notes: text("notes"),
  preferredGoogleAccount: mysqlEnum("preferred_google_account", ["reagan", "dad", "none"]).default("none").notNull(),
  hasFamilyTier: boolean("has_family_tier").default(false).notNull(),
  isPaid: boolean("is_paid").default(false).notNull(),
  monthlyCost: int("monthly_cost"),                                   // cents
  sortOrder: int("sort_order").default(0).notNull(),
  lastVerifiedAt: timestamp("last_verified_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});


/* ============================================================
 * Nightly agenda PDF email pipeline (Phase 3)
 * ----------------------------------------------------------------
 * One row per school day. The 8 PM cron writes the row, builds a
 * PDF (schedule + estimated minutes + attached worksheet/lesson
 * PDFs), uploads to S3, then emails Marcy + spear.cpt + saves a
 * copy in Mom's Drive Homeschool Hub. If anything about that day's
 * plan changes between 8 PM and the school start time the next
 * morning, the row's `lastChangeAt` advances and a resend job
 * picks it up and resends with subject "[UPDATED]".
 * ============================================================ */
export const dailyAgendas = mysqlTable("dailyAgendas", {
  id: int("id").autoincrement().primaryKey(),
  date: varchar("date", { length: 10 }).notNull().unique(), // YYYY-MM-DD
  generatedAt: timestamp("generatedAt").defaultNow().notNull(),
  lastEmailedAt: timestamp("lastEmailedAt"),
  lastChangeAt: timestamp("lastChangeAt").defaultNow().notNull(),
  pdfStorageKey: varchar("pdfStorageKey", { length: 512 }),
  pdfUrl: varchar("pdfUrl", { length: 512 }),
  driveFileId: varchar("driveFileId", { length: 128 }),
  version: int("version").default(1).notNull(),
  notes: text("notes"),
});
export type DailyAgenda = typeof dailyAgendas.$inferSelect;

/* ============================================================
 * Kiwi quiet-listening pipeline (Phase 8)
 * ----------------------------------------------------------------
 * One row per ~5-minute audio buffer the client sends to the
 * server during the school-day window. The server-side summarizer
 * extracts {topics, completions, emotion, comfort, difficulty,
 * talkativeness} so Mom's detailed analytics stay rich without
 * exposing raw transcripts in the UI. Reagan's UI never reads
 * this table — only Mom's daily Drive export does.
 * ============================================================ */
export const listeningSummaries = mysqlTable("listeningSummaries", {
  id: int("id").autoincrement().primaryKey(),
  date: varchar("date", { length: 10 }).notNull(), // YYYY-MM-DD
  periodStart: timestamp("periodStart").notNull(),
  periodEnd: timestamp("periodEnd").notNull(),
  subjectGuess: varchar("subjectGuess", { length: 32 }),
  topicsJson: json("topicsJson"),
  completionsJson: json("completionsJson"),
  emotionScore: int("emotionScore"),         // -100..100
  comfortScore: int("comfortScore"),          // 0..100
  difficultyScore: int("difficultyScore"),    // 0..100
  talkativenessScore: int("talkativenessScore"), // 0..100
  rawSummary: text("rawSummary"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type ListeningSummary = typeof listeningSummaries.$inferSelect;

/* ============================================================
 * Reagan's "Make a request" button (Phase 5)
 * ----------------------------------------------------------------
 * One row per request she sends to the adults (assignment idea,
 * adventure idea, schedule change, snack request, etc.). The
 * server emails Mom + Dad and posts a notifyOwner alert. Adults
 * resolve from the Adult Inbox.
 * ============================================================ */
export const studentRequests = mysqlTable("studentRequests", {
  id: int("id").autoincrement().primaryKey(),
  fromUserId: int("fromUserId"),
  kind: mysqlEnum("kind", ["assignment", "adventure", "schedule", "snack", "supplies", "help", "other"]).notNull().default("other"),
  body: text("body").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  resolvedAt: timestamp("resolvedAt"),
  resolvedNote: text("resolvedNote"),
  resolvedByUserId: int("resolvedByUserId"),
});
export type StudentRequest = typeof studentRequests.$inferSelect;


/* ============================================================
 * adultAiMessages — chat history for the Mom + tutor "AI" search-bar assistant.
 *
 * Kept separate from `kiwiMessages` (Reagan's bird companion) so adult content
 * never leaks into Reagan's history pull and so we can purge it independently
 * for privacy. Logged with the actor's openId so multi-tutor environments can
 * show who said what later.
 * ============================================================ */
export const adultAiMessages = mysqlTable("adultAiMessages", {
  id: int("id").autoincrement().primaryKey(),
  role: mysqlEnum("role", ["user", "assistant", "system"]).notNull(),
  content: text("content").notNull(),
  actorOpenId: varchar("actorOpenId", { length: 100 }),
  actorName: varchar("actorName", { length: 100 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type AdultAiMessage = typeof adultAiMessages.$inferSelect;


/* ============================== TUTOR DAY NOTES ===========================
 * Free-form per-day notes a tutor jots on their assigned day, stamped with
 * tutor name + date. Read by the AI agenda generator when planning future
 * days so prior context flows forward (e.g. "softened long-division on Wed
 * because she was overwhelmed").
 * ========================================================================== */
export const tutorDayNotes = mysqlTable("tutorDayNotes", {
  id: int("id").autoincrement().primaryKey(),
  dateStr: varchar("dateStr", { length: 10 }).notNull(), // YYYY-MM-DD
  tutorName: varchar("tutorName", { length: 80 }).notNull(),
  authorOpenId: varchar("authorOpenId", { length: 64 }),
  topicsCovered: text("topicsCovered"), // free-form list
  comfort: mysqlEnum("comfort", ["calm", "okay", "stretched", "overwhelmed"]),
  notes: text("notes").notNull(), // the actual write-up
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

/* ============================== NIGHTLY AGENDA EMAILS ===========================
 * Track every nightly 8 PM agenda email sent to Mom/Dad. We snapshot a hash of
 * the agenda body so the cron can resend ONLY if the agenda changed between
 * 8 PM and school start the next morning. The Drive push is also recorded so
 * we know whether the Homeschool Hub has the latest copy.
 * ============================================================================== */
export const nightlyAgendaEmails = mysqlTable("nightlyAgendaEmails", {
  id: int("id").autoincrement().primaryKey(),
  forDate: varchar("forDate", { length: 10 }).notNull(), // YYYY-MM-DD (the day the agenda is FOR)
  sentAt: timestamp("sentAt").defaultNow().notNull(),
  recipients: text("recipients").notNull(), // comma-separated emails
  agendaHash: varchar("agendaHash", { length: 64 }).notNull(), // sha256 of canonical body
  blockCount: int("blockCount").notNull(),
  pdfStorageKey: varchar("pdfStorageKey", { length: 200 }), // /manus-storage/... key
  drivePushed: boolean("drivePushed").default(false).notNull(),
  driveFolderPath: varchar("driveFolderPath", { length: 200 }),
  status: mysqlEnum("status", ["queued", "sent", "failed", "resent"]).default("queued").notNull(),
  errorMessage: text("errorMessage"),
  triggerKind: mysqlEnum("triggerKind", ["nightly", "change_resend", "manual"]).default("nightly").notNull(),
});
export type NightlyAgendaEmail = typeof nightlyAgendaEmails.$inferSelect;

