/**
 * server/agendaAnswer.test.ts
 *
 * Locks the 2026-06-29 "answer any question" upgrade to the AI agenda chat:
 *  - isLikelyQuestion() correctly separates questions / idea-requests from
 *    schedule edits (the routing hint that sends non-edits to answer mode).
 *  - gatherAnswerContext() assembles a usable context blob and NEVER throws,
 *    even when every db helper is missing or returns empty.
 */
import { describe, it, expect } from "vitest";
import { isLikelyQuestion, gatherAnswerContext } from "./_lib/agendaAnswer";
import type { AgendaPlanContext } from "./_lib/agendaEditor";

function baseCtx(overrides: Partial<AgendaPlanContext> = {}): AgendaPlanContext {
  return {
    planId: 1,
    date: "2026-06-29",
    dayLabel: "Monday, June 29",
    studentName: "Reagan",
    gradeLevel: "5th grade",
    tutorOfDayLabel: null,
    blocks: [],
    subjects: [{ slug: "math", name: "Math" }],
    topicCatalog: [],
    ...overrides,
  };
}

describe("isLikelyQuestion — routes questions to answer mode", () => {
  it("treats clear questions as answerable", () => {
    for (const q of [
      "How is Reagan doing in fractions?",
      "what did she work on this week?",
      "Is she keeping up with writing?",
      "How's she doing?",
      "what's a good calm afternoon look like",
      "tell me about her recent mood",
      "any ideas for a science adventure?",
      "suggest a calm bird-themed afternoon",
      "explain long division to me like she'd hear it",
      "tell me a joke about parakeets",
    ]) {
      expect(isLikelyQuestion(q)).toBe(true);
    }
  });

  it("does NOT treat schedule edits as questions", () => {
    for (const e of [
      "add a 30 min math block at 9am",
      "make it shorter and fun",
      "drop the catch-up block",
      "move math to the morning",
      "start at 9, 25-min blocks",
      "shift everything 15 minutes later",
      "swap the science video for weather",
      "make a worksheet on multiplying fractions",
    ]) {
      expect(isLikelyQuestion(e)).toBe(false);
    }
  });

  it("lets a mixed 'review fractions' edit phrasing fall to edit mode", () => {
    // "review fractions" is a remediation EDIT (queue_review_block), not a Q.
    expect(isLikelyQuestion("review fractions today")).toBe(false);
  });

  it("returns false for empty / whitespace", () => {
    expect(isLikelyQuestion("")).toBe(false);
    expect(isLikelyQuestion("   ")).toBe(false);
  });
});

describe("gatherAnswerContext — defensive assembly", () => {
  it("never throws and fills sensible placeholders when db is empty", async () => {
    const emptyDb = {
      getProfile: async () => null,
      listSkillsWithProgress: async () => [],
      getAllWeakTopics: async () => [],
      listAllBlockGrades: async () => [],
      listRecentMood: async () => [],
      listAdventuresFiltered: async () => [],
    };
    const c = await gatherAnswerContext(baseCtx(), emptyDb);
    expect(c.profileLine).toContain("Reagan");
    expect(c.todayBlocks).toContain("no blocks scheduled");
    expect(c.skillProgress).toContain("no skill-progress");
    expect(c.weakTopics).toContain("no flagged weak topics");
    expect(c.recentGrades).toContain("no graded work");
    expect(c.recentMood).toContain("no recent mood");
    expect(c.adventures).toContain("no adventure ideas");
  });

  it("never throws when db helpers reject or are missing entirely", async () => {
    const brokenDb = {
      getProfile: async () => {
        throw new Error("db down");
      },
      // all other helpers intentionally absent
    };
    const c = await gatherAnswerContext(baseCtx(), brokenDb);
    // Falls back to ctx values + placeholders rather than throwing.
    expect(c.profileLine).toContain("Reagan");
    expect(c.skillProgress).toContain("no skill-progress");
  });

  it("surfaces real data when present", async () => {
    const db = {
      getProfile: async () => ({ studentName: "Reagan", gradeLevel: "5th grade", notes: "loves birds" }),
      listSkillsWithProgress: async () => [
        { title: "Add/subtract fractions", subjectSlug: "math", masteryScore: 62 },
      ],
      getAllWeakTopics: async () => [
        { subjectSlug: "math", topicTitle: "Fractions", masteryScore: 55 },
      ],
      listAllBlockGrades: async () => [
        { subjectSlug: "math", title: "Fractions quiz", score: 68, gradedAt: new Date("2026-06-25") },
      ],
      listRecentMood: async () => [{ mood: "focused", loggedAt: new Date("2026-06-28") }],
      listAdventuresFiltered: async () => [
        { title: "Backyard bird count", kind: "science", setting: "outdoor", isFavorite: true },
      ],
    };
    const c = await gatherAnswerContext(
      baseCtx({
        blocks: [
          {
            id: 10,
            title: "Math warm-up",
            description: null,
            blockType: "math",
            startTime: "09:00",
            durationMin: 30,
            sortOrder: 0,
            status: "not_started",
            subjectSlug: "math",
            curriculumTopicCode: null,
          },
        ],
      }),
      db,
    );
    expect(c.profileLine).toContain("loves birds");
    expect(c.todayBlocks).toContain("Math warm-up");
    expect(c.skillProgress).toContain("62%");
    expect(c.weakTopics).toContain("Fractions");
    expect(c.recentGrades).toContain("68%");
    expect(c.recentMood).toContain("focused");
    expect(c.adventures).toContain("Backyard bird count");
  });
});
