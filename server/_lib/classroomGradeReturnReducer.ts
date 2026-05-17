/**
 * classroomGradeReturnReducer.ts
 *
 * Pure decision helper for "the teacher just returned graded work in
 * Google Classroom — what should our DB do about it?"
 *
 * This is intentionally separated from the DB write path so we can:
 *  - unit-test every branch without touching MySQL
 *  - re-use it from a future scheduled sync job AND from a manual
 *    Mom-side "apply this grade" button
 *  - make the post-OAuth wiring trivial: turn a Classroom payload
 *    into a structured directive with no surprises
 *
 * Inputs intentionally accept "nothing came back from Classroom yet"
 * (returnedAt = null, grade = null), so a sync job can call us with
 * raw Classroom rows without prefiltering.
 *
 * Decision rules:
 *  - If `returnedAt` is null  → action="skip", reason="not_returned_yet".
 *    This covers the entire pre-OAuth state plus any in-flight work.
 *  - If lifecycle is already "graded" AND nothing material has changed
 *    (same grade text + same gradeNumeric + already-stamped gradedAt)
 *    → action="skip", reason="already_applied" (idempotent).
 *  - If `returnedAt` is set and grade info has changed (or we've never
 *    flipped to graded) → action="apply" with normalized grade fields
 *    and a `note` pre-built so updateClassroomAssignmentStatus has
 *    everything it needs to write the audit row.
 *
 * Grade normalization:
 *  - `grade` is the human-readable string the teacher sees (e.g. "A-",
 *    "92/100", "Pass"). Trimmed; empty becomes null.
 *  - `gradeNumeric` is the canonical decimal-as-string the DB stores.
 *    If Classroom only gave us `assignedGrade: 92` and `maxPoints: 100`,
 *    we compute "92.00" (two decimals, fixed). If only a letter/string
 *    grade is present, gradeNumeric is null.
 *  - If both inputs are missing entirely we still apply the lifecycle
 *    flip with grade=null/gradeNumeric=null — the teacher returned the
 *    work without a numeric grade, which IS valid (e.g. "Reviewed").
 */

export type ClassroomGradeReturnInput = {
  /** Current lifecycle state of the assignment in our DB. */
  currentLifecycle: "to_do" | "in_progress" | "turned_in" | "graded";
  /** Already-applied grade fields (whatever we last wrote). */
  currentGrade?: string | null;
  currentGradeNumeric?: string | null;
  /** Timestamp we last flipped to graded, if any. */
  currentGradedAt?: Date | null;
  /** Raw "returned to student" timestamp from Classroom (null if not yet). */
  returnedAt: Date | null;
  /** Human grade text, e.g. "A-", "Pass". */
  grade?: string | null;
  /** Numeric grade (if Classroom returned one). */
  assignedGrade?: number | null;
  /** Max points (if Classroom configured one). Used only for nicer text. */
  maxPoints?: number | null;
};

export type ClassroomGradeReturnDecision =
  | { action: "skip"; reason: "not_returned_yet" | "already_applied" }
  | {
      action: "apply";
      toStatus: "graded";
      grade: string | null;
      gradeNumeric: string | null;
      note: string;
    };

function normalizeGradeText(g: string | null | undefined): string | null {
  if (g === null || g === undefined) return null;
  const t = String(g).trim();
  return t.length === 0 ? null : t;
}

function deriveGradeNumeric(
  assignedGrade: number | null | undefined,
): string | null {
  if (assignedGrade === null || assignedGrade === undefined) return null;
  if (typeof assignedGrade !== "number" || !Number.isFinite(assignedGrade)) {
    return null;
  }
  // Two-decimal canonical form so equality comparisons in the DB are stable.
  return assignedGrade.toFixed(2);
}

function buildNote(input: ClassroomGradeReturnInput, grade: string | null) {
  const parts: string[] = [];
  parts.push("Classroom returned");
  if (grade) parts.push(`grade=${grade}`);
  if (
    typeof input.assignedGrade === "number" &&
    typeof input.maxPoints === "number" &&
    input.maxPoints > 0
  ) {
    parts.push(`(${input.assignedGrade}/${input.maxPoints})`);
  }
  if (input.returnedAt) {
    parts.push(`@ ${input.returnedAt.toISOString()}`);
  }
  return parts.join(" ");
}

export function classroomGradeReturnReducer(
  input: ClassroomGradeReturnInput,
): ClassroomGradeReturnDecision {
  // 1. Nothing came back from Classroom yet — no-op.
  if (!input.returnedAt) {
    return { action: "skip", reason: "not_returned_yet" };
  }

  const newGrade = normalizeGradeText(input.grade);
  const newGradeNumeric = deriveGradeNumeric(input.assignedGrade ?? null);

  // 2. Idempotency: only skip if we ALREADY flipped to graded with the
  //    exact same grade text + gradeNumeric we'd write today.
  if (
    input.currentLifecycle === "graded" &&
    input.currentGradedAt &&
    (input.currentGrade ?? null) === newGrade &&
    (input.currentGradeNumeric ?? null) === newGradeNumeric
  ) {
    return { action: "skip", reason: "already_applied" };
  }

  // 3. Otherwise apply — flip to "graded" with normalized fields.
  return {
    action: "apply",
    toStatus: "graded",
    grade: newGrade,
    gradeNumeric: newGradeNumeric,
    note: buildNote(input, newGrade),
  };
}
