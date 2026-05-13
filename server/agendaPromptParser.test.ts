/**
 * Push 88 (2026-05-13) — Agenda prompt parser + diff applier contract.
 *
 * Locks:
 *   - Mom-utterances Mom listed parse to specific directives.
 *   - Diff applier respects clamps (10–120 min) and skips completed blocks.
 *   - "No directives detected" message when prompt has nothing actionable.
 *   - mutation registered as familyAdminProcedure (not public) so Reagan
 *     can't preview prompts on her own session.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  parseAgendaPromptToDirectives,
  applyDirectivesAsDiff,
  type BlockSnapshot,
} from "./_lib/agendaPromptParser";

const ROOT = join(__dirname, "..");
const ROUTERS_SRC = readFileSync(join(ROOT, "server", "routers.ts"), "utf8");

const baseBlocks: BlockSnapshot[] = [
  { id: 1, title: "Math drill", subjectSlug: "math", durationMin: 40 },
  { id: 2, title: "Read aloud", subjectSlug: "ela", durationMin: 30 },
  { id: 3, title: "Science experiment", subjectSlug: "science", durationMin: 45 },
  { id: 4, title: "Adventure walk", subjectSlug: "specials", durationMin: 30 },
];

describe("Push 88 — parseAgendaPromptToDirectives", () => {
  it("detects 'shorter' as shortenAll", () => {
    const out = parseAgendaPromptToDirectives("make it shorter today");
    expect(out.find((d) => d.kind === "shortenAll")).toBeTruthy();
  });

  it("detects 'fun and easy' as both amplifyFun + easeUp", () => {
    const out = parseAgendaPromptToDirectives("short fun and easy");
    expect(out.find((d) => d.kind === "shortenAll")).toBeTruthy();
    expect(out.find((d) => d.kind === "amplifyFun")).toBeTruthy();
    expect(out.find((d) => d.kind === "easeUp")).toBeTruthy();
  });

  it("detects 'more focused on math' as focusSubject math", () => {
    const out = parseAgendaPromptToDirectives("more focused on math today");
    const focus = out.find((d) => d.kind === "focusSubject");
    expect(focus).toBeTruthy();
    expect(focus?.subjectSlug).toBe("math");
  });

  it("detects explicit duration bump", () => {
    const out = parseAgendaPromptToDirectives("add 10 min to math");
    const bump = out.find((d) => d.kind === "bumpDurationFor");
    expect(bump).toBeTruthy();
    expect(bump?.subjectSlug).toBe("math");
    expect(bump?.deltaMin).toBe(10);
  });

  it("detects 'no science today' as removeSubjectToday science", () => {
    const out = parseAgendaPromptToDirectives("no science today");
    const skip = out.find((d) => d.kind === "removeSubjectToday");
    expect(skip).toBeTruthy();
    expect(skip?.subjectSlug).toBe("science");
  });

  it("detects 'less art' as deprioritizeSubject", () => {
    const out = parseAgendaPromptToDirectives("less art please");
    const dep = out.find((d) => d.kind === "deprioritizeSubject");
    expect(dep).toBeTruthy();
    expect(dep?.subjectSlug).toBe("specials");
  });

  it("returns [] for empty / unrecognized prompt", () => {
    expect(parseAgendaPromptToDirectives("")).toEqual([]);
    expect(parseAgendaPromptToDirectives("hi there")).toEqual([]);
  });
});

describe("Push 88 — applyDirectivesAsDiff", () => {
  it("shortenAll reduces every non-complete block by 25% clamped at 10", () => {
    const { ops } = applyDirectivesAsDiff(baseBlocks, [
      { kind: "shortenAll", rationale: "short" },
    ]);
    const mathOp = ops.find((o) => o.kind === "updateDuration" && o.blockId === 1);
    expect(mathOp).toBeTruthy();
    if (mathOp && mathOp.kind === "updateDuration") {
      expect(mathOp.after).toBe(30); // 40 * 0.75 = 30
    }
  });

  it("respects clamps (never below 10, never above 120)", () => {
    const tinyBlock: BlockSnapshot = { id: 9, title: "Tiny", subjectSlug: "math", durationMin: 12 };
    const big: BlockSnapshot = { id: 10, title: "Big", subjectSlug: "math", durationMin: 110 };
    const { ops: shrunk } = applyDirectivesAsDiff([tinyBlock], [
      { kind: "shortenAll", rationale: "" },
    ]);
    // 12*0.75 = 9 -> clamped to 10.
    const op = shrunk.find((o) => o.kind === "updateDuration");
    if (op && op.kind === "updateDuration") expect(op.after).toBeGreaterThanOrEqual(10);
    const { ops: grown } = applyDirectivesAsDiff([big], [
      { kind: "lengthenAll", rationale: "" },
    ]);
    const op2 = grown.find((o) => o.kind === "updateDuration");
    if (op2 && op2.kind === "updateDuration") expect(op2.after).toBeLessThanOrEqual(120);
  });

  it("skips already-complete blocks", () => {
    const blocks: BlockSnapshot[] = [
      { id: 1, title: "Done", subjectSlug: "math", durationMin: 40, status: "complete" },
      { id: 2, title: "Open", subjectSlug: "math", durationMin: 40 },
    ];
    const { ops } = applyDirectivesAsDiff(blocks, [
      { kind: "shortenAll", rationale: "" },
    ]);
    expect(ops.find((o) => o.blockId === 1)).toBeFalsy();
    expect(ops.find((o) => o.blockId === 2)).toBeTruthy();
  });

  it("focusSubject only touches matching subject", () => {
    const { ops } = applyDirectivesAsDiff(baseBlocks, [
      { kind: "focusSubject", subjectSlug: "math", rationale: "focus math" },
    ]);
    expect(ops.length).toBe(1);
    expect(ops[0].blockId).toBe(1);
  });

  it("removeSubjectToday produces a skipBlock op (not a duration update)", () => {
    const { ops } = applyDirectivesAsDiff(baseBlocks, [
      { kind: "removeSubjectToday", subjectSlug: "science", rationale: "" },
    ]);
    const skip = ops.find((o) => o.blockId === 3);
    expect(skip?.kind).toBe("skipBlock");
  });

  it("empty directive list returns the 'nothing will change' summary", () => {
    const out = applyDirectivesAsDiff(baseBlocks, []);
    expect(out.ops).toEqual([]);
    expect(out.summary.toLowerCase()).toContain("nothing will change");
  });
});

describe("Push 88 — router exposure", () => {
  it("agendaEditor.previewPromptDiff is registered as familyAdminProcedure mutation", () => {
    const slice = ROUTERS_SRC.slice(
      ROUTERS_SRC.indexOf("previewPromptDiff"),
      ROUTERS_SRC.indexOf("previewPromptDiff") + 800,
    );
    expect(slice).toContain("familyAdminProcedure");
    expect(slice).toContain(".mutation(");
    expect(slice).toContain("parseAgendaPromptToDirectives");
    expect(slice).toContain("applyDirectivesAsDiff");
  });
});
