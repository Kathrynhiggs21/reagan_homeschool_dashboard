import { describe, it, expect, beforeEach } from "vitest";
import { loadKnowledgeBundle, _resetKnowledgeBundleCache } from "./_lib/knowledgeBundle";
import { buildPromptMessages } from "./_lib/aiScheduleGenerator";

describe("knowledgeBundle", () => {
  beforeEach(() => _resetKnowledgeBundleCache());

  it("loads all five knowledge files", () => {
    const k = loadKnowledgeBundle();
    expect(k.q4Standards.length).toBeGreaterThan(100);
    expect(k.iepSnapshot.length).toBeGreaterThan(100);
    expect(k.scopeSequence.length).toBeGreaterThan(100);
    expect(k.assignmentTracker.length).toBeGreaterThan(100);
    // hsCatalogExcerpt may legitimately be small (40 lines max)
    expect(k.hsCatalogExcerpt.length).toBeGreaterThan(50);
  });

  it("renders a single inlinable promptBlock", () => {
    const k = loadKnowledgeBundle();
    expect(k.promptBlock).toContain("REAGAN KNOWLEDGE BUNDLE");
    expect(k.promptBlock).toContain("Q4 standards");
    expect(k.promptBlock).toContain("IEP snapshot");
    expect(k.promptBlock).toContain("scope & sequence");
    expect(k.promptBlock).toContain("assignment tracker");
    expect(k.totalChars).toBeGreaterThan(1000);
  });

  it("aiScheduleGenerator buildPromptMessages embeds the knowledge bundle into the system prompt", () => {
    const msgs = buildPromptMessages({
      dateStr: "2026-05-04",
      dayLabel: "Monday, May 4",
      studentName: "Reagan",
      subjects: [{ slug: "math", name: "Math" }],
      dayLength: "full",
    });
    const sys = msgs[0]?.content || "";
    expect(sys).toContain("REAGAN KNOWLEDGE BUNDLE");
    // quick sanity that an actual standards line made it through
    expect(sys).toMatch(/5\.OA\.|5\.G\.|RL\.5/);
  });
});
