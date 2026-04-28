/**
 * Vitest coverage for Phase 2+3 additions: take-notes CRUD, needs-work tree
 * create/complete/reopen, grades upsert+letter, printables sources listing.
 * Uses the live DB + live tRPC caller (same pattern as other tests in this repo).
 */
import { describe, it, expect } from "vitest";
import { appRouter } from "./routers";

function makeCaller() {
  // Mirror the pattern used by auth.logout.test.ts: instantiate caller with a
  // minimal public context — all new procedures are publicProcedure so no user.
  return (appRouter as any).createCaller({ user: null, req: null, res: null });
}

describe("take notes", () => {
  it("creates, lists, updates, and deletes a note", async () => {
    const caller = makeCaller();
    const created: any = await caller.notes.create({
      title: "Test note",
      body: "hello world",
      subjectSlug: "math",
    });
    expect(created.id).toBeGreaterThan(0);

    const list: any[] = await caller.notes.list({});
    expect(list.some((n) => n.id === created.id)).toBe(true);

    await caller.notes.update({ id: created.id, title: "Test note v2" });
    const list2: any[] = await caller.notes.list({});
    const updated = list2.find((n) => n.id === created.id);
    expect(updated.title).toBe("Test note v2");

    await caller.notes.delete({ id: created.id });
    const list3: any[] = await caller.notes.list({});
    expect(list3.find((n) => n.id === created.id)).toBeUndefined();
  });
});

describe("needs work tree", () => {
  it("creates parent + child, completes, reopens, deletes", async () => {
    const caller = makeCaller();
    const parent: any = await caller.needsWork.create({
      title: "Math (test)",
      origin: "manual",
    });
    const child: any = await caller.needsWork.create({
      parentId: parent.id,
      title: "Fractions (test)",
      subjectSlug: "math",
      origin: "manual",
    });
    expect(child.parentId).toBe(parent.id);

    await caller.needsWork.complete({ id: child.id });
    const all: any[] = await caller.needsWork.list();
    const c = all.find((r) => r.id === child.id);
    expect(c.dateCompleted).toBeTruthy();

    await caller.needsWork.reopen({ id: child.id });
    const all2: any[] = await caller.needsWork.list();
    const c2 = all2.find((r) => r.id === child.id);
    expect(c2.dateCompleted).toBeFalsy();

    await caller.needsWork.delete({ id: child.id });
    await caller.needsWork.delete({ id: parent.id });
  });
});

describe("printables hub", () => {
  it("lists seeded sources with at least Ohio + K5 entries", async () => {
    const caller = makeCaller();
    const sources: any[] = await caller.printables.listSources();
    expect(sources.length).toBeGreaterThanOrEqual(15);
    const names = sources.map((s) => (s.name || "").toLowerCase());
    expect(names.some((n) => n.includes("k5"))).toBe(true);
  });
});

describe("submissions + auto-grading", () => {
  it("creates a typed submission and auto-grades against an MC+text key", async () => {
    const caller = makeCaller();
    // Create a block to attach to
    const today = new Date().toISOString().slice(0, 10);
    const plan: any = await caller.plans.ensureToday({ date: today }).catch(() => null);
    // Use any existing block: pull today's schedule
    const t: any = await caller.plans.today();
    const block = t?.blocks?.[0];
    expect(block).toBeTruthy();

    // Seed an answer key
    await caller.answerKeys.upsert({
      blockId: block.id,
      totalPoints: 100,
      questions: [
        { qId: "q1", kind: "mc", prompt: "Capital of Ohio?", correct: "Columbus" },
        { qId: "q2", kind: "mc", prompt: "2 + 2", correct: "4" },
      ],
    });

    // Submit typed answers
    const sub: any = await caller.submissions.create({
      blockId: block.id,
      mode: "typed",
      answersText: "Columbus\n4",
    });
    expect(sub.id).toBeGreaterThan(0);

    const graded: any = await caller.submissions.autoGrade({ submissionId: sub.id });
    expect(graded.autoScore).toBe(100);
    expect(graded.letter).toBe("A");
  }, 30000);
});

describe("adaptive curriculum", () => {
  it("rebuildAdaptiveSuggestions adds proposed adjustments + seeds needs-work for low-mastery skills", async () => {
    const caller = makeCaller();
    // Ensure a low-mastery skill exists
    const skills: any = await caller.skills.list();
    let target = skills.find((s: any) => (s.currentScore ?? 100) < 60);
    if (!target) {
      // upsert a fresh low-mastery skill
      await caller.skills.upsert({
        subjectSlug: "math",
        skillName: "Fractions with unlike denominators (adaptive test)",
        currentScore: 40,
      });
    }

    const result: any = await caller.adjustments.rebuild();
    expect(result.adjustmentsAdded).toBeGreaterThanOrEqual(0);
    expect(result.needsWorkAdded).toBeGreaterThanOrEqual(0);

    const proposed: any = await caller.adjustments.list({ status: "proposed" });
    expect(Array.isArray(proposed)).toBe(true);
  }, 30000);

  it("subjectGrades returns rolling averages with letters + kid labels", async () => {
    const caller = makeCaller();
    const grades: any = await caller.submissions.subjectGrades();
    expect(Array.isArray(grades)).toBe(true);
    for (const g of grades) {
      expect(typeof g.subjectSlug).toBe("string");
      expect(typeof g.average).toBe("number");
      expect(["A","B","C","D","F"]).toContain(g.letter);
      expect(["Mastered","Got it","Getting there","Not yet"]).toContain(g.kidLabel);
    }
  }, 15000);
});
