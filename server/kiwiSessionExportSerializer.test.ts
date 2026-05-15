import { describe, it, expect } from "vitest";
import {
  exportKiwiSessionState,
  importKiwiSessionState,
  KIWI_SESSION_SCHEMA_VERSION,
} from "./_lib/kiwiSessionExportSerializer";
import { makeKiwiChatSessionState } from "./_lib/kiwiChatSessionState";

describe("kiwiSessionExportSerializer — versioned localStorage round-trip", () => {
  it("round-trip preserves a populated state", () => {
    const s = makeKiwiChatSessionState();
    s.streak.streakByPanel.today = 2;
    s.streak.lastEventAtUtcMs.today = 1779000000000;
    s.rotation.counterByPanel.today = 3;
    const raw = exportKiwiSessionState(s);
    const back = importKiwiSessionState(raw);
    expect(back).toEqual(s);
  });

  it("export tags envelope with current schema version", () => {
    const raw = exportKiwiSessionState(makeKiwiChatSessionState());
    const parsed = JSON.parse(raw);
    expect(parsed.schemaVersion).toBe(KIWI_SESSION_SCHEMA_VERSION);
  });

  it("import returns fresh empty state on null/undefined/empty", () => {
    expect(importKiwiSessionState(null)).toEqual(makeKiwiChatSessionState());
    expect(importKiwiSessionState(undefined)).toEqual(makeKiwiChatSessionState());
    expect(importKiwiSessionState("")).toEqual(makeKiwiChatSessionState());
  });

  it("import returns fresh empty state on malformed JSON", () => {
    expect(importKiwiSessionState("{not-json")).toEqual(makeKiwiChatSessionState());
    expect(importKiwiSessionState("42")).toEqual(makeKiwiChatSessionState());
    expect(importKiwiSessionState("[1,2,3]")).toEqual(makeKiwiChatSessionState());
  });

  it("import returns empty when schemaVersion is missing or wrong", () => {
    expect(importKiwiSessionState(JSON.stringify({ state: {} }))).toEqual(
      makeKiwiChatSessionState(),
    );
    expect(
      importKiwiSessionState(
        JSON.stringify({ schemaVersion: 999, state: { streak: {} } }),
      ),
    ).toEqual(makeKiwiChatSessionState());
    expect(
      importKiwiSessionState(
        JSON.stringify({ schemaVersion: 0, state: { streak: {} } }),
      ),
    ).toEqual(makeKiwiChatSessionState());
  });

  it("sanitizes malformed inner values rather than crashing", () => {
    const raw = JSON.stringify({
      schemaVersion: KIWI_SESSION_SCHEMA_VERSION,
      state: {
        streak: {
          streakByPanel: {
            today: 2,
            kiwi: "bad",
            bookshelf: -3,
            notebook: NaN,
          },
          lastEventAtUtcMs: { today: 1779000000000, kiwi: "x" },
        },
        rotation: {
          counterByPanel: { today: 5, kiwi: null },
        },
      },
    });
    const back = importKiwiSessionState(raw);
    expect(back.streak.streakByPanel.today).toBe(2);
    expect(back.streak.streakByPanel.kiwi).toBeUndefined();
    expect(back.streak.streakByPanel.bookshelf).toBeUndefined();
    expect(back.streak.streakByPanel.notebook).toBeUndefined();
    expect(back.streak.lastEventAtUtcMs.today).toBe(1779000000000);
    expect(back.streak.lastEventAtUtcMs.kiwi).toBeUndefined();
    expect(back.rotation.counterByPanel.today).toBe(5);
    expect(back.rotation.counterByPanel.kiwi).toBeUndefined();
  });

  it("export handles null/undefined input by emitting empty envelope", () => {
    const fromNull = importKiwiSessionState(exportKiwiSessionState(null));
    expect(fromNull).toEqual(makeKiwiChatSessionState());
    const fromUndefined = importKiwiSessionState(
      exportKiwiSessionState(undefined),
    );
    expect(fromUndefined).toEqual(makeKiwiChatSessionState());
  });

  it("export of cyclic input falls back to empty envelope (does not throw)", () => {
    const cyclic: any = makeKiwiChatSessionState();
    cyclic.self = cyclic;
    const raw = exportKiwiSessionState(cyclic);
    const back = importKiwiSessionState(raw);
    expect(back).toEqual(makeKiwiChatSessionState());
  });

  it("multiple export/import cycles preserve value", () => {
    const s = makeKiwiChatSessionState();
    s.streak.streakByPanel.today = 1;
    s.rotation.counterByPanel.today = 4;
    let raw = exportKiwiSessionState(s);
    let back = importKiwiSessionState(raw);
    raw = exportKiwiSessionState(back);
    back = importKiwiSessionState(raw);
    raw = exportKiwiSessionState(back);
    back = importKiwiSessionState(raw);
    expect(back).toEqual(s);
  });

  it("export does not mutate input state", () => {
    const s = makeKiwiChatSessionState();
    s.streak.streakByPanel.today = 1;
    const snap = JSON.stringify(s);
    exportKiwiSessionState(s);
    expect(JSON.stringify(s)).toBe(snap);
  });

  it("import does not share references with envelope", () => {
    const s = makeKiwiChatSessionState();
    s.streak.streakByPanel.today = 1;
    const raw = exportKiwiSessionState(s);
    const back = importKiwiSessionState(raw);
    back.streak.streakByPanel.today = 99;
    // Original `s` must still be 1
    expect(s.streak.streakByPanel.today).toBe(1);
  });

  it("schemaVersion constant is a positive integer", () => {
    expect(Number.isInteger(KIWI_SESSION_SCHEMA_VERSION)).toBe(true);
    expect(KIWI_SESSION_SCHEMA_VERSION).toBeGreaterThan(0);
  });

  it("is deterministic — same input → same output", () => {
    const s = makeKiwiChatSessionState();
    s.streak.streakByPanel.today = 2;
    s.rotation.counterByPanel.today = 1;
    expect(exportKiwiSessionState(s)).toBe(exportKiwiSessionState(s));
  });
});
