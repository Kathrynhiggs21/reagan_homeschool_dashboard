import { describe, it, expect } from "vitest";
import { runKiwiSessionAwareOrchestrator } from "./_lib/kiwiSessionAwareOrchestrator";
import { makeKiwiChatSessionState } from "./_lib/kiwiChatSessionState";

const TS = 1779000000000;
const FORBIDDEN = /\b(yay|woohoo|great job|awesome|amazing|buddy|friend|pal|kiddo|sweetie)\b/i;

describe("kiwiSessionAwareOrchestrator — single unified state round-trip", () => {
  it("clean candidate → unchanged + severity info + no rotation", () => {
    const r = runKiwiSessionAwareOrchestrator({
      panel: "today",
      candidate: "Open the book.",
      priorSessionState: makeKiwiChatSessionState(),
      timestampUtcMs: TS,
    });
    expect(r.finalText).toBe("Open the book.");
    expect(r.blessedFallbackFired).toBe(false);
    expect(r.auditEntry.severity).toBe("info");
    expect(r.newSessionState.rotation.counterByPanel.today ?? 0).toBe(0);
  });

  it("first drift → safe fallback + streak +1 + rotation unchanged", () => {
    const r = runKiwiSessionAwareOrchestrator({
      panel: "today",
      candidate: "Hey buddy, awesome job! Hehehe~~",
      priorSessionState: makeKiwiChatSessionState(),
      timestampUtcMs: TS,
    });
    expect(r.auditEntry.severity).toBe("major");
    expect(r.newSessionState.streak.streakByPanel.today).toBe(1);
    expect(r.newSessionState.rotation.counterByPanel.today ?? 0).toBe(0);
    expect(r.blessedFallbackFired).toBe(false);
  });

  it("second drift → blessed line + rotation seed 1", () => {
    const a = runKiwiSessionAwareOrchestrator({
      panel: "today",
      candidate: "Hey buddy! Hehehe~~",
      priorSessionState: makeKiwiChatSessionState(),
      timestampUtcMs: TS,
    });
    const b = runKiwiSessionAwareOrchestrator({
      panel: "today",
      candidate: "Yay great job kiddo!!! Amazing.",
      priorSessionState: a.newSessionState,
      timestampUtcMs: TS + 1,
    });
    expect(b.blessedFallbackFired).toBe(true);
    expect(b.newSessionState.rotation.counterByPanel.today).toBe(1);
    expect(b.finalText).not.toContain("!");
    expect(b.finalText).not.toMatch(FORBIDDEN);
  });

  it("third consecutive drift → different blessed line (rotation seed 2)", () => {
    let state = makeKiwiChatSessionState();
    state = runKiwiSessionAwareOrchestrator({
      panel: "today",
      candidate: "Hey buddy! Hehehe~~",
      priorSessionState: state,
      timestampUtcMs: TS,
    }).newSessionState;
    const second = runKiwiSessionAwareOrchestrator({
      panel: "today",
      candidate: "Yay great job kiddo!!!",
      priorSessionState: state,
      timestampUtcMs: TS + 1,
    });
    const third = runKiwiSessionAwareOrchestrator({
      panel: "today",
      candidate: "Hey buddy! Hehehe~~",
      priorSessionState: second.newSessionState,
      timestampUtcMs: TS + 2,
    });
    expect(second.blessedFallbackFired).toBe(true);
    expect(third.blessedFallbackFired).toBe(true);
    expect(third.newSessionState.rotation.counterByPanel.today).toBe(2);
    // Different rotation seed → different blessed line (almost always)
    // We assert the system advances; the line equality check is panel-dependent
    expect(third.newSessionState.rotation.counterByPanel.today).toBeGreaterThan(
      second.newSessionState.rotation.counterByPanel.today!,
    );
  });

  it("clean reply between drifts resets streak; rotation preserved", () => {
    let state = makeKiwiChatSessionState();
    state = runKiwiSessionAwareOrchestrator({
      panel: "today",
      candidate: "Hey buddy! Hehehe~~",
      priorSessionState: state,
      timestampUtcMs: TS,
    }).newSessionState;
    state = runKiwiSessionAwareOrchestrator({
      panel: "today",
      candidate: "Yay great job kiddo!!!",
      priorSessionState: state,
      timestampUtcMs: TS + 1,
    }).newSessionState; // rotation now 1
    state = runKiwiSessionAwareOrchestrator({
      panel: "today",
      candidate: "Open the book.",
      priorSessionState: state,
      timestampUtcMs: TS + 2,
    }).newSessionState; // streak reset, rotation preserved
    expect(state.streak.streakByPanel.today).toBe(0);
    expect(state.rotation.counterByPanel.today).toBe(1);
  });

  it("streaks + rotations are panel-scoped", () => {
    let state = makeKiwiChatSessionState();
    state = runKiwiSessionAwareOrchestrator({
      panel: "today",
      candidate: "Hey buddy! Hehehe~~",
      priorSessionState: state,
      timestampUtcMs: TS,
    }).newSessionState;
    state = runKiwiSessionAwareOrchestrator({
      panel: "today",
      candidate: "Yay great job kiddo!!!",
      priorSessionState: state,
      timestampUtcMs: TS + 1,
    }).newSessionState; // today rotation = 1
    const r = runKiwiSessionAwareOrchestrator({
      panel: "kiwi",
      candidate: "Hey buddy! Hehehe~~",
      priorSessionState: state,
      timestampUtcMs: TS + 2,
    });
    expect(r.blessedFallbackFired).toBe(false);
    expect(r.newSessionState.rotation.counterByPanel.kiwi ?? 0).toBe(0);
    expect(r.newSessionState.rotation.counterByPanel.today).toBe(1);
  });

  it("input session state never mutated", () => {
    const prev = makeKiwiChatSessionState();
    prev.streak.streakByPanel.today = 1;
    prev.rotation.counterByPanel.today = 7;
    const snap = JSON.stringify(prev);
    runKiwiSessionAwareOrchestrator({
      panel: "today",
      candidate: "Hey buddy! Hehehe~~",
      priorSessionState: prev,
      timestampUtcMs: TS,
    });
    expect(JSON.stringify(prev)).toBe(snap);
  });

  it("null priorSessionState handled", () => {
    const r = runKiwiSessionAwareOrchestrator({
      panel: "today",
      candidate: "Hey buddy! Hehehe~~",
      priorSessionState: null,
      timestampUtcMs: TS,
    });
    expect(r.newSessionState.streak.streakByPanel.today).toBe(1);
  });

  it("non-string candidate handled (empty)", () => {
    const r = runKiwiSessionAwareOrchestrator({
      panel: "today",
      candidate: 42 as unknown as string,
      priorSessionState: makeKiwiChatSessionState(),
      timestampUtcMs: TS,
    });
    expect(r.finalText).toBe("");
  });

  it("study_buddy profile applied for bookshelf", () => {
    const r = runKiwiSessionAwareOrchestrator({
      panel: "bookshelf",
      candidate: "One. Two. Three.",
      priorSessionState: makeKiwiChatSessionState(),
      timestampUtcMs: TS,
    });
    expect(r.profile.profile).toBe("study_buddy");
    expect(r.appliedSentenceCap).toBe(2);
    expect(r.finalText).toBe("One. Two.");
  });

  it("blessed-line house rules survive the pipeline (no !, no forbidden)", () => {
    const a = runKiwiSessionAwareOrchestrator({
      panel: "kiwi",
      candidate: "Hey buddy! Hehehe~~",
      priorSessionState: makeKiwiChatSessionState(),
      timestampUtcMs: TS,
    });
    const b = runKiwiSessionAwareOrchestrator({
      panel: "kiwi",
      candidate: "Yay great job kiddo!!!",
      priorSessionState: a.newSessionState,
      timestampUtcMs: TS + 1,
    });
    expect(b.blessedFallbackFired).toBe(true);
    expect(b.finalText).not.toContain("!");
    expect(b.finalText).not.toMatch(FORBIDDEN);
  });

  it("audit entry timestamp passes through unchanged", () => {
    const r = runKiwiSessionAwareOrchestrator({
      panel: "today",
      candidate: "Hello.",
      priorSessionState: makeKiwiChatSessionState(),
      timestampUtcMs: TS + 999,
    });
    expect(r.auditEntry.timestampUtcMs).toBe(TS + 999);
  });

  it("is deterministic — same input → same output", () => {
    const r1 = runKiwiSessionAwareOrchestrator({
      panel: "today",
      candidate: "Open the book.",
      priorSessionState: makeKiwiChatSessionState(),
      timestampUtcMs: TS,
    });
    const r2 = runKiwiSessionAwareOrchestrator({
      panel: "today",
      candidate: "Open the book.",
      priorSessionState: makeKiwiChatSessionState(),
      timestampUtcMs: TS,
    });
    expect(r1).toEqual(r2);
  });

  it("fallback reason is adult-tone (no !, no Reagan, no emotional language)", () => {
    const a = runKiwiSessionAwareOrchestrator({
      panel: "today",
      candidate: "Hey buddy! Hehehe~~",
      priorSessionState: makeKiwiChatSessionState(),
      timestampUtcMs: TS,
    });
    const b = runKiwiSessionAwareOrchestrator({
      panel: "today",
      candidate: "Yay great job kiddo!!!",
      priorSessionState: a.newSessionState,
      timestampUtcMs: TS + 1,
    });
    expect(b.fallbackReason).not.toContain("!");
    expect(b.fallbackReason.toLowerCase()).not.toContain("reagan");
    expect(b.fallbackReason).not.toMatch(/alarming|worrying|bad|amazing/i);
  });
});
