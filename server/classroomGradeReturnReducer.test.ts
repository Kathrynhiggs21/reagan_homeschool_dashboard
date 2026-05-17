/**
 * classroomGradeReturnReducer.test.ts
 *
 * Pure unit tests for the grade-return decision helper. No DB.
 *
 * Locks the contract Mom + the future sync job depend on:
 *  - returnedAt=null is always a no-op (covers entire pre-OAuth state).
 *  - First-time return flips to graded with normalized grade fields.
 *  - Letter-only grade keeps gradeNumeric null.
 *  - assignedGrade is normalized to two-decimal string ("92" → "92.00").
 *  - Idempotent: same grade after flip → skip "already_applied".
 *  - Re-grade: different grade after flip → apply again.
 *  - Empty / whitespace grade text → null.
 *  - Note is informative and includes returnedAt ISO string.
 */

import { describe, it, expect } from "vitest";
import {
  classroomGradeReturnReducer,
  type ClassroomGradeReturnInput,
} from "./_lib/classroomGradeReturnReducer";

const RETURNED = new Date("2026-05-15T16:00:00Z");

const base: ClassroomGradeReturnInput = {
  currentLifecycle: "turned_in",
  currentGrade: null,
  currentGradeNumeric: null,
  currentGradedAt: null,
  returnedAt: RETURNED,
  grade: null,
  assignedGrade: null,
  maxPoints: null,
};

describe("classroomGradeReturnReducer", () => {
  it("skips with reason='not_returned_yet' when returnedAt is null", () => {
    const out = classroomGradeReturnReducer({ ...base, returnedAt: null });
    expect(out.action).toBe("skip");
    if (out.action === "skip") expect(out.reason).toBe("not_returned_yet");
  });

  it("applies the first-time return even when grade is null (review-only)", () => {
    const out = classroomGradeReturnReducer({
      ...base,
      currentLifecycle: "turned_in",
      grade: null,
      assignedGrade: null,
    });
    expect(out.action).toBe("apply");
    if (out.action === "apply") {
      expect(out.toStatus).toBe("graded");
      expect(out.grade).toBeNull();
      expect(out.gradeNumeric).toBeNull();
      expect(out.note).toContain("Classroom returned");
      expect(out.note).toContain(RETURNED.toISOString());
    }
  });

  it("normalizes assignedGrade=92 + maxPoints=100 to gradeNumeric='92.00' and includes 92/100 in note", () => {
    const out = classroomGradeReturnReducer({
      ...base,
      grade: "A-",
      assignedGrade: 92,
      maxPoints: 100,
    });
    expect(out.action).toBe("apply");
    if (out.action === "apply") {
      expect(out.grade).toBe("A-");
      expect(out.gradeNumeric).toBe("92.00");
      expect(out.note).toContain("grade=A-");
      expect(out.note).toContain("(92/100)");
    }
  });

  it("trims grade text and treats whitespace-only as null", () => {
    const out1 = classroomGradeReturnReducer({ ...base, grade: "  Pass  " });
    if (out1.action === "apply") expect(out1.grade).toBe("Pass");
    const out2 = classroomGradeReturnReducer({ ...base, grade: "   " });
    if (out2.action === "apply") expect(out2.grade).toBeNull();
  });

  it("letter-only grade keeps gradeNumeric null", () => {
    const out = classroomGradeReturnReducer({
      ...base,
      grade: "B+",
      assignedGrade: null,
    });
    expect(out.action).toBe("apply");
    if (out.action === "apply") {
      expect(out.grade).toBe("B+");
      expect(out.gradeNumeric).toBeNull();
    }
  });

  it("idempotent: same grade after a previous flip → skip 'already_applied'", () => {
    const out = classroomGradeReturnReducer({
      ...base,
      currentLifecycle: "graded",
      currentGrade: "A-",
      currentGradeNumeric: "92.00",
      currentGradedAt: new Date("2026-05-15T17:00:00Z"),
      grade: "A-",
      assignedGrade: 92,
      maxPoints: 100,
    });
    expect(out.action).toBe("skip");
    if (out.action === "skip") expect(out.reason).toBe("already_applied");
  });

  it("re-grade: different grade after a previous flip → apply again", () => {
    const out = classroomGradeReturnReducer({
      ...base,
      currentLifecycle: "graded",
      currentGrade: "B",
      currentGradeNumeric: "85.00",
      currentGradedAt: new Date("2026-05-15T17:00:00Z"),
      grade: "A-",
      assignedGrade: 92,
      maxPoints: 100,
    });
    expect(out.action).toBe("apply");
    if (out.action === "apply") {
      expect(out.grade).toBe("A-");
      expect(out.gradeNumeric).toBe("92.00");
    }
  });

  it("rejects non-finite assignedGrade values defensively (Infinity/NaN → null gradeNumeric)", () => {
    const a = classroomGradeReturnReducer({
      ...base,
      assignedGrade: Number.POSITIVE_INFINITY as any,
    });
    if (a.action === "apply") expect(a.gradeNumeric).toBeNull();
    const b = classroomGradeReturnReducer({
      ...base,
      assignedGrade: Number.NaN as any,
    });
    if (b.action === "apply") expect(b.gradeNumeric).toBeNull();
  });

  it("first-time return from in_progress (kid never tapped Turn-it-in) still applies cleanly", () => {
    // Edge case: Classroom marked it returned even though Reagan didn't
    // mark it turned_in here. We still want to honor the teacher and
    // flip to graded — the teacher is the source of truth.
    const out = classroomGradeReturnReducer({
      ...base,
      currentLifecycle: "in_progress",
      grade: "Pass",
    });
    expect(out.action).toBe("apply");
    if (out.action === "apply") expect(out.toStatus).toBe("graded");
  });
});
