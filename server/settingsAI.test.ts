/**
 * settingsAI.test.ts — exercise the validator/normalizer in _lib/settingsAI
 * without hitting Gemini. The applier lives inline in routers.ts (it's just
 * fan-out to prefs.set / tutors.upsert), so we only need to lock in the
 * shape and security guarantees the validator promises.
 */
import { describe, it, expect } from "vitest";
import { validateSettingsAIPlan, SETTINGS_AI_PREFS_ALLOW, type SettingsAIContext } from "./_lib/settingsAI";

const ctx: SettingsAIContext = {
  reagan: { name: "Reagan", gradeLevel: "5th Grade" },
  tutors: [
    { id: 1, name: "Mom", role: "primary", subjects: "all", active: true },
    { id: 2, name: "Hira", role: "math", subjects: "math", active: true },
  ],
  prefs: {
    "ui.theme": "starry-chalkboard",
    "kiwi.voice": "Leda",
    "kiwi.silent": "0",
  },
  voicePresets: ["Leda", "Aoede", "Sadachbia", "Kore"],
  themes: ["starry-chalkboard", "cream-homeschool", "chalkboard-night", "notebook-doodle"],
};

describe("validateSettingsAIPlan", () => {
  it("keeps allowlisted prefs.set ops and drops unknown keys", () => {
    const out = validateSettingsAIPlan(
      {
        summary: "Switch theme & enable wake word",
        ops: [
          { kind: "prefs.set", key: "ui.theme", value: "cream-homeschool" },
          { kind: "prefs.set", key: "kiwi.wakeWord", value: "1" },
          { kind: "prefs.set", key: "totally.bogus", value: "x" } as any,
        ],
        warnings: [],
      },
      ctx,
    );
    const keys = out.ops
      .filter(o => o.kind === "prefs.set")
      .map(o => (o as any).key)
      .sort();
    expect(keys).toEqual(["kiwi.wakeWord", "ui.theme"]);
    expect(out.warnings.some(w => /totally\.bogus/.test(w))).toBe(true);
  });

  it("rejects unknown theme and unknown voice values", () => {
    const out = validateSettingsAIPlan(
      {
        summary: "Try unknowns",
        ops: [
          { kind: "prefs.set", key: "ui.theme", value: "vaporwave" },
          { kind: "prefs.set", key: "kiwi.voice", value: "RobotMcRobot" },
        ],
        warnings: [],
      },
      ctx,
    );
    expect(out.ops.length).toBe(0);
    expect(out.warnings.length).toBe(2);
  });

  it("normalizes tutor.upsert (trims name, drops nameless entries) and keeps ask: ops", () => {
    const out = validateSettingsAIPlan(
      {
        summary: "Tutor changes",
        ops: [
          { kind: "tutor.upsert", name: "  Grandma  ", role: "science", active: true },
          { kind: "tutor.upsert" } as any, // no name → dropped
          { kind: "ask", question: "Which day for Grandma?" },
          { kind: "reagan.note", text: "  Reagan tired today  " },
        ],
        warnings: [],
      },
      ctx,
    );
    const tutor = out.ops.find(o => o.kind === "tutor.upsert") as any;
    expect(tutor?.name).toBe("Grandma");
    const ask = out.ops.find(o => o.kind === "ask") as any;
    expect(ask?.question).toMatch(/Grandma/);
    const note = out.ops.find(o => o.kind === "reagan.note") as any;
    expect(note?.text).toBe("Reagan tired today");
    // 3 valid ops (tutor + ask + note); the empty tutor was dropped
    expect(out.ops.length).toBe(3);
  });

  it("returns an empty plan unchanged when there are no ops", () => {
    const out = validateSettingsAIPlan({ summary: "Nothing to do.", ops: [], warnings: [] }, ctx);
    expect(out.summary).toBe("Nothing to do.");
    expect(out.ops).toEqual([]);
  });
});

describe("SETTINGS_AI_PREFS_ALLOW guards", () => {
  it("includes the keys the SettingsAIHelperCard relies on", () => {
    for (const k of ["ui.theme", "kiwi.voice", "kiwi.silent", "kiwi.wakeWord", "notifications.evening8pm"]) {
      expect(SETTINGS_AI_PREFS_ALLOW).toContain(k);
    }
  });
});
