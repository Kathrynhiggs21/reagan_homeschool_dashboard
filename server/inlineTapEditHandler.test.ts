/**
 * Push 152 (2026-05-14) — inlineTapEditHandler vitest contract.
 */
import { describe, it, expect } from "vitest";
import { applyInlineTapEdit } from "./_lib/inlineTapEditHandler";

describe("applyInlineTapEdit — startTime", () => {
  it("accepts '9'", () => {
    const r = applyInlineTapEdit({ blockId: 1, field: "startTime", rawValue: "9", oldStartTime: "08:00" });
    expect(r.ok).toBe(true);
    expect(r.applyValue).toBe("09:00");
    expect(r.undoValue).toBe("08:00");
    expect(r.message).toMatch(/09:00/);
  });

  it("accepts '9:30'", () => {
    const r = applyInlineTapEdit({ blockId: 1, field: "startTime", rawValue: "9:30" });
    expect(r.applyValue).toBe("09:30");
  });

  it("accepts '10am'", () => {
    const r = applyInlineTapEdit({ blockId: 1, field: "startTime", rawValue: "10am" });
    expect(r.applyValue).toBe("10:00");
  });

  it("accepts '1pm'", () => {
    const r = applyInlineTapEdit({ blockId: 1, field: "startTime", rawValue: "1pm" });
    expect(r.applyValue).toBe("13:00");
  });

  it("rejects gibberish with kid-readable error", () => {
    const r = applyInlineTapEdit({ blockId: 1, field: "startTime", rawValue: "later" });
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/9|9:30|10am/);
  });

  it("rejects out-of-range hours", () => {
    const r = applyInlineTapEdit({ blockId: 1, field: "startTime", rawValue: "25" });
    expect(r.ok).toBe(false);
  });
});

describe("applyInlineTapEdit — durationMin", () => {
  it("accepts plain '30'", () => {
    const r = applyInlineTapEdit({ blockId: 1, field: "durationMin", rawValue: "30", oldDurationMin: 25 });
    expect(r.ok).toBe(true);
    expect(r.applyValue).toBe(30);
    expect(r.undoValue).toBe(25);
  });

  it("accepts '30 min'", () => {
    const r = applyInlineTapEdit({ blockId: 1, field: "durationMin", rawValue: "30 min" });
    expect(r.applyValue).toBe(30);
  });

  it("accepts '1h'", () => {
    const r = applyInlineTapEdit({ blockId: 1, field: "durationMin", rawValue: "1h" });
    expect(r.applyValue).toBe(60);
  });

  it("accepts '1h 15m'", () => {
    const r = applyInlineTapEdit({ blockId: 1, field: "durationMin", rawValue: "1h 15m" });
    expect(r.applyValue).toBe(75);
  });

  it("rejects 0 minutes", () => {
    const r = applyInlineTapEdit({ blockId: 1, field: "durationMin", rawValue: "0" });
    expect(r.ok).toBe(false);
  });

  it("rejects > 180 min for academic", () => {
    const r = applyInlineTapEdit({ blockId: 1, field: "durationMin", rawValue: "200", isAcademic: true });
    expect(r.ok).toBe(false);
  });

  it("rejects > 60 min for movement (isAcademic=false)", () => {
    const r = applyInlineTapEdit({ blockId: 1, field: "durationMin", rawValue: "75", isAcademic: false });
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/1 and 60/);
  });
});

describe("applyInlineTapEdit — title", () => {
  it("accepts a short clean title", () => {
    const r = applyInlineTapEdit({ blockId: 1, field: "title", rawValue: "Math practice", oldTitle: "Math" });
    expect(r.ok).toBe(true);
    expect(r.applyValue).toBe("Math practice");
    expect(r.undoValue).toBe("Math");
  });

  it("collapses whitespace", () => {
    const r = applyInlineTapEdit({ blockId: 1, field: "title", rawValue: "  Math    practice  " });
    expect(r.applyValue).toBe("Math practice");
  });

  it("rejects empty title", () => {
    const r = applyInlineTapEdit({ blockId: 1, field: "title", rawValue: "   " });
    expect(r.ok).toBe(false);
  });

  it("rejects > 80 char title", () => {
    const r = applyInlineTapEdit({ blockId: 1, field: "title", rawValue: "x".repeat(81) });
    expect(r.ok).toBe(false);
  });
});

describe("applyInlineTapEdit — kid + Grandma readable", () => {
  it("error messages contain no internal jargon", () => {
    const cases = [
      { field: "startTime" as const, rawValue: "blarg" },
      { field: "durationMin" as const, rawValue: "abc" },
      { field: "title" as const, rawValue: "" },
    ];
    for (const c of cases) {
      const r = applyInlineTapEdit({ blockId: 1, ...c });
      expect(r.message).not.toMatch(/applyValue|undoValue|InlineTapEditField|isAcademic/);
    }
  });
});
