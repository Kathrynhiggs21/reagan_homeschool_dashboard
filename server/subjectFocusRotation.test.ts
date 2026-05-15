import { describe, it, expect } from "vitest";
import { decideSubjectFocus } from "./_lib/subjectFocusRotation";

describe("subjectFocusRotation — house rules", () => {
  it("returns weekend_light on Saturday with calm kidLine + no required focus", () => {
    // 2026-05-16 is a Saturday
    const r = decideSubjectFocus({ isoDate: "2026-05-16" });
    expect(r.weekendLight).toBe(true);
    expect(r.reason).toBe("weekend_light");
    expect(r.focusSubject).toBe("Choice");
    expect(r.kidLine).toMatch(/weekend/i);
    expect(r.kidLine.toLowerCase()).not.toMatch(/buddy|friend|yay|woohoo/);
    expect(r.adultLine.toLowerCase()).not.toMatch(/buddy|friend|yay|woohoo/);
  });

  it("returns weekend_light on Sunday", () => {
    const r = decideSubjectFocus({ isoDate: "2026-05-17" });
    expect(r.weekendLight).toBe(true);
    expect(r.focusSubject).toBe("Choice");
  });

  it("falls back to day_default when no history is provided (Monday → Math)", () => {
    const r = decideSubjectFocus({ isoDate: "2026-05-18" });
    expect(r.weekendLight).toBe(false);
    expect(r.reason).toBe("history_empty");
    expect(r.focusSubject).toBe("Math");
    expect(r.alternates.length).toBe(2);
    expect(r.alternates).not.toContain("Math");
  });

  it("uses day default when day_default subject is among least-done", () => {
    const r = decideSubjectFocus({
      isoDate: "2026-05-19", // Tuesday → Reading default
      recentHistory: [{ isoDate: "2026-05-18", subject: "Math" }],
    });
    expect(r.reason).toBe("day_default");
    expect(r.focusSubject).toBe("Reading");
  });

  it("switches to rotation_balance when day default is overrepresented", () => {
    const r = decideSubjectFocus({
      isoDate: "2026-05-25", // Monday default = Math
      recentHistory: [
        { isoDate: "2026-05-22", subject: "Math" },
        { isoDate: "2026-05-21", subject: "Math" },
        { isoDate: "2026-05-20", subject: "Math" },
        { isoDate: "2026-05-19", subject: "Math" },
        { isoDate: "2026-05-18", subject: "Math" },
      ],
    });
    expect(r.reason).toBe("rotation_balance");
    expect(r.focusSubject).not.toBe("Math");
    expect(r.adultLine.toLowerCase()).toContain("behind");
  });

  it("never returns a subject outside the pool", () => {
    const r = decideSubjectFocus({
      isoDate: "2026-05-18",
      recentHistory: [{ isoDate: "2026-05-17", subject: "UnknownSubject" }],
    });
    expect([
      "Math",
      "Reading",
      "Science",
      "Writing",
      "Social Studies",
    ]).toContain(r.focusSubject);
  });

  it("honors a custom availableSubjects override", () => {
    const r = decideSubjectFocus({
      isoDate: "2026-05-18",
      availableSubjects: ["Birding", "Swimming", "Plants"],
    });
    expect(["Birding", "Swimming", "Plants"]).toContain(r.focusSubject);
    expect(r.alternates.length).toBe(2);
  });

  it("alternates never include the chosen focus", () => {
    const r = decideSubjectFocus({ isoDate: "2026-05-20" });
    expect(r.alternates).not.toContain(r.focusSubject);
  });

  it("is deterministic — same input twice → same output", () => {
    const args = {
      isoDate: "2026-05-21",
      recentHistory: [
        { isoDate: "2026-05-20", subject: "Science" },
        { isoDate: "2026-05-19", subject: "Reading" },
      ],
    };
    const a = decideSubjectFocus(args);
    const b = decideSubjectFocus(args);
    expect(a).toEqual(b);
  });

  it("handles unsorted history (defensive sort)", () => {
    const r1 = decideSubjectFocus({
      isoDate: "2026-05-25",
      recentHistory: [
        { isoDate: "2026-05-22", subject: "Math" },
        { isoDate: "2026-05-21", subject: "Math" },
        { isoDate: "2026-05-20", subject: "Math" },
        { isoDate: "2026-05-19", subject: "Math" },
        { isoDate: "2026-05-18", subject: "Math" },
      ],
    });
    const r2 = decideSubjectFocus({
      isoDate: "2026-05-25",
      recentHistory: [
        { isoDate: "2026-05-18", subject: "Math" },
        { isoDate: "2026-05-19", subject: "Math" },
        { isoDate: "2026-05-22", subject: "Math" },
        { isoDate: "2026-05-20", subject: "Math" },
        { isoDate: "2026-05-21", subject: "Math" },
      ],
    });
    expect(r1).toEqual(r2);
  });

  it("kidLine and adultLine never contain forbidden voice words", () => {
    const forbidden = /buddy|friend|yay|woohoo|great job|awesome/i;
    const cases = [
      decideSubjectFocus({ isoDate: "2026-05-16" }),
      decideSubjectFocus({ isoDate: "2026-05-17" }),
      decideSubjectFocus({ isoDate: "2026-05-18" }),
      decideSubjectFocus({
        isoDate: "2026-05-25",
        recentHistory: [
          { isoDate: "2026-05-22", subject: "Math" },
          { isoDate: "2026-05-21", subject: "Math" },
          { isoDate: "2026-05-20", subject: "Math" },
          { isoDate: "2026-05-19", subject: "Math" },
          { isoDate: "2026-05-18", subject: "Math" },
        ],
      }),
    ];
    for (const r of cases) {
      expect(r.kidLine).not.toMatch(forbidden);
      expect(r.adultLine).not.toMatch(forbidden);
    }
  });

  it("history_empty branch yields exactly 2 alternates and excludes focus", () => {
    const r = decideSubjectFocus({ isoDate: "2026-05-21" }); // Thu → Writing
    expect(r.reason).toBe("history_empty");
    expect(r.focusSubject).toBe("Writing");
    expect(r.alternates.length).toBe(2);
    expect(r.alternates).not.toContain("Writing");
  });

  it("malformed isoDate falls back gracefully (no throw)", () => {
    const r = decideSubjectFocus({ isoDate: "not-a-date" });
    expect(r.focusSubject).toBeTruthy();
    expect(r.kidLine).toBeTruthy();
  });

  it("focusSubject is never empty", () => {
    const days = [
      "2026-05-16",
      "2026-05-17",
      "2026-05-18",
      "2026-05-19",
      "2026-05-20",
      "2026-05-21",
      "2026-05-22",
    ];
    for (const d of days) {
      const r = decideSubjectFocus({ isoDate: d });
      expect(typeof r.focusSubject).toBe("string");
      expect(r.focusSubject.length).toBeGreaterThan(0);
    }
  });

  it("rotation considers only the most recent 7 history entries", () => {
    const r = decideSubjectFocus({
      isoDate: "2026-05-25",
      recentHistory: [
        { isoDate: "2026-05-22", subject: "Math" },
        { isoDate: "2026-05-21", subject: "Math" },
        { isoDate: "2026-05-20", subject: "Math" },
        { isoDate: "2026-05-19", subject: "Math" },
        { isoDate: "2026-05-18", subject: "Math" },
        { isoDate: "2026-05-15", subject: "Math" },
        { isoDate: "2026-05-14", subject: "Math" },
        { isoDate: "2026-05-13", subject: "Reading" }, // oldest, ignored
      ],
    });
    expect(r.reason).toBe("rotation_balance");
    expect(r.focusSubject).not.toBe("Math");
  });

  it("weekendLight=false for all Mon-Fri ISO dates", () => {
    const weekdays = [
      "2026-05-18",
      "2026-05-19",
      "2026-05-20",
      "2026-05-21",
      "2026-05-22",
    ];
    for (const d of weekdays) {
      const r = decideSubjectFocus({ isoDate: d });
      expect(r.weekendLight).toBe(false);
    }
  });
});
