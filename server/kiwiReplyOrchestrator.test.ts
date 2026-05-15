import { describe, it, expect } from "vitest";
import { runKiwiReplyOrchestrator } from "./_lib/kiwiReplyOrchestrator";
import { makeKiwiDriftStreakState } from "./_lib/kiwiDriftStreakTracker";

const TS = 1779000000000;
const FORBIDDEN = /\b(yay|woohoo|great job|awesome|amazing|buddy|friend|pal|kiddo|sweetie)\b/i;

describe("kiwiReplyOrchestrator — top-level chat UI entry point", () => {
  it("clean candidate → returns candidate unchanged, info severity, no blessed", () => {
    const r = runKiwiReplyOrchestrator({
      panel: "today",
      candidate: "Open the book to page 47.",
      priorStreakState: makeKiwiDriftStreakState(),
      timestampUtcMs: TS,
      rotationSeed: 0,
    });
    expect(r.finalText).toBe("Open the book to page 47.");
    expect(r.blessedFallbackFired).toBe(false);
    expect(r.auditEntry.severity).toBe("info");
    expect(r.fallbackReason).toBe("");
  });

  it("drift-flagged candidate → uses safe fallback, severity major, streak +1", () => {
    const r = runKiwiReplyOrchestrator({
      panel: "today",
      candidate: "Hey buddy, awesome job! Hehehe~~",
      priorStreakState: makeKiwiDriftStreakState(),
      timestampUtcMs: TS,
      rotationSeed: 0,
    });
    expect(r.auditEntry.severity).toBe("major");
    expect(r.newStreakState.streakByPanel.today).toBe(1);
    expect(r.blessedFallbackFired).toBe(false); // streak just 1
  });

  it("second consecutive drift → blessed fallback fires, streak 2", () => {
    const first = runKiwiReplyOrchestrator({
      panel: "today",
      candidate: "Hey buddy, awesome job! Hehehe~~",
      priorStreakState: makeKiwiDriftStreakState(),
      timestampUtcMs: TS,
      rotationSeed: 0,
    });
    const second = runKiwiReplyOrchestrator({
      panel: "today",
      candidate: "Yay great job kiddo!!! Amazing.",
      priorStreakState: first.newStreakState,
      timestampUtcMs: TS + 1,
      rotationSeed: 0,
    });
    expect(second.blessedFallbackFired).toBe(true);
    expect(second.newStreakState.streakByPanel.today).toBe(2);
    expect(second.fallbackReason).toContain("today");
    // Blessed line must still pass house rules
    expect(second.finalText).not.toMatch(FORBIDDEN);
    expect(second.finalText).not.toContain("!");
  });

  it("a clean reply between two drifts resets the streak", () => {
    const a = runKiwiReplyOrchestrator({
      panel: "today",
      candidate: "Hey buddy, awesome job! Hehehe~~",
      priorStreakState: makeKiwiDriftStreakState(),
      timestampUtcMs: TS,
      rotationSeed: 0,
    });
    const b = runKiwiReplyOrchestrator({
      panel: "today",
      candidate: "Open the book.",
      priorStreakState: a.newStreakState,
      timestampUtcMs: TS + 1,
      rotationSeed: 0,
    });
    expect(b.newStreakState.streakByPanel.today).toBe(0);
    const c = runKiwiReplyOrchestrator({
      panel: "today",
      candidate: "Hey buddy, awesome job! Hehehe~~",
      priorStreakState: b.newStreakState,
      timestampUtcMs: TS + 2,
      rotationSeed: 0,
    });
    expect(c.blessedFallbackFired).toBe(false);
    expect(c.newStreakState.streakByPanel.today).toBe(1);
  });

  it("streaks are panel-scoped — today drift × 1 + kiwi drift × 1 → no fallback", () => {
    const a = runKiwiReplyOrchestrator({
      panel: "today",
      candidate: "Hey buddy, awesome job! Hehehe~~",
      priorStreakState: makeKiwiDriftStreakState(),
      timestampUtcMs: TS,
      rotationSeed: 0,
    });
    const b = runKiwiReplyOrchestrator({
      panel: "kiwi",
      candidate: "Hey buddy, awesome job! Hehehe~~",
      priorStreakState: a.newStreakState,
      timestampUtcMs: TS + 1,
      rotationSeed: 0,
    });
    expect(b.blessedFallbackFired).toBe(false);
  });

  it("resolves study_buddy profile + tighter cap for bookshelf", () => {
    const r = runKiwiReplyOrchestrator({
      panel: "bookshelf",
      candidate: "One. Two. Three.",
      priorStreakState: makeKiwiDriftStreakState(),
      timestampUtcMs: TS,
      rotationSeed: 0,
    });
    expect(r.profile.profile).toBe("study_buddy");
    expect(r.appliedSentenceCap).toBe(2);
    expect(r.finalText).toBe("One. Two.");
    expect(r.auditEntry.severity).toBe("minor");
  });

  it("resolves neutral_calm profile for feeling panel", () => {
    const r = runKiwiReplyOrchestrator({
      panel: "feeling",
      candidate: "I'm here. Tell me.",
      priorStreakState: makeKiwiDriftStreakState(),
      timestampUtcMs: TS,
      rotationSeed: 0,
    });
    expect(r.profile.profile).toBe("neutral_calm");
    expect(r.appliedSentenceCap).toBe(2);
  });

  it("audit entry timestamp matches input timestamp", () => {
    const r = runKiwiReplyOrchestrator({
      panel: "today",
      candidate: "Hello.",
      priorStreakState: makeKiwiDriftStreakState(),
      timestampUtcMs: TS + 999,
      rotationSeed: 0,
    });
    expect(r.auditEntry.timestampUtcMs).toBe(TS + 999);
  });

  it("null priorStreakState handled — starts from empty", () => {
    const r = runKiwiReplyOrchestrator({
      panel: "today",
      candidate: "Hey buddy, awesome job! Hehehe~~",
      priorStreakState: null,
      timestampUtcMs: TS,
      rotationSeed: 0,
    });
    expect(r.newStreakState.streakByPanel.today).toBe(1);
  });

  it("non-string candidate handled (coerces to empty)", () => {
    const r = runKiwiReplyOrchestrator({
      panel: "today",
      candidate: 42 as unknown as string,
      priorStreakState: makeKiwiDriftStreakState(),
      timestampUtcMs: TS,
      rotationSeed: 0,
    });
    expect(r.finalText).toBe("");
  });

  it("blessed-line finalText obeys no-exclamation house rule", () => {
    const a = runKiwiReplyOrchestrator({
      panel: "today",
      candidate: "Hey buddy! Hehehe~~",
      priorStreakState: makeKiwiDriftStreakState(),
      timestampUtcMs: TS,
      rotationSeed: 0,
    });
    const b = runKiwiReplyOrchestrator({
      panel: "today",
      candidate: "Yay great job kiddo!!!",
      priorStreakState: a.newStreakState,
      timestampUtcMs: TS + 1,
      rotationSeed: 2,
    });
    expect(b.finalText).not.toContain("!");
    expect(b.blessedFallbackFired).toBe(true);
  });

  it("is deterministic — same input → same output", () => {
    const r1 = runKiwiReplyOrchestrator({
      panel: "today",
      candidate: "Open the book.",
      priorStreakState: makeKiwiDriftStreakState(),
      timestampUtcMs: TS,
      rotationSeed: 5,
    });
    const r2 = runKiwiReplyOrchestrator({
      panel: "today",
      candidate: "Open the book.",
      priorStreakState: makeKiwiDriftStreakState(),
      timestampUtcMs: TS,
      rotationSeed: 5,
    });
    expect(r1).toEqual(r2);
  });

  it("prior state is not mutated", () => {
    const prior = makeKiwiDriftStreakState();
    prior.streakByPanel.today = 1;
    const snapshot = JSON.stringify(prior);
    runKiwiReplyOrchestrator({
      panel: "today",
      candidate: "Hey buddy, awesome job! Hehehe~~",
      priorStreakState: prior,
      timestampUtcMs: TS,
      rotationSeed: 0,
    });
    expect(JSON.stringify(prior)).toBe(snapshot);
  });

  it("blessed audit entry severity stays major (the fallback fired)", () => {
    const a = runKiwiReplyOrchestrator({
      panel: "today",
      candidate: "Hey buddy! Hehehe~~",
      priorStreakState: makeKiwiDriftStreakState(),
      timestampUtcMs: TS,
      rotationSeed: 0,
    });
    const b = runKiwiReplyOrchestrator({
      panel: "today",
      candidate: "Yay great job kiddo!!!",
      priorStreakState: a.newStreakState,
      timestampUtcMs: TS + 1,
      rotationSeed: 2,
    });
    expect(b.blessedFallbackFired).toBe(true);
    expect(b.auditEntry.severity).toBe("major");
  });
});
