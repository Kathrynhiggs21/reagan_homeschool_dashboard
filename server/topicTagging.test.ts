import { describe, it, expect } from "vitest";
import {
  sanitizeBlocks,
  buildPromptMessages,
  type AICurriculumTopicHint,
} from "./_lib/aiScheduleGenerator";

const TOPIC_CATALOG: AICurriculumTopicHint[] = [
  { code: "5.OA.1", title: "Order of operations w/ parentheses", subjectSlug: "math", status: "notStarted" },
  { code: "5.NF.3", title: "Fractions as division",            subjectSlug: "math", status: "inProgress" },
  { code: "RL.5.2", title: "Theme + summary",                  subjectSlug: "ela",  status: "notStarted" },
];

describe("topic tagging contract", () => {
  it("AI system prompt surfaces the active topic catalog AND the topic-required rule", () => {
    const messages = buildPromptMessages({
      dateStr: "2026-05-04",
      dayLabel: "Monday, May 4",
      studentName: "Reagan",
      gradeLevel: "5th grade",
      subjects: [{ slug: "math", name: "Math" }, { slug: "ela", name: "ELA" }],
      topicCatalog: TOPIC_CATALOG,
      tutorOfDay: { name: "Marcy", role: "Parent", arrival: "09:00", departure: "12:00" },
    });
    const sys = messages[0].content as string;
    expect(sys).toContain("ACTIVE CURRICULUM TOPIC CATALOG");
    expect(sys).toContain("5.OA.1");
    expect(sys).toContain("RL.5.2");
    expect(sys).toMatch(/EVERY academic block.*MUST include a curriculumTopicCode/);
    expect(sys).toContain("Marcy");
    expect(sys).toContain("09:00\u201312:00");
  });

  it("sanitizer keeps a valid topic code and warns on an unknown one", () => {
    const validCodes = new Set(TOPIC_CATALOG.map(t => t.code));
    const validSlugs = new Set(["math", "ela"]);
    const { blocks, warnings } = sanitizeBlocks(
      [
        { blockType: "math",        title: "Order of ops",  description: "warm-up", durationMin: 20, startTime: "09:00", subjectSlug: "math", curriculumTopicCode: "5.OA.1" },
        { blockType: "math",        title: "Mystery code",   description: "demo",   durationMin: 20, subjectSlug: "math", curriculumTopicCode: "9.ZZ.99" },
        { blockType: "appointment", title: "Therapy",        description: "Wed",    durationMin: 60, subjectSlug: null,   curriculumTopicCode: null },
      ],
      validSlugs,
      validCodes,
    );
    expect(blocks).toHaveLength(3);
    expect(blocks[0].curriculumTopicCode).toBe("5.OA.1");
    expect(blocks[1].curriculumTopicCode).toBeNull();   // unknown code stripped
    expect(blocks[2].curriculumTopicCode).toBeNull();   // appointment may stay untagged
    expect(warnings.some(w => w.includes("9.ZZ.99"))).toBe(true);
  });

  it("sanitizer warns when an academic block arrives with no topic code at all", () => {
    const { warnings } = sanitizeBlocks(
      [{ blockType: "math", title: "Untagged math", description: "x", durationMin: 30, subjectSlug: "math" }],
      new Set(["math"]),
      new Set(["5.OA.1"]),
    );
    expect(warnings.some(w => /missing curriculumTopicCode/i.test(w))).toBe(true);
  });
});
