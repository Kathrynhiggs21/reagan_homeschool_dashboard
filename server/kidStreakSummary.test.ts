import { describe, it, expect } from "vitest";
import { computeKidStreaks } from "./_lib/kidStreakSummary";

// Mon 2026-05-11 .. Fri 2026-05-15
const MON = "2026-05-11";
const TUE = "2026-05-12";
const WED = "2026-05-13";
const THU = "2026-05-14";
const FRI = "2026-05-15";

describe("Push 169 — computeKidStreaks", () => {
  it("rejects bad input", () => {
    expect(() => computeKidStreaks(null as any)).toThrow();
    expect(() => computeKidStreaks({ todayISO: "bad", dailyByDate: {} } as any)).toThrow();
  });

  it("returns no streak when there's no history", () => {
    const r = computeKidStreaks({ todayISO: FRI, dailyByDate: {} });
    expect(r.headlineLine).toMatch(/Welcome back/i);
    r.perSubject.forEach((s) => expect(s.daysInARow).toBe(0));
  });

  it("counts a 1-day streak for today only", () => {
    const r = computeKidStreaks({
      todayISO: FRI,
      dailyByDate: { [FRI]: { math: 30 } },
    });
    const m = r.perSubject.find((s) => s.subject === "math")!;
    expect(m.daysInARow).toBe(1);
    expect(m.kidLine).toMatch(/today/i);
  });

  it("counts 3 in a row", () => {
    const r = computeKidStreaks({
      todayISO: FRI,
      dailyByDate: {
        [WED]: { math: 30 },
        [THU]: { math: 30 },
        [FRI]: { math: 30 },
      },
    });
    const m = r.perSubject.find((s) => s.subject === "math")!;
    expect(m.daysInARow).toBe(3);
    expect(m.kidLine).toMatch(/3 days in a row/i);
  });

  it("does not break the streak across the weekend", () => {
    // last Mon-Fri 5/4..5/8, then this week 5/11..5/15
    const PREV_FRI = "2026-05-08";
    const r = computeKidStreaks({
      todayISO: MON,
      dailyByDate: {
        [PREV_FRI]: { math: 30 },
        [MON]: { math: 30 },
      },
    });
    const m = r.perSubject.find((s) => s.subject === "math")!;
    expect(m.daysInARow).toBe(2);
  });

  it("first-day-back fires when today has work but prev school day did not + history >= 7d ago", () => {
    const TWO_WEEKS_AGO = "2026-05-01"; // Friday
    const r = computeKidStreaks({
      todayISO: FRI,
      dailyByDate: {
        [TWO_WEEKS_AGO]: { science: 30 },
        [FRI]: { science: 30 },
      },
    });
    const s = r.perSubject.find((x) => x.subject === "science")!;
    expect(s.isFirstDayBack).toBe(true);
    expect(s.kidLine).toMatch(/first day back/i);
  });

  it("never uses kid-unfriendly words like 'broken' or 'lost'", () => {
    const r = computeKidStreaks({
      todayISO: FRI,
      dailyByDate: { [WED]: { math: 30 }, [FRI]: { math: 30 } },
    });
    expect(r.headlineLine).not.toMatch(/broken|lost|failed|missed/i);
    r.perSubject.forEach((s) => expect(s.kidLine).not.toMatch(/broken|lost|failed|missed/i));
  });

  it("headline picks the longest streak", () => {
    const r = computeKidStreaks({
      todayISO: FRI,
      dailyByDate: {
        [WED]: { math: 30, ela: 30 },
        [THU]: { math: 30, ela: 30 },
        [FRI]: { math: 30, ela: 30, science: 30 },
      },
    });
    expect(r.headlineLine).toMatch(/3 days in a row/i);
  });

  it("first-day-back only fires when streak is exactly 1 today", () => {
    const r = computeKidStreaks({
      todayISO: FRI,
      dailyByDate: {
        [WED]: { math: 30 },
        [THU]: { math: 30 },
        [FRI]: { math: 30 },
      },
    });
    const m = r.perSubject.find((s) => s.subject === "math")!;
    expect(m.isFirstDayBack).toBe(false);
  });

  it("returns 5 canonical subjects in order by default", () => {
    const r = computeKidStreaks({ todayISO: FRI, dailyByDate: {} });
    expect(r.perSubject.map((s) => s.subject)).toEqual([
      "math",
      "ela",
      "science",
      "social-studies",
      "specials",
    ]);
  });

  it("respects explicit subject list", () => {
    const r = computeKidStreaks({
      todayISO: FRI,
      dailyByDate: {},
      subjects: ["math", "science"],
    });
    expect(r.perSubject.map((s) => s.subject)).toEqual(["math", "science"]);
  });

  it("clamps lookbackDays to safe range", () => {
    const r = computeKidStreaks({ todayISO: FRI, lookbackDays: 999, dailyByDate: {} });
    expect(r.lookbackDays).toBe(60);
    const r2 = computeKidStreaks({ todayISO: FRI, lookbackDays: 0, dailyByDate: {} });
    expect(r2.lookbackDays).toBe(1);
  });

  it("counts >= 1 minute as 'did the subject'", () => {
    const r = computeKidStreaks({
      todayISO: FRI,
      dailyByDate: { [FRI]: { math: 1 } },
    });
    expect(r.perSubject.find((s) => s.subject === "math")!.daysInARow).toBe(1);
  });

  it("kid line scales: 5+ days in a row uses richer language", () => {
    const days = ["2026-05-04", "2026-05-05", "2026-05-06", "2026-05-07", "2026-05-08", MON, TUE, WED, THU, FRI];
    const dailyByDate: Record<string, any> = {};
    days.forEach((d) => (dailyByDate[d] = { math: 30 }));
    const r = computeKidStreaks({ todayISO: FRI, dailyByDate });
    const m = r.perSubject.find((s) => s.subject === "math")!;
    expect(m.daysInARow).toBe(10);
    expect(m.kidLine).toMatch(/on fire/i);
  });

  it("is deterministic", () => {
    const a = computeKidStreaks({ todayISO: FRI, dailyByDate: { [THU]: { math: 30 }, [FRI]: { math: 30 } } });
    const b = computeKidStreaks({ todayISO: FRI, dailyByDate: { [THU]: { math: 30 }, [FRI]: { math: 30 } } });
    expect(b).toEqual(a);
  });
});
