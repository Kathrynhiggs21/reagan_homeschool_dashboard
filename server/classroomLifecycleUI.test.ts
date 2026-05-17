import { describe, it, expect } from "vitest";
import {
  LIFECYCLE_META,
  LIFECYCLE_ORDER,
  nextLabelFor,
  nextLifecycleStep,
  otherLifecycleSteps,
  pickPrimaryTarget,
} from "../shared/classroomLifecycleUI";

describe("shared/classroomLifecycleUI", () => {
  describe("LIFECYCLE_META catalog", () => {
    it("has an entry (label, nextActionLabel, tone, emoji) for every state", () => {
      for (const s of LIFECYCLE_ORDER) {
        const m = LIFECYCLE_META[s];
        expect(m).toBeDefined();
        expect(m.label.length).toBeGreaterThan(0);
        expect(m.nextActionLabel.length).toBeGreaterThan(0);
        expect(m.emoji.length).toBeGreaterThan(0);
        expect(["slate", "amber", "sky", "emerald"]).toContain(m.tone);
      }
    });

    it("uses kid-friendly labels (sanity guard)", () => {
      // We had earlier copy that said "Reagan submitted" / "Teacher graded".
      // Lock the short kid-facing chip labels so a future refactor doesn't
      // silently regress to long sentences.
      expect(LIFECYCLE_META.to_do.label).toBe("To Do");
      expect(LIFECYCLE_META.in_progress.label).toBe("Working");
      expect(LIFECYCLE_META.turned_in.label).toBe("Turned In");
      expect(LIFECYCLE_META.graded.label).toBe("Graded");
    });
  });

  describe("nextLifecycleStep", () => {
    it("walks the canonical forward chain", () => {
      expect(nextLifecycleStep("to_do")).toBe("in_progress");
      expect(nextLifecycleStep("in_progress")).toBe("turned_in");
      expect(nextLifecycleStep("turned_in")).toBe("graded");
    });

    it("returns null on the terminal state (graded)", () => {
      expect(nextLifecycleStep("graded")).toBeNull();
    });

    it("returns null for an unknown value", () => {
      // @ts-expect-error -- exercising runtime guard
      expect(nextLifecycleStep("done")).toBeNull();
    });
  });

  describe("otherLifecycleSteps", () => {
    it("excludes both current and next-step (because primary button already covers next)", () => {
      // Current=to_do, next=in_progress → picker should offer turned_in + graded.
      expect(otherLifecycleSteps("to_do")).toEqual(["turned_in", "graded"]);
    });

    it("for graded (terminal), returns every non-current state in canonical order", () => {
      expect(otherLifecycleSteps("graded")).toEqual([
        "to_do",
        "in_progress",
        "turned_in",
      ]);
    });

    it("for in_progress, returns to_do (back) + graded (skip-forward)", () => {
      expect(otherLifecycleSteps("in_progress")).toEqual(["to_do", "graded"]);
    });
  });

  describe("nextLabelFor", () => {
    it("uses the canonical forward verb when target === next-step", () => {
      // to_do → in_progress is the canonical forward step, label is "Start it!"
      expect(nextLabelFor("to_do", "in_progress")).toBe("Start it!");
      expect(nextLabelFor("in_progress", "turned_in")).toBe("Turn it in");
      expect(nextLabelFor("turned_in", "graded")).toBe("Mark graded");
    });

    it("formats backward moves as 'Reopen to {label}'", () => {
      expect(nextLabelFor("graded", "in_progress")).toBe("Reopen to Working");
      expect(nextLabelFor("turned_in", "to_do")).toBe("Reopen to To Do");
    });

    it("formats forward-skip moves as 'Jump to {label}'", () => {
      expect(nextLabelFor("to_do", "graded")).toBe("Jump to Graded");
      expect(nextLabelFor("to_do", "turned_in")).toBe("Jump to Turned In");
    });

    it("handles the terminal-graded reopen primary verb correctly", () => {
      // For graded, nextLifecycleStep is null, so EVERY other target is
      // either backward or "self". All three other states are backward,
      // so they all should read "Reopen to {label}".
      expect(nextLabelFor("graded", "to_do")).toBe("Reopen to To Do");
      expect(nextLabelFor("graded", "turned_in")).toBe("Reopen to Turned In");
    });
  });

  describe("pickPrimaryTarget", () => {
    it("returns the canonical forward step when one exists", () => {
      // Today/Schedule/Classes all share this rule — the chip's primary
      // button on a to_do assignment must move forward to in_progress.
      expect(pickPrimaryTarget("to_do")).toBe("in_progress");
      expect(pickPrimaryTarget("in_progress")).toBe("turned_in");
      expect(pickPrimaryTarget("turned_in")).toBe("graded");
    });

    it("falls back to to_do when current is terminal (graded)", () => {
      // The chip's primary on a graded assignment is "Reopen" — it sends
      // the assignment all the way back to to_do so the kid sees it on
      // tomorrow's Today page.
      expect(pickPrimaryTarget("graded")).toBe("to_do");
    });
  });
});
