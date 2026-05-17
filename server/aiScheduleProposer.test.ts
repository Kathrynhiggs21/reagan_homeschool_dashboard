import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import {
  sanitizeProposal,
  snapshotToBlockDraft,
  buildProposalPromptMessages,
  proposeScheduleEdit,
  type ExistingBlockSnapshot,
} from "./_lib/aiScheduleProposer";

/**
 * AI Schedule Proposer — free-form prompt → diff layer for the agenda editor.
 *
 * Contract this file locks:
 *  1. The proposer is PURE — it never imports db.ts and never writes anything.
 *  2. sanitizeProposal accepts garbage from the LLM without throwing.
 *  3. Decisions referencing nonexistent block ids are dropped with warnings.
 *  4. Existing blocks the LLM forgot to mention are auto-filled as `keep`.
 *  5. Empty / missing prompt → all-keep proposal, no LLM call (fast path).
 *  6. The LLM-failure path falls back to all-keep instead of throwing.
 *  7. The prompt includes the existing block ids so the LLM can reference them.
 */

const SUBJECTS = [
  { slug: "math", name: "Math" },
  { slug: "ela", name: "ELA" },
  { slug: "science", name: "Science" },
];

const VALID_SLUGS = new Set(SUBJECTS.map((s) => s.slug));

function makeSnap(overrides: Partial<ExistingBlockSnapshot> & { id: number; sortOrder: number }): ExistingBlockSnapshot {
  return {
    blockType: "math",
    title: "Math",
    description: "do the page",
    durationMin: 25,
    startTime: null,
    subjectSlug: "math",
    curriculumTopicCode: null,
    ...overrides,
  };
}

const EXISTING: ExistingBlockSnapshot[] = [
  makeSnap({ id: 101, sortOrder: 0, blockType: "morning_warmup", title: "Soft start", subjectSlug: null, durationMin: 15 }),
  makeSnap({ id: 102, sortOrder: 1, blockType: "math", title: "Math", subjectSlug: "math", durationMin: 30 }),
  makeSnap({ id: 103, sortOrder: 2, blockType: "read_aloud", title: "Tuck Everlasting", subjectSlug: "ela", durationMin: 25 }),
  makeSnap({ id: 104, sortOrder: 3, blockType: "adventure", title: "Backyard nature", subjectSlug: "science", durationMin: 30 }),
];

/* ------------------------- PART A: source contract ------------------------- */

describe("aiScheduleProposer — source contract", () => {
  const src = fs.readFileSync(
    path.join(__dirname, "_lib", "aiScheduleProposer.ts"),
    "utf8",
  );

  it("does NOT import db.ts (pure helper)", () => {
    expect(src).not.toMatch(/from ['"]\.\.\/db['"]/);
    expect(src).not.toMatch(/from ['"]\.\.\/\.\.\/server\/db['"]/);
  });

  it("does NOT call drizzle / sql tag (no DB writes)", () => {
    expect(src).not.toMatch(/import .*drizzle-orm/);
    expect(src).not.toMatch(/getDb\(\)/);
  });

  it("exports proposeScheduleEdit + sanitizeProposal + buildProposalPromptMessages", () => {
    expect(src).toContain("export async function proposeScheduleEdit");
    expect(src).toContain("export function sanitizeProposal");
    expect(src).toContain("export function buildProposalPromptMessages");
  });

  it("supports all four decision kinds: keep, modify, remove, add", () => {
    expect(src).toMatch(/kind: "keep"/);
    expect(src).toMatch(/kind: "modify"/);
    expect(src).toMatch(/kind: "remove"/);
    expect(src).toMatch(/kind: "add"/);
  });
});

/* --------------------------- PART B: pure helpers -------------------------- */

describe("snapshotToBlockDraft", () => {
  it("converts an existing block snapshot to an AIBlockDraft", () => {
    const draft = snapshotToBlockDraft(EXISTING[1]);
    expect(draft.blockType).toBe("math");
    expect(draft.title).toBe("Math");
    expect(draft.durationMin).toBe(30);
    expect(draft.subjectSlug).toBe("math");
  });

  it("normalizes null description to empty string", () => {
    const draft = snapshotToBlockDraft(makeSnap({ id: 1, sortOrder: 0, description: null }));
    expect(draft.description).toBe("");
  });
});

/* ---------------------- PART C: sanitizeProposal logic --------------------- */

describe("sanitizeProposal", () => {
  it("returns empty + warning when LLM payload is null/undefined", () => {
    const res = sanitizeProposal(null, EXISTING, VALID_SLUGS);
    expect(res.decisions).toEqual([]);
    expect(res.warnings.length).toBeGreaterThan(0);
  });

  it("returns empty + warning when `decisions` field is missing", () => {
    const res = sanitizeProposal({ summary: "ok" }, EXISTING, VALID_SLUGS);
    expect(res.decisions).toEqual([]);
    expect(res.warnings.some((w) => w.includes("decisions"))).toBe(true);
    expect(res.summary).toBe("ok");
  });

  it("preserves keep/remove decisions for valid existing block ids", () => {
    const res = sanitizeProposal(
      {
        summary: "shorter day",
        decisions: [
          { kind: "keep", existingBlockId: 101, reason: "morning still works" },
          { kind: "remove", existingBlockId: 102, reason: "drop math today" },
        ],
      },
      EXISTING,
      VALID_SLUGS,
    );
    const kinds = res.decisions.map((d) => d.kind);
    expect(kinds).toContain("keep");
    expect(kinds).toContain("remove");
    // The unmentioned blocks (103, 104) should be auto-filled as keep.
    const keepIds = res.decisions
      .filter((d) => d.kind === "keep")
      .map((d) => (d as any).existingBlockId);
    expect(keepIds).toContain(103);
    expect(keepIds).toContain(104);
  });

  it("drops decisions referencing non-existent block ids and emits a warning", () => {
    const res = sanitizeProposal(
      {
        summary: "x",
        decisions: [
          { kind: "remove", existingBlockId: 999, reason: "ghost block" },
        ],
      },
      EXISTING,
      VALID_SLUGS,
    );
    expect(res.decisions.find((d) => d.kind === "remove")).toBeUndefined();
    expect(res.warnings.some((w) => w.includes("999"))).toBe(true);
  });

  it("accepts a modify decision and produces a clean before/after pair", () => {
    const res = sanitizeProposal(
      {
        summary: "lighter math",
        decisions: [
          {
            kind: "modify",
            existingBlockId: 102,
            after: {
              blockType: "math",
              title: "Math (light)",
              description: "one short page",
              durationMin: 15,
              subjectSlug: "math",
            },
            reason: "shortened per parent prompt",
          },
        ],
      },
      EXISTING,
      VALID_SLUGS,
    );
    const mod = res.decisions.find((d) => d.kind === "modify") as any;
    expect(mod).toBeDefined();
    expect(mod.before.title).toBe("Math");
    expect(mod.before.durationMin).toBe(30);
    expect(mod.after.title).toBe("Math (light)");
    expect(mod.after.durationMin).toBe(15);
  });

  it("falls back insertAfterSortOrder to null when sortOrder isn't real", () => {
    const res = sanitizeProposal(
      {
        summary: "add art",
        decisions: [
          {
            kind: "add",
            after: {
              blockType: "choice",
              title: "Art break",
              description: "draw",
              durationMin: 20,
              subjectSlug: null,
            },
            insertAfterSortOrder: 99,
            reason: "fits between math + reading",
          },
        ],
      },
      EXISTING,
      VALID_SLUGS,
    );
    const add = res.decisions.find((d) => d.kind === "add") as any;
    expect(add).toBeDefined();
    expect(add.insertAfterSortOrder).toBeNull();
    expect(res.warnings.some((w) => w.includes("99"))).toBe(true);
  });

  it("rejects duplicate decisions for the same existingBlockId (first wins)", () => {
    const res = sanitizeProposal(
      {
        summary: "x",
        decisions: [
          { kind: "keep", existingBlockId: 101, reason: "a" },
          { kind: "remove", existingBlockId: 101, reason: "b" },
        ],
      },
      EXISTING,
      VALID_SLUGS,
    );
    const matches = res.decisions.filter(
      (d) => "existingBlockId" in d && d.existingBlockId === 101,
    );
    expect(matches.length).toBe(1);
    expect(matches[0].kind).toBe("keep");
    expect(res.warnings.some((w) => w.includes("already has a decision"))).toBe(true);
  });

  it("treats unmentioned existing blocks as implicit `keep`", () => {
    const res = sanitizeProposal(
      { summary: "leave it alone", decisions: [] },
      EXISTING,
      VALID_SLUGS,
    );
    const keepIds = res.decisions
      .filter((d) => d.kind === "keep")
      .map((d) => (d as any).existingBlockId)
      .sort((a, b) => a - b);
    expect(keepIds).toEqual([101, 102, 103, 104]);
  });

  it("ignores unknown decision kinds with a warning", () => {
    const res = sanitizeProposal(
      {
        summary: "x",
        decisions: [{ kind: "bewitch", existingBlockId: 101 }],
      },
      EXISTING,
      VALID_SLUGS,
    );
    expect(res.warnings.some((w) => w.includes("unknown decision kind"))).toBe(true);
  });
});

/* ------------------- PART D: buildProposalPromptMessages ------------------- */

describe("buildProposalPromptMessages", () => {
  it("includes existing block ids so the LLM can reference them", () => {
    const msgs = buildProposalPromptMessages({
      dateStr: "2026-05-18",
      dayLabel: "Monday, May 18",
      studentName: "Reagan",
      adultPrompt: "shorter day",
      subjects: SUBJECTS,
      existingBlocks: EXISTING,
    });
    const body = msgs.map((m) => m.content).join("\n");
    expect(body).toContain('"id": 101');
    expect(body).toContain('"id": 102');
    expect(body).toContain('"id": 103');
    expect(body).toContain('"id": 104');
  });

  it("includes the parent's free-form prompt verbatim", () => {
    const msgs = buildProposalPromptMessages({
      dateStr: "2026-05-18",
      dayLabel: "Monday, May 18",
      studentName: "Reagan",
      adultPrompt: "swap math for art today please",
      subjects: SUBJECTS,
      existingBlocks: EXISTING,
    });
    const body = msgs.map((m) => m.content).join("\n");
    expect(body).toContain("swap math for art today please");
  });
});

/* ------------------- PART E: proposeScheduleEdit fast path ----------------- */

describe("proposeScheduleEdit", () => {
  it("empty prompt → all-keep proposal, NO LLM call", async () => {
    const res = await proposeScheduleEdit({
      dateStr: "2026-05-18",
      dayLabel: "Monday, May 18",
      studentName: "Reagan",
      adultPrompt: "",
      subjects: SUBJECTS,
      existingBlocks: EXISTING,
    });
    expect(res.decisions.length).toBe(EXISTING.length);
    expect(res.decisions.every((d) => d.kind === "keep")).toBe(true);
    expect(res.warnings).toEqual([]);
  });

  it("whitespace-only prompt is also treated as no-op", async () => {
    const res = await proposeScheduleEdit({
      dateStr: "2026-05-18",
      dayLabel: "Monday, May 18",
      studentName: "Reagan",
      adultPrompt: "   \n\t  ",
      subjects: SUBJECTS,
      existingBlocks: EXISTING,
    });
    expect(res.decisions.every((d) => d.kind === "keep")).toBe(true);
  });
});
