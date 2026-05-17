/**
 * classroomLifecycleTransitions
 *
 * Pure helper that owns the lifecycle state machine for a Classroom
 * assignment. Same enum as the DB column `classroomAssignments.lifecycleStatus`:
 *
 *     to_do  →  in_progress  →  turned_in  →  graded
 *
 * Rules (intentionally lenient — Mom + Grandma get the final say):
 *   • Forward moves through the canonical chain are always legal.
 *   • Skipping forward is legal (e.g. to_do → graded if a kid handed
 *     in paper work and the teacher already wrote a score).
 *   • Backward moves are legal but flagged with `isReopen: true` so the
 *     UI / audit log can render them differently ("Reagan reopened
 *     'Fractions WS'").
 *   • Same-state is a legal no-op (`isNoop: true`) — used for idempotent
 *     retries from the drive-push queue.
 *
 * Returns a structured decision object instead of throwing, so callers
 * (tRPC procedure, drive-push worker) can branch without try/catch.
 */

import type { ClassroomLifecycle } from "./classroomDrivePathPlanner";
export type { ClassroomLifecycle } from "./classroomDrivePathPlanner";

export const ALL_LIFECYCLE_STATES: ClassroomLifecycle[] = [
  "to_do",
  "in_progress",
  "turned_in",
  "graded",
];

const LIFECYCLE_RANK: Record<ClassroomLifecycle, number> = {
  to_do: 0,
  in_progress: 1,
  turned_in: 2,
  graded: 3,
};

export function isLifecycleState(value: unknown): value is ClassroomLifecycle {
  return (
    typeof value === "string" &&
    (ALL_LIFECYCLE_STATES as readonly string[]).includes(value)
  );
}

export type TransitionDecision =
  | {
      ok: true;
      from: ClassroomLifecycle;
      to: ClassroomLifecycle;
      isNoop: boolean;
      isReopen: boolean;
      /** Which timestamp column should be stamped on the assignment row, if any. */
      stampColumn: "startedAt" | "turnedInAt" | "gradedAt" | null;
      /** Compact phrase to render in the audit log + toast. */
      auditVerb: string;
    }
  | {
      ok: false;
      reason: "INVALID_FROM" | "INVALID_TO";
    };

/**
 * Decide what should happen for a (from, to) pair without touching the DB.
 * Mirrors `updateClassroomAssignmentStatus` in `server/db.ts` — keeping
 * the rule set in one pure place lets tests cover every branch quickly.
 */
export function decideTransition(
  from: unknown,
  to: unknown,
): TransitionDecision {
  if (!isLifecycleState(from)) return { ok: false, reason: "INVALID_FROM" };
  if (!isLifecycleState(to)) return { ok: false, reason: "INVALID_TO" };

  const fromRank = LIFECYCLE_RANK[from];
  const toRank = LIFECYCLE_RANK[to];
  const isNoop = from === to;
  const isReopen = !isNoop && toRank < fromRank;

  // Stamp the corresponding timestamp ONLY on a real forward move (not on
  // a no-op retry, not on a reopen — those keep the original stamp so we
  // can see when the assignment first reached that state).
  let stampColumn: "startedAt" | "turnedInAt" | "gradedAt" | null = null;
  if (!isNoop && !isReopen) {
    if (to === "in_progress") stampColumn = "startedAt";
    else if (to === "turned_in") stampColumn = "turnedInAt";
    else if (to === "graded") stampColumn = "gradedAt";
  }

  let auditVerb: string;
  if (isNoop) auditVerb = `Already ${humanLabel(to)}`;
  else if (isReopen) auditVerb = `Reopened to ${humanLabel(to)}`;
  else auditVerb = `Moved to ${humanLabel(to)}`;

  return { ok: true, from, to, isNoop, isReopen, stampColumn, auditVerb };
}

export function humanLabel(state: ClassroomLifecycle): string {
  switch (state) {
    case "to_do":
      return "To Do";
    case "in_progress":
      return "In Progress";
    case "turned_in":
      return "Turned In";
    case "graded":
      return "Graded";
  }
}

/**
 * Compact shape that's safe to insert into `classroomSubmissions`.
 * Keeping this here (rather than in db.ts) means the worker process can
 * reconstruct the same row off a queue entry without reaching into the
 * DB layer.
 */
export type AuditRowDraft = {
  fromStatus: ClassroomLifecycle;
  toStatus: ClassroomLifecycle;
  isReopen: boolean;
  isNoop: boolean;
  verb: string;
  note: string | null;
};

export function buildAuditRowDraft(
  decision: Extract<TransitionDecision, { ok: true }>,
  note: string | null = null,
): AuditRowDraft {
  return {
    fromStatus: decision.from,
    toStatus: decision.to,
    isReopen: decision.isReopen,
    isNoop: decision.isNoop,
    verb: decision.auditVerb,
    note: note && note.trim().length > 0 ? note.trim() : null,
  };
}
