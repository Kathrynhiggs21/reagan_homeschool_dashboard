/**
 * Push 101 (2026-05-13) — IEP-paperwork PDF render-plan contract.
 *
 * Locks the audience-aware section visibility, the don't-show-if-empty
 * rule for mood/coverage/behavior-tags, and the footer copy for the
 * three audiences (iep-meeting / grandma-share / tutor-handoff).
 */
import { describe, it, expect } from "vitest";
import {
  buildIepPaperworkPlan,
  visibleIepSections,
  type IepPlanInput,
} from "./_lib/iepPaperworkPlan";

const SAMPLE: IepPlanInput = {
  dateISO: "2026-05-13",
  dateLabel: "May 13, 2026",
  audience: "iep-meeting",
  moodRows: [
    { loggedAt: "2026-05-13T09:14:00", zone: "green", source: "kid-self" },
    { loggedAt: "2026-05-13T13:00:00", zone: "yellow", source: "mom" },
  ],
  coverage: [
    { subject: "math", plannedPct: 80, effectivePct: 95 },
    { subject: "science", plannedPct: 0, effectivePct: 100, offPlan: true },
  ],
  behaviorTagsRollup: [
    { tag: "focused", count: 4 },
    { tag: "distracted", count: 1 },
  ],
  hasReaganVoiceVerified: true,
};

describe("Push 101 — IEP paperwork plan", () => {
  it("iep-meeting audience shows ALL canonical sections", () => {
    const plan = buildIepPaperworkPlan(SAMPLE);
    expect(visibleIepSections(plan)).toEqual([
      "header",
      "mood-timeline",
      "coverage",
      "behavior-tags",
      "voice-provenance-note",
      "footer",
    ]);
    expect(plan.footer).toContain("Source-of-record paper trail");
  });

  it("grandma-share audience hides voice-provenance-note and uses grandma footer", () => {
    const plan = buildIepPaperworkPlan({ ...SAMPLE, audience: "grandma-share" });
    expect(visibleIepSections(plan)).not.toContain("voice-provenance-note");
    expect(plan.footer).toMatch(/IEP meetings/i);
    expect(plan.footer).toMatch(/don't repost/i);
  });

  it("tutor-handoff audience shows voice provenance ONLY when verified entries exist", () => {
    const yes = buildIepPaperworkPlan({
      ...SAMPLE,
      audience: "tutor-handoff",
      hasReaganVoiceVerified: true,
    });
    expect(visibleIepSections(yes)).toContain("voice-provenance-note");
    const no = buildIepPaperworkPlan({
      ...SAMPLE,
      audience: "tutor-handoff",
      hasReaganVoiceVerified: false,
    });
    expect(visibleIepSections(no)).not.toContain("voice-provenance-note");
    expect(no.footer).toMatch(/confirm receipt/i);
  });

  it('"don\'t show if no info" — empty mood/coverage/behavior all hide their sections', () => {
    const empty = buildIepPaperworkPlan({
      ...SAMPLE,
      moodRows: [],
      coverage: [],
      behaviorTagsRollup: [],
    });
    const ids = visibleIepSections(empty);
    expect(ids).not.toContain("mood-timeline");
    expect(ids).not.toContain("coverage");
    expect(ids).not.toContain("behavior-tags");
    // Header + footer always render
    expect(ids).toContain("header");
    expect(ids).toContain("footer");
  });

  it("kid name defaults to Reagan and respects override", () => {
    const def = buildIepPaperworkPlan(SAMPLE);
    expect(def.kidName).toBe("Reagan");
    const over = buildIepPaperworkPlan({ ...SAMPLE, kidName: "Reagan H." });
    expect(over.kidName).toBe("Reagan H.");
    expect(over.footer).toContain("Reagan H.");
  });

  it("footer payload is materialized into the footer section", () => {
    const plan = buildIepPaperworkPlan(SAMPLE);
    const footerSection = plan.sections.find((s) => s.id === "footer");
    expect(footerSection?.payload).toBe(plan.footer);
  });

  it("mood-timeline payload preserves canonical bucket order", () => {
    const plan = buildIepPaperworkPlan(SAMPLE);
    const mood = plan.sections.find((s) => s.id === "mood-timeline");
    const buckets = mood?.payload as Array<{ bucket: string }>;
    expect(buckets.map((b) => b.bucket)).toEqual([
      "morning",
      "midday",
      "afternoon",
      "evening",
    ]);
  });
});
