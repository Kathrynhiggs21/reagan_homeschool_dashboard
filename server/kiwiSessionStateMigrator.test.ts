import { describe, it, expect } from "vitest";
import {
  migrateKiwiSessionRaw,
  migrateKiwiSessionAndReExport,
} from "./_lib/kiwiSessionStateMigrator";
import { makeKiwiChatSessionState } from "./_lib/kiwiChatSessionState";
import {
  exportKiwiSessionState,
  importKiwiSessionState,
  KIWI_SESSION_SCHEMA_VERSION,
} from "./_lib/kiwiSessionExportSerializer";

describe("kiwiSessionStateMigrator — forward-compat upgrade path", () => {
  it("null/undefined/empty raw → fresh", () => {
    expect(migrateKiwiSessionRaw(null).migrationPath).toBe("fresh");
    expect(migrateKiwiSessionRaw(undefined).migrationPath).toBe("fresh");
    expect(migrateKiwiSessionRaw("").migrationPath).toBe("fresh");
  });

  it("current envelope → 'current' + round-trips intact", () => {
    const s = makeKiwiChatSessionState();
    s.streak.streakByPanel.today = 2;
    s.rotation.counterByPanel.today = 1;
    const raw = exportKiwiSessionState(s);
    const r = migrateKiwiSessionRaw(raw);
    expect(r.migrationPath).toBe("current");
    expect(r.state).toEqual(s);
  });

  it("bare v0 shape (no schemaVersion) → 'v0_to_v1' + value preserved", () => {
    const bare = JSON.stringify({
      streak: {
        streakByPanel: { today: 2, kiwi: 0 },
        lastEventAtUtcMs: { today: 1779000000000 },
      },
      rotation: {
        counterByPanel: { today: 3 },
      },
    });
    const r = migrateKiwiSessionRaw(bare);
    expect(r.migrationPath).toBe("v0_to_v1");
    expect(r.state.streak.streakByPanel.today).toBe(2);
    expect(r.state.streak.streakByPanel.kiwi).toBe(0);
    expect(r.state.streak.lastEventAtUtcMs.today).toBe(1779000000000);
    expect(r.state.rotation.counterByPanel.today).toBe(3);
  });

  it("bare v0 sanitizes malformed inner values", () => {
    const bare = JSON.stringify({
      streak: {
        streakByPanel: { today: 1, kiwi: "bad" },
        lastEventAtUtcMs: { today: -5 },
      },
      rotation: { counterByPanel: { today: NaN, kiwi: 4 } },
    });
    const r = migrateKiwiSessionRaw(bare);
    expect(r.migrationPath).toBe("v0_to_v1");
    expect(r.state.streak.streakByPanel.today).toBe(1);
    expect(r.state.streak.streakByPanel.kiwi).toBeUndefined();
    expect(r.state.streak.lastEventAtUtcMs.today).toBeUndefined();
    expect(r.state.rotation.counterByPanel.today).toBeUndefined();
    expect(r.state.rotation.counterByPanel.kiwi).toBe(4);
  });

  it("malformed JSON → 'discarded' + fresh state", () => {
    const r = migrateKiwiSessionRaw("{not-json");
    expect(r.migrationPath).toBe("discarded");
    expect(r.state).toEqual(makeKiwiChatSessionState());
  });

  it("unknown future schemaVersion → 'discarded'", () => {
    const future = JSON.stringify({
      schemaVersion: 999,
      state: { streak: {}, rotation: {} },
    });
    const r = migrateKiwiSessionRaw(future);
    expect(r.migrationPath).toBe("discarded");
  });

  it("envelope with non-number schemaVersion AND v0-looking state → 'v0_to_v1'", () => {
    // If schemaVersion is missing/non-number AND looks like v0, treat as v0.
    const weird = JSON.stringify({
      streak: { streakByPanel: { today: 1 } },
      rotation: { counterByPanel: { today: 2 } },
    });
    const r = migrateKiwiSessionRaw(weird);
    expect(r.migrationPath).toBe("v0_to_v1");
    expect(r.state.streak.streakByPanel.today).toBe(1);
  });

  it("primitive JSON (number/array/null) → 'discarded'", () => {
    expect(migrateKiwiSessionRaw("42").migrationPath).toBe("discarded");
    expect(migrateKiwiSessionRaw("[1,2,3]").migrationPath).toBe("discarded");
    expect(migrateKiwiSessionRaw("null").migrationPath).toBe("discarded");
  });

  it("empty object → 'discarded' (no streak / no rotation keys)", () => {
    const r = migrateKiwiSessionRaw("{}");
    expect(r.migrationPath).toBe("discarded");
    expect(r.state).toEqual(makeKiwiChatSessionState());
  });

  it("migrateAndReExport produces a current-version envelope", () => {
    const bare = JSON.stringify({
      streak: { streakByPanel: { today: 5 } },
      rotation: { counterByPanel: { today: 1 } },
    });
    const r = migrateKiwiSessionAndReExport(bare);
    expect(r.migrationPath).toBe("v0_to_v1");
    const parsed = JSON.parse(r.reExported);
    expect(parsed.schemaVersion).toBe(KIWI_SESSION_SCHEMA_VERSION);
    expect(importKiwiSessionState(r.reExported)).toEqual(r.state);
  });

  it("never throws on adversarial input", () => {
    const adversarial = [
      "",
      "a",
      "{",
      "{a:1}",
      JSON.stringify({ schemaVersion: "1", state: 42 }),
      JSON.stringify({ schemaVersion: -1, state: {} }),
      JSON.stringify({ streak: 1 }),
      JSON.stringify({ rotation: "bad" }),
    ];
    for (const r of adversarial) {
      expect(() => migrateKiwiSessionRaw(r)).not.toThrow();
    }
  });

  it("v0_to_v1 result re-exports as current schemaVersion (forward-fixed)", () => {
    const bare = JSON.stringify({
      streak: { streakByPanel: { today: 1 } },
      rotation: { counterByPanel: {} },
    });
    const r = migrateKiwiSessionAndReExport(bare);
    // Re-running migrate on the re-export should be 'current', not 'v0_to_v1'
    const second = migrateKiwiSessionRaw(r.reExported);
    expect(second.migrationPath).toBe("current");
    expect(second.state).toEqual(r.state);
  });

  it("is deterministic — same input → same output", () => {
    const raw = JSON.stringify({
      schemaVersion: KIWI_SESSION_SCHEMA_VERSION,
      state: {
        streak: {
          streakByPanel: { today: 1 },
          lastEventAtUtcMs: {},
        },
        rotation: { counterByPanel: {} },
      },
    });
    expect(migrateKiwiSessionRaw(raw)).toEqual(migrateKiwiSessionRaw(raw));
  });
});
