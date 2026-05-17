import { describe, it, expect } from "vitest";
import {
  ALL_LIFECYCLE_STATES,
  buildAuditRowDraft,
  decideTransition,
  humanLabel,
  isLifecycleState,
} from "./_lib/classroomLifecycleTransitions";

describe("classroomLifecycleTransitions", () => {
  describe("isLifecycleState", () => {
    it("accepts every canonical state", () => {
      for (const s of ALL_LIFECYCLE_STATES) {
        expect(isLifecycleState(s)).toBe(true);
      }
    });

    it("rejects garbage", () => {
      expect(isLifecycleState("done")).toBe(false);
      expect(isLifecycleState("")).toBe(false);
      expect(isLifecycleState(null)).toBe(false);
      expect(isLifecycleState(undefined)).toBe(false);
      expect(isLifecycleState(0)).toBe(false);
    });
  });

  describe("decideTransition — happy path", () => {
    it("stamps startedAt on to_do -> in_progress", () => {
      const d = decideTransition("to_do", "in_progress");
      expect(d.ok).toBe(true);
      if (!d.ok) return;
      expect(d.stampColumn).toBe("startedAt");
      expect(d.isNoop).toBe(false);
      expect(d.isReopen).toBe(false);
      expect(d.auditVerb).toBe("Moved to In Progress");
    });

    it("stamps turnedInAt on in_progress -> turned_in", () => {
      const d = decideTransition("in_progress", "turned_in");
      expect(d.ok).toBe(true);
      if (!d.ok) return;
      expect(d.stampColumn).toBe("turnedInAt");
    });

    it("stamps gradedAt on turned_in -> graded", () => {
      const d = decideTransition("turned_in", "graded");
      expect(d.ok).toBe(true);
      if (!d.ok) return;
      expect(d.stampColumn).toBe("gradedAt");
    });

    it("allows skipping forward (to_do -> graded) and stamps gradedAt", () => {
      // Mom hands in paper work that already has a teacher score —
      // bypass the middle states.
      const d = decideTransition("to_do", "graded");
      expect(d.ok).toBe(true);
      if (!d.ok) return;
      expect(d.stampColumn).toBe("gradedAt");
      expect(d.isReopen).toBe(false);
    });
  });

  describe("decideTransition — no-op (idempotent retry)", () => {
    it("flags same-state as no-op without a stamp", () => {
      const d = decideTransition("graded", "graded");
      expect(d.ok).toBe(true);
      if (!d.ok) return;
      expect(d.isNoop).toBe(true);
      expect(d.isReopen).toBe(false);
      expect(d.stampColumn).toBeNull();
      expect(d.auditVerb).toBe("Already Graded");
    });
  });

  describe("decideTransition — reopen (backward)", () => {
    it("flags backward as reopen and does NOT stamp", () => {
      const d = decideTransition("graded", "in_progress");
      expect(d.ok).toBe(true);
      if (!d.ok) return;
      expect(d.isReopen).toBe(true);
      expect(d.isNoop).toBe(false);
      // Important: a reopen must NEVER overwrite the original stamp,
      // because we want to know when she FIRST hit each state.
      expect(d.stampColumn).toBeNull();
      expect(d.auditVerb).toBe("Reopened to In Progress");
    });

    it("flags turned_in -> to_do as reopen", () => {
      const d = decideTransition("turned_in", "to_do");
      expect(d.ok).toBe(true);
      if (!d.ok) return;
      expect(d.isReopen).toBe(true);
      expect(d.stampColumn).toBeNull();
    });
  });

  describe("decideTransition — invalid input", () => {
    it("rejects unknown from-state", () => {
      const d = decideTransition("done", "graded");
      expect(d.ok).toBe(false);
      if (d.ok) return;
      expect(d.reason).toBe("INVALID_FROM");
    });

    it("rejects unknown to-state", () => {
      const d = decideTransition("to_do", "complete");
      expect(d.ok).toBe(false);
      if (d.ok) return;
      expect(d.reason).toBe("INVALID_TO");
    });
  });

  describe("humanLabel", () => {
    it("returns the canonical label for each state", () => {
      expect(humanLabel("to_do")).toBe("To Do");
      expect(humanLabel("in_progress")).toBe("In Progress");
      expect(humanLabel("turned_in")).toBe("Turned In");
      expect(humanLabel("graded")).toBe("Graded");
    });
  });

  describe("buildAuditRowDraft", () => {
    it("produces a row draft mirroring the decision (forward)", () => {
      const d = decideTransition("to_do", "in_progress");
      expect(d.ok).toBe(true);
      if (!d.ok) return;
      const row = buildAuditRowDraft(d, "Reagan started after snack");
      expect(row.fromStatus).toBe("to_do");
      expect(row.toStatus).toBe("in_progress");
      expect(row.isReopen).toBe(false);
      expect(row.isNoop).toBe(false);
      expect(row.note).toBe("Reagan started after snack");
      expect(row.verb).toBe("Moved to In Progress");
    });

    it("trims whitespace-only notes down to null", () => {
      const d = decideTransition("turned_in", "graded");
      expect(d.ok).toBe(true);
      if (!d.ok) return;
      expect(buildAuditRowDraft(d, "   ").note).toBeNull();
      expect(buildAuditRowDraft(d, null).note).toBeNull();
      expect(buildAuditRowDraft(d).note).toBeNull();
    });

    it("preserves the reopen flag for backward moves", () => {
      const d = decideTransition("graded", "to_do");
      expect(d.ok).toBe(true);
      if (!d.ok) return;
      const row = buildAuditRowDraft(d);
      expect(row.isReopen).toBe(true);
      expect(row.verb).toBe("Reopened to To Do");
    });
  });
});
