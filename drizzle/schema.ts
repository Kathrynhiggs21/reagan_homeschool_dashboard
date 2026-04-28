import {
  boolean,
  date,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
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
  type: mysqlEnum("type", ["workbook", "novel", "reference", "audiobook"]).default("workbook").notNull(),
  subjectSlug: varchar("subjectSlug", { length: 32 }),
  currentPage: int("currentPage").default(1).notNull(),
  totalPages: int("totalPages"),
  notes: text("notes"),
});

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
