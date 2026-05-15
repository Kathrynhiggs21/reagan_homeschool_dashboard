import { describe, it, expect } from "vitest";
import { runKiwiPanelEntry } from "./_lib/kiwiPanelEntryBundle";

const MIN = 60_000;

describe("kiwiPanelEntryBundle — one-call panel mount", () => {
  it("first visit returns shouldGreet=true, greeting and clock populated", () => {
    const t = Date.UTC(2026, 4, 15, 14, 0, 0); // 14:00 UTC = 10:00 NY
    const r = runKiwiPanelEntry({
      prior: null,
      panel: "today",
      nowUtcMs: t,
      timeZone: "America/New_York",
    });
    expect(r.shouldGreet).toBe(true);
    expect(r.reason).toBe("first_visit");
    expect(r.greeting).not.toBeNull();
    expect(r.greeting!.panel).toBe("today");
    expect(r.greeting!.bucket).toBe("morning");
    expect(r.clock).not.toBeNull();
    expect(r.clock!.localHour).toBe(10);
    expect(r.state.panels["today"]).toBe(t);
  });

  it("suppressed re-visit returns no greeting and no clock", () => {
    const t1 = Date.UTC(2026, 4, 15, 14, 0, 0);
    const t2 = t1 + 3 * MIN; // within default 10-min window
    const r1 = runKiwiPanelEntry({
      prior: null,
      panel: "today",
      nowUtcMs: t1,
      timeZone: "America/New_York",
    });
    const r2 = runKiwiPanelEntry({
      prior: r1.state,
      panel: "today",
      nowUtcMs: t2,
      timeZone: "America/New_York",
    });
    expect(r2.shouldGreet).toBe(false);
    expect(r2.greeting).toBeNull();
    expect(r2.clock).toBeNull();
    expect(r2.reason).toBe("suppressed");
    // State unchanged
    expect(r2.state.panels["today"]).toBe(t1);
  });

  it("greet again after window with updated record", () => {
    const t1 = Date.UTC(2026, 4, 15, 14, 0, 0);
    const t2 = t1 + 11 * MIN;
    const r1 = runKiwiPanelEntry({
      prior: null,
      panel: "today",
      nowUtcMs: t1,
      timeZone: "America/New_York",
    });
    const r2 = runKiwiPanelEntry({
      prior: r1.state,
      panel: "today",
      nowUtcMs: t2,
      timeZone: "America/New_York",
    });
    expect(r2.shouldGreet).toBe(true);
    expect(r2.reason).toBe("outside_window");
    expect(r2.greeting).not.toBeNull();
    expect(r2.state.panels["today"]).toBe(t2);
  });

  it("panel isolation: greeting today doesn't suppress kiwi entry", () => {
    const t1 = Date.UTC(2026, 4, 15, 14, 0, 0);
    const a = runKiwiPanelEntry({
      prior: null,
      panel: "today",
      nowUtcMs: t1,
      timeZone: "America/New_York",
    });
    const b = runKiwiPanelEntry({
      prior: a.state,
      panel: "kiwi",
      nowUtcMs: t1 + 30_000,
      timeZone: "America/New_York",
    });
    expect(b.shouldGreet).toBe(true);
    expect(b.greeting!.panel).toBe("kiwi");
    // 'kiwi' greeting must include canonical identity phrasing
    expect(b.greeting!.greeting).toMatch(/I'm (Kiwi|here)/);
  });

  it("time-of-day bucket drives greeting selection", () => {
    const morning = runKiwiPanelEntry({
      prior: null,
      panel: "today",
      nowUtcMs: Date.UTC(2026, 4, 15, 14, 0, 0), // 10 NY
      timeZone: "America/New_York",
    });
    const evening = runKiwiPanelEntry({
      prior: null,
      panel: "today",
      nowUtcMs: Date.UTC(2026, 4, 15, 22, 0, 0), // 18 NY (evening)
      timeZone: "America/New_York",
    });
    expect(morning.greeting!.bucket).toBe("morning");
    expect(evening.greeting!.bucket).toBe("evening");
  });

  it("invalid timezone falls back to UTC and still greets", () => {
    const t = Date.UTC(2026, 4, 15, 9, 0, 0);
    const r = runKiwiPanelEntry({
      prior: null,
      panel: "today",
      nowUtcMs: t,
      timeZone: "Not/Real",
    });
    expect(r.shouldGreet).toBe(true);
    expect(r.clock!.timeZone).toBe("UTC");
    expect(r.clock!.localHour).toBe(9);
  });

  it("null timezone allowed; falls back to UTC", () => {
    const t = Date.UTC(2026, 4, 15, 12, 0, 0);
    const r = runKiwiPanelEntry({
      prior: null,
      panel: "today",
      nowUtcMs: t,
      timeZone: null,
    });
    expect(r.clock!.timeZone).toBe("UTC");
  });

  it("schedule greeting includes dual-adult approval reminder", () => {
    for (let day = 0; day < 3; day++) {
      const r = runKiwiPanelEntry({
        prior: null,
        panel: "schedule",
        nowUtcMs: Date.UTC(2026, 4, 15 + day, 14, 0, 0),
        timeZone: "America/New_York",
      });
      const ok =
        /Mom and Grandma/.test(r.greeting!.greeting) ||
        /both adults/.test(r.greeting!.greeting) ||
        /approval/.test(r.greeting!.greeting) ||
        /Reviewing/.test(r.greeting!.greeting);
      if (!ok) {
        throw new Error(`schedule greeting missing rule context: ${r.greeting!.greeting}`);
      }
    }
  });

  it("greeting never contains forbidden kiddy/pet-name register", () => {
    const FORBIDDEN = /\b(buddy|friend|pal|kiddo|sweetie|champ)\b/i;
    for (const panel of ["today", "kiwi", "schedule", "feeling", "stuck"]) {
      for (let h = 0; h < 24; h += 4) {
        for (let day = 0; day < 5; day++) {
          const r = runKiwiPanelEntry({
            prior: null,
            panel,
            nowUtcMs: Date.UTC(2026, 4, 15 + day, h, 0, 0),
            timeZone: "UTC",
          });
          expect(r.greeting!.greeting).not.toMatch(FORBIDDEN);
          expect(r.greeting!.greeting).not.toMatch(/!/);
        }
      }
    }
  });

  it("does not mutate prior state object", () => {
    const prior = { panels: { today: Date.UTC(2026, 4, 15, 14, 0, 0) } };
    const before = JSON.stringify(prior);
    runKiwiPanelEntry({
      prior,
      panel: "today",
      nowUtcMs: Date.UTC(2026, 4, 15, 14, 5, 0), // within window
      timeZone: "America/New_York",
    });
    expect(JSON.stringify(prior)).toBe(before);
  });

  it("is deterministic — same input → same output", () => {
    const input = {
      prior: null,
      panel: "today" as const,
      nowUtcMs: Date.UTC(2026, 4, 15, 14, 0, 0),
      timeZone: "America/New_York",
    };
    const a = runKiwiPanelEntry(input);
    const b = runKiwiPanelEntry(input);
    expect(a).toEqual(b);
  });

  it("custom suppress window flows through to tracker", () => {
    const t1 = Date.UTC(2026, 4, 15, 14, 0, 0);
    const r1 = runKiwiPanelEntry({
      prior: null,
      panel: "today",
      nowUtcMs: t1,
      timeZone: "UTC",
      suppressWindowMs: 60_000, // 1 min
    });
    const r2 = runKiwiPanelEntry({
      prior: r1.state,
      panel: "today",
      nowUtcMs: t1 + 90_000,
      timeZone: "UTC",
      suppressWindowMs: 60_000,
    });
    expect(r2.shouldGreet).toBe(true);
    expect(r2.reason).toBe("outside_window");
  });
});
