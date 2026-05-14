import { describe, it, expect } from "vitest";
import { computeSubjectTimeBalanceAlert } from "./_lib/subjectTimeBalanceAlert";

const TARGET = { math: 150, ela: 150, science: 90, "social-studies": 60, specials: 60 } as const;

describe("Push 167 — computeSubjectTimeBalanceAlert", () => {
  it("rejects bad input", () => {
    expect(() => computeSubjectTimeBalanceAlert(null as any)).toThrow();
    expect(() => computeSubjectTimeBalanceAlert({ weekStartISO: "bad", schoolDaysElapsedThisWeek: 0, actualMinByDay: {}, weeklyTargetMin: {} } as any)).toThrow();
  });

  it("emits no notices on day 0", () => {
    const r = computeSubjectTimeBalanceAlert({
      weekStartISO: "2026-05-11",
      schoolDaysElapsedThisWeek: 0,
      actualMinByDay: {},
      weeklyTargetMin: TARGET,
    });
    expect(r.notices.length).toBe(0);
    expect(r.adultLine).toMatch(/balanced/i);
  });

  it("flags missing subject after 3 days untouched", () => {
    const r = computeSubjectTimeBalanceAlert({
      weekStartISO: "2026-05-11",
      schoolDaysElapsedThisWeek: 3,
      actualMinByDay: { math: 90, ela: 90, "social-studies": 30, specials: 30 },
      weeklyTargetMin: TARGET,
    });
    const sci = r.notices.find((n) => n.subject === "science");
    expect(sci?.kind).toBe("missing");
    expect(r.adultLine).toMatch(/Science/);
  });

  it("flags behind subject when actual is low vs proportional", () => {
    const r = computeSubjectTimeBalanceAlert({
      weekStartISO: "2026-05-11",
      schoolDaysElapsedThisWeek: 4,
      actualMinByDay: { math: 30, ela: 120, science: 60, "social-studies": 40, specials: 40 },
      weeklyTargetMin: TARGET,
    });
    const m = r.notices.find((n) => n.subject === "math");
    expect(m?.kind).toBe("behind");
    expect(m?.text).toMatch(/Math/);
  });

  it("flags ahead subject when actual is way over proportional", () => {
    const r = computeSubjectTimeBalanceAlert({
      weekStartISO: "2026-05-11",
      schoolDaysElapsedThisWeek: 2,
      actualMinByDay: { math: 200, ela: 60, science: 30, "social-studies": 20, specials: 20 },
      weeklyTargetMin: TARGET,
    });
    const m = r.notices.find((n) => n.subject === "math");
    expect(m?.kind).toBe("ahead");
  });

  it("does not flag ahead on day 1 (too early)", () => {
    const r = computeSubjectTimeBalanceAlert({
      weekStartISO: "2026-05-11",
      schoolDaysElapsedThisWeek: 1,
      actualMinByDay: { math: 200 },
      weeklyTargetMin: TARGET,
    });
    const m = r.notices.find((n) => n.subject === "math");
    expect(m?.kind).not.toBe("ahead");
  });

  it("does not flag subjects with target < 30 min as behind", () => {
    const r = computeSubjectTimeBalanceAlert({
      weekStartISO: "2026-05-11",
      schoolDaysElapsedThisWeek: 4,
      actualMinByDay: {},
      weeklyTargetMin: { math: 150, ela: 150, science: 90, "social-studies": 20, specials: 20 },
    });
    const ss = r.notices.find((n) => n.subject === "social-studies");
    expect(ss).toBeUndefined();
  });

  it("priority: missing > behind > ahead", () => {
    const r = computeSubjectTimeBalanceAlert({
      weekStartISO: "2026-05-11",
      schoolDaysElapsedThisWeek: 4,
      actualMinByDay: { math: 200, ela: 30 }, // math ahead, ela behind, science missing
      weeklyTargetMin: TARGET,
    });
    expect(r.adultLine).toMatch(/hasn't been touched/);
  });

  it("kid line nudges toward the first missing/behind subject", () => {
    const r = computeSubjectTimeBalanceAlert({
      weekStartISO: "2026-05-11",
      schoolDaysElapsedThisWeek: 4,
      actualMinByDay: { math: 30, ela: 120, science: 60, "social-studies": 40, specials: 40 },
      weeklyTargetMin: TARGET,
    });
    expect(r.kidLine).toMatch(/math/i);
  });

  it("kid line is upbeat when nothing is behind", () => {
    const r = computeSubjectTimeBalanceAlert({
      weekStartISO: "2026-05-11",
      schoolDaysElapsedThisWeek: 4,
      actualMinByDay: { math: 120, ela: 120, science: 70, "social-studies": 50, specials: 50 },
      weeklyTargetMin: TARGET,
    });
    expect(r.kidLine).not.toMatch(/Want to pick/);
  });

  it("returns 5 subject rows in canonical order", () => {
    const r = computeSubjectTimeBalanceAlert({
      weekStartISO: "2026-05-11",
      schoolDaysElapsedThisWeek: 2,
      actualMinByDay: {},
      weeklyTargetMin: TARGET,
    });
    expect(r.subjects.map((s) => s.subject)).toEqual(["math", "ela", "science", "social-studies", "specials"]);
  });

  it("pacingPct caps at 200", () => {
    const r = computeSubjectTimeBalanceAlert({
      weekStartISO: "2026-05-11",
      schoolDaysElapsedThisWeek: 2,
      actualMinByDay: { math: 9999 },
      weeklyTargetMin: TARGET,
    });
    const m = r.subjects.find((s) => s.subject === "math")!;
    expect(m.pacingPct).toBe(200);
  });

  it("pacingPct is 100 when no target (avoids divide-by-zero)", () => {
    const r = computeSubjectTimeBalanceAlert({
      weekStartISO: "2026-05-11",
      schoolDaysElapsedThisWeek: 2,
      actualMinByDay: {},
      weeklyTargetMin: { math: 0, ela: 0, science: 0, "social-studies": 0, specials: 0 },
    });
    expect(r.subjects[0].pacingPct).toBe(100);
    expect(r.notices.length).toBe(0);
  });

  it("full-week math: elapsed=5 with target met yields no notice", () => {
    const r = computeSubjectTimeBalanceAlert({
      weekStartISO: "2026-05-11",
      schoolDaysElapsedThisWeek: 5,
      actualMinByDay: { math: 150, ela: 150, science: 90, "social-studies": 60, specials: 60 },
      weeklyTargetMin: TARGET,
    });
    expect(r.notices.length).toBe(0);
  });
});
